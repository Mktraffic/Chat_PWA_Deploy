// =============================================================================
// Geo - Envoltorio de navigator.geolocation (Actividades 1 a 6 del taller)
//
//  1. Validación de compatibilidad ........ Geo.soportado()
//  2. Control de errores .................. Geo.describirError()
//  3. Seguimiento continuo ................ seguir() / detenerSeguimiento()  (watchPosition)
//  4. Caché y antigüedad .................. opciones.maximumAge + caché propia (ultima)
//  5. Alta precisión ...................... opciones.enableHighAccuracy + reintento
//  6. Tiempo máximo de espera ............. opciones.timeout + temporizador de seguridad
// =============================================================================

class Geo {

    constructor( opciones = {} ) {

        this.opciones = Object.assign({
            enableHighAccuracy: true,   // Act. 5: usa GPS / mejor fuente disponible
            timeout:            10000,  // Act. 6: máx. 10 s esperando la posición
            maximumAge:         60000   // Act. 4: reutiliza posiciones de hasta 60 s
        }, opciones );

        // Tiempo extra (ms) tras el cual avisamos que la respuesta "tarda demasiado".
        // El tiempo que el usuario tarda en responder el diálogo de permisos NO cuenta
        // dentro de 'timeout' (la especificación lo excluye), así que sin este segundo
        // temporizador la app no se enteraría de que sigue esperando una respuesta del usuario.
        this.margenAviso = 5000;

        this.watchId = null;   // id devuelto por watchPosition
        this.ultima  = null;   // última posición válida (caché propia)
    }


    // -------------------------------------------------------------------------
    // Actividad 1: compatibilidad
    // -------------------------------------------------------------------------
    static soportado() {
        return ( 'geolocation' in navigator ) && !!navigator.geolocation;
    }

    // La API sólo funciona en contextos seguros (HTTPS o localhost)
    static contextoSeguro() {
        return window.isSecureContext !== false;
    }


    // -------------------------------------------------------------------------
    // Actividad 2: mensajes de error
    //   err.code  1 = PERMISSION_DENIED
    //             2 = POSITION_UNAVAILABLE
    //             3 = TIMEOUT
    //             0 = errores propios (no soportado / contexto inseguro)
    // -------------------------------------------------------------------------
    static describirError( err, timeoutMs ) {

        const seg = timeoutMs ? Math.round( timeoutMs / 1000 ) : null;

        switch ( err && err.code ) {
            case 0:
                return err.message;
            case 1:
                return 'Permiso de ubicación denegado. Habilítalo desde el candado junto a la URL ' +
                       '(Configuración del sitio → Ubicación) y vuelve a intentar.';
            case 2:
                return 'Ubicación no disponible: no hay señal GPS/red o el servicio de ubicación ' +
                       'del dispositivo está apagado.';
            case 3:
                return 'Se agotó el tiempo de espera' + ( seg ? ` (${ seg } s)` : '' ) +
                       ' para obtener la ubicación. Intenta de nuevo.';
            default:
                return 'Error desconocido al obtener la ubicación' +
                       ( err && err.message ? `: ${ err.message }` : '.' );
        }
    }

    // Error "propio" con el mismo formato que GeolocationPositionError
    static _errorPropio( message ) {
        return { code: 0, message };
    }

    // Valida soporte y contexto seguro. Devuelve un error propio o null.
    static validar() {

        if ( !Geo.soportado() ) {
            return Geo._errorPropio( 'Tu navegador no soporta geolocalización (navigator.geolocation).' );
        }

        if ( !Geo.contextoSeguro() ) {
            return Geo._errorPropio( 'La geolocalización requiere una conexión segura (HTTPS o localhost).' );
        }

        return null;
    }


    // -------------------------------------------------------------------------
    // Utilidades
    // -------------------------------------------------------------------------

    // Distancia en metros entre dos puntos {lat, lng} (fórmula de Haversine)
    static distancia( a, b ) {

        const R   = 6371000; // radio medio de la Tierra en metros
        const rad = grados => grados * Math.PI / 180;

        const dLat = rad( b.lat - a.lat );
        const dLng = rad( b.lng - a.lng );

        const h = Math.sin( dLat / 2 ) ** 2 +
                  Math.cos( rad( a.lat ) ) * Math.cos( rad( b.lat ) ) * Math.sin( dLng / 2 ) ** 2;

        return 2 * R * Math.asin( Math.sqrt( h ) );
    }

    // Convierte un GeolocationPosition en un objeto simple y agrega metadatos
    _resultado( pos, extra = {} ) {

        const r = Object.assign({
            lat:        pos.coords.latitude,
            lng:        pos.coords.longitude,
            precision:  pos.coords.accuracy,      // metros
            timestamp:  pos.timestamp,            // ms (momento de la medición)
            edadMs:     Math.max( 0, Date.now() - pos.timestamp ),
            fuente:     'api',                    // 'api' | 'cache-navegador' | 'cache-app'
            altaPrecision: !!this.opciones.enableHighAccuracy,
            degradada:  false
        }, extra );

        // Si la medición ya tenía más de 1 s cuando llegó, el navegador la sirvió de su caché
        if ( r.fuente === 'api' && r.edadMs > 1000 ) {
            r.fuente = 'cache-navegador';
        }

        return r;
    }

    // Solicitud única con temporizador de seguridad.
    // onLento(): se invoca si no hay respuesta después de timeout + margenAviso
    _pedir( opts, onLento ) {

        return new Promise( ( resolve, reject ) => {

            let terminado = false;

            const aviso = setTimeout( () => {
                if ( !terminado && typeof onLento === 'function' ) onLento();
            }, ( opts.timeout || 0 ) + this.margenAviso );

            navigator.geolocation.getCurrentPosition(
                pos => {
                    terminado = true;
                    clearTimeout( aviso );
                    resolve( pos );
                },
                err => {
                    terminado = true;
                    clearTimeout( aviso );
                    reject( err );
                },
                opts
            );
        });
    }


    // -------------------------------------------------------------------------
    // Posición única (Act. 1, 2, 4, 5 y 6)
    // Devuelve una Promise<resultado>. Rechaza con un error con .code (0-3).
    // -------------------------------------------------------------------------
    async obtener( { onLento, forzar = false } = {} ) {

        // Act. 1: compatibilidad antes de hacer cualquier cosa
        const invalido = Geo.validar();
        if ( invalido ) throw invalido;

        // Act. 4: si ya tenemos una posición suficientemente reciente, no
        // volvemos a iniciar la geolocalización.
        if ( !forzar && this.ultima && this.opciones.maximumAge > 0 ) {

            const edad = Date.now() - this.ultima.timestamp;

            if ( edad <= this.opciones.maximumAge ) {
                return Object.assign( {}, this.ultima, { edadMs: edad, fuente: 'cache-app' });
            }
        }

        const opts = Object.assign( {}, this.opciones );

        try {

            const pos = await this._pedir( opts, onLento );
            return this._guardar( this._resultado( pos ) );

        } catch ( err ) {

            // Act. 5: si falla la alta precisión por un motivo que NO es el permiso,
            // reintentamos con precisión normal (red/Wi-Fi) antes de rendirnos.
            if ( opts.enableHighAccuracy && err.code !== 1 ) {

                const pos = await this._pedir( Object.assign( {}, opts, { enableHighAccuracy: false }), onLento );

                return this._guardar( this._resultado( pos, {
                    altaPrecision: false,
                    degradada:     true,
                    motivo:        err
                }));
            }

            throw err;
        }
    }

    _guardar( resultado ) {
        this.ultima = resultado;
        return resultado;
    }


    // -------------------------------------------------------------------------
    // Actividad 3: seguimiento continuo con watchPosition
    //   onPos( resultado )  → cada vez que el navegador reporta una posición
    //   onError( err )      → errores (TIMEOUT y POSITION_UNAVAILABLE no cancelan el seguimiento)
    // Devuelve true si inició el seguimiento.
    // -------------------------------------------------------------------------
    seguir( onPos, onError ) {

        const invalido = Geo.validar();
        if ( invalido ) {
            if ( onError ) onError( invalido );
            return false;
        }

        if ( this.watchId !== null ) return true; // ya está siguiendo

        // Para el seguimiento queremos datos frescos: maximumAge = 0.
        // El timeout en watchPosition aplica a cada actualización, por lo que usamos
        // uno más holgado para no generar errores cuando el dispositivo está quieto.
        const opts = Object.assign( {}, this.opciones, {
            maximumAge: 0,
            timeout:    Math.max( this.opciones.timeout, 30000 )
        });

        this.watchId = navigator.geolocation.watchPosition(
            pos => {
                const r = this._guardar( this._resultado( pos ) );
                if ( onPos ) onPos( r );
            },
            err => {
                // Si el usuario revoca / niega el permiso no tiene sentido seguir escuchando
                if ( err.code === 1 ) this.detenerSeguimiento();
                if ( onError ) onError( err );
            },
            opts
        );

        return true;
    }

    detenerSeguimiento() {

        if ( this.watchId !== null ) {
            navigator.geolocation.clearWatch( this.watchId );
            this.watchId = null;
        }
    }

    get siguiendo() {
        return this.watchId !== null;
    }
}
