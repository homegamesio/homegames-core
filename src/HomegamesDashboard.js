const { fork } = require('child_process');

const { Asset, gameNode, Colors, Deck } = require('./common');

const games = require('./games');

const WebSocket = require("ws");

const GameSession = require("./GameSession");
const Player = require("./Player");
const http = require("http");

const HOMEGAMES_PORT_RANGE_MIN = 7001;
const HOMEGAMES_PORT_RANGE_MAX = 7100;

const players = {};

for (let i = 1; i < 256; i++) {
    players[i] = false;
}

const generatePlayerId = () => {
    for (let k in players) {
        if (!players[k]) {
            return Number(k);
        }
    }

    throw new Error("no player IDs left in pool");
};

const PORTS = new Array();

for (let i = 7001; i < 7100; i++) {
    PORTS.push(i);
}

let portIndex = 0;

let sessionIdCounter = 1;

class HomegamesDashboard {
    constructor() {
        this.base = gameNode(Colors.RED, (player, x, y) => {
        }, {x: 0, y: 0}, {x: 100, y: 100});
        this.sessions = {};
        this.gameIds = {};
    //    setInterval(() => {
//            let emptySessionIds = Object.keys(this.sessions).filter(s => {
//                return Object.values(this.sessions[s].players).length === 0;
//            });
//
//            emptySessionIds.forEach(id => {
//                delete this.sessions[id];
//            });
//
//            if (emptySessionIds.length > 0) {
//                this.renderGameList();
//            }
//        }, 5000);

        this.renderGameList();

    }
    
    renderGameList() {
        let xIndex = 5;
        let sessionYIndex = 20;
        this.base.clearChildren();
        for (let key in games) {
            let gameOption = gameNode(Colors.BLACK, (player, x, y) => {
                let port = PORTS[portIndex++];
                console.log(port);

                const childSession = fork('game_server2.js');
                childSession.on('message', (msg) => {
                    player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
                });

                childSession.send(JSON.stringify({
                    key,
                    port
                }));
                
                console.log('spawned dat boi');

                this.sessions[sessionIdCounter++] = {
                    game: key,
                    port: port
                };
                 
                this.renderGameList();

            }, {x: xIndex, y: 0}, {x: 4, y: 4}, {'text': key, x: xIndex, y: 10});

            let activeSessions = Object.values(this.sessions).filter(s => {
                return s === key;
            });

            let gameInfoNode = gameNode(Colors.BLUE, null, {x: xIndex, y: 15}, {x: 4, y: 4}, {'text': activeSessions.length + ' sessions', x: xIndex, y: 15});

            this.base.addChild(gameInfoNode);

            for (let sessionIndex in activeSessions) {
                const session = activeSessions[sessionIndex];
                let sessionNode = gameNode(Colors.BLUE, (player, x, y) => {
                    player.receiveUpdate([5, Math.floor(session.hg_port / 100), Math.floor(session.hg_port % 100)]);
                }, {x: xIndex, y: 20 + (sessionIndex * 6)}, {x: 5, y: 5}, {'text': 'session', x: xIndex, y: 25 + (sessionIndex * 6)});
                this.base.addChild(sessionNode);
            }

            xIndex += 8;
            this.base.addChild(gameOption);
        }
    }

    handleNewPlayer(player) {
        console.log("new player?");
        console.log(Object.values(this.players).length);
    }

    handlePlayerDisconnect(player) {
        console.log("player left");
        console.log(Object.values(this.players).length);
    }

    getRoot() {
        return this.base;
    }
}

module.exports = HomegamesDashboard;
