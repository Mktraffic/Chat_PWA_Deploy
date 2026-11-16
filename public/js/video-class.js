// =============================================================================
// GrabadorVideo - Grabación de video en formato webm con MediaRecorder
// (Actividad 7 del taller)
//
// Flujo:  encender() → grabar() → detener() → obtenerDataURL()
//                          ↑___ descartar() / encender() para regrabar
// =============================================================================

class GrabadorVideo {

    /**
     * @param {HTMLVideoElement} videoEnVivo  <video> para la vista previa mientras se graba
     * @param {HTMLVideoElement} videoRevision <video> para reproducir lo grabado
     * @param {Object} opciones { duracionMax: segundos, bitsPorSegundo: number }
     */
    constructor( videoEnVivo, videoRevision, opciones = {} ) {

        this.videoEnVivo   = videoEnVivo;
        this.videoRevision = videoRevision;

        this.duracionMax    = opciones.duracionMax    || 15;      // segundos
        this.bitsPorSegundo = opciones.bitsPorSegundo || 800000;  // ~0.8 Mbps → mensajes livianos

        this.stream     = null;
        this.recorder   = null;
        this.chunks     = [];
        this.blob       = null;
        this.mimeType   = '';
        this.urlRevision = null;
        this.temporizador = null;
        this.segundos   = 0;

        // Callbacks opcionales
        this.onTick  = null;  // ( segundosTranscurridos, duracionMax )
        this.onFin   = null;  // ( blob )  → se dispara al terminar la grabación
        this.onError = null;  // ( err )

        console.log('GrabadorVideo init');
    }


    // -------------------------------------------------------------------------
    // Compatibilidad
    // -------------------------------------------------------------------------
    static soportado() {
        return !!( navigator.mediaDevices &&
                   navigator.mediaDevices.getUserMedia &&
                   window.MediaRecorder );
    }

    // Motivo por el que NO se puede grabar (o null si todo está disponible).
    // Distingue "contexto inseguro" (HTTP por IP de la red local) de "navegador sin soporte":
    // en HTTP inseguro navigator.mediaDevices ni siquiera existe.
    static mensajeNoDisponible() {

        if ( window.isSecureContext === false ) {
            return 'La cámara requiere una conexión segura (HTTPS o localhost).';
        }

        if ( !GrabadorVideo.soportado() ) {
            return 'Tu navegador no soporta grabación de video (MediaRecorder / getUserMedia).';
        }

        return null;
    }

    // Primer tipo webm que soporta el navegador ('' si ninguno)
    static mejorMime() {

        if ( !window.MediaRecorder || !MediaRecorder.isTypeSupported ) return '';

        const candidatos = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
        ];

        return candidatos.find( tipo => MediaRecorder.isTypeSupported( tipo ) ) || '';
    }

    // Mensaje legible para el usuario según el tipo de error
    static describirError( err ) {

        if ( !window.isSecureContext && window.isSecureContext !== undefined ) {
            return 'La cámara requiere una conexión segura (HTTPS o localhost).';
        }

        switch ( err && err.name ) {
            case 'NotAllowedError':
            case 'PermissionDeniedError':
                return 'Permiso de cámara/micrófono denegado. Habilítalo desde el candado junto a la URL.';
            case 'NotFoundError':
            case 'DevicesNotFoundError':
                return 'No se encontró una cámara en este dispositivo.';
            case 'NotReadableError':
            case 'TrackStartError':
                return 'La cámara está siendo usada por otra aplicación.';
            case 'OverconstrainedError':
                return 'La cámara no soporta la resolución solicitada.';
            case 'SecurityError':
                return 'El navegador bloqueó el acceso a la cámara por seguridad.';
            case 'NoSoportado':
                return err.message;
            default:
                return 'No se pudo usar la cámara' + ( err && err.message ? `: ${ err.message }` : '.' );
        }
    }

    static _errorNoSoportado( mensaje ) {
        const e = new Error( mensaje );
        e.name = 'NoSoportado';
        return e;
    }


    // -------------------------------------------------------------------------
    // 1. Encender la cámara y mostrar la vista previa
    //    Devuelve { audio: boolean }  (false si se grabará sólo video)
    // -------------------------------------------------------------------------
    async encender() {

        const noDisponible = GrabadorVideo.mensajeNoDisponible();

        if ( noDisponible ) {
            throw GrabadorVideo._errorNoSoportado( noDisponible );
        }

        this.mimeType = GrabadorVideo.mejorMime();

        if ( !this.mimeType ) {
            throw GrabadorVideo._errorNoSoportado(
                'Tu navegador no puede grabar en formato webm.' );
        }

        this.descartar();   // limpia grabaciones y streams anteriores

        const video = { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' };
        let tieneAudio = true;

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
        } catch ( err ) {

            // Si el problema es sólo el micrófono (no existe / está ocupado) grabamos sin audio.
            // Si el usuario negó el permiso no insistimos: se propaga el error.
            if ( err.name === 'NotFoundError' || err.name === 'NotReadableError' ) {
                this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
                tieneAudio = false;
            } else {
                throw err;
            }
        }

        this.videoRevision.pause();
        this.videoEnVivo.muted     = true;   // evita eco/acople mientras se graba
        this.videoEnVivo.srcObject = this.stream;

        return { audio: tieneAudio };
    }


    // -------------------------------------------------------------------------
    // 2. Iniciar la grabación
    // -------------------------------------------------------------------------
    grabar() {

        if ( !this.stream ) {
            throw GrabadorVideo._errorNoSoportado( 'La cámara no está encendida.' );
        }

        this.chunks = [];
        this.blob   = null;

        const opts = { videoBitsPerSecond: this.bitsPorSegundo };
        if ( this.mimeType ) opts.mimeType = this.mimeType;

        this.recorder = new MediaRecorder( this.stream, opts );

        this.recorder.ondataavailable = e => {
            if ( e.data && e.data.size > 0 ) this.chunks.push( e.data );
        };

        this.recorder.onerror = e => {
            this._detenerTemporizador();
            if ( this.onError ) this.onError( e.error || e );
        };

        this.recorder.onstop = () => this._finalizar();

        this.recorder.start( 1000 );   // entrega un fragmento por segundo

        // Contador y límite de duración
        this.segundos = 0;
        this._detenerTemporizador();
        this.temporizador = setInterval( () => {

            this.segundos++;
            if ( this.onTick ) this.onTick( this.segundos, this.duracionMax );

            if ( this.segundos >= this.duracionMax ) this.detener();

        }, 1000 );
    }

    get grabando() {
        return !!this.recorder && this.recorder.state === 'recording';
    }


    // -------------------------------------------------------------------------
    // 3. Detener la grabación (manual o al alcanzar duracionMax)
    // -------------------------------------------------------------------------
    detener() {

        this._detenerTemporizador();

        if ( this.recorder && this.recorder.state !== 'inactive' ) {
            this.recorder.stop();   // dispara onstop → _finalizar()
        }
    }

    _finalizar() {

        // OJO: el tipo del Blob se normaliza a 'video/webm'. Si se deja
        // 'video/webm;codecs=vp8,opus', la coma rompe el Data URL al convertirlo a base64.
        const tipoBase = ( this.mimeType || 'video/webm' ).split(';')[0];
        this.blob = new Blob( this.chunks, { type: tipoBase } );

        // Liberamos la cámara y mostramos la grabación para revisarla
        this._apagarStream();

        if ( this.urlRevision ) URL.revokeObjectURL( this.urlRevision );
        this.urlRevision = URL.createObjectURL( this.blob );
        this.videoRevision.src = this.urlRevision;

        if ( this.onFin ) this.onFin( this.blob );
    }


    // -------------------------------------------------------------------------
    // 4. Resultado
    // -------------------------------------------------------------------------
    tieneGrabacion() {
        return !!this.blob && this.blob.size > 0;
    }

    // Convierte la grabación a Data URL (base64) para enviarla en el JSON del mensaje
    obtenerDataURL() {

        return new Promise( ( resolve, reject ) => {

            if ( !this.tieneGrabacion() ) return reject( new Error( 'No hay video grabado.' ) );

            const lector = new FileReader();
            lector.onload  = () => resolve( lector.result );
            lector.onerror = () => reject( lector.error || new Error( 'No se pudo leer el video.' ) );
            lector.readAsDataURL( this.blob );
        });
    }


    // -------------------------------------------------------------------------
    // Limpieza
    // -------------------------------------------------------------------------
    _detenerTemporizador() {
        if ( this.temporizador ) {
            clearInterval( this.temporizador );
            this.temporizador = null;
        }
    }

    _apagarStream() {

        if ( this.stream ) {
            this.stream.getTracks().forEach( track => track.stop() );   // video Y audio
            this.stream = null;
        }

        this.videoEnVivo.srcObject = null;
    }

    // Apaga todo y borra la grabación
    descartar() {

        this._detenerTemporizador();

        if ( this.recorder && this.recorder.state !== 'inactive' ) {
            this.recorder.onstop = null;   // no disparar _finalizar()
            this.recorder.stop();
        }

        this.recorder = null;
        this.chunks   = [];
        this.blob     = null;

        this._apagarStream();

        if ( this.urlRevision ) {
            URL.revokeObjectURL( this.urlRevision );
            this.urlRevision = null;
        }

        this.videoRevision.pause();
        this.videoRevision.removeAttribute('src');
        this.videoRevision.load();
    }
}
