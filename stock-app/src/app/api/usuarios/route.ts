import { NextRequest, NextResponse } from "next/server";
import { getUsuarios, crearUsuario, getUsuarioPorEmail, registrarHistorial } from "@/lib/sheets";
import { usuarioSchema } from "@/lib/validations";
import { compararPassword, crearToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import type { Rol } from "@/types";

// El middleware ya restringe /api/usuarios a administradores (RUTAS_SOLO_ADMIN),
// pero se revalida acá también por defensa en profundidad.

export async function GET() {
  try {
    const usuarios = await getUsuarios();
    return NextResponse.json({ ok: true, data: usuarios });
  } catch (err) {
    console.error("Error al listar usuarios:", err);
    return NextResponse.json({ ok: false, error: "No se pudieron obtener los usuarios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";

  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede crear usuarios" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = usuarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }
    if (!parsed.data.password) {
      return NextResponse.json({ ok: false, error: "La contraseña es obligatoria para un usuario nuevo" }, { status: 400 });
    }

    const existente = await getUsuarioPorEmail(parsed.data.email.toLowerCase().trim());
    if (existente) {
      return NextResponse.json({ ok: false, error: "Ya existe un usuario con ese email" }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const usuario = await crearUsuario({
      nombre: parsed.data.nombre,
      email: parsed.data.email.toLowerCase().trim(),
      passwordHash,
      rol: parsed.data.rol,
    });

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "crear_usuario",
      entidad: `usuario:${usuario.email}`,
      valorNuevo: `rol:${usuario.rol}`,
    });

    return NextResponse.json({ ok: true, data: usuario }, { status: 201 });
  } catch (err) {
    console.error("Error al crear usuario:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo crear" }, { status: 500 });
  }
}
