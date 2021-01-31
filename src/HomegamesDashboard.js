const { fork } = require('child_process');
const path = require('path');
const squishMap = require('./common/squish-map');
const { Game, GameNode, Colors, Shapes, ShapeUtils } = squishMap['064'];

const COLORS = Colors.COLORS;

const Asset = require('./common/Asset');

const games = require('./games');

const sortedGameKeys = Object.keys(games).sort();

const { ExpiringSet, animations } = require('./common/util');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const serverPortMin = getConfigValue('GAME_SERVER_PORT_RANGE_MIN', 7001);
const serverPortMax = getConfigValue('GAME_SERVER_PORT_RANGE_MAX', 7099);

const sessions = {};

for (let i = serverPortMin; i <= serverPortMax; i++) {
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

const DASHBOARD_COLOR = [69, 100, 150, 255];
const orangeish = [246, 99, 4, 255];

const DEFAULT_GAME_THUMBNAIL = getConfigValue('DEFAULT_GAME_THUMBNAIL', 'https://d3lgoy70hwd3pc.cloudfront.net/logo.png');
const CHILD_SESSION_HEARTBEAT_INTERVAL = getConfigValue('CHILD_SESSION_HEARTBEAT_INTERVAL', 250);

class HomegamesDashboard extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '064',
            author: 'Joseph Garcia',
            tickRate: 10
        };
    }

    constructor() {
        super();
        this.assets = {
            'dashboardSong': new Asset('url', {
                'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/assets/testsong.mp3',
                type: 'audio'
            })
        };
        this.playerStates = {};

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
            'location': DEFAULT_GAME_THUMBNAIL,
            'type': 'image'
        });

        this.assets['logo'] = new Asset('url', {
            'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/homegames_logo_small.png',
            'type': 'image'
        });

        this.assets['settings-gear'] = new Asset('url', {
            'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/settings_gear.png',
            'type': 'image'
        });

        this.optionColor = [255, 149, 10, 255];
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON, 
            coordinates2d: [
                [0, 0],
                [100, 0],
                [100, 100],
                [0, 100],
                [0, 0]
            ],
            fill: COLORS.HG_BLACK 
        });

        this.speaker = new GameNode.Asset({
            assetInfo: {
                'dashboardSong': {
                    size: {
                        x: 0,
                        y: 0
                    },
                    pos: {
                        x: 0,
                        y: 0
                    }
                }
            },
            coordinates2d: []
        });

        this.base.addChild(this.speaker);

        this.screen = new GameNode.Shape({
            shapeType: Shapes.POLYGON, 
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: DASHBOARD_COLOR
        });
        
        this.base.addChild(this.screen);
        this.sessions = {};
        this.requestCallbacks = {};
        this.requestIdCounter = 1;
        setInterval(this.heartbeat.bind(this), CHILD_SESSION_HEARTBEAT_INTERVAL);
    }

    heartbeat() {
        Object.values(this.sessions).forEach(session => {
            session.sendHeartbeat();
        });
    }

    joinSession(player, session) {
        player.receiveUpdate([5, Math.floor(session.port / 100), Math.floor(session.port % 100)]);
    }

    spectateSession(player, session) {
        player.receiveUpdate([6, Math.floor(session.port / 100), Math.floor(session.port % 100)]);
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
        };

        const sessionInfoUpdateInterval = setInterval(updateSessionInfo, 5000); 

        childSession.on('close', () => {
            clearInterval(sessionInfoUpdateInterval);
            sessions[port] = null;
            delete this.sessions[sessionId];
        });

        childSession.on('error', (err) => {
            console.log('child session error');
            console.log(err);
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
        const modalColor = COLORS.HG_BLACK;//[12, 176, 80, 255];
        const fadeStart = [modalColor[0], modalColor[1], modalColor[2], 0];

        const createTextInfo = (text, x, y, size, align, color) => { 
            return {text, x, y, size, align, color };
        };

        const activeSessions = Object.values(this.sessions).filter(s => s.game === gameKey);
        const gameInfoModal = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(10, 10, 80, 80),
            color: fadeStart,
            fill: fadeStart,
            playerIds: [player.id],
            effects: {
                shadow: {
                    color: COLORS.HG_BLACK,
                    blur: 6
                }
            }
        });

        const gameMetadata = games[gameKey].metadata && games[gameKey].metadata() || {};

        const title = gameMetadata.title || gameKey;
        const author = gameMetadata.author || 'Unknown Author';
        const description = gameMetadata.description || 'No description available';
        const version = gameMetadata.version ? `Version ${gameMetadata.version}` : 'Unkown version';

        const titleNode = new GameNode.Text({
            textInfo: createTextInfo(title, 50, 12, 2.5, 'center', orangeish),
            playerIds: [player.id]
        });

        const authorNode = new GameNode.Text({
            textInfo: createTextInfo(`by ${author}`, 50, 20, 1.2, 'center', COLORS.WHITE),
            playerIds: [player.id]
        });

        const descriptionNode = new GameNode.Text({
            textInfo: createTextInfo(description, 50, 32, .8, 'center', COLORS.WHITE),
            playerIds: [player.id]
        });

        const versionText = new GameNode.Text({
            textInfo: createTextInfo(version, 50, 26, 1, 'center', COLORS.HG_YELLOW),
            playerIds: [player.id]
        });
 
        const createText = new GameNode.Text({
            textInfo: createTextInfo('Create a new session', 30, 61, 1.3, 'center', COLORS.BLACK),
            playerIds: [player.id]
        });

        const createButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(17.5, 45, 25, 35),
            fill: COLORS.HG_BLUE,
            playerIds: [player.id],
            onClick: (player) => {
                this.playerStates[player.id].root.removeChild(gameInfoModal.id);
                this.startSession(player, gameKey);
            }
        });

        gameInfoModal.addChildren(createButton, titleNode, authorNode, descriptionNode, createText, versionText);

        let sessionOptionY = 48;
        const sessionOptionX = 58;

        const sessionButtonHeight = 4;
        const sessionButtonWidth = 10;
        
        if (activeSessions.length > 0) {
            const joinText = new GameNode.Text({
                textInfo: createTextInfo('Current sessions', 70, 40, 1.3, 'center', COLORS.WHITE),
                playerIds: [player.id]
            });

            gameInfoModal.addChild(joinText);
        }

        activeSessions.forEach(s => {
            const joinSessionButton = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(sessionOptionX + 5, sessionOptionY - 1, sessionButtonWidth, sessionButtonHeight),
                fill: COLORS.WHITE,
                playerIds: [player.id],
                onClick: (player) => {
                    this.joinSession(player, s);
                }
            });

            const joinLabel = new GameNode.Text({
                textInfo: createTextInfo('Join', sessionOptionX + 5 + (sessionButtonWidth / 2), sessionOptionY - 1.6 + (sessionButtonHeight / 2), .9, 'center', COLORS.BLACK),
                playerIds: [player.id]
            });

            const spectateSessionButton = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(sessionOptionX + sessionButtonWidth + 2 + 5, sessionOptionY - 1, sessionButtonWidth, sessionButtonHeight),
                fill: COLORS.WHITE,
                playerIds: [player.id],
                onClick: (player) => {
                    this.spectateSession(player, s);
                }
            });

            const spectateLabel = new GameNode.Text({
                textInfo: createTextInfo('Spectate', sessionOptionX + 5 + sessionButtonWidth + 2 + (sessionButtonWidth / 2), sessionOptionY - 1.6 + (sessionButtonHeight / 2), .9, 'center', COLORS.BLACK),
                playerIds: [player.id]
            });

            const sessionText = new GameNode.Text({
                textInfo: createTextInfo(`Session ${s.id}`, sessionOptionX, sessionOptionY, 1, 'center', orangeish),
                playerIds: [player.id]
            });

            joinSessionButton.addChild(joinLabel);
            spectateSessionButton.addChild(spectateLabel);

            gameInfoModal.addChildren(sessionText, joinSessionButton, spectateSessionButton);

            sessionOptionY += sessionButtonHeight + 3;
        });

        const closeModalButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(11, 11, 6, 6),
            fill: COLORS.HG_RED,
            playerIds: [player.id],
            onClick: (player) => {
                delete this.modals[player.id];
                this.playerStates[player.id].root.removeChild(gameInfoModal.node.id);
            }
        });

        gameInfoModal.addChild(closeModalButton);

        animations.fadeIn(gameInfoModal, .6);
         
        this.playerStates[player.id].root.addChild(gameInfoModal);
    }
    
    renderGameList(playerId) {
        const playerRoot = this.playerStates[playerId].root;
        playerRoot.clearChildren();

        const gameOptionSize = {
            x: 20,
            y: 18
        };

        const gameOptionMargin = {
            x: 10,
            y: 10
        };
        const startX = 5;
        const startY = 5;

        const endX = 95;
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

        const barWrapper = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(95, 5, 3, 90),
            fill: DASHBOARD_COLOR,
            color: COLORS.HG_BLACK,
            border: 6,
            playerIds: [playerId],
            onClick: (player, x, y) => {
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
        });

        const currentScreen = this.playerStates[playerId].screen || 0;

        const startGameIndex = (gamesPerScreen * currentScreen);
        const endGameIndex = startGameIndex + gamesPerScreen;

        const barTopPadding = 5.6;
        const barStartY = (barHeight * currentScreen) + barTopPadding;

        const bar = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(95.4, barStartY, 2.2, barHeight),
            fill: COLORS.HG_BLACK,
            playerIds: [playerId]
        });

        barWrapper.addChild(bar);

        playerRoot.addChild(barWrapper);

        let gameIndex = 0;

        const gameKeys = sortedGameKeys.slice(startGameIndex, endGameIndex);
        for (const keyIndex in gameKeys) {
            const key = gameKeys[keyIndex];

            const assetKey = games[key].metadata && games[key].metadata().thumbnail ? key : 'default';
            const gamePos = indexToPos(gameIndex);

            const gameOptionWrapper = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: [
                    [gamePos[0], gamePos[1]],
                    [gamePos[0] + gameOptionSize.x, gamePos[1]],
                    [gamePos[0] + gameOptionSize.x, gamePos[1] + gameOptionSize.y],
                    [gamePos[0], gamePos[1] + gameOptionSize.y],
                    [gamePos[0], gamePos[1]]
                ],
                fill: COLORS.HG_BLACK,
                playerIds: [playerId],
                onClick: (player) => {
                    this.onGameOptionClick(player, key);
                }
            });

            const optionMarginX = gameOptionSize.x * .1;
            const optionMarginY = gameOptionSize.y * .05;

            const gameOption = new GameNode.Asset({
                onClick: (player) => {
                    this.onGameOptionClick(player, key);
                },
                coordinates2d: ShapeUtils.rectangle(gamePos[0] + optionMarginX, gamePos[1] + optionMarginY, gameOptionSize.x, gameOptionSize.y),
                assetInfo: {
                    [assetKey]: {
                        pos: {
                            x: gamePos[0] + optionMarginX,
                            y: gamePos[1] + optionMarginY
                        },
                        size: {
                            x: (.8 * gameOptionSize.x),
                            y: (.8 * gameOptionSize.y)
                        }
                    }
                },
                playerIds: [playerId]
            });

            gameOptionWrapper.addChild(gameOption);

            gameIndex++;

            const textThing = (games[key].metadata && games[key].metadata().name || key) + '';
            const gameOptionTitle = new GameNode.Text({
                textInfo: {
                    text: textThing, 
                    color: COLORS.BLACK,
                    align: 'center',
                    x: gamePos[0] + (gameOptionSize.x / 2), 
                    y: gamePos[1] + (1.1 * gameOptionSize.y),
                    size: 1
                }, 
                playerIds: [playerId]
            });

            gameOption.addChild(gameOptionTitle);

            playerRoot.addChild(gameOptionWrapper);
            //            this.base.addChild(authorInfoNode);
        }
    }

    isText(key) {
        return key.length == 1 && (key >= 'A' && key <= 'Z') || (key >= 'a' && key <= 'z') || key === ' ' || key === 'Backspace';
    }

    handleKeyDown(player, key) {
        return;
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
        const playerRootNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0]
            ],
            playerIds: [player.id]
        });

        this.base.addChild(playerRootNode);

        this.playerStates[player.id] = {
            screen: 0,
            root: playerRootNode
        };

        this.renderGameList(player.id);
    }

    handlePlayerDisconnect(playerId) {
        delete this.keyCoolDowns[playerId];
        const playerRoot = this.playerStates[playerId].root;
        this.base.removeChild(playerRoot.node.id);
    }

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }
}

module.exports = HomegamesDashboard;
