/**
 * Conteos.gs — cada conteo guardado es un registro nuevo (nunca se
 * sobreescribe uno anterior), así el historial de conteos por producto
 * queda completo. El "último conteo por código" se calcula en el frontend
 * a partir de `creadoEn`.
 */

function listarConteos_() {
  return leerHoja_(SHEETS.CONTEOS);
}

function guardarConteo_(input) {
  if (!input.codigo || input.stockContado === undefined) {
    throw new Error("Código y cantidad contada son obligatorios");
  }

  const conteo = {
    id: nuevoId_(),
    codigo: input.codigo,
    descripcion: input.descripcion || "",
    ubicacion: input.ubicacion || "",
    stockSap: Number(input.stockSap) || 0,
    stockContado: Number(input.stockContado),
    diferencia: Number(input.diferencia),
    estado: input.estado,
    observaciones: input.observaciones || "",
    ubicacionNueva: input.ubicacionNueva || "",
    usuarioId: input.usuarioId || "",
    usuarioEmail: input.usuarioEmail || "",
    fecha: input.fecha || ahora_().fecha,
    hora: input.hora || ahora_().hora,
    sincronizado: true,
    creadoEn: ahora_().iso,
  };

  agregarFila_(SHEETS.CONTEOS, conteo);
  logAccion_("guardarConteo", conteo.codigo);

  return conteo;
}

/**
 * Guarda varios conteos de una vez
 * (usado por la sincronización offline en lote).
 */
function guardarConteosLote_(input) {
  const conteos = input.conteos || [];

  if (!Array.isArray(conteos) || conteos.length === 0) {
    throw new Error("No se recibieron conteos para sincronizar");
  }

  const timestamp = ahora_().iso;

  const filas = conteos.map((c) => ({
    id: nuevoId_(),
    codigo: c.codigo,
    descripcion: c.descripcion || "",
    ubicacion: c.ubicacion || "",
    stockSap: Number(c.stockSap) || 0,
    stockContado: Number(c.stockContado),
    diferencia: Number(c.diferencia),
    estado: c.estado,
    observaciones: c.observaciones || "",
    ubicacionNueva: c.ubicacionNueva || "",
    usuarioId: c.usuarioId || "",
    usuarioEmail: c.usuarioEmail || "",
    fecha: c.fecha || ahora_().fecha,
    hora: c.hora || ahora_().hora,
    sincronizado: true,
    creadoEn: timestamp,
  }));

  agregarFilas_(SHEETS.CONTEOS, filas);

  logAccion_(
    "guardarConteosLote",
    `${filas.length} conteos sincronizados`
  );

  return {
    guardados: filas.length
  };
}

/**
 * Elimina TODOS los conteos
 * (usado por un administrador para reiniciar un inventario).
 */
function resetearConteos_() {
  const sheet = getSheet_(SHEETS.CONTEOS);
  const filas = sheet.getLastRow();
  const cantidad = Math.max(filas - 1, 0);

  if (filas > 1) {
    sheet.deleteRows(2, filas - 1);
  }

  logAccion_(
    "resetearConteos",
    `${cantidad} conteos eliminados`
  );

  return {
    eliminados: cantidad
  };
}
