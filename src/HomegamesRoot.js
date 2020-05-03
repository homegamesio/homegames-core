const { GameNode, Colors, Shapes } = require('squishjs');
const Asset = require('./common/Asset');
const { animations } = require('./common/util');

class HomegamesRoot {
    constructor(game, isDashboard) {
        this.root = new GameNode.Shape(
            Colors.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                    [0, 0],
                    [0, 0]
                ]
            },
            null
        );

        this.playerDashboards = {};

        const onDashHomeClick = (player, x, y) => {

            if (this.playerDashboards[player.id] && this.playerDashboards[player.id].dashboard) {
                return;
            };

            const thingShape = Shapes.RECTANGLE(5, 5, 90, 90);
            const settingsText = new GameNode.Text({
                text: 'Settings (and other stuff)',
                x: 50,
                y: 10,
                size: 100
            }, player.id);
            const thing = new GameNode.Shape(Colors.WHITE, 
                Shapes.POLYGON,
                {
                    coordinates2d: thingShape,
                    fill: Colors.WHITE
                },
                player.id,
                null,
                {
                    shadow: {
                        color: Colors.BLACK,
                        blur: 6
                    }
                }
            );

            const playerName = new GameNode.Text({
                text: `Name: ${player.name}`,
                x: 20,
                y: 40,
                size: 40
            }, player.id, {
                type: 'text',
                oninput: (player, text) => {
                    console.log('player said');
                    console.log(text);
                }
            });

            thing.addChildren(settingsText, playerName);
//            const closeThing = GameNode(Colors.BLACK, () => {
//                this.homeButton.removeChild(thing.id);
//            }, {x: 80, y: 10}, {x: 10, y: 10}, {text: 'Close', x: 85, y: 13, size: 50, color: Colors.WHITE}, null, player.id);
//            const name = GameNode([255, 255, 255, 0], null, {x: 12, y: 38}, {x: 17, y: 10}, {text: `Name: ${player.name}`, x: 20, y: 40, size: 40}, null, player.id, 
//            null,
//            {
//                type: 'text',
//                oninput: (player, text) => {
//                    if (!text) {
//                        return;
//                    }
//                    this.players[player.id].name = text;
//                    const newName = name.text;
//                    newName.text = `Name: ${player.name}`;
//                    name.text = newName;
//                }
//            });
//
//            const version = new GameNode.Text([255, 255, 255, 0], null, 
//                {
//                    x: 20,
//                    y: 30
//                },
//                {
//                    x: 10,
//                    y: 10
//                },
//                {
//                    text: `Version: TODO`,
//                    x: 20,
//                    y: 30,
//                    size: 40
//                },
//                null,
//                player.id
//            );
//            thing.addChild(closeThing);
//            thing.addChild(version);
//            thing.addChild(name);
            this.homeButton.addChild(thing);
            //const int1 = animations.fadeIn(version, .8, 20);
            //const int2 = animations.fadeIn(thing, .8, 20);
            //const int3 = animations.fadeIn(name, .8, 20);
            this.playerDashboards[player.id] = {dashboard: thing, intervals: []};//: [int1, int2, int3]};
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
