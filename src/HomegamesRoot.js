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

        // todo: get default aspect ratio from config
        const aspectRatio = game.constructor.metadata && game.constructor.metadata().aspectRatio || {x: 16, y: 9};

        this.homeButton = new GameNode.Asset(
            isDashboard ? onDashHomeClick : onGameHomeClick,
            [
                [2, 2],
                [10.1, 2],
                [10.1, 2 + (8.1 * (aspectRatio.x / aspectRatio.y))],
                [2, 2 + (8.1 * (aspectRatio.x / aspectRatio.y))],
                [2, 2]
            ],
            {
                'home-button': {
                    pos: {x: 2, y: 2},
                    size: {
                        x: 8.1, y: 8.1 * (aspectRatio.x / aspectRatio.y)
                    }
                }
            }
        );

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
            })
        }
    }
}

module.exports = HomegamesRoot;
