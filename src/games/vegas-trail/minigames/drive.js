const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-1000');

const MAX_THINGS = 4;

class Drive {
    constructor({mainGame}) {
        this.mainGame = mainGame;

        this.spawnedEnemies = {};
        this.spawnedRewards = {};

        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: Colors.COLORS.HG_BLACK,
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
                'car-default': {
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

        this.road = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                0,
                0,
                100,
                100
            ),
            assetInfo: {
                'drive-1-1': {
                    pos: {
                        x: 0,
                        y: 0
                    },
                    size: {
                        x: 100,
                        y: 100
                    }
                }
            }
        });

        this.clickLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
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

        // this.car = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(50, 85, 4, 4),
        //     fill: Colors.COLORS.PINK
        // });

        this.road.addChildren(this.car, this.clickLayer);
        this.root.addChild(this.road);

        const songNode = new GameNode.Asset({
                    coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                    assetInfo: {
                        'driveSong': {
                            'pos': Object.assign({}, { x: 0, y: 0 }),
                            'size': Object.assign({}, { x: 0, y: 0 }),
                            'startTime': 0
                        }
                    }
                });

                this.root.addChild(songNode);
    }

    tick({ playerStates, resources}) {
        if (!this.lastRoadTransition || this.lastRoadTransition + 500 < Date.now()) {
            let currentAssetPieces = Object.keys(this.road.node.asset)[0].split('-');
            let zone = this.zone || 1;
            let currentFrame = Number(currentAssetPieces[2]);

            this.road.node.asset = {
                [`drive-${zone}-${(currentFrame + 1) % 2}`]: {
                    pos: {
                        x: 0,
                        y: 0
                    },
                    size: {
                        x: 100,
                        y: 100
                    }
                }
            };

            this.lastRoadTransition = Date.now();
        }
        if (this.carPath && this.carPathIndex !== null && this.carPathIndex < this.carPath.length) {
            this.car.node.coordinates2d = ShapeUtils.rectangle(this.carPath[this.carPathIndex][0], this.carPath[this.carPathIndex][1], 4, 4);

            let assetKey = 'car-default';
            let assetWidth = 6;
            let assetHeight = 12;


            if (this.carPath[this.carPathIndex + 1] && this.carPath[this.carPathIndex + 1][0] < this.carPath[this.carPathIndex][0]) {
                assetKey = 'car-left';
                assetWidth = 8;
                assetHeight = 16;
            } else if (this.carPath[this.carPathIndex + 1] && this.carPath[this.carPathIndex + 1][0] > this.carPath[this.carPathIndex][0]) {
                assetKey = 'car-right';
                assetWidth = 8;
                assetHeight = 16;
            }

            const asset = {
                [assetKey]: {
                    pos: {
                        x: this.carPath[this.carPathIndex][0], 
                        y: this.carPath[this.carPathIndex][1]
                    },
                    size: {
                        x: assetWidth,
                        y: assetHeight
                    }
                }
            };
            this.car.node.asset = asset;

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
            const currentCoords = this.spawnedEnemies[key].node.coordinates2d;

            if (currentCoords[0][1] + 1 >= 96) {
                enemiesToRemove.add(key);
            } else {
                this.spawnedEnemies[key].node.coordinates2d = ShapeUtils.rectangle(currentCoords[0][0], currentCoords[0][1] + 1, 4, 4);
            }
        }

        for (let key in this.spawnedRewards) {
            const currentCoords = this.spawnedRewards[key].node.coordinates2d;

            if (currentCoords[0][1] + 1 >= 96) {
                rewardsToRemove.add(key);
            } else {
                this.spawnedRewards[key].node.coordinates2d = ShapeUtils.rectangle(currentCoords[0][0], currentCoords[0][1] + 1, 4, 4);
                this.spawnedRewards[key].node.asset = {'scrap': { pos: {x: currentCoords[0][0], y: currentCoords[0][1] + 1}, size: {x: 4, y: 4 }}};
            }
        }

        for (let key in this.spawnedEnemies) {
            const currentCoords = this.spawnedEnemies[key].node.coordinates2d;

            if (currentCoords[0][1] + 1 >= 96) {
                enemiesToRemove.add(key);
            } else {
                const assetKey = Object.keys(this.spawnedEnemies[key].node.asset)[0];
                this.spawnedEnemies[key].node.coordinates2d = ShapeUtils.rectangle(currentCoords[0][0], currentCoords[0][1] + 1, 4, 4);
                this.spawnedEnemies[key].node.asset = {[assetKey]: { pos: {x: currentCoords[0][0], y: currentCoords[0][1] + 1}, size: {x: 4, y: 4 }}};
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
                    this.mainGame.handleCarHit(50);
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

            this.mainGame.resources.scrap = this.mainGame.resources.scrap + 1;
            this.mainGame.renderStatsLayer();
        }
    }


    handleNewZone(zone) {
        this.zone = zone;
        const newId = `drive-${zone}-0`;

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

        this.road.node.asset = newAssetInfo;
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

            this.spawnedRewards[gameNode.node.id] = gameNode;
            this.root.addChild(gameNode);
        } else {
            const assetKey = Math.random() <= .5 ? 'tumbleweed' : 'rock-1';
            const gameNode = new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    xVal,
                    10,
                    5,
                    5
                ),
                assetInfo: {
                    [assetKey]: {
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

            this.spawnedEnemies[gameNode.node.id] = gameNode;
            this.root.addChild(gameNode);
        }
        
    }

    getRoot() {
        return this.root;
    }
}

module.exports = Drive;
