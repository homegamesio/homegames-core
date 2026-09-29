// Development preview using the same client and local-play loader as core.
const http = require('http');
const path = require('path');
const { createWebClientHandler } = require('../../src/util/web-client');
const { createLocalPlayHandler } = require('../../src/util/local-play');
const gamePath = path.resolve(__dirname, '../../src/games/city-scanner/index.js');
const web = createWebClientHandler();
const localLibrary = { scan: () => ({ 'city-scanner': { versions: {
    local: { gameId: 'city-scanner', gamePath, versionId: 'local' }
} } }) };
const port = Number(process.env.PORT || 9877);
http.createServer((req, res) => {
    // A fresh handler lets a page reload pick up source edits.
    const local = createLocalPlayHandler({ localLibrary });
    if (web(req, res) || local(req, res)) return;
    res.writeHead(404); res.end();
}).listen(port, '127.0.0.1', () => {
    console.log(`City Scanner preview: http://127.0.0.1:${port}/?localGame=city-scanner`);
});
