import { NextRequest, NextResponse } from "next/server";
import { eliminarResumen, getResumenMensual, registrarHistorial } from "@/lib/sheets";
import { leerSesion } from "@/lib/sesion";

/**
 * Borra un cierre COMPLETO de ResumenMensual por id (el resumen y, si los
 * tiene, sus artículos guardados).
 *
 * Permiso: el mismo que cerrar el cíclico — el Encargado de Almacén (solo
 * cierres de sus plantas) y el súper administrador. Los demás perfiles solo
 * pueden ver el Estado por planta.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (!sesion.esSuperAdmin && !sesion.capacidades.cerrarCiclo) {
    return NextResponse.json({ ok: false, error: "Tu perfil no puede borrar cierres" }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta el id del cierre" }, { status: 400 });
    }

    // El cierre tiene que existir y ser de una planta dentro del alcance propio.
    const cierre = (await getResumenMensual()).find((r) => String(r.id) === id);
    if (!cierre) {
      return NextResponse.json({ ok: false, error: "No se encontró el cierre" }, { status: 404 });
    }
    if (!sesion.esSuperAdmin && !sesion.alcance.includes(cierre.agencia)) {
      return NextResponse.json({ ok: false, error: "No podés borrar cierres de esa planta" }, { status: 403 });
    }

    const resultado = await eliminarResumen(id);

    await registrarHistorial({
      usuarioId: sesion.id,
      usuarioEmail: sesion.email,
      rol: sesion.rol,
      accion: "eliminar_resumen",
      entidad: `resumen:${id}`,
      observacion: `Eliminación del cierre completo de ${cierre.agencia} en Estado por planta`,
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
