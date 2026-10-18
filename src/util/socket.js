const WebSocket = require('ws');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { isHostRequest } = require('./host-access');

// Membership comes only from the upgrade request, never the ready message.
const hostSockets = new WeakSet();
const isHostSocket = socket => !!socket && hostSockets.has(socket);

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
// Default budget; FPS games also stream relative aim alongside repeated keys.
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX = 120;
const POINTER_LOCK_RATE_LIMIT_MAX = 240;
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
// const createRateLimiter = () => {
const createRateLimiter = (maxMessages = RATE_LIMIT_MAX) => {
    let count = 0;
    let windowStart = Date.now();
    return () => {
        const now = Date.now();
        if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
            count = 0;
            windowStart = now;
        }
        count++;
        // return count <= RATE_LIMIT_MAX;
        return count <= maxMessages;
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
                if (!Number.isInteger(clientId) || _proxyPlayerIds[clientId] !== true) return;

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
                        if (!Number.isInteger(clientId) || _proxyPlayerIds[clientId] !== true) return;
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
                            // proxyServer.send([2, clientId, aspectRatio.x, aspectRatio.y, BEZEL_SIZE_X, BEZEL_SIZE_Y, ...squishVersionArray]);
                            proxyServer.send([2, clientId, aspectRatio.x, aspectRatio.y, BEZEL_SIZE_X, BEZEL_SIZE_Y, ...squishVersionArray,
                                gameMetadata?.pointerLock === true ? 1 : 0]);
                        } catch (e) {}

                        const playerOpts = { clientInfo, info: {}, requestedGame, isRemote: true, playerName: jsonMessage.playerName };

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
                    } else if (sentPlayerId != null && _proxyPlayerIds[sentPlayerId] === true) {
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
const socketServer = (gameSession, port, cb = null, certPath = null, username = null, opts = {}) => {

    // The main server (dashboard session on HOME_PORT) serves the browser
    // client itself, so http(s)://host:port is the whole product. It also
    // serves local-play manifests so games can run single-player in the
    // browser with no game session. Child game session servers leave this
    // off — players reach them via WS redirects.
    let webClientHandler = null;
    let localPlayHandler = null;
    let packHandler = null;
    if (opts.serveWebClient) {
        const { createWebClientHandler } = require('./web-client');
        const { createLocalPlayHandler } = require('./local-play');
        webClientHandler = createWebClientHandler();
        localPlayHandler = createLocalPlayHandler();
        packHandler = require('../library/PortableLibrary').createPackHandler({
            directory: require('path').join(require('homegames-common').getAppDataPath(), 'hg-games'),
            onInstalled: () => gameSession.game.refreshLibrary?.(),
        });
    }

    const requestHandler = (req, res) => {
        if (opts.serveWebClient && req.method === 'GET' && req.url === '/api/capabilities') {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ manageServer: isHostRequest(req) }));
            return;
        }
        if (packHandler?.(req, res)) return;
        if (localRtc?.handleRequest(req, res)) return;
        if (opts.serveWebClient && req.method === 'GET' && req.url === '/rtc-config') {
            const offline = getConfigValue('RTC_SHARE_ORIGIN', null) === 'local';
            const origin = offline ? require('./browser-game-server').invitationOrigin({ host: req.headers.host,
                port: server.address().port, certificate: certPath ? new crypto.X509Certificate(fs.readFileSync(`${certPath}/homegames.cert`)) : null }) : null;
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({
                signalingUrl: offline ? `${(origin || `http://${req.headers.host}`).replace(/^http/, 'ws')}/rtc` : getConfigValue('RTC_SIGNAL_URL', null) || 'wss://api.homegames.io/rtc',
                joinUrl: offline ? `${origin || `http://${req.headers.host}`}/` : getConfigValue('RTC_JOIN_URL', null) || 'https://homegames.io/play.html',
                autoStart: offline,
                iceTransportPolicy: getConfigValue('RTC_ICE_TRANSPORT_POLICY', 'all'),
            }));
            return;
        }
        if (opts.householdRooms?.handleRequest(req, res)) return;
        if (webClientHandler && webClientHandler(req, res)) {
            return;
        }

        if (localPlayHandler && localPlayHandler(req, res)) {
            return;
        }

        if (req.url === '/api/players') {
            const players = Object.keys(gameSession.players).map(id => ({
                id,
                name: (gameSession.playerInfoMap[id] && gameSession.playerInfoMap[id].name) || 'Player ' + id
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(players));
        } else if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                ok: true,
                playerCount: gameSession.getPlayerCount(),
                // Spectators keep a session alive too — the lifecycle monitor
                // must not tear down a session people are actively watching.
                spectatorCount: Object.keys(gameSession.spectators || {}).length,
            }));
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

        // Hot-swap renewed certs into the live server — without this a
        // long-running instance would serve the old cert until expiry even
        // though the renewal wrote a fresh one to disk. Only the main process
        // has a cert manager; child game servers are short-lived and read
        // certs at spawn.
        const { getDefaultInstance } = require('./cert-manager');
        const certManager = getDefaultInstance();
        if (certManager) {
            certManager.onUpdate((status) => {
                if (status.state !== 'renewed') return;
                const renewed = certManager.readCertificate();
                if (!renewed) return;
                try {
                    server.setSecureContext(renewed);
                    log.info('Renewed certificate hot-swapped into running HTTPS server');
                } catch (err) {
                    log.error('Failed to hot-swap renewed certificate');
                    log.error(err);
                }
            });
        }
    } else {
        log.info('Starting regular server on port ' + port);
        server = http.createServer(requestHandler);
    }

    const localRtc = opts.serveWebClient && getConfigValue('RTC_SHARE_ORIGIN', null) === 'local'
        ? require('homegames-common/rtc-signaling').attachRtcSignaling(server, { getIceServers: () => [], allowOtherUpgrades: true }) : null;
    const wss = new WebSocket.Server({ noServer: true, maxPayload: MAX_PAYLOAD });
    server.on('upgrade', (req, socket, head) => {
        if (localRtc && req.url === '/rtc') return;
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    });

    let publicIp = null;
    if (getConfigValue('PUBLIC_GAMES', false)) getPublicIP().then(ip => {
        publicIp = ip;
        broadcast(gameSession);
    }).catch(() => {});

    wss.on('connection', (ws, req) => {
        if (isHostRequest(req)) hostSockets.add(ws);
        // const rateLimiter = createRateLimiter();
        const rateLimiter = createRateLimiter(gameSession.gameMetadata?.pointerLock === true
            ? POINTER_LOCK_RATE_LIMIT_MAX : RATE_LIMIT_MAX);

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
                // Homenames is https exactly when we have certs (mirrors
                // homenames-helper). The cert is issued for the public domain,
                // not localhost/host.docker.internal, so skip verification —
                // this traffic never leaves the machine.
                const dockerHost = process.env.DOCKER_HOST_HOSTNAME;
                const homenamesHost = dockerHost || 'localhost';
                const homenamesSecure = !!certPath;

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
                        // ws.send([2, ws.id, aspectRatio.x, aspectRatio.y, BEZEL_SIZE_X, BEZEL_SIZE_Y, ...squishVersionArray]);
                        ws.send([2, ws.id, aspectRatio.x, aspectRatio.y, BEZEL_SIZE_X, BEZEL_SIZE_Y, ...squishVersionArray,
                            gameMetadata?.pointerLock === true ? 1 : 0]);
                    } catch (e) {
                        freePlayerId(ws.id);
                        return;
                    }

                    const playerOpts = { clientInfo, info: playerInfo || {}, requestedGame, playerName: jsonMessage.playerName };

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
                    method: 'GET',
                    rejectUnauthorized: false
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
            hostSockets.delete(ws);
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
        opts.onReady?.(server);
        cb && cb();
    });
};

module.exports = { socketServer, isHostSocket };
