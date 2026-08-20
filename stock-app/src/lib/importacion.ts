import * as XLSX from "xlsx";
import type { FilaImportacion } from "@/services/productos.service";

export interface ResultadoLectura {
  filasValidas: FilaImportacion[];
  filasInvalidas: { fila: number; motivo: string }[];
  totalFilas: number;
}

const COLUMNAS_ESPERADAS = ["codigo", "descripcion", "ubicacion", "familia", "proveedor", "stockSap", "precioUnitario"];

// Acepta variantes comunes de encabezado (con/sin tilde, mayúsculas, español)
// — incluye tanto el formato simplificado que se usa a diario como los
// nombres de columna tal cual vienen en el export crudo de SAP, para poder
// importar cualquiera de los dos sin convertir nada a mano.
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
  "valor libre util.": "valorLibreUtil", // interno: sirve para calcular precioUnitario, no es un campo final
  "valor libre util": "valorLibreUtil",
};

function normalizarEncabezado(h: string): string {
  return String(h).trim().toLowerCase();
}

/** Lee un archivo .xlsx, .xls o .csv y devuelve las filas normalizadas + errores por fila. */
export async function leerArchivoProductos(file: File): Promise<ResultadoLectura> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const primeraHoja = workbook.Sheets[workbook.SheetNames[0]];
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

    filasValidas.push({
      codigo,
      descripcion,
      ubicacion: String(fila.ubicacion ?? ""),
      familia: String(fila.familia ?? ""),
      proveedor: String(fila.proveedor ?? ""),
      stockSap: stockSapFinal,
      ...(precioUnitario !== undefined ? { precioUnitario } : {}),
    });
  });

  return { filasValidas, filasInvalidas, totalFilas: filas.length };
}

export { COLUMNAS_ESPERADAS };
