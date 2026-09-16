import { NextResponse } from "next/server";

/*
  ============================================================================
  Qué versión de StockApp está publicada ahora mismo
  ============================================================================

  El problema que resuelve: la app es una PWA. El navegador (y el celular,
  que la tiene "instalada") se queda con la versión que cargó la primera vez
  y puede seguir mostrándola durante días. Entonces se corrige algo, se
  publica, y los operarios siguen trabajando con la pantalla vieja sin que
  nadie se entere -- ni ellos, que no ven el arreglo, ni quien lo publicó,
  que cree que ya está en la calle.

  La solución no puede ser "avisales por WhatsApp que recarguen". Tiene que
  ser la app la que se dé cuenta sola. Para eso alcanza con que el servidor
  sepa decir en qué versión está, y que cada pestaña compare esa respuesta
  contra la versión con la que ella misma arrancó.

  VERCEL_GIT_COMMIT_SHA lo pone Vercel solo en cada publicación: no hay que
  acordarse de subir un número de versión a mano, que es exactamente el tipo
  de paso que se olvida justo el día que importa.
*/

// Tiene que leer variables de entorno en cada pedido, no quedar congelada
// en el build de una página estática.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_APP_VERSION ||
  "desarrollo";

export async function GET() {
  return NextResponse.json(
    { ok: true, version: VERSION },
    {
      headers: {
        // Sin esto el propio pedido que detecta versiones nuevas podría
        // venir de la caché, o sea contestar siempre la versión vieja: el
        // chiste se muerde la cola.
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}
