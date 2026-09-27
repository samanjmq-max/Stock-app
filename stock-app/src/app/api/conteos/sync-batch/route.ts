import { NextRequest, NextResponse } from "next/server";
import { guardarConteosLote, registrarHistorial } from "@/lib/sheets";
import { leerSesion } from "@/lib/sesion";
import type { Agencia, Conteo } from "@/types";

export async function POST(request: NextRequest) {
  /*
    Se lee la sesión con la misma función blindada que el resto de las rutas,
    en vez de leer los headers a mano. Leer headers sueltos es justo el
    patrón que dejó sin control el borrado en lote en su momento -- acá se
    unifica para que no vuelva a pasar.
  */
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  if (!sesion.capacidades.contar) {
    return NextResponse.json({ ok: false, error: "Tu perfil no puede registrar conteos" }, { status: 403 });
  }
  const { id: userId, email, rol, agencia: agenciaPropia } = sesion;
  const puedeElegirAgencia = sesion.esSuperAdmin;

  try {
    const body = await request.json();
    let conteos = (body.conteos || []) as Omit<Conteo, "id" | "creadoEn" | "sincronizado">[];

    if (!Array.isArray(conteos) || conteos.length === 0) {
      return NextResponse.json({ ok: false, error: "No hay conteos para sincronizar" }, { status: 400 });
    }

    // Solo el super-admin puede sincronizar conteos etiquetados con una
    // agencia distinta de la propia (operar en nombre de otra planta, ej.
    // Lascano). Para cualquier otro usuario, se corrige a su propia agencia
    // en vez de confiar ciegamente en lo que mandó el cliente.
    if (!puedeElegirAgencia) {
      conteos = conteos.map((c) => (c.agencia === agenciaPropia ? c : { ...c, agencia: agenciaPropia }));
    }

    // PASO QUE CONFIRMA (commit): si esto sale bien, los conteos YA quedaron
    // guardados. Lo que venga después (auditoría) es best-effort y NO puede
    // hacer fallar la respuesta.
    const resultado = await guardarConteosLote(conteos);

    // Auditoría: una entrada de historial por cada conteo sincronizado, para
    // no perder trazabilidad. `allSettled`: si alguna de estas escrituras de
    // historial falla (timeout de Apps Script, etc.), NO se devuelve 500 —
    // porque el cliente reintentaría el lote y duplicaría conteos ya guardados
    // (guardarConteosLote solo hace append, no deduplica).
    const historial = await Promise.allSettled(
      conteos.map((c) =>
        registrarHistorial({
          usuarioId: userId,
          usuarioEmail: email,
          rol,
          accion: "guardar_conteo",
          entidad: `producto:${c.codigo}`,
          valorNuevo: `stockContado:${c.stockContado} (sincronizado offline)`,
          observacion: c.observaciones,
          dispositivo: request.headers.get("user-agent") || "",
        })
      )
    );
    const historialFallidos = historial.filter((h) => h.status === "rejected").length;
    if (historialFallidos > 0) {
      console.error(`sync-batch: ${historialFallidos}/${conteos.length} entradas de historial fallaron (los conteos SÍ se guardaron)`);
    }

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al sincronizar conteos en lote:", err);
    // Se reenvía el mensaje real (fetchGas/leerRespuestaGas dan diagnósticos
    // precisos), en vez de un genérico que deja al operario sin saber qué pasó.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "No se pudo sincronizar" },
      { status: 500 }
    );
  }
}
