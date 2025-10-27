const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-136');
const COLORS = Colors.COLORS;

const PLAYER_SPEED = 0.3;
const ITEM_SPEED = 0.2;

class HalloweenWords extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 1, y: 1},
            squishVersion: '136',
            author: 'Joseph Garcia',
            thumbnail: 'f70e1e9e2b5ab072764949a6390a8b96',
            isTest: false,
            tickRate: 60,
            assets: {
                'owl': new Asset({
                    'id': 'a6a47244be5da3730cae21ea96a1e92f',
                    'type': 'image'
                }),
                'spider': new Asset({
                    'type': 'image',
                    'id': 'e7df1707e47b1e73da9d95a7bc0b748e'
                }),
                'background': new Asset({
                    'id': '92988fb1c107889e5f31a0ceccb5ecbf',
                    'type': 'image'
                }),
                'candy-corn': new Asset({
                    'id': '73002c2d933a14ae74915ef31b79d99e',
                    'type': 'image'
                }),
                'apple': new Asset({
                    'id': 'e5c8eb3d8f10823374475452651af7c0',
                    'type': 'image'
                }),
                'chocolate': new Asset({
                    'id': '132dffc5933569f3da3836e335212f56',
                    'type': 'image'
                }),
                'lollipop': new Asset({
                    'id': 'b60270feb83048685e4e21f7ceda26b7',
                    'type': 'image'
                })
            }
        };
    }

    tick() {
        const now = Date.now();
        if (!this.lastSpawnedItem || !this.lastSpawnTime || this.lastSpawnTime < now - 2500) {
            this.lastSpawnedItem = this.spawnItem();
            this.lastSpawnTime = now;
            this.stuffLayer.addChild(this.lastSpawnedItem);
        } 

        for (let childIndex in this.stuffLayer.node.children) {
            const child = this.stuffLayer.node.children[childIndex];
            const curX = child.node.coordinates2d[0][0];
            const curY = child.node.coordinates2d[0][1];
            const newY = curY + ITEM_SPEED;
            const newCoords = ShapeUtils.rectangle(curX, newY, 5, 5);

            if (newY >= 95) {
                this.stuffLayer.removeChild(child.node.id);
                delete this.spawnedItems[child.node.id];
            }
            child.node.coordinates2d = newCoords;
            const newAssetInfo = Object.assign({}, child.node.asset);
            newAssetInfo[Object.keys(newAssetInfo)[0]].pos = {x: curX , y: newY};
            child.node.asset = newAssetInfo;// {'owl': {pos: {x: newX, y: newY}, size: {x: 10, y: 10}}};
        }

        if (!this.lastCollisionCheck || this.lastCollisionCheck < now - 100) {

            const mover = this.mover;
            const moverX = mover.node.coordinates2d[0][0];
            const moverY = mover.node.coordinates2d[0][1];
    
            const wouldBeCollisions = GeometryUtils.checkCollisions(this.stuffLayer, {node: {coordinates2d: ShapeUtils.rectangle(moverX, moverY, 10, 10)}}, (node) => {
                return node.node.id !== this.stuffLayer.node.id && node.node.id !== mover.node.id;
            });

            if (wouldBeCollisions.length > 0) {
                for (const collisionIndex in wouldBeCollisions) {
                    const collision = wouldBeCollisions[collisionIndex];
                    if (this.spawnedItems[collision.node.id]) {
                        this.spawnedItems[collision.node.id].onCollide();
                        this.stuffLayer.removeChild(collision.node.id);
                        delete this.spawnedItems[collision.node.id];
                    }
                }
            }

        }


        this.stuffLayer.node.onStateChange();
    }

    constructor() {
        super();
        const baseColor = COLORS.BLACK;
        this.score = 0;
        this.currentBag = 0;
        this.spawnedItems = {};
        //this.base = new GameNode.Shape({
        //    shapeType: Shapes.POLYGON,
        //    coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
        //    fill: baseColor
        //});

        //const backgroundImage = new GameNode.Asset({
        this.base = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            assetInfo: {
                'background': {
                    'pos': {
                        x: 0, 
                        y: 0
                    },
                    'size': {
                        x: 100,
                        y: 100
                    }
                }
            }
        });

        this.stuffLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [0, 0, 0, 0]
        });

        this.metaLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [0, 0, 0, 0]
        });

        this.base.addChildren(this.stuffLayer, this.metaLayer);

        this.keysDown = {};

        const moverColor = COLORS.BLUE;

//        this.mover = new GameNode.Shape({
//            shapeType: Shapes.POLYGON,
//            coordinates2d: ShapeUtils.rectangle(45, 90, 10, 10),
//            fill: moverColor
//        });
//        
//        this.base.addChild(this.mover);
        const owl = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(45, 90, 10, 10),
            assetInfo: {
                'owl': {
                    'pos': {
                        x: 45, 
                        y: 90
                    },
                    'size': {
                        x: 10,
                        y: 10
                    }
                }
            }
        });
        this.base.addChild(owl);
        this.mover = owl;
//        this.base.addChild(backgroundImage)

        this.renderMetaLayer();
    }

    handleKeyUp(player, key) {
        this.keysDown[key] = true;
    }

    handleGamepadInput(playerId, gamepadInput) {
        const stick1X = gamepadInput.input.sticks.STICK_1_X.value;
        const stick2X = gamepadInput.input.sticks.STICK_2_X.value;

        const stick1Y = gamepadInput.input.sticks.STICK_1_Y.value;
        const stick2Y = gamepadInput.input.sticks.STICK_2_Y.value;


        if (stick1X < 0) {
            this.movePlayer(this.mover, 'left', PLAYER_SPEED);
        } else if (stick1X > 0) {
            this.movePlayer(this.mover, 'right', PLAYER_SPEED);
        }

        if (stick2X < 0) {
            this.movePlayer(this.mover, 'left', PLAYER_SPEED);
        } else if (stick2X > 0) {
            this.movePlayer(this.mover, 'right', PLAYER_SPEED);
        }
    }

    movePlayer(player, dir, dist = .1) {
        let newX = player.node.coordinates2d[0][0];
        let newY = player.node.coordinates2d[0][1];

        if (dir === 'left') {
            if (newX - dist < 0) {
                newX = 0;
            } else {
                newX -= dist;
            }
        } 

        if (dir === 'right') {
            if (newX + 10 + dist <= 100) {
                newX += dist;
            } else {
                newX = 100 - 10;//player.size.x;
            }
        } 

        const newCoords = ShapeUtils.rectangle(newX, newY, 10, 10);

        player.node.coordinates2d = newCoords;
        player.node.asset = {'owl': {pos: {x: newX, y: newY}, size: {x: 10, y: 10}}};

        this.base.node.onStateChange();
    }

    spawnItem() {
        const types = ['spider', 'chocolate', 'lollipop', 'candy-corn', 'apple'];
        const randVal = Math.floor(Math.random() * types.length);
        let color = [0, 255, 0, 255];
        if (types[randVal] === 'spider') {
            color = [255, 0, 0, 255];
        }

        const randX = Math.floor(Math.random() * 95); // 100 - width (5)
        const item = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(randX, 0, 5, 5),
            assetInfo: {
                [types[randVal]]: {
                    'pos': {
                        x: randX, 
                        y: 0
                    },
                    'size': {
                        x: 5,
                        y: 5
                    }
                }
            }
        });
 
        //new GameNode.Shape({
        //    shapeType: Shapes.POLYGON,
        //    coordinates2d: ShapeUtils.rectangle(randX, 0, 5, 5),
        //    fill: color 
        //});
        
//        this.stuffLayer.addChild(item); 

        this.spawnedItems[item.node.id] = {type: types[randVal], onCollide: () => {
            if (types[randVal] == 'spider') {
                this.dropBag();
            } else {
                this.addToBag();
            }
        }, node: item};

        return item;
    }

    dropBag() {
        // todo: play "spider" sound
        this.currentBag = 0;
        this.renderMetaLayer();
    }

    handleNewPlayer() {
        // todo: play "happy halloween"
    }

    addToBag() {
        this.currentBag++;

        if (this.currentBag % 5 == 0) {
            this.grantPoint();
            this.currentBag = 0;
        }

        this.renderMetaLayer();
    }

    grantPoint() {
        // todo: play "omnom" 
        this.score++;
        this.renderMetaLayer();
    }

    renderMetaLayer() {
        this.metaLayer.clearChildren();
        const scoreValue = new GameNode.Text({
            textInfo: {
                x: 92.5,
                y: 7.5,
                align: 'center',
                size: 5,
                text: this.score + '',
                color: Colors.COLORS.BLACK
            }
        });

        this.metaLayer.addChildren(scoreValue);
    }

    handleKeyDown(player, key) {
        this.keysDown[key] = true;

        if (key == 'ArrowLeft') {
            this.movePlayer(this.mover, 'left', PLAYER_SPEED);
        }

        if (key == 'ArrowRight') {
            this.movePlayer(this.mover, 'right', PLAYER_SPEED);
        }

        if (key == 'a') {
            this.movePlayer(this.mover, 'left', PLAYER_SPEED);
        }

        if (key == 'd') {
            this.movePlayer(this.mover, 'right', PLAYER_SPEED);
        }
    }

    getLayers() {
        return [{root: this.base}];
    }
}

module.exports = HalloweenWords;
