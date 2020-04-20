const Asset = require('../common/Asset');
const { Game, GameNode, Colors } = require('squishjs');

class ImageTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/draw_thumbnail.jpg'
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

        const defaultImageSize = {x: 10, y: 10 * 16/9};
        const defaultImagePos = {x: 45, y: 40};

        this.base = GameNode(Colors.WHITE, (player, x, y) => {
            const newAsset = this.base.asset;
            newAsset.image.pos = {x, y};
            this.base.asset = newAsset;
        }, {x: 0, y: 0}, {x: 100, y: 100}, null, {'image': {pos: Object.assign({}, defaultImagePos), size: Object.assign({}, defaultImageSize)}});

        this.decreaseWidthButton = GameNode(Colors.WHITE, (player, x, y) => {
            if (this.base.asset.image.size.x < 1) {
                return;
            }
            const newAsset = this.base.asset;
            newAsset.image.size.x -= 1;
            this.base.asset = newAsset;
        }, {x: 29.5, y: 2}, {x: 6, y: 6 * 16 / 9}, {text: '-', x: 32.5, y: 5, size: 50, color: Colors.RED});

        this.increaseWidthButton = GameNode(Colors.WHITE, (player, x, y) => {
            if (this.base.asset.image.size.x > 80) {
                return;
            }

            const newAsset = this.base.asset;
            newAsset.image.size.x += 1;
            this.base.asset = newAsset;
        }, {x: 54.5, y: 2}, {x: 6, y: 6 * 16 / 9}, {text: '+', x: 57.5, y: 5, size: 50, color: Colors.BLUE});

        this.widthText = GameNode(Colors.WHITE, null, {x: 0, y: 0}, {x: 0, y: 0}, {text: 'Width', x: 46, y: 6, size: 40});

        this.decreaseHeightButton = GameNode(Colors.WHITE, (player, x, y) => {
            if (this.base.asset.image.size.y < 1) {
                return;
            }

            const newAsset = this.base.asset;
            newAsset.image.size.y -= 1;
            this.base.asset = newAsset;
        }, {x: 29.5, y: 13}, {x: 6, y: 6 * 16 / 9}, {text: '-', x: 32.5, y: 15, size: 50, color: Colors.RED});

        this.increaseHeightButton = GameNode(Colors.WHITE, (player, x, y) => {
            if (this.base.asset.image.size.y > 80) {
                return;
            }

            const newAsset = this.base.asset;
            newAsset.image.size.y += 1;
            this.base.asset = newAsset;
        }, {x: 54.5, y: 13}, {x: 6, y: 6 *  16 / 9}, {text: '+', x: 57.5, y: 15, size: 50, color: Colors.BLUE});

        this.heightText = GameNode(Colors.WHITE, null, {x: 0, y: 0}, {x: 0, y: 0}, {text: 'Height', x: 46, y: 16, size: 40});
        
        this.resetButton = GameNode(Colors.YELLOW, () => {
            const newAsset = this.base.asset;
            newAsset.image.pos = Object.assign({}, defaultImagePos);
            newAsset.image.size = Object.assign({}, defaultImageSize);
            this.base.asset = newAsset;
        }, {x: 90, y: 0}, {x: 10, y: 10}, {text: 'Reset', x: 95, y: 2.5, size: 50});

        this.base.addChild(this.widthText);
        this.base.addChild(this.decreaseWidthButton);
        this.base.addChild(this.increaseWidthButton);

        this.base.addChild(this.heightText);
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
