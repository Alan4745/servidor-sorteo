const crypto = require("crypto");
const moment = require("moment-timezone");

function generarCodigo(longitud) {
  const caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let codigo = "";
  for (let i = 0; i < longitud; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
}

function cifrarDato(dato) {
  const algorithm = "aes-256-cbc";
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(dato, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { encrypted, key: key.toString("hex"), iv: iv.toString("hex") };
}

function desencriptarDato(encrypted, key, iv) {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "hex")
  );
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const getRandomCode = async (req, res) => {
  try {
    const [rows] = await global.db.execute(
      "SELECT * FROM codes ORDER BY RAND() LIMIT 1"
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No se encontraron códigos" });
    }

    res.status(200).json(rows[0]);
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

    res.status(200).json(rows[0]);
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
      telefono,
      correoElectronico,
    } = req.body;

    console.log(req.body);

    const edadCalculada = calcularEdad(fechaNacimiento);

    if (edadCalculada < 18) {
      return res.status(400).json({
        message: "Debe ser mayor de 18 años para registrar el código",
      });
    }

    if (!/^\d{13}$/.test(documentoIdentificacion)) {
      return res.status(400).json({
        message:
          "El documento de identificación debe contener solo números y tener una longitud de 13 caracteres",
      });
    }

    const [rows] = await global.db.execute(
      "SELECT * FROM codes WHERE codigo = ?",
      [codigo]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Código no encontrado" });
    }

    const code = rows[0];

    if (code.estadoCanjeado) {
      return res.status(400).json({ message: "El código ya ha sido canjeado" });
    }

    const updateQuery = `
      UPDATE codes 
      SET edad = ?, pais = ?, nombre = ?, apellidos = ?, fechaNacimiento = ?, 
          documentoIdentificacion = ?, telefono = ?, correoElectronico = ?, 
          fechaCajeado = ?, estadoCanjeado = true 
      WHERE codigo = ?
    `;

    const fechaCajeado = moment.tz("America/Guatemala").toDate();

    await global.db.execute(updateQuery, [
      edadCalculada,
      pais,
      nombre,
      apellidos,
      fechaNacimiento,
      documentoIdentificacion,
      telefono,
      correoElectronico,
      fechaCajeado,
      codigo,
    ]);

    const [updatedRows] = await global.db.execute(
      "SELECT * FROM codes WHERE codigo = ?",
      [codigo]
    );

    res.status(200).json(updatedRows[0]);
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
};
