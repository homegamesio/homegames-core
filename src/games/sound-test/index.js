const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-112');
const COLORS = Colors.COLORS;

class SoundTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '112',
            author: 'Joseph Garcia',
            thumbnail: '18a17230e3b5b8edad5f44d73a496a2c',
            isTest: true
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({ 
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [100, 0],
                [100, 100],
                [0, 100],
                [0, 0]
            ],
            fill: COLORS.WHITE,
            onClick: (player, x, y) => {
            }
        });

        this.startTime = 0;

        this.pauseButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(20, 20, 20, 20),
            fill: COLORS.RED,
            onClick: (player) => {
                this.pauseButton.clearChildren();
                this.base.removeChild(this.pauseButton.node.id);
                this.base.addChild(this.playButton);
                const diff = (new Date() - this.songPlayedAt) / 1000;
                this.startTime = this.startTime + diff;
            }
        });

        this.playButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(20, 20, 20, 20),
            fill: COLORS.GREEN,
            onClick: (player) => {
                this.songPlayedAt = new Date();
                const songNode = new GameNode.Asset({
                    coordinates2d: ShapeUtils.rectangle(20, 20, 0, 0),
                    assetInfo: {
                        'song': {
                            'pos': Object.assign({}, { x: 0, y: 0 }),
                            'size': Object.assign({}, { x: 0, y: 0 }),
                            'startTime': this.startTime
                        }
                    }
                });

                this.pauseButton.addChild(songNode);

                this.base.addChild(this.pauseButton);
            }
        });

        this.base.addChild(this.playButton);
    }

    handlePlayerUpdate(playerId, newData) {
        if (this.pauseButton.node.children.length > 0) {
            const diff = (new Date() - this.songPlayedAt) / 1000;
            this.pauseButton.node.children[0].node.asset.song.startTime = diff;
        }
    }

    getLayers() {
        return [{root: this.base}];
    }

    getAssets() {
        return {
            'song': new Asset({
                'id': 'd9f097268324319d07a903cb50dc7210',
                'type': 'audio'
            })
        };
    }
    
}

module.exports = SoundTest;
