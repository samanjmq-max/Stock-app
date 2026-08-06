"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Upload, Download, Pencil, Trash2, Search } from "lucide-react";
import { productosService } from "@/services/productos.service";
import type { ProductoInput } from "@/lib/validations";
import type { Producto } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/hooks/useConfirm";
import { exportarExcel, exportarCSV, exportarPDF } from "@/lib/exportacion";
import { ProductoFormDialog } from "@/features/productos/components/ProductoFormDialog";
import { ImportarProductosDialog } from "@/features/productos/components/ImportarProductosDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const POR_PAGINA = 15;

export default function ProductosPage() {
  const { isAdmin } = useAuth();
  const { confirm, ConfirmDialogElement } = useConfirm();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [familiaFiltro, setFamiliaFiltro] = useState<string>("todas");
  const [pagina, setPagina] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      setProductos(await productosService.listar());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const familias = useMemo(
    () => Array.from(new Set(productos.map((p) => p.familia).filter(Boolean))).sort(),
    [productos]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      const coincideBusqueda =
        !q || [p.codigo, p.descripcion, p.ubicacion, p.familia, p.proveedor].join(" ").toLowerCase().includes(q);
      const coincideFamilia = familiaFiltro === "todas" || p.familia === familiaFiltro;
      return coincideBusqueda && coincideFamilia;
    });
  }, [productos, busqueda, familiaFiltro]);

  const totalPaginas = Math.max(Math.ceil(filtrados.length / POR_PAGINA), 1);
  const paginaSegura = Math.min(pagina, totalPaginas);
  const enPagina = filtrados.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA);

  async function guardarProducto(input: ProductoInput) {
    try {
      if (productoEditando) {
        await productosService.actualizar(productoEditando.id, input);
        toast.success("Producto actualizado");
      } else {
        await productosService.crear(input);
        toast.success("Producto creado");
      }
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function eliminarProducto(p: Producto) {
    const confirmado = await confirm({
      titulo: "Eliminar producto",
      descripcion: `¿Eliminar el producto ${p.codigo} — ${p.descripcion}? Esta acción no se puede deshacer.`,
      textoConfirmar: "Eliminar",
      variante: "destructive",
    });
    if (!confirmado) return;

    try {
      await productosService.eliminar(p.id);
      toast.success("Producto eliminado");
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
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
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={familiaFiltro} onValueChange={(v) => { setFamiliaFiltro(v); setPagina(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Familia" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las familias</SelectItem>
              {familias.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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

      <p className="text-xs text-muted-foreground">{filtrados.length} productos</p>

      <div className="space-y-2">
        {enPagina.map((p) => (
          <Card key={p.id}>
            <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.codigo} — {p.descripcion}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  📍 {p.ubicacion || "sin ubicación"} · {p.familia || "sin familia"} · Stock SAP: {p.stockSap}
                </p>
              </div>
              {isAdmin && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => { setProductoEditando(p); setDialogOpen(true); }}>
                    <Pencil size={15} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => eliminarProducto(p)}>
                    <Trash2 size={15} className="text-destructive" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {enPagina.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">No se encontraron productos.</p>
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="secondary" size="sm" disabled={paginaSegura === 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">Página {paginaSegura} de {totalPaginas}</span>
          <Button variant="secondary" size="sm" disabled={paginaSegura === totalPaginas} onClick={() => setPagina((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      )}

      <ProductoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productoEditando={productoEditando}
        onGuardar={guardarProducto}
      />
      <ImportarProductosDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportado={(cantidad) => {
          toast.success(`${cantidad} productos importados`);
          cargar();
        }}
      />
      {ConfirmDialogElement}
    </div>
  );
}
