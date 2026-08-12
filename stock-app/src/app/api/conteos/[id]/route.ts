import { NextRequest, NextResponse } from "next/server";
import { editarConteo, eliminarConteo, registrarHistorial } from "@/lib/sheets";
import type { Rol } from "@/types";
import { z } from "zod";

const editarConteoSchema = z.object({
  stockContado: z.coerce.number().min(0),
  diferencia: z.coerce.number(),
  estado: z.string(),
  observaciones: z.string().optional().default(""),
  ubicacionNueva: z.string().optional().default(""),
});

// Editar un conteo queda abierto a cualquier usuario autenticado
// (administrador u operador) — cualquiera puede corregir un dato mal
// cargado, como el caso del operador que encontró una diferencia al
// final del turno.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";

  if (!rol) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = editarConteoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }
    const conteo = await editarConteo(id, parsed.data);
    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "editar_conteo",
      entidad: `conteo:${id}`,
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

// Eliminar un conteo SOLO puede hacerlo un administrador (super
// administrador o jefe de planta) — un operador puede corregir un
// conteo propio, pero no borrarlo.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";

  if (!rol) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (rol !== "administrador") {
    return NextResponse.json(
      { ok: false, error: "Solo un administrador puede eliminar un conteo" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const resultado = await eliminarConteo(id);
    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "eliminar_conteo",
      entidad: `conteo:${id}`,
      observacion: "Eliminación de un conteo",
    });
    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al eliminar conteo:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "No se pudo eliminar el conteo" },
      { status: 500 }
    );
  }
}
