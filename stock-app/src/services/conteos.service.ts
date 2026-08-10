import type { Conteo, Agencia } from "@/types";
import type { ConteoInput } from "@/lib/validations";

async function parseOrThrow<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "Error en la solicitud");
  return json.data as T;
}

export const conteosService = {
  /** Lista conteos. Si se pasa agencia, filtra solo esa (admin). Sin agencia = solo los propios (operador). */
  listar: (agencia?: Agencia): Promise<Conteo[]> => {
    const url = agencia ? `/api/conteos?agencia=${encodeURIComponent(agencia)}` : "/api/conteos";
    return fetch(url).then((r) => parseOrThrow<Conteo[]>(r));
  },

  guardar: (input: ConteoInput): Promise<Conteo> =>
    fetch("/api/conteos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => parseOrThrow<Conteo>(r)),

  editar: (id: string, input: { stockContado: number; diferencia: number; estado: string; observaciones: string; ubicacionNueva: string }): Promise<Conteo> =>
    fetch(`/api/conteos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => parseOrThrow<Conteo>(r)),

  eliminar: (id: string): Promise<{ id: string; eliminado: boolean }> =>
    fetch(`/api/conteos/${id}`, { method: "DELETE" }).then((r) => parseOrThrow<{ id: string; eliminado: boolean }>(r)),

  eliminarVarios: (ids: string[]): Promise<{ eliminados: number }> =>
    fetch("/api/conteos/eliminar-lote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).then((r) => parseOrThrow<{ eliminados: number }>(r)),

  /** Resetea conteos. Si se pasa agencia, borra solo esa. Sin agencia o null = todas (solo admin global). */
  resetear: (agencia?: Agencia | null): Promise<{ eliminados: number }> =>
    fetch("/api/conteos/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencia: agencia ?? null }),
    }).then((r) => parseOrThrow<{ eliminados: number }>(r)),
};
