/**
 * Productos.gs — CRUD del stock teórico (SAP) y su importación masiva.
 */

function listarProductos_() {
  return leerHoja_(SHEETS.PRODUCTOS);
}

function obtenerProductoPorCodigo_(codigo) {
  const productos = leerHoja_(SHEETS.PRODUCTOS);
  const encontrado = productos.find((p) => String(p.codigo).toLowerCase() === String(codigo).toLowerCase());
  return encontrado || null;
}

function crearProducto_(input) {
  if (!input.codigo || !input.descripcion) {
    throw new Error("Código y descripción son obligatorios");
  }
  const existente = obtenerProductoPorCodigo_(input.codigo);
  if (existente) throw new Error(`Ya existe un producto con el código ${input.codigo}`);

  const producto = {
    id: nuevoId_(),
    codigo: String(input.codigo).trim(),
    descripcion: input.descripcion,
    ubicacion: input.ubicacion || "",
    familia: input.familia || "",
    proveedor: input.proveedor || "",
    stockSap: Number(input.stockSap) || 0,
    actualizadoEn: ahora_().iso,
  };
  agregarFila_(SHEETS.PRODUCTOS, producto);
  logAccion_("crearProducto", producto.codigo);
  return producto;
}

function actualizarProducto_(input) {
  if (!input.id) throw new Error("Falta el id del producto a actualizar");
  const fila = buscarFilaPor_(SHEETS.PRODUCTOS, "id", input.id);
  if (fila === -1) throw new Error("Producto no encontrado");

  const cambios = {};
  ["codigo", "descripcion", "ubicacion", "familia", "proveedor", "stockSap"].forEach((campo) => {
    if (input[campo] !== undefined) cambios[campo] = input[campo];
  });
  cambios.actualizadoEn = ahora_().iso;

  actualizarFila_(SHEETS.PRODUCTOS, fila, cambios);
  logAccion_("actualizarProducto", input.id);

  return leerHoja_(SHEETS.PRODUCTOS).find((p) => p.id === input.id);
}

function eliminarProducto_(input) {
  if (!input.id) throw new Error("Falta el id del producto a eliminar");
  const fila = buscarFilaPor_(SHEETS.PRODUCTOS, "id", input.id);
  if (fila === -1) throw new Error("Producto no encontrado");
  eliminarFila_(SHEETS.PRODUCTOS, fila);
  logAccion_("eliminarProducto", input.id);
  return { id: input.id };
}

/** Importación masiva: agrega todos los productos recibidos como filas nuevas. */
function importarProductos_(input) {
  const productos = input.productos || [];
  if (!Array.isArray(productos) || productos.length === 0) {
    throw new Error("No se recibieron productos para importar");
  }

  const existentes = new Set(leerHoja_(SHEETS.PRODUCTOS).map((p) => String(p.codigo).toLowerCase()));
  const nuevos = [];
  const timestamp = ahora_().iso;

  productos.forEach((p) => {
    if (!p.codigo || !p.descripcion) return; // fila inválida, se ignora
    const codigoNorm = String(p.codigo).toLowerCase();
    if (existentes.has(codigoNorm)) return; // evita duplicados en la misma importación
    existentes.add(codigoNorm);
    nuevos.push({
      id: nuevoId_(),
      codigo: String(p.codigo).trim(),
      descripcion: p.descripcion,
      ubicacion: p.ubicacion || "",
      familia: p.familia || "",
      proveedor: p.proveedor || "",
      stockSap: Number(p.stockSap) || 0,
      actualizadoEn: timestamp,
    });
  });

  agregarFilas_(SHEETS.PRODUCTOS, nuevos);
  logAccion_("importarProductos", `${nuevos.length} productos importados`);
  return { importados: nuevos.length };
}
