/**
 * Utils.gs — helpers compartidos por todos los módulos.
 *
 * Cómo se configura:
 *   Extensiones > Propiedades del script > agregar:
 *     - SHEET_ID   -> el ID de esta misma planilla (o de otra, ver nota abajo)
 *     - API_KEY    -> una clave larga y aleatoria (la misma que ponés en
 *                     GAS_API_KEY del .env de Next.js)
 *
 * Nota: lo más simple es que este script esté "contenedor vinculado" a la
 * planilla (Extensiones > Apps Script desde la propia hoja). En ese caso
 * SpreadsheetApp.getActiveSpreadsheet() ya apunta a la hoja correcta y
 * SHEET_ID es opcional (se usa como respaldo si el script fuera standalone).
 */

const SHEETS = {
  USUARIOS: "Usuarios",
  PRODUCTOS: "Productos",
  CONTEOS: "Conteos",
  HISTORIAL: "Historial",
  CONFIGURACION: "Configuracion",
  LOGS: "Logs",
};

const HEADERS = {
  [SHEETS.USUARIOS]: ["id", "nombre", "email", "passwordHash", "rol", "activo", "creadoEn"],
  [SHEETS.PRODUCTOS]: ["id", "codigo", "descripcion", "ubicacion", "familia", "proveedor", "stockSap", "actualizadoEn"],
 [SHEETS.CONTEOS]: [
    "id", "codigo", "descripcion", "ubicacion", "stockSap", "stockContado", "diferencia",
    "estado", "observaciones", "ubicacionNueva", "usuarioId", "usuarioEmail", "fecha", "hora", "sincronizado", "creadoEn",
  ],
  [SHEETS.HISTORIAL]: [
    "id", "usuarioId", "usuarioEmail", "rol", "accion", "entidad",
    "valorAnterior", "valorNuevo", "observacion", "fecha", "hora", "dispositivo", "ip",
  ],
  [SHEETS.CONFIGURACION]: ["clave", "valor", "actualizadoEn"],
  [SHEETS.LOGS]: ["timestamp", "accion", "detalle", "error"],
};

function getSpreadsheet_() {
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SHEET_ID");
  if (!id) throw new Error("No hay planilla vinculada ni SHEET_ID configurado en Propiedades del script.");
  return SpreadsheetApp.openById(id);
}

function getSheet_(nombre) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    sheet.appendRow(HEADERS[nombre]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Crea todas las hojas necesarias con sus encabezados si no existen. Ejecutar una vez manualmente. */
function configurarProyecto() {
  Object.values(SHEETS).forEach((nombre) => getSheet_(nombre));
  logAccion_("configurarProyecto", "Hojas verificadas/creadas correctamente");
  return "Listo: todas las hojas fueron creadas o ya existían.";
}

function nuevoId_() {
  return Utilities.getUuid();
}

function ahora_() {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  return {
    fecha: Utilities.formatDate(now, tz, "dd/MM/yyyy"),
    hora: Utilities.formatDate(now, tz, "HH:mm:ss"),
    iso: now.toISOString(),
  };
}

/** Lee una hoja completa y la devuelve como array de objetos usando la fila 1 como encabezado. */
function leerHoja_(nombre) {
  const sheet = getSheet_(nombre);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter((row) => row.some((cell) => cell !== "" && cell !== null))
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      return obj;
    });
}

/** Agrega una fila a una hoja a partir de un objeto (usa HEADERS para el orden). */
function agregarFila_(nombre, objeto) {
  const sheet = getSheet_(nombre);
  const headers = HEADERS[nombre];
  const fila = headers.map((h) => (objeto[h] !== undefined ? objeto[h] : ""));
  sheet.appendRow(fila);
  return objeto;
}

/** Agrega varias filas de una sola vez (más eficiente que appendRow en loop). */
function agregarFilas_(nombre, objetos) {
  if (objetos.length === 0) return;
  const sheet = getSheet_(nombre);
  const headers = HEADERS[nombre];
  const filas = objetos.map((obj) => headers.map((h) => (obj[h] !== undefined ? obj[h] : "")));
  sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, headers.length).setValues(filas);
}

/** Busca la fila (1-indexed, incluye header) cuyo valor en `campo` == `valor`. Devuelve -1 si no existe. */
function buscarFilaPor_(nombre, campo, valor) {
  const sheet = getSheet_(nombre);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const col = headers.indexOf(campo);
  if (col === -1) return -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][col]) === String(valor)) return i + 1; // +1 porque getRange es 1-indexed
  }
  return -1;
}

/** Actualiza celdas de una fila ya localizada, a partir de un objeto parcial. */
function actualizarFila_(nombre, numeroFila, cambios) {
  const sheet = getSheet_(nombre);
  const headers = HEADERS[nombre];
  headers.forEach((h, i) => {
    if (cambios[h] !== undefined) {
      sheet.getRange(numeroFila, i + 1).setValue(cambios[h]);
    }
  });
}

function eliminarFila_(nombre, numeroFila) {
  getSheet_(nombre).deleteRow(numeroFila);
}

function logAccion_(accion, detalle, error) {
  try {
    const sheet = getSheet_(SHEETS.LOGS);
    sheet.appendRow([new Date().toISOString(), accion, detalle || "", error || ""]);
  } catch (e) {
    // Nunca dejar que un error de logging rompa la respuesta principal.
  }
}

function validarApiKey_(apiKey) {
  const props = PropertiesService.getScriptProperties();
  const esperado = props.getProperty("API_KEY");
  if (!esperado) throw new Error("El servidor no tiene API_KEY configurada en Propiedades del script.");
  if (apiKey !== esperado) throw new Error("API key inválida");
}

function respuestaOk_(data) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function respuestaError_(mensaje) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(mensaje) }))
    .setMimeType(ContentService.MimeType.JSON);
}
