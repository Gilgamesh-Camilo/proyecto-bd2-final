from .. import sql

TABLAS = ('prestamos', 'multas', 'reservas', 'traslados', 'ejemplares', 'socios', 'empleados')

LIMITE = 200

CONSULTA_AUDITORIA = """
    SELECT id_auditoria, tabla_afectada, operacion, clave_registro, usuario_bd, fecha,
           valores_anteriores, valores_nuevos
      FROM auditoria
"""


def listar(tabla):
    if tabla is None:
        return sql.consultar(CONSULTA_AUDITORIA + ' ORDER BY id_auditoria DESC LIMIT %s', [LIMITE])
    return sql.consultar(
        CONSULTA_AUDITORIA + ' WHERE tabla_afectada = %s ORDER BY id_auditoria DESC LIMIT %s',
        [tabla, LIMITE],
    )
