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

let width = 160;
let height = 90;
let gamePixels = new Uint8ClampedArray(width * height * 4);

setInterval(function() {
	let newGamePixels = new Uint8ClampedArray(width * height * 4);
	
	for (let i = 0; i < gamePixels.length; i+=4) {
		let colorKey = colorKeys[Math.floor(Math.random() * colorKeys.length)];
		newGamePixels[i] = COLORS[colorKey][0];
		newGamePixels[i + 1] = COLORS[colorKey][1];
		newGamePixels[i + 2] = COLORS[colorKey][2];
		newGamePixels[i + 3] = COLORS[colorKey][3];
	}
	gamePixels = newGamePixels;
}, 10);


setInterval(function() {
	server.clients.forEach(function(client) {
  	if (client.readyState === WebSocket.OPEN) {
    	client.send(gamePixels);
		}
	});
}, 16.67);

server.on('connection', (ws) => {
//	console.log("ws connection", ws);
});
