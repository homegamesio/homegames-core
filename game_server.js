const WebSocket = require("ws");

const Draw = require("./src/games/draw");
const LayerTest = require("./src/games/layer-test");
const MoveTest = require("./src/games/move-test");
const TextTest = require("./src/games/text-test");
const GameSession = require("./src/GameSession");
const Player = require("./src/Player");
const SplashScreen = require("./src/splash-screen/splash-screen");
const Slaps = require('./src/games/slaps');
const http = require("http");
const linkHelper = require("./src/util/link-helper");

const PORT = 7080;

const server = http.createServer();

linkHelper();

let toExecute;
toExecute = new Slaps();
//toExecute = new SplashScreen();
//toExecute = new Draw();
//toExecute = new LayerTest();
//toExecute = new MoveTest();
//toExecute = new AllTest();
//toExecute = new TextTest();
//toExecute = new Demo();

const session = new GameSession(toExecute, {
    "width": 320, 
    "height": 180
});

const wss = new WebSocket.Server({
    server
});

wss.on("connection", (ws) => {
    function messageHandler(msg) {
        ws.removeListener('message', messageHandler);
        const player = new Player(ws);
        session.addPlayer(player);
    }
    
    ws.on('message', messageHandler);
});

server.listen(PORT);

