import { NextRequest, NextResponse } from "next/server";
import { eliminarResumen, registrarHistorial } from "@/lib/sheets";
import { leerSesion } from "@/lib/sesion";

/**
 * Borra un cierre de ResumenMensual por id. SOLO el súper administrador — es
 * una acción sensible (limpiar el histórico consolidado). Los demás perfiles
 * solo pueden ver el Estado por planta.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (!sesion.esSuperAdmin) {
    return NextResponse.json({ ok: false, error: "Solo el súper administrador puede borrar cierres" }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta el id del cierre" }, { status: 400 });
    }

    const resultado = await eliminarResumen(id);

    await registrarHistorial({
      usuarioId: sesion.id,
      usuarioEmail: sesion.email,
      rol: sesion.rol,
      accion: "eliminar_resumen",
      entidad: `resumen:${id}`,
      observacion: "Eliminación de un cierre en Estado por planta",
    });

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al eliminar el cierre:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "No se pudo borrar el cierre" },
      { status: 500 }
    );
  }
}
