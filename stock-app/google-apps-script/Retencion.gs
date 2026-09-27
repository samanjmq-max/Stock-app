/**
 * Retencion.gs — CIERRE DE CÍCLICO y política de retención por diseño.
 * Archivo NUEVO y autocontenido. NO reemplaza Utils.gs ni Conteos.gs.
 */

var RESUMEN_SHEET = "ResumenMensual";
var RESUMEN_HEADERS = [
  "id", "agencia", "periodo", "fechaCierre", "articulos", "totalContado",
  "totalDiferenciaAbs", "importe", "usuarioCierre", "emailCierre", "archivoGenerado", "creadoEn",
  // Desglose por estado (artículos y pesos), congelado al cierre. Se agregaron
  // al final para no mover las columnas viejas ni romper las filas existentes.
  "coincidencias", "importeCoincidencias",
  "diferenciasPositivas", "importeDiferenciasPositivas",
  "diferenciasNegativas", "importeDiferenciasNegativas",
  "porContar", "importePorContar",
];

function getResumenSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(RESUMEN_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(RESUMEN_SHEET);
    sheet.appendRow(RESUMEN_HEADERS);
    sheet.setFrozenRows(1);
    return sheet;
  }
  // Migración suave del encabezado: si se agregaron columnas nuevas (el
  // desglose por estado), se completan sin tocar los datos ya guardados. Las
  // filas viejas simplemente quedan con esas columnas vacías.
  var anchoActual = sheet.getLastColumn();
  var encabezado = anchoActual > 0 ? sheet.getRange(1, 1, 1, anchoActual).getValues()[0] : [];
  var falta = RESUMEN_HEADERS.some(function (h, i) { return encabezado[i] !== h; });
  if (falta) {
    sheet.getRange(1, 1, 1, RESUMEN_HEADERS.length).setValues([RESUMEN_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function guardarResumen_(obj) {
  var sheet = getResumenSheet_();
  var fila = RESUMEN_HEADERS.map(function (h) { return obj[h] !== undefined ? obj[h] : ""; });
  sheet.appendRow(fila);
  return obj;
}

function listarResumenMensual_() {
  var sheet = getResumenSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1)
    .filter(function (row) { return row.some(function (c) { return c !== "" && c !== null; }); })
    .map(function (row) {
      var o = {};
      headers.forEach(function (h, i) { o[h] = row[i]; });
      return o;
    });
}

/**
 * Cierra el cíclico de una agencia: guarda un resumen liviano en ResumenMensual
 * y borra el detalle de esa agencia en Conteos.
 *
 * 1) ORDEN: primero se BORRA (rápido, en bloque) y recién si borró algo se
 *    guarda el resumen — así no queda un resumen huérfano si el borrado falla.
 * 2) TOTALES: los números (incluido el DESGLOSE por estado, en artículos y
 *    pesos) los manda el navegador en `input.totales` (estado final
 *    deduplicado, los mismos del Dashboard y del documento). Si no llegan, se
 *    calcula en el servidor ANTES de borrar (best-effort).
 */
function cerrarCiclo_(input) {
  var agencia = input && input.agencia;
  if (!agencia) throw new Error("Falta la agencia para cerrar el cíclico");

  var totales = input && input.totales;

  // Fallback (cliente viejo o llamada directa): calcular ANTES de borrar.
  if (!totales) {
    var todos = leerHoja_(SHEETS.CONTEOS);
    var delAgencia = todos.filter(function (c) { return String(c.agencia) === String(agencia); });
    if (delAgencia.length === 0) throw new Error("No hay conteos para cerrar en " + agencia);

    var precios = {};
    leerHoja_(SHEETS.PRODUCTOS)
      .filter(function (p) { return String(p.agencia) === String(agencia); })
      .forEach(function (p) { precios[String(p.codigo)] = Number(p.precioUnitario) || 0; });

    var tc = 0, td = 0, imp = 0;
    var coin = 0, iCoin = 0, dPos = 0, iPos = 0, dNeg = 0, iNeg = 0;
    delAgencia.forEach(function (c) {
      var precio = precios[String(c.codigo)] || 0;
      var contado = Number(c.stockContado) || 0;
      var dif = Number(c.diferencia) || 0;
      tc += contado;
      td += Math.abs(dif);
      imp += dif * precio;
      if (c.estado === "coincide") { coin++; iCoin += precio * contado; }
      else if (c.estado === "sobra") { dPos++; iPos += precio * Math.abs(dif); }
      else if (c.estado === "falta") { dNeg++; iNeg += precio * Math.abs(dif); }
    });
    totales = {
      articulos: delAgencia.length,
      totalContado: tc,
      totalDiferenciaAbs: td,
      importe: imp,
      coincidencias: coin, importeCoincidencias: iCoin,
      diferenciasPositivas: dPos, importeDiferenciasPositivas: iPos,
      diferenciasNegativas: dNeg, importeDiferenciasNegativas: iNeg,
      porContar: 0, importePorContar: 0, // no calculable sin comparar catálogo
    };
  }

  // 1) Borrar primero (rápido, en bloque). Si no había nada, no se guarda resumen.
  var r = resetearConteos_({ agencia: agencia });
  if (!r.eliminados) {
    throw new Error("No hay conteos para cerrar en " + agencia);
  }

  // 2) Recién ahora se guarda el resumen liviano.
  var t = ahora_();
  var tz = Session.getScriptTimeZone();
  var periodo = Utilities.formatDate(new Date(), tz, "yyyy-MM");
  var num = function (v) { return Math.round((Number(v) || 0) * 100) / 100; };

  var resumen = {
    id: nuevoId_(),
    agencia: agencia,
    periodo: periodo,
    fechaCierre: t.fecha,
    articulos: Number(totales.articulos) || 0,
    totalContado: Number(totales.totalContado) || 0,
    totalDiferenciaAbs: Number(totales.totalDiferenciaAbs) || 0,
    importe: num(totales.importe),
    usuarioCierre: (input && input.usuarioNombre) || "",
    emailCierre: (input && input.usuarioEmail) || "",
    archivoGenerado: (input && input.archivoGenerado) || "",
    creadoEn: t.iso,
    coincidencias: Number(totales.coincidencias) || 0,
    importeCoincidencias: num(totales.importeCoincidencias),
    diferenciasPositivas: Number(totales.diferenciasPositivas) || 0,
    importeDiferenciasPositivas: num(totales.importeDiferenciasPositivas),
    diferenciasNegativas: Number(totales.diferenciasNegativas) || 0,
    importeDiferenciasNegativas: num(totales.importeDiferenciasNegativas),
    porContar: Number(totales.porContar) || 0,
    importePorContar: num(totales.importePorContar),
  };

  guardarResumen_(resumen);
  logAccion_("cerrarCiclo", agencia + ": " + r.eliminados + " conteos archivados y borrados");
  return { eliminados: r.eliminados, resumen: resumen };
}
