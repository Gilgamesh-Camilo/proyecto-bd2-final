import re
from datetime import date, datetime
from decimal import Decimal

from django.db import connection

PROCEDIMIENTO = re.compile(r'sp_[a-z_]+')


def convertir(valor):
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, datetime):
        return valor.isoformat(timespec='seconds')
    if isinstance(valor, date):
        return valor.isoformat()
    return valor


def filas(cursor):
    columnas = [columna[0] for columna in cursor.description]
    return [dict(zip(columnas, [convertir(valor) for valor in fila], strict=True)) for fila in cursor.fetchall()]


def consultar(sql, parametros=None):
    with connection.cursor() as cursor:
        cursor.execute(sql, parametros or [])
        return filas(cursor)


def consultar_uno(sql, parametros=None):
    resultado = consultar(sql, parametros)
    if not resultado:
        return None
    return resultado[0]


def existe(sql, parametros=None):
    return consultar_uno(sql, parametros) is not None


def llamar(procedimiento, parametros_entrada, cantidad_salida):
    if PROCEDIMIENTO.fullmatch(procedimiento) is None:
        raise ValueError('Nombre de procedimiento no permitido.')
    marcas = ['%s'] * len(parametros_entrada) + ['NULL'] * cantidad_salida
    sql = f'CALL {procedimiento}({", ".join(marcas)})'
    with connection.cursor() as cursor:
        cursor.execute(sql, parametros_entrada)
        columnas = [col[0] for col in cursor.description]
        valores = [convertir(valor) for valor in cursor.fetchone()]
        return dict(zip(columnas, valores, strict=True))
