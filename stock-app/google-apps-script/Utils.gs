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

/** Las 9 agencias de la empresa. Centro Logístico es la operación central. */
const AGENCIAS = [
  "JP Varela",
  "Lascano",
  "Vergara",
  "Rio Branco",
  "Tres Gomensoro",
  "Tacuarembó",
  "Salto",
  "Montevideo",
  "Centro Logístico",
];

const HEADERS = {
    [SHEETS.USUARIOS]: ["id", "nombre", "email", "passwordHash", "rol", "perfil", "agencia", "agencias", "activo", "creadoEn"],
  [SHEETS.PRODUCTOS]: ["id", "codigo", "descripcion", "ubicacion", "familia", "proveedor", "stockSap","unidadMedida", "precioUnitario", "agencia", "actualizadoEn"],
  [SHEETS.CONTEOS]: [
    "id", "codigo", "descripcion", "ubicacion", "stockSap", "stockContado", "diferencia",
    "estado", "observaciones", "ubicacionNueva", "agencia", "usuarioId", "usuarioEmail", "fecha", "hora", "sincronizado", "creadoEn",
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

/**
 * Migración de una sola vez: a los productos y conteos que ya existían
 * ANTES de agregar el concepto de "agencia", les asigna "Centro
 * Logístico" (para no perder ni mezclar nada de lo ya cargado). Ejecutar
 * UNA vez manualmente desde el editor después de pegar este código.
 */
function migrarAgenciaCentroLogistico() {
  [SHEETS.PRODUCTOS, SHEETS.CONTEOS].forEach((nombre) => {
    const sheet = getSheet_(nombre);
    const headers = sincronizarEncabezados_(sheet, HEADERS[nombre]);
    const agenciaCol = headers.indexOf("agencia");
    if (agenciaCol === -1) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const rango = sheet.getRange(2, agenciaCol + 1, lastRow - 1, 1);
    const valores = rango.getValues();
    const actualizados = valores.map(([v]) => [v === "" || v === null ? "Centro Logístico" : v]);
    rango.setValues(actualizados);
  });

  logAccion_("migrarAgenciaCentroLogistico", "Productos y Conteos existentes migrados a Centro Logístico");
  return "Listo: los productos y conteos que no tenían agencia quedaron asignados a Centro Logístico.";
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

/**
 * Compara los encabezados que el código espera (HEADERS[nombre]) contra
 * los que REALMENTE existen en la fila 1 de la hoja. Si falta alguno —por
 * ejemplo, se agregó un campo nuevo en el código pero la planilla es
 * vieja y todavía no tiene esa columna— lo agrega solo, como columna
 * nueva al final, sin tocar ni desordenar las columnas existentes.
 *
 * Devuelve el orden REAL (y ya actualizado) de columnas de la hoja, para
 * que agregarFila_/agregarFilas_ escriban cada valor en su columna
 * correcta por NOMBRE, sin depender de que el orden del código y el de
 * la planilla coincidan a mano.
 */
function sincronizarEncabezados_(sheet, headersEsperados) {
  const ultimaCol = sheet.getLastColumn();
  const headersActuales = ultimaCol > 0
    ? sheet.getRange(1, 1, 1, ultimaCol).getValues()[0].filter((h) => h !== "")
    : [];

  const faltantes = headersEsperados.filter((h) => headersActuales.indexOf(h) === -1);
  if (faltantes.length > 0) {
    sheet.getRange(1, headersActuales.length + 1, 1, faltantes.length).setValues([faltantes]);
    return headersActuales.concat(faltantes);
  }
  return headersActuales;
}

/** Agrega una fila a una hoja a partir de un objeto (columnas por NOMBRE, no por orden fijo). */
function agregarFila_(nombre, objeto) {
  const sheet = getSheet_(nombre);
  const headers = sincronizarEncabezados_(sheet, HEADERS[nombre]);
  const fila = headers.map((h) => (objeto[h] !== undefined ? objeto[h] : ""));
  sheet.appendRow(fila);
  return objeto;
}

/** Agrega varias filas de una sola vez (más eficiente que appendRow en loop). */
function agregarFilas_(nombre, objetos) {
  if (objetos.length === 0) return;
  const sheet = getSheet_(nombre);
  const headers = sincronizarEncabezados_(sheet, HEADERS[nombre]);
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
    if (String(values[i][col]) === String(valor)) return i + 1;
  }
  return -1;
}

/** Actualiza celdas de una fila ya localizada, a partir de un objeto parcial (por nombre de columna real). */
function actualizarFila_(nombre, numeroFila, cambios) {
  const sheet = getSheet_(nombre);
  const headers = sincronizarEncabezados_(sheet, HEADERS[nombre]);
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
/** Crea en cada hoja las columnas que el código espera y la planilla todavía no tiene. */
function sincronizarEncabezadosDeTodasLasHojas() {
  const creadas = [];

  Object.keys(HEADERS).forEach(function (nombre) {
    const sheet = getSheet_(nombre);
    const ultimaCol = sheet.getLastColumn();
    const antes = ultimaCol > 0
      ? sheet.getRange(1, 1, 1, ultimaCol).getValues()[0].filter(function (h) { return h !== ""; })
      : [];

    sincronizarEncabezados_(sheet, HEADERS[nombre]).forEach(function (h) {
      if (antes.indexOf(h) === -1) creadas.push(nombre + " → " + h);
    });
  });

  logAccion_("sincronizarEncabezados", creadas.join(", ") || "sin cambios");
  return creadas.length
    ? "Columnas agregadas:\n" + creadas.join("\n")
    : "No hubo columnas nuevas que agregar: la planilla ya estaba al día.";
}
