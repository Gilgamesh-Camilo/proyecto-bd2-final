-- =====================================================================
-- Script de Programabilidad: Funciones, Procedimientos, Triggers,
-- Control de Transacciones y Manejo de Excepciones (PostgreSQL)
-- =====================================================================

-- 1. FUNCIÓN: Calcular Total de un Pedido sumando los subtotales
CREATE OR REPLACE FUNCTION fn_calcular_total_pedido(p_id_pedido INT)
RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC(12, 2) := 0.00;
BEGIN
    SELECT COALESCE(SUM(subtotal), 0.00)
    INTO v_total
    FROM detalle_pedidos
    WHERE id_pedido = p_id_pedido;

    RETURN v_total;
END;
$$ LANGUAGE plpgsql;


-- 2. TRIGGER & FUNCIÓN: Auditoría automática sobre la tabla PRODUCTOS
CREATE OR REPLACE FUNCTION trg_fn_auditar_productos()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO logs_auditoria(tabla_afectada, operacion, registro_id, detalle)
        VALUES ('productos', 'INSERT', NEW.id_producto, row_to_json(NEW)::jsonb);
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO logs_auditoria(tabla_afectada, operacion, registro_id, detalle)
        VALUES ('productos', 'UPDATE', NEW.id_producto, json_build_object('antes', row_to_json(OLD), 'despues', row_to_json(NEW))::jsonb);
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO logs_auditoria(tabla_afectada, operacion, registro_id, detalle)
        VALUES ('productos', 'DELETE', OLD.id_producto, row_to_json(OLD)::jsonb);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditoria_productos ON productos;
CREATE TRIGGER trg_auditoria_productos
AFTER INSERT OR UPDATE OR DELETE ON productos
FOR EACH ROW EXECUTE FUNCTION trg_fn_auditar_productos();


-- 3. TRIGGER & FUNCIÓN: Descontar stock al agregar producto al pedido
CREATE OR REPLACE FUNCTION trg_fn_actualizar_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_stock_disp INT;
BEGIN
    SELECT stock_actual INTO v_stock_disp
    FROM inventario
    WHERE id_producto = NEW.id_producto;

    IF v_stock_disp IS NULL THEN
        RAISE EXCEPTION 'El producto ID % no existe en inventario', NEW.id_producto;
    END IF;

    IF v_stock_disp < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto ID %. Disponible: %, Solicitado: %', 
            NEW.id_producto, v_stock_disp, NEW.cantidad;
    END IF;

    UPDATE inventario
    SET stock_actual = stock_actual - NEW.cantidad,
        ultima_actualizacion = CURRENT_TIMESTAMP
    WHERE id_producto = NEW.id_producto;

    -- Actualizar el total en la cabecera del pedido
    UPDATE pedidos
    SET total = fn_calcular_total_pedido(NEW.id_pedido)
    WHERE id_pedido = NEW.id_pedido;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_descontar_stock ON detalle_pedidos;
CREATE TRIGGER trg_descontar_stock
AFTER INSERT ON detalle_pedidos
FOR EACH ROW EXECUTE FUNCTION trg_fn_actualizar_stock();


-- 4. PROCEDIMIENTO ALMACENADO: Registrar Pedido Completo con Control de Transacciones y Excepciones
CREATE OR REPLACE PROCEDURE sp_registrar_pedido(
    IN p_id_cliente INT,
    IN p_id_producto INT,
    IN p_cantidad INT,
    OUT p_id_pedido_generado INT,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_precio_prod NUMERIC(12,2);
    v_subtotal NUMERIC(12,2);
    v_cliente_existe INT;
BEGIN
    -- Validar existencia de cliente
    SELECT COUNT(*) INTO v_cliente_existe FROM clientes WHERE id_cliente = p_id_cliente;
    IF v_cliente_existe = 0 THEN
        RAISE EXCEPTION 'El cliente con ID % no está registrado', p_id_cliente;
    END IF;

    -- Obtener precio del producto
    SELECT precio INTO v_precio_prod FROM productos WHERE id_producto = p_id_producto;
    IF v_precio_prod IS NULL THEN
        RAISE EXCEPTION 'Producto ID % inexistente', p_id_producto;
    END IF;

    v_subtotal := v_precio_prod * p_cantidad;

    -- Inserción cabecera de pedido
    INSERT INTO pedidos (id_cliente, estado, total)
    VALUES (p_id_cliente, 'PENDIENTE', 0)
    RETURNING id_pedido INTO p_id_pedido_generado;

    -- Inserción detalle (aquí se disparará el trigger que valida stock y calcula total)
    INSERT INTO detalle_pedidos (id_pedido, id_producto, cantidad, precio_unitario, subtotal)
    VALUES (p_id_pedido_generado, p_id_producto, p_cantidad, v_precio_prod, v_subtotal);

    p_mensaje := 'Pedido registrado exitosamente';

EXCEPTION
    WHEN OTHERS THEN
        p_id_pedido_generado := NULL;
        p_mensaje := SQLERRM;
        -- En PL/pgSQL los bloques de excepción hacen ROLLBACK implícito de la subtransacción
        RAISE NOTICE 'Error al registrar pedido: %', SQLERRM;
END;
$$;
