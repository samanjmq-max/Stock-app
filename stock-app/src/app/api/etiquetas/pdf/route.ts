import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
import { leerHeaderTexto } from "@/lib/headers";

// 1mm en puntos PDF (72 puntos = 1 pulgada = 25.4mm)
const MM = 72 / 25.4;
const PAGE_W = 100 * MM; // 10 cm de largo
const PAGE_H = 50 * MM;  // 5 cm de ancho

interface ItemEtiqueta {
  codigo: string;
  descripcion?: string;
  ubicacion?: string;
}

function truncar(doc: PDFKit.PDFDocument, texto: string, tam: number, anchoMax: number): string {
  if (!texto) return "";
  doc.fontSize(tam);
  if (doc.widthOfString(texto) <= anchoMax) return texto;
  let recortado = texto;
  while (recortado.length > 0 && doc.widthOfString(recortado + "...") > anchoMax) {
    recortado = recortado.slice(0, -1);
  }
  return recortado ? recortado + "..." : "";
}

export async function POST(request: NextRequest) {
  const rol = leerHeaderTexto(request, "x-user-rol");
  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede generar etiquetas" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const items: ItemEtiqueta[] = Array.isArray(body.items) ? body.items : [];
    const validos = items.filter((i) => i.codigo && i.codigo.trim());

    if (validos.length === 0) {
      return NextResponse.json({ ok: false, error: "No se recibieron artículos válidos" }, { status: 400 });
    }

    const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    const listo = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    for (const item of validos) {
      doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });

      const margen = 4 * MM;
      const anchoUtil = PAGE_W - margen * 2;

      doc.font("Helvetica-Bold");

      const desc = truncar(doc, item.descripcion || "", 9, anchoUtil);
      doc.fontSize(9).text(desc, margen, 4 * MM, { width: anchoUtil, align: "center" });

      if (item.ubicacion) {
        const ubic = truncar(doc, `Ubic.: ${item.ubicacion}`, 8.5, anchoUtil);
        doc.fontSize(8.5).text(ubic, margen, 8 * MM, { width: anchoUtil, align: "center" });
      }

      const png = await bwipjs.toBuffer({
        bcid: "code128",
        text: item.codigo.trim(),
        scale: 3,
        height: 12,
        includetext: false,
        backgroundcolor: "FFFFFF",
      });

      // "fit" escala el código de barras preservando sus proporciones —
      // nunca lo deforma, solo lo agranda o achica entero por igual.
      doc.image(png, margen, 12 * MM, { fit: [anchoUtil, 13 * MM], align: "center" });

      doc.fontSize(11).text(item.codigo.trim(), margen, 27 * MM, { width: anchoUtil, align: "center" });
    }

    doc.end();
    const pdfBuffer = await listo;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="etiquetas.pdf"',
      },
    });
  } catch (err) {
    console.error("Error al generar etiquetas PDF:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
