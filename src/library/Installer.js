// Installer — installs a published game version from source and registers it on
// disk. Games are published as git source (fetched by commitSha), not asset
// zips, so this is the single install path.
//
// Dependencies (catalogClient, localLibrary) are injected so the install flow
// can be unit-tested without real network.

const fs = require('fs');
const path = require('path');

const createInstaller = ({ catalogClient, localLibrary } = {}) => {
    if (!catalogClient || !localLibrary) {
        throw new Error('createInstaller requires catalogClient and localLibrary');
    }

    const downloadedGameDir = localLibrary.downloadedGameDir;

    // Install a studio/Forgejo-published version: fetch the source tree at the
    // given commit and write every blob to disk. Reports progress as
    // { received, total } in units of files. onProgress is optional.
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

    return { installFromSource };
};

module.exports = { createInstaller };
