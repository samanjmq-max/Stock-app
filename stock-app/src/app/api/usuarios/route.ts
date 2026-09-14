import { NextRequest, NextResponse } from "next/server";
import { getUsuarios, crearUsuario, registrarHistorial } from "@/lib/sheets";
import { usuarioSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";
import { esSuperAdmin, puedeGestionarA, perfilesQuePuedeCrear, serializarAgencias, rolDePerfil } from "@/lib/permisos";
import { leerSesion } from "@/lib/sesion";
import type { Usuario } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const sesion = leerSesion(request);
    if (!sesion) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const usuarios = await getUsuarios();

    /*
      Qué usuarios ve cada uno: los de las plantas que tiene a cargo.

      Antes era `u.agencia === agenciaPropia`, una sola planta. Con un jefe a
      cargo de dos o tres depósitos eso le escondía a su propia gente. Ahora
      se compara contra el alcance completo, que para el gerente y el super
      admin son las nueve.
    */
    const visibles = sesion.capacidades.todasLasPlantas
      ? usuarios
      : usuarios.filter((u) => sesion.alcance.includes(u.agencia));

    /*
      Se marca acá quién es el super admin, en vez de que la pantalla lo
      deduzca comparando contra el usuario logueado. Esa comparación solo
      acertaba en la fila propia: para un gerente mirando la lista, la fila
      del super admin aparecía como "Jefe de Planta", que es lo que su rol
      dice pero no lo que la persona es.

      El dato tiene que venir del servidor sí o sí: sale de
      SUPER_ADMIN_EMAIL, que en el navegador no existe.
    */
    const conMarca = visibles.map((u) => ({ ...u, esSuperAdmin: esSuperAdmin(u.email) }));

    return NextResponse.json({ ok: true, data: conMarca });
  } catch (err) {
    console.error("Error al listar usuarios:", err);
    return NextResponse.json({ ok: false, error: "No se pudieron obtener los usuarios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (!sesion.capacidades.gestionarUsuarios) {
    return NextResponse.json({ ok: false, error: "Tu perfil no puede crear usuarios" }, { status: 403 });
  }
  const { rol, id: userId, email } = sesion;

  try {
    const body = await request.json();
    const parsed = usuarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }
    if (!parsed.data.password) {
      return NextResponse.json({ ok: false, error: "La contraseña es obligatoria para un usuario nuevo" }, { status: 400 });
    }

    // Un nuevo usuario creado desde el formulario NUNCA es el super
    // administrador (ese es fijo, por variable de entorno) — así que
    // la planta siempre es obligatoria acá, sin excepción.
    if (!parsed.data.agencia) {
      return NextResponse.json({ ok: false, error: "La planta es obligatoria" }, { status: 400 });
    }

    /*
      Dos controles, y hacen falta los dos.

      El primero: no se puede otorgar un perfil por encima del propio. Un
      jefe de planta que pudiera crear otro jefe se fabricaría permisos --
      se crea un usuario nuevo, le asigna las nueve plantas y entra con ese.

      El segundo: todas las plantas del nuevo usuario tienen que caer dentro
      del alcance de quien lo crea. Eso es lo que hace `puedeGestionarA`, y
      cubre tanto la planta principal como las extra.
    */
    if (!perfilesQuePuedeCrear(sesion).includes(parsed.data.perfil)) {
      return NextResponse.json(
        { ok: false, error: `Tu perfil no puede crear un usuario con perfil "${parsed.data.perfil}"` },
        { status: 403 }
      );
    }

    const agencias = serializarAgencias(
      parsed.data.perfil === "jefe" && parsed.data.agencias?.length
        ? parsed.data.agencias
        : [parsed.data.agencia]
    );

    if (!puedeGestionarA(sesion, { perfil: parsed.data.perfil, agencia: parsed.data.agencia, agencias })) {
      return NextResponse.json(
        { ok: false, error: "No podés asignar plantas que no tenés a cargo" },
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
        // El rol se deriva del perfil, nunca llega del formulario. Apps
        // Script lo recalcula igual: la misma regla puesta dos veces, que en
        // permisos es donde la redundancia vale la pena.
        rol: rolDePerfil(parsed.data.perfil),
        perfil: parsed.data.perfil,
        agencia: parsed.data.agencia,
        agencias,
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
        valorNuevo: `perfil:${parsed.data.perfil}, plantas:${agencias}`,
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
