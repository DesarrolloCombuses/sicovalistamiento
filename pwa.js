/* Registro del Service Worker + manejo de actualizaciones + version visible.
 * Se ejecuta aparte de la logica de la app para que funcione aunque no haya internet.
 */
(function () {
  "use strict";

  function pintarVersion() {
    var el = document.getElementById("appVersion");
    if (el && window.APP_VERSION) el.textContent = "v" + window.APP_VERSION;
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pintarVersion);
  } else {
    pintarVersion();
  }

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      function vigilar(worker) {
        if (!worker) return;
        worker.addEventListener("statechange", function () {
          // Hay controller => es una ACTUALIZACION (no la primera instalacion).
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            mostrarBarraActualizacion(reg);
          }
        });
      }
      if (reg.waiting && navigator.serviceWorker.controller) {
        mostrarBarraActualizacion(reg);
      }
      reg.addEventListener("updatefound", function () { vigilar(reg.installing); });

      // Revisa si hay version nueva al abrir y cada 30 min.
      reg.update();
      setInterval(function () { reg.update(); }, 30 * 60 * 1000);
    }).catch(function (e) {
      console.warn("No se pudo registrar el Service Worker:", e);
    });

    var recargando = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (recargando) return;
      recargando = true;
      window.location.reload();
    });
  });

  function mostrarBarraActualizacion(reg) {
    if (document.getElementById("pwaUpdateBar")) return;
    var bar = document.createElement("div");
    bar.id = "pwaUpdateBar";
    bar.className = "pwa-update-bar";
    bar.innerHTML =
      '<span>Hay una version nueva disponible.</span>' +
      '<button type="button" id="pwaUpdateBtn" class="btn btn-sm btn-light">Actualizar</button>';
    document.body.appendChild(bar);
    document.getElementById("pwaUpdateBtn").addEventListener("click", function () {
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    });
  }
})();
