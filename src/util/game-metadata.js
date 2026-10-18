'use strict';
const fs = require('fs');
const { parseGameSourceMetadata } = require('homegames-common/local-play');
const { parseSquishVersion } = require('homegames-common/game-loader');
const { normalizeMetadata, bindRuntimeMetadata, runtimeMetadata } = require('homegames-common/runtime-metadata');

// Inspect imported source without running it. Squish may be imported by a local
// base class, so resolve the complete module graph before reporting its runtime.
function readGameMetadata(gamePath) {
    const parsed = parseGameSourceMetadata(fs.readFileSync(gamePath, 'utf8'), { includePathAssets: true });
    if (parsed.error) return parsed;
    try { return { ...parsed, squishVersion: parseSquishVersion(gamePath) || parsed.squishVersion }; }
    catch (error) { return { error: error.message }; }
}

// Keep instantiated Asset objects and dynamic metadata for trusted legacy
// server games. Static inspection of imported projects uses readGameMetadata.
function effectiveGameMetadata(GameClass, gamePath, fallbackRuntime) {
    const metadata = GameClass?.metadata ? GameClass.metadata() : {};
    const runtime = (gamePath && parseSquishVersion(gamePath))
        || (GameClass && runtimeMetadata(GameClass).squishVersion) || fallbackRuntime;
    const normalized = normalizeMetadata(metadata, { runtime, legacy: true });
    bindRuntimeMetadata(GameClass, normalized);
    return normalized;
}
module.exports = { effectiveGameMetadata, readGameMetadata };
