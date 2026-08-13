import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import bwipjs from "bwip-js";
import { leerHeaderTexto } from "@/lib/headers";

// bwip-js necesita Node (no funciona en Edge Runtime).
export const runtime = "nodejs";

const PAGE_W_MM = 100; // 10 cm de largo
const PAGE_H_MM = 50;  // 5 cm de ancho

interface ItemEtiqueta {
  codigo: string;
  descripcion?: string;
  ubicacion?: string;
}

function truncar(doc: jsPDF, texto: string, anchoMaximoMm: number): string {
  if (!texto) return "";
  if (doc.getTextWidth(texto) <= anchoMaximoMm) return texto;
  let recortado = texto;
  while (recortado.length > 0 && doc.getTextWidth(recortado + "...") > anchoMaximoMm) {
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
    const validos = items.filter((i) => i.codigo && String(i.codigo).trim());

    if (validos.length === 0) {
      return NextResponse.json({ ok: false, error: "No se recibieron artículos válidos" }, { status: 400 });
    }

    const doc = new jsPDF({ unit: "mm", format: [PAGE_W_MM, PAGE_H_MM], orientation: "landscape" });
    const anchoUtil = PAGE_W_MM - 8;

    for (let i = 0; i < validos.length; i++) {
      const item = validos[i];
      const codigoLimpio = String(item.codigo).trim();

      if (i > 0) doc.addPage([PAGE_W_MM, PAGE_H_MM], "landscape");

      doc.setFont("helvetica", "bold");

      doc.setFontSize(9);
      doc.text(truncar(doc, item.descripcion || "", anchoUtil), PAGE_W_MM / 2, 6, { align: "center" });

      if (item.ubicacion) {
        doc.setFontSize(8.5);
        doc.text(truncar(doc, `Ubic.: ${item.ubicacion}`, anchoUtil), PAGE_W_MM / 2, 10, { align: "center" });
      }

      const png = await bwipjs.toBuffer({
        bcid: "code128",
        text: codigoLimpio,
        scale: 3,
        height: 12,
        includetext: false,
        backgroundcolor: "FFFFFF",
      });
      const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

      // Ancho fijo centrado: mantiene todas las etiquetas visualmente
      // consistentes, sin importar el largo del código.
      const anchoBarra = 60;
      doc.addImage(dataUrl, "PNG", (PAGE_W_MM - anchoBarra) / 2, 12, anchoBarra, 13);

      doc.setFontSize(11);
      doc.text(codigoLimpio, PAGE_W_MM / 2, 29, { align: "center" });
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

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
