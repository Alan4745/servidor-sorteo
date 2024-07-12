const express = require("express");
const controllerCodes = require("./../controllers/codes.controller");

const api = express.Router();

// api.get("/Test", (req, res) => {
//   res.send("Hola Mundo desde Express!");
// });

// api.post("/generarCodigos", controllerCodes.crearTickets);

api.get("/random-code", controllerCodes.getRandomCode);

api.get("/random-codeV2", controllerCodes.getRandomCodeV2);

api.put("/redeemCode/:codigo", controllerCodes.redeemCodeByCodigo);

api.post("/buscarPorIdentificacion", controllerCodes.buscarPorIdentificacion);

api.get(
  "/codeCashing/:documentoIdentificacion",
  controllerCodes.findByPersonalDocument
);

module.exports = api;
