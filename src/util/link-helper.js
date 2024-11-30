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

const API_URL = getConfigValue('API_URL', 'https://api.homegames.io:443');
const parsedUrl = new URL(API_URL);
const isSecure = parsedUrl.protocol == 'https:';

const getPublicIP = () => new Promise((resolve, reject) => {
    (isSecure ? https : http).get(`${API_URL}/ip`, (res) => {
        let buf = '';
        res.on('data', (chunk) => {
            buf += chunk.toString();
        });

        res.on('end', () => {
            resolve(buf.toString());
        });
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

const getClientInfo = () => new Promise((resolve, reject) => {
    const localIp = getLocalIP();
    getPublicIP().then(publicIp => {

        resolve({
            localIp,
            publicIp,
            https: getConfigValue('HTTPS_ENABLED', false)
        });
    });
});

const LINK_URL = getConfigValue('LINK_URL', `wss://homegames.link`);

const linkConnect = (msgHandler) => new Promise((resolve, reject) => {
    const client = new WebSocket(LINK_URL);

    let interval;

    // in 30 minutes, kill and refresh websocket
    const socketRefreshTime = Date.now() + (1000 * 60 * 30);
    
    client.on('open', () => {
        getClientInfo().then(clientInfo => {
            const toSend = Object.assign({}, clientInfo);
            toSend.mapEnabled = true;//process.env.MAP_ENABLED ? true : false;
            client.send(JSON.stringify({
                type: 'register',
                data: toSend 
            }));

            interval = setInterval(() => {
                client.readyState == 1 && client.send(JSON.stringify({type: 'heartbeat'}));
                if (Date.now() > socketRefreshTime) {
                    log.info('refreshing link socket');
                    client.close();
                    clearInterval(interval);
                    linkConnect(msgHandler);
                }

            }, 1000 * 10);

            resolve(client);
        });
    });

    client.on('message', msgHandler ? msgHandler : () => {});
    
    client.on('error', (err) => {
        console.log(err);
        log.error('Link client error');
        log.error(err);
        reject(err);
    });

    client.on('close', () => {
        clearTimeout(this.pingTimeout);
        clearInterval(interval);
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

module.exports = { linkConnect, getClientInfo, verifyDNS };
