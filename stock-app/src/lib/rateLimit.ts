import "server-only";
import { Redis } from "@upstash/redis";

/**
 * rateLimit.ts — protege el login (y la recuperación de contraseña) contra
 * fuerza bruta contando los intentos fallidos.
 *
 * Cómo funciona ahora (dos modos, elige solo):
 *
 *   1. CON Upstash Redis (recomendado en producción): si están las variables
 *      de entorno UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN, el
 *      conteo vive en Redis, COMPARTIDO entre todas las instancias que Vercel
 *      levante. Ahí el límite es real y firme aunque haya mucho tráfico.
 *
 *   2. SIN Upstash (memoria local): si esas variables no están —caso típico
 *      del desarrollo local, o si todavía no configuraste Upstash— cae al
 *      contador en memoria de siempre. Funciona perfecto en una sola
 *      instancia; su única limitación es la que ya conocíamos (con varias
 *      instancias en paralelo, cada una cuenta por su lado).
 *
 * Además, si Redis está configurado pero falla en caliente (se cae, timeout),
 * NO tumba el login: esa llamada puntual degrada al contador en memoria y se
 * registra el error. Preferimos seguir protegiendo con memoria antes que
 * dejar a todo el mundo afuera por un problema de Redis.
 *
 * El resto del código (login/route.ts, recuperar/route.ts) solo tuvo que
 * pasar a `await` estas funciones — la firma y el comportamiento son los
 * mismos de antes.
 */

const MAX_INTENTOS = 5;
const VENTANA_MS = 10 * 60 * 1000; // 10 minutos

// -------------------------------------------------------------------------
// Cliente de Redis (solo si están las dos variables). Si falta alguna, queda
// en null y todo el archivo usa el contador en memoria.
// -------------------------------------------------------------------------
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// -------------------------------------------------------------------------
// Contador en memoria (fallback). Es el mismo de antes.
// -------------------------------------------------------------------------
interface Intento {
  cantidad: number;
  primerIntentoEn: number;
  ventanaMs: number;
}

const intentosPorClave = new Map<string, Intento>();

// Limpieza periódica para no acumular memoria indefinidamente.
const VENTANA_LIMPIEZA_MS = 60 * 60 * 1000; // 1 hora
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, intento] of intentosPorClave.entries()) {
    if (ahora - intento.primerIntentoEn > intento.ventanaMs) intentosPorClave.delete(clave);
  }
}, VENTANA_LIMPIEZA_MS).unref?.();

function estaLimitadoEnMemoria(clave: string, maxIntentos: number, ventanaMs: number): boolean {
  const intento = intentosPorClave.get(clave);
  if (!intento) return false;
  const dentroDeVentana = Date.now() - intento.primerIntentoEn < ventanaMs;
  return dentroDeVentana && intento.cantidad >= maxIntentos;
}

function registrarFalloEnMemoria(clave: string, ventanaMs: number): void {
  const ahora = Date.now();
  const intento = intentosPorClave.get(clave);
  if (!intento || ahora - intento.primerIntentoEn > ventanaMs) {
    intentosPorClave.set(clave, { cantidad: 1, primerIntentoEn: ahora, ventanaMs });
  } else {
    intento.cantidad += 1;
  }
}

function limpiarEnMemoria(clave: string): void {
  intentosPorClave.delete(clave);
}

function minutosRestantesEnMemoria(clave: string): number {
  const intento = intentosPorClave.get(clave);
  if (!intento) return 0;
  const restante = intento.ventanaMs - (Date.now() - intento.primerIntentoEn);
  return Math.max(Math.ceil(restante / 60000), 0);
}

// -------------------------------------------------------------------------
// API pública — ahora asíncrona. Misma semántica que antes: se cuentan los
// intentos FALLIDOS, se limpian tras un éxito, y se bloquea cuando se llega
// al máximo dentro de la ventana.
//
// `maxIntentos`/`ventanaMs` son opcionales: por defecto, el límite genérico
// de login (5 / 10 min). La recuperación de contraseña pasa los suyos, más
// estrictos (ver recuperar/route.ts).
// -------------------------------------------------------------------------

/** Devuelve true si la clave superó el máximo de intentos fallidos en la ventana. */
export async function estaLimitado(
  clave: string,
  maxIntentos = MAX_INTENTOS,
  ventanaMs = VENTANA_MS
): Promise<boolean> {
  if (redis) {
    try {
      const cantidad = await redis.get<number>(clave);
      return (cantidad ?? 0) >= maxIntentos;
    } catch (err) {
      console.error("rateLimit: fallo al leer de Redis, uso memoria:", err);
    }
  }
  return estaLimitadoEnMemoria(clave, maxIntentos, ventanaMs);
}

/** Registra un intento fallido para esa clave. */
export async function registrarIntentoFallido(
  clave: string,
  maxIntentos = MAX_INTENTOS,
  ventanaMs = VENTANA_MS
): Promise<void> {
  if (redis) {
    try {
      // INCR cuenta el fallo; la primera vez fijamos el vencimiento de la
      // ventana. Al vencer, Redis borra la clave solo y el conteo arranca
      // de cero — igual que la versión en memoria.
      const cantidad = await redis.incr(clave);
      if (cantidad === 1) await redis.pexpire(clave, ventanaMs);
      return;
    } catch (err) {
      console.error("rateLimit: fallo al escribir en Redis, uso memoria:", err);
    }
  }
  registrarFalloEnMemoria(clave, ventanaMs);
}

/** Limpia los intentos fallidos de una clave (tras un login/recuperación exitosos). */
export async function limpiarIntentos(clave: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(clave);
      return;
    } catch (err) {
      console.error("rateLimit: fallo al borrar en Redis, uso memoria:", err);
    }
  }
  limpiarEnMemoria(clave);
}

/** Minutos que faltan para que se libere el bloqueo de una clave. */
export async function minutosRestantes(clave: string): Promise<number> {
  if (redis) {
    try {
      const ttlMs = await redis.pttl(clave); // ms restantes; -1 sin vencimiento, -2 sin clave
      if (ttlMs <= 0) return 0;
      return Math.max(Math.ceil(ttlMs / 60000), 0);
    } catch (err) {
      console.error("rateLimit: fallo al leer TTL de Redis, uso memoria:", err);
    }
  }
  return minutosRestantesEnMemoria(clave);
}
