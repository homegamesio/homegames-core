const { fork } = require('child_process');
const path = require('path');
const { GameNode, Colors } = require('squishjs');

const Asset = require('./common/Asset');

const games = require('./games');
const Game = require('./games/Game');

const config = require('../config');

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

class HomegamesDashboard extends Game {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        this.assets = {};
        this.playerNodes = {};
        this.playerEditStates = {};
        this.keyCoolDowns = {};
        this.modals = {};
        Object.keys(games).filter(k => games[k].metadata && games[k].metadata().thumbnail).forEach(key => {
            this.assets[key] = new Asset('url', {
                'location': games[key].metadata && games[key].metadata().thumbnail,
                'type': 'image'
            });
        });

        this.assets['default'] = new Asset('url', {
            'location': config.DEFAULT_GAME_THUMBNAIL,
            'type': 'image'
        });

        this.base = GameNode(Colors.CREAM, null, {x: 0, y: 0}, {x: 100, y: 100});
        this.sessions = {};
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

    joinSession(player, session) {
        player.receiveUpdate([5, Math.floor(session.port / 100), Math.floor(session.port % 100)]);
    }

    updateSessionInfo(sessionId) {
        this.sessions[sessionId].getPlayers((players) => { 
            this.sessions[sessionId].players = players;
        });
    }

    startSession(player, gameKey) { 
        const sessionId = sessionIdCounter++;
        const port = getServerPort();

        const childSession = fork(path.join(__dirname, 'child_game_server.js'));

        sessions[port] = childSession;

        childSession.send(JSON.stringify({
            key: gameKey,
            port,
            player: {
                id: player.id,
                name: player.name
            }
        }));

        childSession.on('message', (thang) => {
            const jsonMessage = JSON.parse(thang);
            if (jsonMessage.success) {
                player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
            }
            else if (jsonMessage.requestId) {
                this.requestCallbacks[jsonMessage.requestId] && this.requestCallbacks[jsonMessage.requestId](jsonMessage.payload);
            }
        });

        const updateSessionInfo = () => {
            this.updateSessionInfo(sessionId);
        }

        const sessionInfoUpdateInterval = setInterval(updateSessionInfo, 5000); 

        childSession.on('close', () => {
            clearInterval(sesionInfoUpdateInterval);
            sessions[port] = null;
            delete this.sessions[sessionId];
            this.renderGameList();  
        });
        
        this.sessions[sessionId] = {
            id: sessionId,
            game: gameKey,
            port: port,
            sendMessage: () => {
            },
            getPlayers: (cb) => {
                const requestId = this.requestIdCounter++;
                if (cb) {
                    this.requestCallbacks[requestId] = cb;
                }
                childSession.send(JSON.stringify({
                    'api': 'getPlayers',
                    'requestId': requestId
                }));
            },
            sendHeartbeat: () => {
                childSession.send(JSON.stringify({
                    'type': 'heartbeat'
                }));
            },
            players: []
        };

        this.renderGameList();
    }
    
    renderGameList() {
        let xIndex = 5;
        let yIndex = 10;
        this.base.clearChildren();
        for (const key in games) {
            const activeSessions = Object.values(this.sessions).filter(s => s.game === key);

            const assetKey = games[key].metadata && games[key].metadata().thumbnail ? key : 'default';
            const gameOption = GameNode(Colors.CREAM, (player) => {

                const gameInfoModal = GameNode(Colors.ORANGE, (player) => {
                
                }, {x: 5, y: 5}, {x: 90, y: 90}, {text: key, x: 50, y: 10, size: 20}, null, player.id);
                
                const playButton = GameNode(Colors.GREEN, (player) => {
                
                    this.startSession(player, key);
                
                }, {x: 42.5, y: 25}, {x: 15, y: 10}, {text: 'Create Session', x: 50, y: 29, size: 18}, null, player.id);
                
                const otherSessionsText = activeSessions.length > 0 ? 'or join an existing session' : 'No current sessions';

                const orText = GameNode(Colors.ORANGE, null, {x: 45, y: 35}, {x: 0, y: 0}, {x: 50, y: 40, text: otherSessionsText, size: 18}, null, player.id);
                gameInfoModal.addChild(orText);
                gameInfoModal.addChild(playButton);

                let sessionOptionXIndex = 20;
                let sessionOptionYIndex = 50;
                activeSessions.forEach(s => {
                    const sessionOption = GameNode(Colors.WHITE, (player) => {
                        this.joinSession(player, s);
                    }, {x: sessionOptionXIndex, y: sessionOptionYIndex}, {x: 10, y: 10}, {text: 'Session ' + s.id + ': ' + s.players.length + ' players', x: sessionOptionXIndex + 3, y: sessionOptionYIndex + 3}, null, player.id);
                    gameInfoModal.addChild(sessionOption);
                    sessionOptionXIndex += 15;

                    if (sessionOptionXIndex >= 100) {
                        sessionOptionXIndex = 20;
                        sessionOptionYIndex += 15;
                    }
                });
                
                const closeModalButton = GameNode(Colors.ORANGE, (player) => {
                
                    delete this.modals[player.id];
                    
                    this.base.removeChild(gameInfoModal.id);
                
                }, {x: 6, y: 7}, {x: 4, y: 8}, {text: 'X', x: 8, y: 8, size: 60}, null, player.id);
                
                this.modals[player.id] = gameInfoModal;
                
                gameInfoModal.addChild(closeModalButton);
                
                this.base.addChild(gameInfoModal);

            }, {x: xIndex, y: yIndex}, {x: 10, y: 10}, {'text': (games[key].metadata && games[key].metadata().name || key) + '', x: xIndex + 5, y: yIndex + 12}, {
                [assetKey]: {
                    pos: {x: xIndex, y: yIndex},
                    size: {x: 10, y: 10}
                }
            });

            const authorInfoNode = GameNode(Colors.CREAM, null, {
                x: xIndex + 5, 
                y: yIndex + 15
            },
            {
                x: 10,
                y: 10
            },
            {
                text: 'by ' + (games[key].metadata && games[key].metadata()['author'] || 'Unknown Author'),
                x: xIndex + 5,
                y: yIndex + 15
            });

            xIndex += 15;

            if (xIndex + 10 >= 100) {
                yIndex += 25;
                xIndex = 5;
            }

            this.base.addChild(gameOption);
            this.base.addChild(authorInfoNode);
        }
    }

    isText(key) {
        return key.length == 1 && (key >= 'A' && key <= 'Z') || (key >= 'a' && key <= 'z') || key === ' ' || key === 'Backspace';
    }

    handleKeyDown(player, key) {
        if (!this.playerEditStates[player.id] || !this.isText(key)) {
            return;
        }

        if (!this.keyCoolDowns[player.id] || !this.keyCoolDowns[player.id][key]) {
            const newText = this.playerNodes[player.id].text;
            if (newText.text.length > 0 && key === 'Backspace') {
                newText.text = newText.text.substring(0, newText.text.length - 1); 
            } else if(key !== 'Backspace') {
                newText.text = newText.text + key;
            }
            this.playerNodes[player.id].text = newText;
            this.keyCoolDowns[player.id][key] = setTimeout(() => {
                clearTimeout(this.keyCoolDowns[player.id][key]);
                delete this.keyCoolDowns[player.id][key];
            }, 200);
        }
    }

    handleKeyUp(player, key) {
        if (this.keyCoolDowns[player.id][key]) {
            clearTimeout(this.keyCoolDowns[player.id][key]);
            delete this.keyCoolDowns[player.id][key];
        }
    }

    handleNewPlayer(player) {
        this.keyCoolDowns[player.id] = {};
        const playerNameNode = GameNode(Colors.CREAM, (player) => {
            this.playerEditStates[player.id] = !this.playerEditStates[player.id];
            playerNameNode.color = this.playerEditStates[player.id] ? Colors.WHITE : Colors.CREAM;
            if (!this.playerEditStates[player.id]) {
                player.name = this.playerNodes[player.id].text.text;
            }
        }, {x: 2, y: 2}, {x: 5, y: 5}, {text: player.name || 'dat boi', x: 5, y: 5}, null, player.id);
        this.playerNodes[player.id] = playerNameNode;
        this.base.addChild(playerNameNode);
    }

    handlePlayerDisconnect(playerId) {
        delete this.keyCoolDowns[playerId];

        if (this.playerNodes[playerId]) {
            this.base.removeChild(this.playerNodes[playerId].id);
            delete this.playerNodes[playerId];
        }
        if (this.modals[playerId]) {
            this.base.removeChild(this.modals[playerId].id);
            delete this.modals[playerId];
        }
    }

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }
}

module.exports = HomegamesDashboard;
