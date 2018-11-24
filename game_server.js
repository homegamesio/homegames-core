const WebSocket = require('ws');
const uuid = require('uuid');

const GameNode = require('./GameNode');
const Squisher = require('./Squisher');

const COLORS = require('./Colors');

const { listenable } = require('./helpers') 

const server = new WebSocket.Server({
	port: 7080
});

const colorKeys = Object.keys(COLORS);

const randomizeBackground = function() {
	let colorKey = Math.floor(Math.random() * colorKeys.length);
	boardColor = COLORS[colorKeys[colorKey]];
};

const randomizeDrawColor = function(ws) {
	let colorKey = Math.floor(Math.random() * colorKeys.length);
	let newColor = COLORS[colorKeys[colorKey]];
	clientColors[ws.id] = newColor;
};

const handleBoardClick = function() {
    this.color = COLORS.TERRACOTTA;
    squisher.update(this);
    gamePixels = squisher.getPixels();
};

const resetBoard = function() {
    console.log("RESET BOARD");
};

const listener = {
    handleUpdate: function(pixels) {
        server.clients.forEach(function(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(pixels);
            }
        });
    }
};

const board = listenable(new GameNode(COLORS.PURPLE, handleBoardClick, {'x': 0, 'y': 0}, {'x': 1, 'y': 1}), function() {});

const resetButton = listenable(new GameNode(COLORS.RED, resetBoard, {'x': .9, 'y': 0}, {'x': .1, 'y': .5}), function() {});

board.addChild(resetButton);

const squisher = new Squisher(192, 108, board);
squisher.addListener(listener);

let gamePixels = squisher.getPixels();

server.on('connection', (ws) => {
	ws.id = uuid();
	ws.send(gamePixels);
    ws.on('message', function(msg) {
        let data = JSON.parse(msg);
        if (!data.x) {
            console.log(data);
            return;
        }
        squisher.handleClick(data.x, data.y);
    });
});
