const HomegamesDashboard = require('./src/dashboard/HomegamesDashboard');
const GameSession = require('./src/GameSession');
const { socketServer } = require('./src/util/socket');
const Homenames = require('./src/Homenames');
const path = require('path');
const baseDir = path.dirname(require.main.filename);

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
const GAME_SERVER_HOME_PORT = getConfigValue('GAME_SERVER_HOME_PORT', 7001);

const server = (certPath, squishMap) => {
    console.log('running server');

    if (squishMap) {
        console.log("custom squish map");
        console.log(squishMap);
    }

    // hack kind of. but homegames dashbaoard is special
    let session;

    const dashboard = new HomegamesDashboard({ squishMap, movePlayer: (params) => {
        session && session.movePlayer(params);
    }});
    
    // const dashboard = new PlayerVisibilityTest();//new HomegamesDashboard(squishMap);
    
    // const dashboard = new LayerTest();//new HomegamesDashboard(squishMap);
    
    session = new GameSession(dashboard, GAME_SERVER_HOME_PORT);
    
    const homeNames = new Homenames(HOMENAMES_PORT);
    
    session.initialize(() => {
        socketServer(session, GAME_SERVER_HOME_PORT, null, certPath);
    });
};

module.exports = server;
