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

const { ExpiringSet, animations } = require('../common/util');
const { renderDashboard } = require('./dashboard');

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

const SOURCE_GAME_DIRECTORY = path.resolve(getConfigValue('SOURCE_GAME_DIRECTORIES', 'src/games'));
const DOWNLOADED_GAME_DIRECTORY = path.resolve(getConfigValue('DOWNLOADED_GAME_DIRECTORY', 'hg-games'));

console.log("GAME DIRLLLLL");
console.log(SOURCE_GAME_DIRECTORY);
console.log(DOWNLOADED_GAME_DIRECTORY);
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

    initializeGamesHelper(dir) {
        const entries = fs.readdirSync(dir);
            const results = new Set();
            const processedEntries = {};

            entries.forEach(entry => {
                const entryPath = path.resolve(`${dir}/${entry}`)
            
                const metadata = fs.statSync(entryPath);
                if (metadata.isFile()) {
                    if (entryPath.endsWith('index.js')) {
                        results.add(entryPath);
                    }
                } else if (metadata.isDirectory()) {
                    const nestedPaths = this.initializeGamesHelper(entryPath);
                        nestedPaths.forEach(nestedPath => results.add(nestedPath));
                }
                
            });

            return results;
    }

    initializeGames() {
        const sourceGames = this.initializeGamesHelper(SOURCE_GAME_DIRECTORY);
        const downloadedGames = this.initializeGamesHelper(DOWNLOADED_GAME_DIRECTORY);

        const gamePaths = Array.from(new Set([...sourceGames, ...downloadedGames])).sort();

        const games = {};

        // used to append to keys with clashes. we should have ids
        let suffixCount = 0;
        gamePaths.forEach(gamePath => {
            const gameClass = require(gamePath);
            const gameMetadata = gameClass.metadata ? gameClass.metadata() : {};
            const isLocal = sourceGames.has(gamePath);
            gameMetadata.isLocal = isLocal;
            gameMetadata.path = gamePath;
            
            const gameKey = gameClass.name;

            if (!games[gameKey]) {
                games[gameKey] = { class: gameClass, metadata: gameMetadata };
            } else {
                games[`${gameKey}_${suffixCount++}`] = { class: gameClass, metadata: gameMetadata };
            }
        });

        return games;
        //         const _game = require(gamePath);
        //         const gameMetadata = _game.metadata && _game.metadata() || null;
        //         const suffix = gameMetadata && gameMetadata.version || counter++;
        //         this.localGames[_game.name + '_' + suffix] = {game: _game, path: gamePath}; 
    }

    constructor({ movePlayer }) {
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

        this.playerStates = {};

        this.movePlayer = movePlayer;

        this.games = this.initializeGames();

        this.plane = this.initializeCollectionPlane(this.games);

        // thang().then((stuff) => {
        //     let counter = 0;
        //     stuff.forEach(gamePath => {
        //         const _game = require(gamePath);
        //         const gameMetadata = _game.metadata && _game.metadata() || null;
        //         const suffix = gameMetadata && gameMetadata.version || counter++;
        //         this.localGames[_game.name + '_' + suffix] = {game: _game, path: gamePath}; 
        //     });
        //     this.initializeGames(this.localGames);
        // });

        // Object.keys(games).filter(k => games[k].metadata && games[k].metadata().thumbnail).forEach(key => {
        //     this.assets[key] = new Asset({
        //         'id': games[key].metadata && games[key].metadata().thumbnail,
        //         'type': 'image'
        //     });
        // });

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

    onGameOptionClick(gameCollection, playerId, gameKey, versionKey = null) {        
        this.showGameModal(gameCollection, playerId, gameKey, versionKey);
    }

    startSession(playerId, gameKey, versionKey = null) { 
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
                            id: playerId
                        }
                    }));

                    childSession.on('message', (thang) => {
                        if (thang.startsWith('{')) {
                            const jsonMessage = JSON.parse(thang);
                            if (jsonMessage.success) {
                                console.log('need to figure this out. give access to session?')
                                // player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
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
                    id: playerId
                }
            }));

            childSession.on('message', (thang) => {
                const jsonMessage = JSON.parse(thang);
                if (jsonMessage.success) {
                    // console.log('oh no');
                    this.movePlayer({ playerId, port });
                    // player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
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

    joinSession(playerId, session) {
        console.log('hmmmmmm');
        this.movePlayer({ playerId, port: session.port });
        // player.receiveUpdate([5, Math.floor(session.port / 100), Math.floor(session.port % 100)]);
    }

    showGameModal(gameCollection, playerId, gameKey, versionKey = null) {
        const playerViewRoot = this.playerViews[playerId] && this.playerViews[playerId].root;

        const gameMetadata = gameCollection[gameKey].metadata && gameCollection[gameKey].metadata() || {};

        const activeSessions = Object.values(this.sessions).filter(session => {
            return session.game === gameKey;
        });

        console.log('player if ' + playerId);

        const modal = gameModal({ 
            gameKey, 
            activeSessions, 
            playerId,
            gameMetadata, 
            onJoinSession: (session) => {
                this.joinSession(playerId, session);
            },
            onCreateSession: () => {
                this.startSession(playerId, gameKey, versionKey);
            }, 
            onClose: () => {
                playerViewRoot.removeChild(modal.node.id);  
            }
        });

        playerViewRoot.addChild(modal);
    }

    getAssets() {
        return this.assets;
    }

    // initializeGames(gameCollection) {
    //     const gameCount = Object.keys(gameCollection).length;
    //     const pagesNeeded = Math.ceil(gameCount / (gamesPerRow * rowsPerPage));
    //     console.log('need ' + pagesNeeded + ' pages with ' + rowsPerPage + ' rows per page for ' + gameCount + ' games')
    //     let baseSize = (gameContainerHeight + gameContainerYMargin) * pagesNeeded;

    //     console.log(gameContainerHeight + gameContainerYMargin);
    //     // pages need to match height of game container to avoid the base getting cut off
    //     const paddingMultiplier = Math.ceil(baseSize / gameContainerHeight) / (baseSize / gameContainerHeight);
    //     baseSize *= paddingMultiplier;

    //     this.base.node.coordinates2d = ShapeUtils.rectangle(0, 0, baseSize, baseSize);
    //     this.updatePlaneSize(baseSize);

    //     let index = 0;
    //     for (let game in gameCollection) {
    //         const realStartX = gameContainerXMargin + ( (optionWidth + gameLeftXMargin) * (index % gamesPerRow) );
    //         const startYIndex = (gameContainerYMargin) + gameTopYMargin;
    //         // hack
    //         const textHeight = 2.5;
    //         const realStartY = gameContainerYMargin + ( (optionHeight + gameTopYMargin) *  Math.floor(index / gamesPerRow) ) + textHeight;

    //         const gameOptionVisualBase = new GameNode.Shape({
    //             shapeType: Shapes.POLYGON,
    //             coordinates2d: ShapeUtils.rectangle(
    //                 realStartX,//startIndex + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)),//gameContainerXMargin + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)), 
    //                 realStartY,//gameContainerYMargin + ((optionHeight + gameTopYMargin) * Math.floor(index / gamesPerRow)), 
    //                 optionWidth, 
    //                 optionHeight
    //             ),
    //             fill: OPTION_COLOR
    //             // fill: COLORS.CREAM//Colors.randomColor()
    //         });


    //         // transparent box with click handler (so image shows under)
    //         const gameOptionClickHandler = new GameNode.Shape({
    //             onClick: (playerId) => {
    //                 this.onGameOptionClick(gameCollection, playerId, game);
    //             },
    //             shapeType: Shapes.POLYGON,
    //             coordinates2d: ShapeUtils.rectangle(
    //                 realStartX,//startIndex + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)),//gameContainerXMargin + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)), 
    //                 realStartY,//gameContainerYMargin + ((optionHeight + gameTopYMargin) * Math.floor(index / gamesPerRow)), 
    //                 optionWidth, 
    //                 optionHeight
    //             )
    //             // fill: COLORS.CREAM//Colors.randomColor()
    //         });

    //         const assetKey = gameCollection[game].metadata && gameCollection[game].metadata().thumbnail ? game : 'default';

    //         const gameOption = new GameNode.Asset({
    //             coordinates2d:  ShapeUtils.rectangle(
    //                 realStartX,//startIndex + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)),//gameContainerXMargin + ((optionWidth + gameLeftXMargin) * (index % gamesPerRow)), 
    //                 realStartY,//gameContainerYMargin + ((optionHeight + gameTopYMargin) * Math.floor(index / gamesPerRow)), 
    //                 optionWidth, 
    //                 optionHeight
    //             ),//ShapeUtils.rectangle(gamePos[0] + optionMarginX, gamePos[1] + optionMarginY, gameOptionSize.x, gameOptionSize.y),
    //             assetInfo: {
    //                 [assetKey]: {
    //                     pos: {
    //                         x: realStartX,//gamePos[0] + optionMarginX,
    //                         y: realStartY//gamePos[1] + optionMarginY
    //                     },
    //                     size: {
    //                         x: optionWidth,//(.8 * gameOptionSize.x),
    //                         y: optionHeight//(.8 * gameOptionSize.y)
    //                     }
    //                 }
    //             }
    //             // playerIds: [playerId]
    //         });

    //         const gameName = new GameNode.Text({
    //             textInfo: {
    //                 text: game,//'ayy lmao ' + realStartY,
    //                 x: realStartX + (optionWidth / 2),
    //                 y: realStartY - textHeight - 4, //hack,
    //                 color: DASHBOARD_TEXT_COLOR,
    //                 align: 'center',
    //                 size: 1.6
    //             }
    //         });

    //         gameOptionVisualBase.addChildren(gameOption, gameOptionClickHandler, gameName);

    //         this.base.addChild(gameOptionVisualBase);
    //         index++;   
    //     }
    // }


    initializeCollectionPlane(gameCollection) {

        // return this.getPlane();
        const planeBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000),
            fill: BASE_COLOR
        });

        return planeBase;
        
        const plane = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000)
        });

        plane.addChildren(planeBase);
        
        return plane;
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

            console.log("GAME KEY");
            console.log(game);
            console.log(gameCollection[game]);


            // transparent box with click handler (so image shows under)
            const gameOptionClickHandler = new GameNode.Shape({
                onClick: (playerId) => {
                    this.onGameOptionClick(gameCollection, playerId, game);
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

            const assetKey = gameCollection[game].metadata && gameCollection[game].metadata.thumbnail ? game : 'default';

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

    handlePlayerSearch(playerId, text, playerSearchBox) {
        // hack. should be finding text. but also shouldnt be adding children to this text node
        const newText = playerSearchBox.getChildren()[0].clone({});
        networkHelper.searchGames(text).then(results => {
            this.renderGames(playerId);//, {results, query: text});
        });
        if (!text) {
            newText.node.text.text = 'Search';
        } else {
            newText.node.text.text = text;
        }
        playerSearchBox.clearChildren();
        playerSearchBox.addChild(newText);
    }

    handleNewPlayer({ playerId, settings: playerSettings, info: playerInfo, requestedGame }) {
        this.playerStates[playerId] = {
            view: {
                x: 0, 
                y: 0, 
                w: gameContainerWidth, 
                h: gameContainerHeight
            }
        };

        const playerNodeRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [playerId]
        });

        this.playerViews[playerId] = {
            root: playerNodeRoot,
        }

        this.getViewRoot().addChild(playerNodeRoot);

        this.renderGames(playerId);//, {});

        // if (requestedGame) {
        //     const { gameId, versionId } = requestedGame;

        //    https.get(`https://landlord.homegames.io/games/${gameId}/version/${versionId}`, (res) => {
        //        if (res.statusCode == 200) {
        //            res.on('data', (buf) => {
        //                const gameData = JSON.parse(buf);
        //                if (!this.downloadedGames[gameId]) {
        //                     this.downloadedGames[gameId] = {};
        //                }

        //                this.downloadedGames[gameId][versionId] = gameData;
        //                this.showGameModal(this.downloadedGames, player, gameId, versionId);
        //            });
        //        } else {
        //            console.log('dont know what happened');
        //        }
        //    });
        // }
    }

    renderGames(playerId) {//, {results, query}) {
        console.log('player state should have results + query for polayer id ' + playerId);
        console.log(this.playerStates);
        console.log(this.games);
        const playerState = this.playerStates[playerId];

        const playerView = playerState.view;
        console.log(playerView);
        if (playerState) {
            const nodeRoot = this.playerViews[playerId].root;

            const plane = playerState.results ? resultPlane(playerState.results) : this.plane;

            console.log('planbe!!!');
            console.log(playerView)
            console.log(plane);
            const view = ViewUtils.getView(
                plane,
                playerView, 
                [playerId], 
                {
                    filter: (node) => node.node.id !== this.base.node.id, 
                    y: (100 - containerHeight)
                }
            );
            console.log('noew view');
            console.log(view);

            const dashboardContent = renderDashboard({ playerId, plane, playerView: view });

            const playerNodeRoot = this.playerViews[playerId].root;
            playerNodeRoot.clearChildren();

            const tang = new GameNode.Shape({
                fill: COLORS.WHITE,
                coordinates2d: ShapeUtils.rectangle(20, 20, 20, 20),
                shapeType: Shapes.POLYGON
            });

            nodeRoot.addChild(view);
            // nodeRoot.addChild(dashboardContent);

            console.log('i have node root to render to, and state to know what to render');
        }
        // const playerView = this.playerViews[playerId].view;
        // // const existingViewNode = this.playerViews[player.id] && this.playerViews[player.id].viewRoot;
        
        // const playerNodeRoot = this.playerViews[playerId].root;
        // playerNodeRoot.clearChildren();

        // const playerGameViewRoot = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
        //     playerIds: [playerId]
        // });

        // let view;
        // if (results) {
        //     const plane = this.initializeCollectionPlane(results.games);
        //     view = ViewUtils.getView(
        //         plane,
        //         playerView, 
        //         [playerId], 
        //         {
        //             filter: (node) => node.node.id !== plane.getChildren()[0].node.id, 
        //             y: (100 - containerHeight)
        //         }
        //     );
        //     // return;
        // } else {
        //     view = ViewUtils.getView(
        //         this.getPlane(),
        //         playerView, 
        //         [playerId], 
        //         {
        //             filter: (node) => node.node.id !== this.base.node.id, 
        //             y: (100 - containerHeight)
        //         }
        //     );
        // }

        // playerGameViewRoot.addChild(view);

        // const playerSearchBox = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON, 
        //     coordinates2d: ShapeUtils.rectangle(12.5, 2.5, 75, 10),
        //     playerIds: [playerId],
        //     fill: SEARCH_BOX_COLOR
        // });

        // const playerSearchText = new GameNode.Text({
        //     textInfo: {
        //         x: 15, // maybe need a function to map text size given a screen size
        //         y: 5.5,
        //         text: query || 'Search - coming soon',
        //         color: SEARCH_TEXT_COLOR,
        //         size:1.8
        //     },
        //     playerIds: [playerId]
        // });

        // playerSearchBox.addChild(playerSearchText);

        // let canGoDown, canGoUp = false;

        // const baseHeight = this.base.node.coordinates2d[2][1];

        // const currentView = this.playerViews[playerId].view;
        // if (currentView.y - (gameContainerHeight + gameContainerYMargin) >= 0) {     
        //     canGoUp = true;
        // } 
        
        // if (currentView.y + 2 * (gameContainerHeight + gameContainerYMargin) <= baseHeight) {
        //     canGoDown = true;
        // }
        // const upArrow = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(90, 22.5, 10, 20),
        //     playerIds: [playerId],
        //     fill: BASE_COLOR,
        //     onClick: (player, x, y) => {

        //         const _plane = results ? this.initializeCollectionPlane(results.games) : this.getPlane();

        //         const currentView = Object.assign({}, this.playerViews[playerId].view);

        //         if (currentView.y - (gameContainerHeight + gameContainerYMargin) >= 0) {
        //             currentView.y -= gameContainerHeight + gameContainerYMargin;
        //             this.playerViews[playerId].view = currentView;
        //             this.renderGames(playerId, {});
        //         } 
        //     }
        // });

        // const upText = new GameNode.Text({
        //     textInfo: {
        //         x: 95,
        //         y: 27.5,
        //         align: 'center',
        //         size: 1.1,
        //         text: '\u25B2',
        //         color: COLORS.BLACK
        //     }
        // });

        // upArrow.addChild(upText);

        // const downArrow = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(90, 72.5, 10, 20),
        //     playerIds: [playerId],
        //     fill: BASE_COLOR,
        //     onClick: (player, x, y) => {
        //         const _plane = results ? this.initializeCollectionPlane(results.games) : this.getPlane();

        //         const currentView = Object.assign({}, this.playerViews[playerId].view);

        //         // y value of bottom right corner of base (assumed rectangle)
        //         const baseHeight = this.base.node.coordinates2d[2][1];

        //         // game container height + game y margin would be the new 0, 0 of the view, so we multiply by 2 to make sure the new view would be covered by the base
        //         if (currentView.y + 2 * (gameContainerHeight + gameContainerYMargin) <= baseHeight) {
        //             currentView.y += gameContainerHeight + gameContainerYMargin;
        //             this.playerViews[playerId].view = currentView;
        //             this.renderGames(playerId, {});
        //         } 

        //     }
        // });

        // const downText = new GameNode.Text({
        //     textInfo: {
        //         x: 95,
        //         y: 77.5,
        //         align: 'center',
        //         size: 1.1,
        //         text: '\u25BC',
        //         color: COLORS.BLACK
        //     }
        // });

        // downArrow.addChild(downText);

        // playerNodeRoot.addChild(playerGameViewRoot);
        // playerNodeRoot.addChild(playerSearchBox);
        // if (canGoUp) {
        //     playerNodeRoot.addChildren(upArrow);
        // }
        // if (canGoDown) {
        //     playerNodeRoot.addChildren(downArrow);
        // }
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
