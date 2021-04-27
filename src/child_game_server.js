const GameSession = require('./GameSession');
const { socketServer } = require('./util/socket');
const games = require('./games');
const https = require('https');
const http = require('http');
const unzipper = require('unzipper');
const fs = require('fs');

let lastMessage;
let gameSession;

const path = require('path');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const getZip = (url, dir) => new Promise((resolve, reject) => {
    https.get(url, (_response) => {
        console.log('getting ' + url);
        console.log('to ' + dir);
	    const _s = _response.pipe(unzipper.Extract({ path: dir }));
            _s.on('finish', () => {
	        resolve(dir);
            });
	});
});

const getUrl = (url, headers = {}) => new Promise((resolve, reject) => {
    const getModule = url.startsWith('https') ? https : http;

    let responseData = '';

    getModule.get(url, { headers } , (res) => {
        const bufs = [];
        res.on('data', (chunk) => {
            bufs.push(chunk);
        });

        res.on('end', () => {
            if (res.statusCode > 199 && res.statusCode < 300) {
                resolve(Buffer.concat(bufs));
            } else {
                reject(Buffer.concat(bufs));
            }
        });
    }).on('error', error => {
        reject(error);
    });
 
});

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const process = require('process');

const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);
const CERT_PATH = getConfigValue('HG_CERT_PATH', `${process.cwd()}/.hg_certs`);
const GAME_PATH = getConfigValue('HG_GAME_PATH', `${process.cwd()}/.hg_games`);

const AUTH_DIR = getConfigValue('HG_AUTH_DIR', `${process.cwd()}/.hg_auth`);
const sendProcessMessage = (msg) => {
    process.send(JSON.stringify(msg));
};

const { guaranteeCerts, getLoginInfo, promptLogin, login, storeTokens, verifyAccessToken } = require('homegames-common');
const startServer = (sessionInfo) => {

//    const gamePaths = sessionInfo.gamePaths;

//    const gameRefs = {};
//
//    for (const key in gamePaths) {
//        console.log("KEYYY");
//        console.log(key);
//        gameRefs[key] = require(gamePaths[key]);        
//    }
//
//    console.log("GAME REFS");
//    console.log(gameRefs);
//

    if (games[sessionInfo.key]) {
        console.log(sessionInfo.key);
        const gameInstance = games[sessionInfo.key] ? new games[sessionInfo.key]() : new gameRefs[sessionInfo.key]();
        
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
    } else if (sessionInfo.games && sessionInfo.games[sessionInfo.key]) {
        console.log('dont know where this is');
        console.log(sessionInfo.games);
        console.log(sessionInfo.games[sessionInfo.key]);
        getUrl('https://landlord.homegames.io/games/' + sessionInfo.games[sessionInfo.key].id).then(_gameData => {
            console.log('game data');
            const gameData = JSON.parse(_gameData);
            console.log(gameData);
            const latestVersion = gameData.versions && gameData.versions[0];
            const latestLocation = latestVersion.location;
            const newDir = GAME_PATH + '/' + Date.now();
            getZip(latestLocation, newDir).then(() => {
                console.log('downloaded to ' + newDir);
                setTimeout(() => {
//                const stream = fs.createReadStream(newDir + '.zip');
//                const _s = stream.pipe(unzipper.Extract({
//                    path: newDir + 'out'
//                }));

//                _s.on('finish', () => {
//                    console.log('unzipped to ' + (newDir + 'out'));
//                });
                fs.readdir(newDir, (err, files) => {
                    console.log(err);
                    console.log(files);
                    console.log("looks like i have data in " + (newDir + '/' + files[0])); 
                    // todo: get squish version from game

                    const squishSource = require.resolve('homegames-common').split('homegames-common')[0];

                    console.log("OJSFDGDSFG");
                    console.log(squishSource);
                    const sourceNodeModules = squishSource//'/Users/josephgarcia/homegames/homegames-core/node_modules';
                    fs.symlink(sourceNodeModules, (newDir + '/' + files[0] + '/node_modules'), 'dir', (err) => {
                        console.log('created symlink!');
                        console.log(err);
                        const _game = require(newDir + '/' + files[0]);
                        const gameInstance = new _game();
        
                        gameSession = new GameSession(gameInstance, sessionInfo.port);
                        gameSession.initialize(() => {
                            socketServer(gameSession, sessionInfo.port, () => {
                                sendProcessMessage({
                                    'success': true
                                });
                            });
                        });
 

                    });
                });
                }, 1000);
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
}, 3000);
