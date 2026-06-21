const { log } = require('homegames-common');

const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const os = require('os');
const fs = require('fs');
const path = require('path');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require('homegames-common');

const MAP_ENABLED = getConfigValue('MAP_ENABLED', false);

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

const getClientInfo = () => new Promise((resolve, reject) => {
    const localIp = getLocalIP();
    const httpsEnabled = getConfigValue('HTTPS_ENABLED', false);
    getPublicIP().then(publicIp => {

        resolve({
            localIp,
            publicIp,
            https: httpsEnabled, // legacy field, kept for back-compat with older link servers
            httpsEnabled,
            httpsReady
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

const linkConnect = (msgHandler, reconnectAttempt = 0) => new Promise((resolve, reject) => {
    const client = new WebSocket(LINK_URL);

    let interval;
    // Distinguishes a deliberate close (the 30-min refresh) from an unexpected
    // drop (error / network blip). Only unexpected drops trigger reconnect.
    let intentionalClose = false;
    let reconnectScheduled = false;
    // Local copy so we can reset backoff to 0 once a connection opens.
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
        attempt = 0; // healthy connection — reset backoff
        getClientInfo().then(clientInfo => {
            const toSend = Object.assign({}, clientInfo);
            toSend.mapEnabled = MAP_ENABLED;

            client.send(JSON.stringify({
                type: 'register',
                data: toSend
            }));

            interval = setInterval(() => {
                client.readyState == 1 && client.send(JSON.stringify({type: 'heartbeat'}));
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

    client.on('message', msgHandler ? msgHandler : () => {});

    client.on('error', (err) => {
        log.error('Link client error');
        log.error(err);
        // 'close' always follows 'error' and owns reconnect, so don't reconnect
        // here. reject() is a no-op once the promise has already resolved on open.
        reject(err);
    });

    client.on('close', () => {
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
const setHttpsReady = (client, ready) => new Promise((resolve) => {
    httpsReady = ready;
    if (client && client.readyState === 1) {
        getClientInfo().then(clientInfo => {
            const toSend = Object.assign({}, clientInfo);
            toSend.mapEnabled = MAP_ENABLED;
            client.send(JSON.stringify({
                type: 'register',
                data: toSend
            }));
            resolve();
        }).catch(() => resolve());
    } else {
        resolve();
    }
});

module.exports = { linkConnect, getClientInfo, verifyDNS, setHttpsReady };
