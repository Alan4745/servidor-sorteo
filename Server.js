require("dotenv").config();
const port = process.env.PORT || 3000;
const http = require("http");
const app = require("./App");
const mysql = require("mysql2/promise");

const connectDB = async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Intentar obtener una conexión del pool para verificar que la conexión es exitosa
    const connection = await pool.getConnection();
    connection.release();

    console.log("La Base De Datos está conectada");
    global.db = pool;
  } catch (error) {
    console.error("Error al conectar con la base de datos:", error.message);
    process.exit(1);
  }
};

const server = http.createServer(app);

connectDB()
  .then(() => {
    server.listen(port, () => {
      console.log(`El Servidor está corriendo en el puerto: ${port}`);
    });
  })
  .catch((error) => {
    console.error("Error al iniciar el servidor:", error.message);
    process.exit(1);
  });
