/**
 * validate.js — Runs inside a Docker container for homedome game validation.
 *
 * Environment variables:
 *   SQUISH_VERSION — which squish version to use
 *
 * Game code is mounted read-only at /app/game/
 * Network is disabled (--network=none).
 *
 * Behavior:
 *   1. Find and load game class from /app/game/
 *   2. Verify metadata() exists and its fields are sane (name, squishVersion,
 *      aspectRatio, tickRate, services, assets)
 *   3. Instantiate the game with the same options a real session passes
 *   4. Verify getLayers() returns a valid structure
 *   5. Squish every node in every layer — the actual serialization contract a
 *      connected client depends on
 *   6. Simulate a session: players join, keyboard/mouse input, clicks on
 *      clickable nodes, a player disconnects — while driving tick() the same
 *      way Squisher does
 *   7. Re-squish the final state to catch state corrupted during play
 *   8. Output a single marker-prefixed JSON result line to stdout and exit
 *
 * stdout is reserved for the result line. All game console output (and this
 * script's own logging) goes to stderr so log noise can never corrupt the
 * result.
 *
 * Output (stdout, one line):
 *   __HG_VALIDATE_RESULT__{"success":true,"squishVersion":"142","assetIds":[],"warnings":[]}
 *
 * Exit code: 0 = validation passed, 1 = validation failed
 */

const path = require('path');
const fs = require('fs');

const SQUISH_VERSION = process.env.SQUISH_VERSION || '142';
const GAME_DIR = '/app/game';
const VALIDATION_RUN_MS = 5000; // let the game run for 5 seconds
const RESULT_MARKER = '__HG_VALIDATE_RESULT__';
const MAX_WARNINGS = 20;
const MAX_BOOT_NODES = 10000; // node count at first squish — sanity bound
const MAX_CLICK_POKES = 25;

const { squishMap, DEFAULT_SQUISH_VERSION, parseSquishVersion } = require('homegames-common/game-loader');

// ---------------------------------------------------------------------------
// stdout is the result channel. Capture the raw write + exit up front, then
// send everything console-shaped (including game logging) to stderr and
// convert game-initiated process.exit() into a validation failure.
// ---------------------------------------------------------------------------
const rawStdoutWrite = process.stdout.write.bind(process.stdout);
const realExit = process.exit.bind(process);

for (const method of ['log', 'info', 'warn', 'debug', 'trace']) {
    console[method] = (...args) => console.error(...args);
}
process.stdout.write = (chunk, ...rest) => process.stderr.write(chunk, ...rest);

let resultWritten = false;
const writeResult = (result) => {
    if (resultWritten) return;
    resultWritten = true;
    rawStdoutWrite(RESULT_MARKER + JSON.stringify(result) + '\n');
    realExit(result.success ? 0 : 1);
};

// Game code calling process.exit() would otherwise silently kill validation.
process.exit = (code) => {
    writeResult({ success: false, error: `Game code called process.exit(${code === undefined ? '' : code}) — games must not exit the process` });
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const findEntryPoint = (dir) => {
    const walk = (d, depth) => {
        let results = [];
        let entries;
        try { entries = fs.readdirSync(d); } catch (e) { return results; }

        for (const entry of entries) {
            if (entry === 'node_modules') continue;
            const full = path.join(d, entry);
            const stat = fs.statSync(full);
            if (stat.isFile() && entry === 'index.js') {
                results.push({ path: full, depth });
            } else if (stat.isDirectory()) {
                results = results.concat(walk(full, depth + 1));
            }
        }
        return results;
    };

    const candidates = walk(dir, 0).sort((a, b) => a.depth - b.depth);
    return candidates.length > 0 ? candidates[0].path : null;
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------------------
// Metadata validation. Returns a list of error strings (empty = valid).
// ---------------------------------------------------------------------------
const KNOWN_SERVICES = new Set(['multiplayer', 'contentGenerator']);

const validateMetadata = (metadata, detectedSquishVersion) => {
    const errors = [];
    const warnings = [];

    if (!isPlainObject(metadata)) {
        return { errors: ['metadata() must return an object'], warnings };
    }

    // squishVersion — required, supported, and consistent with the version
    // detected from the require() in source.
    if (!metadata.squishVersion) {
        errors.push('metadata() must return a squishVersion');
    } else if (typeof metadata.squishVersion !== 'string') {
        errors.push('metadata().squishVersion must be a string');
    } else if (!squishMap[metadata.squishVersion]) {
        errors.push(`metadata().squishVersion "${metadata.squishVersion}" is not a supported squish version (supported: ${Object.keys(squishMap).join(', ')})`);
    } else if (detectedSquishVersion && metadata.squishVersion !== detectedSquishVersion) {
        errors.push(`metadata().squishVersion is "${metadata.squishVersion}" but the game requires squish-${detectedSquishVersion} — these must match`);
    }

    // name — required for catalog display
    if (metadata.name === undefined || metadata.name === null) {
        errors.push('metadata() must return a name');
    } else if (typeof metadata.name !== 'string' || metadata.name.trim().length === 0) {
        errors.push('metadata().name must be a non-empty string');
    } else if (metadata.name.length > 100) {
        errors.push('metadata().name must be 100 characters or fewer');
    }

    if (metadata.description !== undefined && (typeof metadata.description !== 'string' || metadata.description.length > 1000)) {
        errors.push('metadata().description must be a string of 1000 characters or fewer');
    }

    if (metadata.author !== undefined && typeof metadata.author !== 'string') {
        errors.push('metadata().author must be a string');
    }

    if (metadata.aspectRatio !== undefined) {
        const ar = metadata.aspectRatio;
        if (!isPlainObject(ar) || !isFiniteNumber(ar.x) || !isFiniteNumber(ar.y) || ar.x <= 0 || ar.y <= 0) {
            errors.push('metadata().aspectRatio must be an object like { x: 16, y: 9 } with positive numbers');
        }
    }

    if (metadata.tickRate !== undefined) {
        if (!isFiniteNumber(metadata.tickRate) || metadata.tickRate < 1 || metadata.tickRate > 120) {
            errors.push('metadata().tickRate must be a number between 1 and 120');
        }
    }

    if (metadata.services !== undefined) {
        if (!Array.isArray(metadata.services) || metadata.services.some(s => typeof s !== 'string')) {
            errors.push('metadata().services must be an array of strings');
        } else {
            for (const service of metadata.services) {
                if (!KNOWN_SERVICES.has(service)) {
                    warnings.push(`metadata().services contains unknown service "${service}"`);
                }
            }
        }
    }

    if (metadata.assets !== undefined) {
        if (!isPlainObject(metadata.assets)) {
            errors.push('metadata().assets must be an object mapping keys to Asset instances');
        } else {
            for (const key of Object.keys(metadata.assets)) {
                const asset = metadata.assets[key];
                const info = asset && asset.info;
                if (!info || typeof info !== 'object') {
                    errors.push(`metadata().assets["${key}"] is not a valid Asset (missing info)`);
                } else if (info.id !== undefined && (typeof info.id !== 'string' || info.id.trim().length === 0)) {
                    errors.push(`metadata().assets["${key}"] has an invalid id`);
                }
            }
        }
    }

    return { errors, warnings };
};

// ---------------------------------------------------------------------------
// Node tree walking + squish checks
// ---------------------------------------------------------------------------

// Walk a GameNode tree, calling visit(gameNode, depth) on every node.
// Bounded and cycle-safe so a malformed tree can't hang validation.
const walkNodeTree = (root, visit, maxNodes = MAX_BOOT_NODES * 2) => {
    const seen = new Set();
    const stack = [{ node: root, depth: 0 }];
    let count = 0;

    while (stack.length > 0) {
        const { node, depth } = stack.pop();
        if (!node || !node.node) continue;
        if (seen.has(node.node)) continue;
        seen.add(node.node);

        count++;
        if (count > maxNodes) {
            throw new Error(`Node tree exceeds ${maxNodes} nodes (possible runaway node creation or cycle)`);
        }

        visit(node, depth);

        const children = node.node.children || [];
        for (const child of children) {
            stack.push({ node: child, depth: depth + 1 });
        }
    }

    return count;
};

// Extract layers as an array of { root } entries (getLayers may return an
// array or a keyed object). Throws with a descriptive error on bad structure.
const getLayerArray = (gameInstance) => {
    if (!gameInstance.getLayers || typeof gameInstance.getLayers !== 'function') {
        throw new Error('Game instance missing getLayers() method');
    }

    const layers = gameInstance.getLayers();

    if (!Array.isArray(layers) && !isPlainObject(layers)) {
        throw new Error('getLayers() must return an array or object');
    }

    const layerArray = Array.isArray(layers) ? layers : Object.values(layers);
    if (layerArray.length === 0) {
        throw new Error('getLayers() returned no layers — a game must render at least one layer');
    }

    layerArray.forEach((layer, i) => {
        if (!layer || !layer.root) {
            throw new Error(`Layer ${i} missing root property`);
        }
        if (!layer.root.node) {
            throw new Error(`Layer ${i} root is not a GameNode (missing internal node)`);
        }
    });

    return layerArray;
};

// Squish every node in every layer — same contract Squisher applies when
// serializing state for clients. Returns the total node count.
const squishAllLayers = (gameInstance, squishFn, label) => {
    const layerArray = getLayerArray(gameInstance);
    let totalNodes = 0;

    layerArray.forEach((layer, i) => {
        totalNodes += walkNodeTree(layer.root, (gameNode) => {
            try {
                squishFn(gameNode);
            } catch (err) {
                const id = gameNode.node && gameNode.node.id;
                throw new Error(`Failed to serialize node ${id} in layer ${i} ${label}: ${err.message}`);
            }
        });
    });

    return totalNodes;
};

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------
const run = () => {
    const warnings = [];
    const addWarning = (msg) => {
        if (warnings.length < MAX_WARNINGS) warnings.push(msg);
    };

    // Step 1: Find entry point
    const entryPath = findEntryPoint(GAME_DIR);
    if (!entryPath) {
        return writeResult({ success: false, error: 'No index.js found in game directory' });
    }

    // Step 2: Detect squish version from source (AST-based)
    let detectedSquishVersion;
    try {
        detectedSquishVersion = parseSquishVersion(entryPath);
    } catch (err) {
        return writeResult({ success: false, error: `Failed to parse squish version: ${err.message}` });
    }

    const squishVersion = detectedSquishVersion || SQUISH_VERSION;

    // Set up squish path
    const squishPkg = squishMap[squishVersion] || squishMap[DEFAULT_SQUISH_VERSION];
    let squishLib;
    try {
        process.env.SQUISH_PATH = require.resolve(squishPkg);
        squishLib = require(squishPkg);
        require('homegames-common/stream-node').installStreamNode(squishLib.GameNode);
    } catch (err) {
        return writeResult({ success: false, error: `Squish version ${squishVersion} (package ${squishPkg}) not installed` });
    }

    const squishNode = (gameNode) => squishLib.squish(gameNode);

    // Game code resolves squish-* and any allowed deps from the image's
    // pre-installed packages (game dir is read-only, no node_modules).
    const gameNodeModules = path.join(path.dirname(entryPath), 'node_modules');
    if (!fs.existsSync(gameNodeModules)) {
        try {
            process.env.NODE_PATH = '/app/node_modules';
            require('module').Module._initPaths();
        } catch (e) {
            // best effort
        }
    }

    // Step 3: Load the game class
    let GameClass;
    try {
        GameClass = require(entryPath);
    } catch (err) {
        return writeResult({ success: false, error: `Failed to require game: ${err.message}` });
    }

    if (typeof GameClass !== 'function') {
        return writeResult({ success: false, error: 'index.js must export a game class (module.exports = MyGame)' });
    }

    // Step 4: Verify metadata
    if (!GameClass.metadata || typeof GameClass.metadata !== 'function') {
        return writeResult({ success: false, error: 'Game class missing static metadata() method' });
    }

    let metadata;
    try {
        metadata = GameClass.metadata();
    } catch (err) {
        return writeResult({ success: false, error: `metadata() threw: ${err.message}` });
    }

    const metadataCheck = validateMetadata(metadata, detectedSquishVersion);
    metadataCheck.warnings.forEach(addWarning);
    if (metadataCheck.errors.length > 0) {
        return writeResult({ success: false, error: metadataCheck.errors.slice(0, 5).join('; ') });
    }

    // Step 5: Instantiate the game with the same options shape a real
    // session passes (child_game_server.js: { addAsset, saveGame, saveData }).
    let gameInstance;
    try {
        const addAsset = () => Promise.resolve();
        const saveGame = () => {};
        const setCursor = (playerId, cursor) => {
            require('homegames-common/cursor').normalizeCursor(cursor);
            return true;
        };
        gameInstance = new GameClass({ addAsset, saveGame, saveData: null, setCursor,
            media: new (require('homegames-common/media-session'))() });
    } catch (err) {
        return writeResult({ success: false, error: `Failed to instantiate game: ${err.message}` });
    }

    // Step 6: Verify layer structure and squish the entire boot state — the
    // actual serialization contract clients depend on.
    let bootNodeCount;
    try {
        bootNodeCount = squishAllLayers(gameInstance, squishNode, 'at boot');
    } catch (err) {
        return writeResult({ success: false, error: err.message });
    }

    if (bootNodeCount > MAX_BOOT_NODES) {
        return writeResult({ success: false, error: `Game creates ${bootNodeCount} nodes at boot — maximum is ${MAX_BOOT_NODES}` });
    }

    // Step 6b: Collect asset IDs for NSFW flagging
    const collectedAssetIds = [];
    try {
        const metadataAssets = metadata.assets || {};
        for (const key of Object.keys(metadataAssets)) {
            const id = metadataAssets[key]?.info?.id;
            if (id) collectedAssetIds.push(id);
        }
        if (gameInstance.getAssets && typeof gameInstance.getAssets === 'function') {
            const instanceAssets = gameInstance.getAssets() || {};
            for (const key of Object.keys(instanceAssets)) {
                const id = instanceAssets[key]?.info?.id;
                if (id && !collectedAssetIds.includes(id)) collectedAssetIds.push(id);
            }
        }
    } catch (err) {
        // Non-fatal — proceed without asset list
        console.error('Failed to collect asset IDs:', err.message);
    }

    // Step 7: Simulated session. Track uncaught errors throughout.
    const uncaughtErrors = [];

    process.on('uncaughtException', (err) => {
        uncaughtErrors.push(err.message || err.toString());
    });

    process.on('unhandledRejection', (reason) => {
        uncaughtErrors.push(reason?.message || String(reason));
    });

    const makePlayerPayload = (playerId) => ({
        playerId,
        info: { name: `validator-${playerId}` },
        settings: {},
        clientInfo: { aspectRatio: metadata.aspectRatio || { x: 16, y: 9 } },
        requestedGame: null,
    });

    // Players joining is the most basic lifecycle event — a throwing
    // handleNewPlayer means the game is broken for everyone, so it's fatal.
    if (gameInstance.handleNewPlayer) {
        for (const playerId of [1, 2]) {
            try {
                gameInstance.handleNewPlayer(makePlayerPayload(playerId));
            } catch (err) {
                return writeResult({ success: false, error: `handleNewPlayer threw for player ${playerId}: ${err.message}`, squishVersion, assetIds: collectedAssetIds });
            }
        }
    }

    // Drive tick() the same way Squisher does (Squisher isn't constructed
    // here because its initialize() downloads assets and the network is off).
    let tickErrorCount = 0;
    let lastTickError = null;
    let tickInterval = null;
    if (gameInstance.tick && typeof gameInstance.tick === 'function') {
        const tickRate = metadata.tickRate || 60;
        tickInterval = setInterval(() => {
            try {
                gameInstance.tick();
            } catch (err) {
                tickErrorCount++;
                lastTickError = err.message || String(err);
            }
        }, 1000 / tickRate);
    }

    // Input pokes. Real sessions wrap these in try/catch and survive them, so
    // errors here are warnings, not failures — but they're worth surfacing.
    const poke = (label, fn) => {
        try {
            fn();
        } catch (err) {
            addWarning(`${label} threw: ${err.message}`);
        }
    };

    const runInputPokes = () => {
        const pid = 1;

        if (gameInstance.handleKeyDown) {
            for (const key of ['w', 'a', 's', 'd', ' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'x']) {
                poke(`handleKeyDown("${key}")`, () => gameInstance.handleKeyDown(pid, key));
                if (gameInstance.handleKeyUp) {
                    poke(`handleKeyUp("${key}")`, () => gameInstance.handleKeyUp(pid, key));
                }
            }
        }

        if (gameInstance.handleMouseMove) {
            for (const [x, y] of [[50, 50], [10, 90], [90, 10]]) {
                poke(`handleMouseMove(${x}, ${y})`, () => gameInstance.handleMouseMove(pid, { x, y }));
            }
        }

        if (gameInstance.handleMouseUp) {
            poke('handleMouseUp', () => gameInstance.handleMouseUp(pid, { x: 50, y: 50 }));
        }

        if (gameInstance.handlePlayerUpdate) {
            poke('handlePlayerUpdate', () => gameInstance.handlePlayerUpdate(pid, { info: { name: 'validator-renamed' }, settings: {} }));
        }

        // Click a sample of clickable nodes, the way a player poking around
        // the UI would.
        try {
            const layerArray = getLayerArray(gameInstance);
            const clickables = [];
            for (const layer of layerArray) {
                walkNodeTree(layer.root, (gameNode) => {
                    if (clickables.length < MAX_CLICK_POKES && typeof gameNode.node.handleClick === 'function') {
                        clickables.push(gameNode);
                    }
                });
                if (clickables.length >= MAX_CLICK_POKES) break;
            }

            for (const gameNode of clickables) {
                const coords = gameNode.node.coordinates2d;
                let x = 50, y = 50;
                if (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0])) {
                    const xs = coords.map(c => c[0]).filter(isFiniteNumber);
                    const ys = coords.map(c => c[1]).filter(isFiniteNumber);
                    if (xs.length && ys.length) {
                        x = (Math.min(...xs) + Math.max(...xs)) / 2;
                        y = (Math.min(...ys) + Math.max(...ys)) / 2;
                    }
                }
                poke(`onClick of node ${gameNode.node.id}`, () => gameNode.node.handleClick(pid, x, y));
            }
        } catch (err) {
            addWarning(`Click poke sweep failed: ${err.message}`);
        }
    };

    // Stagger the simulation across the run window: input midway through,
    // disconnect near the end, so tick() runs against each state.
    setTimeout(runInputPokes, Math.floor(VALIDATION_RUN_MS * 0.3));

    setTimeout(() => {
        if (gameInstance.handlePlayerDisconnect) {
            try {
                gameInstance.handlePlayerDisconnect(2);
            } catch (err) {
                uncaughtErrors.push(`handlePlayerDisconnect threw: ${err.message}`);
            }
        }
    }, Math.floor(VALIDATION_RUN_MS * 0.7));

    // Step 8: Final checks after the run window.
    setTimeout(() => {
        if (tickInterval) clearInterval(tickInterval);

        if (tickErrorCount > 0) {
            return writeResult({
                success: false,
                error: `tick() threw ${tickErrorCount} time(s): ${lastTickError}`,
                squishVersion,
                assetIds: collectedAssetIds,
                warnings,
            });
        }

        if (uncaughtErrors.length > 0) {
            return writeResult({
                success: false,
                error: `Runtime errors: ${uncaughtErrors.slice(0, 5).join('; ')}`,
                squishVersion,
                assetIds: collectedAssetIds,
                warnings,
            });
        }

        // Re-squish the whole tree — catches state that became unserializable
        // during simulated play.
        try {
            squishAllLayers(gameInstance, squishNode, 'after simulated play');
        } catch (err) {
            return writeResult({
                success: false,
                error: err.message,
                squishVersion,
                assetIds: collectedAssetIds,
                warnings,
            });
        }

        // Clean up game timers if supported
        if (gameInstance.destroy) {
            try { gameInstance.destroy(); } catch (e) {}
        }
        if (gameInstance.clearAllTimers) {
            try { gameInstance.clearAllTimers(); } catch (e) {}
        }

        writeResult({
            success: true,
            squishVersion,
            assetIds: collectedAssetIds,
            warnings,
        });
    }, VALIDATION_RUN_MS);
};

// Catch any top-level crash
try {
    run();
} catch (err) {
    writeResult({ success: false, error: `Validation crashed: ${err.message}` });
}
