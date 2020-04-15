const { GameNode, Colors } = require('squishjs');
const Asset = require('./common/Asset');

class HomegamesRoot {
    constructor(game) {
        this.root = GameNode(
            Colors.WHITE,
            null,
            {x: 0, y: 0},
            {x: 0, y: 0}
        );
        this.homeButton= GameNode(
            Colors.WHITE,
            (player) => {
                player.receiveUpdate([5, 70, 0]);
            },
            {x: 2, y: 2},
            {x: 8, y: 8 * 16 / 9},
            null,
            {
                'home-button': {
                    pos: {x: 2, y: 2},
                    size: {
                        x: 8, y: 8 * 16 / 9
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
