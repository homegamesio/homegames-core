const WebSocket = require('ws');
const uuid = require('uuid');

class Player {
    constructor(ws) {
        this.inputListeners = new Set();
        this.ws = ws;
        this.id = uuid();
        this.ws.on('message', this.handlePlayerInput.bind(this));
        this.ws.on('close', this.disconnect.bind(this));
    }

    handlePlayerInput(msg) {
        const data = JSON.parse(msg);
        if (!data.type) {
            console.log(data);
            return;
        }
        
        for (let listener of this.inputListeners) {
            listener.handlePlayerInput(this, data);
        }
    }

    disconnect() {
        // handle cleanup here. will probably need to notify listeners. too many listeners.
    }

    addInputListener(listener) {
        this.inputListeners.add(listener);
    }

    receiveUpdate(update) {
        this.ws.readyState === WebSocket.OPEN && this.ws.send(update);
    }

}

module.exports = Player;
