from ..decoradores import ADMINISTRADOR, GESTION, manejar_errores, metodos, requiere_empleado
from ..services import multa_service
from ..utils import respuesta, resultado_procedimiento
from ..validaciones import parametro_opcion


@manejar_errores
@metodos('GET')
@requiere_empleado()
def multas(request):
    estado = parametro_opcion(request, 'estado', 'el estado', multa_service.ESTADOS)
    return respuesta(multa_service.listar(estado))


@manejar_errores
@metodos('POST')
@requiere_empleado(*GESTION)
def pagar_multa(request, id_prestamo):
    return resultado_procedimiento(multa_service.pagar(id_prestamo), 'p_exito')


@manejar_errores
@metodos('POST')
@requiere_empleado(ADMINISTRADOR)
def condonar_multa(request, id_prestamo):
    return resultado_procedimiento(multa_service.condonar(id_prestamo), 'p_exito')
