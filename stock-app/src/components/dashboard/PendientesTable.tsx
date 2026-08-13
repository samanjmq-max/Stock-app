"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Producto } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  productos: Producto[];
  onQuitarFiltro: () => void;
}

export function PendientesTable({ productos, onQuitarFiltro }: Props) {
  const [busqueda, setBusqueda] = useState("");
  // Por defecto se ocultan los artículos con stock SAP = 0: no necesitan
  // contarse porque en teoría no debería haber nada físico. Si aparece
  // alguno con stock físico igual, el conteo normal lo va a mostrar como
  // "Diferencias +" en la vista general — no hace falta que aparezca acá.
  const [ocultarSinStock, setOcultarSinStock] = useState(true);

  const sinStockCount = useMemo(
    () => productos.filter((p) => Number(p.stockSap) === 0).length,
    [productos]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (ocultarSinStock && Number(p.stockSap) === 0) return false;
      if (!q) return true;
      return (
        p.codigo.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q) ||
        p.ubicacion.toLowerCase().includes(q) ||
        p.familia.toLowerCase().includes(q)
      );
    });
  }, [productos, busqueda, ocultarSinStock]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">
          Pendientes de contar
          <span className="ml-2 text-muted-foreground font-normal">
            ({filtrados.length}
            {busqueda || ocultarSinStock ? ` de ${productos.length}` : ""})
          </span>
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onQuitarFiltro}
          className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/5"
        >
          <X size={13} />
          Volver al resumen
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, descripción, ubicación o familia..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ocultarSinStock}
              onChange={(e) => setOcultarSinStock(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
            />
            Ocultar stock SAP = 0 ({sinStockCount})
          </label>
        </div>

        {filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {productos.length === 0
              ? "¡No queda nada pendiente! Ya se contó todo el catálogo."
              : "Ningún artículo pendiente coincide con los filtros."}
          </p>
        ) : (
          <div className="-mx-5">
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border sticky top-0 bg-background z-10">
                    <th className="px-5 py-2 font-medium">Código</th>
                    <th className="px-2 py-2 font-medium">Descripción</th>
                    <th className="px-2 py-2 font-medium">Ubicación</th>
                    <th className="px-2 py-2 font-medium">Familia</th>
                    <th className="px-5 py-2 font-medium text-right">Stock SAP</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.slice(0, 300).map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-2 font-medium whitespace-nowrap">{p.codigo}</td>
                      <td className="px-2 py-2 max-w-[220px] truncate" title={p.descripcion}>
                        {p.descripcion}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">{p.ubicacion || "—"}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{p.familia || "—"}</td>
                      <td className="px-5 py-2 text-right">{p.stockSap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtrados.length > 300 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Mostrando los primeros 300 — seguí escribiendo para acotar la búsqueda.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
