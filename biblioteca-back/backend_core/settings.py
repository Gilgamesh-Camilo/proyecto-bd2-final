import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')


def variable(nombre, defecto=None):
    valor = os.environ.get(nombre, defecto)
    if not isinstance(valor, str) or valor.strip() == '':
        raise ImproperlyConfigured(f'Falta la variable {nombre} en el archivo .env.')
    return valor.strip()


def lista(nombre, defecto):
    return [elemento.strip() for elemento in variable(nombre, defecto).split(',') if elemento.strip() != '']


def entero(nombre, defecto):
    valor = variable(nombre, defecto)
    if not valor.isdigit() or int(valor) <= 0:
        raise ImproperlyConfigured(f'La variable {nombre} debe ser un número entero positivo.')
    return int(valor)


SECRET_KEY = variable('SECRET_KEY')

DEBUG = variable('DEBUG', 'False').lower() == 'true'

ALLOWED_HOSTS = lista('ALLOWED_HOSTS', 'localhost,127.0.0.1')

INSTALLED_APPS = [
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend_core.urls'

WSGI_APPLICATION = 'backend_core.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': variable('DB_NAME', 'biblioteca_db'),
        'USER': variable('DB_USER', 'biblioteca_app'),
        'PASSWORD': variable('DB_PASSWORD'),
        'HOST': variable('DB_HOST', 'localhost'),
        'PORT': variable('DB_PORT', '5432'),
        'CONN_MAX_AGE': 60,
        'OPTIONS': {'connect_timeout': 5},
    }
}

MONGO_URI = variable('MONGO_URI', 'mongodb://localhost:27017/')

MONGO_DB_NAME = variable('MONGO_DB_NAME', 'biblioteca_nosql')

HORAS_SESION = entero('HORAS_SESION', '8')

CORS_ALLOWED_ORIGINS = lista('CORS_ALLOWED_ORIGINS', 'http://localhost:4200')

LANGUAGE_CODE = 'es-co'

TIME_ZONE = 'America/Bogota'

USE_I18N = True

USE_TZ = False

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {'format': '{asctime} {levelname} {name}: {message}', 'style': '{'},
    },
    'handlers': {
        'consola': {'class': 'logging.StreamHandler', 'formatter': 'simple'},
    },
    'loggers': {
        'api': {'handlers': ['consola'], 'level': 'INFO', 'propagate': False},
    },
}
