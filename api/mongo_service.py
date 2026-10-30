from pymongo import MongoClient
from django.conf import settings
from datetime import datetime

class MongoService:
    _client = None
    _db = None

    @classmethod
    def get_database(cls):
        if cls._db is None:
            cls._client = MongoClient(settings.MONGO_URI)
            cls._db = cls._client[settings.MONGO_DB_NAME]
        return cls._db

    @classmethod
    def log_event(cls, tipo_evento, payload, usuario="sistema"):
        """Operación CRUD: Insertar documento NoSQL"""
        db = cls.get_database()
        doc = {
            "tipo_evento": tipo_evento,
            "usuario": usuario,
            "payload": payload,
            "timestamp": datetime.utcnow()
        }
        res = db["eventos_sistema"].insert_one(doc)
        return str(res.inserted_id)

    @classmethod
    def get_resumen_agregacion_eventos(cls):
        """Agregación en MongoDB: Agrupar eventos por tipo y contar ocurrencias"""
        db = cls.get_database()
        pipeline = [
            {"$group": {"_id": "$tipo_evento", "total": {"$sum": 1}}},
            {"$sort": {"total": -1}}
        ]
        return list(db["eventos_sistema"].aggregate(pipeline))

    @classmethod
    def get_ultimos_eventos(cls, limit=10):
        """Consulta NoSQL con ordenamiento y proyección"""
        db = cls.get_database()
        cursor = db["eventos_sistema"].find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
        return list(cursor)
