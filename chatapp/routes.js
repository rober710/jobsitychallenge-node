/**
 * App routes and handling functions.
 */

var express = require('express');
var HttpStatus = require('http-status-codes');
var passport = require('passport');
var router = express.Router();

var commandRegistry = require('./commands');
var Message = require('./database/models').Message;
var logger = require('./logging');

router.get('/', function(req, res) {
    if (req.user) {
        console.log('usuario en sesión');
    } else {
        res.redirect('/login');
    }
});

router.get('/login', function (req, res) {
    res.render('login');
});

router.post('/login', function (req, res, next) {
    passport.authenticate('local', {
        successRedirect: '/chatroom',
        failureFlash: false
    }, function (err, user, info) {
        if (err) {
            next(err);
        }

        if (!user) {
            res.status(HttpStatus.FORBIDDEN);
            // Info is what is passed as an argument to done() in callback of passport.use.
            res.render('login', {error: info});
            return;
        }

        req.logIn(user, function (err) {
            if (err) {
                res.status(HttpStatus.FORBIDDEN);
                res.render('login', {error: err});
                return next(err);
            }

            return res.redirect('/chatroom');
        });
    })(req, res, next);
});

router.get('/logout', function (req, res, next) {
    req.logout();
    req.session.destroy();
    res.redirect('/login');
});

router.get('/chatroom', function (req, res) {
    if (!req.user) {
        res.redirect('/login');
        return;
    }

    res.render('chat');
});

// Ajax routes
router.post('/messages/post', function (req, res, next) {
    if (!req.user) {
        res.status(HttpStatus.FORBIDDEN);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.write(JSON.stringify({
            'error': true, 'code': 'CH01',
            'message': 'User is not in session.'
        }));
        res.end();
    }

    const COMMAND_REGEX = /^\/(\w+)(?:=(.*))?$/;
    let postedMessage = req.body.message;

    if (!postedMessage) {
        res.status(HttpStatus.BAD_REQUEST);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.write(JSON.stringify({
            'error': true, 'code': 'CH01',
            'message': 'Parameter "message" was not send or was empty.'
        }));
        res.end();
    }

    let regexMatch = COMMAND_REGEX.exec(postedMessage);
    if (regexMatch) {
        let command = regexMatch[1];
        let arg = regexMatch[2];

        let handler = commandRegistry[command];

        if (!handler) {
            res.status(HttpStatus.BAD_REQUEST);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.write(JSON.stringify({
                'error': true, 'code': 'CH01',
                'message': `Command "${command}" not recognized.`
            }));
            res.end();
            return;
        }

        let connector = req.app.locals.botMessageManager;
        handler(connector, arg).then(response => {
            res.status(HttpStatus.OK);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.write(JSON.stringify(response));
            res.end();
        }, err => {
            let content = null;

            try {
                content = JSON.stringify(err);
            } catch (err) {
                logger.error(err);
                content = JSON.stringify({
                    'error': true, 'code': 'CH01',
                    'message': 'Could not convert response to JSON to send to the client.'
                });
            }

            res.status(HttpStatus.INTERNAL_SERVER_ERROR);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.write(content);
            res.end();
        });
        return;
    }

    // Save message in database and publish it to the chatroom.
    let messageObj = new Message({
        id: null,
        username: req.user.get('username'),
        date_posted: new Date(),
        text: postedMessage
    });

    messageObj.save().then(message => {
        message.toJSON().then(jsonStr => {
            res.status(HttpStatus.OK);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.write(jsonStr);
            res.end();
        }).catch(err => {
            logger.error('Error serializing message to JSON.');
            logger.error(err);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.write(JSON.stringify({
                'error': true, 'code': 'CH02',
                'message': 'Error converting message to JSON.'
            }));
            res.end();
        });
    }).catch(err => {
        logger.error('Could not save message to the database.');
        logger.error(err);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.write(JSON.stringify({
            'error': true, 'code': 'CH02',
            'message': 'Error saving message to the database.'
        }));
        res.end();
    });
});

module.exports = router;
