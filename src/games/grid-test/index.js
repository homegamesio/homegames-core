const { Asset, Colors, Game, GameNode, Shapes, ShapeUtils } = require('squish-1009');

const COLORS = Colors.COLORS;

class GridTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '1009',
            author: 'Joseph Garcia',
            thumbnail: '1e844026921f7662a62ce72da869da63'
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100)
        });
    }

    handleNewPlayer({playerId}) {
        const playerRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 10; j++) {
                const node = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(i * 10, j * 10, 10, 10),
                    fill: [255, 255, 255, 255],
                    onHover: () => {
                        node.node.fill = [255, 0, 0, 255];
                        node.node.onStateChange();
                    },
                    onClick: () => {

                    }
                });
                playerRoot.addChild(node);
            }
        }
        this.base.addChild(playerRoot);
    }

    getLayers() {
        return [{root: this.base}];
    }
}

module.exports = GridTest;
