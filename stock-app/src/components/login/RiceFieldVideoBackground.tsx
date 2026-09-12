"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Decoración de fondo para /login — loop de video del campo de arroz.
 * Puramente presentacional (aria-hidden, pointer-events-none): no contiene
 * lógica de negocio ni de autenticación.
 *
 * El video no se muestra crudo: pasa por una gradación de cuatro capas que
 * lo lleva del verde plano de stock a una imagen tratada y cálida. La idea
 * es que el arrozal sea el protagonista de la pantalla, así que el
 * oscurecimiento general es suave -- la legibilidad del formulario la
 * resuelve su propio halo difuminado (.login-halo), que actúa solo donde
 * hace falta en vez de apagar la imagen entera.
 *
 * Respeta prefers-reduced-motion: si está activado, el <video> no se
 * reproduce y queda solo el poster estático como fondo — la gradación se
 * aplica igual, así que se ve igual de tratado, simplemente quieto.
 */
export function RiceFieldVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // El fondo entra con un fundido corto en vez de aparecer de golpe: sin
  // esto, el primer frame del video hace un salto de negro a verde que
  // arruina la secuencia de entrada de la tarjeta.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
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
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000 ease-out"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/*
        CAPA 1 — El video, graduado.
        contrast sube el punch, saturate baja el verde neón del material
        original, y brightness lo baja lo justo: el formulario ya no depende de un fondo
        muy oscuro porque tiene su propio halo difuminado detrás.
        Los tres valores son moderados a propósito: filtrar un video en
        reproducción cuesta trabajo de GPU en cada frame, y en un teléfono de
        depósito eso se paga en batería.
      */}
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        style={{ filter: "contrast(1.26) saturate(0.96) brightness(0.88)" }}
        src="/videos/campo-arroz-closeup.mp4"
        poster="/images/login-fallback.jpg"
        autoPlay={!reducedMotion}
        muted
        loop
        playsInline
        preload="auto"
      />

      {/*
        CAPA 2 — Tinte cálido en soft-light.
        Lleva los verdes hacia la temperatura tierra de la marca sin
        convertirlos en marrón: soft-light respeta las luces y las sombras
        del material, a diferencia de un overlay plano que lo ensucia todo.
      */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "hsl(24 75% 34%)", mixBlendMode: "soft-light", opacity: 0.4 }}
      />

      {/*
        CAPA 3 — Viñeta radial, muy suave: solo cierra las esquinas para que la
        imagen no corte en seco contra el borde. El oscurecimiento que hace
        legible el formulario es el halo local (.login-halo), no esta capa.

        El color va FIJO en el oscuro (20 25% 5%) y no en hsl(var(--background)):
        ese token en modo claro es casi blanco, así que la viñeta pintaba un
        velo blanco en todos los bordes de la imagen. El login siempre se ve
        oscuro, sin importar el tema de la app.
      */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 88% at 50% 46%, transparent 0%, hsl(20 25% 5% / 0.14) 70%, hsl(20 25% 5% / 0.5) 100%)",
        }}
      />

      {/*
        CAPA 4 — Base inferior. Ancla la imagen al suelo de la app en vez de
        cortarla en seco contra el borde de la pantalla.
      */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{ background: "linear-gradient(to top, hsl(20 25% 5% / 0.45), transparent)" }}
      />
    </div>
  );
}
