"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Producto } from "@/types";

/*
  Panel de códigos GENÉRICOS.

  Son códigos que deben quedar en CERO: se listan con la cantidad que hay en el
  catálogo (stock SAP de la planta), para verlos de un vistazo y bajarlos. Los
  que tienen stock resaltan en rojo; los que están en cero, en verde.

  La lista de códigos es fija (la definió Maximiliano). El panel la cruza con
  el catálogo ya cargado y filtrado por la agencia/filtros activos del
  Dashboard, así que respeta la planta que se está viendo.
*/

const GENERICOS: { codigo: string; descripcion: string }[] = [
  { codigo: "20011593", descripcion: "GENERICO JARDINERIA" },
  { codigo: "20011594", descripcion: "GENERICO COMBUSTIBLES" },
  { codigo: "20011595", descripcion: "GENERICO SOFTWARE" },
  { codigo: "20011596", descripcion: "GENERICO ART.PROPAGANDA" },
  { codigo: "20011597", descripcion: "GENERICO HERRAMIENTAS" },
  { codigo: "20011598", descripcion: "GENERICO MAT.TALLER" },
  { codigo: "20011599", descripcion: "GENERICO PAPELERIA" },
  { codigo: "20011600", descripcion: "GENERICO ART. OFICINA" },
  { codigo: "20011601", descripcion: "GENERICO COMPUTACION" },
  { codigo: "20011602", descripcion: "GENERICO UNIFORMES" },
  { codigo: "20011603", descripcion: "GENERICO ART. USO DOMESTICO" },
  { codigo: "20011604", descripcion: "GENERICO BOTIQUIN MEDICO" },
  { codigo: "20011605", descripcion: "GENERICO ELEMENTOS DE SEGURIDAD" },
  { codigo: "20011606", descripcion: "GENERICO CONTROL PLAGAS" },
  { codigo: "20011607", descripcion: "GENERICO INS. LABORATORIO" },
  { codigo: "20011608", descripcion: "GENERICO INS. FUMIGACION" },
  { codigo: "20011609", descripcion: "GENERICO OTROS INS.PRODUCCIÓN" },
  { codigo: "40000011", descripcion: "GENERICO - REPUESTOS" },
  { codigo: "40000012", descripcion: "GENERICO - MAT ELECTRICOS" },
  { codigo: "40000013", descripcion: "GENERICO - OBRA CIVIL" },
  { codigo: "40000014", descripcion: "GENERICO - EQ. OFICINA" },
  { codigo: "40000015", descripcion: "GENERICO - COMUNICACIONES" },
  { codigo: "40000016", descripcion: "GENERICO - JARDINERIA" },
  { codigo: "40000017", descripcion: "GENERICO - COMBUSTIBLES" },
  { codigo: "40000018", descripcion: "GENERICO - SOFTWARE" },
  { codigo: "40000019", descripcion: "GENERICO - ART. PROPAGANDA" },
  { codigo: "40000020", descripcion: "GENERICO - HERRAMIENTAS" },
  { codigo: "40000021", descripcion: "GENERICO - MAT TALLER" },
  { codigo: "40000022", descripcion: "GENERICO - PAPELERIA" },
  { codigo: "40000023", descripcion: "GENERICO - ART OFICINA" },
  { codigo: "40000024", descripcion: "GENERICO - COMPUTACION" },
  { codigo: "40000025", descripcion: "GENERICO - UNIFORMES" },
  { codigo: "40000026", descripcion: "GENERICO - ART. LIMPIEZA" },
  { codigo: "40000027", descripcion: "GENERICO - ART. USO DOMESTICO" },
  { codigo: "40000028", descripcion: "GENERICO - BOTIQUIN MEDICO" },
  { codigo: "40000029", descripcion: "GENERICO - ELEMENTOS DE SEGURIDAD" },
  { codigo: "40000030", descripcion: "GENERICO - CONTROL PLAGAS" },
  { codigo: "40000031", descripcion: "GENERICO - INS. LABORATORIO" },
  { codigo: "40000032", descripcion: "GENERICO - HILOS" },
  { codigo: "40000033", descripcion: "GENERICO - INS. FUMIGACION" },
  { codigo: "40000034", descripcion: "GENERICO - OTROS INS. PRODUCCION" },
  { codigo: "40000035", descripcion: "GENERICO - ART. P/PERSONAL" },
];

const norm = (c: unknown) => String(c ?? "").trim().toLowerCase();

interface Fila {
  codigo: string;
  descripcion: string;
  cantidad: number | null; // null = no está en el catálogo de esta planta
}

export function GenericosPanel({ productos }: { productos: Producto[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filas: Fila[] = useMemo(() => {
    const porCodigo = new Map<string, Producto>();
    for (const p of productos) porCodigo.set(norm(p.codigo), p);
    return GENERICOS.map((g) => {
      const p = porCodigo.get(norm(g.codigo));
      return {
        codigo: g.codigo,
        descripcion: p?.descripcion || g.descripcion,
        cantidad: p ? Number(p.stockSap) || 0 : null,
      };
    });
  }, [productos]);

  const presentes = filas.filter((f) => f.cantidad !== null);
  const conStock = presentes.filter((f) => (f.cantidad ?? 0) > 0).length;
  const enCero = presentes.filter((f) => (f.cantidad ?? 0) === 0).length;
  const totalPresentes = presentes.length || 1;
  const pctEnCero = Math.round((enCero / totalPresentes) * 100);

  const filasVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => f.codigo.toLowerCase().includes(q) || f.descripcion.toLowerCase().includes(q));
  }, [filas, busqueda]);

  // Dona: verde = en cero, rojo = a bajar. dasharray sobre circunferencia ~100.
  const dashEnCero = (enCero / totalPresentes) * 100;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {/* Lista */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 className="font-display text-base font-bold">Genéricos ({GENERICOS.length})</h3>
            <span className="text-xs text-muted-foreground">deben quedar en cero</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Los que tienen stock resaltan en rojo — hay que bajarlos.
          </p>

          <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <Search size={15} className="shrink-0 text-muted-foreground" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar código o descripción…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="max-h-[340px] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 bg-muted/80 backdrop-blur">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Código</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Descripción</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cant.</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filasVisibles.map((f) => {
                  const stock = f.cantidad;
                  const aBajar = (stock ?? 0) > 0;
                  return (
                    <tr key={f.codigo} className="border-t border-border/70">
                      <td className="px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">{f.codigo}</td>
                      <td className="px-3 py-2 text-[13px]">{f.descripcion}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${aBajar ? "font-bold text-destructive" : ""}`}>
                        {stock === null ? "—" : stock.toLocaleString("es-UY")}
                      </td>
                      <td className="px-3 py-2">
                        {stock === null ? (
                          <span className="text-xs text-muted-foreground">sin catálogo</span>
                        ) : aBajar ? (
                          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">a bajar</span>
                        ) : (
                          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">0 ✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filasVisibles.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">Nada coincide con la búsqueda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Resumen + gráfico */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-display text-base font-bold">Resumen</h3>

          <p className="font-display text-[40px] font-bold leading-none text-destructive tabular-nums">{conStock}</p>
          <p className="text-xs text-muted-foreground">genéricos con stock (a bajar)</p>

          <hr className="my-3 border-border" />

          <p className="font-display text-[30px] font-bold leading-none text-success tabular-nums">{enCero}</p>
          <p className="text-xs text-muted-foreground">ya en cero ✓</p>

          {/* Gráfico: aprovecha el espacio de abajo */}
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">En cero vs. a bajar</p>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <svg width="96" height="96" viewBox="0 0 42 42" aria-hidden="true">
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                  <circle
                    cx="21" cy="21" r="15.9" fill="none"
                    stroke="hsl(var(--success))" strokeWidth="6"
                    strokeDasharray={`${dashEnCero.toFixed(1)} ${(100 - dashEnCero).toFixed(1)}`}
                    strokeDashoffset={25}
                  />
                  <circle
                    cx="21" cy="21" r="15.9" fill="none"
                    stroke="hsl(var(--destructive))" strokeWidth="6"
                    strokeDasharray={`${(100 - dashEnCero).toFixed(1)} ${dashEnCero.toFixed(1)}`}
                    strokeDashoffset={(25 - dashEnCero).toFixed(1)}
                  />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-lg font-bold leading-none tabular-nums">{pctEnCero}%</span>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">en cero</span>
                </div>
              </div>
              <div className="text-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-success" /> <b className="tabular-nums">{enCero}</b>
                  <span className="text-muted-foreground">en cero</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-destructive" /> <b className="tabular-nums">{conStock}</b>
                  <span className="text-muted-foreground">a bajar</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
