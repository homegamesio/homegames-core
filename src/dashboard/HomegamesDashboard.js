const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0730');

const unzipper = require('unzipper');
const fs = require('fs');
const gameModal = require('./game-modal');

const COLORS = Colors.COLORS;

const Asset = require('../common/Asset');

const games = require('../games');

const sortedGameKeys = Object.keys(games).sort();

const { ExpiringSet, animations } = require('../common/util');

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

const findLocalGames = (_path = '') => {
    const path = _path || config.GAME
    if (!path) {

    }
}

let sessionIdCounter = 1;
// https://coolors.co/5bc0eb-fde74c-9bc53d-e55934-fa7921
// https://coolors.co/99621e-d38b5d-f3ffb6-739e82-2c5530
// const DASHBOARD_COLOR = [69, 100, 150, 255];

const OPTION_COLOR = [251, 255, 242, 255];
const BASE_COLOR = [251, 255, 242, 255];
const SEARCH_BOX_COLOR = [241, 112, 111, 255];
const DASHBOARD_TEXT_COLOR = COLORS.ALMOST_BLACK;
const SEARCH_TEXT_COLOR = COLORS.ALMOST_BLACK;//[255, 255, 255, 255];
const orangeish = [246, 99, 4, 255];

const gamesPerRow = 2;
const rowsPerPage = 2;
const containerWidth = 100;
const containerHeight = 90;

const gameContainerXMargin = 12.5;
const gameContainerYMargin = 10;

const gameLeftXMargin = 10;
const gameTopYMargin = 10; 

const gameContainerWidth = containerWidth - (2 * gameContainerXMargin);
const gameContainerHeight = containerHeight - (2 * gameContainerYMargin);

console.log("container height: " + gameContainerHeight);

const optionWidth = (gameContainerWidth - ((gamesPerRow - 1) * gameLeftXMargin)) / gamesPerRow;
const optionHeight = (gameContainerHeight - ((rowsPerPage - 1) * gameTopYMargin)) / rowsPerPage;

console.log("option is " + optionWidth + " wide, " + optionHeight + " high");

const CHILD_SESSION_HEARTBEAT_INTERVAL = getConfigValue('CHILD_SESSION_HEARTBEAT_INTERVAL', 500);

const GAME_DIRECTORY = path.resolve(getConfigValue('GAME_DIRECTORY', 'hg-games'));
console.log("GAME DIR");
console.log(GAME_DIRECTORY);
// copied from common. TODO: refactor everything so its not embarrassing 
const getUrl = (url, headers = {}) => new Promise((resolve, reject) => {
    const getModule = url.startsWith('https') ? https : http;

    let responseData = '';

    getModule.get(url, { headers } , (res) => {
        const bufs = [];
        res.on('data', (chunk) => {
            bufs.push(chunk);
        });

        res.on('end', () => {
            if (res.statusCode > 199 && res.statusCode < 300) {
                resolve(Buffer.concat(bufs));
            } else {
                reject(Buffer.concat(bufs));
            }
        });
    }).on('error', error => {
        reject(error);
    });
 
});

const networkHelper = {
    searchGames: (q) => new Promise((resolve, reject) => {
        getUrl('https://landlord.homegames.io/games?query=' + q).then(response => {
            let results;
            try {
                results = JSON.parse(response);
            } catch (err) {
                console.error('Unable to do thing');
                reject();
            }    
            resolve(results);
        });
    })
}

class HomegamesDashboard extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super(1000);

        this.assets = {
            'default': new Asset({
                'id': 'ff745468e1b725445c65245ce044da21',
                'type': 'image'
            }),
            'dashboardSong': new Asset({
                'id': 'd9f097268324319d07a903cb50dc7210',
                type: 'audio'
            })
        };


        const thang = () => new Promise((resolve, reject) => {
            thangHelper(GAME_DIRECTORY, new Set()).then(resolve);//('ayy lmao'));
        });

        const thangHelper = (dir) => new Promise((resolve, reject) => {

            fs.readdir(dir, (err, entries) => {
                // console.log('entries');
                // console.log(entries);
                const results = new Set();
                const processedEntries = {};
                entries.forEach(entry => {
                    // console.log('entry: ' + entry);
                    const entryPath = path.resolve(`${dir}/${entry}`)
                    // console.log(entryPath);

                    processedEntries[entryPath] = false;

                    fs.stat(entryPath, (err, metadata) => {
                        if (metadata.isFile()) {
                        processedEntries[entryPath] = true;
                        // console.log('found file ' + entryPath);
                        if (entryPath.endsWith('index.js')) {
                            results.add(entryPath);
                        }

                        if (Object.keys(processedEntries).filter(k => !processedEntries[k]).length == 0) {
                            // console.log('donee!!!! nice 123');
                            resolve(results);
                        }
                    } else if (metadata.isDirectory()) {
                        // console.log('need to traverse');
                        // console.log(entryPath);
                        thangHelper(entryPath).then(nestedPaths => {
                            // results.add(nestedPaths);
                            nestedPaths.forEach(nestedPath => results.add(nestedPath));
                            processedEntries[entryPath] = true;

                            if (Object.keys(processedEntries).filter(k => !processedEntries[k]).length == 0) {
                                // console.log('donee!!!! nice 456');
                                resolve(results);
                            }
                        });
                    }
                    });
                    
                })
            });
        });

        this.localGames = Object.assign({}, games);
        thang().then((stuff) => {
            let counter = 0;
            stuff.forEach(gamePath => {
                const _game = require(gamePath);
                const gameMetadata = _game.metadata && _game.metadata() || null;
                const suffix = gameMetadata && gameMetadata.version || counter++;
                this.localGames[_game.name + '_' + suffix] = {game: _game, path: gamePath}; 
            });
            this.initializeGames(this.localGames);
        });

        Object.keys(games).filter(k => games[k].metadata && games[k].metadata().thumbnail).forEach(key => {
            this.assets[key] = new Asset({
                'id': games[key].metadata && games[key].metadata().thumbnail,
                'type': 'image'
            });
        });

        this.playerViews = {};

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000),
            fill: BASE_COLOR
        });
        
        this.getPlane().addChildren(this.base);

        // this.initializeGames(this.localGames);
        this.initializeSearch();
        this.downloadedGames = {};
        this.sessions = {};
        this.requestCallbacks = {};
        this.requestIdCounter = 1;
            
        setInterval(() => {
            for (let i in this.sessions) {
                this.sessions[i].sendHeartbeat && this.sessions[i].sendHeartbeat();
            }
        }, CHILD_SESSION_HEARTBEAT_INTERVAL);
        // const baseSize = this.getBaseSize(games);

        // whiteBase.node.coordinates2d = ShapeUtils.rectangle(0, 0, baseSize, baseSize);
        // this.updatePlaneSize(baseSize);
    }

    initializeSearch() {
        // todo: connect to game service
    }

    onGameOptionClick(gameCollection, player, gameKey, versionKey = null) {        
        this.showGameModal(gameCollection, player, gameKey, versionKey);
    }

    startSession(player, gameKey, versionKey = null) { 
        const sessionId = sessionIdCounter++;
        const port = getServerPort();

        if (this.downloadedGames[gameKey]) {
            if (!versionKey) {
                console.log('downhloaded game requires version id');
            } else {
                this.downloadGame(gameKey, versionKey).then(gamePath => {
                    const childGameServerPath = path.join(path.resolve(__dirname, '..'), 'child_game_server.js');
                    const childSession = fork(childGameServerPath);

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

                    childSession.on('error', (err) => {
                        this.sessions[sessionId] = {};
                        
                        console.log('child session error');
                        console.log(err);
                    });
                    
                    childSession.on('close', (err) => {
                        this.sessions[sessionId] = {};
                    });
                    console.log('asss asss asss111');
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
            }
        } else {

            const childGameServerPath = path.join(path.resolve(__dirname, '..'), 'child_game_server.js');

            const childSession = fork(childGameServerPath);

            sessions[port] = childSession;

            const referencedGame = games[gameKey] || this.localGames[gameKey].game;

            const squishVersion = referencedGame.metadata().squishVersion;

            childSession.send(JSON.stringify({
                key: gameKey,
                squishVersion,
                gamePath: this.localGames[gameKey] ? this.localGames[gameKey].path : null,
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

            childSession.on('error', (err) => {
                this.sessions[sessionId] = {};
                childSession.kill();
                console.log('child session error');
                console.log(err);
            });
            
            childSession.on('close', (err) => {
                this.sessions[sessionId] = {};
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

    showGameModal(gameCollection, player, gameKey, versionKey = null) {
        const playerViewRoot = this.playerViews[player.id] && this.playerViews[player.id].root;

        const gameMetadata = gameCollection[gameKey].metadata && gameCollection[gameKey].metadata() || {};

        const activeSessions = Object.values(this.sessions).filter(session => {
            return session.game === gameKey;
        });

        const modal = gameModal({ 
            gameKey, 
            activeSessions, 
            playerId: player.id, 
            gameMetadata, 
            onJoinSession: (session) => {
                this.joinSession(player, session);
            },
            onCreateSession: () => {
                this.startSession(player, gameKey, versionKey);
            }, 
            onClose: () => {
                playerViewRoot.removeChild(modal.node.id);  
            }
        });

        // const game = gameCollection[gameKey];
        
        
        // const modalBase = new GameNode.Shape({
        //     coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 95, 95),
        //     fill: COLORS.LIGHT_CORAL,
        //     shapeType: Shapes.POLYGON
        // });

        // const closeButton = new GameNode.Shape({
        //     coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 10, 10),
        //     fill: COLORS.HARD_ORANGE_RED,
        //     shapeType: Shapes.POLYGON,
        //     onClick: (player) => {
        //         console.log('close');
        //         playerViewRoot.removeChild(modalBase.node.id);
        //     }
        // });

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

        // const assetKey = gameCollection[gameKey].metadata && gameCollection[gameKey].metadata().thumbnail ? gameKey : 'default';

        // const imgCoords = [27.5, 12.5, 45, 45];
        // const gameImage = new GameNode.Asset({
        //     coordinates2d:  ShapeUtils.rectangle(imgCoords[0], imgCoords[1], imgCoords[2], imgCoords[3]),
        //     assetInfo: {
        //         [assetKey]: {
        //             pos: {
        //                 x: imgCoords[0],
        //                 y: imgCoords[1]
        //             },
        //             size: {
        //                 x: imgCoords[2],
        //                 y: imgCoords[3]
        //             }
        //         }
        //     }
        // });

        // const gameName = new GameNode.Text({
        //     textInfo: {
        //         text: assetKey,
        //         x: 50,
        //         y: 5,
        //         color: COLORS.WHITE,
        //         size: 1.5,
        //         align: 'center'
        //     }
        // });

        // const author = new GameNode.Text({
        //     textInfo: {
        //         text: gameCollection[gameKey].metadata && gameCollection[gameKey].metadata().author || 'Unknown author',
        //         x: 50,
        //         y: 9,
        //         color: COLORS.ALMOST_BLACK,
        //         size: 0.9,
        //         align: 'center'
        //     }
        // });

        // const description = new GameNode.Text({
        //     textInfo: {
        //         x: 27.5,
        //         y: 65,
        //         text: gameCollection[gameKey].metadata && gameCollection[gameKey].metadata().description || 'No description available',
        //         align: 'left',
        //         size: 0.6,
        //         color: COLORS.WHITE
        //     }
        // });

        // const sessionText = new GameNode.Text({
        //     textInfo: {
        //         x: 15,
        //         y: 17.5,
        //         text: 'Join an existing session',
        //         color: COLORS.WHITE,
        //         align: 'center',
        //         size: 1.2
        //     }
        // });

        // let yIndex = 22.5;

        // let count = 0;
        // const sessionList = Object.values(this.sessions).filter(session => {
        //     return session.game === gameKey;
        // }).map(session => {
        //     const sessionNode = new GameNode.Shape({
        //         shapeType: Shapes.POLYGON,
        //         coordinates2d: ShapeUtils.rectangle(10, yIndex, 10, 8),
        //         fill: COLORS.GRAY,
        //         onClick: (player, x, y) => {
        //             this.joinSession(player, session);
        //         }
        //     });

        //     const sessionText = new GameNode.Text({
        //         textInfo: {
        //             x: 15,
        //             y: yIndex + 3,
        //             size: 0.8,
        //             color: COLORS.WHITE,
        //             align: 'center',
        //             text: `Session ${session.id}`
        //         }
        //     });

        //     yIndex += 10;
        //     sessionNode.addChild(sessionText);
        //     return sessionNode;
        // });

        // const createButton = new GameNode.Shape({
        //     fill: COLORS.COOL_GREEN,
        //     coordinates2d: ShapeUtils.rectangle(75, 22.5, 20, 15),
        //     shapeType: Shapes.POLYGON,
        //     onClick: () => {
        //         this.startSession(player, gameKey, versionKey);
        //     }
        // });

        // const createIcon = new GameNode.Text({
        //     textInfo: {
        //         color: COLORS.ALMOST_BLACK,
        //         x: 85, 
        //         y: 25,
        //         text: '\u1405',
        //         align: 'center',
        //         size: 5
        //     }
        // });

        // const createText = new GameNode.Text({
        //     textInfo: {
        //         x: 85,
        //         y: 17.5, 
        //         text: 'Create a session',
        //         color: COLORS.WHITE,
        //         size: 1.3,
        //         align: 'center'
        //     }
        // });

        // createButton.addChildren(createText, createIcon);

        // closeButton.addChildren(closeX);

        // sessionList.forEach(sessionNode => modalBase.addChild(sessionNode));
        // modalBase.addChildren(closeButton, gameName, author, gameImage, description, sessionText, createButton);

        playerViewRoot.addChild(modal);
    }

    getAssets() {
        return this.assets;
    }

    initializeGames(gameCollection) {
        const gameCount = Object.keys(gameCollection).length;
        const pagesNeeded = Math.ceil(gameCount / (gamesPerRow * rowsPerPage));
        console.log('need ' + pagesNeeded + ' pages with ' + rowsPerPage + ' rows per page for ' + gameCount + ' games')
        let baseSize = (gameContainerHeight + gameContainerYMargin) * pagesNeeded;

        console.log(gameContainerHeight + gameContainerYMargin);
        // pages need to match height of game container to avoid the base getting cut off
        const paddingMultiplier = Math.ceil(baseSize / gameContainerHeight) / (baseSize / gameContainerHeight);
        baseSize *= paddingMultiplier;

        this.base.node.coordinates2d = ShapeUtils.rectangle(0, 0, baseSize, baseSize);
        this.updatePlaneSize(baseSize);

        let index = 0;
        for (let game in gameCollection) {
            const realStartX = gameContainerXMargin + ( (optionWidth + gameLeftXMargin) * (index % gamesPerRow) );
            const startYIndex = (gameContainerYMargin) + gameTopYMargin;
            // hack
            const textHeight = 2.5;
            const realStartY = gameContainerYMargin + ( (optionHeight + gameTopYMargin) *  Math.floor(index / gamesPerRow) ) + textHeight;

            const gameOptionVisualBase = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    realStartX,//startIndex + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)),//gameContainerXMargin + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)), 
                    realStartY,//gameContainerYMargin + ((optionHeight + gameTopYMargin) * Math.floor(index / gamesPerRow)), 
                    optionWidth, 
                    optionHeight
                ),
                fill: OPTION_COLOR
                // fill: COLORS.CREAM//Colors.randomColor()
            });


            // transparent box with click handler (so image shows under)
            const gameOptionClickHandler = new GameNode.Shape({
                onClick: (player, x, y) => {
                    this.onGameOptionClick(gameCollection, player, game);
                },
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    realStartX,//startIndex + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)),//gameContainerXMargin + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)), 
                    realStartY,//gameContainerYMargin + ((optionHeight + gameTopYMargin) * Math.floor(index / gamesPerRow)), 
                    optionWidth, 
                    optionHeight
                )
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
                    y: realStartY - textHeight - 4, //hack,
                    color: DASHBOARD_TEXT_COLOR,
                    align: 'center',
                    size: 1.6
                }
            });

            gameOptionVisualBase.addChildren(gameOption, gameOptionClickHandler, gameName);

            this.base.addChild(gameOptionVisualBase);
            index++;   
        }
    }


    initializeCollectionPlane(gameCollection) {

        // return this.getPlane();
        const planeBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000),
            fill: BASE_COLOR
        });
        
        const plane = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000)
        });

        plane.addChildren(planeBase);
        
        // return plane;
        const gameCount = Object.keys(gameCollection).length;
        const pagesNeeded = Math.ceil(gameCount / (gamesPerRow * rowsPerPage));
        const baseSize = (gameContainerHeight + gameContainerYMargin) * pagesNeeded;

        // const plane = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(0, 0, 10000, 10000),
        //     fill: BASE_COLOR
        // });
        // this.base.node.coordinates2d = ShapeUtils.rectangle(0, 0, baseSize, baseSize);
        // this.updatePlaneSize(baseSize);

        let index = 0;
        for (let game in gameCollection) {
            const realStartX = gameContainerXMargin + ( (optionWidth + gameLeftXMargin) * (index % gamesPerRow) );
            const startYIndex = (gameContainerYMargin) + gameTopYMargin;
            // hack
            const textHeight = 2.5;
            const realStartY = gameContainerYMargin + ( (optionHeight + gameTopYMargin) *  Math.floor(index / gamesPerRow) ) + textHeight;

            const gameOptionVisualBase = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    realStartX,//startIndex + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)),//gameContainerXMargin + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)), 
                    realStartY,//gameContainerYMargin + ((optionHeight + gameTopYMargin) * Math.floor(index / gamesPerRow)), 
                    optionWidth, 
                    optionHeight
                ),
                fill: OPTION_COLOR
                // fill: COLORS.CREAM//Colors.randomColor()
            });


            // transparent box with click handler (so image shows under)
            const gameOptionClickHandler = new GameNode.Shape({
                onClick: (player, x, y) => {
                    this.onGameOptionClick(gameCollection, player, game);
                },
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    realStartX,//startIndex + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)),//gameContainerXMargin + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)), 
                    realStartY,//gameContainerYMargin + ((optionHeight + gameTopYMargin) * Math.floor(index / gamesPerRow)), 
                    optionWidth, 
                    optionHeight
                )
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
                    y: realStartY - textHeight - 4, //hack,
                    color: DASHBOARD_TEXT_COLOR,
                    align: 'center',
                    size: 2.5
                }
            });

            gameOptionVisualBase.addChildren(gameOption, gameOptionClickHandler, gameName);

            plane.addChild(gameOptionVisualBase);
            index++;   
        }
        return plane;
    }

    // wtf    
    // updateSessionInfo(sessionId) {
    //     this.sessions[sessionId].getPlayers((players) => { 
    //         this.sessions[sessionId].players = players;
    //     });
    // }

    handlePlayerSearch(player, text, playerSearchBox) {
        // hack. should be finding text. but also shouldnt be adding children to this text node
        const newText = playerSearchBox.getChildren()[0].clone({});
        networkHelper.searchGames(text).then(results => {
            this.renderGames(player, {results, query: text});
        });
        if (!text) {
            newText.node.text.text = 'Search';
        } else {
            newText.node.text.text = text;
        }
        playerSearchBox.clearChildren();
        playerSearchBox.addChild(newText);
    }

    handleNewPlayer(player) {

        console.log('adddddding player');
        console.log(player);

        const playerView = {x: 0, y: 0, w: gameContainerWidth, h: gameContainerHeight};

        const playerNodeRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [player.id]
        });

        this.playerViews[player.id] = {
            view: playerView,
            root: playerNodeRoot,
        }

        this.renderGames(player, {});

        this.getViewRoot().addChild(playerNodeRoot);

        if (player.requestedGame) {
            const { gameId, versionId } = player.requestedGame;

           https.get(`https://landlord.homegames.io/games/${gameId}/version/${versionId}`, (res) => {
               if (res.statusCode == 200) {
                   res.on('data', (buf) => {
                       const gameData = JSON.parse(buf);
                       if (!this.downloadedGames[gameId]) {
                            this.downloadedGames[gameId] = {};
                       }

                       this.downloadedGames[gameId][versionId] = gameData;
                       this.showGameModal(this.downloadedGames, player, gameId, versionId);
                   });
               } else {
                   console.log('dont know what happened');
               }
           });
        }
    }

    renderGames(player, {results, query}) {
        const playerView = this.playerViews[player.id].view;
        // const existingViewNode = this.playerViews[player.id] && this.playerViews[player.id].viewRoot;
        
        const playerNodeRoot = this.playerViews[player.id].root;
        playerNodeRoot.clearChildren();

        const playerGameViewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [player.id]
        });

        let view;
        if (results) {
            const plane = this.initializeCollectionPlane(results.games);
            view = ViewUtils.getView(
                plane,
                playerView, 
                [player.id], 
                {
                    filter: (node) => node.node.id !== plane.getChildren()[0].node.id, 
                    y: (100 - containerHeight)
                }
            );
            // return;
        } else {
            view = ViewUtils.getView(
                this.getPlane(),
                playerView, 
                [player.id], 
                {
                    filter: (node) => node.node.id !== this.base.node.id, 
                    y: (100 - containerHeight)
                }
            );
        }

        playerGameViewRoot.addChild(view);

        const playerSearchBox = new GameNode.Shape({
            shapeType: Shapes.POLYGON, 
            coordinates2d: ShapeUtils.rectangle(12.5, 2.5, 75, 10),
            playerIds: [player.id],
            fill: SEARCH_BOX_COLOR
        });

        const playerSearchText = new GameNode.Text({
            textInfo: {
                x: 15, // maybe need a function to map text size given a screen size
                y: 5.5,
                text: query || 'Search - coming soon',
                color: SEARCH_TEXT_COLOR,
                size:1.8
            },
            playerIds: [player.id]
        });

        playerSearchBox.addChild(playerSearchText);

        let canGoDown, canGoUp = false;

        const baseHeight = this.base.node.coordinates2d[2][1];

        const currentView = this.playerViews[player.id].view;
        if (currentView.y - (gameContainerHeight + gameContainerYMargin) >= 0) {     
            canGoUp = true;
        } 
        
        if (currentView.y + 2 * (gameContainerHeight + gameContainerYMargin) <= baseHeight) {
            canGoDown = true;
        }
        const upArrow = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(90, 22.5, 10, 20),
            playerIds: [player.id],
            fill: BASE_COLOR,
            onClick: (player, x, y) => {

                const _plane = results ? this.initializeCollectionPlane(results.games) : this.getPlane();

                const currentView = Object.assign({}, this.playerViews[player.id].view);

                if (currentView.y - (gameContainerHeight + gameContainerYMargin) >= 0) {
                    currentView.y -= gameContainerHeight + gameContainerYMargin;
                    this.playerViews[player.id].view = currentView;
                    this.renderGames(player, {});
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
            fill: BASE_COLOR,
            onClick: (player, x, y) => {
                const _plane = results ? this.initializeCollectionPlane(results.games) : this.getPlane();

                const currentView = Object.assign({}, this.playerViews[player.id].view);

                // y value of bottom right corner of base (assumed rectangle)
                const baseHeight = this.base.node.coordinates2d[2][1];

                // game container height + game y margin would be the new 0, 0 of the view, so we multiply by 2 to make sure the new view would be covered by the base
                if (currentView.y + 2 * (gameContainerHeight + gameContainerYMargin) <= baseHeight) {
                    currentView.y += gameContainerHeight + gameContainerYMargin;
                    this.playerViews[player.id].view = currentView;
                    this.renderGames(player, {});
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
        playerNodeRoot.addChild(playerSearchBox);
        if (canGoUp) {
            playerNodeRoot.addChildren(upArrow);
        }
        if (canGoDown) {
            playerNodeRoot.addChildren(downArrow);
        }
    }

    downloadGame(gameId, versionId) {
        return new Promise((resolve, reject) => {
            console.log('downloaded game ' + gameId);
            const referencedGame = this.downloadedGames[gameId][versionId];
            console.log('referenced');
            console.log(referencedGame);
            // const version = gameVersion && gameVersion.data || this.downloadedGames[gameId].versions[0];
            const gamePath = `${GAME_DIRECTORY}/${gameId}_${versionId}`;
            https.get(referencedGame.location, (res) => {
                const stream = res.pipe(unzipper.Extract({
                    path: gamePath
                }));

                stream.on('close', () => {
                    fs.readdir(gamePath, (err, files) => {
                        resolve(`${gamePath}/${files[0]}/index.js`);
                    });
                });

            });
        });
    }

    handlePlayerDisconnect(playerId) {
        const playerViewRoot = this.playerViews[playerId] && this.playerViews[playerId].root;
        if (playerViewRoot) {
            this.getViewRoot().removeChild(playerViewRoot.node.id);
        }
    }

}

module.exports = HomegamesDashboard;
