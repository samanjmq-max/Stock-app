import { NextRequest, NextResponse } from "next/server";
import { getConteos, guardarConteo, getProductoPorCodigo, registrarHistorial } from "@/lib/sheets";
import { conteoSchema } from "@/lib/validations";
import { calcularDiferencia, estadoDesdeDiferencia, formatFecha, formatHora } from "@/lib/utils";
import { leerHeaderTexto } from "@/lib/headers";
import { leerSesion } from "@/lib/sesion";
import type { Agencia } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const sesion = leerSesion(request);
    if (!sesion) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    /*
      Qué planta se puede pedir: cualquiera que esté dentro del alcance.

      Antes la condición era `rol === "administrador"`, y como un jefe de
      planta también es administrador, le alcanzaba con escribir
      ?agencia=Lascano en la barra de direcciones para leer los conteos de
      una planta que no es la suya. La interfaz nunca le ofrece ese selector,
      pero esconder el control no cierra la puerta: el que decide es el
      servidor, y el servidor no estaba mirando.

      Ahora el alcance sale del perfil: el gerente y el super admin ven las
      nueve plantas; un jefe, las que tenga asignadas; los demás, la suya. Si
      piden una que no les toca, se les devuelve la suya en vez de un error
      -- es un filtro, no un intento de intrusión, y romper la pantalla por
      un parámetro de más sería peor que ignorarlo.
    */
    const agenciaPedida = request.nextUrl.searchParams.get("agencia") as Agencia | null;
    const agenciaFiltro =
      agenciaPedida && sesion.alcance.includes(agenciaPedida)
        ? agenciaPedida
        : sesion.agencia ?? undefined;
    const conteos = await getConteos(agenciaFiltro);
    return NextResponse.json({ ok: true, data: conteos });
  } catch (err) {
    console.error("Error al listar conteos:", err);
    return NextResponse.json({ ok: false, error: "No se pudieron obtener los conteos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = leerHeaderTexto(request, "x-user-id") || "";
  const email = leerHeaderTexto(request, "x-user-email") || "";
  const rol = (leerHeaderTexto(request, "x-user-rol") || "operador") as "administrador" | "operador";
  const agencia = (leerHeaderTexto(request, "x-user-agencia") || "Centro Logístico") as Agencia;

  try {
    const body = await request.json();
    const parsed = conteoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }
    const { codigo, stockContado, observaciones, ubicacionNueva } = parsed.data;
    const producto = await getProductoPorCodigo(codigo, agencia);
    const now = new Date();
    const stockSap = producto?.stockSap ?? 0;
    const diferencia = calcularDiferencia(stockSap, stockContado);
    const estado = producto ? estadoDesdeDiferencia(diferencia) : "no_existe";
    const conteo = await guardarConteo({
      codigo,
      descripcion: producto?.descripcion || "(no existe en SAP)",
      ubicacion: producto?.ubicacion || "",
      stockSap,
      stockContado,
      diferencia,
      estado,
      observaciones: observaciones || "",
      ubicacionNueva: ubicacionNueva || "",
      agencia,
      usuarioId: userId,
      usuarioEmail: email,
      fecha: formatFecha(now),
      hora: formatHora(now),
    });
    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "guardar_conteo",
      entidad: `producto:${codigo}`,
      valorAnterior: producto ? `stockSap:${stockSap}` : "no existía",
      valorNuevo: `stockContado:${stockContado}`,
      observacion: observaciones,
      dispositivo: request.headers.get("user-agent") || "",
    });
    return NextResponse.json({ ok: true, data: conteo }, { status: 201 });
  } catch (err) {
    console.error("Error al guardar conteo:", err);
    return NextResponse.json({ ok: false, error: "No se pudo guardar el conteo" }, { status: 500 });
  }
}
