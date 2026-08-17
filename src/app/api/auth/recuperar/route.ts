import { NextRequest, NextResponse } from "next/server";
import { getUsuarioPorEmail, actualizarUsuario, registrarHistorial } from "@/lib/sheets";
import { hashPassword } from "@/lib/password";
import { esSuperAdmin } from "@/lib/permisos";
import { estaLimitado, registrarIntentoFallido, limpiarIntentos, minutosRestantes } from "@/lib/rateLimit";
import { z } from "zod";

const recuperarSchema = z.object({
  email: z.string().email(),
  codigo: z.string().min(1),
  nuevaPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// Mensaje idéntico para CUALQUIER motivo de fallo (email que no es el del
// super admin, código incorrecto, etc.) — así nadie puede usar los mensajes
// de error para averiguar si un email en particular es el del super admin.
const ERROR_GENERICO = "No se pudo procesar la solicitud. Verificá el email y el código.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = recuperarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || ERROR_GENERICO }, { status: 400 });
    }
    const { email, codigo, nuevaPassword } = parsed.data;
    const emailNormalizado = email.toLowerCase().trim();

    const ip = request.headers.get("x-forwarded-for") || "sin-ip";
    const claveLimite = `recuperar:${ip}:${emailNormalizado}`;

    if (estaLimitado(claveLimite)) {
      const minutos = minutosRestantes(claveLimite);
      return NextResponse.json(
        { ok: false, error: `Demasiados intentos. Probá de nuevo en ${minutos} minuto${minutos === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    const codigoConfigurado = process.env.RECOVERY_CODE;
    if (!codigoConfigurado) {
      console.error("RECOVERY_CODE no está configurado en las variables de entorno");
      return NextResponse.json({ ok: false, error: ERROR_GENERICO }, { status: 500 });
    }

    // Esta recuperación SOLO funciona para el email del super administrador.
    // Cualquier otro email recibe el mismo error genérico, sin distinción.
    if (!esSuperAdmin(emailNormalizado) || codigo !== codigoConfigurado) {
      registrarIntentoFallido(claveLimite);
      return NextResponse.json({ ok: false, error: ERROR_GENERICO }, { status: 401 });
    }

    const usuario = await getUsuarioPorEmail(emailNormalizado);
    if (!usuario) {
      registrarIntentoFallido(claveLimite);
      return NextResponse.json({ ok: false, error: ERROR_GENERICO }, { status: 401 });
    }

    const passwordHash = await hashPassword(nuevaPassword);
    await actualizarUsuario(usuario.id, { passwordHash });
    limpiarIntentos(claveLimite);

    await registrarHistorial({
      usuarioId: usuario.id,
      usuarioEmail: usuario.email,
      rol: usuario.rol,
      accion: "recuperar_password",
      entidad: `usuario:${usuario.email}`,
      dispositivo: request.headers.get("user-agent") || "",
      ip,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al recuperar contraseña:", err);
    return NextResponse.json({ ok: false, error: ERROR_GENERICO }, { status: 500 });
  }
}
