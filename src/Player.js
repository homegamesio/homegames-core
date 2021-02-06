const WebSocket = require('ws');

class Player {
    constructor(ws, spectating, clientInfo) {
        this.inputListeners = new Set();
        this.stateListeners = new Set();
        this.clientInfo = clientInfo;
        this.ws = ws;
        this.id = ws.id;
        this.spectating = spectating;

        this.ws.on('message', (input) => {
            try {
                const _input = JSON.parse(input);
                if (_input.clientInfo) {
                    this.clientInfo = _input.clientInfo;
                    this.handlePlayerInput(JSON.stringify({
                        type: 'clientInfo',
                        data: _input.clientInfo
                    }));
                } else {
                    this.handlePlayerInput(input);
                }
            } catch (err) {
                console.log('nope');
                console.log(err);
                this.handlePlayerInput(input);
            }
        });
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
