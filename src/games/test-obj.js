const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');
const Deck = require('../common/Deck');
const COLORS = Colors.COLORS;

class TestObj extends Game {
    static metadata() {
        return {
            author: 'Joseph Garcia',
            aspectRatio: {
                x: 16,
                y: 9
            }
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            shapeType: Shapes.POLYGON,
            fill: COLORS.BLUE
        });
    }

    getRoot() {
        return this.base;
    }
}

module.exports = TestObj;
