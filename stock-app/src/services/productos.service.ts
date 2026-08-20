import type { Producto, Agencia } from "@/types";
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
  /** Precio de una sola unidad, en pesos. Si no viene, no se toca el precio ya cargado. */
  precioUnitario?: number;
}

export const productosService = {
  /** Lista productos. Si se pasa agencia, filtra solo esa (admin). Sin agencia = solo los propios (operador). */
  listar: (agencia?: Agencia): Promise<Producto[]> => {
    const url = agencia ? `/api/productos?agencia=${encodeURIComponent(agencia)}` : "/api/productos";
    return fetch(url).then((r) => parseOrThrow<Producto[]>(r));
  },
  buscarPorCodigo: async (codigo: string, agencia?: Agencia): Promise<Producto | undefined> => {
    const productos = await productosService.listar(agencia);
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
  /** Importa productos para una agencia específica — obligatoria. */
  importar: (productos: FilaImportacion[], agencia: Agencia): Promise<{ importados: number; actualizados: number; agencia: string }> =>
    fetch("/api/productos/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productos, agencia }),
    }).then((r) => parseOrThrow<{ importados: number; actualizados: number; agencia: string }>(r)),
};
