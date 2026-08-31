/* Service Worker - Alistamiento Diario (PWA)
 * Cachea SOLO el shell estatico (mismo origen) + las librerias CDN.
 * NUNCA cachea datos en vivo: Supabase, Google CSV ni los envios a SICOV.
 * Subir VERSION en cada despliegue: eso dispara la actualizacion en los equipos.
 */
const VERSION = "1.4.0";
const CACHE = "sicov-shell-" + VERSION;

// Shell propio (mismo origen). Rutas relativas para que sirva tambien en subcarpetas.
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./version.js",
  "./config.js",
  "./app.js",
  "./pwa.js",
  "./manifest.json",
  "./assets/logo-combuses.webp",
  "./assets/favicon-combuses.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

// Librerias externas (versionadas e inmutables). Best-effort: si el CDN falla, no rompe la instalacion.
const CDN = [
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).then(function () {
        return Promise.allSettled(CDN.map(function (u) {
          return cache.add(new Request(u, { mode: "no-cors" }));
        }));
      });
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== CACHE && k.indexOf("sicov-shell-") === 0;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// La pagina pide activar la version nueva de inmediato.
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", function (event) {
  const req = event.request;

  // Nunca interceptar escrituras (envios a SICOV, inserts a Supabase, etc.).
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const mismoOrigen = url.origin === self.location.origin;
  const esCdn = url.hostname === "cdn.jsdelivr.net";

  // Datos en vivo (Supabase REST, funciones, Google CSV) van SIEMPRE a la red, sin cache.
  if (!mismoOrigen && !esCdn) return;

  event.respondWith(
    caches.match(req).then(function (cacheado) {
      if (cacheado) {
        // Shell propio: refresca en segundo plano (stale-while-revalidate).
        if (mismoOrigen) {
          fetch(req).then(function (res) {
            if (res && res.ok) {
              caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
            }
          }).catch(function () {});
        }
        return cacheado;
      }
      return fetch(req).then(function (res) {
        if (res && (res.ok || res.type === "opaque")) {
          const copia = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copia); });
        }
        return res;
      }).catch(function () {
        if (req.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
