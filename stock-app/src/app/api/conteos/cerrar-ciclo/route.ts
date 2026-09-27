import { NextRequest, NextResponse } from "next/server";
import { cerrarCiclo, registrarHistorial } from "@/lib/sheets";
import { leerSesion } from "@/lib/sesion";
import type { Agencia } from "@/types";

/**
 * Cierra el cíclico de una agencia: el backend guarda el resumen mensual y
 * borra SOLO el detalle de esa agencia. El documento de detalle (Excel/PDF)
 * lo genera y descarga el navegador ANTES de llamar acá.
 *
 * Permiso: capacidad `cerrarCiclo` — hoy la tienen SOLO el Encargado de
 * Almacén y el súper administrador. Los demás perfiles visualizan.
 */
export async function POST(request: NextRequest) {
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (!sesion.capacidades.cerrarCiclo) {
    return NextResponse.json({ ok: false, error: "Tu perfil no puede cerrar el cíclico" }, { status: 403 });
  }

  const { id: userId, email, rol, nombre } = sesion;

  try {
    const body = await request.json().catch(() => ({}));
    const agencia = body.agencia as Agencia | undefined;
    const archivoGenerado = typeof body.archivoGenerado === "string" ? body.archivoGenerado : "";

    if (!agencia) {
      return NextResponse.json({ ok: false, error: "Falta la agencia a cerrar" }, { status: 400 });
    }
    // Solo se puede cerrar una planta dentro del alcance propio.
    if (!sesion.alcance.includes(agencia)) {
      return NextResponse.json({ ok: false, error: "No podés cerrar el cíclico de esa planta" }, { status: 403 });
    }

    const resultado = await cerrarCiclo({
      agencia,
      usuarioId: userId,
      usuarioEmail: email,
      usuarioNombre: nombre,
      archivoGenerado,
    });

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "cerrar_ciclo",
      entidad: `agencia:${agencia}`,
      valorNuevo: `${resultado.eliminados} conteos archivados y borrados (${agencia})${archivoGenerado ? ` — documento: ${archivoGenerado}` : ""}`,
    });

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al cerrar el cíclico:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo cerrar el cíclico" }, { status: 500 });
  }
}
