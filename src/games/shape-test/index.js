const { Colors, Game, GameNode, Shapes } = require('squish-061');
const COLORS = Colors.COLORS;

class ShapeTest extends Game {
    static metadata() {
        return {
            aspectRatio: {
                x: 16,
                y: 9
            },
            author: 'Joseph Garcia',
            squishVersion: '061',
            name: 'Shape Test',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/shape-test.png'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [50, 10],
                [55, 15],
                [60, 10],
                [60, 30],
                [70, 50],
                [60, 40],
                [50, 10]
            ],
            fill: COLORS.PURPLE,
            onClick: (player, x, y) => {
                console.log('I have neen clicked');
            }
        });
    }

    getRoot() {
        return this.base;
    }

}

module.exports = ShapeTest;
