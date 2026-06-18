// CatalogClient — the dashboard's window onto the remote game catalog (the API).
//
// Extracted from HomegamesDashboard.js (the inline `getUrl` + `networkHelper`).
// This is the only place that knows how to talk to the games API, so the
// dashboard, Installer, and AssetCache can share one configured client instead
// of each hand-rolling http requests against a module-level API_URL.

const http = require('http');
const https = require('https');

const { log } = require('homegames-common');

// Low-level GET returning the raw response body as a Buffer. Resolves on 2xx,
// rejects otherwise (or on transport error). Preserved verbatim from the
// dashboard's original helper.
const getUrl = (url, headers = {}) => new Promise((resolve, reject) => {
    const getModule = url.startsWith('https') ? https : http;

    getModule.get(url, { headers }, (res) => {
        const bufs = [];
        res.on('data', (chunk) => bufs.push(chunk));
        res.on('end', () => {
            if (res.statusCode > 199 && res.statusCode < 300) {
                resolve(Buffer.concat(bufs));
            } else {
                reject(Buffer.concat(bufs));
            }
        });
    }).on('error', (error) => reject(error));
});

const buildQuery = (params) => {
    const pairs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    return pairs.length ? `?${pairs.join('&')}` : '';
};

// Factory: a catalog client bound to one API base URL.
const createCatalogClient = ({ apiUrl }) => {
    if (!apiUrl) throw new Error('createCatalogClient requires an apiUrl');

    const getJson = (path) => getUrl(`${apiUrl}${path}`).then((response) => JSON.parse(response));

    return {
        // Paginated catalog listing — GET /games?offset=&limit=&featured=&includeNsfw=
        // Drives the Browse Catalog grid.
        list: ({ offset = 0, limit = 10, featured, includeNsfw } = {}) => new Promise((resolve, reject) => {
            const query = buildQuery({ offset, limit, featured, includeNsfw });
            getJson(`/games${query}`).then(resolve).catch((err) => {
                log.error('Error listing games', err);
                reject(err);
            });
        }),

        // Search — GET /games?query=
        searchGames: (q) => new Promise((resolve, reject) => {
            getUrl(`${apiUrl}/games?query=${encodeURIComponent(q)}`).then((response) => {
                let results;
                try {
                    results = JSON.parse(response);
                } catch (err) {
                    log.error('Error parsing search response', err);
                    return reject(err);
                }
                resolve(results);
            }).catch((err) => {
                log.error('Error searching games', err);
                reject(err);
            });
        }),

        // GET /games/:gameId
        getGameDetails: (gameId) => new Promise((resolve, reject) => {
            getUrl(`${apiUrl}/games/${gameId}`).then((response) => {
                let results;
                try {
                    results = JSON.parse(response);
                } catch (err) {
                    log.error(err);
                    return reject(err);
                }
                resolve(results);
            }).catch((err) => {
                log.error(err);
                reject(err);
            });
        }),

        // GET /games/:gameId/version/:versionId
        getGameVersionDetails: (gameId, versionId) => new Promise((resolve, reject) => {
            getUrl(`${apiUrl}/games/${gameId}/version/${versionId}`).then((response) => {
                resolve(JSON.parse(response));
            }).catch((err) => {
                log.error(err.toString());
                reject(err);
            });
        }),

        // Published versions for a game, each with its commitSha.
        // GET /games/:gameId/published-versions -> { versions: [{ versionId, commitSha, publishedAt, publishedBy }] }
        getPublishedVersions: (gameId) => getJson(`/games/${gameId}/published-versions`),

        // Recursive source tree at a commit (Forgejo git tree).
        // GET /games/:gameId/source-tree?ref=<commitSha> -> { tree: [{ path, type: 'blob'|'tree', ... }] }
        getSourceTree: (gameId, ref) => getJson(`/games/${gameId}/source-tree?ref=${encodeURIComponent(ref)}`),

        // A single source file at a commit (Forgejo contents API; content is base64).
        // GET /games/:gameId/source?path=<path>&ref=<commitSha> -> { content, encoding, type, ... }
        getSourceFile: (gameId, filePath, ref) =>
            getJson(`/games/${gameId}/source?path=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(ref)}`),

        // URL for a downloadable asset (legacy game archive, thumbnail bytes, ...).
        // Keeps API base-URL knowledge in one place for Installer / AssetCache.
        assetUrl: (assetId) => `${apiUrl}/assets/${assetId}`,
    };
};

module.exports = { createCatalogClient, getUrl };
