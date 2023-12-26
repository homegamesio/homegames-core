const https = require('https');
const GameSession = require('./GameSession');
const crypto = require('crypto');
const fs = require('fs');
const { socketServer } = require('./util/socket');
const { reportBug } = require('./common/util');

const process = require('process');

let lastMessage;
let gameSession;

const path = require('path');

const { log, getConfigValue, getAppDataPath } = require('homegames-common');

const ERROR_REPORTING_ENABLED = getConfigValue('ERROR_REPORTING', false);
const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);

const sendProcessMessage = (msg) => {
    process.send(JSON.stringify(msg));
};

const startServer = (sessionInfo) => {
    let gameInstance;

    log.info('Starting server with this info', sessionInfo);

    const addAsset = (key, asset) => new Promise((resolve, reject) => {
        gameSession.handleNewAsset(key, asset).then(resolve).catch(reject);
    });

    const appDataPath = getAppDataPath();
    
    process.env.SQUISH_PATH = require.resolve(`squish-${sessionInfo.squishVersion}`);

    try {
        log.info("THIS IS SESSION INFO");
        log.info(sessionInfo);
        
        if (sessionInfo.gamePath) {
            const _gameClass = require(sessionInfo.gamePath);
            let saveData;
            const savePath = crypto.createHash('md5').update(sessionInfo.gamePath).digest('hex');
    
            const existingGameSaveDataPath = path.join(path.join(appDataPath, '.save-data'), savePath);
    
            const saveGame = (data) => new Promise((resolve, reject) => {
                // lol. read parsed json to validate json
                const jsonData = JSON.stringify(JSON.parse(JSON.stringify(data)));
                fs.writeFileSync(existingGameSaveDataPath, jsonData);
            });

            if (fs.existsSync(existingGameSaveDataPath)) {
                try {
                    const stuff = fs.readFileSync(existingGameSaveDataPath);
                    saveData = JSON.parse(stuff);
                } catch (err) {
                    console.log("Error reading save data");
                    console.log(err);
                }
            }
            gameInstance = new _gameClass({ addAsset, saveGame, saveData });
        } else {
            gameInstance = new games[sessionInfo.key]({ addAsset });

        }
        gameSession = new GameSession(gameInstance, sessionInfo.port, sessionInfo.username);
    } catch (err) {
        log.error('Error instantiating game session', err);
        if (ERROR_REPORTING_ENABLED) {
            reportBug(`Exception: ${err.message} Stack: ${err.stack}`);
        }
    }

    if (gameSession) {

        gameSession.initialize(() => {
            socketServer(gameSession, sessionInfo.port, () => {
                sendProcessMessage({
                    'success': true
                });
            }, HTTPS_ENABLED ? sessionInfo.certPath : null, sessionInfo.username);
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

// short grace period of ten seconds to allow the first client to connect before checking heartbeat
setTimeout(() => {
    setInterval(checkPulse, 10 * 1000);
}, 2000);

