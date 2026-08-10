import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validations";
import { getUsuarioPorEmail, registrarHistorial } from "@/lib/sheets";
import { compararPassword, crearToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { estaLimitado, registrarIntentoFallido, limpiarIntentos, minutosRestantes } from "@/lib/rateLimit";
import type { Agencia } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.errors[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }
    const { email, password } = parsed.data;

    const ip = request.headers.get("x-forwarded-for") || "sin-ip";
    const claveLimite = `${ip}:${email.toLowerCase().trim()}`;

    if (estaLimitado(claveLimite)) {
      const minutos = minutosRestantes(claveLimite);
      return NextResponse.json(
        { ok: false, error: `Demasiados intentos fallidos. Probá de nuevo en ${minutos} minuto${minutos === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    const usuario = await getUsuarioPorEmail(email.toLowerCase().trim());
    if (!usuario || !usuario.activo) {
      registrarIntentoFallido(claveLimite);
      return NextResponse.json({ ok: false, error: "Email o contraseña incorrectos" }, { status: 401 });
    }

    const passwordOk = await compararPassword(password, usuario.passwordHash);
    if (!passwordOk) {
      registrarIntentoFallido(claveLimite);
      return NextResponse.json({ ok: false, error: "Email o contraseña incorrectos" }, { status: 401 });
    }

    limpiarIntentos(claveLimite);

    // La agencia queda grabada en el token — el frontend la usa para filtrar
    // productos, conteos y Dashboard sin tener que pedirla de nuevo.
    const token = await crearToken({
      userId: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombre: usuario.nombre,
      agencia: (usuario.agencia || "Centro Logístico") as Agencia,
    });

    await registrarHistorial({
      usuarioId: usuario.id,
      usuarioEmail: usuario.email,
      rol: usuario.rol,
      accion: "login",
      dispositivo: request.headers.get("user-agent") || "",
      ip,
    });

    const response = NextResponse.json({
      ok: true,
      data: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        agencia: usuario.agencia || "Centro Logístico",
      },
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (err) {
    console.error("Error en login:", err);
    return NextResponse.json({ ok: false, error: "Error al iniciar sesión" }, { status: 500 });
  }
}
