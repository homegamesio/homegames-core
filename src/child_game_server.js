const GameSession = require('./GameSession');
const { socketServer } = require('./util/socket');

const process = require('process');

let lastMessage;
let gameSession;

const path = require('path');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { log, getConfigValue } = require('homegames-common');

const sendProcessMessage = (msg) => {
    process.send(JSON.stringify(msg));
};

const startServer = (sessionInfo) => {
    let gameInstance;

    log.info('Starting server with this info', sessionInfo);

    console.log('thisisisisisisiis');

    const addAsset = (key, asset) => new Promise((resolve, reject) => {
        gameSession.handleNewAsset(key, asset).then(resolve).catch(reject);
    });

    if (sessionInfo.gamePath) {
        const _gameClass = require(sessionInfo.gamePath);

        gameInstance = new _gameClass({ addAsset });
    } else {
        gameInstance = new games[sessionInfo.key]({ addAsset });
    }

    gameSession = new GameSession(gameInstance, sessionInfo.port);

    gameSession.initialize(() => {
        socketServer(gameSession, sessionInfo.port, () => {
            sendProcessMessage({
                'success': true
            });
        });
    });

};

process.on('message', (msg) => {
    lastMessage = new Date();
    const message = JSON.parse(msg);
    if (message.key) {
        startServer(message);
    } else {
        if (message.api) {
            if (message.api === 'getPlayers') {
                process.send(JSON.stringify({
                    'payload': Object.values(gameSession.players).map(p => { return {'id': p.id, 'name': p.info.name}; }),
                    'requestId': message.requestId
                }));
            }
        }
    }
});

process.on('error', (err) => {
    log.error('error happened', err);
});

const checkPulse = () => {
    if (!gameSession || (Object.values(gameSession.players).length == 0 && Object.values(gameSession.spectators).length == 0) || !lastMessage || new Date() - lastMessage > 5000) {
        log.info('discontinuing myself');
        process.exit(0);
    }
};

// short grace period of two to allow the first client to connect before checking heartbeat
setTimeout(() => {
    setInterval(checkPulse, 500);
}, 2000);
