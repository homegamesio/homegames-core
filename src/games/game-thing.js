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
        this.base = GameNode(Colors.BLUE, (player) => {

        }, {'x': 0, 'y': 0}, {'x': 100, 'y': 100});
        
        this.misterSticksFrames = {
            idleLeft: 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/test1.png',
            kickRight: 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/test2.png'
        };

        this.npcFrames = {
            walker: 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/walkerthing.png'
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

        }, {x: 5, y: 5}, {x: 10, y: 10}, null, {walker: {pos: {x: 5, y: 5}, size: {x: 10, y: 10}}});
        this.base.addChild(this.walkerGuy);
        this.base.addChild(this.misterSticks);
    }

    tick() {
        const guyCollisions = checkCollisions(this.base, this.misterSticks, (node) => node.id !== this.misterSticks.id && node.id !== this.base.id);
        if (guyCollisions.length > 0) {
            if (this.misterSticks.isKickin) {
                const currentWalkerAsset = Object.values(this.walkerGuy.asset)[0];
                const newPos = this.walkerGuy.pos;
                
                currentWalkerAsset.pos.x = (currentWalkerAsset.pos.x + 40) % 100;
                newPos.x = (newPos.x + 40) % 100;

                this.walkerGuy.pos = newPos;
//                this.walkerGuy.asset = currentWalkerAsset;
            } else {
                Object.values(this.misterSticks.asset)[0].pos = {
                    x: 40,
                    y: 40
                };
                this.misterSticks.pos = {x: 40, y: 40};
            }
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
            moveDis = .1;
        } else if (key == 'w' || key == 'ArrowUp') {
            moveDir = 'y';
            moveDis = -.1;
        } else if (key == 'a' || key == 'ArrowLeft') {
            moveDir = 'x';
            moveDis = -.1;
        } else if (key == 's' || key == 'ArrowDown') {
            moveDir = 'y';
            moveDis = .1;
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
