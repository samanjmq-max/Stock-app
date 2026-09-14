import type { FilaImportacion } from "@/services/productos.service";

export interface ResultadoLectura {
  filasValidas: FilaImportacion[];
  filasInvalidas: { fila: number; motivo: string }[];
  totalFilas: number;
  /**
   * Si el archivo traía alguna columna de precio. Cuando es `false`, la
   * importación NO borra los precios ya cargados -- Apps Script solo pisa el
   * precio si la fila trae uno -- pero conviene decirlo, porque si alguien
   * sube el archivo esperando actualizar precios y no pasa nada, el silencio
   * se parece demasiado a un error.
   */
  traePrecio: boolean;
  /** Si el archivo traía columna de unidad de medida. Misma lógica que el precio. */
  traeUnidad: boolean;
}

const COLUMNAS_ESPERADAS = ["codigo", "descripcion", "ubicacion", "familia", "proveedor", "stockSap", "precioUnitario"];

/*
  ============================================================================
  El formato del archivo
  ============================================================================

  Estas seis columnas son obligatorias y el archivo se rechaza entero si le
  falta alguna. Es a propósito, y es más duro que antes.

  El motivo: cuando se importa un código que YA existe, Apps Script pisa su
  ficha con lo que venga en el archivo. Si el archivo no trae la columna de
  ubicación, lo que "viene" es vacío, y el resultado es que se le borra la
  ubicación a todos los artículos de esa planta de un saque -- justo el dato
  con el que el operario camina el depósito. Antes eso pasaba en silencio y
  se descubría al día siguiente, contando.

  Se podría haber arreglado del otro lado (que el script ignore lo vacío),
  pero eso deja pasar archivos distintos en cada planta y termina en nueve
  formatos diferentes. Rechazar acá es lo que mantiene el patrón: una sola
  planilla, la misma para las nueve.

  El precio queda aparte, como opcional: no se borra nunca si no viene (tiene
  su propia protección en el script), y hay plantas que todavía no lo cargan.
*/
export interface ColumnaRequerida {
  campo: string;
  etiqueta: string;
  /** Nombres de encabezado aceptados, para poder decir qué escribir. */
  acepta: string[];
}

export const COLUMNAS_REQUERIDAS: ColumnaRequerida[] = [
  { campo: "codigo", etiqueta: "Código", acepta: ["codigo", "Material"] },
  { campo: "descripcion", etiqueta: "Descripción", acepta: ["descripcion", "Texto breve de material"] },
  { campo: "ubicacion", etiqueta: "Ubicación", acepta: ["ubicacion"] },
  { campo: "familia", etiqueta: "Familia", acepta: ["familia", "Grupo de artículos"] },
  { campo: "proveedor", etiqueta: "Proveedor", acepta: ["proveedor"] },
  { campo: "stockSap", etiqueta: "Stock SAP", acepta: ["stockSap", "Libre utilización"] },
];

export const COLUMNA_PRECIO: ColumnaRequerida = {
  campo: "precioUnitario",
  etiqueta: "Precio unitario",
  acepta: ["precio unitario", "Valor libre util."],
};

/*
  Unidad de medida: UN, KG, L, M...

  Va en la plantilla y se importa, pero NO es obligatoria todavía. Ninguno de
  los archivos que están dando vueltas hoy la trae, así que exigirla haría
  rebotar el primer archivo que suba cada planta el día del deploy. Como
  además es de las que no se pisan si no vienen (misma protección que el
  precio en Apps Script), tenerla opcional no rompe ningún dato.

  Cuando las nueve plantas estén mandando la planilla nueva, pasarla a
  COLUMNAS_REQUERIDAS es mover una línea.
*/
export const COLUMNA_UNIDAD: ColumnaRequerida = {
  campo: "unidadMedida",
  etiqueta: "Unidad de medida",
  acepta: ["unidad", "unidad de medida", "UMB"],
};

/** Error de formato: el archivo no tiene las columnas mínimas. */
export interface ErrorDeColumnas extends Error {
  columnasFaltantes: ColumnaRequerida[];
  columnasEncontradas: string[];
}

export function esErrorDeColumnas(e: unknown): e is ErrorDeColumnas {
  return e instanceof Error && Array.isArray((e as ErrorDeColumnas).columnasFaltantes);
}

// Acepta variantes comunes de encabezado (con/sin tilde, mayúsculas, español),
// incluidos los nombres tal cual vienen en el export crudo de SAP, para no
// tener que renombrar columnas a mano.
//
// OJO: que un nombre esté acá NO alcanza para que el archivo pase. El export
// crudo de SAP no trae ubicación ni proveedor, y esas dos son obligatorias
// (ver COLUMNAS_REQUERIDAS, más abajo), así que hay que agregárselas antes de
// subirlo. Es deliberado: sin la columna de ubicación, importar le borra la
// ubicación a todos los artículos de la planta.
const ALIAS_COLUMNAS: Record<string, string> = {
  // Formato simplificado (uso diario)
  codigo: "codigo",
  código: "codigo",
  descripcion: "descripcion",
  descripción: "descripcion",
  ubicacion: "ubicacion",
  ubicación: "ubicacion",
  familia: "familia",
  proveedor: "proveedor",
  stocksap: "stockSap",
  "stock sap": "stockSap",
  stock: "stockSap",
  unidad: "unidadMedida",
  "unidad de medida": "unidadMedida",
  unidadmedida: "unidadMedida",
  um: "unidadMedida",
  "u.m.": "unidadMedida",
  preciounitario: "precioUnitario",
  "precio unitario": "precioUnitario",
  precio: "precioUnitario",

  // Export crudo de SAP
  material: "codigo",
  "texto breve de material": "descripcion",
  "libre utilización": "stockSap",
  "libre utilizacion": "stockSap",
  "grupo de artículos": "familia",
  "grupo de articulos": "familia",
  umb: "unidadMedida",
  "unidad medida base": "unidadMedida",
  "valor libre util.": "valorLibreUtil", // interno: sirve para calcular precioUnitario, no es un campo final
  "valor libre util": "valorLibreUtil",
};

function normalizarEncabezado(h: string): string {
  return String(h).trim().toLowerCase();
}

/**
 * Lee un archivo .xlsx, .xls o .csv y devuelve las filas normalizadas +
 * errores por fila.
 *
 * `xlsx` se carga dinámicamente -- solo lo usa el diálogo de importación de
 * Productos (admin), así que no tiene sentido que viaje en el bundle
 * inicial de esa página para todo el mundo.
 */
export async function leerArchivoProductos(file: File): Promise<ResultadoLectura> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const nombreHoja = workbook.SheetNames[0];
  if (!nombreHoja) {
    throw new Error("El archivo no tiene ninguna hoja");
  }
  const primeraHoja = workbook.Sheets[nombreHoja]!;

  /*
    Primero los ENCABEZADOS, antes de mirar una sola fila.

    Se lee con `header: 1`, que devuelve la hoja como arreglo de arreglos, y
    se toma la primera fila. No sirve mirar las claves de las filas ya
    convertidas a objeto: si el archivo tiene encabezados pero ninguna fila
    de datos, no hay ningún objeto del que sacar las claves y el archivo
    pasaría como "válido pero vacío".
  */
  const matriz = XLSX.utils.sheet_to_json(primeraHoja, { header: 1, blankrows: false }) as unknown[][];
  const encabezados = (matriz[0] ?? []).map((h) => String(h ?? "").trim()).filter(Boolean);

  const camposPresentes = new Set<string>();
  for (const h of encabezados) {
    const campo = ALIAS_COLUMNAS[normalizarEncabezado(h)];
    if (campo) camposPresentes.add(campo);
  }

  const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !camposPresentes.has(c.campo));
  if (faltantes.length > 0) {
    const error = new Error(
      `Al archivo le faltan ${faltantes.length === 1 ? "esta columna" : "estas columnas"}: ${faltantes
        .map((c) => c.etiqueta)
        .join(", ")}.`
    ) as ErrorDeColumnas;
    error.columnasFaltantes = faltantes;
    error.columnasEncontradas = encabezados;
    throw error;
  }

  // "Valor libre util." es el total de la línea, no el precio de una unidad,
  // pero sirve para calcularlo: cualquiera de las dos cuenta como precio.
  const traePrecio = camposPresentes.has("precioUnitario") || camposPresentes.has("valorLibreUtil");
  const traeUnidad = camposPresentes.has("unidadMedida");

  const filas: Record<string, unknown>[] = XLSX.utils.sheet_to_json(primeraHoja, { defval: "" });

  const filasValidas: FilaImportacion[] = [];
  const filasInvalidas: { fila: number; motivo: string }[] = [];

  filas.forEach((filaCruda, i) => {
    const fila: Record<string, unknown> = {};
    Object.entries(filaCruda).forEach(([key, value]) => {
      const normalizado = ALIAS_COLUMNAS[normalizarEncabezado(key)];
      if (normalizado) fila[normalizado] = value;
    });

    const codigo = String(fila.codigo ?? "").trim();
    const descripcion = String(fila.descripcion ?? "").trim();
    const stockSapRaw = fila.stockSap;

    if (!codigo) {
      filasInvalidas.push({ fila: i + 2, motivo: "Falta el código" }); // +2: fila 1 es encabezado
      return;
    }
    if (!descripcion) {
      filasInvalidas.push({ fila: i + 2, motivo: "Falta la descripción" });
      return;
    }
    const stockSap = Number(stockSapRaw);
    if (stockSapRaw !== "" && stockSapRaw !== undefined && isNaN(stockSap)) {
      filasInvalidas.push({ fila: i + 2, motivo: `Stock SAP inválido: "${stockSapRaw}"` });
      return;
    }
    const stockSapFinal = isNaN(stockSap) ? 0 : stockSap;

    // Precio unitario: si vino una columna de precio directa, se usa esa.
    // Si no, pero vino "Valor libre util." (el total en pesos de esa línea
    // de stock, tal como lo exporta SAP), se calcula dividiendo por la
    // cantidad — nunca se divide por cero.
    let precioUnitario: number | undefined;
    if (fila.precioUnitario !== undefined && fila.precioUnitario !== "") {
      const p = Number(fila.precioUnitario);
      if (!isNaN(p)) precioUnitario = p;
    } else if (fila.valorLibreUtil !== undefined && fila.valorLibreUtil !== "" && stockSapFinal > 0) {
      const valorTotal = Number(fila.valorLibreUtil);
      if (!isNaN(valorTotal)) precioUnitario = valorTotal / stockSapFinal;
    }

    // La unidad se manda SOLO si la celda trae algo. Mandar "" haría que el
    // script la pise con vacío, que es justo lo que no queremos mientras la
    // columna sea opcional y haya productos con la unidad ya cargada.
    const unidadMedida = String(fila.unidadMedida ?? "").trim().toUpperCase();

    filasValidas.push({
      codigo,
      descripcion,
      ubicacion: String(fila.ubicacion ?? ""),
      familia: String(fila.familia ?? ""),
      proveedor: String(fila.proveedor ?? ""),
      stockSap: stockSapFinal,
      ...(unidadMedida ? { unidadMedida } : {}),
      ...(precioUnitario !== undefined ? { precioUnitario } : {}),
    });
  });

  return { filasValidas, filasInvalidas, totalFilas: filas.length, traePrecio, traeUnidad };
}

/**
 * Arma la planilla modelo: una fila de encabezados con los nombres exactos
 * que la app espera, más una fila de ejemplo.
 *
 * Existe para que "el patrón" sea algo que se baja, no algo que cada planta
 * interpreta de un instructivo. Es la forma más barata de que las nueve
 * manden el mismo archivo.
 */
export async function descargarPlantillaProductos() {
  const XLSX = await import("xlsx");

  const encabezados = [...COLUMNAS_REQUERIDAS.map((c) => c.campo), COLUMNA_UNIDAD.campo, COLUMNA_PRECIO.campo];

  // Dos filas de ejemplo, y la segunda es un líquido a propósito: es el caso
  // que hace falta la unidad. Con "45" a secas no se sabe si son 45 bidones
  // o 45 litros, y el que cuenta necesita saberlo.
  const ejemplos = [
    ["50232", "ALMENDRA PEL. TOST. Y SAL. L.A. 100 G", "CL-A-A-001", "SECOS", "LA ANONIMA", 120, "UN", 85.5],
    ["50418", "ACEITE DE GIRASOL A GRANEL", "CL-B-C-014", "ACEITES", "COUSA", 450, "L", 62],
  ];

  const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...ejemplos]);
  hoja["!cols"] = [{ wch: 12 }, { wch: 42 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 14 }];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Productos");
  XLSX.writeFile(libro, "plantilla-importacion-stock.xlsx");
}

export { COLUMNAS_ESPERADAS };
