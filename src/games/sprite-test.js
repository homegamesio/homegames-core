const { Asset, gameNode, Colors, Deck } = require('../common');

class SpriteTest {
    constructor() {
        this.danceFrames = {
            'dance0':'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_0.png',
            'dance_left':'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_left.png',
            'dance_right':'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_right.png',
            'dance_up':'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_up.png',
            'dance_down':'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_down.png'
        }

        this.assets = {
            "dance0": new Asset("url", {
                "location": this.danceFrames['dance0'],
                "type": "image"
            }),
            "dance_up": new Asset("url", {
                "location": this.danceFrames['dance_up'],
                "type": "image"
            }),
            "dance_down": new Asset("url", {
                "location": this.danceFrames['dance_down'],
                "type": "image"
            }),
            "dance_left": new Asset("url", {
                "location": this.danceFrames['dance_left'],
                "type": "image"
            }),
            "dance_right": new Asset("url", {
                "location": this.danceFrames['dance_right'],
                "type": "image"
            })
        };

        this.inputCooldowns = {};

        this.background = gameNode(
            Colors.CREAM,
            null,
            {
                x: 0,
                y: 0
            },
            {
                x: 100,
                y: 100
            });

        this.dancers = {};
    }

    handleKeyDown(player, key) {
        if (this.inputCooldowns[player.id]) {
            return;
        }
        this.inputCooldowns[player.id] = setTimeout(function() {
            clearTimeout(this.inputCooldowns[player.id]);
            delete this.inputCooldowns[player.id];
        }.bind(this), 50);

        let dancer = this.dancers[player.id];
        let frameMap = {
            'ArrowLeft': 'dance_left',
            'ArrowRight': 'dance_right',
            'ArrowUp': 'dance_up',
            'ArrowDown': 'dance_down'
        };

        let newFrame = frameMap[key] ? (dancer.assets.dance0 ? frameMap[key] : 'dance0') : 'dance0';
        let newAssets = {};
        newAssets[newFrame] = Object.values(this.dancers[player.id].assets)[0];
        dancer.assets = newAssets;
    }

    handleNewPlayer(player) {
        this.dancers[player.id] = gameNode(
            Colors.BLACK,
            null,
            {x: 10, y: 10},
            {x: 0, y: 0},
            {'text': player.name, x: 50, y: 40},
            {'dance0': {pos: {x: 35, y: 45}, size: {x: 30, y: 30}}}
        );
        this.background.addChild(this.dancers[player.id]);
    }

    handlePlayerDisconnect(player) {
        this.background.clearChildren();
        delete this.dancers[player.id];
    }

    getAssets() {
        return this.assets;
    }

    getRoot() {
        return this.background;
    }
}

module.exports = SpriteTest;
