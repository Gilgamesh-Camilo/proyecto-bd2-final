from django.urls import include, path

from api.utils import error

urlpatterns = [
    path('api/', include('api.urls')),
]


def no_encontrado(request, exception):
    return error('La ruta solicitada no existe.', 404)


def error_servidor(request):
    return error('Ocurrió un error inesperado. Intenta de nuevo.', 500)


handler404 = no_encontrado

handler500 = error_servidor
