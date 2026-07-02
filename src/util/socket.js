const WebSocket = require('ws');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const fs = require('fs');

const { getConfigValue, log, getHash } = require('homegames-common');

const API_URL = getConfigValue('API_URL', 'https://api.homegames.io:443');
const LINK_PROXY_URL = getConfigValue('LINK_PROXY_URL', 'wss://public.homegames.link:81');

const parsedUrl = new URL(API_URL);
const isSecure = parsedUrl.protocol == 'https:';

const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
const BEZEL_SIZE_X = getConfigValue('BEZEL_SIZE_X', 15);
const BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 15);

const DOMAIN_NAME = getConfigValue('DOMAIN_NAME', null);
const CERT_DOMAIN = getConfigValue('CERT_DOMAIN', null);

// Max 10MB WebSocket messages — asset bundles (images, fonts, audio) can be several MB
const MAX_PAYLOAD = 10 * 1024 * 1024;
// Max 120 messages per second per connection
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX = 120;
// Homenames request timeout
const HOMENAMES_TIMEOUT_MS = 5000;

const getPublicIP = () => new Promise((resolve) => {
    const req = (isSecure ? https : http).get(`${API_URL}/ip`, (res) => {
        let buf = '';
        res.on('data', (chunk) => { buf += chunk.toString(); });
        res.on('end', () => { resolve(buf.toString()); });
    });
    req.on('error', () => { resolve(null); });
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
});

// ---------------------------------------------------------------------------
// Player ID pool (1-127 for local, 128-255 for proxy — no overlap)
// ---------------------------------------------------------------------------
const _playerIds = {};
for (let i = 1; i < 128; i++) _playerIds[i] = false;

const generatePlayerId = () => {
    for (const k in _playerIds) {
        if (_playerIds[k] === false) {
            _playerIds[k] = true;
            return Number(k);
        }
    }
    return null; // pool exhausted — caller must handle
};

const freePlayerId = (id) => {
    if (id != null && _playerIds[id] !== undefined) {
        _playerIds[id] = false;
    }
};

const _proxyPlayerIds = {};
for (let i = 128; i < 256; i++) _proxyPlayerIds[i] = false;

const generateProxyPlayerId = () => {
    for (const k in _proxyPlayerIds) {
        if (_proxyPlayerIds[k] === false) {
            _proxyPlayerIds[k] = true;
            return Number(k);
        }
    }
    return null;
};

const freeProxyPlayerId = (id) => {
    if (id != null && _proxyPlayerIds[id] !== undefined) {
        _proxyPlayerIds[id] = false;
    }
};

// ---------------------------------------------------------------------------
// Simple per-connection rate limiter
// ---------------------------------------------------------------------------
const createRateLimiter = () => {
    let count = 0;
    let windowStart = Date.now();
    return () => {
        const now = Date.now();
        if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
            count = 0;
            windowStart = now;
        }
        count++;
        return count <= RATE_LIMIT_MAX;
    };
};

// ---------------------------------------------------------------------------
// Broadcast (public relay proxy)
// ---------------------------------------------------------------------------
const broadcast = (gameSession) => {
    const proxyServer = new WebSocket(LINK_PROXY_URL);

    proxyServer.on('open', () => {
        log.info('Opened connection to proxy server');
    });

    proxyServer.on('error', (err) => {
        log.info('Unable to connect to proxy server. Public games will be unavailable.');
    });

    proxyServer.on('message', (msg) => {
        try {
            if (msg.startsWith && msg.startsWith('idreq-')) {
                const proxyClientId = msg.substring(6);
                const clientId = generateProxyPlayerId();
                if (clientId == null) return; // pool exhausted
                proxyServer.send('idres-' + proxyClientId + '-' + clientId);
            } else if (msg.startsWith && msg.startsWith('close-')) {
                const pieces = msg.split('-');
                const clientId = Number(pieces[1]);
                if (isNaN(clientId)) return;

                if (gameSession.spectators[clientId]) {
                    gameSession.removeSpectator(clientId);
                } else {
                    gameSession.removePlayer(clientId);
                }
                freeProxyPlayerId(clientId);
            } else {
                let isJson = msg.startsWith;
                let sentPlayerId;
                if (!isJson) {
                    const ting = msg.slice(1);
                    try {
                        JSON.parse(ting);
                        sentPlayerId = msg[0];
                        msg = ting;
                        isJson = true;
                    } catch (err) { /* not json */ }
                }
                if (isJson) {
                    const jsonMessage = JSON.parse(msg);
                    if (jsonMessage.type === 'ready') {
                        const clientId = jsonMessage.id;
                        const requestedGame = jsonMessage.clientInfo && jsonMessage.clientInfo.requestedGame;
                        const clientInfo = jsonMessage.clientInfo && jsonMessage.clientInfo.clientInfo;
                        const fakeWs = {
                            readyState: WebSocket.OPEN,
                            send: (s) => {
                                try { proxyServer.send([199, clientId, ...s]); } catch (e) {}
                            },
                            on: () => {},
                            id: clientId
                        };

                        const aspectRatio = gameSession.aspectRatio;
                        const gameMetadata = gameSession.gameMetadata;
                        let squishVersion = 'latest';
                        if (gameMetadata && gameMetadata.squishVersion) {
                            squishVersion = gameMetadata.squishVersion;
                        }

                        const squishVersionArray = [squishVersion.length];
                        for (let i = 0; i < squishVersion.length; i++) {
                            squishVersionArray.push(squishVersion.charCodeAt(i));
                        }

                        try {
                            proxyServer.send([2, clientId, aspectRatio.x, aspectRatio.y, BEZEL_SIZE_X, BEZEL_SIZE_Y, ...squishVersionArray]);
                        } catch (e) {}

                        const playerOpts = { clientInfo, info: {}, requestedGame, isRemote: true };

                        if (jsonMessage.spectating) {
                            gameSession.addSpectator(clientId, fakeWs, playerOpts);
                        } else {
                            gameSession.addPlayer(clientId, fakeWs, playerOpts);
                        }
                    } else if (jsonMessage.type === 'code') {
                        // Server code for public relay — only allow strings
                        if (typeof jsonMessage.code === 'string' && jsonMessage.code.length < 20) {
                            gameSession.setServerCode(jsonMessage.code);
                        }
                    } else if (sentPlayerId != null) {
                        gameSession.handleInput(sentPlayerId, jsonMessage);
                    }
                }
            }
        } catch (err) {
            log.error('Error processing proxy message: ' + err.message);
        }
    });
};

// ---------------------------------------------------------------------------
// Socket server
// ---------------------------------------------------------------------------
const socketServer = (gameSession, port, cb = null, certPath = null, username = null) => {

    const requestHandler = (req, res) => {
        if (req.url === '/api/players') {
            const players = Object.keys(gameSession.players).map(id => ({
                id,
                name: (gameSession.playerInfoMap[id] && gameSession.playerInfoMap[id].name) || 'Player ' + id
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(players));
        } else if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, playerCount: gameSession.getPlayerCount() }));
        } else {
            res.writeHead(404);
            res.end();
        }
    };

    let server;
    if (certPath) {
        log.info('Starting secure server on port ' + port);
        server = https.createServer({
            key: fs.readFileSync(`${certPath}/homegames.key`).toString(),
            cert: fs.readFileSync(`${certPath}/homegames.cert`).toString()
        }, requestHandler);
    } else {
        log.info('Starting regular server on port ' + port);
        server = http.createServer(requestHandler);
    }

    const wss = new WebSocket.Server({ server, maxPayload: MAX_PAYLOAD });

    let publicIp = null;
    getPublicIP().then(ip => {
        publicIp = ip;
        const broadcastEnabled = !!getConfigValue('PUBLIC_GAMES', false);
        if (broadcastEnabled) {
            broadcast(gameSession);
        }
    }).catch(() => {});

    wss.on('connection', (ws) => {
        const rateLimiter = createRateLimiter();

        // Input forwarding — registered immediately, gated on _playerReady
        const inputHandler = (inputMsg) => {
            if (!ws._playerReady) return;
            if (!rateLimiter()) return; // rate limited
            try {
                const inputData = JSON.parse(inputMsg);
                if (inputData.type && typeof inputData.type === 'string'
                    && inputData.type !== 'ready' && !inputData.clientInfo) {
                    gameSession.handleInput(ws.id, inputData);
                }
            } catch (err) {
                // malformed JSON — ignore
            }
        };
        ws.on('message', inputHandler);

        function messageHandler(msg) {
            let jsonMessage;
            try {
                jsonMessage = JSON.parse(msg);
            } catch (err) {
                return; // malformed JSON
            }

            if (jsonMessage.type === 'homenames_update') {
                // Only process if sender is authenticated
                if (!ws._playerReady || ws.id == null) return;
                gameSession.handlePlayerUpdate(jsonMessage.playerId, {
                    info: jsonMessage.info || {},
                    settings: jsonMessage.settings || {}
                });
            } else if (jsonMessage.type === 'ready') {
                ws.removeListener('message', messageHandler);

                // Server assigns the player ID — never trust client
                const id = generatePlayerId();
                if (id == null) {
                    log.error('Player ID pool exhausted');
                    ws.close(1013, 'Server full');
                    return;
                }
                ws.id = id;
                ws.spectating = !!jsonMessage.spectating;
                ws._playerReady = false;

                const requestedGame = jsonMessage.clientInfo && jsonMessage.clientInfo.requestedGame;
                const clientInfo = jsonMessage.clientInfo && jsonMessage.clientInfo.clientInfo;
                console.log('client info ');
                console.log(jsonMessage.clientInfo);

                // When running inside Docker the session is in a container, so
                // 'localhost' is the container — not the host running Homenames.
                // Reach the host over plain HTTP (mirrors homenames-helper).
                const dockerHost = process.env.DOCKER_HOST_HOSTNAME;
                const homenamesHost = dockerHost || 'localhost';
                const homenamesSecure = dockerHost ? false : !!certPath;

                const finishPlayerSetup = (playerInfo) => {
                    // Guard against WebSocket being closed during async work
                    if (ws.readyState !== WebSocket.OPEN) {
                        freePlayerId(ws.id);
                        return;
                    }

                    const aspectRatio = gameSession.aspectRatio;
                    const gameMetadata = gameSession.gameMetadata;
                    let squishVersion = 'latest';
                    if (gameMetadata && gameMetadata.squishVersion) {
                        squishVersion = gameMetadata.squishVersion;
                    }

                    const squishVersionArray = [squishVersion.length];
                    for (let i = 0; i < squishVersion.length; i++) {
                        squishVersionArray.push(squishVersion.charCodeAt(i));
                    }

                    try {
                        ws.send([2, ws.id, aspectRatio.x, aspectRatio.y, BEZEL_SIZE_X, BEZEL_SIZE_Y, ...squishVersionArray]);
                    } catch (e) {
                        freePlayerId(ws.id);
                        return;
                    }

                    const playerOpts = { clientInfo, info: playerInfo || {}, requestedGame };

                    if (ws.spectating) {
                        gameSession.addSpectator(ws.id, ws, playerOpts);
                    } else {
                        gameSession.addPlayer(ws.id, ws, playerOpts);
                    }

                    ws._playerReady = true;
                };

                // Fetch player info from Homenames with timeout
                const req = (homenamesSecure ? https : http).request({
                    hostname: homenamesHost,
                    port: HOMENAMES_PORT,
                    path: `/info/${ws.id}`,
                    method: 'GET'
                }, res => {
                    let buf = '';
                    res.on('data', (chunk) => { buf += chunk.toString(); });
                    res.on('end', () => {
                        try {
                            finishPlayerSetup(JSON.parse(buf));
                        } catch (e) {
                            finishPlayerSetup(null);
                        }
                    });
                });
                req.on('error', () => { finishPlayerSetup(null); });
                req.setTimeout(HOMENAMES_TIMEOUT_MS, () => { req.destroy(); finishPlayerSetup(null); });
                req.end();
            }
        }

        ws.on('message', messageHandler);

        ws.on('close', () => {
            if (ws.id == null) return;
            if (ws.spectating) {
                gameSession.removeSpectator(ws.id);
            } else {
                gameSession.removePlayer(ws.id);
            }
            freePlayerId(ws.id);
        });

        ws.on('error', (err) => {
            log.error('Client WebSocket error: ' + (err.message || err));
        });
    });

    server.on('error', (err) => {
        log.error('HTTP server error: ' + err.message);
        cb && cb(err);
    });

    wss.on('error', (wsErr) => {
        log.error('WebSocket server error: ' + (wsErr.message || wsErr));
    });

    server.listen(port, null, null, () => {
        cb && cb();
    });
};

module.exports = { socketServer };
