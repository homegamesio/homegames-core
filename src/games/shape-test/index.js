const { Colors, Game, GameNode, Shapes } = require('squish-0740');
const COLORS = Colors.COLORS;

class ShapeTest extends Game {
    static metadata() {
        return {
            aspectRatio: {
                x: 16,
                y: 9
            },
            author: 'Joseph Garcia',
            squishVersion: '0740',
            name: 'Shape Test',
            thumbnail: 'e5eea80e9a43152a4b65811cd648228d'
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

    getLayers() {
        return [{root: this.base}];
    }
}

module.exports = ShapeTest;
