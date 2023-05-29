const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0766');

class GridDefense {
    constructor(playerId, initialState = {}) {
        const playerScores = {
            [playerId]: 0
        }
        
        this.state = initialState;
        this.spawnedEnemies = {};
        this.towerStates = {};
        this.shotPaths = {};

        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.BLACK,
            onClick: (playerId, x, y) => {
                this.createTower(playerId, 'dinker', x, y);
            }
        });

        this.mapPath = this.generateMapPath();

        this.root.addChild(this.mapPath);
        this.startRound();
    }

    createTower(playerId, type = 'dinker', x, y) {
        if (type === 'dinker') {
            const dinker = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(Math.floor(x), Math.floor(y), 1, 1),
                fill: Colors.COLORS.YELLOW,
                onClick: (playerId) => this.upgradeTower(playerId, dinker.node.id)
            });

            this.towerStates[dinker.node.id] = {
                node: dinker,
                shoot: (x, y) => {
                    const currentCoords = dinker.node.coordinates2d;
                    const curX = currentCoords[0][0];
                    const curY = currentCoords[0][1];
                    const xVel = curX === x ? 0 : (curX > x ? -1 : 1);//currentCoords[0][0]currentCoords[0][0] - x;
                    const yVel = curY === y ? 0 : (curY > y ? -1 : 1);//currentCoords[0][1] - y;
                    const shotPath = Physics.getPath(curX, curY, xVel, yVel, 100, 100);//xVel < 0 ? 0 : 100, yVel < 0 ? 0 : 100);

                    const shot = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(curX + .5, curY + .5, .25, .25),
                        fill: Colors.COLORS.CYAN
                    });

                    dinker.addChild(shot);

                    this.shotPaths[shot.node.id] = {
                        parentId: dinker.node.id,
                        path: shotPath,
                        node: shot,
                        curIndex: 0
                    }

                    this.towerStates[dinker.node.id].cooldown = setTimeout(() => {
                        this.towerStates[dinker.node.id].cooldown = null;
                    }, 1000);
                },
                rate: 1,
                power: 1,
                range: 1,
                playerId
            };
            
            this.root.addChild(dinker);
        }
    }

    upgradeTower(playerId, nodeId) {
    }

    startRound() {
        const enemy = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 50, 1, 1),
            fill: Colors.COLORS.PINK
        });
        
        this.tickCount = 0;
        this.root.addChild(enemy);

        this.spawnedEnemies[enemy.node.id] = enemy;
        this.shouldMoveEnemies = true;
    }

    generateMapPath() {
        // todo: actually generate this
        const pathPoints = [];
        
        let topNode = null;
        let lastNode = null;

        for (let i = 0; i < 100; i++) {
            const newNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(i, 50, 1, 1),
                fill: Colors.COLORS.GREEN
            });
            
            if (!topNode) {
                topNode = newNode;
            }

            if (lastNode) {
                lastNode.addChild(newNode);
            }

            lastNode = newNode;
        }

        return topNode;
    }

    tick() {
        this.tickCount++;
        if (this.tickCount % 5 == 0) {
            this.shouldMoveEnemies = true;
        }

        if (this.shouldMoveEnemies) {
            this.shouldMoveEnemies = false;
            this.moveEnemies();
        }

        const shotsToDelete = new Set();
        for (let key in this.shotPaths) {
            const { node, curIndex, path } = this.shotPaths[key];
            if (curIndex >= path.length) {
                shotsToDelete.add(key);
                continue;
            }
            const newCoords = ShapeUtils.rectangle(path[curIndex][0], path[curIndex][1], .25, .25);
            node.node.coordinates2d = newCoords;
            this.shotPaths[key].curIndex = curIndex + 1;
        }

        for (let key of shotsToDelete) {
            const parentNode = this.towerStates[this.shotPaths[key].parentId];
            if (parentNode) {
                parentNode.node.removeChild(key);
            }
            delete this.shotPaths[key];
        }

        for (let key in this.towerStates) {
            const info = this.towerStates[key];
            const towerCoords = this.towerStates[key].node.node.coordinates2d;
            // todo: optimize
            for (let enemyKey in this.spawnedEnemies) {
                const enemyCoords = this.spawnedEnemies[enemyKey].node.coordinates2d;
                if (Math.abs(towerCoords[0][0] - enemyCoords[0][0]) <= info.range &&
                    Math.abs(towerCoords[0][1] - enemyCoords[0][1]) <= info.range) {
                        if (!this.towerStates[key].cooldown) {
                            this.towerStates[key].shoot(enemyCoords[0][0], enemyCoords[0][1]);
                        }
                    }
            }
        }
    }

    moveEnemies() {
        for (let k in this.spawnedEnemies) {
            const oldCoords = this.spawnedEnemies[k].node.coordinates2d;
            const curX = oldCoords[0][0];
            const curY = oldCoords[0][1];
            const newCoords = ShapeUtils.rectangle(curX + .1, curY, 1, 1);
            this.spawnedEnemies[k].node.coordinates2d = newCoords;
        }
    }

    getRoot() {
        return this.root;
    }
}

module.exports = GridDefense;
