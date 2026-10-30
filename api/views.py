import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
from .mongo_service import MongoService

def estado_servidor(request):
    """Endpoint de salud y diagnóstico RDBMS + MongoDB"""
    estado = {"relational": False, "nosql": False}
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            estado["relational"] = True
    except Exception as e:
        estado["relational_error"] = str(e)

    try:
        db = MongoService.get_database()
        db.command("ping")
        estado["nosql"] = True
    except Exception as e:
        estado["nosql_error"] = str(e)

    return JsonResponse({
        "status": "online",
        "asignatura": "Bases de Datos 2 - Universidad El Bosque",
        "conexiones": estado
    })

def listar_productos(request):
    """Consulta que cruza productos, categorías e inventario (3FN)"""
    query = """
        SELECT p.id_producto, p.codigo_sku, p.nombre, p.precio, 
               c.nombre AS categoria, COALESCE(i.stock_actual, 0) AS stock
        FROM productos p
        INNER JOIN categorias c ON p.id_categoria = c.id_categoria
        LEFT JOIN inventario i ON p.id_producto = i.id_producto
        ORDER BY p.id_producto ASC;
    """
    with connection.cursor() as cursor:
        cursor.execute(query)
        columnas = [col[0] for col in cursor.description]
        productos = [dict(zip(columnas, row)) for row in cursor.fetchall()]

    return JsonResponse({"productos": productos})

@csrf_exempt
def crear_pedido_sp(request):
    """
    Llama directamente al Procedimiento Almacenado `sp_registrar_pedido`
    en PostgreSQL que controla transacciones y dispara triggers de stock.
    Además, registra un log documental en MongoDB.
    """
    if request.method != 'POST':
        return JsonResponse({"error": "Método no permitido. Use POST"}, status=405)

    try:
        body = json.loads(request.body)
        id_cliente = body.get('id_cliente')
        id_producto = body.get('id_producto')
        cantidad = body.get('cantidad')

        if not all([id_cliente, id_producto, cantidad]):
            return JsonResponse({"error": "Parámetros incompletos (id_cliente, id_producto, cantidad)"}, status=400)

        # Ejecución del Stored Procedure en PostgreSQL
        with connection.cursor() as cursor:
            cursor.execute(
                "CALL sp_registrar_pedido(%s, %s, %s, %s, %s);",
                [id_cliente, id_producto, cantidad, None, None]
            )
            res = cursor.fetchone()
            id_pedido_creado, mensaje = res[0], res[1]

        if not id_pedido_creado:
            # Registrar intento fallido en MongoDB
            MongoService.log_event(
                tipo_evento="PEDIDO_FALLIDO",
                payload={"cliente": id_cliente, "producto": id_producto, "error": mensaje}
            )
            return JsonResponse({"success": False, "mensaje": mensaje}, status=400)

        # Registrar evento exitoso en NoSQL (MongoDB)
        MongoService.log_event(
            tipo_evento="PEDIDO_CREADO",
            payload={"id_pedido": id_pedido_creado, "cliente": id_cliente, "cantidad": cantidad}
        )

        return JsonResponse({
            "success": True,
            "id_pedido": id_pedido_creado,
            "mensaje": mensaje
        })

    except Exception as e:
        return JsonResponse({"error": f"Error interno: {str(e)}"}, status=500)

def mongodb_metricas(request):
    """Demostración de Agregaciones y Consultas Complejas en MongoDB"""
    try:
        agregaciones = MongoService.get_resumen_agregacion_eventos()
        ultimos_logs = MongoService.get_ultimos_eventos(15)
        return JsonResponse({
            "agregacion_por_tipo_evento": agregaciones,
            "ultimos_logs_nosql": ultimos_logs
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
