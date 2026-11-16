
var url = window.location.href;
var swLocation = '/sw.js';

var swReg;

if ( navigator.serviceWorker ) {


    if ( url.includes('localhost') ) {
        swLocation = '/sw.js';
    }


    window.addEventListener('load', function() {

        navigator.serviceWorker.register( swLocation ).then( function(reg){

            swReg = reg;
            swReg.pushManager.getSubscription().then( verificaSuscripcion );

        });

    });

}





// Referencias de jQuery
var googleMapKey = 'AIzaSyA5mjCwx1TRLuBAjwQw84WE6h5ErSe7Uj8';

var titulo      = $('#titulo');
var nuevoBtn    = $('#nuevo-btn');
var salirBtn    = $('#salir-btn');
var cancelarBtn = $('#cancel-btn');
var postBtn     = $('#post-btn');
var avatarSel   = $('#seleccion');
var timeline    = $('#timeline');

var modal       = $('#modal');
var modalAvatar = $('#modal-avatar');
var avatarBtns  = $('.seleccion-avatar');
var txtMensaje  = $('#txtMensaje');

var btnActivadas    = $('.btn-noti-activadas');
var btnDesactivadas = $('.btn-noti-desactivadas');


var btnLocation      = $('#location-btn');

var modalMapa        = $('.modal-mapa');

var btnTomarFoto     = $('#tomar-foto-btn');
var btnPhoto         = $('#photo-btn');
var contenedorCamara = $('.camara-contenedor');

// Actividad 3 y 7: botones y contenedores nuevos
var btnTrack         = $('#track-btn');
var btnVideo         = $('#video-btn');
var contenedorVideo  = $('.video-contenedor');
var videoEstado      = $('#video-estado');
var btnGrabar        = $('#grabar-video-btn');
var btnDetenerVideo  = $('#detener-video-btn');
var btnRegrabar      = $('#regrabar-video-btn');

var lat  = null;
var lng  = null; 
var foto = null; 

// El usuario, contiene el ID del héroe seleccionado
var usuario;

// Init de la camara class
// document.getElementById('player');
const camara = new Camara( $('#player')[0] );

// Init de la clase de geolocalización (Actividades 1 a 6)
//   enableHighAccuracy: usa GPS si está disponible   (Act. 5)
//   timeout:            máx. 10 s de espera          (Act. 6)
//   maximumAge:         reutiliza posiciones < 60 s  (Act. 4)
const geo = new Geo({
    enableHighAccuracy: true,
    timeout:            10000,
    maximumAge:         60000
});

// Init del grabador de video (Actividad 7): máximo 15 s por mensaje
const grabador = new GrabadorVideo( $('#player-video')[0], $('#revision-video')[0], {
    duracionMax: 15
});

// Distancia mínima (metros) que debe moverse el dispositivo para recentrar el mapa
// durante el seguimiento continuo (evita recargar el iframe por cada microcambio del GPS)
const DISTANCIA_MIN_MAPA = 5;

// Aviso al usuario con mdtoast. tipo: 'info' | 'warning' | 'error' | undefined
function avisar( texto, tipo ) {

    const opts = {
        interaction: true,
        interactionTimeout: 6000,
        actionText: 'OK'
    };

    if ( tipo ) opts.type = tipo;

    $.mdtoast( texto, opts );
}



// ===== Codigo de la aplicación

function crearMensajeHTML(mensaje, personaje, lat, lng, foto, video) {

    // console.log(mensaje, personaje, lat, lng);

    var content =`
    <li class="animated fadeIn fast"
        data-user="${ personaje }"
        data-mensaje="${ mensaje }"
        data-tipo="mensaje">


        <div class="avatar">
            <img src="img/avatars/${ personaje }.jpg">
        </div>
        <div class="bubble-container">
            <div class="bubble">
                <h3>@${ personaje }</h3>
                <br/>
                ${ mensaje }
                `;
    
    if ( foto ) {
        content += `
                <br>
                <img class="foto-mensaje" src="${ foto }">
        `;
    }

    // Actividad 7: video grabado (webm)
    if ( video ) {
        content += `
                <br>
                <video class="video-mensaje" src="${ video }" controls playsinline preload="metadata"></video>
        `;
    }
        
    content += `</div>        
                <div class="arrow"></div>
            </div>
        </li>
    `;

    
    // si existe la latitud y longitud, 
    // llamamos la funcion para crear el mapa
    if ( lat ) {
        crearMensajeMapa( lat, lng, personaje );
    }
    
    // Borramos la latitud y longitud por si las usó
    lat = null;
    lng = null;

    $('.modal-mapa').remove();

    timeline.prepend(content);
    cancelarBtn.click();

}

function crearMensajeMapa(lat, lng, personaje) {


    let content = `
    <li class="animated fadeIn fast"
        data-tipo="mapa"
        data-user="${ personaje }"
        data-lat="${ lat }"
        data-lng="${ lng }">
                <div class="avatar">
                    <img src="img/avatars/${ personaje }.jpg">
                </div>
                <div class="bubble-container">
                    <div class="bubble">
                        <iframe
                            width="100%"
                            height="250"
                            frameborder="0" style="border:0"
                            src="https://www.google.com/maps/embed/v1/view?key=${ googleMapKey }&center=${ lat },${ lng }&zoom=17" allowfullscreen>
                            </iframe>
                    </div>
                    
                    <div class="arrow"></div>
                </div>
            </li> 
    `;

    timeline.prepend(content);
}




// Globals
function logIn( ingreso ) {

    if ( ingreso ) {
        nuevoBtn.removeClass('oculto');
        salirBtn.removeClass('oculto');
        timeline.removeClass('oculto');
        avatarSel.addClass('oculto');
        modalAvatar.attr('src', 'img/avatars/' + usuario + '.jpg');
    } else {
        nuevoBtn.addClass('oculto');
        salirBtn.addClass('oculto');
        timeline.addClass('oculto');
        avatarSel.removeClass('oculto');

        titulo.text('Seleccione Personaje');
    
    }

}


// Seleccion de personaje
avatarBtns.on('click', function() {

    usuario = $(this).data('user');

    titulo.text('@' + usuario);

    logIn(true);

});

// Boton de salir
salirBtn.on('click', function() {

    logIn(false);

});

// Boton de nuevo mensaje
nuevoBtn.on('click', function() {

    modal.removeClass('oculto');
    modal.animate({ 
        marginTop: '-=1000px',
        opacity: 1
    }, 200 );

});


// Boton de cancelar mensaje
cancelarBtn.on('click', function() {

    if ( !modal.hasClass('oculto') ) {
        modal.animate({ 
            marginTop: '+=1000px',
            opacity: 0
         }, 200, function() {
             modal.addClass('oculto');
             modalMapa.addClass('oculto');
             txtMensaje.val('');
             limpiarRecursos();
         });
    }

});

// Boton de enviar mensaje
postBtn.on('click', async function() {

    var mensaje = txtMensaje.val();
    if ( mensaje.length === 0 ) {
        cancelarBtn.click();
        return;
    }

    // Actividad 7: no se puede enviar mientras la grabación sigue en curso
    if ( grabador.grabando ) {
        avisar('Detén la grabación de video antes de enviar el mensaje.', 'warning');
        return;
    }

    // Actividad 7: convertimos el video grabado a base64 para enviarlo en el JSON
    var video = null;

    if ( grabador.tieneGrabacion() ) {
        try {
            video = await grabador.obtenerDataURL();
        } catch ( err ) {
            console.log('Error preparando el video', err);
            avisar('No se pudo preparar el video: ' + err.message, 'error');
            return;
        }
    }

    var data = {
        mensaje: mensaje,
        user: usuario,
        lat: lat,
        lng: lng,
        foto: foto,
        video: video
    };


    fetch('api', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify( data )
    })
    .then( res => res.json() )
    .then( res => console.log( 'app.js', res ))
    .catch( err => console.log( 'app.js error:', err ));


    crearMensajeHTML( mensaje, usuario, lat, lng, foto, video );
    
    // Reiniciamos lo adjunto para que el siguiente mensaje no reutilice
    // la ubicación, la foto o el video del anterior
    lat  = null;
    lng  = null;
    foto = null;
});



// Obtener mensajes del servidor
function getMensajes() {

    fetch('api')
        .then( res => res.json() )
        .then( posts => {

            console.log(posts);

            posts.forEach( post => 
                crearMensajeHTML( post.mensaje, post.user, post.lat, post.lng, post.foto, post.video ));
        });


}

getMensajes();



// Detectar cambios de conexión
function isOnline() {

    if ( navigator.onLine ) {
        // tenemos conexión
        // console.log('online');
        $.mdtoast('Online', {
            interaction: true,
            interactionTimeout: 1000,
            actionText: 'OK!'
        });


    } else{
        // No tenemos conexión
        $.mdtoast('Offline', {
            interaction: true,
            actionText: 'OK',
            type: 'warning'
        });
    }

}

window.addEventListener('online', isOnline );
window.addEventListener('offline', isOnline );

isOnline();


// Notificaciones
function verificaSuscripcion( activadas ) {

    if ( activadas ) {
        
        btnActivadas.removeClass('oculto');
        btnDesactivadas.addClass('oculto');

    } else {
        btnActivadas.addClass('oculto');
        btnDesactivadas.removeClass('oculto');
    }

}



function enviarNotificacion() {

    const notificationOpts = {
        body: 'Este es el cuerpo de la notificación',
        icon: 'img/icons/icon-72x72.png'
    };


    const n = new Notification('Hola Mundo', notificationOpts);

    n.onclick = () => {
        console.log('Click');
    };

}


function notificarme() {

    if ( !window.Notification ) {
        console.log('Este navegador no soporta notificaciones');
        return;
    }

    if ( Notification.permission === 'granted' ) {
        
        // new Notification('Hola Mundo! - granted');
        enviarNotificacion();

    } else if ( Notification.permission !== 'denied' || Notification.permission === 'default' )  {

        Notification.requestPermission( function( permission ) {

            console.log( permission );

            if ( permission === 'granted' ) {
                // new Notification('Hola Mundo! - pregunta');
                enviarNotificacion();
            }

        });

    }



}

// notificarme();


// Get Key
function getPublicKey() {

    // fetch('api/key')
    //     .then( res => res.text())
    //     .then( console.log );

    return fetch('api/key')
        .then( res => res.arrayBuffer())
        // returnar arreglo, pero como un Uint8array
        .then( key => new Uint8Array(key) );


}

// getPublicKey().then( console.log );
btnDesactivadas.on( 'click', function() {

    if ( !swReg ) return console.log('No hay registro de SW');

    getPublicKey().then( function( key ) {

        swReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key
        })
        .then( res => res.toJSON() )
        .then( suscripcion => {

            // console.log(suscripcion);
            fetch('api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( suscripcion )
            })
            .then( verificaSuscripcion )
            .catch( cancelarSuscripcion );


        });


    });


});



function cancelarSuscripcion() {

    swReg.pushManager.getSubscription().then( subs => {

        subs.unsubscribe().then( () =>  verificaSuscripcion(false) );

    });


}

btnActivadas.on( 'click', function() {

    cancelarSuscripcion();


});


// URL del mapa embebido de Google Maps centrado en una coordenada
function urlMapa( lat, lng ) {
    return `https://www.google.com/maps/embed/v1/view?key=${ googleMapKey }&center=${ lat },${ lng }&zoom=17`;
}

// Texto de estado que se muestra bajo el mapa: coordenadas, precisión y origen del dato
function textoEstadoGeo( r ) {

    var origen;

    if ( r.fuente === 'cache-app' ) {
        origen = `caché de la app (hace ${ Math.round( r.edadMs / 1000 ) } s)`;
    } else if ( r.fuente === 'cache-navegador' ) {
        origen = `caché del navegador (hace ${ Math.round( r.edadMs / 1000 ) } s)`;
    } else if ( r.degradada ) {
        origen = 'precisión normal (falló la alta precisión)';
    } else {
        origen = r.altaPrecision ? 'alta precisión' : 'precisión normal';
    }

    var partes = [
        `Lat ${ r.lat.toFixed(5) }, Lng ${ r.lng.toFixed(5) }`,
        `±${ Math.round( r.precision ) } m`,
        origen,
        new Date().toLocaleTimeString()
    ];

    if ( geo.siguiendo ) partes.unshift('Siguiendo');

    return partes.join(' · ');
}

// Crear mapa en el modal
function mostrarMapaModal(lat, lng, info) {

    $('.modal-mapa').remove();
    
    var content = `
            <div class="modal-mapa">
                <iframe
                    width="100%"
                    height="250"
                    frameborder="0"
                    src="${ urlMapa( lat, lng ) }" allowfullscreen>
                    </iframe>
                <div class="geo-estado">${ info ? textoEstadoGeo( info ) : '' }</div>
            </div>
    `;

    modal.append( content );
}

// Actividad 3: actualiza el mapa existente cuando llega una nueva posición.
// Sólo recarga el iframe si 'recentrar' es true; el texto de estado siempre se actualiza.
function actualizarMapaModal( r, recentrar ) {

    var iframe = $('.modal-mapa iframe');

    if ( iframe.length === 0 ) {
        mostrarMapaModal( r.lat, r.lng, r );
        return;
    }

    if ( recentrar ) iframe.attr( 'src', urlMapa( r.lat, r.lng ) );

    $('.modal-mapa .geo-estado').text( textoEstadoGeo( r ) );
}


// Sección 11 - Recursos Nativos


// Obtener la geolocalización
//   Act. 1: valida compatibilidad antes de generar el mapa
//   Act. 2: controla los errores (permiso, no disponible, timeout)
//   Act. 4: maximumAge → no repite la medición si la última es reciente
//   Act. 5: enableHighAccuracy con reintento si falla
//   Act. 6: timeout máximo de espera
btnLocation.on('click', async () => {

    // Act. 1: ¿el navegador soporta la API y estamos en un contexto seguro?
    const invalido = Geo.validar();

    if ( invalido ) {
        console.log('Geolocalización no disponible:', invalido.message);
        avisar( Geo.describirError( invalido ), 'error' );
        return;
    }

    // console.log('Botón geolocalización');
    $.mdtoast('Cargando mapa...', {
        interaction: true,
        interactionTimeout: 2000,
        actionText: 'Ok!'
    });

    try {

        const r = await geo.obtener({
            onLento: () => avisar(
                'La ubicación está tardando más de lo normal. ' +
                'Verifica que aceptaste el permiso de ubicación.', 'warning' )
        });

        console.log( r );

        // Act. 5: la alta precisión falló y se usó la precisión normal
        if ( r.degradada ) {
            avisar( 'No se logró alta precisión (' +
                    Geo.describirError( r.motivo, geo.opciones.timeout ) +
                    ') Se usó precisión normal.', 'warning' );
        }

        lat = r.lat;
        lng = r.lng;

        mostrarMapaModal( r.lat, r.lng, r );

    } catch ( err ) {

        // Act. 2 y 6: permiso denegado, posición no disponible o tiempo agotado
        console.log('Error de geolocalización:', err.code, err.message);
        avisar( Geo.describirError( err, geo.opciones.timeout ), 'error' );
    }

});


// Actividad 3: seguimiento continuo (watchPosition)
var ultimaPosicionMapa = null;   // posición con la que se dibujó el mapa por última vez
var ultimoAvisoError   = 0;      // para no repetir toasts de error seguidos

function detenerSeguimiento() {
    geo.detenerSeguimiento();
    btnTrack.removeClass('activo');
}

btnTrack.on('click', () => {

    // Segundo clic: detener el seguimiento
    if ( geo.siguiendo ) {
        detenerSeguimiento();
        avisar('Seguimiento de ubicación detenido.', 'info');
        return;
    }

    ultimaPosicionMapa = null;

    const iniciado = geo.seguir(

        // Llega una nueva posición
        r => {

            console.log('watchPosition:', r);

            // El mensaje que se envíe llevará siempre la última posición conocida
            lat = r.lat;
            lng = r.lng;

            const seMovio = !ultimaPosicionMapa ||
                            Geo.distancia( ultimaPosicionMapa, r ) >= DISTANCIA_MIN_MAPA;

            if ( seMovio ) ultimaPosicionMapa = r;

            actualizarMapaModal( r, seMovio );
        },

        // Error durante el seguimiento
        err => {

            console.log('watchPosition error:', err.code, err.message);

            // Permiso denegado (o API no disponible): el seguimiento ya no puede continuar
            if ( err.code === 1 || err.code === 0 ) detenerSeguimiento();

            // Un TIMEOUT sólo indica que no hubo cambios recientes: no molestamos
            if ( err.code === 3 ) return;

            if ( Date.now() - ultimoAvisoError > 10000 ) {
                ultimoAvisoError = Date.now();
                avisar( Geo.describirError( err, geo.opciones.timeout ),
                        err.code === 2 ? 'warning' : 'error' );
            }
        }
    );

    if ( iniciado ) {
        btnTrack.addClass('activo');
        avisar('Siguiendo tu ubicación...', 'info');
    }

});



// Boton de la camara
// usamos la funcion de fleca para prevenir
// que jQuery me cambie el valor del this
btnPhoto.on('click', () => {

    console.log('Inicializar camara');

    // Si había una grabación de video en curso, la descartamos: la cámara se usa para la foto
    grabador.descartar();
    contenedorVideo.addClass('oculto');
    setEstadoVideo('inactivo');

    contenedorCamara.removeClass('oculto');

    camara.encender();

});


// Boton para tomar la foto
btnTomarFoto.on('click', () => {

    console.log('Botón tomar foto');

    foto = camara.tomarFoto();

    camara.apagar();
    
    // console.log(foto);

});


// Actividad 7: Grabación de video (webm)

// Estados: 'inactivo' | 'listo' (vista previa) | 'grabando' | 'revision' (reproduce lo grabado)
function setEstadoVideo( estado ) {

    btnGrabar.toggleClass( 'oculto', estado !== 'listo' );
    btnDetenerVideo.toggleClass( 'oculto', estado !== 'grabando' );
    btnRegrabar.toggleClass( 'oculto', estado !== 'revision' );

    $('#player-video').toggleClass( 'oculto', estado === 'revision' );
    $('#revision-video').toggleClass( 'oculto', estado !== 'revision' );

    videoEstado.toggleClass( 'grabando', estado === 'grabando' );
}

// Enciende la cámara (con micrófono) y muestra la vista previa
async function iniciarVistaPreviaVideo() {

    try {

        const r = await grabador.encender();

        setEstadoVideo('listo');

        if ( r.audio ) {
            videoEstado.text(`Listo para grabar (máx. ${ grabador.duracionMax } s)`);
        } else {
            videoEstado.text('Sin micrófono: se grabará sólo video.');
            avisar('No se detectó micrófono: el video se grabará sin audio.', 'warning');
        }

    } catch ( err ) {

        console.log('Error al iniciar la cámara de video:', err);
        avisar( GrabadorVideo.describirError( err ), 'error' );

        contenedorVideo.addClass('oculto');
        setEstadoVideo('inactivo');
    }
}

grabador.onTick = ( seg, max ) => {
    videoEstado.text(`● Grabando ${ seg }/${ max } s`);
};

grabador.onFin = blob => {
    console.log('Video grabado:', blob.type, blob.size, 'bytes');
    setEstadoVideo('revision');
    videoEstado.text(`Video listo (${ Math.round( blob.size / 1024 ) } KB). Envía el mensaje para adjuntarlo.`);
};

grabador.onError = err => {
    console.log('Error durante la grabación:', err);
    avisar('Falló la grabación de video: ' + ( err.message || err.name || 'error desconocido' ), 'error');
    grabador.descartar();
    contenedorVideo.addClass('oculto');
    setEstadoVideo('inactivo');
};

btnVideo.on('click', async () => {

    console.log('Inicializar grabación de video');

    // Valida contexto seguro (HTTPS/localhost) y soporte de MediaRecorder
    const noDisponible = GrabadorVideo.mensajeNoDisponible();

    if ( noDisponible ) {
        console.log('Grabación de video no disponible:', noDisponible);
        avisar( noDisponible, 'error' );
        return;
    }

    // La cámara de fotos y la de video no se usan a la vez
    camara.apagar();
    contenedorCamara.addClass('oculto');

    contenedorVideo.removeClass('oculto');

    await iniciarVistaPreviaVideo();
});

btnGrabar.on('click', () => {

    try {
        grabador.grabar();
        setEstadoVideo('grabando');
        videoEstado.text(`● Grabando 0/${ grabador.duracionMax } s`);
    } catch ( err ) {
        console.log('Error al iniciar la grabación:', err);
        avisar( GrabadorVideo.describirError( err ), 'error' );
    }
});

btnDetenerVideo.on('click', () => {
    grabador.detener();
});

btnRegrabar.on('click', async () => {
    grabador.descartar();
    await iniciarVistaPreviaVideo();
});


// Libera ubicación, cámara y video cuando se cierra el modal de nuevo mensaje
function limpiarRecursos() {

    detenerSeguimiento();

    camara.apagar();
    contenedorCamara.addClass('oculto');

    grabador.descartar();
    contenedorVideo.addClass('oculto');
    setEstadoVideo('inactivo');

    $('.modal-mapa').remove();

    lat  = null;
    lng  = null;
    foto = null;
}

setEstadoVideo('inactivo');


// Share API

// if ( navigator.share ) {
//     console.log('Navegador lo soporta');
// } else {
//     console.log('Navegador NO lo soporta');
// }

timeline.on('click', 'li', function( e ) {

    // No abrir el menú de compartir cuando se interactúa con el reproductor de video
    if ( $( e.target ).is('video') ) return;

    if ( !navigator.share ) {
        console.log('Web Share API no soportada en este navegador');
        return;
    }

    // console.log(  $(this)  );
    
    let tipo    = $(this).data('tipo');
    let lat     = $(this).data('lat');
    let lng     = $(this).data('lng');
    let mensaje = $(this).data('mensaje');
    let user    = $(this).data('user');
    
    console.log({ tipo, lat, lng, mensaje, user  });


    const shareOpts = {
        title: user,
        text: mensaje
    };

    if ( tipo === 'mapa' ) {
        shareOpts.text = 'Mapa';
        shareOpts.url  = `https://www.google.com/maps/@${ lat },${ lng },15z`;
    }

    navigator.share(shareOpts)
      .then(() => console.log('Successful share'))
      .catch((error) => console.log('Error sharing', error));

});




