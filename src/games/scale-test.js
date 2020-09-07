const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');
const Asset = require('../common/Asset');
const COLORS = Colors.COLORS;

class ScaleTest extends Game {
    static metadata() {
        return {
            name: 'Scale test',
            author: 'Joseph Garcia',
            aspectRatio: {x: 16, y: 9}
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape(
            COLORS.HG_BLUE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                fill: COLORS.HG_BLUE
            }
        );

        this.assets = {
            'image': new Asset('url', {
                'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/homegames_logo_small.png',
                'type': 'image'
            })
        };

        this.testBox = new GameNode.Shape(
            COLORS.BLACK,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(20, 20, 60, 20),
                fill: COLORS.BLACK
            }
        );

        this.testAsset = new GameNode.Asset(
            (player, x, y) => {
                console.log('clicked that thang');
            },
            ShapeUtils.rectangle(20, 60, 60, 20),
            {
                'image': {
                    pos: {x: 20, y: 60},
                    size: {x: 60, y: 20}
                }
            }
        );

        this.base.addChild(this.testBox);
        this.base.addChild(this.testAsset);
    }
    
    getAssets() {
        return this.assets;
    }

    getRoot() {
        return this.base;
    }

}

module.exports = ScaleTest;
