import { NextRequest, NextResponse } from "next/server";
import { actualizarProducto, eliminarProducto, registrarHistorial } from "@/lib/sheets";
import { productoSchema } from "@/lib/validations";
import { leerSesion } from "@/lib/sesion";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = leerSesion(request);

  if (!sesion?.capacidades.gestionarCatalogo) {
    return NextResponse.json({ ok: false, error: "Tu perfil no puede editar productos" }, { status: 403 });
  }
  const { rol, id: userId, email } = sesion;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = productoSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const producto = await actualizarProducto(id, parsed.data);

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "editar_producto",
      entidad: `producto:${producto.codigo}`,
      valorNuevo: JSON.stringify(parsed.data),
    });

    return NextResponse.json({ ok: true, data: producto });
  } catch (err) {
    console.error("Error al editar producto:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo editar" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = leerSesion(request);

  if (!sesion?.capacidades.gestionarCatalogo) {
    return NextResponse.json({ ok: false, error: "Tu perfil no puede eliminar productos" }, { status: 403 });
  }
  const { rol, id: userId, email } = sesion;

  try {
    const { id } = await params;
    const resultado = await eliminarProducto(id);

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "eliminar_producto",
      entidad: `producto:${id}`,
    });

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al eliminar producto:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo eliminar" }, { status: 500 });
  }
}
