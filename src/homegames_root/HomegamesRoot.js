const process = require('process');
const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require(process.env.SQUISH_PATH || 'squish-0756');

const { animations } = require('../common/util');

const PLAYER_SETTINGS = require('../common/player-settings.js');

const path = require('path');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}
const { getConfigValue } = require('homegames-common');
const HomenamesHelper = require('../util/homenames-helper');

const settingsModal = require('./settings');
const COLORS = Colors.COLORS;

const procStats = require('process-stats')();

const HOME_PORT = getConfigValue('HOME_PORT', 7001);
class HomegamesRoot {
    static metadata() {
        return {
            assets: {
                'frame': new Asset({
                    'id': 'c299f1f7e24d03e59cb569f5815bfe2f',
                    'type': 'image'
                }),
                'logo-horizontal': new Asset({
                    'id': '31b81479f187d9ab6aa6845e0794b4be',
                    'type': 'image'
                })
            }
        };
    }
    getTopLayerRoot() {
        return this.topLayerRoot;
    }

    constructor(session, isDashboard, profiling) {
        this.isDashboard = isDashboard;
        this.profiling = profiling;
        this.renderTimes = [];
        this.session = session;
        this.homenamesHelper = new HomenamesHelper();

        this.gameAssets = {};
        this.viewStates = {};

        this.frameStates = {};
  
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
            this.session.movePlayer({ playerId, port: HOME_PORT });
        };

        const gameAspectRatio = this.session.game.constructor.metadata && this.session.game.constructor.metadata().aspectRatio;
        let aspectRatio;
        if (gameAspectRatio) {
            aspectRatio = gameAspectRatio;
        } else {
            aspectRatio = {x: 16, y: 9};
        }

        const logoSizeX = 17 * (aspectRatio.y / aspectRatio.x);
        const logoSizeY = 5;
        const logoStartY = 94.5;
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
        // const ting = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(0, 0, 80, 80),
        //     fill: COLORS.HG_BLUE,
        //     // playerIds: [playerId]
        // });
        // this.topLayerRoot.addChild(ting);
    }

    getRoot() {
        return this.root;
    }

    handleNewPlayer({ playerId }) {
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
        if (this.viewStates[playerId] && this.viewStates[playerId].state === 'settings') {
            this.showSettings(playerId);
        }
    }

    handleNewSpectator(spectator) {
        const spectatorFrame = new GameNode.Asset({
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

        this.frameStates[spectator.id] = spectatorFrame;
        this.baseThing.addChild(spectatorFrame);
        this.updateLabels();
    }

    showSettings(playerId) {
        this.topLayerRoot.clearChildren();
        this.viewStates[playerId] = {state: 'settings'};
        const modal = settingsModal({ 
            playerId,
            onRemove: () => {
                this.topLayerRoot.removeChild(modal.node.id);
            }, 
            onNameChange: (text) => {
                this.homenamesHelper.updatePlayerInfo(playerId,
                    {
                        playerName: text
                    });
            },
            onSoundToggle: (newVal) => {
                this.homenamesHelper.updatePlayerSetting(playerId, PLAYER_SETTINGS.SOUND, {
                    enabled: newVal
                });
            }
        });

        
        this.topLayerRoot.addChild(modal);
    }

    updateLabels() {
        for (const nodeId in this.frameRoot.node.children) {
            const playerFrame = this.frameRoot.node.children[nodeId];
            
            playerFrame.clearChildren();

            const playerId = playerFrame.node.playerIds[0];
            const playerInfo = this.session.playerInfoMap[playerId];

            const settingsButton = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(42.5,.25, 15, 4.5),
                fill: [187, 189, 191, 255],
                onClick: (playerId) => {
                    this.showSettings(playerId);
                }, 
                playerIds: [playerId],
                effects: {
                    shadow: {
                        color: COLORS.BLACK,
                        blur: 10
                    }
                },
            });

            const labelText = new GameNode.Text({
                textInfo: {
                    text: playerInfo.name || 'unknown',
                    x: 50,
                    y: 1.5,
                    size: 0.7,
                    color: COLORS.WHITE,
                    align: 'center'
                },
                playerIds: [playerId]
            });
       
            if (this.serverCode) {
                const serverCodeNode = new GameNode.Text({
                    textInfo: {
                        text: `Server code: ${this.serverCode.split('').join(' ')}`,
                        x: 75,
                        y: 1,
                        size: 1.6,
                        color: COLORS.ORANGE,
                        align: 'center'
                    },
                    playerIds: [playerId]
                });

                playerFrame.addChild(serverCodeNode)
            }

            settingsButton.addChild(labelText);
                
            playerFrame.addChild(settingsButton);

            if (!this.isDashboard) {
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
        if (this.frameStates[spectatorId]) {
            this.baseThing.removeChild(this.frameStates[spectatorId].node.id);
            delete this.frameStates[spectatorId];
        }

        this.updateLabels();
    }

    downloadAssets() {
        return new Promise((resolve, reject) => {
            let downloadedCount = 0;
            const checkedCount = 0;
            let totalCount = 0;
            const seenCount = 0;

            for (const gameKey in this.gameAssets) {
                for (const assetKey in this.gameAssets[gameKey]) {
                    totalCount += 1;
                }
            }
            for (const gameKey in this.gameAssets) {
                for (const assetKey in this.gameAssets[gameKey]) {
                    const asset = this.gameAssets[gameKey][assetKey];
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


        });
    }

    getLocalAssetInfo() {
        return new Promise((resolve, reject) => {
            let downloadedCount = 0;
            const checkedCount = 0;
            let totalCount = 0;
            let seenCount = 0;

            for (const gameKey in this.gameAssets) {
                for (const assetKey in this.gameAssets[gameKey]) {
                    totalCount += 1;
                }
            }
            for (const gameKey in this.gameAssets) {
                for (const assetKey in this.gameAssets[gameKey]) {
                    const asset = this.gameAssets[gameKey][assetKey];
                    asset.existsLocally().then(exists => {
                        if (exists) {
                            downloadedCount += 1;
                        }

                        seenCount += 1;

                        if (seenCount == totalCount) {
                            resolve({
                                totalCount,
                                downloadedCount
                            });
                        }
                    });
                }
            }
        });

    }

    handleSquisherMessage(msg) {
        if (msg.type === 'renderStart') {
            this.renderTimes.push({start: msg.time});
        } else if (msg.type === 'renderEnd') {
            this.renderTimes[this.renderTimes.length - 1].end = msg.time;
        }
    }

    handleServerCode(serverCode) {
        this.serverCode = serverCode;
        this.homeButton.node.handleClick = null;
        this.updateLabels();
    }

}

module.exports = HomegamesRoot;
