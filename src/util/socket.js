const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const assert = require('assert');
const Player = require('../Player');
const fs = require('fs');
const os = require('os');
const path = require('path');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue, log, getUserHash } = require('homegames-common');

const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
const BEZEL_SIZE_X = getConfigValue('BEZEL_SIZE_X', 15);
const _BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 15);
const PERFORMANCE_PROFILING = getConfigValue('PERFORMANCE_PROFILING', false);
const HOTLOAD_ENABLED = getConfigValue('HOTLOAD_ENABLED', false);
const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);
const BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 15);


const getLocalIP = () => {
    const ifaces = os.networkInterfaces();
    let localIP;

    Object.keys(ifaces).forEach((ifname) => {
        ifaces[ifname].forEach((iface) => {
            if ('IPv4' !== iface.family || iface.internal) {
                return;
            }
            localIP = localIP || iface.address;
        });
    });

    return localIP;
};

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
        },
        ayy() {
            console.log('i am ayy');
        }
    };

    return new Proxy(obj, handler);
};

let _playerIds = {};

for (let i = 1; i < 256; i++) {
    _playerIds[i] = false;
}

const generatePlayerId = () => {

    for (const k in _playerIds) {
        if (_playerIds[k] === false) {
            _playerIds[k] = true;
            return Number(k);
        }
    }

    throw new Error('no player IDs left in pool');
};

const broadcast = (gameSession) => {
    const proxyServer = new WebSocket('wss://public.homegames.link:81');

    proxyServer.on('open', () => {
        log.info('Opened connection to proxy server');
    });

    proxyServer.on('error', (err) => {
        log.error(err);
        log.info('Unable to connect to proxy server. Public games will be unavailable.');
    });

    const internalId = 1;
    const playerIdMap = {};

    const clientInfoMap = {};
    proxyServer.on('message', (msg) => {
        if (msg.startsWith && msg.startsWith('idreq-')) {
            const proxyClientId = msg.substring(6);
            const clientId = generatePlayerId();
            proxyServer.send('idres-' + proxyClientId + '-' + clientId);
        } else if (msg.startsWith && msg.startsWith('close-')) {
            const pieces = msg.split('-');
            const clientId = pieces[1];
            
            if (gameSession.spectators[clientId]) {
                gameSession.handleSpectatorDisconnect(clientId);
            } else {
                gameSession.handlePlayerDisconnect(clientId);
            }
            delete _playerIds[clientId];
        } else {
            let isJson = msg.startsWith;
            let sentPlayerId;
            if (!isJson) {
                const ting = msg.slice(1);
                
                // TODO: encode all json this way from broadcast server to remove this check   
                try {
                    JSON.parse(ting);
                    sentPlayerId = msg[0];
                    msg = ting;
                    isJson = true;
                } catch (err) {

                }
            }
            if (isJson) {
                const jsonMessage = JSON.parse(msg);
                if (jsonMessage.type === 'ready') {
                    const clientId = jsonMessage.id;
                    const requestedGame = jsonMessage.clientInfo && jsonMessage.clientInfo.requestedGame;
                    const playerInfo = {};
                    const fakeWs = {
                        readyState: WebSocket.OPEN,
                        send: (s) => {
                            proxyServer.send([199, clientId, ...s]);
                        },
                        on: (input) => {
                        },
                        id: clientId
                    };

                    const player = new Player(fakeWs, playerInfo, jsonMessage.spectating, jsonMessage.clientInfo && jsonMessage.clientInfo.clientInfo, requestedGame, true);
                    
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

                    if (jsonMessage.spectating) {
                        gameSession.addSpectator(player);
                    } else {
                        gameSession.addPlayer(player);
                    }
                } else if(jsonMessage.type === 'code') {
                    const code = jsonMessage.code;
                    gameSession.setServerCode(code);
                } else {
                    if (jsonMessage.clientInfo) {
                        clientInfoMap[sentPlayerId] = jsonMessage.clientInfo;                            
                    } else {
                        gameSession.handlePlayerInput(sentPlayerId, jsonMessage);
                    }
                }
            } 
        }
    });
}

const socketServer = (gameSession, port, cb = null, certPath = null, username = null) => {

    let server;

    if (certPath) {
        server = https.createServer({
            key: fs.readFileSync(`${certPath}/homegames.key`).toString(),
            cert: fs.readFileSync(`${certPath}/homegames.cert`).toString()
        });
    } else { 
        log.info('Starting regular server on port ' + port);
        server = http.createServer();
    }

    const wss = new WebSocket.Server({
        server
    });


    const broadcastEnabled = !!getConfigValue('PUBLIC_GAMES', false);
    log.info('broadcastEnabled: ' + broadcastEnabled);

    if (broadcastEnabled) {
        broadcast(gameSession);
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
                const req = (HTTPS_ENABLED ? https : http).request({
                    hostname: HTTPS_ENABLED && username ? (getUserHash(username + getLocalIP()) + '.homegames.link') : 'localhost',
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

