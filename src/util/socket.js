const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const https = require('https');
const assert = require('assert');
const Player = require('../Player');
const config = require('../../config');
const { login, promptLogin, verifyAccessToken, storeTokens, linkInit, getLoginInfo, guaranteeCerts, refreshAccessToken } = require('homegames-common');

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

    getServer().then(server => {
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
//                 playerIds[ws.id] = false;
                 gameSession.handlePlayerDisconnect(ws.id);
                 
             }

             ws.on('close', closeHandler);

         });
         
         server.listen(port, null, null, () => {
             cb && cb();
         });
    });
};

const getServer = () => new Promise((resolve, reject) => {
    if (config.ACCOUNT_ENABLED) {
        getLoginInfo(config.AUTH_DATA_PATH).then(info => {
            verifyAccessToken(info.username, info.tokens.accessToken).then(() => {
                refreshAccessToken(info.username, info.tokens).then(newTokens => {
                    storeTokens(config.AUTH_DATA_PATH, info.username, newTokens).then(() => {
                        guaranteeCerts(config.AUTH_DATA_PATH, config.CERT_DATA_PATH).then(certPaths => {
                            const options = {
                                key: fs.readFileSync(certPaths.keyPath).toString(),
                                cert: fs.readFileSync(certPaths.certPath).toString()
                            };

                            server = https.createServer(options);
                            resolve(server);
                        });
                    });
                })
            }).catch(err => {
                promptLogin().then((info) => {
                    login(info.username, info.password).then((tokens) => {
                        storeTokens(config.AUTH_DATA_PATH, info.username, tokens).then(() => {
                            guaranteeCerts(config.AUTH_DATA_PATH, config.CERT_DATA_PATH).then(certPaths => {
                                const options = {
                                    key: fs.readFileSync(certPaths.keyPath).toString(),
                                    cert: fs.readFileSync(certPaths.certPath).toString()
                                };

                                server = https.createServer(options);
                                resolve(server);
                            });
                        });
                    });
                });
            });
        }).catch(err => {
            promptLogin().then((info) => {
                login(info.username, info.password).then((tokens) => {
                    storeTokens(config.AUTH_DATA_PATH, info.username, tokens).then(() => {
                        guaranteeCerts(config.AUTH_DATA_PATH, config.CERT_DATA_PATH).then(certPaths => {
                            const options = {
                                key: fs.readFileSync(certPaths.keyPath).toString(),
                                cert: fs.readFileSync(certPaths.certPath).toString()
                            };

                            server = https.createServer(options);
                            resolve(server);
                        });
                    });
                });
            });

        });
    } else if (config.CERT_DATA_PATH) {
        const options = {
            key: fs.readFileSync(config.CERT_DATA_PATH + '/key.pem').toString(),
            cert: fs.readFileSync(config.CERT_DATA_PATH + '/cert.pem').toString()
        };

        server = https.createServer(options);
        resolve(server);
    }
    else {
        server = http.createServer();
        resolve(server);
    }

 
});


module.exports = {
    socketServer
};

