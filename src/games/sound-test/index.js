const Asset = require('../../common/Asset');
const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-0730');
const COLORS = Colors.COLORS;

class SoundTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            // squishVersion: '0730',
            author: 'Joseph Garcia',
            thumbnail: '2a0cf606567326c6c40df592ee1358ca'
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
                // const newAsset = this.imageNode.node.asset;
                // newAsset.image.pos = {x, y};
                // this.imageNode.node.asset = newAsset;
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
                console.log('thidf this');
                console.log(this.startTime);
                const diff = (new Date() - this.songPlayedAt) / 1000;
                this.startTime = this.startTime + diff;
                // console.log('its been this many milliseconds ' + diff);
                // this.startTime =
            }
        });

        this.playButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(20, 20, 20, 20),
            fill: COLORS.GREEN,
            onClick: (player) => {
                console.log('want to add song node at a given point (start for now) ' + this.startTime);
                this.songPlayedAt = new Date();
                // this.startTime
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
        
        // this.songNode = new GameNode.Asset({
        //     coordinates2d: ShapeUtils.rectangle(20, 20, 0, 0),
        //     assetInfo: {
        //         'song': {
        //             'pos': Object.assign({}, { x: 0, y: 0 }),
        //             'size': Object.assign({}, { x: 0, y: 0 })
        //         }
        //     }
        // });

        // this.pauseButton = new GameNode.Asset({
        //     coordinates2d: ShapeUtils.rectangle(20, 20, 20, 20),
        //     assetInfo: {
        //         'image': {
        //             'pos': Object.assign({}, { x: 20, y: 20 }),
        //             'size': Object.assign({}, { x: 20, y: 20 })
        //         }
        //     }
        // });

        this.base.addChild(this.playButton);
    }

    handlePlayerUpdate(playerId, newData) {
        console.log('oh shit wow');
        if (this.pauseButton.node.children.length > 0) {
            const diff = (new Date() - this.songPlayedAt) / 1000;
            console.log('its been ' + diff + ' since i started playing'); 
            // this.startTime = this.startTime + diff;
            // console.log('new start time ' + this.startTime);
            // console.log(this.pauseButton.node.children[0]);
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
        }
    }
    
    // getRoot() {
    //     return this.base;
    // }
}

module.exports = SoundTest;
