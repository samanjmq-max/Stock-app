"use client";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@/types";

/**
 * Todos los gráficos de recharts del Dashboard, en un componente aparte
 * cargado con `next/dynamic({ ssr: false })` desde la página -- mismo
 * criterio que ya usa Conteo para BarcodeScanner/OcrScanner. `recharts` es
 * la librería más pesada del bundle de Dashboard (era la ruta más pesada
 * de toda la app, 460kB de First Load JS); separarla evita que viaje en el
 * chunk inicial cuando la página todavía no la necesita.
 */

interface DatoColor {
  name: string;
  value: number;
  color: string;
}

interface Props {
  stats: DashboardStats;
  tituloAgencia: string;
  pieData: DatoColor[];
  importeData: DatoColor[];
  /**
   * Dibuja UNA sola de las dos tarjetas, para poder ubicarlas en lugares
   * distintos del Dashboard (la dona al lado del avance; el importe al lado
   * de Genéricos). Sin esta prop se dibujan las dos, lado a lado.
   */
  solo?: "estado" | "importe";
}

function formatearImporte(valor: number): string {
  return `$ ${valor.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}

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

export default function DashboardCharts({
  stats,
  tituloAgencia,
  pieData,
  importeData,
  solo,
}: Props) {
  return (
    <>
      {/* Dos gráficos en una fila (Estado · Importe). El progreso en el tiempo
          pasó a la tarjeta principal del Dashboard (AvanceChart). */}
      <div className={solo ? "h-full" : "grid gap-4 md:grid-cols-2"}>
        {solo !== "importe" && (
        <Card className="h-full">
          <CardHeader><CardTitle>Estado del conteo — {tituloAgencia}</CardTitle></CardHeader>
          <CardContent>
            {stats.totalContados === 0
              ? <p className="text-sm text-muted-foreground py-8 text-center">Todavía no hay conteos. Andá a "Contar stock" para empezar.</p>
              : (
                <>
                  {/*
                    Las etiquetas ya NO se dibujan alrededor de la torta.
                    Recharts las coloca por fuera del radio y, en el ancho de
                    un celular, se salen del área del gráfico y se cortan: se
                    leía "oinciden: 882" en vez de "Coinciden: 882".

                    En su lugar, el agujero de la dona muestra el total (que
                    antes estaba vacío) y la identidad de cada porción va en
                    una leyenda debajo, que se acomoda sola y nunca se recorta.
                    El nombre y la cifra van en color de texto, no en el color
                    de la serie: el cuadradito de color al lado es el que
                    carga la identidad.
                  */}
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={85}
                          paddingAngle={2}
                          stroke="hsl(var(--card))"
                          strokeWidth={2}
                        >
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip {...tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-[26px] font-bold leading-none tabular-nums">
                        {stats.totalContados.toLocaleString("es-UY")}
                      </span>
                      <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Contados
                      </span>
                    </div>
                  </div>

                  <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                    {pieData.filter((d) => d.value > 0).map((d) => (
                      <li key={d.name} className="flex items-center gap-1.5 text-xs">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-mono font-medium tabular-nums">
                          {d.value.toLocaleString("es-UY")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
          </CardContent>
        </Card>
        )}

        {solo !== "estado" && (
        <Card className="flex h-full flex-col">
          <CardHeader><CardTitle>Importe contado (en pesos)</CardTitle></CardHeader>
          {/* Sola (al lado de Genéricos) la tarjeta se estira al alto de su
              vecina: el gráfico ocupa todo ese alto en vez de quedar arriba
              con un hueco debajo. */}
          <CardContent className={solo ? "min-h-[260px] flex-1" : undefined}>
            {stats.importeCoincidencias === 0 && stats.importeDiferenciasPositivas === 0 && stats.importeDiferenciasNegativas === 0 && stats.importePendientes === 0
              ? <p className="text-sm text-muted-foreground py-8 text-center">Sin importes para mostrar — cargá precios unitarios en el catálogo.</p>
              : <ResponsiveContainer width="100%" height={solo ? "100%" : 230}>
                  {/* Margen arriba: sin él, el importe escrito sobre la barra
                      más alta se cortaba contra el borde del gráfico. */}
                  <BarChart data={importeData} margin={{ top: 26, right: 8, left: 0, bottom: 0 }}>
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
        )}
      </div>
    </>
  );
}
