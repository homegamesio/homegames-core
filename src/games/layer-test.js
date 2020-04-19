const { Game, GameNode, Colors, Shapes } = require('squishjs');

class LayerTest extends Game {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        const baseColor = Colors.randomColor();
        this.base = new GameNode.Shape(
            baseColor,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [0, 0],
                    [100, 0],
                    [100, 100],
                    [0, 100],
                    [0, 0]
                ],
                fill: baseColor
            },
            null,
            this.handleLayerClick);

        const increment = 1;
        let prev = this.base;
        for (let i = increment; i < 50; i+= 2 * increment) {
            const childColor = Colors.randomColor();
            const child = new GameNode.Shape(
                childColor,
                Shapes.POLYGON,
                {
                    coordinates2d: [
                        [i, i],
                        [i + 100 - (2 * i), i],
                        [i + 100 - (2 * i), i + 100 - (2 * i)],
                        [i, i + 100 - (2 * i)],
                        [i, i]
                    ],
                    fill: childColor
                },
                null,
                this.handleLayerClick
            );
            prev.addChild(child);
            prev = child;
        }
    }

    handleNewPlayer() {
    }

    handlePlayerDisconnect() {
    }

    handleLayerClick() {
        const newColor = Colors.randomColor();
        this.color = newColor;
        this.fill = newColor;
    }

    getRoot() {
        return this.base;
    }
}

module.exports = LayerTest;
