const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');
const { dictionary } = require('../../common/util');
const fs = require('fs');

const COLORS = Colors.COLORS;

class InputTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '142',
            author: 'Joseph Garcia',
            name: 'Input Test',
            thumbnail: 'c6d38aca68fed708d08d284a5d201a0a',
            assets: {
                'test-font': new Asset({
                    'type': 'font',
                    'id': '846b73999657425425fc39d39f9963b2'
                })
            },
            isTest: true
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
                color: COLORS.BLACK,
                font: 'test-font'
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
                        this.textNode.node.onStateChange();
                    }
                }
            },
            playerIds: [1]
        });

        const fileInputShape = ShapeUtils.rectangle(60, 10, 20, 20);
        let uploadNum = 1;

        let image;

        this.soundNode = null;
        this.replayButton = null;
        this.lastAudioKey = null;

        this.fileInputNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: fileInputShape,
            fill: COLORS.HG_BLUE,
            input: {
                type: 'file',
                oninput: (player, data, meta) => {
                    // meta.kind is sniffed from the bytes server-side;
                    // image is the legacy default for untyped uploads.
                    const kind = (meta && meta.kind) || 'image';
                    const assetKey = kind + (++uploadNum);

                    this.assets[assetKey] = new Asset({
                        id: assetKey,
                        type: kind
                    }, data);

                    this.addAsset(assetKey, this.assets[assetKey]).then(() => {
                        if (kind === 'audio') {
                            this.playUploadedAudio(assetKey);
                            return;
                        }
                        if (image) {
                            this.base.removeChild(image.id);
                        }
                        image = new GameNode.Asset({
                            assetInfo: {
                                [assetKey]: {
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

    playUploadedAudio(assetKey) {
        this.lastAudioKey = assetKey;

        // The client starts a sound when its node appears and stops it when
        // the node leaves the tree — so replaying means remove, then re-add
        // a frame later.
        if (this.soundNode) {
            this.base.removeChild(this.soundNode.id);
            this.soundNode = null;
        }
        this.setTimeout(() => {
            this.soundNode = new GameNode.Asset({
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                assetInfo: {
                    [assetKey]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 }
                }
            });
            this.base.addChild(this.soundNode);
        }, 100);

        if (!this.replayButton) {
            this.replayButton = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(60, 45, 20, 12),
                fill: COLORS.CANDY_GREEN,
                onClick: () => this.playUploadedAudio(this.lastAudioKey)
            });
            this.replayButton.addChild(new GameNode.Text({
                textInfo: { text: 'REPLAY', x: 70, y: 49, size: 2, align: 'center', color: COLORS.BLACK }
            }));
            this.base.addChild(this.replayButton);
        }
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
