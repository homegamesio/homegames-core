'use strict';

const { isIP } = require('net');
const { X509Certificate } = require('crypto');

const address = value => typeof value === 'string' ? value.replace(/^::ffff:/i, '').toLowerCase() : '';
const loopback = value => value === '127.0.0.1' || value === '::1';

// This is a direct-connection policy. Forwarding headers and player-supplied
// identity never confer host privileges. Do not proxy public traffic through
// a loopback connection to these administrative endpoints.
function isHostRequest(req) {
    const peer = address(req?.socket?.remoteAddress);
    const local = address(req?.socket?.localAddress);
    if (!loopback(peer) && !(isIP(peer) && peer === local)) return false;

    const host = req?.headers?.host;
    if (typeof host !== 'string' || /[\s\\/@?#]/.test(host)) return false;
    try {
        const origin = new URL(`${req.socket.encrypted ? 'https' : 'http'}://${host}`);
        const hostname = origin.hostname.replace(/^\[|\]$/g, '');
        let knownHost = hostname === 'localhost' || loopback(hostname)
            || (isIP(hostname) && hostname === local);
        // The native launcher uses the server's certificate name. Allow that
        // name only on TLS, using the certificate actually served on this
        // connection, and still require a same-machine peer above.
        if (!knownHost && req.socket.encrypted) {
            const raw = req.socket.getCertificate?.()?.raw;
            if (raw) {
                const certificate = new X509Certificate(raw);
                knownHost = !!(isIP(hostname) ? certificate.checkIP(hostname)
                    : certificate.checkHost(hostname, { wildcards: false, subject: 'never' }));
            }
        }
        if (!knownHost) return false;
        // Origin is mandatory in browser WebSocket handshakes and cross-origin
        // fetches. Local command-line clients may omit it; opaque origins may not.
        return req.headers.origin === undefined || req.headers.origin === origin.origin;
    } catch (_) {
        return false;
    }
}

module.exports = { isHostRequest };
