import type { Conteo } from "@/types";
import type { ConteoInput } from "@/lib/validations";

async function parseOrThrow<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "Error en la solicitud");
  return json.data as T;
}

export const conteosService = {
  listar: (): Promise<Conteo[]> => fetch("/api/conteos").then((r) => parseOrThrow<Conteo[]>(r)),

  guardar: (input: ConteoInput): Promise<Conteo> =>
    fetch("/api/conteos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => parseOrThrow<Conteo>(r)),

  /** Corrige un conteo ya guardado (por su id) — no crea uno nuevo. */
  editar: (
    id: string,
    input: { stockContado: number; diferencia: number; estado: string; observaciones: string; ubicacionNueva: string }
  ): Promise<Conteo> =>
    fetch(`/api/conteos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => parseOrThrow<Conteo>(r)),
};
