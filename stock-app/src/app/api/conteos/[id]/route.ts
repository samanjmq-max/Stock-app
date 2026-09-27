import { NextRequest, NextResponse } from "next/server";
import { editarConteo, eliminarConteo, registrarHistorial, getConteos, getProductoPorCodigo } from "@/lib/sheets";
import { leerSesion } from "@/lib/sesion";
import { calcularDiferencia, estadoDesdeDiferencia } from "@/lib/utils";
import type { Agencia } from "@/types";
import { z } from "zod";

/*
  Ronda 2 de seguridad:

  - AISLAMIENTO ENTRE PLANTAS: antes estas rutas por id chequeaban la capacidad
    pero NO que el conteo perteneciera a una planta del alcance del usuario. Un
    jefe con varias plantas podía editar/borrar por id un conteo de OTRA planta.
    Ahora se verifica que el conteo esté dentro de `sesion.alcance`.

  - EDITAR NO CONFÍA EN EL CLIENTE: la diferencia y el estado se RECALCULAN en el
    servidor a partir del stock SAP del producto (igual que al crear un conteo),
    en vez de aceptar los valores que mande el navegador — así no se puede
    guardar un conteo con una diferencia/estado inconsistentes.
*/

const editarConteoSchema = z.object({
  stockContado: z.coerce.number().min(0),
  observaciones: z.string().optional().default(""),
  ubicacionNueva: z.string().optional().default(""),
});

/** Devuelve el conteo si existe Y está dentro del alcance; si no, null. */
async function conteoEnAlcance(id: string, alcance: Agencia[]) {
  const todos = await getConteos();
  const c = todos.find((x) => String(x.id) === String(id));
  if (!c || !alcance.includes(c.agencia as Agencia)) return null;
  return c;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  const { rol, id: userId, email } = sesion;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = editarConteoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const objetivo = await conteoEnAlcance(id, sesion.alcance);
    if (!objetivo) {
      return NextResponse.json({ ok: false, error: "Conteo no encontrado o fuera de tu alcance" }, { status: 404 });
    }

    // Recalcular diferencia y estado en el SERVIDOR desde el stock SAP.
    const producto = await getProductoPorCodigo(objetivo.codigo, objetivo.agencia as Agencia);
    const stockSap = producto?.stockSap ?? 0;
    const diferencia = calcularDiferencia(stockSap, parsed.data.stockContado);
    const estado = producto ? estadoDesdeDiferencia(diferencia) : "no_existe";

    const conteo = await editarConteo(id, {
      stockContado: parsed.data.stockContado,
      diferencia,
      estado,
      observaciones: parsed.data.observaciones,
      ubicacionNueva: parsed.data.ubicacionNueva,
    });

    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "editar_conteo",
      entidad: `conteo:${id}`,
      valorNuevo: JSON.stringify({ stockContado: parsed.data.stockContado, diferencia, estado }),
      observacion: "Corrección de un conteo existente",
    });
    return NextResponse.json({ ok: true, data: conteo });
  } catch (err) {
    console.error("Error al editar conteo:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "No se pudo editar el conteo" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (!sesion.capacidades.borrarLineas) {
    return NextResponse.json({ ok: false, error: "Tu perfil no puede eliminar conteos" }, { status: 403 });
  }
  const { rol, id: userId, email } = sesion;

  try {
    const { id } = await params;
    const objetivo = await conteoEnAlcance(id, sesion.alcance);
    if (!objetivo) {
      return NextResponse.json({ ok: false, error: "Conteo no encontrado o fuera de tu alcance" }, { status: 404 });
    }

    const resultado = await eliminarConteo(id);
    await registrarHistorial({
      usuarioId: userId,
      usuarioEmail: email,
      rol,
      accion: "eliminar_conteo",
      entidad: `conteo:${id}`,
      observacion: "Eliminación de un conteo",
    });
    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al eliminar conteo:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "No se pudo eliminar el conteo" },
      { status: 500 }
    );
  }
}
