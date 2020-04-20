const HomegamesDashboard = require('./src/HomegamesDashboard');
const GameSession = require("./src/GameSession");
const { socketServer } = require('./src/util/socket');
const config = require('./config');
const ImageTest = require('./src/games/image-test');
const Homenames = require('./src/Homenames');

//const dashboard = new ImageTest();
const dashboard = new HomegamesDashboard();

const session = new GameSession(dashboard);

const homeNames = new Homenames(config.GAME_SERVER_HOME_PORT + 99);

session.initialize(() => {
    socketServer(session, config.GAME_SERVER_HOME_PORT);
});
