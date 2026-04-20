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

// ---------------------------------------------------------------------------
// Request body helper
// ---------------------------------------------------------------------------
const getReqBody = (req) => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
    });
    req.on('error', reject);
});

class Homenames {
    constructor(port, certPath, gameSessionManager) {
        log.info('running homenames on port ' + port);

        this.certPath = certPath;
        this.playerInfo = {};
        this.playerSettings = {};
        this.sessionClients = {};
        this.playerListeners = {};
        this.clientInfo = {};
        this.gameSessionManager = gameSessionManager || null;

        const homenamesApp = (req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            const reqPath = req.url.split('/');

            // -----------------------------------------------------------------
            // Session management API
            // -----------------------------------------------------------------
            if (req.url.startsWith('/sessions')) {
                this.handleSessionRequest(req, res);
                return;
            }

            // -----------------------------------------------------------------
            // Existing player info / settings / client_info / add_listener APIs
            // -----------------------------------------------------------------
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

                        const socketSession = new WebSocket(`${HTTPS_ENABLED ? 'wss' : 'ws'}://localhost:${payload.sessionPort}`);
                        socketSession.on('open', () => {
                            log.info('opened socket connection to session');
                            this.sessionClients[payload.sessionPort] = socketSession;
                            if (!this.playerListeners[payload.playerId]) {
                                this.playerListeners[payload.playerId] = new Set();
                            }

                            this.playerListeners[payload.playerId].add(payload.sessionPort);

                            res.end('alright');
                        });
                        socketSession.on('error', (err) => {
                            log.error('Homenames listener socket error for port ' + payload.sessionPort + ': ' + err.message);
                            if (!res.writableEnded) {
                                res.statusCode = 502;
                                res.end('failed to connect to session');
                            }
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

    // -----------------------------------------------------------------------
    // Session management HTTP handler
    // -----------------------------------------------------------------------

    handleSessionRequest(req, res) {
        const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
        // urlParts: ['sessions'] or ['sessions', ':id']
        const sessionId = urlParts.length > 1 ? Number(urlParts[1]) : null;

        if (!this.gameSessionManager) {
            res.writeHead(501, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session management not available' }));
            return;
        }

        // GET /sessions
        if (req.method === 'GET' && !sessionId) {
            this.handleListSessions(req, res);
            return;
        }

        // GET /sessions/:id
        if (req.method === 'GET' && sessionId) {
            this.handleGetSession(req, res, sessionId);
            return;
        }

        // POST /sessions
        if (req.method === 'POST' && !sessionId) {
            this.handleCreateSession(req, res);
            return;
        }

        // DELETE /sessions/:id
        if (req.method === 'DELETE' && sessionId) {
            this.handleDeleteSession(req, res, sessionId);
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }

    // GET /sessions
    handleListSessions(req, res) {
        const sessions = this.gameSessionManager.listSessions();

        // Enrich with player counts
        const enriched = Promise.all(sessions.map(async (s) => {
            let playerCount = 0;

            // For fork sessions, use IPC
            const payload = await this.gameSessionManager.requestFromSession(s.id, 'getPlayers');
            if (payload) {
                playerCount = payload.length;
            } else {
                // For Docker/no-frame sessions, query the health endpoint
                try {
                    const healthData = await this._querySessionHealth(s.port);
                    if (healthData && healthData.playerCount !== undefined) {
                        playerCount = healthData.playerCount;
                    }
                } catch (e) {}
            }

            return {
                id: s.id,
                port: s.port,
                gameKey: s.gameKey,
                gameId: s.gameId || null,
                squishVersion: s.squishVersion,
                playerCount,
            };
        }));

        enriched.then(results => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sessions: results }));
        }).catch(err => {
            log.error('Error listing sessions', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to list sessions' }));
        });
    }

    // GET /sessions/:id
    handleGetSession(req, res, sessionId) {
        const session = this.gameSessionManager.getSession(sessionId);

        if (!session) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session not found' }));
            return;
        }

        // Try to get player list
        this.gameSessionManager.requestFromSession(sessionId, 'getPlayers').then(payload => {
            const players = payload || [];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: session.id,
                port: session.port,
                type: session.type,
                gameKey: session.gameKey || null,
                gameId: session.gameId || null,
                squishVersion: session.squishVersion,
                players,
            }));
        }).catch(err => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: session.id,
                port: session.port,
                type: session.type,
                gameKey: session.gameKey || null,
                gameId: session.gameId || null,
                squishVersion: session.squishVersion,
                players: [],
            }));
        });
    }

    // POST /sessions
    // Body: { gamePath } or { code } or { files } or { gamePath, gameId, gameKey }
    //   code: string — single file (written as index.js)
    //   files: { "path": "content", ... } — multiple files (must include index.js)
    handleCreateSession(req, res) {
        getReqBody(req).then(body => {
            const { gamePath, code, files, gameId, gameKey, noFrame } = body;

            if (!gamePath && !code && !files) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'gamePath, code, or files is required' }));
                return;
            }

            const input = {};
            if (gamePath) {
                input.gamePath = gamePath;
            } else if (files) {
                // Write all files to a temp directory
                const tmpDir = path.join(os.tmpdir(), 'hg-preview-' + Date.now() + '-' + Math.random().toString(36).slice(2));
                fs.mkdirSync(tmpDir, { recursive: true });
                for (const filePath of Object.keys(files)) {
                    const fullPath = path.join(tmpDir, filePath);
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, files[filePath]);
                }
                input.gamePath = path.join(tmpDir, 'index.js');
            } else if (code) {
                input.code = code;
            }

            if (gameKey) input.gameKey = gameKey;

            // Sessions created via HTTP API default to no frame
            input.noFrame = noFrame !== undefined ? noFrame : true;

            let responded = false;

            const sendResponse = (sessionId, port, type) => {
                if (responded) return;
                responded = true;

                // Store extra metadata on the session object
                const session = this.gameSessionManager.getSession(sessionId);
                if (session && gameId) {
                    session.gameId = gameId;
                }

                const wsProtocol = HTTPS_ENABLED ? 'wss' : 'ws';
                const wsHost = getLocalIP() || 'localhost';

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    sessionId,
                    port,
                    type,
                    wsUrl: `${wsProtocol}://${wsHost}:${port}`,
                }));
            };

            this.gameSessionManager.startSession(input, {
                onReady: (session) => {
                    log.info(`[Homenames] Session ${session.id} ready on port ${session.port}`);
                    sendResponse(session.id, session.port, session.type);
                },
            }).then(result => {
                const { sessionId, port, type } = result;

                // For fork sessions, onReady fires before .then() resolves,
                // so the response is already sent. For Docker sessions,
                // onReady fires later once the container is accepting connections.
                // Set a timeout fallback in case onReady never fires.
                setTimeout(() => {
                    if (!responded) {
                        log.info(`[Homenames] Session ${sessionId} timeout waiting for onReady, responding anyway`);
                        sendResponse(sessionId, port, type);
                    }
                }, 30000);
            }).catch(err => {
                if (!responded) {
                    responded = true;
                    log.error('Failed to create session', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message || 'Failed to create session' }));
                }
            });
        }).catch(err => {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
        });
    }

    // DELETE /sessions/:id
    handleDeleteSession(req, res, sessionId) {
        const session = this.gameSessionManager.getSession(sessionId);

        if (!session) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session not found' }));
            return;
        }

        this.gameSessionManager.stopSession(sessionId).then(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        }).catch(err => {
            log.error('Failed to stop session', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to stop session' }));
        });
    }

    _querySessionHealth(port) {
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port,
                path: '/health',
                method: 'GET',
                timeout: 2000,
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.end();
        });
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
