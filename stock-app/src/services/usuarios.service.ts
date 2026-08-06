import type { Usuario } from "@/types";
import type { UsuarioInput } from "@/lib/validations";

async function parseOrThrow<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "Error en la solicitud");
  return json.data as T;
}

export const usuariosService = {
  listar: (): Promise<Usuario[]> => fetch("/api/usuarios").then((r) => parseOrThrow<Usuario[]>(r)),

  crear: (input: UsuarioInput): Promise<Usuario> =>
    fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => parseOrThrow<Usuario>(r)),

  actualizar: (id: string, input: Partial<UsuarioInput>): Promise<Usuario> =>
    fetch(`/api/usuarios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => parseOrThrow<Usuario>(r)),

  eliminar: (id: string): Promise<{ id: string }> =>
    fetch(`/api/usuarios/${id}`, { method: "DELETE" }).then((r) => parseOrThrow<{ id: string }>(r)),
};
