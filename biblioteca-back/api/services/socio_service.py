import logging

from pymongo.errors import PyMongoError

from .. import sql
from ..mongo_service import LISTAS, MongoService
from ..validaciones import patron_busqueda

registro = logging.getLogger('api')

TIPOS_DOCUMENTO = ('CC', 'TI', 'CE', 'PA')

ESTADOS = ('ACTIVO', 'SUSPENDIDO', 'RETIRADO')

CONSULTA_SOCIOS = """
    SELECT s.id_socio, pe.tipo_documento, pe.numero_documento, pe.nombres, pe.apellidos, pe.email, pe.telefono,
           ts.nombre AS tipo_socio, s.estado, c.numero_carne, c.estado AS estado_carne,
           (SELECT COUNT(*) FROM prestamos p
             WHERE p.id_socio = s.id_socio AND p.estado IN ('ACTIVO', 'VENCIDO')) AS prestamos_abiertos,
           (SELECT COUNT(*) FROM multas m
              JOIN prestamos p ON p.id_prestamo = m.id_prestamo
             WHERE p.id_socio = s.id_socio AND m.estado = 'PENDIENTE') AS multas_pendientes,
           fn_motivo_bloqueo_socio(s.id_socio, TRUE) AS motivo_bloqueo
      FROM socios s
      JOIN personas pe ON pe.id_persona = s.id_socio
      JOIN tipos_socio ts ON ts.id_tipo_socio = s.id_tipo_socio
      LEFT JOIN carnes c ON c.id_socio = s.id_socio
"""

ORDEN = ' ORDER BY pe.apellidos, pe.nombres, s.id_socio'


def buscar(termino):
    if termino is None:
        return sql.consultar(CONSULTA_SOCIOS + ORDEN)
    patron = patron_busqueda(termino)
    return sql.consultar(
        CONSULTA_SOCIOS
        + " WHERE pe.nombres || ' ' || pe.apellidos ILIKE %s OR pe.numero_documento ILIKE %s"
        + ' OR c.numero_carne ILIKE %s'
        + ORDEN,
        [patron, patron, patron],
    )


def por_documento(documento):
    return sql.consultar(CONSULTA_SOCIOS + ' WHERE UPPER(pe.numero_documento) = UPPER(%s)' + ORDEN, [documento])


def existe(id_socio):
    return sql.existe('SELECT 1 FROM socios WHERE id_socio = %s', [id_socio])


def detalle(id_socio):
    socio = sql.consultar_uno(CONSULTA_SOCIOS + ' WHERE s.id_socio = %s', [id_socio])
    if socio is None:
        return None
    adicional = sql.consultar_uno(
        """
        SELECT pe.fecha_nacimiento, s.direccion, s.fecha_registro, c.fecha_expedicion, c.fecha_vencimiento,
               ts.max_prestamos, ts.dias_prestamo, ts.valor_multa_dia
          FROM socios s
          JOIN personas pe ON pe.id_persona = s.id_socio
          JOIN tipos_socio ts ON ts.id_tipo_socio = s.id_tipo_socio
          LEFT JOIN carnes c ON c.id_socio = s.id_socio
         WHERE s.id_socio = %s
        """,
        [id_socio],
    )
    socio.update(adicional)
    return socio


def nombres(ids):
    if not ids:
        return {}
    filas = sql.consultar(
        "SELECT id_persona, nombres || ' ' || apellidos AS nombre FROM personas WHERE id_persona = ANY(%s::INTEGER[])",
        [ids],
    )
    return {fila['id_persona']: fila['nombre'] for fila in filas}


def listas_lectura(id_socio):
    try:
        documentos = list(
            MongoService.coleccion(LISTAS).find({'id_socio': id_socio}).sort([('creada', -1), ('_id', 1)])
        )
    except PyMongoError:
        registro.warning('No se pudieron leer las listas de lectura del socio %s', id_socio)
        return None
    listas = []
    for doc in documentos:
        libros = []
        contenido = doc.get('libros')
        if not isinstance(contenido, list):
            contenido = []
        for libro in contenido:
            if isinstance(libro, dict) and isinstance(libro.get('titulo'), str):
                libros.append({'titulo': libro['titulo'], 'leido': libro.get('leido') is True})
        listas.append(
            {
                'id': str(doc['_id']),
                'nombre': doc.get('nombre') if isinstance(doc.get('nombre'), str) else '',
                'publica': doc.get('publica') is True,
                'libros': libros,
            }
        )
    return listas


def registrar(datos):
    return sql.llamar(
        'sp_registrar_socio',
        [
            datos['tipo_documento'],
            datos['numero_documento'],
            datos['nombres'],
            datos['apellidos'],
            datos['fecha_nacimiento'],
            datos['email'],
            datos['telefono'],
            datos['direccion'],
            datos['id_tipo_socio'],
        ],
        3,
    )


def cambiar_estado(id_socio, estado):
    return sql.llamar('sp_cambiar_estado_socio', [id_socio, estado], 2)


def renovar_carne(id_socio):
    return sql.llamar('sp_renovar_carne', [id_socio], 2)
