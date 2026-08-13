"use client";
import { jsPDF } from "jspdf";
// Import defensivo: según cómo empaquete Next.js la librería, a veces el
// export por defecto no llega bien y JsBarcode queda undefined — esto
// cubre los dos casos posibles sin depender de cuál use el bundler.
import * as JsBarcodeNS from "jsbarcode";
const JsBarcode: any = (JsBarcodeNS as any).default ?? JsBarcodeNS;

const PAGE_W_MM = 100; // 10 cm de largo
const PAGE_H_MM = 50;  // 5 cm de ancho
const PX_PER_MM = 96 / 25.4;

export interface DatosEtiqueta {
  codigo: string;
  descripcion: string;
  ubicacion?: string;
}

function truncarTexto(doc: jsPDF, texto: string, anchoMaximoMm: number): string {
  if (!texto) return "";
  if (doc.getTextWidth(texto) <= anchoMaximoMm) return texto;
  let recortado = texto;
  while (recortado.length > 0 && doc.getTextWidth(recortado + "...") > anchoMaximoMm) {
    recortado = recortado.slice(0, -1);
  }
  return recortado ? recortado + "..." : "";
}

function generarBarcodeDataUrl(codigo: string): { dataUrl: string; widthMm: number } {
  if (typeof JsBarcode !== "function") {
    throw new Error("La librería de códigos de barras no cargó correctamente (JsBarcode no es una función).");
  }
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, codigo, {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    width: 1.6,
    height: 90,
  });
  if (!canvas.width) {
    throw new Error("No se pudo dibujar el código de barras (canvas vacío).");
  }
  return { dataUrl: canvas.toDataURL("image/png"), widthMm: canvas.width / PX_PER_MM };
}

export function agregarEtiqueta(doc: jsPDF, datos: DatosEtiqueta, esPrimera: boolean) {
  if (!datos.codigo || !datos.codigo.trim()) {
    throw new Error("Falta el código del artículo.");
  }
  if (!esPrimera) doc.addPage([PAGE_W_MM, PAGE_H_MM], "landscape");

  const anchoUtil = PAGE_W_MM - 8;
  doc.setFont("helvetica", "bold");

  doc.setFontSize(9);
  doc.text(truncarTexto(doc, datos.descripcion || "", anchoUtil), PAGE_W_MM / 2, 6, { align: "center" });

  if (datos.ubicacion) {
    doc.setFontSize(8.5);
    doc.text(truncarTexto(doc, `Ubic.: ${datos.ubicacion}`, anchoUtil), PAGE_W_MM / 2, 10, { align: "center" });
  }

  const { dataUrl, widthMm } = generarBarcodeDataUrl(datos.codigo.trim());
  doc.addImage(dataUrl, "PNG", (PAGE_W_MM - widthMm) / 2, 12, widthMm, 13);

  doc.setFontSize(11);
  doc.text(datos.codigo.trim(), PAGE_W_MM / 2, 29, { align: "center" });
}

export function descargarEtiquetas(lista: DatosEtiqueta[], nombreArchivo = "etiqueta") {
  if (lista.length === 0) return;
  const doc = new jsPDF({ unit: "mm", format: [PAGE_W_MM, PAGE_H_MM], orientation: "landscape" });
  lista.forEach((item, i) => agregarEtiqueta(doc, item, i === 0));
  doc.save(`${nombreArchivo}.pdf`);
}
