const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0766');

class FightIllness {
    constructor() {
        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.WHITE
        });

        const enemy = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(48, 48, 4, 4),
            fill: Colors.COLORS.RED
        });

        this.enemies = {
            [enemy.node.id]: {
                node: enemy,
                lastIncrease: null,
                increaseInterval: 50 // every 200ms get bigger
            }
        }
        
        this.root.addChild(enemy);
    }

    tick() {
        const now = Date.now();
        for (let key in this.enemies) {
            const enemy = this.enemies[key];
            if (!enemy.lastIncrease || enemy.lastIncrease + enemy.increaseInterval <= now) {
                const coords = enemy.node.node.coordinates2d;
                const oldXStart = coords[0][0];
                const oldYStart = coords[0][1];
                const oldWidth = coords[1][0] - oldXStart;
                const oldHeight = coords[2][1] - oldYStart;

                const newCoords = ShapeUtils.rectangle(oldXStart - 1, oldYStart - 1, oldWidth + 2, oldHeight + 2);

                this.enemies[key].node.node.coordinates2d = newCoords; 
                this.enemies[key].lastIncrease = Date.now();
            }
        }
    }

    spawnObstacle() {
    }

    getRoot() {
        return this.root;
    }
}

module.exports = FightIllness;
