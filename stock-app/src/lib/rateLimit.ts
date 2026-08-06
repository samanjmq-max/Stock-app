import "server-only";

/**
 * rateLimit.ts — protege el login contra fuerza bruta (probar muchas
 * contraseñas seguidas).
 *
 * Cómo funciona por defecto (sin configurar nada):
 *   Cuenta los intentos fallidos en la memoria del propio servidor. Esto
 *   funciona perfecto en un servidor único (por ejemplo un droplet, o
 *   Vercel con una sola instancia activa). LIMITACIÓN: en plataformas
 *   serverless con mucho tráfico, Vercel puede levantar varias instancias
 *   en paralelo, cada una con su propia memoria — en ese caso el límite
 *   real efectivo puede terminar siendo más alto que MAX_INTENTOS.
 *
 * Cómo mejorarlo en producción con tráfico alto:
 *   Crear una cuenta gratuita en https://upstash.com (Redis serverless),
 *   agregar las variables de entorno UPSTASH_REDIS_REST_URL y
 *   UPSTASH_REDIS_REST_TOKEN, instalar `@upstash/ratelimit` y
 *   `@upstash/redis`, y reemplazar la implementación de abajo por un
 *   limitador contra Redis (compartido entre todas las instancias). La
 *   función `estaLimitado` de este archivo es el único lugar que
 *   necesitaría cambiar — el resto del código no se toca.
 */

const MAX_INTENTOS = 5;
const VENTANA_MS = 10 * 60 * 1000; // 10 minutos

interface Intento {
  cantidad: number;
  primerIntentoEn: number;
}

const intentosPorClave = new Map<string, Intento>();

// Limpieza periódica para no acumular memoria indefinidamente.
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, intento] of intentosPorClave.entries()) {
    if (ahora - intento.primerIntentoEn > VENTANA_MS) intentosPorClave.delete(clave);
  }
}, VENTANA_MS).unref?.();

/**
 * Devuelve true si la clave (normalmente IP + email) superó el máximo de
 * intentos fallidos permitidos en la ventana de tiempo actual.
 */
export function estaLimitado(clave: string): boolean {
  const intento = intentosPorClave.get(clave);
  if (!intento) return false;
  const dentroDeVentana = Date.now() - intento.primerIntentoEn < VENTANA_MS;
  return dentroDeVentana && intento.cantidad >= MAX_INTENTOS;
}

/** Registra un intento fallido de login para esa clave. */
export function registrarIntentoFallido(clave: string): void {
  const ahora = Date.now();
  const intento = intentosPorClave.get(clave);
  if (!intento || ahora - intento.primerIntentoEn > VENTANA_MS) {
    intentosPorClave.set(clave, { cantidad: 1, primerIntentoEn: ahora });
  } else {
    intento.cantidad += 1;
  }
}

/** Limpia los intentos fallidos de una clave (se llama tras un login exitoso). */
export function limpiarIntentos(clave: string): void {
  intentosPorClave.delete(clave);
}

export function minutosRestantes(clave: string): number {
  const intento = intentosPorClave.get(clave);
  if (!intento) return 0;
  const restante = VENTANA_MS - (Date.now() - intento.primerIntentoEn);
  return Math.max(Math.ceil(restante / 60000), 0);
}
