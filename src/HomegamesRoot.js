const { GameNode, Colors } = require('squishjs');
const Asset = require('./common/Asset');
const { animations } = require('./common/util');

class HomegamesRoot {
    constructor(game, isDashboard) {
        this.root = GameNode(
            Colors.WHITE,
            null,
            {x: 0, y: 0},
            {x: 0, y: 0}
        );

        this.playerDashboards = {};

        const onDashHomeClick = (player, x, y) => {
            const thing = GameNode([255, 255, 255, 0], null, {x: 5, y: 5}, {x: 90, y: 90}, {text: 'Settings (and other stuff)', x: 50, y: 10, size: 100}, 
                null, player.id,
            {
                shadow: {
                    color: Colors.BLACK,
                    blur: 6
                }
            });
            const closeThing = GameNode(Colors.BLACK, () => {
                this.homeButton.removeChild(thing.id);
            }, {x: 40, y: 40}, {x: 15, y: 15});
            const name = GameNode([255, 255, 255, 0], null, {x: 12, y: 38}, {x: 17, y: 10}, {text: `Name: ${player.name}`, x: 20, y: 40, size: 40}, null, player.id, 
            null,
            {
                type: 'text',
                oninput: (player, text) => {
                    if (!text) {
                        return;
                    }
                    this.players[player.id].name = text;
                    const newName = name.text;
                    newName.text = `Name: ${player.name}`;
                    name.text = newName;
                }
            });

            const version = GameNode([255, 255, 255, 0], null, 
                {
                    x: 20,
                    y: 30
                },
                {
                    x: 10,
                    y: 10
                },
                {
                    text: `Version: TODO`,
                    x: 20,
                    y: 30,
                    size: 40
                },
                null,
                player.id
            );
            thing.addChild(closeThing);
            thing.addChild(version);
            thing.addChild(name);
            this.homeButton.addChild(thing);
            const int1 = animations.fadeIn(version, .8, 20);
            const int2 = animations.fadeIn(thing, .8, 20);
            const int3 = animations.fadeIn(name, .8, 20);
            this.playerDashboards[player.id] = {dashboard: thing, intervals: [int1, int2, int3]};
        };

        const onGameHomeClick = (player) => {
            player.receiveUpdate([5, 70, 0]);
        };

        this.homeButton= GameNode(
            Colors.WHITE,
            isDashboard ? onDashHomeClick : onGameHomeClick,
            {x: 2.25, y: 2.25},
            {x: 7.6, y: 7.6 * 16 / 9},
            null,
            {
                'home-button': {
                    pos: {x: 2, y: 2},
                    size: {
                        x: 8.1, y: 8.1 * 16 / 9
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
