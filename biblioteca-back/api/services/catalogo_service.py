from .. import sql


def sedes():
    return sql.consultar('SELECT id_sede, nombre, ciudad, estado FROM sedes ORDER BY nombre')


def categorias():
    return sql.consultar('SELECT id_categoria, codigo_dewey, nombre FROM categorias ORDER BY nombre')


def tipos_socio():
    return sql.consultar(
        """
        SELECT id_tipo_socio, nombre, max_prestamos, dias_prestamo, max_renovaciones, valor_multa_dia
          FROM tipos_socio
         ORDER BY id_tipo_socio
        """
    )


def sede_activa(id_sede):
    return sql.existe("SELECT 1 FROM sedes WHERE id_sede = %s AND estado = 'ACTIVA'", [id_sede])


def categoria_existe(id_categoria):
    return sql.existe('SELECT 1 FROM categorias WHERE id_categoria = %s', [id_categoria])


def tipo_socio_existe(id_tipo_socio):
    return sql.existe('SELECT 1 FROM tipos_socio WHERE id_tipo_socio = %s', [id_tipo_socio])


def resumen(id_sede):
    return sql.consultar_uno(
        """
        SELECT
            (SELECT COUNT(*) FROM prestamos
              WHERE estado = 'ACTIVO' AND fecha_limite >= CURRENT_DATE) AS prestamos_al_dia,
            (SELECT COUNT(*) FROM prestamos
              WHERE estado = 'VENCIDO' OR (estado = 'ACTIVO' AND fecha_limite < CURRENT_DATE)) AS prestamos_vencidos,
            (SELECT COUNT(*) FROM multas WHERE estado = 'PENDIENTE') AS multas_pendientes,
            (SELECT COALESCE(SUM(valor), 0) FROM multas WHERE estado = 'PENDIENTE') AS valor_multas_pendientes,
            (SELECT COUNT(*) FROM reservas WHERE estado = 'EN_ESPERA') AS reservas_en_espera,
            (SELECT COUNT(*) FROM reservas WHERE estado = 'DISPONIBLE') AS reservas_para_retirar,
            (SELECT COUNT(*) FROM traslados WHERE estado IN ('SOLICITADO', 'EN_TRANSITO')) AS traslados_abiertos,
            (SELECT COUNT(*) FROM ejemplares
              WHERE id_sede = %s AND estado = 'DISPONIBLE') AS disponibles_en_mi_sede
        """,
        [id_sede],
    )


def vencidos_sede(id_sede):
    return sql.consultar(
        """
        SELECT p.id_prestamo, l.titulo, e.codigo_barras, pe.nombres || ' ' || pe.apellidos AS socio,
               p.fecha_limite, fn_dias_retraso(p.id_prestamo) AS dias_retraso
          FROM prestamos p
          JOIN ejemplares e ON e.id_ejemplar = p.id_ejemplar
          JOIN libros l ON l.id_libro = e.id_libro
          JOIN personas pe ON pe.id_persona = p.id_socio
         WHERE p.id_sede_prestamo = %s
           AND (p.estado = 'VENCIDO' OR (p.estado = 'ACTIVO' AND p.fecha_limite < CURRENT_DATE))
         ORDER BY p.fecha_limite, p.id_prestamo
         LIMIT 10
        """,
        [id_sede],
    )


def actualizar_estados():
    return sql.llamar('sp_actualizar_estados', [], 3)
