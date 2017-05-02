/**
 * App routes and handling functions.
 */

var express = require('express');
var passport = require('passport');

var router = express.Router();

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
            res.status(401);
            // Info is what is passed as an argument to done() in callback of passport.use.
            res.render('login', {error: info});
            return;
        }

        req.logIn(user, function (err) {
            if (err) {
                res.status(401);
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

module.exports = router;
