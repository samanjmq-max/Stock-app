import { NextRequest, NextResponse } from "next/server";
import { getResumenMensual } from "@/lib/sheets";
import { leerSesion } from "@/lib/sesion";

/**
 * Devuelve el histórico consolidado de cierres (1 fila por agencia por
 * cierre). Cualquier usuario autenticado lo puede ver, pero solo de las
 * plantas dentro de su alcance (el gerente y el súper admin ven las nueve).
 * Alimenta el Estado por planta y el mini-dashboard mensual.
 */
export async function GET(request: NextRequest) {
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  try {
    const todos = await getResumenMensual();
    const visibles = sesion.capacidades.todasLasPlantas
      ? todos
      : todos.filter((r) => sesion.alcance.includes(r.agencia));

    return NextResponse.json({ ok: true, data: visibles });
  } catch (err) {
    console.error("Error al listar el resumen mensual:", err);
    return NextResponse.json({ ok: false, error: "No se pudo obtener el resumen mensual" }, { status: 500 });
  }
}
