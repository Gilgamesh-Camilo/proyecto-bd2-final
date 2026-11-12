-- ====================================================================================
-- Autor       :
-- Fecha       : 2026-11-11
-- Version     : 1.1
-- Descripcion : Reportes de BiblioRed sobre la base relacional (PostgreSQL 16).
--               Cada reporte es una consulta independiente; se ejecutan despues
--               de bibliored_postgresql.sql:
--                   psql -U postgres -d biblioteca_db -f bibliored_reportes.sql
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- Prestamos por sede y por mes
-- ------------------------------------------------------------------------------------
SELECT s.nombre AS sede,
       TO_CHAR(p.fecha_prestamo, 'YYYY-MM') AS mes,
       COUNT(*) AS prestamos,
       SUM(CASE WHEN p.estado = 'DEVUELTO' THEN 1 ELSE 0 END) AS devueltos,
       SUM(CASE WHEN p.estado IN ('ACTIVO', 'VENCIDO') THEN 1 ELSE 0 END) AS abiertos,
       SUM(CASE WHEN p.estado = 'PERDIDO' THEN 1 ELSE 0 END) AS perdidos
  FROM prestamos p
  JOIN sedes s ON s.id_sede = p.id_sede_prestamo
 GROUP BY s.nombre, TO_CHAR(p.fecha_prestamo, 'YYYY-MM')
 ORDER BY mes, sede;

-- ------------------------------------------------------------------------------------
-- Variacion mensual de prestamos en la red
-- ------------------------------------------------------------------------------------
WITH por_mes AS (
    SELECT TO_CHAR(fecha_prestamo, 'YYYY-MM') AS mes,
           COUNT(*) AS prestamos
      FROM prestamos
     GROUP BY TO_CHAR(fecha_prestamo, 'YYYY-MM')
)
SELECT mes,
       prestamos,
       LAG(prestamos) OVER (ORDER BY mes) AS mes_anterior,
       prestamos - LAG(prestamos) OVER (ORDER BY mes) AS variacion
  FROM por_mes
 ORDER BY mes;

-- ------------------------------------------------------------------------------------
-- Los diez libros mas prestados, con sus autores
-- ------------------------------------------------------------------------------------
WITH conteo AS (
    SELECT e.id_libro, COUNT(*) AS prestamos
      FROM prestamos p
      JOIN ejemplares e ON e.id_ejemplar = p.id_ejemplar
     GROUP BY e.id_libro
),
autores_libro AS (
    SELECT la.id_libro,
           STRING_AGG(a.nombres || ' ' || a.apellidos, ', ' ORDER BY la.orden) AS autores
      FROM libros_autores la
      JOIN autores a ON a.id_autor = la.id_autor
     GROUP BY la.id_libro
)
SELECT DENSE_RANK() OVER (ORDER BY c.prestamos DESC) AS puesto,
       l.titulo,
       al.autores,
       cat.nombre AS categoria,
       c.prestamos
  FROM conteo c
  JOIN libros l ON l.id_libro = c.id_libro
  JOIN categorias cat ON cat.id_categoria = l.id_categoria
  LEFT JOIN autores_libro al ON al.id_libro = l.id_libro
 ORDER BY puesto, l.titulo
 FETCH FIRST 10 ROWS ONLY;

-- ------------------------------------------------------------------------------------
-- Prestamos vencidos: dias de retraso y multa que se generaria hoy
-- ------------------------------------------------------------------------------------
SELECT p.id_prestamo,
       pe.nombres || ' ' || pe.apellidos AS socio,
       pe.numero_documento AS documento,
       l.titulo,
       e.codigo_barras,
       s.nombre AS sede,
       p.fecha_limite,
       fn_dias_retraso(p.id_prestamo) AS dias_retraso,
       fn_valor_multa_retraso(p.id_prestamo) AS multa_estimada
  FROM prestamos p
  JOIN personas pe ON pe.id_persona = p.id_socio
  JOIN ejemplares e ON e.id_ejemplar = p.id_ejemplar
  JOIN libros l ON l.id_libro = e.id_libro
  JOIN sedes s ON s.id_sede = p.id_sede_prestamo
 WHERE p.estado IN ('ACTIVO', 'VENCIDO')
   AND p.fecha_limite < CURRENT_DATE
 ORDER BY dias_retraso DESC, p.id_prestamo;

-- ------------------------------------------------------------------------------------
-- Cumplimiento de devolucion por tipo de socio
-- ------------------------------------------------------------------------------------
SELECT ts.nombre AS tipo_socio,
       COUNT(*) AS devueltos,
       SUM(CASE WHEN p.fecha_devolucion <= p.fecha_limite THEN 1 ELSE 0 END) AS a_tiempo,
       ROUND(100.0 * SUM(CASE WHEN p.fecha_devolucion <= p.fecha_limite THEN 1 ELSE 0 END) / COUNT(*), 1)
           AS porcentaje_a_tiempo
  FROM prestamos p
  JOIN socios so ON so.id_socio = p.id_socio
  JOIN tipos_socio ts ON ts.id_tipo_socio = so.id_tipo_socio
 WHERE p.estado = 'DEVUELTO'
 GROUP BY ts.nombre
 ORDER BY porcentaje_a_tiempo DESC, ts.nombre;

-- ------------------------------------------------------------------------------------
-- Disponibilidad de cada libro por sede
-- ------------------------------------------------------------------------------------
SELECT l.titulo,
       s.nombre AS sede,
       COUNT(*) AS ejemplares,
       SUM(CASE WHEN e.estado = 'DISPONIBLE' THEN 1 ELSE 0 END) AS disponibles,
       SUM(CASE WHEN e.estado = 'PRESTADO' THEN 1 ELSE 0 END) AS prestados,
       SUM(CASE WHEN e.estado IN ('RESERVADO', 'EN_TRASLADO') THEN 1 ELSE 0 END) AS apartados_o_en_traslado,
       SUM(CASE WHEN e.estado = 'EN_REPARACION' THEN 1 ELSE 0 END) AS en_reparacion,
       SUM(CASE WHEN e.estado = 'PERDIDO' THEN 1 ELSE 0 END) AS perdidos
  FROM ejemplares e
  JOIN libros l ON l.id_libro = e.id_libro
  JOIN sedes s ON s.id_sede = e.id_sede
 WHERE e.estado <> 'DE_BAJA'
 GROUP BY l.titulo, s.nombre
 ORDER BY l.titulo, s.nombre;

-- ------------------------------------------------------------------------------------
-- Ejemplares fuera de circulacion por sede y su valor de reposicion
-- ------------------------------------------------------------------------------------
SELECT s.nombre AS sede,
       e.estado,
       COUNT(*) AS ejemplares,
       COALESCE(SUM(e.valor_reposicion), 0) AS valor_reposicion
  FROM ejemplares e
  JOIN sedes s ON s.id_sede = e.id_sede
 WHERE e.estado IN ('EN_REPARACION', 'PERDIDO', 'DE_BAJA')
 GROUP BY s.nombre, e.estado
 ORDER BY s.nombre, e.estado;

-- ------------------------------------------------------------------------------------
-- Libros que se piden mas de lo que se tienen: reservas abiertas frente a
-- ejemplares disponibles en toda la red
-- ------------------------------------------------------------------------------------
SELECT l.titulo,
       COUNT(r.id_reserva) AS reservas_abiertas,
       (SELECT COUNT(*)
          FROM ejemplares e
         WHERE e.id_libro = l.id_libro
           AND e.estado = 'DISPONIBLE') AS disponibles_en_la_red
  FROM libros l
  JOIN reservas r ON r.id_libro = l.id_libro
 WHERE r.estado IN ('EN_ESPERA', 'DISPONIBLE')
 GROUP BY l.id_libro, l.titulo
 ORDER BY reservas_abiertas DESC, l.titulo;

-- ------------------------------------------------------------------------------------
-- Cola de reservas abiertas: posicion de cada socio por libro
-- ------------------------------------------------------------------------------------
SELECT l.titulo,
       ROW_NUMBER() OVER (PARTITION BY r.id_libro ORDER BY r.fecha_reserva) AS posicion,
       pe.nombres || ' ' || pe.apellidos AS socio,
       s.nombre AS sede_retiro,
       r.fecha_reserva,
       r.estado,
       r.fecha_expiracion
  FROM reservas r
  JOIN libros l ON l.id_libro = r.id_libro
  JOIN personas pe ON pe.id_persona = r.id_socio
  JOIN sedes s ON s.id_sede = r.id_sede_retiro
 WHERE r.estado IN ('EN_ESPERA', 'DISPONIBLE')
 ORDER BY l.titulo, posicion;

-- ------------------------------------------------------------------------------------
-- Socios con multas pendientes y total adeudado
-- ------------------------------------------------------------------------------------
SELECT pe.tipo_documento || ' ' || pe.numero_documento AS documento,
       pe.nombres || ' ' || pe.apellidos AS socio,
       ts.nombre AS tipo_socio,
       so.estado AS estado_socio,
       COUNT(*) AS multas_pendientes,
       SUM(m.valor) AS total_adeudado
  FROM multas m
  JOIN prestamos p ON p.id_prestamo = m.id_prestamo
  JOIN socios so ON so.id_socio = p.id_socio
  JOIN personas pe ON pe.id_persona = so.id_socio
  JOIN tipos_socio ts ON ts.id_tipo_socio = so.id_tipo_socio
 WHERE m.estado = 'PENDIENTE'
 GROUP BY pe.tipo_documento, pe.numero_documento, pe.nombres, pe.apellidos, ts.nombre, so.estado
HAVING SUM(m.valor) > 0
 ORDER BY total_adeudado DESC;

-- ------------------------------------------------------------------------------------
-- Cupo de prestamos de los socios con libros en su poder
-- ------------------------------------------------------------------------------------
WITH abiertos AS (
    SELECT id_socio, COUNT(*) AS abiertos
      FROM prestamos
     WHERE estado IN ('ACTIVO', 'VENCIDO')
     GROUP BY id_socio
)
SELECT pe.nombres || ' ' || pe.apellidos AS socio,
       ts.nombre AS tipo_socio,
       a.abiertos,
       ts.max_prestamos,
       ts.max_prestamos - a.abiertos AS cupo_restante
  FROM abiertos a
  JOIN socios so ON so.id_socio = a.id_socio
  JOIN personas pe ON pe.id_persona = so.id_socio
  JOIN tipos_socio ts ON ts.id_tipo_socio = so.id_tipo_socio
 ORDER BY cupo_restante, socio;

-- ------------------------------------------------------------------------------------
-- Los tres socios que mas leen en cada sede
-- ------------------------------------------------------------------------------------
SELECT sede, puesto, socio, prestamos
  FROM (SELECT s.nombre AS sede,
               RANK() OVER (PARTITION BY p.id_sede_prestamo ORDER BY COUNT(*) DESC) AS puesto,
               pe.nombres || ' ' || pe.apellidos AS socio,
               COUNT(*) AS prestamos
          FROM prestamos p
          JOIN sedes s ON s.id_sede = p.id_sede_prestamo
          JOIN personas pe ON pe.id_persona = p.id_socio
         GROUP BY s.nombre, p.id_sede_prestamo, pe.nombres, pe.apellidos) ranking
 WHERE puesto <= 3
 ORDER BY sede, puesto, socio;

-- ------------------------------------------------------------------------------------
-- Recaudo de multas por mes y acumulado
-- ------------------------------------------------------------------------------------
SELECT TO_CHAR(fecha_pago, 'YYYY-MM') AS mes,
       COUNT(*) AS multas_pagadas,
       SUM(valor) AS recaudado,
       SUM(SUM(valor)) OVER (ORDER BY TO_CHAR(fecha_pago, 'YYYY-MM')) AS acumulado
  FROM multas
 WHERE estado = 'PAGADA'
 GROUP BY TO_CHAR(fecha_pago, 'YYYY-MM')
 ORDER BY mes;

-- ------------------------------------------------------------------------------------
-- Multas por motivo: valor pendiente, pagado y condonado
-- ------------------------------------------------------------------------------------
SELECT motivo,
       COUNT(*) AS multas,
       SUM(CASE WHEN estado = 'PENDIENTE' THEN valor ELSE 0 END) AS pendiente,
       SUM(CASE WHEN estado = 'PAGADA' THEN valor ELSE 0 END) AS pagado,
       SUM(CASE WHEN estado = 'CONDONADA' THEN valor ELSE 0 END) AS condonado,
       ROUND(100.0 * SUM(valor) / SUM(SUM(valor)) OVER (), 1) AS porcentaje_del_total
  FROM multas
 GROUP BY motivo
 ORDER BY SUM(valor) DESC, motivo;

-- ------------------------------------------------------------------------------------
-- Carnes vencidos o que vencen en los proximos 60 dias
-- ------------------------------------------------------------------------------------
SELECT pe.nombres || ' ' || pe.apellidos AS socio,
       c.numero_carne,
       c.fecha_vencimiento,
       c.fecha_vencimiento - CURRENT_DATE AS dias_para_vencer,
       CASE WHEN c.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDO' ELSE 'POR VENCER' END AS situacion
  FROM carnes c
  JOIN socios so ON so.id_socio = c.id_socio
  JOIN personas pe ON pe.id_persona = so.id_socio
 WHERE so.estado <> 'RETIRADO'
   AND c.estado <> 'ANULADO'
   AND c.fecha_vencimiento <= CURRENT_DATE + 60
 ORDER BY c.fecha_vencimiento, socio;

-- ------------------------------------------------------------------------------------
-- Traslados entre sedes y dias que tardo o lleva cada uno
-- ------------------------------------------------------------------------------------
SELECT t.id_traslado,
       l.titulo,
       e.codigo_barras,
       so.nombre AS origen,
       sd.nombre AS destino,
       t.estado,
       CAST(t.fecha_solicitud AS DATE) AS solicitado,
       CAST(t.fecha_recepcion AS DATE) AS recibido,
       COALESCE(CAST(t.fecha_recepcion AS DATE), CURRENT_DATE) - CAST(t.fecha_solicitud AS DATE) AS dias
  FROM traslados t
  JOIN ejemplares e ON e.id_ejemplar = t.id_ejemplar
  JOIN libros l ON l.id_libro = e.id_libro
  JOIN sedes so ON so.id_sede = t.id_sede_origen
  JOIN sedes sd ON sd.id_sede = t.id_sede_destino
 WHERE t.estado <> 'CANCELADO'
 ORDER BY t.estado, dias DESC;

-- ------------------------------------------------------------------------------------
-- Actividad de cada empleado: prestamos registrados y traslados solicitados
-- ------------------------------------------------------------------------------------
SELECT pe.nombres || ' ' || pe.apellidos AS empleado,
       r.nombre AS rol,
       s.nombre AS sede,
       COALESCE(pr.prestamos, 0) AS prestamos_registrados,
       COALESCE(tr.traslados, 0) AS traslados_solicitados
  FROM empleados em
  JOIN personas pe ON pe.id_persona = em.id_empleado
  JOIN roles r ON r.id_rol = em.id_rol
  JOIN sedes s ON s.id_sede = em.id_sede
  LEFT JOIN (SELECT id_empleado, COUNT(*) AS prestamos FROM prestamos GROUP BY id_empleado) pr
         ON pr.id_empleado = em.id_empleado
  LEFT JOIN (SELECT id_empleado, COUNT(*) AS traslados FROM traslados GROUP BY id_empleado) tr
         ON tr.id_empleado = em.id_empleado
 ORDER BY prestamos_registrados DESC, traslados_solicitados DESC, empleado;

-- ------------------------------------------------------------------------------------
-- Cambios registrados por la auditoria, por tabla y operacion
-- ------------------------------------------------------------------------------------
SELECT tabla_afectada,
       operacion,
       COUNT(*) AS cambios,
       MAX(fecha) AS ultimo_cambio
  FROM auditoria
 GROUP BY tabla_afectada, operacion
 ORDER BY tabla_afectada, operacion;
