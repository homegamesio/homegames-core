'use strict';
const fs = require('fs');
const path = require('path');
const { normalizePath } = require('homegames-common/portable-project');

function findGameEntry(directory, requestedEntry) {
    const root = fs.realpathSync(directory);
    const resolve = entry => {
        const filename = fs.realpathSync(path.join(root, normalizePath(entry)));
        if (!filename.startsWith(root + path.sep) || !fs.statSync(filename).isFile()) throw new Error('Game entry must be a file inside the game directory');
        return filename;
    };
    if (requestedEntry) return resolve(requestedEntry);
    const manifest = path.join(root, 'homegame.json');
    if (fs.existsSync(manifest)) return resolve(JSON.parse(fs.readFileSync(manifest, 'utf8')).entry);
    if (fs.existsSync(path.join(root, 'index.js'))) return resolve('index.js');
    // Retain the historical shallowest-index discovery for unpacked legacy
    // repository archives that contain one enclosing folder.
    const pending = [''];
    while (pending.length) {
        const relative = pending.shift(), folder = path.join(root, relative);
        if (relative && fs.existsSync(path.join(folder, 'index.js'))) return resolve(relative + '/index.js');
        for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) pending.push(relative ? relative + '/' + entry.name : entry.name);
        }
    }
    return null;
}
module.exports = { findGameEntry };
