import logging
from functools import wraps

from django.db import DatabaseError
from pymongo.errors import PyMongoError

from .errores import ErrorApi, NoAutenticado, PermisoDenegado
from .services import auth_service
from .sesion import leer_token
from .utils import error

registro = logging.getLogger('api')

ADMINISTRADOR = 'ADMINISTRADOR'
BIBLIOTECARIO = 'BIBLIOTECARIO'
GESTION = (ADMINISTRADOR, BIBLIOTECARIO)


def manejar_errores(vista):
    @wraps(vista)
    def envoltura(request, *args, **kwargs):
        try:
            return vista(request, *args, **kwargs)
        except ErrorApi as exc:
            return error(exc.mensaje, exc.estado)
        except PyMongoError as exc:
            registro.warning('Fallo en la base documental durante %s %s: %s', request.method, request.path, exc)
            return error('Esta información no está disponible en este momento. Intenta de nuevo en unos minutos.', 503)
        except DatabaseError:
            registro.exception('Fallo en la base relacional durante %s %s', request.method, request.path)
            return error('No se pudo completar la operación. Intenta de nuevo en unos minutos.', 503)
        except Exception:
            registro.exception('Error inesperado durante %s %s', request.method, request.path)
            return error('Ocurrió un error inesperado. Intenta de nuevo.', 500)

    return envoltura


def metodos(*permitidos):
    def decorador(vista):
        @wraps(vista)
        def envoltura(request, *args, **kwargs):
            if request.method not in permitidos:
                respuesta = error('Método no permitido.', 405)
                respuesta['Allow'] = ', '.join(permitidos)
                return respuesta
            return vista(request, *args, **kwargs)

        return envoltura

    return decorador


def requiere_empleado(*roles):
    def decorador(vista):
        @wraps(vista)
        def envoltura(request, *args, **kwargs):
            encabezado = request.headers.get('Authorization')
            if not isinstance(encabezado, str) or not encabezado.startswith('Bearer '):
                raise NoAutenticado('Inicia sesión para continuar.')
            id_empleado = leer_token(encabezado[len('Bearer ') :].strip())
            if id_empleado is None:
                raise NoAutenticado('La sesión no es válida o ya venció. Inicia sesión de nuevo.')
            empleado = auth_service.empleado_activo(id_empleado)
            if empleado is None:
                raise NoAutenticado('La sesión no es válida o ya venció. Inicia sesión de nuevo.')
            request.empleado = empleado
            exigir_rol(request, roles)
            return vista(request, *args, **kwargs)

        return envoltura

    return decorador


def exigir_rol(request, roles):
    if roles and request.empleado['rol'] not in roles:
        raise PermisoDenegado('Tu rol no tiene permiso para esta acción.')
