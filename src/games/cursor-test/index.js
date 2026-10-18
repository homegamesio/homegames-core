const { Asset, Game, GameNode, Shapes, ShapeUtils } = require('squish-150');

class CursorTest extends Game {
    static metadata() {
        return {
            name: 'Cursor Test',
            author: "Joseph Garcia",
            description: 'Hover over the center square to try a custom cursor.',
            squishVersion: '150',
            aspectRatio: { x: 16, y: 9 },
            isTest: true,
            assets: {
                'test-cursor': new Asset({
                    path: './assets/a168ae244a71ea100ff1d9ca4c1fa101.jpg',
                    type: 'image'
                })
            }
        };
    }

    constructor({ setCursor }) {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [248, 248, 236, 255]
        });
        this.target = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(40, 32.222, 20, 35.556),
            fill: [122, 192, 225, 255],
            onHover: playerId => setCursor(playerId, { assetKey: 'test-cursor', size: { width: 32, height: 40 } }),
            offHover: playerId => setCursor(playerId, null)
        });
        this.base.addChildren(
            new GameNode.Text({ textInfo: {
                text: 'CURSOR TEST', x: 50, y: 14, size: 3,
                align: 'center', color: [28, 34, 45, 255]
            } }),
            this.target,
            new GameNode.Text({ textInfo: {
                text: 'Hover over the square to change your cursor. Move away to reset it.',
                x: 50, y: 80, size: 1.8, align: 'center', color: [28, 34, 45, 255]
            } })
        );
    }

    getLayers() { return [{ root: this.base }]; }
}

module.exports = CursorTest;
