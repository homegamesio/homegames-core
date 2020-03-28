const WebSocket = require('ws');
const http = require('http');
const assert = require('assert');
const linkHelper = require('./link-helper');
const Player = require('../Player');
const config = require('../../config');
const { RTCPeerConnection, RTCSessionDescription } = require('wrtc');

const socketServer = (gameSession, port, cb = null) => {
    linkHelper();

    const clients = {};

    for (let i = 1; i < 256; i++) {
        clients[i] = false;
    }

    const generatePlayerId = (ws) => {
        for (const k in clients) {
            if (clients[k] === false) {
                clients[k] = ws;
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
        ws.id = generatePlayerId(ws);
        function messageHandler(msg) {
            const jsonMessage = JSON.parse(msg);

            if (jsonMessage.type === 'RTCPeerRequest') {
                const connection = new RTCPeerConnection();
                clients[ws.id].rtcConnection = connection;
                connection.addEventListener('icecandidate', ({ candidate }) => {
                    if (!candidate) {
                        ws.send(JSON.stringify({
                            type: 'RTCOffer',
                            offer: connection.localDescription
                        }));
                    }
                });

                const dataChannel = connection.createDataChannel('homegames');
                dataChannel.onopen = () => {
                    clients[ws.id].channel = dataChannel;
                };

                connection.createOffer().then(offer => {
                    const replacedSDP = offer.sdp.replace(/\r\na=ice-options:trickle/g, '');
                    offer.sdp = replacedSDP; 

                    connection.setLocalDescription(offer);
                });
            } else if (jsonMessage.type === 'answer') {

                if (clients[ws.id] && clients[ws.id].rtcConnection) {
                    try {
                        clients[ws.id].rtcConnection.setRemoteDescription(jsonMessage.answer); 
                    } catch(err) {
                        clients[ws.id].connection = null;
                        console.error(err);
                    }
                }
            } else if (jsonMessage.type === 'ready') {
                ws.removeListener('message', messageHandler);    

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
                player.channel = clients[ws.id].channel;
                gameSession.addPlayer(player);
            }
        }

        ws.on('message', messageHandler);

        function closeHandler() {
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

