const squishMap = require('./common/squish-map');

let { GameNode, Colors, Shapes, ShapeUtils } = squishMap['0633'];

const Asset = require('./common/Asset');
const { animations } = require('./common/util');
const COLORS = Colors.COLORS;
const path = require('path');
let baseDir = path.dirname(require.main.filename);

const process = require('process');
const procStats = require('process-stats')();

class HomegamesRoot {
    constructor(game, isDashboard, profiling) {
        this.isDashboard = isDashboard;
        this.profiling = profiling;
        this.game = game;
        if (game.constructor.metadata() && game.constructor.metadata().squishVersion) {
            const squishVersion = squishMap[game.constructor.metadata().squishVersion];
            GameNode = squishVersion.GameNode;
            Colors = squishVersion.Colors;
            Shapes = squishVersion.Shapes;
            ShapeUtils = squishVersion.ShapeUtils;
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
                    y: 10,
                    size: 2.5,
                    align: 'center',
                    color: COLORS.BLACK
                },
                playerIds: [player.id]
            });

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
                    text: `Name: ${player.name}`,
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
                        player.name = text;
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
            onClick: isDashboard ? onDashHomeClick : onGameHomeClick,
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
                    y: 4.2,
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
                    y: 4.2,
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
                    return _data;
                };

                const dataToShow = getVisibleData().reverse();

                cpuPerfGraph.clearChildren();
                memGraph.clearChildren();

                let dotX = startX;
                let memDotX = memStartX;
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
                cpuData.push(procStats());
//                const result = 100 * (newUsage.user + newUsage.system) / ((Date.now() - startTime) * 1000)
//                console.log(result);
            }, 500);

            this.perfThing.addChildren(memLabel, memPercentageLabel1, memPercentageLabel2, memPercentageLabel3, memGraph);
            this.perfThing.addChildren(cpuLabel, cpuPercentageLabel1, cpuPercentageLabel2, cpuPercentageLabel3, cpuPerfGraph);

            this.root.addChild(this.perfThing);
        }

        this.root.addChild(this.baseThing);
        this.root.addChild(game.getRoot());
        this.root.addChild(this.homeButton);
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
        console.log('sogsg');
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
                    text: player.name,
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

    getAssets() {
        return {
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
        };
    }
}

module.exports = HomegamesRoot;
