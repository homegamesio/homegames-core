const HomegamesDashboard = require('./src/HomegamesDashboard');
const clicker = require('./src/games/click-city');
const GameSession = require("./src/GameSession");
const { socketServer } = require('./src/util/socket');
const config = require('./config');
const Homenames = require('./src/Homenames');

//const dashboard = new HomegamesDashboard();
const dashboard = new clicker();

const session = new GameSession(dashboard);

const homeNames = new Homenames(config.HOMENAMES_PORT);

session.initialize(() => {
    socketServer(session, config.GAME_SERVER_HOME_PORT);
});
