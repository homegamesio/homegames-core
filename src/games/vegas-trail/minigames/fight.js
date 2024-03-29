const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-1006');

class Fight {
    constructor({mainGame}) {
        this.mainGame = mainGame;
        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.HG_YELLOW
        });

        this.backgroundAssetNode = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                0,
                10,
                100,
                90
            ),
            assetInfo: {
                'fight-1': {
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

        this.root.addChild(this.backgroundAssetNode);

        this.clickCounts = {};

        this.enemyConfig = {
            'x': {
                increaseInterval: 1000,
                initialWidth: 4,
                maxWidth: 16,
                timeout: 3000, // wait 3 seconds after hitting max size
                widthIncrement: 2,
                initialHeight: 4,
                maxHeight: 16,
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

        this.enemies = {};
        
        this.root.addChild(this.enemyLayer);
        this.root.addChild(this.attackLayer);

        this.leftGloveAsset = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                15,
                70,
                25,
                25
            ),
            assetInfo: {
                'glove-left': {
                    pos: {
                        x: 15,
                        y: 70
                    },
                    size: {
                        x: 25,
                        y: 25
                    }
                }
            }
        });

        this.rightGloveAsset = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                60,
                70,
                25,
                25
            ),
            assetInfo: {
                'glove-right': {
                    pos: {
                        x: 60,
                        y: 70
                    },
                    size: {
                        x: 25,
                        y: 25
                    }
                }
            }
        });

        this.attackLayer.addChildren(this.leftGloveAsset, this.rightGloveAsset);

        const songNode = new GameNode.Asset({
                    coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                    assetInfo: {
                        'fightSong': {
                            'pos': Object.assign({}, { x: 0, y: 0 }),
                            'size': Object.assign({}, { x: 0, y: 0 }),
                            'startTime': 0
                        }
                    }
                });

                this.root.addChild(songNode);
    }

    attack(playerId, x, y) {
        if (x <= 50) {
            this.leftGloveAsset.node.asset = {
                'glove-left': {
                    pos: {
                        x: 20,
                        y: 50
                    },
                    size: {
                        x: 25,
                        y: 25
                    }
                }
            }
            this.resetLeftTime = Date.now() + 250;

            if (this.enemy && this.enemy.state === 'left') {
                this.enemy.hits += 1;

                if (this.enemy.hits >= 3) {
                    this.enemyLayer.clearChildren();
                    this.enemy = null;

                    const dustAssetKey = 'dust-' + (Math.random() < .5 ? '1' : '2');

                    this.dustAsset = {
                        node: new GameNode.Asset({
                            coordinates2d: ShapeUtils.rectangle(35, 35, 30, 30),
                            assetInfo: {
                                [dustAssetKey]: {
                                    pos: {
                                        x: 35, 
                                        y: 35
                                    },
                                    size: {
                                        x: 30,
                                        y: 30
                                    }
                                }
                            }
                        }),
                        createdAt: Date.now()
                    };

                    this.enemyLayer.addChild(this.dustAsset.node);

                } else {
                    this.updateEnemy('default');
                }

            }
        } else {
            this.rightGloveAsset.node.asset = {
                'glove-right': {
                    pos: {
                        x: 55,
                        y: 50
                    },
                    size: {
                        x: 25,
                        y: 25
                    }
                }
            }

            this.resetRightTime = Date.now() + 250;

            if (this.enemy && this.enemy.state === 'right') {
                this.enemy.hits += 1;

                if (this.enemy.hits >= 3) {
                    this.enemyLayer.clearChildren();
                    this.enemy = null;

                    const dustAssetKey = 'dust-' + (Math.random() < .5 ? '1' : '2');

                    this.dustAsset = {
                        node: new GameNode.Asset({
                            coordinates2d: ShapeUtils.rectangle(35, 35, 30, 30),
                            assetInfo: {
                                [dustAssetKey]: {
                                    pos: {
                                        x: 35, 
                                        y: 35
                                    },
                                    size: {
                                        x: 30,
                                        y: 30
                                    }
                                }
                            }
                        }),
                        createdAt: Date.now()
                    };

                    this.enemyLayer.addChild(this.dustAsset.node);
                } else {
                    this.updateEnemy('default');
                }

            }
        }
    }

    handleNewZone(zone) {
        const newId = `fight-${zone}`;

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

        this.backgroundAssetNode.node.asset = newAssetInfo;
    }

    updateEnemy(state = 'default') {
        const existingEnemyType = this.enemy ? Object.keys(this.enemy.node.node.asset)[0].split('-')[1] : 1;
        const assetKey = `bug-${existingEnemyType}-${state}`;
        
        const newAssetInfo = {
            [assetKey]: {
                pos: {
                    x: 35,
                    y: 35
                },
                size: {
                    x: 30,
                    y: 30
                }
            }
        }
        this.enemy.node.node.asset = newAssetInfo;
        this.enemy.state = state;
        this.lastEnemyMoveTime = Date.now();
    }

    tick({ playerStates, resources}) {
        const now = Date.now();

        if (!this.enemy) {
            if (this.dustAsset) {
                if (this.dustAsset.createdAt + 500 <= now) {
                    this.enemyLayer.removeChild(this.dustAsset.node.id);
                    this.dustAsset = null;
                }
            } else {
                this.spawnEnemy();
            }
        } else if (!this.lastEnemyMoveTime || this.lastEnemyMoveTime + 750 < Date.now()) {
            if (this.enemy.state === 'default') {
                const left = Math.random() < .5;

                this.updateEnemy(left ? 'left' : 'right');
            } else {
                this.mainGame.handleSickHit();

                this.updateEnemy('default');
            }
        }

        // const enemiesToRemove = new Set();

        if (this.resetLeftTime && this.resetLeftTime <= now) {
            this.leftGloveAsset.node.asset = {
                'glove-left': {
                    pos: {
                        x: 15,
                        y: 70
                    },
                    size: {
                        x: 25,
                        y: 25
                    }
                }
            }
        }

        if (this.resetRightTime && this.resetRightTime <= now) {
            this.rightGloveAsset.node.asset = {
                'glove-right': {
                    pos: {
                        x: 60,
                        y: 70
                    },
                    size: {
                        x: 25,
                        y: 25
                    }
                }
            }
        }
    }

    spawnEnemy() {

        let bugType = 1;
        
        const rand = Math.random();

        if (rand >= .33) {
        
            bugType = 2;

            if (rand >= .66) {
                bugType = 3;
            }
        }

        const bugKey = `bug-${Math.max(1, bugType)}-default`;

        const sampleEnemy = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                35,
                35,
                30,
                30
            ),
            assetInfo: {
                [bugKey]: {
                    pos: {
                        x: 35,
                        y: 35
                    },
                    size: {
                        x: 30,
                        y: 30
                    }
                }
            }
        });

        this.enemyLayer.addChild(sampleEnemy);

        this.enemy = {
            node: sampleEnemy,
            hits: 0,
            state: 'default'
        }
    }

    getRoot() {
        return this.root;
    }
}

module.exports = Fight;
