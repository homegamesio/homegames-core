const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-0756');
const { dictionary } = require('../../common/util');
const fs = require('fs');

const COLORS = Colors.COLORS;

class InputTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0756',
            author: 'Joseph Garcia',
            name: 'Input Test',
            thumbnail: 'c6d38aca68fed708d08d284a5d201a0a'
        };
    }

    constructor({ addAsset }) {
        super();
        this.addAsset = addAsset;
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON, 
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.CREAM
        });

        this.assets = {
        };

        this.textNode = new GameNode.Text({
            textInfo: {
                text: 'I am text',
                x: 30,
                y: 50,
                size: 4,
                align: 'center',
                color: COLORS.BLACK
            }
        });

        const textInputShape = ShapeUtils.rectangle(20, 10, 20, 20);
        
        this.textInputNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: textInputShape,
            fill: COLORS.HG_BLUE,
            input: {
                type: 'text',
                oninput: (player, text) => {
                    if (text) {
                        const newText = this.textNode.node.text;
                        newText.text = text;
                        this.textNode.node.textInfo = newText;
                    }
                }
            }
        });

        const fileInputShape = ShapeUtils.rectangle(60, 10, 20, 20);
        let imageNum = 1;

        let image;

        const _that = this;

        this.fileInputNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: fileInputShape,
            fill: COLORS.HG_BLUE,
            input: {
                type: 'file',
                oninput: (player, data) => {
                    const imageKey = 'image' + (++imageNum);
                    
                    this.assets[imageKey] = new Asset({
                        id: imageKey,
                        type: 'image'
                    }, data);

                    this.addAsset(imageKey, this.assets[imageKey]).then(() => {
                        if (image) {
                            this.base.removeChild(image.id);
                        }
                        image = new GameNode.Asset({
                            assetInfo: {
                                [imageKey]: {
                                    pos: {
                                        x: 60,
                                        y: 40
                                    },
                                    size: {
                                        x: 30,
                                        y: 30
                                    }
                                }
                            }
                        });
                        this.base.addChild(image);
                    });
                }
            }
        });

        this.base.addChild(this.textNode);
        this.base.addChild(this.textInputNode);
        this.base.addChild(this.fileInputNode);
    }

    isText(key) {
        return key.length == 1 && (key >= 'A' && key <= 'Z') || (key >= 'a' && key <= 'z') || key === ' ' || key === 'Backspace';
    }
    
    getLayers() {
        return [{root: this.base}];
    }

    getAssets() {
        return this.assets;
    }
}

module.exports = InputTest;
