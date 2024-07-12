const moment = require("moment-timezone");
const nodemailer = require("nodemailer");
require("dotenv").config();
const path = require("path");
const fs = require("fs");

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

const getRandomReward = () => {
  const rewards = ["Premio 1", "Premio 2", "Premio 3"];
  const randomIndex = Math.floor(Math.random() * rewards.length);
  return rewards[randomIndex];
};

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

// Función para enviar correos electrónicos
const sendEmail = async (to, subject, text, code) => {
  try {
    // Ajusta la ruta aquí
    const emailTemplatePath = path.join(
      __dirname,
      "..",
      "template",
      "emailTemplate.html"
    );
    let emailTemplate = fs.readFileSync(emailTemplatePath, "utf8");

    // Reemplazar las variables en la plantilla
    emailTemplate = emailTemplate.replace(
      "{{subject}}",
      `${code} - ${subject}`
    );
    emailTemplate = emailTemplate.replace("{{text}}", text);

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: `${code} - ${subject}`,
      html: emailTemplate,
    });
    console.log(`Correo enviado a ${to}`);
  } catch (error) {
    console.error("Error al enviar el correo:", error.message);
    throw new Error("Error al enviar el correo");
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
      `Tu código es: ${code.codigo}`,
      `${code.codigo}`
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

const redeemCodeByCodigo = async (req, res) => {
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
      // Convertir ambos el código en la base de datos y el proporcionado a minúsculas para la comparación
      const [rows] = await connection.execute(
        "SELECT * FROM codes WHERE LOWER(codigo) = LOWER(?) FOR UPDATE",
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
        code.codigo, // No olvides usar el código original para actualizar
      ]);

      // Contar los registros en cashingCodes
      const [countRows] = await connection.execute(
        "SELECT COUNT(*) AS count FROM cashingCodes"
      );
      const { count } = countRows[0];

      let reward = "Sin premio";

      // Si el nuevo registro es múltiplo de 5, asignar un premio
      if ((count + 1) % 5 === 0) {
        reward = getRandomReward();
      }

      const insertQuery = `
        INSERT INTO cashingCodes (codigo, fechaRegistro, horaRegistro, idCodigo, reward) 
        VALUES (?, ?, ?, ?, ?)
      `;

      const fechaRegistro = moment.tz("America/Guatemala").format("YYYY-MM-DD");
      const horaRegistro = moment.tz("America/Guatemala").format("HH:mm:ss");

      await connection.execute(insertQuery, [
        codigo,
        fechaRegistro,
        horaRegistro,
        code.id, // Asumiendo que idCodigo es el id del código en la tabla codes
        reward,
      ]);

      await sendEmail(
        correoElectronico,
        "Código Canjeado con Éxito",
        `Tu código ${codigo} ha sido canjeado con éxito. ${
          reward === "Sin premio"
            ? ""
            : `Has ganado un premio adicional: ${reward}`
        }`,
        codigo
      );

      res
        .status(200)
        .json({ message: "Código canjeado con éxito", code, reward });
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
  redeemCodeByCodigo,
  findByPersonalDocument,
  buscarPorIdentificacion,
};
