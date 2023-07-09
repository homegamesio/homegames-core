const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-0767');
const COLORS = Colors.COLORS;

class SpriteTest extends Game {
    static metadata() {
        const danceFrames = {
            'dance0': '3b16c6d6ee6d3709bf827b61e61003b1',
            'dance_left': '1b2bd924c08a2b72d6ac18b28ba6a125',
            'dance_right': 'd5b9d6f97fad560735509723314fa524',
            'dance_up': '41ba50cf1bb69975c74d8f65ef43ee04',
            'dance_down': '22f9dd0f7519fadc805a7dc1ec051e6f'
        };

        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0767',
            author: 'Joseph Garcia',
            thumbnail: 'd8a39042ae0d7829b83f5c0280dc8230',
            assets: {
                'dance0': new Asset({
                    'id': danceFrames['dance0'],
                    'type': 'image'
                }),
                'dance_up': new Asset({
                    'id': danceFrames['dance_up'],
                    'type': 'image'
                }),
                'dance_down': new Asset({
                    'id': danceFrames['dance_down'],
                    'type': 'image'
                }),
                'dance_left': new Asset({
                    'id': danceFrames['dance_left'],
                    'type': 'image'
                }),
                'dance_right': new Asset({
                    'id': danceFrames['dance_right'],
                    'type': 'image'
                })
            },
            isTest: true
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

    handleKeyDown(playerId, key) {
        if (this.inputCooldowns[playerId]) {
            return;
        }
        this.inputCooldowns[playerId] = this.setTimeout(function() {
            clearTimeout(this.inputCooldowns[playerId]);
            delete this.inputCooldowns[playerId];
        }.bind(this), 50);

        const dancer = this.dancers[playerId];
        const frameMap = {
            'ArrowLeft': 'dance_left',
            'ArrowRight': 'dance_right',
            'ArrowUp': 'dance_up',
            'ArrowDown': 'dance_down',

            'a': 'dance_left',
            'd': 'dance_right',
            'w': 'dance_up',
            's': 'dance_down'
        };

        const newFrame = frameMap[key] ? (dancer.node.asset.dance0 ? frameMap[key] : 'dance0') : 'dance0';
        const newAssets = {};
        newAssets[newFrame] = Object.values(this.dancers[playerId].node.asset)[0];
        dancer.node.asset = newAssets;
    }

    getPlayerSpot() {
        for (const i in this.playerSpots) {
            if (!this.playerSpots[i].player) {
                return this.playerSpots[i];
            }
        }
    }

    handleNewPlayer({ playerId, info, settings }) {
        const spot = this.getPlayerSpot();
        spot.player = playerId;
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

        this.dancers[playerId] = dancer;

        this.background.addChild(this.dancers[playerId]);
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
    
    getLayers() {
        return [{root: this.background}];
    }
}

module.exports = SpriteTest;
