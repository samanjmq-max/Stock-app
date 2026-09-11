"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Decoración de fondo para /login — loop de video del campo de arroz.
 * Puramente presentacional (aria-hidden, pointer-events-none): no contiene
 * lógica de negocio ni de autenticación.
 *
 * Respeta prefers-reduced-motion: si está activado, el <video> no se
 * reproduce (se pausa/no arranca) y queda solo el poster estático como
 * fondo — mismo criterio que el resto del design-system (ver globals.css).
 */
export function RiceFieldVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reducedMotion) {
      video.pause();
      return;
    }

    // Bug conocido de React/DOM: el atributo JSX `muted` no siempre llega a
    // setear la PROPIEDAD `.muted` del elemento a tiempo para que el
    // navegador autorice autoplay sin gesto del usuario (el navegador chequea
    // la propiedad real al momento del play(), no el atributo). Lo forzamos
    // explícito acá para no depender de esa carrera.
    video.muted = true;
    video.defaultMuted = true;

    const tryPlay = () => {
      video.play().catch((err) => {
        // No es crítico -- el poster queda visible como fallback -- pero
        // logueamos para poder diagnosticar bloqueos de autoplay reales
        // en vez de fallar en silencio.
        console.warn("[RiceFieldVideoBackground] autoplay bloqueado:", err);
      });
    };

    // Si todavía no hay suficientes datos cargados, el play() puede fallar
    // por eso (no por policy) -- reintentamos apenas el video avise que ya
    // tiene el primer frame disponible.
    if (video.readyState >= 2) {
      tryPlay();
      return;
    }
    video.addEventListener("loadeddata", tryPlay, { once: true });
    return () => video.removeEventListener("loadeddata", tryPlay);
  }, [reducedMotion]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        src="/videos/campo-arroz-closeup.mp4"
        poster="/images/login-fallback.jpg"
        autoPlay={!reducedMotion}
        muted
        loop
        playsInline
        preload="auto"
      />
      {/*
        Viñeta radial en vez de franja horizontal: el título + card quedan
        centrados en pantalla, así que un degradado de arriba-abajo tapaba
        el video tanto en el centro (donde no hace falta) como en los bordes
        (donde sí queremos que se note). Centro transparente, tiñe solo hacia
        bordes/esquinas -- ahora a la mitad de intensidad (~28% máximo, antes
        55%) para que se vean los colores del video, no lavados. El card
        (glassmorphism) es el que aporta legibilidad al centro, no esta capa.
      */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 50% 50%, transparent 0%, hsl(var(--background) / 0.28) 100%)",
        }}
      />
    </div>
  );
}
