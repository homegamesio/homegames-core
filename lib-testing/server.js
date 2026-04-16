// Simplified Homegames server for the embeddable client library.
//
// Accepts WebSocket connections. The client sends a "ready" message with either:
//   - { requestedGame: { gameVersionId } }  — server fetches & runs the published game
//   - { code: "..." }                       — server runs the code directly (Studio preview)
//   - { type: 'updateCode', code: '...' }   — hot-reload: replace the running game with new code
//
// No dashboard, no Homenames, no child processes — just a direct game session.
//
// Usage:
//   PORT=7001 node server.js
//   PORT=7001 GAME_PATH=/path/to/game/index.js node server.js   # load a local game file

const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

const {
    gameLoader: {
        squishMap,
        DEFAULT_SQUISH_VERSION,
        detectSquishVersion,
        loadGameClass,
        loadGameClassFromPath,
        fetchGameFromForgejo,
    },
    MiniGameSession,
    getConfigValue,
} = require('homegames-common');

const PORT = Number(process.env.PORT) || 7001;
const GAME_PATH = process.env.GAME_PATH || null;

// Temp directory for code loaded from strings — inside __dirname so require() resolves our node_modules
const TMP_DIR = path.join(__dirname, '.tmp-games');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

// ---------------------------------------------------------------------------
// Forgejo config (optional — for gameVersionId loading)
// ---------------------------------------------------------------------------
let forgejoUrl, forgejoToken;
try {
    forgejoUrl = getConfigValue('FORGEJO_URL', '');
    forgejoToken = getConfigValue('FORGEJO_ADMIN_TOKEN', '');
} catch (e) {
    forgejoUrl = '';
    forgejoToken = '';
}

// ---------------------------------------------------------------------------
// Player ID pool
// ---------------------------------------------------------------------------
let playerIdCounter = 0;
const generatePlayerId = () => ++playerIdCounter;

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200);
        res.end('ok');
        return;
    }
    res.writeHead(404);
    res.end('Not found');
});

const wss = new WebSocket.Server({ server });

const sessions = new Map();

const createSession = (GameClass, squishVersion) => {
    const session = { _mini: null };

    const addAsset = (key, asset) => {
        if (session._mini) return session._mini.handleNewAsset(key, asset);
        return Promise.resolve();
    };

    const gameInstance = new GameClass({ addAsset });
    session._mini = new MiniGameSession(gameInstance, squishVersion);

    return session._mini;
};

wss.on('connection', (ws) => {
    console.log('[lib-testing] New WebSocket connection');

    let session = null;
    let playerId = null;

    ws.on('message', (msg) => {
        const msgStr = typeof msg === 'string' ? msg : msg.toString();
        let parsed;
        try {
            parsed = JSON.parse(msgStr);
        } catch (e) {
            return;
        }

        console.log('[lib-testing] Received message type:', parsed.type);

        if (parsed.type === 'ready') {
            playerId = parsed.id || generatePlayerId();
            const clientInfo = parsed.clientInfo?.clientInfo || {};

            let GameClass, squishVersion;

            const setSquishEnv = (sv) => {
                process.env.SQUISH_PATH = require.resolve(squishMap[sv] || squishMap[DEFAULT_SQUISH_VERSION]);
            };

            try {
                if (parsed.code) {
                    squishVersion = detectSquishVersion(parsed.code);
                    console.log('[lib-testing] Detected squish version:', squishVersion);
                    setSquishEnv(squishVersion);
                    GameClass = loadGameClass(parsed.code, TMP_DIR);
                    console.log('[lib-testing] Loaded game class:', GameClass?.name);
                } else if (parsed.requestedGame?.gameVersionId) {
                    // TODO: fetch from Forgejo by versionId using fetchGameFromForgejo
                    // For now, fall back to GAME_PATH env var
                    if (!GAME_PATH) {
                        console.error('[lib-testing] No GAME_PATH set and Forgejo version loading not yet fully wired');
                        ws.close();
                        return;
                    }
                    // Set SQUISH_PATH to default before loading; game code requires it at parse time
                    setSquishEnv(DEFAULT_SQUISH_VERSION);
                    GameClass = loadGameClassFromPath(GAME_PATH);
                    squishVersion = (GameClass.metadata && GameClass.metadata().squishVersion) || DEFAULT_SQUISH_VERSION;
                    setSquishEnv(squishVersion);
                } else if (GAME_PATH) {
                    setSquishEnv(DEFAULT_SQUISH_VERSION);
                    GameClass = loadGameClassFromPath(GAME_PATH);
                    squishVersion = (GameClass.metadata && GameClass.metadata().squishVersion) || DEFAULT_SQUISH_VERSION;
                    setSquishEnv(squishVersion);
                } else {
                    console.error('[lib-testing] No game specified');
                    ws.close();
                    return;
                }
            } catch (err) {
                console.error('[lib-testing] Failed to load game:', err);
                ws.close();
                return;
            }

            try {
                session = createSession(GameClass, squishVersion);

                session.initialize().then(() => {
                    const sv = squishVersion;
                    const svBuf = [sv.length];
                    for (let i = 0; i < sv.length; i++) {
                        svBuf.push(sv.charCodeAt(i));
                    }

                    ws.send(Buffer.from([2, playerId, session.aspectRatio.x, session.aspectRatio.y, 0, 0, ...svBuf]));
                    session.addPlayer(playerId, ws, clientInfo);
                    sessions.set(ws, session);

                    console.log(`[lib-testing] Session started for player ${playerId}, squish ${squishVersion}`);
                }).catch(err => {
                    console.error('[lib-testing] Failed to initialize session:', err);
                    ws.close();
                });
            } catch (err) {
                console.error('[lib-testing] Failed to create game instance:', err);
                ws.close();
            }

        } else if (parsed.type === 'updateCode') {
            console.log('[lib-testing] Received code update');

            if (session) {
                session.destroy();
                sessions.delete(ws);
            }

            try {
                const squishVersion = detectSquishVersion(parsed.code);
                process.env.SQUISH_PATH = require.resolve(squishMap[squishVersion] || squishMap[DEFAULT_SQUISH_VERSION]);

                const GameClass = loadGameClass(parsed.code, TMP_DIR);
                session = createSession(GameClass, squishVersion);

                session.initialize().then(() => {
                    const sv = squishVersion;
                    const svBuf = [sv.length];
                    for (let i = 0; i < sv.length; i++) {
                        svBuf.push(sv.charCodeAt(i));
                    }

                    ws.send(Buffer.from([2, playerId, session.aspectRatio.x, session.aspectRatio.y, 0, 0, ...svBuf]));
                    session.addPlayer(playerId, ws, {});
                    sessions.set(ws, session);

                    console.log('[lib-testing] Code updated, session restarted');
                }).catch(err => {
                    console.error('[lib-testing] Failed to initialize after code update:', err);
                });
            } catch (err) {
                console.error('[lib-testing] Failed to load updated code:', err);
            }

        } else if (session && playerId != null) {
            session.handleInput(playerId, parsed);
        }
    });

    ws.on('close', () => {
        if (session && playerId != null) {
            session.removePlayer(playerId);
        }
        if (session) {
            session.destroy();
            sessions.delete(ws);
        }
        console.log('[lib-testing] Connection closed');
    });

    ws.on('error', (err) => {
        console.error('[lib-testing] WebSocket error:', err);
    });
});

server.listen(PORT, () => {
    console.log(`[lib-testing] Homegames lib-testing server running on port ${PORT}`);
    if (GAME_PATH) {
        console.log(`[lib-testing] Default game: ${GAME_PATH}`);
    }
    console.log('[lib-testing] Accepts: gameVersionId, code (raw JS), updateCode (hot-reload)');
});
