class ErrorApi(Exception):
    estado = 400

    def __init__(self, mensaje):
        super().__init__(mensaje)
        self.mensaje = mensaje


class DatoInvalido(ErrorApi):
    estado = 400


class NoAutenticado(ErrorApi):
    estado = 401


class PermisoDenegado(ErrorApi):
    estado = 403


class NoEncontrado(ErrorApi):
    estado = 404


class Conflicto(ErrorApi):
    estado = 409


class ServicioNoDisponible(ErrorApi):
    estado = 503
