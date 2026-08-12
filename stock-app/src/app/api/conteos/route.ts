import { NextRequest, NextResponse } from "next/server";
import { getConteos, guardarConteo, getProductoPorCodigo, registrarHistorial } from "@/lib/sheets";
import { conteoSchema } from "@/lib/validations";
import { calcularDiferencia, estadoDesdeDiferencia, formatFecha, formatHora } from "@/lib/utils";
import { leerHeaderTexto } from "@/lib/headers";
import type { Agencia } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const agencia = leerHeaderTexto(request, "x-user-agencia") as Agencia | null;
    const rol = leerHeaderTexto(request, "x-user-rol");
    // Admin puede ver todas las agencias o filtrar por una.
    // Operador solo ve la suya.
    const agenciaFiltro = rol === "administrador"
      ? (request.nextUrl.searchParams.get("agencia") as Agencia | null) ?? agencia ?? undefined
      : agencia ?? undefined;
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
