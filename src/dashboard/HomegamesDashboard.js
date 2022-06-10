const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0750');

const squishMap = {
    '0750': require.resolve('squish-0750'),
    '0751': require.resolve('squish-0751')
}

const unzipper = require('unzipper');
const fs = require('fs');
const gameModal = require('./game-modal');

const COLORS = Colors.COLORS;

const Asset = require('../common/Asset');

const { ExpiringSet, animations } = require('../common/util');

const gameOption = require('./game-option');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require('homegames-common');

const serverPortMin = getConfigValue('GAME_SERVER_PORT_RANGE_MIN', 7002);
const serverPortMax = getConfigValue('GAME_SERVER_PORT_RANGE_MAX', 7099);

const IS_DEMO = getConfigValue('IS_DEMO', true);

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
const gameContainerYMargin = 5;

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

const SOURCE_GAME_DIRECTORY = path.resolve(getConfigValue('SOURCE_GAME_DIRECTORIES', `${baseDir}/src/games`));
const DOWNLOADED_GAME_DIRECTORY = path.resolve(getConfigValue('DOWNLOADED_GAME_DIRECTORY', `hg-games`));

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
    }), 
    getGameVersionDetails: (gameId, versionId) => new Promise((resolve, reject) => {
        getUrl('https://landlord.homegames.io/games/' + gameId + '/version/' + versionId).then(response => { 
            console.log(response.toString());
            resolve(JSON.parse(response));
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

const getGameMap = () => {
    const sourceGames = getGamePathsHelper(SOURCE_GAME_DIRECTORY);
    const downloadedGames = getGamePathsHelper(DOWNLOADED_GAME_DIRECTORY);

    const gamePaths = Array.from(new Set([...sourceGames, ...downloadedGames])).sort();

    const games = {};

    // used to append to keys with clashes. we should have ids
    let suffixCount = 0;
    const gameMetadataMap = getGameMetadataMap();
    gamePaths.forEach(gamePath => {
        const isLocal = sourceGames.has(gamePath);

        const gameClass = require(gamePath);
        const gameMetadata = gameClass.metadata ? gameClass.metadata() : {};

        const storedMetadata = gameMetadataMap[gamePath] || {};

        if (isLocal) {
            games[gameClass.name] = {
                metadata: {
                    name: gameMetadata.name || gameClass.name,
                    thumbnail: gameMetadata.thumbnail,
                    description: gameMetadata.description || 'No description available'
                },
                versions: {
                    0: {
                        gameId: gameClass.name,
                        class: gameClass,
                        metadata: {...gameMetadata },
                        gamePath,
                        versionId: 0,
                        version: 0,
                        isReviewed: true
                    }
                }
            }
        } else {
            const gameId = storedMetadata?.game?.gameId;
            const versionId = storedMetadata?.version?.versionId;

            if (!gameId || !versionId) {
                console.warn('Unknown game at ' + gamePath);
            } else {
                if (!games[gameId]) {
                    games[gameId] = {
                        metadata: storedMetadata.game,
                        versions: {}
                    }
                }

                games[gameId].versions[versionId] = {
                    class: gameClass,
                    metadata: { ...storedMetadata.version, squishVersion: gameMetadata.squishVersion },
                    gamePath,
                    versionId,
                    version: storedMetadata.version.version,
                    isReviewed: storedMetadata.version.isReviewed
                };
            }
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


    constructor({ movePlayer, addAsset }) {
        super(1000);
        // todo: static vs. addasset

        this.addAsset = addAsset;

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

        this.playerModals = {};

        this.movePlayer = movePlayer;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000),
            fill: BASE_COLOR
        });

        this.localGames = getGameMap();

        Object.keys(this.localGames).filter(k => this.localGames[k].metadata && this.localGames[k].metadata.thumbnail).forEach(key => {
            this.assets[key] = new Asset({
                'id': this.localGames[key].metadata && this.localGames[key].metadata.thumbnail,
                'type': 'image'
            });
        });

        this.renderGamePlane();

        this.playerViews = {};
        this.playerStates = {};
        this.playerRoots = {};
        

        const testNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.ORANGE,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000)
        });

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

    startSession(playerId, gameKey, versionKey = null) { 
        const sessionId = sessionIdCounter++;
        const port = getServerPort();

        const childGameServerPath = path.join(path.resolve(__dirname, '..'), 'child_game_server.js');
    
        if (this.localGames[gameKey]) {
            const referencedGame = this.localGames[gameKey];
            const versionId = versionKey || Object.keys(referencedGame.versions)[Object.keys(referencedGame.versions).length - 1];

            const squishVersion = referencedGame.versions[versionId].metadata.squishVersion || '0750';

            const childSession = fork(childGameServerPath, [], { env: { SQUISH_PATH: squishMap[squishVersion] }});

            sessions[port] = childSession;

            childSession.send(JSON.stringify({
                key: gameKey,
                squishVersion,
                gamePath: referencedGame.versions[versionId].gamePath,
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
                versionId,
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
    }

    joinSession(playerId, session) {
        this.movePlayer({ playerId, port: session.port });
    }

    showGameModalNew(playerId, gameId, versionId) {
        const playerRoot = this.playerRoots[playerId].node;


        const isSourceGame = this.localGames[gameId] && this.localGames[gameId].versions[0] ? true : false;

        const wat = (game, gameVersion) => {
                    const activeSessions = Object.values(this.sessions).filter(session => {
                        return session.game === gameVersion.gameId && Number(session.versionId) === Number(gameVersion.versionId);
                    });

                    const versionList = this.localGames[gameId] ? Object.values(this.localGames[gameId].versions) : [];
                    if (versionList.filter(v => v.versionId === gameVersion.versionId).length === 0) {
                        versionList.push({...gameVersion});
                    }

                    const modal = gameModal({ 
                        gameKey: gameId,
                        versionId: gameVersion.versionId,
                        activeSessions, 
                        playerId,
                        versions: versionList,
                        gameMetadata: gameVersion.metadata, 
                        onVersionChange: (newVersionId) => {
                            this.showGameModalNew(playerId, gameId, newVersionId);
                        },
                        onJoinSession: (session) => {
                            this.joinSession(playerId, session);
                        },
                        onCreateSession: () => {
                            if (this.localGames[gameId]?.versions[gameVersion.versionId]) {
                                this.startSession(playerId, gameId, gameVersion.versionId);

                            } else {
                                this.downloadGame({ gameDetails: game, version: gameVersion }).then(() => {
                                    this.renderGamePlane();
                                    this.startSession(playerId, gameId, gameVersion.versionId);
                                })
                            }
                        },
                        onClose: () => {
                            playerRoot.removeChild(modal.node.id);  
                        }
                    });

                    if (this.playerModals[playerId]) {
                        playerRoot.removeChild(this.playerModals[playerId]);
                    }

                    this.playerModals[playerId] = modal.node.id;
                    playerRoot.addChild(modal);


            }
        if (isSourceGame) {
            wat(this.localGames[gameId].metadata.game, this.localGames[gameId].versions[0]);
        } else {
            networkHelper.getGameDetails(gameId).then(gameDetails => {
                if (versionId) {
                    networkHelper.getGameVersionDetails(gameId, versionId).then(gameVersion => {
                        const withMetadata = {...gameVersion, metadata: { description: gameVersion.description, name: gameDetails.name, thumbnail: gameDetails.thumbnail }};
                        wat(gameDetails, withMetadata);
                    })
                } else {
                    const gameVersion = Object.values(gameDetails.versions)[0];
                    const withMetadata = {...gameVersion, metadata: { description: gameVersion.description, name: gameDetails.name, thumbnail: gameDetails.thumbnail }};
                    wat(gameDetails, withMetadata)
                }

        });
        }
    }

    renderGamePlane() {
        const plane = this.buildGamePlane({ gameCollection: this.localGames, width: 80, height: 80 });
        this.getPlane().clearChildren();
        this.getPlane().addChild(plane);
    }

    getAssets() {
        return this.assets;
    }

    buildGamePlane({ gameCollection, rowsPerPage = 2, columnsPerPage = 2 }) {

        const gameCount = Object.keys(gameCollection).length;
        
        const pagesNeeded = Math.ceil(gameCount / (gamesPerRow * rowsPerPage));

        const gameOptionWidth = 100 / columnsPerPage;
        const gameOptionHeight = 100 / rowsPerPage;

        let gameIndex = 0;

        const planeBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        for (const key in gameCollection) {
            const xIndex = gameIndex % columnsPerPage === 0 ? 0 : ((gameIndex % columnsPerPage) / columnsPerPage) * 100; 
            const yIndex = Math.floor(gameIndex / rowsPerPage) * (100 / rowsPerPage);
            let assetKey = this.assets[key] ? key : 'default';

            const gameName = gameCollection[key]?.metadata?.name || key;

            const gameOptionNode = gameOption({
                x: xIndex,
                y: yIndex,
                width: gameOptionWidth,
                height: gameOptionHeight,
                gameName,
                assetKey,
                onClick: (playerId) => {
                    this.showGameModalNew(playerId, key);
                }
            });

            planeBase.addChild(gameOptionNode);
            gameIndex++;

        }

        return planeBase;
        
    }

    handleNewPlayer({ playerId, settings: playerSettings, info: playerInfo, requestedGame }) {
    
        const playerView = {x: 0, y: 0, w: 100, h: 100};

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

        this.playerRootNode.addChild(playerNodeRoot);

        this.renderGames(playerId, {});

        if (requestedGame) {
            const { gameId, versionId } = requestedGame;

            networkHelper.getGameDetails(gameId).then(gameDetails => {
                networkHelper.getGameVersionDetails(gameId, versionId).then(version => {
                    const ting = { 
                        [gameId]: {
                            metadata: {
                                game: gameDetails,
                                version
                            },
                            versions: {
                                [versionId]: version
                            }
                        }
                    };

                    if (!this.assets[gameId]) {
                        const asset = new Asset({
                            'id': gameDetails.thumbnail,
                            'type': 'image'
                        }); 

                        this.assets[gameId] = asset;    

                        this.addAsset(gameId, asset).then(() => {
                            this.showGameModalNew(playerId, gameId, version.versionId);
                        });
                    } else {
                            this.showGameModalNew(playerId, gameId, version.versionId);
                    }
                });
            });
        }
    }

    handleSearch(playerId) {
        const query = this.playerStates[playerId].query;

        const playerView = {x: 0, y: 0, w: 100, h: 100};

        this.playerStates[playerId] = {
            view: playerView
        };

        const games = {};


        let processedEntries = 0;
        networkHelper.searchGames(query).then(results => {
            if (!results.games || !results.games.length) {
                this.renderGames(playerId, {})
            } else {
                results.games.forEach(game => {
                    const thumbnailId = game.thumbnail.indexOf('/') > 0 ? game.thumbnail.split('/')[game.thumbnail.split('/').length  - 1] : game.thumbnail; 

                    games[game.id] = {
                        metadata: {
                            name: game.name,
                            author: game.createdBy,
                            thumbnail: thumbnailId
                        }
                    }

                    if (!this.assets[game.id]) {
                        const asset = new Asset({
                            'id': thumbnailId,
                            'type': 'image'
                        }); 

                        this.assets[game.id] = asset;    

                        this.addAsset(game.id, asset).then(() => {
                            processedEntries += 1;
                            if (processedEntries === results.games.length) {
                                this.renderGames(playerId, { searchResults: games, searchQuery: query });
                            }

                        });
                        
                    } else {
                        processedEntries += 1;
                        if (processedEntries === results.games.length) {
                            this.renderGames(playerId, { searchResults: games, searchQuery: query });
                        }
                    }
                });
            }

        });
    

    }

    buildStaticElements(playerId, gamePlane, searchQuery = '', searchResults = null) {
        const baseNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: BASE_COLOR,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            playerIds: [playerId]
        });

        const playerSearchBox = new GameNode.Shape({
            shapeType: Shapes.POLYGON, 
            coordinates2d: ShapeUtils.rectangle(12.5, 2.5, 75, 10),
            playerIds: [playerId],
            fill: SEARCH_BOX_COLOR,
            input: IS_DEMO ? null : {
                type: 'text',
                oninput: (playerId, input) => {
                    this.playerStates[playerId].query = input;
                    this.handleSearch(playerId);
                }
            }
        });

        const playerSearchText = new GameNode.Text({
            textInfo: {
                x: 15, // maybe need a function to map text size given a screen size
                y: 5.5,
                text: IS_DEMO ? 'Search - disabled in demo' : searchQuery || 'Search',
                color: SEARCH_TEXT_COLOR,
                size:1.8
            },
            playerIds: [playerId]
        });
        
        playerSearchBox.addChildren(playerSearchText);


        if (searchResults) {
            const clearSearchButton = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(82.5, 2.5, 5, 10),
                playerIds: [playerId],
                fill: SEARCH_BOX_COLOR,
                onClick: (playerId) => {        
                    const playerView = {x: 0, y: 0, w: 100, h: 100};

                    this.playerStates[playerId] = {
                        view: playerView
                    };

                    this.renderGames(playerId, {});
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
            playerSearchBox.addChildren(clearSearchButton);
        }

        let canGoDown = false;
        let canGoUp = false;

        const baseHeight = this.base.node.coordinates2d[2][1];

        const currentView = this.playerStates[playerId].view;

        const planeBase = gamePlane.getChildren()[0];
        const gameOptionsBelowView = planeBase.getChildren().filter(child => {
            return child.node.coordinates2d[0][1] >= (currentView.y + currentView.h);
        });

        const gameOptionsAboveView = planeBase.getChildren().filter(child => {
            return child.node.coordinates2d[2][1] <= currentView.y;
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

                const _plane = this.getPlane();

                const currentView = Object.assign({}, this.playerStates[playerId].view);

                if (currentView.y - 100 >= 0) {
                    currentView.y -= 100;
                    this.playerStates[playerId].view = currentView;
                    this.renderGames(playerId, { searchResults, searchQuery });
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
                const _plane = this.getPlane();

                const currentView = Object.assign({}, this.playerStates[playerId].view);

                const largestOptionY = Math.max(...this.getPlane().node.children[0].node.children.map(c => c.node.coordinates2d[0][1]));

                if (currentView.y + 100 <= largestOptionY) {
                    currentView.y += 100;
                    this.playerStates[playerId].view = currentView;
                    this.renderGames(playerId, { searchResults, searchQuery });
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

        baseNode.addChild(playerSearchBox);
        if (canGoUp) {
            baseNode.addChildren(upArrow);
        }
        if (canGoDown) {
            baseNode.addChildren(downArrow);
        }

        return baseNode;
    }

    renderGames(playerId, { searchResults, searchQuery }) {
        const playerRoot = this.playerRoots[playerId];
        const playerView = this.playerStates[playerId].view;

        const searchPlaneBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        if (searchResults) {
            const transformedResults = {};
            Object.keys(searchResults).forEach(gameId => {
                transformedResults[gameId] = {
                    versions: {},
                    metadata: searchResults[gameId].metadata
                };
            })
            searchPlaneBase.addChild(this.buildGamePlane({ gameCollection: transformedResults }));
        }

        const gamePlane = searchResults ? searchPlaneBase : this.getPlane();
        
        const staticElements = this.buildStaticElements(playerId, gamePlane, searchQuery, searchResults);

        const view = ViewUtils.getView(
            gamePlane,
            playerView, 
            [playerId], 
            {
                y: 12.5 + ((100 - 12.5 - gameContainerHeight) / 2),
                x: 12.5
            },
            {
                x: gameContainerWidth / 100,
                y: gameContainerHeight / 100
            }
        );

        playerRoot.node.addChildren(staticElements, view);
    }

    downloadGame({ gameDetails, version }) {
        const { id: gameId, description, name, createdBy, createdAt } = gameDetails;
        const { versionId, location, isReviewed } = version;

        const metadataToStore = {
            version: {
                versionId,
                version: version.version,
                isReviewed
            },
            game: {
               gameId,
               description,
               name,
               createdBy,
               createdAt,
               thumbnail: gameDetails.thumbnail && gameDetails.thumbnail.indexOf('/') > 0 ? gameDetails.thumbnail.split('/')[gameDetails.thumbnail.split('/').length - 1] : gameDetails.thumbnail 
            }
        }
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
                        const indexPath = `${gamePath}/index.js`;
                    
                        currentMetadata[indexPath] = metadataToStore;
                        updateGameMetadataMap(currentMetadata);
                        this.localGames = getGameMap();

                        Object.keys(this.localGames).filter(k => this.localGames[k].metadata && this.localGames[k].metadata.thumbnail).forEach(key => {
                            this.assets[key] = new Asset({
                                'id': this.localGames[key].metadata && this.localGames[key].metadata.thumbnail,
                                'type': 'image'
                            });
                        });
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
