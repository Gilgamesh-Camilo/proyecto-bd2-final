import logging

from psycopg2.extras import Json
from pymongo.errors import PyMongoError

from .. import sql
from ..mongo_service import BUSQUEDAS, FICHAS, RESENAS, MongoService
from ..validaciones import patron_busqueda

registro = logging.getLogger('api')

IDIOMAS = ('es', 'en', 'fr', 'pt', 'it', 'de')

ESTADOS_MANUALES = ('DISPONIBLE', 'EN_REPARACION', 'PERDIDO', 'DE_BAJA')

ROLES_AUTOR = ('AUTOR', 'COAUTOR', 'EDITOR', 'TRADUCTOR', 'ILUSTRADOR')

CONSULTA_LIBROS = """
    SELECT l.id_libro, l.isbn, l.titulo, l.subtitulo, l.anio_publicacion, l.idioma,
           c.nombre AS categoria, ed.nombre AS editorial,
           COALESCE((SELECT STRING_AGG(a.nombres || ' ' || a.apellidos, ', ' ORDER BY la.orden)
                       FROM libros_autores la
                       JOIN autores a ON a.id_autor = la.id_autor
                      WHERE la.id_libro = l.id_libro), '') AS autores
      FROM libros l
      JOIN categorias c ON c.id_categoria = l.id_categoria
      JOIN editoriales ed ON ed.id_editorial = l.id_editorial
"""


def ids_por_texto(termino):
    cursor = MongoService.coleccion(FICHAS).find({'$text': {'$search': termino}}, {'_id': 0, 'id_libro': 1})
    return [doc['id_libro'] for doc in cursor if isinstance(doc.get('id_libro'), int)]


def buscar(termino, id_categoria, id_sede, ids_texto):
    condiciones = []
    parametros = []
    if termino is not None:
        patron = patron_busqueda(termino)
        condiciones.append(
            """
            (l.titulo ILIKE %s OR l.subtitulo ILIKE %s OR l.isbn ILIKE %s
             OR EXISTS (SELECT 1
                          FROM libros_autores la
                          JOIN autores a ON a.id_autor = la.id_autor
                         WHERE la.id_libro = l.id_libro
                           AND a.nombres || ' ' || a.apellidos ILIKE %s)
             OR l.id_libro = ANY(%s::INTEGER[]))
            """
        )
        parametros += [patron, patron, patron, patron, ids_texto]
    if id_categoria is not None:
        condiciones.append('l.id_categoria = %s')
        parametros.append(id_categoria)
    if id_sede is not None:
        condiciones.append('EXISTS (SELECT 1 FROM ejemplares x WHERE x.id_libro = l.id_libro AND x.id_sede = %s)')
        parametros.append(id_sede)
    filtro = ''
    if condiciones:
        filtro = ' WHERE ' + ' AND '.join(condiciones)
    libros = sql.consultar(CONSULTA_LIBROS + filtro + ' ORDER BY l.titulo, l.id_libro', parametros)
    disponibilidad = disponibilidad_por_sede([libro['id_libro'] for libro in libros])
    for libro in libros:
        por_sede = disponibilidad.get(libro['id_libro'], [])
        libro['por_sede'] = por_sede
        libro['total_ejemplares'] = sum(sede['total'] for sede in por_sede)
        libro['disponibles'] = sum(sede['disponibles'] for sede in por_sede)
    return libros


def disponibilidad_por_sede(ids):
    if not ids:
        return {}
    filas = sql.consultar(
        """
        SELECT l.id_libro, s.id_sede, s.nombre AS sede,
               COUNT(e.id_ejemplar) AS total,
               COUNT(e.id_ejemplar) FILTER (WHERE e.estado = 'DISPONIBLE') AS disponibles
          FROM libros l
         CROSS JOIN sedes s
          LEFT JOIN ejemplares e ON e.id_libro = l.id_libro AND e.id_sede = s.id_sede
         WHERE l.id_libro = ANY(%s::INTEGER[])
         GROUP BY l.id_libro, s.id_sede, s.nombre, s.estado
        HAVING s.estado = 'ACTIVA' OR COUNT(e.id_ejemplar) > 0
         ORDER BY s.id_sede
        """,
        [ids],
    )
    resultado = {}
    for fila in filas:
        resultado.setdefault(fila.pop('id_libro'), []).append(fila)
    return resultado


def existe(id_libro):
    return sql.existe('SELECT 1 FROM libros WHERE id_libro = %s', [id_libro])


def detalle(id_libro):
    libro = sql.consultar_uno(
        """
        SELECT l.id_libro, l.isbn, l.titulo, l.subtitulo, l.anio_publicacion, l.edicion, l.numero_paginas,
               l.idioma, c.nombre AS categoria, c.codigo_dewey, ed.nombre AS editorial, ed.pais AS pais_editorial
          FROM libros l
          JOIN categorias c ON c.id_categoria = l.id_categoria
          JOIN editoriales ed ON ed.id_editorial = l.id_editorial
         WHERE l.id_libro = %s
        """,
        [id_libro],
    )
    if libro is None:
        return None
    libro['autores'] = sql.consultar(
        """
        SELECT a.id_autor, a.nombres, a.apellidos, a.nacionalidad, la.rol_autor, la.orden
          FROM libros_autores la
          JOIN autores a ON a.id_autor = la.id_autor
         WHERE la.id_libro = %s
         ORDER BY la.orden
        """,
        [id_libro],
    )
    libro['ejemplares'] = sql.consultar(
        """
        SELECT e.id_ejemplar, e.codigo_barras, e.estado, e.ubicacion_estante, e.id_sede, s.nombre AS sede
          FROM ejemplares e
          JOIN sedes s ON s.id_sede = e.id_sede
         WHERE e.id_libro = %s
         ORDER BY s.nombre, e.codigo_barras
        """,
        [id_libro],
    )
    libro['ficha'] = ficha(id_libro)
    libro['calificacion'] = calificacion(id_libro)
    return libro


def ficha(id_libro):
    try:
        doc = MongoService.coleccion(FICHAS).find_one({'id_libro': id_libro}, {'_id': 0})
    except PyMongoError:
        registro.warning('No se pudo leer la ficha del libro %s', id_libro)
        return None
    if not isinstance(doc, dict):
        return None
    return {
        'sinopsis': texto_o_vacio(doc.get('sinopsis')),
        'palabras_clave': [p for p in lista(doc.get('palabras_clave')) if isinstance(p, str)],
        'tabla_contenido': [c for c in lista(doc.get('tabla_contenido')) if isinstance(c, dict)],
        'premios': [p for p in lista(doc.get('premios')) if isinstance(p, dict)],
        'adaptaciones': [a for a in lista(doc.get('adaptaciones')) if isinstance(a, dict)],
        'nivel': texto_o_vacio(doc.get('nivel')),
    }


def calificacion(id_libro):
    try:
        grupos = list(
            MongoService.coleccion(RESENAS).aggregate(
                [
                    {'$match': {'id_libro': id_libro}},
                    {'$group': {'_id': '$id_libro', 'promedio': {'$avg': '$calificacion'}, 'total': {'$sum': 1}}},
                ]
            )
        )
    except PyMongoError:
        registro.warning('No se pudo calcular la calificación del libro %s', id_libro)
        return None
    if not grupos:
        return {'promedio': None, 'total': 0}
    return {'promedio': round(float(grupos[0]['promedio']), 2), 'total': int(grupos[0]['total'])}


def ejemplar_por_codigo(codigo):
    return sql.consultar_uno(
        """
        SELECT e.id_ejemplar, e.codigo_barras, e.estado, e.id_sede, s.nombre AS sede, l.id_libro, l.titulo
          FROM ejemplares e
          JOIN sedes s ON s.id_sede = e.id_sede
          JOIN libros l ON l.id_libro = e.id_libro
         WHERE UPPER(e.codigo_barras) = UPPER(%s)
        """,
        [codigo],
    )


def registrar_busqueda(termino, filtros, total, empleado):
    try:
        MongoService.coleccion(BUSQUEDAS).insert_one(
            {
                'fecha': MongoService.ahora(),
                'termino': termino,
                'filtros': filtros,
                'total_resultados': total,
                'sede': empleado['id_sede'],
                'canal': 'MOSTRADOR',
                'usuario': empleado['usuario'],
            }
        )
    except PyMongoError:
        registro.warning('No se pudo registrar la búsqueda "%s"', termino)


def lista(valor):
    if isinstance(valor, list):
        return valor
    return []


def texto_o_vacio(valor):
    if isinstance(valor, str):
        return valor
    return ''


def buscar_catalogo(termino, id_categoria, id_sede, empleado):
    ids_texto = []
    documental = True
    if termino is not None:
        try:
            ids_texto = ids_por_texto(termino)
        except PyMongoError:
            documental = False
            registro.warning('La búsqueda de texto en las fichas no está disponible')
    libros = buscar(termino, id_categoria, id_sede, ids_texto)
    if termino is not None and documental:
        filtros = {}
        if id_categoria is not None:
            filtros['id_categoria'] = id_categoria
        if id_sede is not None:
            filtros['id_sede'] = id_sede
        registrar_busqueda(termino, filtros, len(libros), empleado)
    return libros


def editoriales():
    return sql.consultar('SELECT id_editorial, nombre, pais FROM editoriales ORDER BY nombre')


def autores():
    return sql.consultar(
        'SELECT id_autor, nombres, apellidos, nacionalidad FROM autores ORDER BY apellidos, nombres, id_autor'
    )


def registrar(libro, ejemplares):
    return sql.llamar(
        'sp_registrar_libro',
        [
            libro['isbn'],
            libro['titulo'],
            libro['subtitulo'],
            libro['anio_publicacion'],
            libro['edicion'],
            libro['numero_paginas'],
            libro['idioma'],
            libro['id_editorial'],
            libro['id_categoria'],
            Json(libro['autores']),
            ejemplares['id_sede'],
            ejemplares['cantidad'],
            ejemplares['ubicacion_estante'],
            ejemplares['valor_reposicion'],
        ],
        3,
    )


def registrar_ejemplares(id_libro, ejemplares):
    return sql.llamar(
        'sp_registrar_ejemplares',
        [
            id_libro,
            ejemplares['id_sede'],
            ejemplares['cantidad'],
            ejemplares['ubicacion_estante'],
            ejemplares['valor_reposicion'],
        ],
        2,
    )


def crear_ficha(id_libro, libro):
    categoria = sql.consultar_uno('SELECT nombre FROM categorias WHERE id_categoria = %s', [libro['id_categoria']])
    documento = {
        'id_libro': id_libro,
        'isbn': libro['isbn'],
        'titulo': libro['titulo'],
        'categoria': categoria['nombre'],
        'actualizado_en': MongoService.ahora(),
    }
    if libro['sinopsis'] is not None:
        documento['sinopsis'] = libro['sinopsis']
    if libro['palabras_clave']:
        documento['palabras_clave'] = libro['palabras_clave']
    try:
        MongoService.coleccion(FICHAS).insert_one(documento)
    except PyMongoError:
        registro.warning('No se pudo crear la ficha del libro %s', id_libro)
        return False
    return True


def ejemplar_existe(id_ejemplar):
    return sql.existe('SELECT 1 FROM ejemplares WHERE id_ejemplar = %s', [id_ejemplar])


def cambiar_estado_ejemplar(id_ejemplar, estado):
    return sql.llamar('sp_cambiar_estado_ejemplar', [id_ejemplar, estado], 2)
