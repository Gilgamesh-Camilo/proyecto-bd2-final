-- =====================================================================
-- PROYECTO FINAL - BASES DE DATOS 2 (UNIVERSIDAD EL BOSQUE)
-- Script DDL: Creación de Esquema Relacional (PostgreSQL)
-- Cumple con: Mínimo 8 entidades, 3FN, relaciones 1:1, 1:N y N:M
-- =====================================================================

DROP TABLE IF EXISTS detalle_pedidos CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS inventario CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS perfil_usuario CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS logs_auditoria CASCADE;

-- 1. Categorías de productos
CREATE TABLE categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Productos (1:N con Categorías)
CREATE TABLE productos (
    id_producto SERIAL PRIMARY KEY,
    id_categoria INT NOT NULL REFERENCES categorias(id_categoria) ON DELETE RESTRICT,
    codigo_sku VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Inventario (Relación 1:1 con Productos para control estricto de existencias)
CREATE TABLE inventario (
    id_producto INT PRIMARY KEY REFERENCES productos(id_producto) ON DELETE CASCADE,
    stock_actual INT NOT NULL CHECK (stock_actual >= 0),
    stock_minimo INT NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Clientes
CREATE TABLE clientes (
    id_cliente SERIAL PRIMARY KEY,
    numero_documento VARCHAR(25) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Perfil de Usuario / Cliente (Relación 1:1 estricta con Clientes)
CREATE TABLE perfil_usuario (
    id_cliente INT PRIMARY KEY REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    direccion_residencia VARCHAR(255),
    ciudad VARCHAR(100) NOT NULL DEFAULT 'Bogotá',
    limite_credito NUMERIC(12, 2) DEFAULT 0.00 CHECK (limite_credito >= 0),
    nivel_fidelizacion VARCHAR(20) DEFAULT 'BRONCE'
);

-- 6. Pedidos (1:N con Clientes)
CREATE TABLE pedidos (
    id_pedido SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
    fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(30) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PAGADO', 'CANCELADO', 'ENTREGADO')),
    total NUMERIC(12, 2) DEFAULT 0.00 CHECK (total >= 0)
);

-- 7. Detalle de Pedidos (Relación N:M entre Pedidos y Productos)
CREATE TABLE detalle_pedidos (
    id_detalle SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
    id_producto INT NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    CONSTRAINT uq_pedido_producto UNIQUE (id_pedido, id_producto)
);

-- 8. Auditoría / Logs en Base de Datos
CREATE TABLE logs_auditoria (
    id_log SERIAL PRIMARY KEY,
    tabla_afectada VARCHAR(50) NOT NULL,
    operacion VARCHAR(20) NOT NULL,
    registro_id INT,
    detalle JSONB,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
