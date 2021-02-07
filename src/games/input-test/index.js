const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-063');
const { dictionary } = require('../../common/util');
const fs = require('fs');
const Asset = require('../../common/Asset');

const COLORS = Colors.COLORS;

class InputTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '061',
            author: 'Joseph Garcia',
            name: 'Input Test',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/input-test.png'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON, 
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.CREAM
        });

        this.assets = {};

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

        let _that = this;

        this.fileInputNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: fileInputShape,
            fill: COLORS.HG_BLUE,
            input: {
                type: 'file',
                oninput: (player, data) => {
                    const imageKey = 'image' + imageNum;
                    this.assets[imageKey] = new Asset('data', {type: 'image'}, Buffer.from(data));

                    // HACK
                    this.session.squisher.initialize().then(() => {
                        Object.values(this.players).forEach(player => {
                            player.receiveUpdate(this.session.squisher.assetBundle);
                        });
                        _that.setTimeout(() => {
                            if (image) {
                                this.base.removeChild(image.id);
                            }
                            image = new GameNode.Asset({
                                shapeType: ShapeUtils.rectangle(40, 40, 30, 30),
                                assetInfo: {
                                    [imageKey]: {
                                        pos: {
                                            x: 40,
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
                        }, 500);
                
                    });

                    imageNum++;
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

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }
}

module.exports = InputTest;
