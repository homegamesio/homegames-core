// Characterization tests for the dashboard's LOCAL game discovery.
//
// These pin the behavior that the upcoming refactor (LocalLibrary / CatalogClient
// extraction) must preserve. They cover the two pieces that are deterministic
// and safe to exercise in place:
//
//   1. getGamePathsHelper(dir) - the recursive index.js scan (pure: takes a dir).
//   2. getGameMap()            - the source-game discovery CONTRACT (shape only,
//                                asserted against the repo's own src/games).
//
// NOT covered here, by design:
//   - downloadGame() and the downloaded-game mapping branch of getGameMap() are
//     bound to the real app-data directory (DOWNLOADED_GAME_DIRECTORY, derived
//     from getAppDataPath() at module load) and to the network. Exercising them
//     in place would pollute the user's real ~/Library/.../hg-games/.metadata.
//     They get proper unit tests in Phase 1, once Installer/LocalLibrary take an
//     injectable target directory and http client.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const Dashboard = require('../../src/dashboard/HomegamesDashboard');
const { getGamePathsHelper, getGameMap } = Dashboard;

// --- helpers ---------------------------------------------------------------

const makeTempTree = () => {
    // realpathSync so macOS /var -> /private/var symlink matches the absolute
    // paths getGamePathsHelper builds via path.resolve.
    const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hg-scan-')));

    const write = (rel, contents) => {
        const abs = path.join(base, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, contents);
        return abs;
    };

    // two real entry points at different depths, plus decoy files that must NOT match
    const a = write('game-a/index.js', 'module.exports = {};');
    const b = write('nested/game-b/index.js', 'module.exports = {};');
    write('game-a/helper.js', '// not an entry point');
    write('notindex.js', '// top-level non-entry file');
    write('index.js.bak', '// looks close but is not index.js');

    return { base, expected: [a, b] };
};

const rmTree = (dir) => fs.rmSync(dir, { recursive: true, force: true });

// --- test 1: getGamePathsHelper scan semantics -----------------------------

test('getGamePathsHelper finds index.js recursively and ignores everything else', () => {
    const { base, expected } = makeTempTree();
    try {
        const result = getGamePathsHelper(base);

        assert(result instanceof Set, 'expected a Set of paths');
        const found = Array.from(result).sort();
        const want = expected.slice().sort();

        assert.deepStrictEqual(found, want,
            `expected exactly the two index.js paths.\n  found: ${JSON.stringify(found)}\n  want:  ${JSON.stringify(want)}`);

        // explicit: decoys excluded
        found.forEach(p => assert(p.endsWith(`${path.sep}index.js`), `unexpected match: ${p}`));
    } finally {
        rmTree(base);
    }
});

test('getGamePathsHelper returns an empty Set for a missing directory (no throw)', () => {
    const missing = path.join(os.tmpdir(), 'hg-scan-does-not-exist-' + process.pid);
    const result = getGamePathsHelper(missing);
    assert(result instanceof Set);
    assert.strictEqual(result.size, 0);
});

// --- test 2: getGameMap source-game contract -------------------------------

test('getGameMap surfaces built-in src/games with the local-game-version contract', () => {
    const games = getGameMap();

    assert(games && typeof games === 'object');
    const keys = Object.keys(games);
    assert(keys.length > 0, 'expected at least one built-in game from src/games');

    // every entry has the {metadata, versions} shape
    keys.forEach(key => {
        const g = games[key];
        assert(g.metadata, `entry ${key} missing metadata`);
        assert(g.versions && typeof g.versions === 'object', `entry ${key} missing versions`);
    });

    // at least one entry is a built-in (synthetic local-game-version) and carries
    // the contract the rest of the dashboard relies on.
    const localEntries = keys
        .map(k => games[k].versions['local-game-version'])
        .filter(Boolean);

    assert(localEntries.length > 0, 'expected at least one local-game-version entry');

    localEntries.forEach(v => {
        assert.strictEqual(v.versionId, 'local-game-version');
        assert.strictEqual(v.version, 0, 'built-in games are version 0');
        assert.strictEqual(v.approved, true, 'built-in games are pre-approved');
        assert.strictEqual(typeof v.class, 'function', 'built-in version must carry the loaded game class');
        assert(typeof v.gamePath === 'string' && v.gamePath.endsWith('index.js'),
            'built-in version must point at its index.js');
    });
});
