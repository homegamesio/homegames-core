const WebSocket = require("ws");

//const Draw = require("./src/games/draw");
//const LayerTest = require("./src/games/layer-test");
//const SpriteTest = require("./src/games/sprite-test");
const HomegamesDashboard = require('./src/HomegamesDashboard');
//const MoveTest = require("./src/games/move-test");
//const TextTest = require("./src/games/text-test");
const GameSession = require("./src/GameSession");
const Player = require("./src/Player");
//const Homegames = require('./Homegames');
//const SplashScreen = require("./src/splash-screen/splash-screen");
//const Slaps = require('./src/games/slaps');
//const NameTest = require('./src/games/name-test');
//const Menu = require('./src/menu');
const http = require("http");
const linkHelper = require("./src/common/util/link-helper");

//const WordMatch = require('./src/games/word-match');
const games = require('./src/games');

const HOMEGAMES_PORT_RANGE_MIN = 7001;
const HOMEGAMES_PORT_RANGE_MAX = 7100;

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

const dashboard = new HomegamesDashboard();

const session = new GameSession(dashboard, {
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
        players[ws.id] && players[ws.id].disconnect();
    });
});

server.listen(7000);

