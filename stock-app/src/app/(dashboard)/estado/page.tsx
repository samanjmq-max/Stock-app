"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Archive, Building2, FileText, AlertTriangle, RefreshCw, FileSpreadsheet, Trash2,
} from "lucide-react";
import { resumenService } from "@/services/resumen.service";
import type { ResumenMensual } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
// Partes de la fecha de cierre para el mini-almanaque (mes / día / año).
function partesFecha(v: string): { mes: string; dia: string; anio: string } {
  const d = new Date(v);
  if (isNaN(d.getTime())) return { mes: "—", dia: "", anio: "" };
  return {
    mes: d.toLocaleDateString("es-UY", { month: "short" }).replace(".", ""),
    dia: String(d.getDate()),
    anio: String(d.getFullYear()),
  };
}

// Las 4 categorías del cierre, en el mismo orden y color que el Dashboard.
function categorias(r: ResumenMensual) {
  return [
    { label: "Coincidencias", art: r.coincidencias, pesos: r.importeCoincidencias, color: "hsl(var(--success))" },
    { label: "Diferencias +", art: r.diferenciasPositivas, pesos: r.importeDiferenciasPositivas, color: "hsl(var(--info))" },
    { label: "Diferencias −", art: r.diferenciasNegativas, pesos: r.importeDiferenciasNegativas, color: "hsl(var(--destructive))" },
    { label: "Por contar", art: r.porContar, pesos: r.importePorContar, color: "hsl(var(--avance))" },
  ];
}

export default function EstadoPage() {
  const { esSuperAdmin } = useAuth();
  const [resumenes, setResumenes] = useState<ResumenMensual[]>([]);
  const [loading, setLoading] = useState(true);
  // Un fallo de carga NO es lo mismo que "no hay cierres".
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

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

  async function eliminar(r: ResumenMensual) {
    if (!esSuperAdmin || !r.id) return;
    const ok = window.confirm(
      `¿Borrar este cierre de ${r.agencia}?\n\nSolo se borra el registro del resumen (Estado por planta). El documento que se descargó al cerrar no se toca. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setEliminandoId(r.id);
    try {
      await resumenService.eliminar(r.id);
      setResumenes((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Cierre borrado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar el cierre");
    } finally {
      setEliminandoId(null);
    }
  }

  // Más recientes primero.
  const ordenados = useMemo(
    () => [...resumenes].sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn))),
    [resumenes]
  );
  const agenciasConCierre = useMemo(() => new Set(resumenes.map((r) => r.agencia)).size, [resumenes]);

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
      <div>
        <h1 className="font-display text-2xl font-bold">Estado por planta</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de cada cíclico cerrado. El detalle fino quedó como documento (Excel/PDF) en poder de quien lo cerró; acá vive el consolidado.
        </p>
      </div>

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

          {ordenados.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
                <FileText size={28} className="opacity-60" />
                <p className="text-sm">Todavía no se cerró ningún cíclico.</p>
                <p className="text-xs">Cuando cierres un cíclico desde el Dashboard, el resumen va a aparecer acá.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {ordenados.map((r, i) => (
                <Card key={r.id || i} className="shadow-sm">
                  <CardContent className="space-y-4 py-4">
                    {/* Encabezado: calendario + planta, con el total como subtítulo (B) */}
                    <div className="flex items-center gap-3 border-b border-border pb-3">
                      {(() => {
                        const f = partesFecha(r.fechaCierre);
                        return (
                          <div className="w-[52px] shrink-0 overflow-hidden rounded-lg border border-border text-center">
                            <div className="bg-primary py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">{f.mes}</div>
                            <div className="pt-0.5 text-[22px] font-bold leading-tight tabular-nums">{f.dia}</div>
                            <div className="pb-1 text-[10px] text-muted-foreground tabular-nums">{f.anio}</div>
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <p className="font-display text-lg font-bold leading-tight">{r.agencia}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          <b className="font-semibold tabular-nums text-foreground">{fmtNum(r.articulos)}</b> artículos ·{" "}
                          <b className="font-semibold tabular-nums text-foreground">{fmtPesos(r.importe)}</b>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Cierre {fmtPeriodo(r.periodo)} · Cerró: {r.usuarioCierre || r.emailCierre || "—"}
                        </p>
                      </div>

                      {/* Borrar cierre — solo súper admin (ej. limpiar pruebas). */}
                      {esSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => eliminar(r)}
                          disabled={eliminandoId === r.id}
                          aria-label="Borrar cierre"
                          title="Borrar este cierre"
                          className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          {eliminandoId === r.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      )}
                    </div>

                    {/* Desglose por estado: fila de mini-stats (artículos + pesos).
                        Cada celda con un tinte y borde de su color -> se lee igual
                        de bien en modo día (claro) que en modo noche (oscuro). */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {categorias(r).map((c) => (
                        <div
                          key={c.label}
                          className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5"
                          style={{
                            borderColor: `color-mix(in srgb, ${c.color} 32%, transparent)`,
                            background: `color-mix(in srgb, ${c.color} 8%, transparent)`,
                          }}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium leading-tight" style={{ color: c.color }}>{c.label}</p>
                            <p className="text-lg font-bold tabular-nums leading-tight">{fmtNum(c.art)}</p>
                            <p className="text-[11px] tabular-nums text-muted-foreground">{fmtPesos(c.pesos)}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pie: documento */}
                    {r.archivoGenerado && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <FileSpreadsheet size={13} /> Documento de detalle: <span className="font-medium">{r.archivoGenerado}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
