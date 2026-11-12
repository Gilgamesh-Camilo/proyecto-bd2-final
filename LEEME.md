# Back en un solo commit

La carpeta `biblioteca-back` de este zip reemplaza completa a la del proyecto. Necesita que la base tenga aplicado
`database/relational/bibliored_actualizacion.sql`.

## 1. Actualizar la base ya montada

No hay que borrar ni recargar la base. En la máquina virtual, con el archivo en la carpeta personal:

    sudo -u postgres psql -v ON_ERROR_STOP=1 -d biblioteca_db < ~/bibliored_actualizacion.sql

Agrega los procedimientos nuevos (registro de libros, ejemplares y sedes, multas por daño o pérdida, condonación,
cambios de estado, renovación del carné y desbloqueo de empleados) y sus permisos. No modifica datos y se puede
ejecutar más de una vez. Reemplaza a `bibliored_registro_libros.sql`: si ya habían ejecutado ese, igual se ejecuta
este. `bibliored_postgresql.sql` (versión 1.2) trae lo mismo para cuando la base se cree desde cero.

## 2. Pasos en GitHub Desktop

1. Elige la rama donde está el back, haz Fetch origin y luego Pull origin.
2. Branch > New branch: `back-gestion`.
3. En el explorador de archivos, entra a la carpeta `biblioteca-back` del proyecto y borra todo menos `venv`
   (y `.env`, si ya lo tienes). Después copia ahí el contenido de la carpeta `biblioteca-back` de este zip.
4. Revisa Changes:
   - Si todavía no habías subido el back organizado por módulos, aparecen muchos archivos nuevos y estos
     eliminados: api/views.py, api/models.py, api/admin.py, la carpeta api/migrations,
     database/relational/01_ddl_relational.sql, database/relational/respaldo_biblioteca.sql y
     database/nosql/respaldo_mongo.json.
   - Si ya lo habías subido, aparecen solo cambios dentro de `api/services`, `api/views`, `api/urls.py`,
     `api/validaciones.py`, `api/sql.py` y `database/relational`.
5. Prueba que arranque (sección 3), haz el commit, Publish branch y Pull Request hacia la rama que integra el
   proyecto.

## 3. Antes del commit

Si no tienes `.env`, créalo a partir de `.env.example` y completa `SECRET_KEY` (una clave larga y aleatoria) y
`DB_PASSWORD` (la clave que le pusieron a `biblioteca_app`).

Desde la carpeta `biblioteca-back`, con el entorno virtual activo:

    pip install -r requirements.txt
    python manage.py check
    python manage.py test api
    python manage.py runserver 8000

Con el front encendido, entra con cualquier empleado de los datos de prueba (por ejemplo `hpinilla`, o
`navendano` como administrador); la clave de prueba de todos es `Biblioteca#2026`.

## 4. Mensaje del commit

Si es el primer commit del back nuevo:

    refactor: organizacion del back por modulos

    - Vistas y servicios separados por modulo.
    - Inicio de sesion con contrasena y bloqueo por intentos.
    - Operaciones con los procedimientos de la base.
    - Registro de libros, ejemplares y sedes; multas, estados y carnes.
    - Configuracion desde el archivo .env.
    - Scripts de las dos bases en la carpeta database.

Si el back por módulos ya estaba subido:

    feat: gestion del catalogo, socios, multas y sedes

    - Registro de libros con autores y ejemplares.
    - Multas por dano o perdida y condonacion.
    - Cambio de estado de ejemplares, socios y sedes; registro de sedes.
    - Renovacion del carne y desbloqueo de empleados.
    - Script para actualizar la base ya montada y reportes nuevos.
