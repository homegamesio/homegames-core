const { Asset } = require('../../common/Asset');
const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-063');
const COLORS = Colors.COLORS;

class SpriteTest extends Game {
    static metadata() {
        const danceFrames = {
            'dance0': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_0.png',
            'dance_left': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_left.png',
            'dance_right': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_right.png',
            'dance_up': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_up.png',
            'dance_down': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/dance_down.png'
        };

        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '063',
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/sprite-test.png',
            assets: {
                'dance0': new Asset('url', {
                    'location': danceFrames['dance0'],
                    'type': 'image'
                }),
                'dance_up': new Asset('url', {
                    'location': danceFrames['dance_up'],
                    'type': 'image'
                }),
                'dance_down': new Asset('url', {
                    'location': danceFrames['dance_down'],
                    'type': 'image'
                }),
                'dance_left': new Asset('url', {
                    'location': danceFrames['dance_left'],
                    'type': 'image'
                }),
                'dance_right': new Asset('url', {
                    'location': danceFrames['dance_right'],
                    'type': 'image'
                })
            }
        };
    }

    constructor() {
        super();
        this.playerSpots = {};
        
        const playerRows = 3;
        const playerCols = 8;

        for (let i = 0; i < playerRows * playerCols; i++) {
            this.playerSpots[i] = {
                x: i % playerCols,
                y: i % playerRows
            };
        }

        this.inputCooldowns = {};

        this.background = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.CREAM,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (player, x, y) => {
                let fakeArrowKey;
                if (x >= 25 && x <= 75) {
                    fakeArrowKey = y <= 50 ? 'ArrowUp' : 'ArrowDown';
                } else {
                    fakeArrowKey = x < 50 ? 'ArrowLeft' : 'ArrowRight';
                }
                this.handleKeyDown(player, fakeArrowKey);
            }
        });

        this.dancers = {};
    }

    handleKeyDown(player, key) {
        if (this.inputCooldowns[player.id]) {
            return;
        }
        this.inputCooldowns[player.id] = this.setTimeout(function() {
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

        const newFrame = frameMap[key] ? (dancer.node.asset.dance0 ? frameMap[key] : 'dance0') : 'dance0';
        const newAssets = {};
        newAssets[newFrame] = Object.values(this.dancers[player.id].node.asset)[0];
        dancer.node.asset = newAssets;
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
        const dancer = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(x, y, 15, 15),
            assetInfo: {
                'dance0': {
                    pos: {x, y},
                    size: {x: 15, y: 15}
                }
            }
        });

        this.dancers[player.id] = dancer;

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

    getRoot() {
        return this.background;
    }
}

module.exports = SpriteTest;
