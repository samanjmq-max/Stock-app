export const APP_CONFIG = {
  nombre: "StockApp",
  descripcion: "Sistema profesional de conteo de stock físico vs SAP",
  version: "1.0.0-etapa1",
} as const;

export const ROLES = {
  ADMINISTRADOR: "administrador",
  OPERADOR: "operador",
} as const;

export const ESTADOS_CONTEO = {
  COINCIDE: "coincide",
  SOBRA: "sobra",
  FALTA: "falta",
  NO_EXISTE: "no_existe",
} as const;

export const RUTAS = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  CONTEO: "/conteo",
  PRODUCTOS: "/productos",
  HISTORIAL: "/historial",
  USUARIOS: "/usuarios",
  CONFIGURACION: "/configuracion",
} as const;
