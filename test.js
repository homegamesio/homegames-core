const assert = require("assert");
const { GameNode, Colors, squish, unsquish } = require('squishjs');
const Asset = require('./src/common/Asset');
const HomegamesDashboard = require('./src/HomegamesDashboard');
const { socketServer } = require('./src/util/socket');

const ASSET_TYPE = 1;

class Game {
    constructor() {
        this.players = {};
        this.listeners = new Set();
        this.root = null;
    }

    addPlayer(player) {
        this.players[player.id] = player;
    }

    removePlayer(playerId) {
        delete this.players[playerId];
    }

    addUpdateListener(listener) {
        this.listeners.add(listener);
    }

    getRoot() {
        return this.root;
    }

    initialize() {
        console.log("INITTING");
    }

    getAssets() {
        return null;
    }
}

class PerfTest extends Game {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: "Joseph Garcia"
        };
    }

    constructor() {
        super();
        this.base = GameNode(Colors.WHITE, (player) => {
        }, {"x": 0, "y": 0}, {"x": 100, "y": 100});

        this.imageTestNode = GameNode(Colors.WHITE, null, {x: 0, y: 0}, {x: 0, y: 0}, {text: "", x: 0, y: 0}, {"test": {pos: {x: 20, y: 20}, size: {x: 20, y: 20}}});

        this.base.addChild(this.imageTestNode);
       // let xCounter = 0;
       // let yCounter = 0;

       // const filler = setInterval(() => {
       //     let dot = gameNode(Colors.randomColor(), null, {x: xCounter, y: yCounter}, {x: 1, y: 1});
       //     this.base.addChild(dot);
       //     xCounter += 1;
       //     if (xCounter >= 100) {
       //         xCounter = 0;
       //         yCounter++;
       //     }

       //     if (yCounter == 100 && xCounter == 100) {
       //         clearInterval(filler);
       //     }

       // }, 2);
    }

    getAssets() {
        return {
            "test": new Asset("url", {
                "location": "https://www.nicepng.com/png/full/323-3239506_kanye-west-shrug-transparent.png",
                "type": "image"
            })
        }
    }

    getRoot() {
        return this.base;
    }
}

const Squisher = require("./src/Squisher");
const { fork } = require("child_process");
const path = require("path");

const games = require("./src/games");

const config = require("./config");

const GameSession = require("./src/GameSession");

const dashboard = new HomegamesDashboard();

const squisher = new Squisher(dashboard);

const session = new GameSession(squisher);

session.initialize(() => {
    socketServer(session, config.GAME_SERVER_HOME_PORT);
});

