const Asset = require('../common/Asset');
const { Game, GameNode, Colors, Shapes } = require('squishjs');
const COLORS = Colors.COLORS;

class ImageTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/image-test.png'
        };
    }

    constructor() {
        super();
        this.assets = {
            'image': new Asset('url', {
                'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/images/homegames_logo_small.png',
                'type': 'image'
            })
        };

        const aspectRatio = this.constructor.metadata().aspectRatio;
        const defaultImageSize = {x: 10 * (aspectRatio.y/aspectRatio.x), y: 10};// * (aspectRatio.y / aspectRatio.x)};
        const defaultImagePos = {x: 45, y: 40};

        this.base = new GameNode.Shape(COLORS.WHITE, 
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [0, 0],
                    [100, 0],
                    [100, 100],
                    [0, 100],
                    [0, 0]
                ],
                fill: COLORS.WHITE
            },
            null,
            (player, x, y) => {
                const newAsset = this.imageNode.node.asset;
                newAsset.image.pos = {x, y};
                this.imageNode.node.asset = newAsset;
            }
        );
        
        this.imageNode = new GameNode.Asset(
            null,
            [
                [defaultImagePos.x, defaultImagePos.y],
                [defaultImagePos.x + defaultImageSize.x, defaultImagePos.y],
                [defaultImagePos.x + defaultImageSize.x, defaultImagePos.y + defaultImageSize.y],
                [defaultImagePos.x, defaultImagePos.y + defaultImagePos.y],
                [defaultImagePos.x, defaultImagePos.y]
            ],
            {
                'image': {
                    'pos': Object.assign({}, defaultImagePos),
                    'size': Object.assign({}, defaultImageSize)
                }
            }
        );

        this.base.addChild(this.imageNode);

        this.decreaseWidthButton = new GameNode.Shape(
            COLORS.RED,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [29.5, 2],
                    [29.5 + 6, 2],
                    [29.5 + 6, 2 + (6 * 16 / 9)],
                    [29.5, 2 + (6 * 16 / 9)],
                    [29.5, 2],
                ],
                fill: COLORS.RED
            },
            null,
            (player, x, y) => {
                if (this.imageNode.node.asset.image.size.x < 1) {
                    return;
                }
                const newAsset = this.imageNode.node.asset;
                newAsset.image.size.x -= 1;
                this.imageNode.node.asset = newAsset;
            }
        );
        
        this.increaseWidthButton = new GameNode.Shape(
            COLORS.GREEN,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [49.5, 2],
                    [49.5 + 6, 2],
                    [49.5 + 6, 2 + (6 * 16 / 9)],
                    [49.5, 2 + (6 * 16 / 9)],
                    [49.5, 2],
                ],
                fill: COLORS.GREEN
            },
            null,
            (player, x, y) => {
                if (this.imageNode.node.asset.image.size.x > 80) {
                    return;
                }
                const newAsset = this.imageNode.node.asset;
                newAsset.image.size.x += 1;
                this.imageNode.node.asset = newAsset;
            }
        );

        this.decreaseHeightButton = new GameNode.Shape(
            COLORS.RED,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [29.5, 22],
                    [29.5 + 6, 22],
                    [29.5 + 6, 22 + (6 * 16 / 9)],
                    [29.5, 22 + (6 * 16 / 9)],
                    [29.5, 22],
                ],
                fill: COLORS.RED
            },
            null,
            (player, x, y) => {
                if (this.imageNode.node.asset.image.size.y < 1) {
                    return;
                }
                const newAsset = this.imageNode.node.asset;
                newAsset.image.size.y -= 1;
                this.imageNode.node.asset = newAsset;
            }
        );
        
        this.increaseHeightButton = new GameNode.Shape(
            COLORS.GREEN,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [49.5, 22],
                    [49.5 + 6, 22],
                    [49.5 + 6, 22 + (6 * 16 / 9)],
                    [49.5, 22 + (6 * 16 / 9)],
                    [49.5, 22],
                ],
                fill: COLORS.GREEN
            },
            null,
            (player, x, y) => {
                if (this.imageNode.node.asset.image.size.y > 80) {
                    return;
                }
                const newAsset = this.imageNode.node.asset;
                newAsset.image.size.y += 1;
                this.imageNode.node.asset = newAsset;
            }
        );
        
        this.resetButton = new GameNode.Shape(
            COLORS.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [79.5, 22],
                    [79.5 + 6, 22],
                    [79.5 + 6, 22 + (6 * 16 / 9)],
                    [79.5, 22 + (6 * 16 / 9)],
                    [79.5, 22],
                ],
                fill: COLORS.HG_YELLOW
            },
            null,
            (player, x, y) => {
                this.imageNode.node.coordinates2d = [
                    [defaultImagePos.x, defaultImagePos.y],
                    [defaultImagePos.x + defaultImageSize.x, defaultImagePos.y],
                    [defaultImagePos.x + defaultImageSize.x, defaultImagePos.y + defaultImageSize.y],
                    [defaultImagePos.x, defaultImagePos.y + defaultImagePos.y],
                    [defaultImagePos.x, defaultImagePos.y]
                ];

                this.imageNode.node.asset = {
                    'image': { 
                        'pos': Object.assign({}, defaultImagePos),
                        'size': Object.assign({}, defaultImageSize)
                    }
                };              
            }
        );

        this.base.addChild(this.decreaseWidthButton);
        this.base.addChild(this.increaseWidthButton);

        this.base.addChild(this.decreaseHeightButton);
        this.base.addChild(this.increaseHeightButton);

        this.base.addChild(this.resetButton);
    }

    getAssets() {
        return this.assets;
    }

    getRoot() {
        return this.base;
    }
}

module.exports = ImageTest;
