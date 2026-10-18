const path = require('path');
const fs = require('fs');

const { getConfigValue, getConfig, setConfigValue, getAppDataPath, log } = require('homegames-common');
const discovery = require('../util/link-helper');

console.log('wattt1')
const squishMap = require('../common/squish-map');

console.log('watdsfdsf3');
console.log(squishMap);

const { Asset, Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require(squishMap['150']);

console.log('this is Game');
console.log(Game);

const gameModal = require('./game-modal');

const COLORS = Colors.COLORS;

const API_URL = getConfigValue('API_URL', 'https://api.homegames.io:443');

const parsedUrl = new URL(API_URL);
const isSecure = parsedUrl.protocol == 'https:';

const { ExpiringSet, animations } = require('../common/util');

const gameOption = require('./game-option');
const sessionStrip = require('./session-strip');
const settingsModal = require('./settings-modal');
const { getDefaultInstance: getCertManager } = require('../util/cert-manager');

const { createLocalCatalog } = require('../library/LocalCatalog');
const { createLocalLibrary } = require('../library/LocalLibrary');
const { createInstaller } = require('../library/Installer');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}



const IS_DEMO = getConfigValue('IS_DEMO', true);

let sessionIdCounter = 1;

// --- Palette: matches homegames.io (app.css) ---
// Off-white page, coral header, butter-yellow active/primary buttons,
// charcoal for borders and muted text, white surfaces, near-black text.
const BASE_COLOR = [251, 255, 242, 255];      // #fbfff2 page background
const CORAL_COLOR = [241, 112, 111, 255];     // site header / accent
const BUTTER_COLOR = [255, 247, 142, 255];    // site hover/active
const CHARCOAL_COLOR = [77, 77, 77, 255];     // #4D4D4D
const PANEL_COLOR = COLORS.WHITE;
const PANEL_BORDER_COLOR = CHARCOAL_COLOR;
const DASHBOARD_TEXT_COLOR = COLORS.ALMOST_BLACK;
const PLACEHOLDER_TEXT_COLOR = [150, 152, 145, 255];

// --- Layout ---
// Games per page is configurable (DASHBOARD_PAGE_SIZE: 3, 6, or 9). The grid
// is always 3 columns; page size sets the row count (1, 2, or 3). Pages stack
// vertically in 100-unit bands on the plane; paging shifts the view by 100.
const configuredPageSize = Number(getConfigValue('DASHBOARD_PAGE_SIZE', 6));
const PAGE_SIZE = [3, 6, 9].indexOf(configuredPageSize) >= 0 ? configuredPageSize : 6;
const GRID_COLUMNS = 3;
const GRID_ROWS = PAGE_SIZE / GRID_COLUMNS;

// Screen regions (0-100 plane): a slim top bar, the game grid projected below
// it, and a narrow paging rail on the right edge. When sessions are running,
// an active-sessions strip appears between the top bar and the grid and the
// grid compresses into GRID_AREA_WITH_SESSIONS.
const TOP_BAR = { y: 2.5, height: 7 };
const GRID_AREA = { x: 2.5, y: 11.5, width: 85, height: 84 };
const SESSION_STRIP = { x: 2.5, y: 11, width: 85, height: 9.5 };
const GRID_AREA_WITH_SESSIONS = { x: 2.5, y: 22.5, width: 85, height: 73 };
const PAGE_RAIL = { x: 89.5, width: 8, upY: 34, downY: 52, buttonHeight: 10 };

const CHILD_SESSION_HEARTBEAT_INTERVAL = getConfigValue('CHILD_SESSION_HEARTBEAT_INTERVAL', 500);

const SOURCE_GAME_DIRECTORY = path.resolve(`${baseDir}${path.sep}src${path.sep}games`);
const DOWNLOADED_GAME_DIRECTORY = path.join(getAppDataPath(), 'hg-games');

const localLibrary = createLocalLibrary({
    sourceGameDir: SOURCE_GAME_DIRECTORY,
    downloadedGameDir: DOWNLOADED_GAME_DIRECTORY,
    localGameDir: getConfigValue('LOCAL_GAME_DIRECTORY', null),
});

localLibrary.ensureDirs();
const networkHelper = createLocalCatalog(localLibrary);

class HomegamesDashboard extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            squishVersion: '150'
        };
    }


    constructor({ movePlayer, requestClientSave, startLocalPlay, requestRestart, servingHttps, addAsset, username, certPath, gameSessionManager, householdRooms, canManageServer = () => false, catalogClient, localLibrary: injectedLibrary }) {
        super(1000);
        // todo: static vs. addasset

        // Catalog client and local library are injectable for testing; they
        // default to the module-level instances (real API + app-data dir). The
        // installer shares both so installs hit the same (possibly mocked) deps.
        this.localLibrary = injectedLibrary || localLibrary;
        this.networkHelper = catalogClient || createLocalCatalog(this.localLibrary);
        this.installer = createInstaller({ catalogClient: this.networkHelper, localLibrary: this.localLibrary });

        this.addAsset = addAsset;
        this.username = username;
        this.certPath = certPath;
        this.gameSessionManager = gameSessionManager;
        this.householdRooms = householdRooms;
        this.canManageServer = canManageServer;

        this.assets = {
            'default': new Asset({
                path: "./assets/ff745468e1b725445c65245ce044da21.png",
                'type': 'image'
            }, fs.readFileSync(path.join(__dirname, "./assets/ff745468e1b725445c65245ce044da21.png"))),
            'dashboardSong': new Asset({
                path: "./assets/d9f097268324319d07a903cb50dc7210.mp3",
                type: 'audio'
            }, fs.readFileSync(path.join(__dirname, "./assets/d9f097268324319d07a903cb50dc7210.mp3")))
        };

        this.playerModals = {};
        this.playerDownloadOverlays = {};
        // Node ids of the current render layer per player, so renderGames can
        // remove the previous one instead of stacking layers on every re-render.
        this.playerRenderLayers = {};

        this.movePlayer = movePlayer;
        this.requestClientSave = requestClientSave || null;
        this.startLocalPlay = startLocalPlay || null;

        // Server settings section. requestRestart triggers the supervisor's
        // restart contract (exit 75, or 76 to also open homegames.link);
        // servingHttps is whether THIS run is serving HTTPS (config may
        // already say otherwise — that's what "restart to apply" is for).
        this.requestRestart = requestRestart || null;
        this.servingHttps = !!servingHttps;
        this.pendingRestart = false;
        this.playerSettingsModals = {};

        // Live cert progress: re-render any open settings modal when the cert
        // manager reports a change (absent in tests / custom setups).
        this._certManager = getCertManager();
        this._stopDiscoveryUpdates = discovery.onDiscoveryUpdate(() => this._rerenderSettingsModals());
        if (this._certManager) {
            this._certManager.onUpdate(() => this._rerenderSettingsModals());
        }

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

        // Active-sessions strip state: which mode each player last rendered
        // (so a strip change can re-render everyone in place), cached player
        // counts, and a signature to only re-render when something changed.
        this.playerRenderModes = {};
        this._sessionPlayerCounts = {};
        this._sessionIdSignature = '';
        this.setInterval(() => this._refreshSessionStrip(), 2000);
    }

    // -----------------------------------------------------------------------
    // Active sessions strip
    // -----------------------------------------------------------------------

    // All joinable (non-private) sessions on this server. The session manager
    // is the source of truth — it includes sessions created via the Homenames
    // API (website-hosted play) and prunes dead ones. Falls back to the
    // dashboard's own session map when no manager is wired (tests).
    _getActiveSessions() {
        let raw;
        if (this.gameSessionManager && this.gameSessionManager.listSessions) {
            raw = this.gameSessionManager.listSessions().filter(s => !s.private);
        } else {
            raw = Object.values(this.sessions).map(s => ({ id: s.id, port: s.port, gameKey: s.game }));
        }

        return raw.map(s => {
            const gameKey = s.gameKey || s.gameId;
            const localMeta = gameKey && this.localGames[gameKey] && this.localGames[gameKey].metadata;
            const count = this._sessionPlayerCounts[s.id];
            return {
                id: s.id,
                port: s.port,
                name: (localMeta && localMeta.name) || gameKey || `Session ${s.id}`,
                playerCount: count === undefined ? null : count,
            };
        }).concat(this.householdRooms?.list().filter(s => s.playerCount < s.maxPlayers) || []);
    }

    // Poll for strip changes: session set (create/end, incl. website-created
    // sessions) re-renders immediately; player counts refresh async and
    // re-render only when a count actually changed.
    _refreshSessionStrip() {
        const sessions = this._getActiveSessions();

        const idSignature = sessions.map(s => `${s.id}:${s.invitation ? s.playerCount : ''}`).join(',');
        if (idSignature !== this._sessionIdSignature) {
            this._sessionIdSignature = idSignature;
            // Drop counts for ended sessions
            const live = new Set(sessions.map(s => s.id));
            Object.keys(this._sessionPlayerCounts).forEach(id => {
                if (!live.has(Number(id))) delete this._sessionPlayerCounts[id];
            });
            this._rerenderAllPlayers();
        }

        if (!this.gameSessionManager || !this.gameSessionManager.requestFromSession) return;
        sessions.filter(s => !s.invitation).forEach(s => {
            this.gameSessionManager.requestFromSession(s.id, 'getPlayers').then(players => {
                const count = Array.isArray(players) ? players.length : null;
                if (this._sessionPlayerCounts[s.id] !== count) {
                    this._sessionPlayerCounts[s.id] = count;
                    this._rerenderAllPlayers();
                }
            }).catch(() => {});
        });
    }

    // Re-render every connected player in whatever mode they were last in
    // (local grid / search / browse).
    _rerenderAllPlayers() {
        Object.keys(this.playerRoots).forEach(playerId => {
            this.renderGames(playerId, this.playerRenderModes[playerId] || {});
        });
    }

    startSession(playerId, gameKey, versionKey = null) { 
        if (!this.localGames[gameKey]) return;

        const referencedGame = this.localGames[gameKey];
        const versionId = versionKey || Object.keys(referencedGame.versions)[Object.keys(referencedGame.versions).length - 1];
        const version = referencedGame.versions[versionId];

        // Configure the session manager with current username/certPath
        this.gameSessionManager.username = this.username;
        this.gameSessionManager.certPath = this.certPath;

        // When server-side save files are disabled (public instances), the
        // creating player's browser may hold the save from a previous session.
        // Ask for it now — saveData is injected at game construction, so this
        // is the only moment it can arrive. Times out to null; never blocks
        // the launch on a slow/absent client save.
        const savesEnabled = getConfigValue('SAVE_FILES_ENABLED', true) !== false;
        const clientSavePromise = (savesEnabled || !this.requestClientSave)
            ? Promise.resolve(null)
            : this.requestClientSave(playerId, { gameKey }).catch(() => null);

        clientSavePromise.then((clientSave) => this.gameSessionManager.startSession(
            { gamePath: version.gamePath, gameKey, versionId, clientSave },
            {
                playerId,
                onReady: (session) => {
                    log.info(`[Dashboard] onReady fired for session ${session.id} on port ${session.port}, moving player ${playerId}`);
                    this.movePlayer({ playerId, port: session.port });
                },
            }
        )).then((result) => {
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
            this.showSessionError(playerId, (err && err.message) || 'Failed to start the game session.');
        });
    }

    joinSession(playerId, session) {
        if (session.invitation && this.startLocalPlay) {
            const live = this.householdRooms?.list().find(s => s.id === session.id);
            if (live && live.playerCount < live.maxPlayers) this.startLocalPlay(playerId, { invitation: live.invitation });
            return;
        }
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
        return Object.values(this.sessions).concat(this.householdRooms?.list() || [])
            .filter(s => s.game === gameId && s.versionId === versionId);
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
            onPlaySinglePlayer: this.startLocalPlay
                ? () => this.playCatalogGame(playerId, view.gameKey, view.selectedVersionId)
                : null,
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

        this.playCatalogGame(playerId, view.gameKey, view.selectedVersionId, 'websocket');
    }

    renderGamePlane() {
        const plane = this.buildGamePlane({ gameCollection: this.localGames });
        this.getPlane().clearChildren();
        this.getPlane().addChild(plane);
    }

    // -----------------------------------------------------------------------
    // Server settings
    // -----------------------------------------------------------------------

    close(...args) {
        this._stopDiscoveryUpdates?.();
        return super.close(...args);
    }

    // Everything the settings modal needs to render. HTTPS intent is read
    // from the merged config file (NOT getConfigValue) because the env var
    // HTTPS_ENABLED means "serving https in this process right now" — the two
    // deliberately diverge between a config write and the restart.
    _settingsState() {
        const config = getConfig();
        const configuredPageSizeNow = Number(config.DASHBOARD_PAGE_SIZE);
        return {
            servingHttps: this.servingHttps,
            offline: process.env.HG_OFFLINE === 'true',
            httpsEnabled: config.HTTPS_ENABLED === true,
            certStatus: this._certManager ? this._certManager.getStatus() : null,
            discoveryStatus: discovery.getDiscoveryStatus(),
            pendingRestart: this.pendingRestart,
            pageSize: [3, 6, 9].indexOf(configuredPageSizeNow) >= 0 ? configuredPageSizeNow : 6,
            homePort: Number(getConfigValue('HOME_PORT', 7001)),
            homenamesPort: Number(getConfigValue('HOMENAMES_PORT', 7100)),
            homePortFromEnvironment: process.env.HOME_PORT !== undefined,
            homenamesPortFromEnvironment: process.env.HOMENAMES_PORT !== undefined,
            allowFork: config.FORK_SESSIONS_ENABLED === true,
        };
    }

    _settingsHandlers(playerId) {
        const handlers = {
            onEnableMultiplayer: () => {
                if (!getConfigValue('LINK_ENABLED', false)) this.pendingRestart = true;
                setConfigValue('LINK_ENABLED', true);
                setConfigValue('HTTPS_ENABLED', true);
                if (this._certManager) {
                    // Background acquisition; progress arrives via onUpdate.
                    const ready = this._certManager.hasValidCert()
                        ? this._certManager.checkNetwork() : this._certManager.ensureCert();
                    ready.catch(() => {});
                }
                this.showSettingsModal(playerId);
            },
            onDisableMultiplayer: () => {
                setConfigValue('LINK_ENABLED', false);
                setConfigValue('HTTPS_ENABLED', false);
                this.pendingRestart = true;
                this.showSettingsModal(playerId);
            },
            onRetryCertificate: () => {
                if (this._certManager) {
                    const retry = this._certManager.getStatus().networkChanged
                        ? this._certManager.checkNetwork()
                        : this.servingHttps ? this._certManager.maybeRenew() : this._certManager.ensureCert();
                    retry.catch(() => {});
                }
                this.showSettingsModal(playerId);
            },
            onRetryDiscovery: () => { void discovery.retryDiscovery(); },
            onRestart: (openLink) => {
                if (this.requestRestart) {
                    this.requestRestart(openLink);
                }
            },
            onSetPageSize: (n) => {
                if ([3, 6, 9].indexOf(n) < 0) return;
                if (this._settingsState().pageSize !== n) {
                    setConfigValue('DASHBOARD_PAGE_SIZE', n);
                    this.pendingRestart = true;
                }
                this.showSettingsModal(playerId);
            },
            onToggleAllowFork: () => {
                // Applies to the NEXT session launch (the session manager
                // reads FORK_SESSIONS_ENABLED per start) — no restart needed.
                setConfigValue('FORK_SESSIONS_ENABLED', !this._settingsState().allowFork);
                this.showSettingsModal(playerId);
            },
            onSetPort: (key, rawValue) => {
                if (key !== 'HOME_PORT' && key !== 'HOMENAMES_PORT') return;
                if (process.env[key] !== undefined) return;
                const port = Number(String(rawValue).trim());
                // Unprivileged, sane range only; silently ignore junk input.
                if (!Number.isInteger(port) || port < 1024 || port > 65535) return;
                if (getConfig()[key] !== port) {
                    setConfigValue(key, port);
                    this.pendingRestart = true;
                }
                this.showSettingsModal(playerId);
            },
            onClose: () => this.closeSettingsModal(playerId),
        };
        // Check at invocation too: hiding a button is not authorization, and
        // a disconnected player's old callbacks must lose their privileges.
        for (const name of Object.keys(handlers)) {
            if (name === 'onClose') continue;
            const handler = handlers[name];
            handlers[name] = (...args) => {
                if (this.canManageServer(playerId)) return handler(...args);
            };
        }
        return handlers;
    }

    showSettingsModal(playerId) {
        if (!this.canManageServer(playerId)) return;
        const playerRoot = this.playerRoots[playerId] && this.playerRoots[playerId].node;
        if (!playerRoot) return;

        const modal = settingsModal({
            playerId,
            state: this._settingsState(),
            handlers: this._settingsHandlers(playerId),
        });

        if (this.playerSettingsModals[playerId]) {
            playerRoot.removeChild(this.playerSettingsModals[playerId]);
        }
        this.playerSettingsModals[playerId] = modal.node.id;
        playerRoot.addChild(modal);
    }

    closeSettingsModal(playerId) {
        const playerRoot = this.playerRoots[playerId] && this.playerRoots[playerId].node;
        if (playerRoot && this.playerSettingsModals[playerId]) {
            playerRoot.removeChild(this.playerSettingsModals[playerId]);
        }
        this.playerSettingsModals[playerId] = null;
    }

    // Cert progress landed — refresh the modal for whoever is looking at it.
    _rerenderSettingsModals() {
        Object.keys(this.playerSettingsModals).forEach(playerId => {
            if (this.playerSettingsModals[playerId]) {
                this.showSettingsModal(playerId);
            }
        });
    }

    getAssets() {
        return this.assets;
    }

    buildGamePlane({ gameCollection, onGameClick = null }) {
        const cellWidth = 100 / GRID_COLUMNS;
        const cellHeight = 100 / GRID_ROWS;

        let gameIndex = 0;

        const planeBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        const testGamesEnabled = getConfigValue('TESTS_ENABLED', false);

        for (const key in gameCollection) {
            const gameMetadata = gameCollection[key]?.metadata || null;

            if (!testGamesEnabled && gameMetadata && gameMetadata.isTest) {
                continue;
            }

            // Absolute row * cellHeight tiles pages contiguously: GRID_ROWS
            // rows fill each 100-unit page band, so paging (view.y += 100)
            // lands exactly on the next page.
            const col = gameIndex % GRID_COLUMNS;
            const row = Math.floor(gameIndex / GRID_COLUMNS);

            const assetKey = this.assets[key] ? key : 'default';
            const gameName = gameCollection[key]?.metadata?.name || key;

            const gameOptionNode = gameOption({
                x: col * cellWidth,
                y: row * cellHeight,
                width: cellWidth,
                height: cellHeight,
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
                    const thumbnailId = game.thumbnail && game.thumbnail.indexOf('/') > 0 ? game.thumbnail.split('/').pop() : game.thumbnail;

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

    loadMoreCatalog(playerId, opts = {}) {
        const browseState = this.playerStates[playerId].browse;
        if (!browseState || browseState.loading || browseState.exhausted) return;
        browseState.loading = true;
        this.renderGames(playerId, { browse: true });
        this._fetchCatalogPage(playerId, opts);
    }

    // Fetch the next catalog page, merge results, register thumbnails, re-render.
    // Guards against the player having left Browse mode mid-request.
    //
    // opts.advance: the fetch was triggered by paging down at the end of the
    // loaded results — once the new games land, move the view onto them if
    // they start a new page band. If the last loaded page was only partially
    // filled, the new games fill its empty slots, so the view stays put.
    _fetchCatalogPage(playerId, { advance = false } = {}) {
        const browseState = this.playerStates[playerId].browse;
        if (!browseState) return;

        const stillBrowsing = () => this.playerStates[playerId] && this.playerStates[playerId].browse === browseState;

        this.networkHelper.list({ offset: browseState.offset, limit: browseState.limit }).then(response => {
            if (!stillBrowsing()) return;

            const games = (response && response.games) || [];
            const registrations = [];
            const previousCount = Object.keys(browseState.results).length;

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

            // Follow the results: if the first new game starts a page band
            // below the current view, jump the view to that band.
            if (advance && games.length > 0) {
                const cellHeight = 100 / GRID_ROWS;
                const firstNewRow = Math.floor(previousCount / GRID_COLUMNS);
                // epsilon guards float error in cellHeight multiples landing
                // a hair under an exact band boundary
                const firstNewBand = Math.floor(((firstNewRow * cellHeight) + 1e-9) / 100) * 100;
                const view = this.playerStates[playerId].view;
                if (firstNewBand > view.y) {
                    this.playerStates[playerId].view = Object.assign({}, view, { y: firstNewBand });
                }
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
    playCatalogGame(playerId, gameId, requestedVersionId = null, mode = 'browser') {
        const start = versionId => {
            if (mode === 'browser' && this.startLocalPlay) {
                this.startLocalPlay(playerId, { gameKey: gameId, versionId });
            } else this.startSession(playerId, gameId, versionId);
        };
        const installed = this.localGames[gameId] && this.localGames[gameId].versions;
        if (installed && (requestedVersionId ? installed[requestedVersionId] : Object.keys(installed).length > 0)) {
            start(requestedVersionId || Object.keys(installed).slice(-1)[0]);
            return;
        }

        if (!this.canManageServer(playerId)) {
            this.showSessionError(playerId, 'Ask the host to install this game on their computer.');
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

            if (!this.canManageServer(playerId)) throw new Error('Host disconnected before installation.');

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
                start(versionId);
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

    // Dismissible full-screen message for one player: dimmed backdrop,
    // centered box, tap anywhere to close. Shared by download failures and
    // session-start failures (one overlay slot per player).
    _showOverlayMessage(playerId, text, size = 1.5) {
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
                size,
                text,
                color: DASHBOARD_TEXT_COLOR
            },
            playerIds: [playerId]
        }));

        overlay.addChild(box);
        playerRootNode.addChild(overlay);
        this.playerDownloadOverlays[playerId] = overlay.node.id;
    }

    showDownloadError(playerId, name) {
        this._showOverlayMessage(playerId, `Couldn't download ${name}. Tap to dismiss.`);
    }

    // Session launch failed — tell the player why (e.g. fork sessions disabled
    // and Docker not running) instead of leaving them staring at the dashboard.
    showSessionError(playerId, message) {
        message = String(message || 'Unable to start the game.');
        // Common 1.7.3 uses the previous setting label in its launch error.
        // Keep the dashboard's guidance consistent with the visible control.
        if (message.startsWith('Fork sessions are disabled and Docker is not running.')) {
            message = 'Start Docker or enable "Run games without Docker" in Settings.';
        }
        this._showOverlayMessage(playerId, `${message} Tap to dismiss.`, 1.2);
    }

    buildStaticElements(playerId, gamePlane, searchQuery = '', searchResults = null, browse = false, activeSessions = [], gridArea = GRID_AREA) {
        const baseNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: BASE_COLOR,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            playerIds: [playerId]
        });

        // Vertically center a text of `size` in a bar at (barY, barH). Text
        // height in y-units is size * 16/9 at the dashboard's aspect ratio.
        const centerTextY = (barY, barH, size) => barY + ((barH - (size * 16 / 9)) / 2);

        // Coral header band behind the top bar (and the sessions strip, when
        // present) — same treatment as the homegames.io site header.
        baseNode.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, gridArea.y),
            playerIds: [playerId],
            fill: CORAL_COLOR
        }));

        // Active sessions — joinable from anywhere, no need to find the
        // owning game's modal.
        if (activeSessions.length > 0) {
            baseNode.addChild(sessionStrip({
                sessions: activeSessions,
                playerId,
                onJoin: (session) => this.joinSession(playerId, session),
                area: SESSION_STRIP
            }));
        }

        // --- Top bar: Browse / Back toggle + search field on one slim row ---
        // The toggle is available regardless of demo mode, since browsing the
        // catalog needs no text input.
        const browseToggle = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(2.5, TOP_BAR.y, 11, TOP_BAR.height),
            playerIds: [playerId],
            fill: BUTTER_COLOR,
            border: 2,
            color: PANEL_BORDER_COLOR,
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
                x: 8,
                y: centerTextY(TOP_BAR.y, TOP_BAR.height, 1.3),
                align: 'center',
                size: 1.3,
                text: browse ? '◀ Back' : 'Library',
                color: DASHBOARD_TEXT_COLOR
            },
            playerIds: [playerId]
        }));

        const playerSearchBox = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(15, TOP_BAR.y, 60, TOP_BAR.height),
            playerIds: [playerId],
            fill: PANEL_COLOR,
            border: 2,
            color: PANEL_BORDER_COLOR,
            input: IS_DEMO ? null : {
                type: 'text',
                oninput: (playerId, input) => {
                    this.playerStates[playerId].query = input;
                    this.handleSearch(playerId);
                }
            }
        });

        const searchPlaceholder = IS_DEMO ? 'Search — disabled in demo' : 'Search';
        const playerSearchText = new GameNode.Text({
            textInfo: {
                x: 17.5,
                y: centerTextY(TOP_BAR.y, TOP_BAR.height, 1.4),
                align: 'left',
                text: searchQuery || searchPlaceholder,
                color: searchQuery ? DASHBOARD_TEXT_COLOR : PLACEHOLDER_TEXT_COLOR,
                size: 1.4
            },
            playerIds: [playerId]
        });

        playerSearchBox.addChildren(playerSearchText);


        if (searchResults) {
            // Clear button lives inside the right end of the search field.
            const clearSearchButton = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(69.5, TOP_BAR.y + 1, 5, TOP_BAR.height - 2),
                playerIds: [playerId],
                fill: PANEL_COLOR,
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
                    x: 72,
                    y: centerTextY(TOP_BAR.y, TOP_BAR.height, 1.6),
                    size: 1.6,
                    align: 'center',
                    text: '✕',
                    color: CORAL_COLOR
                },
                playerIds: [playerId]
            });

            clearSearchButton.addChild(clearSearchX);
            playerSearchBox.addChildren(clearSearchButton);
        }

        // Server settings are shown only to the host computer.
        const settingsButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(76.5, TOP_BAR.y, 11, TOP_BAR.height),
            playerIds: [playerId],
            fill: PANEL_COLOR,
            border: 2,
            color: PANEL_BORDER_COLOR,
            onClick: (pid) => this.showSettingsModal(pid)
        });
        settingsButton.addChild(new GameNode.Text({
            textInfo: {
                x: 82,
                y: centerTextY(TOP_BAR.y, TOP_BAR.height, 1.3),
                align: 'center',
                size: 1.3,
                text: 'Settings',
                color: DASHBOARD_TEXT_COLOR
            },
            playerIds: [playerId]
        }));

        // --- Paging rail (right edge): up arrow / page indicator / down arrow ---

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
        const gameOptions = planeBase.getChildren();
        const gameOptionsBelowView = gameOptions.filter(child => {
            return child.node.coordinates2d[0][1] >= (currentView.y + currentView.h);
        });

        const gameOptionsAboveView = gameOptions.filter(child => {
            return child.node.coordinates2d[2][1] <= currentView.y;
        });

        const canGoDown = gameOptionsBelowView.length > 0 || canLoadMore;
        const canGoUp = gameOptionsAboveView.length > 0;

        // Pages are 100-unit bands on the plane; the page count comes from the
        // deepest option currently laid out.
        const totalPages = gameOptions.length
            ? 1 + Math.max(...gameOptions.map(child => Math.floor(child.node.coordinates2d[0][1] / 100)))
            : 1;
        const currentPage = Math.floor(currentView.y / 100) + 1;
        const railCenterX = PAGE_RAIL.x + (PAGE_RAIL.width / 2);

        const upArrow = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(PAGE_RAIL.x, PAGE_RAIL.upY, PAGE_RAIL.width, PAGE_RAIL.buttonHeight),
            playerIds: [playerId],
            fill: PANEL_COLOR,
            border: 2,
            color: PANEL_BORDER_COLOR,
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
                x: railCenterX,
                y: centerTextY(PAGE_RAIL.upY, PAGE_RAIL.buttonHeight, 1.2),
                align: 'center',
                size: 1.2,
                text: '\u25B2',
                color: CORAL_COLOR
            }
        });

        upArrow.addChild(upText);

        const downArrow = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(PAGE_RAIL.x, PAGE_RAIL.downY, PAGE_RAIL.width, PAGE_RAIL.buttonHeight),
            playerIds: [playerId],
            fill: PANEL_COLOR,
            border: 2,
            color: PANEL_BORDER_COLOR,
            onClick: (player, x, y) => {
                const currentView = Object.assign({}, this.playerStates[playerId].view);

                if (gameOptionsBelowView.length > 0) {
                    currentView.y += 100;
                    this.playerStates[playerId].view = currentView;
                    rerender();
                } else if (canLoadMore) {
                    // At the bottom of what we've loaded -- pull the next page
                    // and follow the view onto it once it lands.
                    this.loadMoreCatalog(playerId, { advance: true });
                }
            }
        });

        const downText = new GameNode.Text({
            textInfo: {
                x: railCenterX,
                y: centerTextY(PAGE_RAIL.downY, PAGE_RAIL.buttonHeight, 1.2),
                align: 'center',
                size: 1.2,
                text: '\u25BC',
                color: CORAL_COLOR
            }
        });

        downArrow.addChild(downText);

        baseNode.addChildren(browseToggle, playerSearchBox);
        if (this.canManageServer(playerId)) baseNode.addChild(settingsButton);
        if (canGoUp) {
            baseNode.addChildren(upArrow);
        }
        if (canGoDown) {
            baseNode.addChildren(downArrow);
        }

        // Page indicator between the arrows — only when there is anything to page.
        if (totalPages > 1 || canLoadMore) {
            baseNode.addChild(new GameNode.Text({
                textInfo: {
                    x: railCenterX,
                    y: 47,
                    align: 'center',
                    size: 1.1,
                    text: `${currentPage} / ${totalPages}${canLoadMore ? '+' : ''}`,
                    color: PLACEHOLDER_TEXT_COLOR
                },
                playerIds: [playerId]
            }));
        }

        // Empty local library: point new users at Browse instead of a blank grid.
        if (!browse && !searchResults && gameOptions.length === 0) {
            baseNode.addChild(new GameNode.Text({
                textInfo: {
                    x: 45,
                    y: 47,
                    align: 'center',
                    size: 1.6,
                    text: 'No games installed',
                    color: DASHBOARD_TEXT_COLOR
                },
                playerIds: [playerId]
            }));
            baseNode.addChild(new GameNode.Text({
                textInfo: {
                    x: 45,
                    y: 52,
                    align: 'center',
                    size: 1.2,
                    text: this.canManageServer(playerId) ? 'Add a game pack with Import ZIP' : 'Ask the host to add a game pack',
                    color: PLACEHOLDER_TEXT_COLOR
                },
                playerIds: [playerId]
            }));
        }

        if (browse) {
            const browseState = this.playerStates[playerId].browse || {};

            // Status line for loading / error / empty catalog.
            let statusText = null;
            if (browseState.error) {
                statusText = 'Could not read the local library.';
            } else if (browseState.loading && Object.keys(browseState.results || {}).length === 0) {
                statusText = 'Reading local games…';
            } else if (!browseState.loading && Object.keys(browseState.results || {}).length === 0) {
                statusText = 'No local games found.';
            }

            if (statusText) {
                baseNode.addChild(new GameNode.Text({
                    textInfo: {
                        x: 45,
                        y: 50,
                        align: 'center',
                        size: 1.5,
                        text: statusText,
                        color: DASHBOARD_TEXT_COLOR
                    },
                    playerIds: [playerId]
                }));
            }

            // While a next page is being fetched (the down arrow triggered it),
            // show a quiet hint — paging is otherwise seamless: the down arrow
            // pulls the next page and the view follows it, until the catalog
            // is exhausted and the arrow disappears.
            if (browseState.loading && Object.keys(browseState.results || {}).length > 0) {
                baseNode.addChild(new GameNode.Text({
                    textInfo: {
                        x: 45,
                        y: 96.5,
                        align: 'center',
                        size: 1.1,
                        text: 'Loading…',
                        color: PLACEHOLDER_TEXT_COLOR
                    },
                    playerIds: [playerId]
                }));
            }
        }

        return baseNode;
    }

    renderGames(playerId, { searchResults, searchQuery, browse } = {}) {
        const playerRoot = this.playerRoots[playerId];
        const playerView = this.playerStates[playerId].view;

        // Remember this player's mode so strip changes (session created or
        // ended, player counts) can re-render them in place.
        this.playerRenderModes[playerId] = { searchResults, searchQuery, browse };

        // The grid compresses to make room for the sessions strip when there
        // are sessions to show.
        const activeSessions = this._getActiveSessions();
        const gridArea = activeSessions.length > 0 ? GRID_AREA_WITH_SESSIONS : GRID_AREA;

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

        const staticElements = this.buildStaticElements(playerId, gamePlane, searchQuery, searchResults, browse, activeSessions, gridArea);

        const view = ViewUtils.getView(
            gamePlane,
            playerView,
            [playerId],
            {
                x: gridArea.x,
                y: gridArea.y
            },
            {
                x: gridArea.width / 100,
                y: gridArea.height / 100
            }
        );

        playerRoot.node.addChildren(staticElements, view);
        this.playerRenderLayers[playerId] = [staticElements.node.id, view.node.id];
    }

    // Re-register thumbnail assets for every known local game (after a rescan).
    _registerLocalThumbnails() {
        const testGamesEnabled = getConfigValue('TESTS_ENABLED', false);
        Object.keys(this.localGames)
            // Hidden development games do not need dashboard thumbnails.
            .filter(k => this.localGames[k].metadata && this.localGames[k].metadata.thumbnail
                && (testGamesEnabled || !this.localGames[k].metadata.isTest))
            .forEach(key => {
                const metadata = this.localGames[key].metadata;
                // Older installed games may still declare a hosted asset ID.
                // Thumbnails are optional: never add an Asset without bytes,
                // since that prevents the entire dashboard from initializing.
                // Keep the fallback under the game key for catalog/modal views.
                this.assets[key] = this.assets.default;
                if (typeof metadata.thumbnail === 'string' && metadata.thumbnail.startsWith('./') && metadata.gamePath) {
                    try {
                        this.assets[key] = new Asset({ path: metadata.thumbnail, type: 'image' },
                            require('homegames-common/local-game-assets').readGameAsset(metadata.gamePath, metadata.thumbnail));
                    } catch (err) {
                        log.error(`Unable to load thumbnail for ${key}: ${err.message}`);
                    }
                }
            });
    }

    async refreshLibrary() {
        this.localGames = this.localLibrary.scan();
        const previous = new Set(Object.keys(this.assets));
        this._registerLocalThumbnails();
        await Promise.all(Object.entries(this.assets).filter(([key]) => !previous.has(key)).map(([key, asset]) => this.addAsset(key, asset)));
        for (const playerId of Object.keys(this.playerStates)) this.exitBrowse(playerId);
    }

    handlePlayerDisconnect(playerId) {
        const playerViewRoot = this.playerRoots[playerId] && this.playerRoots[playerId].node;
        if (playerViewRoot) {
            const node = playerViewRoot.node;
            this.playerRootNode.removeChild(node.id);
            delete this.playerRoots[playerId];
            delete this.playerRenderLayers[playerId];
            delete this.playerSettingsModals[playerId];
            delete this.playerRenderModes[playerId];
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

// Layout facts tests (and future chrome) can depend on without hardcoding
// coordinates: page geometry and where the paging rail buttons sit.
module.exports.UI = {
    PAGE_SIZE,
    GRID_COLUMNS,
    GRID_ROWS,
    TOP_BAR,
    GRID_AREA,
    GRID_AREA_WITH_SESSIONS,
    SESSION_STRIP,
    PAGE_RAIL,
};
