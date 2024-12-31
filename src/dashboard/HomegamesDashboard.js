const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

const { getConfigValue, getAppDataPath, log } = require('homegames-common');

const { Asset, Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-131');

const squishMap = require('../common/squish-map');

const decompress = require('decompress');
const gameModal = require('./game-modal');

const COLORS = Colors.COLORS;

const API_URL = getConfigValue('API_URL', 'https://api.homegames.io:443');

const parsedUrl = new URL(API_URL);
const isSecure = parsedUrl.protocol == 'https:';

const { ExpiringSet, animations } = require('../common/util');

const gameOption = require('./game-option');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

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

const SOURCE_GAME_DIRECTORY = path.resolve(`${baseDir}${path.sep}src${path.sep}games`);
const DOWNLOADED_GAME_DIRECTORY = path.join(getAppDataPath(), 'hg-games');

const updateGameMetadataMap = (newMetadata) => {
    fs.writeFileSync(DOWNLOADED_GAME_DIRECTORY + path.sep + '.metadata', JSON.stringify(newMetadata));
}

const getGameMetadataMap = () => {
    if (fs.existsSync(DOWNLOADED_GAME_DIRECTORY + path.sep + '.metadata')) {
        const bytes = fs.readFileSync(DOWNLOADED_GAME_DIRECTORY + path.sep + '.metadata');
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

if (!fs.existsSync(DOWNLOADED_GAME_DIRECTORY)) {
    try {
        fs.mkdirSync(DOWNLOADED_GAME_DIRECTORY);
    } catch (err) {
        log.error('Unable to create downloaded game directory');
        log.error(err);
    }
}

const networkHelper = {
    searchGames: (q) => new Promise((resolve, reject) => {
        getUrl(`${API_URL}/games?query=${q}`).then(response => {
            let results;
            try {
                results = JSON.parse(response);
            } catch (err) {
                log.error('Error parsing search response', err);
                reject();
            }    
            resolve(results);
        }).catch(err => {
            log.error('Error searching games', err);
            console.log(err);
            reject(err);
        });
    }),
    getGameDetails: (gameId) => new Promise((resolve, reject) => {
       getUrl(`${API_URL}/games/${gameId}`).then(response => {
            let results;
            try {
                results = JSON.parse(response);
            } catch (err) {
                log.error(err);
                reject();
            }    
            resolve(results);
        }).catch(err => {
            log.error(err);
            reject(err);
        }); 
    }), 
    getGameVersionDetails: (gameId, versionId) => new Promise((resolve, reject) => {
        getUrl(`${API_URL}/games/${gameId}/version/${versionId}`).then(response => { 
            resolve(JSON.parse(response));
        }).catch(err => {
            log.error(err.toString());
            reject(err);
        }); 
    })
};

if (!fs.existsSync(DOWNLOADED_GAME_DIRECTORY)) {
    try {
        fs.mkdirSync(DOWNLOADED_GAME_DIRECTORY);
    } catch (err) {
        console.error('Unable to create game directory');
        console.error(err);
    }
}

const getGamePathsHelper = (dir) => {
    let entries = [];
    try {
        entries = fs.readdirSync(dir);
    } catch (err) {
        console.error('Unable to read game directory');
        console.error(err);
    }
    const results = new Set();
    const processedEntries = {};

    entries.forEach(entry => {
        const entryPath = path.resolve(`${dir}${path.sep}${entry}`);

        const metadata = fs.statSync(entryPath);
        if (metadata.isFile()) {
            let isMatch = false;
            if (path.sep === '\\') {
                const regex = new RegExp(/games\\[a-zA-Z0-9-_]+\\index.js/);
                isMatch = !!regex.exec(entryPath);
            } else {
                isMatch = entryPath.match(`${path.sep}[a-zA-Z0-9\\-_]+${path.sep}index.js`);
            }

            if (isMatch) {
                if (entryPath.endsWith('index.js')) {
                    results.add(entryPath);
                }
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
        if (isLocal) {

            const gameClass = require(gamePath);

            if (!gameClass.name || !gameClass.metadata) {
                log.info('Unknown game at path ' + gamePath);
            } else {
                const gameMetadata = gameClass.metadata ? gameClass.metadata() : {};

                games[gameClass.name] = {
                    metadata: {
                        name: gameMetadata.name || gameClass.name,
                        thumbnail: gameMetadata.thumbnail,
                        thumbnailSource: gameMetadata.thumbnailSource,
                        author: gameMetadata.createdBy || 'Unknown author',
                        isTest: gameMetadata.isTest || false
                    },
                    versions: {
                        'local-game-version': {
                            gameId: gameClass.name,
                            class: gameClass,
                            metadata: {...gameMetadata },
                            gamePath,
                            versionId: 'local-game-version',
                            description: gameMetadata.description || 'No description available',
                            version: 0,
                            approved: true
                        }
                    }
                }
            }
        } else {
            const storedMetadata = gameMetadataMap[gamePath] || {};

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
                    gameId,
                    metadata: storedMetadata.version,
                    gamePath,
                    versionId,
                    version: storedMetadata.version.version,
                    approved: storedMetadata.version.approved
                };
            }
        } 
    });

    if (getConfigValue('LOCAL_GAME_DIRECTORY', null)) {
        const localGameDirString = getConfigValue('LOCAL_GAME_DIRECTORY');
        const localGameDir = path.resolve(localGameDirString);
        
        if (!fs.existsSync(localGameDirString)) {
            fs.mkdirSync(localGameDirString);
        }

        const localGamePaths = getGamePathsHelper(localGameDir);

        localGamePaths.forEach(gamePath => {
            log.info('Using local game at path ' + gamePath);
            const gameClass = require(gamePath);
            const gameMetadata = gameClass.metadata ? gameClass.metadata() : {};

            games[gameClass.name] = {
                metadata: {
                    name: gameMetadata.name || gameClass.name,
                    thumbnail: gameMetadata.thumbnail,
                    description: gameMetadata.description,
                    thumbnailSource: gameMetadata.thumbnailSource,
                    author: gameMetadata.createdBy || 'Unknown author'
                },
                versions: {
                    'local-game-version': {
                        gameId: gameClass.name,
                        class: gameClass,
                        metadata: {...gameMetadata },
                        gamePath,
                        versionId: 'local-game-version',
                        description: gameMetadata.description || 'No description available',
                        version: 0,
                        approved: true
                    }
                }
            }
        });
    }

    return games;
};

class HomegamesDashboard extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            squishVersion: '131'
        };
    }


    constructor({ movePlayer, addAsset, username, certPath }) {
        super(1000);
        // todo: static vs. addasset

        this.addAsset = addAsset;
        this.username = username;
        this.certPath = certPath;

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
        
        this.setInterval(() => {
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

            const squishVersion = referencedGame.versions[versionId].metadata.squishVersion || '1006';

            const func = fork;
            const tingEnv = process.env;

            // referenced game file needs to use our dependencies
            tingEnv.NODE_PATH = `${process.cwd()}${path.sep}node_modules`;

            const childSession = func(childGameServerPath, [], { env: { SQUISH_PATH: squishMap[squishVersion], ...tingEnv}});

            sessions[port] = childSession;

            childSession.send(JSON.stringify({
                key: gameKey,
                squishVersion,
                gamePath: referencedGame.versions[versionId].gamePath,
                port,
                player: {
                    id: playerId
                },
                username: this.username,
                certPath: this.certPath
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
                console.log('error!');
                console.log(err);
                this.sessions[sessionId] = {};
                childSession.kill();
                log.error('child session error', err);
            });
            
            childSession.on('close', (err) => {
                console.log(err);
                log.error('Child session closed');
                log.error(err);
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

        const isSourceGame = this.localGames[gameId] && this.localGames[gameId]['local-game-version'] ? true : false;

        const wat = (game, gameVersion, versions = []) => {
                    const activeSessions = Object.values(this.sessions).filter(session => {
                        return session.game === gameVersion.gameId && session.versionId === gameVersion.versionId;
                    });

                    let versionList = [];
                    if (this.localGames[gameId]) {
                        versionList = Object.values(this.localGames[gameId].versions);
                        if (versionList.filter(v => v.id === gameVersion.versionId).length === 0) {
                            versionList.push({...gameVersion});
                        }
                        
                    } else {
                        versionList = versions;
                    }
                    
                    const realVersionId = gameVersion.versionId;
                    const realVersion = versionList.filter(v => v.versionId === realVersionId)[0];

                    const description = realVersion.metadata.description;
                    
                    const modal = gameModal({ 
                        gameKey: gameId,
                        versionId: gameVersion.id,
                        activeSessions, 
                        playerId,
                        versions: versionList,
                        gameMetadata: { ...gameVersion.metadata, description }, 
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
                                }).catch(err => {
                                    log.error('Error downloading game');
                                    log.error(err);
                                });
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
            wat(this.localGames[gameId].metadata.game, this.localGames[gameId].versions['local-game-version']);
        } else {
            // todo: refactor this mess
            if (this.localGames[gameId]) {
                if (!versionId) {
                    versionId = Object.values(this.localGames[gameId].versions)[0].versionId;
                }
                const huh = this.localGames[gameId];

                const gameDetails = {
                    game: {
                        name: huh.metadata.name,
                        description: huh.metadata.description,
                        created: huh.metadata.description,
                        developerId: huh.metadata.createdBy,
                        thumbnail: huh.metadata.thumbnail,
                        id: huh.metadata.gameId
                    },
                    versions: Object.keys(huh.versions).map(k => {
                        return {
                            id: huh.versions[k].versionId,
                            published: huh.versions[k].metadata.published,
                            assetId: huh.versions[k].metadata.assetId,
                            approved: huh.versions[k].metadata.approved
                        }
                    })
                };
                    
                const gameVersion = Object.values(huh.versions)[0];
                const withMetadata = { ...gameVersion, metadata: { description: huh.metadata.description, name: huh.metadata.name, thumbnail: huh.metadata.thumbnail, author: huh.metadata.createdBy }};
                wat(gameDetails, withMetadata, gameDetails.versions.map(v => {
                    return {
                        ...v,
                        versionId: v.id,
                        metadata: {
                            published: v.published
                        }
                    }
                }));

            } else {
 
                networkHelper.getGameDetails(gameId).then(gameDetails => {

                    const innerTing = () => {
                        if (versionId) {
                            networkHelper.getGameVersionDetails(gameId, versionId).then(gameVersion => {
                                
                                const withMetadata = {...gameVersion, metadata: { description: gameVersion.description, name: gameDetails.game.name, thumbnail: gameDetails.game.thumbnail, author: gameDetails.game.developerId }};
                                const gameVersionsWithMetadata = gameDetails.versions.filter(v => v.id !== gameVersion.versionId).map(v => {
                                     return {...v, metadata: { version: v.version, description: v.description, versionId: v.id, name: gameDetails.game.name, thumbnail: gameDetails.game.thumbnail }}
                                });
                                wat(gameDetails, withMetadata, gameVersionsWithMetadata);
                            })
                        } else {
                            const gameVersion = this.localGames[gameId] ? Object.values(this.localGames[gameId].versions)[0] : Object.values(gameDetails.versions)[0];
                            const withMetadata = {...gameVersion, metadata: { description: gameDetails.game.description, name: gameDetails.game.name, thumbnail: gameDetails.game.thumbnail, author: gameDetails.game.developerId }};
                            
                            const gameVersionsWithMetadata = gameDetails.versions.filter(v => v.id !== gameVersion.versionId).map(v => {
                                 return {...v, metadata: { description: v.description, version: v.version, versionId: v.id, name: gameDetails.name, thumbnail: gameDetails.thumbnail }}
                            });

                            wat(gameDetails, withMetadata, gameVersionsWithMetadata)
                        }
                    }
                    if (!this.assets[gameId]) {
                        const asset = new Asset({
                            'id': gameDetails.game.thumbnail,
                            'type': 'image'
                        }); 

                        this.assets[gameId] = asset;    

                        this.addAsset(gameId, asset).then(() => {
                            innerTing();
                        });
                    } else {
                        innerTing();
                    }
                }).catch(err => {
                    const gameDetails = this.localGames[gameId];
                    const gameVersion = this.localGames[gameId] ? Object.values(this.localGames[gameId].versions)[0] : Object.values(gameDetails.versions)[0];
                    const withMetadata = {...gameVersion, metadata: { description: gameVersion.description, name: gameDetails.metadata.name, thumbnail: gameDetails.metadata.thumbnail, author: gameDetails.metadata.createdBy }};

                    const gameVersionsWithMetadata = Object.keys(gameDetails.versions).filter(v => v !== gameVersion.versionId).map(v => {
                         return {...v, metadata: { description: v.description, version: v.version, versionId: v.versionId, name: gameDetails.name, thumbnail: gameDetails.game.thumbnail }}
                    });

                    wat(gameDetails, withMetadata, gameVersionsWithMetadata);
                });
            }
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

        const testGamesEnabled = getConfigValue('TESTS_ENABLED', false);

        for (const key in gameCollection) {
            const xIndex = gameIndex % columnsPerPage === 0 ? 0 : ((gameIndex % columnsPerPage) / columnsPerPage) * 100; 
            const yIndex = Math.floor(gameIndex / rowsPerPage) * (100 / rowsPerPage);
            let assetKey = this.assets[key] ? key : 'default';

            const gameMetadata = gameCollection[key]?.metadata || null;

            if (!testGamesEnabled && gameMetadata && gameMetadata.isTest) {
                continue;
            }

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

            let { gameId, versionId } = requestedGame;
            
            const lowerCaseToOriginalKey = {};
            Object.keys(this.localGames).forEach(k => {
                lowerCaseToOriginalKey[k.toLowerCase()] = k;
            });
            if (lowerCaseToOriginalKey[gameId.toLowerCase()] && this.localGames[lowerCaseToOriginalKey[gameId.toLowerCase()]].versions?.['local-game-version']) {
                this.showGameModalNew(playerId, lowerCaseToOriginalKey[gameId.toLowerCase()], 'local-game-version');
            } else {
                if (this.localGames[gameId]) {
                    if (!versionId) {
                        versionId = Object.values(this.localGames[gameId].versions)[0].versionId;
                    }
                    this.showGameModalNew(playerId, gameId, versionId);
                } else {
                    networkHelper.getGameDetails(gameId).then(gameDetails => {
                        if (!versionId) {
                            if (gameDetails.versions.length > 0) {
                                versionId = gameDetails.versions[gameDetails.versions.length - 1].id;
                            }
                        }
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
                                    'id': gameDetails.game.thumbnail,
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
                    }).catch(err => {
                        log.error(err);
                    });
                }
            }
        }
    }

    handleSearch(playerId) {
        const query = this.playerStates[playerId].query;

        if (!query) {
            this.renderGames(playerId, {});
            return;
        }

        const playerView = {x: 0, y: 0, w: 100, h: 100};

        this.playerStates[playerId] = {
            view: playerView
        };

        const games = {};

        const localGameData = this.localGames;

        for (let key in localGameData) {
            const localGameMetadata = localGameData[key].metadata;
            const keyMatches = key.toLowerCase().indexOf(query.toLowerCase()) >= 0;
            const nameMatches = localGameMetadata.name && localGameMetadata.name.toLowerCase().indexOf(query.toLowerCase()) >= 0;
            if (keyMatches || nameMatches) {
                games[key] = {
                    metadata: {
                        name: localGameMetadata.name || key,
                        author: localGameMetadata.author,
                        thumbnail: localGameMetadata.thumbnail,
                        thumbnailSource: localGameMetadata.thumbnailSource
                    }
                }
            }
        }

        let processedEntries = 0;

        networkHelper.searchGames(query).then(results => {
            if (!results.games || !results.games.length) {
                this.renderGames(playerId, { searchResults: games, searchQuery: query });
            } else {
                results.games.forEach(game => {
                    const thumbnailId = game.thumbnail.indexOf('/') > 0 ? game.thumbnail.split('/')[game.thumbnail.split('/').length  - 1] : game.thumbnail; 

                    games[game.id] = {
                        metadata: {
                            name: game.name,
                            author: game.developerId,
                            thumbnail: thumbnailId,
                            description: game.description || ''
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

        }).catch(err => {
            this.renderGames(playerId, { searchResults: games, searchQuery: query });
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
                size: 1.8
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
        const { id: gameId, description, name, developerId: createdBy, created: createdAt, thumbnail } = gameDetails.game;
        const { id: versionId, assetId, approved, published } = version;
        const location = `${API_URL}/assets/${assetId}`;

        const metadataToStore = {
            version: {
                versionId,
                version: version.version,
                approved,
                squishVersion: version.squishVersion,
                published
            },
            game: {
               gameId,
               name,
               description,
               createdBy,
               createdAt,
               thumbnail
            }
        }

        return new Promise((resolve, reject) => {
            const gamePath = `${DOWNLOADED_GAME_DIRECTORY}${path.sep}${gameId}${path.sep}${versionId}`;
            const zipPath = `${DOWNLOADED_GAME_DIRECTORY}${path.sep}${gameId}${path.sep}${versionId}.zip`;

            if (!fs.existsSync(`${DOWNLOADED_GAME_DIRECTORY}${path.sep}${gameId}`)) {
                fs.mkdirSync(`${DOWNLOADED_GAME_DIRECTORY}${path.sep}${gameId}`);
            }

            const zipWriteStream = fs.createWriteStream(zipPath);
            
            zipWriteStream.on('close', () => {
                decompress(zipPath, gamePath).then((files) => {
                        const currentMetadata = getGameMetadataMap();
		        const foundIndex = files.filter(f => f.type === 'file' && f.path.endsWith('index.js'))[0];
                        const indexPath = path.join(gamePath, foundIndex.path);//`${gamePath}${path.sep}index.js`;
                    
                        currentMetadata[indexPath] = metadataToStore;
                        updateGameMetadataMap(currentMetadata);
                        this.localGames = getGameMap();

                        Object.keys(this.localGames).filter(k => this.localGames[k].metadata && this.localGames[k].metadata.thumbnail).forEach(key => {
                            this.assets[key] = new Asset({
                                'id': this.localGames[key].metadata && this.localGames[key].metadata.thumbnail,
                                'source': this.localGames[key].metadata && this.localGames[key].metadata.thumbnailSource,
                                'type': 'image'
                            });
                        });
                        resolve(indexPath);
                });
            });

            (API_URL.startsWith('https') ? https : http).get(location, (res) => {
                res.pipe(zipWriteStream);
                zipWriteStream.on('finish', () => {
                    zipWriteStream.close();
                });
            });
        });
    }

    handlePlayerDisconnect(playerId) {
        const playerViewRoot = this.playerRoots[playerId] && this.playerRoots[playerId].node;
        if (playerViewRoot) {
            const node = playerViewRoot.node;
            this.playerRootNode.removeChild(node.id);
            delete this.playerRoots[playerId];
        }
    }
    
}

module.exports = HomegamesDashboard;
