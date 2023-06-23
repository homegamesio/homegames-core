const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0767');
const weapons = require('../weapons');

// const WEAPONS = {
//     DEFAULT: 'DEFAULT'
// };

const MAX_SHOTS = 3;
const MAX_ENEMIES = 3;

// HUNTING SLOT MACHINES

const createEnemy = (enemyType) => {
     const left = Math.random() < .5;
     const startY = Math.max(Math.min(Math.random() * 100, 70), 30);

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
         100, 
         100);

     return {
         node: enemyData.create(left ? 0: 100, startY),
         newPath,
         left
    };
}

const createLegs = (legType, left, y) => {
    // dumb hack. "left" means coming from left aka moving right.
    const pieces = legType.split('-');
    
    if (left) {
        pieces[1] = 'right';
    } else {
        pieces[1] = 'left';
    }

    legType = pieces.join('-');

    const legData = legTypes[legType];

    return {
         node: legData.create(left ? 0: 100, y),
    };
}

const legTypes = {
    'legs-left-1': {
        yOffsets: {
            'big-saguaro': 6
        },
        xOffsets: {
            'big-saguaro': -0.5
        },
        create: (startX, startY) => {
            return new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    startX,
                    startY,
                    6,
                    6
                ),
                assetInfo: {
                    'legs-left-1': {
                        pos: {
                            x: startX,
                            y: startY
                        },
                        size: {
                            x: 6,
                            y: 6
                        }
                    }
                }
            });            
        }
    },
    'legs-left-2': {
        xOffsets: {
            'big-saguaro': -0.5
        },
        yOffsets: {
            'big-saguaro': 6
        },
        create: (startX, startY) => {
            return new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    startX,
                    startY,
                    6,
                    6
                ),
                assetInfo: {
                    'legs-left-2': {
                        pos: {
                            x: startX,
                            y: startY
                        },
                        size: {
                            x: 6,
                            y: 6
                        }
                    }
                }
            });            
        }
    },
    'legs-right-1': {
        yOffsets: {
            'big-saguaro': 6
        },
        xOffsets: {
            'big-saguaro': -0.5
        },
        create: (startX, startY) => {
            return new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    startX,
                    startY,
                    6,
                    6
                ),
                assetInfo: {
                    'legs-right-1': {
                        pos: {
                            x: startX,
                            y: startY
                        },
                        size: {
                            x: 6,
                            y: 6
                        }
                    }
                }
            });            
        }
    },
    'legs-right-2': {
        xOffsets: {
            'big-saguaro': -0.5
        },
        yOffsets: {
            'big-saguaro': 6
        },
        create: (startX, startY) => {
            return new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    startX,
                    startY,
                    6,
                    6
                ),
                assetInfo: {
                    'legs-right-2': {
                        pos: {
                            x: startX,
                            y: startY
                        },
                        size: {
                            x: 6,
                            y: 6
                        }
                    }
                }
            });            
        }
    },
    // '2': {

    // },
    // '3': {

    // }
}

const enemyTypes = {
    'w': {
        xRate: .25,
        value: 25,
        health: 50,
        create: (startX, startY) => {

            return new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    startX,
                    startY,
                    6,
                    6
                ),
                assetInfo: {
                    'big-saguaro': {
                        pos: {
                            x: startX,
                            y: startY
                        },
                        size: {
                            x: 6,
                            y: 6
                        }
                    }
                }
            });
            // return new GameNode.Shape({
            //    shapeType: Shapes.POLYGON,
            //     coordinates2d: ShapeUtils.rectangle(startX, startY, 5, 5),
            //     fill: Colors.COLORS.BLUE
            // });
        }
    },
    // 'x': {
    //     value: 150,
    //     xRate: 1.5,
    //     create: (startX, startY) => {
    //         return new GameNode.Shape({
    //            shapeType: Shapes.POLYGON,
    //             coordinates2d: ShapeUtils.rectangle(startX, startY, 2, 2),
    //             fill: Colors.COLORS.GOLD
    //         });
    //     }

    // },
    // 'y': {
    //     value: 100,
    //     xRate: 1,
    //     create: (startX, startY) => {
    //         return new GameNode.Shape({
    //            shapeType: Shapes.POLYGON,
    //             coordinates2d: ShapeUtils.rectangle(startX, startY, 3, 3),
    //             fill: Colors.COLORS.CYAN
    //         });
    //     }

    // },
    // 'z': {
    //     value: 50,
    //     xRate: .5,
    //     create: (startX, startY) => {
    //         return new GameNode.Shape({
    //            shapeType: Shapes.POLYGON,
    //             coordinates2d: ShapeUtils.rectangle(startX, startY, 4, 4),
    //             fill: Colors.COLORS.GREEN
    //         });
    //     }

    // }
}; 

class Hunt {
    constructor({ mainGame, playerId, depleteAmmo, initialState = {} }) {
        const playerScores = {
            [playerId]: 0
        }

        this.expiringNodes = {};
        this.mainGame = mainGame;

        this.depleteAmmo = depleteAmmo;
        
        this.state = initialState;

        this.renderedEnemies = {};
        this.renderedShots = {};
        this.renderedScrap = {};

        this.enemyPaths = {};
        this.shotPaths = {};
        this.scores = {};
        this.lastResources = {};
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
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100)
        });

        this.gameLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100)
        });

        this.assetNode = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                0,
                10,
                100,
                90
            ),
            assetInfo: {
                'hunt-1': {
                    pos: {
                        x: 0,
                        y: 10
                    },
                    size: {
                        x: 100,
                        y: 90
                    }
                }
            }
        });

        this.weaponNode = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                48,
                94,
                weapons['baseball'].x,
                weapons['baseball'].y
            ),
            assetInfo: {
                'baseball-1': {
                    pos: {
                        x: 48,
                        y: 94
                    },
                    size: {
                        x: weapons['baseball'].x,
                        y: weapons['baseball'].y
                    }
                }
            }
        });

        this.gameLayer.addChildren(this.assetNode, this.weaponNode);

        this.clickLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (playerId, x, y) => {
                this.shoot(playerId, x, y);
            }
        });

        for (let i in this.infoNodes) {
            const gameNode = this.infoNodes[i].gameNode;
            this.gameLayer.addChild(gameNode);
        }

        this.root.addChildren(this.gameLayer, this.clickLayer);

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

    handleNewZone(zone) {
        const newId = `hunt-${zone}`;

        const newAssetInfo = {
            [newId]: {
                pos: {
                    x: 0,
                    y: 10
                },
                size: {
                    x: 100,
                    y: 90
                }
            }
        };

        this.assetNode.node.asset = newAssetInfo;
    }


    setMode(mode) {
        this.mode = mode;
    }

    renderWeaponNode() {
        const playerWeapon = this.lastResources.weapon || 'baseball';

        if (this.weaponNode) {
            this.gameLayer.removeChild(this.weaponNode.id);
            this.weaponNode.node.free();
        }        

        const assetKey = playerWeapon + '-1';

        this.weaponNode = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                48,
                94,
                weapons[playerWeapon].x,
                weapons[playerWeapon].y
            ),
            assetInfo: {
                [assetKey]: {
                    pos: {
                        x: 48,
                        y: 94
                    },
                    size: {
                        x: weapons[playerWeapon].x,
                        y: weapons[playerWeapon].y
                    }
                }
            }
        });

        this.gameLayer.addChild(this.weaponNode);

    }

    shoot(playerId, x, y) {
        // if (this.mode === 'select') {
            // const fakeNode = new GameNode.Shape({
            //     shapeType: Shapes.POLYGON,
            //     coordinates2d: ShapeUtils.rectangle(x - 2, y - 2, 4, 4)
            // });

            // const collidingScrap = GeometryUtils.checkCollisions(
            //     this.root, fakeNode,
            //     (node) => {
            //         return this.renderedScrap[node.node.id];
            //     }
            // );

            // console.log('colliding with this scrap');
            // console.log(collidingScrap);
        // } else if (this.mode === 'shoot') {
            if (Object.keys(this.renderedShots).length >= MAX_SHOTS) {
                return;
            }

            if (!this.lastResources.ammo) {
                return;
            } 
            
            const playerWeapon = this.lastResources.weapon || 'baseball';
            // const weapons = {
            //     [WEAPONS.DEFAULT]: {
            //         x: 1,
            //         y: 1,
            //         rate: 2
            //     }
            // };

            // console.log('weijweijowe!');
            // console.log(this.lastResources);
            // console.log(weapons);
            const weapon = Object.assign({}, weapons[playerWeapon]);
            // console.log('weapon');
            // console.log(weapon);
            const shot = new GameNode.Shape({
                // todo: move all of these intervals to tick
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(48, 94, weapon.x, weapon.y),//playerWeapon.x, playerWeapon.y),
            });

            const assetKey = playerWeapon + '-1';

            const shotAsset = new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    48,
                    94,
                    weapon.x,
                    weapon.y
                ),
                assetInfo: {
                    [assetKey]: {
                        pos: {
                            x: 48,
                            y: 94
                        },
                        size: {
                            x: weapon.x,
                            y: weapon.y
                        }
                    }
                }
            });

            shot.addChildren(shotAsset);

            // end needs to be x, y
            // start is 50, 100
            // xVel is 50 +/- x
            // yVel is 1

            const xDiff = Math.abs(50 - x);
            const yDiff = Math.abs(100 - y);
            // moving at rate each tick
            const newPath = Physics.getPath(
                    48,
                    94,
                    (x > 50 ? 1 : -1) * ((xDiff) * (weapon.velocity / 100)),
                    -1 * (yDiff * (weapon.velocity / 100)),
                    100, 
                    100);

            this.renderedShots[shot.node.id] = {
                gameNode: shot,
                playerId,
                weapon: playerWeapon
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

            this.gameLayer.addChild(shot);
            this.depleteAmmo(1);
        // }
    }

    spawnEnemy(enemyType, legType) {
        if (Object.keys(this.renderedEnemies).length >= MAX_ENEMIES) {
            return;
        }
        const randomKeyIndex = enemyType ? Object.keys(enemyTypes).indexOf(enemyType) : Math.floor(Math.random() * Object.keys(enemyTypes).length);
        const { node: enemy, newPath, left } = createEnemy(Object.keys(enemyTypes)[randomKeyIndex]);

        const randomLegKeyIndex = legType ? Object.keys(legTypes).indexOf(legType) : Math.floor(Math.random() * Object.keys(legTypes).length);
        const { node: legsNode } = createLegs(Object.keys(legTypes)[randomLegKeyIndex], left, enemy.node.coordinates2d[0][1]);

        this.gameLayer.addChildren(enemy, legsNode);

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
        const realType = Object.keys(enemyTypes)[randomKeyIndex];
            this.renderedEnemies[enemy.node.id] = {
                gameNode: enemy,
                type: realType,
                health: enemyTypes[realType].health,
                legs: legsNode
            }
//            leftWallEnemies.forEach(e => this.root.removeChild(e.node.id));
  //          rightWallEnemies.forEach(e => this.root.removeChild(e.node.id));

    }

    spawnScrap(x, y) {
        console.log('need to spawn scrap at ' + x + ',  ' + y);

        const scrapIcon = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                x - 1,
                y - 1,
                3,
                3
            ),
            assetInfo: {
                'scrap': {
                    pos: {
                        x: x - 1,
                        y: y - 1
                    },
                    size: {
                        x: 3,
                        y: 3
                    }
                }
            }
        });

         const scrapCoords = scrapIcon.node.coordinates2d;

         const goalX = 0;
         const goalY = 0;

         const xVel = scrapCoords[0][0] / -40; 
         const yVel = scrapCoords[0][1] / - 40;

         const newPath = Physics.getPath(
             scrapCoords[0][0],
             scrapCoords[0][1],
             xVel,
             yVel,
             100, 
             100);

        this.renderedScrap[scrapIcon.id] = {
            node: scrapIcon,
            path: newPath,
            currentIndex: 0
        }

        this.gameLayer.addChild(scrapIcon);
    }

    renderHit(enemyData, hitValue, isCritical) {
        const enemyNode = enemyData.gameNode;
        const enemyHealth = enemyData.health;
        const coords = enemyNode.node.coordinates2d;

        const x = Math.floor(coords[0][0]);
        const y = Math.floor(coords[0][1]);

        const width = Math.floor(coords[1][0]) - x;
        const height = Math.floor(coords[2][1]) - y;

        // const enemyHealthNode = new GameNode.Text({
        //     textInfo: {
        //         x: Math.floor(x + (width / 2)),
        //         y: Math.floor(y + (height * 1.2)),
        //         text: `${enemyHealth}`,
        //         color: Colors.COLORS.WHITE,
        //         size: 1,
        //         align: 'center'
        //     }
        // });

        const textNode = new GameNode.Text({
            textInfo: {
                x: Math.floor(x + (width / 2) + .5),
                y: Math.floor(y + (height * 1.8)),
                text: `- ${hitValue}`,
                color: isCritical ? Colors.COLORS.HG_RED : Colors.COLORS.HG_BLACK,
                size: 1.2,
                font: 'heavy-amateur',
                align: 'center'
            }
        });
        this.gameLayer.addChildren(textNode);

        // this.gameLayer.addChildren(enemyHealthNode, textNode);

        const now = Date.now();

        this.expiringNodes[textNode.id] = {
            node: textNode,
            lifetime: 500,
            createdAt: now
        }

        // this.expiringNodes[enemyHealthNode.id] = {
        //     node: enemyHealthNode,
        //     lifetime: 500,
        //     createdAt: now
        // }
    }

    tick({ playerStates, resources }) {
        this.lastResources = resources;
        const now = Date.now();

        if (!this.lastSpawnTime || (this.lastSpawnTime && this.lastSpawnTime < now - 1000)) {
            this.lastSpawnTime = now;
            this.spawnEnemy();
        }

        const enemyKeysToRemove = new Set();
        const shotKeysToRemove = new Set();
        const enemiesEliminated = new Set();

        const damageDoneByEnemy = {};

        const handleEnemyKill = (key, playerId, enemyType) => {
            if (!this.scores[playerId]) {
                this.scores[playerId] = 0;
            }

            this.scores[playerId] = this.scores[playerId] + enemyTypes[enemyType].value;

            enemyKeysToRemove.add(key);
            enemiesEliminated.add(key);
        }
        
        for (const key in this.renderedEnemies) {
            damageDoneByEnemy[key] = 0;
            // check for collisions with bullet
            const collidingBullets = GeometryUtils.checkCollisions(
                this.root, this.renderedEnemies[key].gameNode,
                (node) => {
                    return this.renderedShots[node.node.id];
                }
            );

            const enemyType = this.renderedEnemies[key].type;
            
            if (collidingBullets.length) {
                let playerId;

                for (const i in collidingBullets) {
                    const shotData = this.renderedShots[collidingBullets[i].node.id]; 
                    playerId = playerId || shotData.playerId;
                    // this.root.removeChild(collidingBullets[i].node.id);
                    shotKeysToRemove.add(collidingBullets[i].node.id);
                    const playerWeapon = shotData.weapon;
                    const hitWith = weapons[playerWeapon];

                    const baseDamage = hitWith.damage;

                    // random value within 10% of base damage
                    const padding = baseDamage * (Math.random() * 10) / 100;

                    const realDamage = Math.floor(baseDamage + ((Math.random() < .5 ? 1 : -1) * padding));

                    const newHealth = this.renderedEnemies[key].health - realDamage;
                    
                    if (newHealth <= 0) {
                        handleEnemyKill(key, playerId, enemyType);
                    }

                    this.renderHit(this.renderedEnemies[key], realDamage, realDamage > baseDamage);

                    this.renderedEnemies[key].health = newHealth;
                }
            }

            // move next index in path
            if (this.enemyPaths[key]) {
                const enemyPath = this.enemyPaths[key].path;
                const pathIndex = this.enemyPaths[key].currentIndex;

                if (pathIndex >= enemyPath.length) {
                    enemyKeysToRemove.add(key);
                } else {
                    const enemy = this.renderedEnemies[key].gameNode;
                    const legsNode = this.renderedEnemies[key].legs;
                    const enemyCoords = enemy.node.coordinates2d;
                    const newCoordinates = ShapeUtils.rectangle(enemyPath[pathIndex][0], enemyPath[pathIndex][1], enemyCoords[1][0] - enemyCoords[0][0], enemyCoords[2][1] - enemyCoords[1][1]);
                    enemy.node.coordinates2d = newCoordinates;
                    legsNode.node.coordinates2d = newCoordinates;

                    const enemyAssetKey = Object.keys(enemy.node.asset)[0];

                    const newAsset = {
                        [enemyAssetKey]: {
                            'pos': {
                                x: enemyPath[pathIndex][0],
                                y: enemyPath[pathIndex][1]
                            },
                            'size': {
                                x: 6,
                                y: 6
                            }
                        }
                    }

                    let legKey = Object.keys(legsNode.node.asset)[0];//'legs-1-1';// + (Math.random() < .5 ? '1' : '2');

                    if (!this.renderedEnemies[key].lastLegChange || this.renderedEnemies[key].lastLegChange + 500 <= Date.now()) {
                        legKey = legKey.substring(0, legKey.length - 1) + (legKey.endsWith('1') ? '2' : '1');
                        this.renderedEnemies[key].lastLegChange = Date.now();
                    }
                    
                    const newLegs = {
                        [legKey]: {
                            'pos': {
                                x: enemyPath[pathIndex][0] + legTypes[legKey].xOffsets[enemyAssetKey],
                                y: enemyPath[pathIndex][1] + legTypes[legKey].yOffsets[enemyAssetKey]
                            },
                            'size': {
                                x: 6,
                                y: 6
                            }
                        }
                    };

                    enemy.node.asset = newAsset;
                    legsNode.node.asset = newLegs;
                    this.enemyPaths[key].currentIndex = pathIndex + 1;
                }
            } else {
                enemyKeysToRemove.add(key);
            }

            enemyKeysToRemove.forEach(k => {
                if (!this.renderedEnemies[k] || !this.renderedEnemies[k].gameNode) {
                    // continue;
                } else {
                    const node = this.renderedEnemies[k].gameNode;
                    const legsNode = this.renderedEnemies[k].legs;
                    const coords = node.node.coordinates2d;
                    if (enemiesEliminated.has(k)) {
                        this.spawnScrap(coords[0][0] + (coords[1][0] - coords[0][0]), coords[0][1] + (coords[2][1] - coords[1][1]));
                    }
                    this.gameLayer.removeChild(k);
                    this.gameLayer.removeChild(legsNode.id);

                    delete this.renderedEnemies[k]
                    delete this.enemyPaths[k];
                    node.node.free();
                    legsNode.node.free();
                }
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
                    if (shot.node.children.length) {
                        const existingAssetKey = Object.keys(shot.node.children[0].node.asset)[0];
                        const newAssetKey = existingAssetKey.substring(0, existingAssetKey.length - 1) + (existingAssetKey.endsWith('1') ? '2' : '1');
                        const newAsset = {
                            [newAssetKey]: {
                                pos: {
                                    x: shotPath[pathIndex][0],
                                    y: shotPath[pathIndex][1]
                                },
                                size: {
                                    x: weapons[this.renderedShots[key].weapon].x,
                                    y: weapons[this.renderedShots[key].weapon].y
                                }
                            }
                        };

                        shot.node.children[0].node.coordinates2d = newCoordinates;
                        shot.node.children[0].node.asset = newAsset;
                    }

                    this.shotPaths[key].currentIndex = pathIndex + 1;
                }
            } else {
                shotKeysToRemove.add(key);
            }

            shotKeysToRemove.forEach(k => {
                this.gameLayer.removeChild(k);
                const node = this.renderedShots[k];
                delete this.renderedShots[k];
                delete this.shotPaths[k];

                if (node) {
                    node.gameNode.free();
                }
            });
        }

        for (const key in this.scores) {

        }

        const scrapKeysToRemove = new Set();

        for (const key in this.renderedScrap) {
            const scrapData = this.renderedScrap[key]; 
            const scrapPath = scrapData.path;
            const pathIndex = scrapData.currentIndex;

            if (pathIndex >= scrapPath.length) {
                scrapKeysToRemove.add(key);
            } else {
                const scrapNode = scrapData.node;
                const scrapCoords = scrapNode.node.coordinates2d;
                const newCoordinates = ShapeUtils.rectangle(scrapPath[pathIndex][0], scrapPath[pathIndex][1], scrapCoords[1][0] - scrapCoords[0][0], scrapCoords[2][1] - scrapCoords[1][1]);
                scrapNode.node.coordinates2d = newCoordinates;
                scrapNode.node.asset = { 'scrap': { pos: {x: scrapPath[pathIndex][0], y: scrapPath[pathIndex][1]}, size: {x: scrapCoords[1][0] - scrapCoords[0][0], y: scrapCoords[2][1] - scrapCoords[1][1]}}}
                this.renderedScrap[key].currentIndex = pathIndex + 1;
            }
        }

        for (const key of scrapKeysToRemove) {
            const node = this.renderedScrap[key].node;
            this.gameLayer.removeChild(node.id);

            node.node.free();
            delete this.renderedScrap[key];
            this.mainGame.resources.scrap = this.mainGame.resources.scrap + 1;
            this.mainGame.renderStatsLayer();
        }

        const expiringNodesToDelete = new Set();

        for (let key in this.expiringNodes) {
            if (now >= this.expiringNodes[key].createdAt + this.expiringNodes[key].lifetime) {
                const node = this.expiringNodes[key].node;
                // console.log('what the heck');
                // console.log(node);
                this.gameLayer.removeChild(node.id);
                expiringNodesToDelete.add(key);
                node.node.free();
            }
        }

        for (const key of expiringNodesToDelete) {
            delete this.expiringNodes[key];
        }
 
    }

    getRoot() {
        return this.root;
    }
}

module.exports = Hunt;
