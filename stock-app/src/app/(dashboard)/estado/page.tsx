"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Archive, Building2, FileText } from "lucide-react";
import { resumenService } from "@/services/resumen.service";
import type { ResumenMensual } from "@/types";
import { Card, CardContent } from "@/components/ui/card";

function fmt(n: number): string {
  return Number(n || 0).toLocaleString("es-UY");
}

export default function EstadoPage() {
  const [resumenes, setResumenes] = useState<ResumenMensual[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    resumenService
      .listar()
      .then((data) => { if (vivo) setResumenes(data); })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo cargar el estado"))
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, []);

  // Más recientes primero.
  const ordenados = useMemo(
    () => [...resumenes].sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn))),
    [resumenes]
  );

  const agenciasConCierre = useMemo(
    () => new Set(resumenes.map((r) => r.agencia)).size,
    [resumenes]
  );

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
          Resumen de los cíclicos cerrados. El detalle de cada cierre quedó como documento (Excel/PDF) en poder de quien lo cerró; acá vive lo consolidado.
        </p>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Archive size={18} /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums leading-none">{resumenes.length}</p>
              <p className="text-xs text-muted-foreground">cierres registrados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
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
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Planta</th>
                    <th className="px-4 py-3 font-semibold">Período</th>
                    <th className="px-4 py-3 font-semibold">Cierre</th>
                    <th className="px-4 py-3 text-right font-semibold">Artículos</th>
                    <th className="px-4 py-3 text-right font-semibold">Contado</th>
                    <th className="px-4 py-3 text-right font-semibold">Dif. (abs)</th>
                    <th className="px-4 py-3 text-right font-semibold">Importe</th>
                    <th className="px-4 py-3 font-semibold">Cerró</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenados.map((r, i) => (
                    <tr key={r.id || i} className={i % 2 ? "bg-elevated/30" : ""}>
                      <td className="px-4 py-3 font-medium">{r.agencia}</td>
                      <td className="px-4 py-3 tabular-nums">{r.periodo}</td>
                      <td className="px-4 py-3 tabular-nums">{r.fechaCierre}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(r.articulos)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(r.totalContado)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(r.totalDiferenciaAbs)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(r.importe)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.usuarioCierre || r.emailCierre || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
