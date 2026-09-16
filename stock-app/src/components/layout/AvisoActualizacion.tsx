"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, ArrowUpCircle } from "lucide-react";

/*
  ============================================================================
  "Hay una versión nueva de StockApp"
  ============================================================================

  Por qué existe: StockApp es una PWA, y una PWA se guarda en el teléfono.
  El operario que la abrió el lunes puede seguir usando la pantalla del lunes
  el jueves, aunque el martes se haya corregido algo. Nadie se entera: ni él,
  que no ve el arreglo, ni quien lo publicó, que lo da por hecho. Peor todavía
  cuando el cambio es de los que tocan datos -- alguien importando stock con
  la versión vieja de la pantalla es un problema real, no una molestia visual.

  Cómo funciona: al montar, esta barra le pregunta al servidor qué versión
  está publicada y se la guarda como "la versión con la que arranqué". Después
  vuelve a preguntar cada tanto. Si la respuesta cambió, es que se publicó algo
  mientras esta pestaña estaba abierta, y ahí aparece la barra.

  Tres decisiones que valen la pena explicar:

  1. NO recarga sola. En el medio de un conteo, una recarga sorpresa es
     exactamente lo que hace que la gente desconfíe de un sistema. Avisa y
     deja apretar el botón.

  2. "Ahora no" la esconde 10 minutos, no para siempre. Es la diferencia
     entre respetar que alguien esté ocupado y dejar que la versión vieja
     viva para siempre porque se apretó una X sin leer.

  3. Al actualizar borra la caché del navegador y fuerza al service worker a
     buscar la versión nueva. Una recarga común, en una PWA, puede devolver
     la MISMA pantalla vieja desde la caché -- y entonces el botón miente.
     Los conteos pendientes no viven ahí (están en la base local del
     dispositivo), así que esto no pierde nada de trabajo.
*/

/** Cada cuánto se vuelve a preguntar. Suficiente para enterarse rápido sin ser un ping constante. */
const INTERVALO_MS = 3 * 60 * 1000;

/** Cuánto dura el "ahora no" antes de que la barra insista. */
const POSPONER_MS = 10 * 60 * 1000;

export function AvisoActualizacion() {
  const [hayVersionNueva, setHayVersionNueva] = useState(false);
  const [visible, setVisible] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  // La versión con la que arrancó ESTA pestaña. Va en un ref y no en estado
  // porque cambiarla no tiene que repintar nada: es el punto de comparación,
  // no algo que se muestre.
  const versionInicial = useRef<string | null>(null);

  const consultar = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return; // 401 por sesión vencida, servidor caído, etc.
      const json = await res.json();
      const version = typeof json?.version === "string" ? json.version : null;
      if (!version) return;

      if (versionInicial.current === null) {
        versionInicial.current = version;
        return;
      }

      if (version !== versionInicial.current) {
        setHayVersionNueva(true);
        setVisible(true);
      }
    } catch {
      // Sin internet en el depósito es lo normal, no un error que reportar.
    }
  }, []);

  useEffect(() => {
    consultar();
    const id = setInterval(consultar, INTERVALO_MS);

    // Volver a la app después de un rato es el mejor momento para enterarse:
    // es cuando la persona levanta la vista y todavía no empezó nada.
    const alVolver = () => {
      if (document.visibilityState === "visible") consultar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [consultar]);

  async function actualizarAhora() {
    setActualizando(true);
    try {
      if ("serviceWorker" in navigator) {
        const registros = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registros.map((r) => r.update().catch(() => undefined)));
      }
      if ("caches" in window) {
        const claves = await caches.keys();
        await Promise.all(claves.map((k) => caches.delete(k)));
      }
    } catch {
      // Si algo de esto falla, la recarga sigue siendo mejor que nada.
    }
    window.location.reload();
  }

  function posponer() {
    setVisible(false);
    setTimeout(() => setVisible(true), POSPONER_MS);
  }

  if (!hayVersionNueva || !visible) return null;

  return (
    /*
      Colores escritos a mano, no tokens del tema.

      Es la misma lección de la pantalla del tablero: esta barra tiene fondo
      propio y fijo, así que si el texto usara los tokens del tema se volvería
      invisible en modo día, que es cuando más se usa la app.
    */
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] px-3 pt-[env(safe-area-inset-top)]"
    >
      <div
        className="mx-auto mt-2 flex max-w-2xl flex-col gap-2 rounded-xl border p-3 shadow-lg sm:flex-row sm:items-center sm:gap-3"
        style={{ background: "#2a1a08", borderColor: "#7c4a12", color: "#fdf3e3" }}
      >
        <ArrowUpCircle size={20} className="shrink-0" style={{ color: "#f5a524" }} />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "#fdf3e3" }}>
            Hay una versión nueva de StockApp
          </p>
          <p className="text-xs" style={{ color: "#d9c3a4" }}>
            Actualizá para trabajar con la última versión. Los conteos que tengas sin subir no se pierden.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={posponer}
            disabled={actualizando}
            className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{ background: "transparent", color: "#d9c3a4", border: "1px solid #7c4a12" }}
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={actualizarAhora}
            disabled={actualizando}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
            style={{ background: "#f5a524", color: "#241504" }}
          >
            <RefreshCw size={13} className={actualizando ? "animate-spin" : undefined} />
            {actualizando ? "Actualizando..." : "Actualizar ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}
