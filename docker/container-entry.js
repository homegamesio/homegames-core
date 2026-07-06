/**
 * container-entry.js — Runs inside a Docker container for live game sessions.
 *
 * This is a thin wrapper that finds the game entry point in /app/game/,
 * sets up environment variables, and runs child_game_server.js — the same
 * code path used by the fork-based approach. This means Docker sessions
 * get the full GameSession with HomegamesRoot (bezel, back button, settings).
 *
 * Environment variables (from docker run):
 *   GAME_PORT       — port to bind the WebSocket server on
 *   SQUISH_VERSION  — which squish version to use
 *   GAME_ENTRY      — relative path to entry point within /app/game (optional)
 *
 * Game code is mounted read-only at /app/game/
 * Save data (if any) is mounted read-write at /app/save/
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const GAME_DIR = '/app/game';
const GAME_ENTRY = process.env.GAME_ENTRY || null;

// ---------------------------------------------------------------------------
// Find the entry point
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

const entryPath = GAME_ENTRY ? path.join(GAME_DIR, GAME_ENTRY) : findEntryPoint(GAME_DIR);
if (!entryPath || !fs.existsSync(entryPath)) {
    console.error('[container-entry] Game entry point not found:', entryPath || GAME_DIR);
    process.exit(1);
}

console.log('[container-entry] Game entry:', entryPath);
console.log('[container-entry] Port:', process.env.GAME_PORT);
console.log('[container-entry] Squish version:', process.env.SQUISH_VERSION);

// ---------------------------------------------------------------------------
// Set up NODE_PATH so require() finds deps from the container's
// pre-installed packages. Games cannot bring their own dependencies —
// everything they may require (squish versions, ws) ships in the image.
// ---------------------------------------------------------------------------
const nodePaths = ['/app/node_modules'];

// ---------------------------------------------------------------------------
// Run child_game_server.js with environment variable config.
// It detects it's not forked (no process.send) and reads GAME_PATH etc from env.
// This gives us the full GameSession + HomegamesRoot + socketServer stack.
// ---------------------------------------------------------------------------
const childServerPath = path.join('/app', 'src', 'child_game_server.js');

const env = Object.assign({}, process.env, {
    NODE_PATH: nodePaths.join(path.delimiter),
    GAME_PATH: entryPath,
    // GAME_PORT, SQUISH_VERSION, GAME_KEY already in process.env from docker run
});

// Use require() instead of spawn so we stay in the same process
// (simpler lifecycle, no zombie processes)
process.env.NODE_PATH = env.NODE_PATH;
process.env.GAME_PATH = env.GAME_PATH;
require('module').Module._initPaths();

require(childServerPath);
