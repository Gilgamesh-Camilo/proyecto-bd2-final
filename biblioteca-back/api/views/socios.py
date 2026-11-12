from datetime import date

from ..decoradores import GESTION, exigir_rol, manejar_errores, metodos, requiere_empleado
from ..errores import DatoInvalido, NoEncontrado
from ..services import catalogo_service, multa_service, prestamo_service, reserva_service, socio_service
from ..utils import respuesta, resultado_procedimiento
from ..validaciones import (
    CORREO,
    DOCUMENTO,
    NOMBRE,
    TELEFONO,
    entero,
    fecha,
    leer_cuerpo,
    opcion,
    parametro_texto,
    texto,
)


def datos_socio(cuerpo):
    datos = {
        'tipo_documento': opcion(cuerpo.get('tipo_documento'), 'el tipo de documento', socio_service.TIPOS_DOCUMENTO),
        'numero_documento': texto(
            cuerpo.get('numero_documento'),
            'el número de documento',
            20,
            patron=DOCUMENTO,
            mensaje_patron='El documento solo admite letras y números, sin espacios ni puntos.',
        ),
        'nombres': texto(
            cuerpo.get('nombres'), 'los nombres', 80, patron=NOMBRE, mensaje_patron='Los nombres solo admiten letras.'
        ),
        'apellidos': texto(
            cuerpo.get('apellidos'),
            'los apellidos',
            80,
            patron=NOMBRE,
            mensaje_patron='Los apellidos solo admiten letras.',
        ),
        'fecha_nacimiento': fecha(cuerpo.get('fecha_nacimiento'), 'la fecha de nacimiento'),
        'email': texto(
            cuerpo.get('email'),
            'el correo',
            120,
            obligatorio=False,
            patron=CORREO,
            mensaje_patron='El correo no tiene un formato válido.',
        ),
        'telefono': texto(
            cuerpo.get('telefono'),
            'el teléfono',
            20,
            obligatorio=False,
            patron=TELEFONO,
            mensaje_patron='El teléfono solo admite números, entre 7 y 20 dígitos.',
        ),
        'direccion': texto(cuerpo.get('direccion'), 'la dirección', 150, obligatorio=False),
        'id_tipo_socio': entero(cuerpo.get('id_tipo_socio'), 'el tipo de socio'),
    }
    if datos['fecha_nacimiento'] >= date.today():
        raise DatoInvalido('La fecha de nacimiento debe ser anterior a hoy.')
    if not catalogo_service.tipo_socio_existe(datos['id_tipo_socio']):
        raise NoEncontrado('El tipo de socio no existe.')
    return datos


@manejar_errores
@metodos('GET', 'POST')
@requiere_empleado()
def socios(request):
    if request.method == 'POST':
        exigir_rol(request, GESTION)
        datos = datos_socio(leer_cuerpo(request))
        return resultado_procedimiento(socio_service.registrar(datos), 'p_id_socio', 201)
    documento = parametro_texto(
        request,
        'documento',
        'el documento',
        20,
        patron=DOCUMENTO,
        mensaje_patron='El documento solo admite letras y números, sin espacios ni puntos.',
    )
    if documento is not None:
        return respuesta(socio_service.por_documento(documento))
    return respuesta(socio_service.buscar(parametro_texto(request, 'q', 'la búsqueda', 100)))


@manejar_errores
@metodos('GET')
@requiere_empleado()
def detalle_socio(request, id_socio):
    socio = socio_service.detalle(id_socio)
    if socio is None:
        raise NoEncontrado('El socio no existe.')
    socio['prestamos'] = prestamo_service.de_socio(id_socio)
    socio['multas'] = multa_service.de_socio(id_socio)
    socio['reservas'] = reserva_service.de_socio(id_socio)
    socio['listas_lectura'] = socio_service.listas_lectura(id_socio)
    return respuesta(socio)


@manejar_errores
@metodos('POST')
@requiere_empleado(*GESTION)
def estado_socio(request, id_socio):
    if not socio_service.existe(id_socio):
        raise NoEncontrado('El socio no existe.')
    estado = opcion(leer_cuerpo(request).get('estado'), 'el estado', socio_service.ESTADOS)
    return resultado_procedimiento(socio_service.cambiar_estado(id_socio, estado), 'p_exito')


@manejar_errores
@metodos('POST')
@requiere_empleado(*GESTION)
def carne_socio(request, id_socio):
    if not socio_service.existe(id_socio):
        raise NoEncontrado('El socio no existe.')
    return resultado_procedimiento(socio_service.renovar_carne(id_socio), 'p_fecha_vencimiento')
