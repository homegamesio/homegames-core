const { fork } = require('child_process');
const https = require('https');
const path = require('path');
const squishMap = require('./common/squish-map');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squishjs');
const unzipper = require('unzipper');
const fs = require('fs');

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

const serverPortMin = getConfigValue('GAME_SERVER_PORT_RANGE_MIN', 7002);
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

const gamesPerRow = 2;
const rowsPerPage = 2;
const containerWidth = 100;
const containerHeight = 90;

const gameContainerXMargin = 10;
const gameContainerYMargin = 10;

const gameLeftXMargin = 10;
const gameTopYMargin = 10; 

const gameContainerWidth = containerWidth - (2 * gameContainerXMargin);
const gameContainerHeight = containerHeight - (2 * gameContainerYMargin);

console.log("container height: " + gameContainerHeight);

const optionWidth = (gameContainerWidth - ((gamesPerRow - 1) * gameLeftXMargin)) / gamesPerRow;
const optionHeight = (gameContainerHeight - ((rowsPerPage - 1) * gameTopYMargin)) / rowsPerPage;

console.log("option is " + optionWidth + " wide, " + optionHeight + " high");

const DEFAULT_GAME_THUMBNAIL = getConfigValue('DEFAULT_GAME_THUMBNAIL', 'https://d3lgoy70hwd3pc.cloudfront.net/logo.png');
const CHILD_SESSION_HEARTBEAT_INTERVAL = getConfigValue('CHILD_SESSION_HEARTBEAT_INTERVAL', 250);

class HomegamesDashboard extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/layer-test.png'
        };
    }

    constructor() {
        super(1000);

        this.assets = {
            'default': new Asset('url', {
                'location': DEFAULT_GAME_THUMBNAIL,
                'type': 'image'
            }),
            'dashboardSong': new Asset('url', {
                'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/assets/testsong.mp3',
                type: 'audio'
            }),
            'logo': new Asset('url', {
                'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/homegames_logo_small.png',
                'type': 'image'
            }),
            'settings-gear': new Asset('url', {
                'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/settings_gear.png',
                'type': 'image'
            })
        };

        Object.keys(games).filter(k => games[k].metadata && games[k].metadata().thumbnail).forEach(key => {
            this.assets[key] = new Asset('url', {
                'location': games[key].metadata && games[key].metadata().thumbnail,
                'type': 'image'
            });
        });

        this.playerViews = {};

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000),
            fill: COLORS.WHITE
        });
        
        this.getPlane().addChildren(this.base);

        this.initializeGames(games);
        this.initializeSearch();
        this.downloadedGames = {};
        this.sessions = {};
        this.requestCallbacks = {};
        this.requestIdCounter = 1;

        // const baseSize = this.getBaseSize(games);

        // whiteBase.node.coordinates2d = ShapeUtils.rectangle(0, 0, baseSize, baseSize);
        // this.updatePlaneSize(baseSize);
    }

    initializeSearch() {
        // todo: connect to game service
    }

    onGameOptionClick(gameCollection, player, gameKey) {        
        this.showGameModal(gameCollection, player, gameKey);
    }

    startSession(player, gameKey, gameVersion = null) { 
        const sessionId = sessionIdCounter++;
        const port = getServerPort();

        if (this.downloadedGames[gameKey]) {
            this.downloadGame(gameKey, gameVersion).then(gamePath => {

                const childSession = fork(path.join(__dirname, 'child_game_server.js'));

                sessions[port] = childSession;

                childSession.send(JSON.stringify({
                    referenceSquishMap: this.referenceSquishMap,
                    key: gameKey,
                    gamePath,
                    port,
                    player: {
                        id: player.id,
                        name: player.name
                    }
                }));

                childSession.on('message', (thang) => {
                    if (thang.startsWith('{')) {
                        const jsonMessage = JSON.parse(thang);
                        if (jsonMessage.success) {
                            player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
                        }
                        else if (jsonMessage.requestId) {
                            this.requestCallbacks[jsonMessage.requestId] && this.requestCallbacks[jsonMessage.requestId](jsonMessage.payload);
                        }
                    } else {
                        console.log('message!');
                        console.log(message);
                    }
                });

                // const updateSessionInfo = () => {
                //     this.updateSessionInfo(sessionId);
                // };

                // const sessionInfoUpdateInterval = setInterval(updateSessionInfo, 5000); 

                // childSession.on('close', () => {
                //     clearInterval(sessionInfoUpdateInterval);
                //     sessions[port] = null;
                //     delete this.sessions[sessionId];
                // });

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
            });
        } else {

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

            // const updateSessionInfo = () => {
            //     this.updateSessionInfo(sessionId);
            // };

            // const sessionInfoUpdateInterval = setInterval(updateSessionInfo, 5000); 

            // childSession.on('close', () => {
            //     clearInterval(sessionInfoUpdateInterval);
            //     sessions[port] = null;
            //     delete this.sessions[sessionId];
            // });

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
        }

        //        this.renderGameList();
    }

    joinSession(player, session) {
        player.receiveUpdate([5, Math.floor(session.port / 100), Math.floor(session.port % 100)]);
    }

    showGameModal(gameCollection, player, gameKey) {
        const game = games[gameKey];
        const playerViewRoot = this.playerViews[player.id] && this.playerViews[player.id].root;

        const modalBase = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 95, 95),
            fill: COLORS.LIGHT_CORAL,
            shapeType: Shapes.POLYGON
        });

        const closeButton = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 10, 10),
            fill: COLORS.HARD_ORANGE_RED,
            shapeType: Shapes.POLYGON,
            onClick: (player) => {
                console.log('close');
                playerViewRoot.removeChild(modalBase.node.id);
            }
        });

        const closeX = new GameNode.Text({
            textInfo: {
                x: 7.5,
                y: 4.5,
                text: 'X',
                align: 'center',
                color: COLORS.WHITE,
                size: 3
            }
        });

        const assetKey = gameCollection[gameKey].metadata && gameCollection[gameKey].metadata().thumbnail ? gameKey : 'default';

        const imgCoords = [27.5, 12.5, 45, 45];
        const gameImage = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(imgCoords[0], imgCoords[1], imgCoords[2], imgCoords[3]),
            assetInfo: {
                [assetKey]: {
                    pos: {
                        x: imgCoords[0],
                        y: imgCoords[1]
                    },
                    size: {
                        x: imgCoords[2],
                        y: imgCoords[3]
                    }
                }
            }
        });

        const gameName = new GameNode.Text({
            textInfo: {
                text: assetKey,
                x: 50,
                y: 5,
                color: COLORS.WHITE,
                size: 1.5,
                align: 'center'
            }
        });

        const author = new GameNode.Text({
            textInfo: {
                text: gameCollection[gameKey].metadata && gameCollection[gameKey].metadata().author || 'Unknown author',
                x: 50,
                y: 9,
                color: COLORS.ALMOST_BLACK,
                size: 0.9,
                align: 'center'
            }
        });

        const description = new GameNode.Text({
            textInfo: {
                x: 27.5,
                y: 65,
                text: gameCollection[gameKey].metadata && gameCollection[gameKey].metadata().description || 'No description available',
                align: 'left',
                size: 0.6,
                color: COLORS.WHITE
            }
        });

        const sessionText = new GameNode.Text({
            textInfo: {
                x: 15,
                y: 17.5,
                text: 'Join an existing session',
                color: COLORS.WHITE,
                align: 'center',
                size: 1.2
            }
        });

        let yIndex = 22.5;

        let count = 0;
        const sessionList = Object.values(this.sessions).filter(session => {
            return session.game === gameKey;
        }).map(session => {
            const sessionNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(10, yIndex, 10, 8),
                fill: COLORS.GRAY,
                onClick: (player, x, y) => {
                    this.joinSession(player, session);
                }
            });

            const sessionText = new GameNode.Text({
                textInfo: {
                    x: 15,
                    y: yIndex + 3,
                    size: 0.8,
                    color: COLORS.WHITE,
                    align: 'center',
                    text: `Session ${session.id}`
                }
            });

            yIndex += 10;
            sessionNode.addChild(sessionText);
            return sessionNode;
        });

        const createButton = new GameNode.Shape({
            fill: COLORS.COOL_GREEN,
            coordinates2d: ShapeUtils.rectangle(75, 22.5, 20, 15),
            shapeType: Shapes.POLYGON,
            onClick: () => {
                this.startSession(player, gameKey)
            }
        });

        const createIcon = new GameNode.Text({
            textInfo: {
                color: COLORS.ALMOST_BLACK,
                x: 85, 
                y: 25,
                text: '\u1405',
                align: 'center',
                size: 5
            }
        });

        const createText = new GameNode.Text({
            textInfo: {
                x: 85,
                y: 17.5, 
                text: 'Create a session',
                color: COLORS.WHITE,
                size: 1.3,
                align: 'center'
            }
        });

        createButton.addChildren(createText, createIcon);

        closeButton.addChildren(closeX);

        sessionList.forEach(sessionNode => modalBase.addChild(sessionNode));
        modalBase.addChildren(closeButton, gameName, author, gameImage, description, sessionText, createButton);

        playerViewRoot.addChild(modalBase);
    }

    getAssets() {
        return this.assets;
    }

    initializeGames(gameCollection) {
        const gameCount = Object.keys(gameCollection).length;
        const pagesNeeded = Math.ceil(gameCount / (gamesPerRow * rowsPerPage));
        const baseSize = (gameContainerHeight + gameContainerYMargin) * pagesNeeded;

        this.base.node.coordinates2d = ShapeUtils.rectangle(0, 0, baseSize, baseSize);
        this.updatePlaneSize(baseSize);

        let index = 0;
        for (let game in gameCollection) {
            const realStartX = gameContainerXMargin + ( (optionWidth + gameLeftXMargin) * (index % gamesPerRow) );
            const startYIndex = (gameContainerYMargin) + gameTopYMargin;
            // hack
            const textHeight = 2.5;
            const realStartY = gameContainerYMargin + ( (optionHeight + gameTopYMargin) *  Math.floor(index / gamesPerRow) ) + textHeight;

            const gameOptionBase = new GameNode.Shape({
                onClick: (player, x, y) => {
                    this.onGameOptionClick(gameCollection, player, game);
                },
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    realStartX,//startIndex + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)),//gameContainerXMargin + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)), 
                    realStartY,//gameContainerYMargin + ((optionHeight + gameTopYMargin) * Math.floor(index / gamesPerRow)), 
                    optionWidth, 
                    optionHeight
                ),
                // fill: COLORS.CREAM//Colors.randomColor()
            });

            const assetKey = gameCollection[game].metadata && gameCollection[game].metadata().thumbnail ? game : 'default';

            const gameOption = new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    realStartX,//startIndex + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)),//gameContainerXMargin + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)), 
                    realStartY,//gameContainerYMargin + ((optionHeight + gameTopYMargin) * Math.floor(index / gamesPerRow)), 
                    optionWidth, 
                    optionHeight
                ),//ShapeUtils.rectangle(gamePos[0] + optionMarginX, gamePos[1] + optionMarginY, gameOptionSize.x, gameOptionSize.y),
                assetInfo: {
                    [assetKey]: {
                        pos: {
                            x: realStartX,//gamePos[0] + optionMarginX,
                            y: realStartY//gamePos[1] + optionMarginY
                        },
                        size: {
                            x: optionWidth,//(.8 * gameOptionSize.x),
                            y: optionHeight//(.8 * gameOptionSize.y)
                        }
                    }
                }
                // playerIds: [playerId]
            });

            const gameName = new GameNode.Text({
                textInfo: {
                    text: game,//'ayy lmao ' + realStartY,
                    x: realStartX + (optionWidth / 2),
                    y: realStartY - textHeight,
                    color: COLORS.HG_BLACK,
                    align: 'center',
                    size: 1.1
                }
            });

            gameOption.addChildren(gameOptionBase, gameName);

            this.base.addChild(gameOption);
            index++;   
        }
        // for (let colIndex = 0; colIndex < gamesPerRow; colIndex)
        // return pagesNeeded * pageSize;
    }

    // wtf    
    // updateSessionInfo(sessionId) {
    //     this.sessions[sessionId].getPlayers((players) => { 
    //         this.sessions[sessionId].players = players;
    //     });
    // }


    handleNewPlayer(player) {
        const playerView = {x: 0, y: 0, w: gameContainerWidth, h: gameContainerHeight};

        const playerGameViewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [player.id]
        });

        const uh = ViewUtils.getView(this.getPlane(), playerView, [player.id], {filter: (node) => node.node.id !== this.base.node.id, y: (100 - containerHeight)});

        playerGameViewRoot.addChild(uh);

        const playerNodeRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [player.id]
        });

        const playerSearchBox = new GameNode.Shape({
            shapeType: Shapes.POLYGON, 
            coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 95, 10),
            playerIds: [player.id],
            fill: COLORS.RED,
            onClick: (player, x, y) => {
                console.log('searched');
            }
        });

        const upArrow = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(90, 22.5, 10, 20),
            playerIds: [player.id],
            fill: COLORS.WHITE,
            onClick: (player, x, y) => {
                const currentView = this.playerViews[player.id].view;

                currentView.y -= gameContainerHeight + gameContainerYMargin;//40;

                if (currentView.y < 0) {
                    currentView.y = 0;
                }

                const newUh = ViewUtils.getView(this.getPlane(), currentView, [player.id], {filter: (node) => node.node.id !== this.base.node.id, y: (100 - containerHeight)});
                const playerViewRoot = this.playerViews[player.id] && this.playerViews[player.id].viewRoot;

                if (playerViewRoot) {
                    playerViewRoot.clearChildren();
                    playerViewRoot.addChild(newUh);
                }
            }
        });

        const upText = new GameNode.Text({
            textInfo: {
                x: 95,
                y: 27.5,
                align: 'center',
                size: 1.1,
                text: '\u25B2',
                color: COLORS.BLACK
            }
        });

        upArrow.addChild(upText);

        const downArrow = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(90, 72.5, 10, 20),
            playerIds: [player.id],
            fill: COLORS.WHITE,
            onClick: (player, x, y) => {
                const currentView = this.playerViews[player.id].view;

                currentView.y += gameContainerHeight + gameContainerYMargin;//40;

                // todo: check base size bound

                const newUh = ViewUtils.getView(this.getPlane(), currentView, [player.id], {filter: (node) => node.node.id !== this.base.node.id, y: (100 - containerHeight)});
                const playerViewRoot = this.playerViews[player.id] && this.playerViews[player.id].viewRoot;

                if (playerViewRoot) {
                    playerViewRoot.clearChildren();
                    playerViewRoot.addChild(newUh);
                }
            }
        });

        const downText = new GameNode.Text({
            textInfo: {
                x: 95,
                y: 77.5,
                align: 'center',
                size: 1.1,
                text: '\u25BC',
                color: COLORS.BLACK
            }
        });

        downArrow.addChild(downText);
        playerNodeRoot.addChild(playerGameViewRoot);
        playerNodeRoot.addChildren(playerSearchBox, upArrow, downArrow);

        this.playerViews[player.id] = {
            view: playerView,
            root: playerNodeRoot,
            viewRoot: playerGameViewRoot
        }

        this.getViewRoot().addChild(playerNodeRoot);
    }

    handlePlayerDisconnect(playerId) {
        const playerViewRoot = this.playerViews[playerId] && this.playerViews[playerId].root;
        if (playerViewRoot) {
            this.getViewRoot().removeChild(playerViewRoot.node.id);
        }
    }

}

module.exports = HomegamesDashboard;
