const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const compression = require('compression');


const app = express();


const publicPath = path.resolve(__dirname, '../public');
const port = process.env.PORT || 3000;


// app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.json({ limit: '50mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true })); // support encoded bodies


// Compresión gzip/brotli de HTML, CSS, JS y JSON
app.use(compression());


// Enable CORS
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});



// Directorio Público
app.use(express.static(publicPath, {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        // Estos archivos deben revalidarse siempre (el SW y lo que importa)
        if (/(sw\.js|sw-[\w-]+\.js|index\.html|manifest\.json)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Rutas 
const routes = require('./routes');
app.use('/api', routes );



app.listen(port, (err) => {

    if (err) throw new Error(err);

    console.log(`Servidor corriendo en puerto ${ port }`);

});