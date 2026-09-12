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
  ventanaMs: number;
  maxIntentos: number;
}

const intentosPorClave = new Map<string, Intento>();

// Limpieza periódica para no acumular memoria indefinidamente. Usa la
// ventana más larga conocida como cota superior -- una entrada nunca
// necesita sobrevivir más tiempo que su propia ventana.
const VENTANA_LIMPIEZA_MS = 60 * 60 * 1000; // 1 hora
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, intento] of intentosPorClave.entries()) {
    if (ahora - intento.primerIntentoEn > intento.ventanaMs) intentosPorClave.delete(clave);
  }
}, VENTANA_LIMPIEZA_MS).unref?.();

/**
 * Devuelve true si la clave (normalmente IP + email) superó el máximo de
 * intentos fallidos permitidos en la ventana de tiempo actual.
 *
 * `maxIntentos`/`ventanaMs` son opcionales -- por defecto usan el límite
 * genérico de login (5 / 10 min). SEC-04: la recuperación de contraseña
 * (RECOVERY_CODE) es, en la práctica, una llave maestra permanente para la
 * cuenta del super-admin -- vale la pena un límite más estricto ahí que en
 * un login normal, así que ese endpoint pasa sus propios valores.
 */
export function estaLimitado(clave: string, maxIntentos = MAX_INTENTOS, ventanaMs = VENTANA_MS): boolean {
  const intento = intentosPorClave.get(clave);
  if (!intento) return false;
  const dentroDeVentana = Date.now() - intento.primerIntentoEn < ventanaMs;
  return dentroDeVentana && intento.cantidad >= maxIntentos;
}

/** Registra un intento fallido para esa clave (ver estaLimitado sobre los parámetros opcionales). */
export function registrarIntentoFallido(clave: string, maxIntentos = MAX_INTENTOS, ventanaMs = VENTANA_MS): void {
  const ahora = Date.now();
  const intento = intentosPorClave.get(clave);
  if (!intento || ahora - intento.primerIntentoEn > ventanaMs) {
    intentosPorClave.set(clave, { cantidad: 1, primerIntentoEn: ahora, ventanaMs, maxIntentos });
  } else {
    intento.cantidad += 1;
  }
}

/** Limpia los intentos fallidos de una clave (se llama tras un login/recuperación exitosos). */
export function limpiarIntentos(clave: string): void {
  intentosPorClave.delete(clave);
}

export function minutosRestantes(clave: string): number {
  const intento = intentosPorClave.get(clave);
  if (!intento) return 0;
  const restante = intento.ventanaMs - (Date.now() - intento.primerIntentoEn);
  return Math.max(Math.ceil(restante / 60000), 0);
}
