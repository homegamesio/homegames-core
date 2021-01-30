const GameSession = require('./GameSession');
const { socketServer } = require('./util/socket');
const games = require('./games');

let lastMessage;
let gameSession;

const path = require('path');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const process = require('process');

const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);
const CERT_PATH = getConfigValue('HG_CERT_PATH', `${process.cwd()}/.hg_certs`);

const AUTH_DIR = getConfigValue('HG_AUTH_DIR', `${process.cwd()}/.hg_auth`);
const sendProcessMessage = (msg) => {
    process.send(JSON.stringify(msg));
};

const { guaranteeCerts, getLoginInfo, promptLogin, login, storeTokens, verifyAccessToken } = require('homegames-common');
const startServer = (sessionInfo) => {
    const gameInstance = new games[sessionInfo.key]();
    
    gameSession = new GameSession(gameInstance);

    if (HTTPS_ENABLED) {
        guaranteeCerts(`${AUTH_DIR}/tokens.json`, CERT_PATH).then(certPaths => {
 
            gameSession.initialize(() => {
                socketServer(gameSession, sessionInfo.port, () => {
                    sendProcessMessage({
                        'success': true
                    });
                }, certPaths);
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
                    'payload': Object.values(gameSession.game.players).map(p => { return {'id': p.id, 'name': p.name}; }),
                    'requestId': message.requestId
                }));
            }
        }
    }
});

const checkPulse = () => {
    if (!gameSession || Object.values(gameSession.game.players).length == 0 || !lastMessage || new Date() - lastMessage > 1000) {
        process.exit(0);
    }
};

setInterval(checkPulse, 500);
