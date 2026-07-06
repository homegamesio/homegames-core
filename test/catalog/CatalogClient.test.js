// Unit tests for CatalogClient against a throwaway local HTTP server.
// Now that the client takes an injectable apiUrl, its request building and
// response parsing can be pinned without touching the real API.

const assert = require('assert');
const http = require('http');
const { URL } = require('url');

const { createCatalogClient } = require('../../src/catalog/CatalogClient');

// Spin up a server that records the last request and replies from a handler.
const withServer = (handler, fn) => new Promise((resolve, reject) => {
    const received = [];
    const server = http.createServer((req, res) => {
        received.push(req.url);
        handler(req, res);
    });
    server.listen(0, '127.0.0.1', async () => {
        const { port } = server.address();
        const apiUrl = `http://127.0.0.1:${port}`;
        try {
            await fn({ apiUrl, received });
            resolve();
        } catch (err) {
            reject(err);
        } finally {
            server.close();
        }
    });
});

const json = (res, obj, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
};

test('CatalogClient.list builds a paginated /games query and parses JSON', async () => {
    await withServer((req, res) => json(res, { games: [{ id: 'g1' }], total: 1 }), async ({ apiUrl, received }) => {
        const client = createCatalogClient({ apiUrl });
        const result = await client.list({ offset: 20, limit: 10, includeNsfw: false });

        assert.deepStrictEqual(result, { games: [{ id: 'g1' }], total: 1 });

        const url = new URL(received[0], apiUrl);
        assert.strictEqual(url.pathname, '/games');
        assert.strictEqual(url.searchParams.get('offset'), '20');
        assert.strictEqual(url.searchParams.get('limit'), '10');
        assert.strictEqual(url.searchParams.get('includeNsfw'), 'false');
        // featured was undefined -> must be omitted entirely
        assert.strictEqual(url.searchParams.has('featured'), false);
    });
});

test('CatalogClient.list omits empty params and applies defaults', async () => {
    await withServer((req, res) => json(res, []), async ({ apiUrl, received }) => {
        const client = createCatalogClient({ apiUrl });
        await client.list();

        const url = new URL(received[0], apiUrl);
        assert.strictEqual(url.searchParams.get('offset'), '0');
        assert.strictEqual(url.searchParams.get('limit'), '10');
        assert.strictEqual(url.searchParams.has('featured'), false);
        assert.strictEqual(url.searchParams.has('includeNsfw'), false);
    });
});

test('CatalogClient.searchGames encodes the query and parses results', async () => {
    await withServer((req, res) => json(res, [{ id: 'g2', name: 'space game' }]), async ({ apiUrl, received }) => {
        const client = createCatalogClient({ apiUrl });
        const results = await client.searchGames('space game');

        assert.deepStrictEqual(results, [{ id: 'g2', name: 'space game' }]);
        const url = new URL(received[0], apiUrl);
        assert.strictEqual(url.pathname, '/games');
        assert.strictEqual(url.searchParams.get('query'), 'space game');
    });
});

test('CatalogClient.getGameDetails / getGameVersionDetails hit the right paths', async () => {
    await withServer((req, res) => json(res, { ok: req.url }), async ({ apiUrl }) => {
        const client = createCatalogClient({ apiUrl });

        const details = await client.getGameDetails('abc');
        assert.strictEqual(details.ok, '/games/abc');

        const version = await client.getGameVersionDetails('abc', 'v9');
        assert.strictEqual(version.ok, '/games/abc/version/v9');
    });
});

test('CatalogClient rejects on a non-2xx response', async () => {
    await withServer((req, res) => { res.writeHead(500); res.end('boom'); }, async ({ apiUrl }) => {
        const client = createCatalogClient({ apiUrl });
        let threw = false;
        try {
            await client.getGameDetails('abc');
        } catch (err) {
            threw = true;
        }
        assert.strictEqual(threw, true, 'expected a rejection on HTTP 500');
    });
});

test('CatalogClient.assetUrl composes the asset endpoint', async () => {
    const client = createCatalogClient({ apiUrl: 'https://api.example.test' });
    assert.strictEqual(client.assetUrl('asset-123'), 'https://api.example.test/assets/asset-123');
});

test('createCatalogClient requires an apiUrl', () => {
    assert.throws(() => createCatalogClient({}), /requires an apiUrl/);
});
