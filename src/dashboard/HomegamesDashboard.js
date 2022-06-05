const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0750');

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

const getGamePaths = () => {
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

        console.log('okay for this thing i have this');
        console.log(gamePath);
        console.log(gameMetadata);
        console.log(storedMetadata);
        if (isLocal) {
            games[gameClass.name] = {
                metadata: {
                    name: gameMetadata.name || gameClass.name,
                    thumbnail: gameMetadata.thumbnail,
                    description: gameMetadata.description || 'No description available'
                },
                versions: {
                    0: {
                        class: gameClass,
                        metadata: {...gameMetadata,isReviewed: true},
                        gamePath,
                        versionId: 0,
                    }
                }
            }
        } else {
            console.log('found an no ndd what is thisss3');
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
                    metadata: storedMetadata.version,
                    gamePath,
                    versionId
                };
            }
        }
        // console.log(gameMetadataMap);

        // const metadata = isLocal ? gameMetadata : storedMetadata;// :// { ...gameMetadata, ...storedMetadata }
        // // metadata.path = gamePath;
        
        //     // console.log("what do d");
        //     // console.log(storedMetadata);
        //     // console.log(metadata);

        // let gameKey;
        // if (isLocal) {
        //     gameKey = gameClass.name;
        // } else {
        //     gameKey = metadata.game.gameId;
        // }

        // if (!games[gameKey]) {

        //     const metadataToInsert = isLocal ? { game: metadata, version: {version: 0} } : metadata;
        //     games[gameKey] = {
        //         metadata: metadataToInsert,
        //         versions: {}
        //     };
        // }

        // // versioning not supported for source games
        // if (isLocal) {
        //     games[gameKey].versions[0] = {
        //         class: gameClass,
        //         metadata,
        //         gamePath
        //     }
        // } else {
        //     games[gameKey].versions[metadata.version.versionId] = {
        //         class: gameClass,
        //         metadata,
        //         gamePath
        //     }
        // }

        // if (!games[gameKey]) {
        //     games[gameKey] = { class: gameClass, metadata };
        // } else {
        //     games[`${gameKey}_${suffixCount++}`] = { class: gameClass, metadata };
        // }
    });

    return games;
};

const getGameMap = () => {
    console.log("THIS IS THE THANG");
    console.log(getGamePaths());
    return getGamePaths();
    // const games = {};
    // const gamePaths = getGamePaths();
    // for (const gameKey in gamePaths) {
    //     const gameClass = gamePaths[gameKey].class;
    //     console.log('stuff and metadata');
    //     console.log(gamePaths[gameKey].metadata);
    //     const metadata = gamePaths[gameKey].metadata;
    //     if (metadata.thumbnail) {
    //         // todo: fix this hack
    //         if (metadata.thumbnail.indexOf('/') > 0) {
    //             metadata.thumbnail = metadata.thumbnail.split('/')[metadata.thumbnail.split('/').length - 1];
    //         }
    //     }
    //     games[gameKey] = { gameClass: gameClass, metadata };//: gamePaths[gameKey].metadata }; 
    // }

    // return games;
}

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

        console.log('initializing assets here');
        console.log(this.localGames);

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

        const childSession = fork(childGameServerPath);

        sessions[port] = childSession;

        if (this.localGames[gameKey]) {
            const referencedGame = this.localGames[gameKey];

            const squishVersion = referencedGame.metadata.squishVersion;
            console.log('watttt ' + versionKey);
            console.log(referencedGame)
            const versionId = versionKey || Object.keys(referencedGame.versions)[Object.keys(referencedGame.versions).length - 1];
            console.log('version id is ' + versionId)
            console.log('the fckckc');
            console.log(referencedGame.versions);
            childSession.send(JSON.stringify({
                key: gameKey,
                squishVersion,
                gamePath: referencedGame.versions[versionId].gamePath,//this.localGames[gameKey].metadata.path,
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


        const isLocal = this.localGames[gameId] && this.localGames[gameId].versions[0] ? true : false;
        const wat = (game, gameVersion) => {
                    console.log('need to do something with verison');
                    console.log(gameVersion);
                    const activeSessions = Object.values(this.sessions).filter(session => {
                        return session.game === gameVersion.gameId && session.versionId === gameVersion.versionId;
                    });

                    console.log('need to get list of versions from here: ');
                    console.log(this.localGames[gameId].versions);

                    // const v

                    const modal = gameModal({ 
                        gameKey: gameId,
                        versionId: gameVersion.versionId,
                        activeSessions, 
                        playerId,
                        versions: Object.values(this.localGames[gameId].versions),
                        gameMetadata: {}, 
                        onVersionChange: (newVersionId) => {
                            this.showGameModalNew(playerId, gameId, newVersionId);
                            // currentVersionId = newVersionId;
                            // const newModal = createModal({ gameId, versionId: newVersionId, onCreateSession });
                            // playerRoot.removeChild(modal.id);
                            // playerRoot.addChild(newModal);

                        },
                        onJoinSession: (session) => {
                            this.joinSession(playerId, session);
                        },
                        onCreateSession: () => {
                            console.log('starting session');
                            console.log(this.localGames[gameId]);
                            console.log(gameVersion);
                            if (this.localGames[gameId]?.versions[gameVersion.versionId]) {
                                console.log('i have that locally already');
                                this.startSession(playerId, gameId, gameVersion.versionId);

                            } else {
                                this.downloadGame({ gameDetails: game, version: gameVersion }).then(() => {
                                    console.log('downloaded gameeememe');
                                    this.renderGamePlane();
                                    this.startSession(playerId, gameId, gameVersion.versionId);
                                })
                            }
                            console.log('you want to start session with game version ' + gameVersion.versionId)
                            // this.startSession(playerId, gameId, sessionVersionId);
                        },//onCreateSession(versionId),
                        onClose: () => {
                            playerRoot.removeChild(modal.node.id);  
                        }
                    });

                    if (this.playerModals[playerId]) {
                        playerRoot.removeChild(this.playerModals[playerId]);
                        // this.playerModals[playerId] = null;
                    }

                    this.playerModals[playerId] = modal.node.id;
                    playerRoot.addChild(modal);


            }
        if (isLocal) {
            console.log('this is a source game');
            console.log('wattt');
            console.log(this.localGames[gameId].metadata.game);
            console.log(this.localGames[gameId].versions[0]);
            wat(this.localGames[gameId].metadata.game, this.localGames[gameId].versions[0]);
            // this.startSession(playerId, gameId, this.localGames[gameId].versions[0]);
        } else {
            networkHelper.getGameDetails(gameId).then(gameDetails => {
                if (versionId) {
                    networkHelper.getGameVersionDetails(gameId, versionId).then(gameVersion => {
                        wat(gameDetails, gameVersion);
                    })
                } else {
                    const gameVersion = Object.values(gameDetails.versions)[0];
                    wat(gameDetails, gameVersion)
                }

        });
        }
        // console.log('you want to show a game modal for game ' + gameId + ', version ' + versionId + ' for player ' + playerId);
    }

    showGameModal(gameCollection, playerId, gameKey, versionKey = null) {
        console.log('this is game collection');
        console.log(gameCollection);
        const playerRoot = this.playerRoots[playerId].node;

        const gameMetadata = gameCollection[gameKey].metadata || {};

        const _versionId = versionKey || this.localGames[gameKey] && Object.keys(this.localGames[gameKey].versions)[0];

        const versionList = [];

        // unpublished games do not have version numbers
        let nullVersionCounter = 0;
        if (this.localGames[gameKey]) {
            for (const versionId in this.localGames[gameKey].versions) {
                const gameVersionData = this.localGames[gameKey].versions[versionId];
                
                const versionNumber = this.localGames[gameKey].metadata.version.version >= 0 ? this.localGames[gameKey].metadata.version.version : -1 * ++nullVersionCounter;
                // console.log('need to know if thisi s appeepe');
                // console.log(this.localGames[gameKey].metadata);
                versionList.push({
                    version: versionNumber,
                    versionId,
                    // isReviewed: 
                })
            }
        }

        const thang = (gameDetails, versionDetails) => {


            const fetchedVersions = gameDetails.versions;
            for (const index in fetchedVersions) {
                const fetchedVersion = fetchedVersions[index];
                if (versionList.filter(v => v.versionId === fetchedVersion.versionId ).length === 0) {
                //     console.log('need to know if thisi s appeepff 22222e');
                // console.log(fetchedVersion);
                    versionList.push({
                        version: fetchedVersion.version,
                        versionId: fetchedVersion.versionId,
                        isReviewed: !!fetchedVersion.isReviewed || false
                    });
                }
            }
            // console.log(fetchedVersions)
            // console.log("VERSION LIST");
            // console.log(versionList);
            let currentVersionId = _versionId;
            const createModal = ({ gameId, versionId, onCreateSession }) => {

                console.log('creating create modal for version ' + gameId + ', ' + versionId);
                const activeSessions = Object.values(this.sessions).filter(session => {
                    return session.game === gameKey && session.versionId === versionId;
                });

                const modal = gameModal({ 
                    gameKey: gameId,
                    versionId,
                    activeSessions, 
                    playerId,
                    versions: versionList,
                    gameMetadata, 
                    onVersionChange: (newVersionId) => {
                        currentVersionId = newVersionId;
                        const newModal = createModal({ gameId, versionId: newVersionId, onCreateSession });
                        playerRoot.removeChild(modal.id);
                        playerRoot.addChild(newModal);

                    },
                    onJoinSession: (session) => {
                        this.joinSession(playerId, session);
                    },
                    onCreateSession: () => onCreateSession(versionId),
                    onClose: () => {
                        playerRoot.removeChild(modal.node.id);  
                    }
                });

                return modal;
            }

            console.log("THE VERSION ID IS " + _versionId)
            if (_versionId === '0') {//} || (this.localGames[gameKey] && this.localGames[gameKey].versions[_versionId])) {
                console.log('what the fuck mane');
                const modal = createModal({ gameId: gameKey, versionId: _versionId, onCreateSession: (sessionVersionId) => {
                console.log('what the fuck mane 420 ' + sessionVersionId);

                const fullVersionMap = {};
                for (const versionIndex in gameDetails.versions) {
                    const versionData = gameDetails.versions[versionIndex];
                    const versionId = versionData.versionId;
                    fullVersionMap[versionId] = versionData;
                    versionList.push({
                        version: versionData.version,
                        versionId: versionData.versionId
                    });
                }

                const isPublic = gameDetails.isPublic;

                console.log("GAME DETAILS ");
                console.log(gameDetails);

                const _version = versionList.filter(v => v.versionId === sessionVersionId);

                // const gameId = gameDetails.id;
                const versionId = _version.versionId;

                console.log('ayo');
                console.log(sessionVersionId + ", " + gameKey + ", " + playerId)
                    // this.downloadGame( { gameDetails, version: fullVersionMap[sessionVersionId] }).then(gamePath => {
                    //     this.localGames = getGameMap();

                    //     Object.keys(this.localGames).filter(k => this.localGames[k].metadata && this.localGames[k].metadata.thumbnail).forEach(key => {
                    //         this.assets[key] = new Asset({
                    //             'id': this.localGames[key].metadata && this.localGames[key].metadata.thumbnail,
                    //             'type': 'image'
                    //         });
                    //     });

                        this.startSession(playerId, gameKey, sessionVersionId);
                    // });
                    // this.startSession(playerId, gameKey, sessionVersionId);
                }});
                playerRoot.addChild(modal);
            } else {

                const fullVersionMap = {};
                for (const versionIndex in gameDetails.versions) {
                    const versionData = gameDetails.versions[versionIndex];
                    const versionId = versionData.versionId;
                    fullVersionMap[versionId] = versionData;
                    versionList.push({
                        version: versionData.version,
                        versionId: versionData.versionId
                    });
                }

                if (versionDetails && versionList.filter(v => v.versionId === versionDetails.versionId).length === 0) {
                    versionList.push({
                        version: versionDetails.version,
                        versionId: versionDetails.versionId
                    })
                } 

                const isPublic = gameDetails.isPublic;

                console.log("GAME DETAILS ");
                console.log(gameDetails);

                const _version = versionKey ? versionList.filter(v => v.versionId === versionKey)[0] : versionList[0];

                const gameId = gameDetails.id;
                const versionId = versionDetails ? versionDetails.versionId : _version.versionId;
                const modal = createModal({ gameId, versionId, onCreateSession: (sessionVersionId) => {

                    console.log("DOWNLOADddddING GAME VERS");
                    console.log(currentVersionId || _version.versionId);
                    console.log(currentVersionId);
                    console.log(_version.versionId);
                    this.downloadGame( { gameDetails, version: fullVersionMap[currentVersionId || _version.versionId] || versionDetails}).then(gamePath => {
                        console.log('downloaded version to path ' + gamePath);
                        console.log(versionDetails);
                        console.log(fullVersionMap[currentVersionId || _version.versionId]);
                        this.localGames = getGameMap();

                        console.log('okay now local gamesssss is');
                        console.log(this.localGames);
                        this.renderGamePlane();

                        Object.keys(this.localGames).filter(k => this.localGames[k].metadata && this.localGames[k].metadata.thumbnail).forEach(key => {
                            this.assets[key] = new Asset({
                                'id': this.localGames[key].metadata && this.localGames[key].metadata.thumbnail,
                                'type': 'image'
                            });
                        });

                        this.startSession(playerId, gameId, currentVersionId || _version.versionId);
                    });
                }});

                playerRoot.addChild(modal);        
            }
        }

        if (_versionId === '0') {
            thang(this.localGames[gameKey].metadata.game)
        } else {
            networkHelper.getGameDetails(gameKey).then(gameDetails => {
                networkHelper.getGameVersionDetails(gameKey, _versionId).then((versionDetails) => {
                    console.log('version details');
                    console.log(versionDetails);
                    thang(gameDetails, versionDetails);
                });
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

                    console.log('player requested a game');
                    console.log(gameDetails)

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

                    
                // this.downloadGame( { gameDetails, version }).then(gamePath => {
                // this.localGames = getGameMap();

                // this.renderGamePlane();
                // this.renderGames(playerId, {})


                // Object.keys(this.localGames).filter(k => this.localGames[k].metadata && this.localGames[k].metadata.thumbnail).forEach(key => {
                //     this.assets[key] = new Asset({
                //         'id': this.localGames[key].metadata && this.localGames[key].metadata.thumbnail,
                //         'type': 'image'
                //     });
                // });

                // // this.startSession(playerId, gameId, currentVersionId || _version.versionId);
                //     // this.localGames = getGameMap();

                //     // Object.keys(this.localGames).filter(k => this.localGames[k].metadata && this.localGames[k].metadata.thumbnail).forEach(key => {
                //     //     this.assets[key] = new Asset({
                //     //         'id': this.localGames[key].metadata && this.localGames[key].metadata.thumbnail,
                //     //         'type': 'image'
                //     //     });
                //     // });

                //     // this.renderGamePlane();
                //     // this.renderGames(playerId, {})
            //     // });
            //     }
            // });
    //     }
    // }

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

                    console.log('the fuckckckck');
                    console.log(game);

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
            console.log('results')
            console.log(searchResults);
            const transformedResults = {};
            Object.keys(searchResults).forEach(gameId => {
                console.log('mapping this result');
                // console.log(result);
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
                version: version.version
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
