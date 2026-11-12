from ..decoradores import manejar_errores, metodos
from ..services import estado_service
from ..utils import respuesta


@manejar_errores
@metodos('GET')
def estado_servidor(request):
    return respuesta(
        {
            'estado': 'en línea',
            'conexiones': {
                'postgresql': estado_service.relacional_disponible(),
                'mongodb': estado_service.documental_disponible(),
            },
        }
    )
