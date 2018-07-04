const uuid = require('uuid/v4');
const WebSocket = require('ws');

const server = new WebSocket.Server({
	port: 8080
});

let width = 240;
let height = 135;
let gamePixels = new Uint8ClampedArray(width * height * 4);
for (let i = 0; i < gamePixels.length; i+=4) {
	gamePixels[i] = 255;
  gamePixels[i + 1] = 0;
  gamePixels[i + 2] = 0;
  gamePixels[i + 3] = 255;
}

server.on('connection', (ws) => {

	//connection.clientId = uuid();

  //let message = {
	//	"type": "id",
	//	"id": connection.clientId
	//};

	//clients[connection.clientId] = connection;
	
	ws.on('message', function(message) {
		ws.send(gamePixels.buffer);
		// TODO: parse type. for now, assume requesting pixel state
		//connection.send(JSON.stringify(gameState.buffer));
	});
});
