from .. import sql

ESTADOS = ('ACTIVA', 'CERRADA')


def listar():
    return sql.consultar(
        """
        SELECT s.id_sede, s.nombre, s.direccion, s.ciudad, s.telefono, s.fecha_apertura, s.estado,
               (SELECT COUNT(*) FROM ejemplares e
                 WHERE e.id_sede = s.id_sede AND e.estado <> 'DE_BAJA') AS ejemplares,
               (SELECT COUNT(*) FROM empleados em
                 WHERE em.id_sede = s.id_sede AND em.estado = 'ACTIVO') AS empleados
          FROM sedes s
         ORDER BY s.nombre
        """
    )


def existe(id_sede):
    return sql.existe('SELECT 1 FROM sedes WHERE id_sede = %s', [id_sede])


def registrar(datos):
    return sql.llamar(
        'sp_registrar_sede',
        [datos['nombre'], datos['direccion'], datos['ciudad'], datos['telefono'], datos['fecha_apertura']],
        2,
    )


def cambiar_estado(id_sede, estado):
    return sql.llamar('sp_cambiar_estado_sede', [id_sede, estado], 2)
