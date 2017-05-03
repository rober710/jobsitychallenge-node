/**
 * Bot message receiver.
 */

var amqp = require('amqplib');
var uuid = require('uuid/v1');

var logger = require('./logging');

const defaultOptions = {
    url: 'amqp://localhost',
    requestQueueName: 'bot_requests',
    responseQueueName: 'bot_responses',
    reconnectRetries: 3
};

class BotMessageManager {
    constructor(options) {
        options = options || {};
        this._options = Object.assign({}, defaultOptions, options);
        this._connection = null;
        this._requestChannel = null;
        this._responseChannel = null;
        this._retryCount = 0;
        this._ready = false;
        this._promises = {};
    }

    initialize() {
        logger.info(`Connecting to ${this._options.url}...`);
        let promiseConn = amqp.connect(this._options.url).then(connection => {
            connection.on('error', err => {
                logger.error(err);
            });

            connection.on('close', () => {
                logger.info('Connection closed.');
                this._ready = false;
            });

            logger.info(`Connected to RabbitMQ at ${this._options.url}`);
            this._connection = connection;
            return connection;
        }, err => {
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

        let reqChann = promiseConn.then(connection => connection.createChannel()).then(channel => {
            this._requestChannel = channel;
            return channel.assertQueue(this._options.requestQueueName).then(() => {
                logger.info(`Ready to send requests through the ${this._options.requestQueueName} queue.`);
                return channel;
            });
        });

        let resChann = promiseConn.then(connection => connection.createChannel()).then(channel => {
            this._responseChannel = channel;
            channel.prefetch(1);
            return channel.assertQueue(this._options.responseQueueName).then(() => {
                channel.consume(this._options.responseQueueName, this._handleResponse.bind(this), { noAck: true });
                logger.info(`Ready to receive responses from the ${this._options.responseQueueName} queue.`);
                return channel;
            });
        });

        return Promise.all([reqChann, resChann]).then(() => {
            this._ready = true;
        });
    }

    sendMessage(message) {
        if (!this._ready) {
            return Promise.reject({error: true, message: 'Message received but cannot deliver it because server '
                + 'is not ready.'});
        }

        let content = null;

        try {
            content = JSON.stringify(message);
        } catch (err) {
            logger.error(err);
            return Promise.reject({error: true, message: 'Could not serialize message to send to bot.', cause: err});
        }

        let messageId = uuid();
        return new Promise((resolve, reject) => {
            logger.info(`Sending bot request (corrId=${messageId}).`);
            logger.debug && logger.debug(content, {corrId: messageId});
            this._promises[messageId] = {resolve, reject};
            this._requestChannel.sendToQueue(this._options.requestQueueName, Buffer.from(content, 'utf8'), {
                contentType: 'application/json',
                contentEncoding: 'UTF-8',
                correlationId: messageId
            });
        });
    }

    _handleResponse(message) {
        if (!this._ready) {
            logger.error('Message received but handler cannot process responses at this time.');
            return;
        }

        let corrId = message.properties.correlationId;

        logger.info(`Message (corrId=${corrId}) received by the handler.`);
        if (logger.debug) {
            logger.debug(message.content.toString(), {corrId});
        }

        // Look up the pending promise to resolve.
        let promiseHandlers = this._promises[corrId];

        if (!promiseHandlers) {
            logger.error(`Message (corrId=${corrId}) does not correspond to any request made.`);
            return;
        }

        let response = null;

        try {
            response = JSON.parse(message.content.toString());
        } catch (err) {
            logger.error(err);
            promiseHandlers.reject({error: true, message: 'Could not deserialize response from bot.', cause: err});
            return;
        }

        try {
            if (response.error) {
                promiseHandlers.reject(response);
            } else {
                promiseHandlers.resolve(response);
            }
        } finally {
            delete this._promises[corrId];
        }
    }
}

module.exports = {
    BotMessageManager
};
