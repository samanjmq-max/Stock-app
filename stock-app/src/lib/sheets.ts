import "server-only";
import type { Usuario, Producto, Conteo, HistorialEntry, AccionHistorial, Rol, Agencia } from "@/types";

const GAS_URL = process.env.GAS_WEB_APP_URL;
const GAS_API_KEY = process.env.GAS_API_KEY;

if (!GAS_URL && process.env.NODE_ENV === "production") {
  throw new Error("Falta GAS_WEB_APP_URL");
}

interface GasResponse<T> { ok: boolean; data?: T; error?: string; }

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
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, apiKey: GAS_API_KEY, ...body }),
    cache: "no-store",
  });
  const json: GasResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error || `Error al llamar a Apps Script (${action})`);
  return json.data as T;
}

/* ==================== USUARIOS ==================== */
export async function getUsuarios(): Promise<Usuario[]> { return gasGet<Usuario[]>("listarUsuarios"); }
export async function getUsuarioPorEmail(email: string): Promise<(Usuario & { passwordHash: string }) | null> {
  return gasGet<(Usuario & { passwordHash: string }) | null>("obtenerUsuarioPorEmail", { email });
}
export async function crearUsuario(input: { nombre: string; email: string; passwordHash: string; rol: Rol; agencia: Agencia; }): Promise<Usuario> {
  return gasPost<Usuario>("crearUsuario", input);
}
export async function actualizarUsuario(id: string, input: Partial<{ nombre: string; email: string; passwordHash: string; rol: Rol; agencia: Agencia; activo: boolean }>): Promise<Usuario> {
  return gasPost<Usuario>("actualizarUsuario", { id, ...input });
}
export async function eliminarUsuario(id: string): Promise<{ id: string }> {
  return gasPost<{ id: string }>("eliminarUsuario", { id });
}

/* ==================== PRODUCTOS ==================== */
export async function getProductos(agencia?: Agencia): Promise<Producto[]> {
  return gasGet<Producto[]>("listarProductos", agencia ? { agencia } : {});
}
export async function getProductoPorCodigo(codigo: string, agencia?: Agencia): Promise<Producto | null> {
  return gasGet<Producto | null>("obtenerProductoPorCodigo", { codigo, ...(agencia ? { agencia } : {}) });
}
export async function crearProducto(input: Omit<Producto, "id" | "actualizadoEn">): Promise<Producto> {
  return gasPost<Producto>("crearProducto", input);
}
export async function actualizarProducto(id: string, input: Partial<Omit<Producto, "id">>): Promise<Producto> {
  return gasPost<Producto>("actualizarProducto", { id, ...input });
}
export async function eliminarProducto(id: string): Promise<{ id: string }> {
  return gasPost<{ id: string }>("eliminarProducto", { id });
}
export async function importarProductos(productos: Omit<Producto, "id" | "actualizadoEn">[], agencia: Agencia): Promise<{ importados: number; actualizados: number; agencia: string }> {
  return gasPost<{ importados: number; actualizados: number; agencia: string }>("importarProductos", { productos, agencia });
}

/* ==================== CONTEOS ==================== */
export async function getConteos(agencia?: Agencia): Promise<Conteo[]> {
  return gasGet<Conteo[]>("listarConteos", agencia ? { agencia } : {});
}
export async function guardarConteo(input: Omit<Conteo, "id" | "creadoEn" | "sincronizado">): Promise<Conteo> {
  return gasPost<Conteo>("guardarConteo", input);
}
export async function guardarConteosLote(conteos: Omit<Conteo, "id" | "creadoEn" | "sincronizado">[]): Promise<{ guardados: number }> {
  return gasPost<{ guardados: number }>("guardarConteosLote", { conteos });
}
export async function editarConteo(id: string, input: { stockContado: number; diferencia: number; estado: string; observaciones: string; ubicacionNueva: string }): Promise<Conteo> {
  return gasPost<Conteo>("editarConteo", { id, ...input });
}
export async function eliminarConteo(id: string): Promise<{ id: string; eliminado: boolean }> {
  return gasPost<{ id: string; eliminado: boolean }>("eliminarConteo", { id });
}
export async function eliminarConteos(ids: string[]): Promise<{ eliminados: number }> {
  return gasPost<{ eliminados: number }>("eliminarConteos", { ids });
}
export async function resetearConteos(agencia?: Agencia): Promise<{ eliminados: number }> {
  return gasPost<{ eliminados: number }>("resetearConteos", agencia ? { agencia } : {});
}

/* ==================== HISTORIAL ==================== */
export async function getHistorial(): Promise<HistorialEntry[]> { return gasGet<HistorialEntry[]>("listarHistorial"); }
export async function registrarHistorial(input: { usuarioId: string; usuarioEmail: string; rol: Rol; accion: AccionHistorial; entidad?: string; valorAnterior?: string; valorNuevo?: string; observacion?: string; dispositivo?: string; ip?: string; }): Promise<HistorialEntry> {
  return gasPost<HistorialEntry>("registrarHistorial", input);
}

/* ==================== AGENCIAS ==================== */
export async function getAgencias(): Promise<string[]> { return gasGet<string[]>("listarAgencias"); }
