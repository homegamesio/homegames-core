// fetchGameSource — download a published game's source tree at a commit from
// the platform API into a local directory. This is the single "get game code
// onto disk" primitive: the Installer uses it for permanent library installs,
// and Homenames uses it to fetch games for API-created sessions (so the
// platform API never has to download game code itself).

const fs = require('fs');
const path = require('path');

// Fetch every blob at gameId@commitSha into destDir. Reports progress as
// { received, total } in units of files. Resolves { indexPath, fileCount }.
const fetchGameSource = async ({ catalogClient, gameId, commitSha, destDir, onProgress } = {}) => {
    if (!catalogClient || !gameId || !commitSha || !destDir) {
        throw new Error('fetchGameSource requires catalogClient, gameId, commitSha, and destDir');
    }

    fs.mkdirSync(destDir, { recursive: true });

    const tree = await catalogClient.getSourceTree(gameId, commitSha);
    const blobs = ((tree && tree.tree) || []).filter((entry) => entry.type === 'blob');

    if (blobs.length === 0) {
        throw new Error(`Source tree for ${gameId}@${commitSha} is empty`);
    }

    const resolvedDest = path.resolve(destDir);
    let received = 0;
    for (const blob of blobs) {
        // Git itself forbids '..' path components, but the tree arrives over
        // the network — never write outside destDir.
        const dest = path.join(destDir, blob.path);
        if (path.isAbsolute(blob.path) || !path.resolve(dest).startsWith(resolvedDest + path.sep)) {
            continue;
        }
        const file = await catalogClient.getSourceFile(gameId, blob.path, commitSha);
        const buf = Buffer.from(file.content || '', file.encoding || 'base64');
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        received += 1;
        if (onProgress) onProgress({ received, total: blobs.length });
    }

    const indexBlob = blobs.find((b) => b.path === 'index.js') || blobs.find((b) => b.path.endsWith('index.js'));
    if (!indexBlob) {
        throw new Error(`Source for ${gameId}@${commitSha} has no index.js`);
    }

    return { indexPath: path.join(destDir, indexBlob.path), fileCount: received };
};

module.exports = { fetchGameSource };
