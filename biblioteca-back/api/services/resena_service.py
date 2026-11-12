from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError

from ..errores import Conflicto
from ..mongo_service import RESENAS, MongoService
from . import socio_service


def id_valido(id_resena):
    try:
        return ObjectId(id_resena)
    except (InvalidId, TypeError):
        return None


def listar(id_libro):
    documentos = list(MongoService.coleccion(RESENAS).find({'id_libro': id_libro}).sort([('fecha', -1), ('_id', 1)]))
    ids = sorted({doc['id_socio'] for doc in documentos if isinstance(doc.get('id_socio'), int)})
    nombres = socio_service.nombres(ids)
    return [a_respuesta(doc, nombres) for doc in documentos]


def a_respuesta(doc, nombres):
    id_socio = doc.get('id_socio') if isinstance(doc.get('id_socio'), int) else None
    votos = doc.get('votos_utiles')
    return {
        'id': str(doc['_id']),
        'id_socio': id_socio,
        'socio': nombres.get(id_socio, 'Socio retirado'),
        'calificacion': doc.get('calificacion') if isinstance(doc.get('calificacion'), int) else 0,
        'titulo': doc.get('titulo') if isinstance(doc.get('titulo'), str) else '',
        'texto': doc.get('texto') if isinstance(doc.get('texto'), str) else '',
        'fecha': MongoService.fecha_local(doc.get('fecha')) or '',
        'editada': doc.get('editada') is True,
        'votos_utiles': votos if isinstance(votos, list) else [],
    }


def crear(id_libro, id_socio, calificacion, titulo, texto):
    try:
        insercion = MongoService.coleccion(RESENAS).insert_one(
            {
                'id_libro': id_libro,
                'id_socio': id_socio,
                'calificacion': calificacion,
                'titulo': titulo,
                'texto': texto,
                'fecha': MongoService.ahora(),
                'editada': False,
                'votos_utiles': [],
                'respuestas': [],
            }
        )
    except DuplicateKeyError as exc:
        raise Conflicto('Este socio ya publicó una reseña de este libro; puede editar la que tiene.') from exc
    return str(insercion.inserted_id)


def actualizar(id_resena, calificacion, titulo, texto):
    cambio = MongoService.coleccion(RESENAS).update_one(
        {'_id': id_resena},
        {
            '$set': {
                'calificacion': calificacion,
                'titulo': titulo,
                'texto': texto,
                'editada': True,
                'fecha_edicion': MongoService.ahora(),
            }
        },
    )
    return cambio.matched_count > 0


def eliminar(id_resena):
    return MongoService.coleccion(RESENAS).delete_one({'_id': id_resena}).deleted_count > 0
