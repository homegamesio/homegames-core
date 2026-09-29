const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../src/games/orbit-breaker');
const client = path.resolve(__dirname, '../../../homegames-client/dist/homegames-client.js');
const port = Number(process.env.ORBIT_BREAKER_PORT || 9889);
http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/' || url.pathname === '/qa') {
        res.setHeader('Content-Type', 'text/html');
        let html = fs.readFileSync(path.join(__dirname, 'preview.html'), 'utf8');
        if (url.pathname === '/qa') html = html.replace('<script src="/homegames-client.js">', '<script src="/qa.js"></script><script src="/homegames-client.js">');
        res.end(html);
    }
    else if (url.pathname === '/qa.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(fs.readFileSync(path.join(__dirname, 'qa.js'))); }
    else if (url.pathname === '/homegames-client.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(fs.readFileSync(client)); }
    else if (url.pathname === '/game.json') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(Object.fromEntries(fs.readdirSync(root).filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(root, f), 'utf8')]))));
    } else { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log('Orbit Breaker: http://127.0.0.1:' + port));
