const express = require("express"); // Framework para construir aplicaciones web
const morgan = require("morgan"); //Middleware que registra los detalles de las solicitudes HTTP
const cors = require("cors"); // Middleware que ayuda a configurar la politica de mismo origen en la aplicacion
const app = express();

const codesRouter = require("./src/routes/codes.routes");

// Configura los middlewares de la aplicacion
app.use(express.urlencoded({ extended: false })); // Middleware que analiza los datos de la solicitud HTTP y los pone en un objeto req.body
app.use(express.json()); // Middleware que analiza los datos de la solicitud HTTP en formato JSON y los pone en un objeto req.body

app.use(cors()); //Middleware que permiten el acceso a la API desde cualquier origen
app.use(morgan("dev")); // morgan nos muestra en consola que peticiones estan entrantes a la API

app.use("/api", codesRouter);

module.exports = app;
