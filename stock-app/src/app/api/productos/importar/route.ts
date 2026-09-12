import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { importarProductos, registrarHistorial } from "@/lib/sheets";
import { esSuperAdmin } from "@/lib/permisos";
import type { Rol, Agencia } from "@/types";
import { AGENCIAS } from "@/types";

const filaSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  ubicacion: z.string().optional().default(""),
  familia: z.string().optional().default(""),
  proveedor: z.string().optional().default(""),
  stockSap: z.coerce.number().min(0),
  // Opcional: si la fila no trae precio, no se pisa el que ya estaba
  // cargado en el producto (ver Productos.gs — importarProductos_).
  precioUnitario: z.coerce.number().min(0).optional(),
});

export async function POST(request: NextRequest) {
  const rol = request.headers.get("x-user-rol") as Rol | null;
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";
  const agenciaPropia = request.headers.get("x-user-agencia") as Agencia | null;
  if (rol !== "administrador") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede importar productos" }, { status: 403 });
  }
  try {
    const body = await request.json();
    // La agencia es obligatoria en la importación — debe venir en el body.
    const agencia = body.agencia as Agencia | undefined;
    if (!agencia || !(AGENCIAS as readonly string[]).includes(agencia)) {
      return NextResponse.json({ ok: false, error: "Seleccioná una agencia válida para importar" }, { status: 400 });
    }
    // SEC-01: solo el super-admin puede importar en una agencia distinta de
    // la propia (operar en nombre de otra planta) -- mismo criterio ya
    // aplicado en sync-batch y POST /api/productos. Sin esto, cualquier
    // administrador de planta podía sobrescribir en lote el catálogo de
    // OTRA agencia con solo cambiar el campo `agencia` del body.
    if (agenciaPropia && agencia !== agenciaPropia && !esSuperAdmin(email)) {
      return NextResponse.json(
        { ok: false, error: "Solo podés importar productos a tu propia agencia" },
        { status: 403 }
      );
    }
    const filas = z.array(filaSchema).safeParse(body.productos);
    if (!filas.success) {
      return NextResponse.json({ ok: false, error: "El archivo tiene filas con columnas inválidas" }, { status: 400 });
    }
    if (filas.data.length === 0) {
      return NextResponse.json({ ok: false, error: "No hay productos válidos para importar" }, { status: 400 });
    }
    const resultado = await importarProductos(filas.data as any, agencia);
    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "importar_productos",
      valorNuevo: `${resultado.importados} nuevos, ${resultado.actualizados} actualizados — agencia: ${agencia}`,
    });
    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al importar productos:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo importar" }, { status: 500 });
  }
}
