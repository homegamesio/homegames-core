const WebSocket = require("ws");

const Draw = require("./src/games/draw");
const LayerTest = require("./src/games/layer-test");
const MoveTest = require("./src/games/move-test");
const TextTest = require("./src/games/text-test");
const GameSession = require("./src/GameSession");
const Player = require("./src/Player");
const SplashScreen = require("./src/splash-screen/splash-screen");
const http = require("http");
const linkHelper = require("./src/util/link-helper");
const GameSelector = require("./src/game-selector");
const SessionDashboard = require("./src/session-dashboard");

const SESSION_PORT_MIN = 7100;
const SESSION_PORT_MAX = 7200;

const range = (start, end) => {
    return Array(end - start + 1).fill().map((_, idx) => start + idx);
};

const SESSION_PORT_RANGE = range(SESSION_PORT_MIN, SESSION_PORT_MAX);

const PORT = 7080;

const server = http.createServer();

linkHelper();

const sessionDashboard = new SessionDashboard(SESSION_PORT_RANGE);
//let toExecute;
//toExecute = new SplashScreen();
//toExecute = new Draw();
//toExecute = new LayerTest();
//toExecute = new GameSelector();
//toExecute = new AllTest();
//toExecute = new TextTest();
//toExecute = new MoveTest();
//toExecute = new Demo();

const session = new GameSession(sessionDashboard);

const wss = new WebSocket.Server({
    server
});

wss.on("connection", (ws) => {
    console.log("ay");
    const player = new Player(ws);
    session.addPlayer(player);
    player.receiveUpdate([7, 160, 10, 90, 10]);//game.getResolution());
});

server.listen(PORT);

