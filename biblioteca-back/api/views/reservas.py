from ..decoradores import manejar_errores, metodos, requiere_empleado
from ..services import reserva_service
from ..utils import respuesta, resultado_procedimiento
from ..validaciones import entero, leer_cuerpo, parametro_opcion


@manejar_errores
@metodos('GET', 'POST')
@requiere_empleado()
def reservas(request):
    if request.method == 'POST':
        cuerpo = leer_cuerpo(request)
        id_socio = entero(cuerpo.get('id_socio'), 'el socio')
        id_libro = entero(cuerpo.get('id_libro'), 'el libro')
        id_sede = entero(cuerpo.get('id_sede'), 'la sede de retiro')
        return resultado_procedimiento(reserva_service.crear(id_socio, id_libro, id_sede), 'p_id_reserva', 201)
    estado = parametro_opcion(request, 'estado', 'el estado', reserva_service.ESTADOS)
    return respuesta(reserva_service.listar(estado))


@manejar_errores
@metodos('POST')
@requiere_empleado()
def cancelar_reserva(request, id_reserva):
    return resultado_procedimiento(reserva_service.cancelar(id_reserva), 'p_exito')
