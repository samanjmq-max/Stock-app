"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pencil, Trash2, Loader2, Search, ArrowUp, ArrowDown, ArrowUpDown, Check, X } from "lucide-react";
import type { Producto } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Columna = "codigo" | "descripcion" | "ubicacion" | "familia" | "proveedor" | "stockSap" | "precioUnitario" | "importe";
type Direccion = "asc" | "desc";

const COLUMNAS: { key: Columna; label: string; alineacion?: "right" }[] = [
  { key: "codigo", label: "Código" },
  { key: "descripcion", label: "Descripción" },
  { key: "ubicacion", label: "Ubicación" },
  { key: "familia", label: "Familia" },
  { key: "proveedor", label: "Proveedor" },
  { key: "stockSap", label: "Stock SAP", alineacion: "right" },
  { key: "precioUnitario", label: "Precio", alineacion: "right" },
  { key: "importe", label: "Importe", alineacion: "right" },
];

function formatearImporte(valor: number): string {
  return `$ ${valor.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}

function importeProducto(p: Producto): number {
  return (Number(p.precioUnitario) || 0) * Number(p.stockSap || 0);
}

interface Props {
  productos: Producto[];
  isAdmin: boolean;
  busqueda: string;
  onEditar: (p: Producto) => void;
  onEliminar: (p: Producto) => void;
  onEliminarVarios: (productos: Producto[]) => Promise<void>;
  onGuardarPrecio: (p: Producto, precio: number) => Promise<void>;
  onLimpiarFiltros?: () => void;
  onAgregarPrimero?: () => void;
}

export function ProductosTable({
  productos,
  isAdmin,
  busqueda,
  onEditar,
  onEliminar,
  onEliminarVarios,
  onGuardarPrecio,
  onLimpiarFiltros,
  onAgregarPrimero,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [ordenColumna, setOrdenColumna] = useState<Columna | null>(null);
  const [ordenDireccion, setOrdenDireccion] = useState<Direccion>("asc");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [eliminandoLote, setEliminandoLote] = useState(false);
  const [editandoPrecioId, setEditandoPrecioId] = useState<string | null>(null);
  const [precioBorrador, setPrecioBorrador] = useState("");
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);

  function toggleOrden(col: Columna) {
    if (ordenColumna !== col) {
      setOrdenColumna(col);
      setOrdenDireccion(col === "stockSap" || col === "precioUnitario" || col === "importe" ? "desc" : "asc");
    } else {
      setOrdenDireccion((d) => (d === "asc" ? "desc" : "asc"));
    }
  }

  const ordenados = useMemo(() => {
    if (!ordenColumna) return productos;
    const factor = ordenDireccion === "asc" ? 1 : -1;
    return [...productos].sort((a, b) => {
      if (ordenColumna === "importe") return (importeProducto(a) - importeProducto(b)) * factor;
      if (ordenColumna === "stockSap" || ordenColumna === "precioUnitario") {
        return (Number(a[ordenColumna]) - Number(b[ordenColumna])) * factor;
      }
      const av = String(a[ordenColumna] ?? "").toLowerCase();
      const bv = String(b[ordenColumna] ?? "").toLowerCase();
      return av.localeCompare(bv, "es") * factor;
    });
  }, [productos, ordenColumna, ordenDireccion]);

  const visibles = ordenados.slice(0, 300);

  const resumen = useMemo(() => {
    const importe = ordenados.reduce((acc, p) => acc + importeProducto(p), 0);
    return { total: ordenados.length, importe };
  }, [ordenados]);

  const todosSeleccionados = visibles.length > 0 && seleccionados.size === visibles.length;
  const algunoSeleccionado = seleccionados.size > 0;

  function toggleUno(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setSeleccionados(todosSeleccionados ? new Set() : new Set(visibles.map((p) => p.id)));
  }

  async function eliminar(p: Producto) {
    setEliminandoId(p.id);
    try {
      await onEliminar(p);
    } finally {
      setEliminandoId(null);
    }
  }

  async function eliminarSeleccionados() {
    const elegidos = ordenados.filter((p) => seleccionados.has(p.id));
    setEliminandoLote(true);
    try {
      await onEliminarVarios(elegidos);
      setSeleccionados(new Set());
    } finally {
      setEliminandoLote(false);
    }
  }

  function empezarEdicionPrecio(p: Producto) {
    setEditandoPrecioId(p.id);
    setPrecioBorrador(String(p.precioUnitario ?? 0));
  }

  async function confirmarPrecio(p: Producto) {
    const valor = Number(precioBorrador);
    if (isNaN(valor) || valor < 0) {
      toast.error("Precio inválido");
      return;
    }
    if (valor === Number(p.precioUnitario ?? 0)) {
      setEditandoPrecioId(null);
      return;
    }
    setGuardandoPrecio(true);
    try {
      await onGuardarPrecio(p, valor);
      setEditandoPrecioId(null);
    } finally {
      setGuardandoPrecio(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 flex-wrap gap-2">
        <CardTitle className="text-sm">
          Productos
          <span className="ml-2 text-muted-foreground font-normal">({resumen.total})</span>
        </CardTitle>
        {isAdmin && algunoSeleccionado && (
          <Button
            variant="destructive"
            size="sm"
            onClick={eliminarSeleccionados}
            disabled={eliminandoLote}
            className="h-7 text-xs"
          >
            {eliminandoLote ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
            Eliminar seleccionados ({seleccionados.size})
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-3 text-xs bg-muted rounded-lg px-3 py-1.5 w-fit">
          <span className="text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{resumen.total}</span>
          </span>
          <span className="w-px h-3 bg-border" />
          <span className="text-muted-foreground">
            Importe: <span className="font-semibold text-foreground">{formatearImporte(resumen.importe)}</span>
          </span>
        </div>

        {visibles.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {productos.length === 0 && !busqueda
                ? "Todavía no hay productos cargados."
                : "Ningún producto coincide con la búsqueda o los filtros."}
            </p>
            <div className="flex justify-center gap-2">
              {onLimpiarFiltros && (
                <Button variant="outline" size="sm" onClick={onLimpiarFiltros}>
                  <X size={14} />
                  Limpiar filtros
                </Button>
              )}
              {isAdmin && onAgregarPrimero && productos.length === 0 && !busqueda && (
                <Button size="sm" onClick={onAgregarPrimero}>
                  Agregar primer producto
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="-mx-5">
            <div className="overflow-auto max-h-[520px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border sticky top-0 bg-background z-10">
                    {isAdmin && (
                      <th className="px-5 py-2 font-medium w-8">
                        <input
                          type="checkbox"
                          checked={todosSeleccionados}
                          onChange={toggleTodos}
                          aria-label="Seleccionar todos"
                          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                        />
                      </th>
                    )}
                    {COLUMNAS.map((col, i) => {
                      const activa = ordenColumna === col.key;
                      const Icono = activa ? (ordenDireccion === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                      const esPrimera = i === 0 && !isAdmin;
                      return (
                        <th
                          key={col.key}
                          className={`py-2 font-medium select-none cursor-pointer hover:text-foreground transition-colors ${
                            esPrimera ? "px-5" : "px-2"
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
                    {isAdmin && <th className="px-5 py-2 font-medium text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {/* "Crumple & collapse" al eliminar -- el ítem se arruga y colapsa en
                      vez de desaparecer en seco (design-system, evolución futurista
                      confirmada 2026-09-12; ver mockup "Glass & Glow"). No es el arco
                      hasta un tacho del mockup original -- en una tabla no hay un
                      tacho fijo al que apuntar, así que se acota a lo que sí se
                      traduce bien acá. `layout="position"` para que las filas de
                      abajo suban con el mismo resorte en vez de saltar en seco;
                      `initial={false}` para que esto solo se vea al eliminar (o al
                      filtrar), nunca al montar la tabla la primera vez. */}
                  <AnimatePresence initial={false}>
                    {visibles.map((p) => (
                      <motion.tr
                        key={p.id}
                        layout="position"
                        initial={false}
                        exit={
                          prefersReducedMotion
                            ? { opacity: 0, transition: { duration: 0 } }
                            : { opacity: 0, scale: 0.92, x: 14, rotate: -3, transition: { duration: 0.28, ease: [0.5, -0.2, 0.7, 1.1] } }
                        }
                        className={`group border-b border-border last:border-0 hover:bg-muted/30 ${seleccionados.has(p.id) ? "bg-primary/5" : ""}`}
                      >
                      {isAdmin && (
                        <td className="px-5 py-2">
                          <input
                            type="checkbox"
                            checked={seleccionados.has(p.id)}
                            onChange={() => toggleUno(p.id)}
                            aria-label={`Seleccionar ${p.codigo}`}
                            className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                          />
                        </td>
                      )}
                      <td className={`py-2 font-medium whitespace-nowrap ${isAdmin ? "px-2" : "px-5"}`}>{p.codigo}</td>
                      <td className="px-2 py-2 max-w-[220px] truncate" title={p.descripcion}>{p.descripcion}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{p.ubicacion || "—"}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{p.familia || "—"}</td>
                      <td className="px-2 py-2 whitespace-nowrap max-w-[140px] truncate" title={p.proveedor}>{p.proveedor || "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{p.stockSap}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {/* Edición inline -- ediciones simples de precio no necesitan
                            abrir el modal completo (design-system pages/productos.md). */}
                        {isAdmin && editandoPrecioId === p.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              autoFocus
                              type="number"
                              step="any"
                              value={precioBorrador}
                              onChange={(e) => setPrecioBorrador(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") confirmarPrecio(p);
                                if (e.key === "Escape") setEditandoPrecioId(null);
                              }}
                              className="h-7 w-24 text-right text-xs tabular-nums"
                              disabled={guardandoPrecio}
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => confirmarPrecio(p)} disabled={guardandoPrecio}>
                              {guardandoPrecio ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />}
                            </Button>
                          </div>
                        ) : isAdmin ? (
                          <button
                            type="button"
                            onClick={() => empezarEdicionPrecio(p)}
                            className="hover:underline decoration-dotted underline-offset-2 cursor-pointer"
                            title="Click para editar el precio"
                          >
                            {formatearImporte(Number(p.precioUnitario) || 0)}
                          </button>
                        ) : (
                          formatearImporte(Number(p.precioUnitario) || 0)
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                        {formatearImporte(importeProducto(p))}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-2 text-right whitespace-nowrap">
                          {/* Reveladas al hover/focus, no siempre visibles
                              compitiendo con los datos (design-system). */}
                          <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity inline-flex">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditar(p)}>
                              <Pencil size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => eliminar(p)}
                              disabled={eliminandoId === p.id}
                            >
                              {eliminandoId === p.id ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
                            </Button>
                          </div>
                        </td>
                      )}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {ordenados.length > 300 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  <Search size={12} className="inline mr-1 -mt-0.5" />
                  Mostrando los primeros 300 de {ordenados.length} — seguí escribiendo o filtrando para acotar.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
