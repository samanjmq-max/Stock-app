"use client";

import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  LabelList,
  ReferenceLine,
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
  topValorStock: { codigo: string; descripcion: string; valor: number }[];
  progresoTiempo: { momento: string; acumulado: number }[];
  totalContable: number;
  saltoTicksTiempo: number;
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
  topValorStock,
  progresoTiempo,
  totalContable,
  saltoTicksTiempo,
}: Props) {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
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
                    {/* Fucsia de avance, el mismo color que el porcentaje
                        grande de arriba y que la tarjeta de "Pendientes":
                        esta curva es exactamente ese número en el tiempo.
                        Antes era verde, que ahora significa "Diferencias +". */}
                    <linearGradient id="gradienteProgreso" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--avance))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--avance))" stopOpacity={0} />
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
                    stroke="hsl(var(--avance))"
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
    </>
  );
}
