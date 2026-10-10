const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { isIP } = require('net');
const { attachRtcSignaling } = require('homegames-common/rtc-signaling');
const { createWebClientHandler } = require('./web-client');
const { createLocalPlayHandler } = require('./local-play');

const PUBLIC_SIGNAL_URL = 'wss://api.homegames.io/rtc';
const PUBLIC_JOIN_URL = 'https://homegames.io/play.html';

// Choose an address another device can open, never the host's localhost.
// An explicit URL covers multiple NICs, HTTPS names, proxies and public hosts.
const lanOrigin = (port, secure, interfaces = os.networkInterfaces()) => {
    const candidates = Object.values(interfaces).flat().filter(n => n && !n.internal && n.family === 'IPv4');
    const address = candidates.find(n => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)) || candidates[0];
    return address ? `${secure ? 'https' : 'http'}://${address.address}:${port}` : null;
};

// Preserve a reachable hostname (and its certificate name) when the page was
// opened through one. Only loopback HTTP needs substitution with a LAN IP.
const invitationOrigin = ({ host, port, certificate = null, interfaces }) => {
    const protocol = certificate ? 'https:' : 'http:';
    let origin;
    try { if (host) origin = new URL(`${protocol}//${host}`); } catch (_) {}
    const loopback = hostname => hostname === 'localhost' || hostname.endsWith('.localhost')
        || /^127\./.test(hostname) || hostname === '[::1]' || hostname === '0.0.0.0';
    const covered = hostname => isIP(hostname) ? certificate.checkIP(hostname) : certificate.checkHost(hostname);
    if (origin && !loopback(origin.hostname) && (!certificate || covered(origin.hostname))) return origin.origin;
    if (certificate) {
        // When the host opens localhost, phones still need a usable DNS name.
        // Never turn a DNS-only HTTPS certificate into a raw-IP invitation.
        const names = (certificate.subjectAltName || '').split(', ')
            .filter(name => name.startsWith('DNS:')).map(name => name.slice(4));
        const name = names.find(name => /^[a-z0-9.-]+$/i.test(name) && !loopback(name)
            && certificate.checkHost(name));
        if (name) return new URL(`https://${name}:${port}`).origin;
        const lan = lanOrigin(port, true, interfaces);
        return lan && certificate.checkIP(new URL(lan).hostname) ? lan : null;
    }
    return lanOrigin(port, false, interfaces);
};

const createBrowserGameServer = ({ startPath, port, certPath = null, shareOrigin = null,
    signalingUrl = null, joinUrl = null, iceServers = null, iceTransportPolicy = 'all' }) => {
    const entry = require.resolve(startPath);
    const gameKey = 'start:' + crypto.createHash('sha1').update(entry).digest('hex');
    const title = path.basename(path.dirname(entry));
    const library = { scan: () => ({ start: { versions: { local: { gamePath: entry, versionId: 'local' } } } }) };
    const localPlay = createLocalPlayHandler({ localLibrary: library });
    const web = createWebClientHandler();
    const tls = certPath ? {
        key: fs.readFileSync(path.join(certPath, 'homegames.key')),
        cert: fs.readFileSync(path.join(certPath, 'homegames.cert')),
    } : null;
    const certificate = tls ? new crypto.X509Certificate(tls.cert) : null;
    const request = (req, res) => {
        if (req.method === 'GET' && req.url === '/boot.json') {
            // Share invitations are public by default, even when the host loads
            // its game from a private homegames.link address. LAN-only signaling
            // is an explicit development option; never silently fall back to it.
            const origin = shareOrigin === 'local'
                ? invitationOrigin({ host: req.headers.host, port: server.address().port, certificate }) : shareOrigin;
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ mode: 'browser', manifestUrl: '/games/start/local-manifest', gameKey, title,
                share: shareOrigin !== 'local' || origin || (signalingUrl && joinUrl) ? {
                    signalingUrl: signalingUrl || (origin ? `${origin}/rtc` : PUBLIC_SIGNAL_URL),
                    joinUrl: joinUrl || (origin ? `${origin}/` : PUBLIC_JOIN_URL), iceTransportPolicy,
                } : null }));
        } else if (req.method === 'GET' && req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, mode: 'browser' }));
        } else if (!web(req, res) && !localPlay(req, res)) { res.writeHead(404); res.end(); }
    };
    const server = tls ? https.createServer(tls, request) : http.createServer(request);
    const signaling = attachRtcSignaling(server, iceServers ? { getIceServers: () => iceServers } : {});
    // No game construction, session fork, Homenames or simulation on this path.
    return { server, signaling, listen: () => server.listen(port) };
};

module.exports = { createBrowserGameServer, lanOrigin, invitationOrigin };
