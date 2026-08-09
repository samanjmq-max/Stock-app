import "server-only";
import type { Usuario, Producto, Conteo, HistorialEntry, AccionHistorial, Rol } from "@/types";

/**
 * Este módulo es la ÚNICA parte del sistema que sabe que la persistencia
 * hoy es Google Sheets. Expone funciones de dominio (getProductos,
 * guardarConteo, etc.) — el resto de la app (API routes, componentes)
 * nunca construye URLs de Apps Script ni conoce su forma.
 *
 * El día que se migre a PostgreSQL/Supabase, SOLO este archivo cambia:
 * se reimplementan estas mismas funciones contra la nueva base y el
 * resto de la aplicación sigue funcionando sin tocarse.
 */

const GAS_URL = process.env.GAS_WEB_APP_URL;
const GAS_API_KEY = process.env.GAS_API_KEY;

if (!GAS_URL && process.env.NODE_ENV === "production") {
  throw new Error("Falta GAS_WEB_APP_URL: la URL de tu Google Apps Script Web App");
}

interface GasResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function gasGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(GAS_URL as string);
  url.searchParams.set("action", action);
  url.searchParams.set("apiKey", GAS_API_KEY || "");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const json: GasResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error || `Error al llamar a Apps Script (${action})`);
  return json.data as T;
}

async function gasPost<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_URL as string, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita preflight CORS en Apps Script
    body: JSON.stringify({ action, apiKey: GAS_API_KEY, ...body }),
    cache: "no-store",
  });
  const json: GasResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error || `Error al llamar a Apps Script (${action})`);
  return json.data as T;
}

/* ==================== USUARIOS ==================== */

export async function getUsuarios(): Promise<Usuario[]> {
  return gasGet<Usuario[]>("listarUsuarios");
}

export async function getUsuarioPorEmail(
  email: string
): Promise<(Usuario & { passwordHash: string }) | null> {
  return gasGet<(Usuario & { passwordHash: string }) | null>("obtenerUsuarioPorEmail", { email });
}

export async function crearUsuario(input: {
  nombre: string;
  email: string;
  passwordHash: string;
  rol: Rol;
}): Promise<Usuario> {
  return gasPost<Usuario>("crearUsuario", input);
}

export async function actualizarUsuario(
  id: string,
  input: Partial<{ nombre: string; email: string; passwordHash: string; rol: Rol; activo: boolean }>
): Promise<Usuario> {
  return gasPost<Usuario>("actualizarUsuario", { id, ...input });
}

export async function eliminarUsuario(id: string): Promise<{ id: string }> {
  return gasPost<{ id: string }>("eliminarUsuario", { id });
}

/* ==================== PRODUCTOS ==================== */

export async function getProductos(): Promise<Producto[]> {
  return gasGet<Producto[]>("listarProductos");
}

export async function getProductoPorCodigo(codigo: string): Promise<Producto | null> {
  return gasGet<Producto | null>("obtenerProductoPorCodigo", { codigo });
}

export async function crearProducto(input: Omit<Producto, "id" | "actualizadoEn">): Promise<Producto> {
  return gasPost<Producto>("crearProducto", input);
}

export async function actualizarProducto(
  id: string,
  input: Partial<Omit<Producto, "id">>
): Promise<Producto> {
  return gasPost<Producto>("actualizarProducto", { id, ...input });
}

export async function eliminarProducto(id: string): Promise<{ id: string }> {
  return gasPost<{ id: string }>("eliminarProducto", { id });
}

export async function importarProductos(
  productos: Omit<Producto, "id" | "actualizadoEn">[]
): Promise<{ importados: number }> {
  return gasPost<{ importados: number }>("importarProductos", { productos });
}

/* ==================== CONTEOS ==================== */

export async function getConteos(): Promise<Conteo[]> {
  return gasGet<Conteo[]>("listarConteos");
}

export async function guardarConteo(
  input: Omit<Conteo, "id" | "creadoEn" | "sincronizado">
): Promise<Conteo> {
  return gasPost<Conteo>("guardarConteo", input);
}

export async function guardarConteosLote(
  conteos: Omit<Conteo, "id" | "creadoEn" | "sincronizado">[]
): Promise<{ guardados: number }> {
  return gasPost<{ guardados: number }>("guardarConteosLote", { conteos });
}

/** Corrige un conteo YA guardado (por su id) — no crea uno nuevo. */
export async function editarConteo(
  id: string,
  input: { stockContado: number; diferencia: number; estado: string; observaciones: string; ubicacionNueva: string }
): Promise<Conteo> {
  return gasPost<Conteo>("editarConteo", { id, ...input });
}

/** Elimina UN conteo puntual por su id. */
export async function eliminarConteo(id: string): Promise<{ id: string; eliminado: boolean }> {
  return gasPost<{ id: string; eliminado: boolean }>("eliminarConteo", { id });
}

/** Elimina VARIOS conteos de una vez (selección múltiple). */
export async function eliminarConteos(ids: string[]): Promise<{ eliminados: number }> {
  return gasPost<{ eliminados: number }>("eliminarConteos", { ids });
}

export async function resetearConteos(): Promise<{ eliminados: number }> {
  return gasPost<{ eliminados: number }>("resetearConteos", {});
}

/* ==================== HISTORIAL ==================== */

export async function getHistorial(): Promise<HistorialEntry[]> {
  return gasGet<HistorialEntry[]>("listarHistorial");
}

export async function registrarHistorial(input: {
  usuarioId: string;
  usuarioEmail: string;
  rol: Rol;
  accion: AccionHistorial;
  entidad?: string;
  valorAnterior?: string;
  valorNuevo?: string;
  observacion?: string;
  dispositivo?: string;
  ip?: string;
}): Promise<HistorialEntry> {
  return gasPost<HistorialEntry>("registrarHistorial", input);
}
