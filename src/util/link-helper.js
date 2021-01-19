const WebSocket = require('ws');
const os = require('os');
const config = require('../../config');

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
        https: config.HTTPS_ENABLED
    }
};

const linkConnect = (msgHandler) => new Promise((resolve, reject) => {
    const client = new WebSocket('wss://www.homegames.link:7080');
    
    client.on('open', () => {
        const clientInfo = getClientInfo();

        client.send(JSON.stringify({
            type: 'register',
            data: clientInfo
        }));

        setInterval(() => {
            client.send(JSON.stringify({type: 'heartbeat'}));
        }, 2 * 1000 * 60);

        resolve(client);
    });

    client.on('message', msgHandler);
    
    client.on('error', (e) => {
        console.error(e);
    });

    client.on('close', () => {
        clearTimeout(this.pingTimeout);
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
