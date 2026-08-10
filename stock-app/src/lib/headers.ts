import type { NextRequest } from "next/server";

/**
 * Lee un header de identidad (propagado por el middleware) y lo decodifica.
 * El middleware guarda estos valores con acentos/tildes tal cual, pero los
 * headers HTTP los codifican en tránsito (ej: "í" -> "%C3%AD") — por eso
 * TODA lectura de x-user-* debe pasar por acá, nunca por request.headers.get() directo.
 */
export function leerHeaderTexto(request: NextRequest | Request, nombre: string): string | null {
  const valor = request.headers.get(nombre);
  if (!valor) return null;
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}
