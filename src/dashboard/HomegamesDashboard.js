const path = require('path');
const fs = require('fs');

const { getConfigValue, getAppDataPath, log } = require('homegames-common');

const { Asset, Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-135');

const squishMap = require('../common/squish-map');

const gameModal = require('./game-modal');

const COLORS = Colors.COLORS;

const API_URL = getConfigValue('API_URL', 'https://api.homegames.io:443');

const parsedUrl = new URL(API_URL);
const isSecure = parsedUrl.protocol == 'https:';

const { ExpiringSet, animations } = require('../common/util');

const gameOption = require('./game-option');

const { createCatalogClient } = require('../catalog/CatalogClient');
const { createLocalLibrary } = require('../library/LocalLibrary');
const { createInstaller } = require('../library/Installer');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}



const IS_DEMO = getConfigValue('IS_DEMO', true);

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

const networkHelper = createCatalogClient({ apiUrl: API_URL });

const localLibrary = createLocalLibrary({
    sourceGameDir: SOURCE_GAME_DIRECTORY,
    downloadedGameDir: DOWNLOADED_GAME_DIRECTORY,
    localGameDir: getConfigValue('LOCAL_GAME_DIRECTORY', null),
});

localLibrary.ensureDirs();

class HomegamesDashboard extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            squishVersion: '135'
        };
    }


    constructor({ movePlayer, addAsset, username, certPath, gameSessionManager, catalogClient, localLibrary: injectedLibrary }) {
        super(1000);
        // todo: static vs. addasset

        // Catalog client and local library are injectable for testing; they
        // default to the module-level instances (real API + app-data dir). The
        // installer shares both so installs hit the same (possibly mocked) deps.
        this.networkHelper = catalogClient || networkHelper;
        this.localLibrary = injectedLibrary || localLibrary;
        this.installer = createInstaller({ catalogClient: this.networkHelper, localLibrary: this.localLibrary });

        this.addAsset = addAsset;
        this.username = username;
        this.certPath = certPath;
        this.gameSessionManager = gameSessionManager;

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
        this.playerDownloadOverlays = {};

        this.movePlayer = movePlayer;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000),
            fill: BASE_COLOR
        });

        this.localGames = this.localLibrary.scan();

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
        if (!this.localGames[gameKey]) return;

        const referencedGame = this.localGames[gameKey];
        const versionId = versionKey || Object.keys(referencedGame.versions)[Object.keys(referencedGame.versions).length - 1];
        const version = referencedGame.versions[versionId];

        // Configure the session manager with current username/certPath
        this.gameSessionManager.username = this.username;
        this.gameSessionManager.certPath = this.certPath;

        this.gameSessionManager.startSession(
            { gamePath: version.gamePath, gameKey },
            {
                playerId,
                onReady: (session) => {
                    log.info(`[Dashboard] onReady fired for session ${session.id} on port ${session.port}, moving player ${playerId}`);
                    this.movePlayer({ playerId, port: session.port });
                },
            }
        ).then((result) => {
            const { sessionId, port } = result;

            this.sessions[sessionId] = {
                id: sessionId,
                game: gameKey,
                versionId,
                port,
                sendMessage: () => {},
                getPlayers: (cb) => {
                    this.gameSessionManager.requestFromSession(sessionId, 'getPlayers').then(payload => {
                        cb && cb(payload);
                    });
                },
                sendHeartbeat: () => {
                    this.gameSessionManager.sendToSession(sessionId, { type: 'heartbeat' });
                },
                players: [],
            };
        }).catch((err) => {
            log.error('Failed to start game session');
            log.error(err);
        });
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
                            console.log('ayooo1');
                            if (this.localGames[gameId]?.versions[gameVersion.versionId]) {
                                console.log('ayooo2');
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
 
                this.networkHelper.getGameDetails(gameId).then(gameDetails => {

                    const innerTing = () => {
                        if (versionId) {
                            this.networkHelper.getGameVersionDetails(gameId, versionId).then(gameVersion => {
                                
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

    buildGamePlane({ gameCollection, rowsPerPage = 2, columnsPerPage = 2, onGameClick = null }) {

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
                    if (onGameClick) {
                        onGameClick(playerId, key);
                    } else {
                        this.showGameModalNew(playerId, key);
                    }
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
                    this.networkHelper.getGameDetails(gameId).then(gameDetails => {
                        if (!versionId) {
                            if (gameDetails.versions.length > 0) {
                                versionId = gameDetails.versions[gameDetails.versions.length - 1].id;
                            }
                        }
                        this.networkHelper.getGameVersionDetails(gameId, versionId).then(version => {
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

        this.networkHelper.searchGames(query).then(results => {
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

    // Enter Browse mode and load the first page of the remote catalog.
    handleBrowse(playerId, { reset = true } = {}) {
        this.playerStates[playerId].view = { x: 0, y: 0, w: 100, h: 100 };

        if (reset || !this.playerStates[playerId].browse) {
            this.playerStates[playerId].browse = {
                offset: 0,
                limit: 12,
                results: {},
                loading: true,
                error: false,
                exhausted: false
            };
        } else {
            this.playerStates[playerId].browse.loading = true;
        }

        this.renderGames(playerId, { browse: true });
        this._fetchCatalogPage(playerId);
    }

    loadMoreCatalog(playerId) {
        const browseState = this.playerStates[playerId].browse;
        if (!browseState || browseState.loading || browseState.exhausted) return;
        browseState.loading = true;
        this.renderGames(playerId, { browse: true });
        this._fetchCatalogPage(playerId);
    }

    // Fetch the next catalog page, merge results, register thumbnails, re-render.
    // Guards against the player having left Browse mode mid-request.
    _fetchCatalogPage(playerId) {
        const browseState = this.playerStates[playerId].browse;
        if (!browseState) return;

        const stillBrowsing = () => this.playerStates[playerId] && this.playerStates[playerId].browse === browseState;

        this.networkHelper.list({ offset: browseState.offset, limit: browseState.limit }).then(response => {
            if (!stillBrowsing()) return;

            const games = (response && response.games) || [];
            const registrations = [];

            games.forEach(game => {
                const thumbnailId = (game.thumbnail && game.thumbnail.indexOf('/') > 0)
                    ? game.thumbnail.split('/')[game.thumbnail.split('/').length - 1]
                    : game.thumbnail;

                browseState.results[game.id] = {
                    metadata: {
                        name: game.name,
                        author: game.developerId,
                        thumbnail: thumbnailId,
                        description: game.description || ''
                    }
                };

                if (thumbnailId && !this.assets[game.id]) {
                    const asset = new Asset({ id: thumbnailId, type: 'image' });
                    this.assets[game.id] = asset;
                    registrations.push(this.addAsset(game.id, asset).catch(() => {}));
                }
            });

            browseState.offset += games.length;
            browseState.loading = false;
            if (games.length < browseState.limit) {
                browseState.exhausted = true;
            }

            Promise.all(registrations).then(() => {
                if (stillBrowsing()) this.renderGames(playerId, { browse: true });
            });
        }).catch(err => {
            log.error('Failed to load catalog');
            log.error(err);
            if (!stillBrowsing()) return;
            browseState.loading = false;
            browseState.error = true;
            browseState.exhausted = true;
            this.renderGames(playerId, { browse: true });
        });
    }

    exitBrowse(playerId) {
        this.playerStates[playerId].browse = null;
        this.playerStates[playerId].view = { x: 0, y: 0, w: 100, h: 100 };
        this.renderGames(playerId, {});
    }

    // Auto download-then-play a catalog game. If it's already installed locally,
    // just start it; otherwise fetch details, download with a progress overlay,
    // then start the session.
    playCatalogGame(playerId, gameId) {
        if (this.localGames[gameId] && this.localGames[gameId].versions && Object.keys(this.localGames[gameId].versions).length > 0) {
            this.startSession(playerId, gameId);
            return;
        }

        this.showDownloadProgress(playerId, gameId, null);

        // Studio/Forgejo-published games have no asset zip; their source lives in
        // git, fetched by commitSha. Pull the published versions for the commit,
        // install from source, then play.
        Promise.all([
            this.networkHelper.getGameDetails(gameId),
            this.networkHelper.getPublishedVersions(gameId)
        ]).then(([gameDetails, published]) => {
            const versions = (published && published.versions) || [];
            if (versions.length === 0) {
                throw new Error('Game has no published versions');
            }
            const latest = versions.reduce((a, b) => ((b.publishedAt || 0) > (a.publishedAt || 0) ? b : a));
            const displayName = (gameDetails.game && gameDetails.game.name) || gameId;

            return this.installer.installFromSource({
                gameId,
                game: gameDetails.game,
                versionId: latest.versionId,
                commitSha: latest.commitSha,
                onProgress: (p) => {
                    const pct = (p && p.total) ? Math.floor((100 * p.received) / p.total) : null;
                    this.showDownloadProgress(playerId, displayName, pct);
                }
            }).then(({ versionId }) => {
                this.localGames = this.localLibrary.scan();
                this._registerLocalThumbnails();
                this.clearDownloadProgress(playerId);
                this.startSession(playerId, gameId, versionId);
            });
        }).catch(err => {
            log.error('Failed to download and play catalog game');
            log.error(err);
            this.showDownloadError(playerId, gameId);
        });
    }

    _removeDownloadOverlay(playerId) {
        const playerRootNode = this.playerRoots[playerId] && this.playerRoots[playerId].node;
        const existing = this.playerDownloadOverlays[playerId];
        if (playerRootNode && existing) {
            playerRootNode.removeChild(existing);
        }
        this.playerDownloadOverlays[playerId] = null;
    }

    // Full-screen dimmed overlay with a "Downloading … N%" box. Re-rendered (swap)
    // on each progress update via the tracked overlay node id.
    showDownloadProgress(playerId, name, pct) {
        const playerRootNode = this.playerRoots[playerId] && this.playerRoots[playerId].node;
        if (!playerRootNode) return;

        this._removeDownloadOverlay(playerId);

        const overlay = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            playerIds: [playerId],
            fill: [0, 0, 0, 200]
        });

        const box = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(25, 40, 50, 20),
            playerIds: [playerId],
            fill: BASE_COLOR
        });

        const label = (pct === null || pct === undefined)
            ? `Downloading ${name}…`
            : `Downloading ${name}… ${pct}%`;

        box.addChild(new GameNode.Text({
            textInfo: {
                x: 50,
                y: 48,
                align: 'center',
                size: 1.8,
                text: label,
                color: DASHBOARD_TEXT_COLOR
            },
            playerIds: [playerId]
        }));

        overlay.addChild(box);
        playerRootNode.addChild(overlay);
        this.playerDownloadOverlays[playerId] = overlay.node.id;
    }

    clearDownloadProgress(playerId) {
        this._removeDownloadOverlay(playerId);
    }

    showDownloadError(playerId, name) {
        const playerRootNode = this.playerRoots[playerId] && this.playerRoots[playerId].node;
        if (!playerRootNode) return;

        this._removeDownloadOverlay(playerId);

        const overlay = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            playerIds: [playerId],
            fill: [0, 0, 0, 200],
            onClick: (pid) => this._removeDownloadOverlay(pid)
        });

        const box = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(25, 40, 50, 20),
            playerIds: [playerId],
            fill: BASE_COLOR
        });

        box.addChild(new GameNode.Text({
            textInfo: {
                x: 50,
                y: 47,
                align: 'center',
                size: 1.5,
                text: `Couldn't download ${name}. Tap to dismiss.`,
                color: DASHBOARD_TEXT_COLOR
            },
            playerIds: [playerId]
        }));

        overlay.addChild(box);
        playerRootNode.addChild(overlay);
        this.playerDownloadOverlays[playerId] = overlay.node.id;
    }

    buildStaticElements(playerId, gamePlane, searchQuery = '', searchResults = null, browse = false) {
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

        // Browse / Back toggle (left of the search box). Available regardless of
        // demo mode, since browsing the catalog needs no text input.
        const browseToggle = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0.5, 2.5, 11, 10),
            playerIds: [playerId],
            fill: SEARCH_BOX_COLOR,
            onClick: (pid) => {
                if (browse) {
                    this.exitBrowse(pid);
                } else {
                    this.handleBrowse(pid);
                }
            }
        });
        browseToggle.addChild(new GameNode.Text({
            textInfo: {
                x: 6,
                y: 5.5,
                align: 'center',
                size: 1.4,
                text: browse ? '◀ Back' : 'Browse',
                color: BASE_COLOR
            },
            playerIds: [playerId]
        }));
        baseNode.addChild(browseToggle);

        if (browse) {
            const browseState = this.playerStates[playerId].browse || {};

            // Status line for loading / error / empty catalog.
            let statusText = null;
            if (browseState.error) {
                statusText = 'Could not reach the catalog. Showing what is available offline.';
            } else if (browseState.loading && Object.keys(browseState.results || {}).length === 0) {
                statusText = 'Loading catalog…';
            } else if (!browseState.loading && Object.keys(browseState.results || {}).length === 0) {
                statusText = 'No games found in the catalog.';
            }

            if (statusText) {
                baseNode.addChild(new GameNode.Text({
                    textInfo: {
                        x: 50,
                        y: 50,
                        align: 'center',
                        size: 1.6,
                        text: statusText,
                        color: DASHBOARD_TEXT_COLOR
                    },
                    playerIds: [playerId]
                }));
            }

            // "Load more" pulls the next page; hidden once the catalog is exhausted.
            if (!browseState.exhausted && Object.keys(browseState.results || {}).length > 0) {
                const loadMore = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(42.5, 91, 15, 7),
                    playerIds: [playerId],
                    fill: SEARCH_BOX_COLOR,
                    onClick: (pid) => this.loadMoreCatalog(pid)
                });
                loadMore.addChild(new GameNode.Text({
                    textInfo: {
                        x: 50,
                        y: 93,
                        align: 'center',
                        size: 1.3,
                        text: browseState.loading ? 'Loading…' : 'Load more',
                        color: BASE_COLOR
                    },
                    playerIds: [playerId]
                }));
                baseNode.addChild(loadMore);
            }
        }

        return baseNode;
    }

    renderGames(playerId, { searchResults, searchQuery, browse } = {}) {
        const playerRoot = this.playerRoots[playerId];
        const playerView = this.playerStates[playerId].view;

        let gamePlane;

        if (browse) {
            const collection = (this.playerStates[playerId].browse && this.playerStates[playerId].browse.results) || {};
            const browsePlaneBase = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
            });
            browsePlaneBase.addChild(this.buildGamePlane({
                gameCollection: collection,
                onGameClick: (pid, key) => this.playCatalogGame(pid, key)
            }));
            gamePlane = browsePlaneBase;
        } else if (searchResults) {
            const searchPlaneBase = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
            });
            const transformedResults = {};
            Object.keys(searchResults).forEach(gameId => {
                transformedResults[gameId] = {
                    versions: {},
                    metadata: searchResults[gameId].metadata
                };
            });
            searchPlaneBase.addChild(this.buildGamePlane({ gameCollection: transformedResults }));
            gamePlane = searchPlaneBase;
        } else {
            gamePlane = this.getPlane();
        }

        const staticElements = this.buildStaticElements(playerId, gamePlane, searchQuery, searchResults, browse);

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

    // Re-register thumbnail assets for every known local game (after a rescan).
    _registerLocalThumbnails() {
        Object.keys(this.localGames)
            .filter(k => this.localGames[k].metadata && this.localGames[k].metadata.thumbnail)
            .forEach(key => {
                this.assets[key] = new Asset({
                    'id': this.localGames[key].metadata && this.localGames[key].metadata.thumbnail,
                    'source': this.localGames[key].metadata && this.localGames[key].metadata.thumbnailSource,
                    'type': 'image'
                });
            });
    }

    // Legacy asset-zip download (kept for games that still carry a sourceAssetId).
    downloadGame({ gameDetails, version, onProgress }) {
        return this.installer.install({ gameDetails, version, onProgress }).then(({ indexPath }) => {
            this.localGames = this.localLibrary.scan();
            this._registerLocalThumbnails();
            return indexPath;
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

// Seams now live in LocalLibrary / CatalogClient. These delegating exports keep
// the dashboard's characterization tests pointed at its public surface, proving
// the extraction preserved behavior. New tests target the modules directly.
module.exports.getGameMap = () => localLibrary.scan();
module.exports.getGamePathsHelper = (dir) => localLibrary.getGamePaths(dir);
module.exports.getGameMetadataMap = () => localLibrary.readMetadataMap();
module.exports.updateGameMetadataMap = (m) => localLibrary.writeMetadataMap(m);
module.exports.networkHelper = networkHelper;
module.exports.SOURCE_GAME_DIRECTORY = SOURCE_GAME_DIRECTORY;
module.exports.DOWNLOADED_GAME_DIRECTORY = DOWNLOADED_GAME_DIRECTORY;
