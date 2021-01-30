const squishMap = require('./common/squish-map');

let { GameNode, Colors, Shapes, ShapeUtils } = squishMap['064'];

const Asset = require('./common/Asset');
const { animations } = require('./common/util');
const COLORS = Colors.COLORS;

class HomegamesRoot {
    constructor(game, isDashboard) {
        if (game.constructor.metadata() && game.constructor.metadata().squishVersion) {
            const squishVersion = squishMap[game.constructor.metadata().squishVersion];
            GameNode = squishVersion.GameNode;
            Colors = squishVersion.Colors;
            Shapes = squishVersion.Shapes;
            ShapeUtils = squishVersion.ShapeUtils;
        }
  
        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0]
            ]
        });

        this.playerDashboards = {};

        const onDashHomeClick = (player, x, y) => {
            if (this.playerDashboards[player.id] && this.playerDashboards[player.id].dashboard) {
                return;
            }

            const modalShape = ShapeUtils.rectangle(5, 5, 90, 90);
            const settingsText = new GameNode.Text({
                textInfo: {
                    text: 'Settings (and other stuff)',
                    x: 50,
                    y: 10,
                    size: 5,
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
                coordinates2d: ShapeUtils.rectangle(5, 5, 10, 10),
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
                    x: 8,
                    y: 35,
                    size: 2,
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
                    size: 2,
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

        this.baseThing = new GameNode.Asset({
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
            }

        });

        console.log(this.baseThing);

        this.root.addChild(this.baseThing);
        this.root.addChild(game.getRoot());
        this.root.addChild(this.homeButton);
    }

    getRoot() {
        return this.root;
    }

    handlePlayerDisconnect(playerId) {
        if (this.playerDashboards[playerId]) {
            this.playerDashboards[playerId].intervals.forEach(interval => {
                clearInterval(interval);
            });
            this.homeButton.removeChild(this.playerDashboards[playerId].dashboard.id);
            delete this.playerDashboards[playerId];
        }
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
