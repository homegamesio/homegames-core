const HomegamesDashboard = require('./src/HomegamesDashboard');
const GameSession = require("./src/GameSession");
const { socketServer } = require('./src/util/socket');
const config = require('./config');
const Homenames = require('./src/Homenames');
const PerfTest = require('./src/games/perf-test');
const PlayerVisibilityTest = require('./src/games/player-vis-test');

const dashboard = new PlayerVisibilityTest();//HomegamesDashboard();

const session = new GameSession(dashboard);

const homeNames = new Homenames(config.HOMENAMES_PORT);

session.initialize(() => {
    socketServer(session, config.GAME_SERVER_HOME_PORT);
});
