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
 *   2. Verify it has a metadata() static method with squishVersion
 *   3. Instantiate the game
 *   4. Verify getLayers() returns a valid structure
 *   5. Let it run for a few seconds to catch runtime errors
 *   6. Output JSON result to stdout and exit
 *
 * Output (stdout, one JSON object):
 *   { "success": true, "squishVersion": "135" }
 *   { "success": false, "error": "No getLayers method found" }
 *
 * Exit code: 0 = validation passed, 1 = validation failed
 */

const path = require('path');
const fs = require('fs');

const SQUISH_VERSION = process.env.SQUISH_VERSION || '135';
const GAME_DIR = '/app/game';
const VALIDATION_RUN_MS = 5000; // let the game run for 5 seconds

const { squishMap, DEFAULT_SQUISH_VERSION, parseSquishVersion } = require('homegames-common/game-loader');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const writeResult = (result) => {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(result.success ? 0 : 1);
};

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

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------
const run = () => {
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
    try {
        process.env.SQUISH_PATH = require.resolve(squishPkg);
    } catch (err) {
        return writeResult({ success: false, error: `Squish version ${squishVersion} (package ${squishPkg}) not installed` });
    }

    // Symlink node_modules into game directory
    const gameNodeModules = path.join(path.dirname(entryPath), 'node_modules');
    if (!fs.existsSync(gameNodeModules)) {
        try {
            // We're on --read-only with --tmpfs /tmp, so write symlink to /tmp and set NODE_PATH
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

    if (!metadata.squishVersion) {
        return writeResult({ success: false, error: 'metadata() must return a squishVersion' });
    }

    // Step 5: Instantiate the game
    let gameInstance;
    try {
        const addAsset = () => Promise.resolve();
        const saveGame = () => {};
        gameInstance = new GameClass({ addAsset, saveGame });
    } catch (err) {
        return writeResult({ success: false, error: `Failed to instantiate game: ${err.message}` });
    }

    // Step 6: Verify getLayers
    if (!gameInstance.getLayers || typeof gameInstance.getLayers !== 'function') {
        return writeResult({ success: false, error: 'Game instance missing getLayers() method' });
    }

    let layers;
    try {
        layers = gameInstance.getLayers();
    } catch (err) {
        return writeResult({ success: false, error: `getLayers() threw: ${err.message}` });
    }

    if (!Array.isArray(layers) && typeof layers !== 'object') {
        return writeResult({ success: false, error: 'getLayers() must return an array or object' });
    }

    // Verify each layer has a root
    const layerArray = Array.isArray(layers) ? layers : Object.values(layers);
    for (let i = 0; i < layerArray.length; i++) {
        if (!layerArray[i].root) {
            return writeResult({ success: false, error: `Layer ${i} missing root property` });
        }
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

    // Step 7: Let the game run for a bit to catch runtime errors
    const uncaughtErrors = [];

    process.on('uncaughtException', (err) => {
        uncaughtErrors.push(err.message || err.toString());
    });

    process.on('unhandledRejection', (reason) => {
        uncaughtErrors.push(reason?.message || String(reason));
    });

    setTimeout(() => {
        // Clean up game timers if supported
        if (gameInstance.destroy) gameInstance.destroy();
        if (gameInstance.clearAllTimers) gameInstance.clearAllTimers();

        if (uncaughtErrors.length > 0) {
            return writeResult({
                success: false,
                error: `Runtime errors: ${uncaughtErrors.slice(0, 5).join('; ')}`,
                squishVersion,
                assetIds: collectedAssetIds,
            });
        }

        writeResult({
            success: true,
            squishVersion,
            assetIds: collectedAssetIds,
        });
    }, VALIDATION_RUN_MS);
};

// Catch any top-level crash
try {
    run();
} catch (err) {
    writeResult({ success: false, error: `Validation crashed: ${err.message}` });
}
