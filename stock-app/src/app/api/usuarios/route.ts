import { NextRequest, NextResponse } from "next/server";
import { getUsuarios, crearUsuario, registrarHistorial } from "@/lib/sheets";
import { usuarioSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";
import { esSuperAdmin } from "@/lib/permisos";
import type { Rol, Agencia, Usuario } from "@/types";

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

    const passwordHash = await hashPassword(parsed.data.password);

    // Nota: NO se consulta antes si el email ya existe. Esa verificación
    // previa era un viaje extra a Apps Script (lento) y además no evitaba
    // nada: entre la consulta y el alta puede colarse otra creación. La
    // validación buena es la que hace `crearUsuario_` en Apps Script, que
    // corre dentro del candado del script. Acá solo se traduce ese error
    // al código HTTP que corresponde.
    let usuario: Usuario;
    try {
      usuario = await crearUsuario({
        nombre: parsed.data.nombre,
        email: parsed.data.email.toLowerCase().trim(),
        passwordHash,
        rol: parsed.data.rol,
        agencia: parsed.data.agencia,
      });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "No se pudo crear el usuario";
      if (/ya existe/i.test(mensaje)) {
        return NextResponse.json({ ok: false, error: "Ya existe un usuario con ese email" }, { status: 409 });
      }
      throw err;
    }

    // El historial es auditoría, no parte del alta: si falla o se demora,
    // el usuario ya quedó creado y no tiene sentido devolverle un error al
    // administrador por eso. Se registra el fallo en los logs de Vercel.
    try {
      await registrarHistorial({
        usuarioId: userId,
        usuarioEmail: email,
        rol,
        accion: "crear_usuario",
        entidad: `usuario:${usuario.email}`,
        valorNuevo: `rol:${usuario.rol}, agencia:${usuario.agencia}`,
      });
    } catch (err) {
      console.error("Usuario creado, pero falló el registro en historial:", err);
    }

    return NextResponse.json({ ok: true, data: usuario }, { status: 201 });
  } catch (err) {
    console.error("Error al crear usuario:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo crear" }, { status: 500 });
  }
}
