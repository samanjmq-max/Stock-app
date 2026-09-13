"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Clock, TrendingUp, TrendingDown, Equal, Download, Loader2, RotateCcw, RefreshCw, AlertTriangle, ScanBarcode } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData, esContable, normalizarCodigo, mapaPrecios, importeRelevante } from "@/hooks/useDashboardData";
import { StatCard } from "@/components/dashboard/StatCard";
import { FiltrosMoviles } from "@/components/layout/FiltrosMoviles";
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
import { cn } from "@/lib/utils";
import type { Conteo, Producto, EstadoConteo, Agencia } from "@/types";

// Mismo criterio de formato que StatCard y DashboardCharts. Está repetido en
// los tres archivos; unificarlo en lib/utils es una limpieza pendiente, sin
// urgencia porque la regla de formato no cambió nunca.
function formatearImporte(valor: number): string {
  return `$ ${valor.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}

/*
  Semáforo del conteo, en clave de variación — no de "bien / mal".

  Antes era coincide=verde, falta=rojo, sobra=dorado. El problema: el dorado no
  decía nada (¿advertencia de qué?) y el verde se gastaba en el caso que NO pide
  ninguna acción, dejando a las dos diferencias sin par visual.

  Ahora se lee como un gráfico de cotización, que es el modelo mental que ya
  tiene cualquiera: lo que baja en rojo, lo que sube en verde, y el punto de
  equilibrio en azul. Las dos diferencias quedan enfrentadas y el caso neutro
  sale del camino.

  Esto convive con la regla del sistema de que el azul (--info) es el color del
  sistema: acá significa exactamente eso, "nada que hacer", no un estado del
  stock. Ver design-system/stockapp-saman/MASTER.md §2.3.
*/
const COLORS = {
  coincide: "hsl(var(--info))",
  falta: "hsl(var(--destructive))",
  sobra: "hsl(var(--success))",
};
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

// recharts es la librería más pesada del bundle de Dashboard -- separada en
// su propio componente cargado dinámicamente (ssr:false), mismo criterio
// que ya usa Conteo para BarcodeScanner/OcrScanner, para que no viaje en el
// chunk inicial de la página.
const DashboardCharts = dynamic(() => import("@/components/dashboard/DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>
      <Skeleton className="h-[320px]" />
      <Skeleton className="h-[560px]" />
    </div>
  ),
});

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

  /*
    Un solo vocabulario en toda la pantalla: "Coincidencias", "Diferencias −",
    "Diferencias +", y siempre en ese orden. Antes el gráfico de torta decía
    "Coinciden / Faltan / Sobran" y el de importes decía otra cosa, en otro
    orden, y las tarjetas una tercera — tres nombres para los mismos tres
    estados obligan a re-leer cada gráfico. Los nombres salen de LABEL_VISTA
    para que no haya forma de que se desincronicen otra vez.
  */
  const pieData = [
    { name: LABEL_VISTA.coincide!, value: stats.coincidencias, color: COLORS.coincide },
    { name: LABEL_VISTA.falta!, value: stats.diferenciasNegativas, color: COLORS.falta },
    { name: LABEL_VISTA.sobra!, value: stats.diferenciasPositivas, color: COLORS.sobra },
  ];

  const importeData = [
    { name: LABEL_VISTA.coincide!, value: stats.importeCoincidencias, color: COLORS.coincide },
    { name: LABEL_VISTA.falta!, value: stats.importeDiferenciasNegativas, color: COLORS.falta },
    { name: LABEL_VISTA.sobra!, value: stats.importeDiferenciasPositivas, color: COLORS.sobra },
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
  function limpiarFiltrosDashboard() {
    setAgenciaFiltro(undefined);
    setUbicacionFiltro([]);
    setFamiliaFiltro([]);
    setVista(null);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="p-4 md:p-6 space-y-5">

      {/* Control único de filtros en celular. En escritorio no se dibuja:
          ahí los filtros van en línea, que es lo que ya funcionaba. */}
      <FiltrosMoviles
        agencia={
          isAdmin
            ? {
                valor: agenciaFiltro ?? "todas",
                valorNeutro: "todas",
                opciones: [
                  { valor: "todas", etiqueta: "Todas las agencias" },
                  ...AGENCIAS.map((a) => ({ valor: a, etiqueta: a })),
                ],
                onChange: (v) => {
                  setAgenciaFiltro(v === "todas" ? undefined : (v as Agencia));
                  setUbicacionFiltro([]);
                  setFamiliaFiltro([]);
                  setVista(null);
                },
              }
            : undefined
        }
        ubicacion={ubicacionFiltro}
        opcionesUbicacion={opcionesUbicacion}
        onUbicacion={setUbicacionFiltro}
        familia={familiaFiltro}
        opcionesFamilia={opcionesFamilia}
        onFamilia={setFamiliaFiltro}
        onLimpiar={limpiarFiltrosDashboard}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="hidden items-center gap-3 flex-wrap md:flex">
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

      {/*
        NIVEL 1 — La pregunta que todos traen al abrir la app: ¿cómo viene el
        conteo? Una sola cifra grande, con la barra que la hace legible de un
        vistazo y los absolutos abajo.

        Reemplaza a cuatro tarjetas sueltas que decían lo mismo repartido
        ("Productos totales", "Contados", "Avance", "Última sincronización").
        Los totales pasan a ser el denominador, los contados el numerador, y
        la última sincronización ya vive en el topbar, así que no se pierde
        ningún dato: se pierde la repetición.
      */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-5 p-5">
          <div className="shrink-0">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-muted-foreground">
              Avance del conteo
            </p>
            <p className="mt-2 font-display text-[clamp(38px,8vw,56px)] font-bold leading-none tracking-tight tabular-nums text-avance">
              {stats.porcentajeCompletado}%
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{tituloAgencia}</p>
          </div>

          <div className="min-w-[200px] flex-1">
            <div className="h-[7px] w-full overflow-hidden rounded-full bg-muted">
              <div
                /* Fucsia de avance -- el mismo color que la tarjeta de
                   "Pendientes", para que se lea de un vistazo que este
                   porcentaje habla justamente de eso. Ni verde (ahora es
                   "Diferencias +") ni terracota (es el color de las
                   acciones): el avance no es un estado del stock. */
                className="h-full rounded-full bg-avance transition-[width] duration-base ease-out-soft"
                style={{ width: `${Math.min(100, Math.max(0, stats.porcentajeCompletado))}%` }}
              />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
              {/* Sigue siendo el filtro de "contados", que antes vivía en su
                  propia tarjeta -- no se pierde, cambia de lugar. */}
              <button
                type="button"
                onClick={() => toggleVista("contados")}
                className={cn(
                  "rounded px-1.5 py-0.5 transition-colors duration-quick hover:bg-elevated hover:text-foreground",
                  vista === "contados" && "bg-elevated text-foreground"
                )}
              >
                {stats.totalContados.toLocaleString("es-UY")} contados
              </button>
              <span>{stats.totalProductos.toLocaleString("es-UY")} productos totales</span>
            </div>
          </div>

          <TrendingUp size={18} className="hidden shrink-0 text-muted-foreground sm:block" />
        </CardContent>
      </Card>

      {/*
        NIVEL 3 — Estado del conteo. Cuatro tarjetas, no ocho, y todas del
        mismo tipo de dato: cuántos productos hay en cada estado. El importe
        baja a metadato dentro de la tarjeta en vez de competir con la cifra.
      */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Los tres iconos son el mismo gesto de cotización: la línea quebrada
            que baja, la que sube, y el igual para el equilibrio. Antes eran
            flechas en círculo, que se leen como "mover" o "descargar" y no
            como "varió". */}
        <StatCard label={LABEL_VISTA.coincide!} value={stats.coincidencias} icon={Equal} tone="info"
          onClick={() => toggleVista("coincide")} activo={vista === "coincide"}
          importe={stats.importeCoincidencias} />
        {/* El aviso de faltantes vive DENTRO de la tarjeta, no en una franja
            roja aparte: esa franja ocupaba una pantalla entera de alto en
            celular para decir lo mismo que ya dice esta cifra. */}
        <StatCard label={LABEL_VISTA.falta!} value={stats.diferenciasNegativas} icon={TrendingDown} tone="destructive"
          onClick={() => toggleVista("falta")} activo={vista === "falta"}
          importe={stats.importeDiferenciasNegativas}
          aviso={stats.diferenciasNegativas > 0 ? "Sin revisar" : undefined} />
        <StatCard label={LABEL_VISTA.sobra!} value={stats.diferenciasPositivas} icon={TrendingUp} tone="success"
          onClick={() => toggleVista("sobra")} activo={vista === "sobra"}
          importe={stats.importeDiferenciasPositivas} />
        {/* Fucsia, igual que el avance de arriba: son las dos caras del
            mismo número. El porcentaje dice cuánto se hizo, esta tarjeta
            cuánto queda. */}
        <StatCard label="Pendientes (con stock)" value={stats.pendientes} icon={Clock} tone="avance"
          onClick={() => toggleVista("pendientes")} activo={vista === "pendientes"}
          importe={stats.importePendientes} />
      </div>

      <p className="-mt-2 text-xs text-muted-foreground">
        $ → Importe total en pesos (calculado con el precio unitario cargado en cada producto; los que todavía no tienen precio no suman).
      </p>

      <DashboardCharts
        stats={stats}
        tituloAgencia={tituloAgencia}
        pieData={pieData}
        importeData={importeData}
        topValorStock={topValorStock}
        progresoTiempo={progresoTiempo}
        totalContable={totalContable}
        saltoTicksTiempo={saltoTicksTiempo}
      />

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
