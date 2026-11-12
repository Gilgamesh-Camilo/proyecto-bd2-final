from ..decoradores import ADMINISTRADOR, manejar_errores, metodos, requiere_empleado
from ..errores import NoEncontrado
from ..services import sede_service
from ..utils import respuesta, resultado_procedimiento
from ..validaciones import TELEFONO, fecha, leer_cuerpo, opcion, texto


def datos_sede(cuerpo):
    apertura = cuerpo.get('fecha_apertura')
    return {
        'nombre': texto(cuerpo.get('nombre'), 'el nombre de la sede', 80),
        'direccion': texto(cuerpo.get('direccion'), 'la dirección', 150),
        'ciudad': texto(cuerpo.get('ciudad'), 'la ciudad', 60),
        'telefono': texto(
            cuerpo.get('telefono'),
            'el teléfono',
            20,
            obligatorio=False,
            patron=TELEFONO,
            mensaje_patron='El teléfono solo admite números, entre 7 y 20 dígitos.',
        ),
        'fecha_apertura': None if apertura is None else fecha(apertura, 'la fecha de apertura'),
    }


@manejar_errores
@metodos('GET', 'POST')
@requiere_empleado(ADMINISTRADOR)
def sedes(request):
    if request.method == 'POST':
        datos = datos_sede(leer_cuerpo(request))
        return resultado_procedimiento(sede_service.registrar(datos), 'p_id_sede', 201)
    return respuesta(sede_service.listar())


@manejar_errores
@metodos('POST')
@requiere_empleado(ADMINISTRADOR)
def estado_sede(request, id_sede):
    if not sede_service.existe(id_sede):
        raise NoEncontrado('La sede no existe.')
    estado = opcion(leer_cuerpo(request).get('estado'), 'el estado', sede_service.ESTADOS)
    return resultado_procedimiento(sede_service.cambiar_estado(id_sede, estado), 'p_exito')
