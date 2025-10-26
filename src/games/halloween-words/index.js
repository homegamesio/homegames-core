const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-136');
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
            tickRate: 60
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
        this.spawnedItems = {};
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: baseColor
        });

        this.stuffLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [0, 0, 0, 255]
        });

        this.metaLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [0, 0, 0, 0]
        });

        this.base.addChildren(this.stuffLayer, this.metaLayer);

        this.keysDown = {};

        const moverColor = COLORS.BLUE;

        this.mover = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(45, 90, 10, 10),
            fill: moverColor
        });
        
        this.base.addChild(this.mover);
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

        this.base.node.onStateChange();
    }

    spawnItem() {
        const types = ['spider', 'chocolate', 'lollipop', 'candy corn'];
        const randVal = Math.floor(Math.random() * types.length);
        let color = [0, 255, 0, 255];
        if (types[randVal] === 'spider') {
            color = [255, 0, 0, 255];
        }

        const randX = Math.floor(Math.random() * 95); // 100 - width (5)
        const item = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(randX, 0, 5, 5),
            fill: color 
        });
        
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

    }

    addToBag() {
        if (!this.bagCount) {
            this.bagCount = 0;
        }

        this.bagCount++;

        if (this.bagCount >= 0) {
            this.grantPoint();
            this.bagCount = 0;
        }

        this.renderMetaLayer();
    }

    grantPoint() {
        console.log('hdhhdhdd score ' + this.score);
        this.score++;
        this.renderMetaLayer();
    }

    renderMetaLayer() {
        console.log('what is score' + this.score);
        this.metaLayer.clearChildren();
        const scoreValue = new GameNode.Text({
            textInfo: {
                x: 90,
                y: 15,
                align: 'center',
                size: 3,
                text: this.score + '',
                color: Colors.COLORS.WHITE
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
