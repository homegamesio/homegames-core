const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0767');

const MAX_THINGS = 4;

class Drive {
    constructor() {
        this.spawnedEnemies = {};
        this.spawnedRewards = {};

        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.HG_BLACK,
            onClick: (player, x, y) => {
                const currentCarCoords = this.car.node.coordinates2d;

                const xDiff = Math.abs(currentCarCoords[0][0] - x);
                const yDiff = Math.abs(currentCarCoords[0][0] - y);

                const newPath = Physics.getPath(
                        currentCarCoords[0][0],
                        currentCarCoords[0][1],
                        x < currentCarCoords[0][0] ? -1 : 1,
                        0,
                        100, 
                        100);

                // this is a hack. path stuff should be more robust
                this.carPath = newPath.filter(p => x < currentCarCoords[0][0] ? p[0] >= x : p[0] <= x);// && p[1] <= y); 

                this.carPathIndex = 0;
            }
        });

        this.carPath = [];
        this.carPathIndex = null;

        this.car = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                50,
                85,
                4,
                8
            ),
            assetInfo: {
                'gas-car': {
                    pos: {
                        x: 50,
                        y: 85
                    },
                    size: {
                        x: 6,
                        y: 12
                    }
                }
            }
        });
        // this.car = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(50, 85, 4, 4),
        //     fill: Colors.COLORS.PINK
        // });

        this.root.addChild(this.car);
    }

    tick({ playerStates, resources}) {
        if (this.carPath && this.carPathIndex !== null && this.carPathIndex < this.carPath.length) {
            this.car.node.coordinates2d = ShapeUtils.rectangle(this.carPath[this.carPathIndex][0], this.carPath[this.carPathIndex][1], 4, 4);
            console.log('what is this');
            console.log(this.car.node.asset);
            const asset = {
                'gas-car': {
                    pos: {
                        x: this.carPath[this.carPathIndex][0], 
                        y: this.carPath[this.carPathIndex][1]
                    },
                    size: {
                        x: 6,
                        y: 12
                    }
                }
            };
            this.car.node.asset = asset;
            //Object.assign({}, this.car.node.asset);
            // asset['gas-car'].pos = 
            // {x: this.carPath[this.carPathIndex][0], y: this.carPath[this.carPathIndex][1]}
            this.carPathIndex = this.carPathIndex + 1;
        }

        if (!this.lastSpawnTime || (this.lastSpawnTime && this.lastSpawnTime < Date.now() - 500)) {
            if (Object.keys(this.spawnedEnemies).length + Object.keys(this.spawnedRewards).length < MAX_THINGS) {
                this.lastSpawnTime = Date.now();
                this.spawnObstacle();
            }
        }

        const enemiesToRemove = new Set();
        const rewardsToRemove = new Set();

        for (let key in this.spawnedEnemies) {
            // console.log('need to move or kill or hit');
            const currentCoords = this.spawnedEnemies[key].node.coordinates2d;

            if (currentCoords[0][1] + 1 >= 96) {
                enemiesToRemove.add(key);
            } else {
                this.spawnedEnemies[key].node.coordinates2d = ShapeUtils.rectangle(currentCoords[0][0], currentCoords[0][1] + 1, 4, 4);
            }
        }

        for (let key in this.spawnedRewards) {
            // console.log('need to move rewards');
            const currentCoords = this.spawnedRewards[key].node.coordinates2d;

            if (currentCoords[0][1] + 1 >= 96) {
                rewardsToRemove.add(key);
            } else {
                this.spawnedRewards[key].node.coordinates2d = ShapeUtils.rectangle(currentCoords[0][0], currentCoords[0][1] + 1, 4, 4);
                this.spawnedRewards[key].node.asset = {'scrap': { pos: {x: currentCoords[0][0], y: currentCoords[0][1] + 1}, size: {x: 4, y: 4 }}};
            }
        }

        if (!this.lastCollisionCheck || this.lastCollisionCheck + 200 < Date.now()) {
            const collidingRewards = GeometryUtils.checkCollisions(
                this.root, this.car,
                (node) => {
                    return this.spawnedRewards[node.node.id];
                }
            );

            const collidingEnemies = GeometryUtils.checkCollisions(
                this.root, this.car,
                (node) => {
                    return this.spawnedEnemies[node.node.id];
                }
            );

            if (collidingRewards) {
                for (let i in collidingRewards) {
                    rewardsToRemove.add(collidingRewards[i].node.id);
                }
            }

            if (collidingEnemies) {
                for (let i in collidingEnemies) {
                    enemiesToRemove.add(collidingEnemies[i].node.id);
                }
            }
        }

        for (let key of enemiesToRemove) {
            this.root.removeChild(key);
            this.spawnedEnemies[key].node.free();
            delete this.spawnedEnemies[key];
        }

        for (let key of rewardsToRemove) {
            this.root.removeChild(key);
            this.spawnedRewards[key].node.free();
            delete this.spawnedRewards[key]; 
        }

        
    }

    spawnObstacle() {
        const isReward = Math.random() <= 0.5;
        const xVal = Math.floor(Math.random() * 100);
        
        if (isReward) {
            const gameNode = new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    xVal,
                    10,
                    5,
                    5
                ),
                assetInfo: {
                    'scrap': {
                        pos: {
                            x: xVal,
                            y: 10
                        },
                        size: {
                            x: 5,
                            y: 5
                        }
                    }
                }
            });

            // new GameNode.Shape({
            //     shapeType: Shapes.POLYGON,
            //     coordinates2d: ShapeUtils.rectangle(xVal, 10, 5, 5),
            //     fill: Colors.COLORS.ORANGE
            // });

            this.spawnedRewards[gameNode.node.id] = gameNode;
            this.root.addChild(gameNode);
        } else {
            const gameNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(xVal, 10, 5, 5),
                fill: Colors.COLORS.HG_BLACK
            });

            this.spawnedEnemies[gameNode.node.id] = gameNode;
            this.root.addChild(gameNode);
        }
        
    }

    getRoot() {
        return this.root;
    }
}

module.exports = Drive;
