/**
 * Server of the bot. This module connects to the RabbitMQ Queue in order to listen to requests and to
 * answer them.
 */

var amqp = require('amqplib');
var adapter = require('./api-adapter');
var ApiError = require('./errors').ApiError;
var logger = require('./logging');

const defaultOptions = {
    url: 'amqp://localhost',
    requestQueueName: 'bot_requests',
    responseQueueName: 'bot_responses',
    reconnectRetries: 3
};

class BotServer {
    constructor(options) {
        options = options || {};
        this._options = Object.assign({}, defaultOptions, options);
        this._connection = null;
        this._requestChannel = null;
        this._responseChannel = null;
        this._retryCount = 0;
        this._ready = false;
    }

    initialize() {
        logger.info(`Connecting to ${this._options.url}...`);
        let promiseConn = amqp.connect(this._options.url).then((connection) => {
            // Attach error handlers to the connection
            connection.on('error', (err) => {
                // TODO: Check in which cases this can happen and how to handle them.
                logger.error(err);
            });

            connection.on('close', () => {
                logger.info('Connection closed.');
                this._ready = false;
            });

            logger.info(`Connected to RabbitMQ at ${this._options.url}`);
            this._connection = connection;
            return connection;
        }, (err) => {
            logger.error(err);
            if (this._retryCount < this._reconnectRetries) {
                logger.error("An error occurred while trying to connect to RabbitMQ. Retrying...");
                this._retryCount++;
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        this.initialize(url).then(resolve).catch(reject);
                    }, 500);
                });
            } else {
                throw new Error(`Could not connect to RabbitMQ after ${reconnectRetries + 1} attempts.`);
            }
        });

        let reqChann = promiseConn.then((connection) => connection.createChannel()).then((channel) => {
            this._requestChannel = channel;
            channel.prefetch(1);
            return channel.assertQueue(this._options.requestQueueName).then(() => {
                channel.consume(this._options.requestQueueName, this.processMessage.bind(this), { noAck: true });
                logger.info(`Ready to receive messages in the ${this._options.requestQueueName} queue.`);
                return channel;
            });
        });

        let resChann = promiseConn.then((connection) => connection.createChannel()).then((channel) => {
            this._responseChannel = channel;
            return channel.assertQueue(this._options.responseQueueName).then(() => {
                logger.info(`Ready to send responses through the ${this._options.responseQueueName} queue.`);
                return channel;
            });
        });

        return Promise.all([reqChann, resChann]).then(() => {
            this._ready = true;
        });
    }

    processMessage(message) {
        if (!this._ready) {
            logger.error('Message received but server cannot process requests or send responses at this time.');
            return;
        }

        logger.info(`Message (corrId=${message.properties.correlationId}) received by the bot.`);
        if (logger.debug) {
            logger.debug(message.content.toString(), {corrId: message.properties.correlationId});
        }

        let content = '';
        try {
            content = JSON.parse(message.content.toString());
        } catch (err) {
            logger.error(`Error parsing message sent to bot (corrId=${message.properties.correlationId}).`);
            logger.error(err);
            this._sendResponse(BotServer._createErrorResponse('Message is not a valid JSON object string.',
                'BOT01'), message.properties.correlationId);
            return;
        }

        // Messages are expected to be JSON objects, so we can retrieve the type of request being made.
        if (!content.type) {
            this._sendResponse(BotServer._createErrorResponse('Message seems to be an invalid JSON object.',
                'BOT01'), message.properties.correlationId);
            return;
        }

        // Check if the api adapter contains a handler for the message type received.
        let commandHandler = adapter[content.type];
        if (!commandHandler) {
            this._sendResponse(BotServer._createErrorResponse(`Command ${content.type} not recognized.`,
                'BOT02'), message.properties.correlationId);
            return;
        }

        commandHandler(content.arg || null).then((responseObj) => {
            this._sendResponse(responseObj, message.properties.correlationId);
        }).catch((error) => {
            logger.error(error);
            if (error instanceof ApiError) {
                this._sendResponse(BotServer._createErrorResponse(error.message, error.code),
                    message.properties.correlationId);
            } else if (error.message) {
                this._sendResponse(BotServer._createErrorResponse(error.message), message.properties.correlationId);
            } else {
                this._sendResponse(BotServer._createErrorResponse(error), message.properties.correlationId);
            }
        });
    }

    _sendResponse(content, correlationId) {
        if (!this._ready) {
            logger.error('Server cannot send responses at this time.');
            return;
        }

        logger.info(`Sending response to message corrId=${correlationId}.`);
        logger.debug && logger.debug(JSON.stringify(content), {corrId: correlationId});

        let response = null;
        try {
            response = JSON.stringify(content);
        } catch (err) {
            logger.error(`Could not serialize response for messageId=${correlationId}.`);
            logger.error(err);
            response = BotServer._createErrorResponse('Non serializable response.', 'BOT01');
        }

        this._responseChannel.sendToQueue(this._options.responseQueueName,
            Buffer.from(response, 'utf8'), {
                contentType: 'application/json',
                contentEncoding: 'UTF-8',
                correlationId: correlationId
        });
    }

    static _createErrorResponse(message, code = null) {
        let responseObj = {error: true, message};
        if (code) {
            responseObj.code = code;
        }
        return responseObj;
    }
}

var server = new BotServer();

function start() {
    server.initialize().then(() => {
        // Temp code to test sending messages through RabbitMQ.
        let reqChannel = null;
        let conn = amqp.connect('amqp://localhost').then((connection) => connection.createChannel())
            .then((channel) => {reqChannel = channel; return channel.assertQueue('bot_requests'); }).then((okData) => {
                reqChannel.sendToQueue('bot_requests', Buffer.from(JSON.stringify({type: 'day_range', arg: ['AAPL', 'APPL']}), 'utf8'), {
                    contentType: 'application/json',
                    contentEncoding: 'UTF-8',
                    correlationId: '465464-dfje546w4e31we65w464'
                });
            });
    }).catch((err) => {
        logger.error(err);
        process.exit(1);
    });
}

// Setup global error handlers:
process.on('uncaughtException', (err) => {
    logger.error('Uncaught error detected!', err);
    process.exit(1);
});

process.on('unhandledRejection', function (reason, promise) {
    logger.error('Unhandled rejection detected!', {reason, promise});
});

if (require.main === module) {
    logger.info('Starting server process...');
    start();
}