import { NextRequest, NextResponse } from "next/server";
import { verificarToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { capacidadesDe, esSuperAdmin, perfilDe, type Capacidades } from "@/lib/permisos";
const RUTAS_PUBLICAS = ["/login", "/api/auth/login", "/recuperar", "/api/auth/recuperar"];
// /historial y /api/historial: el log de auditoría es de toda la empresa
// (login/logout, altas/bajas, ediciones de productos y usuarios de TODAS
// las plantas) y hoy no tiene forma de filtrarse por agencia porque
// HistorialEntry no guarda ese dato -- se restringe a admin para no
// exponer actividad de otras plantas a un operador.
/*
  Cada ruta restringida pide una capacidad concreta, no "ser administrador".

  Con los dos roles de antes daba lo mismo: administrador podía todo y
  operador nada. Ahora no -- un encargado de almacén borra líneas pero no
  entra a Usuarios, y un jefe de planta entra a Usuarios pero solo maneja
  su propia gente. Nombrar la capacidad y no el rol es lo que hace que
  agregar un perfil mañana no obligue a revisar esta lista.
*/
const RUTAS_RESTRINGIDAS: { prefijo: string; capacidad: keyof Capacidades }[] = [
  { prefijo: "/usuarios", capacidad: "gestionarUsuarios" },
  { prefijo: "/api/usuarios", capacidad: "gestionarUsuarios" },
  { prefijo: "/etiquetas", capacidad: "etiquetas" },
  { prefijo: "/api/etiquetas", capacidad: "etiquetas" },
  { prefijo: "/historial", capacidad: "verHistorial" },
  { prefijo: "/api/historial", capacidad: "verHistorial" },
  { prefijo: "/configuracion", capacidad: "gestionarCatalogo" },
];
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
  const perfil = perfilDe(payload);
  const capacidades = capacidadesDe(payload);

  const restriccion = RUTAS_RESTRINGIDAS.find((r) => pathname.startsWith(r.prefijo));
  if (restriccion && !capacidades[restriccion.capacidad]) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ ok: false, error: "No tenés permiso para esta operación" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.sub);
  requestHeaders.set("x-user-email", payload.email);
  requestHeaders.set("x-user-rol", payload.rol);
  requestHeaders.set("x-user-nombre", payload.nombre);
  requestHeaders.set("x-user-agencia", payload.agencia || "Centro Logístico");
  requestHeaders.set("x-user-perfil", perfil);
  /*
    Las plantas van codificadas a propósito. Los nombres traen acentos
    ("Centro Logístico") y una cabecera HTTP con caracteres fuera de ASCII
    ya dio problemas antes -- por eso /api/auth/me hace decodeURIComponent
    sobre nombre y agencia. Acá se codifica de forma explícita en la ida y
    se decodifica en la vuelta, así el comportamiento es el mismo siempre y
    no depende de quién codifique por el camino.
  */
  requestHeaders.set("x-user-agencias", encodeURIComponent(payload.agencias || ""));
  requestHeaders.set("x-user-es-super-admin", esSuperAdmin(payload.email) ? "1" : "0");
  return NextResponse.next({ request: { headers: requestHeaders } });
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};
