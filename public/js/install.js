// public/js/install.js – Instalación personalizada de la PWA (beforeinstallprompt)
(function () {
    'use strict';

    var deferredPrompt = null;
    var installBanner  = document.getElementById('install-banner');
    var installBtn     = document.getElementById('install-btn');
    var cerrarBtn      = document.getElementById('install-cerrar');

    if (!installBanner) { return; }

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();                           // evita el mini-infobar automático
        deferredPrompt = e;
        installBanner.classList.remove('oculto');     // solo se muestra si el navegador confirma que es instalable
    });

    installBtn.addEventListener('click', function () {
        if (!deferredPrompt) { return; }
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
            console.log('Instalación:', choice.outcome);   // accepted | dismissed
            deferredPrompt = null;
            installBanner.classList.add('oculto');
        });
    });

    cerrarBtn.addEventListener('click', function () {
        installBanner.classList.add('oculto');
    });

    window.addEventListener('appinstalled', function () {
        console.log('App instalada');
        deferredPrompt = null;
        installBanner.classList.add('oculto');
    });
})();
