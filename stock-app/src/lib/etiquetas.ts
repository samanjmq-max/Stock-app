"use client";

export interface DatosEtiqueta {
  codigo: string;
  descripcion: string;
  ubicacion?: string;
  /**
   * Cuántas copias imprimir de esta etiqueta. Si no viene, el servidor
   * asume 1 -- el campo es opcional en la pantalla justamente para que no
   * trance a nadie por no completarlo.
   *
   * Las copias se expanden en el servidor, no acá: mandar 50 veces el
   * mismo artículo en el body sería 50 veces la misma descripción viajando
   * por la red, y el PDF igual se arma allá.
   */
  copias?: number;
}

/** Total de etiquetas que va a tener el PDF (no de renglones de la lista). */
export function contarEtiquetas(lista: DatosEtiqueta[]): number {
  return lista.reduce((suma, item) => suma + Math.max(1, Math.floor(item.copias || 1)), 0);
}

/**
 * Le pide al servidor que arme el PDF de etiquetas (el código de barras se
 * genera del lado del servidor con bwip-js/pdfkit — esto evita los
 * problemas de compatibilidad de las librerías de código de barras en el
 * navegador) y dispara la descarga del archivo resultante.
 */
export async function descargarEtiquetas(lista: DatosEtiqueta[], nombreArchivo = "etiquetas") {
  if (lista.length === 0) return;

  const res = await fetch("/api/etiquetas/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: lista }),
  });

  if (!res.ok) {
    let mensaje = "No se pudo generar el PDF";
    try {
      const json = await res.json();
      if (json?.error) mensaje = json.error;
    } catch {
      // la respuesta de error no era JSON, se usa el mensaje genérico
    }
    throw new Error(mensaje);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
