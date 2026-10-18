const { Game, GameNode, Colors, Shapes, ShapeUtils, Asset } = require('squish-150');
const { COLORS } = Colors;

class ImageGallery extends Game {
    static metadata() {
        return {
            // Catalog review: Image display demo; retain for asset testing.
            isTest: true,
            squishVersion: '150',
            name: 'Image Gallery',
            author: "Joseph Garcia",
            description: 'A simple gallery to display images. Fill in asset IDs in metadata.assets.',
            aspectRatio: { x: 16, y: 9 },
            assets: {
                // Add your assets here, e.g.:
                'img1': new Asset({ path: './assets/36ea01dd20b9ea62f30edae47eea1bd1.jpg', type: 'image' }),
            }
        };
    }

    constructor() {
        super();

        this.imageKeys = Object.keys(this.constructor.metadata().assets);
      console.log("IMAGE KEYS");
console.log(this.imageKeys);
        this.currentIndex = 0;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.BLACK
        });

        this.imageNode = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(10, 10, 80, 60),
assetInfo: {
'img1': {
                    'pos': {x: 30, y: 20},
                    'size': {x: 40, y: 60},
                    // Crop percentages (0-100) removed from each edge. 0 = show
                    // the whole image (identical to the pre-crop behavior).
                    'cropLeft': 0,
                    'cropTop': 0,
                    'cropRight': 0,
                    'cropBottom': 0
                }    
}}); 

        this.titleText = new GameNode.Text({
            textInfo: {
                text: 'Image Gallery',
                x: 50, y: 8,
                size: 3,
                align: 'center',
                color: COLORS.WHITE
            }
        });

        this.prevBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(10, 75, 20, 15),
            fill: COLORS.GRAY,
            onClick: (playerId) => this.showPrev(playerId)
        });

        this.prevLabel = new GameNode.Text({
            textInfo: {
                text: 'Prev',
                x: 20, y: 82.5,
                size: 1.8,
                align: 'center',
                color: COLORS.WHITE
            }
        });

        this.nextBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(70, 75, 20, 15),
            fill: COLORS.GRAY,
            onClick: (playerId) => this.showNext(playerId)
        });

        this.nextLabel = new GameNode.Text({
            textInfo: {
                text: 'Next',
                x: 80, y: 82.5,
                size: 1.8,
                align: 'center',
                color: COLORS.WHITE
            }
        });

  console.log('a1');
        this.base.addChildren(this.titleText, this.imageNode, this.prevBtn, this.prevLabel, this.nextBtn, this.nextLabel);
  console.log('a2');

        this.updateImage();
  console.log('a3');

    }

    updateImage() {
        if (this.imageKeys.length === 0) {
            this.imageNode.node.assetInfo = {};
            this.titleText.node.text = { text: 'No assets configured', x: 50, y: 50, size: 2, align: 'center', color: COLORS.WHITE };
            this.base.node.onStateChange();
            return;
        }
        const key = this.imageKeys[this.currentIndex];
        this.imageNode.node.assetInfo = {
            [key]: { pos: { x: 10, y: 10 }, size: { x: 80, y: 60 } }
        };
        this.titleText.node.text = {
            text: `${key} ${this.currentIndex + 1}/${this.imageKeys.length}`,
            x: 50, y: 8,
            size: 2.5,
            align: 'center',
            color: COLORS.WHITE
        };
        this.base.node.onStateChange();
    }

    showPrev(playerId) {
        if (this.imageKeys.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.imageKeys.length) % this.imageKeys.length;
        this.updateImage();
    }

    showNext(playerId) {
        if (this.imageKeys.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.imageKeys.length;
        this.updateImage();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = ImageGallery;