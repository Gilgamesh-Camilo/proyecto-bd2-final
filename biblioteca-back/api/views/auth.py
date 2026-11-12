from django.contrib.auth.hashers import check_password, make_password

from ..decoradores import manejar_errores, metodos, requiere_empleado
from ..errores import DatoInvalido, NoAutenticado, PermisoDenegado
from ..services import auth_service
from ..sesion import crear_token
from ..utils import respuesta
from ..validaciones import USUARIO, leer_cuerpo, texto

CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos.'


def leer_contrasena(valor):
    if valor is None or (isinstance(valor, str) and valor == ''):
        raise DatoInvalido('Falta la contraseña.')
    if not isinstance(valor, str):
        raise DatoInvalido('La contraseña debe ser un texto.')
    if len(valor) > 128:
        raise DatoInvalido('La contraseña admite máximo 128 caracteres.')
    return valor


@manejar_errores
@metodos('POST')
def iniciar_sesion(request):
    cuerpo = leer_cuerpo(request)
    usuario = texto(
        cuerpo.get('usuario'),
        'el usuario',
        30,
        patron=USUARIO,
        mensaje_patron='El usuario solo admite letras, números, punto, guion y guion bajo.',
    )
    contrasena = leer_contrasena(cuerpo.get('contrasena'))
    empleado = auth_service.buscar_por_usuario(usuario)
    if empleado is None:
        make_password(contrasena)
        raise NoAutenticado(CREDENCIALES_INVALIDAS)
    if empleado['estado'] == 'BLOQUEADO':
        raise PermisoDenegado(
            'La cuenta está bloqueada por intentos fallidos. Pide a un administrador que la desbloquee.'
        )
    if empleado['estado'] != 'ACTIVO':
        raise PermisoDenegado('La cuenta está inactiva. Comunícate con un administrador.')
    if not check_password(contrasena, empleado['contrasena_hash']):
        acceso = auth_service.registrar_acceso(empleado['id_empleado'], False)
        if acceso.get('p_estado') == 'BLOQUEADO':
            raise PermisoDenegado(
                'Se superó el número de intentos y la cuenta quedó bloqueada. '
                'Pide a un administrador que la desbloquee.'
            )
        raise NoAutenticado(CREDENCIALES_INVALIDAS)
    auth_service.registrar_acceso(empleado['id_empleado'], True)
    return respuesta(
        {
            'token': crear_token(empleado['id_empleado']),
            'empleado': auth_service.publico(empleado),
        }
    )


@manejar_errores
@metodos('GET')
@requiere_empleado()
def empleado_actual(request):
    return respuesta({'empleado': request.empleado})
