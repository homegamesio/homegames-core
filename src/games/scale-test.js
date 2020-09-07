const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');
const COLORS = Colors.COLORS;

class ScaleTest extends Game {
    static metadata() {
        return {
            name: 'Scale test',
            author: 'Joseph Garcia',
            aspectRatio: {x: 16, y: 9}
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape(
            COLORS.HG_BLUE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                fill: COLORS.HG_BLUE
            }
        );
    }

    getRoot() {
        return this.base;
    }

}

module.exports = ScaleTest;
