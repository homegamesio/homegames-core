const WebSocket = require("ws");
const http = require("http");
const assert = require("assert");
const linkHelper = require("../common/util/link-helper");
const Player = require("../Player");

const socketServer = (gameSession, port, cb = null) => {
    linkHelper();

    let playerIds = {};

    for (let i = 1; i < 256; i++) {
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
            assert(msg === "ready");

            ws.removeListener("message", messageHandler);
    
            ws.id = generatePlayerId();

            let gameMetadata = gameSession.game.constructor.metadata();
            const gameWidth1 = gameMetadata.res.width / 100;
            const gameWidth2 = gameMetadata.res.width % 100;
            const gameHeight1 = gameMetadata.res.height / 100;
            const gameHeight2 = gameMetadata.res.height % 100;
            
            // init message
            ws.send([2, ws.id, gameWidth1, gameWidth2, gameHeight1, gameHeight2]);

            const player = new Player(ws);
            gameSession.addPlayer(player);
        }

        ws.on("message", messageHandler);

        function closeHandler() {
            playerIds[ws.id] = false;
            gameSession.handlePlayerDisconnect(ws.id);
        }

        ws.on("close", closeHandler);

    });
    
    server.listen(port, null, null, () => {
        cb && cb();
    });
};


module.exports = {
    socketServer
};

