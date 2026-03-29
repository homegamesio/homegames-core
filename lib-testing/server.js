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

const PORT = Number(process.env.PORT) || 7001;
const GAME_PATH = process.env.GAME_PATH || null;

// ---------------------------------------------------------------------------
// Squish map (same as homegames-core)
// ---------------------------------------------------------------------------
const squishMap = {
    '0756': 'squish-0756',
    '0762': 'squish-0762',
    '0765': 'squish-0765',
    '0766': 'squish-0766',
    '0767': 'squish-0767',
    '1000': 'squish-1000',
    '1004': 'squish-1004',
    '1005': 'squish-1005',
    '1006': 'squish-1006',
    '1007': 'squish-1007',
    '1008': 'squish-1008',
    '1009': 'squish-1009',
    '1010': 'squish-1010',
    '120': 'squish-120',
    '130': 'squish-130',
    '135': 'squish-135',
    '136': 'squish-136',
    '137': 'squish-137',
};

const DEFAULT_SQUISH_VERSION = '135';

// ---------------------------------------------------------------------------
// Minimal GameSession — stripped down from src/GameSession.js
// No HomegamesRoot (bezel/frame), no Homenames, no spectators.
// Just: game + squisher + players.
// ---------------------------------------------------------------------------

class MiniGameSession {
    constructor(game, squishVersion) {
        const squishPkg = squishMap[squishVersion] || squishMap[DEFAULT_SQUISH_VERSION];
        const { Squisher } = require(squishPkg);

        this.game = game;
        this.squishVersion = squishVersion;
        this.scale = { x: 1, y: 1 };

        this.squisher = new Squisher({
            game,
            scale: this.scale,
            onAssetUpdate: (newAssetBundle) => {
                for (const pid in this.players) {
                    this._send(this.players[pid], newAssetBundle);
                }
            },
        });

        this.squisher.addListener(() => this._broadcastState());

        this.gameMetadata = game.constructor.metadata ? game.constructor.metadata() : {};
        this.aspectRatio = this.gameMetadata.aspectRatio || { x: 16, y: 9 };
        this.players = {};  // id -> ws
        this.playerInfoMap = {};
        this.clientInfoMap = {};
    }

    initialize() {
        // Squisher already calls initialize() in its constructor.
        // Calling it again hangs for games with zero assets (promise never resolves).
        // Just resolve immediately — the squisher is ready.
        return Promise.resolve();
    }

    addPlayer(playerId, ws, clientInfo, requestedGame) {
        this.players[playerId] = ws;
        this.clientInfoMap[playerId] = clientInfo || {};

        // Send asset bundle if we have one
        if (this.squisher.assetBundle) {
            this._send(ws, this.squisher.assetBundle);
        }

        const playerPayload = {
            playerId,
            settings: {},
            info: {},
            clientInfo: clientInfo || {},
            requestedGame,
        };

        this.game.handleNewPlayer && this.game.handleNewPlayer(playerPayload);
    }

    removePlayer(playerId) {
        this.game.handlePlayerDisconnect && this.game.handlePlayerDisconnect(playerId);
        delete this.players[playerId];
        delete this.playerInfoMap[playerId];
        delete this.clientInfoMap[playerId];
    }

    handleInput(playerId, input) {
        if (input.type === 'click') {
            this._handleClick(playerId, input.data);
        } else if (input.type === 'keydown') {
            this.game.handleKeyDown && this.game.handleKeyDown(Number(playerId), input.key);
        } else if (input.type === 'keyup') {
            this.game.handleKeyUp && this.game.handleKeyUp(Number(playerId), input.key);
        } else if (input.type === 'mouseup') {
            this.game.handleMouseUp && this.game.handleMouseUp(playerId, input.data);
        } else if (input.type === 'input') {
            if (input.gamepad) {
                this.game.handleGamepadInput && this.game.handleGamepadInput(Number(playerId), input);
            } else {
                const node = this.game.findNode(input.nodeId);
                if (node && node.node.input) {
                    if (node.node.input.type === 'file') {
                        node.node.input.oninput(playerId, Object.values(input.input));
                    } else {
                        node.node.input.oninput(playerId, input.input);
                    }
                }
            }
        } else if (input.type === 'onhover') {
            const node = this.game.findNode(input.nodeId);
            if (node && node.node?.onHover) node.node.onHover(playerId);
        } else if (input.type === 'offhover') {
            const node = this.game.findNode(input.nodeId);
            if (node && node.node?.offHover) node.node.offHover(playerId);
        }
    }

    handleNewAsset(key, asset) {
        return this.squisher.handleNewAsset(key, asset).then(newBundle => {
            for (const pid in this.players) {
                this._send(this.players[pid], newBundle);
            }
        });
    }

    _handleClick(playerId, click) {
        if (click.x >= 100 || click.y >= 100) return;

        // Walk the game tree to find what was clicked (simplified — no bezel offset)
        const clicked = this._findClick(click.x, click.y, playerId);
        if (clicked) {
            const realNode = this.game.findNode(clicked.id);
            if (realNode) {
                realNode.node.handleClick && realNode.node.handleClick(playerId, click.x, click.y);
            }
        }
    }

    _findClick(x, y, playerId) {
        let clicked = null;
        for (const layerIndex in this.game.getLayers()) {
            const layer = this.game.getLayers()[layerIndex];
            const scale = layer.scale || this.scale;
            clicked = this._findClickHelper(x, y, playerId, layer.root.node, null, scale) || clicked;
        }
        return clicked;
    }

    _findClickHelper(x, y, playerId, node, clicked, scale) {
        if (node.playerIds && node.playerIds.length > 0 && !node.playerIds.find(p => p === playerId)) {
            return clicked;
        }

        if (node.coordinates2d) {
            const vertices = [];
            for (const i in node.coordinates2d) {
                const xOff = 100 - (scale.x * 100);
                const yOff = 100 - (scale.y * 100);
                const sx = node.coordinates2d[i][0] * ((100 - xOff) / 100) + (xOff / 2);
                const sy = node.coordinates2d[i][1] * ((100 - yOff) / 100) + (yOff / 2);
                vertices.push([sx, sy]);
            }

            let isInside = false;
            let minX = vertices[0][0], maxX = vertices[0][0];
            let minY = vertices[0][1], maxY = vertices[0][1];
            for (let i = 1; i < vertices.length; i++) {
                minX = Math.min(vertices[i][0], minX);
                maxX = Math.max(vertices[i][0], maxX);
                minY = Math.min(vertices[i][1], minY);
                maxY = Math.max(vertices[i][1], maxY);
            }

            if (!(x < minX || x > maxX || y < minY || y > maxY)) {
                let ii = 0, jj = vertices.length - 1;
                for (ii, jj; ii < vertices.length; jj = ii++) {
                    if ((vertices[ii][1] > y) !== (vertices[jj][1] > y) &&
                        x < (vertices[jj][0] - vertices[ii][0]) * (y - vertices[ii][1]) / (vertices[jj][1] - vertices[ii][1]) + vertices[ii][0]) {
                        isInside = !isInside;
                    }
                }
            }

            if (isInside) clicked = node;
        }

        for (const i in node.children) {
            clicked = this._findClickHelper(x, y, playerId, node.children[i].node, clicked, scale);
        }

        return clicked;
    }

    _broadcastState() {
        for (const pid in this.players) {
            let frame = this.squisher.getPlayerFrame(pid);
            if (!frame) {
                // No per-player frame (game doesn't use playerIds on nodes).
                // Send the full squished state instead.
                frame = this.squisher.state;
            }
            if (frame) {
                const flat = Array.isArray(frame) ? frame.flat() : frame;
                this._send(this.players[pid], flat);
            }
        }
    }

    _send(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(Buffer.from(data));
        }
    }

    destroy() {
        // Clean up game timers if the game supports it
        if (this.game.destroy) this.game.destroy();
    }
}

// ---------------------------------------------------------------------------
// Load a game class from a file path
// ---------------------------------------------------------------------------
const loadGameFromPath = (gamePath) => {
    const resolvedPath = path.resolve(gamePath);
    // Clear require cache so we get fresh code
    delete require.cache[require.resolve(resolvedPath)];
    return require(resolvedPath);
};

// ---------------------------------------------------------------------------
// Load a game class from raw source code string.
// Writes to a temp file and requires it — avoids VM realm issues.
// ---------------------------------------------------------------------------
const os = require('os');
let tmpCounter = 0;

// Write temp files inside __dirname so Node's require resolves our node_modules
const TMP_DIR = path.join(__dirname, '.tmp-games');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

const loadGameFromCode = (code, squishVersion) => {
    const tmpPath = path.join(TMP_DIR, `hg-studio-${Date.now()}-${tmpCounter++}.js`);
    fs.writeFileSync(tmpPath, code);
    try {
        delete require.cache[require.resolve(tmpPath)];
        return require(tmpPath);
    } finally {
        try { fs.unlinkSync(tmpPath); } catch (e) {}
    }
};

// ---------------------------------------------------------------------------
// Detect squish version from code string (best-effort parse)
// ---------------------------------------------------------------------------
const detectSquishVersion = (code) => {
    // Look for squishVersion in a metadata() method
    const match = code.match(/squishVersion\s*:\s*['"](\w+)['"]/);
    return match ? match[1] : DEFAULT_SQUISH_VERSION;
};

// ---------------------------------------------------------------------------
// Player ID pool
// ---------------------------------------------------------------------------
let playerIdCounter = 0;
const generatePlayerId = () => ++playerIdCounter;

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
    // Simple health check
    if (req.url === '/health') {
        res.writeHead(200);
        res.end('ok');
        return;
    }
    res.writeHead(404);
    res.end('Not found');
});

const wss = new WebSocket.Server({ server });

// Active sessions: one per connection for now
const sessions = new Map();

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
            // Not JSON — ignore
            return;
        }

        console.log('[lib-testing] Received message type:', parsed.type);

        if (parsed.type === 'ready') {
            playerId = parsed.id || generatePlayerId();
            console.log('[lib-testing] Player ID:', playerId);
            console.log('[lib-testing] Has code:', !!parsed.code);
            console.log('[lib-testing] Has requestedGame:', !!parsed.requestedGame);

            const clientInfo = parsed.clientInfo?.clientInfo || {};

            // Determine how to load the game
            let GameClass, squishVersion;

            try {
                if (parsed.code) {
                    // Raw code from Studio
                    squishVersion = detectSquishVersion(parsed.code);
                    console.log('[lib-testing] Detected squish version:', squishVersion);
                    GameClass = loadGameFromCode(parsed.code, squishVersion);
                    console.log('[lib-testing] Loaded game class:', GameClass?.name);
                } else if (parsed.requestedGame?.gameVersionId) {
                    // TODO: fetch from Forgejo/API by versionId
                    // For now, fall back to GAME_PATH env var
                    if (!GAME_PATH) {
                        console.error('[lib-testing] No GAME_PATH set and version loading not yet implemented');
                        ws.close();
                        return;
                    }
                    GameClass = loadGameFromPath(GAME_PATH);
                    squishVersion = (GameClass.metadata && GameClass.metadata().squishVersion) || DEFAULT_SQUISH_VERSION;
                } else if (GAME_PATH) {
                    GameClass = loadGameFromPath(GAME_PATH);
                    squishVersion = (GameClass.metadata && GameClass.metadata().squishVersion) || DEFAULT_SQUISH_VERSION;
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

            // Set SQUISH_PATH for the game
            process.env.SQUISH_PATH = require.resolve(squishMap[squishVersion] || squishMap[DEFAULT_SQUISH_VERSION]);

            try {
                console.log('[lib-testing] Creating game instance...');
                const addAsset = (key, asset) => session.handleNewAsset(key, asset);
                const gameInstance = new GameClass({ addAsset });
                console.log('[lib-testing] Game instance created, creating session...');
                session = new MiniGameSession(gameInstance, squishVersion);
                console.log('[lib-testing] Initializing session...');

                session.initialize().then(() => {
                    // Send init message: [2, playerId, aspectX, aspectY, bezelX, bezelY, squishVersionLen, ...squishVersionChars]
                    const sv = squishVersion;
                    const svBuf = [];
                    svBuf.push(sv.length);
                    for (let i = 0; i < sv.length; i++) {
                        svBuf.push(sv.charCodeAt(i));
                    }

                    const initMsg = Buffer.from([2, playerId, session.aspectRatio.x, session.aspectRatio.y, 0, 0, ...svBuf]);
                    ws.send(initMsg);

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
            // Hot-reload: replace the running game with new code
            console.log('[lib-testing] Received code update');

            if (session) {
                session.destroy();
                sessions.delete(ws);
            }

            try {
                const squishVersion = detectSquishVersion(parsed.code);
                process.env.SQUISH_PATH = require.resolve(squishMap[squishVersion] || squishMap[DEFAULT_SQUISH_VERSION]);

                const GameClass = loadGameFromCode(parsed.code, squishVersion);
                const addAsset = (key, asset) => session.handleNewAsset(key, asset);
                const gameInstance = new GameClass({ addAsset });
                session = new MiniGameSession(gameInstance, squishVersion);

                session.initialize().then(() => {
                    const sv = squishVersion;
                    const svBuf = [];
                    svBuf.push(sv.length);
                    for (let i = 0; i < sv.length; i++) {
                        svBuf.push(sv.charCodeAt(i));
                    }

                    ws.send(Buffer.from([2, playerId, session.aspectRatio.x, session.aspectRatio.y, 0, 0, ...svBuf]));

                    session.addPlayer(playerId, ws, {});
                    sessions.set(ws, session);

                    console.log(`[lib-testing] Code updated, session restarted`);
                }).catch(err => {
                    console.error('[lib-testing] Failed to initialize after code update:', err);
                });
            } catch (err) {
                console.error('[lib-testing] Failed to load updated code:', err);
            }
        } else if (session && playerId != null) {
            // Game input
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
    console.log(`[lib-testing] Accepts: gameVersionId, code (raw JS), updateCode (hot-reload)`);
});
