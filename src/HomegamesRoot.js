const { GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');
const Asset = require('./common/Asset');
const { animations } = require('./common/util');
const COLORS = Colors.COLORS;

class HomegamesRoot {
    constructor(game, isDashboard) {
        this.root = new GameNode.Shape(
            COLORS.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                    [0, 0],
                    [0, 0]
                ]
            }
        );

        this.playerDashboards = {};

        const onDashHomeClick = (player, x, y) => {
            if (this.playerDashboards[player.id] && this.playerDashboards[player.id].dashboard) {
                return;
            };

            const modalShape = ShapeUtils.rectangle(5, 5, 90, 90);
            const settingsText = new GameNode.Text({
                text: 'Settings (and other stuff)',
                x: 50,
                y: 10,
                size: 5,
                align: 'center',
                color: COLORS.BLACK
            }, player.id);

            const modal = new GameNode.Shape(COLORS.WHITE, 
                Shapes.POLYGON,
                {
                    coordinates2d: modalShape,
                    fill: COLORS.WHITE
                },
                player.id,
                null,
                {
                    shadow: {
                        color: COLORS.BLACK,
                        blur: 6
                    }
                }
            );

            const closeButton = new GameNode.Shape(
                COLORS.HG_RED,
                Shapes.POLYGON,
                {
                    coordinates2d: ShapeUtils.rectangle(5, 5, 10, 10),
                    fill: COLORS.HG_RED
                },
                player.id,
                (player) => {
                    this.playerDashboards[player.id] = null;
                    this.homeButton.removeChild(modal.node.id);
                }
            );

            const playerName = new GameNode.Text({
                text: `Name: ${player.name}`,
                x: 8,
                y: 35,
                size: 2,
                align: 'left',
                color: COLORS.BLACK
            }, player.id, {
                type: 'text',
                oninput: (player, text) => {
                    player.name = text;
                }
            });
            
            const version = new GameNode.Text({
                text: 'Version: TODO',
                x: 20,
                y: 27,
                size: 2,
                align: 'left',
                color: COLORS.BLACK
            }, player.id);
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

        this.homeButton = new GameNode.Asset(
            isDashboard ? onDashHomeClick : onGameHomeClick,
            ShapeUtils.rectangle(logoStartX, logoStartY, logoSizeX, logoSizeY),
            {
                'logo-horizontal': {
                    pos: {x: logoStartX, y: logoStartY},
                    size: {
                        x: logoSizeX, 
                        y: logoSizeY
                    }
                }
            }
        );

        this.baseThing = new GameNode.Asset(
            null,
            ShapeUtils.rectangle(0, 0, 100, 100),
            {
                'frame': {
                    pos: {x: 0, y: 0},
                    size: {
                        x: 100,
                        y: 100
                    }
                }
            }
        );

        this.root.addChild(this.baseThing);
        this.root.addChild(this.homeButton);
        this.root.addChild(game.getRoot());
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
        }
    }
}

module.exports = HomegamesRoot;
