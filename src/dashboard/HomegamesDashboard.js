const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0740');

const unzipper = require('unzipper');
const fs = require('fs');
const gameModal = require('./game-modal');

const COLORS = Colors.COLORS;

const Asset = require('../common/Asset');

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
    const path = _path || config.GAME;
    if (!path) {

    }
};

let sessionIdCounter = 1;

const OPTION_COLOR = [251, 255, 242, 255];
const BASE_COLOR = [251, 255, 242, 255];
const SEARCH_BOX_COLOR = [241, 112, 111, 255];
const DASHBOARD_TEXT_COLOR = COLORS.ALMOST_BLACK;
const SEARCH_TEXT_COLOR = COLORS.ALMOST_BLACK;
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

const optionWidth = (gameContainerWidth - ((gamesPerRow - 1) * gameLeftXMargin)) / gamesPerRow;
const optionHeight = (gameContainerHeight - ((rowsPerPage - 1) * gameTopYMargin)) / rowsPerPage;

const CHILD_SESSION_HEARTBEAT_INTERVAL = getConfigValue('CHILD_SESSION_HEARTBEAT_INTERVAL', 500);

const GAME_DIRECTORY = path.resolve(getConfigValue('GAME_DIRECTORY', 'hg-games'));

const updateGameMetadataMap = (newMetadata) => {
    fs.writeFileSync(GAME_DIRECTORY + '/.metadata', JSON.stringify(newMetadata));
}

const getGameMetadataMap = () => {
    if (fs.existsSync(GAME_DIRECTORY + '/.metadata')) {
        const bytes = fs.readFileSync(GAME_DIRECTORY + '/.metadata');
        return JSON.parse(bytes);
    }

    return {};
}

// copied from common. TODO: refactor everything so its not embarrassing 
const getUrl = (url, headers = {}) => new Promise((resolve, reject) => {
    const getModule = url.startsWith('https') ? https : http;

    const responseData = '';

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

const SOURCE_GAME_DIRECTORY = path.resolve(getConfigValue('SOURCE_GAME_DIRECTORIES', 'src/games'));
const DOWNLOADED_GAME_DIRECTORY = path.resolve(getConfigValue('DOWNLOADED_GAME_DIRECTORY', 'hg-games'));

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
    }),
    getGameDetails: (gameId) => new Promise((resolve, reject) => {
       getUrl('https://landlord.homegames.io/games/' + gameId).then(response => {
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
};

if (!fs.existsSync(GAME_DIRECTORY)) {
    fs.mkdirSync(GAME_DIRECTORY);
}

const getGamePathsHelper = (dir) => {
    const entries = fs.readdirSync(dir);
    const results = new Set();
    const processedEntries = {};

    entries.forEach(entry => {
        const entryPath = path.resolve(`${dir}/${entry}`);
        
        const metadata = fs.statSync(entryPath);
        if (metadata.isFile()) {
            if (entryPath.endsWith('index.js')) {
                results.add(entryPath);
            }
        } else if (metadata.isDirectory()) {
            const nestedPaths = getGamePathsHelper(entryPath);
            nestedPaths.forEach(nestedPath => results.add(nestedPath));
        }
            
    });

    return results;
};

const getGamePaths = () => {
    const sourceGames = getGamePathsHelper(SOURCE_GAME_DIRECTORY);
    const downloadedGames = getGamePathsHelper(DOWNLOADED_GAME_DIRECTORY);

    const gamePaths = Array.from(new Set([...sourceGames, ...downloadedGames])).sort();

    const games = {};

    // used to append to keys with clashes. we should have ids
    let suffixCount = 0;
    const gameMetadataMap = getGameMetadataMap();
    gamePaths.forEach(gamePath => {
        const gameClass = require(gamePath);
        const gameMetadata = gameClass.metadata ? gameClass.metadata() : {};
        const storedMetadata = gameMetadataMap[gamePath] || {};

        const metadata = { ...gameMetadata, ...storedMetadata }
        const isLocal = sourceGames.has(gamePath);
        metadata.isLocal = isLocal;
        metadata.path = gamePath;
        
        const gameKey = gameClass.name;

        if (!games[gameKey]) {
            games[gameKey] = { class: gameClass, metadata };
        } else {
            games[`${gameKey}_${suffixCount++}`] = { class: gameClass, metadata };
        }
    });

    return games;
};

class HomegamesDashboard extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia'
        };
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

        this.movePlayer = movePlayer;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000),
            fill: BASE_COLOR
        });

        this.localGames = {};
        const gamePaths = getGamePaths();
        for (const gameKey in gamePaths) {
            const gameClass = gamePaths[gameKey].class;
            this.localGames[gameKey] = { gameClass: gameClass, path: gamePaths[gameKey].path, metadata: gamePaths[gameKey].metadata }; 
        }

        Object.keys(this.localGames).filter(k => this.localGames[k].metadata && this.localGames[k].metadata.thumbnail).forEach(key => {
            this.assets[key] = new Asset({
                'id': this.localGames[key].metadata && this.localGames[key].metadata.thumbnail,
                'type': 'image'
            });
        });

        this.initializeGames(this.localGames);

        this.playerViews = {};
        this.playerStates = {};
        this.playerRoots = {};
        

        const testNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.ORANGE,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000)
        });
        this.getPlane().addChild(testNode);
        // this.getPlane().addChildren(this.base);

        this.initializeSearch();
        this.downloadedGames = {};
        this.sessions = {};
        this.requestCallbacks = {};
        this.requestIdCounter = 1;


        this.playerRootNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.BLACK
        });

        this.getViewRoot().addChild(this.playerRootNode);

            
        setInterval(() => {
            for (const i in this.sessions) {
                this.sessions[i].sendHeartbeat && this.sessions[i].sendHeartbeat();
            }
        }, CHILD_SESSION_HEARTBEAT_INTERVAL);
    }

    initializeSearch() {
        // todo: connect to game service
    }

    startSession(playerId, gameKey, versionKey = null) { 
        const sessionId = sessionIdCounter++;
        const port = getServerPort();

            const childGameServerPath = path.join(path.resolve(__dirname, '..'), 'child_game_server.js');

            const childSession = fork(childGameServerPath);

            sessions[port] = childSession;

            if (this.localGames[gameKey]) {
                const referencedGame = this.localGames[gameKey];

                const squishVersion = referencedGame.metadata.squishVersion;

                childSession.send(JSON.stringify({
                    key: gameKey,
                    squishVersion,
                    gamePath: this.localGames[gameKey].metadata.path,
                    port,
                    player: {
                        id: playerId
                    }
                }));

                childSession.on('message', (thang) => {
                    const jsonMessage = JSON.parse(thang);
                    if (jsonMessage.success) {
                        this.movePlayer({ playerId, port });
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
            } else {

            }
    }

    joinSession(playerId, session) {
        this.movePlayer({ playerId, port: session.port });
    }

    showGameModal(gameCollection, playerId, gameKey, versionKey = null) {
        const playerViewRoot = this.playerViews[playerId] && this.playerViews[playerId].root;

        const gameMetadata = gameCollection[gameKey].metadata || {};

        const activeSessions = Object.values(this.sessions).filter(session => {
            return session.game === gameKey;
        });

        if (this.localGames[gameKey]) {
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
        } else {
            networkHelper.getGameDetails(gameKey).then(gameDetails => {
                let version;

                if (versionKey) {
                    version = gameDetails.versions.filter(v => v.id === versionKey)[0];
                } else {
                    version = gameDetails.versions[gameDetails.versions.length - 1];

                }

                const { gameId, versionId } = version;

                this.downloadGame( { gameDetails, version }).then(gamePath => {
                    this.localGames = {};
                    const gamePaths = getGamePaths();
                    for (const gameKey2 in gamePaths) {
                        const gameClass = gamePaths[gameKey2].class;
                        this.localGames[gameKey2] = { gameClass: gameClass, path: gamePaths[gameKey2].path, metadata: gamePaths[gameKey2].metadata }; 
                    }
                    const gameClass = require(gamePath);
                    const metad = Object.assign({path: gamePath}, gameMetadata || {});

                    this.localGames[gameKey] = {
                        gameClass,
                        path: gamePath,
                        metadata: metad
                    }
                    
                    this.initializeGames(this.localGames);
                    const modal = gameModal({ 
                        gameKey, 
                        activeSessions, 
                        playerId,
                        gameMetadata: metad, 
                        onJoinSession: (session) => {
                            this.joinSession(playerId, session);
                        },
                        onCreateSession: () => {
                            this.startSession(playerId, gameKey, versionId);
                        }, 
                        onClose: () => {
                            playerViewRoot.removeChild(modal.node.id);  
                        }
                    });

                    playerViewRoot.addChild(modal);
                });
                
            })
        }
    }

    getAssets() {
        return this.assets;
    }

    initializeGames(gameCollection) {
        this.base.clearChildren();
        const gameCount = Object.keys(gameCollection).length;
        const pagesNeeded = Math.ceil(gameCount / (gamesPerRow * rowsPerPage));
        console.log('need ' + pagesNeeded + ' pages with ' + rowsPerPage + ' rows per page for ' + gameCount + ' games');
        let baseSize = (gameContainerHeight + gameContainerYMargin) * pagesNeeded;

        // pages need to match height of game container to avoid the base getting cut off
        const paddingMultiplier = Math.ceil(baseSize / gameContainerHeight) / (baseSize / gameContainerHeight);
        baseSize *= paddingMultiplier;

        this.base.node.coordinates2d = ShapeUtils.rectangle(0, 0, baseSize, baseSize);
        this.updatePlaneSize(baseSize);

        let index = 0;
        for (const gameKey in gameCollection) {
            const realStartX = gameContainerXMargin + ( (optionWidth + gameLeftXMargin) * (index % gamesPerRow) );
            const startYIndex = (gameContainerYMargin) + gameTopYMargin;
            // hack
            const textHeight = 2.5;
            const realStartY = gameContainerYMargin + ( (optionHeight + gameTopYMargin) *  Math.floor(index / gamesPerRow) ) + textHeight;

            const gameOptionVisualBase = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    realStartX,
                    realStartY,
                    optionWidth, 
                    optionHeight
                ),
                fill: OPTION_COLOR
            });


            // transparent box with click handler (so image shows under)
            const gameOptionClickHandler = new GameNode.Shape({
                onClick: (playerId) => {
                    this.showGameModal(gameCollection, playerId, gameKey);
                },
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    realStartX,
                    realStartY,
                    optionWidth, 
                    optionHeight
                )
            });

            const assetKey = gameCollection[gameKey].metadata && gameCollection[gameKey].metadata.thumbnail ? gameKey : 'default';

            const gameOption = new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    realStartX,
                    realStartY,
                    optionWidth, 
                    optionHeight
                ),
                assetInfo: {
                    [assetKey]: {
                        pos: {
                            x: realStartX,
                            y: realStartY
                        },
                        size: {
                            x: optionWidth,
                            y: optionHeight
                        }
                    }
                }
            });

            const gameName = new GameNode.Text({
                textInfo: {
                    text: gameCollection[gameKey].metadata && gameCollection[gameKey].metadata.name || gameKey,
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

        let index = 0;
        for (const game in gameCollection) {
            const realStartX = gameContainerXMargin + ( (optionWidth + gameLeftXMargin) * (index % gamesPerRow) );
            const startYIndex = (gameContainerYMargin) + gameTopYMargin;
            // hack
            const textHeight = 2.5;
            const realStartY = gameContainerYMargin + ( (optionHeight + gameTopYMargin) *  Math.floor(index / gamesPerRow) ) + textHeight;

            const gameOptionVisualBase = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    realStartX,
                    realStartY,
                    optionWidth, 
                    optionHeight
                ),
                fill: OPTION_COLOR
            });


            // transparent box with click handler (so image shows under)
            const gameOptionClickHandler = new GameNode.Shape({
                onClick: (playerId) => {
                    this.showGameModal(gameCollection, playerId, game);
                },
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    realStartX,
                    realStartY,
                    optionWidth, 
                    optionHeight
                )
            });

            let assetKey = 'default';
            if (gameCollection[game].gameClass) {
                if (gameCollection[game].metadata && gameCollection[game].metadata().thumbnail) {
                    assetKey = gameCollection[game].metadata().thumbnail;
                } else {
                    assetKey = game;
                }
            } else {
                if (game.metadata && game.metadata.thumbnail) {
                    assetKey = game.metadata.thumbnail;
                }
            }
            const gameOption = new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    realStartX,
                    realStartY,
                    optionWidth, 
                    optionHeight
                ),
                assetInfo: {
                    [assetKey]: {
                        pos: {
                            x: realStartX,
                            y: realStartY
                        },
                        size: {
                            x: optionWidth,
                            y: optionHeight
                        }
                    }
                }
            });

            const gameName = new GameNode.Text({
                textInfo: {
                    text: game.metadata?.isLocal ? game : gameCollection[game].metadata.name,
                    x: realStartX + (optionWidth / 2),
                    y: realStartY - textHeight - 4, //hack,
                    color: DASHBOARD_TEXT_COLOR,
                    align: 'center',
                    size: 2.5
                }
            });

            gameOptionVisualBase.addChildren(gameOption, gameOptionClickHandler, gameName);

            planeBase.addChild(gameOptionVisualBase);
            index++;   
        }
        return plane;
    }

    handleNewPlayer({ playerId, settings: playerSettings, info: playerInfo, requestedGame }) {
    
        const playerView = {x: 0, y: 0, w: gameContainerWidth, h: gameContainerHeight};
        console.log('here it shte t');
        console.log(playerView);

        const playerNodeRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [playerId]
        });

        this.playerRoots[playerId] = {
            node: playerNodeRoot
        }
        this.playerStates[playerId] = {
            view: playerView
        };

        // this.playerViews[playerId] = {
        //     root: playerNodeRoot
        // };
        this.playerRootNode.addChild(playerNodeRoot);

        this.renderGames(playerId);

        if (requestedGame) {
            const { gameId, versionId } = requestedGame;

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

    handleSearch(playerId) {
        const query = this.playerStates[playerId].query;

        const playerView = {x: 0, y: 0, w: gameContainerWidth, h: gameContainerHeight};

        this.playerStates[playerId] = {
            view: playerView
        };

        networkHelper.searchGames(query).then(results => {
            const games = {};
            results.games.forEach(game => {
                games[game.id] = {
                    metadata: {
                        name: game.name,
                        author: game.createdBy,
                        thumbnail: game.thumbnail
                    }
                }
            });
            this.renderSearchResults(playerId, games, query);
        })
    }

    renderSearchResults(playerId, results, query) {
        const playerView = this.playerStates[playerId].view;
        const playerNodeRoot = this.playerViews[playerId].root;
        playerNodeRoot.clearChildren();

        const playerGameViewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [playerId]
        });

        const plane = this.initializeCollectionPlane(results);
        const view = ViewUtils.getView(
            plane,
            playerView, 
            [playerId], 
            {
                filter: (node) => node.node.id !== plane.getChildren()[0].node.id, 
                y: (100 - containerHeight)
            }
        );
        playerGameViewRoot.addChild(view);

        const playerSearchBox = new GameNode.Shape({
            shapeType: Shapes.POLYGON, 
            coordinates2d: ShapeUtils.rectangle(12.5, 2.5, 75, 10),
            playerIds: [playerId],
            fill: SEARCH_BOX_COLOR,
            input: {
                type: 'text',
                oninput: (playerId, input) => {
                    this.playerStates[playerId].query = input;
                    this.handleSearch(playerId);

                }
            }
        });

        const clearSearchButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(82.5, 2.5, 5, 10),
            playerIds: [playerId],
            fill: SEARCH_BOX_COLOR,
            onClick: (playerId) => {        
                const playerView = {x: 0, y: 0, w: gameContainerWidth, h: gameContainerHeight};

                this.playerStates[playerId] = {
                    view: playerView
                };

                this.renderGames(playerId);
            }
        });

        const clearSearchX = new GameNode.Text({
            textInfo: {
                x: 83.75,
                y: 2.25,
                size: 4,
                text: 'x',
                color: BASE_COLOR
            },
            playerIds: [playerId]
        });

        clearSearchButton.addChild(clearSearchX);

        const playerSearchText = new GameNode.Text({
            textInfo: {
                x: 15, // maybe need a function to map text size given a screen size
                y: 5.5,
                text: query || '',
                color: SEARCH_TEXT_COLOR,
                size:1.8
            },
            playerIds: [playerId]
        });

        playerSearchBox.addChildren(playerSearchText, clearSearchButton);

        let canGoDown, canGoUp = false;

        const baseHeight = this.base.node.coordinates2d[2][1];

        const currentView = this.playerStates[playerId].view;

        const gameOptionsBelowView = plane.getChildren()[0].getChildren().filter(child => {
            return child.node.coordinates2d[0][1] > (currentView.y + currentView.h);
        });

        const gameOptionsAboveView = plane.getChildren()[0].getChildren().filter(child => {
            return child.node.coordinates2d[2][1] < currentView.y;;
        });
        
        if (gameOptionsBelowView.length > 0) {
            canGoDown = true;
        }

        if (gameOptionsAboveView.length > 0) {
            canGoUp = true;
        }

        const upArrow = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(90, 22.5, 10, 20),
            playerIds: [playerId],
            fill: BASE_COLOR,
            onClick: (player, x, y) => {

                const _plane = results ? this.initializeCollectionPlane(results.games) : this.getPlane();

                const currentView = Object.assign({}, this.playerStates[playerId].view);

                if (currentView.y - (gameContainerHeight + gameContainerYMargin) >= 0) {
                    currentView.y -= gameContainerHeight + gameContainerYMargin;
                    this.playerStates[playerId].view = currentView;
                    this.renderGames(playerId);
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
            playerIds: [playerId],
            fill: BASE_COLOR,
            onClick: (player, x, y) => {
                const _plane = results ? this.initializeCollectionPlane(results.games) : this.getPlane();

                const currentView = Object.assign({}, this.playerStates[playerId].view);

                // y value of bottom right corner of base (assumed rectangle)
                const baseHeight = this.base.node.coordinates2d[2][1];

                // game container height + game y margin would be the new 0, 0 of the view, so we multiply by 2 to make sure the new view would be covered by the base
                if (currentView.y + 2 * (gameContainerHeight + gameContainerYMargin) <= baseHeight) {
                    currentView.y += gameContainerHeight + gameContainerYMargin;
                    this.playerStates[playerId].view = currentView;
                    this.renderGames(playerId);
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

    buildStaticElements(playerId) {
        const baseNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.RED,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            playerIds: [playerId]
        });

        return baseNode;
        // const playerSearchBox = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON, 
        //     coordinates2d: ShapeUtils.rectangle(12.5, 2.5, 75, 10),
        //     playerIds: [playerId],
        //     fill: SEARCH_BOX_COLOR,
        //     input: {
        //         type: 'text',
        //         oninput: (playerId, input) => {
        //             this.playerStates[playerId].query = input;
        //             this.handleSearch(playerId);
        //         }
        //     }
        // });

        // const playerSearchText = new GameNode.Text({
        //     textInfo: {
        //         x: 15, // maybe need a function to map text size given a screen size
        //         y: 5.5,
        //         text: 'Search',
        //         color: SEARCH_TEXT_COLOR,
        //         size:1.8
        //     },
        //     playerIds: [playerId]
        // });

        // playerSearchBox.addChild(playerSearchText);

        // let canGoDown, canGoUp = false;

        // const baseHeight = this.base.node.coordinates2d[2][1];

        // const currentView = this.playerStates[playerId].view;

        // const gameOptionsBelowView = this.base.getChildren().filter(child => {
        //     return child.node.coordinates2d[0][1] > (currentView.y + currentView.h);
        // });

        // const gameOptionsAboveView = this.base.getChildren().filter(child => {
        //     return child.node.coordinates2d[2][1] < currentView.y;;
        // });

        // if (gameOptionsBelowView.length > 0) {
        //     canGoDown = true;
        // }

        // if (gameOptionsAboveView.length > 0) {
        //     canGoUp = true;
        // }

        // const upArrow = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(90, 22.5, 10, 20),
        //     playerIds: [playerId],
        //     fill: BASE_COLOR,
        //     onClick: (player, x, y) => {

        //         const _plane = this.getPlane();

        //         const currentView = Object.assign({}, this.playerStates[playerId].view);

        //         if (currentView.y - (gameContainerHeight + gameContainerYMargin) >= 0) {
        //             currentView.y -= gameContainerHeight + gameContainerYMargin;
        //             this.playerStates[playerId].view = currentView;
        //             this.renderGames(playerId);
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
        //         const _plane = this.getPlane();

        //         const currentView = Object.assign({}, this.playerStates[playerId].view);

        //         // y value of bottom right corner of base (assumed rectangle)
        //         const baseHeight = this.base.node.coordinates2d[2][1];

        //         // game container height + game y margin would be the new 0, 0 of the view, so we multiply by 2 to make sure the new view would be covered by the base
        //         if (currentView.y + 2 * (gameContainerHeight + gameContainerYMargin) <= baseHeight) {
        //             currentView.y += gameContainerHeight + gameContainerYMargin;
        //             this.playerStates[playerId].view = currentView;
        //             this.renderGames(playerId);
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

    renderGames(playerId) {
        const staticElements = this.buildStaticElements(playerId);
        const playerRoot = this.playerRoots[playerId];
        const playerView = this.playerStates[playerId].view;

        console.log('sdfisdf');
        console.log(this.playerRoots);

        const view = ViewUtils.getView(
            this.getPlane(),
            playerView, 
            [playerId], 
            {
                // filter: (node) => {console.log('what is this node im filtering lol'); console.log(node); return false;},//node.node.id !== playerRoot.node.id,//this.base.node.id, 
                // y: 50//(100 - 90)//containerHeight)
            }
        );

        console.log('hjksdfdsf');
        console.log(this.getPlane());
        console.log(view);
        console.log(playerView);
        // playerRoot.node.addChild(staticElements);

        playerRoot.node.addChildren(staticElements, view);

        // console.log('rendering. containerHeight ' + containerHeight);
        // const playerView = this.playerStates[playerId].view;
        
        // const playerNodeRoot = this.playerViews[playerId].root;
        // playerNodeRoot.clearChildren();

        // const playerGameViewRoot = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
        //     playerIds: [playerId]
        // });

        // const view = ViewUtils.getView(
        //     this.getPlane(),
        //     playerView, 
        //     [playerId], 
        //     {
        //         filter: (node) => node.node.id !== this.base.node.id, 
        //         y: (100 - containerHeight)
        //     }
        // );

        // playerGameViewRoot.addChild(view);

        // above here///////

        // const playerSearchBox = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON, 
        //     coordinates2d: ShapeUtils.rectangle(12.5, 2.5, 75, 10),
        //     playerIds: [playerId],
        //     fill: SEARCH_BOX_COLOR,
        //     input: {
        //         type: 'text',
        //         oninput: (playerId, input) => {
        //             this.playerStates[playerId].query = input;
        //             this.handleSearch(playerId);
        //         }
        //     }
        // });

        // const playerSearchText = new GameNode.Text({
        //     textInfo: {
        //         x: 15, // maybe need a function to map text size given a screen size
        //         y: 5.5,
        //         text: 'Search',
        //         color: SEARCH_TEXT_COLOR,
        //         size:1.8
        //     },
        //     playerIds: [playerId]
        // });

        // playerSearchBox.addChild(playerSearchText);

        // let canGoDown, canGoUp = false;

        // const baseHeight = this.base.node.coordinates2d[2][1];

        // const currentView = this.playerStates[playerId].view;

        // const gameOptionsBelowView = this.base.getChildren().filter(child => {
        //     return child.node.coordinates2d[0][1] > (currentView.y + currentView.h);
        // });

        // const gameOptionsAboveView = this.base.getChildren().filter(child => {
        //     return child.node.coordinates2d[2][1] < currentView.y;;
        // });

        // if (gameOptionsBelowView.length > 0) {
        //     canGoDown = true;
        // }

        // if (gameOptionsAboveView.length > 0) {
        //     canGoUp = true;
        // }

        // const upArrow = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(90, 22.5, 10, 20),
        //     playerIds: [playerId],
        //     fill: BASE_COLOR,
        //     onClick: (player, x, y) => {

        //         const _plane = this.getPlane();

        //         const currentView = Object.assign({}, this.playerStates[playerId].view);

        //         if (currentView.y - (gameContainerHeight + gameContainerYMargin) >= 0) {
        //             currentView.y -= gameContainerHeight + gameContainerYMargin;
        //             this.playerStates[playerId].view = currentView;
        //             this.renderGames(playerId);
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
        //         const _plane = this.getPlane();

        //         const currentView = Object.assign({}, this.playerStates[playerId].view);

        //         // y value of bottom right corner of base (assumed rectangle)
        //         const baseHeight = this.base.node.coordinates2d[2][1];

        //         // game container height + game y margin would be the new 0, 0 of the view, so we multiply by 2 to make sure the new view would be covered by the base
        //         if (currentView.y + 2 * (gameContainerHeight + gameContainerYMargin) <= baseHeight) {
        //             currentView.y += gameContainerHeight + gameContainerYMargin;
        //             this.playerStates[playerId].view = currentView;
        //             this.renderGames(playerId);
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

    downloadGame({ gameDetails, version }) {
        // const { name, description, thumbnail, id } = gameDetails;
        const { id: gameId } = gameDetails;
        const { versionId, location } = version;
        return new Promise((resolve, reject) => {
            const gamePath = `${GAME_DIRECTORY}/${gameId}/${versionId}`;

            if (!fs.existsSync(`${GAME_DIRECTORY}/${gameId}`)) {
                fs.mkdirSync(`${GAME_DIRECTORY}/${gameId}`);
            }

            https.get(location, (res) => {
                const stream = res.pipe(unzipper.Extract({
                    path: gamePath
                }));

                stream.on('close', () => {
                    fs.readdir(gamePath, (err, files) => {
                        const currentMetadata = getGameMetadataMap();
                        const indexPath = `${gamePath}/${files[0]}/index.js`;
                
                        currentMetadata[indexPath] = gameDetails;
                        updateGameMetadataMap(currentMetadata);
                
                        resolve(indexPath);
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
