const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0766');

const WEAPONS = {
    DEFAULT: 'DEFAULT'
};

// HUNTING SLOT MACHINES

const createEnemy = (enemyType) => {
     const left = Math.random() < .5;
     const startY = Math.max(Math.min(Math.random() * 100, 80), 20);

     const enemyData = enemyTypes[enemyType];
     const xRate = (left ? 1 : -1) * enemyData.xRate;

     // it will take 100 / xRate ticks to get across the screen
     // we want the enemy to move at most 20 units in either y direction
     const up = Math.random() < .5;
     const velVal = Math.random() * 20;

     const yVel = (up ? 1 : -1) * (velVal / (100 / xRate));

     const newPath = Physics.getPath(
         left ? 0 : 100,
         startY,
         xRate,
         yVel,
         110, 
         110);

     return {
         node: enemyData.create(left ? 0: 100, startY),
         newPath
    };
}

const enemyTypes = {
    'w': {
        xRate: .25,
        value: 25,
        create: (startX, startY) => {
            return new GameNode.Shape({
               shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(startX, startY, 5, 5),
                fill: Colors.COLORS.BLUE
            });
        }
    },
    'x': {
        value: 150,
        xRate: 1.5,
        create: (startX, startY) => {
            return new GameNode.Shape({
               shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(startX, startY, 2, 2),
                fill: Colors.COLORS.GOLD
            });
        }

    },
    'y': {
        value: 100,
        xRate: 1,
        create: (startX, startY) => {
            return new GameNode.Shape({
               shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(startX, startY, 3, 3),
                fill: Colors.COLORS.CYAN
            });
        }

    },
    'z': {
        value: 50,
        xRate: .5,
        create: (startX, startY) => {
            return new GameNode.Shape({
               shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(startX, startY, 4, 4),
                fill: Colors.COLORS.GREEN
            });
        }

    }
};

 

class Hunt {
    constructor(playerId, initialState = {}) {
        const playerScores = {
            [playerId]: 0
        }
        
        this.state = initialState;

        this.renderedEnemies = {};
        this.enemyPaths = {};

        this.actionQueue = [];

        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.WHITE,
            onClick: (playerId, x, y) => {
                this.shoot(playerId, x, y);
            }
        });

//        const spawner = setInterval(() => {
//            const randomKeyIndex = Math.floor(Math.random() * Object.keys(enemyTypes).length);
//            const { node: enemy, newPath } = createEnemy(Object.keys(enemyTypes)[randomKeyIndex]);
//            this.root.addChild(enemy);
//            let pathIndex = 0;
//            const mover = setInterval(() => {
//                if (pathIndex >= newPath.length) {
//                    clearInterval(mover);
//                    this.root.removeChild(enemy.node.id);
//                    return;
//                }
//                const newCoordinates = ShapeUtils.rectangle(newPath[pathIndex][0], newPath[pathIndex][1], 5, 5);
//                enemy.node.coordinates2d = newCoordinates;
//                pathIndex++;
//            }, 16);
//
//            const leftWallEnemies = GeometryUtils.checkCollisions(
//                this.root, 
//                {
//                    node: {
//                        coordinates2d: ShapeUtils.rectangle(0, 0, 1, 100)
//                    }
//                }, 
//                (node) => {
//                    return this.renderedEnemies[node.node.id];
//                }
//            );
//
//            const rightWallEnemies = GeometryUtils.checkCollisions(
//                this.root, 
//                {
//                    node: {
//                        coordinates2d: ShapeUtils.rectangle(99, 0, 1, 100)
//                    }
//                }, 
//                (node) => {
//                    return node.node.id !== enemy.node.id && this.renderedEnemies[node.node.id];
//                }
//            );
//
//            this.renderedEnemies[enemy.node.id] = enemy;
////            leftWallEnemies.forEach(e => this.root.removeChild(e.node.id));
//  //          rightWallEnemies.forEach(e => this.root.removeChild(e.node.id));
//        }, 1000);

//        setTimeout(() => {
//            clearInterval(spawner);
//            console.log('ended');
//        }, 60 * 1000);
    }

    shoot(playerId, x, y) {
        const playerWeapon = this.state.weapons && this.state.weapons[playerId] || WEAPONS.DEFAULT;
        const weapons = {
            [WEAPONS.DEFAULT]: {
                x: 1,
                y: 1,
                rate: 2
            }
        };

        const weapon = weapons[playerWeapon];
        const shot = new GameNode.Shape({
            // todo: move all of these intervals to tick
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50, 100, weapon.x, weapon.y),//playerWeapon.x, playerWeapon.y),
            fill: Colors.COLORS.PURPLE
        });

        // end needs to be x, y
        // start is 50, 100
        // xVel is 50 +/- x
        // yVel is 1

        const xDiff = Math.abs(50 - x);
        const yDiff = Math.abs(100 - y);
        // moving at rate each tick
        const newPath = Physics.getPath(
                50,
                100,
                (x > 50 ? 1 : -1) * ((xDiff) * (weapon.rate / 100)),
                -1 * (yDiff * (weapon.rate / 100)),
                100, 
                100);
        
        let pathIndex = 0;
        const mover = setInterval(() => {
            if (pathIndex >= newPath.length) {
                clearInterval(mover);
                this.root.removeChild(shot.node.id);
                return;
            }
            const collidingEnemies = GeometryUtils.checkCollisions(
                this.root, 
                shot,
                (node) => {
                    return node.node.id !== shot.node.id && this.renderedEnemies[node.node.id];
                }
            );

            if (collidingEnemies) {
                collidingEnemies.forEach(e => this.root.removeChild(e.node.id));
            }

            const newCoordinates = ShapeUtils.rectangle(newPath[pathIndex][0], newPath[pathIndex][1], weapon.x, weapon.y);
            shot.node.coordinates2d = newCoordinates;
            pathIndex++;
        }, 16);

        this.root.addChild(shot);
    }

    spawnEnemy(enemyType) {
        const randomKeyIndex = enemyType ? Object.keys(enemyTypes).indexOf(enemyType) : Math.floor(Math.random() * Object.keys(enemyTypes).length);
        const { node: enemy, newPath } = createEnemy(Object.keys(enemyTypes)[randomKeyIndex]);
        
        this.root.addChild(enemy);

        this.enemyPaths[enemy.node.id] = {
            currentIndex: 0,
            path: newPath
        };
        
//        let pathIndex = 0;
//            const mover = setInterval(() => {
//                if (pathIndex >= newPath.length) {
//                    clearInterval(mover);
//                    this.root.removeChild(enemy.node.id);
//                    return;
//                }
//                const newCoordinates = ShapeUtils.rectangle(newPath[pathIndex][0], newPath[pathIndex][1], 5, 5);
//                enemy.node.coordinates2d = newCoordinates;
//                pathIndex++;
//            }, 16);
//
//            const leftWallEnemies = GeometryUtils.checkCollisions(
//                this.root, 
//                {
//                    node: {
//                        coordinates2d: ShapeUtils.rectangle(0, 0, 1, 100)
//                    }
//                }, 
//                (node) => {
//                    return this.renderedEnemies[node.node.id];
//                }
//            );
//
//            const rightWallEnemies = GeometryUtils.checkCollisions(
//                this.root, 
//                {
//                    node: {
//                        coordinates2d: ShapeUtils.rectangle(99, 0, 1, 100)
//                    }
//                }, 
//                (node) => {
//                    return node.node.id !== enemy.node.id && this.renderedEnemies[node.node.id];
//                }
//            );
//
            this.renderedEnemies[enemy.node.id] = enemy;
//            leftWallEnemies.forEach(e => this.root.removeChild(e.node.id));
  //          rightWallEnemies.forEach(e => this.root.removeChild(e.node.id));

    }

    tick() {
        if (!this.lastSpawnTime || (this.lastSpawnTime && this.lastSpawnTime < Date.now() - 1000)) {
            this.lastSpawnTime = Date.now();
            this.spawnEnemy();
        }

        const keysToRemove = new Set();
        for (const key in this.renderedEnemies) {
            // check for collisions with bullet

            // move next index in path
            if (this.enemyPaths[key]) {
                const enemyPath = this.enemyPaths[key].path;
                const pathIndex = this.enemyPaths[key].currentIndex;

                if (pathIndex >= enemyPath.length) {
                    keysToRemove.add(key);
                } else {
                    const enemy = this.renderedEnemies[key];
                    const enemyCoords = enemy.node.coordinates2d;
                    const newCoordinates = ShapeUtils.rectangle(enemyPath[pathIndex][0], enemyPath[pathIndex][1], enemyCoords[1][0] - enemyCoords[0][0], enemyCoords[2][1] - enemyCoords[1][1]);
                    enemy.node.coordinates2d = newCoordinates;
                    this.enemyPaths[key].currentIndex = pathIndex + 1;
                }
            } else {
                keysToRemove.add(key);
            }

            keysToRemove.forEach(k => {
                this.root.removeChild(k);
                delete this.renderedEnemies[k]
                delete this.enemyPaths[k]
            });
        }
    }

    getRoot() {
        return this.root;
    }
}

module.exports = Hunt;
