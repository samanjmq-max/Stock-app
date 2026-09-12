"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Registra el service worker y avisa cuando hay una versión nueva desplegada.
 *
 * Antes esto no existía: `sw.js` ya activaba la versión nueva en segundo
 * plano (skipWaiting + clients.claim), pero una pestaña o la PWA que ya
 * estaba abierta seguía corriendo el JS viejo cargado en memoria -- eso
 * explicaba por qué un cambio recién publicado en Vercel no se veía hasta
 * cerrar y volver a abrir la app a mano. Ahora, cuando el navegador detecta
 * un SW nuevo instalado, se muestra un toast con "Actualizar" en vez de
 * recargar solos (podría cortar un conteo sin guardar); al tocarlo se le
 * pide al SW nuevo que tome control (mensaje "SKIP_WAITING") y se recarga
 * apenas eso pasa (evento controllerchange).
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let recargando = false;
    function alCambiarControlador() {
      if (recargando) return;
      recargando = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", alCambiarControlador);

    function avisarNuevaVersion(worker: ServiceWorker) {
      toast("Hay una versión nueva de StockApp", {
        description: "Actualizá para ver los últimos cambios.",
        duration: Infinity,
        action: {
          label: "Actualizar",
          onClick: () => worker.postMessage("SKIP_WAITING"),
        },
      });
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registro) => {
        // Ya había una versión nueva instalada esperando de una visita anterior.
        if (registro.waiting && navigator.serviceWorker.controller) {
          avisarNuevaVersion(registro.waiting);
        }
        registro.addEventListener("updatefound", () => {
          const nuevo = registro.installing;
          if (!nuevo) return;
          nuevo.addEventListener("statechange", () => {
            // "installed" + ya hay un controller = es una actualización, no la
            // primera instalación (ahí no hay nada que avisar todavía).
            if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
              avisarNuevaVersion(nuevo);
            }
          });
        });
      })
      .catch((err) => {
        console.error("No se pudo registrar el service worker:", err);
      });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", alCambiarControlador);
  }, []);

  return null;
}
