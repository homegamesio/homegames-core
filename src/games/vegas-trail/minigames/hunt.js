const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0767');

const WEAPONS = {
    DEFAULT: 'DEFAULT'
};

const MAX_SHOTS = 10;
const MAX_ENEMIES = 8;

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
        this.renderedShots = {};

        this.enemyPaths = {};
        this.shotPaths = {};
        this.scores = {};
        this.infoNodes = [
            {
                type: 'score',
                gameNode: new GameNode.Text({
                    textInfo: {
                        x: 6,
                        y: 2,
                        text: '0',
                        color: Colors.COLORS.BLACK,
                        size: 1,
                        align: 'left'
                    }
                })
            }
        ];

        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.WHITE,
            onClick: (playerId, x, y) => {
                this.shoot(playerId, x, y);
            }
        });

        for (let i in this.infoNodes) {
            const gameNode = this.infoNodes[i].gameNode;
            this.root.addChild(gameNode);
        }

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
        if (Object.keys(this.renderedShots).length >= MAX_SHOTS) {
            return;
        }
        
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

        this.renderedShots[shot.node.id] = {
            gameNode: shot,
            playerId
        };

        this.shotPaths[shot.node.id] = {
            currentIndex: 0,
            path: newPath
        };
        
//        let pathIndex = 0;
//        const mover = setInterval(() => {
//            if (pathIndex >= newPath.length) {
//                clearInterval(mover);
//                this.root.removeChild(shot.node.id);
//                return;
//            }
//            const collidingEnemies = GeometryUtils.checkCollisions(
//                this.root, 
//                shot,
//                (node) => {
//                    return node.node.id !== shot.node.id && this.renderedEnemies[node.node.id];
//                }
//            );
//
//            if (collidingEnemies) {
//                collidingEnemies.forEach(e => this.root.removeChild(e.node.id));
//            }
//
//            const newCoordinates = ShapeUtils.rectangle(newPath[pathIndex][0], newPath[pathIndex][1], weapon.x, weapon.y);
//            shot.node.coordinates2d = newCoordinates;
//            pathIndex++;
//        }, 16);

        this.root.addChild(shot);
    }

    spawnEnemy(enemyType) {
        if (Object.keys(this.renderedEnemies).length >= MAX_ENEMIES) {
            return;
        }
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
            this.renderedEnemies[enemy.node.id] = {
                gameNode: enemy,
                type: Object.keys(enemyTypes)[randomKeyIndex]
            }
//            leftWallEnemies.forEach(e => this.root.removeChild(e.node.id));
  //          rightWallEnemies.forEach(e => this.root.removeChild(e.node.id));

    }

    tick() {
        // if (!this.lastSpawnTime || (this.lastSpawnTime && this.lastSpawnTime < Date.now() - 1000)) {
            this.lastSpawnTime = Date.now();
            this.spawnEnemy();
        // }

        const enemyKeysToRemove = new Set();
        const shotKeysToRemove = new Set();

        for (const key in this.renderedEnemies) {
            // check for collisions with bullet
            const collidingBullets = GeometryUtils.checkCollisions(
                this.root, this.renderedEnemies[key].gameNode,
                (node) => {
                    return this.renderedShots[node.node.id];
                }
            );

            if (collidingBullets.length) {
                let playerId;
                for (const i in collidingBullets) { 
                    playerId = playerId || this.renderedShots[collidingBullets[i].node.id].playerId;
                    // this.root.removeChild(collidingBullets[i].node.id);
                    shotKeysToRemove.add(collidingBullets[i].node.id);
                    // collidingBullets[i].node.ayy();
                }
                const enemyType = this.renderedEnemies[key].type;
                
                if (!this.scores[playerId]) {
                    this.scores[playerId] = 0;
                }

                this.scores[playerId] = this.scores[playerId] + enemyTypes[enemyType].value;

                enemyKeysToRemove.add(key);
            }

            // move next index in path
            if (this.enemyPaths[key]) {
                const enemyPath = this.enemyPaths[key].path;
                const pathIndex = this.enemyPaths[key].currentIndex;

                if (pathIndex >= enemyPath.length) {
                    enemyKeysToRemove.add(key);
                } else {
                    const enemy = this.renderedEnemies[key].gameNode;
                    const enemyCoords = enemy.node.coordinates2d;
                    const newCoordinates = ShapeUtils.rectangle(enemyPath[pathIndex][0], enemyPath[pathIndex][1], enemyCoords[1][0] - enemyCoords[0][0], enemyCoords[2][1] - enemyCoords[1][1]);
                    enemy.node.coordinates2d = newCoordinates;
                    this.enemyPaths[key].currentIndex = pathIndex + 1;
                }
            } else {
                enemyKeysToRemove.add(key);
            }

            enemyKeysToRemove.forEach(k => {
                if (!this.renderedEnemies[k] || !this.renderedEnemies[k].gameNode) {
                    // continue;
                } else {
                    this.root.removeChild(k);
                    const node = this.renderedEnemies[k].gameNode;

                    console.log('just revoked');
                    delete this.renderedEnemies[k]
                    delete this.enemyPaths[k];

                    console.log('removed enemy ' + k);
                    console.log(node);
                    node.node.ayy();
                }
                // k.node.coordinates2d = k.node.coordinates2d;
                // throw new Error('ay lmao');
            });

            this.infoNodes.forEach(infoNode => {

                if (infoNode.type === 'score') {
                    const gameNode = infoNode.gameNode;
                    const textInfo = Object.assign({}, gameNode.node.text);
                    textInfo.text = Object.keys(this.scores).length > 0 ? '' + Object.values(this.scores)[0] : '0'; // todo: support multiple player scores? prob not
                    gameNode.node.text = textInfo;
                }
            });
        }

        for (const key in this.renderedShots) {
            // move next index in path
            if (this.shotPaths[key]) {
                const shotPath = this.shotPaths[key].path;
                const pathIndex = this.shotPaths[key].currentIndex;

                if (pathIndex >= shotPath.length) {
                    shotKeysToRemove.add(key);
                } else {
                    const shot = this.renderedShots[key].gameNode;
                    const shotCoords = shot.node.coordinates2d;
                    const newCoordinates = ShapeUtils.rectangle(shotPath[pathIndex][0], shotPath[pathIndex][1], shotCoords[1][0] - shotCoords[0][0], shotCoords[2][1] - shotCoords[1][1]);
                    shot.node.coordinates2d = newCoordinates;
                    this.shotPaths[key].currentIndex = pathIndex + 1;
                }
            } else {
                shotKeysToRemove.add(key);
            }

            shotKeysToRemove.forEach(k => {
                this.root.removeChild(k);

                console.log("here is ting1111");
                console.log(this.renderedShots[k]);
                console.log('aboutt otosdfgods')
                const node = this.renderedShots[k];
                console.log("THIS IS NOE!!!!");
                console.log(node);
                delete this.renderedShots[k];
                delete this.shotPaths[k];
                this.root.removeChild(k);


                console.log("here is ting12222");
                console.log('ayththdshfhsd!');
                console.log(node);
                if (node) {
                    node.gameNode.node.ayy();
                }
            });
        }

        for (const key in this.scores) {

        }
 
    }

    getRoot() {
        return this.root;
    }
}

module.exports = Hunt;
