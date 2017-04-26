/**
 * Server of the bot. This module connects to the RabbitMQ Queue in order to listen to requests and to
 * answer them.
 */

var amqp = require('amqplib');

const defaultOptions = {
    url: 'amqp://localhost',
    requestQueueName: 'bot_requests',
    responseQueueName: 'bot_responses',
    reconnectRetries: 3
};

class ServerConnection {
    constructor(options) {
        options = options || {};
        this._options = Object.assign({}, defaultOptions, options);
        this._connection = null;
        this._requestChannel = null;
        this._responseChannel = null;
        this._retryCount = 0;
        this._ready = false;
    }

    connect() {
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
                        this.connect(url).then(resolve).catch(reject);
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
                'BOT03'), message.properties.correlationId);
            return;
        }

        // Messages are expected to be JSON objects, so we can retrieve the type of request being made.
        if (!content.type) {
            this._sendResponse(this._createErrorResponse('Message seems to be an invalid JSON object.',
                'BOT03'), message.properties.correlationId);
            return;
        }
    }

    _sendResponse(content, correlationId) {

    }

    _createErrorResponse(message, code=null) {
        let responseObj = {error: true, message};
        if (code) {
            responseObj.code = code;
        }
        return responseObj;
    }
}

var serverConnection = new ServerConnection();

function start() {
    serverConnection.connect().then(() => {
        // Temp code to test sending messages through RabbitMQ.
        let reqChannel = null;
        let conn = amqp.connect('amqp://localhost').then((connection) => connection.createChannel())
            .then((channel) => {reqChannel = channel; return channel.assertQueue('bot_requests'); }).then((okData) => {
                reqChannel.sendToQueue('bot_requests', Buffer.from('Nuevo mensaje áéñ!!', 'utf8'), {
                    contentType: 'application/json',
                    contentEncoding: 'UTF-8',
                    correlationId: 'n'
                });
            });
    }).catch((err) => {
        console.log(err);
        process.exit(1);
    });
}

if (require.main === module) {
    console.log('Starting server process...');
    start();
}