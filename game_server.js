#!/usr/bin/env/node

const HomegamesDashboard = require('./src/HomegamesDashboard');
const GameSession = require("./src/GameSession");
const { socketServer } = require('./src/util/socket');
const games = require('./src/games');

//const HOMEGAMES_PORT_RANGE_MIN = 7001;
//const HOMEGAMES_PORT_RANGE_MAX = 7100;

const dashboard = new HomegamesDashboard();

const session = new GameSession(dashboard, {
    "width": 320, 
    "height": 180
});

socketServer(session, 7000);
