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
  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`);
}

/** Exporta un array de objetos a un archivo .csv descargable. */
export async function exportarCSV(datos: Record<string, unknown>[], nombreArchivo: string) {
  const XLSX = await import("xlsx");
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
    // Terracotta (--primary de globals.css) en vez del azul cobalto del
    // sistema de diseño viejo, que quedó pisado acá cuando se migró la
    // paleta cálida (design-system/stockapp-saman/MASTER.md §2).
    headStyles: { fillColor: [141, 76, 27] },
    alternateRowStyles: { fillColor: [247, 243, 236] },
  });

  doc.save(`${nombreArchivo}.pdf`);
}
