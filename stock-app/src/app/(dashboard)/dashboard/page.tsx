"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, LabelList, ReferenceLine } from "recharts";
import { Package, CheckCircle2, Clock, TrendingUp, ArrowUpCircle, ArrowDownCircle, Download, Loader2, RotateCcw, RefreshCw, AlertTriangle, ScanBarcode } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData, esContable, normalizarCodigo, mapaPrecios, importeRelevante } from "@/hooks/useDashboardData";
import { StatCard } from "@/components/dashboard/StatCard";
import { ConteosTable } from "@/components/dashboard/ConteosTable";
import { PendientesTable } from "@/components/dashboard/PendientesTable";
import { EditarConteoDialog } from "@/components/dashboard/EditarConteoDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { exportarExcel, exportarPDF } from "@/lib/exportacion";
import { conteosService } from "@/services/conteos.service";
import { AGENCIAS } from "@/types";
import type { Conteo, Producto, EstadoConteo, Agencia } from "@/types";

// Paleta cálida via tokens de globals.css (design-system/stockapp-saman/MASTER.md §2.3):
// coincide -> success (verde grano), sobra -> warning (dorado), falta -> destructive (rojo semántico).
const COLORS = {
  coincide: "hsl(var(--success))",
  falta: "hsl(var(--destructive))",
  sobra: "hsl(var(--warning))",
};
type Vista = EstadoConteo | "pendientes" | "contados" | null;

const LABEL_VISTA: Record<string, string> = {
  coincide: "Coincidencias",
  sobra: "Diferencias +",
  falta: "Diferencias −",
  contados: "Contados",
  pendientes: "Pendientes",
};

function formatearImporte(valor: number): string {
  return `$ ${valor.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}

// Estilo compartido de tooltip de recharts, alineado a la card cálida (globals.css)
// en vez del tooltip blanco/negro por defecto.
const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.5rem",
    fontSize: "12px",
    boxShadow: "0 4px 10px rgba(20,10,5,0.08)",
  },
  labelStyle: { color: "hsl(var(--popover-foreground))" },
  cursor: { fill: "hsl(var(--muted))" },
};

// Auto-actualización: cada cuánto se refresca el Dashboard solo, en milisegundos.
const INTERVALO_AUTO_ACTUALIZACION = 5 * 60 * 60 * 1000; // 5 horas

export default function DashboardPage() {
  const { isAdmin, esSuperAdmin, agencia: agenciaUsuario } = useAuth();
  const [agenciaFiltro, setAgenciaFiltro] = useState<Agencia | undefined>(undefined);
  // Filtro cíclico por zona -- disponible para cualquier usuario (operario
  // incluido), a diferencia del selector de agencia que es solo para admin.
  const [ubicacionFiltro, setUbicacionFiltro] = useState<string[]>([]);
  const [familiaFiltro, setFamiliaFiltro] = useState<string[]>([]);
  const { stats, conteos, productos, loading, error, recargar, opcionesUbicacion, opcionesFamilia } =
    useDashboardData(agenciaFiltro, ubicacionFiltro, familiaFiltro);
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

  const precios = mapaPrecios(productos);

  const pieData = [
    { name: "Coinciden", value: stats.coincidencias, color: COLORS.coincide },
    { name: "Faltan", value: stats.diferenciasNegativas, color: COLORS.falta },
    { name: "Sobran", value: stats.diferenciasPositivas, color: COLORS.sobra },
  ];

  const importeData = [
    { name: "Coincidencias", value: stats.importeCoincidencias, color: COLORS.coincide },
    { name: "Diferencias +", value: stats.importeDiferenciasPositivas, color: COLORS.sobra },
    { name: "Diferencias −", value: stats.importeDiferenciasNegativas, color: COLORS.falta },
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

  // Top 20 más costosos en stock (precio unitario × Stock SAP) de lo que se
  // está viendo ahora mismo -- respeta la agencia y el filtro de zona ya
  // aplicados arriba, así que siempre tiene datos reales para mostrar (no
  // depende de que todas las plantas estén cargadas, a diferencia del
  // intento anterior con "más pedidos" multi-planta).
  const topValorStock = [...productos]
    .map((p) => ({ codigo: p.codigo, descripcion: p.descripcion, valor: (Number(p.precioUnitario) || 0) * Number(p.stockSap || 0) }))
    .filter((p) => p.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 20);

  // Progreso del conteo en el tiempo: cuántos códigos únicos distintos ya se
  // contaron, acumulado a medida que van entrando los conteos (orden
  // cronológico real, no deduplicado por ubicación como `todosLosConteos`).
  // Reemplaza al viejo gráfico "por ubicación" (barras por zona, sin
  // relación temporal) que no se entendía como progreso.
  const totalContable = productos.filter(esContable).length;
  const conteosOrdenados = [...conteos].sort(
    (a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime()
  );
  const codigosVistos = new Set<string>();
  const progresoTiempo = conteosOrdenados.map((c) => {
    codigosVistos.add(normalizarCodigo(c.codigo));
    return {
      momento: new Date(c.creadoEn).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      acumulado: codigosVistos.size,
    };
  });
  // Espaciado de ticks del eje X para no amontonar etiquetas cuando hay
  // muchos conteos -- muestra ~8 como máximo, sin importar cuántos puntos haya.
  const saltoTicksTiempo = Math.max(0, Math.ceil(progresoTiempo.length / 8) - 1);

  const conteosFiltrados = vista && vista !== "pendientes" && vista !== "contados"
    ? todosLosConteos.filter((c) => c.estado === vista)
    : todosLosConteos;

  function toggleVista(v: Vista) {
    setVista((actual) => (actual === v ? null : v));
  }

  function datosConteosParaExportar(lista: Conteo[]) {
    return lista.map((c) => {
      const precio = precios[normalizarCodigo(c.codigo)] || 0;
      return {
        Agencia: c.agencia,
        Código: c.codigo,
        Descripción: c.descripcion,
        Ubicación: c.ubicacion,
        "Stock SAP": c.stockSap,
        "Stock Contado": c.stockContado,
        Diferencia: c.diferencia,
        // Precio de una unidad y valor total de la línea — mismo criterio
        // que la tabla: para diferencias es el valor de la diferencia,
        // para coincidencias el valor de lo contado.
        "Precio unitario": precio,
        Importe: Math.round(importeRelevante(c, precio)),
        Estado: c.estado,
        "Ubicación (nueva)": c.ubicacionNueva || "",
        Usuario: c.usuarioEmail,
        Fecha: c.fecha,
      };
    });
  }

  function datosProductosParaExportar(lista: Producto[]) {
    return lista.map((p) => {
      const precio = Number(p.precioUnitario) || 0;
      return {
        Agencia: p.agencia,
        Código: p.codigo,
        Descripción: p.descripcion,
        Ubicación: p.ubicacion,
        Familia: p.familia,
        "Stock SAP": p.stockSap,
        "Precio unitario": precio,
        Importe: Math.round(precio * Number(p.stockSap || 0)),
      };
    });
  }

  const COLUMNAS_CONTEOS = [
    { header: "Agencia", key: "Agencia" },
    { header: "Código", key: "Código" },
    { header: "Descripción", key: "Descripción" },
    { header: "Ubicación", key: "Ubicación" },
    { header: "SAP", key: "Stock SAP" },
    { header: "Contado", key: "Stock Contado" },
    { header: "Dif.", key: "Diferencia" },
    { header: "Importe", key: "Importe" },
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
    { header: "Importe", key: "Importe" },
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

  const agenciaParaVaciar = (agenciaFiltro || agenciaUsuario || "") as Agencia | "";

  async function vaciarConteos() {
    if (!agenciaParaVaciar) return;

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

  const tituloZona = [...ubicacionFiltro, ...familiaFiltro].join(" · ");
  const tituloAgencia = (agenciaFiltro || agenciaUsuario || "Todas las agencias") + (tituloZona ? ` — ${tituloZona}` : "");
  const hayFiltroActivo = vista !== null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="p-4 md:p-6 space-y-5">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && (
            <>
              <p className="text-sm text-muted-foreground">Ver agencia:</p>
              <Select
                value={agenciaFiltro ?? "todas"}
                onValueChange={(v) => {
                  setAgenciaFiltro(v === "todas" ? undefined : v as Agencia);
                  // Ubicaciones/familias de la agencia anterior ya no aplican.
                  setUbicacionFiltro([]);
                  setFamiliaFiltro([]);
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
            </>
          )}

          {/* Filtro cíclico por zona -- disponible para cualquier usuario,
              no solo admin: un operario también necesita poder acotar su
              propia vista a la ubicación/familia que le toca contar.
              SearchableSelect en vez de <Select> nativo: con catálogos de
              miles de productos, las ubicaciones son demasiadas para un
              dropdown sin buscador. */}
          <SearchableSelect
            value={ubicacionFiltro}
            onValueChange={setUbicacionFiltro}
            options={opcionesUbicacion}
            allLabel="Todas las ubicaciones"
            placeholder="Buscar ubicación..."
            className="w-44"
          />
          <SearchableSelect
            value={familiaFiltro}
            onValueChange={setFamiliaFiltro}
            options={opcionesFamilia}
            allLabel="Todas las familias"
            placeholder="Buscar familia..."
            className="w-40"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={actualizarManual} disabled={actualizando} className="h-8">
            {actualizando ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            Actualizar
          </Button>
          {/* Acceso rápido más prominente entre los accesos de la página
              (design-system/stockapp-saman/pages/dashboard.md) -- no es el
              único CTA (esto es un resumen, no un formulario), pero sí el
              más destacado. */}
          <Button asChild size="sm" className="h-8">
            <Link href="/conteo">
              <ScanBarcode size={14} />
              Nuevo conteo
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Productos totales" value={stats.totalProductos} icon={Package} />
        <StatCard label="Contados" value={stats.totalContados} icon={CheckCircle2} tone="success"
          onClick={() => toggleVista("contados")} activo={vista === "contados"}
          importe={stats.importeContados} />
        <StatCard label="Pendientes (con stock)" value={stats.pendientes} icon={Clock} tone="warning"
          onClick={() => toggleVista("pendientes")} activo={vista === "pendientes"}
          importe={stats.importePendientes} />
        <StatCard label="Avance" value={`${stats.porcentajeCompletado}%`} icon={TrendingUp} />
        <StatCard label="Coincidencias" value={stats.coincidencias} icon={CheckCircle2} tone="success"
          onClick={() => toggleVista("coincide")} activo={vista === "coincide"}
          importe={stats.importeCoincidencias} />
        <StatCard label="Diferencias +" value={stats.diferenciasPositivas} icon={ArrowUpCircle} tone="success"
          onClick={() => toggleVista("sobra")} activo={vista === "sobra"}
          importe={stats.importeDiferenciasPositivas} />
        <StatCard label="Diferencias −" value={stats.diferenciasNegativas} icon={ArrowDownCircle} tone="destructive"
          onClick={() => toggleVista("falta")} activo={vista === "falta"}
          importe={stats.importeDiferenciasNegativas} />
        <StatCard label="Última sincronización"
          value={stats.ultimaSincronizacion
            ? new Date(stats.ultimaSincronizacion).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })
            : "—"}
          icon={Clock} />
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        $ → Importe total en pesos (calculado con el precio unitario cargado en cada producto; los que todavía no tienen precio no suman).
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Estado del conteo — {tituloAgencia}</CardTitle></CardHeader>
          <CardContent>
            {stats.totalContados === 0
              ? <p className="text-sm text-muted-foreground py-8 text-center">Todavía no hay conteos. Andá a "Contar stock" para empezar.</p>
              : <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      // Etiqueta directa (nombre + valor) en vez de depender
                      // solo del color para distinguir las porciones -- se
                      // omiten las de valor 0 para no ensuciar el gráfico.
                      label={({ name, value }) => (value ? `${name}: ${value}` : "")}
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Importe contado (en pesos)</CardTitle></CardHeader>
          <CardContent>
            {stats.importeCoincidencias === 0 && stats.importeDiferenciasPositivas === 0 && stats.importeDiferenciasNegativas === 0
              ? <p className="text-sm text-muted-foreground py-8 text-center">Sin importes para mostrar — cargá precios unitarios en el catálogo.</p>
              : <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={importeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} />
                    <YAxis fontSize={10} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatearImporte(v)} {...tooltipStyle} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {importeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(v: number) => formatearImporte(v)}
                        style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>}
          </CardContent>
        </Card>

      </div>

      {/* Ancho completo, no parte de la grilla de 2 columnas -- una serie de
          tiempo se lee mejor con espacio horizontal de sobra. Area chart con
          degradado (en vez de línea simple) para un look más actual;
          --success porque es, literalmente, progreso positivo acumulándose. */}
      <Card>
        <CardHeader><CardTitle>Progreso del conteo (en el tiempo)</CardTitle></CardHeader>
        <CardContent>
          {progresoTiempo.length === 0
            ? <p className="text-sm text-muted-foreground py-8 text-center">Todavía no hay conteos registrados.</p>
            : <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={progresoTiempo} margin={{ right: 16, top: 8 }}>
                  <defs>
                    <linearGradient id="gradienteProgreso" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="momento" fontSize={10} tickLine={false} interval={saltoTicksTiempo} />
                  <YAxis fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [v, "Códigos contados (acumulado)"]} />
                  {totalContable > 0 && (
                    <ReferenceLine
                      y={totalContable}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      label={{ value: `Total a contar (${totalContable})`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="acumulado"
                    stroke="hsl(var(--success))"
                    strokeWidth={2.5}
                    fill="url(#gradienteProgreso)"
                    dot={progresoTiempo.length <= 30}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>}
        </CardContent>
      </Card>

      {/* Ancho completo, no parte de la grilla de 2 columnas -- con 20
          barras necesita más aire que una card a media pantalla, y
          horizontal (en vez de vertical como el resto) porque con esa
          cantidad de categorías y valores en pesos, las etiquetas de barras
          verticales angostas se pisan entre sí. Dorado (--warning) en vez
          de --primary/--success, ya usados en los gráficos vecinos, para
          que no se repita el mismo color entre gráficos. */}
      <Card>
        <CardHeader><CardTitle>Top 20 más costosos en stock — {tituloAgencia}</CardTitle></CardHeader>
        <CardContent>
          {topValorStock.length === 0
            ? <p className="text-sm text-muted-foreground py-8 text-center">Sin importes para mostrar — cargá precios unitarios en el catálogo.</p>
            : <ResponsiveContainer width="100%" height={560}>
                <BarChart data={topValorStock} layout="vertical" margin={{ left: 8, right: 72 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={10} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="codigo" type="category" fontSize={11} width={90} tickLine={false} />
                  <Tooltip
                    {...tooltipStyle}
                    labelFormatter={(codigo, payload) => {
                      const descripcion = payload?.[0]?.payload?.descripcion;
                      return descripcion ? `${codigo} — ${descripcion}` : codigo;
                    }}
                    formatter={(v: number) => [formatearImporte(v), "Valor en stock"]}
                  />
                  <Bar dataKey="valor" radius={[0, 6, 6, 0]} fill="hsl(var(--warning))">
                    <LabelList
                      dataKey="valor"
                      position="right"
                      formatter={(v: number) => formatearImporte(v)}
                      style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>}
        </CardContent>
      </Card>

      {vista === "pendientes"
        ? <PendientesTable productos={productosPendientes} onQuitarFiltro={() => setVista(null)} />
        : <ConteosTable conteos={conteosFiltrados} filtro={vista === "contados" ? null : (vista as EstadoConteo | null)}
            onQuitarFiltro={() => setVista(null)} onEditar={setConteoAEditar} onEliminado={recargar} precios={precios} />}

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
