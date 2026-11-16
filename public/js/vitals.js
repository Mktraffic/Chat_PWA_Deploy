// public/js/vitals.js – Mini sistema RUM (LCP, INP, CLS) → consola + IndexedDB
(function () {
    'use strict';

    var DB_NAME = 'rum-db';
    var STORE   = 'metricas';

    // Si la librería no cargó (p. ej. sin conexión y sin caché), no rompemos la app
    if (!window.webVitals) {
        console.warn('[RUM] web-vitals no está disponible; monitoreo desactivado');
        return;
    }

    function abrirDB() {
        return new Promise(function (resolve, reject) {
            var req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function () {
                req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror   = function () { reject(req.error); };
        });
    }

    function guardar(metric) {
        var registro = {
            nombre: metric.name,          // LCP | INP | CLS
            valor: metric.value,
            rating: metric.rating,        // good | needs-improvement | poor
            navegacion: metric.navigationType,
            url: location.pathname,
            fecha: new Date().toISOString()
        };

        console.log('[RUM]', registro.nombre, registro.valor, registro.rating);

        abrirDB().then(function (db) {
            var tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).add(registro);
            tx.oncomplete = function () { db.close(); };
        }).catch(function (e) { console.warn('RUM: no se pudo guardar', e); });
    }

    // reportAllChanges para ver valores mientras el usuario interactúa (útil para la demo)
    webVitals.onLCP(guardar, { reportAllChanges: true });
    webVitals.onINP(guardar, { reportAllChanges: true });
    webVitals.onCLS(guardar, { reportAllChanges: true });
})();
