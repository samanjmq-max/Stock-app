import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const id = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  const rol = request.headers.get("x-user-rol");
  const nombre = request.headers.get("x-user-nombre");
  const agencia = request.headers.get("x-user-agencia");

  if (!id || !email || !rol) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, data: { id, email, rol, nombre, agencia } });
}
