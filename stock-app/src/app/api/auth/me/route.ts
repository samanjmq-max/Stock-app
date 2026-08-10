import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const id = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  const rol = request.headers.get("x-user-rol");
  const nombreHeader = request.headers.get("x-user-nombre");
  const agenciaHeader = request.headers.get("x-user-agencia");
  const esSuperAdmin = request.headers.get("x-user-es-super-admin") === "1";

  if (!id || !email || !rol) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  function decodificar(valor: string | null): string | null {
    if (!valor) return valor;
    try {
      return decodeURIComponent(valor);
    } catch {
      return valor;
    }
  }

  const nombre = decodificar(nombreHeader);
  const agencia = decodificar(agenciaHeader);

  return NextResponse.json({ ok: true, data: { id, email, rol, nombre, agencia, esSuperAdmin } });
}
