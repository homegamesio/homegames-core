// Unit tests for Installer. Games are published as git source (no asset zips),
// so these pin installFromSource: blob-by-blob writes, progress reporting, the
// metadata record (with commitSha), and the error paths. The catalog dependency
// is injected so nothing hits the network.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createInstaller } = require('../../src/library/Installer');

const tmp = (label) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), label)));
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });

// Minimal in-memory LocalLibrary stand-in.
const fakeLibrary = (downloadedGameDir) => {
    let meta = {};
    return {
        downloadedGameDir,
        readMetadataMap: () => meta,
        writeMetadataMap: (m) => { meta = m; },
        _meta: () => meta,
    };
};

test('createInstaller requires catalogClient and localLibrary', () => {
    assert.throws(() => createInstaller({}), /requires catalogClient and localLibrary/);
});

test('installFromSource writes every blob to disk and records metadata', async () => {
    const dir = tmp('hg-inst-src-');
    try {
        const lib = fakeLibrary(dir);
        const b64 = (s) => Buffer.from(s).toString('base64');
        const catalog = {
            getSourceTree: async (gameId, ref) => ({
                tree: [
                    { path: 'index.js', type: 'blob' },
                    { path: 'lib/helper.js', type: 'blob' },
                    { path: 'lib', type: 'tree' }, // directories are skipped
                ],
            }),
            getSourceFile: async (gameId, filePath, ref) => ({
                encoding: 'base64',
                content: b64(`// ${filePath} @ ${ref}`),
            }),
        };

        const seen = [];
        const installer = createInstaller({ catalogClient: catalog, localLibrary: lib });
        const result = await installer.installFromSource({
            gameId: 'g7',
            game: { name: 'Source Game', developerId: 'dev', thumbnail: 't', description: 'd', created: 1 },
            versionId: 'v1',
            commitSha: 'deadbeef',
            onProgress: (p) => seen.push(p),
        });

        // files written under <dir>/g7/v1/
        const root = path.join(dir, 'g7', 'v1');
        assert.strictEqual(fs.readFileSync(path.join(root, 'index.js')).toString(), '// index.js @ deadbeef');
        assert.strictEqual(fs.readFileSync(path.join(root, 'lib', 'helper.js')).toString(), '// lib/helper.js @ deadbeef');

        assert.strictEqual(result.indexPath, path.join(root, 'index.js'));
        assert.strictEqual(result.versionId, 'v1');

        // progress reported per file (2 blobs, the tree entry skipped)
        assert.deepStrictEqual(seen, [{ received: 1, total: 2 }, { received: 2, total: 2 }]);

        // metadata recorded with commitSha
        const stored = lib._meta()[result.indexPath];
        assert.strictEqual(stored.version.commitSha, 'deadbeef');
        assert.strictEqual(stored.game.gameId, 'g7');
        assert.strictEqual(stored.game.name, 'Source Game');
    } finally {
        rm(dir);
    }
});

test('installFromSource rejects when the tree has no index.js', async () => {
    const dir = tmp('hg-inst-src-noidx-');
    try {
        const lib = fakeLibrary(dir);
        const catalog = {
            getSourceTree: async () => ({ tree: [{ path: 'readme.md', type: 'blob' }] }),
            getSourceFile: async () => ({ encoding: 'base64', content: Buffer.from('x').toString('base64') }),
        };
        const installer = createInstaller({ catalogClient: catalog, localLibrary: lib });
        let err;
        try {
            await installer.installFromSource({ gameId: 'g', game: {}, versionId: 'v', commitSha: 'sha' });
        } catch (e) { err = e; }
        assert(err && /no index\.js/.test(err.message));
    } finally {
        rm(dir);
    }
});

test('installFromSource requires gameId, versionId, and commitSha', async () => {
    const installer = createInstaller({ catalogClient: {}, localLibrary: fakeLibrary('/x') });
    let err;
    try { await installer.installFromSource({ gameId: 'g', versionId: 'v' }); } catch (e) { err = e; }
    assert(err && /requires gameId, versionId, and commitSha/.test(err.message));
});
