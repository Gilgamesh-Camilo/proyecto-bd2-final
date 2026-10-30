-- =====================================================================
-- Datos Semilla de Prueba
-- =====================================================================
INSERT INTO categorias (nombre, descripcion) VALUES
('Servidores', 'Hardware para data center y virtualización'),
('Redes', 'Switches, routers y cableado estructurado'),
('Periféricos', 'Monitores, teclados y accesorios');

INSERT INTO productos (id_categoria, codigo_sku, nombre, descripcion, precio) VALUES
(1, 'SRV-DL380', 'Servidor HP ProLiant DL380 Gen10', 'Intel Xeon 16 Core, 64GB RAM', 12500000.00),
(2, 'SW-CISCO-24', 'Switch Cisco Catalyst 24 Puertos', 'Switch administrable Capa 2/3', 3450000.00),
(3, 'MON-DELL-27', 'Monitor Dell UltraSharp 27 pulgadas', 'Panel IPS 4K para desarrollo', 1890000.00);

INSERT INTO inventario (id_producto, stock_actual, stock_minimo) VALUES
(1, 10, 2),
(2, 25, 5),
(3, 40, 8);

INSERT INTO clientes (numero_documento, nombres, apellidos, email, telefono) VALUES
('1010203040', 'Juan Camilo', 'Martín', 'jcmartin@unbosque.edu.co', '3101234567'),
('1020304050', 'Katherine', 'Gómez', 'kgomez@unbosque.edu.co', '3119876543');

INSERT INTO perfil_usuario (id_cliente, direccion_residencia, ciudad, limite_credito, nivel_fidelizacion) VALUES
(1, 'Av. Cra 9 # 131 A - 02', 'Bogotá', 25000000.00, 'ORO'),
(2, 'Calle 100 # 15 - 20', 'Bogotá', 15000000.00, 'PLATA');
