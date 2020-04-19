const WebSocket = require('ws');
const http = require('http');
const assert = require('assert');
const linkHelper = require('./link-helper');
const Player = require('../Player');
const config = require('../../config');

const socketServer = (gameSession, port, cb = null) => {
    linkHelper();

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
    
            ws.id = generatePlayerId();

            const aspectRatio = gameSession.aspectRatio;

            // init message
            ws.send([2, ws.id, aspectRatio.x, aspectRatio.y]);

            const player = new Player(ws, ws.id);
            gameSession.addPlayer(player);
        }

        ws.on('message', messageHandler);

        function closeHandler() {
            playerIds[ws.id] = false;
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

