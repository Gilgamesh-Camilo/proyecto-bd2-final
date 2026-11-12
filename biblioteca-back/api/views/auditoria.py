from ..decoradores import ADMINISTRADOR, manejar_errores, metodos, requiere_empleado
from ..services import auditoria_service
from ..utils import respuesta
from ..validaciones import parametro_opcion


@manejar_errores
@metodos('GET')
@requiere_empleado(ADMINISTRADOR)
def auditoria(request):
    tabla = parametro_opcion(request, 'tabla', 'la tabla', auditoria_service.TABLAS)
    return respuesta(auditoria_service.listar(tabla))
