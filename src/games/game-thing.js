const { GameNode, Colors } = require('squishjs');
const Asset = require('../common/Asset');
const Game = require('./Game');
const { checkCollisions } = require('../common/util');

class GameThing extends Game {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: 'Joseph Garcia',
            name: 'Game Thing'
        };
    }

    constructor() {
        super();
        this.base1 = GameNode(Colors.BLUE, (player, x, y) => {
            x *= 100;
            y *= 100;
            const newThing = GameNode(Colors.BLUE, (player) => {
                console.log('activate super');
            }, {x, y}, {x: 10, y: 10}, null, {triangle: {pos: {x, y}, size: {x: 10, y: 10}}});
            this.base1.addChild(newThing);
        }, {'x': 0, 'y': 0}, {'x': 100, 'y': 100});

        const getListHelper = (node, stuff) => {
            stuff.push(node);
            for (let childIndex in node.children) {
                getListHelper(node.children[childIndex], stuff);
            }
        };

        const getList = () => {
            let stuff = [];
            getListHelper(this.base1, stuff);
            return stuff;
        };

        for (let i = 0; i < 5; i++) {
            const list = getList();
            const baseRoomIndex = Math.floor(Math.random() * list.length);

            const room = GameNode(Colors.randomColor(), (player, x, y) => {
                console.log('clicked');
            }, {x: 0, y: 0}, {x: 100, y: 100}, null);
            console.log(list[baseRoomIndex])
            list[baseRoomIndex].addChild(room);

            const directions = [['left', 'right'], ['right', 'left'], ['top', 'bottom'], ['bottom', 'top']];
            const baseDirIndex = Math.floor(Math.random() * directions.length);
            const dir = directions[baseDirIndex];
            list[baseRoomIndex][dir[0]] = room;
            room[dir[1]] = list[baseRoomIndex];
        }

//        this.map = {
//            [this.base1.id]: {
//                left: GameNode(Colors.randomColor(), null, {x: 0, y: 0}, {x: 100, y: 100}),
//                right: 'idk right',
//                up: 'idk up',
//                down: 'idk down',
//            }
//        };

        this.base2 = GameNode(Colors.GREEN, (player, x, y) => {
            x *= 100;
            y *= 100;
            const newThing = GameNode(Colors.BLUE, (player) => {
                console.log('activate super');
            }, {x, y}, {x: 10, y: 10}, null, {square: {pos: {x, y}, size: {x: 10, y: 10}}});
            this.base2.addChild(newThing);
        }, {'x': 0, 'y': 0}, {'x': 100, 'y': 100});
 
        this.misterSticksFrames = {
            idleLeft: 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/test1.png',
            kickRight: 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/test2.png'
        };

        this.npcFrames = {
            walker: 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/walkerthing.png',
            square: 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/square.png',
            triangle: 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/triangle.png',
            hexagon: 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/hexagon.png'
        };
        
        const allAssets = Object.assign(this.misterSticksFrames, this.npcFrames);
        this.assets = {};
        for (let key in allAssets) {
            this.assets[key] = new Asset('url', {
                'location': allAssets[key],
                'type': 'image'
            });
        }

        this.misterSticks = GameNode(null, (player) => {
        }, {x: 40, y: 40}, {x: 10, y: 10}, null, {idleLeft: {pos: {x: 40, y: 40}, size: {x: 15, y: 15}}});

        this.walkerGuy = GameNode(null, (player) => {

        }, {x: 5, y: 5}, {x: 10, y: 10}, null, {hexagon: {pos: {x: 5, y: 5}, size: {x: 10, y: 10}}});
        this.base1.addChild(this.walkerGuy);
        this.base1.addChild(this.misterSticks);
        this.base = this.base1;
    }

    tick() {
        const guyCollisions = checkCollisions(this.base, this.misterSticks, (node) => node.id !== this.misterSticks.id && node.id !== this.base.id);
        let posX = this.misterSticks.pos.x;
        let posY = this.misterSticks.pos.y;
        if (posX <= 0 || posX >= 100 || posY <= 0 || posY >= 100) {
            if (posX <= 0 && this.base.left) {
                this.base = this.base.left;
                this.base.addChild(this.misterSticks);
                this.misterSticks.pos = {x: 50, y: 50};
                const assetCopy = this.misterSticks.asset;
                Object.values(assetCopy)[0].pos.x = 50;
                Object.values(assetCopy)[0].pos.y = 50;
                this.misterSticks.asset = assetCopy;
            }
            else if (posX >= 100 && this.base.right) {
                this.base = this.base.right;
                this.base.addChild(this.misterSticks);
                this.misterSticks.pos = {x: 50, y: 50};
                const assetCopy = this.misterSticks.asset;
                Object.values(assetCopy)[0].pos.x = 50;
                Object.values(assetCopy)[0].pos.y = 50;
                this.misterSticks.asset = assetCopy;
            }

            else if (posY <= 0 && this.base.top) {
                this.base = this.base.top;
                this.base.addChild(this.misterSticks);
                this.misterSticks.pos = {x: 50, y: 50};
                const assetCopy = this.misterSticks.asset;
                Object.values(assetCopy)[0].pos.x = 50;
                Object.values(assetCopy)[0].pos.y = 50;
                this.misterSticks.asset = assetCopy;
            }
            else if (posY >= 100 && this.base.bottom) {
                this.base = this.base.bottom;
                this.base.addChild(this.misterSticks);
                this.misterSticks.pos = {x: 50, y: 50};
                const assetCopy = this.misterSticks.asset;
                Object.values(assetCopy)[0].pos.x = 50;
                Object.values(assetCopy)[0].pos.y = 50;
                this.misterSticks.asset = assetCopy;
            }
        }

//        console.log(this.misterSticks.pos.x);
//        console.log(this.misterSticks.pos.y);
        if (guyCollisions.length > 0) {
            if (this.misterSticks.isKickin) {
                for (let nodeIndex in guyCollisions) {
                    const node = guyCollisions[nodeIndex];
                    this.base.removeChild(node.id);
                }
//                this.base = this.base2;
            } else {
                Object.values(this.misterSticks.asset)[0].pos = {
                    x: 40,
                    y: 40
                };
                this.misterSticks.pos = {x: 40, y: 40};
            }
        }

        const walkerVelocity = .2;
        const xDiff = this.misterSticks.pos.x - this.walkerGuy.pos.x;
        const yDiff = this.misterSticks.pos.y - this.walkerGuy.pos.y;

        // player to the right
        if (xDiff > 0) {
            const newPos = this.walkerGuy.pos;
            newPos.x += walkerVelocity;
            const newAsset = this.walkerGuy.asset;
            Object.values(newAsset)[0].pos.x += walkerVelocity;
            this.walkerGuy.pos = newPos;
            this.walkerGuy.asset = newAsset;
        } else {
            const newPos = this.walkerGuy.pos;
            newPos.x -= walkerVelocity;
            const newAsset = this.walkerGuy.asset;
            Object.values(newAsset)[0].pos.x -= walkerVelocity;
            this.walkerGuy.pos = newPos;
            this.walkerGuy.asset = newAsset;
        }

        // player below
        if (yDiff > 0) {
            const newPos = this.walkerGuy.pos;
            newPos.y += walkerVelocity;
            const newAsset = this.walkerGuy.asset;
            Object.values(newAsset)[0].pos.y += walkerVelocity;
            this.walkerGuy.pos = newPos;
            this.walkerGuy.asset = newAsset;
        } else {
            const newPos = this.walkerGuy.pos;
            newPos.y -= walkerVelocity;
            const newAsset = this.walkerGuy.asset;
            Object.values(newAsset)[0].pos.y -= walkerVelocity;
            this.walkerGuy.pos = newPos;
            this.walkerGuy.asset = newAsset;
        }
    }

    handleNewPlayer(player) {
    }

    handlePlayerDisconnect() {
    }

    handleKeyUp(player, key) {
        if (key === ' ') {
            const currentAsset = Object.values(this.misterSticks.asset)[0];
            const newAsset = {
                idleLeft: {
                    pos: currentAsset.pos,
                    size: currentAsset.size
                }
            };
            this.misterSticks.isKickin = false;
            this.misterSticks.asset = newAsset;
        }
    }

    handleKeyDown(player, key) {
        let moveDir;
        let moveDis;

        if (key == 'd' || key == 'ArrowRight') {
            moveDir = 'x';
            moveDis = .5;
        } else if (key == 'w' || key == 'ArrowUp') {
            moveDir = 'y';
            moveDis = -.5;
        } else if (key == 'a' || key == 'ArrowLeft') {
            moveDir = 'x';
            moveDis = -.5;
        } else if (key == 's' || key == 'ArrowDown') {
            moveDir = 'y';
            moveDis = .5;
        } else if (key == ' ') {
            const currentAsset = Object.values(this.misterSticks.asset)[0];
            const newAsset = {
                kickRight: {
                    pos: currentAsset.pos,
                    size: currentAsset.size
                }
            };
            this.misterSticks.isKickin = true;
            this.misterSticks.asset = newAsset;
            return;
        } else {
            return;
        }

        let newPos = this.misterSticks.pos;
        newPos[moveDir] += moveDis;
        let newAsset = this.misterSticks.asset;
        Object.values(newAsset)[0].pos[moveDir] += moveDis;

        this.misterSticks.pos = newPos;
        this.misterSticks.asset = newAsset;
    }

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }

}

module.exports = GameThing;
