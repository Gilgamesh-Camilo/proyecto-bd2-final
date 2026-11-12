from django.conf import settings
from django.core import signing

SAL = 'bibliored.sesion'


def crear_token(id_empleado):
    return signing.dumps({'id_empleado': id_empleado}, salt=SAL, compress=True)


def leer_token(token):
    if not isinstance(token, str) or token == '':
        return None
    try:
        datos = signing.loads(token, salt=SAL, max_age=settings.HORAS_SESION * 3600)
    except signing.BadSignature:
        return None
    if not isinstance(datos, dict):
        return None
    id_empleado = datos.get('id_empleado')
    if isinstance(id_empleado, bool) or not isinstance(id_empleado, int):
        return None
    return id_empleado
