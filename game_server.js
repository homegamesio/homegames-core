const GameSession = require('./src/GameSession');
const { socketServer } = require('./src/util/socket');
const Homenames = require('./src/Homenames');
const path = require('path');
const baseDir = path.dirname(require.main.filename);
// const viewtest = require('./src/games/view-test');

const { getConfigValue } = require('homegames-common');

const logger = require('./src/logger');

const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
const HOME_PORT = getConfigValue('HOME_PORT', 7001);

const server = (certPath, squishMap, username) => {
    logger.debug('running server');

    if (squishMap) {
        logger.debug('custom squish map');
        logger.debug(squishMap);
    }

    const startPathOverride = getConfigValue('START_PATH', null);

    const customStartModule = startPathOverride ? require(startPathOverride) : null;

    const HomegamesDashboard = require('./src/dashboard/HomegamesDashboard');

    // hack kind of. but homegames dashbaoard is special
    let session;

    console.log('certttt path');
    console.log(certPath);

    const dashboard = customStartModule ? new customStartModule({ 
        squishMap,
        addAsset: (key, asset) => new Promise((resolve, reject) => {
            // if (session) {
            session.handleNewAsset(key, asset).then(resolve).catch(reject);
            // }
        }),
        username,
        certPath
    }) : new HomegamesDashboard({ 
        squishMap, 
        movePlayer: (params) => {
            session && session.movePlayer(params);
        },
        addAsset: (key, asset) => new Promise((resolve, reject) => {
            // if (session) {
            session.handleNewAsset(key, asset).then(resolve).catch(reject);
            // }
        }),
        username,
        certPath
    });
    
    session = new GameSession(dashboard, HOME_PORT, username);
    
    const homeNames = new Homenames(HOMENAMES_PORT, certPath);
    
    session.initialize(() => {
        socketServer(session, HOME_PORT, null, certPath, username);
    });
};

module.exports = server;
