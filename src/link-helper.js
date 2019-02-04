const WebSocket = require('ws');

const init = () => {
    const client = new WebSocket('ws://www.homegames.link');
    const heartbeat = () => {
        clearTimeout(this.pingTimeout);
        
        this.pingTimeout = setTimeout(() => {
            this.terminate();
        }, 30000 + 1000);
    };
    
    client.on('open', heartbeat);
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
