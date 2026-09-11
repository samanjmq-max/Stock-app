import { NextRequest, NextResponse } from "next/server";
import { verificarToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { esSuperAdmin } from "@/lib/permisos";
const RUTAS_PUBLICAS = ["/login", "/api/auth/login", "/recuperar", "/api/auth/recuperar"];
// /historial y /api/historial: el log de auditoría es de toda la empresa
// (login/logout, altas/bajas, ediciones de productos y usuarios de TODAS
// las plantas) y hoy no tiene forma de filtrarse por agencia porque
// HistorialEntry no guarda ese dato -- se restringe a admin para no
// exponer actividad de otras plantas a un operador.
const RUTAS_SOLO_ADMIN = ["/configuracion", "/usuarios", "/api/usuarios", "/etiquetas", "/historial", "/api/historial"];
// Carpetas de estáticos públicos en /public (imágenes, video, fuentes, audio, etc.)
// servidas directamente por Next — nunca requieren sesión, sin importar la ruta.
const ES_ASSET_DIR = /^\/(?:videos|images|img|fonts|audio)\//;
// Fallback por extensión: cualquier archivo estático típico, esté donde esté
// dentro de /public, queda exento aunque se agregue una carpeta nueva a futuro.
const ES_ASSET_EXT = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp|mp4|webm|mov|m4v|ogg|ogv|mp3|wav|m4a|woff2?|ttf|otf|eot)$/i;
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const esPublica = RUTAS_PUBLICAS.some((r) => pathname.startsWith(r));
  const esAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico" ||
    ES_ASSET_DIR.test(pathname) ||
    ES_ASSET_EXT.test(pathname);
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
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.sub);
  requestHeaders.set("x-user-email", payload.email);
  requestHeaders.set("x-user-rol", payload.rol);
  requestHeaders.set("x-user-nombre", payload.nombre);
  requestHeaders.set("x-user-agencia", payload.agencia || "Centro Logístico");
  requestHeaders.set("x-user-es-super-admin", esSuperAdmin(payload.email) ? "1" : "0");
  return NextResponse.next({ request: { headers: requestHeaders } });
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};
