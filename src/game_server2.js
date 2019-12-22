const WebSocket = require("ws");
const GameSession = require("./GameSession");
const Player = require("./Player");
const http = require("http");
const { socketServer } = require('./util/socket');
const games = require('./games');

let playerId = 1;

let lastMessage;

let gameSession;

const startServer = (sessionInfo) => {
    const gameInstance = new games[sessionInfo.key]();
//    const server = http.createServer();
    
    gameSession = new GameSession(gameInstance, {
        width: 320,
        height: 180
    });
 
    socketServer(gameSession, sessionInfo.port, () => {
        process.send(JSON.stringify({
            "success": true
        }));
    });
//        let thang =  Object.values(gameSession.players).map(p => {
//            return {
//                id: p.id,
//                name: p.name || 'Name Here'
//            }
//        });
//
//        ws.on('close', () => {
//            //console.log("this happens");
//            //console.log("WSID");
//            //console.log(ws.id);
//            //console.log(gameSession.players);
//            //console.log(gameSession.players[ws.id]);
//            gameSession.players[ws.id] && gameSession.players[ws.id].disconnect();
//            //console.log("UHHHH");
//        });
//
//        process.send(JSON.stringify({
//            players: thang
//        }));
//    });
//
//    server.listen(sessionInfo.port, null, null, () => {
//        process.send(JSON.stringify({success: true}));
//    });
};

process.on('message', (msg) => {
    lastMessage = new Date();
    let message = JSON.parse(msg);
    if (message.key) {
        startServer(message);
    } else {
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
    if (!gameSession) {//|| Object.values(gameSession.players).length == 0 || !lastMessage || new Date() - lastMessage > 5000) {
        process.exit(0);
    }
};

setInterval(checkPulse, 5000);
