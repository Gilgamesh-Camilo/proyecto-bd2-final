import json
from datetime import date

from django.test import RequestFactory, SimpleTestCase

from .errores import DatoInvalido
from .sesion import crear_token, leer_token
from .validaciones import (
    CODIGO,
    entero,
    fecha,
    leer_cuerpo,
    parametro_entero,
    parametro_opcion,
    patron_busqueda,
    texto,
)


class ValidacionesTests(SimpleTestCase):
    def test_entero_rechaza_tipos_incorrectos(self):
        for valor in [True, '5', 2.5, 0, -1, 2147483648]:
            with self.assertRaises(DatoInvalido):
                entero(valor, 'el socio')

    def test_entero_acepta_valor_valido_y_opcional(self):
        self.assertEqual(entero(7, 'el socio'), 7)
        self.assertIsNone(entero(None, 'el socio', obligatorio=False))

    def test_entero_respeta_el_maximo(self):
        with self.assertRaises(DatoInvalido):
            entero(6, 'la calificación', maximo=5)

    def test_texto_limpia_y_valida(self):
        self.assertEqual(texto('  hola  ', 'el título', 10), 'hola')
        self.assertIsNone(texto('   ', 'el correo', 10, obligatorio=False))
        with self.assertRaises(DatoInvalido):
            texto('x' * 11, 'el título', 10)
        with self.assertRaises(DatoInvalido):
            texto(15, 'el título', 10)
        with self.assertRaises(DatoInvalido):
            texto('B 01', 'el código', 20, patron=CODIGO)

    def test_fecha(self):
        self.assertEqual(fecha('2001-04-17', 'la fecha'), date(2001, 4, 17))
        for valor in ['2001-02-30', '17/04/2001', 20010417]:
            with self.assertRaises(DatoInvalido):
                fecha(valor, 'la fecha')

    def test_parametros_de_consulta(self):
        fabrica = RequestFactory()
        self.assertEqual(parametro_entero(fabrica.get('/', {'id_sede': '3'}), 'id_sede', 'la sede'), 3)
        self.assertIsNone(parametro_entero(fabrica.get('/'), 'id_sede', 'la sede'))
        with self.assertRaises(DatoInvalido):
            parametro_entero(fabrica.get('/', {'id_sede': '3a'}), 'id_sede', 'la sede')
        with self.assertRaises(DatoInvalido):
            parametro_opcion(fabrica.get('/', {'estado': 'OTRO'}), 'estado', 'el estado', ('ACTIVO',))

    def test_cuerpo_debe_ser_objeto(self):
        fabrica = RequestFactory()
        self.assertEqual(leer_cuerpo(fabrica.post('/', '{"a": 1}', content_type='application/json')), {'a': 1})
        for cuerpo in ['[1, 2]', 'no es json']:
            with self.assertRaises(DatoInvalido):
                leer_cuerpo(fabrica.post('/', cuerpo, content_type='application/json'))

    def test_patron_busqueda_escapa_comodines(self):
        self.assertEqual(patron_busqueda('100%_a'), '%100\\%\\_a%')


class SesionTests(SimpleTestCase):
    def test_token_valido(self):
        self.assertEqual(leer_token(crear_token(5)), 5)

    def test_token_alterado(self):
        token = crear_token(5)
        self.assertIsNone(leer_token(token[:-2] + 'xx'))
        self.assertIsNone(leer_token(''))
        self.assertIsNone(leer_token(None))


class VistasSinBaseTests(SimpleTestCase):
    def test_login_rechaza_metodo_get(self):
        respuesta = self.client.get('/api/auth/login/')
        self.assertEqual(respuesta.status_code, 405)
        self.assertIn('error', respuesta.json())

    def test_login_rechaza_cuerpo_invalido(self):
        respuesta = self.client.post('/api/auth/login/', 'texto', content_type='application/json')
        self.assertEqual(respuesta.status_code, 400)

    def test_login_exige_contrasena(self):
        cuerpo = json.dumps({'usuario': 'hpinilla'})
        respuesta = self.client.post('/api/auth/login/', cuerpo, content_type='application/json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.json()['error'], 'Falta la contraseña.')

    def test_rutas_protegidas_exigen_token(self):
        for ruta in ['/api/libros/', '/api/prestamos/', '/api/socios/1/', '/api/auditoria/']:
            self.assertEqual(self.client.get(ruta).status_code, 401)

    def test_token_invalido(self):
        respuesta = self.client.get('/api/panel/', HTTP_AUTHORIZATION='Bearer abc')
        self.assertEqual(respuesta.status_code, 401)

    def test_ruta_inexistente_responde_json(self):
        respuesta = self.client.get('/api/no-existe/')
        self.assertEqual(respuesta.status_code, 404)
        self.assertIn('error', respuesta.json())
