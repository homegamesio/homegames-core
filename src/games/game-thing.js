const { GameNode, Colors } = require('squishjs');
const Asset = require('../common/Asset');
const Game = require('./Game');

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

        }, {'x': 0, 'y': 0}, {'x': 100, 'y': 100}, {'text': 'ayy lmao', x: 50, y: 5});
        
        this.misterSticksFrames = {
            'initial': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/test1.png',
            'kickin': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/test2.png'
        };
        
        this.assets = {
            'mister_sticks_initial': new Asset('url', {
                'location': this.misterSticksFrames['initial'],
                'type': 'image'
            }),
            'mister_sticks_kickin': new Asset('url', {
                'location': this.misterSticksFrames['kickin'],
                'type': 'image'
            })
        };


        this.misterSticks = GameNode(null, (player) => {
            console.log("i'm mister sticks");
        }, {x: 40, y: 40}, {x: 10, y: 10}, null, {'mister_sticks_initial': {pos: {x: 40, y: 40}, size: {x: 15, y: 15}}});
        console.log(this.misterSticks);
        this.base.addChild(this.misterSticks);
    }

    handleNewPlayer(player) {
    }

    handlePlayerDisconnect() {
    }

    handleKeyUp(player, key) {
        const newAsset = {
            'mister_sticks_initial': {
                pos: {
                    x: 40, 
                    y: 40
                },
                size: {
                    x: 15, 
                    y: 15
                }
            }
        };
        this.misterSticks.asset = newAsset;
    }

    handleKeyDown(player, key) {
        const newAsset = {
            'mister_sticks_kickin': {
                pos: {
                    x: 40, 
                    y: 40
                },
                size: {
                    x: 15, 
                    y: 15
                }
            }
        };
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
