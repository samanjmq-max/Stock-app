"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

/**
 * Curva grande del "Avance del conteo": códigos contados, acumulados en el
 * tiempo. Va en la tarjeta principal del Dashboard, al lado de las cuatro
 * tarjetas de estado.
 *
 * Color: el del texto (--foreground), o sea blanca en modo oscuro y oscura en
 * modo claro. El amarillo de avance queda solo para la tarjeta "Por contar".
 *
 * Estilo: línea con resplandor y, debajo, un relleno
 * degradado cortado en barras verticales finas. Las barras se logran pintando
 * encima del relleno una trama de rayas del color de la tarjeta, así no hace
 * falta una serie de barras aparte.
 *
 * Se carga con `next/dynamic({ ssr: false })`, igual que DashboardCharts:
 * recharts es lo más pesado del Dashboard y no viaja en el chunk inicial.
 */
interface Props {
  progresoTiempo: { momento: string; acumulado: number }[];
  totalContable: number;
  saltoTicksTiempo: number;
}

export default function AvanceChart({ progresoTiempo, totalContable, saltoTicksTiempo }: Props) {
  if (progresoTiempo.length === 0) {
    return (
      <p className="flex h-[190px] items-center justify-center text-center text-sm text-muted-foreground">
        Todavía no hay conteos registrados.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={progresoTiempo} margin={{ top: 14, right: 12, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="avanceRelleno" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.5} />
            <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0.04} />
          </linearGradient>
          {/* Rayas del color de la tarjeta: cortan el relleno en barras finas. */}
          <pattern id="avanceRayas" width="7" height="7" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="3" height="7" fill="hsl(var(--card))" />
          </pattern>
          {/* Resplandor de la línea. */}
          <filter id="avanceBrillo" x="-10%" y="-40%" width="120%" height="180%">
            <feGaussianBlur stdDeviation="4" result="difuso" />
            <feMerge>
              <feMergeNode in="difuso" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="momento"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          interval={saltoTicksTiempo}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          fontSize={10}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            color: "hsl(var(--popover-foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
            fontSize: "12px",
          }}
          labelStyle={{ color: "hsl(var(--popover-foreground))" }}
          cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }}
          formatter={(v: number, nombre: string) =>
            nombre === "acumulado" ? [v.toLocaleString("es-UY"), "Códigos contados (acumulado)"] : [null, null]
          }
        />
        {totalContable > 0 && (
          <ReferenceLine
            y={totalContable}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            label={{
              value: `Total a contar (${totalContable.toLocaleString("es-UY")})`,
              position: "insideTopRight",
              fontSize: 10,
              fill: "hsl(var(--muted-foreground))",
            }}
          />
        )}

        {/* 1) Relleno degradado. */}
        <Area type="monotone" dataKey="acumulado" stroke="none" fill="url(#avanceRelleno)" isAnimationActive={false} activeDot={false} />
        {/* 2) Rayas encima: lo convierten en barras. No aporta dato, por eso no entra al tooltip. */}
        <Area
          type="monotone"
          dataKey="acumulado"
          name="rayas"
          stroke="none"
          fill="url(#avanceRayas)"
          fillOpacity={1}
          isAnimationActive={false}
          activeDot={false}
          tooltipType="none"
        />
        {/* 3) La línea, con resplandor. */}
        <Area
          type="monotone"
          dataKey="acumulado"
          name="linea"
          stroke="hsl(var(--foreground))"
          strokeWidth={2.5}
          fill="none"
          filter="url(#avanceBrillo)"
          dot={false}
          activeDot={{ r: 5, fill: "hsl(var(--foreground))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
          tooltipType="none"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
