"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Archive, Building2, FileText, AlertTriangle, RefreshCw, FileSpreadsheet, Trash2,
  Search, ChevronsUpDown, Check, ChevronDown, X,
} from "lucide-react";
import { resumenService } from "@/services/resumen.service";
import type { DetalleCierre, ResumenMensual } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/hooks/useConfirm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fmtNum(n: number | undefined): string {
  return Number(n || 0).toLocaleString("es-UY", { maximumFractionDigits: 0 });
}
function fmtPesos(n: number | undefined): string {
  return "$ " + Number(n || 0).toLocaleString("es-UY", { maximumFractionDigits: 0 });
}
// Google Sheets suele convertir "2026-09" y las fechas a su propio formato y
// las devuelve como timestamp ISO. Se formatean acá para que se lean bien.
function fmtPeriodo(v: string): string {
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toLocaleDateString("es-UY", { month: "2-digit", year: "numeric" });
  return String(v ?? "—");
}

/**
 * Fecha real del cierre. `fechaCierre` puede venir como "dd/MM/yyyy" (texto)
 * o como timestamp ISO (si Sheets la convirtió); si ninguna sirve se usa
 * `creadoEn`, que siempre es ISO.
 */
function fechaDe(r: ResumenMensual): Date | null {
  const texto = String(r.fechaCierre ?? "");
  const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(texto);
  if (texto && !isNaN(d.getTime())) return d;
  const c = new Date(r.creadoEn);
  return isNaN(c.getTime()) ? null : c;
}
// Partes de la fecha de cierre para el mini-almanaque (mes / día / año).
function partesFecha(d: Date | null): { mes: string; dia: string; anio: string } {
  if (!d) return { mes: "—", dia: "", anio: "" };
  return {
    mes: d.toLocaleDateString("es-UY", { month: "short" }).replace(".", ""),
    dia: String(d.getDate()),
    anio: String(d.getFullYear()),
  };
}
function fmtDia(d: Date | null): string {
  return d ? d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }) : "Sin fecha";
}
function fmtMes(d: Date | null): string {
  if (!d) return "Sin fecha";
  const t = d.toLocaleDateString("es-UY", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function quienCerro(r: ResumenMensual): string {
  return r.usuarioCierre || r.emailCierre || "—";
}

// Los artículos de un cierre se borran solos a los 2 meses (lo hace el
// backend; acá solo se calcula la fecha para avisarle al usuario).
const MESES_RETENCION = 2;
function fechaDeBorrado(r: ResumenMensual): string {
  const base = new Date(r.creadoEn);
  const d = isNaN(base.getTime()) ? fechaDe(r) : base;
  if (!d) return "";
  const v = new Date(d);
  v.setMonth(v.getMonth() + MESES_RETENCION);
  return fmtDia(v);
}

// Las 4 categorías del cierre, en el mismo orden y color que el Dashboard.
type Categoria = "coincide" | "sobra" | "falta" | "pendientes";
function categorias(r: ResumenMensual): { clave: Categoria; label: string; art?: number; pesos?: number; color: string }[] {
  return [
    { clave: "coincide", label: "Coincidencias", art: r.coincidencias, pesos: r.importeCoincidencias, color: "hsl(var(--success))" },
    { clave: "sobra", label: "Diferencias +", art: r.diferenciasPositivas, pesos: r.importeDiferenciasPositivas, color: "hsl(var(--info))" },
    { clave: "falta", label: "Diferencias −", art: r.diferenciasNegativas, pesos: r.importeDiferenciasNegativas, color: "hsl(var(--destructive))" },
    { clave: "pendientes", label: "Por contar", art: r.porContar, pesos: r.importePorContar, color: "hsl(var(--avance))" },
  ];
}

/**
 * A qué tarjeta pertenece un artículo guardado. Lo que se contó y no existe
 * en SAP va con las diferencias positivas: es mercadería de más. "Por contar"
 * no tiene artículos guardados (solo se guarda lo que se contó).
 */
function esDeCategoria(a: DetalleCierre, cat: Categoria): boolean {
  if (cat === "coincide") return a.estado === "coincide";
  if (cat === "sobra") return a.estado === "sobra" || a.estado === "no_existe";
  if (cat === "falta") return a.estado === "falta";
  return false;
}

// Los dos botones del buscador ("Listo" y "Quitar filtros") se hunden al tocarlos.
const BOTON_VIVO = "transition-all duration-quick active:scale-95";

/* ---------- Filtros (los cuatro viven escondidos dentro de la lupa) ---------- */

type ClaveFiltro = "dia" | "mes" | "planta" | "quien";
type Filtros = Record<ClaveFiltro, string[]>;

const FILTROS_VACIOS: Filtros = { dia: [], mes: [], planta: [], quien: [] };
const GRUPOS: { clave: ClaveFiltro; nombre: string; todos: string }[] = [
  { clave: "dia", nombre: "Día", todos: "Todos" },
  { clave: "mes", nombre: "Mes", todos: "Todos" },
  { clave: "planta", nombre: "Planta", todos: "Todas" },
  { clave: "quien", nombre: "Quién cierra", todos: "Todos" },
];

/** Un cierre con sus valores de filtro ya calculados. */
interface Fila {
  r: ResumenMensual;
  fecha: Date | null;
  valores: Record<ClaveFiltro, string>;
}

/* ---------- Estado de cada artículo (color + texto, nunca el color solo) ---------- */

const ORDEN_ESTADO: Record<string, number> = { falta: 0, sobra: 1, no_existe: 2, coincide: 3 };
function etiquetaEstado(a: DetalleCierre): { texto: string; color: string } {
  const dif = Math.abs(Number(a.diferencia) || 0);
  switch (a.estado) {
    case "falta": return { texto: `Falta ${fmtNum(dif)}`, color: "hsl(var(--destructive))" };
    case "sobra": return { texto: `Sobra ${fmtNum(dif)}`, color: "hsl(var(--info))" };
    case "no_existe": return { texto: "No existe en SAP", color: "hsl(var(--warning))" };
    default: return { texto: "Coincide", color: "hsl(var(--success))" };
  }
}

// Cuántos artículos se dibujan de entrada. Un cierre puede traer miles: se
// cargan todos de una vez, pero se muestran de a tandas para que el celular
// no se trabe al abrir la tarjeta.
const TANDA = 100;

export default function EstadoPage() {
  const { esSuperAdmin, capacidades, alcance } = useAuth();
  const { confirm, ConfirmDialogElement } = useConfirm();
  const [resumenes, setResumenes] = useState<ResumenMensual[]>([]);
  const [loading, setLoading] = useState(true);
  // Un fallo de carga NO es lo mismo que "no hay cierres".
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  // Lupa: buscador + filtros.
  const [lupaAbierta, setLupaAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [grupoAbierto, setGrupoAbierto] = useState<ClaveFiltro | null>(null);

  // Tarjeta abierta (una a la vez) y sus artículos. Al esconderla se sueltan
  // de memoria; se vuelven a pedir si se abre de nuevo.
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  // Cuál de las tarjetas de estado (coincidencias, diferencias + o −) se está viendo.
  const [abiertoCat, setAbiertoCat] = useState<Categoria | null>(null);
  const [detalle, setDetalle] = useState<DetalleCierre[] | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(TANDA);
  // Qué tarjeta está abierta AHORA, para descartar respuestas que llegan tarde.
  const abiertoRef = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await resumenService.listar();
      setResumenes(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo cargar el estado por planta";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /** Borrar es del Encargado de Almacén (sus plantas) y del súper admin. El servidor lo vuelve a verificar. */
  function puedeBorrar(r: ResumenMensual): boolean {
    if (esSuperAdmin) return true;
    return !!capacidades?.cerrarCiclo && alcance.includes(r.agencia);
  }

  function esconder() {
    abiertoRef.current = null;
    setAbiertoId(null);
    setAbiertoCat(null);
    setDetalle(null);
    setErrorDetalle(null);
    setVisibles(TANDA);
  }

  async function abrir(r: ResumenMensual, cat: Categoria, reintento = false) {
    // Tocar de nuevo la misma tarjeta la esconde.
    if (!reintento && abiertoId === r.id && abiertoCat === cat) { esconder(); return; }
    setAbiertoCat(cat);
    setVisibles(TANDA);
    // Otra tarjeta del MISMO cierre: los artículos ya están cargados, solo cambia el filtro.
    if (!reintento && abiertoId === r.id && detalle) return;
    abiertoRef.current = r.id;
    setAbiertoId(r.id);
    setDetalle(null);
    setErrorDetalle(null);
    setVisibles(TANDA);
    try {
      const data = await resumenService.detalle(r.id);
      data.sort((a, b) =>
        (ORDEN_ESTADO[a.estado] ?? 9) - (ORDEN_ESTADO[b.estado] ?? 9) ||
        String(a.codigo).localeCompare(String(b.codigo), "es", { numeric: true })
      );
      // Si mientras cargaba se abrió otra tarjeta, esta respuesta se descarta.
      if (abiertoRef.current === r.id) setDetalle(data);
    } catch (err) {
      if (abiertoRef.current === r.id) {
        setErrorDetalle(err instanceof Error ? err.message : "No se pudieron cargar los artículos");
      }
    }
  }

  async function eliminarCierre(r: ResumenMensual) {
    if (!puedeBorrar(r) || !r.id) return;
    const ok = await confirm({
      titulo: `¿Borrar el cierre de ${r.agencia}?`,
      descripcion:
        "Se borra el cierre completo: el resumen y sus artículos guardados. El documento que se descargó al cerrar no se toca. Esta acción no se puede deshacer.",
      textoConfirmar: "Borrar cierre",
      variante: "destructive",
    });
    if (!ok) return;
    setEliminandoId(r.id);
    try {
      await resumenService.eliminar(r.id);
      setResumenes((prev) => prev.filter((x) => x.id !== r.id));
      if (abiertoId === r.id) esconder();
      toast.success("Cierre borrado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar el cierre");
    } finally {
      setEliminandoId(null);
    }
  }

  async function eliminarArticulos(r: ResumenMensual) {
    if (!puedeBorrar(r) || !r.id) return;
    const ok = await confirm({
      titulo: `¿Borrar los artículos de este cierre de ${r.agencia}?`,
      descripcion:
        "Se borra solo la lista de artículos. El resumen del cierre queda en Estado por planta. Esta acción no se puede deshacer.",
      textoConfirmar: "Borrar artículos",
      variante: "destructive",
    });
    if (!ok) return;
    setEliminandoId(r.id);
    try {
      await resumenService.eliminarDetalle(r.id);
      setResumenes((prev) => prev.map((x) => (x.id === r.id ? { ...x, detalleArticulos: 0 } : x)));
      if (abiertoId === r.id) esconder();
      toast.success("Artículos borrados — el resumen se conserva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron borrar los artículos");
    } finally {
      setEliminandoId(null);
    }
  }

  // Más recientes primero, con los valores de filtro ya calculados.
  const filas = useMemo<Fila[]>(
    () =>
      [...resumenes]
        .sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)))
        .map((r) => {
          const fecha = fechaDe(r);
          return { r, fecha, valores: { dia: fmtDia(fecha), mes: fmtMes(fecha), planta: r.agencia, quien: quienCerro(r) } };
        }),
    [resumenes]
  );

  // Opciones de cada filtro: lo que realmente hay en los cierres. Día y mes
  // salen en orden de fecha (las filas ya vienen de más nuevo a más viejo);
  // planta y quién cierra, alfabético.
  const opciones = useMemo<Filtros>(() => {
    const unicos = (clave: ClaveFiltro) => Array.from(new Set(filas.map((f) => f.valores[clave])));
    return {
      dia: unicos("dia"),
      mes: unicos("mes"),
      planta: unicos("planta").sort((a, b) => a.localeCompare(b, "es")),
      quien: unicos("quien").sort((a, b) => a.localeCompare(b, "es")),
    };
  }, [filas]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      for (const g of GRUPOS) {
        const elegidos = filtros[g.clave];
        if (elegidos.length > 0 && !elegidos.includes(f.valores[g.clave])) return false;
      }
      if (!texto) return true;
      const donde = `${f.valores.planta} ${f.valores.quien} ${f.valores.dia} ${f.valores.mes} ${f.r.archivoGenerado ?? ""}`;
      return donde.toLowerCase().includes(texto);
    });
  }, [filas, filtros, busqueda]);

  const cantidadFiltros = GRUPOS.reduce((n, g) => n + filtros[g.clave].length, 0);
  const hayFiltro = cantidadFiltros > 0 || busqueda.trim() !== "";
  const agenciasConCierre = useMemo(() => new Set(resumenes.map((r) => r.agencia)).size, [resumenes]);

  function alternarOpcion(clave: ClaveFiltro, valor: string) {
    setFiltros((prev) => {
      const actual = prev[clave];
      return { ...prev, [clave]: actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor] };
    });
  }
  function quitarFiltros() {
    setFiltros(FILTROS_VACIOS);
    setBusqueda("");
  }
  function textoElegido(clave: ClaveFiltro, todos: string): string {
    const e = filtros[clave];
    if (e.length === 0) return todos;
    if (e.length === 1) return e[0] ?? todos;
    return `${e.length} elegidos`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin" size={20} />
        <span className="ml-2 text-sm">Cargando estado por planta…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {ConfirmDialogElement}

      {/* Encabezado: título + lupa. El buscador y los cuatro filtros viven
          escondidos dentro de la lupa, en un panel chico alineado a la derecha. */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Estado por planta</h1>
          <p className="text-sm text-muted-foreground">
            Resumen de cada cíclico cerrado. Tocá una tarjeta de estado para ver sus artículos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setLupaAbierta((v) => !v); setGrupoAbierto(null); }}
          aria-expanded={lupaAbierta}
          aria-label={cantidadFiltros > 0 ? `Buscar y filtrar (${cantidadFiltros} filtros puestos)` : "Buscar y filtrar"}
          className={cn(
            "flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 transition-all duration-quick active:scale-95",
            lupaAbierta ? "bg-primary text-primary-foreground" : "bg-secondary text-primary hover:bg-elevated"
          )}
        >
          <Search size={19} />
          {cantidadFiltros > 0 && <span className="text-sm font-bold tabular-nums">{cantidadFiltros}</span>}
        </button>
      </div>

      {lupaAbierta && (
        <div className="w-full animate-slide-up space-y-2 rounded-xl border border-border bg-card p-2.5 sm:ml-auto sm:max-w-sm">
          <label className="flex h-10 items-center gap-2 rounded-lg bg-secondary px-3 text-muted-foreground">
            <Search size={15} className="shrink-0" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar cierres"
              autoFocus
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          {/* Los cuatro filtros. Cada fila se abre en el lugar y deja elegir varias opciones. */}
          <div className="overflow-hidden rounded-lg border border-border">
            {GRUPOS.map((g, i) => {
              const abierto = grupoAbierto === g.clave;
              const elegidos = filtros[g.clave];
              return (
                <div key={g.clave} className={i > 0 ? "border-t border-border" : undefined}>
                  <button
                    type="button"
                    onClick={() => setGrupoAbierto(abierto ? null : g.clave)}
                    aria-expanded={abierto}
                    className="flex h-10 w-full items-center justify-between gap-3 px-3 text-left text-sm transition-colors hover:bg-elevated"
                  >
                    <span>{g.nombre}</span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={elegidos.length > 0 ? "truncate font-semibold text-primary" : "truncate text-muted-foreground"}>
                        {textoElegido(g.clave, g.todos)}
                      </span>
                      <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" />
                    </span>
                  </button>
                  {abierto && (
                    <div className="max-h-52 overflow-y-auto bg-background/60">
                      <button
                        type="button"
                        onClick={() => setFiltros((prev) => ({ ...prev, [g.clave]: [] }))}
                        className="flex h-9 w-full items-center justify-between border-t border-border pl-6 pr-3 text-left text-[13px] hover:bg-elevated"
                      >
                        <span>{g.todos}</span>
                        {elegidos.length === 0 && <Check size={15} className="text-primary" aria-label="Elegido" />}
                      </button>
                      {opciones[g.clave].map((op) => {
                        const marcado = elegidos.includes(op);
                        return (
                          <button
                            key={op}
                            type="button"
                            onClick={() => alternarOpcion(g.clave, op)}
                            aria-pressed={marcado}
                            className="flex h-9 w-full items-center justify-between gap-3 border-t border-border pl-6 pr-3 text-left text-[13px] hover:bg-elevated"
                          >
                            <span className="truncate">{op}</span>
                            {marcado && <Check size={15} className="shrink-0 text-primary" aria-label="Elegido" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2 pt-0.5">
            <Button variant="outline" size="sm" className={BOTON_VIVO} onClick={quitarFiltros} disabled={!hayFiltro}>
              <X size={14} /> Quitar filtros
            </Button>
            <Button size="sm" className={BOTON_VIVO} onClick={() => { setLupaAbierta(false); setGrupoAbierto(null); }}>
              <Check size={14} /> Listo
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle size={28} className="text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground">No se pudo cargar la información. Esto no significa que no haya cierres.</p>
            <Button variant="outline" size="sm" onClick={cargar}>
              <RefreshCw size={15} /> Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && (
        <>
          {/* Métricas rápidas */}
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Archive size={18} /></div>
                <div>
                  <p className="text-2xl font-bold tabular-nums leading-none">{resumenes.length}</p>
                  <p className="text-xs text-muted-foreground">cierres registrados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 size={18} /></div>
                <div>
                  <p className="text-2xl font-bold tabular-nums leading-none">{agenciasConCierre}</p>
                  <p className="text-xs text-muted-foreground">plantas con cierre</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Qué se está viendo. Queda a la vista aunque la lupa esté cerrada. */}
          {hayFiltro && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {filtradas.length} de {filas.length} cierres
              </p>
              <Button variant="outline" size="sm" className={BOTON_VIVO} onClick={quitarFiltros}>
                <X size={14} /> Quitar filtros
              </Button>
            </div>
          )}

          {filas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
                <FileText size={28} className="opacity-60" />
                <p className="text-sm">Todavía no se cerró ningún cíclico.</p>
                <p className="text-xs">Cuando cierres un cíclico desde el Dashboard, el resumen va a aparecer acá.</p>
              </CardContent>
            </Card>
          ) : filtradas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
                <Search size={26} className="opacity-60" />
                <p className="text-sm">Ningún cierre coincide con lo que buscaste.</p>
                <Button variant="outline" size="sm" onClick={quitarFiltros}>Quitar filtros</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filtradas.map(({ r, fecha }, i) => {
                const f = partesFecha(fecha);
                const abierto = abiertoId === r.id;
                const guardados = Number(r.detalleArticulos) || 0;
                const borrable = puedeBorrar(r);
                const ocupado = eliminandoId === r.id;
                // Solo los artículos de la tarjeta de estado que se tocó.
                const lista = abierto && detalle && abiertoCat ? detalle.filter((a) => esDeCategoria(a, abiertoCat)) : [];
                const tituloLista = categorias(r).find((c) => c.clave === abiertoCat) ?? { label: "", color: "inherit" };
                return (
                  <Card key={r.id || i} className="overflow-hidden shadow-sm">
                    <CardContent className="space-y-4 py-4">
                      {/* Encabezado: calendario + planta, con el total como subtítulo */}
                      <div className="flex items-center gap-3 border-b border-border pb-3">
                        <div className="w-[52px] shrink-0 overflow-hidden rounded-lg border border-border text-center">
                          <div className="bg-primary py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">{f.mes}</div>
                          <div className="pt-0.5 text-[22px] font-bold leading-tight tabular-nums">{f.dia}</div>
                          <div className="pb-1 text-[10px] text-muted-foreground tabular-nums">{f.anio}</div>
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-lg font-bold leading-tight">{r.agencia}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            <b className="font-semibold tabular-nums text-foreground">{fmtNum(r.articulos)}</b> artículos ·{" "}
                            <b className="font-semibold tabular-nums text-foreground">{fmtPesos(r.importe)}</b>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Cierre {fmtPeriodo(r.periodo)} · Cerró: {quienCerro(r)}
                          </p>
                        </div>

                        {/* Borrar el cierre completo — Encargado de Almacén (sus plantas) y súper admin. */}
                        {borrable && (
                          <button
                            type="button"
                            onClick={() => eliminarCierre(r)}
                            disabled={ocupado}
                            aria-label="Borrar el cierre completo"
                            title="Borrar el cierre completo"
                            className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          >
                            {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        )}
                      </div>

                      {/* Desglose por estado: fila de mini-stats (artículos + pesos).
                          Cada celda con un tinte y borde de su color -> se lee igual
                          de bien en modo día (claro) que en modo noche (oscuro). */}
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {categorias(r).map((c) => {
                          // "Por contar" no se despliega: solo se guardan los artículos contados.
                          const tocable = guardados > 0 && c.clave !== "pendientes";
                          const activa = abierto && abiertoCat === c.clave;
                          const contenido = (
                            <>
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[11px] font-medium leading-tight" style={{ color: c.color }}>{c.label}</span>
                                <span className="block text-lg font-bold tabular-nums leading-tight">{fmtNum(c.art)}</span>
                                <span className="block text-[11px] tabular-nums text-muted-foreground">{fmtPesos(c.pesos)}</span>
                              </span>
                              {tocable && (
                                <ChevronDown
                                  size={15}
                                  className={cn("shrink-0 text-muted-foreground transition-transform duration-quick", activa && "rotate-180")}
                                />
                              )}
                            </>
                          );
                          const estilo = {
                            borderColor: activa ? c.color : `color-mix(in srgb, ${c.color} 32%, transparent)`,
                            background: `color-mix(in srgb, ${c.color} ${activa ? 16 : 8}%, transparent)`,
                          };
                          return tocable ? (
                            <button
                              key={c.label}
                              type="button"
                              onClick={() => abrir(r, c.clave)}
                              aria-expanded={activa}
                              className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-quick hover:brightness-110 active:scale-[0.97]"
                              style={estilo}
                            >
                              {contenido}
                            </button>
                          ) : (
                            <div key={c.label} className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5" style={estilo}>
                              {contenido}
                            </div>
                          );
                        })}
                      </div>

                      {/* Pie: documento */}
                      {r.archivoGenerado && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <FileSpreadsheet size={13} /> Documento de detalle: <span className="font-medium">{r.archivoGenerado}</span>
                        </div>
                      )}

                      {/* Artículos del cierre: se piden recién al tocar. */}
                      {guardados > 0 ? (
                        !abierto && (
                          <p className="text-xs text-muted-foreground">
                            Tocá Coincidencias, Diferencias + o Diferencias − para ver sus artículos.
                          </p>
                        )
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Este cierre no tiene artículos guardados (es anterior a esta función o ya se borraron).
                        </p>
                      )}
                    </CardContent>

                    {abierto && (
                      <div className="border-t border-border bg-background/60 px-5 pb-4">
                        {!detalle && !errorDetalle && (
                          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                            <Loader2 className="animate-spin" size={17} /> Cargando artículos…
                          </div>
                        )}

                        {errorDetalle && (
                          <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <p className="text-sm text-destructive">{errorDetalle}</p>
                            <Button variant="outline" size="sm" onClick={() => abrir(r, abiertoCat ?? "coincide", true)}>
                              <RefreshCw size={15} /> Reintentar
                            </Button>
                          </div>
                        )}

                        {detalle && (
                          <>
                            <p className="pt-3 text-xs font-semibold" style={{ color: tituloLista.color }}>
                              {tituloLista.label} · {fmtNum(lista.length)} artículos
                            </p>
                            {lista.length === 0 && (
                              <p className="py-6 text-center text-sm text-muted-foreground">No hay artículos guardados en este estado.</p>
                            )}
                            <ul>
                              {lista.slice(0, visibles).map((a, j) => {
                                const e = etiquetaEstado(a);
                                return (
                                  <li key={`${a.codigo}-${a.ubicacion}-${j}`} className="flex items-center justify-between gap-3 border-b border-border py-2.5">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm">{a.descripcion || "Sin descripción"}</p>
                                      <p className="text-xs tabular-nums text-muted-foreground">
                                        {a.codigo}{a.ubicacion ? ` · ${a.ubicacion}` : ""} · SAP {fmtNum(a.stockSap)} · Contado {fmtNum(a.stockContado)}
                                      </p>
                                    </div>
                                    <span className="shrink-0 whitespace-nowrap text-xs font-bold tabular-nums" style={{ color: e.color }}>{e.texto}</span>
                                  </li>
                                );
                              })}
                            </ul>
                            {lista.length > visibles && (
                              <Button variant="outline" className="mt-3 w-full" onClick={() => setVisibles((v) => v + TANDA)}>
                                Mostrar más ({fmtNum(lista.length - visibles)} restantes)
                              </Button>
                            )}
                          </>
                        )}

                        <p className="py-3 text-xs text-muted-foreground">
                          Los artículos de este cierre se borran solos el {fechaDeBorrado(r)}. El resumen queda.
                        </p>
                        <div className="flex gap-2">
                          <Button variant="secondary" className="flex-1" onClick={esconder}>Esconder</Button>
                          {borrable && (
                            <Button variant="destructive" onClick={() => eliminarArticulos(r)} disabled={ocupado}>
                              <Trash2 size={15} /> Borrar artículos
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
