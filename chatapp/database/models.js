/**
 * Application models.
 */

var bookshelf = require('./setup').bookshelf;
var logger = require('../logging');
var PasswordManager = require('../util').PasswordManager;

var User = bookshelf.Model.extend({
    tableName: 'users',
    messages: function () {
        return this.hasMany(Message, 'username', 'username')
    },

    /**
     * Checks if the password supplied matches with the one hashed in the database.
     * @param password Password to check if corresponds with the hashed one.
     */
    checkPassword: function (password) {
        // The password in the 'password' field is in bcrypt format.
        let dbPassword = this.get('password');
        if (!dbPassword) {
            logger.warn('Model with empty password!');
            return false;
        }

        try {
            let pm = PasswordManager.fromString(dbPassword);
            return pm.checkPassword(password);
        } catch (err) {
            logger.error(err);
        }

        return false;
    }
});

var Message = bookshelf.Model.extend({
    tableName: 'messages',
    user: function () {
        return this.belongsTo(User, 'username', 'username')
    },
    toJSONObject() {
        return this.related('user').fetch().then(user => {
            return {
                'text': this.get('text'),
                'user': {'id': this.get('username'), 'username': user.get('full_name')},
                'timestamp': this.get('date_posted').toISOString()
            };
        });
    }
});

module.exports = {
    User,
    Message
};
