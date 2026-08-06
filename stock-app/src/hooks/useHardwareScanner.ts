"use client";

import { useEffect, useRef } from "react";

/**
 * La inmensa mayoría de los lectores de código de barras Bluetooth (y USB)
 * se comportan como un teclado (HID keyboard wedge): "tipean" cada
 * caracter del código muy rápido y terminan con Enter. No existe una
 * Web Bluetooth API estándar para "leer un código de barras" — por eso
 * la forma robusta de soportarlos es distinguir ese patrón de tipeo
 * (velocidad + Enter final) de lo que escribe una persona a mano.
 *
 * Umbral: si el tiempo entre teclas es menor a UMBRAL_MS, se considera
 * parte de una lectura de scanner. Si pasa más tiempo, se resetea el buffer.
 */
const UMBRAL_MS = 40;
const LARGO_MINIMO = 3;

export function useHardwareScanner(onScan: (codigo: string) => void, activo: boolean = true) {
  const bufferRef = useRef("");
  const ultimoTiempoRef = useRef(0);

  useEffect(() => {
    if (!activo) return;

    function handleKeyDown(e: KeyboardEvent) {
      const ahora = Date.now();
      const transcurrido = ahora - ultimoTiempoRef.current;
      ultimoTiempoRef.current = ahora;

      // Si pasó demasiado tiempo desde la última tecla, es tipeo humano: reiniciar buffer.
      if (transcurrido > UMBRAL_MS && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      if (e.key === "Enter") {
        if (bufferRef.current.length >= LARGO_MINIMO) {
          onScan(bufferRef.current);
        }
        bufferRef.current = "";
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, activo]);
}
