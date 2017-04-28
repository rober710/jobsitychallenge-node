/**
 * Connection setup.
 */

var path = require('path');
var knex = require('knex');
var bookshelf = require('bookshelf');

knex = knex({
    client: 'sqlite3',
    debug: process.env.LOG_LEVEL === 'debug',
    connection: {
        filename: path.join(__dirname, 'chatroom.sqlite3')
    }
});

bookshelf = bookshelf(knex);

module.exports = {
    knex,
    bookshelf
};
