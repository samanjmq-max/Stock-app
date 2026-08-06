import type { HistorialEntry } from "@/types";

async function parseOrThrow<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "Error en la solicitud");
  return json.data as T;
}

export const historialService = {
  listar: (): Promise<HistorialEntry[]> => fetch("/api/historial").then((r) => parseOrThrow<HistorialEntry[]>(r)),
};
