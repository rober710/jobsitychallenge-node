/**
 * Configure winston and export a logger for the bot.
 */

var winston = require('winston');

let config = {
    id: 'bot-logger',
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        new winston.transports.Console({colorize: true, label: 'bot'})
    ]
};

let logger = new winston.Logger(config);

module.exports = logger;
