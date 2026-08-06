import { NextRequest, NextResponse } from "next/server";
import { verificarToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const RUTAS_PUBLICAS = ["/login", "/api/auth/login"];
const RUTAS_SOLO_ADMIN = ["/configuracion", "/usuarios", "/api/usuarios"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const esPublica = RUTAS_PUBLICAS.some((r) => pathname.startsWith(r));
  const esAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico";

  if (esPublica || esAsset) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verificarToken(token) : null;

  if (!payload) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requiereAdmin = RUTAS_SOLO_ADMIN.some((r) => pathname.startsWith(r));
  if (requiereAdmin && payload.rol !== "administrador") {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ ok: false, error: "Acceso restringido a administradores" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Propaga la identidad del usuario a las API routes vía headers internos.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.sub);
  requestHeaders.set("x-user-email", payload.email);
  requestHeaders.set("x-user-rol", payload.rol);
  requestHeaders.set("x-user-nombre", payload.nombre);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};
