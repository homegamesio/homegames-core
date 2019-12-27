const WebSocket = require("ws");

class Player {
    constructor(ws) {
        this.inputListeners = new Set();
        this.stateListeners = new Set();
        this.dataListeners = new Set();
        this.ws = ws;
        this.id = ws.id;
        this.ws.on("message", this.handlePlayerInput.bind(this));
    }

    handlePlayerInput(msg) {
        if (msg.charAt(0) == "{") {
            const data = JSON.parse(msg);
            if (!data.type) {
                return;
            }
        
            for (const listener of this.inputListeners) {
                listener.handlePlayerInput(this, data);
            }
        } else {
            for (const listener of this.dataListeners) {
                listener.handlePlayerData(this, msg);
            }
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

    addDataListener(listener) {
        this.dataListeners.add(listener);
    }

    receiveUpdate(update) {
        this.ws.readyState === WebSocket.OPEN && this.ws.send(update);
    }

}

module.exports = Player;
