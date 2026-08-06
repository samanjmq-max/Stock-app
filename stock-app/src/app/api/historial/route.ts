import { NextRequest, NextResponse } from "next/server";
import { getHistorial, registrarHistorial } from "@/lib/sheets";
import type { AccionHistorial, Rol } from "@/types";

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

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";
  const rol = (request.headers.get("x-user-rol") || "operador") as Rol;

  try {
    const body = await request.json();
    const entrada = await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: body.accion as AccionHistorial,
      entidad: body.entidad,
      valorAnterior: body.valorAnterior,
      valorNuevo: body.valorNuevo,
      observacion: body.observacion,
      dispositivo: request.headers.get("user-agent") || "",
    });
    return NextResponse.json({ ok: true, data: entrada }, { status: 201 });
  } catch (err) {
    console.error("Error al registrar historial:", err);
    return NextResponse.json({ ok: false, error: "No se pudo registrar en el historial" }, { status: 500 });
  }
}
