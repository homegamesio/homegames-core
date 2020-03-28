const WebSocket = require('ws');

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

    addStateListener(listener) {
        this.stateListeners.add(listener);
    }

    addInputListener(listener) {
        this.inputListeners.add(listener);
    }

    receiveUpdate(update, forceSocket) {
        if (!forceSocket && this.channel && update.length < 16 * 1000 && this.channel.readyState && this.channel.readyState === 'open') {
            this.channel.send(new Uint8ClampedArray(update));
        } else {
            this.ws.readyState === WebSocket.OPEN && this.ws.send(update);
        }
    }

}

module.exports = Player;
