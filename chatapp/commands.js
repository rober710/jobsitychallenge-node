/**
 * Command handler functions.
 */

function stock(connector, argument) {
    let message = {
        type: 'stock',
        arg: argument
    };

    return connector.sendMessage(message).then(response => {
        // Format message as expected from the frontend.
        return [{'text': response['message'], 'user': {'id': 0, 'username': 'Bot'},
            'type': 'command', 'error': false,
            'timestamp': new Date().toISOString()}]
    });
}

function dayRange(connector, arg) {
    // We can query many codes at once. Check to see if many were sent.
    let companies = null;

    if (arg.includes(',')) {
        companies = arg.split(',').map(item => item.trim());
    } else {
        companies = arg;
    }

    let message = {
        type: 'day_range',
        arg: companies
    };

    return connector.sendMessage(message).then(response => {
        let results = response.results;
        let messages = [];

        for (let result of results) {
            if (result.error) {
                messages.push({
                    text: result.message, user: {id: 0, username: 'Bot'},
                    timestamp: new Date().toISOString(), error: true
                });
            } else {
                messages.push({
                    text: result.message, user: {id: 0, username: 'Bot'}, error: false,
                    timestamp: new Date().toISOString()
                });
            }
        }

        return messages;
    });
}

module.exports = {
    stock,
    'day_range': dayRange
};
