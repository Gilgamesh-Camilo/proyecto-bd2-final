import json
import math
import re
from datetime import date

from .errores import DatoInvalido

ENTERO_MAXIMO = 2147483647

DOCUMENTO = re.compile(r'[A-Za-z0-9]+')
CODIGO = re.compile(r'[A-Za-z0-9-]+')
USUARIO = re.compile(r'[A-Za-z0-9._-]+')
NOMBRE = re.compile(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+")
CORREO = re.compile(r'[^@\s]+@[^@\s]+\.[^@\s]+')
TELEFONO = re.compile(r'[0-9]{7,20}')
FECHA = re.compile(r'[0-9]{4}-[0-9]{2}-[0-9]{2}')
DIGITOS = re.compile(r'[0-9]{1,10}')
ISBN = re.compile(r'[0-9]{13}')


def mayuscula(campo):
    return campo[:1].upper() + campo[1:]


def leer_cuerpo(request):
    if not request.body:
        return {}
    try:
        datos = json.loads(request.body.decode('utf-8'))
    except (UnicodeDecodeError, ValueError) as exc:
        raise DatoInvalido('Los datos enviados no tienen un formato válido.') from exc
    if not isinstance(datos, dict):
        raise DatoInvalido('Los datos enviados no tienen un formato válido.')
    return datos


def entero(valor, campo, obligatorio=True, minimo=1, maximo=ENTERO_MAXIMO):
    if valor is None:
        if obligatorio:
            raise DatoInvalido(f'Falta {campo}.')
        return None
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise DatoInvalido(f'{mayuscula(campo)} debe ser un número entero.')
    if valor < minimo or valor > maximo:
        raise DatoInvalido(f'{mayuscula(campo)} debe estar entre {minimo} y {maximo}.')
    return valor


def numero(valor, campo, obligatorio=True, minimo=0, maximo=9999999999):
    if valor is None:
        if obligatorio:
            raise DatoInvalido(f'Falta {campo}.')
        return None
    if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not math.isfinite(valor):
        raise DatoInvalido(f'{mayuscula(campo)} debe ser un número.')
    if valor < minimo or valor > maximo:
        raise DatoInvalido(f'{mayuscula(campo)} debe estar entre {minimo} y {maximo}.')
    return valor


def lista(valor, campo):
    if valor is None:
        return []
    if not isinstance(valor, list):
        raise DatoInvalido(f'{mayuscula(campo)} debe ser una lista.')
    return valor


def texto(valor, campo, maximo=None, obligatorio=True, patron=None, mensaje_patron=None):
    if valor is None or (isinstance(valor, str) and valor.strip() == ''):
        if obligatorio:
            raise DatoInvalido(f'Falta {campo}.')
        return None
    if not isinstance(valor, str):
        raise DatoInvalido(f'{mayuscula(campo)} debe ser un texto.')
    limpio = valor.strip()
    if maximo is not None and len(limpio) > maximo:
        raise DatoInvalido(f'{mayuscula(campo)} admite máximo {maximo} caracteres.')
    if patron is not None and patron.fullmatch(limpio) is None:
        if mensaje_patron is None:
            mensaje_patron = f'{mayuscula(campo)} tiene caracteres no permitidos.'
        raise DatoInvalido(mensaje_patron)
    return limpio


def fecha(valor, campo):
    mensaje = f'{mayuscula(campo)} debe tener el formato AAAA-MM-DD.'
    limpio = texto(valor, campo, 10, patron=FECHA, mensaje_patron=mensaje)
    try:
        return date.fromisoformat(limpio)
    except ValueError as exc:
        raise DatoInvalido(f'{mayuscula(campo)} no es una fecha que exista.') from exc


def opcion(valor, campo, opciones):
    limpio = texto(valor, campo, 30)
    if limpio not in opciones:
        raise DatoInvalido(f'{mayuscula(campo)} no es una opción válida.')
    return limpio


def parametro(request, nombre):
    valor = request.GET.get(nombre)
    if not isinstance(valor, str) or valor.strip() == '':
        return None
    return valor.strip()


def parametro_entero(request, nombre, campo):
    valor = parametro(request, nombre)
    if valor is None:
        return None
    if DIGITOS.fullmatch(valor) is None or not 0 < int(valor) <= ENTERO_MAXIMO:
        raise DatoInvalido(f'{mayuscula(campo)} no es válido.')
    return int(valor)


def parametro_texto(request, nombre, campo, maximo, patron=None, mensaje_patron=None):
    return texto(parametro(request, nombre), campo, maximo, False, patron, mensaje_patron)


def parametro_opcion(request, nombre, campo, opciones):
    valor = parametro(request, nombre)
    if valor is None:
        return None
    if valor not in opciones:
        raise DatoInvalido(f'{mayuscula(campo)} no es una opción válida.')
    return valor


def patron_busqueda(termino):
    escapado = termino.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
    return f'%{escapado}%'
