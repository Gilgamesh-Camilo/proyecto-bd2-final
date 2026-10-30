from django.urls import path
from .views import estado_servidor, listar_productos, crear_pedido_sp, mongodb_metricas

urlpatterns = [
    path('status/', estado_servidor, name='estado_servidor'),
    path('productos/', listar_productos, name='listar_productos'),
    path('pedidos/crear/', crear_pedido_sp, name='crear_pedido_sp'),
    path('nosql/metricas/', mongodb_metricas, name='mongodb_metricas'),
]
