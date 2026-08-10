// ============================================================
// Tipos de dominio — reflejan las entidades lógicas del sistema
// ============================================================

export const AGENCIAS = [
  "JP Varela",
  "Lascano",
  "Vergara",
  "Rio Branco",
  "Tres Gomensoro",
  "Tacuarembó",
  "Salto",
  "Montevideo",
  "Centro Logístico",
] as const;

export type Agencia = (typeof AGENCIAS)[number];

export type Rol = "administrador" | "operador";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  agencia: Agencia;
  activo: boolean;
  creadoEn: string;
}

export interface Producto {
  id: string;
  codigo: string;
  descripcion: string;
  ubicacion: string;
  familia: string;
  proveedor: string;
  stockSap: number;
  agencia: Agencia;
  actualizadoEn: string;
}

export type EstadoConteo = "coincide" | "sobra" | "falta" | "no_existe";

export interface Conteo {
  id: string;
  codigo: string;
  descripcion: string;
  ubicacion: string;
  ubicacionNueva: string;
  stockSap: number;
  stockContado: number;
  diferencia: number;
  estado: EstadoConteo;
  observaciones: string;
  agencia: Agencia;
  usuarioId: string;
  usuarioEmail: string;
  fecha: string;
  hora: string;
  sincronizado: boolean;
  creadoEn: string;
}

export type AccionHistorial =
  | "login"
  | "logout"
  | "crear_producto"
  | "editar_producto"
  | "eliminar_producto"
  | "crear_usuario"
  | "editar_usuario"
  | "eliminar_usuario"
  | "guardar_conteo"
  | "resetear_conteos"
  | "importar_productos"
  | "exportar_datos";

export interface HistorialEntry {
  id: string;
  usuarioId: string;
  usuarioEmail: string;
  rol: Rol;
  accion: AccionHistorial;
  entidad: string;
  valorAnterior: string;
  valorNuevo: string;
  observacion: string;
  fecha: string;
  hora: string;
  dispositivo: string;
  ip: string;
}

export interface DashboardStats {
  totalProductos: number;
  totalContados: number;
  pendientes: number;
  porcentajeCompletado: number;
  conDiferencias: number;
  ultimaSincronizacion: string | null;
  coincidencias: number;
  diferenciasPositivas: number;
  diferenciasNegativas: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  rol: Rol;
  nombre: string;
  agencia: Agencia;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
