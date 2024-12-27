const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-120');

class AnimationTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            thumbnail: '9fbf18d172f421ce98fabf04e10f6c30',
            squishVersion: '120',
            tickRate: 60
        };
    }

    constructor() {
        super();
    
        this.currentFrame = 1;
        this.frameRate = 30;

        this.assets = {
            'frame_1': new Asset({
                'id': 'b7d5c5720146b248f2968a5698d47d34',
                'type': 'image'
            }),
            'frame_2': new Asset({
                'id': '9c16e5fea84b3f1c9df0ad82792f7b5b',
                'type': 'image'
            }),
            'frame_3': new Asset({
                'id': '474967a53dfa25d7b9bd6e592fbd4cd0',
                'type': 'image'
            }),
            'frame_4': new Asset({
                'id': '74a2bdb81449877b4d2ff8526240b30f',
                'type': 'image'
            }),
            'frame_5': new Asset({
                'id': '6de58edbfd09a8249965c5ed5c401b76',
                'type': 'image'
            }),
            'frame_6': new Asset({
                'id': '82a341cee278824aa82ed98833727064',
                'type': 'image'
            }),
            'frame_7': new Asset({
                'id': 'a9d51822c7fe1440d9d1359f62cba260',
                'type': 'image'
            }),
            'frame_8': new Asset({
                'id': '4def94e5207eb6dbf7131c0efd01ded8',
                'type': 'image'
            }),
            'frame_9': new Asset({
                'id': '74112f7093e5d328ba84c9c512615a81',
                'type': 'image'
            }),
            'frame_10': new Asset({
                'id': '0caec7069d2847587dc7467e0104044a',
                'type': 'image'
            }),
            'frame_11': new Asset({
                'id': 'e9f6215f74a8075d0ee49ebc37b7ef53',
                'type': 'image'
            }),
            'frame_12': new Asset({
                'id': 'eda8942e37a94592179618f27d29f030',
                'type': 'image'
            }),
            'frame_13': new Asset({
                'id': 'ee28596dd872144b6f35b328c413c4ea',
                'type': 'image'
            }),
            'frame_14': new Asset({
                'id': 'cbfa874e0478b0ec725e48e9f84cd61d',
                'type': 'image'
            }),
            'frame_15': new Asset({
                'id': '075c025b39869556da5b34863a2fa08f',
                'type': 'image'
            }),
            'frame_16': new Asset({
                'id': '155d43678801b7595ab7d7f3e8515aff',
                'type': 'image'
            }),
            'frame_17': new Asset({
                'id': 'ba7cf5eda822e0da3fb515f3469906ec',
                'type': 'image'
            }),
            'frame_18': new Asset({
                'id': '347b8f82ccc82e8125f4fc054a9dd7ec',
                'type': 'image'
            }),
            'frame_19': new Asset({
                'id': '771654be56b6f8ac24e1c1f4330e0e82',
                'type': 'image'
            }),
            'frame_20': new Asset({
                'id': 'c71522cc122b550a0da14137ab22e445',
                'type': 'image'
            }),
            'frame_21': new Asset({
                'id': '6b52130645fe40af0489b72b5d4a9de8',
                'type': 'image'
            }),
            'frame_22': new Asset({
                'id': '82c07463d2510e1afa1132b6e63a878d',
                'type': 'image'
            }),
            'frame_23': new Asset({
                'id': '4fd5523c225ca78ed3f779d36417cd9e',
                'type': 'image'
            }),
            'frame_24': new Asset({
                'id': 'dc3f39a8a49146822c036bef6016ee23',
                'type': 'image'
            }),
            'frame_25': new Asset({
                'id': 'cdf359e561421393cb0575a8741b9e2f',
                'type': 'image'
            }),
            'frame_26': new Asset({
                'id': '782ee30969eb50c0fd4e79cb6a353706',
                'type': 'image'
            }),
            'frame_27': new Asset({
                'id': '5e7c4aa25db49e2581d0d2d9993f5f88',
                'type': 'image'
            }),
            'frame_28': new Asset({
                'id': '1344a16df085d05c6e4c0084e4f5e7de',
                'type': 'image'
            }),
            'frame_29': new Asset({
                'id': '22039e8f2cf4e5eddf6aecc8990e6058',
                'type': 'image'
            }),
            'frame_30': new Asset({
                'id': '437678f66b5d68a0894e0e0440881156',
                'type': 'image'
            })
        };

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [100, 0],
                [100, 100],
                [0, 100],
                [0, 0]
            ],
            fill: Colors.COLORS.PURPLE
        });

        this.imageNode = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            assetInfo: {
                'frame_1': {
                    'pos': {
                        x: 0,
                        y: 0
                    },
                    'size': {
                        x: 100,
                        y: 100
                    }
                }
            }
        });

        this.paused = false;

        const playPauseText = new GameNode.Text({
            textInfo: {
                x: 92.5,
                y: 76,
                size: 1.2,
                text: 'Pause',
                color: Colors.COLORS.BLACK,
                align: 'center'
            }
        });

        this.playPause = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(87.5, 73.5, 10, 8),
            fill: Colors.COLORS.HG_BLUE,
            onClick: () => {
                if (this.paused) {
                    this.paused = false;
                } else {
                    this.paused = true;
                }

                const curLabel = Object.assign({}, playPauseText.node.text);
                curLabel.text = this.paused ? 'Resume' : 'Pause';

                playPauseText.node.text = curLabel;
                playPauseText.node.onStateChange();
            }
        });

        const frameRateText = new GameNode.Text({
            textInfo: {
                x: 82.5,
                y: 75,
                text: `${this.frameRate}fps`,
                color: Colors.COLORS.BLACK,
                align: 'center',
                size: 2
            }
        });

        const frameRateUpText = new GameNode.Text({
            textInfo: {
                x: 82.5, 
                y: 62.5,
                text: '\u2191',
                color: Colors.COLORS.BLACK,
                align: 'center',
                size: 4
            }
        });

        const frameRateDownText = new GameNode.Text({
            textInfo: {
                x: 82.5, 
                y: 82.5,
                text: '\u2193',
                color: Colors.COLORS.BLACK,
                align: 'center',
                size: 4
            }
        });

        this.frameRateUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 62.5, 5, 8),
            onClick: () => {
                this.frameRate = Math.min(30, this.frameRate + 1);
                const curTextInfo = Object.assign({}, frameRateText.node.text);
                curTextInfo.text = `${this.frameRate}fps`;
                frameRateText.node.text = curTextInfo;
                frameRateText.node.onStateChange();
            }
        });

        this.frameRateDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 82.5, 5, 10),
            onClick: () => {
                this.frameRate = Math.max(1, this.frameRate - 1); 
                const curTextInfo = Object.assign({}, frameRateText.node.text);
                curTextInfo.text = `${this.frameRate}fps`;
                frameRateText.node.text = curTextInfo;
                frameRateText.node.onStateChange();
            }
        });
 
        this.frameRateDown.addChild(frameRateDownText);
        this.frameRateUp.addChild(frameRateUpText);

        this.playPause.addChild(playPauseText);

        this.base.addChildren(this.imageNode, this.playPause, this.frameRateDown, this.frameRateUp, frameRateText);
 
        this.layers = [
            {
                root: this.base      
            }
        ];

    }

    getLayers() {
        return this.layers;
    }

    getAssets() {
        return this.assets;
    }

    tick() {
        const now = Date.now();
        if (!this.paused && (!this.nextRenderTime || this.nextRenderTime <= now)) {
            const newFrame = this.currentFrame + 1 > Object.keys(this.assets).length ? 1 : this.currentFrame + 1;
            const currentAssetInfo = Object.values(this.imageNode.node.asset)[0];
            this.imageNode.node.asset = {
                [`frame_${newFrame}`]: currentAssetInfo
            };

            this.currentFrame = newFrame;
            this.imageNode.node.onStateChange();
            this.nextRenderTime = now + (1000 / this.frameRate);
        }
    }
}

module.exports = AnimationTest;
