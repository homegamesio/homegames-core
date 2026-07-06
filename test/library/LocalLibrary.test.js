// Unit tests for LocalLibrary against injected temp directories.
//
// This is the deeper test promised in Phase 0: now that the source/downloaded
// directories are injectable, we can pin the downloaded-game mapping and the
// .metadata round-trip without polluting the real app-data hg-games directory.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createLocalLibrary, getGamePaths } = require('../../src/library/LocalLibrary');

const tmp = (label) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), label)));
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });
const writeFile = (abs, contents) => {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents);
};

// A built-in game module that exports a class with static name + metadata(),
// matching what require(gamePath) yields for real src/games entries.
const SOURCE_GAME_MODULE = `
class FakeGame {
    static metadata() {
        return { name: 'Fake Game', author: 'tester', createdBy: 'tester', thumbnail: 'thumb-1', description: 'a fake game' };
    }
}
module.exports = FakeGame;
`;

test('getGamePaths finds nested index.js and ignores decoys', () => {
    const base = tmp('hg-lib-scan-');
    try {
        writeFile(path.join(base, 'a/index.js'), '//');
        writeFile(path.join(base, 'deep/b/index.js'), '//');
        writeFile(path.join(base, 'a/other.js'), '//');
        const found = Array.from(getGamePaths(base)).sort();
        assert.deepStrictEqual(found, [
            path.join(base, 'a/index.js'),
            path.join(base, 'deep/b/index.js'),
        ].sort());
    } finally {
        rm(base);
    }
});

test('scan() resolves a built-in source game into the local-game-version contract', () => {
    const sourceGameDir = tmp('hg-lib-src-');
    const downloadedGameDir = tmp('hg-lib-dl-');
    try {
        writeFile(path.join(sourceGameDir, 'fake/index.js'), SOURCE_GAME_MODULE);

        const lib = createLocalLibrary({ sourceGameDir, downloadedGameDir });
        const games = lib.scan();

        const entry = games['FakeGame'];
        assert(entry, 'expected the source game keyed by class name');
        assert.strictEqual(entry.metadata.name, 'Fake Game');
        assert.strictEqual(entry.metadata.author, 'tester');
        assert.strictEqual(entry.metadata.isTest, false);

        const v = entry.versions['local-game-version'];
        assert.strictEqual(v.version, 0);
        assert.strictEqual(v.approved, true);
        assert.strictEqual(typeof v.class, 'function');
        assert(v.gamePath.endsWith('index.js'));
    } finally {
        rm(sourceGameDir);
        rm(downloadedGameDir);
    }
});

test('scan() maps a downloaded game from .metadata, grouping versions under gameId', () => {
    const sourceGameDir = tmp('hg-lib-src2-');
    const downloadedGameDir = tmp('hg-lib-dl2-');
    try {
        // two versions of one downloaded game on disk
        const v1Index = path.join(downloadedGameDir, 'game-xyz/ver-1/index.js');
        const v2Index = path.join(downloadedGameDir, 'game-xyz/ver-2/index.js');
        writeFile(v1Index, '//');
        writeFile(v2Index, '//');

        const lib = createLocalLibrary({ sourceGameDir, downloadedGameDir });
        // write .metadata keyed by absolute index.js path (as the installer does)
        lib.writeMetadataMap({
            [v1Index]: {
                game: { gameId: 'game-xyz', name: 'Downloaded Game', thumbnail: 'tdl' },
                version: { versionId: 'ver-1', version: 1, approved: true },
            },
            [v2Index]: {
                game: { gameId: 'game-xyz', name: 'Downloaded Game', thumbnail: 'tdl' },
                version: { versionId: 'ver-2', version: 2, approved: false },
            },
        });

        const games = lib.scan();
        const entry = games['game-xyz'];
        assert(entry, 'expected the downloaded game keyed by gameId');
        assert.strictEqual(entry.metadata.name, 'Downloaded Game');

        assert.deepStrictEqual(Object.keys(entry.versions).sort(), ['ver-1', 'ver-2']);
        assert.strictEqual(entry.versions['ver-1'].version, 1);
        assert.strictEqual(entry.versions['ver-1'].approved, true);
        assert.strictEqual(entry.versions['ver-2'].version, 2);
        assert.strictEqual(entry.versions['ver-2'].approved, false);
        assert.strictEqual(entry.versions['ver-1'].gamePath, v1Index);
    } finally {
        rm(sourceGameDir);
        rm(downloadedGameDir);
    }
});

test('scan() skips downloaded paths with no .metadata entry', () => {
    const sourceGameDir = tmp('hg-lib-src3-');
    const downloadedGameDir = tmp('hg-lib-dl3-');
    try {
        writeFile(path.join(downloadedGameDir, 'orphan/ver/index.js'), '//');
        const lib = createLocalLibrary({ sourceGameDir, downloadedGameDir });
        // no .metadata written at all
        const games = lib.scan();
        assert.deepStrictEqual(Object.keys(games), [], 'orphan downloaded game without metadata must be skipped');
    } finally {
        rm(sourceGameDir);
        rm(downloadedGameDir);
    }
});

test('readMetadataMap returns {} when .metadata is absent, and round-trips a write', () => {
    const sourceGameDir = tmp('hg-lib-src4-');
    const downloadedGameDir = tmp('hg-lib-dl4-');
    try {
        const lib = createLocalLibrary({ sourceGameDir, downloadedGameDir });
        assert.deepStrictEqual(lib.readMetadataMap(), {});

        const map = { '/abs/path/index.js': { game: { gameId: 'g' }, version: { versionId: 'v' } } };
        lib.writeMetadataMap(map);
        assert.deepStrictEqual(lib.readMetadataMap(), map);
        assert(fs.existsSync(lib.metadataFile));
    } finally {
        rm(sourceGameDir);
        rm(downloadedGameDir);
    }
});

test('createLocalLibrary requires both directories', () => {
    assert.throws(() => createLocalLibrary({ sourceGameDir: '/x' }), /requires sourceGameDir and downloadedGameDir/);
    assert.throws(() => createLocalLibrary({ downloadedGameDir: '/y' }), /requires sourceGameDir and downloadedGameDir/);
});
