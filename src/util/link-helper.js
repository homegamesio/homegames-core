const { log } = require('homegames-common');

const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { X509Certificate, createHash } = require('crypto');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require('homegames-common');

const MAP_ENABLED = getConfigValue('MAP_ENABLED', false);
// Capture the user's intent before core sets HTTPS_ENABLED to the protocol
// actually serving this launch. Environment overrides must beat saved config.
const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);

const API_URL = getConfigValue('API_URL', 'https://api.homegames.io:443');
const parsedUrl = new URL(API_URL);
const isSecure = parsedUrl.protocol == 'https:';

const getPublicIP = () => new Promise((resolve, reject) => {
    const req = (isSecure ? https : http).get(`${API_URL}/ip`, (res) => {
        let buf = '';
        res.on('data', (chunk) => {
            buf += chunk.toString();
        });

        res.on('end', () => {
            resolve(buf.toString());
        });
    });
    req.on('error', (err) => {
        console.log('ereoreorer');
        console.log(err);
        resolve();
    });
    // Without a timeout, an unreachable API (SYN sent, nothing back) fires
    // neither 'error' nor 'response', so this would hang forever — which must
    // never block startup. Resolve undefined (same as the error path) so the
    // instance keeps working offline / on a LAN with no internet.
    req.setTimeout(10 * 1000, () => {
        console.log('getPublicIP timed out');
        req.destroy();
        resolve();
    });

});

const getLocalIP = () => {
    const ifaces = os.networkInterfaces();
    let localIP;

    Object.keys(ifaces).forEach((ifname) => {
        ifaces[ifname].forEach((iface) => {
            if ('IPv4' !== iface.family || iface.internal) {
                return;
            }
            localIP = localIP || iface.address;
        });
    });

    return localIP;
};

// Tracks whether this instance is actually serving HTTPS yet (cert installed +
// HTTPS server up). Reported to homegames.link so it can distinguish "no
// instance here" from "instance present but still provisioning its cert".
// Flip to true via setHttpsReady() once verifyOrRequestCert resolves.
let httpsReady = false;
let servingCertificate = null;
let activeClient = null;
let listeningPort = null;
const setListeningPort = port => {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid listening port');
    listeningPort = port;
};
let discoveryStatus = { state: 'idle' };
const discoveryListeners = new Set();
const setDiscoveryStatus = state => {
    if (discoveryStatus.state === state) return;
    discoveryStatus = { state };
    for (const listener of discoveryListeners) listener();
};
const getDiscoveryStatus = () => ({ ...discoveryStatus });
const onDiscoveryUpdate = listener => { discoveryListeners.add(listener); return () => discoveryListeners.delete(listener); };

// Discovery derives its hostname from the observed public IP. Do not send
// guests to that hostname until the running server has its matching cert.
const certificateMatchesNetwork = (certificate, publicIp) => {
    if (!certificate || typeof publicIp !== 'string' || !require('net').isIP(publicIp)) return false;
    try {
        const leaf = new X509Certificate(certificate);
        const domain = createHash('md5').update(publicIp).digest('hex') + '.homegames.link';
        return Date.parse(leaf.validTo) > Date.now() && !!leaf.checkHost(domain, { wildcards: false });
    } catch (_) { return false; }
};

const getClientInfo = () => new Promise((resolve, reject) => {
    const localIp = getLocalIP();
    const httpsEnabled = process.env.HG_OFFLINE !== 'true' && HTTPS_ENABLED;
    // Environment values are strings. Link's registration protocol requires
    // an integer, even when the listening port came from HOME_PORT.
    const configuredPort = listeningPort ?? getConfigValue('HOME_PORT', 7001);
    const port = Number(configuredPort);
    if (!['string', 'number'].includes(typeof configuredPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
        return reject(new Error('HOME_PORT must be a port from 1 to 65535'));
    }
    getPublicIP().then(publicIp => {

        resolve({
            localIp,
            publicIp,
            // The one port serving everything (page + WS, HTTP or HTTPS).
            // homegames.link appends it to redirect/selector URLs; older link
            // servers ignore it (falling back to scheme-default 80/443).
            port,
            https: httpsEnabled, // legacy field, kept for back-compat with older link servers
            httpsEnabled,
            httpsReady: httpsReady && certificateMatchesNetwork(servingCertificate, publicIp)
        });
    }).catch(err => {
        console.log('couldnt get local ip');
        console.error(err);
        // Reject so callers always settle (previously this swallowed the error
        // and getClientInfo hung forever on any throw).
        reject(err);
    });
});

const LINK_URL = getConfigValue('LINK_URL', `wss://homegames.link`);

const RECONNECT_BASE_MS = 1000;       // first retry after ~1s
const RECONNECT_MAX_MS = 30 * 1000;   // backoff cap
const REGISTRATION_RETRY_MS = 30 * 1000;

const registerClient = async client => {
    const clientInfo = await getClientInfo();
    if (client.readyState !== WebSocket.OPEN) return;
    client.send(JSON.stringify({ type: 'register', data: { ...clientInfo, mapEnabled: MAP_ENABLED } }));
};
const retryDiscovery = () => activeClient ? registerClient(activeClient).catch(() => {}) : Promise.resolve();

const linkConnect = (msgHandler, reconnectAttempt = 0) => new Promise((resolve, reject) => {
    const client = new WebSocket(LINK_URL);

    let interval;
    let nextRegistrationRetry = 0;
    // Distinguishes a deliberate close (the 30-min refresh) from an unexpected
    // drop (error / network blip). Only unexpected drops trigger reconnect.
    let intentionalClose = false;
    let reconnectScheduled = false;
    // Reset backoff only after the registration has stayed connected through
    // a heartbeat. A successful handshake can still be rejected by Link.
    let attempt = reconnectAttempt;

    const scheduleReconnect = () => {
        if (reconnectScheduled || intentionalClose) return;
        reconnectScheduled = true;
        const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
        log.info(`link socket down; reconnecting in ${delay}ms`);
        setTimeout(() => {
            // Swallow rejection: this reconnect isn't awaited by anyone, so a
            // failed attempt must not surface as an unhandled rejection (its own
            // close handler will schedule the next retry).
            linkConnect(msgHandler, attempt + 1).catch(() => {});
        }, delay);
    };

    // in 30 minutes, kill and refresh websocket
    const socketRefreshTime = Date.now() + (1000 * 60 * 30);

    client.on('open', () => {
        activeClient = client;
        setDiscoveryStatus('idle');
        registerClient(client).then(() => {
            if (client.readyState !== WebSocket.OPEN) return resolve(client);
            interval = setInterval(() => {
                if (client.readyState === 1) {
                    attempt = 0;
                    client.send(JSON.stringify({type: 'heartbeat'}));
                    if (['network-conflict', 'dns-unavailable'].includes(discoveryStatus.state)
                        && Date.now() >= nextRegistrationRetry) {
                        nextRegistrationRetry = Date.now() + REGISTRATION_RETRY_MS;
                        registerClient(client).catch(() => {});
                    }
                }
                if (Date.now() > socketRefreshTime) {
                    log.info('refreshing link socket');
                    intentionalClose = true; // don't let the refresh trigger a reconnect
                    clearInterval(interval);
                    client.close();
                    linkConnect(msgHandler).catch(() => {});
                }

            }, 1000 * 10);

            resolve(client);
        }).catch((err) => {
            // Couldn't build client info (e.g. API unreachable). Don't hang the
            // open handler — close so the 'close' handler schedules a backoff
            // reconnect, and reject so linkInit's caller starts the server
            // WITHOUT link (offline/LAN operation must never be blocked on this).
            log.error('Failed to register with link; continuing without it');
            log.error(err);
            try { client.close(); } catch (e) {}
            reject(err);
        });
    });

    client.on('message', raw => {
        try {
            const message = JSON.parse(raw);
            if (activeClient === client && message.type === 'registration-status'
                && ['ready', 'network-conflict', 'dns-unavailable'].includes(message.state)) {
                nextRegistrationRetry = Date.now() + REGISTRATION_RETRY_MS;
                setDiscoveryStatus(message.state);
            }
        } catch (_) { /* Ignore unrelated messages from older Link versions. */ }
        if (msgHandler) msgHandler(raw);
    });

    client.on('error', (err) => {
        log.error('Link client error');
        log.error(err);
        // 'close' always follows 'error' and owns reconnect, so don't reconnect
        // here. reject() is a no-op once the promise has already resolved on open.
        reject(err);
    });

    client.on('close', () => {
        if (activeClient === client) { activeClient = null; setDiscoveryStatus('disconnected'); }
        clearInterval(interval);
        // Reconnect unless this was the deliberate 30-min refresh.
        scheduleReconnect();
    });

});

let msgId = 0;
const verifyDNS = (client, accessToken, localIp) => new Promise((resolve, reject) => {
    msgId++;

    client.send(JSON.stringify({
        type: 'verify-dns',
        localIp,
        //username,
        accessToken,
        msgId
    }));

    resolve(msgId); 
});

// Update HTTPS readiness and re-register with the link server so the new state
// propagates immediately (heartbeats carry no data, so a fresh `register` is how
// field updates reach the cache). Call with the client returned by linkConnect.
const setHttpsReady = (client, ready, certificate) => new Promise((resolve) => {
    httpsReady = ready;
    if (certificate !== undefined) servingCertificate = certificate?.cert || null;
    if (!client || client.readyState !== 1) client = activeClient;
    if (client && client.readyState === 1) {
        registerClient(client).then(resolve).catch(() => resolve());
    } else {
        resolve();
    }
});

module.exports = { linkConnect, getClientInfo, verifyDNS, setHttpsReady, certificateMatchesNetwork,
    getDiscoveryStatus, onDiscoveryUpdate, retryDiscovery, setListeningPort };
