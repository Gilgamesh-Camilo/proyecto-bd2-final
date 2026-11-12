from datetime import UTC, datetime
from threading import Lock
from zoneinfo import ZoneInfo

from django.conf import settings
from pymongo import MongoClient

FICHAS = 'fichas_bibliograficas'
RESENAS = 'resenas'
BUSQUEDAS = 'busquedas'
LISTAS = 'listas_lectura'

ZONA = ZoneInfo(settings.TIME_ZONE)


class MongoService:
    _client = None
    _candado = Lock()

    @classmethod
    def db(cls):
        if cls._client is None:
            with cls._candado:
                if cls._client is None:
                    cls._client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=2500)
        return cls._client[settings.MONGO_DB_NAME]

    @classmethod
    def coleccion(cls, nombre):
        return cls.db()[nombre]

    @classmethod
    def ping(cls):
        cls.db().command('ping')

    @staticmethod
    def ahora():
        return datetime.now(UTC)

    @staticmethod
    def fecha_local(valor):
        if not isinstance(valor, datetime):
            return None
        if valor.tzinfo is None:
            valor = valor.replace(tzinfo=UTC)
        return valor.astimezone(ZONA).replace(tzinfo=None).isoformat(timespec='seconds')
