/**
 * Logging configuration with winston.
 */

var winston = require('winston');

let config = {
    id: 'chat-logger',
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        new winston.transports.Console({colorize: true, label: 'chatapp'})
    ]
};

let logger = new winston.Logger(config);

module.exports = logger;
