const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');

class BlankTemplate extends Game {
    static metadata() {
        return {
            name: 'Blank Template',
            // Catalog review: Empty starter template; no game loop.
            isTest: true,
            aspectRatio: { x: 16, y: 9 },
            squishVersion: '150',
            author: "Joseph Garcia",
            description: 'A new Homegames game'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.WHITE
        });
    }

    handleNewPlayer({ playerId }) {
    }

    handlePlayerDisconnect(playerId) {
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = BlankTemplate;
