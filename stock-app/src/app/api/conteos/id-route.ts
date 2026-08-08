import { NextRequest, NextResponse } from "next/server";
import { editarConteo, registrarHistorial } from "@/lib/sheets";
import type { Rol } from "@/types";
import { z } from "zod";

const editarConteoSchema = z.object({
  stockContado: z.coerce.number().min(0),
  diferencia: z.coerce.number(),
  estado: z.string(),
  observaciones: z.string().optional().default(""),
  ubicacionNueva: z.string().optional().default(""),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";

  if (!rol) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = editarConteoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const conteo = await editarConteo(params.id, parsed.data);

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "guardar_conteo",
      entidad: `conteo:${params.id}`,
      valorNuevo: JSON.stringify(parsed.data),
      observacion: "Corrección de un conteo existente",
    });

    return NextResponse.json({ ok: true, data: conteo });
  } catch (err) {
    console.error("Error al editar conteo:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "No se pudo editar el conteo" },
      { status: 500 }
    );
  }
}
