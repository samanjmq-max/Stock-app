import * as XLSX from "xlsx";
import type { FilaImportacion } from "@/services/productos.service";

export interface ResultadoLectura {
  filasValidas: FilaImportacion[];
  filasInvalidas: { fila: number; motivo: string }[];
  totalFilas: number;
}

const COLUMNAS_ESPERADAS = ["codigo", "descripcion", "ubicacion", "familia", "proveedor", "stockSap"];

// Acepta variantes comunes de encabezado (con/sin tilde, mayúsculas, español)
const ALIAS_COLUMNAS: Record<string, string> = {
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

    filasValidas.push({
      codigo,
      descripcion,
      ubicacion: String(fila.ubicacion ?? ""),
      familia: String(fila.familia ?? ""),
      proveedor: String(fila.proveedor ?? ""),
      stockSap: isNaN(stockSap) ? 0 : stockSap,
    });
  });

  return { filasValidas, filasInvalidas, totalFilas: filas.length };
}

export { COLUMNAS_ESPERADAS };
