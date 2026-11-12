import logging

from django.db import DatabaseError, connection
from pymongo.errors import PyMongoError

from ..mongo_service import MongoService

registro = logging.getLogger('api')


def relacional_disponible():
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except DatabaseError:
        registro.warning('La base relacional no respondió')
        return False
    return True


def documental_disponible():
    try:
        MongoService.ping()
    except PyMongoError:
        registro.warning('La base documental no respondió')
        return False
    return True
