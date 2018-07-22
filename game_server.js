const WebSocket = require('ws');
const uuid = require('uuid');

const server = new WebSocket.Server({
	port: 8080
});

const clientColors = {};
const COLORS = {
	BLACK: [0, 0, 0, 255],
	WHITE: [255, 255, 255, 255],
	GRAY: [190, 190, 190, 255],
	RED: [255, 0, 0, 255],
	PURPLE: [128, 0, 128, 255],
	BLUE: [0, 0, 255, 255],
	GREEN: [0, 255, 0, 255],
	ORANGE: [255, 165, 0, 255],
	YELLOW: [255, 255, 0, 255],
	BROWN: [145, 97, 11, 255],
	PINK: [255, 192, 203, 255],
	FUCHSIA: [255, 0, 255, 255],
	LAVENDER: [230, 230, 250, 255],
	PERRYWINKLE: [204, 204, 255, 255],
	AQUA: [188, 212, 230, 255],
	TURQUOISE: [64, 224, 208],
	MAGENTA: [255, 0, 255, 255],
	ORANGE_RED: [255, 69, 0, 255],
	MUSTARD: [232, 219, 32, 255],
	EMERALD: [39, 89, 45, 255],
	CREAM: [240, 224, 136, 255],
	GOLD: [255, 198, 35, 255],
	SILVER: [192, 192, 192, 255],
	BRONZE: [227, 151, 17, 255],
	MAROON: [128, 0, 0, 255],
	TEAL: [0, 128, 128, 255],
	TERRACOTTA: [226, 114, 91, 255]
};

let squareColor = COLORS.TERRACOTTA;

let colorKeys = Object.keys(COLORS);

// max "good" size seems like ~320x180

let width = 240;
let height = 135;
let gamePixels = new Uint8ClampedArray(width * height * 4);

let changedPixels = {};

const pixelColorMap = {};
const boardEntities = {};

let leftSideColor = COLORS.ORANGE;
let rightSideColor = COLORS.GREEN;

const resetBoard = function() {
	changedPixels = {};
	updateGameState();
};

const randomizeBackground = function() {
	let leftSideColorKey = Math.floor(Math.random() * colorKeys.length);
	let rightSideColorKey = Math.floor(Math.random() * colorKeys.length);
	leftSideColor = COLORS[colorKeys[leftSideColorKey]];
	rightSideColor = COLORS[colorKeys[rightSideColorKey]];
	updateGameState();
};

const randomizeDrawColor = function(ws) {
	let colorKey = Math.floor(Math.random() * colorKeys.length);
	let newColor = COLORS[colorKeys[colorKey]];
	clientColors[ws.id] = newColor;
};

const resetButton = {'color': COLORS.RED, 'onClick': resetBoard};
const randomizeBackgroundButton = {'color': COLORS.PINK, 'onClick': randomizeBackground};
const randomizeClientDrawColorButton = {'color': COLORS.YELLOW, 'onClick': randomizeDrawColor};
const BLACK_PIXEL = {'color': COLORS.BLACK, 'onClick': function() {}};

for (let i = 1; i < 2; i++) {
	boardEntities[i * width - 1] = BLACK_PIXEL;
	boardEntities[i * width - 4] = BLACK_PIXEL;
	boardEntities[i * width - 3] = BLACK_PIXEL;
	boardEntities[i * width - 2] = BLACK_PIXEL;
	boardEntities[i * width - 5] = BLACK_PIXEL;
	boardEntities[i * width - 8] = BLACK_PIXEL;
	boardEntities[i * width - 7] = BLACK_PIXEL;
	boardEntities[i * width - 6] = BLACK_PIXEL;
	boardEntities[i * width - 9] = BLACK_PIXEL;
	boardEntities[i * width - 12] = BLACK_PIXEL;
	boardEntities[i * width - 11] = BLACK_PIXEL;
	boardEntities[i * width - 10] = BLACK_PIXEL;
	boardEntities[i * width - 13] = BLACK_PIXEL;
	boardEntities[i * width - 14] = BLACK_PIXEL;
	boardEntities[i * width - 15] = BLACK_PIXEL;
	boardEntities[i * width - 16] = BLACK_PIXEL;
}

for (let i = 2; i < 6; i++) {
	boardEntities[i * width - 1] = BLACK_PIXEL;

	boardEntities[i * width - 5] = resetButton;
	boardEntities[i * width - 4] = resetButton;
	boardEntities[i * width - 3] = resetButton;
	boardEntities[i * width - 2] = resetButton;

	boardEntities[i * width - 6] = BLACK_PIXEL;

	boardEntities[i * width - 10] = randomizeBackgroundButton;
	boardEntities[i * width - 9] = randomizeBackgroundButton;
	boardEntities[i * width - 8] = randomizeBackgroundButton;
	boardEntities[i * width - 7] = randomizeBackgroundButton;

	boardEntities[i * width - 11] = BLACK_PIXEL;

	boardEntities[i * width - 15] = randomizeClientDrawColorButton;
	boardEntities[i * width - 14] = randomizeClientDrawColorButton;
	boardEntities[i * width - 13] = randomizeClientDrawColorButton;
	boardEntities[i * width - 12] = randomizeClientDrawColorButton;

	boardEntities[i * width - 16] = BLACK_PIXEL;
}

for (let i = 6; i < 7; i++) {
	boardEntities[i * width - 1] = BLACK_PIXEL;
	boardEntities[i * width - 4] = BLACK_PIXEL;
	boardEntities[i * width - 3] = BLACK_PIXEL;
	boardEntities[i * width - 2] = BLACK_PIXEL;
	boardEntities[i * width - 5] = BLACK_PIXEL;
	boardEntities[i * width - 8] = BLACK_PIXEL;
	boardEntities[i * width - 7] = BLACK_PIXEL;
	boardEntities[i * width - 6] = BLACK_PIXEL;
	boardEntities[i * width - 9] = BLACK_PIXEL;
	boardEntities[i * width - 12] = BLACK_PIXEL;
	boardEntities[i * width - 11] = BLACK_PIXEL;
	boardEntities[i * width - 10] = BLACK_PIXEL;
	boardEntities[i * width - 13] = BLACK_PIXEL;
	boardEntities[i * width - 14] = BLACK_PIXEL;
	boardEntities[i * width - 15] = BLACK_PIXEL;
	boardEntities[i * width - 16] = BLACK_PIXEL;
}


// initial game state
//
let newGamePixels = new Uint8ClampedArray(width * height * 4);

const updateGameState = function() {
	for (let i = 0; i < gamePixels.length; i+=4) {
		let color = COLORS.BLACK;
		if ((i/4) in boardEntities) {
			color = boardEntities[i/4].color;
		} else {
			let y = ((i/4) % width);
			color = changedPixels[(i/4)];
			if(y < (width / 2)) {
				color = color ? color : leftSideColor;
			} else {
				color = color ? color : rightSideColor;
			}
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
	ws.id = uuid();
	let colorKey = Math.floor(Math.random() * colorKeys.length);
	let color = COLORS[colorKeys[colorKey]];
	clientColors[ws.id] = color;
	ws.on('message', (msg) => {
		if(msg['req']) {
    	ws.send(gamePixels);
		} else {
			msg.split(',').forEach(function(i) {
				if (boardEntities[i]) {
					boardEntities[i].onClick(ws);
				}
				changedPixels[i] = clientColors[ws.id];
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
