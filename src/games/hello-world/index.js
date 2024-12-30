const { Colors, Game, GameNode, Shapes, ShapeUtils } = require('squish-120');
const COLORS = Colors.COLORS;

class HelloWorld extends Game {
    static metadata() {
        return {
            squishVersion: '120',
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.WHITE
        });

        const textNode = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 50,
                align: 'center',
                size: 2,
                text: 'Hello, world!',
                color: COLORS.BLACK
            }
        });
        
        this.base.addChild(textNode);
    }

    getLayers() {
        return [{root: this.base}];
    }
}

module.exports = HelloWorld;
