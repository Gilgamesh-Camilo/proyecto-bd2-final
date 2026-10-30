// database/nosql/01_mongo_setup.js

db.createCollection("eventos_sistema", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["tipo_evento", "usuario", "timestamp", "payload"],
      properties: {
        tipo_evento: { 
          bsonType: "string",
          description: "Tipo de evento operacional registrado"
        },
        usuario: { 
          bsonType: "string",
          description: "Usuario o servicio ejecutor"
        },
        timestamp: { 
          bsonType: "date",
          description: "Fecha y hora UTC del suceso"
        },
        payload: { 
          bsonType: "object",
          description: "Detalle JSON del evento"
        }
      }
    }
  }
});

// Creación de índices
db.eventos_sistema.createIndex({ "tipo_evento": 1 });
db.eventos_sistema.createIndex({ "timestamp": -1 });

// Documento semilla inicial
db.eventos_sistema.insertOne({
  tipo_evento: "SISTEMA_INICIALIZADO",
  usuario: "admin",
  timestamp: new Date(),
  payload: { entorno: "desarrollo", version: "1.0.0" }
});