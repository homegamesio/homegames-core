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
    const localIP = getLocalIP();

    return {
        ip: localIP,
        https: config.HTTPS_ENABLED
    }
};

const linkConnect = () => new Promise((resolve, reject) => {
    const client = new WebSocket('wss://www.homegames.link:7080');
    
    client.on('open', () => {
        const clientInfo = getClientInfo();

        client.send(JSON.stringify(clientInfo));

        setInterval(() => {
            client.send(JSON.stringify({type: 'heartbeat'}));
        }, 2 * 1000 * 60);

        resolve();
    });
    
    client.on('error', (e) => {
        console.error(e);
    });

    client.on('close', () => {
        clearTimeout(this.pingTimeout);
    });

});

module.exports = { linkConnect, getClientInfo };
