from .. import sql

ESTADOS = ('SOLICITADO', 'EN_TRANSITO', 'RECIBIDO', 'CANCELADO')

CONSULTA_TRASLADOS = """
    SELECT t.id_traslado, e.codigo_barras, l.titulo, t.id_sede_origen, so.nombre AS sede_origen,
           t.id_sede_destino, sd.nombre AS sede_destino, pe.nombres || ' ' || pe.apellidos AS solicitado_por,
           t.fecha_solicitud, t.fecha_envio, t.fecha_recepcion, t.estado, t.motivo
      FROM traslados t
      JOIN ejemplares e ON e.id_ejemplar = t.id_ejemplar
      JOIN libros l ON l.id_libro = e.id_libro
      JOIN sedes so ON so.id_sede = t.id_sede_origen
      JOIN sedes sd ON sd.id_sede = t.id_sede_destino
      JOIN personas pe ON pe.id_persona = t.id_empleado
"""

ORDEN = ' ORDER BY t.fecha_solicitud DESC, t.id_traslado DESC'


def listar(estado):
    if estado is None:
        return sql.consultar(CONSULTA_TRASLADOS + ORDEN)
    return sql.consultar(CONSULTA_TRASLADOS + ' WHERE t.estado = %s' + ORDEN, [estado])


def solicitar(id_ejemplar, id_sede_destino, id_empleado, motivo):
    return sql.llamar('sp_solicitar_traslado', [id_ejemplar, id_sede_destino, id_empleado, motivo], 2)


def avanzar(id_traslado, id_empleado):
    return sql.llamar('sp_avanzar_traslado', [id_traslado, id_empleado], 2)
