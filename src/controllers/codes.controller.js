const Code = require("./../Models/Codes.model");
const crypto = require("crypto");
const moment = require("moment-timezone");

// Función para generar un código aleatorio alfanumérico de longitud especificada
// Función para generar un código aleatorio alfanumérico de longitud especificada
function generarCodigo(longitud) {
  const caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let codigo = "";
  for (let i = 0; i < longitud; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
}

// Función para cifrar datos usando AES
function cifrarDato(dato) {
  const algorithm = "aes-256-cbc";
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(dato, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

// Función para desencriptar datos usando AES
function desencriptarDato(dato) {
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(dato, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Controlador para crear tickets con códigos generados y cifrados usando AES
async function crearTickets(req, res) {
  try {
    const cantidadTickets = 1142671;
    let ticketsIngresados = 0; // Contador para llevar el seguimiento de los tickets ingresados

    for (let i = 0; i < cantidadTickets; i++) {
      const codigo = generarCodigo(8);
      const nuevoTicket = new Code({
        codigo,
        edad: 0,
        pais: "",
        nombre: "",
        apellidos: "",
        fechaNacimiento: null,
        documentoIdentificacion: "",
        telefono: "",
        correoElectronico: "",
        fechaCreacion: moment.tz("America/Guatemala").toDate(),
        fechaCajeado: null,
        estadoCanjeado: false,
      });

      // Guardar el ticket en la base de datos
      await nuevoTicket.save();

      // Incrementar el contador de tickets ingresados
      ticketsIngresados++;

      // Imprimir mensaje de progreso
      console.log(`Progreso: ${ticketsIngresados}/${cantidadTickets}`);
    }

    res.json({ message: `${cantidadTickets} tickets creados exitosamente.` });
  } catch (error) {
    console.error("Error al crear tickets:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

const getRandomCode = async (req, res) => {
  try {
    // Usar la agregación para obtener un documento al azar
    const randomCode = await Code.aggregate([{ $sample: { size: 1 } }]);

    if (randomCode.length === 0) {
      return res.status(404).json({ message: "No se encontraron códigos" });
    }

    // Devolver el documento al azar
    res.status(200).json(randomCode[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el código" });
  }
};

const getRandomCodeV2 = async (req, res) => {
  try {
    // Usar la agregación para filtrar documentos con los campos llenos y obtener uno al azar
    const randomCode = await Code.aggregate([
      {
        $match: {
          documentoIdentificacion: { $ne: "", $exists: true },
          pais: { $ne: "", $exists: true },
          nombre: { $ne: "", $exists: true },
          apellidos: { $ne: "", $exists: true },
          fechaNacimiento: { $ne: null, $exists: true },
          telefono: { $ne: "", $exists: true },
          correoElectronico: { $ne: "", $exists: true },
        },
      },
      { $sample: { size: 1 } },
      {
        $project: {
          codigo: 1,
          pais: 1,
          nombre: 1,
          apellidos: 1,
          fechaNacimiento: 1,
          documentoIdentificacion: 1,
          telefono: 1,
          correoElectronico: 1,
        },
      },
    ]);

    if (randomCode.length === 0) {
      return res.status(404).json({ message: "No se encontraron códigos" });
    }

    // Devolver el documento al azar
    res.status(200).json(randomCode[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el código" });
  }
};

function calcularEdad(fechaNacimiento) {
  const fechaActual = new Date();
  const fechaNacimientoObj = new Date(fechaNacimiento);

  let edad = fechaActual.getFullYear() - fechaNacimientoObj.getFullYear();

  // Ajustar la edad si aún no se ha cumplido el día de nacimiento de este año
  if (
    fechaActual <
    new Date(
      fechaActual.getFullYear(),
      fechaNacimientoObj.getMonth(),
      fechaNacimientoObj.getDate()
    )
  ) {
    edad--;
  }

  return edad;
}

const getCodeByCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const {
      pais,
      nombre,
      apellidos,
      fechaNacimiento,
      documentoIdentificacion,
      telefono,
      correoElectronico,
    } = req.body;

    // Calcular la edad a partir de la fecha de nacimiento
    const edadCalculada = calcularEdad(fechaNacimiento);

    // Validar la edad del usuario
    if (edadCalculada < 18) {
      return res.status(400).json({
        message: "Debe ser mayor de 18 años para registrar el código",
      });
    }

    // Validar el campo documentoIdentificacion
    if (!/^\d{13}$/.test(documentoIdentificacion)) {
      return res.status(400).json({
        message:
          "El documento de identificación debe contener solo números y tener una longitud de 13 caracteres",
      });
    }

    // Buscar el documento por el código
    let code = await Code.findOne({ codigo });

    if (!code) {
      return res.status(404).json({ message: "Código no encontrado" });
    }

    // Validar si el código ya ha sido canjeado
    if (code.estadoCanjeado) {
      return res.status(400).json({ message: "El código ya ha sido canjeado" });
    }

    // Actualizar los campos del documento
    code.edad = edadCalculada;
    if (pais) code.pais = pais;
    if (nombre) code.nombre = nombre;
    if (apellidos) code.apellidos = apellidos;
    if (fechaNacimiento) code.fechaNacimiento = fechaNacimiento;
    if (documentoIdentificacion)
      code.documentoIdentificacion = documentoIdentificacion;
    if (telefono) code.telefono = telefono;
    if (correoElectronico) code.correoElectronico = correoElectronico;
    code.fechaCajeado = moment.tz("America/Guatemala").toDate();
    code.estadoCanjeado = true;

    // Guardar el documento actualizado en la base de datos
    code = await code.save();

    // Devolver el documento actualizado
    res.status(200).json(code);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al buscar o actualizar el código" });
  }
};

const findByPersonalDocument = async (req, res) => {
  try {
    const { documentoIdentificacion } = req.params;

    // Verificar si el documento de identificación está presente en la solicitud
    if (!documentoIdentificacion) {
      return res
        .status(400)
        .json({ message: "El documento de identificación es requerido" });
    }

    // Buscar documentos por el campo documentoIdentificacion
    const codes = await Code.find({
      documentoIdentificacion: documentoIdentificacion,
    });

    if (codes.length === 0) {
      return res.status(404).json({
        message:
          "No se encontraron documentos con ese documento de identificación",
      });
    }

    // Devolver los documentos encontrados
    res.status(200).json(codes);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message:
        "Error al buscar los documentos por el documento de identificación",
    });
  }
};

module.exports = {
  crearTickets,
  getRandomCode,
  getRandomCodeV2,
  getCodeByCodigo,
  findByPersonalDocument,
};
