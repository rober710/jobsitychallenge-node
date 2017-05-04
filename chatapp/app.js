/**
 * App entry point. Creates server.
 */

var path = require('path');

var bodyParser = require('body-parser');
var crypto = require('crypto');
var express = require('express');
var LocalStrategy = require('passport-local').Strategy;
var nunjucks = require('nunjucks');
var passport = require('passport');
var session = require('express-session');
var ws = require('express-ws');

var BotMessageManager = require('./bot-connector').BotMessageManager;
var logger = require('./logging');

var app = express();
var sessionManager = session({
    secret: crypto.createHash('md5').update(Math.random().toString()).digest('hex'),
    resave: true,
    saveUninitialized: false
});

app.use(sessionManager);

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

// Enable Web Socket support for app.
let wsRet = ws(app, null, {
    wsOptions: {
        verifyClient: function (info, done) {
            console.log(info, info.origin, info.secure);
            sessionManager(info.req, {}, function () {
                console.log(info.req.session);
            });
            done(true);
        }
    }
});

app.webSocketServer = wsRet.getWss();

// Load routes for the application
require('./routes')(app);

// Global error handlers:
process.on('uncaughtException', (err) => {
    logger.error('Uncaught error detected!', err);
    process.exit(1);
});

process.on('unhandledRejection', function (reason, promise) {
    logger.error('Unhandled rejection detected!', {reason, promise});
});

let port = parseInt(process.env.PORT);
if (isNaN(port)) {
    port = 3000;
}

// Initialize bot receiver. When it is ready to listen to requests, the server starts listening to requests.
let messageManager = new BotMessageManager();
app.locals.botMessageManager = messageManager;

messageManager.initialize().then(() => {
    logger.info('Bot message receiver initialized. Starting server...');
    app.listen(port, function () {
        logger.info(`Server started. Listening on port ${port}.`);
    });
}).catch(err => {
    logger.error(err);
    process.exit(1);
});
