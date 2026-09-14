import { NextRequest, NextResponse } from "next/server";
import { alcanceDe, capacidadesDe, perfilDe } from "@/lib/permisos";
import type { Agencia, Rol } from "@/types";

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

  const perfil = perfilDe({ perfil: request.headers.get("x-user-perfil"), rol: rol as Rol });
  const agenciasTexto = decodificar(request.headers.get("x-user-agencias")) || "";
  const base = { perfil, rol: rol as Rol, email, agencia: agencia as Agencia, agencias: agenciasTexto };

  /*
    La interfaz necesita saber qué puede hacer esta persona para esconder lo
    que no corresponde. Se mandan las capacidades ya resueltas y no el perfil
    a secas, para que el frontend no tenga que reimplementar la tabla de
    permisos -- si la reimplementa, tarde o temprano queda desalineada con el
    servidor. Esto es solo para dibujar: quien decide de verdad sigue siendo
    cada ruta de API.
  */
  return NextResponse.json({
    ok: true,
    data: {
      id,
      email,
      rol,
      nombre,
      agencia,
      perfil,
      agencias: agenciasTexto,
      alcance: alcanceDe(base),
      capacidades: capacidadesDe(base),
      esSuperAdmin,
    },
  });
}
