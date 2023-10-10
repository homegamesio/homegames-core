const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const path = require('path');
const os = require('os');
const fs = require('fs');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('/src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue, log } = require('homegames-common');

const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);


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

class Homenames {
    constructor(port, certPath) {
        log.info('running homenames on port ' + port);
        
        this.certPath = certPath;
        this.playerInfo = {};
        this.playerSettings = {};
        this.sessionClients = {};
        this.playerListeners = {};
        this.clientInfo = {};

        const homenamesApp = (req, res) => {
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
                } else if (reqPath[reqPath.length - 2] === 'client_info') {
                    let payload = {};
                    if (this.clientInfo[playerId]) {
                        payload = this.clientInfo[playerId];
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
                } else if (reqPath[reqPath.length - 1] === 'client_info') {
                    let body = '';
                    req.on('data', chunk => {
                        body += chunk.toString(); 
                    });

                    req.on('end', () => {
                        const payload = JSON.parse(body);
                        const newClientInfo = this.clientInfo[playerId] || {};
                        Object.assign(newClientInfo, payload);
                        this.clientInfo[playerId] = newClientInfo;
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(this.clientInfo[playerId]));
                        this.notifyListeners(playerId);
                    });
                } else if (reqPath[reqPath.length - 1] === 'add_listener') {
                    let body = '';
                    req.on('data', chunk => {
                        body += chunk.toString(); 
                    });

                    req.on('end', () => {
                        const payload = JSON.parse(body);
                        const hostname = req.headers['host'].split(':')[0];

                        const socketSession = new WebSocket(`${HTTPS_ENABLED ? 'wss' : 'ws'}://${hostname}:${payload.sessionPort}`);
                        socketSession.on('open', () => {
                            log.info('opened socket connection to session');
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
        };

        const server = HTTPS_ENABLED && this.certPath ? https.createServer({
            key: fs.readFileSync(`${this.certPath}/homegames.key`).toString(),
            cert: fs.readFileSync(`${this.certPath}/homegames.cert`).toString()
        }, homenamesApp) : http.createServer(homenamesApp); 

        server.listen(port); 
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
