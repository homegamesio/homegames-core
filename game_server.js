const WebSocket = require('ws');
const Draw = require('./src/games/draw');
const LayerTest = require('./src/games/layer-test');
const MoveTest = require('./src/games/move-test');
const GameSession = require('./src/GameSession');
const Player = require('./src/Player');

const server = new WebSocket.Server({
	port: 7080
});

//const draw = new Draw();
//const layerTest = new LayerTest();
const moveTest = new MoveTest();
const session = new GameSession(moveTest, {'width': 320, 'height': 180});

server.on('connection', (ws) => {
    const player = new Player(ws);
    session.addPlayer(player);
});
