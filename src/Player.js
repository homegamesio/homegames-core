const WebSocket = require('ws');
const http = require('http');

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue, log } = require('homegames-common');

let id = 0;

class Player {
    constructor(ws, playerInfo, spectating, clientInfo, requestedGame, remoteClient) {
        this.inputListeners = new Set();
        this.stateListeners = new Set();
        this.clientInfo = clientInfo || {};
        this.ws = ws;
        this.id = ws?.id || ++id;
        this.info = playerInfo || {};
        this.spectating = spectating;
        this.remoteClient = remoteClient || false;

        this.requestedGame = requestedGame;

        this.ws?.on('message', (input) => {
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
                log.error('client ws error', err);
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
            listener.handlePlayerInput(this.id, data);
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
