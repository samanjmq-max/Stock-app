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

export function normalizarCodigo(codigo: unknown): string {
  return String(codigo ?? "").trim().toLowerCase();
}

export function esContable(producto: Producto): boolean {
  return Number(producto.stockSap) !== 0;
}

export function mapaPrecios(productos: Producto[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  productos.forEach((p) => {
    mapa[normalizarCodigo(p.codigo)] = Number(p.precioUnitario) || 0;
  });
  return mapa;
}

/**
 * Da el importe "relevante" de un conteo según su estado — la misma regla
 * se usa acá y en el monitor de ConteosTable, para que los números del
 * Dashboard y de la tabla siempre coincidan:
 *   - Diferencias (sobra/falta): el valor de la DIFERENCIA (lo de más o
 *     de menos), no de lo contado — es lo que le importa a un gerente
 *     para dimensionar el impacto de un faltante o sobrante.
 *   - Coincide (y no_existe): el valor de lo efectivamente contado.
 */
export function importeRelevante(conteo: Conteo, precio: number): number {
  if (conteo.estado === "sobra" || conteo.estado === "falta") {
    return precio * Math.abs(Number(conteo.diferencia || 0));
  }
  return precio * Number(conteo.stockContado || 0);
}

function calcularStats(productos: Producto[], conteos: Conteo[]): DashboardStats {
  const precios = mapaPrecios(productos);
  const codigosContados = new Set(conteos.map((c) => normalizarCodigo(c.codigo)));

  const ultimoPorCodigoUbicacion = new Map<string, Conteo>();
  for (const c of conteos) {
    const clave = `${normalizarCodigo(c.codigo)}|||${c.ubicacionNueva || c.ubicacion || ""}`;
    const prev = ultimoPorCodigoUbicacion.get(clave);
    if (!prev || new Date(c.creadoEn) > new Date(prev.creadoEn)) {
      ultimoPorCodigoUbicacion.set(clave, c);
    }
  }

  const totalProductos = productos.length;
  const totalContados = codigosContados.size;

  const contables = productos.filter(esContable);
  const contablesContados = contables.filter((p) => codigosContados.has(normalizarCodigo(p.codigo))).length;
  const pendientes = Math.max(contables.length - contablesContados, 0);
  const porcentajeCompletado = contables.length > 0
    ? Math.round((contablesContados / contables.length) * 100)
    : 0;

  let coincidencias = 0, diferenciasPositivas = 0, diferenciasNegativas = 0;
  let importeContados = 0, importeCoincidencias = 0, importeDiferenciasPositivas = 0, importeDiferenciasNegativas = 0;

  ultimoPorCodigoUbicacion.forEach((c) => {
    const precio = precios[normalizarCodigo(c.codigo)] || 0;

    // "Contados": valor total de TODO lo físicamente contado, coincida o
    // no — cuánto stock ya quedó verificado, en pesos.
    importeContados += precio * Number(c.stockContado || 0);

    if (c.estado === "coincide") {
      coincidencias++;
      importeCoincidencias += precio * Number(c.stockContado || 0);
    } else if (c.estado === "sobra") {
      diferenciasPositivas++;
      importeDiferenciasPositivas += precio * Math.abs(Number(c.diferencia || 0));
    } else if (c.estado === "falta") {
      diferenciasNegativas++;
      importeDiferenciasNegativas += precio * Math.abs(Number(c.diferencia || 0));
    }
  });

  const importePendientes = contables
    .filter((p) => !codigosContados.has(normalizarCodigo(p.codigo)))
    .reduce((acc, p) => acc + (precios[normalizarCodigo(p.codigo)] || 0) * Number(p.stockSap || 0), 0);

  const ultimaSincronizacion = conteos.length > 0
    ? conteos.reduce((max, c) => (new Date(c.creadoEn) > new Date(max) ? c.creadoEn : max), conteos[0].creadoEn)
    : null;

  return {
    totalProductos, totalContados, pendientes, porcentajeCompletado,
    conDiferencias: diferenciasPositivas + diferenciasNegativas,
    ultimaSincronizacion, coincidencias, diferenciasPositivas, diferenciasNegativas,
    importePendientes: Math.round(importePendientes),
    importeContados: Math.round(importeContados),
    importeCoincidencias: Math.round(importeCoincidencias),
    importeDiferenciasPositivas: Math.round(importeDiferenciasPositivas),
    importeDiferenciasNegativas: Math.round(importeDiferenciasNegativas),
  };
}
