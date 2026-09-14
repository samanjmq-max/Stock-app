import { AGENCIAS, type Agencia, type Perfil, type Rol } from "@/types";

/**
 * Define quién es el "usuario madre" (super administrador) del sistema.
 * Sale de una variable de entorno, no de la planilla: es la garantía de que
 * nadie pueda auto-asignarse control total desde la pantalla de usuarios.
 */
export function esSuperAdmin(email: string | null): boolean {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!superAdminEmail || !email) return false;
  return email.toLowerCase().trim() === superAdminEmail.toLowerCase().trim();
}

/*
  ============================================================================
  Perfiles
  ============================================================================

  Antes había dos roles ("administrador" / "operador") y el super admin, que
  salía de una variable de entorno. Eso alcanzaba mientras todos los que
  entraban eran de una sola planta y hacían de todo o casi nada. No alcanza
  para un encargado que borra líneas pero no maneja el catálogo, ni para un
  jefe que está a cargo de dos plantas, ni para un gerente que mira las nueve.

  `rol` NO desaparece: se sigue guardando y se deriva del perfil. Es el
  control grueso -- a qué pantallas se entra -- y lo usan el middleware y
  varias rutas. El perfil es el control fino: qué se puede hacer una vez
  adentro. Mantener los dos es lo que permite agregar esto sin reescribir
  cada verificación que ya existía y funciona.
*/

export interface Capacidades {
  /** Registrar conteos nuevos y corregir los existentes. */
  contar: boolean;
  /** Borrar conteos, de a uno o en lote. NO incluye vaciar el inventario. */
  borrarLineas: boolean;
  /** Alta, baja y edición de usuarios. El alcance lo pone `alcanceDe`. */
  gestionarUsuarios: boolean;
  /** Importar productos, editarlos, borrarlos, tocar precios. */
  gestionarCatalogo: boolean;
  /** Ver el historial de auditoría. */
  verHistorial: boolean;
  /**
   * Generar e imprimir etiquetas de código de barras.
   *
   * Hoy la tienen los CUATRO perfiles, a pedido: imprimir una etiqueta para
   * un artículo sin código legible es parte de contar, no un privilegio. La
   * bandera se mantiene igual de que existe -- si algún día hay que
   * restringirla, es una palabra por perfil y no hay que tocar nada más.
   */
  etiquetas: boolean;
  /** Ve todas las plantas, sin importar cuáles tenga asignadas. */
  todasLasPlantas: boolean;
}

/**
 * Vaciar el inventario -- una planta entera o las nueve -- NO es una
 * capacidad de perfil: es exclusiva del super administrador, incluso por
 * encima del gerente. Por eso no está en `Capacidades` y tiene su propia
 * función: para que no haya forma de activarla desde la planilla.
 */
export function puedeVaciarInventario(email: string | null): boolean {
  return esSuperAdmin(email);
}

export const PERFILES: Record<Perfil, { etiqueta: string; descripcion: string; capacidades: Capacidades }> = {
  operario: {
    etiqueta: "Operario",
    descripcion: "Cuenta, corrige e imprime etiquetas. No borra nada y solo ve su planta.",
    capacidades: {
      contar: true,
      borrarLineas: false,
      gestionarUsuarios: false,
      gestionarCatalogo: false,
      verHistorial: false,
      etiquetas: true,
      todasLasPlantas: false,
    },
  },
  encargado: {
    etiqueta: "Encargado de Almacén",
    descripcion: "Cuenta, corrige, borra líneas de conteo e imprime etiquetas. Solo su planta.",
    capacidades: {
      contar: true,
      borrarLineas: true,
      gestionarUsuarios: false,
      gestionarCatalogo: false,
      verHistorial: false,
      etiquetas: true,
      todasLasPlantas: false,
    },
  },
  jefe: {
    etiqueta: "Jefe de Planta",
    descripcion:
      "Todo lo operativo más catálogo, etiquetas e historial. Da de alta y baja operarios y encargados. Puede tener varias plantas a cargo.",
    capacidades: {
      contar: true,
      borrarLineas: true,
      gestionarUsuarios: true,
      gestionarCatalogo: true,
      verHistorial: true,
      etiquetas: true,
      todasLasPlantas: false,
    },
  },
  gerente: {
    etiqueta: "Gerente",
    descripcion: "Todos los permisos sobre todas las plantas. No puede vaciar el inventario.",
    capacidades: {
      contar: true,
      borrarLineas: true,
      gestionarUsuarios: true,
      gestionarCatalogo: true,
      verHistorial: true,
      etiquetas: true,
      todasLasPlantas: true,
    },
  },
};

/** Orden de menor a mayor alcance. Un perfil solo puede crear perfiles por debajo del suyo. */
export const ESCALA_PERFILES: Perfil[] = ["operario", "encargado", "jefe", "gerente"];

/**
 * El rol que le corresponde a cada perfil. `rol` sigue siendo el control
 * grueso (a qué pantallas se entra) y se guarda derivado, nunca a mano, para
 * que no pueda quedar desalineado con el perfil.
 */
export function rolDePerfil(perfil: Perfil): Rol {
  return perfil === "jefe" || perfil === "gerente" ? "administrador" : "operador";
}

/**
 * Perfil efectivo de alguien que ya está en el sistema.
 *
 * Los usuarios cargados antes de esta función no tienen la columna `perfil`,
 * así que se deduce del rol que sí tienen: administrador -> jefe de planta,
 * operador -> operario. Con eso, nadie cambia de permisos el día que esto
 * sale a producción: cada uno sigue pudiendo exactamente lo que podía ayer.
 */
export function perfilDe(u: { perfil?: string | null; rol?: Rol | null }): Perfil {
  const declarado = String(u.perfil || "").trim().toLowerCase();
  if ((ESCALA_PERFILES as string[]).includes(declarado)) return declarado as Perfil;
  return u.rol === "administrador" ? "jefe" : "operario";
}

/**
 * Capacidades efectivas. El super admin tiene todas, sin importar qué diga
 * su fila en la planilla -- es el candado de última instancia.
 */
export function capacidadesDe(u: { perfil?: string | null; rol?: Rol | null; email?: string | null }): Capacidades {
  if (esSuperAdmin(u.email ?? null)) {
    return {
      contar: true,
      borrarLineas: true,
      gestionarUsuarios: true,
      gestionarCatalogo: true,
      verHistorial: true,
      etiquetas: true,
      todasLasPlantas: true,
    };
  }
  return PERFILES[perfilDe(u)].capacidades;
}

/* -------------------------------------------------------------------------
   Alcance por planta
   ------------------------------------------------------------------------- */

/**
 * La lista de plantas de un usuario, tal como está guardada.
 *
 * Se guarda como texto separado por barras en una sola celda
 * ("Tres Gomensoro|Salto") porque una celda no puede tener una lista de
 * verdad. Si viene vacía -- que es el caso de todos los usuarios que ya
 * existen -- vale su agencia de siempre, así que nadie se queda sin plantas.
 */
export function parsearAgencias(texto: string | null | undefined, agenciaBase: Agencia | null): Agencia[] {
  const lista = String(texto || "")
    .split("|")
    .map((a) => a.trim())
    .filter(Boolean)
    .filter((a): a is Agencia => (AGENCIAS as readonly string[]).includes(a));

  if (lista.length > 0) {
    // Sin repetidos, conservando el orden en que se cargaron.
    return Array.from(new Set(lista));
  }
  return agenciaBase ? [agenciaBase] : [];
}

/** El formato inverso: de lista a celda. */
export function serializarAgencias(agencias: Agencia[]): string {
  return Array.from(new Set(agencias)).join("|");
}

/**
 * Qué plantas ve este usuario. Un gerente o el super admin ven las nueve;
 * el resto, las que tenga asignadas.
 */
export function alcanceDe(u: {
  perfil?: string | null;
  rol?: Rol | null;
  email?: string | null;
  agencia?: Agencia | null;
  agencias?: string | Agencia[] | null;
}): Agencia[] {
  if (capacidadesDe(u).todasLasPlantas) return [...AGENCIAS];
  const crudas = Array.isArray(u.agencias) ? u.agencias.join("|") : u.agencias;
  return parsearAgencias(crudas, u.agencia ?? null);
}

/** ¿Puede ver los datos de esta planta? */
export function puedeVerAgencia(
  u: Parameters<typeof alcanceDe>[0],
  agencia: Agencia | null | undefined
): boolean {
  if (!agencia) return false;
  return alcanceDe(u).includes(agencia);
}

/* -------------------------------------------------------------------------
   Quién puede crear a quién
   ------------------------------------------------------------------------- */

/**
 * Perfiles que este usuario puede dar de alta.
 *
 * Un jefe de planta maneja su propia gente -- operarios y encargados -- pero
 * no puede fabricar otro jefe ni un gerente: si pudiera, le alcanzaría con
 * crearse un usuario nuevo para darse a sí mismo todas las plantas. Un
 * gerente sí puede crear jefes. Nadie puede crear un gerente salvo el super
 * admin, y el super admin no se crea desde ninguna pantalla: sale de la
 * variable de entorno.
 */
export function perfilesQuePuedeCrear(u: Parameters<typeof capacidadesDe>[0]): Perfil[] {
  if (!capacidadesDe(u).gestionarUsuarios) return [];
  if (esSuperAdmin(u.email ?? null)) return [...ESCALA_PERFILES];
  const propio = perfilDe(u);
  if (propio === "gerente") return ["operario", "encargado", "jefe"];
  if (propio === "jefe") return ["operario", "encargado"];
  return [];
}

/**
 * ¿Puede tocar (crear, editar, borrar) a este otro usuario?
 *
 * Tres condiciones, todas necesarias: tiene la capacidad, el perfil del otro
 * está por debajo del suyo, y TODAS las plantas del otro caen dentro de su
 * alcance. Lo último es lo que evita que un jefe de dos plantas le asigne a
 * un operario una tercera que él no maneja.
 */
export function puedeGestionarA(
  actor: Parameters<typeof alcanceDe>[0],
  objetivo: { perfil?: string | null; rol?: Rol | null; agencia?: Agencia | null; agencias?: string | Agencia[] | null }
): boolean {
  if (!capacidadesDe(actor).gestionarUsuarios) return false;
  if (esSuperAdmin(actor.email ?? null)) return true;

  const permitidos = perfilesQuePuedeCrear(actor);
  if (!permitidos.includes(perfilDe(objetivo))) return false;

  const mias = alcanceDe(actor);
  const suyas = alcanceDe({ ...objetivo, email: null });
  if (suyas.length === 0) return false;
  return suyas.every((a) => mias.includes(a));
}
