// Importar las variables de entorno del archivo .env
require("dotenv").config();

// Asignación del puerto de comunicación que se encuentra en el archivo .env
const port = process.env.PORT || 3000;

// Importar el módulo http
const http = require("http");

// Importar el servidor creado con express
const app = require("./App");

// Importar Mongoose para la conexión a la base de datos MongoDB
const mongoose = require("mongoose");

// Configurar la conexión a la base de datos
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("La Base De Datos está conectada");
  } catch (error) {
    console.error("Error al conectar con la base de datos:", error.message);
    process.exit(1);
  }
};

// Crear el servidor http con express
const server = http.createServer(app);

// Conectar a la base de datos y una vez conectado, levantar el servidor
connectDB().then(() => {
  server.listen(port, () => {
    console.log(`El Servidor está corriendo en el puerto: ${port}`);
  });
});
