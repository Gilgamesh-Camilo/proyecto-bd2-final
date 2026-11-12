from .. import sql

CONSULTA_EMPLEADO = """
    SELECT e.id_empleado, e.usuario, e.contrasena_hash, e.estado, p.nombres, p.apellidos,
           r.nombre AS rol, e.id_sede, s.nombre AS sede
      FROM empleados e
      JOIN personas p ON p.id_persona = e.id_empleado
      JOIN roles r ON r.id_rol = e.id_rol
      JOIN sedes s ON s.id_sede = e.id_sede
"""


def publico(fila):
    return {
        'id_empleado': fila['id_empleado'],
        'usuario': fila['usuario'],
        'nombres': fila['nombres'],
        'apellidos': fila['apellidos'],
        'rol': fila['rol'],
        'id_sede': fila['id_sede'],
        'sede': fila['sede'],
    }


def buscar_por_usuario(usuario):
    return sql.consultar_uno(CONSULTA_EMPLEADO + ' WHERE LOWER(e.usuario) = LOWER(%s)', [usuario])


def empleado_activo(id_empleado):
    fila = sql.consultar_uno(CONSULTA_EMPLEADO + " WHERE e.id_empleado = %s AND e.estado = 'ACTIVO'", [id_empleado])
    if fila is None:
        return None
    return publico(fila)


def registrar_acceso(id_empleado, exitoso):
    return sql.llamar('sp_registrar_acceso', [id_empleado, exitoso], 2)
