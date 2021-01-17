const WebSocket = require('ws');
const http = require('http');
const assert = require('assert');
const Player = require('../Player');
const config = require('../../config');

const listenable = function(obj, onChange) {
    const handler = {
        get(target, property, receiver) {
            return Reflect.get(target, property, receiver);
        },
        defineProperty(target, property, descriptor) {
            const change = Reflect.defineProperty(target, property, descriptor);
            onChange && onChange();
            return change;
        },
        deleteProperty(target, property) {
            const change = Reflect.deleteProperty(target, property);
            onChange && onChange();
            return change;
        }
    };

    return new Proxy(obj, handler);
};



const socketServer = (gameSession, port, cb = null) => {
    const playerIds = {};

    for (let i = 1; i < 256; i++) {
        playerIds[i] = false;
    }

    const generatePlayerId = () => {
        for (const k in playerIds) {
            if (playerIds[k] === false) {
                playerIds[k] = true;
                return Number(k);
            }
        }

        throw new Error('no player IDs left in pool');
    };

    const server = http.createServer();

    const wss = new WebSocket.Server({
        server
    });
    
    wss.on('connection', (ws) => {
        function messageHandler(msg) {
            const jsonMessage = JSON.parse(msg);

            assert(jsonMessage.type === 'ready');

            ws.removeListener('message', messageHandler);

            ws.id = Number(jsonMessage.id || generatePlayerId());

            const updatePlayerInfo = (_player) => {

                const data = JSON.stringify({
                    'name': _player.name 
                });

                const req = http.request({hostname: 'localhost', port: config.HOMENAMES_PORT, path: '/' + ws.id, method: 'POST', headers: {'Content-Type': 'application/json', 'Content-Length': data.length}}, res => {
                });
                req.write(data);
                req.end();
            }

            const req = http.request({
                hostname: 'localhost',
                port: config.HOMENAMES_PORT,
                path: `/${ws.id}`,
                method: 'GET'
            }, res => {
                res.on('data', d => {
                    const playerInfo = JSON.parse(d);
                    const player = new Player(ws, ws.id);
                    
                    if (jsonMessage.id && playerInfo.name) {
                        player.name = playerInfo.name;
                    }
                    const aspectRatio = gameSession.aspectRatio;

                    // init message
                    ws.send([2, ws.id, aspectRatio.x, aspectRatio.y]);
                    const _player = listenable(player, () => {
                        updatePlayerInfo(_player);
                    });

                    gameSession.addPlayer(_player);

                });
            });
            req.end();
        }

        ws.on('message', messageHandler);

        function closeHandler() {
//            playerIds[ws.id] = false;
            gameSession.handlePlayerDisconnect(ws.id);
            
        }

        ws.on('close', closeHandler);

    });
    
    server.listen(port, null, null, () => {
        cb && cb();
    });
};


module.exports = {
    socketServer
};

