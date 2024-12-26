const { getConfigValue, getAppDataPath, log } = require('homegames-common');

const { Parser } = require('acorn');

const fs = require('fs');
const process = require('process');

if (!process.env.SQUISH_PATH) {
    const defaultVersion = 'squish-113';
    log.info('No SQUISH_PATH found. Using default: ' + defaultVersion);
    process.env.SQUISH_PATH = defaultVersion;
}

let { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require(process.env.SQUISH_PATH);

const squishMap = require('../common/squish-map');

const { animations, reportBug } = require('../common/util');

const PLAYER_SETTINGS = require('../common/player-settings.js');

const path = require('path');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const HomenamesHelper = require('../util/homenames-helper');

const settingsModal = require('./settings');
const COLORS = Colors.COLORS;

const GAME_DIRECTORY = path.join(getAppDataPath(), 'hg-games');


const SOURCE_GAME_DIRECTORY = path.resolve(getConfigValue('SOURCE_GAME_DIRECTORIES', `${baseDir}/src/games`));
const DOWNLOADED_GAME_DIRECTORY = GAME_DIRECTORY;

const HOME_PORT = getConfigValue('HOME_PORT', 7001);

const BEZEL_SIZE_X = getConfigValue('BEZEL_SIZE_X', 10);
const BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 10);

if (!fs.existsSync(GAME_DIRECTORY)) {
    fs.mkdirSync(GAME_DIRECTORY);
}

const parseSquishVersion = (codePath) => {
    const parsed = Parser.parse(fs.readFileSync(codePath));
    
    const foundGameClasses = parsed.body.filter(n => n.type === 'ClassDeclaration' && n.superClass?.name === 'Game');
    
    if (foundGameClasses.length !== 1) {
        throw new Error('Top-level file should have one defined game class');
    }
    
    const foundGame = foundGameClasses[0];
    
    const foundConstructors = foundGame.body.body.filter(n => n.key?.name === 'metadata' && n.kind === 'method');
    
    if (foundConstructors.length !== 1) {
        throw new Error('Game needs one constructor');
    }
    
    const foundConstructor = foundConstructors[0];
    
    let foundSquishVersion;
    
    foundConstructor.value.body.body.forEach(n => {
        const squishVersionNodes = n.argument.properties.filter(n => n.key?.name === 'squishVersion');
        if (squishVersionNodes.length > 1 || (foundSquishVersion && squishVersionNodes.length == 1)) {
            throw new Error('Multiple squish versions found');
        } 
    
        if (squishVersionNodes.length === 1) {
            foundSquishVersion = squishVersionNodes[0].value.value;
        }
    });
    
    if (!foundSquishVersion) {
        throw new Error('No squish version found');
    }
    
    return foundSquishVersion;
};

const getGameMetadataMap = () => {
    if (fs.existsSync(GAME_DIRECTORY + path.sep + '.metadata')) {
        const bytes = fs.readFileSync(GAME_DIRECTORY + path.sep + '.metadata');
        return JSON.parse(bytes);
    }

    return {};
}

const getGamePathsHelper = (dir) => {
    const entries = fs.readdirSync(dir);
    const results = new Set();
    const processedEntries = {};

    entries.forEach(entry => {
        const entryPath = path.resolve(`${dir}${path.sep}${entry}`);
        
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


        if (isLocal) {

            const gameClass = require(gamePath);
            const gameMetadata = gameClass.metadata ? gameClass.metadata() : {};

            games[gameClass.name] = {
                metadata: {
                    name: gameMetadata.name || gameClass.name,
                    thumbnail: gameMetadata.thumbnail,
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
                        isReviewed: true
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
                    isReviewed: storedMetadata.version.isReviewed
                };
            }
        } 
    });

    if (getConfigValue('LOCAL_GAME_DIRECTORY', null)) {
        const localGameDir = path.resolve(getConfigValue('LOCAL_GAME_DIRECTORY'));
        const localGamePaths = getGamePathsHelper(localGameDir);

        localGamePaths.forEach(gamePath => {
            log.info('Using local game at path ' + gamePath);
            const gameClass = require(gamePath);
            const gameMetadata = gameClass.metadata ? gameClass.metadata() : {};

            games[gameClass.name] = {
                metadata: {
                    name: gameMetadata.name || gameClass.name,
                    thumbnail: gameMetadata.thumbnail,
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
                        isReviewed: true
                    }
                }
            }
        });
    }

    return games;
};

class HomegamesRoot {
    static metadata() {
        return {
            assets: {
                'frame': new Asset({
                    'id': 'c299f1f7e24d03e59cb569f5815bfe2f',
                    // no gloss on frame
                    //'8fcdf21f0a48f98840775cf9dc453d49',
                    'type': 'image'
                }),
                'logo-horizontal': new Asset({
                    'id': 'fcb652fab2a4cfe76fe1b6868e3ca7a1',
                    'type': 'image'
                }),
                'amateur': new Asset({
                    'type': 'font',
                    'id': '026a26ef0dd340681f62565eb5bf08fb'
                }),
                'heavy-amateur': new Asset({
                    'type': 'font',
                    'id': '9f11fac62df9c1559f6bd32de1382c20'
                })
            }
        };
    }
    getTopLayerRoot() {
        return this.topLayerRoot;
    }

    constructor(session, isDashboard, profiling) {
        if (session.game.constructor.metadata && session.game.constructor.metadata()) {
            let { Asset: _Asset, Game: _Game, GameNode: _GameNode, Colors: _Colors, Shapes: _Shapes, ShapeUtils: _ShapeUtils } = require("squish-" + session.game.constructor.metadata().squishVersion);
            Asset = _Asset;
            Game = _Game;
            GameNode = _GameNode;
            Colors = _Colors;
            Shapes = _Shapes;
            ShapeUtils = _ShapeUtils;
        }

        this.isDashboard = isDashboard;
        this.profiling = profiling;
        this.renderTimes = [];
        this.session = session;
        this.homenamesHelper = new HomenamesHelper(session.port, session.username);

        this.spectators = {};

        this.viewStates = {};

        this.frameStates = {};

        this.remotePlayerIds = {};
  
        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.BLACK
        });

        this.frameRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.BLACK
        });

        this.topLayerRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.BLACK
        });

        this.playerDashboards = {};

        const onGameHomeClick = (playerId) => {
            if (!this.remotePlayerIds[playerId]) {
                this.session.movePlayer({ playerId, port: HOME_PORT });
            }
        };

        const gameAspectRatio = this.session.game.constructor.metadata && this.session.game.constructor.metadata().aspectRatio;
        let aspectRatio;
        if (gameAspectRatio) {
            aspectRatio = gameAspectRatio;
        } else {
            aspectRatio = {x: 16, y: 9};
        }

        const logoSizeX = 5 * (aspectRatio.y / aspectRatio.x);
        const logoSizeY = BEZEL_SIZE_Y / 2;
        const logoStartY = 100 - (BEZEL_SIZE_Y / 2);
        const logoStartX = 50 - (logoSizeX / 2);

        this.homeButton = new GameNode.Asset({
            onClick: isDashboard ? null : onGameHomeClick,
            coordinates2d: ShapeUtils.rectangle(logoStartX, logoStartY, logoSizeX, logoSizeY),
            assetInfo: {
                'logo-horizontal': {
                    pos: {x: logoStartX, y: logoStartY},
                    size: {
                        x: logoSizeX, 
                        y: logoSizeY
                    }
                }
            }
        });

        this.root.addChild(this.frameRoot);
        this.root.addChild(this.homeButton);
    }

    getRoot() {
        return this.root;
    }

    handleNewPlayer({ playerId, info: playerInfo }) {
        if (this.session.players[playerId]?.remoteClient) {
            this.remotePlayerIds[playerId] = true;
        }
        const playerFrame = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            assetInfo: {
                'frame': {
                    pos: {x: 0, y: 0},
                    size: {
                        x: 100,
                        y: 100
                    }
                }
            },
            effects: {
                shadow: {
                    color: COLORS.HG_BLACK,
                    blur: 5
                }
            },
            playerIds: [playerId]
        });

        this.frameStates[playerId] = playerFrame;
        this.frameRoot.addChild(playerFrame);

        this.updateLabels();
    }

    handlePlayerUpdate(playerId, newData) {
        this.updateLabels();
    }

    handleNewSpectator(spectator) {
        if (this.session.spectators[spectator.id].remoteClient) {
            this.remotePlayerIds[spectator.id] = true;
        }
        const playerFrame = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            assetInfo: {
                'frame': {
                    pos: {x: 0, y: 0},
                    size: {
                        x: 100,
                        y: 100
                    }
                }
            },
            effects: {
                shadow: {
                    color: COLORS.HG_BLACK,
                    blur: 5
                }
            },
            playerIds: [spectator.id]
        });

        this.frameStates[spectator.id] = playerFrame;
        this.frameRoot.addChild(playerFrame);

        this.updateLabels();
    }

    exportSessionData() {
        const sessionDataPath = path.join(getAppDataPath(), 'hg-recordings');

        if (!fs.existsSync(sessionDataPath)) {
            fs.mkdirSync(sessionDataPath);
        }

        const exportPath = sessionDataPath + '/' + Date.now() + '.hgdata';
        const cleanedMetadata = Object.assign({}, this.session?.game?.constructor?.metadata && this.session.game.constructor.metadata());
        cleanedMetadata.assets = {};

        const exportData = {
            metadata: cleanedMetadata,
            data: this.session.stateHistory,
            assets: this.session.squisher.assetBundle
        };

        fs.writeFileSync(exportPath, JSON.stringify(exportData));

        return exportPath;
    }

    showSettings(playerId) {
        if (this.viewStates[playerId]?.state == 'settings') {
            const oldNodeId = this.viewStates[playerId].node.id;
            this.topLayerRoot.removeChild(this.viewStates[playerId].node.id);
        }
        this.viewStates[playerId] = {state: 'settings'};
        const playerInfo = this.session.playerInfoMap[playerId] || {};

        this.getLocalAssetInfo().then(assetInfo => {
            const onDownload = () => this.downloadAssets(assetInfo.gameAssetMap).then(() => this.showSettings(playerId));
            
            const modal = settingsModal({ 
                playerId,
                session: this.session,
                playerInfo,
                assetInfo,
                onDownload,
                onRemove: () => {
                    this.topLayerRoot.removeChild(modal.node.id);
                }, 
                onNameChange: (text) => new Promise((resolve, reject) => {
                    this.homenamesHelper.updatePlayerInfo(playerId,
                        {
                            playerName: text
                        }).then(resolve);
                }),
                onSoundToggle: (newVal) => new Promise((resolve, reject) => {
                    // used to filter out audio nodes when muted and stuff like that
                    this.session.squisher.updatePlayerSettings(playerId, {[PLAYER_SETTINGS.SOUND]: {enabled: newVal}});
                    this.homenamesHelper.updatePlayerSetting(playerId, PLAYER_SETTINGS.SOUND, {
                        enabled: newVal
                    }).then(() => {
                        log.info('just updated setting??');
                        resolve();
                    });
                }),
                onExportSessionData: () => {
                    return this.exportSessionData();
                }
            });
 
            this.viewStates[playerId].node = modal;
            this.topLayerRoot.addChild(modal);
        });
    }

    updateLabels() {
        for (const nodeId in this.frameRoot.node.children) {
            const playerFrame = this.frameRoot.node.children[nodeId];
            playerFrame.clearChildren();

            const playerId = playerFrame.node.playerIds[0];
            const playerInfo = this.session.playerInfoMap[playerId] || {};

            const settingsButton = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(42.5, 0, 15, BEZEL_SIZE_Y / 2),
                fill: COLORS.HG_BLUE,//[187, 189, 191, 255],
                onClick: (playerId) => {
                    this.showSettings(playerId);
                }, 
                playerIds: [playerId],
                effects: {
                    shadow: {
                        color: COLORS.HG_BLACK,
                        blur: 10
                    }
                },
            });

            const labelText = new GameNode.Text({
                textInfo: {
                    text: playerInfo.name || 'Spectator',
                    x: 50,
                    y: 1.5,
                    size: 0.8,
                    color: COLORS.HG_BLACK,
                    align: 'center',
                    font: 'heavy-amateur'
                },
                playerIds: [playerId]
            });
       
            if (this.serverCode) {
                const serverCodeNode = new GameNode.Text({
                    textInfo: {
                        text: `homegames.link   ${this.serverCode.split('').join(' ')}`,
                        x: 75,
                        y: 1,
                        size: 1.1,
                        color: COLORS.HG_RED,
                        align: 'center'
                    },
                    playerIds: [playerId]
                });

                playerFrame.addChild(serverCodeNode);
            }

            settingsButton.addChild(labelText);
                
            playerFrame.addChild(settingsButton);

            if (!this.isDashboard) {

                if (this.session.spectators[playerId]) {
                    const joinButton = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        fill: COLORS.HG_YELLOW,
                        coordinates2d: ShapeUtils.rectangle(10, 0, 15, 5),
                        onClick: () => {
                            this.session.joinSession(playerId);
                        },
                        playerIds: [playerId]
                    });

                    const joinText = new GameNode.Text({
                        textInfo: {
                            x: 17.5,
                            y: 1.5,
                            text: 'Join',
                            size: 0.9,
                            color: COLORS.HG_BLACK,
                            align: 'center'
                        },
                        playerIds: [playerId]
                    });
                    joinButton.addChild(joinText);
                    playerFrame.addChild(joinButton);
                } else {
                    const spectateButton = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        fill: COLORS.HG_YELLOW,
                        coordinates2d: ShapeUtils.rectangle(10, 0, 15, 5),
                        onClick: () => {
                            this.session.spectateSession(playerId);
                        },
                        playerIds: [playerId]
                    });
                    const spectateText = new GameNode.Text({
                        textInfo: {
                            x: 17.5,
                            y: 1.5,
                            text: 'Spectate',
                            size: 0.9,
                            color: COLORS.HG_BLACK,
                            align: 'center'
                        },
                        playerIds: [playerId]
                    });
                    spectateButton.addChild(spectateText);
                    playerFrame.addChild(spectateButton);
                }

                playerFrame.node.coordinates2d = playerFrame.node.coordinates2d;
            }
        }
    }

    handlePlayerDisconnect(playerId) {
        delete this.viewStates[playerId];
        if (this.playerDashboards[playerId]) {
            this.playerDashboards[playerId].intervals.forEach(interval => {
                clearInterval(interval);
            });
            this.homeButton.removeChild(this.playerDashboards[playerId].dashboard.id);
            delete this.playerDashboards[playerId];
        }
        if (this.frameStates[playerId]) {
            this.frameRoot.removeChild(this.frameStates[playerId].node.id);
            delete this.frameStates[playerId];
        }

        this.updateLabels();
    }

    handleSpectatorDisconnect(spectatorId) {
        delete this.viewStates[spectatorId];
        if (this.playerDashboards[spectatorId]) {
            this.playerDashboards[spectatorId].intervals.forEach(interval => {
                clearInterval(interval);
            });
            this.homeButton.removeChild(this.playerDashboards[spectatorId].dashboard.id);
            delete this.playerDashboards[spectatorId];
        }
        if (this.frameStates[spectatorId]) {
            this.frameRoot.removeChild(this.frameStates[spectatorId].node.id);
            delete this.frameStates[spectatorId];
        }

        this.updateLabels();
    }

    downloadAssets(gameAssetMap) {
        return new Promise((resolve, reject) => {
            let downloadedCount = 0;
            const checkedCount = 0;
            let totalCount = 0;
            const seenCount = 0;

            for (const gameKey in gameAssetMap) {
                for (const versionId in gameAssetMap[gameKey]) {
                    for (const assetKey in gameAssetMap[gameKey][versionId]) {
                        totalCount += 1;
                    }
                }
            }

            for (const gameKey in gameAssetMap) {
                for (const versionId in gameAssetMap[gameKey]) {
                    for (const assetKey in gameAssetMap[gameKey][versionId]) {
                        const asset = gameAssetMap[gameKey][versionId][assetKey];
                        asset.existsLocally().then(exists => {
                            if (exists) {
                                downloadedCount += 1;
                            } else {
                                asset.download().then(() => {
                                    downloadedCount += 1;
                                    if (downloadedCount == totalCount) {
                                        resolve();
                                    }
                                });
                            }

                            if (downloadedCount == totalCount) {
                                resolve();
                            }
                        });
                    }
                }
            }


        });
    }

    getLocalAssetInfo() {
        let localGames = {};
        try {
            localGames = getGameMap();
        } catch (err) {
            reportBug('Error getting local game map:\n' + err.toString());
        }

        return new Promise((resolve, reject) => {
            let downloadedCount = 0;
            const checkedCount = 0;
            let totalCount = 0;
            let seenCount = 0;

            const gameAssets = {};

            for (let key in localGames) {
                if (!gameAssets[key]) {
                    gameAssets[key] = {}
                }

                for (let versionId in localGames[key].versions) {
                    if (localGames[key].versions[versionId].class) {
                        const _class = localGames[key].versions[versionId].class;
                        const _gameAssets = _class.metadata && _class.metadata().assets;

                        if (gameAssets) {
                            gameAssets[key][versionId] = _gameAssets;
                        }
                    } else {
                        const gamePath = localGames[key].versions[versionId].gamePath;

                        const squishVersion = parseSquishVersion(gamePath);

                        process.env.SQUISH_PATH = squishMap[squishVersion];

                        try {
                            const _class = require(gamePath);
                            const _gameAssets = _class.metadata && _class.metadata().assets;

                            if (_gameAssets) {
                                gameAssets[key][versionId] = _gameAssets;
                            }
                        } catch (err) {
                            console.error('Unable to import game at ' + gamePath);
                        }
                    }
                }
            }


            for (const gameKey in gameAssets) {
                for (const versionId in gameAssets[gameKey]) {
                    for (const assetKey in gameAssets[gameKey][versionId]) {
                        totalCount += 1;
                    }
                }
            }

            const gameAssetMap = {};

            for (const gameKey in gameAssets) {
                gameAssetMap[gameKey] = {};
                for (const versionId in gameAssets[gameKey]) {
                    gameAssetMap[gameKey][versionId] = {};
                    let assetIndex = 0;
                    for (const assetKey in gameAssets[gameKey][versionId]) {
                        const asset = gameAssets[gameKey][versionId][assetKey];
                        asset.existsLocally().then(exists => {
                            if (exists) {
                                downloadedCount += 1;
                            }

                            gameAssetMap[gameKey][versionId][assetKey] = asset;

                            seenCount += 1;

                            if (seenCount == totalCount) {
                                resolve({
                                    totalCount,
                                    downloadedCount,
                                    gameAssetMap
                                });
                            }
                        });
                    }
                }
            }
        });

    }

    handleSquisherMessage(msg) {
        if (msg.type === 'renderStart') {
//            this.renderTimes.push({start: msg.time});
        } else if (msg.type === 'renderEnd') {
//            this.renderTimes[this.renderTimes.length - 1].end = msg.time;
        }
    }

    handleServerCode(serverCode) {
        this.serverCode = serverCode;
        this.updateLabels();
    }

}

module.exports = HomegamesRoot;
