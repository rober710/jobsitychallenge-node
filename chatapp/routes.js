/**
 * App routes and handling functions.
 */

var express = require('express');

var models = require('./database/models');


var router = express.Router();

router.get('/', function(req, res) {
    res.render('index', {
        prop: 'Prueba!'
    });
});

router.get('/login', function (req, res) {
    res.render('login');
});

router.get('/chatroom', function (req, res) {
    res.render('chat');
});

module.exports = router;