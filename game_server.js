const HomegamesDashboard = require('./src/HomegamesDashboard');
const PerfTest = require('./src/games/perf-test');
const GameSession = require("./src/GameSession");
const { socketServer } = require('./src/util/socket');
const config = require('./config');
const GameThing = require('./src/games/game-thing');

//const dashboard = new HomegamesDashboard();
const game = new GameThing();

const session = new GameSession(game);

session.initialize(() => {
    socketServer(session, config.GAME_SERVER_HOME_PORT);
});
