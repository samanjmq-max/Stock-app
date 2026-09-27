import type { ResumenMensual } from "@/types";

async function parseOrThrow<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "Error en la solicitud");
  return json.data as T;
}

export const resumenService = {
  /**
   * Lista el histórico consolidado de cierres (1 fila por agencia por cierre).
   * El backend/servidor ya lo filtra al alcance del usuario. Alimenta el
   * Estado por planta y el mini-dashboard mensual.
   */
  listar: (): Promise<ResumenMensual[]> =>
    fetch("/api/resumen-mensual").then((r) => parseOrThrow<ResumenMensual[]>(r)),

  /** Borra un cierre por id (solo súper admin — el servidor lo verifica). */
  eliminar: (id: string): Promise<{ id: string; eliminado: boolean }> =>
    fetch(`/api/resumen-mensual/${encodeURIComponent(id)}`, { method: "DELETE" })
      .then((r) => parseOrThrow<{ id: string; eliminado: boolean }>(r)),
};
