/**
 * sonidos.ts — feedback sonoro generado con Web Audio API. No usa archivos
 * de audio (evita peso extra y problemas de autoplay), sintetiza tonos
 * cortos con osciladores. El volumen y la posibilidad de silenciar se
 * controlan desde Configuración (Etapa 3) vía localStorage.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  return ctx;
}

function sonidosHabilitados(): boolean {
  if (typeof window === "undefined") return true;
  const guardado = localStorage.getItem("config_sonidos");
  return guardado === null ? true : guardado === "true";
}

function tono(frecuencia: number, duracionMs: number, tipo: OscillatorType = "sine", volumen = 0.2, delayMs = 0) {
  const audioCtx = getContext();
  if (!audioCtx || !sonidosHabilitados()) return;

  const start = audioCtx.currentTime + delayMs / 1000;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = tipo;
  osc.frequency.value = frecuencia;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(volumen, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duracionMs / 1000);
  osc.start(start);
  osc.stop(start + duracionMs / 1000);
}

/** Beep agudo y corto — lectura de código correcta. */
export function sonidoLecturaCorrecta() {
  tono(1100, 90, "sine", 0.22);
}

/** Doble tono grave — lectura incorrecta / código no reconocido por la cámara. */
export function sonidoLecturaIncorrecta() {
  tono(220, 140, "square", 0.18);
  tono(180, 160, "square", 0.18, 140);
}

/** Tono de advertencia — producto no existe en SAP. */
export function sonidoProductoInexistente() {
  tono(600, 100, "triangle", 0.2);
  tono(400, 140, "triangle", 0.2, 110);
}

/** Acorde ascendente corto — conteo guardado con éxito. */
export function sonidoConteoGuardado() {
  tono(880, 80, "sine", 0.2);
  tono(1320, 120, "sine", 0.2, 80);
}
