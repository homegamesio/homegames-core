const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-0754');
const COLORS = Colors.COLORS;

class HotPotato extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 1, y: 2},
            squishVersion: '0754',
            author: 'Joseph Garcia',
            // thumbnail: 'f70e1e9e2b5ab072764949a6390a8b96'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [87, 42, 19, 255]
        });
    }

    getLayers() {
        return [{
            root: this.base
        }];
    }
}

module.exports = HotPotato;
