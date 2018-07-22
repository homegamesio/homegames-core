const WebSocket = require('ws');

const server = new WebSocket.Server({
	port: 8080
});

const COLORS = {
	BLACK: [0, 0, 0, 255],
	WHITE: [255, 255, 255, 255],
	GRAY: [190, 190, 190, 255],
	RED: [255, 26, 9, 255],
	PURPLE: [225, 26, 255, 255],
	BLUE: [0, 9, 255, 255],
	GREEN: [80, 211, 0, 255],
	ORANGE: [234, 106, 56, 255]
};

let colorKeys = Object.keys(COLORS);

// max "good" size seems like ~320x180

let width = 320;
let height = 180;
let gamePixels = new Uint8ClampedArray(width * height * 4);

const flippedPixels = {};

const pixelColorMap = {};

// initial game state
//
let newGamePixels = new Uint8ClampedArray(width * height * 4);

const updateGameState = function() {
	for (let i = 0; i < gamePixels.length; i+=4) {
		let y = ((i/4) % width);
		let flipped = flippedPixels[(i/4)];
		if(y < (width / 2)) {
			color = flipped ? COLORS.GREEN : COLORS.ORANGE;
		} else {
			color = flipped ? COLORS.ORANGE : COLORS.GREEN;
		}
		newGamePixels[i] = color[0];
		newGamePixels[i + 1] = color[1];
		newGamePixels[i + 2] = color[2];
		newGamePixels[i + 3] = color[3];
	}

	gamePixels = newGamePixels;
};

updateGameState();

server.on('connection', (ws) => {
	ws.on('message', (msg) => {
		if(msg['req']) {
    	ws.send(gamePixels);
		} else {
			msg.split(',').forEach(function(i) {
				flippedPixels[i] = true;//!(flippedPixels[msg]);
			});
			updateGameState();
			server.clients.forEach(function(client) {
  			if (client.readyState === WebSocket.OPEN) {
					client.send(gamePixels);
				}
			});
		}
	});
	ws.send(gamePixels);
});
