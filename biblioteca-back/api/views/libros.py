from datetime import date

from ..decoradores import GESTION, exigir_rol, manejar_errores, metodos, requiere_empleado
from ..errores import DatoInvalido, NoEncontrado
from ..services import catalogo_service, libro_service
from ..utils import respuesta, resultado_procedimiento
from ..validaciones import (
    CODIGO,
    ISBN,
    NOMBRE,
    entero,
    leer_cuerpo,
    lista,
    numero,
    opcion,
    parametro_entero,
    parametro_texto,
    texto,
)


def datos_autor(valor, posicion):
    if not isinstance(valor, dict):
        raise DatoInvalido(f'El autor {posicion} no tiene un formato válido.')
    autor = {'rol_autor': opcion(valor.get('rol_autor'), f'el rol del autor {posicion}', libro_service.ROLES_AUTOR)}
    if valor.get('id_autor') is not None:
        autor['id_autor'] = entero(valor.get('id_autor'), f'el autor {posicion}')
        return autor
    mensaje = f'El nombre del autor {posicion} solo admite letras.'
    autor['nombres'] = texto(
        valor.get('nombres'), f'los nombres del autor {posicion}', 80, patron=NOMBRE, mensaje_patron=mensaje
    )
    autor['apellidos'] = texto(
        valor.get('apellidos'), f'los apellidos del autor {posicion}', 80, patron=NOMBRE, mensaje_patron=mensaje
    )
    autor['nacionalidad'] = texto(
        valor.get('nacionalidad'),
        f'la nacionalidad del autor {posicion}',
        60,
        obligatorio=False,
        patron=NOMBRE,
        mensaje_patron=f'La nacionalidad del autor {posicion} solo admite letras.',
    )
    return autor


def datos_ejemplares(cuerpo):
    return {
        'id_sede': entero(cuerpo.get('id_sede'), 'la sede de los ejemplares'),
        'cantidad': entero(cuerpo.get('cantidad'), 'la cantidad de ejemplares', maximo=20),
        'ubicacion_estante': texto(cuerpo.get('ubicacion_estante'), 'la ubicación en estante', 30, obligatorio=False),
        'valor_reposicion': numero(cuerpo.get('valor_reposicion'), 'el valor de reposición', obligatorio=False),
    }


def datos_libro(cuerpo):
    autores = lista(cuerpo.get('autores'), 'la lista de autores')
    if not autores:
        raise DatoInvalido('El libro debe tener al menos un autor.')
    palabras = lista(cuerpo.get('palabras_clave'), 'las palabras clave')
    return {
        'isbn': texto(
            cuerpo.get('isbn'),
            'el ISBN',
            13,
            patron=ISBN,
            mensaje_patron='El ISBN debe tener 13 dígitos, sin guiones ni espacios.',
        ),
        'titulo': texto(cuerpo.get('titulo'), 'el título', 200),
        'subtitulo': texto(cuerpo.get('subtitulo'), 'el subtítulo', 200, obligatorio=False),
        'anio_publicacion': entero(
            cuerpo.get('anio_publicacion'),
            'el año de publicación',
            obligatorio=False,
            minimo=1450,
            maximo=date.today().year,
        ),
        'edicion': entero(cuerpo.get('edicion'), 'la edición'),
        'numero_paginas': entero(cuerpo.get('numero_paginas'), 'el número de páginas', obligatorio=False),
        'idioma': opcion(cuerpo.get('idioma'), 'el idioma', libro_service.IDIOMAS),
        'id_editorial': entero(cuerpo.get('id_editorial'), 'la editorial'),
        'id_categoria': entero(cuerpo.get('id_categoria'), 'la categoría'),
        'autores': [datos_autor(autor, posicion) for posicion, autor in enumerate(autores, start=1)],
        'sinopsis': texto(cuerpo.get('sinopsis'), 'la sinopsis', obligatorio=False),
        'palabras_clave': [
            texto(palabra, f'la palabra clave {posicion}') for posicion, palabra in enumerate(palabras, start=1)
        ],
    }


@manejar_errores
@metodos('GET', 'POST')
@requiere_empleado()
def libros(request):
    if request.method == 'POST':
        exigir_rol(request, GESTION)
        cuerpo = leer_cuerpo(request)
        libro = datos_libro(cuerpo)
        ejemplares = datos_ejemplares(cuerpo)
        datos = libro_service.registrar(libro, ejemplares)
        if datos.get('p_id_libro') is not None and not libro_service.crear_ficha(datos['p_id_libro'], libro):
            datos['p_mensaje'] = (
                datos['p_mensaje'] + ' La sinopsis y las palabras clave no se guardaron porque esa información '
                'no está disponible en este momento.'
            )
        return resultado_procedimiento(datos, 'p_id_libro', 201)
    termino = parametro_texto(request, 'q', 'la búsqueda', 100)
    id_categoria = parametro_entero(request, 'id_categoria', 'la categoría')
    id_sede = parametro_entero(request, 'id_sede', 'la sede')
    if id_categoria is not None and not catalogo_service.categoria_existe(id_categoria):
        raise NoEncontrado('La categoría no existe.')
    return respuesta(libro_service.buscar_catalogo(termino, id_categoria, id_sede, request.empleado))


@manejar_errores
@metodos('GET')
@requiere_empleado()
def detalle_libro(request, id_libro):
    libro = libro_service.detalle(id_libro)
    if libro is None:
        raise NoEncontrado('El libro no existe.')
    return respuesta(libro)


@manejar_errores
@metodos('POST')
@requiere_empleado(*GESTION)
def ejemplares_libro(request, id_libro):
    if not libro_service.existe(id_libro):
        raise NoEncontrado('El libro no existe.')
    ejemplares = datos_ejemplares(leer_cuerpo(request))
    return resultado_procedimiento(libro_service.registrar_ejemplares(id_libro, ejemplares), 'p_codigos', 201)


@manejar_errores
@metodos('GET')
@requiere_empleado()
def editoriales(request):
    return respuesta(libro_service.editoriales())


@manejar_errores
@metodos('GET')
@requiere_empleado()
def autores(request):
    return respuesta(libro_service.autores())


@manejar_errores
@metodos('GET')
@requiere_empleado()
def ejemplar_por_codigo(request):
    codigo = parametro_texto(
        request,
        'codigo',
        'el código del ejemplar',
        20,
        patron=CODIGO,
        mensaje_patron='El código del ejemplar solo admite letras, números y guiones.',
    )
    if codigo is None:
        raise DatoInvalido('Escribe el código del ejemplar.')
    ejemplar = libro_service.ejemplar_por_codigo(codigo)
    if ejemplar is None:
        raise NoEncontrado('No hay ningún ejemplar con ese código.')
    return respuesta(ejemplar)


@manejar_errores
@metodos('POST')
@requiere_empleado(*GESTION)
def estado_ejemplar(request, id_ejemplar):
    if not libro_service.ejemplar_existe(id_ejemplar):
        raise NoEncontrado('El ejemplar no existe.')
    estado = opcion(leer_cuerpo(request).get('estado'), 'el estado', libro_service.ESTADOS_MANUALES)
    return resultado_procedimiento(libro_service.cambiar_estado_ejemplar(id_ejemplar, estado), 'p_estado_final')
