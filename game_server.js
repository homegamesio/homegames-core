const WebSocket = require('ws');
const Draw = require('./src/games/draw');
const GameSession = require('./src/GameSession');
const Player = require('./src/Player');

const server = new WebSocket.Server({
	port: 7080
});

const draw = new Draw();
const session = new GameSession(draw, {'width': 320, 'height': 180});

server.on('connection', (ws) => {
    const player = new Player(ws);
    session.addPlayer(player);
});
