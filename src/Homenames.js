const WebSocket = require('ws');
const http = require('http');
const path = require('path');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('/src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require('homegames-common');


class Homenames {
    constructor(port) {
        console.log('running homenames on port ' + port);
        
        this.playerInfo = {};
        this.playerSettings = {};
        this.sessionClients = {};
        this.playerListeners = {};

        const server = http.createServer((req, res) => {
            const reqPath = req.url.split('/');
            if (req.method === 'GET') {
                const playerId = reqPath[reqPath.length - 1];
                if (reqPath[reqPath.length - 2] === 'info') {
                    let payload = {};
                    if (this.playerInfo[playerId]) {
                        payload = this.playerInfo[playerId];
                    } 
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(payload));
                } else if (reqPath[reqPath.length - 2] === 'settings') {
                    let payload = {};
                    if (this.playerSettings[playerId]) {
                        payload = this.playerSettings[playerId];
                    } 
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(payload));
                }

            } else if (req.method === 'POST') {
                const playerId = reqPath[reqPath.length - 2];

                if (reqPath[reqPath.length - 1] === 'info') {
                    let body = '';
                    req.on('data', chunk => {
                        body += chunk.toString(); 
                    });

                    req.on('end', () => {
                        this.playerInfo[playerId] = JSON.parse(body);
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(this.playerInfo[playerId]));
                        this.notifyListeners(playerId);
                    });
                } else if (reqPath[reqPath.length - 1] === 'settings') {
                    let body = '';
                    req.on('data', chunk => {
                        body += chunk.toString(); 
                    });

                    req.on('end', () => {
                        const payload = JSON.parse(body);
                        const newSettings = this.playerSettings[playerId] || {};
                        Object.assign(newSettings, payload);
                        this.playerSettings[playerId] = newSettings;
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(this.playerSettings[playerId]));
                        this.notifyListeners(playerId);
                    });
                } else if (reqPath[reqPath.length - 1] === 'add_listener') {
                    let body = '';
                    req.on('data', chunk => {
                        body += chunk.toString(); 
                    });

                    req.on('end', () => {
                        const payload = JSON.parse(body);

                        const socketSession = new WebSocket(`ws://localhost:${payload.sessionPort}`);
                        socketSession.on('open', () => {
                            console.log('opened socket connection to session');
                            this.sessionClients[payload.sessionPort] = socketSession;
                            if (!this.playerListeners[payload.playerId]) {
                                this.playerListeners[payload.playerId] = new Set();
                            }

                            this.playerListeners[payload.playerId].add(payload.sessionPort);

                            res.end('alright');
                        });
                    });
                }
            }
        }).listen(port); 
    }

    notifyListeners(playerId) {
        const sessionPorts = this.playerListeners[playerId];
        if (sessionPorts) {
            for (const port of sessionPorts) {
                const sessionClient = this.sessionClients[port];
                if (sessionClient) {
                    sessionClient.send(JSON.stringify({type: 'homenames_update', playerId, info: this.playerInfo[playerId] || {}, settings: this.playerSettings[playerId] || {} }));
                }
            }
        }
    }
}

module.exports = Homenames;
