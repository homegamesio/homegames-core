const { fork } = require('child_process');
const path = require('path');
const { Game, GameNode, Colors, Shapes } = require('squishjs');

const Asset = require('./common/Asset');

const games = require('./games');

const sortedGameKeys = Object.keys(games).sort();

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
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        this.assets = {};
        this.playerStates = {};
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

        this.assets['logo_horizontal'] = new Asset('url', {
            'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/logo_horizontal.png',
            'type': 'image'
        });

        this.assets['logo'] = new Asset('url', {
            'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/homegames_logo_small.png',
            'type': 'image'
        });

        this.optionColor = [255, 149, 10, 255];
        this.base = new GameNode.Shape(
            Colors.HG_YELLOW, 
            Shapes.POLYGON, 
            {
                coordinates2d: [
                    [0, 0],
                    [100, 0],
                    [100, 100],
                    [0, 100],
                    [0, 0]
                ]
            }
        );

        this.screen = new GameNode.Shape(
            [247, 247, 247, 255],
            Shapes.POLYGON, 
            {
                coordinates2d: [
                    [12.5, 2.5],
                    [87.5, 2.5],
                    [87.5, 97.5],
                    [12.5, 97.5],
                    [12.5, 2.5]
                ],
                fill: Colors.HG_BLUE
            }
        );
        
        this.logoAsset = new GameNode.Asset(
            null,
            [
                [43, 2.5],
                [57, 2.5],
                [57, 2.5 + (13 * 1.42)],
                [43, 2.5 + (13 * 1.42)],
                [43, 2.5],
            ],
            {
            'logo_horizontal': {
                pos: {
                    x: 40, y: 2
                },
                size: {
                    x: 20, y: 9 //(10 / 1.4) / 100
                }
                }
            }
        );
 
        this.screen.addChild(this.logoAsset);
        this.base.addChild(this.screen);
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
        const gameInfoModal = new GameNode.Shape(
            fadeStart,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [15, 15],
                    [70, 15],
                    [70, 70],
                    [15, 70],
                    [15, 15]
                ],
                fill: fadeStart
            },
            player.id,
            null,
//            {text: games[gameKey].metadata && games[gameKey].metadata().name || gameKey, x: 50, y: 18, size: 60}, 
            {
                shadow: {
                    color: Colors.HG_BLACK,
                    blur: 6
                }
            }
        );

        const playButton = new GameNode.Shape(
            [251, 255, 3, 0],
            Shapes.POLYGON,
            {
                coordinates2d: [

                ],
                fill: [251, 255, 3, 0]
            },
            player.id,
            (player) => {
                this.startSession(player, gameKey);
            },
            //{x: 20, y: 50}, 
            //{x: 15, y: 15}, 
            //{text: 'Create Session', x: 27.5, y: 56.5, size: 24}, 
            //null, 
            //player.id, 
            {
                shadow: {
                    color: Colors.BLACK,
                    blur: 6
                }
            }
        );

        const createSessionText = new GameNode.Text({
            text: 'Create Session',
            x: 27.5, 
            y: 56.5,
            size: 24
        });
 
        const otherSessionsText = activeSessions.length > 0 ? 'or join an existing session' : 'No current sessions';

//        const orText = GameNode(fadeStart, null, {x: 65, y: 35}, {x: 0, y: 0}, {x: 70, y: 45, text: otherSessionsText, size: 18}, null, player.id);
//
//        const authorInfoNode = GameNode(
//            fadeStart, 
//            null, 
//            {
//                x: 50, 
//                y: 20 
//            },
//            {
//                x: 0,
//                y: 0
//            },
//            {
//                text: 'by ' + (games[gameKey].metadata && games[gameKey].metadata()['author'] || 'Unknown Author'),
//                x: 50,
//                y: 25,
//                size: 40
//            },
//            null, 
//            player.id
//        );
//
//        const descriptionNode = GameNode(
//            fadeStart, 
//            null, 
//            {
//                x: 50, 
//                y: 30 
//            },
//            {
//                x: 0,
//                y: 0
//            },
//            {
//                text: (games[gameKey].metadata && games[gameKey].metadata()['description'] || 'A description goes here'),
//                x: 50,
//                y: 35,
//                size: 32
//            },
//            null, player.id
//        )

//        gameInfoModal.addChild(authorInfoNode);
//        gameInfoModal.addChild(descriptionNode);

//        gameInfoModal.addChild(orText);
        gameInfoModal.addChild(playButton);
        gameInfoModal.addChild(createSessionText);

        let sessionOptionXIndex = 57;
        let sessionOptionYIndex = 50;
        activeSessions.forEach(s => {
//            const sessionOption = GameNode(
//                [48, 183, 255, 255], 
//                (player) => {
//                    this.joinSession(player, s);
//                }, 
//                {x: sessionOptionXIndex, y: sessionOptionYIndex}, 
//                {x: 25, y: 10}, 
//                {text: 'Session ' + s.id + ': ' + s.players.length + ' players', x: sessionOptionXIndex * 1.2, y: sessionOptionYIndex + 3, size: 14}, 
//                null, 
//                player.id
//            );
//
//            gameInfoModal.addChild(sessionOption);
//            sessionOptionXIndex += 15;
//
//            if (sessionOptionXIndex >= 100) {
//                sessionOptionXIndex = 70;
//                sessionOptionYIndex += 15;
//            }
        });
        
//        const closeModalButton = GameNode([255, 255, 255, 0], (player) => {
        
//            delete this.modals[player.id];
//            
//            this.base.removeChild(gameInfoModal.id);
//        
//        }, {x: 72, y: 17}, {x: 10, y: 10}, {text: 'Close', x: 77, y: 20, size: 50, color: Colors.BLACK}, null, player.id);
        
        this.modals[player.id] = gameInfoModal;

//        gameInfoModal.addChild(closeModalButton);

//        animations.fadeIn(closeModalButton, 5, 10);
//        animations.fadeIn(descriptionNode, 5, 10);
//        animations.fadeIn(authorInfoNode, 5, 10);
//        animations.fadeIn(orText, 5, 10);
        animations.fadeIn(playButton.node, 5, 10);
        animations.fadeIn(gameInfoModal.node, 5, 10);
         
        this.base.addChild(gameInfoModal);
    }
    
    renderGameList(playerId) {
        this.gameListRoots[playerId].clearChildren();

        const gameOptionSize = {
            x: 18,
            y: 20
        };

        const gameOptionMargin = {
            x: 5,
            y: 16
        }
        const startX = 15;
        const startY = 20;

        const endX = 85;
        const endY = 95;

        const perRow = Math.floor((endX - startX) / (gameOptionSize.x + gameOptionMargin.x));
        const perCol = Math.floor((endY - startY) / (gameOptionSize.y + gameOptionMargin.y));

        const rowHeight = (gameOptionSize.y + gameOptionMargin.y);
        const colWidth = (gameOptionSize.x + gameOptionMargin.x);

        const indexToPos = (index) => {
            const rowNum = Math.floor(index / perRow);
            const colNum = index % perRow;
            return [startX + (colNum * colWidth), startY + (rowNum * rowHeight)];
        };

        const gamesPerScreen = perCol * perRow;

        const screens = Math.ceil(Object.keys(games).length / gamesPerScreen);
        const barHeight = 90 / screens;

        const barWrapper = new GameNode.Shape(
            Colors.HG_BLACK,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [83, 5],
                    [86, 5],
                    [86, 95],
                    [83, 95],
                    [83, 5]
                ],
                fill: Colors.HG_BLUE,
                border: 6
            },
            playerId,
            (player, x, y) => {
                const barTopY = bar.node.coordinates2d[0][1];
                if (y > barTopY && y < barTopY + barHeight) {
                    return;
                }
                else if (y < barTopY) {
                    this.playerStates[player.id].screen = this.playerStates[player.id].screen - 1;
                    this.renderGameList(player.id);
                } else {
                    this.playerStates[player.id].screen = this.playerStates[player.id].screen + 1;
                    this.renderGameList(player.id);
                }
            }
        );

        const currentScreen = this.playerStates[playerId].screen || 0;

        const startGameIndex = (gamesPerScreen * currentScreen);
        const endGameIndex = startGameIndex + gamesPerScreen;

        const barTopPadding = 5.6;
        const barStartY = (barHeight * currentScreen) + barTopPadding;

        const bar = new GameNode.Shape(
            Colors.HG_BLACK,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [83.4, barStartY],
                    [85.6, barStartY],
                    [85.6, barStartY + barHeight],
                    [83.4, barStartY + barHeight],
                    [83.4, barStartY]
                ],
                fill: Colors.HG_BLACK
            },
            playerId
        );

        barWrapper.addChild(bar);

        this.gameListRoots[playerId].addChild(barWrapper);

        let gameIndex = 0;

        const gameKeys = sortedGameKeys.slice(startGameIndex, endGameIndex);
        for (const keyIndex in gameKeys) {
            const key = gameKeys[keyIndex];

            const assetKey = games[key].metadata && games[key].metadata().thumbnail ? key : 'default';
            const gamePos = indexToPos(gameIndex);

            const gameOption = new GameNode.Asset(
                (player) => {
                    this.onGameOptionClick(player, key);
                },
                [
                    [gamePos[0], gamePos[1]],
                    [gamePos[0] + gameOptionSize.x, gamePos[1]],
                    [gamePos[0] + gameOptionSize.x, gamePos[1] + gameOptionSize.y],
                    [gamePos[0], gamePos[1] + gameOptionSize.y],
                    [gamePos[0], gamePos[1]]
                ],
                {
                    [assetKey]: {
                        pos: {
                            x: gamePos[0],
                            y: gamePos[1]
                        },
                        size: {
                            x: gameOptionSize.x,
                            y: gameOptionSize.y 
                        }
                    }
                }
            );

            gameIndex++;

            const textThing = (games[key].metadata && games[key].metadata().name || key) + '';
            const gameOptionTitle = new GameNode.Text({
                text: textThing, 
                x: gamePos[0] + (gameOptionSize.x / 2), 
                y: gamePos[1] + (1.1 * gameOptionSize.y),
                size: 24
            });

            gameOption.addChild(gameOptionTitle);

//            const gameOption = GameNode(
//                this.optionColor, 
//                (player) => this.onGameOptionClick(player, key), 
//                {x: xIndex, y: yIndex}, 
//                {x: optionWidth, y: optionHeight}, 
//                {'text': (games[key].metadata && games[key].metadata().name || key) + '', x: xIndex + (optionWidth / 2), y: yIndex + optionHeight + 2, size: 40}, 
//                {
//                    [assetKey]: {
//                        pos: {x: xIndex + (.02 * optionWidth), y: yIndex + (.02 * optionHeight)},
//                        size: {x: optionWidth * .96, y: optionHeight * .96}
//                    }
//                }, 
//                playerId, 
//                {
//                    shadow: {
//                        color: Colors.BLACK,
//                        blur: 6
//                    }
//                }
//            );

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
        this.gameListRoots[player.id] = new GameNode.Shape(
            Colors.HG_BLACK,
            Shapes.POLYGON,
            [
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0]
            ]
        );
        this.base.addChild(this.gameListRoots[player.id]);
        this.playerStates[player.id] = {
            screen: 0
        };
        this.renderGameList(player.id);
    }

    handlePlayerDisconnect(playerId) {
        delete this.keyCoolDowns[playerId];

        if (this.playerNodes[playerId]) {
            this.base.removeChild(this.playerNodes[playerId].node.id);
            delete this.playerNodes[playerId];
        }
        if (this.modals[playerId]) {
            this.base.removeChild(this.modals[playerId].node.id);
            delete this.modals[playerId];
        }
        if (this.gameListRoots[playerId]) {
            this.base.removeChild(this.gameListRoots[playerId].node.id);
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
