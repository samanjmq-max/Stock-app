"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getConteosPendientes,
  marcarConteosSincronizados,
  limpiarConteosSincronizados,
} from "@/db/offlineDb";

/** Cada cuánto se reintenta subir la cola cuando quedó algo pendiente. */
const INTERVALO_REINTENTO_MS = 2 * 60 * 1000;

/** Corta un fetch de sincronización colgado para no dejar el candado tomado. */
const TIMEOUT_SYNC_MS = 30 * 1000;

/*
  Candado a NIVEL MÓDULO, compartido por TODAS las instancias del hook.

  useSync se monta en más de un lugar a la vez (el Topbar vive siempre en el
  layout y la página de Conteo monta otra instancia). El ref `enCursoRef` es
  por instancia, así que no alcanza: dos instancias leen la MISMA cola de
  IndexedDB y suben el mismo lote -> conteos duplicados (sync-batch solo hace
  append). Esta variable de módulo se comparte entre instancias del mismo
  documento y cierra esa ventana.
*/
let sincronizacionGlobalEnCurso = false;

export function useSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);
  const [errorSync, setErrorSync] = useState<string | null>(null);

  // El intervalo de reintento se lee desde un ref para no recrear el efecto
  // de montaje cada vez que cambia el estado de sincronización.
  const sincronizarRef = useRef<(() => Promise<void>) | undefined>(undefined);
  // Candado SÍNCRONO. `sincronizando` es estado de React y puede leerse
  // desfasado si dos disparadores entran casi a la vez (guardar conteo + el
  // intervalo, o "online" + montaje): ambos verían `false` y subirían el
  // MISMO lote -> conteos duplicados en la planilla (sync-batch solo hace
  // append). Un ref se actualiza al instante y cierra esa ventana.
  const enCursoRef = useRef(false);

  const refrescarPendientes = useCallback(async () => {
    const pendientesActuales = await getConteosPendientes();
    setPendientes(pendientesActuales.length);
    return pendientesActuales;
  }, []);

  const sincronizarAhora = useCallback(async () => {
    // Doble candado: el global evita que dos instancias del hook suban el
    // mismo lote; el de instancia evita reentradas dentro de la misma.
    if (!navigator.onLine || enCursoRef.current || sincronizacionGlobalEnCurso) return;
    enCursoRef.current = true;
    sincronizacionGlobalEnCurso = true;
    setSincronizando(true);
    try {
      const pendientesActuales = await getConteosPendientes();
      if (pendientesActuales.length > 0) {
        // Timeout: sin esto, un fetch colgado (señal mala en el depósito) deja
        // el candado tomado hasta que el navegador corte por su cuenta,
        // bloqueando toda sincronización posterior.
        const controlador = new AbortController();
        const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_SYNC_MS);
        let res: Response;
        try {
          res = await fetch("/api/conteos/sync-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controlador.signal,
            body: JSON.stringify({
              conteos: pendientesActuales.map(({ localId, synced, createdAt, ...resto }) => resto),
            }),
          });
        } finally {
          clearTimeout(temporizador);
        }

        // El servidor puede devolver una página de error (HTML) en vez de
        // JSON si la función se cayó o expiró: sin este manejo, el .json()
        // explotaba y el error terminaba en el catch como algo ilegible.
        let json: { ok?: boolean; error?: string } = {};
        try {
          json = await res.json();
        } catch {
          json = { ok: false, error: `El servidor respondió de forma inesperada (HTTP ${res.status})` };
        }

        if (json.ok) {
          const ids = pendientesActuales.map((c) => c.localId!).filter(Boolean);
          await marcarConteosSincronizados(ids);
          setErrorSync(null);
        } else {
          /*
            Antes esto no hacía NADA: si el servidor rechazaba el lote, el
            conteo se quedaba en la cola para siempre y la app seguía
            mostrando "N por sincronizar" sin decir nunca por qué. Un conteo
            trabado es trabajo de inventario que no llegó a la planilla, así
            que el motivo tiene que estar a la vista.

            Importante: NO se borra nada de la cola local cuando falla. El
            conteo se conserva para reintentar; perderlo sería mucho peor
            que mostrar un aviso.
          */
          setErrorSync(json.error || "El servidor rechazó la sincronización");
        }
      } else {
        setErrorSync(null);
      }
      setUltimaSync(new Date());
      await refrescarPendientes();
    } catch (err) {
      console.error("Error al sincronizar:", err);
      setErrorSync(err instanceof Error ? err.message : "No se pudo conectar para sincronizar");
    } finally {
      enCursoRef.current = false;
      sincronizacionGlobalEnCurso = false;
      setSincronizando(false);
    }
  }, [refrescarPendientes]);

  sincronizarRef.current = sincronizarAhora;

  useEffect(() => {
    setIsOnline(navigator.onLine);

    // Al abrir la app, se limpian los conteos que ya fueron subidos al
    // servidor y quedaron acumulados localmente de sesiones anteriores —
    // eran los que hacían "reaparecer" datos ya borrados o editados.
    limpiarConteosSincronizados()
      .then((cantidad) => {
        if (cantidad > 0) {
          console.info(`Limpieza local: ${cantidad} conteos ya sincronizados eliminados del dispositivo.`);
        }
      })
      .catch((err) => console.error("Error al limpiar conteos locales:", err))
      .finally(async () => {
        const pendientesActuales = await refrescarPendientes();
        /*
          INTENTO DE SUBIDA AL ABRIR LA APP.

          Antes el único disparador automático era el evento "online", que
          solo ocurre cuando la conexión se cae y vuelve. Si abrías la app ya
          conectado con algo en la cola, no se intentaba subir nunca: el
          contador quedaba clavado en "1 por sincronizar" hasta que alguien
          tocara el botón de sincronizar a mano. Ese era el conteo que te
          quedaba trabado.
        */
        if (pendientesActuales.length > 0 && navigator.onLine) {
          sincronizarRef.current?.();
        }
      });

    function goOnline() {
      setIsOnline(true);
      sincronizarRef.current?.();
    }
    function goOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Reintento periódico mientras quede algo en la cola. Un operario que
    // contó sin señal y volvió al depósito no debería tener que acordarse
    // de tocar un botón para que su trabajo llegue a la planilla.
    const reintento = setInterval(async () => {
      if (!navigator.onLine) return;
      const pendientesActuales = await getConteosPendientes();
      if (pendientesActuales.length > 0) sincronizarRef.current?.();
    }, INTERVALO_REINTENTO_MS);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(reintento);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isOnline, pendientes, sincronizando, ultimaSync, errorSync, sincronizarAhora, refrescarPendientes };
}
