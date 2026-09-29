// Local play from this server — the core-side counterpart of the platform
// API's local-manifest endpoints. Where the API assembles a game's source from
// Forgejo at a published commit, this assembles it from games installed on
// disk (built-in source games and downloaded games), so a browser can run a
// game single-player via HomegamesClient.LocalSession with no game session.
//
// Endpoints (mounted by socket.js next to the web client routes):
//   GET /games/:gameKey/local-manifest[?versionId=]
//   GET /games/:gameKey/asset-bundle[?versionId=]
//
// Collection is best-effort by design: every game is offered for local play.
// Files the resolver can't reach (requires of server-only modules, missing
// paths) are simply not shipped — if the game actually needs them, the
// browser loader's own error surfaces at load time.
//
// The manifest mirrors the API's response shape (homegamesio's play page and
// our bootstrap consume the same fields): { localPlayable, reason,
// multiplayer, name, squishVersion, entryPoint, files, assetCount,
// assetBundleUrl }.

const fs = require('fs');
const path = require('path');

const { getConfigValue, getAppDataPath } = require('homegames-common');
const localPlay = require('homegames-common/local-play');
// Shared with homegames-client's game-loader — the browser resolves requires
// against the virtual map with these exact functions, so the map must be
// built with them too.
const { normalizePath, resolutionCandidates } = require('homegames-common/local-play-shared');
const acorn = require('acorn');

const { createLocalLibrary } = require('../library/LocalLibrary');
const squishMap = require('../common/squish-map');

// ---------------------------------------------------------------------------
// Source file collection
// ---------------------------------------------------------------------------

// Static relative require() arguments in a source string. Anything else —
// squish versions (the shim provides those), npm/builtin modules, dynamic
// requires — is not followable, and the browser loader reports those itself.
// Returns [] when the source doesn't parse (the browser will surface the
// syntax error when it executes the file).
const extractRelativeRequires = (source) => {
    let ast;
    try {
        ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch (e) {
        try {
            ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
        } catch (e2) {
            return [];
        }
    }

    const requires = [];
    const walk = (node) => {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'CallExpression'
            && node.callee.type === 'Identifier'
            && node.callee.name === 'require'
            && node.arguments[0]) {
            const arg = node.arguments[0];
            if (arg.type === 'Literal' && typeof arg.value === 'string'
                && (arg.value.startsWith('./') || arg.value.startsWith('../'))) {
                requires.push(arg.value);
            }
        }
        for (const key of Object.keys(node)) {
            const value = node[key];
            if (Array.isArray(value)) {
                value.forEach(walk);
            } else if (value && typeof value.type === 'string') {
                walk(value);
            }
        }
    };
    walk(ast);
    return requires;
};

// Build the { virtualPath: source } map for a game by following relative
// requires from its entry file, replicating the browser shim's resolution
// (normalize, then try base, base.js, base/index.js). Best-effort: anything
// that can't be read or resolved is skipped, not fatal.
//
// Returns { files, entryPoint }.
const collectGameFiles = (entryRealPath) => {
    const entryPoint = path.basename(entryRealPath);
    const files = {};          // virtual path -> source
    const realByVirtual = {};  // virtual path -> real path (collision detection)

    const queue = [{ virtual: entryPoint, real: entryRealPath }];
    realByVirtual[entryPoint] = entryRealPath;

    while (queue.length) {
        const { virtual, real } = queue.shift();
        let source;
        try {
            source = fs.readFileSync(real, 'utf8');
        } catch (e) {
            continue; // unreadable — skip; the browser reports the missing module
        }
        files[virtual] = source;

        const fromDir = virtual.includes('/') ? virtual.slice(0, virtual.lastIndexOf('/')) : '';
        const realDir = path.dirname(real);

        for (const request of extractRelativeRequires(source)) {
            // Virtual candidates come from the shared resolver (what the
            // browser will try); each maps to its real on-disk counterpart.
            const realBase = path.resolve(realDir, request);
            const realSuffixes = [realBase, `${realBase}.js`, path.join(realBase, 'index.js')];
            const candidates = resolutionCandidates(fromDir, request)
                .map((virtual, i) => ({ virtual, real: realSuffixes[i] }));

            const resolved = candidates.find(c => {
                try {
                    return fs.statSync(c.real).isFile();
                } catch (e) {
                    return false;
                }
            });
            if (!resolved) continue;

            const existing = realByVirtual[resolved.virtual];
            if (existing && existing !== resolved.real) {
                // Two different real files collapse to one virtual path (a
                // '../' escape colliding with an in-game path). First one wins;
                // the shim's map can only hold one.
                console.warn(`[local-play] ${virtual} requires "${request}" which collides at ${resolved.virtual}; keeping ${existing}`);
                continue;
            }
            if (!existing) {
                realByVirtual[resolved.virtual] = resolved.real;
                queue.push({ virtual: resolved.virtual, real: resolved.real });
            }
        }
    }

    return { files, entryPoint };
};

// ---------------------------------------------------------------------------
// Context — files + metadata for one installed game version
// ---------------------------------------------------------------------------

const EMPTY_META = { squishVersion: null, name: null, services: [], assets: [] };

const buildLocalPlayContext = (gameKey, version) => {
    const { files, entryPoint } = collectGameFiles(version.gamePath);

    let meta = EMPTY_META;
    if (files[entryPoint]) {
        const parsed = localPlay.parseGameSourceMetadata(files[entryPoint]);
        if (!parsed.error) meta = parsed;
    }

    return {
        gameName: meta.name || gameKey,
        files,
        entryPoint,
        meta,
    };
};

// ---------------------------------------------------------------------------
// Asset bundle — bytes for the game's declared assets, packed type-1
// ---------------------------------------------------------------------------

// Default asset source: squish's Asset class, which reads the shared
// <appData>/asset-cache (already warm for any game that has run a hosted
// session) and falls back to downloading from the API.
const defaultFetchAssetData = (assetInfo) => {
    const { Asset } = require(squishMap['142']);
    return new Asset({ id: assetInfo.id, type: assetInfo.type }).getData();
};

const buildAssetBundle = (context, fetchAssetData = defaultFetchAssetData) => {
    const assets = (context.meta && context.meta.assets) || [];
    if (!assets.length) return Promise.resolve(Buffer.alloc(0));

    return Promise.all(assets.map(a =>
        fetchAssetData(a).then(data => ({ key: a.key, type: a.type, data }))
    )).then(entries => localPlay.packAssetBundle(entries));
};

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

let baseDir = path.dirname(require.main.filename);
if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

// Same directory derivation as the dashboard's library — kept independent so
// this module doesn't have to load the (squish-heavy) dashboard.
const createDefaultLibrary = () => createLocalLibrary({
    sourceGameDir: path.resolve(`${baseDir}${path.sep}src${path.sep}games`),
    downloadedGameDir: path.join(getAppDataPath(), 'hg-games'),
    localGameDir: getConfigValue('LOCAL_GAME_DIRECTORY', null),
});

const jsonResponse = (res, status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
};

// createLocalPlayHandler({ localLibrary, fetchAssetData }) -> (req, res) => boolean
// Returns true when the request was handled; false lets other routes run.
const createLocalPlayHandler = ({ localLibrary = null, fetchAssetData = defaultFetchAssetData } = {}) => {
    const library = localLibrary || createDefaultLibrary();

    let games = null; // lazy scan; rescanned when a game key is missing
    const contextCache = {}; // `${gameKey}:${versionId}` -> context
    const bundleCache = {};  // `${gameKey}:${versionId}` -> Promise<Buffer>

    const lookupGame = (gameKey) => {
        if (!games || !games[gameKey]) {
            games = library.scan();
        }
        return games[gameKey] || null;
    };

    const resolveVersion = (game, versionId) => {
        if (versionId) return game.versions[versionId] || null;
        const keys = Object.keys(game.versions);
        // Same default the dashboard uses when launching a session
        return keys.length ? game.versions[keys[keys.length - 1]] : null;
    };

    const getContext = (gameKey, version) => {
        const cacheKey = `${gameKey}:${version.versionId}`;
        if (!contextCache[cacheKey]) {
            contextCache[cacheKey] = buildLocalPlayContext(gameKey, version);
        }
        return contextCache[cacheKey];
    };

    return (req, res) => {
        if (req.method !== 'GET') return false;

        const [pathname, query] = req.url.split('?');
        const match = /^\/games\/([^/]+)\/(local-manifest|asset-bundle)$/.exec(pathname);
        if (!match) return false;

        const gameKey = decodeURIComponent(match[1]);
        const action = match[2];
        const versionId = new URLSearchParams(query || '').get('versionId');

        const game = lookupGame(gameKey);
        if (!game) {
            jsonResponse(res, 404, { error: `Unknown game: ${gameKey}` });
            return true;
        }
        const version = resolveVersion(game, versionId);
        if (!version) {
            jsonResponse(res, 404, { error: `Unknown version for game: ${gameKey}` });
            return true;
        }

        const context = getContext(gameKey, version);

        if (action === 'local-manifest') {
            const bundleQuery = version.versionId ? `?versionId=${encodeURIComponent(version.versionId)}` : '';
            jsonResponse(res, 200, {
                gameKey,
                versionId: version.versionId,
                localPlayable: true,
                reason: null,
                multiplayer: (context.meta.services || []).includes('multiplayer'),
                name: context.gameName,
                squishVersion: context.meta.squishVersion,
                entryPoint: context.entryPoint,
                files: context.files,
                assetCount: (context.meta.assets || []).length,
                assetBundleUrl: `/games/${encodeURIComponent(gameKey)}/asset-bundle${bundleQuery}`,
            });
            return true;
        }

        // asset-bundle
        const cacheKey = `${gameKey}:${version.versionId}`;
        if (!bundleCache[cacheKey]) {
            bundleCache[cacheKey] = buildAssetBundle(context, fetchAssetData);
        }
        bundleCache[cacheKey].then(bundle => {
            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Length': bundle.length,
            });
            res.end(bundle);
        }).catch(err => {
            // A failed asset fetch (offline, missing asset) shouldn't poison
            // the cache — let the next request retry.
            delete bundleCache[cacheKey];
            jsonResponse(res, 500, { error: `Failed to build asset bundle: ${err && err.message || err}` });
        });
        return true;
    };
};

module.exports = {
    createLocalPlayHandler,
    buildLocalPlayContext,
    collectGameFiles,
    buildAssetBundle,
};
