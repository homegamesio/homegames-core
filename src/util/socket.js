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

const { getConfigValue } = require(`${baseDir}/src/util/config`);

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



const socketServer = (gameSession, port, cb = null, certPath = null) => {
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

    let server;

    if (certPath) {
        server = https.createServer({
            key: fs.readFileSync(certPath.keyPath).toString(),
            cert: fs.readFileSync(certPath.certPath).toString()
        });
    } else { 
        console.log('uhhhhh its not secure');
        server = http.createServer();
    }

    const wss = new WebSocket.Server({
        server
    });
    
    wss.on('connection', (ws) => {
        function messageHandler(msg) {
            const jsonMessage = JSON.parse(msg);

            assert(jsonMessage.type === 'ready');

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
                    const player = new Player(ws, jsonMessage.spectating, jsonMessage.clientInfo && jsonMessage.clientInfo.clientInfo, requestedGame);
                    ws.spectating = jsonMessage.spectating;
                    
                    // if (jsonMessage.id && playerInfo.name) {
                    //     player.name = playerInfo.name;
                    // }{}
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

                    // init message
                    ws.send([2, ws.id, aspectRatio.x, aspectRatio.y, BEZEL_SIZE_X, BEZEL_SIZE_Y, ...squishVersionArray]);

                    if (PERFORMANCE_PROFILING) {
                        ws.send([7]);
                    }
                    if (HOTLOAD_ENABLED) {
                        console.log("SENDING HOTLOAD");
                        ws.send([8, 71, 01]);
                    }
                    const _player = listenable(player, () => {
                        player.updatePlayerInfo();
                    });

                    if (jsonMessage.spectating) {
                        gameSession.addSpectator(_player);
                    } else {
                        gameSession.addPlayer(_player);
                    }

                });
            });
            req.end();
        }

        ws.on('message', messageHandler);

        function closeHandler() {
            //            playerIds[ws.id] = false;
            if (ws.spectating) {
                gameSession.handleSpectatorDisconnect(ws.id);
            } else {
                gameSession.handlePlayerDisconnect(ws.id);
            }
            
        }

        ws.on('close', closeHandler);

    });

    wss.on('error', (wat) => {
        console.log('watff');
        console.log(wat);
    })

    
    server.listen(port, null, null, () => {
        cb && cb();
    });
};


module.exports = {
    socketServer
};

