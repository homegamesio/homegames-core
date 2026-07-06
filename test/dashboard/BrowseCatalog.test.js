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

// Walk a squish node tree and collect every node carrying a click handler whose
// top-left corner matches (x, y). Lets a test drive the on-screen arrows/buttons
// the way a real click would, rather than reaching into private methods.
const findClickable = (node, x, y) => {
    const hits = [];
    const visit = (n) => {
        if (!n || !n.node) return;
        const c = n.node.coordinates2d;
        if (typeof n.node.handleClick === 'function' && c && c[0][0] === x && c[0][1] === y) {
            hits.push(n);
        }
        (n.getChildren ? n.getChildren() : []).forEach(visit);
    };
    visit(node);
    return hits;
};

// The down arrow is drawn at rectangle(90, 72.5, ...); the up arrow at (90, 22.5).
const clickDownArrow = (dashboard, playerId) => {
    const [arrow] = findClickable(dashboard.playerRoots[playerId].node, 90, 72.5);
    assert(arrow, 'expected a down arrow to be rendered');
    arrow.node.handleClick(playerId, 95, 80);
};
const hasDownArrow = (dashboard, playerId) =>
    findClickable(dashboard.playerRoots[playerId].node, 90, 72.5).length > 0;

// Collect the text of every Text node in a tree — used to assert which games are
// actually on screen (browse results vs. local games).
const collectText = (node) => {
    const out = [];
    const visit = (n) => {
        if (!n || !n.node) return;
        if (n.node.text && typeof n.node.text.text === 'string') out.push(n.node.text.text);
        (n.getChildren ? n.getChildren() : []).forEach(visit);
    };
    visit(node);
    return out;
};

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

test('paging down while browsing stays on catalog results (does not revert to local games)', async () => {
    // 8 results -> more than one view page, so a down arrow is rendered.
    const ids = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'];
    const dashboard = makeDashboard({
        list: () => Promise.resolve(makePage(ids)),
    });
    try {
        addPlayer(dashboard, 1);
        dashboard.handleBrowse(1);
        await flush(); await flush();

        assert(hasDownArrow(dashboard, 1), 'a down arrow should be available with 8 results');

        clickDownArrow(dashboard, 1);

        // Still browsing, view advanced one page, and the catalog games (not the
        // empty local library) are what's rendered.
        assert(dashboard.playerStates[1].browse, 'should remain in browse mode after paging');
        assert.strictEqual(dashboard.playerStates[1].view.y, 100);
        // buildGamePlane renders each game's display name ("Game g4", ...). If the
        // regression were present we'd be looking at the (empty) local library.
        const texts = collectText(dashboard.playerRoots[1].node);
        assert(texts.some(t => /^Game g\d/.test(t)), 'catalog game names should still be on screen after paging down');
    } finally {
        dashboard.close();
    }
});

test('the down arrow loads the next catalog page once the player scrolls to the end', async () => {
    const first = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11']; // == limit 12
    const pages = {
        0: makePage(first),
        12: makePage(['m', 'n']),
    };
    const dashboard = makeDashboard({
        list: ({ offset }) => Promise.resolve(pages[offset] || { games: [] }),
    });
    try {
        addPlayer(dashboard, 1);
        dashboard.handleBrowse(1);
        await flush(); await flush();

        // A full page means the catalog is not exhausted; more pages are available.
        assert.strictEqual(dashboard.playerStates[1].browse.exhausted, false);

        // Scroll to the bottom of the loaded results (12 games -> 3 view pages).
        clickDownArrow(dashboard, 1); // y: 0 -> 100
        clickDownArrow(dashboard, 1); // y: 100 -> 200
        assert.strictEqual(dashboard.playerStates[1].view.y, 200);

        // At the end of loaded results, the down arrow pulls the next page.
        clickDownArrow(dashboard, 1);
        await flush(); await flush();

        const state = dashboard.playerStates[1].browse;
        assert.deepStrictEqual(Object.keys(state.results).sort(), [...first, 'm', 'n'].sort());
        assert.strictEqual(state.offset, 14);
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
