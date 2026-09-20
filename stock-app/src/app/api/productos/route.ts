import { NextRequest, NextResponse } from "next/server";
import { getProductos, crearProducto, getProductoPorCodigo, registrarHistorial } from "@/lib/sheets";
import { productoSchema } from "@/lib/validations";
import { esSuperAdmin } from "@/lib/permisos";
import { leerSesion } from "@/lib/sesion";
import type { Agencia } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const sesion = leerSesion(request);
    if (!sesion) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    /*
      Qué planta se puede pedir: cualquiera que esté dentro del alcance.

      Antes la condición era `rol === "administrador"`, y como un jefe de
      planta también es administrador, le alcanzaba con escribir
      ?agencia=Lascano para leer el catálogo de una planta que no es la suya.
      Mismo criterio que el GET de conteos: el alcance sale del perfil (el
      gerente y el super admin ven las nueve; un jefe, las que tenga
      asignadas; los demás, la suya). Si piden una que no les toca, se les
      devuelve la suya en vez de un error -- es un filtro, no un intento de
      intrusión.
    */
    const agenciaPedida = request.nextUrl.searchParams.get("agencia") as Agencia | null;
    const agenciaFiltro =
      agenciaPedida && sesion.alcance.includes(agenciaPedida)
        ? agenciaPedida
        : sesion.agencia ?? undefined;

    // Búsqueda puntual por código (usada por "Generar etiqueta" para
    // autocompletar descripción y ubicación) — devuelve un único producto
    // o null, en vez de la lista completa.
    const codigoBuscado = request.nextUrl.searchParams.get("codigo");
    if (codigoBuscado) {
      const producto = await getProductoPorCodigo(codigoBuscado, agenciaFiltro as Agencia);
      return NextResponse.json({ ok: true, data: producto });
    }

    const productos = await getProductos(agenciaFiltro);
    return NextResponse.json({ ok: true, data: productos });
  } catch (err) {
    console.error("Error al listar productos:", err);
    return NextResponse.json({ ok: false, error: "No se pudieron obtener los productos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const sesion = leerSesion(request);
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  /*
    Crear un producto a mano es gestionar el catálogo -- se pide esa
    capacidad, no "ser administrador". Hoy da el mismo resultado (jefe y
    gerente la tienen, el encargado no), pero nombrar la capacidad es lo
    que mantiene la coherencia con el resto de las rutas.
  */
  if (!sesion.capacidades.gestionarCatalogo) {
    return NextResponse.json({ ok: false, error: "Tu perfil no puede crear productos" }, { status: 403 });
  }
  const { id: userId, email } = sesion;

  try {
    const body = await request.json();
    if (!body.agencia && sesion.agencia) body.agencia = sesion.agencia;

    /*
      En qué planta se puede crear: solo dentro del alcance propio. El super
      admin puede en cualquiera; los demás quedan corregidos a una planta
      que efectivamente manejen, en vez de confiar en lo que mandó el
      cliente.
    */
    if (!esSuperAdmin(email)) {
      if (!body.agencia || !sesion.alcance.includes(body.agencia as Agencia)) {
        body.agencia = sesion.agencia;
      }
    }

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
      rol: sesion.rol,
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
