import { NextRequest, NextResponse } from "next/server";
import { resetearConteos, registrarHistorial } from "@/lib/sheets";
import { leerSesion } from "@/lib/sesion";
import { puedeVaciarInventario } from "@/lib/permisos";
import type { Agencia } from "@/types";

export async function POST(request: NextRequest) {
  /*
    Igual que sync-batch: se lee la sesión con `leerSesion`, no headers
    sueltos. La lógica de permiso es la misma de antes, solo que la identidad
    y el "es super admin" salen de la sesión ya resuelta.
  */
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  const { id: userId, email, rol, agencia: agenciaPropia } = sesion;

  /*
    Vaciar el inventario -- de una planta o de todas -- es exclusivo del súper
    administrador. Antes alcanzaba con ser "administrador" (jefe/gerente), que
    podía reiniciar su propia planta; por decisión del dueño, reiniciar conteos
    ahora es solo del súper admin, incluso por planta.
  */
  if (!puedeVaciarInventario(email)) {
    return NextResponse.json(
      { ok: false, error: "Solo el súper administrador puede reiniciar los conteos" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    // Si viene una agencia en el body, borra solo esa. Si no, usa la del usuario.
    // Para borrar TODAS las agencias, el body debe traer agencia: null explícito.
    const agenciaPedida = "agencia" in body ? (body.agencia as Agencia | null) : agenciaPropia;

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
