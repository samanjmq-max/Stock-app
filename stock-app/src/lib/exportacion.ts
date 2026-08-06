import * as XLSX from "xlsx";

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

/** Exporta un array de objetos a un archivo .xlsx descargable. */
export function exportarExcel(datos: Record<string, unknown>[], nombreHoja: string, nombreArchivo: string) {
  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`);
}

/** Exporta un array de objetos a un archivo .csv descargable. */
export function exportarCSV(datos: Record<string, unknown>[], nombreArchivo: string) {
  const hoja = XLSX.utils.json_to_sheet(datos);
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
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`${nombreArchivo}.pdf`);
}
