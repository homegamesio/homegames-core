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
                    [50, 10],
                    [55, 15],
                    [60, 10],
                    [60, 30],
                    [70, 50],
                    [60, 40],
                    [50, 10]
                ],
                fill: Colors.PURPLE
            },
            null, 
            (player, x, y) => {
                console.log('I have neen clicked');
            });
    }

    getRoot() {
        return this.base;
    }

}

module.exports = ShapeTest;
