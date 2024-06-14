const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const app = express();

const codesRouter = require("./src/routes/codes.routes");

// Configura los middlewares de la aplicación
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(cors());
app.use(morgan("dev"));

// Define las rutas de la aplicación
app.use("/api", codesRouter);

// Middleware para manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ error: "Something went wrong!" });
});

module.exports = app;
