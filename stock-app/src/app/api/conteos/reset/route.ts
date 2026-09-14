import { NextRequest, NextResponse } from "next/server";
import { resetearConteos, registrarHistorial } from "@/lib/sheets";
import type { Rol, Agencia } from "@/types";

export async function POST(request: NextRequest) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";
  const agenciaHeader = request.headers.get("x-user-agencia") as Agencia | null;
  const esSuper = request.headers.get("x-user-es-super-admin") === "1";

  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede reiniciar los conteos" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    // Si viene una agencia en el body, borra solo esa. Si no, usa la del usuario.
    // Para borrar TODAS las agencias, el body debe traer agencia: null explícito.
    const agenciaPedida = "agencia" in body ? body.agencia : agenciaHeader;

    /*
      Vaciar el inventario COMPLETO -- las nueve plantas de una -- es del
      super admin y de nadie más. Antes alcanzaba con ser administrador:
      un jefe de planta que mandara { agencia: null } borraba todo.

      Y un administrador común solo puede vaciar SU planta, no elegir otra:
      mismo criterio que el GET de conteos.
    */
    if (!esSuper && agenciaPedida == null) {
      return NextResponse.json(
        { ok: false, error: "Solo el super administrador puede vaciar el inventario de todas las plantas" },
        { status: 403 }
      );
    }
    if (!esSuper && agenciaPedida !== agenciaHeader) {
      return NextResponse.json(
        { ok: false, error: "Solo podés vaciar el inventario de tu propia planta" },
        { status: 403 }
      );
    }

    const agencia = agenciaPedida;
    const resultado = await resetearConteos(agencia ?? undefined);

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "resetear_conteos",
      valorNuevo: `${resultado.eliminados} conteos eliminados${agencia ? ` (${agencia})` : " (todas las agencias)"}`,
    });

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al resetear conteos:", err);
    return NextResponse.json({ ok: false, error: "No se pudo reiniciar el inventario" }, { status: 500 });
  }
}
