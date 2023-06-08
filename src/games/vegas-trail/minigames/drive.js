const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0767');

class Drive {
    constructor() {
        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.WHITE
        });

        this.car = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50, 80, 3, 3),
            fill: Colors.COLORS.PINK
        });

        this.columns = [
            {
                key: 'left',
                gameNode: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(0.5, 0, 33, 100),
                    fill: Colors.COLORS.RED,
                    onClick: (playerId) => {
                        console.log('clicked left');
                    }
                })
            },
            {
                key: 'center',
                gameNode: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(33.5, 0, 33, 100),
                    fill: Colors.COLORS.GREEN,
                    onClick: (playerId) => {
                        console.log('clicked center');
                    }
                })
            },
            {
                key: 'right',
                gameNode: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(66.5, 0, 33, 100),
                    fill: Colors.COLORS.BLUE,
                    onClick: (playerId) => {
                        console.log('clicked right');
                    }
                })
            }
        ];

        for (let i in this.columns) {
            this.root.addChild(this.columns[i].gameNode);
        }
    }

    tick({ playerStates, resources}) {
        if (!this.lastSpawnTime || (this.lastSpawnTime && this.lastSpawnTime < Date.now() - 1000)) {
            this.lastSpawnTime = Date.now();
            this.spawnObstacle();
        }
    }

    spawnObstacle() {
    }

    getRoot() {
        return this.root;
    }
}

module.exports = Drive;
