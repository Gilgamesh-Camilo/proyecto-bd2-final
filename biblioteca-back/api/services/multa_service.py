from .. import sql

ESTADOS = ('PENDIENTE', 'PAGADA', 'CONDONADA')

MOTIVOS_MANUALES = ('DANO', 'PERDIDA')

CONSULTA_MULTAS = """
    SELECT m.id_prestamo, m.motivo, m.valor, m.estado, m.fecha_generacion, m.fecha_pago,
           p.id_socio, pe.nombres || ' ' || pe.apellidos AS socio, pe.numero_documento, l.titulo
      FROM multas m
      JOIN prestamos p ON p.id_prestamo = m.id_prestamo
      JOIN personas pe ON pe.id_persona = p.id_socio
      JOIN ejemplares e ON e.id_ejemplar = p.id_ejemplar
      JOIN libros l ON l.id_libro = e.id_libro
"""

ORDEN = ' ORDER BY m.fecha_generacion DESC, m.id_prestamo DESC'


def listar(estado):
    if estado is None:
        return sql.consultar(CONSULTA_MULTAS + ORDEN)
    return sql.consultar(CONSULTA_MULTAS + ' WHERE m.estado = %s' + ORDEN, [estado])


def de_socio(id_socio):
    return sql.consultar(CONSULTA_MULTAS + ' WHERE p.id_socio = %s' + ORDEN, [id_socio])


def pagar(id_prestamo):
    return sql.llamar('sp_pagar_multa', [id_prestamo], 2)


def condonar(id_prestamo):
    return sql.llamar('sp_condonar_multa', [id_prestamo], 2)


def registrar(id_prestamo, motivo, valor, id_empleado):
    return sql.llamar('sp_registrar_multa', [id_prestamo, motivo, valor, id_empleado], 2)
