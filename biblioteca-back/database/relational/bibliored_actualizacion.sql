-- ====================================================================================
-- Autor       :
-- Fecha       : 2026-11-11
-- Version     : 1.0
-- Descripcion : Actualizacion de una base de BiblioRed que ya esta montada, sin
--               borrarla ni recargarla. Agrega el registro de libros y ejemplares,
--               las multas por dano o perdida y su condonacion, el cambio de estado
--               de ejemplares, socios y sedes, el registro de sedes, la renovacion
--               del carne y el desbloqueo de empleados, con los permisos que necesita
--               biblioteca_app. No borra ni modifica datos y se puede ejecutar mas
--               de una vez. Ejecutar como superusuario:
--                   sudo -u postgres psql -v ON_ERROR_STOP=1 -d biblioteca_db \
--                       < bibliored_actualizacion.sql
-- ====================================================================================

CREATE OR REPLACE FUNCTION fn_crear_ejemplares(
    p_id_libro INTEGER,
    p_id_sede INTEGER,
    p_cantidad INTEGER,
    p_ubicacion_estante VARCHAR,
    p_valor_reposicion NUMERIC
)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    vv_estado_sede VARCHAR(10);
    v_siguiente INTEGER;
    v_id_ejemplar INTEGER;
    vv_codigo VARCHAR(20);
    vv_codigos VARCHAR(300) := '';
    v_hay_cola BOOLEAN;
BEGIN
    IF p_cantidad IS NULL OR p_cantidad < 1 OR p_cantidad > 20 THEN
        RAISE EXCEPTION 'La cantidad de ejemplares debe estar entre 1 y 20.';
    END IF;
    IF p_valor_reposicion IS NOT NULL AND p_valor_reposicion < 0 THEN
        RAISE EXCEPTION 'El valor de reposición no puede ser negativo.';
    END IF;

    SELECT estado INTO vv_estado_sede FROM sedes WHERE id_sede = p_id_sede;
    IF NOT FOUND OR vv_estado_sede <> 'ACTIVA' THEN
        RAISE EXCEPTION 'La sede no existe o está cerrada.';
    END IF;

    LOCK TABLE ejemplares IN SHARE ROW EXCLUSIVE MODE;

    SELECT COALESCE(MAX(substr(codigo_barras, 3)::INTEGER), 0)
      INTO v_siguiente
      FROM ejemplares
     WHERE codigo_barras ~ '^B-[0-9]+$';

    SELECT EXISTS (SELECT 1
                     FROM reservas
                    WHERE id_libro = p_id_libro
                      AND id_sede_retiro = p_id_sede
                      AND estado = 'EN_ESPERA')
      INTO v_hay_cola;

    FOR i IN 1..p_cantidad LOOP
        v_siguiente := v_siguiente + 1;
        vv_codigo := 'B-' || lpad(v_siguiente::TEXT, 6, '0');

        INSERT INTO ejemplares (id_libro, id_sede, codigo_barras, ubicacion_estante, valor_reposicion)
        VALUES (p_id_libro, p_id_sede, vv_codigo, NULLIF(btrim(p_ubicacion_estante), ''), p_valor_reposicion)
        RETURNING id_ejemplar INTO v_id_ejemplar;

        IF v_hay_cola THEN
            PERFORM fn_asignar_siguiente_reserva(v_id_ejemplar, p_id_sede);
        END IF;

        IF i > 1 THEN
            vv_codigos := vv_codigos || ', ';
        END IF;
        vv_codigos := vv_codigos || vv_codigo;
    END LOOP;

    RETURN vv_codigos;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_registrar_libro(
    IN p_isbn VARCHAR,
    IN p_titulo VARCHAR,
    IN p_subtitulo VARCHAR,
    IN p_anio_publicacion INTEGER,
    IN p_edicion INTEGER,
    IN p_numero_paginas INTEGER,
    IN p_idioma VARCHAR,
    IN p_id_editorial INTEGER,
    IN p_id_categoria INTEGER,
    IN p_autores JSONB,
    IN p_id_sede INTEGER,
    IN p_cantidad INTEGER,
    IN p_ubicacion_estante VARCHAR,
    IN p_valor_reposicion NUMERIC,
    OUT p_id_libro INTEGER,
    OUT p_codigos VARCHAR,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    r RECORD;
    v_id_autor INTEGER;
    vv_rol VARCHAR(12);
    v_orden INTEGER := 0;
BEGIN
    BEGIN
        IF p_isbn IS NULL OR p_isbn !~ '^[0-9]{13}$' THEN
            RAISE EXCEPTION 'El ISBN debe tener 13 dígitos.';
        END IF;
        PERFORM 1 FROM libros WHERE isbn = p_isbn;
        IF FOUND THEN
            RAISE EXCEPTION 'Ya existe un libro con el ISBN %.', p_isbn;
        END IF;
        IF COALESCE(btrim(p_titulo), '') = '' THEN
            RAISE EXCEPTION 'El libro necesita un título.';
        END IF;
        IF p_anio_publicacion IS NOT NULL
           AND (p_anio_publicacion < 1450 OR p_anio_publicacion > EXTRACT(YEAR FROM CURRENT_DATE)) THEN
            RAISE EXCEPTION 'El año de publicación debe estar entre 1450 y el año actual.';
        END IF;
        IF p_edicion IS NOT NULL AND p_edicion < 1 THEN
            RAISE EXCEPTION 'La edición debe ser mayor que cero.';
        END IF;
        IF p_numero_paginas IS NOT NULL AND p_numero_paginas < 1 THEN
            RAISE EXCEPTION 'El número de páginas debe ser mayor que cero.';
        END IF;
        IF p_idioma IS NOT NULL AND p_idioma !~ '^[a-z]{2}$' THEN
            RAISE EXCEPTION 'El idioma debe ser un código de dos letras.';
        END IF;

        PERFORM 1 FROM editoriales WHERE id_editorial = p_id_editorial;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La editorial no existe.';
        END IF;
        PERFORM 1 FROM categorias WHERE id_categoria = p_id_categoria;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La categoría no existe.';
        END IF;
        IF p_autores IS NULL OR jsonb_typeof(p_autores) <> 'array' OR jsonb_array_length(p_autores) = 0 THEN
            RAISE EXCEPTION 'El libro debe tener al menos un autor.';
        END IF;

        INSERT INTO libros (id_editorial, id_categoria, isbn, titulo, subtitulo, anio_publicacion,
                            edicion, numero_paginas, idioma)
        VALUES (p_id_editorial, p_id_categoria, p_isbn, btrim(p_titulo), NULLIF(btrim(p_subtitulo), ''),
                p_anio_publicacion, COALESCE(p_edicion, 1), p_numero_paginas, COALESCE(p_idioma, 'es'))
        RETURNING id_libro INTO p_id_libro;

        FOR r IN SELECT valor FROM jsonb_array_elements(p_autores) AS a(valor) LOOP
            v_orden := v_orden + 1;
            vv_rol := COALESCE(r.valor ->> 'rol_autor', 'AUTOR');
            IF vv_rol NOT IN ('AUTOR', 'COAUTOR', 'EDITOR', 'TRADUCTOR', 'ILUSTRADOR') THEN
                RAISE EXCEPTION 'El rol % no es válido para un autor.', vv_rol;
            END IF;

            IF r.valor ? 'id_autor' THEN
                v_id_autor := (r.valor ->> 'id_autor')::INTEGER;
                PERFORM 1 FROM autores WHERE id_autor = v_id_autor;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'El autor % no existe.', v_id_autor;
                END IF;
            ELSE
                IF COALESCE(btrim(r.valor ->> 'nombres'), '') = '' OR COALESCE(btrim(r.valor ->> 'apellidos'), '') = '' THEN
                    RAISE EXCEPTION 'Cada autor nuevo necesita nombres y apellidos.';
                END IF;
                INSERT INTO autores (nombres, apellidos, nacionalidad)
                VALUES (btrim(r.valor ->> 'nombres'), btrim(r.valor ->> 'apellidos'),
                        NULLIF(btrim(r.valor ->> 'nacionalidad'), ''))
                RETURNING id_autor INTO v_id_autor;
            END IF;

            PERFORM 1 FROM libros_autores WHERE id_libro = p_id_libro AND id_autor = v_id_autor;
            IF FOUND THEN
                RAISE EXCEPTION 'Un autor aparece dos veces en el libro.';
            END IF;

            INSERT INTO libros_autores (id_libro, id_autor, rol_autor, orden)
            VALUES (p_id_libro, v_id_autor, vv_rol, v_orden);
        END LOOP;

        p_codigos := fn_crear_ejemplares(p_id_libro, p_id_sede, p_cantidad, p_ubicacion_estante, p_valor_reposicion);
    EXCEPTION
        WHEN unique_violation THEN
            vv_error := 'Ya existe un libro con ese ISBN.';
        WHEN check_violation THEN
            vv_error := 'Algún dato del libro no cumple las reglas de la base.';
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_mensaje := 'Libro registrado con ' || p_cantidad || ' ejemplar(es): ' || p_codigos || '.';
    ELSE
        ROLLBACK;
        p_id_libro := NULL;
        p_codigos := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_registrar_ejemplares(
    IN p_id_libro INTEGER,
    IN p_id_sede INTEGER,
    IN p_cantidad INTEGER,
    IN p_ubicacion_estante VARCHAR,
    IN p_valor_reposicion NUMERIC,
    OUT p_codigos VARCHAR,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    v_apartados INTEGER;
BEGIN
    BEGIN
        PERFORM 1 FROM libros WHERE id_libro = p_id_libro;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El libro % no existe.', p_id_libro;
        END IF;

        p_codigos := fn_crear_ejemplares(p_id_libro, p_id_sede, p_cantidad, p_ubicacion_estante, p_valor_reposicion);

        SELECT COUNT(*)
          INTO v_apartados
          FROM ejemplares
         WHERE codigo_barras = ANY (string_to_array(p_codigos, ', '))
           AND estado = 'RESERVADO';
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_mensaje := 'Ejemplares registrados: ' || p_codigos || '.';
        IF v_apartados > 0 THEN
            p_mensaje := p_mensaje || ' ' || v_apartados || ' quedaron apartados para reservas en espera.';
        END IF;
    ELSE
        ROLLBACK;
        p_codigos := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

-- Multa por dano (despues de la devolucion; el ejemplar pasa a reparacion)
-- o por perdida (prestamo abierto; el prestamo y el ejemplar quedan
-- perdidos). Cada prestamo tiene una sola multa: si ya habia una por
-- retraso pendiente, el dano se suma a esa.
CREATE OR REPLACE PROCEDURE sp_registrar_multa(
    IN p_id_prestamo INTEGER,
    IN p_motivo VARCHAR,
    IN p_valor NUMERIC,
    IN p_id_empleado INTEGER,
    OUT p_valor_multa NUMERIC,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    vv_estado VARCHAR(10);
    v_id_ejemplar INTEGER;
    vv_estado_empleado VARCHAR(10);
    vv_estado_ejemplar VARCHAR(13);
    v_valor_reposicion NUMERIC(12,2);
    vv_motivo_multa VARCHAR(10);
    vv_estado_multa VARCHAR(10);
    v_valor_anterior NUMERIC(12,2);
    v_hay_multa BOOLEAN := FALSE;
BEGIN
    BEGIN
        IF p_motivo IS NULL OR p_motivo NOT IN ('DANO', 'PERDIDA') THEN
            RAISE EXCEPTION 'El motivo debe ser DANO o PERDIDA.';
        END IF;
        IF p_valor IS NOT NULL AND p_valor <= 0 THEN
            RAISE EXCEPTION 'El valor de la multa debe ser mayor que cero.';
        END IF;

        SELECT estado, id_ejemplar
          INTO vv_estado, v_id_ejemplar
          FROM prestamos
         WHERE id_prestamo = p_id_prestamo
           FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El préstamo % no existe.', p_id_prestamo;
        END IF;

        SELECT estado INTO vv_estado_empleado FROM empleados WHERE id_empleado = p_id_empleado;
        IF NOT FOUND OR vv_estado_empleado <> 'ACTIVO' THEN
            RAISE EXCEPTION 'El empleado no está activo.';
        END IF;

        SELECT motivo, estado, valor
          INTO vv_motivo_multa, vv_estado_multa, v_valor_anterior
          FROM multas
         WHERE id_prestamo = p_id_prestamo
           FOR UPDATE;
        v_hay_multa := FOUND;

        SELECT estado, valor_reposicion
          INTO vv_estado_ejemplar, v_valor_reposicion
          FROM ejemplares
         WHERE id_ejemplar = v_id_ejemplar
           FOR UPDATE;

        IF p_motivo = 'PERDIDA' THEN
            IF vv_estado NOT IN ('ACTIVO', 'VENCIDO') THEN
                RAISE EXCEPTION 'Solo se reporta la pérdida de un préstamo abierto (estado %).', vv_estado;
            END IF;
            IF v_hay_multa THEN
                RAISE EXCEPTION 'El préstamo ya tiene una multa registrada.';
            END IF;
            p_valor_multa := COALESCE(p_valor, v_valor_reposicion);
            IF p_valor_multa IS NULL OR p_valor_multa <= 0 THEN
                RAISE EXCEPTION 'El ejemplar no tiene valor de reposición; indica el valor de la multa.';
            END IF;
            UPDATE prestamos SET estado = 'PERDIDO' WHERE id_prestamo = p_id_prestamo;
            UPDATE ejemplares SET estado = 'PERDIDO' WHERE id_ejemplar = v_id_ejemplar;
            INSERT INTO multas (id_prestamo, motivo, valor) VALUES (p_id_prestamo, 'PERDIDA', p_valor_multa);
        ELSE
            IF vv_estado <> 'DEVUELTO' THEN
                RAISE EXCEPTION 'El daño se registra después de la devolución (estado %).', vv_estado;
            END IF;
            IF p_valor IS NULL THEN
                RAISE EXCEPTION 'Indica el valor de la multa por daño.';
            END IF;
            IF vv_estado_ejemplar NOT IN ('DISPONIBLE', 'RESERVADO') THEN
                RAISE EXCEPTION 'El ejemplar ya salió de nuevo (estado %); el daño se registra al recibirlo.', vv_estado_ejemplar;
            END IF;
            IF v_hay_multa AND (vv_motivo_multa <> 'RETRASO' OR vv_estado_multa <> 'PENDIENTE') THEN
                RAISE EXCEPTION 'El préstamo ya tiene una multa por % en estado %.', lower(vv_motivo_multa), lower(vv_estado_multa);
            END IF;

            IF v_hay_multa THEN
                p_valor_multa := v_valor_anterior + p_valor;
                UPDATE multas SET motivo = 'DANO', valor = p_valor_multa WHERE id_prestamo = p_id_prestamo;
            ELSE
                p_valor_multa := p_valor;
                INSERT INTO multas (id_prestamo, motivo, valor) VALUES (p_id_prestamo, 'DANO', p_valor_multa);
            END IF;

            IF vv_estado_ejemplar = 'RESERVADO' THEN
                UPDATE reservas
                   SET estado = 'EN_ESPERA', id_ejemplar = NULL, fecha_expiracion = NULL
                 WHERE id_ejemplar = v_id_ejemplar
                   AND estado = 'DISPONIBLE';
            END IF;
            UPDATE ejemplares SET estado = 'EN_REPARACION' WHERE id_ejemplar = v_id_ejemplar;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        IF p_motivo = 'PERDIDA' THEN
            p_mensaje := 'Pérdida registrada. El ejemplar quedó como perdido y se generó la multa.';
        ELSE
            p_mensaje := 'Daño registrado. El ejemplar pasó a reparación.';
            IF v_hay_multa THEN
                p_mensaje := p_mensaje || ' El valor se sumó a la multa por retraso del mismo préstamo.';
            END IF;
            IF vv_estado_ejemplar = 'RESERVADO' THEN
                p_mensaje := p_mensaje || ' La reserva que lo tenía apartado volvió a la cola.';
            END IF;
        END IF;
    ELSE
        ROLLBACK;
        p_valor_multa := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

-- Condona una multa pendiente. El trigger tgr_au_multas reactiva al socio
-- si era la ultima.
CREATE OR REPLACE PROCEDURE sp_condonar_multa(
    IN p_id_prestamo INTEGER,
    OUT p_exito BOOLEAN,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    vv_estado VARCHAR(10);
BEGIN
    BEGIN
        SELECT estado INTO vv_estado FROM multas WHERE id_prestamo = p_id_prestamo FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El préstamo % no tiene multa.', p_id_prestamo;
        END IF;
        IF vv_estado <> 'PENDIENTE' THEN
            RAISE EXCEPTION 'La multa ya está %.', lower(vv_estado);
        END IF;

        UPDATE multas SET estado = 'CONDONADA' WHERE id_prestamo = p_id_prestamo;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_exito := TRUE;
        p_mensaje := 'Multa condonada.';
    ELSE
        ROLLBACK;
        p_exito := FALSE;
        p_mensaje := vv_error;
    END IF;
END;
$$;

-- Cambia a mano el estado de un ejemplar que no tiene movimientos
-- abiertos: reparacion, perdido, de baja o de vuelta a disponible.
CREATE OR REPLACE PROCEDURE sp_cambiar_estado_ejemplar(
    IN p_id_ejemplar INTEGER,
    IN p_estado VARCHAR,
    OUT p_estado_final VARCHAR,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    vv_actual VARCHAR(13);
    v_id_sede INTEGER;
    v_id_reserva INTEGER;
BEGIN
    BEGIN
        IF p_estado IS NULL OR p_estado NOT IN ('DISPONIBLE', 'EN_REPARACION', 'PERDIDO', 'DE_BAJA') THEN
            RAISE EXCEPTION 'El estado debe ser DISPONIBLE, EN_REPARACION, PERDIDO o DE_BAJA.';
        END IF;

        SELECT estado, id_sede
          INTO vv_actual, v_id_sede
          FROM ejemplares
         WHERE id_ejemplar = p_id_ejemplar
           FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El ejemplar % no existe.', p_id_ejemplar;
        END IF;
        IF vv_actual = 'DE_BAJA' THEN
            RAISE EXCEPTION 'El ejemplar está dado de baja y no cambia de estado.';
        END IF;
        IF vv_actual IN ('PRESTADO', 'RESERVADO', 'EN_TRASLADO') THEN
            RAISE EXCEPTION 'El ejemplar tiene un movimiento abierto (estado %).', vv_actual;
        END IF;
        IF vv_actual = p_estado THEN
            RAISE EXCEPTION 'El ejemplar ya está en ese estado.';
        END IF;
        PERFORM 1 FROM traslados WHERE id_ejemplar = p_id_ejemplar AND estado IN ('SOLICITADO', 'EN_TRANSITO');
        IF FOUND THEN
            RAISE EXCEPTION 'El ejemplar tiene un traslado abierto.';
        END IF;

        IF p_estado = 'DISPONIBLE' THEN
            v_id_reserva := fn_asignar_siguiente_reserva(p_id_ejemplar, v_id_sede);
        ELSE
            UPDATE ejemplares SET estado = p_estado WHERE id_ejemplar = p_id_ejemplar;
        END IF;

        SELECT estado INTO p_estado_final FROM ejemplares WHERE id_ejemplar = p_id_ejemplar;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_mensaje := 'Estado del ejemplar actualizado.';
        IF v_id_reserva IS NOT NULL THEN
            p_mensaje := p_mensaje || ' Quedó apartado para la reserva ' || v_id_reserva || '.';
        END IF;
    ELSE
        ROLLBACK;
        p_estado_final := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

-- Baja logica de socios: suspende, retira (anula el carne) o reactiva.
CREATE OR REPLACE PROCEDURE sp_cambiar_estado_socio(
    IN p_id_socio INTEGER,
    IN p_estado VARCHAR,
    OUT p_exito BOOLEAN,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    vv_actual VARCHAR(12);
    v_pendientes INTEGER;
BEGIN
    BEGIN
        IF p_estado IS NULL OR p_estado NOT IN ('ACTIVO', 'SUSPENDIDO', 'RETIRADO') THEN
            RAISE EXCEPTION 'El estado debe ser ACTIVO, SUSPENDIDO o RETIRADO.';
        END IF;

        SELECT estado INTO vv_actual FROM socios WHERE id_socio = p_id_socio FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El socio % no existe.', p_id_socio;
        END IF;
        IF vv_actual = p_estado THEN
            RAISE EXCEPTION 'El socio ya está en ese estado.';
        END IF;

        SELECT COUNT(*)
          INTO v_pendientes
          FROM multas m
          JOIN prestamos p ON p.id_prestamo = m.id_prestamo
         WHERE p.id_socio = p_id_socio
           AND m.estado = 'PENDIENTE';

        IF p_estado = 'SUSPENDIDO' AND vv_actual <> 'ACTIVO' THEN
            RAISE EXCEPTION 'Solo se suspende a un socio activo.';
        END IF;
        IF p_estado = 'ACTIVO' AND v_pendientes > 0 THEN
            RAISE EXCEPTION 'El socio tiene multas pendientes; se reactiva al pagarlas o condonarlas.';
        END IF;
        IF p_estado = 'RETIRADO' THEN
            PERFORM 1 FROM prestamos WHERE id_socio = p_id_socio AND estado IN ('ACTIVO', 'VENCIDO');
            IF FOUND THEN
                RAISE EXCEPTION 'El socio tiene préstamos sin devolver.';
            END IF;
            IF v_pendientes > 0 THEN
                RAISE EXCEPTION 'El socio tiene multas pendientes.';
            END IF;
            PERFORM 1 FROM reservas WHERE id_socio = p_id_socio AND estado IN ('EN_ESPERA', 'DISPONIBLE');
            IF FOUND THEN
                RAISE EXCEPTION 'El socio tiene reservas abiertas; hay que cancelarlas primero.';
            END IF;
            UPDATE carnes SET estado = 'ANULADO' WHERE id_socio = p_id_socio;
        END IF;
        IF p_estado = 'ACTIVO' AND vv_actual = 'RETIRADO' THEN
            UPDATE carnes
               SET estado = CASE WHEN fecha_vencimiento >= CURRENT_DATE THEN 'VIGENTE' ELSE 'VENCIDO' END
             WHERE id_socio = p_id_socio;
        END IF;

        UPDATE socios SET estado = p_estado WHERE id_socio = p_id_socio;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_exito := TRUE;
        p_mensaje := 'El socio quedó ' || lower(p_estado) || '.';
    ELSE
        ROLLBACK;
        p_exito := FALSE;
        p_mensaje := vv_error;
    END IF;
END;
$$;

-- Renueva el carne del socio por dos anos desde hoy.
CREATE OR REPLACE PROCEDURE sp_renovar_carne(
    IN p_id_socio INTEGER,
    OUT p_fecha_vencimiento DATE,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    vv_estado_socio VARCHAR(12);
    vv_estado_carne VARCHAR(10);
    vv_numero VARCHAR(20);
BEGIN
    BEGIN
        SELECT estado INTO vv_estado_socio FROM socios WHERE id_socio = p_id_socio;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El socio % no existe.', p_id_socio;
        END IF;
        IF vv_estado_socio = 'RETIRADO' THEN
            RAISE EXCEPTION 'El socio está retirado.';
        END IF;

        SELECT estado, numero_carne
          INTO vv_estado_carne, vv_numero
          FROM carnes
         WHERE id_socio = p_id_socio
           FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El socio todavía no tiene carné.';
        END IF;
        IF vv_estado_carne IN ('BLOQUEADO', 'ANULADO') THEN
            RAISE EXCEPTION 'El carné está % y no se puede renovar.', lower(vv_estado_carne);
        END IF;

        p_fecha_vencimiento := (CURRENT_DATE + INTERVAL '2 years')::DATE;
        UPDATE carnes
           SET estado = 'VIGENTE', fecha_vencimiento = p_fecha_vencimiento
         WHERE id_socio = p_id_socio;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_mensaje := 'Carné ' || vv_numero || ' renovado hasta el ' || to_char(p_fecha_vencimiento, 'YYYY-MM-DD') || '.';
    ELSE
        ROLLBACK;
        p_fecha_vencimiento := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

-- Registra una sede nueva, que queda activa.
CREATE OR REPLACE PROCEDURE sp_registrar_sede(
    IN p_nombre VARCHAR,
    IN p_direccion VARCHAR,
    IN p_ciudad VARCHAR,
    IN p_telefono VARCHAR,
    IN p_fecha_apertura DATE,
    OUT p_id_sede INTEGER,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
BEGIN
    BEGIN
        IF COALESCE(btrim(p_nombre), '') = '' THEN
            RAISE EXCEPTION 'La sede necesita un nombre.';
        END IF;
        IF COALESCE(btrim(p_direccion), '') = '' THEN
            RAISE EXCEPTION 'La sede necesita una dirección.';
        END IF;
        IF COALESCE(btrim(p_ciudad), '') = '' THEN
            RAISE EXCEPTION 'La sede necesita una ciudad.';
        END IF;
        PERFORM 1 FROM sedes WHERE lower(nombre) = lower(btrim(p_nombre));
        IF FOUND THEN
            RAISE EXCEPTION 'Ya existe una sede con ese nombre.';
        END IF;

        INSERT INTO sedes (nombre, direccion, ciudad, telefono, fecha_apertura)
        VALUES (btrim(p_nombre), btrim(p_direccion), btrim(p_ciudad), NULLIF(btrim(p_telefono), ''), p_fecha_apertura)
        RETURNING id_sede INTO p_id_sede;
    EXCEPTION
        WHEN unique_violation THEN
            vv_error := 'Ya existe una sede con ese nombre.';
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_mensaje := 'Sede registrada.';
    ELSE
        ROLLBACK;
        p_id_sede := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

-- Cierra o reabre una sede. No se cierra con movimientos abiertos.
CREATE OR REPLACE PROCEDURE sp_cambiar_estado_sede(
    IN p_id_sede INTEGER,
    IN p_estado VARCHAR,
    OUT p_exito BOOLEAN,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    vv_actual VARCHAR(10);
BEGIN
    BEGIN
        IF p_estado IS NULL OR p_estado NOT IN ('ACTIVA', 'CERRADA') THEN
            RAISE EXCEPTION 'El estado debe ser ACTIVA o CERRADA.';
        END IF;

        SELECT estado INTO vv_actual FROM sedes WHERE id_sede = p_id_sede FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La sede % no existe.', p_id_sede;
        END IF;
        IF vv_actual = p_estado THEN
            RAISE EXCEPTION 'La sede ya está en ese estado.';
        END IF;

        IF p_estado = 'CERRADA' THEN
            PERFORM 1
               FROM ejemplares
              WHERE id_sede = p_id_sede
                AND estado IN ('PRESTADO', 'RESERVADO', 'EN_TRASLADO');
            IF FOUND THEN
                RAISE EXCEPTION 'La sede tiene ejemplares prestados, apartados o en traslado.';
            END IF;
            PERFORM 1
               FROM traslados
              WHERE (id_sede_origen = p_id_sede OR id_sede_destino = p_id_sede)
                AND estado IN ('SOLICITADO', 'EN_TRANSITO');
            IF FOUND THEN
                RAISE EXCEPTION 'La sede tiene traslados abiertos.';
            END IF;
            PERFORM 1 FROM reservas WHERE id_sede_retiro = p_id_sede AND estado IN ('EN_ESPERA', 'DISPONIBLE');
            IF FOUND THEN
                RAISE EXCEPTION 'La sede tiene reservas abiertas.';
            END IF;
        END IF;

        UPDATE sedes SET estado = p_estado WHERE id_sede = p_id_sede;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_exito := TRUE;
        p_mensaje := 'La sede quedó ' || lower(p_estado) || '.';
    ELSE
        ROLLBACK;
        p_exito := FALSE;
        p_mensaje := vv_error;
    END IF;
END;
$$;

-- Desbloquea a un empleado bloqueado por intentos fallidos.
CREATE OR REPLACE PROCEDURE sp_desbloquear_empleado(
    IN p_id_empleado INTEGER,
    OUT p_exito BOOLEAN,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    vv_estado VARCHAR(10);
BEGIN
    BEGIN
        SELECT estado INTO vv_estado FROM empleados WHERE id_empleado = p_id_empleado FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El empleado % no existe.', p_id_empleado;
        END IF;
        IF vv_estado <> 'BLOQUEADO' THEN
            RAISE EXCEPTION 'El empleado no está bloqueado.';
        END IF;

        UPDATE empleados SET intentos_fallidos = 0, estado = 'ACTIVO' WHERE id_empleado = p_id_empleado;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_exito := TRUE;
        p_mensaje := 'Empleado desbloqueado.';
    ELSE
        ROLLBACK;
        p_exito := FALSE;
        p_mensaje := vv_error;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_crear_ejemplares(INTEGER, INTEGER, INTEGER, VARCHAR, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON ALL PROCEDURES IN SCHEMA public FROM PUBLIC;

GRANT INSERT ON libros, libros_autores, autores TO biblioteca_app;
GRANT INSERT, UPDATE ON sedes TO biblioteca_app;
GRANT EXECUTE ON FUNCTION fn_crear_ejemplares(INTEGER, INTEGER, INTEGER, VARCHAR, NUMERIC) TO biblioteca_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO biblioteca_app;
