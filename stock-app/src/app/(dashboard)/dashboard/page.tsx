"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { Package, CheckCircle2, Clock, TrendingUp, ArrowUpCircle, ArrowDownCircle, Download, Loader2, RotateCcw, RefreshCw, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData, esContable, normalizarCodigo } from "@/hooks/useDashboardData";
import { StatCard } from "@/components/dashboard/StatCard";
import { ConteosTable } from "@/components/dashboard/ConteosTable";
import { PendientesTable } from "@/components/dashboard/PendientesTable";
import { EditarConteoDialog } from "@/components/dashboard/EditarConteoDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportarExcel, exportarPDF } from "@/lib/exportacion";
import { conteosService } from "@/services/conteos.service";
import { AGENCIAS } from "@/types";
import type { Conteo, Producto, EstadoConteo, Agencia } from "@/types";

const COLORS = { coincide: "#16a34a", falta: "#dc2626", sobra: "#2563eb" };
type Vista = EstadoConteo | "pendientes" | "contados" | null;

const LABEL_VISTA: Record<string, string> = {
  coincide: "Coincidencias",
  sobra: "Diferencias +",
  falta: "Diferencias −",
  contados: "Contados",
  pendientes: "Pendientes",
};

// Auto-actualización: cada cuánto se refresca el Dashboard solo, en milisegundos.
const INTERVALO_AUTO_ACTUALIZACION = 5 * 60 * 60 * 1000; // 5 horas

export default function DashboardPage() {
  const { isAdmin, esSuperAdmin, agencia: agenciaUsuario } = useAuth();
  const [agenciaFiltro, setAgenciaFiltro] = useState<Agencia | undefined>(undefined);
  const { stats, conteos, productos, loading, error, recargar } = useDashboardData(agenciaFiltro);
  const [vista, setVista] = useState<Vista>(null);
  const [conteoAEditar, setConteoAEditar] = useState<Conteo | null>(null);
  const [vaciando, setVaciando] = useState(false);
  const [vaciandoTodas, setVaciandoTodas] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  useEffect(() => {
    const intervalo = setInterval(() => {
      recargar();
    }, INTERVALO_AUTO_ACTUALIZACION);
    return () => clearInterval(intervalo);
  }, [recargar]);

  async function actualizarManual() {
    setActualizando(true);
    try {
      await recargar();
      toast.success("Dashboard actualizado");
    } finally {
      setActualizando(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-[280px]" /><Skeleton className="h-[280px]" />
        </div>
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

  const pieData = [
    { name: "Coinciden", value: stats.coincidencias, color: COLORS.coincide },
    { name: "Faltan", value: stats.diferenciasNegativas, color: COLORS.falta },
    { name: "Sobran", value: stats.diferenciasPositivas, color: COLORS.sobra },
  ];

  const ultimoPorCodigoUbicacion = new Map<string, Conteo>();
  for (const c of conteos) {
    const clave = `${normalizarCodigo(c.codigo)}|||${c.ubicacionNueva || c.ubicacion || ""}`;
    const prev = ultimoPorCodigoUbicacion.get(clave);
    if (!prev || new Date(c.creadoEn) > new Date(prev.creadoEn)) ultimoPorCodigoUbicacion.set(clave, c);
  }
  const todosLosConteos = Array.from(ultimoPorCodigoUbicacion.values());

  const codigosContados = new Set(conteos.map((c) => normalizarCodigo(c.codigo)));
  const productosPendientes = productos.filter(
    (p) => esContable(p) && !codigosContados.has(normalizarCodigo(p.codigo))
  );

  const topDiferencias = [...todosLosConteos]
    .filter((c) => c.diferencia !== 0)
    .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
    .slice(0, 8)
    .map((c) => ({ codigo: c.codigo, diferencia: c.diferencia }));

  const porUbicacion = new Map<string, { contados: number }>();
  todosLosConteos.forEach((c) => {
    const key = c.ubicacionNueva || c.ubicacion || "Sin ubicación";
    const actual = porUbicacion.get(key) || { contados: 0 };
    actual.contados += 1;
    porUbicacion.set(key, actual);
  });
  const progresoUbicacion = Array.from(porUbicacion.entries())
    .map(([ubicacion, v]) => ({ ubicacion, contados: v.contados }))
    .sort((a, b) => b.contados - a.contados)
    .slice(0, 8);

  const conteosFiltrados = vista && vista !== "pendientes" && vista !== "contados"
    ? todosLosConteos.filter((c) => c.estado === vista)
    : todosLosConteos;

  function toggleVista(v: Vista) {
    setVista((actual) => (actual === v ? null : v));
  }

  function datosConteosParaExportar(lista: Conteo[]) {
    return lista.map((c) => ({
      Agencia: c.agencia,
      Código: c.codigo,
      Descripción: c.descripcion,
      Ubicación: c.ubicacion,
      "Stock SAP": c.stockSap,
      "Stock Contado": c.stockContado,
      Diferencia: c.diferencia,
      Estado: c.estado,
      "Ubicación (nueva)": c.ubicacionNueva || "",
      Usuario: c.usuarioEmail,
      Fecha: c.fecha,
    }));
  }

  function datosProductosParaExportar(lista: Producto[]) {
    return lista.map((p) => ({
      Agencia: p.agencia,
      Código: p.codigo,
      Descripción: p.descripcion,
      Ubicación: p.ubicacion,
      Familia: p.familia,
      "Stock SAP": p.stockSap,
    }));
  }

  const COLUMNAS_CONTEOS = [
    { header: "Agencia", key: "Agencia" },
    { header: "Código", key: "Código" },
    { header: "Descripción", key: "Descripción" },
    { header: "Ubicación", key: "Ubicación" },
    { header: "SAP", key: "Stock SAP" },
    { header: "Contado", key: "Stock Contado" },
    { header: "Dif.", key: "Diferencia" },
    { header: "Estado", key: "Estado" },
    { header: "Ubic. nueva", key: "Ubicación (nueva)" },
  ];

  const COLUMNAS_PENDIENTES = [
    { header: "Agencia", key: "Agencia" },
    { header: "Código", key: "Código" },
    { header: "Descripción", key: "Descripción" },
    { header: "Ubicación", key: "Ubicación" },
    { header: "Familia", key: "Familia" },
    { header: "SAP", key: "Stock SAP" },
  ];

  function exportarReporte(formato: "xlsx" | "pdf", alcance: "vista" | "todo") {
    const esPendientes = alcance === "vista" && vista === "pendientes";
    const tituloVista = alcance === "todo" ? "Todos los conteos" : vista ? LABEL_VISTA[vista] || vista : "Todos los conteos";
    const sufijoArchivo = alcance === "todo" ? "todo" : (vista || "todos");

    if (esPendientes) {
      const datos = datosProductosParaExportar(productosPendientes);
      if (datos.length === 0) {
        toast.error("No hay artículos pendientes para exportar");
        return;
      }
      if (formato === "xlsx") exportarExcel(datos, "Pendientes", `pendientes-${sufijoArchivo}`);
      if (formato === "pdf") exportarPDF(datos, COLUMNAS_PENDIENTES, `Pendientes — ${agenciaFiltro || agenciaUsuario || "general"}`, `pendientes-${sufijoArchivo}`);
      return;
    }

    const lista = alcance === "todo" ? todosLosConteos : conteosFiltrados;
    const datos = datosConteosParaExportar(lista);
    if (datos.length === 0) {
      toast.error("No hay conteos para exportar");
      return;
    }
    if (formato === "xlsx") exportarExcel(datos, "Reporte", `reporte-${sufijoArchivo}`);
    if (formato === "pdf") exportarPDF(datos, COLUMNAS_CONTEOS, `${tituloVista} — ${agenciaFiltro || agenciaUsuario || "general"}`, `reporte-${sufijoArchivo}`);
  }

  // Agencia puntual a vaciar: la que esté filtrada en "Ver agencia", o si no
  // hay filtro, la propia del usuario (para un jefe de planta, siempre la
  // suya). Si ninguna de las dos existe (super admin con "Todas las
  // agencias" seleccionado), NO hay agencia puntual — el botón normal de
  // vaciar queda deshabilitado a propósito, para que nunca borre todo por
  // default. Vaciar TODAS las agencias es una acción aparte, explícita.
  const agenciaParaVaciar = (agenciaFiltro || agenciaUsuario || "") as Agencia | "";

  async function vaciarConteos() {
    if (!agenciaParaVaciar) return; // el botón ya debería estar deshabilitado en este caso

    const msg = `Esto va a eliminar TODOS los conteos de ${agenciaParaVaciar} (${conteos.length} en total, según lo cargado ahora). ¿Continuar?`;
    if (!window.confirm(msg)) return;
    if (!window.confirm(`Confirmá de nuevo: se van a borrar los conteos de ${agenciaParaVaciar}. Esta acción NO se puede deshacer.`)) return;

    setVaciando(true);
    try {
      const res = await conteosService.resetear(agenciaParaVaciar);
      toast.success(`${res.eliminados} conteos eliminados de ${agenciaParaVaciar}`);
      setVista(null);
      recargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo vaciar");
    } finally {
      setVaciando(false);
    }
  }

  async function vaciarTodasLasAgencias() {
    if (!window.confirm(`⚠️ Esto va a eliminar TODOS los conteos de TODAS LAS AGENCIAS (${conteos.length}+ registros en total). ¿Estás seguro?`)) return;
    if (!window.confirm('Última confirmación: se borra el historial de conteos de TODA la empresa, no de una agencia. Esta acción NO se puede deshacer. ¿Continuar?')) return;

    setVaciandoTodas(true);
    try {
      const res = await conteosService.resetear(null);
      toast.success(`${res.eliminados} conteos eliminados (todas las agencias)`);
      setVista(null);
      recargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo vaciar");
    } finally {
      setVaciandoTodas(false);
    }
  }

  const tituloAgencia = agenciaFiltro || agenciaUsuario || "Todas las agencias";
  const hayFiltroActivo = vista !== null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="p-4 md:p-6 space-y-5">

      <div className="flex items-center justify-between flex-wrap gap-3">
        {isAdmin ? (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">Ver agencia:</p>
            <Select
              value={agenciaFiltro ?? "todas"}
              onValueChange={(v) => {
                setAgenciaFiltro(v === "todas" ? undefined : v as Agencia);
                setVista(null);
              }}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las agencias</SelectItem>
                {AGENCIAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {agenciaFiltro ? `Mostrando: ${agenciaFiltro}` : "Mostrando el consolidado de toda la empresa"}
            </span>
          </div>
        ) : <div />}

        <Button variant="outline" size="sm" onClick={actualizarManual} disabled={actualizando} className="h-8">
          {actualizando ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Productos totales" value={stats.totalProductos} icon={Package} />
        <StatCard label="Contados" value={stats.totalContados} icon={CheckCircle2} tone="success"
          onClick={() => toggleVista("contados")} activo={vista === "contados"} />
        <StatCard label="Pendientes (con stock)" value={stats.pendientes} icon={Clock} tone="warning"
          onClick={() => toggleVista("pendientes")} activo={vista === "pendientes"} />
        <StatCard label="Avance" value={`${stats.porcentajeCompletado}%`} icon={TrendingUp} />
        <StatCard label="Coincidencias" value={stats.coincidencias} icon={CheckCircle2} tone="success"
          onClick={() => toggleVista("coincide")} activo={vista === "coincide"} />
        <StatCard label="Diferencias +" value={stats.diferenciasPositivas} icon={ArrowUpCircle} tone="success"
          onClick={() => toggleVista("sobra")} activo={vista === "sobra"} />
        <StatCard label="Diferencias −" value={stats.diferenciasNegativas} icon={ArrowDownCircle} tone="destructive"
          onClick={() => toggleVista("falta")} activo={vista === "falta"} />
        <StatCard label="Última sincronización"
          value={stats.ultimaSincronizacion
            ? new Date(stats.ultimaSincronizacion).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })
            : "—"}
          icon={Clock} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Estado del conteo — {tituloAgencia}</CardTitle></CardHeader>
          <CardContent>
            {stats.totalContados === 0
              ? <p className="text-sm text-muted-foreground py-8 text-center">Todavía no hay conteos. Andá a "Contar stock" para empezar.</p>
              : <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top diferencias</CardTitle></CardHeader>
          <CardContent>
            {topDiferencias.length === 0
              ? <p className="text-sm text-muted-foreground py-8 text-center">Sin diferencias registradas todavía.</p>
              : <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topDiferencias}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="codigo" fontSize={10} tickLine={false} />
                    <YAxis fontSize={10} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="diferencia" radius={[6, 6, 0, 0]}>
                      {topDiferencias.map((d, i) => <Cell key={i} fill={d.diferencia > 0 ? COLORS.sobra : COLORS.falta} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Progreso por ubicación</CardTitle></CardHeader>
          <CardContent>
            {progresoUbicacion.length === 0
              ? <p className="text-sm text-muted-foreground py-8 text-center">Sin datos todavía.</p>
              : <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={progresoUbicacion} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" fontSize={10} tickLine={false} />
                    <YAxis dataKey="ubicacion" type="category" fontSize={11} width={110} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="contados" radius={[0, 6, 6, 0]} fill="#2f5fed" />
                  </BarChart>
                </ResponsiveContainer>}
          </CardContent>
        </Card>
      </div>

      {vista === "pendientes"
        ? <PendientesTable productos={productosPendientes} onQuitarFiltro={() => setVista(null)} />
        : <ConteosTable conteos={conteosFiltrados} filtro={vista === "contados" ? null : (vista as EstadoConteo | null)}
            onQuitarFiltro={() => setVista(null)} onEditar={setConteoAEditar} onEliminado={recargar} />}

      <Card>
        <CardHeader>
          <CardTitle>Reporte — {tituloAgencia}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {hayFiltroActivo
                ? `Vista actual: ${LABEL_VISTA[vista as string] || vista} — exporta solo lo que ves en la tabla de arriba`
                : "Sin filtro activo — exporta todos los conteos"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => exportarReporte("xlsx", "vista")}>
                <Download size={15} /> Exportar Excel {hayFiltroActivo ? "(vista actual)" : ""}
              </Button>
              <Button variant="secondary" onClick={() => exportarReporte("pdf", "vista")}>
                <Download size={15} /> Exportar PDF {hayFiltroActivo ? "(vista actual)" : ""}
              </Button>
            </div>
          </div>

          {hayFiltroActivo && (
            <div className="space-y-1.5 pt-1 border-t border-border">
              <p className="text-xs text-muted-foreground pt-2">Ignorando el filtro — todo el conteo:</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => exportarReporte("xlsx", "todo")}>
                  <Download size={13} /> Exportar todo (Excel)
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportarReporte("pdf", "todo")}>
                  <Download size={13} /> Exportar todo (PDF)
                </Button>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-muted-foreground">
                  {agenciaParaVaciar
                    ? `Vacía solo los conteos de: ${agenciaParaVaciar}`
                    : "Elegí una agencia específica arriba (\"Ver agencia\") para poder vaciar sus conteos"}
                </p>
                <Button
                  variant="destructive"
                  onClick={vaciarConteos}
                  disabled={vaciando || !agenciaParaVaciar || conteos.length === 0}
                >
                  {vaciando ? <Loader2 className="animate-spin" size={15} /> : <RotateCcw size={15} />}
                  Vaciar conteos {agenciaParaVaciar ? `(${agenciaParaVaciar})` : ""}
                </Button>
              </div>

              {esSuperAdmin && (
                <div className="flex items-center justify-between flex-wrap gap-2 bg-destructive/5 rounded-lg px-3 py-2">
                  <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertTriangle size={13} />
                    Acción global — borra el historial de TODAS las agencias a la vez
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={vaciarTodasLasAgencias}
                    disabled={vaciandoTodas}
                  >
                    {vaciandoTodas ? <Loader2 className="animate-spin" size={13} /> : <AlertTriangle size={13} />}
                    Vaciar TODAS las agencias
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <EditarConteoDialog key={conteoAEditar?.id || "none"} conteo={conteoAEditar}
        onClose={() => setConteoAEditar(null)} onGuardado={recargar} />
    </motion.div>
  );
}
