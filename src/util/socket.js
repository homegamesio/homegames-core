const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const assert = require('assert');
const Player = require('../Player');
const fs = require('fs');

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue, log } = require('homegames-common');

const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
const BEZEL_SIZE_X = getConfigValue('BEZEL_SIZE_X', 15);
const _BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 15);
const PERFORMANCE_PROFILING = getConfigValue('PERFORMANCE_PROFILING', false);
const HOTLOAD_ENABLED = getConfigValue('HOTLOAD_ENABLED', false);

const BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 15);

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

const playerDataPath = baseDir + (baseDir.endsWith('/') ? '' : '/') + 'player-ids.json';

if (fs.existsSync(playerDataPath)) {
    console.log('deleting old player data');
    // fs.unlinkSync(playerDataPath);
}

const generatePlayerId = () => {
    let data = {};
    if (fs.existsSync(playerDataPath)) {
        data = JSON.parse(fs.readFileSync(playerDataPath));
    } else {
        for (let i = 1; i < 256; i++) {
            data[i] = false;
        }
    }

    for (const k in data) {
        if (data[k] === false) {
            data[k] = true;
            fs.writeFileSync(playerDataPath, JSON.stringify(data));
            console.log('returning id ' + k);
            return Number(k);
        }
    }

    throw new Error('no player IDs left in pool');
};

const socketServer = (gameSession, port, cb = null, certPath = null) => {

    let server;

    if (certPath) {
        server = https.createServer({
            key: fs.readFileSync(certPath.keyPath).toString(),
            cert: fs.readFileSync(certPath.certPath).toString()
        });
    } else { 
        log.info('Starting regular server on port ' + port);
        server = http.createServer();
    }

    const wss = new WebSocket.Server({
        server
    });


    const broadcastEnabled = !!getConfigValue('PUBLIC_GAMES', false);
    console.log('broadcastEnabled ? ' + broadcastEnabled);

    if (broadcastEnabled) {
        const proxyServer = new WebSocket('wss://public.homegames.link:81');

        proxyServer.on('open', () => {
            console.log('just connected to proxy server');
        });

        const internalId = 1;
        const playerIdMap = {};
        // todo: track ids
        let proxyPlayer = null;
        proxyServer.on('message', (msg) => {
            if (msg.startsWith && msg.startsWith('gimmeid-')) {
                const proxyClientId = msg.substring(8);
                const clientId = generatePlayerId();
                proxyServer.send('gimmeidresponse-' + proxyClientId + '-' + clientId);
            } else {
                const jsonMessage = JSON.parse(msg);
                if (jsonMessage.type === 'ready') {
                    const clientId = jsonMessage.id;
                    const requestedGame = jsonMessage.clientInfo && jsonMessage.clientInfo.requestedGame;
                    const playerInfo = {};
                    const fakeWs = {
                        readyState: WebSocket.OPEN,
                        send: (s) => {
                            console.log('sending a message to proxy server, i think i just need player id: ' + clientId);
                            proxyServer.send([199, clientId, ...s]);
                        },
                        on: () => {

                        },
                        id: clientId
                    };
                    const player = new Player(fakeWs, playerInfo, jsonMessage.spectating, jsonMessage.clientInfo && jsonMessage.clientInfo.clientInfo, requestedGame, true);
                    proxyPlayer = player;

                    const aspectRatio = gameSession.aspectRatio;
                    const gameMetadata = gameSession.gameMetadata;

                    let squishVersion = 'latest';
                    if (gameMetadata && gameMetadata.squishVersion) {
                        squishVersion = gameMetadata.squishVersion;
                    }

                    const squishVersionArray = [];
                    squishVersionArray[0] = squishVersion.length;
                    for (let i = 0; i < squishVersion.length; i++) {
                        squishVersionArray[i + 1] = squishVersion.charCodeAt(i);
                    }

                    proxyServer.send([2, clientId, aspectRatio.x, aspectRatio.y, BEZEL_SIZE_X, BEZEL_SIZE_Y, ...squishVersionArray]);

                    gameSession.addPlayer(player);
                } else if(jsonMessage.type === 'code') {
                    const code = jsonMessage.code;
                    gameSession.setServerCode(code);
                } else {
                    proxyPlayer && proxyPlayer.handlePlayerInput(JSON.stringify(jsonMessage));
                }
            }
        });
    }

    wss.on('connection', (ws) => {
        function messageHandler(msg) {
            const jsonMessage = JSON.parse(msg);

            if (jsonMessage.type === 'homenames_update') {
                gameSession.handlePlayerUpdate(jsonMessage.playerId, { info: jsonMessage.info, settings: jsonMessage.settings });
            } else if (jsonMessage.type === 'ready') {

                ws.removeListener('message', messageHandler);

                ws.id = Number(jsonMessage.id || generatePlayerId());

                const requestedGame = jsonMessage.clientInfo && jsonMessage.clientInfo.requestedGame;
                
                const req = http.request({
                    hostname: 'localhost',
                    port: HOMENAMES_PORT,
                    path: `/info/${ws.id}`,
                    method: 'GET'
                }, res => {
                    res.on('data', d => {
                        const playerInfo = JSON.parse(d);
                        log.debug('player info from homenames for this person', playerInfo);
                        const player = new Player(ws, playerInfo, jsonMessage.spectating, jsonMessage.clientInfo && jsonMessage.clientInfo.clientInfo, requestedGame);
                        ws.spectating = jsonMessage.spectating;
                        
                        const aspectRatio = gameSession.aspectRatio;
                        const gameMetadata = gameSession.gameMetadata;

                        // TODO: remove 'latest'
                        let squishVersion = 'latest';
                        if (gameMetadata && gameMetadata.squishVersion) {
                            squishVersion = gameMetadata.squishVersion;
                        }

                        const squishVersionArray = [];
                        squishVersionArray[0] = squishVersion.length;
                        for (let i = 0; i < squishVersion.length; i++) {
                            squishVersionArray[i + 1] = squishVersion.charCodeAt(i);
                        }

                        // init message
                        ws.send([2, ws.id, aspectRatio.x, aspectRatio.y, BEZEL_SIZE_X, BEZEL_SIZE_Y, ...squishVersionArray]);


                        if (jsonMessage.spectating) {
                            gameSession.addSpectator(player);
                        } else {
                            gameSession.addPlayer(player);
                        }

                    });
                });
                req.end();
            }
        }

        ws.on('message', messageHandler);

        function closeHandler() {
            if (ws.spectating) {
                gameSession.handleSpectatorDisconnect(ws.id);
            } else {
                gameSession.handlePlayerDisconnect(ws.id);
            }
            
        }

        ws.on('close', closeHandler);
        ws.on('error', (err) => {
            log.error('Child session error', err);
        });

    });

    wss.on('error', (wsErr) => {
        log.error('socket error', wsErr);
    });

    
    server.listen(port, null, null, () => {
        cb && cb();
    });
};


module.exports = {
    socketServer
};

