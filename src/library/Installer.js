// Installer — downloads a published game version and registers it on disk.
//
// Extracted from HomegamesDashboard.downloadGame. The original swallowed errors:
// it never checked the HTTP status, never handled request/stream 'error', and
// the returned promise could hang forever on a failed download. This version
// rejects on any failure and reports progress, so the UI can show a real
// download experience instead of an indefinite spinner.
//
// Dependencies (catalogClient, localLibrary, decompress, fetchToFile) are
// injected so the install flow can be unit-tested without real network or zips.

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

// Default downloader: streams `url` to `destPath`, rejecting on non-2xx,
// transport error, or write error. Calls onProgress({received,total}) as bytes
// arrive (total is 0 when the server omits content-length).
const defaultFetchToFile = (url, destPath, onProgress) => new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
            res.resume(); // drain so the socket frees
            return reject(new Error(`Download failed: HTTP ${res.statusCode} for ${url}`));
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;

        const out = fs.createWriteStream(destPath);
        out.on('error', reject);
        out.on('finish', () => out.close(() => resolve({ received, total })));

        res.on('data', (chunk) => {
            received += chunk.length;
            if (onProgress) onProgress({ received, total });
        });
        res.on('error', reject);

        res.pipe(out);
    });
    req.on('error', reject);
});

const createInstaller = ({
    catalogClient,
    localLibrary,
    decompress = require('decompress'),
    fetchToFile = defaultFetchToFile,
} = {}) => {
    if (!catalogClient || !localLibrary) {
        throw new Error('createInstaller requires catalogClient and localLibrary');
    }

    const downloadedGameDir = localLibrary.downloadedGameDir;

    // Download + decompress + register a version. Resolves with the install
    // result; the caller (dashboard) is responsible for rescanning + asset
    // registration. onProgress is optional.
    const install = async ({ gameDetails, version, onProgress } = {}) => {
        const { id: gameId, description, name, developerId: createdBy, created: createdAt, thumbnail } = gameDetails.game;
        const { id: versionId, assetId, approved, published } = version;

        const metadataToStore = {
            version: {
                versionId,
                version: version.version,
                approved,
                squishVersion: version.squishVersion,
                published,
            },
            game: {
                gameId,
                name,
                description,
                createdBy,
                createdAt,
                thumbnail,
            },
        };

        const gameDir = `${downloadedGameDir}${path.sep}${gameId}`;
        const gamePath = `${gameDir}${path.sep}${versionId}`;
        const zipPath = `${gameDir}${path.sep}${versionId}.zip`;

        if (!fs.existsSync(gameDir)) {
            fs.mkdirSync(gameDir, { recursive: true });
        }

        const location = catalogClient.assetUrl(assetId);

        await fetchToFile(location, zipPath, onProgress);

        const files = await decompress(zipPath, gamePath);
        const foundIndex = files.filter((f) => f.type === 'file' && f.path.endsWith('index.js'))[0];
        if (!foundIndex) {
            throw new Error(`Downloaded archive for ${gameId}/${versionId} has no index.js`);
        }
        const indexPath = path.join(gamePath, foundIndex.path);

        const currentMetadata = localLibrary.readMetadataMap();
        currentMetadata[indexPath] = metadataToStore;
        localLibrary.writeMetadataMap(currentMetadata);

        return { indexPath, gameId, versionId, metadata: metadataToStore };
    };

    // Install a studio/Forgejo-published version: fetch the source tree at the
    // given commit and write every blob to disk. Used for games that have no
    // downloadable asset zip (the current publishing pipeline). Reports progress
    // as { received, total } in units of files. onProgress is optional.
    const installFromSource = async ({ gameId, game, versionId, commitSha, onProgress } = {}) => {
        if (!gameId || !versionId || !commitSha) {
            throw new Error('installFromSource requires gameId, versionId, and commitSha');
        }

        const gamePath = `${downloadedGameDir}${path.sep}${gameId}${path.sep}${versionId}`;
        fs.mkdirSync(gamePath, { recursive: true });

        const tree = await catalogClient.getSourceTree(gameId, commitSha);
        const blobs = ((tree && tree.tree) || []).filter((entry) => entry.type === 'blob');

        if (blobs.length === 0) {
            throw new Error(`Source tree for ${gameId}@${commitSha} is empty`);
        }

        let received = 0;
        for (const blob of blobs) {
            const file = await catalogClient.getSourceFile(gameId, blob.path, commitSha);
            const buf = Buffer.from(file.content || '', file.encoding || 'base64');
            const dest = path.join(gamePath, blob.path);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, buf);
            received += 1;
            if (onProgress) onProgress({ received, total: blobs.length });
        }

        const indexBlob = blobs.find((b) => b.path === 'index.js') || blobs.find((b) => b.path.endsWith('index.js'));
        if (!indexBlob) {
            throw new Error(`Source for ${gameId}/${versionId} has no index.js`);
        }
        const indexPath = path.join(gamePath, indexBlob.path);

        const g = game || {};
        const metadataToStore = {
            version: {
                versionId,
                commitSha,
                approved: true, // published versions are approved
                published: g.publishedAt,
            },
            game: {
                gameId,
                name: g.name,
                description: g.description,
                createdBy: g.developerId,
                createdAt: g.created,
                thumbnail: g.thumbnail,
            },
        };

        const currentMetadata = localLibrary.readMetadataMap();
        currentMetadata[indexPath] = metadataToStore;
        localLibrary.writeMetadataMap(currentMetadata);

        return { indexPath, gameId, versionId, metadata: metadataToStore };
    };

    return { install, installFromSource };
};

module.exports = { createInstaller, defaultFetchToFile };
