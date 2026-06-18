// Unit tests for Installer. The download + decompress dependencies are injected,
// so these pin the install bookkeeping and — crucially — the error handling that
// the original downloadGame swallowed (no status check, no 'error' handler, a
// promise that could hang forever). They also cover progress reporting and the
// real default downloader against a throwaway HTTP server.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const { createInstaller, defaultFetchToFile } = require('../../src/library/Installer');

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

const fakeCatalog = () => ({ assetUrl: (id) => `http://catalog.test/assets/${id}` });

const sampleArgs = () => ({
    gameDetails: { game: { id: 'game-1', name: 'My Game', description: 'd', developerId: 'dev', created: 123, thumbnail: 'thumb' } },
    version: { id: 'v1', assetId: 'asset-1', version: 3, approved: true, published: 999, squishVersion: '135' },
});

test('install() downloads, decompresses, writes metadata, and returns the index path', async () => {
    const dir = tmp('hg-inst-ok-');
    try {
        const lib = fakeLibrary(dir);
        let fetched = null;
        const installer = createInstaller({
            catalogClient: fakeCatalog(),
            localLibrary: lib,
            fetchToFile: async (url, destPath) => { fetched = { url, destPath }; return { received: 10, total: 10 }; },
            decompress: async () => [{ type: 'file', path: 'index.js' }],
        });

        const result = await installer.install(sampleArgs());

        // hit the catalog's asset URL, wrote the zip under <dir>/game-1/v1.zip
        assert.strictEqual(fetched.url, 'http://catalog.test/assets/asset-1');
        assert.strictEqual(fetched.destPath, path.join(dir, 'game-1', 'v1.zip'));

        // returned the resolved index path under the extraction dir
        assert.strictEqual(result.indexPath, path.join(dir, 'game-1', 'v1', 'index.js'));
        assert.strictEqual(result.gameId, 'game-1');
        assert.strictEqual(result.versionId, 'v1');

        // metadata stored keyed by index path, with the expected version/game record
        const stored = lib._meta()[result.indexPath];
        assert(stored, 'expected metadata keyed by index path');
        assert.strictEqual(stored.version.versionId, 'v1');
        assert.strictEqual(stored.version.version, 3);
        assert.strictEqual(stored.version.squishVersion, '135');
        assert.strictEqual(stored.game.gameId, 'game-1');
        assert.strictEqual(stored.game.name, 'My Game');
    } finally {
        rm(dir);
    }
});

test('install() forwards progress callbacks from the downloader', async () => {
    const dir = tmp('hg-inst-prog-');
    try {
        const lib = fakeLibrary(dir);
        const seen = [];
        const installer = createInstaller({
            catalogClient: fakeCatalog(),
            localLibrary: lib,
            fetchToFile: async (url, destPath, onProgress) => {
                onProgress({ received: 5, total: 10 });
                onProgress({ received: 10, total: 10 });
                return { received: 10, total: 10 };
            },
            decompress: async () => [{ type: 'file', path: 'index.js' }],
        });

        await installer.install({ ...sampleArgs(), onProgress: (p) => seen.push(p) });
        assert.deepStrictEqual(seen, [{ received: 5, total: 10 }, { received: 10, total: 10 }]);
    } finally {
        rm(dir);
    }
});

test('install() rejects when the download fails (no longer hangs)', async () => {
    const dir = tmp('hg-inst-dlfail-');
    try {
        const lib = fakeLibrary(dir);
        const installer = createInstaller({
            catalogClient: fakeCatalog(),
            localLibrary: lib,
            fetchToFile: async () => { throw new Error('HTTP 500'); },
            decompress: async () => { throw new Error('should not decompress'); },
        });

        let err;
        try { await installer.install(sampleArgs()); } catch (e) { err = e; }
        assert(err && /HTTP 500/.test(err.message), 'expected the download error to propagate');
        assert.deepStrictEqual(lib._meta(), {}, 'no metadata should be written on failure');
    } finally {
        rm(dir);
    }
});

test('install() rejects when the archive has no index.js', async () => {
    const dir = tmp('hg-inst-noindex-');
    try {
        const lib = fakeLibrary(dir);
        const installer = createInstaller({
            catalogClient: fakeCatalog(),
            localLibrary: lib,
            fetchToFile: async () => ({ received: 1, total: 1 }),
            decompress: async () => [{ type: 'file', path: 'readme.md' }],
        });

        let err;
        try { await installer.install(sampleArgs()); } catch (e) { err = e; }
        assert(err && /no index\.js/.test(err.message), 'expected a missing-index error');
        assert.deepStrictEqual(lib._meta(), {}, 'no metadata on a bad archive');
    } finally {
        rm(dir);
    }
});

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

// Exercise the real default downloader: status handling, progress, file write.
test('defaultFetchToFile streams a 200 to disk and reports progress', async () => {
    const dir = tmp('hg-inst-fetch-');
    const server = http.createServer((req, res) => {
        const body = Buffer.from('hello-zip-bytes');
        res.writeHead(200, { 'Content-Length': body.length });
        res.end(body);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    try {
        const { port } = server.address();
        const dest = path.join(dir, 'out.zip');
        const seen = [];
        const { received, total } = await defaultFetchToFile(`http://127.0.0.1:${port}/a`, dest, (p) => seen.push(p));

        assert.strictEqual(received, 15);
        assert.strictEqual(total, 15);
        assert.strictEqual(fs.readFileSync(dest).toString(), 'hello-zip-bytes');
        assert(seen.length > 0, 'expected at least one progress event');
    } finally {
        server.close();
        rm(dir);
    }
});

test('defaultFetchToFile rejects on a non-2xx response', async () => {
    const dir = tmp('hg-inst-fetch500-');
    const server = http.createServer((req, res) => { res.writeHead(500); res.end('nope'); });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    try {
        const { port } = server.address();
        let err;
        try {
            await defaultFetchToFile(`http://127.0.0.1:${port}/a`, path.join(dir, 'x.zip'));
        } catch (e) { err = e; }
        assert(err && /HTTP 500/.test(err.message), 'expected rejection on HTTP 500');
    } finally {
        server.close();
        rm(dir);
    }
});
