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
  // Cuántos artículos de detalle hay guardados en DetalleCierres para este
  // cierre. Vacío/0 = no hay detalle (cierre viejo, o ya se borró).
  "detalleArticulos",
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

/**
 * Borra un registro de ResumenMensual por id (usado por el súper admin desde
 * "Estado por planta" para limpiar cierres — p. ej. filas de prueba). El
 * permiso lo controla el servidor Next (solo súper admin); acá solo se borra.
 */
function eliminarResumen_(input) {
  var id = input && input.id;
  if (!id) throw new Error("Falta el id del resumen a eliminar");
  var sheet = getResumenSheet_();
  var values = sheet.getDataRange().getValues();
  var idCol = values[0].indexOf("id");
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      borrarDetalleDeCierres_([id]);
      logAccion_("eliminarResumen", id);
      return { id: id, eliminado: true };
    }
  }
  throw new Error("No se encontró el resumen (id: " + id + ")");
}

/**
 * Borra los conteos de UNA agencia (o de todas si no se pasa agencia), en
 * bloque para no trabar el candado del script.
 *
 * Por qué existe: `resetearConteos_` (Conteos.gs) borra la hoja ENTERA sin
 * mirar la agencia. Como `cerrarCiclo_` y el botón "Reiniciar inventario" son
 * por planta, usar aquel borraría los conteos EN CURSO de las otras 8 plantas.
 * Esta función respeta la agencia: conserva las filas de las demás y reescribe.
 */
function borrarConteosDeAgencia_(agencia) {
  var sheet = getSheet_(SHEETS.CONTEOS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { eliminados: 0 };

  // Sin agencia (súper admin "todas las plantas"): borrar todo, rápido.
  if (!agencia) {
    var n = lastRow - 1;
    sheet.deleteRows(2, n);
    logAccion_("resetearConteos", n + " conteos eliminados (todas las plantas)");
    return { eliminados: n };
  }

  // Con agencia: conservar el resto y reescribir en bloque.
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var colAg = headers.indexOf("agencia");
  if (colAg === -1) throw new Error("La hoja Conteos no tiene columna 'agencia'");

  var conservar = [];
  var eliminados = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][colAg]) === String(agencia)) eliminados++;
    else conservar.push(values[i]);
  }
  if (eliminados === 0) return { eliminados: 0 };

  // Limpiar el cuerpo y reescribir solo lo que se conserva (2 operaciones,
  // sin borrar fila por fila -> no dispara el "Lock timeout").
  sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  if (conservar.length > 0) {
    sheet.getRange(2, 1, conservar.length, headers.length).setValues(conservar);
  }
  logAccion_("resetearConteos", eliminados + " conteos eliminados (" + agencia + ")");
  return { eliminados: eliminados };
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

  // 0) Guardar el detalle de artículos (estado final) ANTES de borrar, con el
  //    id que va a llevar el resumen. Si esto falla, el cierre sigue: el
  //    documento ya se descargó y el resumen no depende del detalle.
  var cierreId = nuevoId_();
  var detalleGuardado = 0;
  try {
    detalleGuardado = guardarDetalleCierre_(cierreId, agencia);
  } catch (e) {
    logAccion_("cerrarCiclo", "No se pudo guardar el detalle de " + agencia, e.message);
  }

  // 1) Borrar primero SOLO esta planta (en bloque). Antes usaba
  //    resetearConteos_, que borra la hoja entera -> cerrar el cíclico de una
  //    planta borraba los conteos en curso de las otras. Ahora es por agencia.
  var r = borrarConteosDeAgencia_(agencia);
  if (!r.eliminados) {
    if (detalleGuardado) borrarDetalleDeCierres_([cierreId]);
    throw new Error("No hay conteos para cerrar en " + agencia);
  }

  // 2) Recién ahora se guarda el resumen liviano.
  var t = ahora_();
  var tz = Session.getScriptTimeZone();
  var periodo = Utilities.formatDate(new Date(), tz, "yyyy-MM");
  var num = function (v) { return Math.round((Number(v) || 0) * 100) / 100; };

  var resumen = {
    id: cierreId,
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
    detalleArticulos: detalleGuardado,
  };

  guardarResumen_(resumen);
  logAccion_("cerrarCiclo", agencia + ": " + r.eliminados + " conteos archivados y borrados");
  return { eliminados: r.eliminados, resumen: resumen };
}


/* ============================================================
 * DETALLE DE CIERRES — los artículos de cada cierre, para verlos en
 * "Estado por planta". Se guardan al cerrar y se borran solos a los 2 meses
 * (el resumen queda). Hoja propia para no engordar ResumenMensual.
 * ============================================================ */

var DETALLE_SHEET = "DetalleCierres";
var DETALLE_HEADERS = [
  "cierreId", "agencia", "creadoEn", "codigo", "descripcion", "ubicacion",
  "stockSap", "stockContado", "diferencia", "estado",
];
var DETALLE_MESES_RETENCION = 2;

function getDetalleSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(DETALLE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(DETALLE_SHEET);
    sheet.appendRow(DETALLE_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Copia a DetalleCierres el ESTADO FINAL de los conteos de una agencia: el
 * último conteo por código + ubicación (la misma regla que usa el Dashboard y
 * el documento de cierre). Devuelve cuántos artículos guardó.
 */
function guardarDetalleCierre_(cierreId, agencia) {
  var delAgencia = leerHoja_(SHEETS.CONTEOS).filter(function (c) {
    return String(c.agencia) === String(agencia);
  });
  if (delAgencia.length === 0) return 0;

  var ultimos = {};
  delAgencia.forEach(function (c) {
    var clave = String(c.codigo) + "|" + String(c.ubicacion);
    var prev = ultimos[clave];
    if (!prev || new Date(c.creadoEn) > new Date(prev.creadoEn)) ultimos[clave] = c;
  });

  var iso = new Date().toISOString();
  var filas = Object.keys(ultimos).map(function (k) {
    var c = ultimos[k];
    return [
      cierreId, agencia, iso, String(c.codigo), c.descripcion, c.ubicacion,
      Number(c.stockSap) || 0, Number(c.stockContado) || 0, Number(c.diferencia) || 0, c.estado,
    ];
  });

  var sheet = getDetalleSheet_();
  sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, DETALLE_HEADERS.length).setValues(filas);
  return filas.length;
}

/** Artículos de un cierre (se piden recién cuando el usuario abre la tarjeta). */
function listarDetalleCierre_(cierreId) {
  if (!cierreId) throw new Error("Falta el id del cierre");
  var sheet = getDetalleSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var col = headers.indexOf("cierreId");
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][col]) !== String(cierreId)) continue;
    var o = {};
    headers.forEach(function (h, j) { o[h] = values[i][j]; });
    out.push(o);
  }
  return out;
}

/**
 * Borra de DetalleCierres todas las filas de los cierres indicados, en bloque
 * (se reescribe lo que se conserva; nada de borrar fila por fila). Devuelve
 * cuántas filas borró.
 */
function borrarDetalleDeCierres_(ids) {
  var sheet = getDetalleSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2 || !ids || ids.length === 0) return 0;
  var quitar = {};
  ids.forEach(function (id) { quitar[String(id)] = true; });

  var values = sheet.getDataRange().getValues();
  var col = values[0].indexOf("cierreId");
  var conservar = [];
  var borradas = 0;
  for (var i = 1; i < values.length; i++) {
    if (quitar[String(values[i][col])]) borradas++;
    else conservar.push(values[i]);
  }
  if (borradas === 0) return 0;

  sheet.getRange(2, 1, lastRow - 1, values[0].length).clearContent();
  if (conservar.length > 0) {
    sheet.getRange(2, 1, conservar.length, values[0].length).setValues(conservar);
  }
  return borradas;
}

/** Pone en 0 el contador de detalle de los cierres indicados (el resumen queda). */
function marcarSinDetalle_(ids) {
  if (!ids || ids.length === 0) return;
  var sheet = getResumenSheet_();
  var values = sheet.getDataRange().getValues();
  var idCol = values[0].indexOf("id");
  var detCol = values[0].indexOf("detalleArticulos");
  if (idCol === -1 || detCol === -1) return;
  var marcar = {};
  ids.forEach(function (id) { marcar[String(id)] = true; });
  for (var i = 1; i < values.length; i++) {
    if (marcar[String(values[i][idCol])]) sheet.getRange(i + 1, detCol + 1).setValue(0);
  }
}

/**
 * Borrado MANUAL de los artículos de un cierre (el resumen queda). El permiso
 * lo controla el servidor Next; acá solo se borra.
 */
function eliminarDetalleCierre_(input) {
  var id = input && input.id;
  if (!id) throw new Error("Falta el id del cierre");
  var borradas = borrarDetalleDeCierres_([id]);
  marcarSinDetalle_([id]);
  logAccion_("eliminarDetalleCierre", id + ": " + borradas + " artículos borrados");
  return { id: id, eliminados: borradas };
}

/**
 * Borrado AUTOMÁTICO: quita los artículos de los cierres con más de 2 meses.
 * El resumen NO se toca. La corre un activador diario (ver
 * instalarPurgadoAutomatico) y también se puede correr a mano desde el editor.
 * Sin guion bajo al final para que aparezca en el desplegable de ejecución.
 */
function purgarDetallesVencidos() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var limite = new Date();
    limite.setMonth(limite.getMonth() - DETALLE_MESES_RETENCION);

    var sheet = getDetalleSheet_();
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return { cierres: 0, eliminados: 0 };
    var idCol = values[0].indexOf("cierreId");
    var fCol = values[0].indexOf("creadoEn");

    var vencidos = {};
    for (var i = 1; i < values.length; i++) {
      var f = new Date(values[i][fCol]);
      if (!isNaN(f.getTime()) && f < limite) vencidos[String(values[i][idCol])] = true;
    }
    var ids = Object.keys(vencidos);
    if (ids.length === 0) return { cierres: 0, eliminados: 0 };

    var borradas = borrarDetalleDeCierres_(ids);
    marcarSinDetalle_(ids);
    logAccion_("purgarDetallesVencidos", ids.length + " cierres, " + borradas + " artículos borrados");
    return { cierres: ids.length, eliminados: borradas };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Se corre UNA sola vez, a mano, desde el editor: deja programado el borrado
 * automático todos los días a las 3 de la mañana. Si ya estaba programado, lo
 * reemplaza (no quedan activadores duplicados).
 */
function instalarPurgadoAutomatico() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "purgarDetallesVencidos") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("purgarDetallesVencidos").timeBased().everyDays(1).atHour(3).create();
  return "Borrado automático programado: todos los días a las 3:00";
}
