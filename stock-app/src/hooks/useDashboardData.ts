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

/**
 * Normaliza un código a texto comparable. Es imprescindible: Google Sheets
 * convierte los códigos numéricos a número, así que el mismo código puede
 * llegar como 50232 desde una hoja y como "50232" desde otra — sin esto,
 * los cruces entre conteos y catálogo nunca coinciden.
 */
export function normalizarCodigo(codigo: unknown): string {
  return String(codigo ?? "").trim().toLowerCase();
}

/** Un artículo "hay que contarlo" solo si su stock en SAP es distinto de cero. */
export function esContable(producto: Producto): boolean {
  return Number(producto.stockSap) !== 0;
}

/**
 * Arma un mapa código normalizado -> precio unitario, para poder calcular
 * importes en pesos sin tener que buscar en el array de productos cada vez.
 * Productos sin precio cargado (todavía) valen 0 — no rompen la suma, solo
 * no aportan importe hasta que se les cargue un precio real.
 */
export function mapaPrecios(productos: Producto[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  productos.forEach((p) => {
    mapa[normalizarCodigo(p.codigo)] = Number(p.precioUnitario) || 0;
  });
  return mapa;
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

  // Universo real de trabajo: solo los artículos con stock distinto de cero.
  const contables = productos.filter(esContable);
  const contablesContados = contables.filter((p) => codigosContados.has(normalizarCodigo(p.codigo))).length;
  const pendientes = Math.max(contables.length - contablesContados, 0);
  const porcentajeCompletado = contables.length > 0
    ? Math.round((contablesContados / contables.length) * 100)
    : 0;

  let coincidencias = 0, diferenciasPositivas = 0, diferenciasNegativas = 0;
  let importeCoincidencias = 0, importeDiferenciasPositivas = 0, importeDiferenciasNegativas = 0;

  ultimoPorCodigoUbicacion.forEach((c) => {
    const precio = precios[normalizarCodigo(c.codigo)] || 0;
    if (c.estado === "coincide") {
      coincidencias++;
      importeCoincidencias += precio * Number(c.stockContado || 0);
    } else if (c.estado === "sobra") {
      diferenciasPositivas++;
      // La diferencia ya viene en positivo para "sobra" — es el excedente
      // encontrado por encima de lo que decía SAP.
      importeDiferenciasPositivas += precio * Math.abs(Number(c.diferencia || 0));
    } else if (c.estado === "falta") {
      diferenciasNegativas++;
      importeDiferenciasNegativas += precio * Math.abs(Number(c.diferencia || 0));
    }
  });

  // Importe pendiente: el valor en pesos del stock SAP de los artículos
  // contables que todavía no se contaron — cuánto valor hay "sin verificar".
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
    importeCoincidencias: Math.round(importeCoincidencias),
    importeDiferenciasPositivas: Math.round(importeDiferenciasPositivas),
    importeDiferenciasNegativas: Math.round(importeDiferenciasNegativas),
  };
}
