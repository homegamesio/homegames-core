const WebSocket = require("ws");
const os = require("os");

const getLocalIP = () => {
    const ifaces = os.networkInterfaces();
    let localIP;

    Object.keys(ifaces).forEach((ifname) => {
        ifaces[ifname].forEach((iface) => {
            if ("IPv4" !== iface.family || iface.internal) {
                return;
            }
            localIP = localIP || iface.address;
        });
    });

    return localIP;
};

const linkConnect = () => {
    const client = new WebSocket("ws://www.homegames.link:7080");
    
    client.on("open", () => {
        const localIP = getLocalIP();
        client.send(localIP);
    });
    
    client.on("error", (e) => {
        console.error(e);
    });

    client.on("close", () => {
        clearTimeout(this.pingTimeout);
    });

    return client;
};

const init = () => {
    try {
        linkConnect();
    } catch(err) {
        console.error(err);
    }
};

module.exports = init;
