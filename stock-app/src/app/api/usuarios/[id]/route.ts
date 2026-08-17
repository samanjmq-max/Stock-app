import { NextRequest, NextResponse } from "next/server";
import { actualizarUsuario, eliminarUsuario, getUsuarios, registrarHistorial } from "@/lib/sheets";
import { usuarioSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";
import { esSuperAdmin } from "@/lib/permisos";
import type { Rol, Agencia } from "@/types";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";
  const agenciaPropia = request.headers.get("x-user-agencia") as Agencia | null;

  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede editar usuarios" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const esSuper = esSuperAdmin(email);

    const usuarios = await getUsuarios();
    const objetivo = usuarios.find((u) => u.id === id);
    if (!objetivo) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    // Un administrador que no es el super administrador solo puede editar
    // usuarios que pertenezcan a su propia agencia.
    if (!esSuper && objetivo.agencia !== agenciaPropia) {
      return NextResponse.json(
        { ok: false, error: "Solo podés editar usuarios de tu propia agencia" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = usuarioSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    // La agencia es obligatoria para cualquier usuario, EXCEPTO si la
    // cuenta que se está editando es la del propio super administrador
    // (identificado por su email, no por lo que mande el formulario) —
    // esa cuenta no pertenece a una sola agencia.
    const objetivoEsSuperAdmin = esSuperAdmin(objetivo.email);
    if (!objetivoEsSuperAdmin && parsed.data.agencia !== undefined && !parsed.data.agencia) {
      return NextResponse.json({ ok: false, error: "La agencia es obligatoria" }, { status: 400 });
    }

    // Tampoco puede "mover" un usuario a otra agencia (salvo el propio super admin editándose).
    if (!esSuper && parsed.data.agencia && parsed.data.agencia !== agenciaPropia) {
      return NextResponse.json(
        { ok: false, error: "No podés asignar usuarios a otra agencia" },
        { status: 403 }
      );
    }

    const cambios: Record<string, unknown> = { ...parsed.data };
    delete cambios.password;
    if (parsed.data.password) {
      cambios.passwordHash = await hashPassword(parsed.data.password);
    }
    const usuario = await actualizarUsuario(id, cambios as any);
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";
  const agenciaPropia = request.headers.get("x-user-agencia") as Agencia | null;

  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede eliminar usuarios" }, { status: 403 });
  }

  try {
    const { id } = await params;

    if (id === userId) {
      return NextResponse.json({ ok: false, error: "No podés eliminar tu propio usuario" }, { status: 400 });
    }

    const esSuper = esSuperAdmin(email);
    if (!esSuper) {
      const usuarios = await getUsuarios();
      const objetivo = usuarios.find((u) => u.id === id);
      if (!objetivo || objetivo.agencia !== agenciaPropia) {
        return NextResponse.json(
          { ok: false, error: "Solo podés eliminar usuarios de tu propia agencia" },
          { status: 403 }
        );
      }
    }

    const resultado = await eliminarUsuario(id);
    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "eliminar_usuario",
      entidad: `usuario:${id}`,
    });
    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al eliminar usuario:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo eliminar" }, { status: 500 });
  }
}
