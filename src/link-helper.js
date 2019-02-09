const WebSocket = require('ws');
const os = require('os');

const ifaces = os.networkInterfaces();

let localIPv4Addr;

Object.keys(ifaces).forEach((ifname) => {
    ifaces[ifname].forEach((iface) => {
        if ('IPv4' !== iface.family || iface.internal !== false) {
            return;
        }

        localIPv4Addr = iface.address;
    });
});

const init = () => {
    const client = new WebSocket('ws://homegames.link:7080');
    const heartbeat = () => {
        clearTimeout(this.pingTimeout);
        
        this.pingTimeout = setTimeout(function() {
            this.close();
        }, 30000 + 1000);
    };
 
    client.on('open', () => {
        client.send(localIPv4Addr);
        heartbeat();
    });
    client.on('ping', heartbeat);
    client.on('error', (e) => {
        console.error(e);
    });
    client.on('close', () => {
        clearTimeout(this.pingTimeout)
    });

    return client;
};

module.exports = init;
