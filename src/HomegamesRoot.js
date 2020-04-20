const { GameNode, Colors } = require('squishjs');
const Asset = require('./common/Asset');

class HomegamesRoot {
    constructor(game, isDashboard) {
        this.root = GameNode(
            Colors.WHITE,
            null,
            {x: 0, y: 0},
            {x: 0, y: 0}
        );

        const onDashHomeClick = (player, x, y) => {
            const thing = GameNode(Colors.WHITE, null, {x: 10, y: 10}, {x: 80, y: 80}, {text: 'What up', x: 50, y: 50, size: 100}, null, player.id);
            this.homeButton.addChild(thing);
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
