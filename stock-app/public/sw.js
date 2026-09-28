// IMPORTANTE: subir esta versión en cada deploy con cambios visibles. Al
// cambiar el texto, el navegador detecta un service worker nuevo, lo activa y
// el handler de `activate` borra las cachés viejas -> el celular deja de
// mostrar la versión anterior. (Antes quedó fija en "stockapp-v1" para
// siempre, por eso la PWA mostraba pantallas desactualizadas.)
const CACHE_VERSION = "stockapp-2026-09-27b";
const APP_SHELL = ["/dashboard", "/login", "/manifest.json", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  // OJO: NO llamar self.skipWaiting() acá. Si el SW nuevo se activa solo,
  // dispara controllerchange y el cliente (PwaRegister) recarga la pestaña de
  // sorpresa -- en medio de un conteo se pierde lo que se está tipeando. En su
  // lugar el SW queda en "waiting" y solo se activa cuando el usuario toca
  // "Actualizar" (que manda el mensaje SKIP_WAITING de abajo). Así la rama
  // registro.waiting del cliente funciona y el aviso aparece a tiempo.
});

// El registro (PwaRegister.tsx) manda esto cuando el usuario toca "Actualizar"
// en el aviso de nueva versión: recién ahí el SW nuevo toma el control y el
// cliente se recarga. Es el único punto donde se hace skipWaiting.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estrategia:
// - Peticiones a /api/*  -> network-first (los datos deben ser frescos;
//   la cola offline real de conteos se maneja en IndexedDB desde la Etapa 2).
// - Navegación y estáticos -> cache-first con actualización en segundo plano.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ ok: false, error: "Sin conexión" }), {
          headers: { "Content-Type": "application/json" },
          status: 503,
        })
      )
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("/offline.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
