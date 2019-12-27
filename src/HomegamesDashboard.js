const { fork } = require("child_process");
const path = require("path");

const { Asset, gameNode, Colors } = require("./common");

const games = require("./games");

const config = require("../config");

const PORTS = {};

for (let i = config.GAME_SERVER_PORT_RANGE_MIN; i < config.GAME_SERVER_PORT_RANGE_MAX; i++) {
    PORTS[i] = false;
}

const generateServerPort = () => {
    for (let p in PORTS) {
        if (PORTS[p] === false) {
            PORTS[p] = true;
            return Number(p);
        }
    }
};

let sessionIdCounter = 1;

class HomegamesDashboard {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: "Joseph Garcia"
        };
    }

    constructor() {
        this.assets = {};
        Object.keys(games).filter(key => games[key].metadata)
            .forEach(key => {
                this.assets[key] = new Asset("url", {
                    "location": games[key].metadata().thumbnail || "https://i0.wp.com/www.palmbeachcountycta.org/wp-content/uploads/2017/10/website-construction-graphic-4.jpg",
                    "type": "image"
                });
            });

        this.base = gameNode(Colors.RED, null, {x: 0, y: 0}, {x: 100, y: 100});
        this.sessions = {};
        this.gameIds = {};
        this.requestCallbacks = {};
        this.requestIdCounter = 1;
        setInterval(this.heartbeat.bind(this), 2000);

        this.renderGameList();
    }

    heartbeat() {
        Object.values(this.sessions).forEach(session => {
            session.sendHeartbeat();
        });
    }
    
    renderGameList() {
        let xIndex = 5;
        this.base.clearChildren();
        for (let key in games) {
            let activeSessions = Object.values(this.sessions).filter(s => {
                return s.game === key;
            });

            let gameOption = gameNode(Colors.RED, (player) => {

                let sessionId = sessionIdCounter++;
                let port = generateServerPort();

                const childSession = fork(path.join(__dirname, "child_game_server.js"));

                childSession.send(JSON.stringify({
                    key,
                    port
                }));

                childSession.on("message", (thang) => {
                    let jsonMessage = JSON.parse(thang);
                    if (jsonMessage.success) {
                        player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
                    }
                    else if (jsonMessage.requestId) {
                        this.requestCallbacks[jsonMessage.requestId] && this.requestCallbacks[jsonMessage.requestId](jsonMessage.payload);
                    }
                });

                childSession.on("close", () => {
                    PORTS[port] = false;
                    delete this.sessions[sessionId];
                    this.renderGameList();  
                });
                
                this.sessions[sessionId] = {
                    game: key,
                    port: port,
                    sendMessage: () => {
                    },
                    getPlayers: (cb) => {
                        let requestId = this.requestIdCounter++;
                        if (cb) {
                            this.requestCallbacks[requestId] = cb;
                        }
                        childSession.send(JSON.stringify({
                            "api": "getPlayers",
                            "requestId": requestId
                        }));
                    },
                    sendHeartbeat: () => {
                        childSession.send(JSON.stringify({
                            "type": "heartbeat"
                        }));
                    }
                };
                 
                this.renderGameList();

            }, {x: xIndex, y: 5}, {x: 10, y: 10}, {"text": key + ": " + activeSessions.length + " sessions", x: xIndex + 5, y: 17}, {
                [key]: {
                    pos: {x: xIndex, y: 5},
                    size: {x: 10, y: 10}
                }
            });

            for (let sessionIndex in activeSessions) {
                const session = activeSessions[sessionIndex];
                let sessionNode = gameNode(Colors.BLUE, (player) => {
                    player.receiveUpdate([5, Math.floor(session.port / 100), Math.floor(session.port % 100)]);
                }, {x: xIndex, y: 20 + (sessionIndex * 6)}, {x: 5, y: 5}, {"text": "session", x: xIndex, y: 25 + (sessionIndex * 6)});
                this.base.addChild(sessionNode);
            }

            xIndex += 15;
            this.base.addChild(gameOption);
        }
    }

    logPlayerCount() {
    }

    handleNewPlayer() {
        this.logPlayerCount();
    }

    handlePlayerDisconnect() {
        this.logPlayerCount();
    }

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }
}

module.exports = HomegamesDashboard;
