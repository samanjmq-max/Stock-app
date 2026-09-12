"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Upload, Download, Search, ChevronDown, FileSpreadsheet, FileText, FileType, SlidersHorizontal } from "lucide-react";
import { productosService } from "@/services/productos.service";
import type { ProductoInput } from "@/lib/validations";
import { AGENCIAS, type Agencia, type Producto } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/hooks/useConfirm";
import { exportarExcel, exportarCSV, exportarPDF } from "@/lib/exportacion";
import { ProductoFormDialog } from "@/features/productos/components/ProductoFormDialog";
import { ImportarProductosDialog } from "@/features/productos/components/ImportarProductosDialog";
import { ProductosTable } from "@/features/productos/components/ProductosTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

/*
  Menú de exportación.

  Antes Excel, CSV y PDF eran tres botones sueltos, uno al lado del otro, con
  el mismo peso visual que "Importar" y casi el mismo que "Nuevo": cinco
  acciones compitiendo en la misma fila, donde exportar a CSV parecía tan
  importante como dar de alta un producto. Ahora son un solo botón secundario
  con tres opciones adentro.

  Es un desplegable propio y no un componente de librería a propósito: el
  proyecto tiene radix-ui de dialog, select, label y slot, pero no de
  dropdown-menu, y sumar una dependencia para tres opciones no se justifica.
*/
function MenuExportar({ onExportar }: { onExportar: (formato: "xlsx" | "csv" | "pdf") => void }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alClickearFuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    }
    function alPresionarEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", alClickearFuera);
    document.addEventListener("keydown", alPresionarEscape);
    return () => {
      document.removeEventListener("mousedown", alClickearFuera);
      document.removeEventListener("keydown", alPresionarEscape);
    };
  }, [abierto]);

  const opciones = [
    { formato: "xlsx" as const, label: "Excel", icono: FileSpreadsheet },
    { formato: "csv" as const, label: "CSV", icono: FileText },
    { formato: "pdf" as const, label: "PDF", icono: FileType },
  ];

  return (
    <div ref={contenedor} className="relative">
      <Button
        variant="outline"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <Download size={15} />
        Exportar
        <ChevronDown size={14} className={cn("transition-transform duration-quick", abierto && "rotate-180")} />
      </Button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1.5 min-w-[168px] overflow-hidden rounded-lg border border-border bg-elevated p-1 shadow-elev-2 animate-fade-in"
        >
          {opciones.map(({ formato, label, icono: Icono }) => (
            <button
              key={formato}
              role="menuitem"
              type="button"
              onClick={() => { onExportar(formato); setAbierto(false); }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors duration-quick hover:bg-secondary"
            >
              <Icono size={15} className="text-muted-foreground" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductosPage() {
  const { isAdmin, esSuperAdmin, agencia } = useAuth();
  const { confirm, ConfirmDialogElement } = useConfirm();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [familiaFiltro, setFamiliaFiltro] = useState<string[]>([]);
  const [ubicacionFiltro, setUbicacionFiltro] = useState<string[]>([]);
  /*
    En el celular los filtros arrancan plegados: desplegados empujaban la
    tabla varios renglones hacia abajo y, al hacer scroll, quedaban tapados
    por el encabezado fijo. La búsqueda y las acciones siguen siempre a la
    vista porque son lo que más se usa. En escritorio no cambia nada.
  */
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);

  // Excepción exclusiva del super-admin: puede elegir gestionar el catálogo
  // de cualquier planta (ej. Lascano) en vez de quedar fijo a la agencia de
  // su propio usuario. Para cualquier otro admin esto nunca se usa --
  // agenciaOperativa siempre es `undefined` (= su propia agencia, sin cambios).
  const [agenciaSeleccionada, setAgenciaSeleccionada] = useState<Agencia | undefined>(undefined);
  const agenciaOperativa = esSuperAdmin ? agenciaSeleccionada : undefined;

  async function cargar(agenciaParaCargar?: Agencia) {
    setLoading(true);
    setError(null);
    try {
      setProductos(await productosService.listar(agenciaParaCargar));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar(agenciaOperativa);
    setFamiliaFiltro([]);
    setUbicacionFiltro([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenciaOperativa]);

  const familias = useMemo(
    () => Array.from(new Set(productos.map((p) => p.familia).filter(Boolean))).sort(),
    [productos]
  );
  const ubicaciones = useMemo(
    () => Array.from(new Set(productos.map((p) => p.ubicacion).filter(Boolean))).sort(),
    [productos]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      const coincideBusqueda =
        !q || [p.codigo, p.descripcion, p.ubicacion, p.familia, p.proveedor].join(" ").toLowerCase().includes(q);
      const coincideFamilia = familiaFiltro.length === 0 || familiaFiltro.includes(p.familia);
      const coincideUbicacion = ubicacionFiltro.length === 0 || ubicacionFiltro.includes(p.ubicacion);
      return coincideBusqueda && coincideFamilia && coincideUbicacion;
    });
  }, [productos, busqueda, familiaFiltro, ubicacionFiltro]);

  const filtrosActivos =
    (ubicacionFiltro.length > 0 ? 1 : 0) + (familiaFiltro.length > 0 ? 1 : 0) + (agenciaSeleccionada ? 1 : 0);

  function limpiarFiltros() {
    setBusqueda("");
    setFamiliaFiltro([]);
    setUbicacionFiltro([]);
  }

  async function guardarProducto(input: ProductoInput) {
    try {
      if (productoEditando) {
        await productosService.actualizar(productoEditando.id, input);
        toast.success("Producto actualizado");
      } else {
        // input.agencia ya viene correcto desde ProductoFormDialog
        // (agenciaPorDefecto = la planta que se está viendo ahora).
        await productosService.crear(input);
        toast.success("Producto creado");
      }
      await cargar(agenciaOperativa);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function guardarPrecioInline(p: Producto, precio: number) {
    try {
      await productosService.actualizar(p.id, { precioUnitario: precio });
      setProductos((prev) => prev.map((x) => (x.id === p.id ? { ...x, precioUnitario: precio } : x)));
      toast.success(`Precio de ${p.codigo} actualizado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el precio");
      throw err;
    }
  }

  // Ya no pide confirmación acá -- ProductosTable ahora maneja el borrado
  // individual con un toast "Deshacer" de 4s (reel 1, "wait for the undo") en
  // vez de un diálogo bloqueante; esta función es lo que se ejecuta recién
  // si nadie deshace a tiempo. El diálogo de confirmación sigue existiendo
  // para el borrado en lote (eliminarVariosProductos, más abajo) -- ahí un
  // solo "Deshacer" no cubre bien N productos a la vez.
  async function eliminarProducto(p: Producto) {
    try {
      await productosService.eliminar(p.id);
      await cargar(agenciaOperativa);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  async function eliminarVariosProductos(seleccionados: Producto[]) {
    const confirmado = await confirm({
      titulo: `Eliminar ${seleccionados.length} productos`,
      descripcion: `¿Eliminar los ${seleccionados.length} productos seleccionados? Esta acción no se puede deshacer.`,
      textoConfirmar: "Eliminar",
      variante: "destructive",
    });
    if (!confirmado) return;

    // No hay endpoint de borrado en lote para productos (sí para conteos) --
    // se reutiliza el DELETE por id existente, en paralelo. Mismo resultado
    // para quien usa la app, sin sumar una ruta nueva para esto.
    const resultados = await Promise.allSettled(seleccionados.map((p) => productosService.eliminar(p.id)));
    const exitosos = resultados.filter((r) => r.status === "fulfilled").length;
    const fallidos = resultados.length - exitosos;
    if (fallidos > 0) {
      toast.error(`${exitosos} eliminados, ${fallidos} fallaron`);
    } else {
      toast.success(`${exitosos} productos eliminados`);
    }
    await cargar(agenciaOperativa);
  }

  function exportar(formato: "xlsx" | "csv" | "pdf") {
    const datos = filtrados.map((p) => ({
      Código: p.codigo,
      Descripción: p.descripcion,
      Ubicación: p.ubicacion,
      Familia: p.familia,
      Proveedor: p.proveedor,
      "Stock SAP": p.stockSap,
    }));
    if (formato === "xlsx") exportarExcel(datos, "Productos", "productos");
    if (formato === "csv") exportarCSV(datos, "productos");
    if (formato === "pdf")
      exportarPDF(
        datos,
        [
          { header: "Código", key: "Código" },
          { header: "Descripción", key: "Descripción" },
          { header: "Ubicación", key: "Ubicación" },
          { header: "Stock SAP", key: "Stock SAP" },
        ],
        "Listado de productos",
        "productos"
      );
    toast.success(`Exportado (${formato.toUpperCase()})`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-muted-foreground" size={22} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
          <Input
            placeholder="Buscar producto..."
            className="pl-9"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {/* Plegador de filtros: solo en celular. */}
        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltrosAbiertos((v) => !v)}
            aria-expanded={filtrosAbiertos}
          >
            <SlidersHorizontal size={14} />
            Filtros
            {filtrosActivos > 0 && (
              <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground tabular-nums">
                {filtrosActivos}
              </span>
            )}
            <ChevronDown size={14} className={cn("transition-transform duration-quick", filtrosAbiertos && "rotate-180")} />
          </Button>
          {filtrosActivos > 0 && (
            <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
              Limpiar
            </Button>
          )}
        </div>

        <div className={cn("gap-2 flex-wrap", filtrosAbiertos ? "flex" : "hidden md:flex")}>
          {esSuperAdmin && (
            <Select
              value={agenciaOperativa ?? "propia"}
              onValueChange={(v) => setAgenciaSeleccionada(v === "propia" ? undefined : v as Agencia)}
            >
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="propia">Mi agencia ({agencia})</SelectItem>
                {AGENCIAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <SearchableSelect
            value={ubicacionFiltro}
            onValueChange={setUbicacionFiltro}
            options={ubicaciones}
            allLabel="Todas las ubicaciones"
            placeholder="Buscar ubicación..."
            className="w-44"
          />
          <SearchableSelect
            value={familiaFiltro}
            onValueChange={setFamiliaFiltro}
            options={familias}
            allLabel="Todas las familias"
            placeholder="Buscar familia..."
            className="w-40"
          />

        </div>

        {/* Acciones: siempre visibles, también en celular. Jerarquía de la
            pantalla: "Nuevo" es la única primaria; Exportar e Importar son
            secundarias. Antes había cinco botones del mismo peso. */}
        <div className="flex gap-2 flex-wrap">
          <MenuExportar onExportar={exportar} />

          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload size={15} />
                Importar
              </Button>
              <Button onClick={() => { setProductoEditando(null); setDialogOpen(true); }}>
                <Plus size={15} />
                Nuevo
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

      <ProductosTable
        productos={filtrados}
        isAdmin={isAdmin}
        busqueda={busqueda}
        onEditar={(p) => { setProductoEditando(p); setDialogOpen(true); }}
        onEliminar={eliminarProducto}
        onEliminarVarios={eliminarVariosProductos}
        onGuardarPrecio={guardarPrecioInline}
        onLimpiarFiltros={busqueda || familiaFiltro.length > 0 || ubicacionFiltro.length > 0 ? limpiarFiltros : undefined}
        onAgregarPrimero={isAdmin ? () => { setProductoEditando(null); setDialogOpen(true); } : undefined}
      />

      <ProductoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productoEditando={productoEditando}
        onGuardar={guardarProducto}
        agenciaPorDefecto={agenciaOperativa ?? agencia ?? "Centro Logístico"}
      />
      <ImportarProductosDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportado={(cantidad) => {
          toast.success(`${cantidad} productos importados`);
          cargar(agenciaOperativa);
        }}
      />
      {ConfirmDialogElement}
    </div>
  );
}
