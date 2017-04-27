/**
 * Server of the bot. This module connects to the RabbitMQ Queue in order to listen to requests and to
 * answer them.
 */

var amqp = require('amqplib');
var adapter = require('./api-adapter');
var ApiError = require('./errors').ApiError;

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
        console.log(`Connecting to ${this._options.url}...`);
        let promiseConn = amqp.connect(this._options.url).then((connection) => {
            // Attach error handlers to the connection
            connection.on('error', (err) => {
                // TODO: Check in which cases this can happen and how to handle them.
                console.error(err);
            });

            connection.on('close', () => {
                console.info('Connection closed.');
                this._ready = false;
            });

            console.log(`Connected to RabbitMQ at ${this._options.url}`);
            this._connection = connection;
            return connection;
        }, (err) => {
            console.error(err);
            if (this._retryCount < this._reconnectRetries) {
                console.error("An error occurred while trying to connect to RabbitMQ. Retrying...");
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
                console.log(`Ready to receive messages in the ${this._options.requestQueueName} queue.`);
                return channel;
            });
        });

        let resChann = promiseConn.then((connection) => connection.createChannel()).then((channel) => {
            this._responseChannel = channel;
            return channel.assertQueue(this._options.responseQueueName).then(() => {
                console.log(`Ready to send responses through the ${this._options.responseQueueName} queue.`);
                return channel;
            });
        });

        return Promise.all([reqChann, resChann]).then(() => {
            this._ready = true;
        });
    }

    processMessage(message) {
        if (!this._ready) {
            console.log('Server cannot receive requests or send responses at this time.');
            return;
        }
        // FIXME: Use winston for logging.
        console.log(`Message (corrId=${message.properties.correlationId}) received by the bot: `
            + message.content.toString());

        let content = '';
        try {
            content = JSON.parse(message.content.toString());
        } catch (err) {
            console.error('Error parsing message sent to bot.');
            console.error(err);
            this._sendResponse(this._createErrorResponse('Error when deserializing message received by the bot.',
                'BOT01'), message.properties.correlationId);
            return;
        }

        // Messages are expected to be JSON objects, so we can retrieve the type of request being made.
        if (!content.type) {
            this._sendResponse(this._createErrorResponse('Message seems to be an invalid JSON object.',
                'BOT01'), message.properties.correlationId);
            return;
        }

        // Check if the api adapter contains a handler for the message type received.
        var commandHandler = adapter[content.type];
        if (!commandHandler) {
            this._sendResponse(this._createErrorResponse(`Command ${content.type} not recognized.`,
                'BOT02'), message.properties.correlationId);
            return;
        }

        commandHandler(content.arg || null).then((responseObj) => {
            this._sendResponse(responseObj, message.properties.correlationId);
        }).catch((error) => {
            console.error(error);
            if (error instanceof ApiError) {
                this._sendResponse(this._createErrorResponse(error.message, error.code),
                    message.properties.correlationId);
            } else if (error.message) {
                this._sendResponse(this._createErrorResponse(error.message), message.properties.correlationId);
            } else {
                this._sendResponse(this._createErrorResponse(error), message.properties.correlationId);
            }
        });
    }

    _sendResponse(content, correlationId) {
        console.log(JSON.stringify(content), correlationId);
    }

    _createErrorResponse(message, code = null) {
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
                reqChannel.sendToQueue('bot_requests', Buffer.from(JSON.stringify({type: 'day_range', arg: 'AAPL'}), 'utf8'), {
                    contentType: 'application/json',
                    contentEncoding: 'UTF-8',
                    correlationId: '465464-dfje546w4e31we65w464'
                });
            });
    }).catch((err) => {
        console.log(err);
        process.exit(1);
    });
}

// Setup global error handlers:
process.on('uncaughtException', (err) => {
    console.error('Uncaught error detected!', err);
    process.exit(1);
});

process.on('unhandledRejection', function (reason, promise) {
    console.error('Unhandled rejection detected!', {reason, promise});
});

if (require.main === module) {
    console.log('Starting server process...');
    start();
}