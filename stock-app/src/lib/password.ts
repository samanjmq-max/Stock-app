import bcrypt from "bcryptjs";

/**
 * Hash "señuelo" de una contraseña que no le pertenece a nadie.
 *
 * Sirve para emparejar el tiempo de respuesta del login cuando el email NO
 * existe (o el usuario está inactivo). Sin esto, un email inexistente
 * responde al instante y uno válido tarda lo que tarda bcrypt (~100 ms): esa
 * diferencia de tiempo deja que un atacante averigüe qué emails son reales
 * (enumeración por tiempos). Comparando contra este hash en la rama de
 * "usuario no encontrado" se gasta el mismo tiempo que en un login normal.
 *
 * No autentica nada: `compararPassword` contra él siempre da `false`.
 */
export const HASH_SENUELO = "$2a$10$FvfpWHN6qXUrPCb5gmo2Ou.zD6MT3uWH2MH6qOwYVdQmCZwp/vN7W";

/** Hashea una contraseña en texto plano para guardarla. */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/** Compara una contraseña en texto plano contra su hash. */
export async function compararPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
