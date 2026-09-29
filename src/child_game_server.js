console.log("man what!!!!");
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const { socketServer } = require('./util/socket');
const { reportBug } = require('./common/util');
const { getService } = require('./services/index');

const process = require('process');
const SessionLifetime = require('homegames-common/session-lifetime');

let lastMessage;
let gameSession; // used in both frame and no-frame modes

const path = require('path');

const { log, getConfigValue, getAppDataPath, GameSession, saveGames } = require('homegames-common');

const ERROR_REPORTING_ENABLED = getConfigValue('ERROR_REPORTING', false);
const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);

// Shared secret gating the docker control endpoint (runtime persistence
// toggle). Passed into the container env by the session manager; matches the
// value the platform API presents. Fork sessions use IPC instead and never
// need this. When unset (local/LAN dev) the control endpoint is disabled.
const HOMENAMES_API_SECRET = getConfigValue('HOMENAMES_API_SECRET', '');

// When persistent, checkPulse will NOT self-terminate on an empty session.
// An admin sets this via the manager (IPC for fork, /control for docker).
// Orphan protection (parent disconnect) is unaffected — see below.
let persistent = false;

const sendProcessMessage = (msg) => {
    if (process.send) {
        process.send(JSON.stringify(msg));
    }
};

// ---------------------------------------------------------------------------
// Save games — build the { saveGame, saveData } pair injected into the game
// constructor. Two backends behind the same contract:
//
//   File backend (default): saves live under a stable per-game directory
//   (<saveDataRoot>/<gameKey>/<versionId>/save.json). The session manager
//   passes the game dir via sessionInfo.saveDataPath (fork) or SAVE_DATA_PATH
//   (docker /app/save bind mount); standalone falls back to app data.
//   At load, the game's own version is tried first, then each entry of
//   metadata().saveCompatibility in order.
//
//   Broadcast backend (SAVES_ENABLED=false): the host persists nothing.
//   saveGame pushes the envelope to every connected client; saveData comes
//   from the creating client's stored copy (validated for size and version
//   compatibility — it is untrusted input).
//
// saveGame is debounced platform-side (last write wins), so games may call
// it freely without hammering the disk or every client's socket.
// ---------------------------------------------------------------------------
const buildSaveOptions = (sessionInfo, gameClass) => {
    const metadata = (gameClass && gameClass.metadata) ? gameClass.metadata() : {};
    const compatibility = Array.isArray(metadata.saveCompatibility) ? metadata.saveCompatibility : [];
    const gameKey = sessionInfo.key || 'unknown-game';
    const versionId = sessionInfo.versionId || process.env.GAME_VERSION_ID || saveGames.DEFAULT_VERSION_ID;

    const savesEnabled = sessionInfo.savesEnabled !== undefined
        ? !!sessionInfo.savesEnabled
        : process.env.SAVES_ENABLED !== undefined
            ? process.env.SAVES_ENABLED === 'true'
            : true;

    if (savesEnabled) {
        const gameDir = sessionInfo.saveDataPath
            || process.env.SAVE_DATA_PATH
            || path.join(getAppDataPath(), '.save-data', saveGames.sanitizeSaveKey(gameKey));
        return {
            saveData: saveGames.resolveSaveData({ gameDir, versionId, compatibility, log }),
            saveGame: saveGames.createFileSaveGame({ gameDir, gameKey, versionId, log }),
        };
    }

    let clientSave = sessionInfo.clientSave || null;
    if (!clientSave && process.env.CLIENT_SAVE_DATA) {
        try {
            clientSave = JSON.parse(Buffer.from(process.env.CLIENT_SAVE_DATA, 'base64').toString('utf8'));
        } catch (e) {
            clientSave = null;
        }
    }

    return {
        saveData: saveGames.extractClientSaveData(clientSave, { versionId, compatibility, log }),
        // gameSession doesn't exist yet at game construction — resolve lazily
        saveGame: saveGames.createBroadcastSaveGame({ getSession: () => gameSession, gameKey, versionId, log }),
    };
};

// Gate the docker /control endpoint on the shared secret (constant-time compare
// so a mismatch doesn't leak length/prefix via timing). The endpoint lives on
// the session's public game port, so this check is what keeps the persistence
// toggle from being flippable by anyone who can reach the port. Disabled (all
// requests rejected) when no secret is configured — runtime control then only
// happens over IPC in fork mode.
const hasControlAuth = (req) => {
    if (!HOMENAMES_API_SECRET) return false;
    const header = req.headers['authorization'] || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) return false;
    const provided = Buffer.from(match[1]);
    const expected = Buffer.from(HOMENAMES_API_SECRET);
    if (provided.length !== expected.length) return false;
    return crypto.timingSafeEqual(provided, expected);
};

const startServer = (sessionInfo) => {
    let gameInstance;

    log.info('Starting server with this info', sessionInfo);

    const addAsset = (key, asset) => new Promise((resolve, reject) => {
        gameSession.handleNewAsset(key, asset).then(resolve).catch(reject);
    });

    process.env.SQUISH_PATH = require.resolve(`squish-${sessionInfo.squishVersion}`);

    try {
        log.info("THIS IS SESSION INFO");
        log.info(sessionInfo);

        let services = {};

        if (sessionInfo.gamePath) {
            const _gameClass = require(sessionInfo.gamePath);

            if (_gameClass.metadata) {
                const requestedServices = _gameClass.metadata().services || [];
                requestedServices.forEach(s => services[s] = getService(s));
            }

            const { saveGame, saveData } = buildSaveOptions(sessionInfo, _gameClass);
            gameInstance = new _gameClass({ addAsset, saveGame, saveData, services });
        } else {
            const _gameClass = games[sessionInfo.key];

            if (_gameClass.metadata) {
                const requestedServices = _gameClass.metadata().services || [];
                requestedServices.forEach(s => services[s] = getService(s));
            }
            const { saveGame, saveData } = buildSaveOptions(sessionInfo, _gameClass);
            gameInstance = new _gameClass({ addAsset, saveGame, saveData, services });

        }

        const BEZEL_SIZE_X = getConfigValue('BEZEL_SIZE_X', 10);
        const BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 10);

        const HomegamesRoot = require('./homegames_root/HomegamesRoot');
        const HomegamesDashboard = require('./dashboard/HomegamesDashboard');

        const squishVersion = (gameInstance.constructor.metadata && gameInstance.constructor.metadata().squishVersion) || sessionInfo.squishVersion;

        // Build the GameSession with frame support
        // We need to create a temporary session reference for HomegamesRoot,
        // since HomegamesRoot expects a session object in its constructor.
        // We'll create a shim and then wire things up.
        const sessionShim = {
            game: gameInstance,
            port: sessionInfo.port,
            username: sessionInfo.username,
            players: {},
            spectators: {},
            playerInfoMap: {},
            clientInfoMap: {},
            playerSettingsMap: {},
        };

        const isDashboard = gameInstance instanceof HomegamesDashboard;
        const homegamesRoot = new HomegamesRoot(sessionShim, isDashboard, false);

        const HomenamesHelper = require('./util/homenames-helper');
        const homenamesHelper = new HomenamesHelper(sessionInfo.port, sessionInfo.username);

        console.log('hello this happens what');
        gameSession = new GameSession(gameInstance, squishVersion, {
            port: sessionInfo.port,
            username: sessionInfo.username,
            spectators: true,
            frame: {
                root: homegamesRoot.getRoot(),
                topLayerRoot: homegamesRoot.getTopLayerRoot(),
                assets: HomegamesRoot.metadata().assets,
                bezelX: BEZEL_SIZE_X,
                bezelY: BEZEL_SIZE_Y,
                handler: homegamesRoot,
            },
            homenames: homenamesHelper,
        });

        // Wire the shim to the real session so HomegamesRoot can access live state
        sessionShim.stateHistory = gameSession.stateHistory;
        sessionShim.remotePlayerMap = gameSession.remotePlayerMap;
        sessionShim.players = gameSession.players;
        sessionShim.spectators = gameSession.spectators;
        sessionShim.playerInfoMap = gameSession.playerInfoMap;
        sessionShim.clientInfoMap = gameSession.clientInfoMap;
        sessionShim.playerSettingsMap = gameSession.playerSettingsMap;
        sessionShim.homenamesHelper = homenamesHelper;
        sessionShim.gameMetadata = gameSession.gameMetadata;
        sessionShim.squisher = gameSession.squisher;
        sessionShim.movePlayer = (opts) => gameSession.movePlayer(opts.playerId, opts.port);
        sessionShim.spectateSession = (playerId) => gameSession.spectateSession(playerId);
        sessionShim.joinSession = (spectatorId) => gameSession.joinSession(spectatorId);

    } catch (err) {
        log.error('Error instantiating game session');
        log.error(err);
        if (ERROR_REPORTING_ENABLED) {
            reportBug(`Exception: ${err.message} Stack: ${err.stack}`);
        }
    }

    if (gameSession) {
        console.log('fhfhfhfhf what');

        gameSession.initialize().then(() => {
            socketServer(gameSession, sessionInfo.port, () => {
                sendProcessMessage({
                    'success': true
                });
            }, HTTPS_ENABLED ? sessionInfo.certPath : null, sessionInfo.username);
        }).catch(err => {
            log.error('Error initializing game session');
            log.error(err);
            sendProcessMessage({ success: false, error: err.message });
        });
    }

};

// ---------------------------------------------------------------------------
// No-frame mode: uses GameSession without frame options — no bezel,
// no HomegamesRoot. Just the game with a WebSocket server, plus the
// Homenames helper so players still get names (games render info.name).
// Used for sessions created via the Homenames HTTP API (homegamesio, etc.)
// ---------------------------------------------------------------------------

const startServerNoFrame = (sessionInfo) => {
    log.info('Starting no-frame server with session info', sessionInfo);

    // Ensure API_URL is set BEFORE requiring GameSession/squish,
    // because Asset.js reads it at module load time
    if (!process.env.API_URL) {
        try {
            process.env.API_URL = getConfigValue('API_URL', 'https://api.homegames.io');
        } catch (e) {
            process.env.API_URL = 'https://api.homegames.io';
        }
    }

    process.env.SQUISH_PATH = require.resolve(`squish-${sessionInfo.squishVersion}`);

    let GameClass;
    try {
        GameClass = require(sessionInfo.gamePath);
    } catch (err) {
        log.error('Failed to load game class:', err);
        sendProcessMessage({ success: false, error: err.message });
        return;
    }

    const squishVersion = (GameClass.metadata && GameClass.metadata().squishVersion) || sessionInfo.squishVersion;
    process.env.SQUISH_PATH = require.resolve(`squish-${squishVersion}`);

    const addAsset = (key, asset) => {
        if (gameSession) return gameSession.handleNewAsset(key, asset);
        return Promise.resolve();
    };

    let gameInstance;
    try {
        const { saveGame, saveData } = buildSaveOptions(sessionInfo, GameClass);
        gameInstance = new GameClass({ addAsset, saveGame, saveData });
    } catch (err) {
        log.error('Failed to instantiate game:', err);
        sendProcessMessage({ success: false, error: err.message });
        return;
    }
    // Homenames integration — without it GameSession never assigns player
    // names and games show "undefined". Inside Docker the helper reaches the
    // host's Homenames via DOCKER_HOST_HOSTNAME / HOMENAMES_PORT (set by the
    // session manager).
    const HomenamesHelper = require('./util/homenames-helper');
    const homenamesHelper = new HomenamesHelper(sessionInfo.port, sessionInfo.username);

    gameSession = new GameSession(gameInstance, squishVersion, {
        port: sessionInfo.port,
        username: sessionInfo.username,
        spectators: true,
        homenames: homenamesHelper,
    });

    gameSession.initialize().then(() => {
        // Simple WebSocket server — no bezel, no proxy.
        // Serves https/wss when certs are available (same layout as socketServer).
        const requestHandler = (req, res) => {
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    ok: true,
                    playerCount: gameSession ? gameSession.getPlayerCount() : 0,
                    spectatorCount: gameSession ? Object.keys(gameSession.spectators || {}).length : 0,
                    persistent,
                }));
                return;
            }
            // Secret-gated runtime control (docker sessions). Body: { persistent }.
            if (req.method === 'POST' && req.url === '/control/persistent') {
                if (!hasControlAuth(req)) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }
                let body = '';
                let tooBig = false;
                req.on('data', (chunk) => {
                    body += chunk;
                    if (body.length > 1024) { tooBig = true; req.destroy(); }
                });
                req.on('end', () => {
                    if (tooBig) return;
                    let parsed;
                    try { parsed = JSON.parse(body); } catch (e) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON' }));
                        return;
                    }
                    persistent = !!parsed.persistent;
                    log.info(`persistence ${persistent ? 'enabled' : 'disabled'} (docker)`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ persistent }));
                });
                return;
            }
            res.writeHead(404); res.end();
        };

        const server = HTTPS_ENABLED && sessionInfo.certPath ? https.createServer({
            key: fs.readFileSync(`${sessionInfo.certPath}/homegames.key`).toString(),
            cert: fs.readFileSync(`${sessionInfo.certPath}/homegames.cert`).toString()
        }, requestHandler) : http.createServer(requestHandler);

        const wss = new WebSocket.Server({ server });
        let playerIdCounter = 0;

        wss.on('connection', (ws) => {
            let playerId = null;
            let isSpectator = false;

            ws.on('message', (msg) => {
                const msgStr = typeof msg === 'string' ? msg : msg.toString();
                let parsed;
                try { parsed = JSON.parse(msgStr); } catch (e) { return; }

                if (parsed.type === 'homenames_update') {
                    // Sent by Homenames over the socket it opened via
                    // addListener — pushes renames/settings changes.
                    gameSession.handlePlayerUpdate(parsed.playerId, {
                        info: parsed.info || {},
                        settings: parsed.settings || {},
                    });
                    return;
                }

                if (parsed.type === 'ready') {
                    playerIdCounter = (playerIdCounter % 254) + 1; // keep in 1-254 range
                    playerId = playerIdCounter;
                    isSpectator = !!parsed.spectating;
                    const clientInfo = parsed.clientInfo?.clientInfo || {};

                    const sv = squishVersion;
                    const svBuf = [sv.length];
                    for (let i = 0; i < sv.length; i++) {
                        svBuf.push(sv.charCodeAt(i));
                    }

                    ws.send(Buffer.from([2, playerId, gameSession.aspectRatio.x, gameSession.aspectRatio.y, 0, 0, ...svBuf]));
                    if (isSpectator) {
                        gameSession.addSpectator(playerId, ws, { clientInfo });
                    } else {
                        gameSession.addPlayer(playerId, ws, { clientInfo });
                    }
                } else if (gameSession && playerId != null) {
                    gameSession.handleInput(playerId, parsed);
                }
            });

            ws.on('close', () => {
                if (gameSession && playerId != null) {
                    if (isSpectator) {
                        gameSession.removeSpectator(playerId);
                    } else {
                        gameSession.removePlayer(playerId);
                    }
                }
            });

            ws.on('error', (err) => {
                log.error('WebSocket error in no-frame session:', err);
            });
        });

        server.listen(sessionInfo.port, () => {
            log.info(`No-frame session listening on port ${sessionInfo.port}`);
            sendProcessMessage({ success: true });
        });
    }).catch(err => {
        log.error('Failed to initialize no-frame session:', err);
        sendProcessMessage({ success: false, error: err.message });
    });
};

// ---------------------------------------------------------------------------
// Two startup modes:
//   1. Forked by Dashboard — receives config via IPC (process.on('message'))
//   2. Docker container    — receives config via environment variables
// ---------------------------------------------------------------------------

const isForked = !!process.send;

if (isForked) {
    console.log('balls and ass');
    // Mode 1: IPC from parent process (original behavior)
    process.on('message', (msg) => {
        lastMessage = new Date();
        const message = JSON.parse(msg);
        if (message.key) {
            console.log('[child] Received session config, noFrame:', message.noFrame);
            if (message.noFrame) {
                startServerNoFrame(message);
            } else {
                startServer(message);
            }
        } else if (message.type === 'setPersistent') {
            persistent = !!message.value;
            log.info(`persistence ${persistent ? 'enabled' : 'disabled'} (fork)`);
        } else {
            if (message.api) {
                if (message.api === 'getPlayers') {
                    const players = gameSession
                        ? Object.keys(gameSession.players).map(id => ({
                            id,
                            name: (gameSession.playerInfoMap[id] && gameSession.playerInfoMap[id].name) || 'Player ' + id
                        }))
                        : [];
                    process.send(JSON.stringify({
                        'payload': players,
                        'requestId': message.requestId
                    }));
                }
            }
        }
    });
} else if (process.env.GAME_PATH) {
    console.log('what in the hell');
    // Mode 2: Standalone (Docker container)
    // Config comes from environment variables.
    lastMessage = new Date();
    const sessionConfig = {
        key: process.env.GAME_KEY || path.basename(process.env.GAME_PATH, '.js'),
        squishVersion: process.env.SQUISH_VERSION || '142',
        gamePath: process.env.GAME_PATH,
        port: Number(process.env.GAME_PORT) || 7002,
        username: process.env.USERNAME || null,
        certPath: process.env.CERT_PATH || null,
        // Save-game context is read from env (SAVES_ENABLED, GAME_VERSION_ID,
        // SAVE_DATA_PATH, CLIENT_SAVE_DATA) inside buildSaveOptions.
    };

    if (process.env.NO_FRAME) {
        startServerNoFrame(sessionConfig);
    } else {
        startServer(sessionConfig);
    }
}

process.on('error', (err) => {
    log.error('error happened', err);
});

const lifetime = new SessionLifetime({
    gracePeriodMs: Number(process.env.GRACE_PERIOD_MS) || 30000,
});

const checkPulse = () => {
    // Loading a game/assets can be asynchronous. Start the idle clock only
    // once there is a session whose occupancy we can actually observe.
    if (!gameSession) return;
    const reason = lifetime.check({
        hasPlayers: gameSession.getPlayerCount() > 0 || Object.keys(gameSession.spectators).length > 0,
        persistent,
        forked: isForked,
        lastHeartbeat: lastMessage && Number(lastMessage),
    });
    if (reason) {
        log.info(`discontinuing myself (${reason})`);
        gameSession.destroy();
        process.exit(0);
    }
};

setInterval(checkPulse, 3000);

process.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection in child process:');
    log.error(reason);
});

console.log("WHAT THE FUCK WHAT THE FUCK");

// Handle parent process death (fork mode) — clean exit instead of orphaning
if (isForked) {
    process.on('disconnect', () => {
        log.info('Parent process disconnected, shutting down');
        if (gameSession) {
            try { gameSession.destroy(); } catch (e) {}
        }
        process.exit(0);
    });
}
