const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-138');
const { COLORS } = Colors;

class MyGamez extends Game {
    static metadata() {
        return {
            squishVersion: '138',
            name: 'My Gamez',
            author: 'Your Name',
            description: 'A simple game template.',
            aspectRatio: { x: 16, y: 9 }
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.HG_BLUE
        });

        this.welcomeText = new GameNode.Text({
            textInfo: { text: 'Welcome to My Game!', x: 50, y: 50, size: 3, align: 'center', color: COLORS.WHITE }
        });

        this.base.addChild(this.welcomeText);
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = MyGamez;
