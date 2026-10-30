# Prototipo Backend - Proyecto Bases de Datos 2 (Universidad El Bosque)

Este proyecto implementa el backend prototipo exigido para la asignatura de **Bases de Datos 2**, cumpliendo con los requisitos obligatorios:
- **Base de Datos Relacional (PostgreSQL):** 8 entidades en 3FN, relaciones 1:1, 1:N, N:M.
- **Lógica en BD:** Stored Procedures (`sp_registrar_pedido`), Funciones (`fn_calcular_total_pedido`), Triggers automáticos para auditoría y validación de stock con manejo de excepciones y control transaccional.
- **Base de Datos NoSQL (MongoDB):** Almacenamiento documental para trazabilidad/eventos y pipeline de agregaciones (`$group`, `$sort`).
- **Arquitectura Backend:** Python + Django con conexión dual (PostgreSQL + PyMongo).

---

## 🚀 Puesta en Marcha Rápida (Linux / Ubuntu VM)

### 1. Clonar o descomprimir e instalar dependencias
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configurar la Base de Datos Relacional (PostgreSQL)
Crea la base de datos y ejecuta los scripts SQL en orden:
```bash
sudo -u postgres psql -c "CREATE DATABASE tienda_db;"
psql -U postgres -d tienda_db -f database/01_ddl_relational.sql
psql -U postgres -d tienda_db -f database/02_programmability.sql
psql -U postgres -d tienda_db -f database/03_seed_data.sql
```

### 3. Configurar MongoDB
Asegúrate de tener el servicio de MongoDB activo:
```bash
sudo systemctl start mongod
```

### 4. Configurar variables de entorno y ejecutar backend
Copia `.env.example` a `.env` si deseas cambiar credenciales, y levanta el servidor:
```bash
python manage.py runserver 0.0.0.0:8000
```

---

## 📡 Endpoints Disponibles

1. `GET /api/status/`  
   Verifica el estado de conexión hacia PostgreSQL y MongoDB.

2. `GET /api/productos/`  
   Consulta relacional optimizada con JOINs (Categoría + Producto + Inventario).

3. `POST /api/pedidos/crear/`  
   Invoca el procedimiento almacenado `sp_registrar_pedido` en PostgreSQL.  
   **Body JSON:**
   ```json
   {
       "id_cliente": 1,
       "id_producto": 1,
       "cantidad": 2
   }
   ```
   *Nota: Si la cantidad supera el stock actual, el trigger y el procedimiento lanzan la excepción y hacen rollback.*

4. `GET /api/nosql/metricas/`  
   Retorna agregaciones de MongoDB y logs de eventos generados.
