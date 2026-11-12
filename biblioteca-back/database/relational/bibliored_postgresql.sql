-- ====================================================================================
-- Autor       :
-- Fecha       : 2026-11-11
-- Version     : 1.2
-- Descripcion : Base relacional de BiblioRed, la red de bibliotecas por sedes
--               (PostgreSQL 14 o superior). Se ejecuta completo, como
--               superusuario, sobre una base vacia o sobre una version
--               anterior (la seccion 1 borra lo que exista):
--                   psql -U postgres -d biblioteca_db -f bibliored_postgresql.sql
--
-- Que queda en PostgreSQL y que va a MongoDB
--   PostgreSQL (este script): todo lo que tiene reglas, cupos, estados,
--   dinero o claves foraneas: sedes, personas, socios y carnes, empleados
--   y roles, libros, autores, ejemplares, prestamos, multas, reservas,
--   traslados y la auditoria que llenan los triggers.
--   MongoDB (bibliored_mongodb.js): lo que no tiene estructura fija o
--   crece sin afectar las reglas del negocio:
--     - fichas_bibliograficas: sinopsis, palabras clave, tabla de
--       contenido, premios y adaptaciones de cada libro.
--     - resenas: calificacion y opinion de los socios.
--     - busquedas: bitacora de lo que se busca en el catalogo.
--     - listas_lectura: listas que arma cada socio.
--   Los documentos se enlazan con esta base por id_libro e id_socio, y la
--   API revisa en PostgreSQL que esas claves existan antes de escribir.
--
-- Convenciones: fn_ funcion, sp_ procedimiento, fn_tgr_ funcion de
--               trigger, tgr_ + B/A + I/U/D trigger, ix_ indice, ux_
--               indice unico parcial, p_ parametro, v_ numero, vv_ texto,
--               vd_ fecha.
-- ====================================================================================

-- ====================================================================================
-- 1. SECCIÓN DDL: ELIMINACIÓN PREVIA (LIMPIEZA DE ENTORNO)
-- ====================================================================================
-- Los roles biblioteca_app y biblioteca_consulta no se borran: son del
-- servidor, no de la base, y la seccion 5 solo los crea si no existen.

DROP TRIGGER IF EXISTS tgr_bi_prestamos ON prestamos;
DROP TRIGGER IF EXISTS tgr_aiud_prestamos ON prestamos;
DROP TRIGGER IF EXISTS tgr_au_multas ON multas;
DROP TRIGGER IF EXISTS tgr_aiud_multas ON multas;
DROP TRIGGER IF EXISTS tgr_bu_empleados ON empleados;
DROP TRIGGER IF EXISTS tgr_aiud_empleados ON empleados;
DROP TRIGGER IF EXISTS tgr_biu_personas ON personas;
DROP TRIGGER IF EXISTS tgr_aiud_socios ON socios;
DROP TRIGGER IF EXISTS tgr_aiud_reservas ON reservas;
DROP TRIGGER IF EXISTS tgr_aiud_traslados ON traslados;
DROP TRIGGER IF EXISTS tgr_aiud_ejemplares ON ejemplares;

DROP PROCEDURE IF EXISTS sp_registrar_prestamo(INTEGER, INTEGER, INTEGER, INTEGER, VARCHAR);
DROP PROCEDURE IF EXISTS sp_registrar_devolucion(INTEGER, INTEGER, NUMERIC, VARCHAR);
DROP PROCEDURE IF EXISTS sp_renovar_prestamo(INTEGER, DATE, VARCHAR);
DROP PROCEDURE IF EXISTS sp_pagar_multa(INTEGER, BOOLEAN, VARCHAR);
DROP PROCEDURE IF EXISTS sp_crear_reserva(INTEGER, INTEGER, INTEGER, INTEGER, VARCHAR, VARCHAR);
DROP PROCEDURE IF EXISTS sp_cancelar_reserva(INTEGER, BOOLEAN, VARCHAR);
DROP PROCEDURE IF EXISTS sp_solicitar_traslado(INTEGER, INTEGER, INTEGER, VARCHAR, INTEGER, VARCHAR);
DROP PROCEDURE IF EXISTS sp_avanzar_traslado(INTEGER, INTEGER, VARCHAR, VARCHAR);
DROP PROCEDURE IF EXISTS sp_registrar_socio(VARCHAR, VARCHAR, VARCHAR, VARCHAR, DATE, VARCHAR, VARCHAR, VARCHAR, INTEGER, INTEGER, VARCHAR, VARCHAR);
DROP PROCEDURE IF EXISTS sp_registrar_acceso(INTEGER, BOOLEAN, VARCHAR, INTEGER);
DROP PROCEDURE IF EXISTS sp_actualizar_estados(INTEGER, INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS fn_dias_retraso(INTEGER);
DROP FUNCTION IF EXISTS fn_valor_multa_retraso(INTEGER);
DROP FUNCTION IF EXISTS fn_ejemplares_disponibles(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS fn_motivo_bloqueo_socio(INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS fn_asignar_siguiente_reserva(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS fn_tgr_bi_prestamos();
DROP FUNCTION IF EXISTS fn_tgr_au_multas();
DROP FUNCTION IF EXISTS fn_tgr_bu_empleados();
DROP FUNCTION IF EXISTS fn_tgr_biu_personas();
DROP FUNCTION IF EXISTS fn_tgr_auditoria();

DROP TABLE IF EXISTS auditoria CASCADE;
DROP TABLE IF EXISTS traslados CASCADE;
DROP TABLE IF EXISTS reservas CASCADE;
DROP TABLE IF EXISTS multas CASCADE;
DROP TABLE IF EXISTS prestamos CASCADE;
DROP TABLE IF EXISTS ejemplares CASCADE;
DROP TABLE IF EXISTS libros_autores CASCADE;
DROP TABLE IF EXISTS libros CASCADE;
DROP TABLE IF EXISTS autores CASCADE;
DROP TABLE IF EXISTS editoriales CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS empleados CASCADE;
DROP TABLE IF EXISTS carnes CASCADE;
DROP TABLE IF EXISTS socios CASCADE;
DROP TABLE IF EXISTS tipos_socio CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP TABLE IF EXISTS sedes CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ====================================================================================
-- 2. SECCIÓN DDL: CREACIÓN DE TABLAS (3FN - 18 ENTIDADES)
-- ====================================================================================
-- Toda la seccion va en una transaccion: si algo falla, no queda nada
-- creado a medias.

BEGIN;

-- ---------------------------------------------------------------------
-- 2.1 Tablas (en orden de dependencia)
-- ---------------------------------------------------------------------

CREATE TABLE roles (
    id_rol       INTEGER GENERATED BY DEFAULT AS IDENTITY,
    nombre       VARCHAR(30) NOT NULL,
    descripcion  VARCHAR(200)
);

CREATE TABLE sedes (
    id_sede         INTEGER GENERATED BY DEFAULT AS IDENTITY,
    nombre          VARCHAR(80) NOT NULL,
    direccion       VARCHAR(150) NOT NULL,
    ciudad          VARCHAR(60) NOT NULL,
    telefono        VARCHAR(20),
    fecha_apertura  DATE,
    estado          VARCHAR(10) DEFAULT 'ACTIVA' NOT NULL
);

CREATE TABLE personas (
    id_persona        INTEGER GENERATED BY DEFAULT AS IDENTITY,
    tipo_documento    VARCHAR(3) NOT NULL,
    numero_documento  VARCHAR(20) NOT NULL,
    nombres           VARCHAR(80) NOT NULL,
    apellidos         VARCHAR(80) NOT NULL,
    fecha_nacimiento  DATE NOT NULL,
    email             VARCHAR(120),
    telefono          VARCHAR(20)
);

CREATE TABLE tipos_socio (
    id_tipo_socio     INTEGER GENERATED BY DEFAULT AS IDENTITY,
    nombre            VARCHAR(30) NOT NULL,
    max_prestamos     INTEGER NOT NULL,
    dias_prestamo     INTEGER NOT NULL,
    max_renovaciones  INTEGER DEFAULT 1 NOT NULL,
    valor_multa_dia   NUMERIC(10,2) NOT NULL
);

CREATE TABLE socios (
    id_socio        INTEGER NOT NULL,
    id_tipo_socio   INTEGER NOT NULL,
    direccion       VARCHAR(150),
    fecha_registro  DATE DEFAULT CURRENT_DATE NOT NULL,
    estado          VARCHAR(12) DEFAULT 'ACTIVO' NOT NULL
);

CREATE TABLE carnes (
    id_carne           INTEGER GENERATED BY DEFAULT AS IDENTITY,
    id_socio           INTEGER NOT NULL,
    numero_carne       VARCHAR(20) NOT NULL,
    fecha_expedicion   DATE DEFAULT CURRENT_DATE NOT NULL,
    fecha_vencimiento  DATE NOT NULL,
    estado             VARCHAR(10) DEFAULT 'VIGENTE' NOT NULL
);

CREATE TABLE empleados (
    id_empleado        INTEGER NOT NULL,
    id_rol             INTEGER NOT NULL,
    id_sede            INTEGER NOT NULL,
    usuario            VARCHAR(30) NOT NULL,
    contrasena_hash    VARCHAR(255) NOT NULL,
    estado             VARCHAR(10) DEFAULT 'ACTIVO' NOT NULL,
    intentos_fallidos  INTEGER DEFAULT 0 NOT NULL,
    ultimo_acceso      TIMESTAMP,
    fecha_ingreso      DATE DEFAULT CURRENT_DATE NOT NULL
);

CREATE TABLE categorias (
    id_categoria  INTEGER GENERATED BY DEFAULT AS IDENTITY,
    codigo_dewey  VARCHAR(10) NOT NULL,
    nombre        VARCHAR(80) NOT NULL,
    descripcion   VARCHAR(300)
);

CREATE TABLE editoriales (
    id_editorial  INTEGER GENERATED BY DEFAULT AS IDENTITY,
    nombre        VARCHAR(100) NOT NULL,
    pais          VARCHAR(60),
    sitio_web     VARCHAR(150)
);

CREATE TABLE autores (
    id_autor          INTEGER GENERATED BY DEFAULT AS IDENTITY,
    nombres           VARCHAR(80) NOT NULL,
    apellidos         VARCHAR(80) NOT NULL,
    nacionalidad      VARCHAR(60),
    fecha_nacimiento  DATE
);

CREATE TABLE libros (
    id_libro          INTEGER GENERATED BY DEFAULT AS IDENTITY,
    id_editorial      INTEGER NOT NULL,
    id_categoria      INTEGER NOT NULL,
    isbn              VARCHAR(13) NOT NULL,
    titulo            VARCHAR(200) NOT NULL,
    subtitulo         VARCHAR(200),
    anio_publicacion  INTEGER,
    edicion           INTEGER DEFAULT 1 NOT NULL,
    numero_paginas    INTEGER,
    idioma            VARCHAR(2) DEFAULT 'es' NOT NULL
);

CREATE TABLE libros_autores (
    id_libro   INTEGER NOT NULL,
    id_autor   INTEGER NOT NULL,
    rol_autor  VARCHAR(12) DEFAULT 'AUTOR' NOT NULL,
    orden      INTEGER DEFAULT 1 NOT NULL
);

CREATE TABLE ejemplares (
    id_ejemplar        INTEGER GENERATED BY DEFAULT AS IDENTITY,
    id_libro           INTEGER NOT NULL,
    id_sede            INTEGER NOT NULL,
    codigo_barras      VARCHAR(20) NOT NULL,
    fecha_adquisicion  DATE DEFAULT CURRENT_DATE NOT NULL,
    ubicacion_estante  VARCHAR(30),
    valor_reposicion   NUMERIC(12,2),
    estado             VARCHAR(13) DEFAULT 'DISPONIBLE' NOT NULL
);

CREATE TABLE prestamos (
    id_prestamo         INTEGER GENERATED BY DEFAULT AS IDENTITY,
    id_ejemplar         INTEGER NOT NULL,
    id_socio            INTEGER NOT NULL,
    id_empleado         INTEGER NOT NULL,
    id_sede_prestamo    INTEGER NOT NULL,
    id_sede_devolucion  INTEGER,
    fecha_prestamo      DATE DEFAULT CURRENT_DATE NOT NULL,
    fecha_limite        DATE NOT NULL,
    fecha_devolucion    DATE,
    num_renovaciones    INTEGER DEFAULT 0 NOT NULL,
    estado              VARCHAR(10) DEFAULT 'ACTIVO' NOT NULL
);

CREATE TABLE multas (
    id_prestamo       INTEGER NOT NULL,
    motivo            VARCHAR(10) NOT NULL,
    valor             NUMERIC(12,2) NOT NULL,
    estado            VARCHAR(10) DEFAULT 'PENDIENTE' NOT NULL,
    fecha_generacion  DATE DEFAULT CURRENT_DATE NOT NULL,
    fecha_pago        DATE
);

CREATE TABLE reservas (
    id_reserva        INTEGER GENERATED BY DEFAULT AS IDENTITY,
    id_socio          INTEGER NOT NULL,
    id_libro          INTEGER NOT NULL,
    id_sede_retiro    INTEGER NOT NULL,
    id_ejemplar       INTEGER,
    fecha_reserva     TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_expiracion  DATE,
    estado            VARCHAR(10) DEFAULT 'EN_ESPERA' NOT NULL
);

CREATE TABLE traslados (
    id_traslado      INTEGER GENERATED BY DEFAULT AS IDENTITY,
    id_ejemplar      INTEGER NOT NULL,
    id_sede_origen   INTEGER NOT NULL,
    id_sede_destino  INTEGER NOT NULL,
    id_empleado      INTEGER NOT NULL,
    fecha_solicitud  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_envio      TIMESTAMP,
    fecha_recepcion  TIMESTAMP,
    estado           VARCHAR(12) DEFAULT 'SOLICITADO' NOT NULL,
    motivo           VARCHAR(200)
);

CREATE TABLE auditoria (
    id_auditoria        BIGINT GENERATED BY DEFAULT AS IDENTITY,
    tabla_afectada      VARCHAR(40) NOT NULL,
    operacion           VARCHAR(6) NOT NULL,
    clave_registro      VARCHAR(60) NOT NULL,
    usuario_bd          VARCHAR(60) DEFAULT CURRENT_USER NOT NULL,
    fecha               TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    valores_anteriores  JSONB,
    valores_nuevos      JSONB
);

-- ---------------------------------------------------------------------
-- 2.2 Claves primarias, unicas y restricciones CHECK
-- ---------------------------------------------------------------------

ALTER TABLE roles ADD CONSTRAINT pk_roles PRIMARY KEY (id_rol);
ALTER TABLE roles ADD CONSTRAINT uq_rol_nombre UNIQUE (nombre);

ALTER TABLE sedes ADD CONSTRAINT pk_sedes PRIMARY KEY (id_sede);
ALTER TABLE sedes ADD CONSTRAINT uq_sede_nombre UNIQUE (nombre);
ALTER TABLE sedes ADD CONSTRAINT ck_sede_estado
    CHECK (estado IN ('ACTIVA', 'CERRADA'));

ALTER TABLE personas ADD CONSTRAINT pk_personas PRIMARY KEY (id_persona);
ALTER TABLE personas ADD CONSTRAINT uq_per_email UNIQUE (email);
ALTER TABLE personas ADD CONSTRAINT uq_per_documento UNIQUE (tipo_documento, numero_documento);
ALTER TABLE personas ADD CONSTRAINT ck_per_tipo_documento
    CHECK (tipo_documento IN ('CC', 'TI', 'CE', 'PA'));
ALTER TABLE personas ADD CONSTRAINT ck_per_email
    CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$');

ALTER TABLE tipos_socio ADD CONSTRAINT pk_tipos_socio PRIMARY KEY (id_tipo_socio);
ALTER TABLE tipos_socio ADD CONSTRAINT uq_tso_nombre UNIQUE (nombre);
ALTER TABLE tipos_socio ADD CONSTRAINT ck_tso_max_prestamos
    CHECK (max_prestamos > 0);
ALTER TABLE tipos_socio ADD CONSTRAINT ck_tso_dias_prestamo
    CHECK (dias_prestamo > 0);
ALTER TABLE tipos_socio ADD CONSTRAINT ck_tso_max_renovaciones
    CHECK (max_renovaciones >= 0);
ALTER TABLE tipos_socio ADD CONSTRAINT ck_tso_valor_multa_dia
    CHECK (valor_multa_dia >= 0);

ALTER TABLE socios ADD CONSTRAINT pk_socios PRIMARY KEY (id_socio);
ALTER TABLE socios ADD CONSTRAINT ck_soc_estado
    CHECK (estado IN ('ACTIVO', 'SUSPENDIDO', 'RETIRADO'));

ALTER TABLE carnes ADD CONSTRAINT pk_carnes PRIMARY KEY (id_carne);
ALTER TABLE carnes ADD CONSTRAINT uq_car_id_socio UNIQUE (id_socio);
ALTER TABLE carnes ADD CONSTRAINT uq_car_numero_carne UNIQUE (numero_carne);
ALTER TABLE carnes ADD CONSTRAINT ck_car_estado
    CHECK (estado IN ('VIGENTE', 'VENCIDO', 'BLOQUEADO', 'ANULADO'));
ALTER TABLE carnes ADD CONSTRAINT ck_car_vigencia
    CHECK (fecha_vencimiento > fecha_expedicion);

ALTER TABLE empleados ADD CONSTRAINT pk_empleados PRIMARY KEY (id_empleado);
ALTER TABLE empleados ADD CONSTRAINT uq_emp_usuario UNIQUE (usuario);
ALTER TABLE empleados ADD CONSTRAINT ck_emp_estado
    CHECK (estado IN ('ACTIVO', 'INACTIVO', 'BLOQUEADO'));
ALTER TABLE empleados ADD CONSTRAINT ck_emp_intentos_fallidos
    CHECK (intentos_fallidos >= 0);

ALTER TABLE categorias ADD CONSTRAINT pk_categorias PRIMARY KEY (id_categoria);
ALTER TABLE categorias ADD CONSTRAINT uq_cat_codigo_dewey UNIQUE (codigo_dewey);
ALTER TABLE categorias ADD CONSTRAINT uq_cat_nombre UNIQUE (nombre);

ALTER TABLE editoriales ADD CONSTRAINT pk_editoriales PRIMARY KEY (id_editorial);
ALTER TABLE editoriales ADD CONSTRAINT uq_edi_nombre UNIQUE (nombre);

ALTER TABLE autores ADD CONSTRAINT pk_autores PRIMARY KEY (id_autor);

ALTER TABLE libros ADD CONSTRAINT pk_libros PRIMARY KEY (id_libro);
ALTER TABLE libros ADD CONSTRAINT uq_lib_isbn UNIQUE (isbn);
ALTER TABLE libros ADD CONSTRAINT ck_lib_isbn
    CHECK (isbn ~ '^[0-9]{13}$');
ALTER TABLE libros ADD CONSTRAINT ck_lib_anio_publicacion
    CHECK (anio_publicacion BETWEEN 1450 AND 2100);
ALTER TABLE libros ADD CONSTRAINT ck_lib_edicion
    CHECK (edicion > 0);
ALTER TABLE libros ADD CONSTRAINT ck_lib_numero_paginas
    CHECK (numero_paginas > 0);

ALTER TABLE libros_autores ADD CONSTRAINT pk_libros_autores PRIMARY KEY (id_libro, id_autor);
ALTER TABLE libros_autores ADD CONSTRAINT uq_lau_orden UNIQUE (id_libro, orden);
ALTER TABLE libros_autores ADD CONSTRAINT ck_lau_rol_autor
    CHECK (rol_autor IN ('AUTOR', 'COAUTOR', 'EDITOR', 'TRADUCTOR', 'ILUSTRADOR'));
ALTER TABLE libros_autores ADD CONSTRAINT ck_lau_orden
    CHECK (orden > 0);

ALTER TABLE ejemplares ADD CONSTRAINT pk_ejemplares PRIMARY KEY (id_ejemplar);
ALTER TABLE ejemplares ADD CONSTRAINT uq_eje_codigo_barras UNIQUE (codigo_barras);
ALTER TABLE ejemplares ADD CONSTRAINT ck_eje_valor_reposicion
    CHECK (valor_reposicion >= 0);
ALTER TABLE ejemplares ADD CONSTRAINT ck_eje_estado
    CHECK (estado IN ('DISPONIBLE', 'PRESTADO', 'RESERVADO', 'EN_TRASLADO', 'EN_REPARACION', 'PERDIDO', 'DE_BAJA'));

ALTER TABLE prestamos ADD CONSTRAINT pk_prestamos PRIMARY KEY (id_prestamo);
ALTER TABLE prestamos ADD CONSTRAINT ck_pre_num_renovaciones
    CHECK (num_renovaciones >= 0);
ALTER TABLE prestamos ADD CONSTRAINT ck_pre_estado
    CHECK (estado IN ('ACTIVO', 'VENCIDO', 'DEVUELTO', 'PERDIDO'));
ALTER TABLE prestamos ADD CONSTRAINT ck_pre_fechas
    CHECK (fecha_limite > fecha_prestamo);
ALTER TABLE prestamos ADD CONSTRAINT ck_pre_devolucion
    CHECK (fecha_devolucion IS NULL OR fecha_devolucion >= fecha_prestamo);
ALTER TABLE prestamos ADD CONSTRAINT ck_pre_sede_devolucion
    CHECK ((fecha_devolucion IS NULL AND id_sede_devolucion IS NULL) OR (fecha_devolucion IS NOT NULL AND id_sede_devolucion IS NOT NULL));

ALTER TABLE multas ADD CONSTRAINT pk_multas PRIMARY KEY (id_prestamo);
ALTER TABLE multas ADD CONSTRAINT ck_mul_motivo
    CHECK (motivo IN ('RETRASO', 'DANO', 'PERDIDA'));
ALTER TABLE multas ADD CONSTRAINT ck_mul_valor
    CHECK (valor >= 0);
ALTER TABLE multas ADD CONSTRAINT ck_mul_estado
    CHECK (estado IN ('PENDIENTE', 'PAGADA', 'CONDONADA'));
ALTER TABLE multas ADD CONSTRAINT ck_mul_pago
    CHECK (fecha_pago IS NULL OR fecha_pago >= fecha_generacion);
ALTER TABLE multas ADD CONSTRAINT ck_mul_estado_pago
    CHECK ((estado = 'PAGADA' AND fecha_pago IS NOT NULL) OR (estado <> 'PAGADA' AND fecha_pago IS NULL));

ALTER TABLE reservas ADD CONSTRAINT pk_reservas PRIMARY KEY (id_reserva);
ALTER TABLE reservas ADD CONSTRAINT ck_res_estado
    CHECK (estado IN ('EN_ESPERA', 'DISPONIBLE', 'ATENDIDA', 'CANCELADA', 'EXPIRADA'));
ALTER TABLE reservas ADD CONSTRAINT ck_res_disponible
    CHECK (estado <> 'DISPONIBLE' OR (id_ejemplar IS NOT NULL AND fecha_expiracion IS NOT NULL));

ALTER TABLE traslados ADD CONSTRAINT pk_traslados PRIMARY KEY (id_traslado);
ALTER TABLE traslados ADD CONSTRAINT ck_tra_estado
    CHECK (estado IN ('SOLICITADO', 'EN_TRANSITO', 'RECIBIDO', 'CANCELADO'));
ALTER TABLE traslados ADD CONSTRAINT ck_tra_sedes
    CHECK (id_sede_origen <> id_sede_destino);
ALTER TABLE traslados ADD CONSTRAINT ck_tra_envio
    CHECK (fecha_envio IS NULL OR fecha_envio >= fecha_solicitud);
ALTER TABLE traslados ADD CONSTRAINT ck_tra_recepcion
    CHECK (fecha_recepcion IS NULL OR (fecha_envio IS NOT NULL AND fecha_recepcion >= fecha_envio));

ALTER TABLE auditoria ADD CONSTRAINT pk_auditoria PRIMARY KEY (id_auditoria);
ALTER TABLE auditoria ADD CONSTRAINT ck_aud_operacion
    CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE'));

-- ---------------------------------------------------------------------
-- 2.3 Claves foraneas
-- ---------------------------------------------------------------------

ALTER TABLE socios ADD CONSTRAINT fk_soc_per
    FOREIGN KEY (id_socio) REFERENCES personas(id_persona) ON DELETE CASCADE;

ALTER TABLE socios ADD CONSTRAINT fk_soc_tipo_socio
    FOREIGN KEY (id_tipo_socio) REFERENCES tipos_socio(id_tipo_socio) ON DELETE RESTRICT;

ALTER TABLE carnes ADD CONSTRAINT fk_car_socio
    FOREIGN KEY (id_socio) REFERENCES socios(id_socio) ON DELETE CASCADE;

ALTER TABLE empleados ADD CONSTRAINT fk_emp_per
    FOREIGN KEY (id_empleado) REFERENCES personas(id_persona) ON DELETE CASCADE;

ALTER TABLE empleados ADD CONSTRAINT fk_emp_rol
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol) ON DELETE RESTRICT;

ALTER TABLE empleados ADD CONSTRAINT fk_emp_sede
    FOREIGN KEY (id_sede) REFERENCES sedes(id_sede) ON DELETE RESTRICT;

ALTER TABLE libros ADD CONSTRAINT fk_lib_editorial
    FOREIGN KEY (id_editorial) REFERENCES editoriales(id_editorial) ON DELETE RESTRICT;

ALTER TABLE libros ADD CONSTRAINT fk_lib_categoria
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria) ON DELETE RESTRICT;

ALTER TABLE libros_autores ADD CONSTRAINT fk_lau_lib
    FOREIGN KEY (id_libro) REFERENCES libros(id_libro) ON DELETE CASCADE;

ALTER TABLE libros_autores ADD CONSTRAINT fk_lau_aut
    FOREIGN KEY (id_autor) REFERENCES autores(id_autor) ON DELETE RESTRICT;

ALTER TABLE ejemplares ADD CONSTRAINT fk_eje_libro
    FOREIGN KEY (id_libro) REFERENCES libros(id_libro) ON DELETE RESTRICT;

ALTER TABLE ejemplares ADD CONSTRAINT fk_eje_sede
    FOREIGN KEY (id_sede) REFERENCES sedes(id_sede) ON DELETE RESTRICT;

ALTER TABLE prestamos ADD CONSTRAINT fk_pre_ejemplar
    FOREIGN KEY (id_ejemplar) REFERENCES ejemplares(id_ejemplar) ON DELETE RESTRICT;

ALTER TABLE prestamos ADD CONSTRAINT fk_pre_socio
    FOREIGN KEY (id_socio) REFERENCES socios(id_socio) ON DELETE RESTRICT;

ALTER TABLE prestamos ADD CONSTRAINT fk_pre_empleado
    FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado) ON DELETE RESTRICT;

ALTER TABLE prestamos ADD CONSTRAINT fk_pre_sede_prestamo
    FOREIGN KEY (id_sede_prestamo) REFERENCES sedes(id_sede) ON DELETE RESTRICT;

ALTER TABLE prestamos ADD CONSTRAINT fk_pre_sede_devolucion
    FOREIGN KEY (id_sede_devolucion) REFERENCES sedes(id_sede) ON DELETE RESTRICT;

ALTER TABLE multas ADD CONSTRAINT fk_mul_pre
    FOREIGN KEY (id_prestamo) REFERENCES prestamos(id_prestamo) ON DELETE RESTRICT;

ALTER TABLE reservas ADD CONSTRAINT fk_res_socio
    FOREIGN KEY (id_socio) REFERENCES socios(id_socio) ON DELETE RESTRICT;

ALTER TABLE reservas ADD CONSTRAINT fk_res_libro
    FOREIGN KEY (id_libro) REFERENCES libros(id_libro) ON DELETE RESTRICT;

ALTER TABLE reservas ADD CONSTRAINT fk_res_sede_retiro
    FOREIGN KEY (id_sede_retiro) REFERENCES sedes(id_sede) ON DELETE RESTRICT;

ALTER TABLE reservas ADD CONSTRAINT fk_res_ejemplar
    FOREIGN KEY (id_ejemplar) REFERENCES ejemplares(id_ejemplar) ON DELETE RESTRICT;

ALTER TABLE traslados ADD CONSTRAINT fk_tra_ejemplar
    FOREIGN KEY (id_ejemplar) REFERENCES ejemplares(id_ejemplar) ON DELETE RESTRICT;

ALTER TABLE traslados ADD CONSTRAINT fk_tra_sede_origen
    FOREIGN KEY (id_sede_origen) REFERENCES sedes(id_sede) ON DELETE RESTRICT;

ALTER TABLE traslados ADD CONSTRAINT fk_tra_sede_destino
    FOREIGN KEY (id_sede_destino) REFERENCES sedes(id_sede) ON DELETE RESTRICT;

ALTER TABLE traslados ADD CONSTRAINT fk_tra_empleado
    FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- 2.4 Indices: claves foraneas, consultas frecuentes e integridad
--    (los ux_ son unicos parciales: solo aplican a filas abiertas)
-- ---------------------------------------------------------------------

CREATE INDEX ix_emp_rol ON empleados (id_rol);
CREATE INDEX ix_emp_sede ON empleados (id_sede);
CREATE INDEX ix_soc_tipo ON socios (id_tipo_socio);
CREATE INDEX ix_lib_editorial ON libros (id_editorial);
CREATE INDEX ix_lib_categoria ON libros (id_categoria);
CREATE INDEX ix_lau_autor ON libros_autores (id_autor);
CREATE INDEX ix_eje_libro_sede ON ejemplares (id_libro, id_sede);
CREATE INDEX ix_eje_sede ON ejemplares (id_sede);
CREATE INDEX ix_pre_ejemplar ON prestamos (id_ejemplar);
CREATE INDEX ix_pre_socio_estado ON prestamos (id_socio, estado);
CREATE INDEX ix_pre_empleado ON prestamos (id_empleado);
CREATE INDEX ix_pre_sede_prestamo ON prestamos (id_sede_prestamo);
CREATE INDEX ix_pre_sede_devolucion ON prestamos (id_sede_devolucion);
CREATE UNIQUE INDEX ux_pre_abierto ON prestamos (id_ejemplar)
    WHERE estado IN ('ACTIVO', 'VENCIDO');
CREATE INDEX ix_res_libro_cola ON reservas (id_libro, estado, fecha_reserva);
CREATE INDEX ix_res_socio ON reservas (id_socio);
CREATE INDEX ix_res_sede ON reservas (id_sede_retiro);
CREATE INDEX ix_res_ejemplar ON reservas (id_ejemplar);
CREATE UNIQUE INDEX ux_res_abierta ON reservas (id_socio, id_libro)
    WHERE estado IN ('EN_ESPERA', 'DISPONIBLE');
CREATE INDEX ix_tra_ejemplar ON traslados (id_ejemplar);
CREATE INDEX ix_tra_origen ON traslados (id_sede_origen);
CREATE INDEX ix_tra_destino ON traslados (id_sede_destino);
CREATE INDEX ix_tra_empleado ON traslados (id_empleado);
CREATE UNIQUE INDEX ux_tra_abierto ON traslados (id_ejemplar)
    WHERE estado IN ('SOLICITADO', 'EN_TRANSITO');
CREATE INDEX ix_aud_tabla_fecha ON auditoria (tabla_afectada, fecha);

-- ---------------------------------------------------------------------
-- 2.5 Diccionario de datos (comentarios)
-- ---------------------------------------------------------------------

COMMENT ON TABLE roles IS 'Perfiles de acceso de los empleados al sistema (seguridad).';
COMMENT ON COLUMN roles.id_rol IS 'Identificador del rol, autoincremental.';
COMMENT ON COLUMN roles.nombre IS 'Nombre del rol: ADMINISTRADOR, BIBLIOTECARIO, AUXILIAR, etc.';
COMMENT ON COLUMN roles.descripcion IS 'Que puede hacer el rol dentro del sistema.';

COMMENT ON TABLE sedes IS 'Bibliotecas de la red.';
COMMENT ON COLUMN sedes.id_sede IS 'Identificador de la sede, autoincremental.';
COMMENT ON COLUMN sedes.nombre IS 'Nombre de la sede; no se repite.';
COMMENT ON COLUMN sedes.direccion IS 'Direccion de la sede.';
COMMENT ON COLUMN sedes.ciudad IS 'Ciudad donde esta la sede.';
COMMENT ON COLUMN sedes.telefono IS 'Telefono de la sede.';
COMMENT ON COLUMN sedes.fecha_apertura IS 'Fecha en que la sede empezo a funcionar.';
COMMENT ON COLUMN sedes.estado IS 'ACTIVA o CERRADA. Una sede cerrada no presta ni recibe traslados.';

COMMENT ON TABLE personas IS 'Datos personales comunes a socios y empleados; una persona puede ser ambas cosas.';
COMMENT ON COLUMN personas.id_persona IS 'Identificador de la persona, autoincremental.';
COMMENT ON COLUMN personas.tipo_documento IS 'Tipo de documento: CC, TI, CE o PA. Junto con numero_documento forma una clave unica.';
COMMENT ON COLUMN personas.numero_documento IS 'Numero del documento de identidad.';
COMMENT ON COLUMN personas.nombres IS 'Nombres de la persona.';
COMMENT ON COLUMN personas.apellidos IS 'Apellidos de la persona.';
COMMENT ON COLUMN personas.fecha_nacimiento IS 'Fecha de nacimiento. La edad no se guarda: se calcula.';
COMMENT ON COLUMN personas.email IS 'Correo electronico; opcional, pero no se repite.';
COMMENT ON COLUMN personas.telefono IS 'Telefono de contacto.';

COMMENT ON TABLE tipos_socio IS 'Categorias de socio y las condiciones de prestamo de cada una.';
COMMENT ON COLUMN tipos_socio.id_tipo_socio IS 'Identificador del tipo de socio, autoincremental.';
COMMENT ON COLUMN tipos_socio.nombre IS 'ESTUDIANTE, DOCENTE, GENERAL, etc.';
COMMENT ON COLUMN tipos_socio.max_prestamos IS 'Prestamos simultaneos que puede tener un socio de este tipo.';
COMMENT ON COLUMN tipos_socio.dias_prestamo IS 'Dias que dura un prestamo antes de vencerse.';
COMMENT ON COLUMN tipos_socio.max_renovaciones IS 'Veces que se puede renovar un mismo prestamo.';
COMMENT ON COLUMN tipos_socio.valor_multa_dia IS 'Valor de la multa por cada dia de retraso.';

COMMENT ON TABLE socios IS 'Personas inscritas para usar los servicios de la red.';
COMMENT ON COLUMN socios.id_socio IS 'Clave primaria y foranea a personas: el socio es la misma persona (subtipo).';
COMMENT ON COLUMN socios.id_tipo_socio IS 'Tipo de socio, que fija sus condiciones de prestamo.';
COMMENT ON COLUMN socios.direccion IS 'Direccion de residencia del socio.';
COMMENT ON COLUMN socios.fecha_registro IS 'Fecha de inscripcion en la red.';
COMMENT ON COLUMN socios.estado IS 'ACTIVO, SUSPENDIDO (no puede prestar) o RETIRADO.';

COMMENT ON TABLE carnes IS 'Carne de cada socio; un socio tiene a lo sumo uno.';
COMMENT ON COLUMN carnes.id_carne IS 'Identificador del carne, autoincremental.';
COMMENT ON COLUMN carnes.id_socio IS 'Socio dueno del carne. Es UNIQUE, y eso es lo que hace la relacion 1:1.';
COMMENT ON COLUMN carnes.numero_carne IS 'Numero impreso en el carne (codigo de barras).';
COMMENT ON COLUMN carnes.fecha_expedicion IS 'Fecha en que se expidio o se repuso el carne.';
COMMENT ON COLUMN carnes.fecha_vencimiento IS 'Fecha hasta la que el carne es valido.';
COMMENT ON COLUMN carnes.estado IS 'VIGENTE, VENCIDO, BLOQUEADO o ANULADO.';

COMMENT ON TABLE empleados IS 'Personal de la red que opera el sistema.';
COMMENT ON COLUMN empleados.id_empleado IS 'Clave primaria y foranea a personas: el empleado es la misma persona (subtipo).';
COMMENT ON COLUMN empleados.id_rol IS 'Rol que define los permisos del empleado.';
COMMENT ON COLUMN empleados.id_sede IS 'Sede donde trabaja el empleado.';
COMMENT ON COLUMN empleados.usuario IS 'Nombre de usuario para entrar al sistema.';
COMMENT ON COLUMN empleados.contrasena_hash IS 'Hash de la contrasena. La contrasena nunca se guarda en texto plano.';
COMMENT ON COLUMN empleados.estado IS 'ACTIVO, INACTIVO o BLOQUEADO (por intentos fallidos).';
COMMENT ON COLUMN empleados.intentos_fallidos IS 'Intentos de ingreso fallidos seguidos.';
COMMENT ON COLUMN empleados.ultimo_acceso IS 'Fecha y hora del ultimo ingreso exitoso.';
COMMENT ON COLUMN empleados.fecha_ingreso IS 'Fecha de vinculacion del empleado.';

COMMENT ON TABLE categorias IS 'Clasificacion tematica de los libros (sistema Dewey).';
COMMENT ON COLUMN categorias.id_categoria IS 'Identificador de la categoria, autoincremental.';
COMMENT ON COLUMN categorias.codigo_dewey IS 'Codigo de clasificacion Dewey; no se repite.';
COMMENT ON COLUMN categorias.nombre IS 'Nombre de la categoria; no se repite.';
COMMENT ON COLUMN categorias.descripcion IS 'Que temas abarca la categoria.';

COMMENT ON TABLE editoriales IS 'Editoriales que publican los libros del catalogo.';
COMMENT ON COLUMN editoriales.id_editorial IS 'Identificador de la editorial, autoincremental.';
COMMENT ON COLUMN editoriales.nombre IS 'Nombre de la editorial; no se repite.';
COMMENT ON COLUMN editoriales.pais IS 'Pais de la editorial.';
COMMENT ON COLUMN editoriales.sitio_web IS 'Sitio web de la editorial.';

COMMENT ON TABLE autores IS 'Personas que escriben, editan, traducen o ilustran libros.';
COMMENT ON COLUMN autores.id_autor IS 'Identificador del autor. Los nombres pueden repetirse (homonimos), por eso no hay clave natural.';
COMMENT ON COLUMN autores.nombres IS 'Nombres del autor.';
COMMENT ON COLUMN autores.apellidos IS 'Apellidos del autor.';
COMMENT ON COLUMN autores.nacionalidad IS 'Nacionalidad del autor.';
COMMENT ON COLUMN autores.fecha_nacimiento IS 'Fecha de nacimiento del autor.';

COMMENT ON TABLE libros IS 'Obras del catalogo (la obra, no la copia fisica).';
COMMENT ON COLUMN libros.id_libro IS 'Identificador del libro, autoincremental.';
COMMENT ON COLUMN libros.id_editorial IS 'Editorial que publica el libro.';
COMMENT ON COLUMN libros.id_categoria IS 'Categoria Dewey del libro.';
COMMENT ON COLUMN libros.isbn IS 'ISBN-13 sin guiones: exactamente 13 digitos. No se repite.';
COMMENT ON COLUMN libros.titulo IS 'Titulo del libro.';
COMMENT ON COLUMN libros.subtitulo IS 'Subtitulo, si tiene.';
COMMENT ON COLUMN libros.anio_publicacion IS 'Ano de publicacion de la edicion.';
COMMENT ON COLUMN libros.edicion IS 'Numero de edicion.';
COMMENT ON COLUMN libros.numero_paginas IS 'Numero de paginas.';
COMMENT ON COLUMN libros.idioma IS 'Idioma del libro, codigo ISO 639-1 (es, en, fr...).';

COMMENT ON TABLE libros_autores IS 'Autores de cada libro y el papel de cada uno; resuelve la relacion N:M.';
COMMENT ON COLUMN libros_autores.id_libro IS 'Libro. Parte de la clave primaria.';
COMMENT ON COLUMN libros_autores.id_autor IS 'Autor. Parte de la clave primaria.';
COMMENT ON COLUMN libros_autores.rol_autor IS 'Papel de la persona en el libro.';
COMMENT ON COLUMN libros_autores.orden IS 'Orden en que aparece en la portada; no se repite dentro de un libro.';

COMMENT ON TABLE ejemplares IS 'Copias fisicas de cada libro; lo que se presta es un ejemplar.';
COMMENT ON COLUMN ejemplares.id_ejemplar IS 'Identificador del ejemplar, autoincremental.';
COMMENT ON COLUMN ejemplares.id_libro IS 'Libro del que es copia.';
COMMENT ON COLUMN ejemplares.id_sede IS 'Sede donde esta el ejemplar ahora; cambia con los traslados y las devoluciones en otra sede.';
COMMENT ON COLUMN ejemplares.codigo_barras IS 'Codigo de barras pegado en el ejemplar; no se repite.';
COMMENT ON COLUMN ejemplares.fecha_adquisicion IS 'Fecha en que el ejemplar entro a la red.';
COMMENT ON COLUMN ejemplares.ubicacion_estante IS 'Signatura topografica: donde va en el estante.';
COMMENT ON COLUMN ejemplares.valor_reposicion IS 'Lo que cuesta reponerlo; es la base de la multa por perdida.';
COMMENT ON COLUMN ejemplares.estado IS 'Situacion actual del ejemplar. PRESTADO y EN_TRASLADO los mantienen los procedimientos (redundancia controlada).';

COMMENT ON TABLE prestamos IS 'Prestamo de un ejemplar a un socio.';
COMMENT ON COLUMN prestamos.id_prestamo IS 'Identificador del prestamo, autoincremental.';
COMMENT ON COLUMN prestamos.id_ejemplar IS 'Ejemplar prestado.';
COMMENT ON COLUMN prestamos.id_socio IS 'Socio que se lleva el ejemplar.';
COMMENT ON COLUMN prestamos.id_empleado IS 'Empleado que registra el prestamo.';
COMMENT ON COLUMN prestamos.id_sede_prestamo IS 'Sede donde se entrega el ejemplar.';
COMMENT ON COLUMN prestamos.id_sede_devolucion IS 'Sede donde se devolvio; puede ser otra. Nula mientras no se devuelva.';
COMMENT ON COLUMN prestamos.fecha_prestamo IS 'Fecha del prestamo.';
COMMENT ON COLUMN prestamos.fecha_limite IS 'Fecha en que vence. Se fija al prestar y se corre con cada renovacion.';
COMMENT ON COLUMN prestamos.fecha_devolucion IS 'Fecha de devolucion; nula mientras el ejemplar no vuelva.';
COMMENT ON COLUMN prestamos.num_renovaciones IS 'Veces que se ha renovado el prestamo.';
COMMENT ON COLUMN prestamos.estado IS 'ACTIVO, VENCIDO, DEVUELTO o PERDIDO.';

COMMENT ON TABLE multas IS 'Multa generada por un prestamo; un prestamo tiene a lo sumo una.';
COMMENT ON COLUMN multas.id_prestamo IS 'Prestamo que genero la multa. Es PK y FK: por eso la relacion es 1:1.';
COMMENT ON COLUMN multas.motivo IS 'RETRASO, DANO (dano) o PERDIDA.';
COMMENT ON COLUMN multas.valor IS 'Valor cobrado. Se guarda porque la tarifa puede cambiar despues (dato historico).';
COMMENT ON COLUMN multas.estado IS 'PENDIENTE, PAGADA o CONDONADA.';
COMMENT ON COLUMN multas.fecha_generacion IS 'Fecha en que se genero la multa.';
COMMENT ON COLUMN multas.fecha_pago IS 'Fecha de pago; solo existe si la multa esta PAGADA.';

COMMENT ON TABLE reservas IS 'Cola de espera de los socios por un libro, para retirarlo en una sede.';
COMMENT ON COLUMN reservas.id_reserva IS 'Identificador de la reserva, autoincremental.';
COMMENT ON COLUMN reservas.id_socio IS 'Socio que reserva.';
COMMENT ON COLUMN reservas.id_libro IS 'Libro reservado (se reserva la obra, no una copia).';
COMMENT ON COLUMN reservas.id_sede_retiro IS 'Sede donde el socio quiere recoger el libro.';
COMMENT ON COLUMN reservas.id_ejemplar IS 'Ejemplar apartado para el socio; nulo mientras esta en espera.';
COMMENT ON COLUMN reservas.fecha_reserva IS 'Momento de la reserva; define el orden de la cola.';
COMMENT ON COLUMN reservas.fecha_expiracion IS 'Ultimo dia para recoger el ejemplar apartado.';
COMMENT ON COLUMN reservas.estado IS 'EN_ESPERA, DISPONIBLE (apartado), ATENDIDA, CANCELADA o EXPIRADA.';

COMMENT ON TABLE traslados IS 'Envio de un ejemplar de una sede a otra.';
COMMENT ON COLUMN traslados.id_traslado IS 'Identificador del traslado, autoincremental.';
COMMENT ON COLUMN traslados.id_ejemplar IS 'Ejemplar que se traslada.';
COMMENT ON COLUMN traslados.id_sede_origen IS 'Sede que despacha el ejemplar.';
COMMENT ON COLUMN traslados.id_sede_destino IS 'Sede que lo recibe; distinta del origen.';
COMMENT ON COLUMN traslados.id_empleado IS 'Empleado que solicita el traslado.';
COMMENT ON COLUMN traslados.fecha_solicitud IS 'Momento en que se pidio el traslado.';
COMMENT ON COLUMN traslados.fecha_envio IS 'Momento en que salio de la sede de origen.';
COMMENT ON COLUMN traslados.fecha_recepcion IS 'Momento en que llego a la sede de destino.';
COMMENT ON COLUMN traslados.estado IS 'SOLICITADO, EN_TRANSITO, RECIBIDO o CANCELADO.';
COMMENT ON COLUMN traslados.motivo IS 'Por que se traslada (reserva en otra sede, rebalanceo, reparacion...).';

COMMENT ON TABLE auditoria IS 'Bitacora de cambios que escriben los triggers; no tiene relaciones.';
COMMENT ON COLUMN auditoria.id_auditoria IS 'Identificador del registro de auditoria, autoincremental.';
COMMENT ON COLUMN auditoria.tabla_afectada IS 'Tabla en la que ocurrio el cambio.';
COMMENT ON COLUMN auditoria.operacion IS 'INSERT, UPDATE o DELETE.';
COMMENT ON COLUMN auditoria.clave_registro IS 'Clave del registro afectado como texto (para claves compuestas, separada por ;). No es FK porque apunta a tablas distintas.';
COMMENT ON COLUMN auditoria.usuario_bd IS 'Usuario de base de datos que hizo el cambio.';
COMMENT ON COLUMN auditoria.fecha IS 'Momento del cambio.';
COMMENT ON COLUMN auditoria.valores_anteriores IS 'Fila antes del cambio, en JSON (nula en INSERT).';
COMMENT ON COLUMN auditoria.valores_nuevos IS 'Fila despues del cambio, en JSON (nula en DELETE).';

COMMIT;

-- ====================================================================================
-- 3. SECCIÓN DML: DATOS SEMILLA (INSERCIONES DE PRUEBA)
-- ====================================================================================
-- Va antes de la programabilidad a proposito: los datos simulan la
-- operacion del 3 de agosto al 24 de octubre de 2026 (prestamos ya
-- vencidos o devueltos, multas pagadas) y los triggers de la seccion 4
-- rechazarian esos movimientos historicos, porque validan cada prestamo
-- nuevo contra la fecha de hoy. Por la misma razon, la tabla auditoria
-- empieza vacia: la llenan los triggers desde la primera operacion.
-- Las claves se insertan explicitas para que las FK se puedan leer; al
-- final se ajustan las secuencias. Personas ficticias e ISBN no reales.

SET client_encoding = 'UTF8';
BEGIN;

-- ---------------------------------------------------------------------
-- 3.1 Catalogos y seguridad
-- ---------------------------------------------------------------------

-- Roles del personal
INSERT INTO roles (id_rol, nombre, descripcion) VALUES
  (1, 'ADMINISTRADOR', 'Administra usuarios, roles, sedes y catálogo.'),
  (2, 'BIBLIOTECARIO', 'Registra préstamos, devoluciones, reservas, multas y traslados.'),
  (3, 'AUXILIAR', 'Registra préstamos y devoluciones; consulta el catálogo.');

-- Sedes de la red (Kennedy esta cerrada: no tiene ejemplares ni movimientos)
INSERT INTO sedes (id_sede, nombre, direccion, ciudad, telefono, fecha_apertura, estado) VALUES
  (1, 'Sede Usaquén', 'Cl 120 # 7-15', 'Bogotá', '6015550101', '2015-03-02', 'ACTIVA'),
  (2, 'Sede Chapinero', 'Cl 61 # 9-20', 'Bogotá', '6015550102', '2017-08-14', 'ACTIVA'),
  (3, 'Sede Teusaquillo', 'Cra 19 # 39-50', 'Bogotá', '6015550103', '2019-02-04', 'ACTIVA'),
  (4, 'Sede Suba', 'Cl 145 # 91-19', 'Bogotá', '6015550104', '2021-06-21', 'ACTIVA'),
  (5, 'Sede Kennedy', 'Cra 78 # 38-12 sur', 'Bogotá', NULL, '2016-10-10', 'CERRADA');

-- Tipos de socio con sus condiciones de prestamo
INSERT INTO tipos_socio (id_tipo_socio, nombre, max_prestamos, dias_prestamo, max_renovaciones, valor_multa_dia) VALUES
  (1, 'ESTUDIANTE', 3, 15, 2, 800),
  (2, 'DOCENTE', 5, 30, 2, 600),
  (3, 'GENERAL', 2, 10, 1, 1200),
  (4, 'ADULTO_MAYOR', 2, 20, 2, 500);

-- Categorias Dewey
INSERT INTO categorias (id_categoria, codigo_dewey, nombre, descripcion) VALUES
  (1, '005.74', 'Bases de datos', 'Diseño, administración y consulta de bases de datos.'),
  (2, '005.13', 'Programación', 'Lenguajes y prácticas de programación.'),
  (3, '519.5', 'Estadística', 'Estadística descriptiva e inferencial.'),
  (4, 'Co863', 'Novela colombiana', 'Narrativa de autores colombianos.'),
  (5, '863', 'Narrativa en español', 'Novela y cuento de otros países de lengua española.'),
  (6, '986.1', 'Historia de Colombia', NULL),
  (7, '520', 'Astronomía y cosmología', 'Divulgación científica sobre el universo.'),
  (8, '741.5', 'Historieta y novela gráfica', NULL);

-- Editoriales
INSERT INTO editoriales (id_editorial, nombre, pais, sitio_web) VALUES
  (1, 'McGraw-Hill Interamericana', 'España', NULL),
  (2, 'Pearson Educación', 'México', NULL),
  (3, 'O''Reilly Media', 'Estados Unidos', 'https://www.oreilly.com'),
  (4, 'Penguin Random House', 'Colombia', NULL),
  (5, 'Planeta', 'Colombia', NULL),
  (6, 'Panamericana Editorial', 'Colombia', NULL),
  (7, 'Cengage Learning', 'México', NULL),
  (8, 'Turner', 'España', NULL),
  (9, 'Lumen', 'Argentina', NULL);

-- Autores
INSERT INTO autores (id_autor, nombres, apellidos, nacionalidad, fecha_nacimiento) VALUES
  (1, 'Abraham', 'Silberschatz', 'Estados Unidos', NULL),
  (2, 'Henry F.', 'Korth', 'Estados Unidos', NULL),
  (3, 'S.', 'Sudarshan', 'India', NULL),
  (4, 'Ramez', 'Elmasri', 'Estados Unidos', NULL),
  (5, 'Shamkant B.', 'Navathe', 'India', NULL),
  (6, 'Anthony', 'Molinaro', 'Estados Unidos', NULL),
  (7, 'Paul', 'Deitel', 'Estados Unidos', NULL),
  (8, 'Harvey', 'Deitel', 'Estados Unidos', NULL),
  (9, 'Robert C.', 'Martin', 'Estados Unidos', NULL),
  (10, 'David R.', 'Anderson', 'Estados Unidos', NULL),
  (11, 'Dennis J.', 'Sweeney', 'Estados Unidos', NULL),
  (12, 'Thomas A.', 'Williams', 'Estados Unidos', NULL),
  (13, 'Gabriel', 'García Márquez', 'Colombia', '1927-03-06'),
  (14, 'José Eustasio', 'Rivera', 'Colombia', '1888-02-19'),
  (15, 'Laura', 'Restrepo', 'Colombia', NULL),
  (16, 'Héctor', 'Abad Faciolince', 'Colombia', NULL),
  (17, 'Mario', 'Mendoza', 'Colombia', NULL),
  (18, 'Julio', 'Cortázar', 'Argentina', '1914-08-26'),
  (19, 'Juan', 'Rulfo', 'México', '1917-05-16'),
  (20, 'Jorge Luis', 'Borges', 'Argentina', '1899-08-24'),
  (21, 'Jorge Orlando', 'Melo', 'Colombia', NULL),
  (22, 'Carl', 'Sagan', 'Estados Unidos', '1934-11-09'),
  (23, 'Stephen', 'Hawking', 'Reino Unido', '1942-01-08'),
  (24, 'Joaquín Salvador', 'Lavado Tejón', 'Argentina', '1932-07-17'),
  (25, 'Marjane', 'Satrapi', 'Irán', '1969-11-22');

-- ---------------------------------------------------------------------
-- 3.2 Personas: supertipo y subtipos
-- ---------------------------------------------------------------------

-- Personas (1 a 8 son empleados; 3 y 6 tambien son socios)
INSERT INTO personas (id_persona, tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, email, telefono) VALUES
  (1, 'CC', '79845120', 'Wilmar', 'Cuervo Ladino', '1986-04-11', 'wcuervo@redbibliotecas.example', '3105550101'),
  (2, 'CC', '52733918', 'Nidia', 'Avendaño Rubio', '1979-09-23', 'navendano@redbibliotecas.example', '3105550102'),
  (3, 'CC', '1020745561', 'Fabián', 'Garzón Pulido', '1992-01-30', 'fgarzon@redbibliotecas.example', '3105550103'),
  (4, 'CC', '1032488170', 'Leidy Tatiana', 'Moscoso Rey', '1997-06-08', 'lmoscoso@redbibliotecas.example', '3105550104'),
  (5, 'CC', '80412633', 'Hernán Darío', 'Pinilla Vaca', '1983-12-02', 'hpinilla@redbibliotecas.example', '3105550105'),
  (6, 'CC', '1015466902', 'Yamile', 'Contreras Ospina', '2001-03-19', 'ycontreras@redbibliotecas.example', '3105550106'),
  (7, 'CC', '79566214', 'Édgar', 'Rojas Bermúdez', '1977-08-15', 'erojas@redbibliotecas.example', '3105550107'),
  (8, 'CC', '1019102345', 'Marcela', 'Ibáñez Chitiva', '1994-11-27', 'mibanez@redbibliotecas.example', '3105550108'),
  (9, 'CC', '1001283746', 'Maryuri', 'Quiroga Benavides', '2003-05-17', 'mquiroga@correo.example', '3125550109'),
  (10, 'CC', '80123456', 'Dairo', 'Sanabria Castellanos', '1988-11-02', 'dsanabria@correo.example', '3125550110'),
  (11, 'CC', '1000564321', 'Yeraldín', 'Socha Moreno', '2004-02-29', 'ysocha@correo.example', '3125550111'),
  (12, 'CC', '1002987654', 'Anderson', 'Pachón Gil', '2002-07-04', 'apachon@correo.example', '3125550112'),
  (13, 'CC', '52144780', 'Rocío del Pilar', 'Neira Suárez', '1975-10-12', 'rneira@correo.example', '3125550113'),
  (14, 'CC', '79388002', 'Gustavo Adolfo', 'Tibaduiza León', '1969-05-21', 'gtibaduiza@correo.example', '3125550114'),
  (15, 'CC', '1003456112', 'Karen Lizeth', 'Barbosa Amaya', '2005-01-14', 'kbarbosa@correo.example', '3125550115'),
  (16, 'CC', '17165203', 'Ramiro', 'Echeverry Salcedo', '1951-03-03', NULL, '6015550116'),
  (17, 'CC', '51877650', 'Luz Dary', 'Fonseca Pinzón', '1972-09-09', 'lfonseca@correo.example', '3125550117'),
  (18, 'CC', '1016023987', 'Jhon Fredy', 'Arévalo Cruz', '1995-12-18', 'jarevalo@correo.example', '3125550118'),
  (19, 'CC', '1000873221', 'Ingrid Paola', 'Mahecha Villamil', '2003-08-25', 'imahecha@correo.example', '3125550119'),
  (20, 'CC', '1001922840', 'Sebastián', 'Rincón Zambrano', '2004-04-02', 'srincon@correo.example', '3125550120'),
  (21, 'CC', '41633520', 'Esperanza', 'Cubillos Ardila', '1958-06-30', 'ecubillos@correo.example', '6015550121'),
  (22, 'CC', '80799115', 'Néstor Iván', 'Vargas Quintero', '1981-02-16', 'nvargas@correo.example', '3125550122'),
  (23, 'CC', '1002365478', 'Daniela Alejandra', 'Patiño Sierra', '2002-10-07', 'dpatino@correo.example', '3125550123'),
  (24, 'CC', '1018477336', 'Óscar Mauricio', 'Bello Rangel', '1990-07-22', 'obello@correo.example', '3125550124'),
  (25, 'CE', 'E4518822', 'Valeria', 'Galindo Cárdenas', '1999-05-05', 'vgalindo@correo.example', '3125550125'),
  (26, 'TI', '1011234567', 'Samuel', 'Cifuentes Parra', '2011-09-13', NULL, '3125550126'),
  (27, 'CC', '52600871', 'Luisa Fernanda', 'Ortegón Chaparro', '1980-01-09', 'lortegon@correo.example', '3125550127'),
  (28, 'CC', '79911402', 'Wilson', 'Hurtado Lozano', '1984-03-27', 'whurtado@correo.example', '3125550128'),
  (29, 'CC', '52398760', 'Claudia Patricia', 'Sarmiento Jaimes', '1976-12-01', 'csarmiento@correo.example', '3125550129'),
  (30, 'CC', '1004788123', 'Mateo', 'Benavides Roa', '2003-11-11', 'mbenavides@correo.example', '3125550130'),
  (31, 'CC', '41422907', 'Gloria Inés', 'Murcia Calderón', '1955-08-19', 'gmurcia@correo.example', '6015550131'),
  (32, 'CC', '1005632019', 'Brayan Stiven', 'Melo Cortés', '2005-06-23', 'bmelo@correo.example', '3125550132'),
  (33, 'CC', '1007210345', 'Natalia', 'Quintana Bohórquez', '2006-02-10', 'nquintana@correo.example', '3125550133'),
  (34, 'PA', 'AV381245', 'Joaquín', 'Ferreira Lustosa', '1987-04-14', 'jferreira@correo.example', '3125550134');

-- Empleados: contrasena_hash en formato PBKDF2 de Django; la clave de prueba de todos es Biblioteca#2026
INSERT INTO empleados (id_empleado, id_rol, id_sede, usuario, contrasena_hash, estado, intentos_fallidos, ultimo_acceso, fecha_ingreso) VALUES
  (1, 2, 1, 'wcuervo', 'pbkdf2_sha256$1000000$redbib01sal$A4quF5tA2VewAD/7HgH87JeqlwoB6btP0CPV6fWRfd4=', 'ACTIVO', 0, '2026-10-24 09:05:00', '2018-02-05'),
  (2, 1, 1, 'navendano', 'pbkdf2_sha256$1000000$redbib02sal$VA5Ynd4xht+cGAe+oTowJoRFmfhpEnhtsMHBlcqdiFg=', 'ACTIVO', 0, '2026-10-24 10:10:00', '2015-03-02'),
  (3, 2, 2, 'fgarzon', 'pbkdf2_sha256$1000000$redbib03sal$5IDXhVTGs9zojr/DuPljH2Ri4flxEr/y1Zx6iidrxhA=', 'ACTIVO', 0, '2026-10-24 11:15:00', '2019-07-15'),
  (4, 3, 2, 'lmoscoso', 'pbkdf2_sha256$1000000$redbib04sal$nOJs0I69taJIL97CMApQnjkM6hPIAubKqna8urWTfqc=', 'ACTIVO', 0, '2026-10-24 12:20:00', '2022-01-17'),
  (5, 2, 3, 'hpinilla', 'pbkdf2_sha256$1000000$redbib05sal$hJyqiB/BZELVHniMjMl5eGzL1Rz7tc9cOyfLEN1FzIM=', 'ACTIVO', 0, '2026-10-24 13:25:00', '2019-02-04'),
  (6, 3, 3, 'ycontreras', 'pbkdf2_sha256$1000000$redbib06sal$jDw5XSiMmxnZljy8W1IkboSvsMLVY37CxpJA6jAT44M=', 'ACTIVO', 0, '2026-10-24 14:30:00', '2023-08-01'),
  (7, 2, 4, 'erojas', 'pbkdf2_sha256$1000000$redbib07sal$PjkLPMKcDsPxCywLW/dtk2F35v2cm6DV6MO4F+oxPDU=', 'ACTIVO', 0, '2026-10-24 15:35:00', '2021-06-21'),
  (8, 3, 4, 'mibanez', 'pbkdf2_sha256$1000000$redbib08sal$u9cOwMSZU+HlxGIRwrBtLAQ2nFU0agDDo7IPBjS9MsY=', 'ACTIVO', 2, '2026-10-24 16:40:00', '2024-02-12');

-- Socios (28 esta suspendido por multa pendiente; 30 se retiro)
INSERT INTO socios (id_socio, id_tipo_socio, direccion, fecha_registro, estado) VALUES
  (3, 3, 'Cl 66 # 11-35', '2020-03-10', 'ACTIVO'),
  (6, 1, 'Cra 24 # 45-18', '2023-08-20', 'ACTIVO'),
  (9, 1, 'Cra 15 # 140-30', '2022-02-01', 'ACTIVO'),
  (10, 3, 'Cl 53 # 13-40', '2021-05-18', 'ACTIVO'),
  (11, 1, 'Cl 147 # 92-10', '2023-01-23', 'ACTIVO'),
  (12, 1, 'Cra 91 # 145-07', '2022-08-08', 'ACTIVO'),
  (13, 2, 'Cl 40 # 21-62', '2019-04-01', 'ACTIVO'),
  (14, 2, 'Cra 9 # 118-22', '2018-09-12', 'ACTIVO'),
  (15, 1, 'Cl 63 # 7-41', '2024-02-05', 'ACTIVO'),
  (16, 4, 'Cra 7 # 124-60', '2017-06-30', 'ACTIVO'),
  (17, 3, 'Cl 45 # 19-33', '2020-11-03', 'ACTIVO'),
  (18, 3, 'Cl 139 # 94-25', '2021-09-27', 'ACTIVO'),
  (19, 1, 'Cra 13 # 57-90', '2022-03-14', 'ACTIVO'),
  (20, 1, 'Cl 127 # 11-05', '2023-07-10', 'ACTIVO'),
  (21, 4, 'Cra 20 # 36-14', '2016-01-19', 'ACTIVO'),
  (22, 2, 'Cra 11 # 64-38', '2019-08-05', 'ACTIVO'),
  (23, 1, 'Cl 134 # 9-51', '2022-09-01', 'ACTIVO'),
  (24, 3, 'Cra 92 # 150-11', '2021-12-06', 'ACTIVO'),
  (25, 3, 'Cl 59 # 10-26', '2025-01-20', 'ACTIVO'),
  (26, 1, 'Cl 152 # 93-40', '2024-03-04', 'ACTIVO'),
  (27, 2, 'Cra 17 # 41-09', '2020-02-17', 'ACTIVO'),
  (28, 3, 'Cl 72 # 12-80', '2021-04-12', 'SUSPENDIDO'),
  (29, 3, 'Cra 6 # 116-44', '2019-10-28', 'ACTIVO'),
  (30, 1, 'Cl 39 # 17-23', '2022-02-21', 'RETIRADO'),
  (31, 4, 'Cra 10 # 131-15', '2018-05-07', 'ACTIVO'),
  (32, 1, 'Cl 146 # 95-33', '2023-03-13', 'ACTIVO'),
  (33, 1, 'Cra 8 # 125-19', '2026-10-21', 'ACTIVO'),
  (34, 3, 'Cl 62 # 5-70', '2026-10-23', 'ACTIVO');

-- Carnes: los socios 33 y 34 se acaban de inscribir y aun no tienen carne (relacion 0..1)
INSERT INTO carnes (id_carne, id_socio, numero_carne, fecha_expedicion, fecha_vencimiento, estado) VALUES
  (1, 3, 'RB-000181', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (2, 6, 'RB-000182', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (3, 9, 'RB-000183', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (4, 10, 'RB-000184', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (5, 11, 'RB-000185', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (6, 12, 'RB-000186', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (7, 13, 'RB-000187', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (8, 14, 'RB-000188', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (9, 15, 'RB-000189', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (10, 16, 'RB-000190', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (11, 17, 'RB-000191', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (12, 18, 'RB-000192', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (13, 19, 'RB-000193', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (14, 20, 'RB-000194', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (15, 21, 'RB-000195', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (16, 22, 'RB-000196', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (17, 23, 'RB-000197', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (18, 24, 'RB-000198', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (19, 25, 'RB-000199', '2025-01-20', '2027-01-20', 'VIGENTE'),
  (20, 26, 'RB-000200', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (21, 27, 'RB-000201', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (22, 28, 'RB-000202', '2025-01-15', '2027-01-15', 'BLOQUEADO'),
  (23, 29, 'RB-000203', '2025-01-15', '2027-01-15', 'VIGENTE'),
  (24, 30, 'RB-000204', '2025-01-15', '2027-01-15', 'ANULADO'),
  (25, 31, 'RB-000205', '2024-10-01', '2026-09-30', 'VENCIDO'),
  (26, 32, 'RB-000206', '2025-01-15', '2027-01-15', 'VIGENTE');

-- ---------------------------------------------------------------------
-- 3.3 Catalogo bibliografico
-- ---------------------------------------------------------------------

-- Libros (titulos reales, ISBN ficticios con digito de control valido)
INSERT INTO libros (id_libro, id_editorial, id_categoria, isbn, titulo, subtitulo, anio_publicacion, edicion, numero_paginas, idioma) VALUES
  (1, 1, 1, '9789589900017', 'Fundamentos de bases de datos', NULL, 2014, 6, 760, 'es'),
  (2, 2, 1, '9789589900024', 'Fundamentos de sistemas de bases de datos', NULL, 2007, 5, 1008, 'es'),
  (3, 3, 1, '9789589900031', 'SQL Cookbook', 'Query Solutions and Techniques for Database Developers', 2005, 1, 636, 'en'),
  (4, 2, 2, '9789589900048', 'Cómo programar en Java', NULL, 2016, 10, 1152, 'es'),
  (5, 2, 2, '9789589900055', 'Código limpio', 'Manual de estilo para el desarrollo ágil de software', 2012, 1, 464, 'es'),
  (6, 7, 3, '9789589900062', 'Estadística para administración y economía', NULL, 2016, 12, 1056, 'es'),
  (7, 4, 4, '9789589900079', 'Cien años de soledad', NULL, 2017, 1, 496, 'es'),
  (8, 4, 4, '9789589900086', 'El amor en los tiempos del cólera', NULL, 2015, 1, 504, 'es'),
  (9, 4, 4, '9789589900093', 'El coronel no tiene quien le escriba', NULL, 2014, 1, 104, 'es'),
  (10, 6, 4, '9789589900109', 'La vorágine', NULL, 2019, 3, 312, 'es'),
  (11, 4, 4, '9789589900116', 'Delirio', NULL, 2004, 1, 344, 'es'),
  (12, 5, 4, '9789589900123', 'El olvido que seremos', NULL, 2006, 1, 274, 'es'),
  (13, 5, 4, '9789589900130', 'Satanás', NULL, 2002, 1, 288, 'es'),
  (14, 4, 5, '9789589900147', 'Rayuela', NULL, 2013, 1, 736, 'es'),
  (15, 4, 5, '9789589900154', 'Pedro Páramo', NULL, 2016, 1, 132, 'es'),
  (16, 4, 5, '9789589900161', 'Ficciones', NULL, 2011, 1, 224, 'es'),
  (17, 8, 6, '9789589900178', 'Historia mínima de Colombia', NULL, 2017, 1, 324, 'es'),
  (18, 5, 7, '9789589900185', 'Cosmos', NULL, 2004, 1, 368, 'es'),
  (19, 5, 7, '9789589900192', 'Breve historia del tiempo', 'Del big bang a los agujeros negros', 2011, 1, 248, 'es'),
  (20, 9, 8, '9789589900208', 'Mafalda', 'Todas las tiras', 2011, 1, 672, 'es'),
  (21, 9, 8, '9789589900215', 'Persépolis', NULL, 2007, 1, 352, 'es');

-- Autoria (N:M)
INSERT INTO libros_autores (id_libro, id_autor, rol_autor, orden) VALUES
  (1, 1, 'AUTOR', 1),
  (1, 2, 'AUTOR', 2),
  (1, 3, 'AUTOR', 3),
  (2, 4, 'AUTOR', 1),
  (2, 5, 'AUTOR', 2),
  (3, 6, 'AUTOR', 1),
  (4, 7, 'AUTOR', 1),
  (4, 8, 'AUTOR', 2),
  (5, 9, 'AUTOR', 1),
  (6, 10, 'AUTOR', 1),
  (6, 11, 'AUTOR', 2),
  (6, 12, 'AUTOR', 3),
  (7, 13, 'AUTOR', 1),
  (8, 13, 'AUTOR', 1),
  (9, 13, 'AUTOR', 1),
  (10, 14, 'AUTOR', 1),
  (11, 15, 'AUTOR', 1),
  (12, 16, 'AUTOR', 1),
  (13, 17, 'AUTOR', 1),
  (14, 18, 'AUTOR', 1),
  (15, 19, 'AUTOR', 1),
  (16, 20, 'AUTOR', 1),
  (17, 21, 'AUTOR', 1),
  (18, 22, 'AUTOR', 1),
  (19, 23, 'AUTOR', 1),
  (20, 24, 'AUTOR', 1),
  (21, 25, 'AUTOR', 1);

-- Ejemplares con su sede y estado al cierre del 24 de octubre
INSERT INTO ejemplares (id_ejemplar, id_libro, id_sede, codigo_barras, fecha_adquisicion, ubicacion_estante, valor_reposicion, estado) VALUES
  (101, 1, 1, 'B-000101', '2020-11-03', '005.74 S562 E1', 189000, 'PRESTADO'),
  (102, 1, 3, 'B-000102', '2020-05-02', '005.74 S562 E2', 189000, 'PRESTADO'),
  (103, 1, 2, 'B-000103', '2024-11-01', '005.74 S562 E3', 189000, 'DISPONIBLE'),
  (104, 1, 3, 'B-000104', '2018-08-10', '005.74 S562 E4', 189000, 'DISPONIBLE'),
  (105, 2, 1, 'B-000105', '2018-04-13', '005.74 E817 E1', 210000, 'DISPONIBLE'),
  (106, 2, 3, 'B-000106', '2023-09-02', '005.74 E817 E2', 210000, 'PRESTADO'),
  (107, 3, 2, 'B-000107', '2024-02-25', '005.74 M133 E1', 165000, 'PRESTADO'),
  (108, 4, 2, 'B-000108', '2022-06-29', '005.13 D699 E1', 225000, 'DISPONIBLE'),
  (109, 4, 1, 'B-000109', '2021-01-22', '005.13 D699 E2', 225000, 'PRESTADO'),
  (110, 5, 3, 'B-000110', '2016-11-22', '005.13 M719 E1', 138000, 'PRESTADO'),
  (111, 5, 2, 'B-000111', '2025-03-29', '005.13 M719 E2', 138000, 'DISPONIBLE'),
  (112, 6, 1, 'B-000112', '2020-09-02', '519.5 A126 E1', 198000, 'PRESTADO'),
  (113, 6, 3, 'B-000113', '2020-02-29', '519.5 A126 E2', 198000, 'PRESTADO'),
  (114, 7, 1, 'B-000114', '2017-09-13', 'Co863 G116 E1', 59000, 'DE_BAJA'),
  (115, 7, 1, 'B-000115', '2024-09-05', 'Co863 G116 E2', 59000, 'RESERVADO'),
  (116, 7, 2, 'B-000116', '2023-10-26', 'Co863 G116 E3', 59000, 'DISPONIBLE'),
  (117, 7, 2, 'B-000117', '2017-08-07', 'Co863 G116 E4', 59000, 'PRESTADO'),
  (118, 7, 4, 'B-000118', '2016-08-29', 'Co863 G116 E5', 59000, 'PRESTADO'),
  (119, 8, 1, 'B-000119', '2019-11-20', 'Co863 G116 E1', 56000, 'PRESTADO'),
  (120, 8, 4, 'B-000120', '2021-01-12', 'Co863 G116 E2', 56000, 'PRESTADO'),
  (121, 9, 3, 'B-000121', '2020-06-13', 'Co863 G116 E1', 32000, 'DISPONIBLE'),
  (122, 10, 1, 'B-000122', '2023-02-04', 'Co863 R717 E1', 38000, 'DISPONIBLE'),
  (123, 10, 4, 'B-000123', '2024-07-31', 'Co863 R717 E2', 38000, 'DISPONIBLE'),
  (124, 11, 4, 'B-000124', '2016-12-08', 'Co863 R152 E1', 52000, 'PRESTADO'),
  (125, 11, 4, 'B-000125', '2020-02-06', 'Co863 R152 E2', 52000, 'DISPONIBLE'),
  (126, 12, 4, 'B-000126', '2022-08-14', 'Co863 A697 E1', 54000, 'DISPONIBLE'),
  (127, 12, 2, 'B-000127', '2023-01-25', 'Co863 A697 E2', 54000, 'PRESTADO'),
  (128, 12, 3, 'B-000128', '2017-01-05', 'Co863 A697 E3', 54000, 'DISPONIBLE'),
  (129, 13, 4, 'B-000129', '2023-11-15', 'Co863 M818 E1', 48000, 'DISPONIBLE'),
  (130, 13, 4, 'B-000130', '2021-07-07', 'Co863 M818 E2', 48000, 'DISPONIBLE'),
  (131, 14, 2, 'B-000131', '2022-08-05', '863 C266 E1', 69000, 'PRESTADO'),
  (132, 15, 1, 'B-000132', '2025-05-15', '863 R620 E1', 35000, 'PRESTADO'),
  (133, 15, 4, 'B-000133', '2016-07-29', '863 R620 E2', 35000, 'PRESTADO'),
  (134, 16, 3, 'B-000134', '2022-10-03', '863 B710 E1', 42000, 'PRESTADO'),
  (135, 17, 1, 'B-000135', '2023-03-10', '986.1 M497 E1', 64000, 'PRESTADO'),
  (136, 17, 4, 'B-000136', '2016-10-09', '986.1 M497 E2', 64000, 'PRESTADO'),
  (137, 18, 1, 'B-000137', '2017-03-18', '520 S590 E1', 61000, 'EN_TRASLADO'),
  (138, 18, 2, 'B-000138', '2016-06-09', '520 S590 E2', 61000, 'PRESTADO'),
  (139, 18, 1, 'B-000139', '2018-12-22', '520 S590 E3', 61000, 'DISPONIBLE'),
  (140, 19, 2, 'B-000140', '2020-10-09', '520 H813 E1', 47000, 'PRESTADO'),
  (141, 20, 1, 'B-000141', '2021-05-14', '741.5 L575 E1', 89000, 'DISPONIBLE'),
  (142, 20, 4, 'B-000142', '2018-07-12', '741.5 L575 E2', 89000, 'PERDIDO'),
  (143, 21, 2, 'B-000143', '2021-08-11', '741.5 S824 E1', 73000, 'EN_REPARACION');

-- ---------------------------------------------------------------------
-- 3.4 Movimientos
-- ---------------------------------------------------------------------

-- Prestamos
INSERT INTO prestamos (id_prestamo, id_ejemplar, id_socio, id_empleado, id_sede_prestamo, id_sede_devolucion, fecha_prestamo, fecha_limite, fecha_devolucion, num_renovaciones, estado) VALUES
  (1, 134, 30, 6, 3, 3, '2026-08-05', '2026-08-20', '2026-08-14', 0, 'DEVUELTO'),
  (2, 124, 22, 4, 2, 2, '2026-08-05', '2026-09-04', '2026-08-14', 0, 'DEVUELTO'),
  (3, 111, 18, 4, 2, 2, '2026-08-07', '2026-08-17', '2026-08-14', 0, 'DEVUELTO'),
  (4, 119, 18, 1, 1, NULL, '2026-08-08', '2026-08-18', NULL, 0, 'VENCIDO'),
  (5, 135, 6, 2, 1, 1, '2026-08-08', '2026-09-07', '2026-08-29', 1, 'DEVUELTO'),
  (6, 120, 22, 7, 4, 4, '2026-08-10', '2026-09-09', '2026-08-20', 0, 'DEVUELTO'),
  (7, 140, 13, 4, 2, 2, '2026-08-10', '2026-10-09', '2026-09-27', 1, 'DEVUELTO'),
  (8, 142, 12, 8, 4, NULL, '2026-08-11', '2026-08-26', NULL, 0, 'PERDIDO'),
  (9, 133, 27, 7, 4, 4, '2026-08-11', '2026-09-10', '2026-09-12', 0, 'DEVUELTO'),
  (10, 128, 26, 6, 3, 3, '2026-08-12', '2026-08-27', '2026-08-25', 0, 'DEVUELTO'),
  (11, 101, 14, 1, 1, 1, '2026-08-12', '2026-09-11', '2026-09-04', 0, 'DEVUELTO'),
  (12, 121, 29, 6, 3, 3, '2026-08-13', '2026-08-23', '2026-08-22', 0, 'DEVUELTO'),
  (13, 129, 28, 7, 4, 4, '2026-08-14', '2026-08-24', '2026-09-25', 0, 'DEVUELTO'),
  (14, 103, 14, 4, 2, 2, '2026-08-14', '2026-09-13', '2026-09-17', 0, 'DEVUELTO'),
  (15, 118, 13, 8, 4, NULL, '2026-08-15', '2026-09-14', NULL, 0, 'VENCIDO'),
  (16, 141, 19, 2, 1, 1, '2026-08-17', '2026-09-01', '2026-09-08', 0, 'DEVUELTO'),
  (17, 127, 24, 4, 2, 2, '2026-08-19', '2026-09-08', '2026-08-27', 1, 'DEVUELTO'),
  (18, 139, 3, 8, 4, 1, '2026-08-20', '2026-08-30', '2026-09-01', 0, 'DEVUELTO'),
  (19, 113, 22, 5, 3, 3, '2026-08-20', '2026-09-19', '2026-08-25', 0, 'DEVUELTO'),
  (20, 112, 19, 2, 1, 1, '2026-08-21', '2026-09-05', '2026-08-30', 0, 'DEVUELTO'),
  (21, 106, 3, 6, 3, 3, '2026-08-22', '2026-09-11', '2026-08-28', 1, 'DEVUELTO'),
  (22, 111, 29, 3, 2, 2, '2026-08-24', '2026-09-03', '2026-09-03', 0, 'DEVUELTO'),
  (23, 113, 9, 6, 3, 3, '2026-08-26', '2026-09-25', '2026-09-01', 1, 'DEVUELTO'),
  (24, 123, 18, 6, 3, 3, '2026-08-27', '2026-09-06', '2026-09-02', 0, 'DEVUELTO'),
  (25, 116, 26, 3, 2, 2, '2026-08-28', '2026-09-12', '2026-09-09', 0, 'DEVUELTO'),
  (26, 136, 24, 6, 3, 3, '2026-09-02', '2026-09-12', '2026-09-09', 0, 'DEVUELTO'),
  (27, 138, 13, 2, 1, 2, '2026-09-02', '2026-10-02', '2026-09-19', 0, 'DEVUELTO'),
  (28, 132, 19, 1, 1, 1, '2026-09-03', '2026-09-18', '2026-09-11', 0, 'DEVUELTO'),
  (29, 130, 13, 8, 4, 4, '2026-09-03', '2026-11-02', '2026-10-10', 1, 'DEVUELTO'),
  (30, 109, 6, 8, 4, 1, '2026-09-04', '2026-09-19', '2026-09-06', 0, 'DEVUELTO'),
  (31, 117, 13, 5, 3, 2, '2026-09-05', '2026-10-05', '2026-09-25', 0, 'DEVUELTO'),
  (32, 113, 11, 6, 3, NULL, '2026-09-05', '2026-09-20', NULL, 0, 'VENCIDO'),
  (33, 134, 17, 6, 3, 3, '2026-09-07', '2026-09-17', '2026-09-09', 0, 'DEVUELTO'),
  (34, 124, 26, 4, 2, 4, '2026-09-08', '2026-09-23', '2026-09-25', 0, 'DEVUELTO'),
  (35, 135, 6, 2, 1, NULL, '2026-09-09', '2026-09-24', NULL, 0, 'VENCIDO'),
  (36, 141, 14, 1, 1, 1, '2026-09-10', '2026-10-10', '2026-10-12', 0, 'DEVUELTO'),
  (37, 128, 11, 5, 3, 3, '2026-09-11', '2026-09-26', '2026-09-26', 0, 'DEVUELTO'),
  (38, 123, 25, 5, 3, 3, '2026-09-12', '2026-09-22', '2026-09-15', 0, 'DEVUELTO'),
  (39, 125, 24, 8, 4, 4, '2026-09-14', '2026-09-24', '2026-09-17', 0, 'DEVUELTO'),
  (40, 104, 19, 5, 3, 3, '2026-09-16', '2026-10-16', '2026-09-29', 1, 'DEVUELTO'),
  (41, 112, 31, 1, 1, 1, '2026-09-16', '2026-10-06', '2026-09-19', 0, 'DEVUELTO'),
  (42, 101, 18, 1, 1, NULL, '2026-09-17', '2026-09-27', NULL, 0, 'VENCIDO'),
  (43, 110, 16, 5, 3, 3, '2026-09-17', '2026-10-27', '2026-10-05', 1, 'DEVUELTO'),
  (44, 131, 19, 4, 2, 2, '2026-09-18', '2026-10-03', '2026-09-27', 0, 'DEVUELTO'),
  (45, 132, 24, 1, 1, NULL, '2026-09-19', '2026-09-29', NULL, 0, 'VENCIDO'),
  (46, 123, 9, 5, 3, 4, '2026-09-21', '2026-10-06', '2026-09-30', 0, 'DEVUELTO'),
  (47, 120, 17, 7, 4, 4, '2026-09-21', '2026-10-11', '2026-10-04', 1, 'DEVUELTO'),
  (48, 111, 16, 3, 2, 2, '2026-09-22', '2026-11-01', '2026-10-11', 1, 'DEVUELTO'),
  (49, 127, 14, 4, 2, NULL, '2026-09-24', '2026-10-24', NULL, 0, 'VENCIDO'),
  (50, 121, 31, 6, 3, 3, '2026-09-25', '2026-10-15', '2026-10-14', 0, 'DEVUELTO'),
  (51, 125, 17, 8, 4, 4, '2026-09-26', '2026-10-06', '2026-10-09', 0, 'DEVUELTO'),
  (52, 106, 6, 5, 3, 3, '2026-09-28', '2026-10-13', '2026-10-01', 0, 'DEVUELTO'),
  (53, 112, 19, 1, 1, NULL, '2026-09-28', '2026-10-28', NULL, 1, 'ACTIVO'),
  (54, 143, 32, 4, 2, 2, '2026-09-29', '2026-10-14', '2026-10-11', 0, 'DEVUELTO'),
  (55, 133, 13, 8, 4, NULL, '2026-09-29', '2026-10-29', NULL, 0, 'ACTIVO'),
  (56, 126, 29, 7, 4, 4, '2026-09-30', '2026-10-10', '2026-10-05', 0, 'DEVUELTO'),
  (57, 140, 9, 3, 2, NULL, '2026-10-01', '2026-10-16', NULL, 0, 'VENCIDO'),
  (58, 131, 13, 3, 2, 2, '2026-10-02', '2026-11-01', '2026-10-16', 0, 'DEVUELTO'),
  (59, 138, 21, 4, 2, 2, '2026-10-03', '2026-10-23', '2026-10-08', 0, 'DEVUELTO'),
  (60, 134, 19, 5, 3, NULL, '2026-10-05', '2026-10-20', NULL, 0, 'VENCIDO'),
  (61, 124, 16, 7, 4, NULL, '2026-10-05', '2026-11-14', NULL, 1, 'ACTIVO'),
  (62, 139, 21, 2, 1, 1, '2026-10-06', '2026-10-26', '2026-10-18', 0, 'DEVUELTO'),
  (63, 103, 26, 3, 2, 2, '2026-10-07', '2026-10-22', '2026-10-19', 0, 'DEVUELTO'),
  (64, 136, 6, 5, 3, 4, '2026-10-07', '2026-10-22', '2026-10-21', 0, 'DEVUELTO'),
  (65, 123, 9, 8, 4, 4, '2026-10-08', '2026-10-23', '2026-10-13', 0, 'DEVUELTO'),
  (66, 115, 29, 1, 1, 1, '2026-10-09', '2026-10-19', '2026-10-21', 0, 'DEVUELTO'),
  (67, 117, 9, 3, 2, NULL, '2026-10-09', '2026-11-08', NULL, 1, 'ACTIVO'),
  (68, 102, 13, 5, 3, NULL, '2026-10-10', '2026-11-09', NULL, 0, 'ACTIVO'),
  (69, 120, 19, 7, 4, NULL, '2026-10-12', '2026-11-11', NULL, 1, 'ACTIVO'),
  (70, 107, 22, 4, 2, NULL, '2026-10-14', '2026-11-13', NULL, 0, 'ACTIVO'),
  (71, 106, 26, 6, 3, NULL, '2026-10-19', '2026-11-18', NULL, 1, 'ACTIVO'),
  (72, 109, 24, 1, 1, NULL, '2026-10-20', '2026-11-09', NULL, 1, 'ACTIVO'),
  (73, 110, 13, 6, 3, NULL, '2026-10-21', '2026-11-20', NULL, 0, 'ACTIVO'),
  (74, 138, 26, 3, 2, NULL, '2026-10-22', '2026-11-06', NULL, 0, 'ACTIVO'),
  (75, 136, 9, 7, 4, NULL, '2026-10-23', '2026-11-07', NULL, 0, 'ACTIVO'),
  (76, 131, 26, 3, 2, NULL, '2026-10-24', '2026-11-08', NULL, 0, 'ACTIVO');

-- Multas (RETRASO = dias de retraso x valor_multa_dia del tipo de socio)
INSERT INTO multas (id_prestamo, motivo, valor, estado, fecha_generacion, fecha_pago) VALUES
  (8, 'PERDIDA', 89000, 'PAGADA', '2026-09-18', '2026-09-21'),
  (9, 'RETRASO', 1200, 'PAGADA', '2026-09-12', '2026-09-13'),
  (13, 'RETRASO', 38400, 'PENDIENTE', '2026-09-25', NULL),
  (14, 'RETRASO', 2400, 'PAGADA', '2026-09-17', '2026-09-18'),
  (16, 'RETRASO', 5600, 'PAGADA', '2026-09-08', '2026-09-10'),
  (18, 'RETRASO', 2400, 'PAGADA', '2026-09-01', '2026-09-01'),
  (34, 'RETRASO', 1600, 'PAGADA', '2026-09-25', '2026-09-26'),
  (36, 'RETRASO', 1200, 'PENDIENTE', '2026-10-12', NULL),
  (51, 'RETRASO', 3600, 'PAGADA', '2026-10-09', '2026-10-10'),
  (54, 'DANO', 25000, 'PENDIENTE', '2026-10-11', NULL),
  (66, 'RETRASO', 2400, 'PENDIENTE', '2026-10-21', NULL);

-- Reservas
INSERT INTO reservas (id_reserva, id_socio, id_libro, id_sede_retiro, id_ejemplar, fecha_reserva, fecha_expiracion, estado) VALUES
  (1, 18, 14, 2, NULL, '2026-08-25 12:00:00', NULL, 'CANCELADA'),
  (2, 24, 18, 4, 139, '2026-09-02 16:20:00', '2026-09-06', 'EXPIRADA'),
  (3, 13, 1, 3, 102, '2026-10-06 10:42:00', '2026-10-12', 'ATENDIDA'),
  (4, 20, 3, 2, NULL, '2026-10-16 08:51:00', NULL, 'EN_ESPERA'),
  (5, 15, 3, 2, NULL, '2026-10-18 19:27:00', NULL, 'EN_ESPERA'),
  (6, 23, 7, 1, 115, '2026-10-20 17:03:00', '2026-10-25', 'DISPONIBLE');

-- Traslados entre sedes
INSERT INTO traslados (id_traslado, id_ejemplar, id_sede_origen, id_sede_destino, id_empleado, fecha_solicitud, fecha_envio, fecha_recepcion, estado, motivo) VALUES
  (1, 126, 1, 4, 1, '2026-08-20 09:00:00', '2026-08-20 15:40:00', '2026-08-22 11:15:00', 'RECIBIDO', 'Rebalanceo de colección'),
  (2, 110, 2, 3, 3, '2026-09-14 10:00:00', '2026-09-15 08:20:00', '2026-09-16 12:05:00', 'RECIBIDO', 'Demanda en la sede de destino'),
  (3, 136, 3, 2, 5, '2026-09-21 14:30:00', NULL, NULL, 'CANCELADO', 'Se resolvió con una copia de otra sede'),
  (4, 102, 2, 3, 3, '2026-10-06 11:05:00', '2026-10-07 09:30:00', '2026-10-09 14:10:00', 'RECIBIDO', 'Reserva para retirar en otra sede'),
  (5, 137, 1, 4, 1, '2026-10-23 09:10:00', '2026-10-24 08:45:00', NULL, 'EN_TRANSITO', 'Rebalanceo de colección'),
  (6, 122, 1, 4, 7, '2026-10-24 16:02:00', NULL, NULL, 'SOLICITADO', 'Solicitud de la sede de destino');

-- ---------------------------------------------------------------------
-- 3.5 Secuencias: como las claves se insertaron explicitas, las columnas
--    IDENTITY deben seguir desde el maximo para los siguientes INSERT
-- ---------------------------------------------------------------------

SELECT setval(pg_get_serial_sequence('roles', 'id_rol'), (SELECT MAX(id_rol) FROM roles));
SELECT setval(pg_get_serial_sequence('sedes', 'id_sede'), (SELECT MAX(id_sede) FROM sedes));
SELECT setval(pg_get_serial_sequence('personas', 'id_persona'), (SELECT MAX(id_persona) FROM personas));
SELECT setval(pg_get_serial_sequence('tipos_socio', 'id_tipo_socio'), (SELECT MAX(id_tipo_socio) FROM tipos_socio));
SELECT setval(pg_get_serial_sequence('carnes', 'id_carne'), (SELECT MAX(id_carne) FROM carnes));
SELECT setval(pg_get_serial_sequence('categorias', 'id_categoria'), (SELECT MAX(id_categoria) FROM categorias));
SELECT setval(pg_get_serial_sequence('editoriales', 'id_editorial'), (SELECT MAX(id_editorial) FROM editoriales));
SELECT setval(pg_get_serial_sequence('autores', 'id_autor'), (SELECT MAX(id_autor) FROM autores));
SELECT setval(pg_get_serial_sequence('libros', 'id_libro'), (SELECT MAX(id_libro) FROM libros));
SELECT setval(pg_get_serial_sequence('ejemplares', 'id_ejemplar'), (SELECT MAX(id_ejemplar) FROM ejemplares));
SELECT setval(pg_get_serial_sequence('prestamos', 'id_prestamo'), (SELECT MAX(id_prestamo) FROM prestamos));
SELECT setval(pg_get_serial_sequence('reservas', 'id_reserva'), (SELECT MAX(id_reserva) FROM reservas));
SELECT setval(pg_get_serial_sequence('traslados', 'id_traslado'), (SELECT MAX(id_traslado) FROM traslados));

COMMIT;

-- ====================================================================================
-- 4. SECCIÓN DE PROGRAMABILIDAD (FUNCIONES, TRIGGERS Y PROCEDIMIENTOS)
-- ====================================================================================
-- Los procedimientos hacen COMMIT si todo sale bien y ROLLBACK si algo
-- falla, y devuelven el error en p_mensaje. Deben llamarse fuera de una
-- transaccion explicita (la API trabaja en modo autocommit).

-- ---------------------------------------------------------------------
-- 4.1 Funciones
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_dias_retraso(p_id_prestamo INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    vd_limite DATE;
    vd_devolucion DATE;
    v_dias INTEGER;
BEGIN
    SELECT fecha_limite, fecha_devolucion
      INTO vd_limite, vd_devolucion
      FROM prestamos
     WHERE id_prestamo = p_id_prestamo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El préstamo % no existe.', p_id_prestamo;
    END IF;

    v_dias := COALESCE(vd_devolucion, CURRENT_DATE) - vd_limite;
    IF v_dias < 0 THEN
        v_dias := 0;
    END IF;
    RETURN v_dias;
END;
$$;

CREATE OR REPLACE FUNCTION fn_valor_multa_retraso(p_id_prestamo INTEGER)
RETURNS NUMERIC(12, 2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_tarifa NUMERIC(10, 2);
BEGIN
    SELECT t.valor_multa_dia
      INTO v_tarifa
      FROM prestamos p
      JOIN socios s ON s.id_socio = p.id_socio
      JOIN tipos_socio t ON t.id_tipo_socio = s.id_tipo_socio
     WHERE p.id_prestamo = p_id_prestamo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El préstamo % no existe.', p_id_prestamo;
    END IF;

    RETURN fn_dias_retraso(p_id_prestamo) * v_tarifa;
END;
$$;

CREATE OR REPLACE FUNCTION fn_ejemplares_disponibles(p_id_libro INTEGER, p_id_sede INTEGER DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_cantidad INTEGER;
BEGIN
    SELECT COUNT(*)
      INTO v_cantidad
      FROM ejemplares
     WHERE id_libro = p_id_libro
       AND estado = 'DISPONIBLE'
       AND (p_id_sede IS NULL OR id_sede = p_id_sede);
    RETURN v_cantidad;
END;
$$;

-- Devuelve NULL si el socio puede prestar (o reservar, si p_contar_cupo
-- es FALSE); si no, devuelve el motivo.
CREATE OR REPLACE FUNCTION fn_motivo_bloqueo_socio(p_id_socio INTEGER, p_contar_cupo BOOLEAN DEFAULT TRUE)
RETURNS VARCHAR
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    vv_estado VARCHAR(12);
    v_max_prestamos INTEGER;
    vv_estado_carne VARCHAR(10);
    vd_vencimiento DATE;
    v_multas INTEGER;
    v_vencidos INTEGER;
    v_abiertos INTEGER;
BEGIN
    SELECT s.estado, t.max_prestamos
      INTO vv_estado, v_max_prestamos
      FROM socios s
      JOIN tipos_socio t ON t.id_tipo_socio = s.id_tipo_socio
     WHERE s.id_socio = p_id_socio;

    IF NOT FOUND THEN
        RETURN 'El socio no existe.';
    END IF;
    IF vv_estado <> 'ACTIVO' THEN
        RETURN 'El socio está ' || lower(vv_estado) || '.';
    END IF;

    SELECT estado, fecha_vencimiento
      INTO vv_estado_carne, vd_vencimiento
      FROM carnes
     WHERE id_socio = p_id_socio;

    IF NOT FOUND THEN
        RETURN 'El socio todavía no tiene carné.';
    END IF;
    IF vv_estado_carne <> 'VIGENTE' OR vd_vencimiento < CURRENT_DATE THEN
        RETURN 'El carné del socio no está vigente.';
    END IF;

    SELECT COUNT(*)
      INTO v_multas
      FROM multas m
      JOIN prestamos p ON p.id_prestamo = m.id_prestamo
     WHERE p.id_socio = p_id_socio
       AND m.estado = 'PENDIENTE';
    IF v_multas > 0 THEN
        RETURN 'El socio tiene ' || v_multas || ' multa(s) pendiente(s).';
    END IF;

    SELECT COUNT(*)
      INTO v_vencidos
      FROM prestamos
     WHERE id_socio = p_id_socio
       AND (estado = 'VENCIDO' OR (estado = 'ACTIVO' AND fecha_limite < CURRENT_DATE));
    IF v_vencidos > 0 THEN
        RETURN 'El socio tiene ' || v_vencidos || ' préstamo(s) vencido(s) sin devolver.';
    END IF;

    IF p_contar_cupo THEN
        SELECT COUNT(*)
          INTO v_abiertos
          FROM prestamos
         WHERE id_socio = p_id_socio
           AND estado IN ('ACTIVO', 'VENCIDO');
        IF v_abiertos >= v_max_prestamos THEN
            RETURN 'El socio ya tiene ' || v_abiertos || ' préstamo(s) abierto(s), que es su límite.';
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

-- Cuando un ejemplar queda libre en una sede, lo aparta para el primer
-- socio de la cola de ese libro en esa sede; si no hay cola, lo deja
-- DISPONIBLE. Devuelve el id de la reserva atendida o NULL.
CREATE OR REPLACE FUNCTION fn_asignar_siguiente_reserva(p_id_ejemplar INTEGER, p_id_sede INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_libro INTEGER;
    v_id_reserva INTEGER;
BEGIN
    SELECT id_libro INTO v_id_libro FROM ejemplares WHERE id_ejemplar = p_id_ejemplar;

    SELECT id_reserva
      INTO v_id_reserva
      FROM reservas
     WHERE id_libro = v_id_libro
       AND id_sede_retiro = p_id_sede
       AND estado = 'EN_ESPERA'
     ORDER BY fecha_reserva
     LIMIT 1
       FOR UPDATE;

    IF FOUND THEN
        UPDATE reservas
           SET estado = 'DISPONIBLE', id_ejemplar = p_id_ejemplar, fecha_expiracion = CURRENT_DATE + 3
         WHERE id_reserva = v_id_reserva;
        UPDATE ejemplares SET id_sede = p_id_sede, estado = 'RESERVADO' WHERE id_ejemplar = p_id_ejemplar;
        RETURN v_id_reserva;
    END IF;

    UPDATE ejemplares SET id_sede = p_id_sede, estado = 'DISPONIBLE' WHERE id_ejemplar = p_id_ejemplar;
    RETURN NULL;
END;
$$;

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

-- ---------------------------------------------------------------------
-- 4.2 Triggers
-- ---------------------------------------------------------------------

-- 4.2.1 Reglas de negocio de cada prestamo nuevo, aunque se inserte sin
--     pasar por el procedimiento. Tambien fija fechas y estado.
CREATE OR REPLACE FUNCTION fn_tgr_bi_prestamos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    vv_motivo VARCHAR(200);
    vv_estado_ejemplar VARCHAR(13);
    v_sede_ejemplar INTEGER;
    vv_estado_empleado VARCHAR(10);
    v_sede_empleado INTEGER;
    v_dias INTEGER;
BEGIN
    vv_motivo := fn_motivo_bloqueo_socio(NEW.id_socio, TRUE);
    IF vv_motivo IS NOT NULL THEN
        RAISE EXCEPTION '%', vv_motivo;
    END IF;

    SELECT estado, id_sede
      INTO vv_estado_ejemplar, v_sede_ejemplar
      FROM ejemplares
     WHERE id_ejemplar = NEW.id_ejemplar
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El ejemplar % no existe.', NEW.id_ejemplar;
    END IF;

    IF vv_estado_ejemplar = 'RESERVADO' THEN
        PERFORM 1
           FROM reservas
          WHERE id_ejemplar = NEW.id_ejemplar
            AND id_socio = NEW.id_socio
            AND estado = 'DISPONIBLE';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El ejemplar está apartado para la reserva de otro socio.';
        END IF;
    ELSIF vv_estado_ejemplar <> 'DISPONIBLE' THEN
        RAISE EXCEPTION 'El ejemplar no está disponible (estado %).', vv_estado_ejemplar;
    END IF;

    PERFORM 1 FROM traslados WHERE id_ejemplar = NEW.id_ejemplar AND estado = 'SOLICITADO';
    IF FOUND THEN
        RAISE EXCEPTION 'El ejemplar tiene un traslado pendiente de despacho.';
    END IF;

    SELECT estado, id_sede
      INTO vv_estado_empleado, v_sede_empleado
      FROM empleados
     WHERE id_empleado = NEW.id_empleado;

    IF NOT FOUND OR vv_estado_empleado <> 'ACTIVO' THEN
        RAISE EXCEPTION 'El empleado no está activo.';
    END IF;
    IF v_sede_empleado <> v_sede_ejemplar THEN
        RAISE EXCEPTION 'El ejemplar está en otra sede; solo lo presta un empleado de esa sede.';
    END IF;
    IF NEW.id_empleado = NEW.id_socio THEN
        RAISE EXCEPTION 'Un empleado no puede registrarse un préstamo a sí mismo.';
    END IF;

    SELECT t.dias_prestamo
      INTO v_dias
      FROM socios s
      JOIN tipos_socio t ON t.id_tipo_socio = s.id_tipo_socio
     WHERE s.id_socio = NEW.id_socio;

    NEW.id_sede_prestamo := v_sede_ejemplar;
    NEW.fecha_prestamo := CURRENT_DATE;
    NEW.fecha_limite := CURRENT_DATE + v_dias;
    NEW.fecha_devolucion := NULL;
    NEW.id_sede_devolucion := NULL;
    NEW.num_renovaciones := 0;
    NEW.estado := 'ACTIVO';
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tgr_bi_prestamos ON prestamos;
CREATE TRIGGER tgr_bi_prestamos
BEFORE INSERT ON prestamos
FOR EACH ROW EXECUTE FUNCTION fn_tgr_bi_prestamos();

-- 4.2.2 Al pagar o condonar la ultima multa pendiente, el socio
--     suspendido vuelve a quedar activo y su carne bloqueado se libera.
CREATE OR REPLACE FUNCTION fn_tgr_au_multas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_socio INTEGER;
    v_pendientes INTEGER;
BEGIN
    IF OLD.estado = 'PENDIENTE' AND NEW.estado <> 'PENDIENTE' THEN
        SELECT id_socio INTO v_id_socio FROM prestamos WHERE id_prestamo = NEW.id_prestamo;

        SELECT COUNT(*)
          INTO v_pendientes
          FROM multas m
          JOIN prestamos p ON p.id_prestamo = m.id_prestamo
         WHERE p.id_socio = v_id_socio
           AND m.estado = 'PENDIENTE';

        IF v_pendientes = 0 THEN
            UPDATE socios SET estado = 'ACTIVO' WHERE id_socio = v_id_socio AND estado = 'SUSPENDIDO';
            UPDATE carnes
               SET estado = 'VIGENTE'
             WHERE id_socio = v_id_socio
               AND estado = 'BLOQUEADO'
               AND fecha_vencimiento >= CURRENT_DATE;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tgr_au_multas ON multas;
CREATE TRIGGER tgr_au_multas
AFTER UPDATE OF estado ON multas
FOR EACH ROW EXECUTE FUNCTION fn_tgr_au_multas();

-- 4.2.3 Seguridad: cinco intentos fallidos seguidos bloquean al empleado.
CREATE OR REPLACE FUNCTION fn_tgr_bu_empleados()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.intentos_fallidos >= 5 THEN
        NEW.estado := 'BLOQUEADO';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tgr_bu_empleados ON empleados;
CREATE TRIGGER tgr_bu_empleados
BEFORE UPDATE OF intentos_fallidos ON empleados
FOR EACH ROW EXECUTE FUNCTION fn_tgr_bu_empleados();

-- 4.2.4 Integridad: nombres sin espacios sobrantes y correo en minusculas.
CREATE OR REPLACE FUNCTION fn_tgr_biu_personas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.nombres := btrim(NEW.nombres);
    NEW.apellidos := btrim(NEW.apellidos);
    NEW.numero_documento := btrim(NEW.numero_documento);
    IF NEW.email IS NOT NULL THEN
        NEW.email := lower(btrim(NEW.email));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tgr_biu_personas ON personas;
CREATE TRIGGER tgr_biu_personas
BEFORE INSERT OR UPDATE ON personas
FOR EACH ROW EXECUTE FUNCTION fn_tgr_biu_personas();

-- 4.2.5 Auditoria. SECURITY DEFINER: la aplicacion no tiene permiso para
--     escribir en auditoria, solo el trigger. El argumento es la columna
--     clave de la tabla. app.usuario lo fija la API con el empleado que
--     hizo la operacion. El hash de la contrasena nunca se copia.
CREATE OR REPLACE FUNCTION fn_tgr_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    vv_clave VARCHAR(60);
    vv_usuario VARCHAR(60);
BEGIN
    vv_usuario := left(session_user || ' / ' || COALESCE(NULLIF(current_setting('app.usuario', TRUE), ''), '-'), 60);

    IF TG_OP = 'DELETE' THEN
        vv_clave := to_jsonb(OLD) ->> TG_ARGV[0];
        INSERT INTO auditoria (tabla_afectada, operacion, clave_registro, usuario_bd, valores_anteriores, valores_nuevos)
        VALUES (TG_TABLE_NAME, TG_OP, vv_clave, vv_usuario, to_jsonb(OLD) - 'contrasena_hash', NULL);
        RETURN OLD;
    END IF;

    vv_clave := to_jsonb(NEW) ->> TG_ARGV[0];
    IF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria (tabla_afectada, operacion, clave_registro, usuario_bd, valores_anteriores, valores_nuevos)
        VALUES (TG_TABLE_NAME, TG_OP, vv_clave, vv_usuario, NULL, to_jsonb(NEW) - 'contrasena_hash');
    ELSE
        INSERT INTO auditoria (tabla_afectada, operacion, clave_registro, usuario_bd, valores_anteriores, valores_nuevos)
        VALUES (TG_TABLE_NAME, TG_OP, vv_clave, vv_usuario, to_jsonb(OLD) - 'contrasena_hash', to_jsonb(NEW) - 'contrasena_hash');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tgr_aiud_prestamos ON prestamos;
CREATE TRIGGER tgr_aiud_prestamos AFTER INSERT OR UPDATE OR DELETE ON prestamos
FOR EACH ROW EXECUTE FUNCTION fn_tgr_auditoria('id_prestamo');

DROP TRIGGER IF EXISTS tgr_aiud_multas ON multas;
CREATE TRIGGER tgr_aiud_multas AFTER INSERT OR UPDATE OR DELETE ON multas
FOR EACH ROW EXECUTE FUNCTION fn_tgr_auditoria('id_prestamo');

DROP TRIGGER IF EXISTS tgr_aiud_reservas ON reservas;
CREATE TRIGGER tgr_aiud_reservas AFTER INSERT OR UPDATE OR DELETE ON reservas
FOR EACH ROW EXECUTE FUNCTION fn_tgr_auditoria('id_reserva');

DROP TRIGGER IF EXISTS tgr_aiud_traslados ON traslados;
CREATE TRIGGER tgr_aiud_traslados AFTER INSERT OR UPDATE OR DELETE ON traslados
FOR EACH ROW EXECUTE FUNCTION fn_tgr_auditoria('id_traslado');

DROP TRIGGER IF EXISTS tgr_aiud_ejemplares ON ejemplares;
CREATE TRIGGER tgr_aiud_ejemplares AFTER INSERT OR UPDATE OR DELETE ON ejemplares
FOR EACH ROW EXECUTE FUNCTION fn_tgr_auditoria('id_ejemplar');

DROP TRIGGER IF EXISTS tgr_aiud_socios ON socios;
CREATE TRIGGER tgr_aiud_socios AFTER INSERT OR UPDATE OR DELETE ON socios
FOR EACH ROW EXECUTE FUNCTION fn_tgr_auditoria('id_socio');

DROP TRIGGER IF EXISTS tgr_aiud_empleados ON empleados;
CREATE TRIGGER tgr_aiud_empleados AFTER INSERT OR UPDATE OR DELETE ON empleados
FOR EACH ROW EXECUTE FUNCTION fn_tgr_auditoria('id_empleado');

-- ---------------------------------------------------------------------
-- 4.3 Procedimientos (cada uno es una transaccion: COMMIT o ROLLBACK)
-- ---------------------------------------------------------------------

-- Si el script se vuelve a correr, se borran las versiones anteriores
-- (CREATE OR REPLACE no deja cambiar los parametros de salida).
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT p.oid::regprocedure AS firma
               FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
                AND p.prokind = 'p'
                AND p.proname LIKE 'sp\_%'
    LOOP
        EXECUTE 'DROP PROCEDURE ' || r.firma;
    END LOOP;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_registrar_prestamo(
    IN p_id_ejemplar INTEGER,
    IN p_id_socio INTEGER,
    IN p_id_empleado INTEGER,
    OUT p_id_prestamo INTEGER,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    vd_limite DATE;
BEGIN
    BEGIN
        INSERT INTO prestamos (id_ejemplar, id_socio, id_empleado)
        VALUES (p_id_ejemplar, p_id_socio, p_id_empleado)
        RETURNING id_prestamo, fecha_limite INTO p_id_prestamo, vd_limite;

        UPDATE ejemplares SET estado = 'PRESTADO' WHERE id_ejemplar = p_id_ejemplar;

        UPDATE reservas
           SET estado = 'ATENDIDA'
         WHERE id_ejemplar = p_id_ejemplar
           AND id_socio = p_id_socio
           AND estado = 'DISPONIBLE';
    EXCEPTION
        WHEN foreign_key_violation THEN
            vv_error := 'El socio, el ejemplar o el empleado no existen.';
        WHEN unique_violation THEN
            vv_error := 'El ejemplar ya tiene un préstamo abierto.';
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_mensaje := 'Préstamo registrado. Fecha límite: ' || to_char(vd_limite, 'DD/MM/YYYY') || '.';
    ELSE
        ROLLBACK;
        p_id_prestamo := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_registrar_devolucion(
    IN p_id_prestamo INTEGER,
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
    v_sede INTEGER;
    v_dias INTEGER;
    v_id_reserva INTEGER;
BEGIN
    BEGIN
        SELECT estado, id_ejemplar
          INTO vv_estado, v_id_ejemplar
          FROM prestamos
         WHERE id_prestamo = p_id_prestamo
           FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El préstamo % no existe.', p_id_prestamo;
        END IF;
        IF vv_estado NOT IN ('ACTIVO', 'VENCIDO') THEN
            RAISE EXCEPTION 'El préstamo ya está cerrado (estado %).', vv_estado;
        END IF;

        SELECT estado, id_sede INTO vv_estado_empleado, v_sede FROM empleados WHERE id_empleado = p_id_empleado;
        IF NOT FOUND OR vv_estado_empleado <> 'ACTIVO' THEN
            RAISE EXCEPTION 'El empleado no está activo.';
        END IF;

        UPDATE prestamos
           SET fecha_devolucion = CURRENT_DATE, id_sede_devolucion = v_sede, estado = 'DEVUELTO'
         WHERE id_prestamo = p_id_prestamo;

        v_dias := fn_dias_retraso(p_id_prestamo);
        p_valor_multa := 0;
        IF v_dias > 0 THEN
            p_valor_multa := fn_valor_multa_retraso(p_id_prestamo);
            INSERT INTO multas (id_prestamo, motivo, valor) VALUES (p_id_prestamo, 'RETRASO', p_valor_multa);
        END IF;

        v_id_reserva := fn_asignar_siguiente_reserva(v_id_ejemplar, v_sede);
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_mensaje := 'Devolución registrada.';
        IF v_dias > 0 THEN
            p_mensaje := p_mensaje || ' Llegó con ' || v_dias || ' día(s) de retraso y se generó una multa.';
        END IF;
        IF v_id_reserva IS NOT NULL THEN
            p_mensaje := p_mensaje || ' El ejemplar quedó apartado para la reserva ' || v_id_reserva || '.';
        END IF;
    ELSE
        ROLLBACK;
        p_valor_multa := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_renovar_prestamo(
    IN p_id_prestamo INTEGER,
    OUT p_fecha_limite DATE,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    r RECORD;
BEGIN
    BEGIN
        SELECT p.estado, p.num_renovaciones, p.fecha_limite, t.max_renovaciones, t.dias_prestamo, e.id_libro
          INTO r
          FROM prestamos p
          JOIN socios s ON s.id_socio = p.id_socio
          JOIN tipos_socio t ON t.id_tipo_socio = s.id_tipo_socio
          JOIN ejemplares e ON e.id_ejemplar = p.id_ejemplar
         WHERE p.id_prestamo = p_id_prestamo
           FOR UPDATE OF p;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El préstamo % no existe.', p_id_prestamo;
        END IF;
        IF r.estado = 'VENCIDO' OR (r.estado = 'ACTIVO' AND r.fecha_limite < CURRENT_DATE) THEN
            RAISE EXCEPTION 'Un préstamo vencido no se renueva: primero hay que devolverlo.';
        END IF;
        IF r.estado <> 'ACTIVO' THEN
            RAISE EXCEPTION 'El préstamo ya está cerrado (estado %).', r.estado;
        END IF;
        IF r.num_renovaciones >= r.max_renovaciones THEN
            RAISE EXCEPTION 'El préstamo ya tiene el máximo de renovaciones (%).', r.max_renovaciones;
        END IF;

        PERFORM 1 FROM reservas WHERE id_libro = r.id_libro AND estado = 'EN_ESPERA';
        IF FOUND THEN
            RAISE EXCEPTION 'Hay socios esperando este libro; no se puede renovar.';
        END IF;

        UPDATE prestamos
           SET fecha_limite = fecha_limite + r.dias_prestamo,
               num_renovaciones = num_renovaciones + 1
         WHERE id_prestamo = p_id_prestamo
        RETURNING fecha_limite INTO p_fecha_limite;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_mensaje := 'Préstamo renovado hasta el ' || to_char(p_fecha_limite, 'DD/MM/YYYY') || '.';
    ELSE
        ROLLBACK;
        p_fecha_limite := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_pagar_multa(
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

        UPDATE multas SET estado = 'PAGADA', fecha_pago = CURRENT_DATE WHERE id_prestamo = p_id_prestamo;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_exito := TRUE;
        p_mensaje := 'Pago registrado.';
    ELSE
        ROLLBACK;
        p_exito := FALSE;
        p_mensaje := vv_error;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_crear_reserva(
    IN p_id_socio INTEGER,
    IN p_id_libro INTEGER,
    IN p_id_sede INTEGER,
    OUT p_id_reserva INTEGER,
    OUT p_estado VARCHAR,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    vv_motivo VARCHAR(200);
    vv_estado_sede VARCHAR(10);
    v_id_ejemplar INTEGER;
    vv_codigo VARCHAR(20);
    v_en_red INTEGER;
BEGIN
    BEGIN
        vv_motivo := fn_motivo_bloqueo_socio(p_id_socio, FALSE);
        IF vv_motivo IS NOT NULL THEN
            RAISE EXCEPTION '%', vv_motivo;
        END IF;

        SELECT estado INTO vv_estado_sede FROM sedes WHERE id_sede = p_id_sede;
        IF NOT FOUND OR vv_estado_sede <> 'ACTIVA' THEN
            RAISE EXCEPTION 'La sede de retiro no existe o está cerrada.';
        END IF;

        PERFORM 1 FROM libros WHERE id_libro = p_id_libro;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El libro % no existe.', p_id_libro;
        END IF;

        PERFORM 1
           FROM prestamos p
           JOIN ejemplares e ON e.id_ejemplar = p.id_ejemplar
          WHERE p.id_socio = p_id_socio
            AND e.id_libro = p_id_libro
            AND p.estado IN ('ACTIVO', 'VENCIDO');
        IF FOUND THEN
            RAISE EXCEPTION 'El socio ya tiene este libro prestado.';
        END IF;

        SELECT id_ejemplar, codigo_barras
          INTO v_id_ejemplar, vv_codigo
          FROM ejemplares e
         WHERE e.id_libro = p_id_libro
           AND e.id_sede = p_id_sede
           AND e.estado = 'DISPONIBLE'
           AND NOT EXISTS (SELECT 1 FROM traslados t WHERE t.id_ejemplar = e.id_ejemplar AND t.estado = 'SOLICITADO')
         ORDER BY e.id_ejemplar
         LIMIT 1
           FOR UPDATE;

        IF FOUND THEN
            INSERT INTO reservas (id_socio, id_libro, id_sede_retiro, id_ejemplar, fecha_expiracion, estado)
            VALUES (p_id_socio, p_id_libro, p_id_sede, v_id_ejemplar, CURRENT_DATE + 3, 'DISPONIBLE')
            RETURNING id_reserva INTO p_id_reserva;
            UPDATE ejemplares SET estado = 'RESERVADO' WHERE id_ejemplar = v_id_ejemplar;
            p_estado := 'DISPONIBLE';
        ELSE
            INSERT INTO reservas (id_socio, id_libro, id_sede_retiro)
            VALUES (p_id_socio, p_id_libro, p_id_sede)
            RETURNING id_reserva INTO p_id_reserva;
            p_estado := 'EN_ESPERA';
            v_en_red := fn_ejemplares_disponibles(p_id_libro, NULL);
        END IF;
    EXCEPTION
        WHEN unique_violation THEN
            vv_error := 'El socio ya tiene una reserva abierta de este libro.';
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        IF p_estado = 'DISPONIBLE' THEN
            p_mensaje := 'Reserva creada: el ejemplar ' || vv_codigo || ' quedó apartado por 3 días.';
        ELSE
            p_mensaje := 'Reserva en espera: no hay copias libres en esa sede. Disponibles en otras sedes: ' || v_en_red || '.';
        END IF;
    ELSE
        ROLLBACK;
        p_id_reserva := NULL;
        p_estado := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_cancelar_reserva(
    IN p_id_reserva INTEGER,
    OUT p_exito BOOLEAN,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    vv_estado VARCHAR(10);
    v_id_ejemplar INTEGER;
    v_id_sede INTEGER;
BEGIN
    BEGIN
        SELECT estado, id_ejemplar, id_sede_retiro
          INTO vv_estado, v_id_ejemplar, v_id_sede
          FROM reservas
         WHERE id_reserva = p_id_reserva
           FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'La reserva % no existe.', p_id_reserva;
        END IF;
        IF vv_estado NOT IN ('EN_ESPERA', 'DISPONIBLE') THEN
            RAISE EXCEPTION 'La reserva ya está cerrada (estado %).', vv_estado;
        END IF;

        UPDATE reservas SET estado = 'CANCELADA' WHERE id_reserva = p_id_reserva;
        IF vv_estado = 'DISPONIBLE' THEN
            PERFORM fn_asignar_siguiente_reserva(v_id_ejemplar, v_id_sede);
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_exito := TRUE;
        p_mensaje := 'Reserva cancelada.';
    ELSE
        ROLLBACK;
        p_exito := FALSE;
        p_mensaje := vv_error;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_solicitar_traslado(
    IN p_id_ejemplar INTEGER,
    IN p_id_sede_destino INTEGER,
    IN p_id_empleado INTEGER,
    IN p_motivo VARCHAR,
    OUT p_id_traslado INTEGER,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    vv_estado VARCHAR(13);
    v_id_origen INTEGER;
    vv_estado_destino VARCHAR(10);
BEGIN
    BEGIN
        SELECT estado, id_sede INTO vv_estado, v_id_origen FROM ejemplares WHERE id_ejemplar = p_id_ejemplar FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El ejemplar % no existe.', p_id_ejemplar;
        END IF;
        IF vv_estado <> 'DISPONIBLE' THEN
            RAISE EXCEPTION 'Solo se traslada un ejemplar disponible (estado actual %).', vv_estado;
        END IF;

        SELECT estado INTO vv_estado_destino FROM sedes WHERE id_sede = p_id_sede_destino;
        IF NOT FOUND OR vv_estado_destino <> 'ACTIVA' THEN
            RAISE EXCEPTION 'La sede de destino no existe o está cerrada.';
        END IF;
        IF v_id_origen = p_id_sede_destino THEN
            RAISE EXCEPTION 'El ejemplar ya está en esa sede.';
        END IF;

        INSERT INTO traslados (id_ejemplar, id_sede_origen, id_sede_destino, id_empleado, motivo)
        VALUES (p_id_ejemplar, v_id_origen, p_id_sede_destino, p_id_empleado, NULLIF(btrim(p_motivo), ''))
        RETURNING id_traslado INTO p_id_traslado;
    EXCEPTION
        WHEN unique_violation THEN
            vv_error := 'El ejemplar ya tiene un traslado abierto.';
        WHEN foreign_key_violation THEN
            vv_error := 'El empleado no existe.';
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_mensaje := 'Traslado solicitado.';
    ELSE
        ROLLBACK;
        p_id_traslado := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

-- SOLICITADO -> EN_TRANSITO lo hace un empleado de la sede de origen;
-- EN_TRANSITO -> RECIBIDO, uno de la sede de destino.
CREATE OR REPLACE PROCEDURE sp_avanzar_traslado(
    IN p_id_traslado INTEGER,
    IN p_id_empleado INTEGER,
    OUT p_estado VARCHAR,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    r RECORD;
    v_sede_empleado INTEGER;
    vv_estado_ejemplar VARCHAR(13);
    v_id_reserva INTEGER;
BEGIN
    BEGIN
        SELECT estado, id_ejemplar, id_sede_origen, id_sede_destino
          INTO r
          FROM traslados
         WHERE id_traslado = p_id_traslado
           FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El traslado % no existe.', p_id_traslado;
        END IF;

        SELECT id_sede INTO v_sede_empleado FROM empleados WHERE id_empleado = p_id_empleado AND estado = 'ACTIVO';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El empleado no está activo.';
        END IF;

        IF r.estado = 'SOLICITADO' THEN
            IF v_sede_empleado <> r.id_sede_origen THEN
                RAISE EXCEPTION 'El despacho lo registra un empleado de la sede de origen.';
            END IF;
            SELECT estado INTO vv_estado_ejemplar FROM ejemplares WHERE id_ejemplar = r.id_ejemplar FOR UPDATE;
            IF vv_estado_ejemplar <> 'DISPONIBLE' THEN
                RAISE EXCEPTION 'El ejemplar ya no está disponible (estado %).', vv_estado_ejemplar;
            END IF;
            UPDATE traslados SET estado = 'EN_TRANSITO', fecha_envio = CURRENT_TIMESTAMP WHERE id_traslado = p_id_traslado;
            UPDATE ejemplares SET estado = 'EN_TRASLADO' WHERE id_ejemplar = r.id_ejemplar;
            p_estado := 'EN_TRANSITO';
        ELSIF r.estado = 'EN_TRANSITO' THEN
            IF v_sede_empleado <> r.id_sede_destino THEN
                RAISE EXCEPTION 'La recepción la registra un empleado de la sede de destino.';
            END IF;
            UPDATE traslados SET estado = 'RECIBIDO', fecha_recepcion = CURRENT_TIMESTAMP WHERE id_traslado = p_id_traslado;
            v_id_reserva := fn_asignar_siguiente_reserva(r.id_ejemplar, r.id_sede_destino);
            p_estado := 'RECIBIDO';
        ELSE
            RAISE EXCEPTION 'El traslado ya está cerrado (estado %).', r.estado;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        IF p_estado = 'EN_TRANSITO' THEN
            p_mensaje := 'Traslado despachado.';
        ELSE
            p_mensaje := 'Traslado recibido.';
            IF v_id_reserva IS NOT NULL THEN
                p_mensaje := p_mensaje || ' El ejemplar quedó apartado para la reserva ' || v_id_reserva || '.';
            END IF;
        END IF;
    ELSE
        ROLLBACK;
        p_estado := NULL;
        p_mensaje := vv_error;
    END IF;
END;
$$;

-- Inscribe a una persona como socio con su carne. Si la persona ya
-- existe (por ejemplo, es empleado), reutiliza sus datos: la
-- generalizacion es solapada.
CREATE OR REPLACE PROCEDURE sp_registrar_socio(
    IN p_tipo_documento VARCHAR,
    IN p_numero_documento VARCHAR,
    IN p_nombres VARCHAR,
    IN p_apellidos VARCHAR,
    IN p_fecha_nacimiento DATE,
    IN p_email VARCHAR,
    IN p_telefono VARCHAR,
    IN p_direccion VARCHAR,
    IN p_id_tipo_socio INTEGER,
    OUT p_id_socio INTEGER,
    OUT p_numero_carne VARCHAR,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    v_id_persona INTEGER;
    v_siguiente INTEGER;
    vv_reutilizada VARCHAR(1) := 'N';
BEGIN
    BEGIN
        IF p_fecha_nacimiento >= CURRENT_DATE THEN
            RAISE EXCEPTION 'La fecha de nacimiento debe ser anterior a hoy.';
        END IF;

        PERFORM 1 FROM tipos_socio WHERE id_tipo_socio = p_id_tipo_socio;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El tipo de socio % no existe.', p_id_tipo_socio;
        END IF;

        SELECT id_persona
          INTO v_id_persona
          FROM personas
         WHERE tipo_documento = p_tipo_documento
           AND numero_documento = btrim(p_numero_documento);

        IF FOUND THEN
            PERFORM 1 FROM socios WHERE id_socio = v_id_persona;
            IF FOUND THEN
                RAISE EXCEPTION 'Esa persona ya está inscrita como socio.';
            END IF;
            vv_reutilizada := 'S';
        ELSE
            INSERT INTO personas (tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, email, telefono)
            VALUES (p_tipo_documento, p_numero_documento, p_nombres, p_apellidos, p_fecha_nacimiento,
                    NULLIF(btrim(p_email), ''), NULLIF(btrim(p_telefono), ''))
            RETURNING id_persona INTO v_id_persona;
        END IF;

        INSERT INTO socios (id_socio, id_tipo_socio, direccion)
        VALUES (v_id_persona, p_id_tipo_socio, NULLIF(btrim(p_direccion), ''));

        SELECT COALESCE(MAX(substr(numero_carne, 4)::INTEGER), 0) + 1
          INTO v_siguiente
          FROM carnes
         WHERE numero_carne ~ '^RB-[0-9]+$';
        p_numero_carne := 'RB-' || lpad(v_siguiente::TEXT, 6, '0');

        INSERT INTO carnes (id_socio, numero_carne, fecha_vencimiento)
        VALUES (v_id_persona, p_numero_carne, (CURRENT_DATE + INTERVAL '2 years')::DATE);

        p_id_socio := v_id_persona;
    EXCEPTION
        WHEN unique_violation THEN
            vv_error := 'Ya existe una persona con ese correo o ese carné.';
        WHEN check_violation THEN
            vv_error := 'Algún dato no cumple las reglas de la base (tipo de documento o correo).';
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_mensaje := 'Socio inscrito con el carné ' || p_numero_carne || '.';
        IF vv_reutilizada = 'S' THEN
            p_mensaje := p_mensaje || ' La persona ya estaba registrada (por ejemplo, como empleado) y se reutilizaron sus datos.';
        END IF;
    ELSE
        ROLLBACK;
        p_id_socio := NULL;
        p_numero_carne := NULL;
        p_mensaje := vv_error;
    END IF;
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

-- Registra el resultado de un intento de ingreso de un empleado. El
-- bloqueo al quinto intento lo hace el trigger tgr_bu_empleados.
CREATE OR REPLACE PROCEDURE sp_registrar_acceso(
    IN p_id_empleado INTEGER,
    IN p_exitoso BOOLEAN,
    OUT p_estado VARCHAR,
    OUT p_intentos INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_exitoso THEN
        UPDATE empleados
           SET intentos_fallidos = 0, ultimo_acceso = CURRENT_TIMESTAMP
         WHERE id_empleado = p_id_empleado
        RETURNING estado, intentos_fallidos INTO p_estado, p_intentos;
    ELSE
        UPDATE empleados
           SET intentos_fallidos = intentos_fallidos + 1
         WHERE id_empleado = p_id_empleado
        RETURNING estado, intentos_fallidos INTO p_estado, p_intentos;
    END IF;
    COMMIT;
END;
$$;

-- Tarea de mantenimiento: marca los prestamos vencidos y libera las
-- reservas apartadas que nadie recogio a tiempo (con un cursor).
CREATE OR REPLACE PROCEDURE sp_actualizar_estados(
    OUT p_vencidos INTEGER,
    OUT p_reservas_expiradas INTEGER,
    OUT p_mensaje VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    vv_error VARCHAR(300);
    c_reservas_vencidas CURSOR FOR
        SELECT id_reserva, id_ejemplar, id_sede_retiro
          FROM reservas
         WHERE estado = 'DISPONIBLE'
           AND fecha_expiracion < CURRENT_DATE
         ORDER BY fecha_reserva
           FOR UPDATE;
    r RECORD;
BEGIN
    p_vencidos := 0;
    p_reservas_expiradas := 0;
    BEGIN
        UPDATE prestamos SET estado = 'VENCIDO' WHERE estado = 'ACTIVO' AND fecha_limite < CURRENT_DATE;
        GET DIAGNOSTICS p_vencidos = ROW_COUNT;

        OPEN c_reservas_vencidas;
        LOOP
            FETCH c_reservas_vencidas INTO r;
            EXIT WHEN NOT FOUND;
            UPDATE reservas SET estado = 'EXPIRADA' WHERE id_reserva = r.id_reserva;
            PERFORM fn_asignar_siguiente_reserva(r.id_ejemplar, r.id_sede_retiro);
            p_reservas_expiradas := p_reservas_expiradas + 1;
        END LOOP;
        CLOSE c_reservas_vencidas;
    EXCEPTION
        WHEN OTHERS THEN
            vv_error := SQLERRM;
    END;

    IF vv_error IS NULL THEN
        COMMIT;
        p_mensaje := 'Préstamos marcados como vencidos: ' || p_vencidos || '. Reservas expiradas: ' || p_reservas_expiradas || '.';
    ELSE
        ROLLBACK;
        p_mensaje := vv_error;
    END IF;
END;
$$;

-- ====================================================================================
-- 5. SECCIÓN DE SEGURIDAD (ROLES Y PERMISOS)
-- ====================================================================================
-- biblioteca_consulta: solo lectura (reportes).
-- biblioteca_app: usuario de la API. Lee todo, inserta y actualiza solo
-- lo que necesitan los procedimientos, no borra, no crea tablas y no
-- escribe en auditoria (eso lo hace el trigger con SECURITY DEFINER).
-- Antes de usarlo en serio, cambiar la contrasena.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'biblioteca_consulta') THEN
        CREATE ROLE biblioteca_consulta NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'biblioteca_app') THEN
        CREATE ROLE biblioteca_app LOGIN PASSWORD 'Cambiar_Esta_Clave_2026';
    END IF;
END;
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL PROCEDURES IN SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO biblioteca_consulta, biblioteca_app;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO biblioteca_consulta;
GRANT EXECUTE ON FUNCTION fn_dias_retraso(INTEGER) TO biblioteca_consulta;
GRANT EXECUTE ON FUNCTION fn_valor_multa_retraso(INTEGER) TO biblioteca_consulta;
GRANT EXECUTE ON FUNCTION fn_ejemplares_disponibles(INTEGER, INTEGER) TO biblioteca_consulta;
GRANT EXECUTE ON FUNCTION fn_motivo_bloqueo_socio(INTEGER, BOOLEAN) TO biblioteca_consulta;

GRANT biblioteca_consulta TO biblioteca_app;

GRANT INSERT, UPDATE ON prestamos, multas, reservas, traslados, ejemplares, personas, socios, carnes TO biblioteca_app;
GRANT INSERT ON libros, libros_autores, autores TO biblioteca_app;
GRANT INSERT, UPDATE ON sedes TO biblioteca_app;
GRANT UPDATE (intentos_fallidos, ultimo_acceso, estado) ON empleados TO biblioteca_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO biblioteca_app;
GRANT EXECUTE ON FUNCTION fn_asignar_siguiente_reserva(INTEGER, INTEGER) TO biblioteca_app;
GRANT EXECUTE ON FUNCTION fn_crear_ejemplares(INTEGER, INTEGER, INTEGER, VARCHAR, NUMERIC) TO biblioteca_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO biblioteca_app;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON auditoria FROM biblioteca_app;

-- ====================================================================================
-- 6. PRUEBA DE FUNCIONAMIENTO INICIAL (OPCIONAL)
-- ====================================================================================
-- Las pruebas estan comentadas para que el script se pueda correr varias
-- veces sin cambiar los datos. Los numeros de prestamo suponen que se
-- ejecutan en este orden, justo despues de cargar el script.

-- 6.1 Prestamo: el ejemplar 105 (Usaquen) al socio 10, registrado por el
--     empleado 1 (wcuervo, de Usaquen). Debe devolver el prestamo 77.
-- CALL sp_registrar_prestamo(105, 10, 1, NULL, NULL);
-- SELECT id_prestamo, estado, fecha_prestamo, fecha_limite FROM prestamos WHERE id_prestamo = 77;
-- SELECT estado FROM ejemplares WHERE id_ejemplar = 105;   -- PRESTADO

-- 6.2 Reglas: el trigger tgr_bi_prestamos y el procedimiento rechazan
--     prestar un ejemplar que ya esta prestado, a un socio suspendido o
--     con prestamos vencidos, y desde otra sede. El procedimiento hace
--     ROLLBACK y explica el motivo en p_mensaje.
-- CALL sp_registrar_prestamo(105, 12, 1, NULL, NULL);  -- ejemplar ya prestado
-- CALL sp_registrar_prestamo(106, 28, 1, NULL, NULL);  -- socio suspendido
-- CALL sp_registrar_prestamo(106, 9, 1, NULL, NULL);   -- socio con un prestamo vencido
-- CALL sp_registrar_prestamo(103, 10, 1, NULL, NULL);  -- ejemplar de otra sede

-- 6.3 Renovacion y devolucion del prestamo 77.
-- CALL sp_renovar_prestamo(77, NULL, NULL);
-- CALL sp_registrar_devolucion(77, 1, NULL, NULL);
-- SELECT estado, fecha_devolucion FROM prestamos WHERE id_prestamo = 77;   -- DEVUELTO

-- 6.4 Funciones.
-- SELECT id_prestamo, fn_dias_retraso(id_prestamo) AS dias, fn_valor_multa_retraso(id_prestamo) AS multa
--   FROM prestamos WHERE estado = 'VENCIDO' ORDER BY dias DESC;
-- SELECT titulo, fn_ejemplares_disponibles(id_libro) AS en_la_red,
--        fn_ejemplares_disponibles(id_libro, 1) AS en_usaquen
--   FROM libros ORDER BY titulo;
-- SELECT fn_motivo_bloqueo_socio(28);   -- motivo por el que no puede llevar libros

-- 6.5 Mantenimiento: vence los prestamos atrasados y expira las reservas
--     que nadie retiro a tiempo.
-- CALL sp_actualizar_estados(NULL, NULL, NULL);

-- 6.6 Auditoria: cada operacion anterior dejo su registro.
-- SELECT id_auditoria, tabla_afectada, operacion, clave_registro, usuario_bd, fecha
--   FROM auditoria ORDER BY id_auditoria DESC LIMIT 10;

-- 6.7 Filas por tabla.
-- SELECT 'roles' AS tabla, COUNT(*) FROM roles UNION ALL SELECT 'sedes', COUNT(*) FROM sedes
-- UNION ALL SELECT 'personas', COUNT(*) FROM personas UNION ALL SELECT 'socios', COUNT(*) FROM socios
-- UNION ALL SELECT 'empleados', COUNT(*) FROM empleados UNION ALL SELECT 'carnes', COUNT(*) FROM carnes
-- UNION ALL SELECT 'libros', COUNT(*) FROM libros UNION ALL SELECT 'ejemplares', COUNT(*) FROM ejemplares
-- UNION ALL SELECT 'prestamos', COUNT(*) FROM prestamos UNION ALL SELECT 'multas', COUNT(*) FROM multas
-- UNION ALL SELECT 'reservas', COUNT(*) FROM reservas UNION ALL SELECT 'traslados', COUNT(*) FROM traslados;
