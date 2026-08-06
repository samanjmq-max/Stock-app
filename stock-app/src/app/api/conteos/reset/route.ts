import { NextRequest, NextResponse } from "next/server";
import { resetearConteos, registrarHistorial } from "@/lib/sheets";
import type { Rol } from "@/types";

export async function POST(request: NextRequest) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";

  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede reiniciar los conteos" }, { status: 403 });
  }

  try {
    const resultado = await resetearConteos();

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "resetear_conteos",
      valorNuevo: `${resultado.eliminados} conteos eliminados`,
    });

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al resetear conteos:", err);
    return NextResponse.json({ ok: false, error: "No se pudo reiniciar el inventario" }, { status: 500 });
  }
}
