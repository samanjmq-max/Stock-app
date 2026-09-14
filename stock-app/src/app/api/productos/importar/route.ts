import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { importarProductos, registrarHistorial } from "@/lib/sheets";
import { leerSesion } from "@/lib/sesion";
import type { Agencia } from "@/types";
import { AGENCIAS } from "@/types";

const filaSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  ubicacion: z.string().optional().default(""),
  familia: z.string().optional().default(""),
  proveedor: z.string().optional().default(""),
  stockSap: z.coerce.number().min(0),
  // Opcional igual que el precio: si la fila no la trae, el script deja la
  // que ya estaba cargada en vez de vaciarla.
  unidadMedida: z.string().optional(),
  // Opcional: si la fila no trae precio, no se pisa el que ya estaba
  // cargado en el producto (ver Productos.gs — importarProductos_).
  precioUnitario: z.coerce.number().min(0).optional(),
});

export async function POST(request: NextRequest) {
  /*
    PERMISO. Antes era `rol !== "administrador"`, o sea jefe de planta y
    gerente. Pero subir el archivo de SAP es el arranque del inventario
    cíclico, y el cíclico lo corre el encargado de almacén -- el jefe y el
    gerente miran los resultados. Por eso ahora pregunta por la capacidad
    `importarStock`, que es del encargado para arriba.

    Importar NO es gestionar el catálogo: dar de alta un artículo a mano,
    borrarlo o cambiarle el precio de a uno sigue pidiendo
    `gestionarCatalogo`, que el encargado no tiene.
  */
  const sesion = leerSesion(request);
  if (!sesion || !sesion.capacidades.importarStock) {
    return NextResponse.json({ ok: false, error: "No tenés permiso para importar stock" }, { status: 403 });
  }

  try {
    const body = await request.json();
    // La agencia es obligatoria en la importación — debe venir en el body.
    const agencia = body.agencia as Agencia | undefined;
    if (!agencia || !(AGENCIAS as readonly string[]).includes(agencia)) {
      return NextResponse.json({ ok: false, error: "Seleccioná una agencia válida para importar" }, { status: 400 });
    }

    /*
      SEC-01: no se puede importar a una planta que no sea la propia. El
      criterio es el mismo que en sync-batch y en POST /api/productos; lo
      que cambia es CONTRA QUÉ se compara.

      Antes se comparaba contra `x-user-agencia`, la planta principal. Eso
      dejaba afuera al jefe de planta a cargo de varias -- el de Tomás
      Gomensoro que también lleva Salto no podía importar a Salto, aunque
      la pantalla se la ofreciera. Ahora se compara contra el ALCANCE, que
      es la lista completa de plantas que esa persona maneja (y son las
      nueve para el gerente y el super admin).
    */
    if (!sesion.alcance.includes(agencia)) {
      return NextResponse.json(
        { ok: false, error: `No tenés ${agencia} a tu cargo, así que no podés importar productos ahí` },
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
      usuarioId: sesion.id,
      usuarioEmail: sesion.email,
      rol: sesion.rol,
      accion: "importar_productos",
      valorNuevo: `${resultado.importados} nuevos, ${resultado.actualizados} actualizados — agencia: ${agencia}`,
    });
    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al importar productos:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo importar" }, { status: 500 });
  }
}
