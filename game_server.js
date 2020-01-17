const HomegamesDashboard = require('./src/HomegamesDashboard');
const GameSession = require("./src/GameSession");
const Squisher = require("./src/Squisher");
const { socketServer } = require('./src/util/socket');
const config = require('./config');

const dashboard = new HomegamesDashboard();

const squisher = new Squisher(dashboard);

const session = new GameSession(squisher);

session.initialize(() => {
    socketServer(session, config.GAME_SERVER_HOME_PORT);
});
