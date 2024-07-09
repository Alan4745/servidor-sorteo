const crypto = require("crypto-js");
const moment = require("moment-timezone");
const nodemailer = require("nodemailer");
require("dotenv").config();

const secretKey = process.env.ENCRYPTION_KEY;

function descifrarDato(datoCifrado) {
  const bytes = crypto.AES.decrypt(datoCifrado, secretKey);
  return bytes.toString(crypto.enc.Utf8);
}

function cifrarDato(dato) {
  return crypto.AES.encrypt(dato, secretKey).toString();
}

const buscarPorIdentificacion = async (req, res) => {
  try {
    const { documentoIdentificacion } = req.body;
    const connection = await global.db.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT * FROM codes WHERE documentoIdentificacion = ?",
        [documentoIdentificacion]
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ message: "Identificación no encontrada" });
      }

      res.status(200).json(rows);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al buscar por identificación" });
  }
};

// Configurar nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Función para enviar correos electrónicos
const sendEmail = async (req, res) => {
  const { to, subject, text } = req.body;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
    });
    console.log(`Correo enviado a ${to}`);
    res.status(200).json({ message: `Correo enviado a ${to}` });
  } catch (error) {
    console.error("Error al enviar el correo:", error.message);
    res
      .status(500)
      .json({ message: "Error al enviar el correo", error: error.message });
  }
};

const getRandomCode = async (req, res) => {
  try {
    const [rows] = await global.db.execute(
      "SELECT * FROM codes ORDER BY RAND() LIMIT 1"
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No se encontraron códigos" });
    }

    // Enviar correo electrónico con el código aleatorio
    const code = rows[0];
    await sendEmail(
      code.correoElectronico,
      "Tu Código Aleatorio",
      `Tu código es: ${code.codigo}`
    );

    res.status(200).json(code);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el código" });
  }
};

const getRandomCodeV2 = async (req, res) => {
  try {
    const query = `
      SELECT codigo, pais, nombre, apellidos, fechaNacimiento, documentoIdentificacion, telefono, correoElectronico 
      FROM codes 
      WHERE documentoIdentificacion != '' 
      AND pais != '' 
      AND nombre != '' 
      AND apellidos != '' 
      AND fechaNacimiento IS NOT NULL 
      AND telefono != '' 
      AND correoElectronico != '' 
      ORDER BY RAND() LIMIT 1
    `;

    const [rows] = await global.db.execute(query);

    if (rows.length === 0) {
      return res.status(404).json({ message: "No se encontraron códigos" });
    }

    const code = rows[0];

    // Enviar correo electrónico con el código aleatorio
    await sendEmail(
      code.correoElectronico,
      "Tu Código Aleatorio",
      `Tu código es: ${code.codigo}`
    );

    res.status(200).json(code);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el código" });
  }
};

function calcularEdad(fechaNacimiento) {
  const fechaActual = new Date();
  const fechaNacimientoObj = new Date(fechaNacimiento);
  let edad = fechaActual.getFullYear() - fechaNacimientoObj.getFullYear();

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
      telefono_pais,
      telefono,
      correoElectronico,
    } = req.body;

    const edadCalculada = calcularEdad(fechaNacimiento);

    if (edadCalculada < 18) {
      return res.status(400).json({
        message: "Debe ser mayor de 18 años para registrar el código",
      });
    }

    const telefonoCompleto = telefono_pais + telefono;

    console.log(telefonoCompleto);

    const connection = await global.db.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT * FROM codes WHERE codigo = ? FOR UPDATE",
        [codigo]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Código no encontrado" });
      }

      const code = rows[0];

      if (code.estadoCanjeado) {
        return res
          .status(400)
          .json({ message: "El código ya ha sido canjeado" });
      }

      const updateQuery = `
        UPDATE codes 
        SET edad = ?, pais = ?, nombre = ?, apellidos = ?, fechaNacimiento = ?, 
            documentoIdentificacion = ?, telefono = ?, correoElectronico = ?, 
            fechaCajeado = ?, estadoCanjeado = true 
        WHERE codigo = ?
      `;

      const fechaCajeado = moment.tz("America/Guatemala").toDate();

      await connection.execute(updateQuery, [
        edadCalculada,
        pais,
        nombre,
        apellidos,
        fechaNacimiento,
        documentoIdentificacion,
        telefonoCompleto,
        correoElectronico,
        fechaCajeado,
        codigo,
      ]);

      const [updatedRows] = await connection.execute(
        "SELECT * FROM codes WHERE codigo = ?",
        [codigo]
      );

      res.status(200).json(updatedRows[0]);
    } finally {
      connection.release(); // Liberar la conexión al pool
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al buscar o actualizar el código" });
  }
};

const findByPersonalDocument = async (req, res) => {
  try {
    const { documentoIdentificacion } = req.params;

    if (!documentoIdentificacion) {
      return res
        .status(400)
        .json({ message: "El documento de identificación es requerido" });
    }

    const [rows] = await global.db.execute(
      "SELECT * FROM codes WHERE documentoIdentificacion = ?",
      [documentoIdentificacion]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message:
          "No se encontraron documentos con ese documento de identificación",
      });
    }

    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message:
        "Error al buscar los documentos por el documento de identificación",
    });
  }
};

module.exports = {
  getRandomCode,
  getRandomCodeV2,
  getCodeByCodigo,
  findByPersonalDocument,
  buscarPorIdentificacion,
  sendEmail, // Exportar la función para enviar correos
};
