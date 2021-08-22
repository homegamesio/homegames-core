const squishMap = require('./common/squish-map');

let { GameNode, Colors, Shapes, ShapeUtils } = squishMap['0633'];

const Asset = require('./common/Asset');
const { animations } = require('./common/util');
const COLORS = Colors.COLORS;
const path = require('path');

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

    constructor(game, isDashboard, profiling) {
        this.isDashboard = isDashboard;
        this.profiling = profiling;
        this.renderTimes = [];
        this.game = game;
        if (game.constructor.metadata() && game.constructor.metadata().squishVersion) {
            const squishVersion = squishMap[game.constructor.metadata().squishVersion];
            GameNode = squishVersion.GameNode;
            Colors = squishVersion.Colors;
            Shapes = squishVersion.Shapes;
            ShapeUtils = squishVersion.ShapeUtils;
        }

        this.gameAssets = {};

        for (let gameIndex in games) {
            const game = games[gameIndex];
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
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        this.playerDashboards = {};

        const onDashHomeClick = (player, x, y) => {
            if (this.playerDashboards[player.id] && this.playerDashboards[player.id].dashboard) {
                return;
            }

            const modalShape = ShapeUtils.rectangle(10, 10, 80, 80);
            const settingsText = new GameNode.Text({
                textInfo: {
                    text: 'Settings (and other stuff)',
                    x: 50,
                    y: 12,
                    size: 2.1,
                    align: 'center',
                    color: COLORS.BLACK
                },
                playerIds: [player.id]
            });

            let totalAssetCount = 0;
            for (const key in this.gameAssets) {
                totalAssetCount += Object.values(this.gameAssets[key]).length;
            }

            const modal = new GameNode.Shape({ 
                shapeType: Shapes.POLYGON,
                coordinates2d: modalShape,
                fill: COLORS.WHITE,
                playerIds: [player.id],
                effect: {
                    shadow: {
                        color: COLORS.BLACK,
                        blur: 6
                    }
                }
            });

            this.getLocalAssetInfo().then(info => {
                const totalAssetText = new GameNode.Text({
                    textInfo: {
                        text: `${info.downloadedCount} of ${totalAssetCount} assets`,
                        x: 26,
                        y: 70,
                        size: 1.6,
                        color: COLORS.BLUE,
                        align: 'center'
                    },
                    playerIds: [player.id]
                });

                if (info.downloadedCount < info.totalCount) {
                    const downloadButton = new GameNode.Shape({
                        onClick: () => {
                            this.downloadAssets().then(() => {
                                this.getLocalAssetInfo().then(info => {
                                    totalAssetText.node.text.text = `${info.downloadedCount} of ${info.totalCount} assets`;
                                    totalAssetText.node.text = totalAssetText.node.text;
                                    const allDownloadedLabel = new GameNode.Text({
                                        textInfo: {
                                            text: 'All assets downloaded!',
                                            x: 45,
                                            y: 72,
                                            color: COLORS.BLACK,
                                            size: .8,
                                            align: 'center'
                                        },
                                        playerIds: [player.id]
                                    });
                
                                    modal.addChild(allDownloadedLabel);
                                    modal.removeChild(downloadButton.node.id);
                                });
                            });
                        },
                        fill: COLORS.GREEN,
                        coordinates2d: ShapeUtils.rectangle(40, 70, 10, 5),
                        shapeType: Shapes.POLYGON,
                        playerIds: [player.id]
                    });

                    const downloadLabel = new GameNode.Text({
                        textInfo: {
                            text: 'Download all assets',
                            x: 45,
                            y: 72,
                            color: COLORS.BLACK,
                            size: .6,
                            align: 'center'
                        },
                        playerIds: [player.id]
                    });

                    downloadButton.addChild(downloadLabel);

                    modal.addChild(downloadButton);
                } else {
                    const allDownloadedLabel = new GameNode.Text({
                        textInfo: {
                            text: 'All assets downloaded!',
                            x: 45,
                            y: 72,
                            color: COLORS.BLACK,
                            size: .8,
                            align: 'center'
                        },
                        playerIds: [player.id]
                    });

                    modal.addChild(allDownloadedLabel);
                }

                modal.addChild(totalAssetText);

            });


            const closeButton = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(10, 10, 10, 10),
                fill: COLORS.HG_RED,
                playerIds: [player.id],
                onClick: (player) => {
                    this.playerDashboards[player.id] = null;
                    this.homeButton.removeChild(modal.node.id);
                }
            });

            const playerName = new GameNode.Text({
                textInfo: {
                    text: `Name: ${player.info.name}`,
                    x: 20,
                    y: 35,
                    size: 1.6,
                    align: 'left',
                    color: COLORS.BLACK
                }, 
                playerIds: [player.id], 
                input: {
                    type: 'text',
                    oninput: (player, text) => {
                        player.info.name = text;
                        player.updatePlayerInfo().then(() => {
                            playerName.node.text.text = `Name: ${player.info.name}`;
                            playerName.node.text = playerName.node.text;
                        })
                    }
                }
            });
            
            const version = new GameNode.Text({
                textInfo: {
                    text: `Version: ${process.env.npm_package_version}`,
                    x: 20,
                    y: 27,
                    size: 1.6,
                    align: 'left',
                    color: COLORS.BLACK
                }, 
                playerIds: [player.id]
            });

            modal.addChildren(settingsText, playerName, closeButton, version);
            this.homeButton.addChild(modal);
            this.playerDashboards[player.id] = {dashboard: modal, intervals: []};
        };

        const onGameHomeClick = (player) => {
            player.receiveUpdate([5, 70, 0]);
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

        this.settingsButton = new GameNode.Asset({
            onClick: onDashHomeClick,
            coordinates2d: ShapeUtils.rectangle(50, .1, 4.5, 7),
            assetInfo: {
                'settings-gear': {
                    pos: {
                        x: 50,
                        y: .1
                    },
                    size: {
                        x: 4.5,
                        y: 7
                    }
                }
            }
        });

        this.baseThing = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        if (this.profiling) {
            this.perfThing = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                fill: COLORS.RED,
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 10),
                onClick: (player, x, y) => {
                    console.log('I have been clicked');
                }
            });

            const cpuLabel = new GameNode.Text({
                textInfo: {
                    text: 'CPU',
                    x: 3,
                    y: 2,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: 1
                }
            });

            const cpuPercentageLabel1 = new GameNode.Text({
                textInfo: {
                    text: '0%',
                    x: 7,
                    y: 8,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: .5
                }
            });

            const cpuPercentageLabel2 = new GameNode.Text({
                textInfo: {
                    text: '50%',
                    x: 7,
                    y: 4.5,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: .5
                }
            });

            const cpuPercentageLabel3 = new GameNode.Text({
                textInfo: {
                    text: '100%',
                    x: 7,
                    y: 1,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: .5
                }
            });

            const cpuPerfGraph = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(8, 1, 16, 8),
                fill: COLORS.WHITE
            });

            const memLabel = new GameNode.Text({
                textInfo: {
                    text: 'Mem.',
                    x: 30,
                    y: 2,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: 1
                }
            });

            const memPercentageLabel1 = new GameNode.Text({
                textInfo: {
                    text: '0%',
                    x: 33,
                    y: 8,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: .5
                }
            });

            const memPercentageLabel2 = new GameNode.Text({
                textInfo: {
                    text: '50%',
                    x: 33,
                    y: 4.5,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: .5
                }
            });

            const memPercentageLabel3 = new GameNode.Text({
                textInfo: {
                    text: '100%',
                    x: 33,
                    y: 1,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: .5
                }
            });

            const memGraph = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(34, 1, 16, 8),
                fill: COLORS.WHITE
            });

            const ttsLabel1 = new GameNode.Text({
                textInfo: {
                    text: '0ms',
                    x: 59,
                    y: 8,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: .5
                }
            });

            const ttsLabel2 = new GameNode.Text({
                textInfo: {
                    text: '50ms',
                    x: 59,
                    y: 4.5,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: .5
                }
            });

            const ttsLabel3 = new GameNode.Text({
                textInfo: {
                    text: '100ms',
                    x: 59,
                    y: 1,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: .5
                }
            });

            const squishGraph = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(60, 1, 16, 8),
                fill: COLORS.WHITE
            });


            let startX = 8;
            let startY = 1;
            let endX = 24.5;
            let endY = 8.5;
            let memStartX = 34;
 
            let cpuData = [];

            cpuData.push(procStats());

            setInterval(() => {

                const getVisibleData = () => {
                    const dotWidth = .5;
                    const padding = .5;
                    const graphWidth = endX - startX;
                    const graphHeight = endY - startY;
                    const count = Math.floor(graphWidth / (padding + dotWidth));

                    let _data = [];
                    for (let i = cpuData.length - 1; i >= 0; i--) {
                        _data.push(cpuData[i]);
                        if (_data.length >= count) {
                            break;
                        }
                    }

                    let _renderData = [];
                    for (let i = this.renderTimes.length - 1; i >= 0; i--) {
                        _renderData.push(this.renderTimes[i]);
                        if (_renderData.length >= count) {
                            break;
                        }
                    }

                    return {renderData: _renderData, resourceData: _data};
                };

                const visibleData = getVisibleData();
                const dataToShow = visibleData.resourceData.reverse();
                const squishDataToShow = visibleData.renderData.reverse();

                cpuPerfGraph.clearChildren();
                memGraph.clearChildren();
                squishGraph.clearChildren();

                let dotX = startX;
                let memDotX = memStartX;

                let squishDotX = 60;

                let renderSum = 0;
                for (const s in squishDataToShow) {
                    const squishData = squishDataToShow[s];
                    const renderTime = squishData.end - squishData.start;
                    const renderVal = endY - (renderTime / 100 * (endY - startY));
                    const renderDot = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(squishDotX, renderVal, .5, .5),
                        fill: COLORS.PURPLE
                    });

                    renderSum += renderTime;
                    squishDotX += 1;
                    squishGraph.addChild(renderDot);
                }

                if (squishDataToShow.length > 0) {
                    const avgRenderTime = renderSum / squishDataToShow.length;
                    const timeline = squishDataToShow[squishDataToShow.length - 1].end - squishDataToShow[0].start;
                    const renderCount = squishDataToShow.length;
                    const factorThing = (1000 / timeline);
                    const avgRenderLabel = new GameNode.Text({
                        textInfo: {
                            text: `Avg: ${avgRenderTime.toFixed(2)}ms/render`,
                            x: 85,
                            y: 3,
                            align: 'center',
                            size: 1,
                            color: COLORS.WHITE
                        }
                    });

                    const perSecondLabel = new GameNode.Text({
                        textInfo: {
                            text: `${(renderCount * factorThing).toFixed(2)} renders/sec`,
                            x: 85,
                            y: 6,
                            align: 'center',
                            size: 1,
                            color: COLORS.WHITE
                        }
                    });

                    squishGraph.addChildren(avgRenderLabel, perSecondLabel);
                }

                for (const i in dataToShow) {
                    const cpuPercentage = dataToShow[i].cpu.value;
                    const memPercentage = dataToShow[i].memUsed.percent;

                    const memYVal = endY - (memPercentage / 100 * (endY - startY));
                    const memDot = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(memDotX, memYVal, .5, .5),
                        fill: COLORS.BLACK
                    });

                    const graphVal = endY - (cpuPercentage/100 * (endY - startY));
                    const dot = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(dotX, graphVal, .5, .5),
                        fill: COLORS.BLUE
                    });
                    dotX += 1;
                    memDotX += 1;

                    cpuPerfGraph.addChild(dot);
                    memGraph.addChild(memDot);
                }
                
                const cpuValue = new GameNode.Text({
                    textInfo: {
                        text: `${dataToShow.length && Math.floor(dataToShow[dataToShow.length - 1].cpu.value) + '%' || 'No data available'}`,
                        x: 3.2,
                        y: 5.5,
                        color: COLORS.GREEN,
                        align: 'center',
                        size: .9
                    }
                });
                
                const memValue = new GameNode.Text({
                    textInfo: {
                        text: `${dataToShow.length && Math.floor(dataToShow[dataToShow.length - 1].memUsed.percent) + '%' || 'No data available'}`,
                        x: 30,
                        y: 5.5,
                        color: COLORS.GREEN,
                        align: 'center',
                        size: .9
                    }
                });

                cpuPerfGraph.addChild(cpuValue);
                memGraph.addChild(memValue);

                cpuData.push(procStats());
            }, 1000);

            const ttsLabel = new GameNode.Text({
                textInfo: {
                    text: `TTS`,
                    x: 56.5,
                    y: 3,
                    size: 1,
                    align: 'center',
                    color: COLORS.WHITE
                }
            });


            this.perfThing.addChildren(memLabel, memPercentageLabel1, memPercentageLabel2, memPercentageLabel3, memGraph);
            this.perfThing.addChildren(cpuLabel, cpuPercentageLabel1, cpuPercentageLabel2, cpuPercentageLabel3, cpuPerfGraph);
            this.perfThing.addChildren(ttsLabel, ttsLabel1, ttsLabel2, ttsLabel3, squishGraph);

            this.root.addChild(this.perfThing);
        }

        this.root.addChild(this.baseThing);
        this.root.addChild(game.getRoot());
        this.root.addChild(this.homeButton);
        this.root.addChild(this.settingsButton);
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
        this.baseThing.addChild(playerFrame);

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

    updateLabels() {
        for (const nodeId in this.baseThing.node.children) {
            const playerFrame = this.baseThing.node.children[nodeId];
            playerFrame.clearChildren();

            const playerId = playerFrame.node.playerIds[0];
            const player = this.players[playerId] || this.spectators[playerId];
            if (!player) {
                return;
            }

            const labelText = new GameNode.Text({
                textInfo: {
                    text: player.info.name || 'unknown',
                    x: 5,
                    y: 1,
                    size: 0.7,
                    color: COLORS.WHITE,
                    align: 'center'
                },
                playerIds: [playerId]
            });
    
            playerFrame.addChild(labelText);

            if (!this.isDashboard) {
                const isSpectator = this.spectators[playerId] && true || false;

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
                } else if (Object.values(this.players).length > 1) {
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
                    playerFrame.addChild(button)
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
            this.baseThing.removeChild(this.frameStates[playerId].node.id);
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
//            console.log(`Rendered ${this.renderTimes.length} frames`);
        }
    }

}

module.exports = HomegamesRoot;
