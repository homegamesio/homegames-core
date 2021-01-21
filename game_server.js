const HomegamesDashboard = require('./src/HomegamesDashboard');
const GameSession = require('./src/GameSession');
const { socketServer } = require('./src/util/socket');
const Homenames = require('./src/Homenames');
const path = require('path');
const baseDir = path.dirname(require.main.filename);

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
const GAME_SERVER_HOME_PORT = getConfigValue('GAME_SERVER_HOME_PORT', 7000);

const server = (certPath) => {
    console.log('running server');

    const dashboard = new HomegamesDashboard();
    
    const session = new GameSession(dashboard);
    
    const homeNames = new Homenames(HOMENAMES_PORT);
    
    session.initialize(() => {
        socketServer(session, GAME_SERVER_HOME_PORT, null, certPath);
    });
};

module.exports = server;
