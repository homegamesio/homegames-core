const HomegamesDashboard = require('./src/HomegamesDashboard');
const GameSession = require("./src/GameSession");
const { socketServer } = require('./src/util/socket');
const config = require('./config');
const games = require('./src/games');

const dashboard = new HomegamesDashboard();

const session = new GameSession(dashboard);

socketServer(session, config.GAME_SERVER_HOME_PORT);
