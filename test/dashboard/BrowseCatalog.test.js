// Tests for the Browse Catalog state machine on the dashboard.
//
// The dashboard now accepts an injectable catalogClient, so we can drive
// handleBrowse / loadMoreCatalog / exitBrowse with a fake catalog and assert how
// the per-player browse state (results, offset, exhausted, error) evolves —
// without a live API. Rendering still runs (building squish nodes), exercising
// the render path end to end; we assert on state rather than pixels.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const HomegamesDashboard = require('../../src/dashboard/HomegamesDashboard');
const { createLocalLibrary } = require('../../src/library/LocalLibrary');

const flush = () => new Promise((r) => setImmediate(r));

// A throwaway library so installs write to a temp dir, never real app-data.
const tempLibrary = () => {
    const realpath = (p) => fs.realpathSync(p);
    const sourceGameDir = realpath(fs.mkdtempSync(path.join(os.tmpdir(), 'hg-br-src-')));
    const downloadedGameDir = realpath(fs.mkdtempSync(path.join(os.tmpdir(), 'hg-br-dl-')));
    return createLocalLibrary({ sourceGameDir, downloadedGameDir });
};

// Build a dashboard with a fake catalog + no-op host callbacks. A temp-dir local
// library is injected by default so tests never touch real app-data.
const makeDashboard = (catalogClient, localLibrary = tempLibrary()) => new HomegamesDashboard({
    movePlayer: () => {},
    addAsset: () => Promise.resolve(),
    catalogClient,
    localLibrary,
});

const addPlayer = (dashboard, playerId) => dashboard.handleNewPlayer({ playerId, info: { name: 'p' }, settings: {} });

const makePage = (ids) => ({ games: ids.map((id) => ({ id, name: `Game ${id}`, developerId: 'dev', thumbnail: `thumb-${id}`, description: '' })) });

test('handleBrowse loads the first catalog page into browse state', async () => {
    const dashboard = makeDashboard({
        list: ({ offset, limit }) => Promise.resolve(makePage(['a', 'b', 'c'])),
    });
    try {
        addPlayer(dashboard, 1);
        dashboard.handleBrowse(1);
        await flush();
        await flush();

        const state = dashboard.playerStates[1].browse;
        assert.deepStrictEqual(Object.keys(state.results).sort(), ['a', 'b', 'c']);
        assert.strictEqual(state.offset, 3);
        assert.strictEqual(state.loading, false);
        assert.strictEqual(state.error, false);
        // got a full page (3 < limit 12) -> exhausted
        assert.strictEqual(state.exhausted, true);
    } finally {
        dashboard.close();
    }
});

test('loadMoreCatalog appends the next page and advances the offset', async () => {
    const pages = {
        0: makePage(['a', 'b']),
        2: makePage(['c', 'd']),
    };
    const dashboard = makeDashboard({
        list: ({ offset, limit }) => Promise.resolve(pages[offset] || { games: [] }),
    });
    try {
        addPlayer(dashboard, 1);
        // force pagination by shrinking the limit after entry
        dashboard.handleBrowse(1);
        await flush(); await flush();
        // first page returned 2 with default limit 12 -> marked exhausted; override to test append path
        dashboard.playerStates[1].browse.limit = 2;
        dashboard.playerStates[1].browse.exhausted = false;

        dashboard.loadMoreCatalog(1);
        await flush(); await flush();

        const state = dashboard.playerStates[1].browse;
        assert.deepStrictEqual(Object.keys(state.results).sort(), ['a', 'b', 'c', 'd']);
        assert.strictEqual(state.offset, 4);
    } finally {
        dashboard.close();
    }
});

test('a short page (fewer than limit) marks the catalog exhausted', async () => {
    const dashboard = makeDashboard({
        list: ({ offset, limit }) => Promise.resolve(makePage(['only'])),
    });
    try {
        addPlayer(dashboard, 1);
        dashboard.handleBrowse(1);
        await flush(); await flush();
        assert.strictEqual(dashboard.playerStates[1].browse.exhausted, true);
    } finally {
        dashboard.close();
    }
});

test('a catalog fetch failure sets error and stops paging (offline-friendly)', async () => {
    const dashboard = makeDashboard({
        list: () => Promise.reject(new Error('network down')),
    });
    try {
        addPlayer(dashboard, 1);
        dashboard.handleBrowse(1);
        await flush(); await flush();

        const state = dashboard.playerStates[1].browse;
        assert.strictEqual(state.error, true);
        assert.strictEqual(state.loading, false);
        assert.strictEqual(state.exhausted, true);
        assert.deepStrictEqual(Object.keys(state.results), []);
    } finally {
        dashboard.close();
    }
});

test('exitBrowse clears browse state and returns to the local view', async () => {
    const dashboard = makeDashboard({
        list: () => Promise.resolve(makePage(['a'])),
    });
    try {
        addPlayer(dashboard, 1);
        dashboard.handleBrowse(1);
        await flush(); await flush();
        assert(dashboard.playerStates[1].browse, 'browse state should exist while browsing');

        dashboard.exitBrowse(1);
        assert.strictEqual(dashboard.playerStates[1].browse, null);
    } finally {
        dashboard.close();
    }
});

test('playCatalogGame installs an uninstalled game from source, then starts it', async () => {
    const b64 = (s) => Buffer.from(s).toString('base64');
    const catalogClient = {
        list: () => Promise.resolve({ games: [] }),
        getGameDetails: (id) => Promise.resolve({ game: { id, name: 'Catalog Game', thumbnail: 'th', developerId: 'dev' } }),
        getPublishedVersions: (id) => Promise.resolve({ versions: [
            { versionId: 'old', commitSha: 'sha-old', publishedAt: 1 },
            { versionId: 'new', commitSha: 'sha-new', publishedAt: 2 },
        ] }),
        getSourceTree: (id, ref) => Promise.resolve({ tree: [{ path: 'index.js', type: 'blob' }] }),
        getSourceFile: (id, p, ref) => Promise.resolve({ encoding: 'base64', content: b64(`// ${p} ${ref}`) }),
    };
    const dashboard = makeDashboard(catalogClient);
    try {
        addPlayer(dashboard, 1);

        let started = null;
        dashboard.startSession = (playerId, gameId, versionId) => { started = { playerId, gameId, versionId }; };

        dashboard.playCatalogGame(1, 'cat-1');
        // let getDetails + publishedVersions + tree + file + scan settle
        for (let i = 0; i < 6; i++) await flush();

        // picked the latest version by publishedAt and started it
        assert.deepStrictEqual(started, { playerId: 1, gameId: 'cat-1', versionId: 'new' });
    } finally {
        dashboard.close();
    }
});

test('playCatalogGame starts a session directly for an already-installed game', () => {
    const dashboard = makeDashboard({ list: () => Promise.resolve({ games: [] }) });
    try {
        addPlayer(dashboard, 1);
        // pretend a game is already installed
        dashboard.localGames['installed-id'] = { metadata: {}, versions: { v1: { versionId: 'v1', gamePath: '/x/index.js' } } };

        let started = null;
        dashboard.startSession = (playerId, gameId) => { started = { playerId, gameId }; };

        dashboard.playCatalogGame(1, 'installed-id');
        assert.deepStrictEqual(started, { playerId: 1, gameId: 'installed-id' });
    } finally {
        dashboard.close();
    }
});
