from ..decoradores import ADMINISTRADOR, manejar_errores, metodos, requiere_empleado
from ..errores import NoEncontrado
from ..services import empleado_service
from ..utils import respuesta, resultado_procedimiento
from ..validaciones import parametro_opcion


@manejar_errores
@metodos('GET')
@requiere_empleado(ADMINISTRADOR)
def empleados(request):
    estado = parametro_opcion(request, 'estado', 'el estado', empleado_service.ESTADOS)
    return respuesta(empleado_service.listar(estado))


@manejar_errores
@metodos('POST')
@requiere_empleado(ADMINISTRADOR)
def desbloquear_empleado(request, id_empleado):
    if not empleado_service.existe(id_empleado):
        raise NoEncontrado('El empleado no existe.')
    return resultado_procedimiento(empleado_service.desbloquear(id_empleado), 'p_exito')
