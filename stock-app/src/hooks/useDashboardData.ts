"use client";

import { useEffect, useState, useCallback } from "react";
import type { Producto, Conteo, DashboardStats } from "@/types";
import { productosService } from "@/services/productos.service";
import { conteosService } from "@/services/conteos.service";

export function useDashboardData() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [conteos, setConteos] = useState<Conteo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listaProductos, listaConteos] = await Promise.all([
        productosService.listar(),
        conteosService.listar(),
      ]);
      setProductos(listaProductos);
      setConteos(listaConteos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const stats: DashboardStats = calcularStats(productos, conteos);

  return { productos, conteos, stats, loading, error, recargar: cargar };
}

function calcularStats(productos: Producto[], conteos: Conteo[]): DashboardStats {
  const ultimoPorCodigo = new Map<string, Conteo>();
  for (const c of conteos) {
    const prev = ultimoPorCodigo.get(c.codigo);
    if (!prev || new Date(c.creadoEn) > new Date(prev.creadoEn)) {
      ultimoPorCodigo.set(c.codigo, c);
    }
  }

  const totalProductos = productos.length;
  const totalContados = ultimoPorCodigo.size;
  const pendientes = Math.max(totalProductos - totalContados, 0);
  const porcentajeCompletado = totalProductos > 0 ? Math.round((totalContados / totalProductos) * 100) : 0;

  let coincidencias = 0;
  let diferenciasPositivas = 0;
  let diferenciasNegativas = 0;
  ultimoPorCodigo.forEach((c) => {
    if (c.estado === "coincide") coincidencias++;
    else if (c.estado === "sobra") diferenciasPositivas++;
    else if (c.estado === "falta") diferenciasNegativas++;
  });

  const ultimaSincronizacion =
    conteos.length > 0
      ? conteos.reduce((max, c) => (new Date(c.creadoEn) > new Date(max) ? c.creadoEn : max), conteos[0].creadoEn)
      : null;

  return {
    totalProductos,
    totalContados,
    pendientes,
    porcentajeCompletado,
    conDiferencias: diferenciasPositivas + diferenciasNegativas,
    ultimaSincronizacion,
    coincidencias,
    diferenciasPositivas,
    diferenciasNegativas,
  };
}
