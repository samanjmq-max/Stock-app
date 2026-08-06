/**
 * vibracion.ts — patrones de vibración diferenciados. Respeta la
 * preferencia de Configuración (Etapa 3) igual que sonidos.ts.
 */

function vibracionHabilitada(): boolean {
  if (typeof window === "undefined") return true;
  const guardado = localStorage.getItem("config_vibracion");
  return guardado === null ? true : guardado === "true";
}

function vibrar(patron: number | number[]) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (!vibracionHabilitada()) return;
  navigator.vibrate(patron);
}

/** Pulso corto y único — lectura correcta / acción exitosa. */
export function vibrarCorrecto() {
  vibrar(90);
}

/** Dos pulsos cortos separados — error o código no reconocido. */
export function vibrarError() {
  vibrar([70, 60, 70]);
}

/** Pulso largo — advertencia (producto no existe en SAP). */
export function vibrarAdvertencia() {
  vibrar(180);
}
