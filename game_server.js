const HomegamesDashboard = require('./src/dashboard/HomegamesDashboard');
const GameSession = require('./src/GameSession');
const { socketServer } = require('./src/util/socket');
const Homenames = require('./src/Homenames');
const path = require('path');
const baseDir = path.dirname(require.main.filename);
// const viewtest = require('./src/games/view-test');

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const logger = require('./src/logger');

const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
const HOME_PORT = getConfigValue('HOME_PORT', 7001);

const server = (certPath, squishMap) => {
    logger.debug('running server');

    if (squishMap) {
        logger.debug('custom squish map');
        logger.debug(squishMap);
    }

    // hack kind of. but homegames dashbaoard is special
    let session;

    const dashboard = new HomegamesDashboard({ 
        squishMap, 
        movePlayer: (params) => {
            session && session.movePlayer(params);
        },
        addAsset: (key, asset) => new Promise((resolve, reject) => {
            // if (session) {
            session.handleNewAsset(key, asset).then(resolve).catch(reject);
            // }
        })
    });

    // const dashboard = new viewtest();

    // const dashboard = new PlayerVisibilityTest();//new HomegamesDashboard(squishMap);
    
    // const dashboard = new LayerTest();//new HomegamesDashboard(squishMap);
    
    session = new GameSession(dashboard, HOME_PORT);
    
    const homeNames = new Homenames(HOMENAMES_PORT);
    
    session.initialize(() => {
        socketServer(session, HOME_PORT, null, certPath);
    });
};

module.exports = server;
