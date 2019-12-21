const WebSocket = require("ws");
const GameSession = require("./src/GameSession");
const Player = require("./src/Player");
const http = require("http");

const games = require('./src/games');

let playerId = 1;

let lastMessage;

let gameSession;

const startServer = (sessionInfo) => {
    const gameInstance = new games[sessionInfo.key]();
    const server = http.createServer();
    gameSession = new GameSession(gameInstance, {
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
            console.log("UHHHH");
        });

        process.send(JSON.stringify({
            players: thang
        }));
    });

    server.listen(sessionInfo.port, null, null, () => {
        process.send(JSON.stringify({success: true}));
    });
};

process.on('message', (msg) => {
    console.log("message from parent");
    console.log(msg);
    lastMessage = new Date();
    let message = JSON.parse(msg);
    if (message.key) {
        startServer(message);
    } else {
        console.log("AY AY");
        console.log(message);
        if (message.api) {
            if (message.api === 'getPlayers') {
                process.send(JSON.stringify({
                    'payload': Object.values(gameSession.players).map(p => { return {'ayy': 'lmao'}}),
                    'requestId': message.requestId
                }));
            }
        }
    }
});

const checkPulse = () => {
    console.log("should i live");
    console.log(Object.values(gameSession.players).length);
    if (Object.values(gameSession.players).length == 0 || !lastMessage || new Date() - lastMessage > 5000) {
        console.log("NO");
        process.exit(0);
    }
};

setInterval(checkPulse, 5000);
