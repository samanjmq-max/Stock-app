import type { Usuario } from "@/types";
import type { UsuarioInput } from "@/lib/validations";

/**
 * Tiempo máximo que el navegador espera una respuesta antes de cortar.
 *
 * Sin esto, si el servidor no responde nunca, el botón "Guardar" queda con la
 * rueda girando indefinidamente y sin ningún mensaje: no hay forma de saber si
 * la operación falló, si sigue en curso o si conviene reintentar.
 *
 * Son 40s a propósito: más que el peor caso del servidor (que tiene su propio
 * corte de 15s por llamada a Apps Script), para que cuando algo salga mal gane
 * el mensaje específico del servidor y no este genérico.
 */
const TIMEOUT_MS = 40000;

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...init, signal: controlador.signal });

    // Se lee como texto y recién después se parsea: si el servidor devuelve
    // una página de error (HTML) en vez de JSON, un res.json() directo tira
    // "Unexpected token '<'", que no le dice nada a quien está usando la app.
    const texto = await res.text();
    let json: { ok?: boolean; data?: T; error?: string };
    try {
      json = JSON.parse(texto);
    } catch {
      throw new Error(`El servidor respondió de forma inesperada (HTTP ${res.status}). Probá de nuevo en un momento.`);
    }

    if (!res.ok || !json.ok) throw new Error(json.error || "Error en la solicitud");
    return json.data as T;
  } catch (err) {
    // Se mira el .name y no `instanceof Error` porque al abortar un fetch el
    // navegador tira un DOMException, que no siempre hereda de Error.
    if ((err as { name?: string } | null)?.name === "AbortError") {
      throw new Error(
        "La operación tardó demasiado y se cortó. Antes de reintentar, recargá la página y fijate si el cambio se guardó igual."
      );
    }
    throw err;
  } finally {
    clearTimeout(temporizador);
  }
}

export const usuariosService = {
  listar: (): Promise<Usuario[]> => pedir<Usuario[]>("/api/usuarios"),

  crear: (input: UsuarioInput): Promise<Usuario> =>
    pedir<Usuario>("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  actualizar: (id: string, input: Partial<UsuarioInput>): Promise<Usuario> =>
    pedir<Usuario>(`/api/usuarios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  eliminar: (id: string): Promise<{ id: string }> =>
    pedir<{ id: string }>(`/api/usuarios/${id}`, { method: "DELETE" }),
};
