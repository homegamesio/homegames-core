const path = require('path');
const fs = require('fs');

const { getConfigValue, getAppDataPath, log } = require('homegames-common');

console.log('wattt1')
const squishMap = require('../common/squish-map');

console.log('watdsfdsf3');
console.log(squishMap);

const { Asset, Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require(squishMap['142']);

console.log('this is Game');
console.log(Game);

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
            squishVersion: '142'
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
        // Node ids of the current render layer per player, so renderGames can
        // remove the previous one instead of stacking layers on every re-render.
        this.playerRenderLayers = {};

        this.movePlayer = movePlayer;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 1000, 1000),
            fill: BASE_COLOR
        });

        this.localGames = this.localLibrary.scan();
        this._registerLocalThumbnails();

        this.renderGamePlane();

        this.playerViews = {};
        this.playerStates = {};
        this.playerRoots = {};

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

    // Open the game modal. Resolves a normalized view model (from a built-in
    // game, a downloaded game, or the remote catalog) then renders it. All the
    // source-specific shape juggling lives in the resolver, so rendering is a
    // single code path.
    showGameModalNew(playerId, gameId, versionId) {
        if (!this.playerRoots[playerId]) return;

        this._resolveModalView(gameId, versionId).then(view => {
            if (view) this._renderModal(playerId, view);
        }).catch(err => {
            log.error('Failed to open game modal for ' + gameId);
            log.error(err);
        });
    }

    // Active sessions for a specific game + version.
    _activeSessionsFor(gameId, versionId) {
        return Object.values(this.sessions).filter(s => s.game === gameId && s.versionId === versionId);
    }

    // Normalized modal view model. Always a Promise: local games resolve
    // synchronously, remote games fetch details (and register the thumbnail).
    _resolveModalView(gameId, versionId) {
        const local = this.localGames[gameId];
        if (local) {
            return Promise.resolve(this._localModalView(gameId, versionId, local));
        }
        return this._remoteModalView(gameId, versionId);
    }

    // Build the view model for a game installed on disk (built-in source game or
    // a downloaded game). Both live in this.localGames; their thumbnails are
    // already registered under the game key.
    _localModalView(gameId, versionId, local) {
        const versionEntries = Object.values(local.versions);
        const selectedVersionId = (versionId && local.versions[versionId])
            ? versionId
            : versionEntries[0].versionId;
        const selected = local.versions[selectedVersionId];

        const versions = versionEntries.map(v => {
            const published = (v.metadata && v.metadata.published) || null;
            return {
                id: v.versionId,
                versionId: v.versionId,
                published,
                approved: v.approved,
                metadata: {
                    versionId: v.versionId,
                    published,
                    description: (v.metadata && v.metadata.description) || null
                }
            };
        });

        const meta = local.metadata || {};
        const selMeta = selected.metadata || {};

        return {
            gameKey: gameId,
            selectedVersionId,
            activeSessions: this._activeSessionsFor(gameId, selectedVersionId),
            versions,
            gameMetadata: {
                name: meta.name || gameId,
                author: meta.author || meta.createdBy || 'Unknown author',
                thumbnail: meta.thumbnail || null,
                description: selMeta.description || selected.description || meta.description || 'No description available',
                maxPlayers: selMeta.maxPlayers || null,
                created: meta.createdAt || selMeta.createdAt || selMeta.created || null
            },
            createContext: { installed: true }
        };
    }

    // Build the view model for a remote catalog game. Registers the thumbnail
    // asset (once); create-session later downloads the selected version from
    // source via playCatalogGame, so no raw details need to be carried here.
    _remoteModalView(gameId, versionId) {
        return this.networkHelper.getGameDetails(gameId).then(gameDetails => {
            const game = (gameDetails && gameDetails.game) || {};
            const rawVersions = (gameDetails && gameDetails.versions) || [];

            if (rawVersions.length === 0) {
                log.error('Game ' + gameId + ' has no versions to show');
                return null;
            }

            return this._ensureRemoteThumbnail(gameId, game.thumbnail).then(() => {
                const selectedVersionId = this._selectRemoteVersion(rawVersions, versionId);
                const selectedRaw = rawVersions.find(v => v.id === selectedVersionId) || {};

                const versions = rawVersions.map(v => {
                    const published = v.published != null ? v.published : null;
                    return {
                        id: v.id,
                        versionId: v.id,
                        published,
                        approved: v.approved,
                        metadata: { versionId: v.id, published, description: v.description || null }
                    };
                });

                return {
                    gameKey: gameId,
                    selectedVersionId,
                    activeSessions: this._activeSessionsFor(gameId, selectedVersionId),
                    versions,
                    gameMetadata: {
                        name: game.name || gameId,
                        author: game.developerId || 'Unknown author',
                        thumbnail: game.thumbnail || null,
                        description: selectedRaw.description || game.description || 'No description available',
                        maxPlayers: selectedRaw.maxPlayers || null,
                        created: game.created || null
                    },
                    createContext: { installed: false }
                };
            });
        });
    }

    // Register a catalog thumbnail under the game key if we haven't already.
    // Thumbnails may be a bare id or a path; keep only the trailing id.
    _ensureRemoteThumbnail(gameId, thumbnail) {
        if (!thumbnail || this.assets[gameId]) return Promise.resolve();

        const thumbnailId = thumbnail.indexOf('/') > 0
            ? thumbnail.split('/').pop()
            : thumbnail;
        const asset = new Asset({ id: thumbnailId, type: 'image' });
        this.assets[gameId] = asset;
        return this.addAsset(gameId, asset).catch(() => {});
    }

    // Pick which catalog version the modal opens on: the requested one if valid,
    // otherwise the most recently published (falling back to the last listed).
    _selectRemoteVersion(rawVersions, versionId) {
        if (versionId && rawVersions.some(v => v.id === versionId)) return versionId;

        const published = rawVersions.filter(v => v.published != null);
        if (published.length) {
            return published.reduce((a, b) => (b.published > a.published ? b : a)).id;
        }
        return rawVersions[rawVersions.length - 1].id;
    }

    // Render a resolved view model into the player's modal slot.
    _renderModal(playerId, view) {
        const playerRoot = this.playerRoots[playerId] && this.playerRoots[playerId].node;
        if (!playerRoot) return;

        const modal = gameModal({
            gameKey: view.gameKey,
            versionId: view.selectedVersionId,
            activeSessions: view.activeSessions,
            playerId,
            versions: view.versions,
            gameMetadata: view.gameMetadata,
            onVersionChange: (newVersionId) => this.showGameModalNew(playerId, view.gameKey, newVersionId),
            onJoinSession: (session) => this.joinSession(playerId, session),
            onCreateSession: () => this._createSessionFromModal(playerId, view),
            onClose: () => playerRoot.removeChild(modal.node.id)
        });

        if (this.playerModals[playerId]) {
            playerRoot.removeChild(this.playerModals[playerId]);
        }

        this.playerModals[playerId] = modal.node.id;
        playerRoot.addChild(modal);
    }

    // Create-session handler for the modal. Installed games start immediately;
    // an uninstalled catalog game is downloaded from source (with a progress
    // overlay) and then started, via the same path Browse uses.
    _createSessionFromModal(playerId, view) {
        if (view.createContext.installed) {
            this.startSession(playerId, view.gameKey, view.selectedVersionId);
            return;
        }

        this.playCatalogGame(playerId, view.gameKey, view.selectedVersionId);
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

    // Download-then-play a catalog game from source. If the requested version is
    // already installed locally, just start it; otherwise fetch its published
    // commit, install from source with a progress overlay, then start the
    // session. `requestedVersionId` targets a specific version (e.g. from the
    // modal's version selector); omitted, it plays the latest published.
    playCatalogGame(playerId, gameId, requestedVersionId = null) {
        const installed = this.localGames[gameId] && this.localGames[gameId].versions;
        if (installed && (requestedVersionId ? installed[requestedVersionId] : Object.keys(installed).length > 0)) {
            this.startSession(playerId, gameId, requestedVersionId || undefined);
            return;
        }

        this.showDownloadProgress(playerId, gameId, null);

        // Games have no asset zip anymore; their source lives in git, fetched by
        // commitSha. Pull the published versions, pick the target commit, install
        // from source, then play.
        Promise.all([
            this.networkHelper.getGameDetails(gameId),
            this.networkHelper.getPublishedVersions(gameId)
        ]).then(([gameDetails, published]) => {
            const versions = (published && published.versions) || [];
            if (versions.length === 0) {
                throw new Error('Game has no published versions');
            }
            const latest = versions.reduce((a, b) => ((b.publishedAt || 0) > (a.publishedAt || 0) ? b : a));
            const target = requestedVersionId
                ? (versions.find(v => v.versionId === requestedVersionId) || latest)
                : latest;
            const displayName = (gameDetails.game && gameDetails.game.name) || gameId;

            return this.installer.installFromSource({
                gameId,
                game: gameDetails.game,
                versionId: target.versionId,
                commitSha: target.commitSha,
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

        const currentView = this.playerStates[playerId].view;

        // Re-render preserving whichever mode we're in (local / search / browse).
        // The arrows previously dropped the `browse` flag here, so paging while
        // browsing kicked the player back to their local games.
        const rerender = () => this.renderGames(playerId, { searchResults, searchQuery, browse });

        // In browse mode there may be more catalog pages to pull once the player
        // scrolls past the loaded results.
        const browseState = browse ? (this.playerStates[playerId].browse || {}) : null;
        const canLoadMore = !!(browseState
            && !browseState.exhausted
            && Object.keys(browseState.results || {}).length > 0);

        // Bound the paging math to the plane actually on screen, not the local
        // games plane (this.getPlane()) -- otherwise search/browse paged against
        // the wrong option positions.
        const planeBase = gamePlane.getChildren()[0];
        const gameOptionsBelowView = planeBase.getChildren().filter(child => {
            return child.node.coordinates2d[0][1] >= (currentView.y + currentView.h);
        });

        const gameOptionsAboveView = planeBase.getChildren().filter(child => {
            return child.node.coordinates2d[2][1] <= currentView.y;
        });

        if (gameOptionsBelowView.length > 0 || canLoadMore) {
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
                const currentView = Object.assign({}, this.playerStates[playerId].view);

                if (currentView.y - 100 >= 0) {
                    currentView.y -= 100;
                    this.playerStates[playerId].view = currentView;
                    rerender();
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
                const currentView = Object.assign({}, this.playerStates[playerId].view);

                if (gameOptionsBelowView.length > 0) {
                    currentView.y += 100;
                    this.playerStates[playerId].view = currentView;
                    rerender();
                } else if (canLoadMore) {
                    // At the bottom of what we've loaded -- pull the next page.
                    this.loadMoreCatalog(playerId);
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

        // Drop the previous render layer before drawing the new one. Without this
        // every re-render (search, paging, browse) stacked another full-screen UI
        // on top of the old one, leaking nodes and leaving stale click handlers
        // behind. Modals and download overlays are tracked separately and left in
        // place.
        const previousLayer = this.playerRenderLayers[playerId];
        if (previousLayer) {
            previousLayer.forEach(nodeId => playerRoot.node.removeChild(nodeId));
        }

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
        this.playerRenderLayers[playerId] = [staticElements.node.id, view.node.id];
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

    handlePlayerDisconnect(playerId) {
        const playerViewRoot = this.playerRoots[playerId] && this.playerRoots[playerId].node;
        if (playerViewRoot) {
            const node = playerViewRoot.node;
            this.playerRootNode.removeChild(node.id);
            delete this.playerRoots[playerId];
            delete this.playerRenderLayers[playerId];
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
