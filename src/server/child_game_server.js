const GameSession = require('../GameSession');
const { socketServer } = require('../util/socket');
const games = require('../games');
const process = require('process');

let lastMessage;
let gameSession;

const path = require('path');

const { getConfigValue } = require(`${path.resolve()}/src/util/config`);

const AUTH_DIR = getConfigValue('HG_AUTH_DIR', `${process.cwd()}/.hg_auth`);
const sendProcessMessage = (msg) => {
    process.send(JSON.stringify(msg));
};

const { guaranteeCerts, getLoginInfo, promptLogin, login, storeTokens, verifyAccessToken } = require('homegames-common');

const startServer = (sessionInfo) => {
    let gameInstance;

    let squishLib = require.resolve('squishjs');
	console.log('heolo');
	console.log(sessionInfo);

    if (sessionInfo.gamePath) {

        if (sessionInfo.referenceSquishMap) {
            console.log("I HAVE A CUSTOM SQUISH MAP!");
            process.env.STAGE = 'PRODUCTION';
            process.env.SQUISH_MAP = JSON.stringify(sessionInfo.referenceSquishMap);
        }

        const _gameClass = require(sessionInfo.gamePath);

        gameInstance = new _gameClass();
    } else {
        gameInstance = new games[sessionInfo.key]();
    }

    gameSession = new GameSession(gameInstance, sessionInfo.port);

    if (sessionInfo.certPath) {
            gameSession.initialize(() => {
                socketServer(gameSession, sessionInfo.port, () => {
                    sendProcessMessage({
                        'success': true
                    });
                },sessionInfo.certPath);
                });
    } else {
        gameSession.initialize(() => {
            socketServer(gameSession, sessionInfo.port, () => {
                sendProcessMessage({
                    'success': true
                });
            });
        });
    }
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
                    'payload': Object.values(gameSession.game.players).map(p => { return {'id': p.id, 'name': p.info.name}; }),
                    'requestId': message.requestId
                }));
            }
        }
    }
});

const checkPulse = () => {
    if (!gameSession || (Object.values(gameSession.game.players).length == 0 && Object.values(gameSession.spectators).length == 0) || !lastMessage || new Date() - lastMessage > 1000) {
        process.exit(0);
    }
};

// short grace period to allow the first client to connect before checking heartbeat
setTimeout(() => {
    setInterval(checkPulse, 500);
}, 5000);
