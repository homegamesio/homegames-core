const WebSocket = require('ws');
const Draw = require('./src/games/draw');
const LayerTest = require('./src/games/layer-test');
const MoveTest = require('./src/games/move-test');
const TextTest = require('./src/games/text-test');
const Demo = require('./src/games/demo');
const GameSession = require('./src/GameSession');
const Player = require('./src/Player');
const SplashScreen = require('./src/splash-screen');
const https = require('https');
const fs = require('fs');

const PORT = 7080;

const server = https.createServer({
    cert: fs.readFileSync('ssl/localhost.crt'),
    key: fs.readFileSync('ssl/localhost.key'),
});

let toExecute;
toExecute = new SplashScreen();
//toExecute = new Draw();
//toExecute = new LayerTest();
//toExecute = new MoveTest();
//toExecute = new TextTest();
//toExecute = new Demo();

const session = new GameSession(toExecute, {'width': 320, 'height': 180});

const wss = new WebSocket.Server({
    server
});

// the first connection will be the HTTPS server connecting to the socket. ignore it as a "player"
let firstConnection = false;

wss.on('connection', (ws) => {
    if (!firstConnection) {
        firstConnection = true;
        return;
    }

    const player = new Player(ws);
    session.addPlayer(player);
});

server.listen(PORT, () => {
    const ws = new WebSocket(`wss://192.168.1.16:${server.address().port}`, {
        rejectUnauthorized: false
    });
});

