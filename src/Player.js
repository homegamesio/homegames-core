const WebSocket = require("ws");
const uuid = require("uuid");

class Player {
    constructor(ws) {
        this.inputListeners = new Set();
        this.stateListeners = new Set();
        this.ws = ws;
        this.id = uuid();
        this.ws.on("message", this.handlePlayerInput.bind(this));
        this.ws.on("close", this.disconnect.bind(this));
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

    receiveUpdate(update) {
        this.ws.readyState === WebSocket.OPEN && this.ws.send(update);
    }

}

module.exports = Player;
