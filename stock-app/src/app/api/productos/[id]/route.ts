import { NextRequest, NextResponse } from "next/server";
import { actualizarProducto, eliminarProducto, registrarHistorial, getProductos } from "@/lib/sheets";
import { productoSchema } from "@/lib/validations";
import { leerSesion } from "@/lib/sesion";
import type { Agencia } from "@/types";

/*
  Ronda 2 — AISLAMIENTO ENTRE PLANTAS: además de la capacidad `gestionarCatalogo`,
  se verifica que el producto pertenezca a una planta del alcance del usuario. Sin
  esto, un jefe con varias plantas podía editar/borrar por id un producto de otra.
*/
async function productoEnAlcance(id: string, alcance: Agencia[]) {
  const todos = await getProductos();
  const p = todos.find((x) => String(x.id) === String(id));
  if (!p || !alcance.includes(p.agencia as Agencia)) return null;
  return p;
}

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

    if (!(await productoEnAlcance(id, sesion.alcance))) {
      return NextResponse.json({ ok: false, error: "Producto no encontrado o fuera de tu alcance" }, { status: 404 });
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

    if (!(await productoEnAlcance(id, sesion.alcance))) {
      return NextResponse.json({ ok: false, error: "Producto no encontrado o fuera de tu alcance" }, { status: 404 });
    }

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
