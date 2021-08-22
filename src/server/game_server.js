const HomegamesDashboard = require('../dashboard/HomegamesDashboard');
const GameSession = require('../GameSession');
const { socketServer } = require('../util/socket');
const Homenames = require('./Homenames');
const path = require('path');

const { getConfigValue } = require(`${path.resolve()}/src/util/config`);


const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
const GAME_SERVER_HOME_PORT = getConfigValue('GAME_SERVER_HOME_PORT', 7000);

const server = (certPath, squishMap) => {
    console.log('running server');

    if (squishMap) {
        console.log("custom squish map");
        console.log(squishMap);
    }

    const dashboard = new HomegamesDashboard(squishMap);
    
    const session = new GameSession(dashboard, GAME_SERVER_HOME_PORT);
    
    const homeNames = new Homenames(HOMENAMES_PORT);
    
    session.initialize(() => {
        socketServer(session, GAME_SERVER_HOME_PORT, null, certPath);
    });
};

module.exports = server;
