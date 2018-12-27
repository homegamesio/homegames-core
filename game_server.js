const WebSocket = require('ws');
const uuid = require('uuid');

const GameNode = require('./GameNode');
const Squisher = require('./Squisher');

const COLORS = require('./Colors');

const { listenable } = require('./helpers') 

const server = new WebSocket.Server({
	port: 7080
});

const randomizeDrawColor = function(ws) {
	let colorKey = Math.floor(Math.random() * colorKeys.length);
	let newColor = COLORS[colorKeys[colorKey]];
	clientColors[ws.id] = newColor;
};

const handleBoardClick = function(x, y) {
    const coloredPixelRaw = new GameNode(COLORS.BLACK, () => {}, {'x': x, 'y': y}, {'x': .0016, 'y': .0009});
//    coloredPixelRaw.index = 1;
    const coloredPixel = listenable(coloredPixelRaw, () => {});

    board.addChild(coloredPixel);
};

const colorKeys = Object.keys(COLORS);

const randomizeBoardColor = function() {
    let colorKey = Math.floor(Math.random() * colorKeys.length);
	board.color = COLORS[colorKeys[colorKey]];
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

// this is a hack. a game should be able to run without a squisher. a game session requires a squisher.
let squisher;

const board = listenable(new GameNode(COLORS.PURPLE, handleBoardClick, {'x': 0, 'y': 0}, {'x': 1, 'y': 1}), () => { squisher && squisher.update(board); });

const resetButton = listenable(new GameNode(COLORS.RED, randomizeBoardColor, {'x': .85, 'y': 0}, {'x': .15, 'y': .15}), () => { squisher && squisher.update(board); });

board.addChild(resetButton);

squisher = new Squisher(320, 180, board);
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
