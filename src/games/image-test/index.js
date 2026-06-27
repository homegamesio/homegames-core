const { Asset, Game, GameNode, Colors, Shapes } = require('squish-139');
const COLORS = Colors.COLORS;

class ImageTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '139',
            author: 'Joseph Garcia',
            thumbnail: '2a0cf606567326c6c40df592ee1358ca',
            isTest: true,
            tickRate: 60
        };
    }

    tick() {
        this.base.node.onStateChange();
    }

    constructor() {
        super();
        const aspectRatio = this.constructor.metadata().aspectRatio;
        const defaultImageSize = {x: 10 * (aspectRatio.y/aspectRatio.x), y: 10};// * (aspectRatio.y / aspectRatio.x)};
        const defaultImagePos = {x: 45, y: 40};

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
                const newAsset = this.imageNode.node.asset;
                newAsset.image.pos = {x, y};
                this.imageNode.node.asset = newAsset;
            }
        });
        
        this.imageNode = new GameNode.Asset({
            coordinates2d: [
                [defaultImagePos.x, defaultImagePos.y],
                [defaultImagePos.x + defaultImageSize.x, defaultImagePos.y],
                [defaultImagePos.x + defaultImageSize.x, defaultImagePos.y + defaultImageSize.y],
                [defaultImagePos.x, defaultImagePos.y + defaultImagePos.y],
                [defaultImagePos.x, defaultImagePos.y]
            ],
            assetInfo: {
                'image': {
                    'pos': Object.assign({}, defaultImagePos),
                    'size': Object.assign({}, defaultImageSize),
                    // Crop percentages (0-100) removed from each edge. 0 = show
                    // the whole image (identical to the pre-crop behavior).
                    'cropLeft': 25,
                    'cropTop': 0,
                    'cropRight': 0,
                    'cropBottom': 0
                }
            }
        });

        this.base.addChild(this.imageNode);

        this.decreaseWidthButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [29.5, 2],
                [29.5 + 6, 2],
                [29.5 + 6, 2 + (6 * 16 / 9)],
                [29.5, 2 + (6 * 16 / 9)],
                [29.5, 2],
            ],
            fill: COLORS.RED,
            onClick: (player, x, y) => {
                if (this.imageNode.node.asset.image.size.x < 1) {
                    return;
                }
                const newAsset = this.imageNode.node.asset;
                newAsset.image.size.x -= 1;
                this.imageNode.node.asset = newAsset;
            }
        });
        
        this.increaseWidthButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [49.5, 2],
                [49.5 + 6, 2],
                [49.5 + 6, 2 + (6 * 16 / 9)],
                [49.5, 2 + (6 * 16 / 9)],
                [49.5, 2],
            ],
            fill: COLORS.GREEN,
            onClick: (player, x, y) => {
                if (this.imageNode.node.asset.image.size.x > 80) {
                    return;
                }
                const newAsset = this.imageNode.node.asset;
                newAsset.image.size.x += 1;
                this.imageNode.node.asset = newAsset;
            }
        });

        this.decreaseHeightButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [29.5, 22],
                [29.5 + 6, 22],
                [29.5 + 6, 22 + (6 * 16 / 9)],
                [29.5, 22 + (6 * 16 / 9)],
                [29.5, 22],
            ],
            fill: COLORS.RED,
            onClick: (player, x, y) => {
                if (this.imageNode.node.asset.image.size.y < 1) {
                    return;
                }
                const newAsset = this.imageNode.node.asset;
                newAsset.image.size.y -= 1;
                this.imageNode.node.asset = newAsset;
            }
        });
        
        this.increaseHeightButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [49.5, 22],
                [49.5 + 6, 22],
                [49.5 + 6, 22 + (6 * 16 / 9)],
                [49.5, 22 + (6 * 16 / 9)],
                [49.5, 22],
            ],
            fill: COLORS.GREEN,
            onClick: (player, x, y) => {
                if (this.imageNode.node.asset.image.size.y > 80) {
                    return;
                }
                const newAsset = this.imageNode.node.asset;
                newAsset.image.size.y += 1;
                this.imageNode.node.asset = newAsset;
            }
        });
        
        this.resetButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [79.5, 22],
                [79.5 + 6, 22],
                [79.5 + 6, 22 + (6 * 16 / 9)],
                [79.5, 22 + (6 * 16 / 9)],
                [79.5, 22],
            ],
            fill: COLORS.HG_YELLOW,
            onClick: (player, x, y) => {
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
                        'size': Object.assign({}, defaultImageSize),
                        'cropLeft': 0,
                        'cropTop': 0,
                        'cropRight': 0,
                        'cropBottom': 0
                    }
                };
            }
        });

        this.base.addChild(this.decreaseWidthButton);
        this.base.addChild(this.increaseWidthButton);

        this.base.addChild(this.decreaseHeightButton);
        this.base.addChild(this.increaseHeightButton);

        this.base.addChild(this.resetButton);

        // --- Crop controls ---
        // One button per edge. Each click crops another 10% off that edge,
        // wrapping back to 0 after 40% so you can cycle through the range.
        const cropEdges = [
            { key: 'cropLeft', x: 10, color: COLORS.HG_BLUE },
            { key: 'cropTop', x: 30, color: COLORS.HG_BLUE },
            { key: 'cropRight', x: 50, color: COLORS.HG_BLUE },
            { key: 'cropBottom', x: 70, color: COLORS.HG_BLUE }
        ];

        cropEdges.forEach(({ key, x, color }) => {
            const button = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: [
                    [x, 70],
                    [x + 6, 70],
                    [x + 6, 70 + (6 * 16 / 9)],
                    [x, 70 + (6 * 16 / 9)],
                    [x, 70]
                ],
                fill: color,
                onClick: () => {
                    console.log("DSFJKSDFKJSDFJHKDSF");
                    const newAsset = this.imageNode.node.asset;
                    const next = ((newAsset.image[key] || 0) + 10) % 50;
                    newAsset.image[key] = next;
                    console.log('what ' + key);
                    this.imageNode.node.asset = newAsset;
                    this.base.node.onStateChange();
                }
            });

            const label = new GameNode.Text({
                textInfo: {
                    x: x + 3,
                    y: 67,
                    text: key.replace('crop', ''),
                    size: 0.8,
                    color: COLORS.WHITE,
                    align: 'center'
                }
            });

            this.base.addChild(button);
            this.base.addChild(label);
        });
    }

    getLayers() {
        return [{root: this.base}];
    }

    getAssets() {
        return {
            'image': new Asset({
                'id': '8870cb1616e9b60db68a0455a85aa22c',
                'type': 'image'
            })
        };
    }
    
    // getRoot() {
    //     return this.base;
    // }
}

module.exports = ImageTest;
