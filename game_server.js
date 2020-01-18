const HomegamesDashboard = require('./src/HomegamesDashboard');
const PerfTest = require('./src/games/perf-test');
const GameSession = require("./src/GameSession");
const { socketServer } = require('./src/util/socket');
const config = require('./config');

const dashboard = new HomegamesDashboard();

const session = new GameSession(dashboard);

session.initialize(() => {
    socketServer(session, config.GAME_SERVER_HOME_PORT);
});
