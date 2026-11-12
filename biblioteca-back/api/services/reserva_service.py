from .. import sql

ESTADOS = ('EN_ESPERA', 'DISPONIBLE', 'ATENDIDA', 'CANCELADA', 'EXPIRADA')

CONSULTA_RESERVAS = """
    SELECT r.id_reserva, r.id_socio, pe.nombres || ' ' || pe.apellidos AS socio, pe.numero_documento,
           r.id_libro, l.titulo, se.nombre AS sede_retiro, e.codigo_barras,
           r.fecha_reserva, r.fecha_expiracion, r.estado
      FROM reservas r
      JOIN personas pe ON pe.id_persona = r.id_socio
      JOIN libros l ON l.id_libro = r.id_libro
      JOIN sedes se ON se.id_sede = r.id_sede_retiro
      LEFT JOIN ejemplares e ON e.id_ejemplar = r.id_ejemplar
"""

ORDEN = ' ORDER BY r.fecha_reserva DESC, r.id_reserva DESC'


def listar(estado):
    if estado is None:
        return sql.consultar(CONSULTA_RESERVAS + ORDEN)
    return sql.consultar(CONSULTA_RESERVAS + ' WHERE r.estado = %s' + ORDEN, [estado])


def de_socio(id_socio):
    return sql.consultar(CONSULTA_RESERVAS + ' WHERE r.id_socio = %s' + ORDEN, [id_socio])


def crear(id_socio, id_libro, id_sede):
    return sql.llamar('sp_crear_reserva', [id_socio, id_libro, id_sede], 3)


def cancelar(id_reserva):
    return sql.llamar('sp_cancelar_reserva', [id_reserva], 2)
