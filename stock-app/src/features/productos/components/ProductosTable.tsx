"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pencil, Trash2, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Check, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { Producto } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Proveedor salió de la tabla: el SAP de SAMAN no lo exporta, así que la
// columna mostraba un guión en todas las filas. Una columna vacía no es
// neutra -- ocupa ancho y obliga a mirarla para descubrir que no dice nada.
// El campo sigue existiendo en el producto y se puede cargar a mano.
type Columna = "codigo" | "descripcion" | "ubicacion" | "familia" | "stockSap" | "precioUnitario" | "importe";
type Direccion = "asc" | "desc";

const COLUMNAS: { key: Columna; label: string; alineacion?: "right" }[] = [
  { key: "codigo", label: "Código" },
  { key: "descripcion", label: "Descripción" },
  { key: "ubicacion", label: "Ubicación" },
  { key: "familia", label: "Familia" },
  { key: "stockSap", label: "Stock SAP", alineacion: "right" },
  { key: "precioUnitario", label: "Precio", alineacion: "right" },
  { key: "importe", label: "Importe", alineacion: "right" },
];

/*
  Paginado real.

  Antes la tabla cortaba en los primeros 300 y avisaba "seguí filtrando para
  acotar" -- con 12.400 artículos en el catálogo eso significaba que los
  restantes 12.100 simplemente no existían para quien no supiera exactamente
  qué buscar, y ordenar por importe para ver los diez más caros mostraba diez
  de esos 300, no del catálogo. Virtualizar la lista sería lo ideal pero
  implica una dependencia nueva; el paginado resuelve el problema real (llegar
  a cualquier producto) sin agregar nada al bundle.
*/
const TAMANOS_PAGINA = [100, 300, 1000] as const;
const TAMANO_INICIAL = 300;

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
  const [eliminandoLote, setEliminandoLote] = useState(false);
  const [editandoPrecioId, setEditandoPrecioId] = useState<string | null>(null);
  const [precioBorrador, setPrecioBorrador] = useState("");
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [tamanoPagina, setTamanoPagina] = useState<number>(TAMANO_INICIAL);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Borrado individual con "Deshacer" (reel 1 -- "wait for the undo"): al
  // tocar el tacho, la fila se arruga y colapsa YA (ver `ocultos` en
  // `visibles` más abajo), pero el DELETE real recién se dispara si nadie
  // deshace en 4s. Por eso `eliminarProducto` en la página ya no muestra su
  // propio diálogo de confirmación -- el toast con "Deshacer" es la
  // confirmación ahora, no dos seguidas. `productosRef` deja chequear, una
  // vez que el DELETE real termina, si el producto sigue estando en la lista
  // (falló) para hacerlo reaparecer -- `onEliminar` ya avisa el error por su
  // cuenta con su propio toast, esto solo evita que quede invisible sin
  // haberse borrado de verdad.
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const productosRef = useRef(productos);
  useEffect(() => {
    productosRef.current = productos;
  }, [productos]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

  const noOcultos = useMemo(() => ordenados.filter((p) => !ocultos.has(p.id)), [ordenados, ocultos]);

  const totalPaginas = Math.max(1, Math.ceil(noOcultos.length / tamanoPagina));
  // Se acota en vez de resetear: si el filtro achica la lista y la página
  // actual ya no existe, cae en la última en vez de saltar a la 1 sin avisar.
  const paginaActual = Math.min(pagina, totalPaginas);
  const desde = (paginaActual - 1) * tamanoPagina;
  const visibles = noOcultos.slice(desde, desde + tamanoPagina);

  // Una búsqueda nueva es una lista nueva: quedarse en la página 7 de la
  // consulta anterior es siempre un error.
  useEffect(() => {
    setPagina(1);
  }, [busqueda, tamanoPagina, ordenColumna, ordenDireccion]);

  function irAPagina(n: number) {
    setPagina(Math.min(Math.max(1, n), totalPaginas));
    // La selección es "todo lo de esta página": arrastrarla a la siguiente
    // haría que "Eliminar seleccionados (300)" borre filas que ya no se ven.
    setSeleccionados(new Set());
    scrollRef.current?.scrollTo({ top: 0 });
  }

  const resumen = useMemo(() => {
    const importe = noOcultos.reduce((acc, p) => acc + importeProducto(p), 0);
    return { total: noOcultos.length, importe };
  }, [noOcultos]);

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

  function pedirEliminar(p: Producto) {
    setOcultos((prev) => new Set(prev).add(p.id));
    toast(`"${p.codigo}" eliminado`, {
      id: `deshacer-${p.id}`,
      duration: 4000,
      action: { label: "Deshacer", onClick: () => deshacerEliminar(p.id) },
    });
    const timer = setTimeout(() => confirmarEliminarDiferido(p), 4000);
    timersRef.current.set(p.id, timer);
  }

  function deshacerEliminar(id: string) {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setOcultos((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function confirmarEliminarDiferido(p: Producto) {
    timersRef.current.delete(p.id);
    await onEliminar(p);
    if (productosRef.current.some((x) => x.id === p.id)) {
      // Seguía en la lista después del DELETE real -- falló (onEliminar ya
      // avisó el error con su propio toast). La volvemos a mostrar en vez de
      // dejarla invisible sin haberse borrado de verdad.
      setOcultos((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
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
            <div ref={scrollRef} className="overflow-auto max-h-[520px]">
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
                      {/* La unidad va pegada a la cifra y no en columna propia:
                          la tabla ya tiene ocho columnas, y "450 L" se lee de
                          una sola pasada mientras que una columna suelta
                          obliga a cruzar la vista. */}
                      <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                        {p.stockSap}
                        {p.unidadMedida ? <span className="ml-1 text-[10px] text-muted-foreground">{p.unidadMedida}</span> : null}
                      </td>
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
                              onClick={() => pedirEliminar(p)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      )}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Paginado. Siempre visible el rango exacto que se está viendo:
                en una tabla de 12.000 filas, "1–300 de 12.416" es la única
                forma de saber dónde está uno parado. */}
            <div className="flex items-center justify-between gap-3 flex-wrap px-5 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground tabular-nums">
                {noOcultos.length === 0 ? (
                  "Sin resultados"
                ) : (
                  <>
                    <span className="font-medium text-foreground">
                      {desde + 1}–{Math.min(desde + tamanoPagina, noOcultos.length)}
                    </span>
                    {" de "}
                    <span className="font-medium text-foreground">{noOcultos.length}</span>
                  </>
                )}
              </p>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">Por página</span>
                  <select
                    value={tamanoPagina}
                    onChange={(e) => setTamanoPagina(Number(e.target.value))}
                    aria-label="Productos por página"
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {TAMANOS_PAGINA.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => irAPagina(1)}
                    disabled={paginaActual === 1}
                    aria-label="Primera página"
                  >
                    <ChevronsLeft size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => irAPagina(paginaActual - 1)}
                    disabled={paginaActual === 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums px-1 min-w-16 text-center">
                    {paginaActual} / {totalPaginas}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => irAPagina(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => irAPagina(totalPaginas)}
                    disabled={paginaActual === totalPaginas}
                    aria-label="Última página"
                  >
                    <ChevronsRight size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
