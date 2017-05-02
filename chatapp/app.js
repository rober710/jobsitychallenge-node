/**
 * App entry point. Creates server.
 */

var path = require('path');

var crypto = require('crypto');
var express = require('express');

var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var nunjucks = require('nunjucks');
var passport = require('passport');
var session = require('express-session');
var LocalStrategy = require('passport-local').Strategy;

var logger = require('./logging');
var router = require('./routes');

var app = express();

app.use(session({
    secret: crypto.createHash('md5').update(Math.random().toString()).digest('hex'),
    resave: true,
    saveUninitialized: false
}));

// Important to make Passport work!
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

nunjucks.configure(path.join(__dirname, 'templates'), {
    autoescape: true,
    express: app
});

// Seems that this defines the extension that template files must have...
app.set('view engine', 'html');
app.use(express.static(path.join(__dirname, 'assets')));

// Create database schema
var knex = require('./database/setup').knex;
require('./database/schema')(knex);

// Setup login authentication with passport.
app.use(passport.initialize());
app.use(passport.session());

var User = require('./database/models').User;
passport.use('local', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}, function(req, username, password, done) {
    User.where('username', username).fetch().then(user => {
        if (user == null) {
            done(null, false, 'Incorrect username or password.');
            return;
        }

        if (user.checkPassword(password)) {
            logger.debug(`Password for user ${username} accepted.`);
            done(null, user);
        } else {
            logger.debug(`Password for user ${username} incorrect.`);
            done(null, false, 'Incorrect username or password.');
        }
    }).catch(err => {
        logger.error(`Error querying data for user ${username} from database.`);
        logger.error(err);
        done(err);
    });
}));

passport.serializeUser(function (user, done) {
    done(null, user.get('username'));
});

passport.deserializeUser(function (username, done) {
    User.where('username', username).fetch().then(user => {
        if (!user) {
            let message = `Session contains null user id ${username}!`;
            logger.warn(message);
            done(message);
            return;
        }
        done(null, user);
    });
});

// Load routes for the application
app.use('/', router);

let port = parseInt(process.env.PORT);
if (isNaN(port)) {
    port = 3000;
}

app.listen(port, function () {
    logger.info(`Server started. Listening on port ${port}.`);
});