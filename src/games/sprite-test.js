const Asset = require('../common/Asset');
const Game = require('./Game');
const { GameNode, Colors } = require('squishjs');
const { COLORS: { BLACK, CREAM } } = Colors;

class SpriteTest extends Game {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        this.danceFrames = {
            'dance0': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_0.png',
            'dance_left': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_left.png',
            'dance_right': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_right.png',
            'dance_up': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_up.png',
            'dance_down': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_down.png'
        };

        this.playerSpots = {};

        const playerRows = 3;
        const playerCols = 8;

        for (let i = 0; i < playerRows * playerCols; i++) {
            this.playerSpots[i] = {
                x: i % playerCols,
                y: i % playerRows
            };
        }

        this.assets = {
            'dance0': new Asset('url', {
                'location': this.danceFrames['dance0'],
                'type': 'image'
            }),
            'dance_up': new Asset('url', {
                'location': this.danceFrames['dance_up'],
                'type': 'image'
            }),
            'dance_down': new Asset('url', {
                'location': this.danceFrames['dance_down'],
                'type': 'image'
            }),
            'dance_left': new Asset('url', {
                'location': this.danceFrames['dance_left'],
                'type': 'image'
            }),
            'dance_right': new Asset('url', {
                'location': this.danceFrames['dance_right'],
                'type': 'image'
            })
        };

        this.inputCooldowns = {};

        this.background = GameNode(
            CREAM,
            (player, x, y) => {
                let fakeArrowKey;
                if (x >= .25 && x <= .75) {
                    fakeArrowKey = y <= .5 ? 'ArrowUp' : 'ArrowDown';
                } else {
                    fakeArrowKey = x < .5 ? 'ArrowLeft' : 'ArrowRight';
                }
                this.handleKeyDown(player, fakeArrowKey);
            },
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

        const dancer = this.dancers[player.id];
        const frameMap = {
            'ArrowLeft': 'dance_left',
            'ArrowRight': 'dance_right',
            'ArrowUp': 'dance_up',
            'ArrowDown': 'dance_down'
        };

        const newFrame = frameMap[key] ? (dancer.asset.dance0 ? frameMap[key] : 'dance0') : 'dance0';
        const newAssets = {};
        newAssets[newFrame] = Object.values(this.dancers[player.id].asset)[0];
        dancer.asset = newAssets;
    }

    getPlayerSpot() {
        for (const i in this.playerSpots) {
            if (!this.playerSpots[i].player) {
                return this.playerSpots[i];
            }
        }
    }

    handleNewPlayer(player) {
        const spot = this.getPlayerSpot();
        spot.player = player;
        const x = ((spot.x * 10) + 2);
        const y = ((spot.y * 30) + 2);
        this.dancers[player.id] = GameNode(
            BLACK,
            null,
            {x: 10, y: 10},
            {x: 0, y: 0},
            {'text': player.name || 'Unknown Player', x: x + 7, y: y + 1},
            {'dance0': {pos: {x: x, y: y}, size: {x: 15, y: 15}}}
        );
        this.background.addChild(this.dancers[player.id]);
    }

    handlePlayerDisconnect(playerId) {
        // this is terrible but its working and its so cool
        for (const i in this.playerSpots) {
            if (this.playerSpots[i].playerId == playerId) {
                this.playerSpots[i].playerId = null;
            }
        }
        this.background.removeChild(this.dancers[playerId].id);
        delete this.dancers[playerId];
    }

    getAssets() {
        return this.assets;
    }

    getRoot() {
        return this.background;
    }
}

module.exports = SpriteTest;
