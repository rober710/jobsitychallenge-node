/**
 * Application models.
 */

var bookshelf = require('./setup').bookshelf;

var User = bookshelf.Model.extend({
    tableName: 'users',
    messages: function () {
        return this.hasMany('')
    }
});

var Message = bookshelf.Model.extend({
    tableName: 'messages'
});

module.exports = {
    User,
    Message
};