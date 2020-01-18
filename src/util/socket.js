const WebSocket = require('ws');
const http = require('http');
const assert = require('assert');
const linkHelper = require('../common/util/link-helper');
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

            const gameMetadata = gameSession.game.constructor.metadata && gameSession.game.constructor.metadata();

            const gameResWidth = gameMetadata ? gameMetadata.res.width : config.DEFAULT_GAME_RES_WIDTH;
            const gameResHeight = gameMetadata ? gameMetadata.res.height : config.DEFAULT_GAME_RES_HEIGHT;

            const gameWidth1 = gameResWidth / 100;
            const gameWidth2 = gameResWidth % 100;
            const gameHeight1 = gameResHeight / 100;
            const gameHeight2 = gameResHeight % 100;
            
            // init message
            ws.send([2, ws.id, gameWidth1, gameWidth2, gameHeight1, gameHeight2]);

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

