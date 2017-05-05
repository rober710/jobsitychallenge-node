/* Chat page functions */

var Chat = {
    messageToSend: '',

    init: function() {
        this.$chatHistory = $('.chat-history');
        this.$button = $('button');
        this.$textarea = $('#message-to-send');
        this.$chatHistoryList = this.$chatHistory.find('ul');
        this.$extraMsg = $('#extra-msg');
        this.$userList = $('#user-list');
        this.myUserId = $('#user_id').val();
        this.messagesUrl = $('#messages_url').val();
        this.updatesUrl = $('#updates_url').val();
        this.onlineUrl = $('#online_url').val();
        this.lastTimestamp = null;
        this.updatesTimer = null;
        this.updateOnlineTimer = null;

        var location = window.location.host;
        var scheme = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        var that = this;

        this._ws = new WebSocket(scheme + location + '/messages', 'json');
        this._ws.addEventListener('open', function (e) {
            that._ready = true;
            that._ws.addEventListener('message', $.proxy(that._handleWsMessage, that));
        });
        this._ws.addEventListener('close', function (code, reason, wasClean) {
            // TODO: try to reconnect?
            that._ready = false;
            console && console.log('Server connection closed.', code, reason);
        });
        this._ws.addEventListener('error', function (e) {
            console && console.error(e);
        });

        this.$button.on('click', $.proxy(this.sendMessage, this));
        this.$textarea.on('keyup', function (event) {
            if (event.keyCode === 13) {
                // enter was pressed
                that.sendMessage();
            }
        });

        this.render();
    },

    render: function() {
        var thisInstance = this;
        $.ajax({
            url: this.messagesUrl,
            type: 'GET',
            dataType: 'json'
        }).done(function(response) {
            if ($.isArray(response)) {
                for(var i = 0; i < response.length; i++) {
                    thisInstance.$chatHistoryList.append(thisInstance._createMessageMarkup(response[i]));
                    thisInstance.lastTimestamp = response[i].timestamp;
                }

                thisInstance.scrollToBottom();
                thisInstance.$textarea.val('');
            }
            // Activar el timer que consulta al servidor por mensajes nuevos.
            //thisInstance.updatesTimer = setInterval($.proxy(thisInstance.getUpdates, thisInstance), 1000);
        }).fail(function(jqxhr) {
            if (jqxhr.responseJSON && jqxhr.responseJSON.message) {
                thisInstance.$extraMsg.text(jqxhr.responseJSON.message);
            }
            thisInstance.$textarea.val('');
        });

        this.getOnlineUsers();
    },

    getUpdates: function() {
        var thisInstance = this;
        this.$extraMsg.empty();
        $.ajax({
            url: this.updatesUrl,
            type: 'GET',
            dataType: 'json',
            data: {
                last_t: this.lastTimestamp || ''
            }
        }).done(function(response) {
            if ($.isArray(response)) {
                for (var i = 0; i < response.length; i++) {
                    var message = response[i];
                    thisInstance.$chatHistoryList.append(thisInstance._createMessageMarkup(message));
                    thisInstance.scrollToBottom();
                    if (message.type == 'message') {
                        thisInstance.lastTimestamp = message.timestamp;
                    }
                }
            }
        }).fail(function(jqxhr) {
            if (jqxhr.responseJSON && jqxhr.responseJSON.message) {
                thisInstance.$extraMsg.text(jqxhr.responseJSON.message);
            } else {
                console && console.log(jqxhr.responseText);
            }
            thisInstance.$textarea.val('');
        });
    },

    renderMessage: function(messageInfo) {
        var item = this._createMessageMarkup(messageInfo);
        this.$chatHistoryList.append(item);
        this.scrollToBottom();
        this.lastTimestamp = messageInfo.timestamp;
        this.$textarea.val('');
    },

    _renderCommandResponse(result) {
        if ($.isArray(result)) {
            for (var i = 0; i < result.length; i++) {
                var message = result[i];
                this.$chatHistoryList.append(this._createMessageMarkup(message));
            }
            this.scrollToBottom();
        } else {
            console && console.error('Unexpected command result format.', result);
        }
    },

    getOnlineUsers: function() {
        var thisInstance = this;
        $.ajax({
            url: this.onlineUrl,
            type: 'GET',
            dataType: 'json'
        }).done(function(userList) {
            thisInstance.$userList.empty();
            if ($.isArray(userList)) {
                $.each(userList, function(index, userInfo) {
                    thisInstance.$userList.append(thisInstance._createOnlineUserEntry(userInfo));
                });
            }
        });
    },

    /**
     * Creates the DOM nodes for a message.
     * @param messageInfo Object with the information of the message to create.
     * @private
     */
    _createMessageMarkup: function(messageInfo) {
        // Was the message mine?
        var mine = this.myUserId === messageInfo.user.id;

        var item = $('<li/>');

        if (mine) {
            item.addClass('clearfix');
        }

        var header = $('<div/>').addClass('message-data');
        var date = moment(messageInfo.timestamp);

        if (mine) {
            header.addClass('align-right');
            header.append($('<span/>').addClass('message-data-time').text(date.format('LLL')));
            header.append($('<span/>').addClass('message-data-name').text(messageInfo.user.username));
            header.append($('<i class="fa fa-circle me"></i>'));
        } else {
            header.append($('<span/>').addClass('message-data-name').append(
                $('<i class="fa fa-circle online"></i>')).text(messageInfo.user.username));
            header.append($('<span/>').addClass('message-data-time').text(date.format('LLL')));
        }

        header.appendTo(item);
        var content = $('<div/>').attr('class', 'message ' + (mine ? 'other-message float-right'
            : 'my-message'));
        content.text(messageInfo.text);
        content.appendTo(item);

        return item;
    },

    _createOnlineUserEntry: function(onlineUserInfo) {
        var item = $('<li/>').addClass('clearfix');
        item.append($('<img/>').attr({
            src: '/img/user_avatar.png',
            alt: onlineUserInfo.name
        }));
        var about = $('<div/>').addClass('about');
        about.append($('<div/>').addClass('name').text(onlineUserInfo.name));
        about.append($('<div/>').addClass('status').append($('<i/>').addClass('fa fa-circle online'))
            .text('En línea'));

        about.appendTo(item);
        return item;
    },

    /**
     * Sends the contents of the textarea to the server.
     */
    sendMessage: function() {
        if (!this._ready) {
            console && console.log('Cannot send message because websocket is not ready.');
            return;
        }

        var text = this.$textarea.val().trim();

        if (!text) {
            return;
        }

        this._ws.send(JSON.stringify({
            type: 'chat',
            text: text
        }));

        this.$textarea.val('');
        this.$extraMsg.empty();
    },

    /**
     * Handles a message received from the websocket.
     * @param e MessageEvent containing information about the message as well as its data.
     * @private
     */
    _handleWsMessage(e) {
        let data = e.data;
        // data is always assumed to be a JSON string.
        try {
            data = JSON.parse(data);
        } catch (err) {
            console && console.error(err);
            this.$extraMsg.text('Could not read response from server!');
            return;
        }

        if (data.error) {
            if (data.message) {
                this.$extraMsg.text(data.message);
            } else {
                this.$extraMsg.text('Unexpected error on message received from server.');
            }

            console && console.error(data);
            return;
        } else if (!data.type) {
            console && console.error('Unexpected response format');
            return;
        }

        switch (data.type) {
            case 'chat':
                this.renderMessage(data.message);
                break;
            case 'command':
                this._renderCommandResponse(data.result);
                break;
            default:
                console && console.warn('Unexpected message type: ' + data.type);
        }
    },

    scrollToBottom: function() {
        this.$chatHistory.scrollTop(this.$chatHistory[0].scrollHeight);
    }
};

$(function() {
    Chat.init();

    var searchFilter = {
        options: {valueNames: ['name']},
        init: function() {
            var userList = new List('people-list', this.options);
            var noItems = $('<li id="no-items-found">No items found</li>');

            userList.on('updated', function(list) {
                if (list.matchingItems.length === 0) {
                    $(list.list).append(noItems);
                } else {
                    noItems.detach();
                }
            });
        }
    };

    searchFilter.init();
});
