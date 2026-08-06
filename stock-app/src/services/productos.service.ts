import type { Producto } from "@/types";
import type { ProductoInput } from "@/lib/validations";

async function parseOrThrow<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "Error en la solicitud");
  return json.data as T;
}

export interface FilaImportacion {
  codigo: string;
  descripcion: string;
  ubicacion?: string;
  familia?: string;
  proveedor?: string;
  stockSap: number;
}

export const productosService = {
  listar: (): Promise<Producto[]> => fetch("/api/productos").then((r) => parseOrThrow<Producto[]>(r)),

  buscarPorCodigo: async (codigo: string): Promise<Producto | undefined> => {
    const productos = await productosService.listar();
    return productos.find((p) => p.codigo.toLowerCase() === codigo.toLowerCase());
  },

  crear: (input: ProductoInput): Promise<Producto> =>
    fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => parseOrThrow<Producto>(r)),

  actualizar: (id: string, input: Partial<ProductoInput>): Promise<Producto> =>
    fetch(`/api/productos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => parseOrThrow<Producto>(r)),

  eliminar: (id: string): Promise<{ id: string }> =>
    fetch(`/api/productos/${id}`, { method: "DELETE" }).then((r) => parseOrThrow<{ id: string }>(r)),

  importar: (productos: FilaImportacion[]): Promise<{ importados: number }> =>
    fetch("/api/productos/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productos }),
    }).then((r) => parseOrThrow<{ importados: number }>(r)),
};
