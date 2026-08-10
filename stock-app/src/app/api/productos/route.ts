import { NextRequest, NextResponse } from "next/server";
import { getProductos, crearProducto, getProductoPorCodigo, registrarHistorial } from "@/lib/sheets";
import { productoSchema } from "@/lib/validations";
import type { Agencia } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const agencia = request.headers.get("x-user-agencia") as Agencia | null;
    const rol = request.headers.get("x-user-rol");
    // Administrador puede pedir todas las agencias o filtrar por una específica.
    // Operador SIEMPRE ve solo su propia agencia.
    const agenciaFiltro = rol === "administrador"
      ? (request.nextUrl.searchParams.get("agencia") as Agencia | null) ?? agencia ?? undefined
      : agencia ?? undefined;

    const productos = await getProductos(agenciaFiltro);
    return NextResponse.json({ ok: true, data: productos });
  } catch (err) {
    console.error("Error al listar productos:", err);
    return NextResponse.json({ ok: false, error: "No se pudieron obtener los productos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rol = request.headers.get("x-user-rol");
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";
  const agenciaHeader = request.headers.get("x-user-agencia") as Agencia | null;

  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede crear productos" }, { status: 403 });
  }

  try {
    const body = await request.json();
    // Si el body no trae agencia explícita, usa la del usuario que hace la petición.
    if (!body.agencia && agenciaHeader) body.agencia = agenciaHeader;

    const parsed = productoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const existente = await getProductoPorCodigo(parsed.data.codigo, parsed.data.agencia as Agencia);
    if (existente) {
      return NextResponse.json({ ok: false, error: `Ya existe un producto con el código ${parsed.data.codigo} en ${parsed.data.agencia}` }, { status: 409 });
    }

    const producto = await crearProducto(parsed.data as any);

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol: "administrador",
      accion: "crear_producto",
      entidad: `producto:${producto.codigo}`,
      valorNuevo: JSON.stringify(producto),
    });

    return NextResponse.json({ ok: true, data: producto }, { status: 201 });
  } catch (err) {
    console.error("Error al crear producto:", err);
    return NextResponse.json({ ok: false, error: "No se pudo crear el producto" }, { status: 500 });
  }
}
