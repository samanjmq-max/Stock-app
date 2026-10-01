import { NextResponse } from "next/server";
import { getHistorial } from "@/lib/sheets";

export async function GET() {
  try {
    const historial = await getHistorial();
    // Más reciente primero
    const ordenado = [...historial].sort(
      (a, b) => new Date(`${b.fecha} ${b.hora}`).getTime() - new Date(`${a.fecha} ${a.hora}`).getTime()
    );
    return NextResponse.json({ ok: true, data: ordenado });
  } catch (err) {
    console.error("Error al listar historial:", err);
    return NextResponse.json({ ok: false, error: "No se pudo obtener el historial" }, { status: 500 });
  }
}

/*
  No hay POST: el historial de auditoría se escribe SOLO desde el servidor
  (registrarHistorial dentro de cada ruta que hace la acción). Antes existía un
  POST que aceptaba accion/entidad arbitrarios del body sin validar -> cualquiera
  con permiso de ver el historial podía inyectar registros falsos en el log de
  auditoría. No se usaba desde el cliente, así que se eliminó.
*/
