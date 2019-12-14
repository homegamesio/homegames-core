const WebSocket = require("ws");
const GameSession = require("./src/GameSession");
const Player = require("./src/Player");
const http = require("http");
const linkHelper = require("./src/common/util/link-helper");
const { Squarer } = require("./src/games");

const PORT = 7080;
const server = http.createServer();

linkHelper();

const players = {};

for (let i = 1; i < 256; i++) {
    players[i] = false;
}

const generatePlayerId = () => {
    for (let k in players) {
        if (!players[k]) {
            return Number(k);
        }
    }

    throw new Error("no player IDs left in pool");
};

const game = new Squarer();

const session = new GameSession(game, {
    "width": 320,
    "height": 180
});

const wss = new WebSocket.Server({
    server
});

wss.on("connection", (ws) => {
    function messageHandler(msg) {
        ws.removeListener('message', messageHandler);
        ws.id = generatePlayerId();
        ws.send([ws.id]);
        const player = new Player(ws);
        session.addPlayer(player);
        players[ws.id] = player;
    }

    ws.on('message', messageHandler);

    ws.on('close', () => {
        players[ws.id].disconnect();
        players[ws.id] = false;
    });
});

server.listen(PORT);

