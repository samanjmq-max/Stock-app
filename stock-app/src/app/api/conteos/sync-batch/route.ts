import { NextRequest, NextResponse } from "next/server";
import { guardarConteosLote, registrarHistorial } from "@/lib/sheets";
import { esSuperAdmin } from "@/lib/permisos";
import type { Agencia, Conteo, Rol } from "@/types";

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || "";
  const email = request.headers.get("x-user-email") || "";
  const rol = (request.headers.get("x-user-rol") || "operador") as Rol;
  const agenciaPropia = (request.headers.get("x-user-agencia") || "Centro Logístico") as Agencia;
  const puedeElegirAgencia = esSuperAdmin(email);

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

    const resultado = await guardarConteosLote(conteos);

    // Auditoría: una entrada de historial por cada conteo sincronizado,
    // para no perder trazabilidad de qué se contó offline.
    await Promise.all(
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

    return NextResponse.json({ ok: true, data: resultado });
  } catch (err) {
    console.error("Error al sincronizar conteos en lote:", err);
    return NextResponse.json({ ok: false, error: "No se pudo sincronizar" }, { status: 500 });
  }
}
