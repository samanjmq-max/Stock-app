import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { registrarHistorial } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  const rol = request.headers.get("x-user-rol") as "administrador" | "operador" | null;

  if (userId && email && rol) {
    try {
      await registrarHistorial({ usuarioId: userId, usuarioEmail: email, rol, accion: "logout" });
    } catch (err) {
      console.error("No se pudo registrar el logout en el historial:", err);
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
