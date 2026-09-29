// Development-only wrapper. The game uses the real Homegames LocalSession.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../src/games/vector-siege');
const client = path.resolve(__dirname, '../../../homegames-client/dist/homegames-client.js');
const files = ['index.js', 'engine.js', 'combat.js', 'settings.js', 'scene.js', 'sound.js', 'war.js', 'war-battle.js', 'war-scene.js', 'war-settings.js'];
const port = Number(process.env.VECTOR_SIEGE_PORT || 9876);
const html = fs.readFileSync(path.join(__dirname, 'preview.html'));
http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); }
    else if (url.pathname === '/homegames-client.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(fs.readFileSync(client)); }
    else if (url.pathname === '/game.json') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(Object.fromEntries(files.map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]))));
    } else { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Vector Siege: http://127.0.0.1:${port}`));
