// Tests for the game modal's data resolution + wiring on the dashboard.
//
// showGameModalNew used to be a tangle of source-specific shape juggling
// (wat/huh/innerTing). It's now a resolver (_resolveModalView) that normalizes
// a built-in game, a downloaded game, or a remote catalog game into one view
// model, plus a renderer. These tests drive the resolver directly for each
// source and exercise the create/join wiring end to end.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const HomegamesDashboard = require('../../src/dashboard/HomegamesDashboard');
const { createLocalLibrary } = require('../../src/library/LocalLibrary');

const flush = () => new Promise((r) => setImmediate(r));

const tempLibrary = () => {
    const realpath = (p) => fs.realpathSync(p);
    const sourceGameDir = realpath(fs.mkdtempSync(path.join(os.tmpdir(), 'hg-gm-src-')));
    const downloadedGameDir = realpath(fs.mkdtempSync(path.join(os.tmpdir(), 'hg-gm-dl-')));
    return createLocalLibrary({ sourceGameDir, downloadedGameDir });
};

const makeDashboard = (catalogClient = { list: () => Promise.resolve({ games: [] }) }) => new HomegamesDashboard({
    movePlayer: () => {},
    addAsset: () => Promise.resolve(),
    catalogClient,
    localLibrary: tempLibrary(),
});

const addPlayer = (dashboard, playerId) => dashboard.handleNewPlayer({ playerId, info: { name: 'p' }, settings: {} });

// A built-in source game as LocalLibrary.scan() shapes it.
const sourceGame = () => ({
    metadata: { name: 'My Game', thumbnail: 'thumb-123', author: 'Jane', isTest: false },
    versions: {
        'local-game-version': {
            gameId: 'MyGame',
            metadata: { name: 'My Game', description: 'A fun game', maxPlayers: 4, thumbnail: 'thumb-123' },
            gamePath: '/games/MyGame/index.js',
            versionId: 'local-game-version',
            description: 'A fun game',
            version: 0,
            approved: true,
        },
    },
});

// A downloaded game as LocalLibrary.scan() shapes it from stored .metadata.
const downloadedGame = () => ({
    metadata: { gameId: 'dl-1', name: 'Downloaded', description: 'dl desc', createdBy: 'Bob', createdAt: 1700000000000, thumbnail: 'dl-thumb' },
    versions: {
        v1: { gameId: 'dl-1', metadata: { versionId: 'v1', version: 1, approved: true, published: 1700000500000 }, gamePath: '/dl/v1/index.js', versionId: 'v1', version: 1, approved: true },
        v2: { gameId: 'dl-1', metadata: { versionId: 'v2', version: 2, approved: false, published: 1700000600000 }, gamePath: '/dl/v2/index.js', versionId: 'v2', version: 2, approved: false },
    },
});

const remoteDetails = () => ({
    game: { id: 'r1', name: 'Remote', description: 'remote desc', developerId: 'Dev', created: 1699999999000, thumbnail: 'assets/rthumb' },
    versions: [
        { id: 'ra', published: 1, approved: true, assetId: 'a1', description: 'version a' },
        { id: 'rb', published: 2, approved: true, assetId: 'a2', description: 'version b' },
    ],
});

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

test('_resolveModalView normalizes a built-in source game', async () => {
    const dashboard = makeDashboard();
    try {
        dashboard.localGames = { MyGame: sourceGame() };
        const view = await dashboard._resolveModalView('MyGame');

        assert.strictEqual(view.selectedVersionId, 'local-game-version');
        assert.strictEqual(view.gameMetadata.name, 'My Game');
        assert.strictEqual(view.gameMetadata.author, 'Jane');
        assert.strictEqual(view.gameMetadata.description, 'A fun game');
        assert.strictEqual(view.gameMetadata.maxPlayers, 4);
        assert.strictEqual(view.gameMetadata.created, null); // source games have no created date
        assert.strictEqual(view.createContext.installed, true);
        assert.strictEqual(view.versions.length, 1);
        assert.strictEqual(view.versions[0].approved, true);
    } finally {
        dashboard.close();
    }
});

test('_resolveModalView normalizes a downloaded game (developer + created date)', async () => {
    const dashboard = makeDashboard();
    try {
        dashboard.localGames = { 'dl-1': downloadedGame() };
        const view = await dashboard._resolveModalView('dl-1');

        assert.strictEqual(view.gameMetadata.author, 'Bob');
        assert.strictEqual(view.gameMetadata.created, 1700000000000);
        assert.strictEqual(view.gameMetadata.description, 'dl desc');
        assert.strictEqual(view.createContext.installed, true);
        assert.deepStrictEqual(view.versions.map(v => v.id).sort(), ['v1', 'v2']);
        // default selection is the first version
        assert.strictEqual(view.selectedVersionId, 'v1');

        // an explicit, valid version is honored
        const v2 = await dashboard._resolveModalView('dl-1', 'v2');
        assert.strictEqual(v2.selectedVersionId, 'v2');
    } finally {
        dashboard.close();
    }
});

test('_resolveModalView fetches a remote catalog game and registers its thumbnail', async () => {
    const registered = [];
    const dashboard = new HomegamesDashboard({
        movePlayer: () => {},
        addAsset: (key, asset) => { registered.push({ key, asset }); return Promise.resolve(); },
        catalogClient: { list: () => Promise.resolve({ games: [] }), getGameDetails: () => Promise.resolve(remoteDetails()) },
        localLibrary: tempLibrary(),
    });
    try {
        const view = await dashboard._resolveModalView('r1');

        assert.strictEqual(view.gameMetadata.name, 'Remote');
        assert.strictEqual(view.gameMetadata.author, 'Dev');
        assert.strictEqual(view.gameMetadata.created, 1699999999000);
        // latest published version is selected by default
        assert.strictEqual(view.selectedVersionId, 'rb');
        assert.strictEqual(view.createContext.installed, false);
        assert.deepStrictEqual(view.versions.map(v => v.id).sort(), ['ra', 'rb']);
        // thumbnail registered under the game key, trailing id only
        assert.deepStrictEqual(registered.map(r => r.key), ['r1']);
        assert.strictEqual(registered[0].asset.info.id, 'rthumb');
    } finally {
        dashboard.close();
    }
});

test('_selectRemoteVersion prefers the requested version, else the latest published', () => {
    const dashboard = makeDashboard();
    try {
        const versions = [{ id: 'a', published: 10 }, { id: 'b', published: 30 }, { id: 'c', published: 20 }];
        assert.strictEqual(dashboard._selectRemoteVersion(versions, 'a'), 'a');
        assert.strictEqual(dashboard._selectRemoteVersion(versions, 'missing'), 'b');
        assert.strictEqual(dashboard._selectRemoteVersion(versions), 'b');
        // no published dates -> falls back to last listed
        assert.strictEqual(dashboard._selectRemoteVersion([{ id: 'x' }, { id: 'y' }]), 'y');
    } finally {
        dashboard.close();
    }
});

test('creating a session for an installed game starts it directly', async () => {
    const dashboard = makeDashboard();
    try {
        addPlayer(dashboard, 1);
        dashboard.localGames = { MyGame: sourceGame() };

        let started = null;
        dashboard.startSession = (playerId, gameId, versionId) => { started = { playerId, gameId, versionId }; };

        dashboard.showGameModalNew(1, 'MyGame');
        await flush();

        // fire the modal's create-session handler via the resolved view
        const view = await dashboard._resolveModalView('MyGame');
        dashboard._createSessionFromModal(1, view);

        assert.deepStrictEqual(started, { playerId: 1, gameId: 'MyGame', versionId: 'local-game-version' });
    } finally {
        dashboard.close();
    }
});

test('creating a session for an uninstalled catalog game downloads it from source (selected version)', async () => {
    const dashboard = new HomegamesDashboard({
        movePlayer: () => {},
        addAsset: () => Promise.resolve(),
        catalogClient: { list: () => Promise.resolve({ games: [] }), getGameDetails: () => Promise.resolve(remoteDetails()) },
        localLibrary: tempLibrary(),
    });
    try {
        addPlayer(dashboard, 1);

        let played = null;
        dashboard.playCatalogGame = (playerId, gameId, versionId) => { played = { playerId, gameId, versionId }; };

        // open on a specific (older) version, then create a session
        const view = await dashboard._resolveModalView('r1', 'ra');
        dashboard._createSessionFromModal(1, view);

        assert.deepStrictEqual(played, { playerId: 1, gameId: 'r1', versionId: 'ra' });
    } finally {
        dashboard.close();
    }
});

test('playCatalogGame installs the requested version\'s commit from source', async () => {
    const catalogClient = {
        list: () => Promise.resolve({ games: [] }),
        getGameDetails: () => Promise.resolve({ game: { id: 'r1', name: 'Remote' } }),
        getPublishedVersions: () => Promise.resolve({ versions: [
            { versionId: 'ra', commitSha: 'sha-a', publishedAt: 1 },
            { versionId: 'rb', commitSha: 'sha-b', publishedAt: 2 },
        ] }),
    };
    const dashboard = makeDashboard(catalogClient);
    try {
        addPlayer(dashboard, 1);

        let captured = null;
        let started = null;
        dashboard.installer.installFromSource = ({ gameId, versionId, commitSha }) => {
            captured = { gameId, versionId, commitSha };
            return Promise.resolve({ versionId });
        };
        dashboard.startSession = (playerId, gameId, versionId) => { started = { playerId, gameId, versionId }; };

        // request the older version explicitly -> its commit is installed
        dashboard.playCatalogGame(1, 'r1', 'ra');
        for (let i = 0; i < 6; i++) await flush();

        assert.deepStrictEqual(captured, { gameId: 'r1', versionId: 'ra', commitSha: 'sha-a' });
        assert.deepStrictEqual(started, { playerId: 1, gameId: 'r1', versionId: 'ra' });
    } finally {
        dashboard.close();
    }
});

test('showGameModalNew renders a modal showing the game created date', async () => {
    const dashboard = makeDashboard();
    try {
        addPlayer(dashboard, 1);
        dashboard.localGames = { 'dl-1': downloadedGame() };

        dashboard.showGameModalNew(1, 'dl-1');
        await flush();

        assert(dashboard.playerModals[1], 'a modal should be tracked for the player');
        const texts = collectText(dashboard.playerRoots[1].node);
        // created date rendered (1700000000000 -> November 14, 2023)
        assert(texts.some(t => t.startsWith('Created:') && t.includes('2023')), 'modal should show the game created date');
        assert(texts.some(t => t === 'By Bob'), 'modal should show the developer');
    } finally {
        dashboard.close();
    }
});

test('the modal renders a paginated list of active sessions', async () => {
    const dashboard = makeDashboard();
    try {
        addPlayer(dashboard, 1);
        dashboard.localGames = { MyGame: sourceGame() };

        // three active sessions for this game+version -> 2 pages at pageSize 2
        [10, 11, 12].forEach(id => {
            dashboard.sessions[id] = {
                id,
                game: 'MyGame',
                versionId: 'local-game-version',
                getPlayers: (cb) => cb([]),
            };
        });

        dashboard.showGameModalNew(1, 'MyGame');
        await flush();

        const texts = collectText(dashboard.playerRoots[1].node);
        assert(texts.some(t => t === 'Join an existing session'), 'join section header should render');
        assert(texts.some(t => t === 'Page 1 of 2'), 'session list should be paginated');
    } finally {
        dashboard.close();
    }
});

test('onJoinSession moves the player to the chosen session', async () => {
    let moved = null;
    const dashboard = new HomegamesDashboard({
        movePlayer: (arg) => { moved = arg; },
        addAsset: () => Promise.resolve(),
        catalogClient: { list: () => Promise.resolve({ games: [] }) },
        localLibrary: tempLibrary(),
    });
    try {
        addPlayer(dashboard, 1);
        dashboard.joinSession(1, { port: 4242 });
        assert.deepStrictEqual(moved, { playerId: 1, port: 4242 });
    } finally {
        dashboard.close();
    }
});
