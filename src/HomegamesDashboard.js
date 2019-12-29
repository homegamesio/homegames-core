const { fork } = require("child_process");
const path = require("path");

const { Asset, gameNode, Colors } = require("./common");

const games = require("./games");

const config = require("../config");

const sessions = {};

for (let i = config.GAME_SERVER_PORT_RANGE_MIN; i < config.GAME_SERVER_PORT_RANGE_MAX; i++) {
    sessions[i] = null;
}

const getServerPort = () => {
    for (const p in sessions) {
        if (!sessions[p]) {
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
                    "location": games[key].metadata().thumbnail || config.DEFAULT_GAME_THUMBNAIL,
                    "type": "image"
                });
            });

        this.base = gameNode(Colors.WHITE, null, {x: 0, y: 0}, {x: 100, y: 100});
        this.sessions = {};
        this.gameIds = {};
        this.requestCallbacks = {};
        this.requestIdCounter = 1;
        setInterval(this.heartbeat.bind(this), config.CHILD_SESSION_HEARTBEAT_INTERVAL);

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
        for (const key in games) {
            const activeSessions = Object.values(this.sessions).filter(s => s.game === key);

            const gameOption = gameNode(Colors.WHITE, (player) => {

                const sessionId = sessionIdCounter++;
                const port = getServerPort();

                const childSession = fork(path.join(__dirname, "child_game_server.js"));

                sessions[port] = childSession;

                childSession.send(JSON.stringify({
                    key,
                    port
                }));

                childSession.on("message", (thang) => {
                    const jsonMessage = JSON.parse(thang);
                    if (jsonMessage.success) {
                        player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
                    }
                    else if (jsonMessage.requestId) {
                        this.requestCallbacks[jsonMessage.requestId] && this.requestCallbacks[jsonMessage.requestId](jsonMessage.payload);
                    }
                });

                childSession.on("close", () => {
                    sessions[port] = null;
                    delete this.sessions[sessionId];
                    this.renderGameList();  
                });
                
                this.sessions[sessionId] = {
                    game: key,
                    port: port,
                    sendMessage: () => {
                    },
                    getPlayers: (cb) => {
                        const requestId = this.requestIdCounter++;
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

            }, {x: xIndex, y: 5}, {x: 10, y: 10}, {"text": (games[key].metadata && games[key].metadata().name || key) + "", x: xIndex + 5, y: 17}, {
                [key]: {
                    pos: {x: xIndex, y: 5},
                    size: {x: 10, y: 10}
                }
            });

            const authorInfoNode = gameNode(Colors.WHITE, null, {
                x: xIndex + 5, 
                y: 20
            },
            {
                x: 10,
                y: 10
            },
            {
                text: "by " + (games[key].metadata && games[key].metadata()["author"] || "Unknown Author"),
                x: xIndex + 5,
                y: 20
            });

            for (const sessionIndex in activeSessions) {
                const session = activeSessions[sessionIndex];
                const sessionNode = gameNode(Colors.BLUE, (player) => {
                    player.receiveUpdate([5, Math.floor(session.port / 100), Math.floor(session.port % 100)]);
                }, {x: xIndex + 3, y: 25 + (sessionIndex * 6)}, {x: 5, y: 5}, {"text": "session", x: xIndex + 3, y: 25 + (sessionIndex * 6)});
                this.base.addChild(sessionNode);
            }

            xIndex += 15;
            this.base.addChild(gameOption);
            this.base.addChild(authorInfoNode);
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
