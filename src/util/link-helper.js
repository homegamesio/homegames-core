const WebSocket = require('ws');
const os = require('os');
const fs = require('fs');
const path = require('path');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require('homegames-common');

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

const getClientInfo = () => {
    const localIp = getLocalIP();

    return {
        localIp,
        https: getConfigValue('HTTPS_ENABLED', false)
    };
};

const linkConnect = (msgHandler, username) => new Promise((resolve, reject) => {
    console.log('registering with username ' + username);
    const client = new WebSocket('wss://homegames.link');

    let interval;

    // in 30 minutes, kill and refresh websocket
    const socketRefreshTime = Date.now() + 1000 * 30;//60 * 30;
    
    client.on('open', () => {
        const clientInfo = getClientInfo();
        clientInfo.username = username ? username.toString() : null;

        client.send(JSON.stringify({
            type: 'register',
            data: clientInfo
        }));

        interval = setInterval(() => {
            client.readyState == 1 && client.send(JSON.stringify({type: 'heartbeat'}));
            if (Date.now() > socketRefreshTime) {
                console.log('refreshing link socket');
                client.close();
                clearInterval(interval);
                linkConnect(msgHandler, username);
            }

        }, 1000 * 10);

        resolve(client);
    });

    client.on('message', msgHandler ? msgHandler : () => {});
    
    client.on('error', (err) => {
        console.log(err);
        reject(err);
    });

    client.on('close', () => {
        clearTimeout(this.pingTimeout);
        clearInterval(interval);
    });

});

let msgId = 0;
const verifyDNS = (client, username, accessToken, localIp) => new Promise((resolve, reject) => {
    msgId++;

    client.send(JSON.stringify({
        type: 'verify-dns',
        localIp,
        username,
        accessToken,
        msgId
    }));

    resolve(msgId); 
});

module.exports = { linkConnect, getClientInfo, verifyDNS };
