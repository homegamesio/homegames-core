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
        const defaultImagePos = {x: 40, y: 40};

        this.base = GameNode(Colors.WHITE, (player, x, y) => {
            const newAsset = this.base.asset;
            newAsset.image.pos = {x, y};
            this.base.asset = newAsset;
        }, {x: 0, y: 0}, {x: 100, y: 100}, null, {'image': {pos: Object.assign({}, defaultImagePos), size: Object.assign({}, defaultImageSize)}});

        this.decreaseWidthButton = GameNode(Colors.WHITE, (player, x, y) => {
            const newAsset = this.base.asset;
            newAsset.image.size.x -= 1;
            this.base.asset = newAsset;
        }, {x: 30, y: 6}, {x: 5, y: 5}, {text: '-', x: 32.5, y: 5, size: 50});

        this.increaseWidthButton = GameNode(Colors.WHITE, (player, x, y) => {
            const newAsset = this.base.asset;
            newAsset.image.size.x += 1;
            this.base.asset = newAsset;
        }, {x: 55, y: 6}, {x: 5, y: 5}, {text: '+', x: 57.5, y: 5, size: 50});

        this.widthText = GameNode(Colors.WHITE, null, {x: 0, y: 0}, {x: 0, y: 0}, {text: 'Width', x: 46, y: 6, size: 40});

        this.decreaseHeightButton = GameNode(Colors.WHITE, (player, x, y) => {
            const newAsset = this.base.asset;
            newAsset.image.size.y -= 1;
            this.base.asset = newAsset;
        }, {x: 30, y: 16}, {x: 5, y: 5}, {text: '-', x: 32.5, y: 15, size: 50});

        this.increaseHeightButton = GameNode(Colors.WHITE, (player, x, y) => {
            const newAsset = this.base.asset;
            newAsset.image.size.y += 1;
            this.base.asset = newAsset;
        }, {x: 55, y: 16}, {x: 5, y: 5}, {text: '+', x: 57.5, y: 15, size: 50});

        this.heightText = GameNode(Colors.WHITE, null, {x: 0, y: 0}, {x: 0, y: 0}, {text: 'Height', x: 46, y: 16, size: 40});
        
        this.resetButton = GameNode(Colors.YELLOW, () => {
            const newAsset = this.base.asset;
            newAsset.image.pos = Object.assign({}, defaultImagePos);
            newAsset.image.size = Object.assign({}, defaultImageSize);
            this.base.asset = newAsset;
        }, {x: 90, y: 0}, {x: 10, y: 10}, {text: 'Reset', x: 95, y: 2.5, size: 30});

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
