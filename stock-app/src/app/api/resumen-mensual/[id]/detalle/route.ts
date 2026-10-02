import { NextRequest, NextResponse } from "next/server";
import { eliminarDetalleCierre, getDetalleCierre, getResumenMensual, registrarHistorial } from "@/lib/sheets";
import { leerSesion } from "@/lib/sesion";

/**
 * Artículos de un cierre (hoja DetalleCierres).
 *
 * GET    -> cualquier usuario autenticado, pero solo de cierres de plantas
 *           dentro de su alcance (igual que el listado de Estado por planta).
 * DELETE -> borra SOLO los artículos; el resumen queda. Mismo permiso que
 *           cerrar el cíclico: Encargado de Almacén (sus plantas) y súper admin.
 */
async function buscarCierre(id: string) {
  return (await getResumenMensual()).find((r) => String(r.id) === id) ?? null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta el id del cierre" }, { status: 400 });
    }

    const cierre = await buscarCierre(id);
    if (!cierre) {
      return NextResponse.json({ ok: false, error: "No se encontró el cierre" }, { status: 404 });
    }
    if (!sesion.capacidades.todasLasPlantas && !sesion.alcance.includes(cierre.agencia)) {
      return NextResponse.json({ ok: false, error: "No podés ver cierres de esa planta" }, { status: 403 });
    }

    const detalle = await getDetalleCierre(id);
    return NextResponse.json({ ok: true, data: detalle });
  } catch (err) {
    console.error("Error al listar el detalle del cierre:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "No se pudieron cargar los artículos del cierre" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (!sesion.esSuperAdmin && !sesion.capacidades.cerrarCiclo) {
    return NextResponse.json({ ok: false, error: "Tu perfil no puede borrar artículos de un cierre" }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta el id del cierre" }, { status: 400 });
    }

    const cierre = await buscarCierre(id);
    if (!cierre) {
      return NextResponse.json({ ok: false, error: "No se encontró el cierre" }, { status: 404 });
    }
    if (!sesion.esSuperAdmin && !sesion.alcance.includes(cierre.agencia)) {
      return NextResponse.json({ ok: false, error: "No podés borrar artículos de esa planta" }, { status: 403 });
    }

    const resultado = await eliminarDetalleCierre(id);

    await registrarHistorial({
      usuarioId: sesion.id,
      usuarioEmail: sesion.email,
      rol: sesion.rol,
      accion: "eliminar_detalle_cierre",
      entidad: `resumen:${id}`,
      valorNuevo: `${resultado.eliminados} artículos borrados (${cierre.agencia})`,
      observacion: "Borrado manual de los artículos de un cierre; el resumen se conserva",
    });

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al borrar el detalle del cierre:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "No se pudieron borrar los artículos del cierre" },
      { status: 500 }
    );
  }
}
