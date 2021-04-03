const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-061');
const { Asset } = require('../../common/Asset');
const COLORS = Colors.COLORS;

class ScaleTest extends Game {
    static metadata() {
        return {
            name: 'Scale test',
            squishVersion: '061',
            author: 'Joseph Garcia',
            aspectRatio: {x: 1, y: 2},
            assets: {
                'image': new Asset('url', {
                    'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/homegames_logo_small.png',
                    'type': 'image'
                })
            }
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.HG_BLUE
        });

        this.testBox = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(20, 20, 60, 20),
            fill: COLORS.BLACK
        });

        this.testAsset = new GameNode.Asset({
            onClick: (player, x, y) => {
                console.log('clicked that thang');
            },
            coordinates2d: ShapeUtils.rectangle(20, 60, 60, 20),
            assetInfo: {
                'image': {
                    pos: {x: 20, y: 60},
                    size: {x: 60, y: 20}
                }
            }
        });

        this.base.addChild(this.testBox);
        this.base.addChild(this.testAsset);
    }
    
    getRoot() {
        return this.base;
    }

}

module.exports = ScaleTest;
