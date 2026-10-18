'use strict';
const fs = require('fs');
const path = require('path');
const portable = require('homegames-common/portable-project');
const { options } = require('homegames-common/portable-project-node');
const { isHostRequest } = require('../util/host-access');

// Validate all bytes before writing. A new revision gets a new directory;
// imports never replace edited source, saves, or existing versions.
async function installPack(bytes, directory) {
    const project = await portable.importArchive(bytes, options);
    const gameId = project.manifest.gameId.toLowerCase(), revision = project.revision;
    const parent = path.join(directory, 'portable', gameId), destination = path.join(parent, revision);
    fs.mkdirSync(parent, { recursive: true });
    if (!fs.existsSync(destination)) {
        const staging = fs.mkdtempSync(path.join(parent, '.import-'));
        try {
            for (const name of project.reader.listFiles()) {
                const file = path.join(staging, name); fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, project.reader.readFile(name), { flag: 'wx' });
            }
            fs.renameSync(staging, destination);
        } finally { if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true }); }
    }
    return { gameKey: gameId.replace(/-/g, ''), versionId: revision, name: project.metadata.name || 'Imported game', destination };
}

function createPackHandler({ directory, onInstalled = async () => {} }) {
    return (req, res) => {
        if (req.url.split('?')[0] !== '/library/import') return false;
        const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
        if (!isHostRequest(req)) { send(403, { error: 'Import games from the Homegames page on the host computer.' }); return true; }
        if (req.method !== 'POST' || req.headers['content-type'] !== 'application/zip' || req.headers['x-homegames-import'] !== '1') { send(400, { error: 'Choose a game ZIP using Import ZIP.' }); return true; }
        let length = 0, failed = false; const chunks = [];
        req.on('data', chunk => {
            if (failed) return;
            length += chunk.length;
            if (length > portable.LIMITS.archiveBytes) { failed = true; chunks.length = 0; send(413, { error: 'Game ZIP exceeds 65 MiB.' }); }
            else chunks.push(chunk);
        });
        req.on('end', async () => {
            if (failed) return;
            try { const result = await installPack(Buffer.concat(chunks), directory); await onInstalled(); send(201, result); }
            catch (error) { send(400, { error: error.message }); }
        });
        req.on('error', () => {});
        return true;
    };
}
module.exports = { installPack, createPackHandler };
