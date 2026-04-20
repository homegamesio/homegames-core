const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const GameSession = require('./GameSession');
const crypto = require('crypto');
const fs = require('fs');
const { socketServer } = require('./util/socket');
const { reportBug } = require('./common/util');
const { getService } = require('./services/index');

const process = require('process');

let lastMessage;
let gameSession;
let miniSession; // used for noFrame mode

const path = require('path');

const { log, getConfigValue, getAppDataPath } = require('homegames-common');

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
        gameSession = new GameSession(gameInstance, sessionInfo.port, sessionInfo.username);
    } catch (err) {
        log.error('Error instantiating game session');
        log.error(err);
        if (ERROR_REPORTING_ENABLED) {
            reportBug(`Exception: ${err.message} Stack: ${err.stack}`);
        }
    }

    if (gameSession) {

        gameSession.initialize(() => {
            socketServer(gameSession, sessionInfo.port, () => {
                sendProcessMessage({
                    'success': true
                });
            }, HTTPS_ENABLED ? sessionInfo.certPath : null, sessionInfo.username);
        });
    }

};

// ---------------------------------------------------------------------------
// No-frame mode: uses MiniGameSession — no bezel, no HomegamesRoot, no
// Homenames integration. Just the raw game with a WebSocket server.
// Used for sessions created via the Homenames HTTP API (homegamesio, etc.)
// ---------------------------------------------------------------------------

const startServerNoFrame = (sessionInfo) => {
    const { MiniGameSession } = require('homegames-common');

    log.info('Starting no-frame server with session info', sessionInfo);

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
        if (miniSession) return miniSession.handleNewAsset(key, asset);
        return Promise.resolve();
    };

    const gameInstance = new GameClass({ addAsset });
    miniSession = new MiniGameSession(gameInstance, squishVersion);

    miniSession.initialize().then(() => {
        // Simple WebSocket server — no bezel, no Homenames, no proxy
        const server = http.createServer((req, res) => {
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    ok: true,
                    playerCount: miniSession ? miniSession.getPlayerCount() : 0,
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

                    ws.send(Buffer.from([2, playerId, miniSession.aspectRatio.x, miniSession.aspectRatio.y, 0, 0, ...svBuf]));
                    miniSession.addPlayer(playerId, ws, clientInfo);
                } else if (miniSession && playerId != null) {
                    miniSession.handleInput(playerId, parsed);
                }
            });

            ws.on('close', () => {
                if (miniSession && playerId != null) {
                    miniSession.removePlayer(playerId);
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
                    const players = miniSession
                        ? Object.keys(miniSession.players).map(id => ({ id, name: 'Player ' + id }))
                        : Object.values(gameSession.players).map(p => ({ id: p.id, name: p.info.name }));
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
    if (!gameSession && !miniSession) {
        log.info('discontinuing myself (no session)');
        process.exit(0);
        return;
    }

    const hasPlayers = miniSession
        ? miniSession.getPlayerCount() > 0
        : (Object.values(gameSession.players).length > 0 || Object.values(gameSession.spectators).length > 0);

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

