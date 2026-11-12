from ..decoradores import GESTION, exigir_rol, manejar_errores, metodos, requiere_empleado
from ..errores import Conflicto, NoEncontrado
from ..services import libro_service, prestamo_service, resena_service, socio_service
from ..utils import respuesta, resultado
from ..validaciones import entero, leer_cuerpo, texto


def datos_resena(cuerpo):
    calificacion = entero(cuerpo.get('calificacion'), 'la calificación', maximo=5)
    titulo = texto(cuerpo.get('titulo'), 'el título de la reseña', 80)
    contenido = texto(cuerpo.get('texto'), 'el texto de la reseña', 3000)
    return calificacion, titulo, contenido


@manejar_errores
@metodos('GET', 'POST')
@requiere_empleado()
def resenas_libro(request, id_libro):
    if not libro_service.existe(id_libro):
        raise NoEncontrado('El libro no existe.')
    if request.method == 'GET':
        return respuesta(resena_service.listar(id_libro))
    cuerpo = leer_cuerpo(request)
    id_socio = entero(cuerpo.get('id_socio'), 'el socio')
    calificacion, titulo, contenido = datos_resena(cuerpo)
    if not socio_service.existe(id_socio):
        raise NoEncontrado('El socio no existe.')
    if not prestamo_service.socio_devolvio_libro(id_socio, id_libro):
        raise Conflicto('Solo se puede reseñar un libro que el socio ya devolvió.')
    id_resena = resena_service.crear(id_libro, id_socio, calificacion, titulo, contenido)
    return respuesta(resultado('Reseña publicada.', id=id_resena), 201)


@manejar_errores
@metodos('PUT', 'DELETE')
@requiere_empleado()
def resena(request, id_resena):
    identificador = resena_service.id_valido(id_resena)
    if identificador is None:
        raise NoEncontrado('La reseña no existe.')
    if request.method == 'DELETE':
        exigir_rol(request, GESTION)
        if not resena_service.eliminar(identificador):
            raise NoEncontrado('La reseña no existe.')
        return respuesta(resultado('Reseña eliminada.'))
    calificacion, titulo, contenido = datos_resena(leer_cuerpo(request))
    if not resena_service.actualizar(identificador, calificacion, titulo, contenido):
        raise NoEncontrado('La reseña no existe.')
    return respuesta(resultado('Reseña actualizada.'))
