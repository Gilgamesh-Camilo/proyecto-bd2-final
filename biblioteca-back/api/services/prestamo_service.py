from .. import sql
from ..validaciones import patron_busqueda

ESTADOS = ('ACTIVO', 'VENCIDO', 'DEVUELTO', 'PERDIDO')

CONSULTA_PRESTAMOS = """
    SELECT p.id_prestamo, p.id_socio, ps.nombres || ' ' || ps.apellidos AS socio, ps.numero_documento,
           l.id_libro, l.titulo, e.codigo_barras, sp.nombre AS sede_prestamo, sd.nombre AS sede_devolucion,
           p.fecha_prestamo, p.fecha_limite, p.fecha_devolucion, p.num_renovaciones, p.estado,
           fn_dias_retraso(p.id_prestamo) AS dias_retraso,
           pe.nombres || ' ' || pe.apellidos AS registrado_por
      FROM prestamos p
      JOIN personas ps ON ps.id_persona = p.id_socio
      JOIN ejemplares e ON e.id_ejemplar = p.id_ejemplar
      JOIN libros l ON l.id_libro = e.id_libro
      JOIN sedes sp ON sp.id_sede = p.id_sede_prestamo
      LEFT JOIN sedes sd ON sd.id_sede = p.id_sede_devolucion
      JOIN personas pe ON pe.id_persona = p.id_empleado
"""

ORDEN = ' ORDER BY p.fecha_prestamo DESC, p.id_prestamo DESC'


def listar(estado, id_sede, termino):
    condiciones = []
    parametros = []
    if estado is not None:
        condiciones.append('p.estado = %s')
        parametros.append(estado)
    if id_sede is not None:
        condiciones.append('p.id_sede_prestamo = %s')
        parametros.append(id_sede)
    if termino is not None:
        patron = patron_busqueda(termino)
        condiciones.append(
            "(ps.nombres || ' ' || ps.apellidos ILIKE %s OR ps.numero_documento ILIKE %s"
            ' OR l.titulo ILIKE %s OR e.codigo_barras ILIKE %s)'
        )
        parametros += [patron, patron, patron, patron]
    filtro = ''
    if condiciones:
        filtro = ' WHERE ' + ' AND '.join(condiciones)
    return sql.consultar(CONSULTA_PRESTAMOS + filtro + ORDEN, parametros)


def de_socio(id_socio):
    return sql.consultar(CONSULTA_PRESTAMOS + ' WHERE p.id_socio = %s' + ORDEN, [id_socio])


def detalle(id_prestamo):
    prestamo = sql.consultar_uno(CONSULTA_PRESTAMOS + ' WHERE p.id_prestamo = %s', [id_prestamo])
    if prestamo is None:
        return None
    adicional = sql.consultar_uno(
        """
        SELECT CASE WHEN p.estado IN ('ACTIVO', 'VENCIDO') THEN fn_valor_multa_retraso(p.id_prestamo) ELSE 0 END
                   AS valor_multa_estimado,
               m.estado AS multa_estado, m.valor AS multa_valor
          FROM prestamos p
          LEFT JOIN multas m ON m.id_prestamo = p.id_prestamo
         WHERE p.id_prestamo = %s
        """,
        [id_prestamo],
    )
    prestamo['valor_multa_estimado'] = adicional['valor_multa_estimado']
    prestamo['multa'] = None
    if adicional['multa_estado'] is not None:
        prestamo['multa'] = {'estado': adicional['multa_estado'], 'valor': adicional['multa_valor']}
    return prestamo


def existe(id_prestamo):
    return sql.existe('SELECT 1 FROM prestamos WHERE id_prestamo = %s', [id_prestamo])


def socio_devolvio_libro(id_socio, id_libro):
    return sql.existe(
        """
        SELECT 1
          FROM prestamos p
          JOIN ejemplares e ON e.id_ejemplar = p.id_ejemplar
         WHERE p.id_socio = %s AND e.id_libro = %s AND p.estado = 'DEVUELTO'
         LIMIT 1
        """,
        [id_socio, id_libro],
    )


def registrar(id_ejemplar, id_socio, id_empleado):
    return sql.llamar('sp_registrar_prestamo', [id_ejemplar, id_socio, id_empleado], 2)


def devolver(id_prestamo, id_empleado):
    return sql.llamar('sp_registrar_devolucion', [id_prestamo, id_empleado], 2)


def renovar(id_prestamo):
    return sql.llamar('sp_renovar_prestamo', [id_prestamo], 2)
