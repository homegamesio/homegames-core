const WebSocket = require("ws");
const http = require("http");
const linkHelper = require("../common/util/link-helper");
const Player = require("../Player");

const socketServer = (gameSession, port, cb = null) => {
    linkHelper();

    let playerIds = new Array(256);

    for (let i = 0; i < 255; i++) {
        playerIds[i] = false;
    }

    const generatePlayerId = () => {
        for (let k in playerIds) {
            if (playerIds[k] === false) {
                return Number(k);
            }
        }

        throw new Error("no player IDs left in pool");
    };

    const server = http.createServer();

    const wss = new WebSocket.Server({
        server
    });
    
    wss.on("connection", (ws) => {
        function messageHandler(msg) {
            ws.removeListener('message', messageHandler);
    
            ws.id = generatePlayerId();
            ws.readyState === 1 && ws.send([ws.id]);

            const player = new Player(ws);
            gameSession.addPlayer(player);
        }

        ws.on('message', messageHandler);

        function closeHandler() {
            console.log("HELLO");
            console.log(ws.id);
            gameSession.handlePlayerDisconnect(ws.id);
        }

        ws.on('close', closeHandler);

    });
    
    server.listen(port, null, null, () => {
        cb && cb();
    });
}


module.exports = {
    socketServer
};

