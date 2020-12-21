const WebSocket = require('ws');

const STATE_MESSAGE_TYPE = 4;

class Player {
    constructor(ws) {
        this.inputListeners = new Set();
        this.stateListeners = new Set();
        this.ws = ws;
        this.id = ws.id;
        this.ws.on('message', this.handlePlayerInput.bind(this));
    }

    handlePlayerInput(msg) {
        const data = JSON.parse(msg);
        if (!data.type) {
            return;
        }
        
        for (const listener of this.inputListeners) {
            listener.handlePlayerInput(this, data);
        }
    }

    disconnect() {
        for (const listener of this.stateListeners) {
            listener.handlePlayerDisconnect(this);
        }
    }

    receiveStateMessage(messageCode) {
        this.receiveUpdate([STATE_MESSAGE_TYPE, messageCode]);
    }

    addStateListener(listener) {
        this.stateListeners.add(listener);
    }

    addInputListener(listener) {
        this.inputListeners.add(listener);
    }

    receiveUpdate(update) {
        this.ws.readyState === WebSocket.OPEN && this.ws.send(update);
    }

}

module.exports = Player;
