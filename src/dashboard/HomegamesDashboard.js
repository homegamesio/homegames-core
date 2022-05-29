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

const gameOption = require('./game-option');

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

        const plane = this.buildGamePlane({ gameCollection: this.localGames, width: 80, height: 80 });
        this.getPlane().addChild(plane);

        this.playerViews = {};
        this.playerStates = {};
        this.playerRoots = {};
        

        const testNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.ORANGE,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000)
        });

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
        const playerRoot = this.playerRoots[playerId].node;

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
                    playerRoot.removeChild(modal.node.id);  
                }
            });

            playerRoot.addChild(modal);
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

                    if (metad && metad.thumbnail && !this.assets[metad.thumbnail]) {
                        console.log('neeeed to addd ' + metad.thumbnail);
                        // this.assets[metad.thumbnail] = 
                    }
                    
                    const newPlane = this.buildGamePlane({ gameCollection: this.localGames });

                    this.getPlane().clearChildren();
                    this.getPlane().addChild(newPlane);

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
                            playerRoot.removeChild(modal.node.id);  
                        }
                    });

                    playerRoot.addChild(modal);
                });
                
            })
        }
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
            const assetKey = gameCollection[key].metadata && gameCollection[key].metadata.thumbnail ? key : 'default';
            const gameName = gameCollection[key].metadata && gameCollection[key].metadata.name || key;

            const gameOptionNode = gameOption({
                x: xIndex,
                y: yIndex,
                width: gameOptionWidth,
                height: gameOptionHeight,
                gameName,
                assetKey,
                onClick: (playerId) => {
                    this.showGameModal(gameCollection, playerId, key);
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

        const playerView = {x: 0, y: 0, w: 100, h: 100};

        this.playerStates[playerId] = {
            view: playerView
        };

        networkHelper.searchGames(query).then(results => {
            const games = {};
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
                    this.assets[game.id] = new Asset({
                        'id': thumbnailId,
                        'type': 'image'
                    }); 
                }
            });

            this.renderGames(playerId, { searchResults: games, searchQuery: query });
        })
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
            input: {
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
                text: searchQuery || 'Search',
                color: SEARCH_TEXT_COLOR,
                size:1.8
            },
            playerIds: [playerId]
        });

        playerSearchBox.addChild(playerSearchText);

        let canGoDown, canGoUp = false;

        const baseHeight = this.base.node.coordinates2d[2][1];

        const currentView = this.playerStates[playerId].view;

        const planeBase = gamePlane.getChildren()[0];
        const gameOptionsBelowView = planeBase.getChildren().filter(child => {
            return child.node.coordinates2d[0][1] > (currentView.y + currentView.h);
        });

        const gameOptionsAboveView = planeBase.getChildren().filter(child => {
            return child.node.coordinates2d[2][1] < currentView.y;
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
        console.log('rendering for player id ' +playerId);
        console.log(searchResults);
        console.log(searchQuery);
        
        const playerRoot = this.playerRoots[playerId];
        const playerView = this.playerStates[playerId].view;

        const searchPlaneBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        if (searchResults) {
            searchPlaneBase.addChild(this.buildGamePlane({ gameCollection: searchResults }));
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
