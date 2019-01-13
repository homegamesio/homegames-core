const WebSocket = require('ws');
const Draw = require('./src/games/draw');
const LayerTest = require('./src/games/layer-test');
const MoveTest = require('./src/games/move-test');
const TextTest = require('./src/games/text-test');
const Demo = require('./src/games/demo');
const GameSession = require('./src/GameSession');
const Player = require('./src/Player');

const server = new WebSocket.Server({
    port: 7080
});

let toExecute;
//toExecute = new Draw();
//toExecute = new LayerTest();
//toExecute = new MoveTest();
//toExecute = new TextTest();
toExecute = new Demo();

const session = new GameSession(toExecute, {'width': 320, 'height': 180});

server.on('connection', (ws) => {
    const player = new Player(ws);
    session.addPlayer(player);
});
