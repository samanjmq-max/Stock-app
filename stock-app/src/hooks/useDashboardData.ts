"use client";
import { useEffect, useState, useCallback } from "react";
import type { Producto, Conteo, DashboardStats, Agencia } from "@/types";
import { productosService } from "@/services/productos.service";
import { conteosService } from "@/services/conteos.service";
import { useAuth } from "@/contexts/AuthContext";
export function useDashboardData(agenciaFiltro?: Agencia) {
  const { isAdmin, agencia: agenciaUsuario } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [conteos, setConteos] = useState<Conteo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Qué agencia cargar: si es admin y se pasa un filtro, usa ese.
  // Si es operador, siempre su propia agencia.
  const agenciaEfectiva = isAdmin
    ? agenciaFiltro ?? undefined
    : agenciaUsuario ?? undefined;
  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listaProductos, listaConteos] = await Promise.all([
        productosService.listar(agenciaEfectiva),
        conteosService.listar(agenciaEfectiva),
      ]);
      setProductos(listaProductos);
      setConteos(listaConteos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [agenciaEfectiva]);
  useEffect(() => { cargar(); }, [cargar]);
  const stats: DashboardStats = calcularStats(productos, conteos);
  return { productos, conteos, stats, loading, error, recargar: cargar };
}

/** Un artículo "hay que contarlo" solo si su stock en SAP es distinto de cero. */
export function esContable(producto: Producto): boolean {
  return Number(producto.stockSap) !== 0;
}

function calcularStats(productos: Producto[], conteos: Conteo[]): DashboardStats {
  const codigosContados = new Set(conteos.map((c) => c.codigo));
  const ultimoPorCodigoUbicacion = new Map<string, Conteo>();
  for (const c of conteos) {
    const clave = `${c.codigo}|||${c.ubicacionNueva || c.ubicacion || ""}`;
    const prev = ultimoPorCodigoUbicacion.get(clave);
    if (!prev || new Date(c.creadoEn) > new Date(prev.creadoEn)) {
      ultimoPorCodigoUbicacion.set(clave, c);
    }
  }

  const totalProductos = productos.length;
  const totalContados = codigosContados.size;

  // Universo real de trabajo: solo los artículos con stock distinto de cero.
  // Los que están en cero no se cuentan (no debería haber nada físico), así
  // que no ensucian ni el conteo de pendientes ni el porcentaje de avance.
  const contables = productos.filter(esContable);
  const contablesContados = contables.filter((p) => codigosContados.has(p.codigo)).length;
  const pendientes = Math.max(contables.length - contablesContados, 0);
  const porcentajeCompletado = contables.length > 0
    ? Math.round((contablesContados / contables.length) * 100)
    : 0;

  let coincidencias = 0, diferenciasPositivas = 0, diferenciasNegativas = 0;
  ultimoPorCodigoUbicacion.forEach((c) => {
    if (c.estado === "coincide") coincidencias++;
    else if (c.estado === "sobra") diferenciasPositivas++;
    else if (c.estado === "falta") diferenciasNegativas++;
  });
  const ultimaSincronizacion = conteos.length > 0
    ? conteos.reduce((max, c) => (new Date(c.creadoEn) > new Date(max) ? c.creadoEn : max), conteos[0].creadoEn)
    : null;
  return { totalProductos, totalContados, pendientes, porcentajeCompletado, conDiferencias: diferenciasPositivas + diferenciasNegativas, ultimaSincronizacion, coincidencias, diferenciasPositivas, diferenciasNegativas };
}
