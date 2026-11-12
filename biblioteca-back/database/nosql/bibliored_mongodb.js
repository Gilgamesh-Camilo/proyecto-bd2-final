// ====================================================================================
// Autor       :
// Fecha       : 2026-11-01
// Version     : 1.1
// Descripcion : Parte documental de BiblioRed (MongoDB 6 o superior). Se ejecuta
//               despues de bibliored_postgresql.sql: los documentos se enlazan
//               con esa base por id_libro e id_socio, y los datos de prueba son
//               coherentes con los suyos (las resenas salen de prestamos
//               DEVUELTOS reales). Ejecutar con:
//                   mongosh "mongodb://localhost:27017" bibliored_mongodb.js
//               La base se llama biblioteca_nosql, como MONGO_DB_NAME de la API.
//
// Por que estos datos van en MongoDB
//   En PostgreSQL se queda todo lo que tiene reglas, estados, dinero o cupos:
//   prestamos, multas, reservas y traslados necesitan transacciones con
//   COMMIT y ROLLBACK, triggers y claves foraneas. A MongoDB pasa lo que no
//   interviene en esas reglas y que en tablas quedaria forzado:
//   - fichas_bibliograficas: cada libro trae informacion distinta. Uno tiene
//     tabla de contenido, otro premios, otro adaptaciones a series o cine, y
//     la cantidad de cada cosa cambia de un libro a otro. En tablas serian
//     tres tablas hijas casi vacias o columnas llenas de NULL; aqui cada
//     ficha guarda solo lo que tiene y se lee completa con una consulta. El
//     indice de texto en espanol busca en el titulo, las palabras clave y la
//     sinopsis, con mas peso para el titulo.
//   - resenas: el texto es libre y cada resena guarda adentro los votos de
//     utilidad y las respuestas, que crecen con el tiempo. Siempre se
//     consultan por libro y junto con su promedio, que sale de una
//     agregacion. Si MongoDB no responde, prestar y devolver sigue
//     funcionando, porque eso vive solo en PostgreSQL.
//   - busquedas: bitacora que se escribe en cada busqueda del catalogo y que
//     solo sirve resumida (lo mas buscado y lo que no se encontro). El indice
//     TTL borra solo lo que pasa de 730 dias, sin procesos de limpieza. En
//     PostgreSQL seria una tabla enorme que nadie lee fila por fila.
//   - listas_lectura: cada lista lleva sus libros adentro, con la fecha en
//     que se agregaron y si ya se leyeron, y se lee y se guarda entera. En
//     tablas harian falta una tabla de listas y otra de detalle solo para
//     esto.
//   La integridad entre las dos bases la cuida la API: antes de guardar una
//   resena revisa en PostgreSQL que el socio exista y haya devuelto el libro.
//
// Convenciones: ix_ indice, ux_ indice unico, seguidos de la coleccion y de
//               los campos.
// ====================================================================================

db = db.getSiblingDB('biblioteca_nosql');

// ====================================================================================
// 1. LIMPIEZA DE ENTORNO
// ====================================================================================
['fichas_bibliograficas', 'resenas', 'busquedas', 'listas_lectura'].forEach(function (nombre) {
  db.getCollection(nombre).drop();
});

// ====================================================================================
// 2. CREACIÓN DE COLECCIONES CON VALIDACIÓN ($jsonSchema)
// ====================================================================================
// MongoDB rechaza cualquier documento que no cumpla el esquema de su
// coleccion (tipos, campos obligatorios, rangos).

db.createCollection('fichas_bibliograficas', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id_libro', 'isbn', 'titulo', 'categoria'],
      properties: {
        id_libro: { bsonType: 'int', minimum: 1 },
        isbn: { bsonType: 'string', pattern: '^[0-9]{13}$' },
        titulo: { bsonType: 'string' },
        categoria: { bsonType: 'string' },
        sinopsis: { bsonType: 'string' },
        palabras_clave: { bsonType: 'array', items: { bsonType: 'string' } },
        premios: { bsonType: 'array' },
        adaptaciones: { bsonType: 'array' },
        tabla_contenido: { bsonType: 'array' }
      }
    }
  }
});

db.createCollection('resenas', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id_libro', 'id_socio', 'calificacion', 'fecha'],
      properties: {
        id_libro: { bsonType: 'int', minimum: 1 },
        id_socio: { bsonType: ['int', 'null'] },
        calificacion: { bsonType: 'int', minimum: 1, maximum: 5 },
        titulo: { bsonType: 'string' },
        texto: { bsonType: 'string', maxLength: 3000 },
        fecha: { bsonType: 'date' },
        votos_utiles: { bsonType: 'array', items: { bsonType: 'int' } },
        respuestas: { bsonType: 'array', maxItems: 50 }
      }
    }
  }
});

db.createCollection('busquedas', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['fecha', 'termino', 'total_resultados'],
      properties: {
        fecha: { bsonType: 'date' },
        termino: { bsonType: 'string' },
        total_resultados: { bsonType: 'int', minimum: 0 },
        canal: { enum: ['MOSTRADOR', 'WEB', 'KIOSCO'] }
      }
    }
  }
});

db.createCollection('listas_lectura', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id_socio', 'nombre', 'libros'],
      properties: {
        id_socio: { bsonType: 'int', minimum: 1 },
        nombre: { bsonType: 'string' },
        publica: { bsonType: 'bool' },
        libros: { bsonType: 'array', maxItems: 200 }
      }
    }
  }
});

// ====================================================================================
// 3. ÍNDICES
// ====================================================================================
// id_libro no se repite en las fichas; la busqueda de texto del catalogo
// usa el indice text en espanol (pesa mas el titulo que la sinopsis).
db.fichas_bibliograficas.createIndex({ id_libro: 1 }, { name: 'ux_fichas_libro', unique: true });
db.fichas_bibliograficas.createIndex(
  { titulo: 'text', sinopsis: 'text', palabras_clave: 'text' },
  { name: 'ix_fichas_texto', default_language: 'spanish', weights: { titulo: 10, palabras_clave: 5, sinopsis: 1 } }
);
// Un socio solo puede resenar una vez cada libro.
db.resenas.createIndex({ id_libro: 1, id_socio: 1 }, { name: 'ux_resenas_libro_socio', unique: true });
db.resenas.createIndex({ id_libro: 1, fecha: -1 }, { name: 'ix_resenas_libro_fecha' });
// TTL: MongoDB borra solas las busquedas de mas de 730 dias (63072000 s).
db.busquedas.createIndex({ fecha: 1 }, { name: 'ix_busquedas_fecha', expireAfterSeconds: 63072000 });
db.busquedas.createIndex({ total_resultados: 1, fecha: -1 }, { name: 'ix_busquedas_resultados_fecha' });
db.listas_lectura.createIndex({ id_socio: 1 }, { name: 'ix_listas_socio' });
db.listas_lectura.createIndex({ 'libros.id_libro': 1 }, { name: 'ix_listas_libro' });

// ====================================================================================
// 4. DATOS SEMILLA (INSERCIONES DE PRUEBA)
// ====================================================================================
// Las busquedas y las listas usan fechas relativas a hoy para que caigan
// dentro de los 60 dias que miran las estadisticas.
var ahora = new Date();
function haceDias(dias, minutos) {
  return new Date(ahora.getTime() - dias * 86400000 - minutos * 60000);
}

// 4.1 Fichas bibliograficas: una por cada libro de PostgreSQL (21).
db.fichas_bibliograficas.insertMany([
  {
    id_libro: 1,
    isbn: '9789589900017',
    titulo: 'Fundamentos de bases de datos',
    categoria: 'Bases de datos',
    actualizado_en: new Date(),
    sinopsis: 'Texto de referencia sobre el diseño, la consulta y la administración de bases de datos relacionales.',
    palabras_clave: ['modelo relacional', 'SQL', 'normalización', 'transacciones', 'índices'],
    tabla_contenido: [
      { capitulo: 2, titulo: 'Introducción al modelo relacional' },
      { capitulo: 3, titulo: 'Introducción a SQL' },
      { capitulo: 4, titulo: 'SQL intermedio' }
    ],
    nivel: 'universitario'
  },
  {
    id_libro: 2,
    isbn: '9789589900024',
    titulo: 'Fundamentos de sistemas de bases de datos',
    categoria: 'Bases de datos',
    actualizado_en: new Date(),
    sinopsis: 'Recorrido por el modelado entidad-relación, el álgebra relacional y el diseño de bases de datos.',
    palabras_clave: ['modelo entidad-relación', 'álgebra relacional', 'diseño de bases de datos', 'SQL'],
    nivel: 'universitario'
  },
  {
    id_libro: 3,
    isbn: '9789589900031',
    titulo: 'SQL Cookbook',
    categoria: 'Bases de datos',
    actualizado_en: new Date(),
    sinopsis: 'Recetario de consultas SQL para problemas frecuentes, con soluciones para varios motores.',
    palabras_clave: ['SQL', 'funciones de ventana', 'consultas', 'recetas'],
    nivel: 'profesional'
  },
  {
    id_libro: 4,
    isbn: '9789589900048',
    titulo: 'Cómo programar en Java',
    categoria: 'Programación',
    actualizado_en: new Date(),
    sinopsis: 'Curso de programación orientada a objetos en Java con ejemplos completos y ejercicios.',
    palabras_clave: ['Java', 'programación orientada a objetos', 'ejercicios'],
    nivel: 'universitario'
  },
  {
    id_libro: 5,
    isbn: '9789589900055',
    titulo: 'Código limpio',
    categoria: 'Programación',
    actualizado_en: new Date(),
    sinopsis: 'Prácticas para escribir código legible: nombres, funciones pequeñas, pruebas y refactorización.',
    palabras_clave: ['buenas prácticas', 'refactorización', 'código legible'],
    nivel: 'profesional'
  },
  {
    id_libro: 6,
    isbn: '9789589900062',
    titulo: 'Estadística para administración y economía',
    categoria: 'Estadística',
    actualizado_en: new Date(),
    sinopsis: 'Estadística descriptiva e inferencial aplicada a problemas de negocios.',
    palabras_clave: ['estadística', 'inferencia', 'regresión', 'probabilidad'],
    nivel: 'universitario'
  },
  {
    id_libro: 7,
    isbn: '9789589900079',
    titulo: 'Cien años de soledad',
    categoria: 'Novela colombiana',
    actualizado_en: new Date(),
    sinopsis: 'La historia de varias generaciones de la familia Buendía en el pueblo de Macondo.',
    palabras_clave: ['realismo mágico', 'Macondo', 'familia Buendía'],
    premios: [{ nombre: 'Premio Rómulo Gallegos', anio: 1972 }],
    adaptaciones: [{ tipo: 'serie', titulo: 'Cien años de soledad', anio: 2024 }]
  },
  {
    id_libro: 8,
    isbn: '9789589900086',
    titulo: 'El amor en los tiempos del cólera',
    categoria: 'Novela colombiana',
    actualizado_en: new Date(),
    sinopsis: 'Un amor que espera más de cincuenta años en una ciudad del Caribe colombiano.',
    palabras_clave: ['amor', 'Caribe', 'vejez'],
    adaptaciones: [{ tipo: 'película', titulo: 'El amor en los tiempos del cólera', anio: 2007 }]
  },
  {
    id_libro: 9,
    isbn: '9789589900093',
    titulo: 'El coronel no tiene quien le escriba',
    categoria: 'Novela colombiana',
    actualizado_en: new Date(),
    sinopsis: 'Un coronel retirado espera durante años la carta que le confirme su pensión.',
    palabras_clave: ['espera', 'pensión', 'dignidad'],
    adaptaciones: [{ tipo: 'película', titulo: 'El coronel no tiene quien le escriba', anio: 1999 }]
  },
  {
    id_libro: 10,
    isbn: '9789589900109',
    titulo: 'La vorágine',
    categoria: 'Novela colombiana',
    actualizado_en: new Date(),
    sinopsis: 'Arturo Cova huye a los Llanos y termina en la selva de las caucherías.',
    palabras_clave: ['selva', 'caucherías', 'Llanos']
  },
  {
    id_libro: 11,
    isbn: '9789589900116',
    titulo: 'Delirio',
    categoria: 'Novela colombiana',
    actualizado_en: new Date(),
    sinopsis: 'En Bogotá, un hombre intenta entender qué le pasó a su esposa durante cuatro días de ausencia.',
    palabras_clave: ['Bogotá', 'locura', 'familia'],
    premios: [{ nombre: 'Premio Alfaguara de Novela', anio: 2004 }]
  },
  {
    id_libro: 12,
    isbn: '9789589900123',
    titulo: 'El olvido que seremos',
    categoria: 'Novela colombiana',
    actualizado_en: new Date(),
    sinopsis: 'Memoria del autor sobre su padre, médico y defensor de derechos humanos en Medellín.',
    palabras_clave: ['memoria', 'Medellín', 'padre'],
    adaptaciones: [{ tipo: 'película', titulo: 'El olvido que seremos', anio: 2020 }]
  },
  {
    id_libro: 13,
    isbn: '9789589900130',
    titulo: 'Satanás',
    categoria: 'Novela colombiana',
    actualizado_en: new Date(),
    sinopsis: 'Varias historias que se cruzan en Bogotá alrededor de una masacre en un restaurante.',
    palabras_clave: ['Bogotá', 'violencia urbana', 'novela negra'],
    premios: [{ nombre: 'Premio Biblioteca Breve', anio: 2002 }]
  },
  {
    id_libro: 14,
    isbn: '9789589900147',
    titulo: 'Rayuela',
    categoria: 'Narrativa en español',
    actualizado_en: new Date(),
    sinopsis: 'Novela entre París y Buenos Aires que se puede leer en más de un orden.',
    palabras_clave: ['París', 'Buenos Aires', 'lectura no lineal']
  },
  {
    id_libro: 15,
    isbn: '9789589900154',
    titulo: 'Pedro Páramo',
    categoria: 'Narrativa en español',
    actualizado_en: new Date(),
    sinopsis: 'Juan Preciado llega a Comala a buscar a su padre y encuentra un pueblo de voces.',
    palabras_clave: ['Comala', 'muerte', 'México rural']
  },
  {
    id_libro: 16,
    isbn: '9789589900161',
    titulo: 'Ficciones',
    categoria: 'Narrativa en español',
    actualizado_en: new Date(),
    sinopsis: 'Cuentos sobre laberintos, bibliotecas infinitas y mundos inventados.',
    palabras_clave: ['cuento', 'laberintos', 'biblioteca']
  },
  {
    id_libro: 17,
    isbn: '9789589900178',
    titulo: 'Historia mínima de Colombia',
    categoria: 'Historia de Colombia',
    actualizado_en: new Date(),
    sinopsis: 'Síntesis de la historia de Colombia desde antes de la Conquista hasta el siglo XXI.',
    palabras_clave: ['historia', 'Colombia', 'independencia', 'siglo XX']
  },
  {
    id_libro: 18,
    isbn: '9789589900185',
    titulo: 'Cosmos',
    categoria: 'Astronomía y cosmología',
    actualizado_en: new Date(),
    sinopsis: 'Divulgación sobre el universo, la historia de la ciencia y el lugar de la humanidad en el cosmos.',
    palabras_clave: ['universo', 'divulgación científica', 'astronomía'],
    adaptaciones: [{ tipo: 'serie documental', titulo: 'Cosmos', anio: 1980 }]
  },
  {
    id_libro: 19,
    isbn: '9789589900192',
    titulo: 'Breve historia del tiempo',
    categoria: 'Astronomía y cosmología',
    actualizado_en: new Date(),
    sinopsis: 'Explicación para todo público del origen del universo, el tiempo y los agujeros negros.',
    palabras_clave: ['big bang', 'agujeros negros', 'cosmología']
  },
  {
    id_libro: 20,
    isbn: '9789589900208',
    titulo: 'Mafalda',
    categoria: 'Historieta y novela gráfica',
    actualizado_en: new Date(),
    sinopsis: 'Recopilación de las tiras de una niña que pregunta por el mundo y la política.',
    palabras_clave: ['humor gráfico', 'tiras cómicas', 'Argentina']
  },
  {
    id_libro: 21,
    isbn: '9789589900215',
    titulo: 'Persépolis',
    categoria: 'Historieta y novela gráfica',
    actualizado_en: new Date(),
    sinopsis: 'Memorias en viñetas de una infancia y juventud entre Irán y Europa.',
    palabras_clave: ['novela gráfica', 'Irán', 'memorias'],
    adaptaciones: [{ tipo: 'película animada', titulo: 'Persépolis', anio: 2007 }]
  }
]);

// 4.2 Resenas (30): socio y libro de un prestamo DEVUELTO en PostgreSQL.
db.resenas.insertMany([
  {
    id_libro: 1,
    id_socio: 14,
    calificacion: 5,
    titulo: 'Me sirvió para el parcial',
    texto: 'Los ejemplos se pueden correr tal cual y los ejercicios están bien graduados.',
    fecha: ISODate('2026-09-06T17:00:00Z'),
    editada: false,
    votos_utiles: [25, 20, 23],
    respuestas: []
  },
  {
    id_libro: 2,
    id_socio: 3,
    calificacion: 3,
    titulo: 'Le faltan ejemplos actuales',
    texto: 'La teoría está bien, pero algunos ejemplos se sienten antiguos.',
    fecha: ISODate('2026-08-30T08:00:00Z'),
    editada: false,
    votos_utiles: [],
    respuestas: []
  },
  {
    id_libro: 2,
    id_socio: 6,
    calificacion: 5,
    titulo: 'Me sirvió para el parcial',
    texto: 'Los ejemplos se pueden correr tal cual y los ejercicios están bien graduados.',
    fecha: ISODate('2026-10-05T08:00:00Z'),
    editada: false,
    votos_utiles: [23, 15, 11],
    respuestas: []
  },
  {
    id_libro: 4,
    id_socio: 6,
    calificacion: 4,
    titulo: 'Buen libro de consulta',
    texto: 'No lo leí completo, pero lo usé varias veces para resolver dudas puntuales.',
    fecha: ISODate('2026-09-09T20:00:00Z'),
    editada: false,
    votos_utiles: [23, 20, 9],
    respuestas: []
  },
  {
    id_libro: 5,
    id_socio: 18,
    calificacion: 4,
    titulo: 'Buen libro de consulta',
    texto: 'No lo leí completo, pero lo usé varias veces para resolver dudas puntuales.',
    fecha: ISODate('2026-08-17T15:00:00Z'),
    editada: false,
    votos_utiles: [23],
    respuestas: []
  },
  {
    id_libro: 6,
    id_socio: 9,
    calificacion: 5,
    titulo: 'Me sirvió para el parcial',
    texto: 'Los ejemplos se pueden correr tal cual y los ejercicios están bien graduados.',
    fecha: ISODate('2026-09-04T13:00:00Z'),
    editada: false,
    votos_utiles: [19, 9, 25],
    respuestas: []
  },
  {
    id_libro: 6,
    id_socio: 22,
    calificacion: 5,
    titulo: 'Me sirvió para el parcial',
    texto: 'Los ejemplos se pueden correr tal cual y los ejercicios están bien graduados.',
    fecha: ISODate('2026-08-29T16:00:00Z'),
    editada: false,
    votos_utiles: [19, 20, 15],
    respuestas: []
  },
  {
    id_libro: 7,
    id_socio: 13,
    calificacion: 3,
    titulo: 'No era lo que esperaba',
    texto: 'Bien escrito, aunque me costó conectar con los personajes.',
    fecha: ISODate('2026-09-26T17:00:00Z'),
    editada: false,
    votos_utiles: [25],
    respuestas: []
  },
  {
    id_libro: 7,
    id_socio: 26,
    calificacion: 5,
    titulo: 'No lo pude soltar',
    texto: 'Lo terminé en una semana; el final me dejó pensando varios días.',
    fecha: ISODate('2026-09-10T19:00:00Z'),
    editada: false,
    votos_utiles: [19, 11, 25],
    respuestas: []
  },
  {
    id_libro: 8,
    id_socio: 22,
    calificacion: 3,
    titulo: 'No era lo que esperaba',
    texto: 'Bien escrito, aunque me costó conectar con los personajes.',
    fecha: ISODate('2026-08-24T19:00:00Z'),
    editada: false,
    votos_utiles: [20, 19],
    respuestas: []
  },
  {
    id_libro: 9,
    id_socio: 29,
    calificacion: 5,
    titulo: 'Lo releería',
    texto: 'Muchas frases para subrayar; vale la pena leerlo con lápiz en mano.',
    fecha: ISODate('2026-08-26T20:00:00Z'),
    editada: false,
    votos_utiles: [19, 11, 15],
    respuestas: []
  },
  {
    id_libro: 10,
    id_socio: 9,
    calificacion: 4,
    titulo: 'Hay que tenerle paciencia',
    texto: 'El comienzo es lento, pero después agarra un ritmo que engancha.',
    fecha: ISODate('2026-10-04T20:00:00Z'),
    editada: false,
    votos_utiles: [15, 11, 25],
    respuestas: []
  },
  {
    id_libro: 10,
    id_socio: 18,
    calificacion: 3,
    titulo: 'No era lo que esperaba',
    texto: 'Bien escrito, aunque me costó conectar con los personajes.',
    fecha: ISODate('2026-09-06T20:00:00Z'),
    editada: false,
    votos_utiles: [20, 23, 9],
    respuestas: []
  },
  {
    id_libro: 11,
    id_socio: 17,
    calificacion: 5,
    titulo: 'No lo pude soltar',
    texto: 'Lo terminé en una semana; el final me dejó pensando varios días.',
    fecha: ISODate('2026-10-13T19:00:00Z'),
    editada: false,
    votos_utiles: [19, 11],
    respuestas: []
  },
  {
    id_libro: 11,
    id_socio: 26,
    calificacion: 5,
    titulo: 'No lo pude soltar',
    texto: 'Lo terminé en una semana; el final me dejó pensando varios días.',
    fecha: ISODate('2026-09-28T15:00:00Z'),
    editada: false,
    votos_utiles: [9, 11],
    respuestas: []
  },
  {
    id_libro: 12,
    id_socio: 24,
    calificacion: 3,
    titulo: 'No era lo que esperaba',
    texto: 'Bien escrito, aunque me costó conectar con los personajes.',
    fecha: ISODate('2026-08-28T09:00:00Z'),
    editada: false,
    votos_utiles: [],
    respuestas: []
  },
  {
    id_libro: 12,
    id_socio: 26,
    calificacion: 4,
    titulo: 'Recomendado para el club de lectura',
    texto: 'Da para mucha conversación; lo discutimos dos sesiones.',
    fecha: ISODate('2026-08-26T17:00:00Z'),
    editada: false,
    votos_utiles: [11],
    respuestas: []
  },
  {
    id_libro: 12,
    id_socio: 29,
    calificacion: 5,
    titulo: 'No lo pude soltar',
    texto: 'Lo terminé en una semana; el final me dejó pensando varios días.',
    fecha: ISODate('2026-10-08T18:00:00Z'),
    editada: false,
    votos_utiles: [11, 9],
    respuestas: []
  },
  {
    id_libro: 13,
    id_socio: 13,
    calificacion: 4,
    titulo: 'Recomendado para el club de lectura',
    texto: 'Da para mucha conversación; lo discutimos dos sesiones.',
    fecha: ISODate('2026-10-14T19:00:00Z'),
    editada: false,
    votos_utiles: [20],
    respuestas: []
  },
  {
    id_libro: 13,
    id_socio: 28,
    calificacion: 4,
    titulo: 'Recomendado para el club de lectura',
    texto: 'Da para mucha conversación; lo discutimos dos sesiones.',
    fecha: ISODate('2026-09-27T17:00:00Z'),
    editada: false,
    votos_utiles: [9, 19],
    respuestas: []
  },
  {
    id_libro: 14,
    id_socio: 13,
    calificacion: 4,
    titulo: 'Hay que tenerle paciencia',
    texto: 'El comienzo es lento, pero después agarra un ritmo que engancha.',
    fecha: ISODate('2026-10-19T16:00:00Z'),
    editada: false,
    votos_utiles: [19, 11, 20],
    respuestas: []
  },
  {
    id_libro: 15,
    id_socio: 19,
    calificacion: 5,
    titulo: 'No lo pude soltar',
    texto: 'Lo terminé en una semana; el final me dejó pensando varios días.',
    fecha: ISODate('2026-09-15T09:00:00Z'),
    editada: false,
    votos_utiles: [],
    respuestas: []
  },
  {
    id_libro: 16,
    id_socio: 17,
    calificacion: 5,
    titulo: 'No lo pude soltar',
    texto: 'Lo terminé en una semana; el final me dejó pensando varios días.',
    fecha: ISODate('2026-09-10T16:00:00Z'),
    editada: false,
    votos_utiles: [15, 23, 25],
    respuestas: []
  },
  {
    id_libro: 16,
    id_socio: 30,
    calificacion: 5,
    titulo: 'No lo pude soltar',
    texto: 'Lo terminé en una semana; el final me dejó pensando varios días.',
    fecha: ISODate('2026-08-18T15:00:00Z'),
    editada: false,
    votos_utiles: [11],
    respuestas: []
  },
  {
    id_libro: 17,
    id_socio: 6,
    calificacion: 5,
    titulo: 'Explica sin enredar',
    texto: 'Temas difíciles contados con ejemplos cotidianos.',
    fecha: ISODate('2026-09-02T17:00:00Z'),
    editada: false,
    votos_utiles: [19, 20],
    respuestas: []
  },
  {
    id_libro: 17,
    id_socio: 24,
    calificacion: 5,
    titulo: 'Explica sin enredar',
    texto: 'Temas difíciles contados con ejemplos cotidianos.',
    fecha: ISODate('2026-09-13T08:00:00Z'),
    editada: false,
    votos_utiles: [23],
    respuestas: []
  },
  {
    id_libro: 18,
    id_socio: 13,
    calificacion: 5,
    titulo: 'Explica sin enredar',
    texto: 'Temas difíciles contados con ejemplos cotidianos.',
    fecha: ISODate('2026-09-23T21:00:00Z'),
    editada: false,
    votos_utiles: [19],
    respuestas: []
  },
  {
    id_libro: 20,
    id_socio: 14,
    calificacion: 5,
    titulo: 'Se lee en una tarde',
    texto: 'Las viñetas dicen mucho con poco; ideal para empezar con novela gráfica.',
    fecha: ISODate('2026-10-14T10:00:00Z'),
    editada: false,
    votos_utiles: [19],
    respuestas: []
  },
  {
    id_libro: 20,
    id_socio: 19,
    calificacion: 4,
    titulo: 'Divertido y actual',
    texto: 'Algunas tiras parecen escritas esta semana.',
    fecha: ISODate('2026-09-09T14:00:00Z'),
    editada: false,
    votos_utiles: [11, 15],
    respuestas: []
  },
  {
    id_libro: 21,
    id_socio: 32,
    calificacion: 4,
    titulo: 'Divertido y actual',
    texto: 'Algunas tiras parecen escritas esta semana.',
    fecha: ISODate('2026-10-15T20:00:00Z'),
    editada: false,
    votos_utiles: [15, 19, 11],
    respuestas: []
  }
]);

// 4.3 Busquedas (90): [termino, resultados, hace cuantos dias, minutos, sede, canal].
// Las de 0 resultados alimentan "Buscados sin resultado".
var busquedas = [
  ['mafalda', 1, 33, 493, 4, 'MOSTRADOR'],
  ['cálculo diferencial', 0, 50, 537, 3, 'MOSTRADOR'],
  ['cosmos', 1, 14, 5, 1, 'WEB'],
  ['mafalda', 1, 26, 558, 2, 'MOSTRADOR'],
  ['la vorágine', 1, 54, 160, 3, 'KIOSCO'],
  ['sistemas operativos', 0, 50, 551, 2, 'MOSTRADOR'],
  ['persépolis', 1, 35, 769, 2, 'KIOSCO'],
  ['rulfo', 1, 36, 274, 2, 'MOSTRADOR'],
  ['persépolis', 1, 6, 446, 2, 'MOSTRADOR'],
  ['bases de datos', 2, 48, 364, 2, 'KIOSCO'],
  ['cien años', 1, 32, 321, 3, 'KIOSCO'],
  ['sql', 2, 18, 322, 2, 'WEB'],
  ['persépolis', 1, 4, 14, 4, 'WEB'],
  ['álgebra lineal', 0, 0, 58, 1, 'MOSTRADOR'],
  ['garcía márquez', 3, 19, 125, 1, 'KIOSCO'],
  ['isabel allende', 0, 36, 878, 3, 'WEB'],
  ['redes de computadores', 0, 38, 640, 1, 'WEB'],
  ['mafalda', 1, 38, 220, 4, 'WEB'],
  ['cien años', 1, 43, 383, 3, 'WEB'],
  ['rulfo', 1, 52, 364, 1, 'KIOSCO'],
  ['álgebra lineal', 0, 1, 288, 3, 'WEB'],
  ['cien años', 1, 19, 786, 4, 'WEB'],
  ['sistemas operativos', 0, 1, 555, 3, 'MOSTRADOR'],
  ['isabel allende', 0, 3, 738, 1, 'MOSTRADOR'],
  ['cien años', 1, 7, 38, 2, 'KIOSCO'],
  ['la vorágine', 1, 38, 663, 3, 'MOSTRADOR'],
  ['álgebra lineal', 0, 37, 129, 3, 'WEB'],
  ['estructuras de datos', 0, 24, 245, 4, 'KIOSCO'],
  ['estadística', 1, 49, 128, 2, 'KIOSCO'],
  ['garcía márquez', 3, 42, 734, 4, 'WEB'],
  ['java', 1, 14, 23, 1, 'WEB'],
  ['isabel allende', 0, 30, 427, 3, 'WEB'],
  ['java', 1, 40, 607, 1, 'MOSTRADOR'],
  ['isabel allende', 0, 2, 665, 3, 'WEB'],
  ['cálculo diferencial', 0, 48, 760, 3, 'MOSTRADOR'],
  ['garcía márquez', 3, 40, 248, 4, 'MOSTRADOR'],
  ['estadística', 1, 43, 520, 2, 'KIOSCO'],
  ['estructuras de datos', 0, 45, 368, 2, 'KIOSCO'],
  ['persépolis', 1, 21, 881, 2, 'WEB'],
  ['la vorágine', 1, 29, 652, 4, 'KIOSCO'],
  ['python', 0, 50, 689, 3, 'MOSTRADOR'],
  ['cortázar', 1, 40, 420, 2, 'WEB'],
  ['garcía márquez', 3, 22, 833, 4, 'MOSTRADOR'],
  ['cortázar', 1, 5, 306, 3, 'KIOSCO'],
  ['persépolis', 1, 8, 731, 1, 'MOSTRADOR'],
  ['isabel allende', 0, 13, 870, 3, 'KIOSCO'],
  ['bases de datos', 2, 25, 389, 2, 'KIOSCO'],
  ['cien años', 1, 5, 145, 4, 'WEB'],
  ['isabel allende', 0, 16, 317, 1, 'KIOSCO'],
  ['sistemas operativos', 0, 42, 806, 2, 'MOSTRADOR'],
  ['rulfo', 1, 18, 554, 3, 'WEB'],
  ['java', 1, 24, 193, 1, 'KIOSCO'],
  ['python', 0, 27, 364, 2, 'KIOSCO'],
  ['cálculo diferencial', 0, 1, 183, 3, 'KIOSCO'],
  ['java', 1, 10, 29, 1, 'KIOSCO'],
  ['garcía márquez', 3, 53, 383, 1, 'WEB'],
  ['rulfo', 1, 13, 544, 2, 'KIOSCO'],
  ['estadística', 1, 8, 108, 3, 'WEB'],
  ['cien años', 1, 55, 857, 1, 'WEB'],
  ['persépolis', 1, 39, 308, 1, 'WEB'],
  ['python', 0, 31, 123, 2, 'WEB'],
  ['redes de computadores', 0, 37, 353, 1, 'MOSTRADOR'],
  ['sql', 2, 51, 506, 3, 'WEB'],
  ['estadística', 1, 10, 332, 4, 'KIOSCO'],
  ['isabel allende', 0, 21, 330, 4, 'WEB'],
  ['mafalda', 1, 11, 201, 4, 'MOSTRADOR'],
  ['la vorágine', 1, 48, 806, 3, 'WEB'],
  ['sistemas operativos', 0, 24, 217, 2, 'WEB'],
  ['sistemas operativos', 0, 42, 753, 2, 'WEB'],
  ['persépolis', 1, 21, 855, 1, 'WEB'],
  ['persépolis', 1, 53, 887, 4, 'WEB'],
  ['java', 1, 34, 641, 3, 'MOSTRADOR'],
  ['mafalda', 1, 9, 574, 1, 'WEB'],
  ['rulfo', 1, 36, 469, 4, 'WEB'],
  ['garcía márquez', 3, 35, 733, 3, 'KIOSCO'],
  ['álgebra lineal', 0, 21, 97, 4, 'KIOSCO'],
  ['isabel allende', 0, 33, 214, 4, 'WEB'],
  ['mafalda', 1, 3, 409, 2, 'MOSTRADOR'],
  ['persépolis', 1, 35, 718, 3, 'MOSTRADOR'],
  ['mafalda', 1, 37, 659, 4, 'WEB'],
  ['python', 0, 21, 12, 1, 'MOSTRADOR'],
  ['cien años', 1, 42, 872, 3, 'WEB'],
  ['garcía márquez', 3, 49, 214, 4, 'KIOSCO'],
  ['persépolis', 1, 39, 645, 3, 'MOSTRADOR'],
  ['isabel allende', 0, 44, 192, 1, 'MOSTRADOR'],
  ['java', 1, 21, 224, 4, 'MOSTRADOR'],
  ['cortázar', 1, 45, 316, 1, 'KIOSCO'],
  ['álgebra lineal', 0, 45, 534, 2, 'MOSTRADOR'],
  ['garcía márquez', 3, 17, 429, 1, 'MOSTRADOR'],
  ['isabel allende', 0, 46, 525, 2, 'WEB']
];
db.busquedas.insertMany(busquedas.map(function (b) {
  return {
    fecha: haceDias(b[2], b[3]),
    termino: b[0],
    filtros: {},
    total_resultados: b[1],
    sede: b[4],
    canal: b[5],
    usuario: null
  };
}));

// 4.4 Listas de lectura (5).
db.listas_lectura.insertMany([
  {
    id_socio: 9,
    nombre: 'Para el parcial de Bases de Datos 2',
    publica: false,
    creada: haceDias(31, 0),
    libros: [
      {
        id_libro: 1,
        titulo: 'Fundamentos de bases de datos',
        agregado: haceDias(31, 0),
        leido: true
      },
      { id_libro: 3, titulo: 'SQL Cookbook', agregado: haceDias(30, 0), leido: false },
      {
        id_libro: 2,
        titulo: 'Fundamentos de sistemas de bases de datos',
        agregado: haceDias(29, 0),
        leido: false
      }
    ]
  },
  {
    id_socio: 13,
    nombre: 'Novela colombiana para el club',
    publica: true,
    creada: haceDias(31, 0),
    libros: [
      { id_libro: 7, titulo: 'Cien años de soledad', agregado: haceDias(31, 0), leido: true },
      { id_libro: 10, titulo: 'La vorágine', agregado: haceDias(30, 0), leido: false },
      { id_libro: 11, titulo: 'Delirio', agregado: haceDias(29, 0), leido: false },
      { id_libro: 12, titulo: 'El olvido que seremos', agregado: haceDias(28, 0), leido: false }
    ]
  },
  {
    id_socio: 20,
    nombre: 'Pendientes de vacaciones',
    publica: false,
    creada: haceDias(32, 0),
    libros: [
      { id_libro: 14, titulo: 'Rayuela', agregado: haceDias(32, 0), leido: true },
      { id_libro: 16, titulo: 'Ficciones', agregado: haceDias(31, 0), leido: false },
      { id_libro: 21, titulo: 'Persépolis', agregado: haceDias(30, 0), leido: false }
    ]
  },
  {
    id_socio: 22,
    nombre: 'Bibliografía del semestre',
    publica: true,
    creada: haceDias(30, 0),
    libros: [
      {
        id_libro: 1,
        titulo: 'Fundamentos de bases de datos',
        agregado: haceDias(30, 0),
        leido: true
      },
      {
        id_libro: 6,
        titulo: 'Estadística para administración y economía',
        agregado: haceDias(29, 0),
        leido: false
      },
      { id_libro: 5, titulo: 'Código limpio', agregado: haceDias(28, 0), leido: false }
    ]
  },
  {
    id_socio: 27,
    nombre: 'Divulgación para el colegio',
    publica: true,
    creada: haceDias(48, 0),
    libros: [
      { id_libro: 18, titulo: 'Cosmos', agregado: haceDias(48, 0), leido: true },
      {
        id_libro: 19,
        titulo: 'Breve historia del tiempo',
        agregado: haceDias(47, 0),
        leido: false
      }
    ]
  }
]);

// ====================================================================================
// 5. PRUEBA DE FUNCIONAMIENTO (CONSULTAS QUE USA LA API)
// ====================================================================================
// Todas se ejecutan y muestran su resultado. La 5.9 crea, edita y borra una
// resena de prueba, asi que los datos quedan como estaban.
var hace60Dias = new Date(Date.now() - 60 * 86400000);

// 5.1 Busqueda de texto del catalogo (indice ix_fichas_texto). La API la
//     combina con la busqueda por titulo, autor e ISBN de PostgreSQL.
print('5.1 Fichas que coinciden con "realismo"');
printjson(db.fichas_bibliograficas.find(
  { $text: { $search: 'realismo' } },
  { _id: 0, id_libro: 1, titulo: 1 }
).toArray());

// 5.2 Ficha de un libro (detalle del libro).
print('5.2 Ficha del libro 7');
printjson(db.fichas_bibliograficas.findOne({ id_libro: 7 }, { _id: 0 }));

// 5.3 Resenas de un libro, las mas recientes primero, y su promedio.
print('5.3 Resenas del libro 7 y su calificacion promedio');
printjson(db.resenas.find({ id_libro: 7 }).sort({ fecha: -1 }).toArray());
printjson(db.resenas.aggregate([
  { $match: { id_libro: 7 } },
  { $group: { _id: '$id_libro', promedio: { $avg: '$calificacion' }, total: { $sum: 1 } } }
]).toArray());

// 5.4 Mejor calificados: libros con dos resenas o mas, con el titulo y la
//     categoria que se traen de la ficha ($lookup).
print('5.4 Mejor calificados');
printjson(db.resenas.aggregate([
  { $group: { _id: '$id_libro', promedio: { $avg: '$calificacion' }, total: { $sum: 1 } } },
  { $match: { total: { $gte: 2 } } },
  { $sort: { promedio: -1, total: -1 } },
  { $limit: 8 },
  { $lookup: { from: 'fichas_bibliograficas', localField: '_id', foreignField: 'id_libro', as: 'ficha' } },
  { $unwind: '$ficha' },
  { $project: { _id: 0, id_libro: '$_id', titulo: '$ficha.titulo', categoria: '$ficha.categoria',
                promedio: { $round: ['$promedio', 2] }, total: 1 } }
]).toArray());

// 5.5 Resenas por categoria.
print('5.5 Resenas por categoria');
printjson(db.resenas.aggregate([
  { $lookup: { from: 'fichas_bibliograficas', localField: 'id_libro', foreignField: 'id_libro', as: 'ficha' } },
  { $unwind: '$ficha' },
  { $group: { _id: '$ficha.categoria', promedio: { $avg: '$calificacion' }, total: { $sum: 1 } } },
  { $sort: { total: -1 } },
  { $project: { _id: 0, categoria: '$_id', promedio: { $round: ['$promedio', 2] }, total: 1 } }
]).toArray());

// 5.6 Terminos mas buscados en los ultimos 60 dias y cuantas veces
//     encontraron algo ($cond).
print('5.6 Terminos mas buscados');
printjson(db.busquedas.aggregate([
  { $match: { fecha: { $gte: hace60Dias } } },
  { $group: { _id: { $toLower: '$termino' }, veces: { $sum: 1 },
              con_resultado: { $sum: { $cond: [{ $gt: ['$total_resultados', 0] }, 1, 0] } } } },
  { $sort: { veces: -1, _id: 1 } },
  { $limit: 10 },
  { $project: { _id: 0, termino: '$_id', veces: 1, con_resultado: 1 } }
]).toArray());

// 5.7 Busquedas sin resultado en los ultimos 60 dias y en que sedes se
//     hicieron ($addToSet): sirve para decidir que libros comprar.
print('5.7 Busquedas sin resultado');
printjson(db.busquedas.aggregate([
  { $match: { total_resultados: 0, fecha: { $gte: hace60Dias } } },
  { $group: { _id: { $toLower: '$termino' }, veces: { $sum: 1 }, sedes: { $addToSet: '$sede' } } },
  { $sort: { veces: -1, _id: 1 } },
  { $limit: 10 },
  { $project: { _id: 0, termino: '$_id', veces: 1, sedes: 1 } }
]).toArray());

// 5.8 Listas de lectura de un socio (detalle del socio).
print('5.8 Listas de lectura del socio 13');
printjson(db.listas_lectura.find({ id_socio: 13 }).sort({ creada: -1 }).toArray());

// 5.9 CRUD de una resena (lo que hace la API al crear, editar y borrar).
//     El socio 19 devolvio el libro 1 en PostgreSQL y no lo ha resenado; la
//     API revisa eso en PostgreSQL antes de escribir.
print('5.9 CRUD de una resena');
var idResena = db.resenas.insertOne({
  id_libro: 1, id_socio: 19, calificacion: 4, titulo: 'Util para el parcial',
  texto: 'Lo consulte para el taller de normalizacion.', fecha: new Date(),
  editada: false, votos_utiles: [], respuestas: []
}).insertedId;
print('Creada:');
printjson(db.resenas.findOne({ _id: idResena }, { _id: 0, id_libro: 1, id_socio: 1, calificacion: 1, editada: 1 }));
db.resenas.updateOne({ _id: idResena }, { $set: { calificacion: 5, editada: true, fecha_edicion: new Date() } });
print('Editada:');
printjson(db.resenas.findOne({ _id: idResena }, { _id: 0, id_libro: 1, id_socio: 1, calificacion: 1, editada: 1 }));
db.resenas.deleteOne({ _id: idResena });
print('Borrada: quedan ' + db.resenas.countDocuments({ _id: idResena }) + ' documentos con ese _id');

// Rechazos esperados: el esquema y el indice unico no dejan guardar estas
// dos. El try/catch muestra el error sin detener el script.
try {
  db.resenas.insertOne({ id_libro: 1, id_socio: 19, calificacion: 7, fecha: new Date() });
  print('No se esperaba: se guardo una calificacion de 7');
} catch (e) {
  print('Rechazada, la calificacion va de 1 a 5: ' + e.message);
}
try {
  db.resenas.insertOne({ id_libro: 7, id_socio: 13, calificacion: 4, fecha: new Date() });
  print('No se esperaba: se guardo una resena repetida');
} catch (e) {
  print('Rechazada, el socio 13 ya reseno el libro 7: ' + e.message);
}

// 5.10 Documentos por coleccion.
print('5.10 Documentos por coleccion');
printjson({
  fichas_bibliograficas: db.fichas_bibliograficas.countDocuments({}),
  resenas: db.resenas.countDocuments({}),
  busquedas: db.busquedas.countDocuments({}),
  listas_lectura: db.listas_lectura.countDocuments({})
});
