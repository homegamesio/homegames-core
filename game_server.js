const WebSocket = require('ws');

const server = new WebSocket.Server({
	port: 8080
});

let width = 128;
let height = 720;
let gamePixels = new Uint8ClampedArray(width * height * 4);

setInterval(function() {
	let newGamePixels = new Uint8ClampedArray(width * height * 4);
	
	for (let i = 0; i < gamePixels.length; i+=4) {
		newGamePixels[i] = Math.floor(Math.random() * 255);;
  	newGamePixels[i + 1] = Math.floor(Math.random() * 255);;
  	newGamePixels[i + 2] = Math.floor(Math.random() * 255);;
  	newGamePixels[i + 3] = 255;
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
