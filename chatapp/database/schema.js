/**
 * Script to create the database schema for the application.
 */

var logger = require('../logging');

function createSchema(knex) {
    logger.info('Checking database schema...');
    knex.schema.createTableIfNotExists('users', (table) => {
        table.string('username', 50).primary();
        // Passwords are sha-256 hashed, with a 8 character salt.
        table.string('password', 74);
        table.string('full_name', 100);
    }).then();

    knex.schema.createTableIfNotExists('messages', (table) => {
        table.increments().primary();
        table.string('username', 50).references('users.username');
        table.dateTime('date_posted');
        table.text('text');
    }).then();
}

module.exports = createSchema;
