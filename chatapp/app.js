/**
 * App entry point.
 */

var path = require('path');
var express = require('express');
var nunjucks = require('nunjucks');

var app = express();

nunjucks.configure(path.join(__dirname, 'templates'), {
    autoescape: true,
    express: app
});

// Seems that this defines the extension that template files must have...
app.set('view engine', 'html');
app.use(express.static(path.join(__dirname, 'assets')));

app.get('/', function(req, res) {
    res.render('index', {
        prop: 'Prueba!'
    });
});

app.get('/login', function (req, res) {
    res.render('login');
});

app.get('/chatroom', function (req, res) {
    res.render('chat');
});

app.listen(3000, function () {
    console.log('Servidor iniciado en puerto 3000');
});