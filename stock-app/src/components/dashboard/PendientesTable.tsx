"use client";

import { useMemo, useState } from "react";
import { Search, X, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { Producto } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  productos: Producto[];
  onQuitarFiltro: () => void;
}

type Columna = "codigo" | "descripcion" | "ubicacion" | "familia" | "stockSap";
type Direccion = "asc" | "desc";

const COLUMNAS: { key: Columna; label: string; alineacion?: "right" }[] = [
  { key: "codigo", label: "Código" },
  { key: "descripcion", label: "Descripción" },
  { key: "ubicacion", label: "Ubicación" },
  { key: "familia", label: "Familia" },
  { key: "stockSap", label: "Stock SAP", alineacion: "right" },
];

export function PendientesTable({ productos, onQuitarFiltro }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [ordenColumna, setOrdenColumna] = useState<Columna | null>(null);
  const [ordenDireccion, setOrdenDireccion] = useState<Direccion>("asc");

  function toggleOrden(col: Columna) {
    if (ordenColumna !== col) {
      setOrdenColumna(col);
      setOrdenDireccion("asc");
    } else {
      setOrdenDireccion((d) => (d === "asc" ? "desc" : "asc"));
    }
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let lista = productos;
    if (q) {
      lista = lista.filter(
        (p) =>
          p.codigo.toLowerCase().includes(q) ||
          p.descripcion.toLowerCase().includes(q) ||
          p.ubicacion.toLowerCase().includes(q) ||
          p.familia.toLowerCase().includes(q)
      );
    }

    if (ordenColumna) {
      const factor = ordenDireccion === "asc" ? 1 : -1;
      lista = [...lista].sort((a, b) => {
        if (ordenColumna === "stockSap") {
          return (Number(a.stockSap) - Number(b.stockSap)) * factor;
        }
        const av = String(a[ordenColumna] ?? "").toLowerCase();
        const bv = String(b[ordenColumna] ?? "").toLowerCase();
        return av.localeCompare(bv, "es") * factor;
      });
    }

    return lista;
  }, [productos, busqueda, ordenColumna, ordenDireccion]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-2">
        <div>
          <CardTitle className="text-sm">
            Pendientes de contar
            <span className="ml-2 text-muted-foreground font-normal">
              ({filtrados.length}
              {busqueda ? ` de ${productos.length}` : ""})
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Solo artículos con stock en SAP distinto de cero — los que están en cero no se listan.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onQuitarFiltro}
          className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/5 shrink-0"
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
              ? "¡No queda nada pendiente! Ya se contaron todos los artículos con stock."
              : "Ningún artículo pendiente coincide con la búsqueda."}
          </p>
        ) : (
          <div className="-mx-5">
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border sticky top-0 bg-background z-10">
                    {COLUMNAS.map((col, i) => {
                      const activa = ordenColumna === col.key;
                      const Icono = activa ? (ordenDireccion === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                      return (
                        <th
                          key={col.key}
                          className={`py-2 font-medium select-none cursor-pointer hover:text-foreground transition-colors ${
                            i === 0 ? "px-5" : i === COLUMNAS.length - 1 ? "px-5" : "px-2"
                          } ${col.alineacion === "right" ? "text-right" : "text-left"}`}
                          onClick={() => toggleOrden(col.key)}
                        >
                          <span className={`inline-flex items-center gap-1 ${col.alineacion === "right" ? "flex-row-reverse" : ""}`}>
                            {col.label}
                            <Icono size={12} className={activa ? "text-primary" : "text-muted-foreground/50"} />
                          </span>
                        </th>
                      );
                    })}
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
