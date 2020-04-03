const WebSocket = require('ws');
const http = require('http');
const assert = require('assert');
const linkHelper = require('./link-helper');
const Player = require('../Player');
const config = require('../../config');

const socketServer = (gameSession, port, cb = null) => {
    linkHelper();

    const clients = {};

    for (let i = 1; i < 256; i++) {
        clients[i] = false;
    }

    const generatePlayerId = () => {
        for (const k in clients) {
            if (clients[k] === false) {
                clients[k] = true;
                return Number(k);
            }
        }

        throw new Error('no player IDs left in pool');
    };

    const server = http.createServer();

    const wss = new WebSocket.Server({
        server
    });

    let hostId;
    
    wss.on('connection', (ws) => {
        ws.id = generatePlayerId();
        clients[ws.id] = {
            socket: ws
        }
        function messageHandler(msg) {
            const jsonMessage = JSON.parse(msg);

            if (jsonMessage.type === 'RTCHostRequest') {
                if (!hostId) {
                    hostId = ws.id;
                    ws.send(JSON.stringify({
                        type: 'RTCHostResponse',
                        success: true
                    }));
                } else {
                    ws.send(JSON.stringify({
                        type: 'RTCHostResponse',
                        success: false
                    }));
                }
            } else if (jsonMessage.type === 'RTCPeerRequest') {
                const peerRequest = jsonMessage;
                peerRequest.targetId = ws.id;
                clients[hostId].socket.send(JSON.stringify(peerRequest));
            } else if (jsonMessage.type === 'RTCOffer') {
                clients[jsonMessage.targetId].socket.send(msg);
            } else if (jsonMessage.type === 'RTCAnswer') {
                const rtcAnswer = jsonMessage;
                rtcAnswer.targetId = ws.id;
                clients[hostId].socket.send(JSON.stringify(rtcAnswer));
            } else if (jsonMessage.type === 'ready') {
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
                clients[ws.id].player = player;
                gameSession.addPlayer(player);
            } else {
                clients[ws.id].player.handlePlayerInput(msg);
            }
        }

        ws.on('message', messageHandler);

        function closeHandler() {
            if (hostId == ws.id) {
                hostId = null;
            }
            clients[ws.id] = false;
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

