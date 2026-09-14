/**
 * Productos.gs — CRUD del stock teórico (SAP) y su importación masiva.
 *
 * A partir de la función multi-agencia, un producto se identifica por la
 * combinación código + agencia (el mismo código puede existir en más de
 * una agencia, cada una con su propio stock).
 *
 * NOTA: esta copia del repo había quedado atrasada varias versiones --
 * todavía tenía la importación que salteaba los códigos existentes y no
 * escribía ni `agencia` ni `precioUnitario`. Se sincronizó con lo que está
 * realmente desplegado en Apps Script. Si se vuelve a tocar el script desde
 * el editor de Google, hay que copiar el resultado acá: un repo que no
 * coincide con lo desplegado es peor que no tener el archivo, porque invita
 * a razonar sobre código que no corre.
 */

function listarProductos_(agencia) {
  const productos = leerHoja_(SHEETS.PRODUCTOS).map((p) => ({
    ...p,
    codigo: String(p.codigo)
  }));

  if (!agencia) return productos;

  return productos.filter((p) => p.agencia === agencia);
}

function obtenerProductoPorCodigo_(codigo, agencia) {
  const productos = leerHoja_(SHEETS.PRODUCTOS);

  const encontrado = productos.find(
    (p) =>
      String(p.codigo).toLowerCase() === String(codigo).toLowerCase() &&
      (!agencia || p.agencia === agencia)
  );

  return encontrado
    ? { ...encontrado, codigo: String(encontrado.codigo) }
    : null;
}

function crearProducto_(input) {
  if (!input.codigo || !input.descripcion || !input.agencia) {
    throw new Error("Código, descripción y agencia son obligatorios");
  }

  const existente = obtenerProductoPorCodigo_(input.codigo, input.agencia);

  if (existente) {
    throw new Error(
      `Ya existe un producto con el código ${input.codigo} en ${input.agencia}`
    );
  }

  const producto = {
    id: nuevoId_(),
    codigo: String(input.codigo).trim(),
    descripcion: input.descripcion,
    ubicacion: input.ubicacion || "",
    familia: input.familia || "",
    proveedor: input.proveedor || "",
    stockSap: Number(input.stockSap) || 0,
    // UN, KG, L... Vacío significa "todavía no cargada".
    unidadMedida: input.unidadMedida ? String(input.unidadMedida).trim().toUpperCase() : "",
    // Precio de una sola unidad, en pesos. 0 significa "todavía no cargado".
    precioUnitario: input.precioUnitario !== undefined ? Number(input.precioUnitario) || 0 : 0,
    agencia: input.agencia,
    actualizadoEn: ahora_().iso,
  };

  agregarFila_(SHEETS.PRODUCTOS, producto);

  logAccion_(
    "crearProducto",
    `${producto.codigo} (${producto.agencia})`
  );

  return producto;
}

function actualizarProducto_(input) {
  if (!input.id) {
    throw new Error("Falta el id del producto a actualizar");
  }

  const fila = buscarFilaPor_(
    SHEETS.PRODUCTOS,
    "id",
    input.id
  );

  if (fila === -1) {
    throw new Error("Producto no encontrado");
  }

  const cambios = {};

  [
    "codigo",
    "descripcion",
    "ubicacion",
    "familia",
    "proveedor",
    "stockSap",
    "unidadMedida",
    "precioUnitario",
    "agencia"
  ].forEach((campo) => {
    if (input[campo] !== undefined) {
      cambios[campo] = input[campo];
    }
  });

  cambios.actualizadoEn = ahora_().iso;

  actualizarFila_(
    SHEETS.PRODUCTOS,
    fila,
    cambios
  );

  logAccion_(
    "actualizarProducto",
    input.id
  );

  return leerHoja_(SHEETS.PRODUCTOS).find(
    (p) => p.id === input.id
  );
}

function eliminarProducto_(input) {
  if (!input.id) {
    throw new Error("Falta el id del producto a eliminar");
  }

  const fila = buscarFilaPor_(
    SHEETS.PRODUCTOS,
    "id",
    input.id
  );

  if (fila === -1) {
    throw new Error("Producto no encontrado");
  }

  eliminarFila_(
    SHEETS.PRODUCTOS,
    fila
  );

  logAccion_(
    "eliminarProducto",
    input.id
  );

  return {
    id: input.id
  };
}

function importarProductos_(input) {
  const productos = input.productos || [];
  const agencia = input.agencia;

  if (!agencia) {
    throw new Error(
      "Falta indicar la agencia para la importación"
    );
  }

  if (
    !Array.isArray(productos) ||
    productos.length === 0
  ) {
    throw new Error(
      "No se recibieron productos para importar"
    );
  }

  const sheet = getSheet_(
    SHEETS.PRODUCTOS
  );

  const headers = sincronizarEncabezados_(
    sheet,
    HEADERS[SHEETS.PRODUCTOS]
  );

  const values = sheet.getDataRange().getValues();

  const codigoCol = headers.indexOf("codigo");
  const agenciaCol = headers.indexOf("agencia");
  const descripcionCol = headers.indexOf("descripcion");
  const ubicacionCol = headers.indexOf("ubicacion");
  const familiaCol = headers.indexOf("familia");
  const proveedorCol = headers.indexOf("proveedor");
  const stockSapCol = headers.indexOf("stockSap");
  const unidadMedidaCol = headers.indexOf("unidadMedida");
  const precioUnitarioCol = headers.indexOf("precioUnitario");
  const actualizadoEnCol = headers.indexOf("actualizadoEn");

  const filaPorCodigo = {};

  for (let i = 1; i < values.length; i++) {
    if (values[i][agenciaCol] === agencia) {
      filaPorCodigo[
        String(values[i][codigoCol]).toLowerCase()
      ] = i;
    }
  }

  const timestamp = ahora_().iso;

  const nuevos = [];
  let actualizados = 0;
  let huboActualizaciones = false;

  productos.forEach((p) => {
    if (!p.codigo || !p.descripcion) {
      return;
    }

    const codigoNorm =
      String(p.codigo).toLowerCase();

    const filaExistente =
      filaPorCodigo[codigoNorm];

    if (filaExistente !== undefined) {
      // Se actualiza en memoria, NO se llama a Sheets fila por fila.
      values[filaExistente][descripcionCol] = p.descripcion;
      values[filaExistente][ubicacionCol] = p.ubicacion || "";
      values[filaExistente][familiaCol] = p.familia || "";
      values[filaExistente][proveedorCol] = p.proveedor || "";
      values[filaExistente][stockSapCol] = Number(p.stockSap) || 0;
      // La unidad, como el precio, SOLO se pisa si la fila trae una. La
      // columna es opcional todavía y hay productos con la unidad ya
      // cargada a mano: un archivo sin esa columna no tiene que borrarla.
      if (unidadMedidaCol !== -1 && p.unidadMedida) {
        values[filaExistente][unidadMedidaCol] = String(p.unidadMedida).trim().toUpperCase();
      }
      // El precio SOLO se pisa si esta importación trajo un precio nuevo.
      // Así, la importación diaria del stock simplificado (que no trae
      // precio) no borra el precio ya cargado en una importación anterior.
      if (precioUnitarioCol !== -1 && p.precioUnitario !== undefined) {
        values[filaExistente][precioUnitarioCol] = Number(p.precioUnitario) || 0;
      }
      values[filaExistente][actualizadoEnCol] = timestamp;

      actualizados++;
      huboActualizaciones = true;
    } else {
      nuevos.push({
        id: nuevoId_(),
        codigo: String(p.codigo).trim(),
        descripcion: p.descripcion,
        ubicacion: p.ubicacion || "",
        familia: p.familia || "",
        proveedor: p.proveedor || "",
        stockSap: Number(p.stockSap) || 0,
        unidadMedida: p.unidadMedida ? String(p.unidadMedida).trim().toUpperCase() : "",
        precioUnitario: p.precioUnitario !== undefined ? Number(p.precioUnitario) || 0 : 0,
        agencia: agencia,
        actualizadoEn: timestamp,
      });
    }
  });

  if (huboActualizaciones) {
    sheet
      .getRange(1, 1, values.length, values[0].length)
      .setValues(values);
  }

  if (nuevos.length > 0) {
    agregarFilas_(
      SHEETS.PRODUCTOS,
      nuevos
    );
  }

  logAccion_(
    "importarProductos",
    `${agencia}: ${nuevos.length} nuevos, ${actualizados} actualizados`
  );

  return {
    importados: nuevos.length,
    actualizados: actualizados,
    agencia: agencia
  };
}
