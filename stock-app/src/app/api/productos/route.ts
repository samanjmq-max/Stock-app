import { NextRequest, NextResponse } from "next/server";
import { getProductos, crearProducto, getProductoPorCodigo, registrarHistorial } from "@/lib/sheets";
import { productoSchema } from "@/lib/validations";

export async function GET() {
  try {
    const productos = await getProductos();
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

  // Defensa en profundidad: el middleware ya filtra /api/usuarios,
  // pero /api/productos es de escritura mixta (lectura para todos,
  // escritura solo admin), así que el control de rol vive acá.
  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede crear productos" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = productoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const existente = await getProductoPorCodigo(parsed.data.codigo);
    if (existente) {
      return NextResponse.json({ ok: false, error: `Ya existe un producto con el código ${parsed.data.codigo}` }, { status: 409 });
    }

    const producto = await crearProducto(parsed.data);

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
