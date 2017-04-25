/**
 * Server of the bot. This module connects to the RabbitMQ Queue in order to listen to requests and to
 * answer them.
 */

var amqp = require('amqplib');

class ServerConnection {
    constructor(url) {
        // TODO: Create a config object to pass all this information?
        this.url = url;
        this.connection = null;
        this.requestChannel = null;
        this.responseChannel = null;
        this.reconnectRetries = 0;
        this._ready = false;
    }

    connect() {
        let promiseConn = amqp.connect(this.url).then((connection) => {
            // Attach error handlers to the connection
            connection.on('error', (err) => {
                // TODO: Check in which cases this can happen and how to handle them.
                console.error(err);
            });

            connection.on('close', () => {
                console.info('Connection closed.');
                this._ready = false;
            });

            console.log('Connected to RabbitMQ.');
            this.connection = connection;
            return connection;
        }, (err) => {
            console.error(err);
            if (reconnectRetries < 3) {
                console.error("An error occurred while trying to connect to RabbitMQ. Retrying...");
                this.reconnectRetries++;
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
            this.requestChannel = channel;
            channel.prefetch(1);
            return channel.assertQueue('bot_requests').then(() => {
                channel.consume('bot_requests', this.processMessage, { noAck: true });
                // TODO: Convert the queue name into a parameter and show it in this informational message.
                console.log('Waiting for messages in the request queue.');
                return channel;
            });
        });

        let resChann = promiseConn.then((connection) => connection.createChannel()).then((channel) => {
            this.responseChannel = channel;
            return channel.assertQueue('bot_responses').then(() => {
                console.log('Connected to the response queue.');
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
    }
}

var serverConnection = new ServerConnection('amqp://localhost');

function start() {
    serverConnection.connect().catch((err) => {
        console.log(err);
        process.exit(1);
    });
}

if (require.main === module) {
    console.log('Starting server process...');
    start();
}