const { Game, GameNode, Colors, Shapes } = require('squish-0750');

class LayerTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            thumbnail: 'f103961541614b68c503a9ae2fd4cc47',
            squishVersion: '0750'
        };
    }

    constructor() {
        super();

        const baseColor = Colors.randomColor();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [100, 0],
                [100, 100],
                [0, 100],
                [0, 0]
            ],
            fill: baseColor,
            onClick: this.handleLayerClick
        });

        this.layers = [
            {
                root: this.base      
            }
        ];

        const increment = 1;
        for (let i = increment; i < 50; i+= 2 * increment) {
            const childColor = Colors.randomColor();
            const layer = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: [
                    [i, i],
                    [i + 100 - (2 * i), i],
                    [i + 100 - (2 * i), i + 100 - (2 * i)],
                    [i, i + 100 - (2 * i)],
                    [i, i]
                ],
                fill: childColor,
                onClick: this.handleLayerClick
            });
            this.layers.push({
                root: layer
            });
        }
    }

    handleNewPlayer({ playerId, info, settings }) {
    }

    handlePlayerDisconnect() {
    }

    handleLayerClick() {
        const newColor = Colors.randomColor();
        this.color = newColor;
        this.fill = newColor;
    }

    getLayers() {
        return this.layers;
    }
}

module.exports = LayerTest;
