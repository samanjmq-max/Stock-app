"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { Package, CheckCircle2, Clock, TrendingUp, ArrowUpCircle, ArrowDownCircle, Download, Loader2, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { StatCard } from "@/components/dashboard/StatCard";
import { ConteosTable } from "@/components/dashboard/ConteosTable";
import { PendientesTable } from "@/components/dashboard/PendientesTable";
import { EditarConteoDialog } from "@/components/dashboard/EditarConteoDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { exportarExcel, exportarPDF } from "@/lib/exportacion";
import { conteosService } from "@/services/conteos.service";
import type { Conteo, EstadoConteo } from "@/types";

const COLORS = { coincide: "#16a34a", falta: "#dc2626", sobra: "#2563eb" };

type Vista = EstadoConteo | "pendientes" | null;

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const { stats, conteos, productos, loading, error, recargar } = useDashboardData();
  const [vista, setVista] = useState<Vista>(null);
  const [conteoAEditar, setConteoAEditar] = useState<Conteo | null>(null);
  const [vaciando, setVaciando] = useState(false);

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
    { name:
