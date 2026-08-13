"use client";

export interface DatosEtiqueta {
  codigo: string;
  descripcion: string;
  ubicacion?: string;
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
