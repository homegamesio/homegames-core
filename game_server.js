const HomegamesDashboard = require('./src/HomegamesDashboard');
const GameSession = require("./src/GameSession");
const { socketServer } = require('./src/util/socket');
const config = require('./config');
const Homenames = require('./src/Homenames');
const ClickCity = require('./src/games/click-city');
const Game42 = require('./src/games/game-42');

//const dashboard = new clickCity();//HomegamesDashboard();
//const dashboard = new HomegamesDashboard();
const dashboard = new Game42();

const session = new GameSession(dashboard);

const homeNames = new Homenames(config.HOMENAMES_PORT);

session.initialize(() => {
    socketServer(session, config.GAME_SERVER_HOME_PORT);
});
