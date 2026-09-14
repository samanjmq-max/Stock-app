import { NextRequest, NextResponse } from "next/server";
import { actualizarUsuario, eliminarUsuario, getUsuarios, registrarHistorial } from "@/lib/sheets";
import { usuarioSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";
import { esSuperAdmin, puedeGestionarA, perfilesQuePuedeCrear, perfilDe, rolDePerfil, serializarAgencias } from "@/lib/permisos";
import { leerSesion } from "@/lib/sesion";


export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (!sesion.capacidades.gestionarUsuarios) {
    return NextResponse.json({ ok: false, error: "Tu perfil no puede editar usuarios" }, { status: 403 });
  }
  const { rol, id: userId, email } = sesion;

  try {
    const { id } = await params;

    const usuarios = await getUsuarios();
    const objetivo = usuarios.find((u) => u.id === id);
    if (!objetivo) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    // Se verifica contra el usuario COMO ESTÁ HOY: hay que poder tocarlo
    // antes de mirar siquiera qué cambios se piden.
    if (!puedeGestionarA(sesion, objetivo)) {
      return NextResponse.json(
        { ok: false, error: "No podés editar a este usuario" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = usuarioSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    // La planta es obligatoria para cualquier usuario, EXCEPTO si la cuenta
    // que se está editando es la del propio super administrador
    // (identificado por su email, no por lo que mande el formulario).
    const objetivoEsSuperAdmin = esSuperAdmin(objetivo.email);
    if (!objetivoEsSuperAdmin && parsed.data.agencia !== undefined && !parsed.data.agencia) {
      return NextResponse.json({ ok: false, error: "La planta es obligatoria" }, { status: 400 });
    }

    const cambios: Record<string, unknown> = { ...parsed.data };
    delete cambios.password;
    delete cambios.agencias;

    /*
      Y ahora contra CÓMO QUEDARÍA. Los dos controles son necesarios: el de
      arriba evita que toque a alguien que no le corresponde; éste evita que
      lo use para escalar -- agarrar a un operario de su planta y convertirlo
      en jefe con las nueve, o mandarlo a un depósito ajeno. Sin este, la
      edición sería la puerta de atrás de todo lo que el alta bloquea.
    */
    const perfilFinal = parsed.data.perfil ?? perfilDe(objetivo);
    const agenciaFinal = (parsed.data.agencia || objetivo.agencia) as typeof objetivo.agencia;
    const agenciasFinal = serializarAgencias(
      perfilFinal === "jefe" && parsed.data.agencias?.length ? parsed.data.agencias : [agenciaFinal]
    );

    if (!objetivoEsSuperAdmin) {
      if (parsed.data.perfil && !perfilesQuePuedeCrear(sesion).includes(parsed.data.perfil)) {
        return NextResponse.json(
          { ok: false, error: `Tu perfil no puede otorgar el perfil "${parsed.data.perfil}"` },
          { status: 403 }
        );
      }
      if (!puedeGestionarA(sesion, { perfil: perfilFinal, agencia: agenciaFinal, agencias: agenciasFinal })) {
        return NextResponse.json(
          { ok: false, error: "No podés asignar plantas que no tenés a cargo" },
          { status: 403 }
        );
      }
      // Perfil y rol se mueven juntos, siempre. Apps Script lo recalcula igual.
      if (parsed.data.perfil) {
        cambios.perfil = perfilFinal;
        cambios.rol = rolDePerfil(perfilFinal);
      }
      if (parsed.data.agencias !== undefined || parsed.data.perfil !== undefined) {
        cambios.agencias = agenciasFinal;
      }
    }

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
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (!sesion.capacidades.gestionarUsuarios) {
    return NextResponse.json({ ok: false, error: "Tu perfil no puede eliminar usuarios" }, { status: 403 });
  }
  const { rol, id: userId, email } = sesion;

  try {
    const { id } = await params;

    if (id === userId) {
      return NextResponse.json({ ok: false, error: "No podés eliminar tu propio usuario" }, { status: 400 });
    }

    const usuarios = await getUsuarios();
    const objetivo = usuarios.find((u) => u.id === id);
    if (!objetivo) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
    }
    // El super admin no se borra desde ninguna pantalla, ni siquiera por él
    // mismo desde otra cuenta: es la última llave del sistema.
    if (esSuperAdmin(objetivo.email)) {
      return NextResponse.json(
        { ok: false, error: "La cuenta del super administrador no se puede eliminar" },
        { status: 403 }
      );
    }
    if (!puedeGestionarA(sesion, objetivo)) {
      return NextResponse.json(
        { ok: false, error: "No podés eliminar a este usuario" },
        { status: 403 }
      );
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
