import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { importarProductos, registrarHistorial } from "@/lib/sheets";
import type { Rol } from "@/types";

const filaSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  ubicacion: z.string().optional().default(""),
  familia: z.string().optional().default(""),
  proveedor: z.string().optional().default(""),
  stockSap: z.coerce.number().min(0),
});

export async function POST(request: NextRequest) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";

  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede importar productos" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const filas = z.array(filaSchema).safeParse(body.productos);
    if (!filas.success) {
      return NextResponse.json({ ok: false, error: "El archivo tiene filas con columnas inválidas" }, { status: 400 });
    }
    if (filas.data.length === 0) {
      return NextResponse.json({ ok: false, error: "No hay productos válidos para importar" }, { status: 400 });
    }

    const resultado = await importarProductos(filas.data);

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "importar_productos",
      valorNuevo: `${resultado.importados} productos importados`,
    });

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al importar productos:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo importar" }, { status: 500 });
  }
}
