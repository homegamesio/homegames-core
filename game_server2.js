const WebSocket = require("ws");
const GameSession = require("./src/GameSession");
const Player = require("./src/Player");
const http = require("http");

const games = require('./src/games');

let playerId = 1;

process.on('message', (msg) => {
    console.log("message from parent");
    console.log(msg);
    sessionInfo = JSON.parse(msg);
    const gameInstance = new games[sessionInfo.key]();
    const server = http.createServer();
    const gameSession = new GameSession(gameInstance, {
        width: 320,
        height: 180
    });

    const wss = new WebSocket.Server({
        server  
    });

    wss.on("connection", (ws) => {
        function messageHandler(msg) {
            ws.removeListener('message', messageHandler);
            ws.id = playerId++;
            ws.send([ws.id]);
            const player = new Player(ws);
            gameSession.addPlayer(player);
        }

        ws.on('message', messageHandler);

        let thang =  Object.values(gameSession.players).map(p => {
            return {
                id: p.id,
                name: p.name || 'Name Here'
            }
        });

        ws.on('close', () => {
            console.log("this happens");
            gameSession.players[ws.id] && gameSession.players[ws.id].disconnect();
        });

        process.send(JSON.stringify({
            players: thang
        }));
    });

    server.listen(sessionInfo.port, null, null, () => {
        process.send(JSON.stringify({success: true}));
    });
});

