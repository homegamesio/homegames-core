const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const { socketServer } = require('./util/socket');
const { reportBug } = require('./common/util');
const { getService } = require('./services/index');

const process = require('process');

let lastMessage;
let gameSession; // used in both frame and no-frame modes

const path = require('path');

const { log, getConfigValue, getAppDataPath, GameSession } = require('homegames-common');

const ERROR_REPORTING_ENABLED = getConfigValue('ERROR_REPORTING', false);
const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);

const sendProcessMessage = (msg) => {
    if (process.send) {
        process.send(JSON.stringify(msg));
    }
};

const startServer = (sessionInfo) => {
    let gameInstance;

    log.info('Starting server with this info', sessionInfo);

    const addAsset = (key, asset) => new Promise((resolve, reject) => {
        gameSession.handleNewAsset(key, asset).then(resolve).catch(reject);
    });

    const appDataPath = getAppDataPath();
    
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

            let saveData;
            const savePath = crypto.createHash('md5').update(sessionInfo.gamePath).digest('hex');
    
            const saveDataRoot = path.join(appDataPath, '.save-data');
            const existingGameSaveDataPath = path.join(saveDataRoot, savePath);
            if (!fs.existsSync(saveDataRoot)) {
                fs.mkdirSync(saveDataRoot);
            }

            const saveGame = (data) => new Promise((resolve, reject) => {
                // lol. read parsed json to validate json
                const jsonData = JSON.stringify(JSON.parse(JSON.stringify(data)));
                fs.writeFileSync(existingGameSaveDataPath, jsonData);
            });

            if (fs.existsSync(existingGameSaveDataPath)) {
                try {
                    const stuff = fs.readFileSync(existingGameSaveDataPath);
                    saveData = JSON.parse(stuff);
                } catch (err) {
                    console.log("Error reading save data");
                    console.log(err);
                }
            }
            gameInstance = new _gameClass({ addAsset, saveGame, saveData, services });
        } else {
            const _gameClass = games[sessionInfo.key];

            if (_gameClass.metadata) {
                const requestedServices = _gameClass.metadata().services || [];
                requestedServices.forEach(s => services[s] = getService(s));
            }
            gameInstance = new _gameClass({ addAsset, services });

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
        sessionShim.stateHistory = [];
        sessionShim.remotePlayerMap = gameSession.remotePlayerMap;
        sessionShim.players = gameSession.players;
        sessionShim.spectators = gameSession.spectators;
        sessionShim.playerInfoMap = gameSession.playerInfoMap;
        sessionShim.clientInfoMap = gameSession.clientInfoMap;
        sessionShim.playerSettingsMap = gameSession.playerSettingsMap;
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

        gameSession.initialize().then(() => {
            socketServer(gameSession, sessionInfo.port, () => {
                sendProcessMessage({
                    'success': true
                });
            }, HTTPS_ENABLED ? sessionInfo.certPath : null, sessionInfo.username);
        }).catch(err => {
            log.error('Error initializing game session');
            log.error(err);
        });
    }

};

// ---------------------------------------------------------------------------
// No-frame mode: uses GameSession without frame options — no bezel,
// no HomegamesRoot, no Homenames integration. Just the raw game with a
// WebSocket server.
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

    const gameInstance = new GameClass({ addAsset });
    gameSession = new GameSession(gameInstance, squishVersion);

    gameSession.initialize().then(() => {
        // Simple WebSocket server — no bezel, no Homenames, no proxy
        const server = http.createServer((req, res) => {
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    ok: true,
                    playerCount: gameSession ? gameSession.getPlayerCount() : 0,
                }));
                return;
            }
            res.writeHead(404); res.end();
        });

        const wss = new WebSocket.Server({ server });
        let playerIdCounter = 0;

        wss.on('connection', (ws) => {
            let playerId = null;

            ws.on('message', (msg) => {
                const msgStr = typeof msg === 'string' ? msg : msg.toString();
                let parsed;
                try { parsed = JSON.parse(msgStr); } catch (e) { return; }

                if (parsed.type === 'ready') {
                    playerId = parsed.id || ++playerIdCounter;
                    const clientInfo = parsed.clientInfo?.clientInfo || {};

                    const sv = squishVersion;
                    const svBuf = [sv.length];
                    for (let i = 0; i < sv.length; i++) {
                        svBuf.push(sv.charCodeAt(i));
                    }

                    ws.send(Buffer.from([2, playerId, gameSession.aspectRatio.x, gameSession.aspectRatio.y, 0, 0, ...svBuf]));
                    gameSession.addPlayer(playerId, ws, { clientInfo });
                } else if (gameSession && playerId != null) {
                    gameSession.handleInput(playerId, parsed);
                }
            });

            ws.on('close', () => {
                if (gameSession && playerId != null) {
                    gameSession.removePlayer(playerId);
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
    // Mode 2: Standalone (Docker container)
    // Config comes from environment variables.
    lastMessage = new Date();
    const sessionConfig = {
        key: process.env.GAME_KEY || path.basename(process.env.GAME_PATH, '.js'),
        squishVersion: process.env.SQUISH_VERSION || '135',
        gamePath: process.env.GAME_PATH,
        port: Number(process.env.GAME_PORT) || 7002,
        username: process.env.USERNAME || null,
        certPath: process.env.CERT_PATH || null,
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

const GRACE_PERIOD_MS = Number(process.env.GRACE_PERIOD_MS) || 30000;

const checkPulse = () => {
    if (!gameSession) {
        log.info('discontinuing myself (no session)');
        process.exit(0);
        return;
    }

    const hasPlayers = gameSession.getPlayerCount() > 0
        || Object.keys(gameSession.spectators).length > 0;

    if (isForked) {
        // Fork mode: parent sends heartbeats. If we haven't heard from parent in 5s
        // AND there are no players, shut down.
        if (!hasPlayers && (!lastMessage || new Date() - lastMessage > 5000)) {
            log.info('discontinuing myself');
            process.exit(0);
        }
    } else {
        // Docker mode: no parent heartbeats. Just check if anyone is connected.
        if (!hasPlayers) {
            log.info('discontinuing myself (no players)');
            process.exit(0);
        }
    }
};

// short grace period to allow the first client to connect before checking heartbeat
setTimeout(() => {
    setInterval(checkPulse, 10 * 1000);
}, isForked ? 2000 : GRACE_PERIOD_MS);
