import { NextRequest, NextResponse } from "next/server";
import { actualizarUsuario, eliminarUsuario, registrarHistorial } from "@/lib/sheets";
import { usuarioSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth";
import type { Rol } from "@/types";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";

  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede editar usuarios" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = usuarioSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const cambios: Record<string, unknown> = { ...parsed.data };
    delete cambios.password;

    // Si viene una contraseña nueva, se hashea acá (nunca en el cliente ni en Sheets en texto plano).
    if (parsed.data.password) {
      cambios.passwordHash = await hashPassword(parsed.data.password);
    }

    const usuario = await actualizarUsuario(params.id, cambios as any);

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "editar_usuario",
      entidad: `usuario:${usuario.email}`,
      valorNuevo: JSON.stringify({ ...parsed.data, password: parsed.data.password ? "(cambiada)" : undefined }),
    });

    return NextResponse.json({ ok: true, data: usuario });
  } catch (err) {
    console.error("Error al editar usuario:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo editar" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";

  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede eliminar usuarios" }, { status: 403 });
  }

  if (params.id === userId) {
    return NextResponse.json({ ok: false, error: "No podés eliminar tu propio usuario" }, { status: 400 });
  }

  try {
    const resultado = await eliminarUsuario(params.id);

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "eliminar_usuario",
      entidad: `usuario:${params.id}`,
    });

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al eliminar usuario:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo eliminar" }, { status: 500 });
  }
}
