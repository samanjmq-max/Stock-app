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
  // Precio de una sola unidad, en pesos. Se calcula al importar como
  // (Valor libre util. ÷ Libre utilización) del export de SAP, o se puede
  // cargar directo si el Excel ya trae una columna de precio. Puede no
  // existir todavía para productos importados antes de tener esta función.
  precioUnitario?: number;
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
  | "exportar_datos"
  | "recuperar_password";

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
  // Importes en pesos — se calculan multiplicando cantidades por el
  // precioUnitario del producto (cuando existe; los productos sin precio
  // cargado no suman al importe, no rompen el cálculo).
  importePendientes: number;
  importeCoincidencias: number;
  importeDiferenciasPositivas: number;
  importeDiferenciasNegativas: number;
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
