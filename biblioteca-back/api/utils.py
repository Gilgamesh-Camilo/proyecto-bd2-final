from django.http import JsonResponse

from .errores import Conflicto


def respuesta(datos, estado=200):
    return JsonResponse(
        datos,
        status=estado,
        safe=isinstance(datos, dict),
        json_dumps_params={'ensure_ascii': False},
    )


def error(mensaje, estado=400):
    return respuesta({'error': mensaje}, estado)


def resultado(mensaje, **datos):
    contenido = {'mensaje': mensaje, 'p_mensaje': mensaje}
    contenido.update(datos)
    return contenido


def resultado_procedimiento(datos, campo_exito, estado=200):
    mensaje = datos.get('p_mensaje')
    if not isinstance(mensaje, str) or mensaje.strip() == '':
        mensaje = 'No se pudo completar la operación.'
    if datos.get(campo_exito) is None or datos.get(campo_exito) is False:
        raise Conflicto(mensaje)
    contenido = dict(datos)
    contenido['mensaje'] = mensaje
    return respuesta(contenido, estado)
