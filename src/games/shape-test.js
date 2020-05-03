const { Colors, Game, GameNode, Shapes } = require('squishjs');

class ShapeTest extends Game {
    static metadata() {
        return {
            aspectRatio: {
                x: 16,
                y: 9
            },
            author: 'Joseph Garcia',
            name: 'Shape Test'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape(
            Colors.PURPLE, 
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [90, 90],
                    [95, 90],
                    [95, 95],
                    [90, 95],
                    [90, 90]
                ],
                fill: Colors.PURPLE
            },
            null, 
            (player, x, y) => {
                console.log('I am a base and i have neen clicked');
            });
    }

    getRoot() {
        return this.base;
    }

}

module.exports = ShapeTest;
