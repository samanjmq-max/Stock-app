import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import bwipjs from "bwip-js";
import { leerSesion } from "@/lib/sesion";

// bwip-js necesita Node (no funciona en Edge Runtime).
export const runtime = "nodejs";

const PAGE_W_MM = 100; // 10 cm de largo
const PAGE_H_MM = 50;  // 5 cm de ancho

/*
  Topes de seguridad. No son una política, son un freno: el PDF se arma
  entero en memoria en una función de Vercel, así que un "999 copias" por
  error de tipeo no debe poder tumbar la ruta ni devolver un archivo de
  cientos de megas. Los números son holgados para el uso real (etiquetar
  una posición entera son decenas, no cientos) y el mensaje dice qué pasó.
*/
const MAX_COPIAS_POR_ITEM = 100;
const MAX_ETIQUETAS = 500;

interface ItemEtiqueta {
  codigo: string;
  descripcion?: string;
  ubicacion?: string;
  copias?: number;
}

/**
 * Cuántas copias imprimir de un artículo.
 *
 * Vacío, cero, texto o basura => 1. Es a propósito: el campo de copias es
 * opcional en la pantalla y no tiene que trancar a nadie por no completarlo.
 * Quien no lo toca quiere una etiqueta, que es lo que pasaba antes de que
 * el campo existiera.
 */
function normalizarCopias(valor: unknown): number {
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_COPIAS_POR_ITEM);
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
  /*
    PERMISO. Antes acá decía `rol !== "administrador"`, y eso dejaba a los
    encargados de almacén con el módulo de etiquetas a la vista y el botón
    de generar devolviendo 403 -- el peor de los dos mundos: la pantalla
    prometía algo que el servidor negaba.

    El menú ya pregunta por la capacidad `etiquetas`; esta ruta tiene que
    preguntar exactamente lo mismo, si no vuelven a opinar distinto. `rol`
    sigue existiendo como control grueso (el middleware ya dejó entrar),
    pero quién puede QUÉ lo decide el perfil.
  */
  const sesion = leerSesion(request);
  if (!sesion || !sesion.capacidades.etiquetas) {
    return NextResponse.json({ ok: false, error: "No tenés permiso para generar etiquetas" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const items: ItemEtiqueta[] = Array.isArray(body.items) ? body.items : [];
    const validos = items
      .filter((i) => i.codigo && String(i.codigo).trim())
      .map((i) => ({ ...i, copias: normalizarCopias(i.copias) }));

    if (validos.length === 0) {
      return NextResponse.json({ ok: false, error: "No se recibieron artículos válidos" }, { status: 400 });
    }

    const totalEtiquetas = validos.reduce((suma, i) => suma + i.copias, 0);
    if (totalEtiquetas > MAX_ETIQUETAS) {
      return NextResponse.json(
        {
          ok: false,
          error: `Son ${totalEtiquetas} etiquetas y el máximo por PDF es ${MAX_ETIQUETAS}. Bajá las copias o generá el archivo en dos tandas.`,
        },
        { status: 400 }
      );
    }

    const doc = new jsPDF({ unit: "mm", format: [PAGE_W_MM, PAGE_H_MM], orientation: "landscape" });
    const anchoUtil = PAGE_W_MM - 8;

    // El código de barras se dibuja una sola vez por código y se reutiliza
    // en cada copia. Con 50 copias del mismo artículo, generarlo 50 veces
    // es 50 veces el mismo PNG y el mismo trabajo de CPU para nada.
    const barrasPorCodigo = new Map<string, string>();
    let primeraPagina = true;

    for (const item of validos) {
      const codigoLimpio = String(item.codigo).trim();

      let dataUrl = barrasPorCodigo.get(codigoLimpio);
      if (!dataUrl) {
        const png = await bwipjs.toBuffer({
          bcid: "code128",
          text: codigoLimpio,
          scale: 3,
          height: 12,
          includetext: false,
          backgroundcolor: "FFFFFF",
        });
        dataUrl = `data:image/png;base64,${png.toString("base64")}`;
        barrasPorCodigo.set(codigoLimpio, dataUrl);
      }

      for (let copia = 0; copia < item.copias; copia++) {
        if (!primeraPagina) doc.addPage([PAGE_W_MM, PAGE_H_MM], "landscape");
        primeraPagina = false;

        doc.setFont("helvetica", "bold");

        doc.setFontSize(9);
        doc.text(truncar(doc, item.descripcion || "", anchoUtil), PAGE_W_MM / 2, 6, { align: "center" });

        if (item.ubicacion) {
          doc.setFontSize(8.5);
          doc.text(truncar(doc, `Ubic.: ${item.ubicacion}`, anchoUtil), PAGE_W_MM / 2, 10, { align: "center" });
        }

        // Ancho fijo centrado: mantiene todas las etiquetas visualmente
        // consistentes, sin importar el largo del código.
        const anchoBarra = 60;
        doc.addImage(dataUrl, "PNG", (PAGE_W_MM - anchoBarra) / 2, 12, anchoBarra, 13);

        doc.setFontSize(11);
        doc.text(codigoLimpio, PAGE_W_MM / 2, 29, { align: "center" });
      }
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
