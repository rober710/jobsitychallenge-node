/**
 * App entry point. Creates server.
 */

var path = require('path');

var crypto = require('crypto');
var express = require('express');
var session = require('express-session');
var nunjucks = require('nunjucks');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var logger = require('./logging');
var router = require('./routes');

var app = express();
app.use(session({
    secret: crypto.createHash('md5').update(Math.random().toString()).digest('hex'),
    resave: false,
    saveUninitialized: false
}));

nunjucks.configure(path.join(__dirname, 'templates'), {
    autoescape: true,
    express: app
});

// Seems that this defines the extension that template files must have...
app.set('view engine', 'html');
app.use(express.static(path.join(__dirname, 'assets')));

// Create database schema
var {knex, bookshelf} = require('./database/setup');
require('./database/schema')(knex);

// Setup login authentication with passport.
app.use(passport.initialize());
app.use(passport.session());

var User = require('./database/models').User;
passport.use(new LocalStrategy(function(username, password, done) {
    User.where('username', username).fetch().then((user) => {
        console.log(user);
    }).catch((err) => {
        logger.error(err);
    })
}));


// Load routes for the application
app.use('/', router);

let port = parseInt(process.env.PORT);
if (isNaN(port)) {
    port = 3000;
}

app.listen(port, function () {
    logger.info(`Server started. Listening on port ${port}.`);
});