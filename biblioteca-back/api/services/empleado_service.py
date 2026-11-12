from .. import sql

ESTADOS = ('ACTIVO', 'INACTIVO', 'BLOQUEADO')

CONSULTA_EMPLEADOS = """
    SELECT e.id_empleado, e.usuario, pe.nombres, pe.apellidos, r.nombre AS rol, s.nombre AS sede,
           e.estado, e.intentos_fallidos, e.ultimo_acceso
      FROM empleados e
      JOIN personas pe ON pe.id_persona = e.id_empleado
      JOIN roles r ON r.id_rol = e.id_rol
      JOIN sedes s ON s.id_sede = e.id_sede
"""

ORDEN = ' ORDER BY pe.apellidos, pe.nombres, e.id_empleado'


def listar(estado):
    if estado is None:
        return sql.consultar(CONSULTA_EMPLEADOS + ORDEN)
    return sql.consultar(CONSULTA_EMPLEADOS + ' WHERE e.estado = %s' + ORDEN, [estado])


def existe(id_empleado):
    return sql.existe('SELECT 1 FROM empleados WHERE id_empleado = %s', [id_empleado])


def desbloquear(id_empleado):
    return sql.llamar('sp_desbloquear_empleado', [id_empleado], 2)
