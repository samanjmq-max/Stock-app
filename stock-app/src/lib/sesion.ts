import type { NextRequest } from "next/server";
import { capacidadesDe, alcanceDe, perfilDe, type Capacidades } from "@/lib/permisos";
import type { Agencia, Perfil, Rol } from "@/types";

/*
  Lee de una vez quién es el que está llamando a una ruta de API.

  El middleware ya verificó el token y dejó todo en cabeceras; acá solo se
  arma el objeto. Estaba repetido a mano en cada ruta -- seis líneas de
  request.headers.get() por archivo -- y esa repetición es justamente cómo
  se escapan los controles: la ruta de borrado en lote se había quedado sin
  verificar el rol porque cada archivo lo resolvía por su cuenta.
*/

export interface Sesion {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  perfil: Perfil;
  agencia: Agencia;
  /** Lista separada por barra, tal como se guarda en la planilla. */
  agencias: string;
  esSuperAdmin: boolean;
  capacidades: Capacidades;
  /** Todas las plantas que este usuario puede ver, ya resueltas. */
  alcance: Agencia[];
}

function decodificar(valor: string | null): string {
  if (!valor) return "";
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

export function leerSesion(request: NextRequest): Sesion | null {
  const h = request.headers;
  const id = h.get("x-user-id");
  const email = h.get("x-user-email");
  const rol = h.get("x-user-rol") as Rol | null;
  if (!id || !email || !rol) return null;

  const agencia = (decodificar(h.get("x-user-agencia")) || "Centro Logístico") as Agencia;
  const agencias = decodificar(h.get("x-user-agencias"));
  const base = {
    email,
    rol,
    perfil: h.get("x-user-perfil"),
    agencia,
    agencias,
  };

  return {
    id,
    email,
    nombre: decodificar(h.get("x-user-nombre")),
    rol,
    perfil: perfilDe(base),
    agencia,
    agencias,
    esSuperAdmin: h.get("x-user-es-super-admin") === "1",
    capacidades: capacidadesDe(base),
    alcance: alcanceDe(base),
  };
}
