"use client";
import { useCallback, useEffect, useState } from "react";
import {
  getConteosPendientes,
  marcarConteosSincronizados,
  limpiarConteosSincronizados,
} from "@/db/offlineDb";

export function useSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);

  const refrescarPendientes = useCallback(async () => {
    const pendientesActuales = await getConteosPendientes();
    setPendientes(pendientesActuales.length);
    return pendientesActuales;
  }, []);

  const sincronizarAhora = useCallback(async () => {
    if (!navigator.onLine || sincronizando) return;
    setSincronizando(true);
    try {
      const pendientesActuales = await getConteosPendientes();
      if (pendientesActuales.length > 0) {
        const res = await fetch("/api/conteos/sync-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conteos: pendientesActuales.map(({ localId, synced, createdAt, ...resto }) => resto),
          }),
        });
        const json = await res.json();
        if (json.ok) {
          const ids = pendientesActuales.map((c) => c.localId!).filter(Boolean);
          await marcarConteosSincronizados(ids);
        }
      }
      setUltimaSync(new Date());
      await refrescarPendientes();
    } catch (err) {
      console.error("Error al sincronizar:", err);
    } finally {
      setSincronizando(false);
    }
  }, [sincronizando, refrescarPendientes]);

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
      .finally(() => {
        refrescarPendientes();
      });

    function goOnline() {
      setIsOnline(true);
      sincronizarAhora();
    }
    function goOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isOnline, pendientes, sincronizando, ultimaSync, sincronizarAhora, refrescarPendientes };
}
