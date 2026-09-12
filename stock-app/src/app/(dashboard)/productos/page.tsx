"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Upload, Download, Search } from "lucide-react";
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

export default function ProductosPage() {
  const { isAdmin, esSuperAdmin, agencia } = useAuth();
  const { confirm, ConfirmDialogElement } = useConfirm();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [familiaFiltro, setFamiliaFiltro] = useState<string[]>([]);
  const [ubicacionFiltro, setUbicacionFiltro] = useState<string[]>([]);

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

        <div className="flex gap-2 flex-wrap">
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

          <Button variant="secondary" onClick={() => exportar("xlsx")}><Download size={15} />Excel</Button>
          <Button variant="secondary" onClick={() => exportar("csv")}><Download size={15} />CSV</Button>
          <Button variant="secondary" onClick={() => exportar("pdf")}><Download size={15} />PDF</Button>

          {isAdmin && (
            <>
              <Button variant="secondary" onClick={() => setImportDialogOpen(true)}>
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
