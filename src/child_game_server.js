const GameSession = require('./GameSession');
const { socketServer } = require('./util/socket');
const games = require('./games');
const process = require('process');

let lastMessage;
let gameSession;

const path = require('path');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);


const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);
const CERT_PATH = getConfigValue('HG_CERT_PATH', `${process.cwd()}/.hg_certs`);

const AUTH_DIR = getConfigValue('HG_AUTH_DIR', `${process.cwd()}/.hg_auth`);
const sendProcessMessage = (msg) => {
    process.send(JSON.stringify(msg));
};

const { guaranteeCerts, getLoginInfo, promptLogin, login, storeTokens, verifyAccessToken } = require('homegames-common');

const startServer = (sessionInfo) => {
    let gameInstance;

    let squishLib = require.resolve('squishjs');

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

    if (HTTPS_ENABLED) {
        console.log('hello friend');
        console.log(CERT_PATH);
            console.log('hello friend 123');
 
            gameSession.initialize(() => {
                console.log('hello friend 123456');
                socketServer(gameSession, sessionInfo.port, () => {
                    console.log('hello friend 123456789');
                    sendProcessMessage({
                        'success': true
                    });
                }, {
                    certPath: `${CERT_PATH}/fullchain.pem`,
                    keyPath: `${CERT_PATH}/privkey.pem`
                    
                });
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

process.on('error', (err) => {
    console.log('error happened');
    console.log(err);
});

const checkPulse = () => {
    if (!gameSession || (Object.values(gameSession.game.players).length == 0 && Object.values(gameSession.spectators).length == 0) || !lastMessage || new Date() - lastMessage > 1000) {
        console.log('killing myself');
        // process.exit(0);
    }
};

// short grace period to allow the first client to connect before checking heartbeat
setTimeout(() => {
    setInterval(checkPulse, 500);
}, 5000);
