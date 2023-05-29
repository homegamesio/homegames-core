const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0766');

class Fight {
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

        this.enemyConfig = {
            'x': {
                increaseInterval: 1000,
                initialWidth: 4,
                maxWidth: 80,
                timeout: 3000, // wait 3 seconds after hitting max size
                widthIncrement: 2,
                initialHeight: 4,
                maxHeight: 12,
                heightIncrement: 2,
                health: 100,
                value: 100
            }
        };

        this.enemyLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        this.attackLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (playerId, x, y) => {
                this.attack(playerId, x, y);
            }
        });

        this.enemies = {
            [enemy.node.id]: {
                node: enemy,
                lastIncrease: null,
                type: 'x',
                health: this.enemyConfig['x'].health,
                spawnedAt: Date.now()
//                increaseInterval: 500 // every 500ms get bigger
            }
        };

        this.enemyLayer.addChild(enemy);
        
        this.root.addChild(this.enemyLayer);
        this.root.addChild(this.attackLayer);
    }

    attack(playerId, x, y) {
        const attackThing = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x - 1, y - 1, 2, 2),
            fill: Colors.COLORS.ORANGE
        });

        const wouldBeCollisions = GeometryUtils.checkCollisions(this.enemyLayer, attackThing);
        for (let i = 0; i < wouldBeCollisions.length; i++) {
            const enemy = this.enemies[wouldBeCollisions[i].node.id];
            console.log("enemy!");
            console.log(enemy);
            const attackValue = 10;
            const newHealth = enemy.health - attackValue;
            if (newHealth <= 0) {
                console.log('is kill');
            }
            this.enemies[wouldBeCollisions[i].node.id].health = newHealth;
            console.log(newHealth);
        }
    }

    tick() {
        const now = Date.now();
        for (let key in this.enemies) {
            const enemy = this.enemies[key];
            const enemyConfig = this.enemyConfig[enemy.type];
            if (!enemy.lastIncrease || enemy.lastIncrease + enemyConfig.increaseInterval <= now) {
                const coords = enemy.node.node.coordinates2d;
                const oldXStart = coords[0][0];
                const oldYStart = coords[0][1];
                const oldWidth = coords[1][0] - oldXStart;
                const oldHeight = coords[2][1] - oldYStart;

                if (oldWidth >= enemyConfig.maxWidth || oldHeight >= enemyConfig.maxHeight) {
                    continue;
                }

                const newCoords = ShapeUtils.rectangle(
                    oldXStart - (enemyConfig.widthIncrement / 2), 
                    oldYStart - (enemyConfig.heightIncrement / 2), 
                    oldWidth + (enemyConfig.widthIncrement), 
                    oldHeight + (enemyConfig.heightIncrement));

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

module.exports = Fight;
