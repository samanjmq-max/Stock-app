import { NextRequest, NextResponse } from "next/server";
import { getUsuarios, crearUsuario, getUsuarioPorEmail, registrarHistorial } from "@/lib/sheets";
import { usuarioSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";
import { esSuperAdmin } from "@/lib/permisos";
import type { Rol, Agencia } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const email = request.headers.get("x-user-email");
    const agenciaPropia = request.headers.get("x-user-agencia") as Agencia | null;

    const usuarios = await getUsuarios();

    const visibles = esSuperAdmin(email)
      ? usuarios
      : usuarios.filter((u) => u.agencia === agenciaPropia);

    return NextResponse.json({ ok: true, data: visibles });
  } catch (err) {
    console.error("Error al listar usuarios:", err);
    return NextResponse.json({ ok: false, error: "No se pudieron obtener los usuarios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";
  const agenciaPropia = request.headers.get("x-user-agencia") as Agencia | null;

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

    const esSuper = esSuperAdmin(email);
    // Un nuevo usuario creado desde el formulario NUNCA es el super
    // administrador (ese es fijo, por variable de entorno) — así que
    // la agencia siempre es obligatoria acá, sin excepción.
    if (!parsed.data.agencia) {
      return NextResponse.json({ ok: false, error: "La agencia es obligatoria" }, { status: 400 });
    }

    if (!esSuper && parsed.data.agencia !== agenciaPropia) {
      return NextResponse.json(
        { ok: false, error: "Solo podés crear usuarios para tu propia agencia" },
        { status: 403 }
      );
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
      agencia: parsed.data.agencia,
    });

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "crear_usuario",
      entidad: `usuario:${usuario.email}`,
      valorNuevo: `rol:${usuario.rol}, agencia:${usuario.agencia}`,
    });

    return NextResponse.json({ ok: true, data: usuario }, { status: 201 });
  } catch (err) {
    console.error("Error al crear usuario:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo crear" }, { status: 500 });
  }
}
