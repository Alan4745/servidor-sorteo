const mongoose = require("mongoose");

// Definir el esquema del modelo "Code"
const codeSchema = new mongoose.Schema({
  codigo: {
    type: String,
    required: true,
  },
  edad: {
    type: Number,
    default: 0,
  },
  pais: {
    type: String,
    default: "",
  },
  nombre: {
    type: String,
    default: "",
  },
  apellidos: {
    type: String,
    default: "",
  },
  fechaNacimiento: {
    type: Date,
    default: "",
  },
  documentoIdentificacion: {
    type: String,
    default: "",
  },
  telefono: {
    type: String,
    default: "",
  },
  correoElectronico: {
    type: String,
    default: "",
  },
  fechaCreacion: {
    type: Date,
    default: Date.now,
  },
  fechaCajeado: {
    type: Date,
    default: null,
  },
  estadoCanjeado: {
    type: Boolean,
    default: false,
  },
});

// Crear el modelo "Code" a partir del esquema
const Code = mongoose.model("Code", codeSchema);

module.exports = Code;
