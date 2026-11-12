from ..decoradores import GESTION, manejar_errores, metodos, requiere_empleado
from ..services import catalogo_service, estadistica_service
from ..utils import respuesta


@manejar_errores
@metodos('GET')
@requiere_empleado()
def catalogos(request):
    return respuesta(
        {
            'sedes': catalogo_service.sedes(),
            'categorias': catalogo_service.categorias(),
            'tipos_socio': catalogo_service.tipos_socio(),
        }
    )


@manejar_errores
@metodos('GET')
@requiere_empleado()
def panel(request):
    id_sede = request.empleado['id_sede']
    return respuesta(
        {
            'resumen': catalogo_service.resumen(id_sede),
            'vencidos_mi_sede': catalogo_service.vencidos_sede(id_sede),
        }
    )


@manejar_errores
@metodos('GET')
@requiere_empleado()
def estadisticas(request):
    return respuesta(estadistica_service.estadisticas())


@manejar_errores
@metodos('POST')
@requiere_empleado(*GESTION)
def actualizar_estados(request):
    datos = catalogo_service.actualizar_estados()
    datos['mensaje'] = datos['p_mensaje']
    return respuesta(datos)
