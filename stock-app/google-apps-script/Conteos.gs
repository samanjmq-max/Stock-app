/**
 * Conteos.gs — cada conteo guardado es un registro nuevo (nunca se
 * sobreescribe uno anterior), así el historial de conteos por producto
 * queda completo. El "estado actual" se calcula en el frontend tomando el
 * último conteo por CÓDIGO + UBICACIÓN (no solo por código), porque un
 * mismo artículo puede existir físicamente en más de una ubicación.
 */

function listarConteos_(agencia) {
  const conteos = leerHoja_(SHEETS.CONTEOS);
  if (!agencia) return conteos; // sin filtro = todas las agencias (uso de administrador)
  return conteos.filter((c) => c.agencia === agencia);
}

function guardarConteo_(input) {
  if (!input.codigo || input.stockContado === undefined || !input.agencia) {
    throw new Error("Código, cantidad contada y agencia son obligatorios");
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
    agencia: input.agencia,
    usuarioId: input.usuarioId || "",
    usuarioEmail: input.usuarioEmail || "",
    fecha: input.fecha || ahora_().fecha,
    hora: input.hora || ahora_().hora,
    sincronizado: true,
    creadoEn: ahora_().iso,
  };

  agregarFila_(SHEETS.CONTEOS, conteo);
  logAccion_("guardarConteo", `${conteo.codigo} (${conteo.agencia})`);
  return conteo;
}

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
    agencia: c.agencia || "",
    usuarioId: c.usuarioId || "",
    usuarioEmail: c.usuarioEmail || "",
    fecha: c.fecha || ahora_().fecha,
    hora: c.hora || ahora_().hora,
    sincronizado: true,
    creadoEn: timestamp,
  }));

  agregarFilas_(SHEETS.CONTEOS, filas);
  logAccion_("guardarConteosLote", `${filas.length} conteos sincronizados`);
  return { guardados: filas.length };
}

function editarConteo_(input) {
  if (!input.id) throw new Error("Falta el id del conteo a editar");

  const sheet = getSheet_(SHEETS.CONTEOS);
  const headers = sincronizarEncabezados_(sheet, HEADERS[SHEETS.CONTEOS]);
  const idCol = headers.indexOf("id");
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(input.id)) {
      const fila = values[i].slice();
      const setCampo = (nombreCol, valor) => {
        const col = headers.indexOf(nombreCol);
        if (col !== -1) fila[col] = valor;
      };

      setCampo("stockContado", Number(input.stockContado));
      setCampo("diferencia", Number(input.diferencia));
      setCampo("estado", input.estado);
      setCampo("observaciones", input.observaciones || "");
      setCampo("ubicacionNueva", input.ubicacionNueva || "");

      sheet.getRange(i + 1, 1, 1, headers.length).setValues([fila]);

      const actualizado = {};
      headers.forEach((h, idx) => (actualizado[h] = fila[idx]));
      logAccion_("editarConteo", input.id);
      return actualizado;
    }
  }

  throw new Error("No se encontró el conteo a editar (id: " + input.id + ")");
}

function eliminarConteo_(input) {
  if (!input.id) throw new Error("Falta el id del conteo a eliminar");

  const sheet = getSheet_(SHEETS.CONTEOS);
  const headers = sincronizarEncabezados_(sheet, HEADERS[SHEETS.CONTEOS]);
  const idCol = headers.indexOf("id");
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(input.id)) {
      sheet.deleteRow(i + 1);
      logAccion_("eliminarConteo", input.id);
      return { id: input.id, eliminado: true };
    }
  }

  throw new Error("No se encontró el conteo a eliminar (id: " + input.id + ")");
}

function eliminarConteos_(input) {
  const ids = input.ids || [];
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("No se recibieron ids para eliminar");
  }

  const sheet = getSheet_(SHEETS.CONTEOS);
  const headers = sincronizarEncabezados_(sheet, HEADERS[SHEETS.CONTEOS]);
  const idCol = headers.indexOf("id");
  const values = sheet.getDataRange().getValues();

  const idsSet = ids.map(String);
  const filasABorrar = [];
  for (let i = 1; i < values.length; i++) {
    if (idsSet.indexOf(String(values[i][idCol])) !== -1) {
      filasABorrar.push(i + 1);
    }
  }

  filasABorrar
    .sort((a, b) => b - a)
    .forEach((numeroFila) => sheet.deleteRow(numeroFila));

  logAccion_("eliminarConteos", `${filasABorrar.length} conteos eliminados`);
  return { eliminados: filasABorrar.length };
}

/**
 * Borra conteos. Sin agencia: borra todos (reinicio global de administrador).
 * Con agencia: borra SOLO los de esa agencia — usado por el cierre de cíclico.
 *
 * IMPORTANTE (rendimiento): el borrado por agencia se hace EN BLOQUE, no fila
 * por fila. La versión anterior llamaba `sheet.deleteRow(n)` una vez por cada
 * conteo a borrar; con 1000+ conteos eso tardaba MINUTOS y mantenía tomado el
 * lock del script, lo que disparaba "Lock timeout: another process was holding
 * the lock for too long". Ahora se reescriben las filas que se conservan de una
 * sola operación y se recorta el sobrante con un único `deleteRows` — pasa de
 * minutos a un par de segundos.
 */
function resetearConteos_(input) {
  const agencia = input && input.agencia;
  const sheet = getSheet_(SHEETS.CONTEOS);

  if (!agencia) {
    // Sin agencia = borrar todos (solo administrador global). Ya era en bloque.
    const filas = sheet.getLastRow();
    const cantidad = Math.max(filas - 1, 0);
    if (filas > 1) sheet.deleteRows(2, filas - 1);
    logAccion_("resetearConteos", `${cantidad} conteos eliminados (todas las agencias)`);
    return { eliminados: cantidad };
  }

  // Con agencia = borrar SOLO los de esa agencia, EN BLOQUE.
  const headers = sincronizarEncabezados_(sheet, HEADERS[SHEETS.CONTEOS]);
  const agenciaCol = headers.indexOf("agencia");
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    logAccion_("resetearConteos", `0 conteos eliminados (${agencia})`);
    return { eliminados: 0 };
  }

  const nCols = values[0].length;

  // Separar: lo que se conserva (las demás agencias) y cuántos se borran.
  const conservar = [];
  let eliminados = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i][agenciaCol] === agencia) {
      eliminados++;
    } else {
      conservar.push(values[i]);
    }
  }

  if (eliminados > 0) {
    const filasDatos = values.length - 1; // filas de datos actuales (sin encabezado)

    // 1) Reescribir arriba las filas que se conservan, de una sola operación.
    if (conservar.length > 0) {
      sheet.getRange(2, 1, conservar.length, nCols).setValues(conservar);
    }

    // 2) Recortar de un saque las filas sobrantes al final (las que quedaron
    //    duplicadas tras subir las conservadas).
    const sobrantes = filasDatos - conservar.length;
    if (sobrantes > 0) {
      sheet.deleteRows(2 + conservar.length, sobrantes);
    }
  }

  logAccion_("resetearConteos", `${eliminados} conteos eliminados (${agencia})`);
  return { eliminados: eliminados };
}

/**
 * FUNCIÓN DE MANTENIMIENTO — se ejecuta UNA SOLA VEZ a mano desde el editor
 * de Apps Script (no se llama desde la app). Corrige conteos guardados con
 * la columna "agencia" codificada (ej: "Centro Log%C3%ADstico" en vez de
 * "Centro Logístico"), causado por un bug ya corregido en el código del
 * sitio (api/conteos/route.ts no decodificaba el header x-user-agencia).
 *
 * Cómo correrla:
 *  1. En script.google.com, arriba, elegí esta función en el desplegable
 *     de funciones (al lado del botón ▷ Ejecutar).
 *  2. Hacé clic en ▷ Ejecutar.
 *  3. Mirá el resultado en Ver > Registros (Ejecuciones) — te va a decir
 *     cuántas filas corrigió.
 */
function repararAgenciasCodificadas() {
  const sheet = getSheet_(SHEETS.CONTEOS);
  const headers = sincronizarEncabezados_(sheet, HEADERS[SHEETS.CONTEOS]);
  const agenciaCol = headers.indexOf("agencia");

  if (agenciaCol === -1) {
    Logger.log("No se encontró la columna 'agencia' en Conteos.");
    return { corregidos: 0 };
  }

  const values = sheet.getDataRange().getValues();
  let corregidos = 0;

  for (let i = 1; i < values.length; i++) {
    const valorActual = values[i][agenciaCol];
    if (typeof valorActual === "string" && valorActual.indexOf("%") !== -1) {
      try {
        const decodificado = decodeURIComponent(valorActual);
        if (decodificado !== valorActual) {
          values[i][agenciaCol] = decodificado;
          corregidos++;
        }
      } catch (e) {
        // Si no se puede decodificar (no era realmente un valor codificado), se deja como está.
      }
    }
  }

  if (corregidos > 0) {
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  }

  Logger.log(`Filas de Conteos corregidas: ${corregidos}`);
  return { corregidos: corregidos };
}

/**
 * FUNCIÓN DE MANTENIMIENTO — se ejecuta UNA SOLA VEZ a mano, para un
 * código puntual, desde el editor de Apps Script (no la llama la app).
 * Limpia duplicados de un código dejando SOLO el conteo más reciente por
 * cada combinación código+ubicación (mismo criterio que ya usa el
 * Dashboard para elegir qué mostrar) — así lo que quede en la planilla
 * coincide exactamente con lo que ya se ve como "actual" en la app.
 *
 * Cómo usarla:
 *  1. Cambiá CODIGO_A_LIMPIAR por el código que quieras limpiar.
 *  2. Elegí limpiarDuplicadosPorCodigo en el desplegable de funciones.
 *  3. Ejecutar (▷).
 *  4. Mirá el resultado en Ver > Registros de ejecución.
 */
function limpiarDuplicadosPorCodigo() {
  const CODIGO_A_LIMPIAR = "20012645"; // <-- cambiar acá para limpiar otro código

  const sheet = getSheet_(SHEETS.CONTEOS);
  const headers = sincronizarEncabezados_(sheet, HEADERS[SHEETS.CONTEOS]);
  const values = sheet.getDataRange().getValues();

  const codigoCol = headers.indexOf("codigo");
  const ubicacionCol = headers.indexOf("ubicacion");
  const ubicacionNuevaCol = headers.indexOf("ubicacionNueva");
  const creadoEnCol = headers.indexOf("creadoEn");

  const codigoNorm = String(CODIGO_A_LIMPIAR).trim().toLowerCase();

  const grupos = {};

  for (let i = 1; i < values.length; i++) {
    const codigoFila = String(values[i][codigoCol] || "").trim().toLowerCase();
    if (codigoFila !== codigoNorm) continue;

    const ubicNueva = values[i][ubicacionNuevaCol] || "";
    const ubic = values[i][ubicacionCol] || "";
    const clave = ubicNueva || ubic || "";

    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push({ fila: i + 1, creadoEn: values[i][creadoEnCol] });
  }

  const filasABorrar = [];

  Object.values(grupos).forEach((filas) => {
    if (filas.length <= 1) return;

    filas.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
    filas.slice(1).forEach((f) => filasABorrar.push(f.fila));
  });

  filasABorrar.sort((a, b) => b - a).forEach((numeroFila) => sheet.deleteRow(numeroFila));

  logAccion_(
    "limpiarDuplicadosPorCodigo",
    `Código ${CODIGO_A_LIMPIAR}: ${filasABorrar.length} filas duplicadas eliminadas`
  );

  return { codigo: CODIGO_A_LIMPIAR, eliminados: filasABorrar.length };
}
