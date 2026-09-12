/** @type {import('next').NextConfig} */

// SEC-05: el build de producción ya NO ignora errores de TypeScript/ESLint
// (antes: typescript.ignoreBuildErrors + eslint.ignoreDuringBuilds en true).
// Esas dos banderas dejaban pasar cualquier error a producción sin que
// nada lo bloqueara -- ausencia de red de seguridad de proceso, no una
// vulnerabilidad en sí, pero suficiente para que 16 errores de tipos
// preexistentes nunca se corrigieran. Ya están todos arreglados (ver
// commit de esta misma revisión de seguridad); si `next build` falla de
// acá en más, es una señal real que hay que atender, no ruido a ignorar.
const isDev = process.env.NODE_ENV !== "production";

function construirSecurityHeaders() {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        // SEC-03: 'unsafe-eval' solo en desarrollo -- lo pide el Fast
        // Refresh/HMR de Next, pero el bundle de producción no lo necesita.
        // Sacarlo en prod reduce la superficie de XSS sin romper nada real.
        // 'wasm-unsafe-eval' queda en los dos: lo necesita Tesseract.js
        // (OCR) para compilar WebAssembly -- no es lo mismo que 'unsafe-eval'
        // (ese es para eval()/Function() de JS) y hace falta en producción.
        // 'unsafe-inline' se mantiene en ambos: sacarlo de verdad requiere
        // reescribir a un esquema de CSP con nonces (styled-jsx, recharts y
        // framer-motion inyectan estilos/scripts inline) -- cambio más
        // grande, no se hizo en esta pasada para no romper el build a ciegas.
        `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""} https://cdn.jsdelivr.net`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://cdn.jsdelivr.net",
        "media-src 'self' blob:",
        "worker-src 'self' blob: https://cdn.jsdelivr.net",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    },
  ];
}

const nextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      source: "/:path*",
      headers: construirSecurityHeaders(),
    },
    {
      source: "/sw.js",
      headers: [
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
  ],
};

export default nextConfig;
