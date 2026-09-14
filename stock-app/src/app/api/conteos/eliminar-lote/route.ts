import { NextRequest, NextResponse } from "next/server";
import { eliminarConteos, registrarHistorial } from "@/lib/sheets";
import type { Rol } from "@/types";
import { z } from "zod";

const eliminarLoteSchema = z.object({
  ids: z.array(z.string()).min(1, "No se seleccionó ningún conteo"),
});

export async function POST(request: NextRequest) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";

  if (!rol) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  /*
    Este control faltaba.

    El DELETE de a un conteo (conteos/[id]) sí exigía administrador, pero
    esta ruta -- que borra decenas de una -- solo verificaba que hubiera
    sesión. La interfaz esconde el botón de borrado múltiple a los operarios
    (`isAdmin && algunoSeleccionado` en ConteosTable), así que nadie llegaba
    por accidente; pero el endpoint estaba abierto a cualquiera con sesión
    iniciada. Botón escondido, puerta abierta.
  */
  if (rol !== "administrador") {
    return NextResponse.json(
      { ok: false, error: "Solo un administrador puede eliminar conteos" },
      { status: 403 }
    );
  }

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
