import logging
from datetime import timedelta

from pymongo.errors import PyMongoError

from .. import sql
from ..mongo_service import BUSQUEDAS, RESENAS, MongoService

registro = logging.getLogger('api')

DIAS_BUSQUEDAS = 60


def prestamos_por_sede():
    return sql.consultar(
        """
        SELECT s.nombre AS sede,
               COUNT(p.id_prestamo) AS prestamos,
               COUNT(p.id_prestamo) FILTER (WHERE p.id_sede_devolucion IS NOT NULL
                                              AND p.id_sede_devolucion <> p.id_sede_prestamo) AS devueltos_en_otra_sede
          FROM sedes s
          LEFT JOIN prestamos p ON p.id_sede_prestamo = s.id_sede
         GROUP BY s.id_sede, s.nombre
         ORDER BY prestamos DESC, s.nombre
        """
    )


def libros_mas_prestados():
    return sql.consultar(
        """
        SELECT l.titulo, COUNT(*) AS prestamos
          FROM prestamos p
          JOIN ejemplares e ON e.id_ejemplar = p.id_ejemplar
          JOIN libros l ON l.id_libro = e.id_libro
         GROUP BY l.id_libro, l.titulo
         ORDER BY prestamos DESC, l.titulo
         LIMIT 5
        """
    )


def mejor_calificados():
    return list(
        MongoService.coleccion(RESENAS).aggregate(
            [
                {'$group': {'_id': '$id_libro', 'promedio': {'$avg': '$calificacion'}, 'total': {'$sum': 1}}},
                {'$match': {'total': {'$gte': 2}}},
                {'$sort': {'promedio': -1, 'total': -1, '_id': 1}},
                {'$limit': 8},
                {
                    '$lookup': {
                        'from': 'fichas_bibliograficas',
                        'localField': '_id',
                        'foreignField': 'id_libro',
                        'as': 'ficha',
                    }
                },
                {'$unwind': '$ficha'},
                {
                    '$project': {
                        '_id': 0,
                        'id_libro': '$_id',
                        'titulo': '$ficha.titulo',
                        'categoria': '$ficha.categoria',
                        'promedio': {'$round': ['$promedio', 2]},
                        'total': 1,
                    }
                },
            ]
        )
    )


def resenas_por_categoria():
    return list(
        MongoService.coleccion(RESENAS).aggregate(
            [
                {
                    '$lookup': {
                        'from': 'fichas_bibliograficas',
                        'localField': 'id_libro',
                        'foreignField': 'id_libro',
                        'as': 'ficha',
                    }
                },
                {'$unwind': '$ficha'},
                {'$group': {'_id': '$ficha.categoria', 'promedio': {'$avg': '$calificacion'}, 'total': {'$sum': 1}}},
                {'$sort': {'total': -1, '_id': 1}},
                {'$project': {'_id': 0, 'categoria': '$_id', 'promedio': {'$round': ['$promedio', 2]}, 'total': 1}},
            ]
        )
    )


def terminos_mas_buscados(desde):
    return list(
        MongoService.coleccion(BUSQUEDAS).aggregate(
            [
                {'$match': {'fecha': {'$gte': desde}}},
                {
                    '$group': {
                        '_id': {'$toLower': '$termino'},
                        'veces': {'$sum': 1},
                        'con_resultado': {'$sum': {'$cond': [{'$gt': ['$total_resultados', 0]}, 1, 0]}},
                    }
                },
                {'$sort': {'veces': -1, '_id': 1}},
                {'$limit': 10},
                {'$project': {'_id': 0, 'termino': '$_id', 'veces': 1, 'con_resultado': 1}},
            ]
        )
    )


def busquedas_sin_resultado(desde):
    return list(
        MongoService.coleccion(BUSQUEDAS).aggregate(
            [
                {'$match': {'total_resultados': 0, 'fecha': {'$gte': desde}}},
                {'$group': {'_id': {'$toLower': '$termino'}, 'veces': {'$sum': 1}, 'sedes': {'$addToSet': '$sede'}}},
                {'$sort': {'veces': -1, '_id': 1}},
                {'$limit': 10},
                {'$project': {'_id': 0, 'termino': '$_id', 'veces': 1, 'sedes': 1}},
            ]
        )
    )


def estadisticas():
    datos = {
        'prestamos_por_sede': prestamos_por_sede(),
        'libros_mas_prestados': libros_mas_prestados(),
        'mejor_calificados': [],
        'resenas_por_categoria': [],
        'busquedas_sin_resultado': [],
        'terminos_mas_buscados': [],
    }
    desde = MongoService.ahora() - timedelta(days=DIAS_BUSQUEDAS)
    try:
        datos['mejor_calificados'] = mejor_calificados()
        datos['resenas_por_categoria'] = resenas_por_categoria()
        datos['terminos_mas_buscados'] = terminos_mas_buscados(desde)
        datos['busquedas_sin_resultado'] = busquedas_sin_resultado(desde)
    except PyMongoError:
        registro.warning('Las estadísticas de reseñas y búsquedas no están disponibles')
    return datos
