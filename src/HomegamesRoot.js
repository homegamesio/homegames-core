let { GameNode, Colors, Shapes, ShapeUtils } = require('squish-0710');

const Asset = require('./common/Asset');
const { animations } = require('./common/util');
const COLORS = Colors.COLORS;
const path = require('path');
let baseDir = path.dirname(require.main.filename);

const games = require('./games');

const process = require('process');
const procStats = require('process-stats')();

class HomegamesRoot {
    static metadata() {
        return {
            assets: {
                'settings-gear': new Asset('url', {
                    'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/assets/settings_gear.png',
                    'type': 'image'
                }),
                'home-button': new Asset('url', {
                    'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/homegames_logo_small.png',
                    'type': 'image'
                }),
                'frame': new Asset('url', {
                    'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/frame.jpg',
                    'type': 'image'
                }),
                'logo-horizontal': new Asset('url', {
                    'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/logo_horizontal.png',
                    'type': 'image'
                })
            }
        }
    }
    getTopLayerRoot() {
        return this.topLayerRoot;
    }

    constructor(game, isDashboard, profiling) {
        this.isDashboard = isDashboard;
        this.profiling = profiling;
        this.renderTimes = [];
        this.game = game;

        this.gameAssets = {};

        for (let gameIndex in this.games) {
            const game = this.games[gameIndex];
            const gameMetadata = game.metadata && game.metadata();
            if (gameMetadata && gameMetadata.assets) {
                if (!this.gameAssets[game.name]) {
                    this.gameAssets[game.name] = {};
                }

                for (const key in gameMetadata.assets) {
                    this.gameAssets[game.name][key] = gameMetadata.assets[key];
                }

            }
        }

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

        // todo: pull this from config and turn port conversion into a function
       const onGameHomeClick = (player) => {
           player.receiveUpdate([5, 70, 1]);
       };

       const gameAspectRatio = game.constructor.metadata && game.constructor.metadata().aspectRatio;
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
            onClick: onGameHomeClick,
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

    handleNewPlayer(player) {
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
           playerIds: [player.id]
       });

       this.frameStates[player.id] = playerFrame;
       this.frameRoot.addChild(playerFrame);

       this.updateLabels();
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
        console.log('plssdsd ' + playerId);
        console.log("COLORS");
        console.log(COLORS);
        const settingsModal = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 80, 80),
            fill: COLORS.HG_BLUE,
            onClick: () => {
                console.log('removing');
                console.log(settingsModal.node);
                this.topLayerRoot.removeChild(settingsModal.node.id);
            },
            playerIds: [playerId]
        });

        // console.log('what is this');
        // console.log(this);
        
        this.topLayerRoot.addChild(settingsModal);
    }

    updateLabels() {
        for (const nodeId in this.frameRoot.node.children) {
            const playerFrame = this.frameRoot.node.children[nodeId];
            
            playerFrame.clearChildren();

            const playerId = playerFrame.node.playerIds[0];
            const player = this.game.players[playerId] || this.game.spectators[playerId];
            if (!player) {
                return;
            }

            const settingsButton = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(45, 0, 10, 5),
                        fill: [84, 77, 71, 255], // frame color
                        onClick: (player, x, y) => {
                            this.showSettings(player.id);
                            // player.receiveUpdate([6, Math.floor(this.game.session.port / 100), Math.floor(this.game.session.port % 100)]);
                            //player.receiveUpdate([6, Math.floor(this.game.session.port / 100), Math.floor(this.game.session.port % 100)]);
                        }, 
                        playerIds: [playerId]
            });

            const labelText = new GameNode.Text({
                textInfo: {
                    text: 'big ole b',//player.info.name || 'unknown',
                    x: 50,
                    y: 1,
                    size: 0.7,
                    color: COLORS.WHITE,
                    align: 'center'
                },
                onClick: () => {
                    console.log('clicking box');
                },
                playerIds: [playerId]
            });
    
            settingsButton.addChild(labelText);
            playerFrame.addChild(settingsButton);

            if (!this.isDashboard) {
                const isSpectator = this.game.spectators && this.game.spectators[playerId] && true || false;

                let button;
                if (isSpectator) {
                    const label = new GameNode.Text({
                        textInfo: {
                            text: 'Join game',
                            x: 15,
                            y: 1,
                            size: 0.7,
                            color: COLORS.WHITE,
                            align: 'center'
                        },
                        playerIds: [playerId]
                    });

                    button = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(10, 0, 10, 3),
                        fill: COLORS.HG_BLUE,
                        onClick: (player, x, y) => {
                            
                            player.receiveUpdate([5, Math.floor(this.game.session.port / 100), Math.floor(this.game.session.port % 100)]);
                        },
                        playerIds: [playerId]
                    });


                    button.addChild(label);
                } else if (Object.values(this.game.players).length > 1) {
                    const label = new GameNode.Text({
                        textInfo: {
                            text: 'Switch to spectator',
                            x: 15,
                            y: 1,
                            size: 0.7,
                            color: COLORS.WHITE,
                            align: 'center'
                        },
                        playerIds: [playerId]
                    });

                    button = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(10, 0, 10, 3),
                        fill: COLORS.HG_BLUE,
                        onClick: (player, x, y) => {
                            player.receiveUpdate([6, Math.floor(this.game.session.port / 100), Math.floor(this.game.session.port % 100)]);
                            //player.receiveUpdate([6, Math.floor(this.game.session.port / 100), Math.floor(this.game.session.port % 100)]);
                        }, 
                        playerIds: [playerId]
                    });

                    button.addChild(label);
                } else {
//                    playerFrame.node.coordinates2d = playerFrame.node.coordinates2d;
                }

                if (button) {
                    // add spectator button back later
                    // playerFrame.addChild(button)
                }
            }
        }
    }

    handlePlayerDisconnect(playerId) {
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
            let checkedCount = 0;
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
                        } else {
                            asset.download().then(() => {
                                console.log('downloaded dddd');
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
            let checkedCount = 0;
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
                            })
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

}

module.exports = HomegamesRoot;
