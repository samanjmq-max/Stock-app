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

/*
  ============================================================================
  Tandas: varios PDF en vez de uno imposible
  ============================================================================

  El tope de 500 etiquetas por PDF no es un capricho: el archivo se arma
  entero en memoria en una función de Vercel, y un PDF de 1400 páginas la
  tumba. Pero el tope, solo, es una pared -- subir el stock completo de una
  planta y que la app conteste "son 1388 y el máximo es 500, arreglátelas" no
  resuelve nada, porque partir la lista a mano es exactamente el trabajo que
  la app tendría que estar ahorrando.

  Así que el tope se queda y la app parte sola. La persona elige EN CUÁNTOS
  archivos, no cuántas etiquetas por archivo: uno piensa "quiero esto en tres
  PDF", no "quiero 463 etiquetas por PDF".
*/
export const MAX_POR_PDF = 500;

/**
 * Parte la lista en tandas de a lo sumo `maxPorTanda` etiquetas.
 *
 * Si un artículo no entra entero, se parten sus COPIAS entre dos tandas.
 * Suena raro pero es lo correcto: las copias de un mismo artículo son
 * etiquetas idénticas, así que da igual en qué archivo caiga cada una, y
 * partirlas garantiza que los archivos salgan del tamaño pedido. La
 * alternativa (no cortar nunca un artículo) devuelve a veces un archivo más
 * de los que la persona pidió, que es justo lo que no queremos.
 */
export function dividirEnTandas(lista: DatosEtiqueta[], maxPorTanda: number): DatosEtiqueta[][] {
  const tope = Math.max(1, Math.floor(maxPorTanda));
  const tandas: DatosEtiqueta[][] = [];
  let actual: DatosEtiqueta[] = [];
  let enActual = 0;

  for (const item of lista) {
    let restantes = Math.max(1, Math.floor(item.copias || 1));
    while (restantes > 0) {
      if (enActual >= tope) {
        tandas.push(actual);
        actual = [];
        enActual = 0;
      }
      const toma = Math.min(tope - enActual, restantes);
      actual.push({ ...item, copias: toma });
      enActual += toma;
      restantes -= toma;
    }
  }

  if (actual.length > 0) tandas.push(actual);
  return tandas;
}

/**
 * Le pide al servidor todos los PDF que hagan falta y los descarga uno
 * detrás del otro.
 *
 * Van en serie, no en paralelo: cada PDF es una función de Vercel armando
 * cientos de códigos de barras, y disparar tres a la vez es la forma más
 * rápida de que se caigan las tres. La pausa entre descargas es para el
 * navegador, no para el servidor -- Chrome bloquea las descargas seguidas si
 * llegan pegadas, y encima le pregunta al usuario si permite "varios
 * archivos". Por eso la pantalla avisa antes de empezar.
 */
export async function descargarEtiquetasEnTandas(
  lista: DatosEtiqueta[],
  nombreBase: string,
  maxPorTanda: number = MAX_POR_PDF,
  alAvanzar?: (hechos: number, total: number) => void
): Promise<number> {
  if (lista.length === 0) return 0;

  const tandas = dividirEnTandas(lista, Math.min(maxPorTanda, MAX_POR_PDF));

  for (let i = 0; i < tandas.length; i++) {
    const nombre = tandas.length === 1 ? nombreBase : `${nombreBase}-parte-${i + 1}-de-${tandas.length}`;
    await descargarEtiquetas(tandas[i]!, nombre);
    alAvanzar?.(i + 1, tandas.length);
    if (i < tandas.length - 1) {
      await new Promise((resolver) => setTimeout(resolver, 800));
    }
  }

  return tandas.length;
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
