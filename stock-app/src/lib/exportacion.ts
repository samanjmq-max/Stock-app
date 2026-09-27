/*
  Saneo anti-inyección de fórmulas (CSV/Excel injection).

  Un valor de texto que empieza con = + - @ (o tab/retorno) es interpretado
  como FÓRMULA por Excel/Sheets al abrir el archivo. Como el catálogo viene
  de SAP y de importaciones, una descripción como `=IMPORTDATA("http://...")`
  se ejecutaría en la máquina de quien abra el documento exportado. Se
  antepone un apóstrofo (Excel lo trata como texto) SOLO a los textos que
  arrancan con esos caracteres y que NO son un número legítimo (para no
  romper columnas numéricas ni los negativos de "Diferencia"/"Importe").
*/
const RE_FORMULA = /^[=+\-@\t\r]/;
function sanitizarValor(v: unknown): unknown {
  if (typeof v !== "string") return v;
  if (v.trim() !== "" && !isNaN(Number(v.replace(/\./g, "").replace(",", ".")))) return v;
  return RE_FORMULA.test(v) ? "'" + v : v;
}
function sanitizarDatos(datos: Record<string, unknown>[]): Record<string, unknown>[] {
  return datos.map((fila) => {
    const out: Record<string, unknown> = {};
    for (const clave in fila) out[clave] = sanitizarValor(fila[clave]);
    return out;
  });
}

function descargarArchivo(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Exporta un array de objetos a un archivo .xlsx descargable.
 *
 * `xlsx` se carga dinámicamente (como ya hace `exportarPDF` con jsPDF) en
 * vez de importarse a nivel de módulo: es una librería pesada que antes
 * entraba en el bundle inicial de Dashboard/Productos/Historial aunque el
 * usuario nunca tocara el botón de exportar. Mismo criterio, ahora
 * consistente en los tres formatos de export.
 */
export async function exportarExcel(datos: Record<string, unknown>[], nombreHoja: string, nombreArchivo: string) {
  const XLSX = await import("xlsx");
  const hoja = XLSX.utils.json_to_sheet(sanitizarDatos(datos));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`);
}

/** Exporta un array de objetos a un archivo .csv descargable. */
export async function exportarCSV(datos: Record<string, unknown>[], nombreArchivo: string) {
  const XLSX = await import("xlsx");
  const hoja = XLSX.utils.json_to_sheet(sanitizarDatos(datos));
  const csv = XLSX.utils.sheet_to_csv(hoja);
  descargarArchivo(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${nombreArchivo}.csv`);
}

/** Exporta un array de objetos a un PDF tabular descargable (carga jsPDF dinámicamente). */
export async function exportarPDF(
  datos: Record<string, unknown>[],
  columnas: { header: string; key: string }[],
  titulo: string,
  nombreArchivo: string
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(titulo, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generado el ${new Date().toLocaleString("es-UY")}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [columnas.map((c) => c.header)],
    body: datos.map((fila) => columnas.map((c) => String(fila[c.key] ?? ""))),
    styles: { fontSize: 8, cellPadding: 3 },
    // Terracotta (--primary de globals.css) en vez del azul cobalto del
    // sistema de diseño viejo, que quedó pisado acá cuando se migró la
    // paleta cálida (design-system/stockapp-saman/MASTER.md §2).
    headStyles: { fillColor: [141, 76, 27] },
    alternateRowStyles: { fillColor: [247, 243, 236] },
  });

  doc.save(`${nombreArchivo}.pdf`);
}
