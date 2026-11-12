from ..decoradores import GESTION, manejar_errores, metodos, requiere_empleado
from ..errores import NoEncontrado
from ..services import multa_service, prestamo_service
from ..utils import respuesta, resultado_procedimiento
from ..validaciones import entero, leer_cuerpo, numero, opcion, parametro_entero, parametro_opcion, parametro_texto


@manejar_errores
@metodos('GET', 'POST')
@requiere_empleado()
def prestamos(request):
    if request.method == 'POST':
        cuerpo = leer_cuerpo(request)
        id_socio = entero(cuerpo.get('id_socio'), 'el socio')
        id_ejemplar = entero(cuerpo.get('id_ejemplar'), 'el ejemplar')
        datos = prestamo_service.registrar(id_ejemplar, id_socio, request.empleado['id_empleado'])
        return resultado_procedimiento(datos, 'p_id_prestamo', 201)
    estado = parametro_opcion(request, 'estado', 'el estado', prestamo_service.ESTADOS)
    id_sede = parametro_entero(request, 'id_sede', 'la sede')
    termino = parametro_texto(request, 'q', 'la búsqueda', 100)
    return respuesta(prestamo_service.listar(estado, id_sede, termino))


@manejar_errores
@metodos('GET')
@requiere_empleado()
def detalle_prestamo(request, id_prestamo):
    prestamo = prestamo_service.detalle(id_prestamo)
    if prestamo is None:
        raise NoEncontrado('El préstamo no existe.')
    return respuesta(prestamo)


@manejar_errores
@metodos('POST')
@requiere_empleado()
def devolver_prestamo(request, id_prestamo):
    if not prestamo_service.existe(id_prestamo):
        raise NoEncontrado('El préstamo no existe.')
    datos = prestamo_service.devolver(id_prestamo, request.empleado['id_empleado'])
    return resultado_procedimiento(datos, 'p_valor_multa')


@manejar_errores
@metodos('POST')
@requiere_empleado()
def renovar_prestamo(request, id_prestamo):
    if not prestamo_service.existe(id_prestamo):
        raise NoEncontrado('El préstamo no existe.')
    return resultado_procedimiento(prestamo_service.renovar(id_prestamo), 'p_fecha_limite')


@manejar_errores
@metodos('POST')
@requiere_empleado(*GESTION)
def multa_prestamo(request, id_prestamo):
    if not prestamo_service.existe(id_prestamo):
        raise NoEncontrado('El préstamo no existe.')
    cuerpo = leer_cuerpo(request)
    motivo = opcion(cuerpo.get('motivo'), 'el motivo', multa_service.MOTIVOS_MANUALES)
    valor = numero(cuerpo.get('valor'), 'el valor de la multa', obligatorio=False, minimo=0.01)
    datos = multa_service.registrar(id_prestamo, motivo, valor, request.empleado['id_empleado'])
    return resultado_procedimiento(datos, 'p_valor_multa', 201)
