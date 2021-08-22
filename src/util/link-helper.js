const WebSocket = require('ws');
const os = require('os');
const path = require('path');
const { getConfigValue } = require(`${path.resolve()}/src/util/config`);


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

const linkConnect = (msgHandler) => new Promise((resolve, reject) => {
    const client = new WebSocket('wss://homegames.link');
    
    client.on('open', () => {
        const clientInfo = getClientInfo();

        client.send(JSON.stringify({
            type: 'register',
            data: clientInfo
        }));

        setInterval(() => {
            client.readyState == 1 && client.send(JSON.stringify({type: 'heartbeat'}));
        }, 1000 * 10);

        resolve(client);
    });

    client.on('message', msgHandler ? msgHandler : () => {});
    
    client.on('error', (err) => {
        reject(err);
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
