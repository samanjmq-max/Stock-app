import { NextRequest, NextResponse } from "next/server";
import { eliminarConteos, registrarHistorial } from "@/lib/sheets";
import { leerSesion } from "@/lib/sesion";
import { z } from "zod";

const eliminarLoteSchema = z.object({
  ids: z.array(z.string()).min(1, "No se seleccionó ningún conteo"),
});

export async function POST(request: NextRequest) {
  /*
    Este control faltaba por completo.

    El DELETE de a un conteo (conteos/[id]) sí verificaba permisos, pero
    esta ruta -- que borra decenas de una -- solo miraba que hubiera sesión.
    La interfaz esconde el botón de borrado múltiple a los operarios, así
    que nadie llegaba por accidente; pero el endpoint estaba abierto a
    cualquiera con sesión iniciada. Botón escondido, puerta abierta.

    Pide la misma capacidad que el borrado de a uno: no tendría sentido que
    borrar cincuenta fuera más fácil que borrar uno.
  */
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (!sesion.capacidades.borrarLineas) {
    return NextResponse.json(
      { ok: false, error: "Tu perfil no puede eliminar conteos" },
      { status: 403 }
    );
  }
  const { rol, id: userId, email } = sesion;

  try {
    const body = await request.json();
    const parsed = eliminarLoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const resultado = await eliminarConteos(parsed.data.ids);

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "eliminar_conteo",
      entidad: `conteos: ${parsed.data.ids.length} seleccionados`,
      observacion: "Eliminación múltiple de conteos",
    });

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al eliminar conteos en lote:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "No se pudieron eliminar los conteos" },
      { status: 500 }
    );
  }
}
