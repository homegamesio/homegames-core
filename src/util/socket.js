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
                playerIds[k] = true;
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
            const gameWidth1 = 12;
            const gameWidth2 = 80;
            const gameHeight1 = 72;
            const gameHeight2 = 0;
            
            // init message
            ws.send([2, ws.id, gameWidth1, gameWidth2, gameHeight1, gameHeight2]);

            const player = new Player(ws);
            gameSession.addPlayer(player);
        }

        ws.on('message', messageHandler);

        function closeHandler() {
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

