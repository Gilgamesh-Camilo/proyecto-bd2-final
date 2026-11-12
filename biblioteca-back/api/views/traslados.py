from ..decoradores import GESTION, exigir_rol, manejar_errores, metodos, requiere_empleado
from ..services import traslado_service
from ..utils import respuesta, resultado_procedimiento
from ..validaciones import entero, leer_cuerpo, parametro_opcion, texto


@manejar_errores
@metodos('GET', 'POST')
@requiere_empleado()
def traslados(request):
    if request.method == 'POST':
        exigir_rol(request, GESTION)
        cuerpo = leer_cuerpo(request)
        id_ejemplar = entero(cuerpo.get('id_ejemplar'), 'el ejemplar')
        id_sede_destino = entero(cuerpo.get('id_sede_destino'), 'la sede de destino')
        motivo = texto(cuerpo.get('motivo'), 'el motivo', 200, obligatorio=False)
        datos = traslado_service.solicitar(id_ejemplar, id_sede_destino, request.empleado['id_empleado'], motivo)
        return resultado_procedimiento(datos, 'p_id_traslado', 201)
    estado = parametro_opcion(request, 'estado', 'el estado', traslado_service.ESTADOS)
    return respuesta(traslado_service.listar(estado))


@manejar_errores
@metodos('POST')
@requiere_empleado(*GESTION)
def avanzar_traslado(request, id_traslado):
    return resultado_procedimiento(traslado_service.avanzar(id_traslado, request.empleado['id_empleado']), 'p_estado')
