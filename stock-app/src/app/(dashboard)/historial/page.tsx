"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Download, X, ChevronDown, ChevronRight, Smartphone } from "lucide-react";
import { historialService } from "@/services/historial.service";
import type { HistorialEntry } from "@/types";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { exportarExcel, exportarPDF } from "@/lib/exportacion";

const ETIQUETAS_ACCION: Record<string, string> = {
  login: "Inicio de sesión",
  logout: "Cierre de sesión",
  crear_producto: "Producto creado",
  editar_producto: "Producto editado",
  eliminar_producto: "Producto eliminado",
  crear_usuario: "Usuario creado",
  editar_usuario: "Usuario editado",
  eliminar_usuario: "Usuario eliminado",
  guardar_conteo: "Conteo guardado",
  resetear_conteos: "Conteos reiniciados",
  importar_productos: "Importación de productos",
  exportar_datos: "Exportación de datos",
  recuperar_password: "Recuperación de contraseña",
};

const ACCIONES_DISPONIBLES = Object.keys(ETIQUETAS_ACCION);

/** "dd/MM/yyyy" (formatFecha, es-UY) -- new Date(str) directo lo interpreta
 * como MM/DD/YYYY (US) y rompe la comparación de rangos. */
function parseFechaUY(fecha: string): Date | null {
  const [d, m, y] = fecha.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

export default function HistorialPage() {
  const [entradas, setEntradas] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [accionFiltro, setAccionFiltro] = useState<string[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  useEffect(() => {
    historialService
      .listar()
      .then(setEntradas)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta) : null;

    return entradas.filter((h) => {
      const coincideBusqueda =
        !q || [h.usuarioEmail, h.accion, h.entidad, h.observacion].join(" ").toLowerCase().includes(q);
      const coincideAccion = accionFiltro.length === 0 || accionFiltro.includes(ETIQUETAS_ACCION[h.accion] || h.accion);
      const fechaEntrada = parseFechaUY(h.fecha);
      const coincideDesde = !desdeDate || !fechaEntrada || fechaEntrada >= desdeDate;
      const coincideHasta = !hastaDate || !fechaEntrada || fechaEntrada <= hastaDate;
      return coincideBusqueda && coincideAccion && coincideDesde && coincideHasta;
    });
  }, [entradas, busqueda, accionFiltro, desde, hasta]);

  const hayFiltrosActivos = !!busqueda || accionFiltro.length > 0 || !!desde || !!hasta;

  function limpiarFiltros() {
    setBusqueda("");
    setAccionFiltro([]);
    setDesde("");
    setHasta("");
  }

  async function exportar(formato: "xlsx" | "pdf") {
    if (filtradas.length === 0) {
      toast.error("No hay eventos para exportar");
      return;
    }
    setExportando(true);
    try {
      const datos = filtradas.map((h) => ({
        Fecha: h.fecha,
        Hora: h.hora,
        Usuario: h.usuarioEmail,
        Rol: h.rol,
        Acción: ETIQUETAS_ACCION[h.accion] || h.accion,
        Entidad: h.entidad,
        Detalle: h.valorNuevo,
        Observación: h.observacion,
      }));
      if (formato === "xlsx") exportarExcel(datos, "Historial", "historial");
      if (formato === "pdf")
        exportarPDF(
          datos,
          [
            { header: "Fecha", key: "Fecha" },
            { header: "Hora", key: "Hora" },
            { header: "Usuario", key: "Usuario" },
            { header: "Acción", key: "Acción" },
            { header: "Entidad", key: "Entidad" },
            { header: "Detalle", key: "Detalle" },
          ],
          "Historial de auditoría",
          "historial"
        );
      toast.success(`Exportado (${formato.toUpperCase()})`);
    } finally {
      setExportando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-muted-foreground" size={22} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between flex-wrap">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <Input
              placeholder="Buscar por usuario, acción, producto..."
              className="pl-9"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <SearchableSelect
            value={accionFiltro}
            onValueChange={setAccionFiltro}
            options={ACCIONES_DISPONIBLES.map((a) => ETIQUETAS_ACCION[a] ?? a)}
            allLabel="Todas las acciones"
            placeholder="Buscar acción..."
            className="w-48"
          />
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-[9.5rem]" aria-label="Desde" />
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-[9.5rem]" aria-label="Hasta" />
          {hayFiltrosActivos && (
            <Button variant="outline" size="sm" onClick={limpiarFiltros}>
              <X size={14} />
              Limpiar filtros
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportar("xlsx")} disabled={exportando}>
            {exportando ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportar("pdf")} disabled={exportando}>
            {exportando ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            PDF
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtradas.length} evento{filtradas.length !== 1 ? "s" : ""} de auditoría
        {hayFiltrosActivos ? ` (de ${entradas.length} en total)` : ""}
      </p>

      {filtradas.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {entradas.length === 0 ? "Todavía no hay eventos registrados." : "Sin eventos con estos filtros."}
          </p>
          {hayFiltrosActivos && (
            <Button variant="outline" size="sm" onClick={limpiarFiltros}>
              <X size={14} />
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[560px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border sticky top-0 bg-background z-10">
                    <th className="px-5 py-2 font-medium w-6" />
                    <th className="px-2 py-2 font-medium whitespace-nowrap">Fecha y hora</th>
                    <th className="px-2 py-2 font-medium">Usuario</th>
                    <th className="px-2 py-2 font-medium">Acción</th>
                    <th className="px-2 py-2 font-medium">Entidad</th>
                    <th className="px-5 py-2 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((h) => {
                    const expandido = expandidoId === h.id;
                    return (
                      <Fragment key={h.id}>
                        <tr
                          onClick={() => setExpandidoId(expandido ? null : h.id)}
                          className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                        >
                          <td className="px-5 py-2 text-muted-foreground">
                            {expandido ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap tabular-nums">
                            {h.fecha} <span className="text-muted-foreground">· {h.hora}</span>
                          </td>
                          <td className="px-2 py-2 max-w-[180px] truncate" title={h.usuarioEmail}>
                            <span className="font-medium">{h.usuarioEmail}</span>
                            <span className="text-muted-foreground capitalize"> ({h.rol})</span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <Badge variant="secondary">{ETIQUETAS_ACCION[h.accion] || h.accion}</Badge>
                          </td>
                          <td className="px-2 py-2 max-w-[160px] truncate text-muted-foreground" title={h.entidad}>
                            {h.entidad || "—"}
                          </td>
                          <td className="px-5 py-2 max-w-[240px] truncate text-muted-foreground" title={h.valorNuevo}>
                            {h.valorNuevo || h.observacion || "—"}
                          </td>
                        </tr>
                        {expandido && (
                          <tr className="border-b border-border bg-muted/20">
                            <td colSpan={6} className="px-5 py-3">
                              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                                {h.valorAnterior && (
                                  <div>
                                    <p className="text-muted-foreground mb-0.5">Valor anterior</p>
                                    <p className="break-words">{h.valorAnterior}</p>
                                  </div>
                                )}
                                {h.valorNuevo && (
                                  <div>
                                    <p className="text-muted-foreground mb-0.5">Valor nuevo</p>
                                    <p className="break-words">{h.valorNuevo}</p>
                                  </div>
                                )}
                                {h.observacion && (
                                  <div className="sm:col-span-2">
                                    <p className="text-muted-foreground mb-0.5">Observación</p>
                                    <p className="break-words italic">"{h.observacion}"</p>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Smartphone size={12} />
                                  <span className="truncate" title={h.dispositivo}>{h.dispositivo || "Dispositivo no registrado"}</span>
                                </div>
                                {h.ip && <div className="text-muted-foreground">IP: {h.ip}</div>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
