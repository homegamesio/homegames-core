const WebSocket = require('ws');
const http = require('http');

const path = require('path');
const { getConfigValue } = require(`${path.resolve()}/src/util/config`);

const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
class Player {
    constructor(ws, spectating, clientInfo, requestedGameId) {
        this.inputListeners = new Set();
        this.stateListeners = new Set();
        this.clientInfo = clientInfo;
        this.ws = ws;
        this.id = ws.id;
        this.info = {};
        this.spectating = spectating;

        console.log('requested game id');
        console.log(requestedGameId);
        this.requestedGameId = requestedGameId;

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

    updatePlayerInfo() {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                info: this.info
            });
                // 'name': _player.name.
                // clientInfo,
                // id: _player.id
            // });

            const req = http.request({
                hostname: 'localhost', 
                port: HOMENAMES_PORT, 
                path: '/' + this.id, 
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json', 
                    'Content-Length': data.length
                }
            }, 
            res => {
                resolve();
            });

            req.write(data);
            req.end();
        });
    };

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
