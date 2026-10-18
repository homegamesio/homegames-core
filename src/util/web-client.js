// Web client serving — makes homegames-core self-contained in the browser.
//
// The main game server (HOME_PORT) serves the Homegames web client directly:
// the landing page, the prebuilt homegames-client UMD bundle, and the socket
// worker. The page and the WebSocket share one origin/port, so the client
// bootstrap needs no config fetch — it derives the WS URL from window.location.
//
// This replaces the separate homegames-web static server for local instances.
// Child game session servers do NOT serve the client (see the serveWebClient
// option in socket.js) — players reach them via WebSocket redirects only.

const fs = require('fs');
const path = require('path');

// Resolve the homegames-client package root without requiring its main entry
// (which is browser-oriented source, not something core should execute).
const defaultClientRoot = () => path.dirname(require.resolve('homegames-client/package.json'));

const WEB_DIR = path.join(__dirname, '..', 'web');

// createWebClientHandler({ webDir, clientRoot }) -> (req, res) => boolean
//
// Returns true when the request was handled (response ended), false to let
// the caller's other routes (or 404) take over. Directories are injectable
// for tests.
const createWebClientHandler = ({ webDir = WEB_DIR, clientRoot = null } = {}) => {
    const resolvedClientRoot = clientRoot || defaultClientRoot();

    const routes = {
        '/': {
            filePath: path.join(webDir, 'index.html'),
            contentType: 'text/html'
        },
        '/index.html': {
            filePath: path.join(webDir, 'index.html'),
            contentType: 'text/html'
        },
        '/bootstrap.js': {
            filePath: path.join(webDir, 'bootstrap.js'),
            contentType: 'text/javascript'
        },
        '/library.js': { filePath: path.join(webDir, 'library.js'), contentType: 'text/javascript' },
        '/favicon.ico': {
            filePath: path.join(webDir, 'favicon.ico'),
            contentType: 'image/x-icon'
        },
        '/homegames-client.js': {
            filePath: path.join(resolvedClientRoot, 'dist', 'homegames-client.js'),
            contentType: 'text/javascript'
        },
        '/socket-worker.js': {
            filePath: path.join(resolvedClientRoot, 'src', 'socket-worker.js'),
            contentType: 'text/javascript'
        }
    };

    return (req, res) => {
        if (req.method !== 'GET') {
            return false;
        }

        const pathname = req.url.split('?')[0];
        const route = routes[pathname];
        if (!route) {
            return false;
        }

        fs.readFile(route.filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end();
                return;
            }
            res.writeHead(200, {
                'Content-Type': route.contentType,
                // The client bundle changes between releases and the pages are
                // tiny; skip caching entirely rather than managing versioned URLs.
                'Cache-Control': 'no-cache'
            });
            res.end(data);
        });

        return true;
    };
};

module.exports = { createWebClientHandler };
