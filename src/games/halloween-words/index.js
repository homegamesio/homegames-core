const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-150');
const COLORS = Colors.COLORS;

const PLAYER_SPEED = 0.4;
const ITEM_SPEED = 0.2;

class HalloweenWords extends Game {
    static metadata() {
        return {
            // Catalog review: Unfinished candy prototype: scoring empties the bag before the spider penalty can matter.
            isTest: true,
            aspectRatio: {x: 1, y: 1},
            squishVersion: '150',
            author: "Joseph Garcia",
            thumbnail: "./assets/f70e1e9e2b5ab072764949a6390a8b96.png",
            tickRate: 60,
            // Reuse the keyboard handlers; no browser or Homepad code in games.
            gamepadBindings: {
                ArrowLeft: ['DIRECTION_LEFT', 'STICK_1_LEFT', 'STICK_2_LEFT'],
                ArrowRight: ['DIRECTION_RIGHT', 'STICK_1_RIGHT', 'STICK_2_RIGHT'],
            },
            assets: {
                'happy-halloween': new Asset({
                    path: "./assets/8c3675b51ce2c4efed73254c5c1cdffa.mp3",
                    'type': 'audio'
                }),
                'ahm-1': new Asset({path: "./assets/8e33b7e9ffa8e2fecb3b63d38e2ff637.mp3", 'type': 'audio'}),
                'ahm-2': new Asset({path: "./assets/d25dd461f3c36c30b9e9a258c1d97548.mp3", 'type': 'audio'}),
                'ahm-3': new Asset({path: "./assets/1bb365606c2b76eeedef1cb229d54410.mp3", 'type': 'audio'}),
                'ahm-4': new Asset({path: "./assets/e8e9e686b208f174995f610d58871b33.mp3", 'type': 'audio'}),
                'ahm-5': new Asset({path: "./assets/dbee142faedf01d6b7d867d326950066.mp3", 'type': 'audio'}),
                'hee-hee-hee': new Asset({path: "./assets/325cd046da0736ceb2651dea386a4d74.mp3", 'type': 'audio'}),
                'spider-1': new Asset({path: "./assets/358c543e37897c7d449c71b12374fd52.mp3", 'type': 'audio'}),
                'spider-2': new Asset({path: "./assets/abb537354e756666223f3f232d8f59bc.mp3", 'type': 'audio'}),
                'owl': new Asset({
                    path: "./assets/a6a47244be5da3730cae21ea96a1e92f.png",
                    'type': 'image'
                }),
                'spider': new Asset({
                    'type': 'image',
                    path: "./assets/e7df1707e47b1e73da9d95a7bc0b748e.png"
                }),
                'background': new Asset({
                    path: "./assets/92988fb1c107889e5f31a0ceccb5ecbf.png",
                    'type': 'image'
                }),
                'candy-corn': new Asset({
                    path: "./assets/73002c2d933a14ae74915ef31b79d99e.png",
                    'type': 'image'
                }),
                'apple': new Asset({
                    path: "./assets/e5c8eb3d8f10823374475452651af7c0.png",
                    'type': 'image'
                }),
                'chocolate': new Asset({
                    path: "./assets/132dffc5933569f3da3836e335212f56.png",
                    'type': 'image'
                }),
                'lollipop': new Asset({
                    path: "./assets/b60270feb83048685e4e21f7ceda26b7.png",
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

        if (!this.lastAudioRemovalCheck || this.lastAudioRemovalCheck < now - 100) {
            const newArr = [];
            for (let i = 0; i < this.audioToRemove.length; i++) {
                const cur = this.audioToRemove[i];
                if (cur.timestamp <= now) {
                    this.base.removeChild(this.audioToRemove[i].node.node.id);
                } else {
                    newArr.push(cur);
                }
            }

            this.audioToRemove = newArr;
        }


        this.stuffLayer.node.onStateChange();
    }

    constructor() {
        super();
        const baseColor = COLORS.BLACK;
        this.audioToRemove = [];
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
            coordinates2d: ShapeUtils.rectangle(42.5, 82.5, 15, 17.5),
            assetInfo: {
                'owl': {
                    'pos': {
                        x: 42.5, 
                        y: 82.5
                    },
                    'size': {
                        x: 15,
                        y: 17.5
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
        this.keysDown[key] = false;
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
            if (newX + 15 + dist <= 100) {
                newX += dist;
            } else {
                newX = 100 - 15;//player.size.x;
            }
        } 

        const newCoords = ShapeUtils.rectangle(newX, newY, 15, 17.5);

        player.node.coordinates2d = newCoords;
        player.node.asset = {'owl': {pos: {x: newX, y: newY}, size: {x: 15, y: 17.5 }}};

        this.base.node.onStateChange();
    }

    spawnItem() {
        const types = ['spider', 'chocolate', 'lollipop', 'candy-corn', 'apple'];
        const randVal = Math.floor(Math.random() * types.length);

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
        const options = ['spider-1', 'spider-2'];
        const randVal = Math.floor(Math.random() * options.length);
        const songNode = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: {
                [options[randVal]]: {
                    'pos': Object.assign({}, { x: 0, y: 0 }),
                    'size': Object.assign({}, { x: 0, y: 0 }),
                    'startTime': 0
                }
            }
        });
        this.base.addChild(songNode);
        this.audioToRemove.push({node: songNode, timestamp: Date.now() + 3000});

        this.currentBag = 0;
        this.renderMetaLayer();
    }

    handleNewPlayer() {
        const options = ['happy-halloween', 'hee-hee-hee'];
        const randVal = Math.floor(Math.random() * options.length);

        const songNode = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: {
                [options[randVal]]: {
                    'pos': Object.assign({}, { x: 0, y: 0 }),
                    'size': Object.assign({}, { x: 0, y: 0 }),
                    'startTime': 0
                }
            }
        });
        this.base.addChild(songNode);
        this.audioToRemove.push({node: songNode, timestamp: Date.now() + 3000});
    }

    addToBag() {
        this.currentBag++;

        //if (this.currentBag % 5 == 0) {
            this.grantPoint();
            this.currentBag = 0;
        //}

        this.renderMetaLayer();
    }

    grantPoint() {
        // todo: play "omnom" 
        const options = ['ahm-1', 'ahm-2', 'ahm-3', 'ahm-4', 'ahm-5'];
        const randVal = Math.floor(Math.random() * options.length);

        const songNode = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: {
                [options[randVal]]: {
                    'pos': Object.assign({}, { x: 0, y: 0 }),
                    'size': Object.assign({}, { x: 0, y: 0 }),
                    'startTime': 0
                }
            }
        });
        this.base.addChild(songNode);
        this.audioToRemove.push({node: songNode, timestamp: Date.now() + 1000});

        this.score++;
        this.renderMetaLayer();
    }

    renderMetaLayer() {
        this.metaLayer.clearChildren();
        const scoreValue = new GameNode.Text({
            textInfo: {
                x: 92.5,
                y: 5,
                align: 'center',
                size: 6,
                text: this.score + '',
                color: Colors.COLORS.ORANGE
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
