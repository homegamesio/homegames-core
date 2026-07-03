const http = require('http');
const https = require('https');
const { socketServer } = require('./src/util/socket');
const Homenames = require('./src/Homenames');
const path = require('path');
const fs = require('fs');
const baseDir = path.dirname(require.main.filename);
const { getService } = require('./src/services/index');

const { getConfigValue, getAppDataPath, GameSession, GameSessionManager } = require('homegames-common');

const logger = require('./src/logger');

const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
const HOME_PORT = getConfigValue('HOME_PORT', 7001);
const BEZEL_SIZE_X = getConfigValue('BEZEL_SIZE_X', 10);
const BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 10);

// ---------------------------------------------------------------------------
// Shared GameSessionManager — used by both Homenames (HTTP API) and the
// Dashboard (in-process game UI). This is the single source of truth for
// all running game sessions on this host.
// ---------------------------------------------------------------------------
const serverPortMin = getConfigValue('GAME_SERVER_PORT_RANGE_MIN', 7002);
const serverPortMax = getConfigValue('GAME_SERVER_PORT_RANGE_MAX', 7099);
const childGameServerPath = path.join(path.resolve(__dirname, 'src'), 'child_game_server.js');
const dockerImageDir = path.join(baseDir, 'docker');

const gameSessionManager = new GameSessionManager({
    portMin: serverPortMin,
    portMax: serverPortMax,
    childServerPath: childGameServerPath,
    dockerImageDir: fs.existsSync(dockerImageDir) ? dockerImageDir : null,
    saveDataRoot: path.join(getAppDataPath(), '.save-data'),
    assetCachePath: path.join(getAppDataPath(), 'asset-cache'),
    // Docker sessions reach Homenames on the host — they must use the SAME
    // port Homenames actually listens on (the runner image bakes no config.json,
    // so the container can't resolve this on its own).
    homenamesPort: HOMENAMES_PORT,
    log: logger,
});

const server = (certPath, squishMap, username) => {
    logger.debug('running server');

    if (squishMap) {
        logger.debug('custom squish map');
        logger.debug(squishMap);
    }

    // Configure the session manager with runtime values
    gameSessionManager.username = username;
    gameSessionManager.certPath = certPath;

    const startPathOverride = getConfigValue('START_PATH', null);

    const customStartModule = startPathOverride ? require(startPathOverride) : null;

    const HomegamesDashboard = require('./src/dashboard/HomegamesDashboard');
    const HomegamesRoot = require('./src/homegames_root/HomegamesRoot');
    const HomenamesHelper = require('./src/util/homenames-helper');

    let session;

    let services = {};

    if (customStartModule?.metadata) {
        const requestedServices = customStartModule.metadata().services || [];
        requestedServices.forEach(s => services[s] = getService(s));
    }

    const dashboard = customStartModule ? new customStartModule({ 
        squishMap,
        addAsset: (key, asset) => new Promise((resolve, reject) => {
            session.handleNewAsset(key, asset).then(resolve).catch(reject);
        }),
        username,
        certPath,
        services
    }) : new HomegamesDashboard({ 
        squishMap, 
        movePlayer: (params) => {
            session && session.movePlayer(params.playerId, params.port);
        },
        addAsset: (key, asset) => new Promise((resolve, reject) => {
            session.handleNewAsset(key, asset).then(resolve).catch(reject);
        }),
        username,
        certPath,
        services,
        gameSessionManager,
    });

    const squishVersion = (dashboard.constructor.metadata && dashboard.constructor.metadata().squishVersion) || '142';
    process.env.SQUISH_PATH = process.env.SQUISH_PATH || require.resolve(`squish-${squishVersion}`);

    // Build the session shim for HomegamesRoot (it expects a session-like object)
    const sessionShim = {
        game: dashboard,
        port: HOME_PORT,
        username,
        players: {},
        spectators: {},
        playerInfoMap: {},
        clientInfoMap: {},
        playerSettingsMap: {},
        remotePlayerMap: {},
    };

    const isDashboard = dashboard instanceof HomegamesDashboard;
    const homegamesRoot = new HomegamesRoot(sessionShim, isDashboard, false);
    const homenamesHelper = new HomenamesHelper(HOME_PORT, username);

    session = new GameSession(dashboard, squishVersion, {
        port: HOME_PORT,
        username,
        spectators: true,
        frame: {
            root: homegamesRoot.getRoot(),
            topLayerRoot: homegamesRoot.getTopLayerRoot(),
            assets: HomegamesRoot.metadata().assets,
            bezelX: BEZEL_SIZE_X,
            bezelY: BEZEL_SIZE_Y,
            handler: homegamesRoot,
        },
        homenames: homenamesHelper,
    });

    // Wire the shim to the real session so HomegamesRoot can access live state
    sessionShim.stateHistory = session.stateHistory;
    sessionShim.remotePlayerMap = session.remotePlayerMap;
    sessionShim.players = session.players;
    sessionShim.spectators = session.spectators;
    sessionShim.playerInfoMap = session.playerInfoMap;
    sessionShim.clientInfoMap = session.clientInfoMap;
    sessionShim.playerSettingsMap = session.playerSettingsMap;
    sessionShim.homenamesHelper = homenamesHelper;
    sessionShim.gameMetadata = session.gameMetadata;
    sessionShim.squisher = session.squisher;
    sessionShim.movePlayer = (opts) => session.movePlayer(opts.playerId, opts.port);
    sessionShim.spectateSession = (playerId) => session.spectateSession(playerId);
    sessionShim.joinSession = (spectatorId) => session.joinSession(spectatorId);
    
    // Pass the shared GameSessionManager to Homenames
    const homeNames = new Homenames(HOMENAMES_PORT, certPath, gameSessionManager);
    
    session.initialize().then(() => {
        socketServer(session, HOME_PORT, null, certPath, username);
    }).catch(err => {
        logger.error('Error initializing game session');
        logger.error(err);
    });
};

module.exports = server;
