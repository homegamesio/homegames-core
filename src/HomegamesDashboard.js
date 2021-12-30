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
const containerHeight = 75;
const gameContainerXMargin = 5;
const gameContainerYMargin = 0;
const gameLeftXMargin = 2.5; 
const gameTopYMargin = 2.5; 

const gameContainerWidth = containerWidth - (2 * gameContainerXMargin);
const gameContainerHeight = containerHeight - (2 * gameContainerYMargin);

const optionWidth = (gameContainerWidth - (2 * gameLeftXMargin)) / gamesPerRow;// - gameLeftXMargin);
const optionHeight = (gameContainerHeight - (2 * gameTopYMargin)) / rowsPerPage;//Math.floor((gameContainerHeight / rowsPerPage));// - gameLeftXMargin);

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

        this.playerViews = {};

        this.whiteBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000),
            fill: COLORS.WHITE
        });
        
        this.getPlane().addChildren(this.whiteBase);

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

    onGameOptionClick(player, gameKey) {        
        this.showGameModal(player, gameKey);
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

    showGameModal(player, gameKey) {
        const game = games[gameKey];
        const playerViewRoot = this.playerViews[player.id] && this.playerViews[player.id].root;

        const modalBase = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 95, 95),
            fill: COLORS.PURPLE,
            shapeType: Shapes.POLYGON
        });

        const closeButton = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 10, 10),
            fill: COLORS.RED,
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

        closeButton.addChildren(closeX);

        modalBase.addChildren(closeButton);

        playerViewRoot.addChild(modalBase);
    }

//     onGameOptionClick(player, gameKey) {
//         const modalColor = COLORS.HG_BLACK;//[12, 176, 80, 255];
//         //const fadeStart = [modalColor[0], modalColor[1], modalColor[2], 0];

//         const createTextInfo = (text, x, y, size, align, color) => { 
//             return {text, x, y, size, align, color };
//         };

//         const gameInfoModal = new GameNode.Shape({
//             shapeType: Shapes.POLYGON,
//             coordinates2d: ShapeUtils.rectangle(10, 10, 80, 80),
//             color: COLORS.HG_BLACK,
//             fill: COLORS.HG_BLACK,//fadeStart,
//             playerIds: [player.id],
//             effects: {
//                 shadow: {
//                     color: COLORS.HG_BLACK,
//                     blur: 6
//                 }
//             }
//         });

//         const renderStuff = (gameMetadata) => {
//             gameInfoModal.clearChildren();

//             const _playerState = this.playerStates[player.id];
//             if (!_playerState.selectedGameVersion) {
//                 this.playerStates[player.id].selectedGameVersion = {index: 0, data: gameMetadata.versions[0]};
//             }

//             const leftArrowBox = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(20, 25, 5, 10),
//                 fill: COLORS.WHITE,
//                 playerIds: [player.id],
//                 onClick: (_player, x, y) => {
//                     if (_playerState.selectedGameVersion.index + 1 >= gameMetadata.versions.length) {
//                         return;
//                     }

//                     this.playerStates[player.id].selectedGameVersion = {index: _playerState.selectedGameVersion.index + 1, data: gameMetadata.versions[_playerState.selectedGameVersion.index + 1]};
//                     renderStuff(gameMetadata);
//                 }
//             });

//             const leftArrowText = new GameNode.Text({
//                 textInfo: createTextInfo(`\u2190`, 22.5, 26.75, 2.5, 'center', orangeish),
//                 playerIds: [player.id],
//             });

//             leftArrowBox.addChild(leftArrowText);

//             const rightArrowBox = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(35, 25, 5, 10),
//                 fill: COLORS.WHITE,
//                 playerIds: [player.id],
//                 onClick: (_player, x, y) => {
//                     if (_playerState.selectedGameVersion.index - 1 < 0) {
//                         return;
//                     }

//                     this.playerStates[player.id].selectedGameVersion = {index: _playerState.selectedGameVersion.index - 1, data: gameMetadata.versions[_playerState.selectedGameVersion.index - 1]};
//                     renderStuff(gameMetadata);
//                 }
//             });

//             const rightArrowText = new GameNode.Text({
//                 textInfo: createTextInfo(`\u2192`, 37.5, 26.75, 2.5, 'center', orangeish),
//                 playerIds: [player.id],
//             });

//             rightArrowBox.addChild(rightArrowText);

//             const currentVersionText = new GameNode.Text({
//                 textInfo: createTextInfo(`Version ${this.playerStates[player.id].selectedGameVersion.data.version}`, 30, 27.5, 1.6, 'center', COLORS.HG_BLACK),
//                 playerIds: [player.id],
//             });

//             const gameVersionSelector = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(20, 25, 20, 10),
//                 fill: COLORS.WHITE,
//                 playerIds: [player.id]
//             });

//             gameVersionSelector.addChildren(leftArrowBox, rightArrowBox, currentVersionText);
//             gameInfoModal.addChild(gameVersionSelector);
//             const title = gameMetadata && gameMetadata.gameData.name || gameKey;
//             const author = gameMetadata && gameMetadata.gameData.author || 'Unknown Author';
//             const description = gameMetadata && gameMetadata.gameData.description || 'No description available';

//             const titleNode = new GameNode.Text({
//                 textInfo: createTextInfo(title, 50, 12, 2.5, 'center', orangeish),
//                 playerIds: [player.id]
//             });

//             const authorNode = new GameNode.Text({
//                 textInfo: createTextInfo(`by ${author}`, 50, 20, 1.2, 'center', COLORS.WHITE),
//                 playerIds: [player.id]
//             });

//             const descriptionLabel = new GameNode.Text({
//                 textInfo: createTextInfo('Description', 65, 25, 1.2, 'center', COLORS.HG_YELLOW),
//                 playerIds: [player.id]
//             });

//             const descriptionNode = new GameNode.Text({
//                 textInfo: createTextInfo(description, 55, 32, 1, 'center', COLORS.WHITE),
//                 playerIds: [player.id]
//             });
     
//             const createText = new GameNode.Text({
//                 textInfo: createTextInfo('Create a new session', 30, 61, 1.3, 'center', COLORS.BLACK),
//                 playerIds: [player.id]
//             });

//             const createButton = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(17.5, 45, 25, 35),
//                 fill: COLORS.HG_BLUE,
//                 playerIds: [player.id],
//                 onClick: (player) => {
//                     this.playerStates[player.id].root.removeChild(gameInfoModal.id);
//                     this.startSession(player, gameKey, this.playerStates[player.id].selectedGameVersion);
//                 }
//             });

//             gameInfoModal.addChildren(createButton, titleNode, authorNode, descriptionLabel, descriptionNode, createText);

//             let sessionOptionY = 48;
//             const sessionOptionX = 58;

//             const sessionButtonHeight = 4;
//             const sessionButtonWidth = 10;
//             const activeSessions = Object.values(this.sessions).filter(s => s.game === gameKey);

//             if (activeSessions.length > 0) {
//                 const joinText = new GameNode.Text({
//                     textInfo: createTextInfo('Current sessions', 70, 40, 1.3, 'center', COLORS.WHITE),
//                     playerIds: [player.id]
//                 });

//                 gameInfoModal.addChild(joinText);
//             }

//             activeSessions.forEach(s => {
//                 const joinSessionButton = new GameNode.Shape({
//                     shapeType: Shapes.POLYGON,
//                     coordinates2d: ShapeUtils.rectangle(sessionOptionX + 5, sessionOptionY - 1, sessionButtonWidth, sessionButtonHeight),
//                     fill: COLORS.WHITE,
//                     playerIds: [player.id],
//                     onClick: (player) => {
//                         this.joinSession(player, s);
//                     }
//                 });

//                 const joinLabel = new GameNode.Text({
//                     textInfo: createTextInfo('Join', sessionOptionX + 5 + (sessionButtonWidth / 2), sessionOptionY - 1.6 + (sessionButtonHeight / 2), .9, 'center', COLORS.BLACK),
//                     playerIds: [player.id]
//                 });

//                 const spectateSessionButton = new GameNode.Shape({
//                     shapeType: Shapes.POLYGON,
//                     coordinates2d: ShapeUtils.rectangle(sessionOptionX + sessionButtonWidth + 2 + 5, sessionOptionY - 1, sessionButtonWidth, sessionButtonHeight),
//                     fill: COLORS.WHITE,
//                     playerIds: [player.id],
//                     onClick: (player) => {
//                         this.spectateSession(player, s);
//                     }
//                 });

//                 const spectateLabel = new GameNode.Text({
//                     textInfo: createTextInfo('Spectate', sessionOptionX + 5 + sessionButtonWidth + 2 + (sessionButtonWidth / 2), sessionOptionY - 1.6 + (sessionButtonHeight / 2), .9, 'center', COLORS.BLACK),
//                     playerIds: [player.id]
//                 });

//                 const sessionText = new GameNode.Text({
//                     textInfo: createTextInfo(`Session ${s.id}`, sessionOptionX, sessionOptionY, 1, 'center', orangeish),
//                     playerIds: [player.id]
//                 });

//                 joinSessionButton.addChild(joinLabel);
//                 spectateSessionButton.addChild(spectateLabel);

//                 gameInfoModal.addChildren(sessionText, joinSessionButton, spectateSessionButton);

//                 sessionOptionY += sessionButtonHeight + 3;
//             });

//             const closeModalButton = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(11, 11, 6, 6),
//                 fill: COLORS.HG_RED,
//                 playerIds: [player.id],
//                 onClick: (player) => {
//                     delete this.modals[player.id];
//                     this.playerStates[player.id].root.removeChild(gameInfoModal.node.id);
//                 }
//             });

//             gameInfoModal.addChild(closeModalButton);

//             // animations.fadeIn(gameInfoModal, 1);
                         
//         };
//         const renderThing = (gameMetadata) => {
//             const title = gameMetadata.title || gameKey;
//             const author = gameMetadata.author || 'Unknown Author';
//             const description = gameMetadata.description || 'No description available';
//             const version = gameMetadata.version ? `Version ${gameMetadata.version}` : 'Unkown version';

//             const titleNode = new GameNode.Text({
//                 textInfo: createTextInfo(title, 50, 12, 2.5, 'center', orangeish),
//                 playerIds: [player.id]
//             });

//             const authorNode = new GameNode.Text({
//                 textInfo: createTextInfo(`by ${author}`, 50, 20, 1.2, 'center', COLORS.WHITE),
//                 playerIds: [player.id]
//             });

//             const descriptionNode = new GameNode.Text({
//                 textInfo: createTextInfo(description, 50, 32, .8, 'center', COLORS.WHITE),
//                 playerIds: [player.id]
//             });

//             const versionText = new GameNode.Text({
//                 textInfo: createTextInfo(version, 50, 26, 1, 'center', COLORS.HG_YELLOW),
//                 playerIds: [player.id]
//             });
     
//             const createText = new GameNode.Text({
//                 textInfo: createTextInfo('Create a new session', 30, 61, 1.3, 'center', COLORS.BLACK),
//                 playerIds: [player.id]
//             });

//             const createButton = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(17.5, 45, 25, 35),
//                 fill: COLORS.HG_BLUE,
//                 playerIds: [player.id],
//                 onClick: (player) => {
//                     this.playerStates[player.id].root.removeChild(gameInfoModal.id);
//                     this.startSession(player, gameKey);
//                 }
//             });

//             gameInfoModal.addChildren(createButton, titleNode, authorNode, descriptionNode, createText, versionText);

//             let sessionOptionY = 48;
//             const sessionOptionX = 58;

//             const sessionButtonHeight = 4;
//             const sessionButtonWidth = 10;

//             const activeSessions = Object.values(this.sessions).filter(s => s.game === gameKey);
            
//             if (activeSessions.length > 0) {
//                 const joinText = new GameNode.Text({
//                     textInfo: createTextInfo('Current sessions', 70, 40, 1.3, 'center', COLORS.WHITE),
//                     playerIds: [player.id]
//                 });

//                 gameInfoModal.addChild(joinText);
//             }

//             activeSessions.forEach(s => {
//                 const joinSessionButton = new GameNode.Shape({
//                     shapeType: Shapes.POLYGON,
//                     coordinates2d: ShapeUtils.rectangle(sessionOptionX + 5, sessionOptionY - 1, sessionButtonWidth, sessionButtonHeight),
//                     fill: COLORS.WHITE,
//                     playerIds: [player.id],
//                     onClick: (player) => {
//                         this.joinSession(player, s);
//                     }
//                 });

//                 const joinLabel = new GameNode.Text({
//                     textInfo: createTextInfo('Join', sessionOptionX + 5 + (sessionButtonWidth / 2), sessionOptionY - 1.6 + (sessionButtonHeight / 2), .9, 'center', COLORS.BLACK),
//                     playerIds: [player.id]
//                 });

//                 const spectateSessionButton = new GameNode.Shape({
//                     shapeType: Shapes.POLYGON,
//                     coordinates2d: ShapeUtils.rectangle(sessionOptionX + sessionButtonWidth + 2 + 5, sessionOptionY - 1, sessionButtonWidth, sessionButtonHeight),
//                     fill: COLORS.WHITE,
//                     playerIds: [player.id],
//                     onClick: (player) => {
//                         this.spectateSession(player, s);
//                     }
//                 });

//                 const spectateLabel = new GameNode.Text({
//                     textInfo: createTextInfo('Spectate', sessionOptionX + 5 + sessionButtonWidth + 2 + (sessionButtonWidth / 2), sessionOptionY - 1.6 + (sessionButtonHeight / 2), .9, 'center', COLORS.BLACK),
//                     playerIds: [player.id]
//                 });

//                 const sessionText = new GameNode.Text({
//                     textInfo: createTextInfo(`Session ${s.id}`, sessionOptionX, sessionOptionY, 1, 'center', orangeish),
//                     playerIds: [player.id]
//                 });

//                 joinSessionButton.addChild(joinLabel);
//                 spectateSessionButton.addChild(spectateLabel);

//                 gameInfoModal.addChildren(sessionText, joinSessionButton, spectateSessionButton);

//                 sessionOptionY += sessionButtonHeight + 3;
//             });

//             const closeModalButton = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(11, 11, 6, 6),
//                 fill: COLORS.HG_RED,
//                 playerIds: [player.id],
//                 onClick: (player) => {
//                     delete this.modals[player.id];
//                     this.playerStates[player.id].root.removeChild(gameInfoModal.node.id);
//                 }
//             });

//             gameInfoModal.addChild(closeModalButton);

//             // animations.fadeIn(gameInfoModal, .6);
//          }

//         this.playerStates[player.id].root.addChild(gameInfoModal);


//         let _gameMetadata;

//         if (this.downloadedGames[gameKey]) {
//             const gameData = this.downloadedGames[gameKey].gameData;

//             const versions = this.downloadedGames[gameKey].versions;

//             _gameMetadata = {
//                 title: gameData.name, 
//                 author: gameData.author, 
//                 description: gameData.description,
//                 version: versions[0] && versions[0].version
//             };
//             renderStuff(this.downloadedGames[gameKey]);//_gameMetadata);
//         } else {
//             _gameMetadata = games[gameKey].metadata && games[gameKey].metadata() || {};
//             renderThing(_gameMetadata);
//         }
        
//     }

    initializeGames(gameCollection) {
        const gameCount = Object.keys(gameCollection).length;
        const pagesNeeded = Math.ceil(gameCount / (gamesPerRow * rowsPerPage));
        const baseSize = containerHeight * pagesNeeded;

        this.whiteBase.node.coordinates2d = ShapeUtils.rectangle(0, 0, baseSize, baseSize);
        this.updatePlaneSize(baseSize);

        let index = 0;
        for (let game in gameCollection) {
            const realStartX = gameContainerXMargin + ( (optionWidth + gameLeftXMargin) * (index % gamesPerRow) );
            const startYIndex = (gameContainerYMargin) + gameTopYMargin;
            const realStartY = gameContainerYMargin + ( (optionHeight + gameTopYMargin) *  Math.floor(index / gamesPerRow) );

            const gameOption = new GameNode.Shape({
                onClick: (player, x, y) => {
                    this.onGameOptionClick(player, game);
                },
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    realStartX,//startIndex + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)),//gameContainerXMargin + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)), 
                    realStartY,//gameContainerYMargin + ((optionHeight + gameTopYMargin) * Math.floor(index / gamesPerRow)), 
                    optionWidth, 
                    optionHeight
                ),
                fill: COLORS.CREAM//Colors.randomColor()
            });

        // const closeX = new GameNode.Text({
        //     textInfo: {
        //         x: 7.5,
        //         y: 4.5,
        //         text: 'X',
        //         align: 'center',
        //         color: COLORS.WHITE,
        //         size: 3
        //     }
        // });
            const gameName = new GameNode.Text({
                textInfo: {
                    text: 'ayy lmao ' + realStartY,
                    x: realStartX + (optionWidth / 2),
                    y: realStartY + 10,
                    color: COLORS.HG_BLACK,
                    align: 'center',
                    size: 1
                }
            });

            gameOption.addChild(gameName);

            this.whiteBase.addChild(gameOption);
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

        // const playerView = {x: 0, y: 0, w: 100, h: 100};
        // const playerViewRoot = ViewUtils.getView(this.getPlane(), playerView, [player.id]);

        const playerView = {x: 0, y: 0, w: containerWidth, h: containerHeight};
        // const playerView = {x: 0, y: 0, w: containerWidth, h: 10};

        const playerGameViewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [player.id]
        });

        const uh = ViewUtils.getView(this.getPlane(), playerView, [player.id], {filter: (node) => node.node.id !== this.whiteBase.node.id, y: (100 - containerHeight)});

        playerGameViewRoot.addChild(uh);

        const playerNodeRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [player.id]
        });

        const playerSearchBox = new GameNode.Shape({
            shapeType: Shapes.POLYGON, 
            coordinates2d: ShapeUtils.rectangle(5, 5, 90, 10),
            playerIds: [player.id],
            fill: COLORS.RED,
            onClick: (player, x, y) => {
                console.log('searched');
            }
        });

        const playerViewBox = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(94.5, 19.5, 5, 80),
            playerIds: [player.id],
            fill: COLORS.BLUE,
            onClick: (player, x, y) => {
                const currentView = this.playerViews[player.id].view;

                // top half, move view up & vice versa
                if (y <= 49.75) {
                    currentView.y -= gameContainerHeight;//40;
                } else {
                    currentView.y += gameContainerHeight;//40;
                }

                if (currentView.y < 0) {
                    currentView.y = 0;
                }

                // console.log('dsdljkfsdfdsf');
                // console.log(currentView);
                const newUh = ViewUtils.getView(this.getPlane(), currentView, [player.id], {filter: (node) => node.node.id !== this.whiteBase.node.id, y: (100 - containerHeight)});
                const playerViewRoot = this.playerViews[player.id] && this.playerViews[player.id].viewRoot;

                if (playerViewRoot) {
                    playerViewRoot.clearChildren();
                    playerViewRoot.addChild(newUh);
                }

                // todo: manage these roots better
            }
        });

        playerNodeRoot.addChild(playerGameViewRoot);
        playerNodeRoot.addChildren(playerSearchBox, playerViewBox);

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

// class HomegamesDashboard extends Game {
//     static metadata() {

//         const _assets = {
//             'default': new Asset('url', {
//                 'location': DEFAULT_GAME_THUMBNAIL,
//                 'type': 'image'
//             }),
//             'dashboardSong': new Asset('url', {
//                 'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/assets/testsong.mp3',
//                 type: 'audio'
//             }),
//             'logo': new Asset('url', {
//                 'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/homegames_logo_small.png',
//                 'type': 'image'
//             }),
//             'settings-gear': new Asset('url', {
//                 'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/settings_gear.png',
//                 'type': 'image'
//             })
//         };

//         Object.keys(games).filter(k => games[k].metadata && games[k].metadata().thumbnail).forEach(key => {
//             _assets[key] = new Asset('url', {
//                 'location': games[key].metadata && games[key].metadata().thumbnail,
//                 'type': 'image'
//             });
//         });

//         return {
//             aspectRatio: {x: 16, y: 9},
//             // squishVersion: '0642',
//             author: 'Joseph Garcia', 
//             // tickRate: 10,
//             assets: _assets
//        };
//     }

//     constructor(referenceSquishMap) {
//         super();
//         console.log('i am a dashboard');

//         this.referenceSquishMap = referenceSquishMap;
        
//         this.playerStates = {};
//         this.downloadedGames = {};

//         this.keyCoolDowns = new ExpiringSet();
//         this.modals = {};

//         this.gameList = Object.values(games);

//         this.optionColor = [255, 149, 10, 255];
//         this.base = new GameNode.Shape({
//             shapeType: Shapes.POLYGON, 
//             coordinates2d: [
//                 [0, 0],
//                 [100, 0],
//                 [100, 100],
//                 [0, 100],
//                 [0, 0]
//             ],
//             fill: COLORS.HG_BLACK 
//         });

//        console.log('does this work');
//        // this.speaker = new GameNode.Asset({
//        //     assetInfo: {
//        //         'dashboardSong': {
//        //             size: {
//        //                 x: 0,
//        //                 y: 0
//        //             },
//        //             pos: {
//        //                 x: 0,
//        //                 y: 0
//        //             }
//        //         }
//        //     },
//        //     coordinates2d: []
//        // });

//        // this.base.addChild(this.speaker);

//        this.screen = new GameNode.Shape({
//            shapeType: Shapes.POLYGON, 
//            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
//            fill: DASHBOARD_COLOR
//        });
       
//        this.base.addChild(this.screen);
//        this.sessions = {};
//        this.requestCallbacks = {};
//        this.requestIdCounter = 1;
//        // setInterval(this.heartbeat.bind(this), CHILD_SESSION_HEARTBEAT_INTERVAL);
//     }

//     heartbeat() {
//         Object.values(this.sessions).forEach(session => {
//             session.sendHeartbeat();
//         });
//     }

//     joinSession(player, session) {
//         player.receiveUpdate([5, Math.floor(session.port / 100), Math.floor(session.port % 100)]);
//     }

//     spectateSession(player, session) {
//         player.receiveUpdate([6, Math.floor(session.port / 100), Math.floor(session.port % 100)]);
//     }

//     updateSessionInfo(sessionId) {
//         this.sessions[sessionId].getPlayers((players) => { 
//             this.sessions[sessionId].players = players;
//         });
//     }

//     downloadGame(gameId, gameVersion = null) {
//         return new Promise((resolve, reject) => {
//             console.log('downloaded game ' + gameId);

//             const version = gameVersion && gameVersion.data || this.downloadedGames[gameId].versions[0];
//             const gamePath = `${path.resolve('hg-games')}/${gameId}_${version.version}`;
//             https.get(version.location, (res) => {
//                 const stream = res.pipe(unzipper.Extract({
//                     path: gamePath
//                 }));

//                 stream.on('close', () => {
//                     fs.readdir(gamePath, (err, files) => {
//                         resolve(`${gamePath}/${files[0]}/index.js`);
//                     });
//                 });

//             });
//         });
//     }

//     startSession(player, gameKey, gameVersion = null) { 
//         const sessionId = sessionIdCounter++;
//         const port = getServerPort();

//         if (this.downloadedGames[gameKey]) {
//             this.downloadGame(gameKey, gameVersion).then(gamePath => {

//                 const childSession = fork(path.join(__dirname, 'child_game_server.js'));

//                 sessions[port] = childSession;

//                 childSession.send(JSON.stringify({
//                     referenceSquishMap: this.referenceSquishMap,
//                     key: gameKey,
//                     gamePath,
//                     port,
//                     player: {
//                         id: player.id,
//                         name: player.name
//                     }
//                 }));

//                 childSession.on('message', (thang) => {
//                     if (thang.startsWith('{')) {
//                         const jsonMessage = JSON.parse(thang);
//                         if (jsonMessage.success) {
//                             player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
//                         }
//                         else if (jsonMessage.requestId) {
//                             this.requestCallbacks[jsonMessage.requestId] && this.requestCallbacks[jsonMessage.requestId](jsonMessage.payload);
//                         }
//                     } else {
//                         console.log('message!');
//                         console.log(message);
//                     }
//                 });

//                 const updateSessionInfo = () => {
//                     this.updateSessionInfo(sessionId);
//                 };

//                 const sessionInfoUpdateInterval = setInterval(updateSessionInfo, 5000); 

//                 childSession.on('close', () => {
//                     clearInterval(sessionInfoUpdateInterval);
//                     sessions[port] = null;
//                     delete this.sessions[sessionId];
//                 });

//                 childSession.on('error', (err) => {
//                     console.log('child session error');
//                     console.log(err);
//                 });
                
//                 this.sessions[sessionId] = {
//                     id: sessionId,
//                     game: gameKey,
//                     port: port,
//                     sendMessage: () => {
//                     },
//                     getPlayers: (cb) => {
//                         const requestId = this.requestIdCounter++;
//                         if (cb) {
//                             this.requestCallbacks[requestId] = cb;
//                         }
//                         childSession.send(JSON.stringify({
//                             'api': 'getPlayers',
//                             'requestId': requestId
//                         }));
//                     },
//                     sendHeartbeat: () => {
//                         childSession.send(JSON.stringify({
//                             'type': 'heartbeat'
//                         }));
//                     },
//                     players: []
//                 };
//             });
//         } else {

//             const childSession = fork(path.join(__dirname, 'child_game_server.js'));

//             sessions[port] = childSession;

//             childSession.send(JSON.stringify({
//                 key: gameKey,
//                 port,
//                 player: {
//                     id: player.id,
//                     name: player.name
//                 }
//             }));

//             childSession.on('message', (thang) => {
//                 const jsonMessage = JSON.parse(thang);
//                 if (jsonMessage.success) {
//                     player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
//                 }
//                 else if (jsonMessage.requestId) {
//                     this.requestCallbacks[jsonMessage.requestId] && this.requestCallbacks[jsonMessage.requestId](jsonMessage.payload);
//                 }
//             });

//             const updateSessionInfo = () => {
//                 this.updateSessionInfo(sessionId);
//             };

//             const sessionInfoUpdateInterval = setInterval(updateSessionInfo, 5000); 

//             childSession.on('close', () => {
//                 clearInterval(sessionInfoUpdateInterval);
//                 sessions[port] = null;
//                 delete this.sessions[sessionId];
//             });

//             childSession.on('error', (err) => {
//                 console.log('child session error');
//                 console.log(err);
//             });
            
//             this.sessions[sessionId] = {
//                 id: sessionId,
//                 game: gameKey,
//                 port: port,
//                 sendMessage: () => {
//                 },
//                 getPlayers: (cb) => {
//                     const requestId = this.requestIdCounter++;
//                     if (cb) {
//                         this.requestCallbacks[requestId] = cb;
//                     }
//                     childSession.send(JSON.stringify({
//                         'api': 'getPlayers',
//                         'requestId': requestId
//                     }));
//                 },
//                 sendHeartbeat: () => {
//                     childSession.send(JSON.stringify({
//                         'type': 'heartbeat'
//                     }));
//                 },
//                 players: []
//             };
//         }

//         //        this.renderGameList();
//     }
 
//     onGameOptionClick(player, gameKey) {
//         const modalColor = COLORS.HG_BLACK;//[12, 176, 80, 255];
//         //const fadeStart = [modalColor[0], modalColor[1], modalColor[2], 0];

//         const createTextInfo = (text, x, y, size, align, color) => { 
//             return {text, x, y, size, align, color };
//         };

//         const gameInfoModal = new GameNode.Shape({
//             shapeType: Shapes.POLYGON,
//             coordinates2d: ShapeUtils.rectangle(10, 10, 80, 80),
//             color: COLORS.HG_BLACK,
//             fill: COLORS.HG_BLACK,//fadeStart,
//             playerIds: [player.id],
//             effects: {
//                 shadow: {
//                     color: COLORS.HG_BLACK,
//                     blur: 6
//                 }
//             }
//         });

//         const renderStuff = (gameMetadata) => {
//             gameInfoModal.clearChildren();

//             const _playerState = this.playerStates[player.id];
//             if (!_playerState.selectedGameVersion) {
//                 this.playerStates[player.id].selectedGameVersion = {index: 0, data: gameMetadata.versions[0]};
//             }

//             const leftArrowBox = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(20, 25, 5, 10),
//                 fill: COLORS.WHITE,
//                 playerIds: [player.id],
//                 onClick: (_player, x, y) => {
//                     if (_playerState.selectedGameVersion.index + 1 >= gameMetadata.versions.length) {
//                         return;
//                     }

//                     this.playerStates[player.id].selectedGameVersion = {index: _playerState.selectedGameVersion.index + 1, data: gameMetadata.versions[_playerState.selectedGameVersion.index + 1]};
//                     renderStuff(gameMetadata);
//                 }
//             });

//             const leftArrowText = new GameNode.Text({
//                 textInfo: createTextInfo(`\u2190`, 22.5, 26.75, 2.5, 'center', orangeish),
//                 playerIds: [player.id],
//             });

//             leftArrowBox.addChild(leftArrowText);

//             const rightArrowBox = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(35, 25, 5, 10),
//                 fill: COLORS.WHITE,
//                 playerIds: [player.id],
//                 onClick: (_player, x, y) => {
//                     if (_playerState.selectedGameVersion.index - 1 < 0) {
//                         return;
//                     }

//                     this.playerStates[player.id].selectedGameVersion = {index: _playerState.selectedGameVersion.index - 1, data: gameMetadata.versions[_playerState.selectedGameVersion.index - 1]};
//                     renderStuff(gameMetadata);
//                 }
//             });

//             const rightArrowText = new GameNode.Text({
//                 textInfo: createTextInfo(`\u2192`, 37.5, 26.75, 2.5, 'center', orangeish),
//                 playerIds: [player.id],
//             });

//             rightArrowBox.addChild(rightArrowText);

//             const currentVersionText = new GameNode.Text({
//                 textInfo: createTextInfo(`Version ${this.playerStates[player.id].selectedGameVersion.data.version}`, 30, 27.5, 1.6, 'center', COLORS.HG_BLACK),
//                 playerIds: [player.id],
//             });

//             const gameVersionSelector = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(20, 25, 20, 10),
//                 fill: COLORS.WHITE,
//                 playerIds: [player.id]
//             });

//             gameVersionSelector.addChildren(leftArrowBox, rightArrowBox, currentVersionText);
//             gameInfoModal.addChild(gameVersionSelector);
//             const title = gameMetadata && gameMetadata.gameData.name || gameKey;
//             const author = gameMetadata && gameMetadata.gameData.author || 'Unknown Author';
//             const description = gameMetadata && gameMetadata.gameData.description || 'No description available';

//             const titleNode = new GameNode.Text({
//                 textInfo: createTextInfo(title, 50, 12, 2.5, 'center', orangeish),
//                 playerIds: [player.id]
//             });

//             const authorNode = new GameNode.Text({
//                 textInfo: createTextInfo(`by ${author}`, 50, 20, 1.2, 'center', COLORS.WHITE),
//                 playerIds: [player.id]
//             });

//             const descriptionLabel = new GameNode.Text({
//                 textInfo: createTextInfo('Description', 65, 25, 1.2, 'center', COLORS.HG_YELLOW),
//                 playerIds: [player.id]
//             });

//             const descriptionNode = new GameNode.Text({
//                 textInfo: createTextInfo(description, 55, 32, 1, 'center', COLORS.WHITE),
//                 playerIds: [player.id]
//             });
     
//             const createText = new GameNode.Text({
//                 textInfo: createTextInfo('Create a new session', 30, 61, 1.3, 'center', COLORS.BLACK),
//                 playerIds: [player.id]
//             });

//             const createButton = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(17.5, 45, 25, 35),
//                 fill: COLORS.HG_BLUE,
//                 playerIds: [player.id],
//                 onClick: (player) => {
//                     this.playerStates[player.id].root.removeChild(gameInfoModal.id);
//                     this.startSession(player, gameKey, this.playerStates[player.id].selectedGameVersion);
//                 }
//             });

//             gameInfoModal.addChildren(createButton, titleNode, authorNode, descriptionLabel, descriptionNode, createText);

//             let sessionOptionY = 48;
//             const sessionOptionX = 58;

//             const sessionButtonHeight = 4;
//             const sessionButtonWidth = 10;
//             const activeSessions = Object.values(this.sessions).filter(s => s.game === gameKey);

//             if (activeSessions.length > 0) {
//                 const joinText = new GameNode.Text({
//                     textInfo: createTextInfo('Current sessions', 70, 40, 1.3, 'center', COLORS.WHITE),
//                     playerIds: [player.id]
//                 });

//                 gameInfoModal.addChild(joinText);
//             }

//             activeSessions.forEach(s => {
//                 const joinSessionButton = new GameNode.Shape({
//                     shapeType: Shapes.POLYGON,
//                     coordinates2d: ShapeUtils.rectangle(sessionOptionX + 5, sessionOptionY - 1, sessionButtonWidth, sessionButtonHeight),
//                     fill: COLORS.WHITE,
//                     playerIds: [player.id],
//                     onClick: (player) => {
//                         this.joinSession(player, s);
//                     }
//                 });

//                 const joinLabel = new GameNode.Text({
//                     textInfo: createTextInfo('Join', sessionOptionX + 5 + (sessionButtonWidth / 2), sessionOptionY - 1.6 + (sessionButtonHeight / 2), .9, 'center', COLORS.BLACK),
//                     playerIds: [player.id]
//                 });

//                 const spectateSessionButton = new GameNode.Shape({
//                     shapeType: Shapes.POLYGON,
//                     coordinates2d: ShapeUtils.rectangle(sessionOptionX + sessionButtonWidth + 2 + 5, sessionOptionY - 1, sessionButtonWidth, sessionButtonHeight),
//                     fill: COLORS.WHITE,
//                     playerIds: [player.id],
//                     onClick: (player) => {
//                         this.spectateSession(player, s);
//                     }
//                 });

//                 const spectateLabel = new GameNode.Text({
//                     textInfo: createTextInfo('Spectate', sessionOptionX + 5 + sessionButtonWidth + 2 + (sessionButtonWidth / 2), sessionOptionY - 1.6 + (sessionButtonHeight / 2), .9, 'center', COLORS.BLACK),
//                     playerIds: [player.id]
//                 });

//                 const sessionText = new GameNode.Text({
//                     textInfo: createTextInfo(`Session ${s.id}`, sessionOptionX, sessionOptionY, 1, 'center', orangeish),
//                     playerIds: [player.id]
//                 });

//                 joinSessionButton.addChild(joinLabel);
//                 spectateSessionButton.addChild(spectateLabel);

//                 gameInfoModal.addChildren(sessionText, joinSessionButton, spectateSessionButton);

//                 sessionOptionY += sessionButtonHeight + 3;
//             });

//             const closeModalButton = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(11, 11, 6, 6),
//                 fill: COLORS.HG_RED,
//                 playerIds: [player.id],
//                 onClick: (player) => {
//                     delete this.modals[player.id];
//                     this.playerStates[player.id].root.removeChild(gameInfoModal.node.id);
//                 }
//             });

//             gameInfoModal.addChild(closeModalButton);

//             // animations.fadeIn(gameInfoModal, 1);
                         
//         };
//         const renderThing = (gameMetadata) => {
//             const title = gameMetadata.title || gameKey;
//             const author = gameMetadata.author || 'Unknown Author';
//             const description = gameMetadata.description || 'No description available';
//             const version = gameMetadata.version ? `Version ${gameMetadata.version}` : 'Unkown version';

//             const titleNode = new GameNode.Text({
//                 textInfo: createTextInfo(title, 50, 12, 2.5, 'center', orangeish),
//                 playerIds: [player.id]
//             });

//             const authorNode = new GameNode.Text({
//                 textInfo: createTextInfo(`by ${author}`, 50, 20, 1.2, 'center', COLORS.WHITE),
//                 playerIds: [player.id]
//             });

//             const descriptionNode = new GameNode.Text({
//                 textInfo: createTextInfo(description, 50, 32, .8, 'center', COLORS.WHITE),
//                 playerIds: [player.id]
//             });

//             const versionText = new GameNode.Text({
//                 textInfo: createTextInfo(version, 50, 26, 1, 'center', COLORS.HG_YELLOW),
//                 playerIds: [player.id]
//             });
     
//             const createText = new GameNode.Text({
//                 textInfo: createTextInfo('Create a new session', 30, 61, 1.3, 'center', COLORS.BLACK),
//                 playerIds: [player.id]
//             });

//             const createButton = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(17.5, 45, 25, 35),
//                 fill: COLORS.HG_BLUE,
//                 playerIds: [player.id],
//                 onClick: (player) => {
//                     this.playerStates[player.id].root.removeChild(gameInfoModal.id);
//                     this.startSession(player, gameKey);
//                 }
//             });

//             gameInfoModal.addChildren(createButton, titleNode, authorNode, descriptionNode, createText, versionText);

//             let sessionOptionY = 48;
//             const sessionOptionX = 58;

//             const sessionButtonHeight = 4;
//             const sessionButtonWidth = 10;

//             const activeSessions = Object.values(this.sessions).filter(s => s.game === gameKey);
            
//             if (activeSessions.length > 0) {
//                 const joinText = new GameNode.Text({
//                     textInfo: createTextInfo('Current sessions', 70, 40, 1.3, 'center', COLORS.WHITE),
//                     playerIds: [player.id]
//                 });

//                 gameInfoModal.addChild(joinText);
//             }

//             activeSessions.forEach(s => {
//                 const joinSessionButton = new GameNode.Shape({
//                     shapeType: Shapes.POLYGON,
//                     coordinates2d: ShapeUtils.rectangle(sessionOptionX + 5, sessionOptionY - 1, sessionButtonWidth, sessionButtonHeight),
//                     fill: COLORS.WHITE,
//                     playerIds: [player.id],
//                     onClick: (player) => {
//                         this.joinSession(player, s);
//                     }
//                 });

//                 const joinLabel = new GameNode.Text({
//                     textInfo: createTextInfo('Join', sessionOptionX + 5 + (sessionButtonWidth / 2), sessionOptionY - 1.6 + (sessionButtonHeight / 2), .9, 'center', COLORS.BLACK),
//                     playerIds: [player.id]
//                 });

//                 const spectateSessionButton = new GameNode.Shape({
//                     shapeType: Shapes.POLYGON,
//                     coordinates2d: ShapeUtils.rectangle(sessionOptionX + sessionButtonWidth + 2 + 5, sessionOptionY - 1, sessionButtonWidth, sessionButtonHeight),
//                     fill: COLORS.WHITE,
//                     playerIds: [player.id],
//                     onClick: (player) => {
//                         this.spectateSession(player, s);
//                     }
//                 });

//                 const spectateLabel = new GameNode.Text({
//                     textInfo: createTextInfo('Spectate', sessionOptionX + 5 + sessionButtonWidth + 2 + (sessionButtonWidth / 2), sessionOptionY - 1.6 + (sessionButtonHeight / 2), .9, 'center', COLORS.BLACK),
//                     playerIds: [player.id]
//                 });

//                 const sessionText = new GameNode.Text({
//                     textInfo: createTextInfo(`Session ${s.id}`, sessionOptionX, sessionOptionY, 1, 'center', orangeish),
//                     playerIds: [player.id]
//                 });

//                 joinSessionButton.addChild(joinLabel);
//                 spectateSessionButton.addChild(spectateLabel);

//                 gameInfoModal.addChildren(sessionText, joinSessionButton, spectateSessionButton);

//                 sessionOptionY += sessionButtonHeight + 3;
//             });

//             const closeModalButton = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: ShapeUtils.rectangle(11, 11, 6, 6),
//                 fill: COLORS.HG_RED,
//                 playerIds: [player.id],
//                 onClick: (player) => {
//                     delete this.modals[player.id];
//                     this.playerStates[player.id].root.removeChild(gameInfoModal.node.id);
//                 }
//             });

//             gameInfoModal.addChild(closeModalButton);

//             // animations.fadeIn(gameInfoModal, .6);
//          }

//         this.playerStates[player.id].root.addChild(gameInfoModal);


//         let _gameMetadata;

//         if (this.downloadedGames[gameKey]) {
//             const gameData = this.downloadedGames[gameKey].gameData;

//             const versions = this.downloadedGames[gameKey].versions;

//             _gameMetadata = {
//                 title: gameData.name, 
//                 author: gameData.author, 
//                 description: gameData.description,
//                 version: versions[0] && versions[0].version
//             };
//             renderStuff(this.downloadedGames[gameKey]);//_gameMetadata);
//         } else {
//             _gameMetadata = games[gameKey].metadata && games[gameKey].metadata() || {};
//             renderThing(_gameMetadata);
//         }
        
//     }
    
//     renderGameList(playerId) {
//         const playerRoot = this.playerStates[playerId].root;
//         playerRoot.clearChildren();

//         const gameOptionSize = {
//             x: 20,
//             y: 18
//         };

//         const gameOptionMargin = {
//             x: 10,
//             y: 10
//         };
//         const startX = 5;
//         const startY = 5;

//         const endX = 95;
//         const endY = 95;

//         const perRow = Math.floor((endX - startX) / (gameOptionSize.x + gameOptionMargin.x));
//         const perCol = Math.floor((endY - startY) / (gameOptionSize.y + gameOptionMargin.y));

//         const rowHeight = (gameOptionSize.y + gameOptionMargin.y);
//         const colWidth = (gameOptionSize.x + gameOptionMargin.x);

//         const indexToPos = (index) => {
//             const rowNum = Math.floor(index / perRow);
//             const colNum = index % perRow;
//             return [startX + (colNum * colWidth), startY + (rowNum * rowHeight)];
//         };

//         const gamesPerScreen = perCol * perRow;

//         const screens = Math.ceil(Object.keys(games).length / gamesPerScreen);
//         const barHeight = 90 / screens;

//         const barWrapper = new GameNode.Shape({
//             shapeType: Shapes.POLYGON,
//             coordinates2d: ShapeUtils.rectangle(95, 5, 3, 90),
//             fill: DASHBOARD_COLOR,
//             color: COLORS.HG_BLACK,
//             border: 6,
//             playerIds: [playerId],
//             onClick: (player, x, y) => {
//                 const barTopY = bar.node.coordinates2d[0][1];
//                 if (y > barTopY && y < barTopY + barHeight) {
//                     return;
//                 }
//                 else if (y < barTopY) {
//                     this.playerStates[player.id].screen = this.playerStates[player.id].screen - 1;
//                     this.renderGameList(player.id);
//                 } else {
//                     this.playerStates[player.id].screen = this.playerStates[player.id].screen + 1;
//                     this.renderGameList(player.id);
//                 }
//             }
//         });

//         const currentScreen = this.playerStates[playerId].screen || 0;

//         const startGameIndex = (gamesPerScreen * currentScreen);
//         const endGameIndex = startGameIndex + gamesPerScreen;

//         const barTopPadding = 5.6;
//         const barStartY = (barHeight * currentScreen) + barTopPadding;

//         const bar = new GameNode.Shape({
//             shapeType: Shapes.POLYGON,
//             coordinates2d: ShapeUtils.rectangle(95.4, barStartY, 2.2, barHeight),
//             fill: COLORS.HG_BLACK,
//             playerIds: [playerId]
//         });

//         barWrapper.addChild(bar);

//         playerRoot.addChild(barWrapper);

//         let gameIndex = 0;

//         const gameKeys = sortedGameKeys.slice(startGameIndex, endGameIndex);
//         for (const keyIndex in gameKeys) {
//             const key = gameKeys[keyIndex];

//             const assetKey = games[key].metadata && games[key].metadata().thumbnail ? key : 'default';
//             const gamePos = indexToPos(gameIndex);

//             const gameOptionWrapper = new GameNode.Shape({
//                 shapeType: Shapes.POLYGON,
//                 coordinates2d: [
//                     [gamePos[0], gamePos[1]],
//                     [gamePos[0] + gameOptionSize.x, gamePos[1]],
//                     [gamePos[0] + gameOptionSize.x, gamePos[1] + gameOptionSize.y],
//                     [gamePos[0], gamePos[1] + gameOptionSize.y],
//                     [gamePos[0], gamePos[1]]
//                 ],
//                 fill: COLORS.HG_BLACK,
//                 playerIds: [playerId],
//                 onClick: (player) => {
//                     console.log("PLAYER CLICKED THING " + key);
//                     console.log(player.id);
//                     // this.onGameOptionClick(player, key);
//                 }
//             });

//             const optionMarginX = gameOptionSize.x * .1;
//             const optionMarginY = gameOptionSize.y * .05;

//             const gameOption = new GameNode.Asset({
//                 onClick: (player) => {
//                     console.log("PLAYER CLICKED THING " + key);
//                     // this.onGameOptionClick(player, key);
//                 },
//                 coordinates2d: ShapeUtils.rectangle(gamePos[0] + optionMarginX, gamePos[1] + optionMarginY, gameOptionSize.x, gameOptionSize.y),
//                 assetInfo: {
//                     [assetKey]: {
//                         pos: {
//                             x: gamePos[0] + optionMarginX,
//                             y: gamePos[1] + optionMarginY
//                         },
//                         size: {
//                             x: (.8 * gameOptionSize.x),
//                             y: (.8 * gameOptionSize.y)
//                         }
//                     }
//                 },
//                 playerIds: [playerId]
//             });

//             gameOptionWrapper.addChild(gameOption);

//             gameIndex++;

//             const textThing = (games[key].metadata && games[key].metadata().name || key) + '';
//             const gameOptionTitle = new GameNode.Text({
//                 textInfo: {
//                     text: textThing, 
//                     color: COLORS.BLACK,
//                     align: 'center',
//                     x: gamePos[0] + (gameOptionSize.x / 2), 
//                     y: gamePos[1] + (1.1 * gameOptionSize.y),
//                     size: 1
//                 }, 
//                 playerIds: [playerId]
//             });

//             gameOption.addChild(gameOptionTitle);

//             playerRoot.addChild(gameOptionWrapper);
//             //            this.base.addChild(authorInfoNode);
//         }
//     }

//     isText(key) {
//         return key.length == 1 && (key >= 'A' && key <= 'Z') || (key >= 'a' && key <= 'z') || key === ' ' || key === 'Backspace';
//     }

//     handleKeyDown(player, key) {
//         return;
//         if (!this.playerEditStates[player.id] || !this.isText(key)) {
//             return;
//         }

//         const keyCacheId = this.generateKeyCacheId(player, key);

//         if (!this.keyCoolDowns.has(keyCacheId)) {
//             const newText = this.playerNodes[player.id].text;
//             if (newText.text.length > 0 && key === 'Backspace') {
//                 newText.text = newText.text.substring(0, newText.text.length - 1); 
//             } else if(key !== 'Backspace') {
//                 newText.text = newText.text + key;
//             }
//             this.playerNodes[player.id].text = newText;
//             this.keyCoolDowns.put(keyCacheId, 200);
//         }
//     }

//     generateKeyCacheId(player, key) {
//         return player.id + ' ' + key;
//     }

//     handleKeyUp(player, key) {
//         const keyCacheId = this.generateKeyCacheId(player, key);

//         if (this.keyCoolDowns.has(keyCacheId)) {
//             this.keyCoolDowns.remove(keyCacheId);
//         }
//     }

//     handleNewPlayer(player) {
//        this.keyCoolDowns[player.id] = {};

//        const playerRootNode = new GameNode.Shape({
//            shapeType: Shapes.POLYGON,
//            coordinates2d: [
//                [0, 0],
//                [0, 0],
//                [0, 0],
//                [0, 0],
//                [0, 0]
//            ],
//            playerIds: [player.id]
//        });

//        this.base.addChild(playerRootNode);

//        this.playerStates[player.id] = {
//            screen: 0,
//            root: playerRootNode,
//            selectedGameVersion: null
//        };

//        this.renderGameList(player.id);

//        if (player.requestedGameId) {
//            https.get(`https://landlord.homegames.io/games/${player.requestedGameId}`, (res) => {
//                if (res.statusCode == 200) {
//                    res.on('data', (buf) => {
//                        const gameData = JSON.parse(buf);
//                        this.downloadedGames[player.requestedGameId] = gameData;                        
//                        this.onGameOptionClick(player, player.requestedGameId);
//                    });
//                } else {
//                    console.log('dont know what happened');
//                }
//            });
//        }
//     }

//     handlePlayerDisconnect(playerId) {
//         delete this.keyCoolDowns[playerId];
//         const playerRoot = this.playerStates[playerId].root;
//         this.base.removeChild(playerRoot.node.id);
//     }
//     deviceRules() {
//         return {
//             deviceType: (player, type) => {
//                 if (type == 'mobile') {
//                     // 1:2 ratio for mobile
//                     player.receiveUpdate([9, 1, 2]);
//                 }
//             }
//         }
//     }

//     getLayers() {
//         return [{root: this.base}];
//     }
// }

module.exports = HomegamesDashboard;
