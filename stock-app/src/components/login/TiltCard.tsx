"use client";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Envoltorio de inclinación 3D para el card de login.
 *
 * EXCEPCIÓN deliberada y acotada a esta pantalla — ver
 * design-system/stockapp-saman/pages/login.md ("Excepciones a MASTER.md").
 * El resto de la app sigue en motion=3 (subtle), sin efectos 3D.
 *
 * Desktop: sigue el mouse (rotateX/rotateY vía onMouseMove/onMouseLeave).
 * Mobile: sigue la orientación del teléfono (DeviceOrientationEvent,
 * beta/gamma relativos a una posición base, no valores absolutos).
 *
 * iOS 13+ exige pedir permiso con un gesto explícito del usuario
 * (DeviceOrientationEvent.requestPermission()) antes de poder leer
 * orientación — se resuelve con un botón discreto que solo aparece cuando
 * hace falta. Si el permiso no está disponible o se rechaza, el card
 * simplemente no se inclina: sin errores, sin popups feos.
 *
 * Respeta prefers-reduced-motion (framer-motion useReducedMotion): con esa
 * preferencia activada no se agrega ningún listener y el card queda
 * estático, mismo criterio que el resto del design-system.
 */

const MAX_TILT_DEG = 6;
const ORIENTATION_SENSITIVITY = 0.35;

interface DeviceOrientationEventIOS {
  requestPermission?: () => Promise<"granted" | "denied">;
}

export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const prefersReducedMotion = useReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const baselineRef = useRef<{ beta: number; gamma: number } | null>(null);
  const [needsIosPermission, setNeedsIosPermission] = useState(false);

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 150, damping: 18, mass: 0.5 });
  const springY = useSpring(rotateY, { stiffness: 150, damping: 18, mass: 0.5 });

  const handleOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return;
      // Primer evento: se toma como posición neutra ("cómo estás sosteniendo
      // el teléfono ahora"), el tilt se calcula relativo a eso, no al valor
      // absoluto del sensor (que sería un tilt constante y exagerado).
      if (!baselineRef.current) {
        baselineRef.current = { beta: event.beta, gamma: event.gamma };
        return;
      }
      const deltaBeta = event.beta - baselineRef.current.beta;
      const deltaGamma = event.gamma - baselineRef.current.gamma;
      rotateX.set(Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, -deltaBeta * ORIENTATION_SENSITIVITY)));
      rotateY.set(Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, deltaGamma * ORIENTATION_SENSITIVITY)));
    },
    [rotateX, rotateY]
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    const isDesktopPointer = window.matchMedia("(pointer: fine) and (hover: hover)").matches;
    if (isDesktopPointer) return; // en desktop el tilt lo maneja el mouse (JSX de abajo)

    const DOE = window.DeviceOrientationEvent as unknown as
      | (typeof DeviceOrientationEvent & DeviceOrientationEventIOS)
      | undefined;
    if (!DOE) return; // sin soporte de orientación -- el card queda estático, sin error

    if (typeof DOE.requestPermission === "function") {
      // iOS 13+: no se puede pedir sin gesto del usuario -- mostramos el botón discreto.
      setNeedsIosPermission(true);
      return;
    }
    // Android / navegadores sin el gate de iOS: no hace falta pedir permiso.
    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [prefersReducedMotion, handleOrientation]);

  async function requestIosPermission() {
    const DOE = window.DeviceOrientationEvent as unknown as DeviceOrientationEventIOS;
    try {
      const result = await DOE.requestPermission?.();
      if (result === "granted") {
        window.addEventListener("deviceorientation", handleOrientation);
      }
      // "denied" -- no hacemos nada más, el card queda sin inclinar.
    } catch {
      // Rechazado o no soportado -- sin efecto, sin error visible al usuario.
    } finally {
      setNeedsIosPermission(false);
    }
  }

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 .. 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * MAX_TILT_DEG * 2);
    rotateX.set(-py * MAX_TILT_DEG * 2);
  }

  function handleMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <div className="w-full" style={{ perspective: 1200 }}>
      <motion.div
        ref={wrapperRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX: springX, rotateY: springY, transformStyle: "preserve-3d" }}
        className={cn("w-full", className)}
      >
        {children}
      </motion.div>

      {needsIosPermission && (
        <button
          type="button"
          onClick={requestIosPermission}
          className="mt-3 flex items-center gap-1.5 mx-auto text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Activar efecto de inclinación con el movimiento del teléfono"
        >
          <Compass size={13} aria-hidden="true" />
          Activar inclinación
        </button>
      )}
    </div>
  );
}
