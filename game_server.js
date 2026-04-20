const GameSession = require('./src/GameSession');
const http = require('http');
const https = require('https');
const { socketServer } = require('./src/util/socket');
const Homenames = require('./src/Homenames');
const path = require('path');
const fs = require('fs');
const baseDir = path.dirname(require.main.filename);
const { getService } = require('./src/services/index');

const { getConfigValue, getAppDataPath, GameSessionManager } = require('homegames-common');

const logger = require('./src/logger');

const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
const HOME_PORT = getConfigValue('HOME_PORT', 7001);

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
            session && session.movePlayer(params);
        },
        addAsset: (key, asset) => new Promise((resolve, reject) => {
            session.handleNewAsset(key, asset).then(resolve).catch(reject);
        }),
        username,
        certPath,
        services,
        gameSessionManager,
    });
    
    session = new GameSession(dashboard, HOME_PORT, username);
    
    // Pass the shared GameSessionManager to Homenames
    const homeNames = new Homenames(HOMENAMES_PORT, certPath, gameSessionManager);
    
    session.initialize(() => {
        socketServer(session, HOME_PORT, null, certPath, username);
    });
};

module.exports = server;
