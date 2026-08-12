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

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) =>
        p.codigo.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q) ||
        p.ubicacion.toLowerCase().includes(q) ||
        p.familia.toLowerCase().includes(q)
    );
  }, [productos, busqueda]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">
          Pendientes de contar
          <span className="ml-2 text-muted-foreground font-normal">
            ({filtrados.length}
            {busqueda ? ` de ${productos.length}` : ""})
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
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, descripción, ubicación o familia..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {productos.length === 0
              ? "¡No queda nada pendiente! Ya se contó todo el catálogo."
              : "Ningún artículo pendiente coincide con la búsqueda."}
          </p>
        ) : (
          <div className="-mx-5">
            {/* Recuadro de alto fijo: las filas scrollean adentro, el resto de la pantalla queda quieto. */}
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
