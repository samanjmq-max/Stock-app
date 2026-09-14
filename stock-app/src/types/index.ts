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

/*
  Perfil de usuario. Es el control FINO de permisos; `rol` sigue siendo el
  grueso (a qué pantallas se entra) y se deriva del perfil, nunca se carga a
  mano. Ver src/lib/permisos.ts para la tabla completa de capacidades.

  Los usuarios cargados antes de que esto existiera no tienen perfil: se
  deduce del rol, así que nadie cambia de permisos al salir a producción.
*/
export type Perfil = "operario" | "encargado" | "jefe" | "gerente";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  /** Perfil de permisos. Opcional: los usuarios viejos no lo tienen y se deduce del rol. */
  perfil?: Perfil;
  /** Planta principal. Es la que se usa por defecto al contar. */
  agencia: Agencia;
  /**
   * Todas las plantas a cargo, separadas por barra ("Tres Gomensoro|Salto").
   * Es texto y no una lista porque vive en una sola celda de la planilla.
   * Vacío = vale `agencia` sola. Un jefe de planta puede tener varias; a
   * veces la misma persona está a cargo de dos o tres depósitos.
   */
  agencias?: string;
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
  | "editar_conteo"
  | "eliminar_conteo"
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
  importeContados: number;
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
  /** Opcional: un token emitido antes de que existieran los perfiles no lo trae. */
  perfil?: Perfil;
  /** Lista separada por barra, igual que en la planilla. */
  agencias?: string;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
