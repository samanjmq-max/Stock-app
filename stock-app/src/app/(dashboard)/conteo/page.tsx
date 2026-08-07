"use client";

import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { Package, CheckCircle2, Clock, TrendingUp, ArrowUpCircle, ArrowDownCircle, Download } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { exportarExcel, exportarPDF } from "@/lib/exportacion";

const COLORS = { coincide: "#16a34a", falta: "#dc2626", sobra: "#2563eb" };

export default function DashboardPage() {
  const { stats, conteos, loading, error } = useDashboardData();

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px]" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-[280px]" />
          <Skeleton className="h-[280px]" />
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

  // Último conteo por código (para top diferencias y progreso por ubicación)
  const ultimoPorCodigo = new Map<string, (typeof conteos)[number]>();
  for (const c of conteos) {
    const prev = ultimoPorCodigo.get(c.codigo);
    if (!prev || new Date(c.creadoEn) > new Date(prev.creadoEn)) ultimoPorCodigo.set(c.codigo, c);
  }
  const todosLosConteos = Array.from(ultimoPorCodigo.values());

  const topDiferencias = [...todosLosConteos]
    .filter((c) => c.diferencia !== 0)
    .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
    .slice(0, 8)
    .map((c) => ({ codigo: c.codigo, diferencia: c.diferencia }));

  const porUbicacion = new Map<string, { contados: number }>();
  todosLosConteos.forEach((c) => {
    const key = c.ubicacion || "Sin ubicación";
    const actual = porUbicacion.get(key) || { contados: 0 };
    actual.contados += 1;
    porUbicacion.set(key, actual);
  });
  const progresoUbicacion = Array.from(porUbicacion.entries())
    .map(([ubicacion, v]) => ({ ubicacion, contados: v.contados }))
    .sort((a, b) => b.contados - a.contados)
    .slice(0, 8);

  function exportarReporte(formato: "xlsx" | "pdf") {
    const datos = todosLosConteos.map((c) => ({
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
    if (formato === "xlsx") exportarExcel(datos, "Reporte", "reporte-inventario");
    if (formato === "pdf")
      exportarPDF(
        datos,
        [
          { header: "Código", key: "Código" },
          { header: "Descripción", key: "Descripción" },
          { header: "Ubicación", key: "Ubicación" },
          { header: "SAP", key: "Stock SAP" },
          { header: "Contado", key: "Stock Contado" },
          { header: "Dif.", key: "Diferencia" },
          { header: "Estado", key: "Estado" },
          { header: "Ubic. nueva", key: "Ubicación (nueva)" },
        ],
        "Reporte de inventario",
        "reporte-inventario"
      );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="p-4 md:p-6 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Productos totales" value={stats.totalProductos} icon={Package} />
        <StatCard label="Contados" value={stats.totalContados} icon={CheckCircle2} tone="success" />
        <StatCard label="Pendientes" value={stats.pendientes} icon={Clock} tone="warning" />
        <StatCard label="Avance" value={`${stats.porcentajeCompletado}%`} icon={TrendingUp} />
        <StatCard label="Coincidencias" value={stats.coincidencias} icon={CheckCircle2} tone="success" />
        <StatCard label="Diferencias +" value={stats.diferenciasPositivas} icon={ArrowUpCircle} tone="success" />
        <StatCard label="Diferencias −" value={stats.diferenciasNegativas} icon={ArrowDownCircle} tone="destructive" />
        <StatCard
          label="Última sincronización"
          value={
            stats.ultimaSincronizacion
              ? new Date(stats.ultimaSincronizacion).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })
              : "—"
          }
          icon={Clock}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Estado del conteo</CardTitle></CardHeader>
          <CardContent>
            {stats.totalContados === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Todavía no hay conteos registrados. Andá a "Contar stock" para empezar.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top diferencias</CardTitle></CardHeader>
          <CardContent>
            {topDiferencias.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sin diferencias registradas todavía.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topDiferencias}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="codigo" fontSize={10} tickLine={false} />
                  <YAxis fontSize={10} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="diferencia" radius={[6, 6, 0, 0]}>
                    {topDiferencias.map((d, i) => (
                      <Cell key={i} fill={d.diferencia > 0 ? COLORS.sobra : COLORS.falta} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Progreso por ubicación</CardTitle></CardHeader>
          <CardContent>
            {progresoUbicacion.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sin datos todavía.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={progresoUbicacion} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={10} tickLine={false} />
                  <YAxis dataKey="ubicacion" type="category" fontSize={11} width={110} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="contados" radius={[0, 6, 6, 0]} fill="#2f5fed" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Reporte completo</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="secondary" onClick={() => exportarReporte("xlsx")} disabled={todosLosConteos.length === 0}>
            <Download size={15} />
            Exportar Excel
          </Button>
          <Button variant="secondary" onClick={() => exportarReporte("pdf")} disabled={todosLosConteos.length === 0}>
            <Download size={15} />
            Exportar PDF
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
