const { fork } = require('child_process');
const path = require('path');
const { Game, GameNode, Colors } = require('squishjs');

const Asset = require('./common/Asset');

const games = require('./games');

const { ExpiringSet, animations } = require('./common/util');

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
        this.playerPositions = {};
        this.gameListRoots = {};
        this.playerNodes = {};
        this.playerEditStates = {};
        this.keyCoolDowns = new ExpiringSet();
        this.modals = {};
        Object.keys(games).filter(k => games[k].metadata && games[k].metadata().thumbnail).forEach(key => {
            this.assets[key] = new Asset('url', {
                'location': games[key].metadata && games[key].metadata().thumbnail,
                'type': 'image'
            });
        });
        this.gameList = Object.values(games);

        this.assets['default'] = new Asset('url', {
            'location': config.DEFAULT_GAME_THUMBNAIL,
            'type': 'image'
        });

        this.assets['logo'] = new Asset('url', {
            'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/homegames_logo_small.png',
            'type': 'image'
        });

        this.baseColor = [45, 88, 173, 255];
        this.optionColor = [255, 149, 10, 255];
        this.base = GameNode(this.baseColor, null, {x: 0, y: 0}, {x: 100, y: 100});
        this.logoAsset = GameNode(this.baseColor, null, {x: 43, y: 5}, {x: 10, y: 10 * (16/9)}, null, {
            'default': {
                pos: {
                    x: 43, y: 2.5
                },
                size: {
                    x: 14, y: 13 * 1.42//(10 / 1.4) / 100
                }
            }
        });
 
        this.base.addChild(this.logoAsset);
        this.sessions = {};
        this.requestCallbacks = {};
        this.requestIdCounter = 1;
        setInterval(this.heartbeat.bind(this), config.CHILD_SESSION_HEARTBEAT_INTERVAL);
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
            clearInterval(sessionInfoUpdateInterval);
            sessions[port] = null;
            delete this.sessions[sessionId];
//            this.renderGameList();  
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

//        this.renderGameList();
    }
 
    onGameOptionClick(player, gameKey) {
        const modalColor = [12, 176, 80, 255];
        const fadeStart = [modalColor[0], modalColor[1], modalColor[2], 0];

        const activeSessions = Object.values(this.sessions).filter(s => s.game === gameKey);
        const gameInfoModal = GameNode(
            fadeStart,
            null, 
            {x: 15, y: 15}, 
            {x: 70, y: 70}, 
            {text: games[gameKey].metadata && games[gameKey].metadata().name || gameKey, x: 50, y: 18, size: 60}, 
            null, 
            player.id, 
            {
                shadow: {
                    color: Colors.BLACK,
                    blur: 6
                }
            }
        );

        const playButton = GameNode(
            [251, 255, 3, 0], 
            (player) => {
                this.startSession(player, gameKey);
            }, 
            {x: 20, y: 50}, 
            {x: 15, y: 15}, 
            {text: 'Create Session', x: 27.5, y: 56.5, size: 24}, 
            null, 
            player.id, 
            {
                shadow: {
                    color: Colors.BLACK,
                    blur: 6
                }
            }
        );
 
        const otherSessionsText = activeSessions.length > 0 ? 'or join an existing session' : 'No current sessions';

        const orText = GameNode(fadeStart, null, {x: 65, y: 35}, {x: 0, y: 0}, {x: 70, y: 45, text: otherSessionsText, size: 18}, null, player.id);

        const authorInfoNode = GameNode(
            fadeStart, 
            null, 
            {
                x: 50, 
                y: 20 
            },
            {
                x: 0,
                y: 0
            },
            {
                text: 'by ' + (games[gameKey].metadata && games[gameKey].metadata()['author'] || 'Unknown Author'),
                x: 50,
                y: 25,
                size: 40
            },
            null, 
            player.id
        );

        const descriptionNode = GameNode(
            fadeStart, 
            null, 
            {
                x: 50, 
                y: 30 
            },
            {
                x: 0,
                y: 0
            },
            {
                text: (games[gameKey].metadata && games[gameKey].metadata()['description'] || 'A description goes here'),
                x: 50,
                y: 35,
                size: 32
            },
            null, player.id
        )

        gameInfoModal.addChild(authorInfoNode);
        gameInfoModal.addChild(descriptionNode);

        gameInfoModal.addChild(orText);
        gameInfoModal.addChild(playButton);

        let sessionOptionXIndex = 57;
        let sessionOptionYIndex = 50;
        activeSessions.forEach(s => {
            const sessionOption = GameNode(
                [48, 183, 255, 255], 
                (player) => {
                    this.joinSession(player, s);
                }, 
                {x: sessionOptionXIndex, y: sessionOptionYIndex}, 
                {x: 25, y: 10}, 
                {text: 'Session ' + s.id + ': ' + s.players.length + ' players', x: sessionOptionXIndex * 1.2, y: sessionOptionYIndex + 3, size: 14}, 
                null, 
                player.id
            );

            gameInfoModal.addChild(sessionOption);
            sessionOptionXIndex += 15;

            if (sessionOptionXIndex >= 100) {
                sessionOptionXIndex = 70;
                sessionOptionYIndex += 15;
            }
        });
        
        const closeModalButton = GameNode([255, 255, 255, 0], (player) => {
        
            delete this.modals[player.id];
            
            this.base.removeChild(gameInfoModal.id);
        
        }, {x: 72, y: 17}, {x: 10, y: 10}, {text: 'Close', x: 77, y: 20, size: 50, color: Colors.BLACK}, null, player.id);
        
        this.modals[player.id] = gameInfoModal;

        gameInfoModal.addChild(closeModalButton);

        animations.fadeIn(closeModalButton, 5, 10);
        animations.fadeIn(descriptionNode, 5, 10);
        animations.fadeIn(authorInfoNode, 5, 10);
        animations.fadeIn(orText, 5, 10);
        animations.fadeIn(playButton, 5, 10);
        animations.fadeIn(gameInfoModal, 5, 10);
         
        this.base.addChild(gameInfoModal);
    }
    
    renderGameList(playerId) {
        this.gameListRoots[playerId].clearChildren();
        const barWrapper = GameNode(Colors.BLACK, null,
            {x: 94, y: 2},
            {x: 5, y: 96}, null, null, playerId);

        const barThing = GameNode(this.baseColor, (player, x, y) => {
            if (y >= (statusThing.pos.y + (.5 * statusThing.size.y))) {
                if (this.playerPositions[playerId] < Object.values(games).length / 3) {
                    this.playerPositions[playerId]++;
                    this.renderGameList(playerId);
                }
            } else {
                if (this.playerPositions[playerId] > 0) {
                    this.playerPositions[playerId]--;
                    this.renderGameList(playerId);
                }
            }
        }, {x: 94.5, y: 2.6}, {x: 4.1, y: 94.6}, null, null, playerId);

        const pageSize = 6;
        const barSize = pageSize / Object.values(games).length;

        const statusThing = GameNode(Colors.BLACK, null,
            {x: 95, y: 3 + Math.min((this.playerPositions[playerId] * barSize) * 94, 94.6 - (barSize * 94.6))},
            {x: 3, y: (barSize * 94.6)}, null, null, playerId);

        barThing.addChild(statusThing);
        barWrapper.addChild(barThing);
        this.gameListRoots[playerId].addChild(barWrapper);
        let xIndex = 5;
        let yIndex = 25;
        const optionWidth = 25;
        const optionHeight = 25;//# * (9/16);
        const optionPaddingX = 6;
        const optionPaddingY = 10;

        const startGameIndex = this.playerPositions[playerId] * 6;

        let gameIndex = 0;
        for (const key in games) {
            if (gameIndex < startGameIndex) {
                gameIndex++;
                continue;
            }
            const assetKey = games[key].metadata && games[key].metadata().thumbnail ? key : 'default';

            const gameOption = GameNode(
                this.optionColor, 
                (player) => this.onGameOptionClick(player, key), 
                {x: xIndex, y: yIndex}, 
                {x: optionWidth, y: optionHeight}, 
                {'text': (games[key].metadata && games[key].metadata().name || key) + '', x: xIndex + (optionWidth / 2), y: yIndex + optionHeight + 2, size: 40}, 
                {
                    [assetKey]: {
                        pos: {x: xIndex + (.02 * optionWidth), y: yIndex + (.02 * optionHeight)},
                        size: {x: optionWidth * .96, y: optionHeight * .96}
                    }
                }, 
                playerId, 
                {
                    shadow: {
                        color: Colors.BLACK,
                        blur: 6
                    }
                }
            );

            xIndex += optionWidth + optionPaddingX;

            if (xIndex + optionWidth >= 100) {
                yIndex += optionHeight + optionPaddingY;
                xIndex = 5;
            }

            this.gameListRoots[playerId].addChild(gameOption);
//            this.base.addChild(authorInfoNode);
        }
    }

    isText(key) {
        return key.length == 1 && (key >= 'A' && key <= 'Z') || (key >= 'a' && key <= 'z') || key === ' ' || key === 'Backspace';
    }

    handleKeyDown(player, key) {
        if (!this.playerEditStates[player.id] || !this.isText(key)) {
            return;
        }

        const keyCacheId = this.generateKeyCacheId(player, key);

        if (!this.keyCoolDowns.has(keyCacheId)) {
            const newText = this.playerNodes[player.id].text;
            if (newText.text.length > 0 && key === 'Backspace') {
                newText.text = newText.text.substring(0, newText.text.length - 1); 
            } else if(key !== 'Backspace') {
                newText.text = newText.text + key;
            }
            this.playerNodes[player.id].text = newText;
            this.keyCoolDowns.put(keyCacheId, 200);
        }
    }

    generateKeyCacheId(player, key) {
        return player.id + ' ' + key;
    }

    handleKeyUp(player, key) {
        const keyCacheId = this.generateKeyCacheId(player, key);

        if (this.keyCoolDowns.has(keyCacheId)) {
            this.keyCoolDowns.remove(keyCacheId);
        }
    }

    handleNewPlayer(player) {
        this.keyCoolDowns[player.id] = {};
//        const playerNameNode = GameNode(this.baseColor, (player) => {
//            this.playerEditStates[player.id] = !this.playerEditStates[player.id];
//            playerNameNode.color = this.playerEditStates[player.id] ? Colors.WHITE : this.baseColor;
//            if (!this.playerEditStates[player.id]) {
//                player.name = this.playerNodes[player.id].text.text;
//            }
//        }, {x: 2, y: 2}, {x: 5, y: 5}, {text: player.name || 'dat boi', x: 5, y: 5}, null, player.id);
//        this.playerNodes[player.id] = playerNameNode;
//        this.base.addChild(playerNameNode);
        this.gameListRoots[player.id] = GameNode(this.baseColor, null, {x: 0, y: 0}, {x: 0, y: 0});
        this.base.addChild(this.gameListRoots[player.id]);
        this.playerPositions[player.id] = 0;
        this.renderGameList(player.id);
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
        if (this.gameListRoots[playerId]) {
            this.base.removeChild(this.gameListRoots[playerId].id);
            delete this.gameListRoots[playerId];
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
