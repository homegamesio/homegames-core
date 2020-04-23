const Asset = require('../common/Asset');
const { Game, GameNode, Colors } = require('squishjs');

class Jukebox extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        this.assets = {
            clickSound: new Asset('url', {
//                location: 'https://file-examples.com/wp-content/uploads/2017/11/file_example_MP3_700KB.mp3',
                //'location': 'http://www.hyperion-records.co.uk/audiotest/18%20MacCunn%20The%20Lay%20of%20the%20Last%20Minstrel%20-%20Part%202%20Final%20chorus%20O%20Caledonia!%20stern%20and%20wild.MP3',
                location: 'http://www.noiseaddicts.com/samples_1w72b820/3740.mp3',
                //'https://file-examples.com/wp-content/uploads/2017/11/file_example_MP3_700KB.mp3',
                //'https://file-examples.com/wp-content/uploads/2017/11/file_example_MP3_5MG.mp3',
                ////'http://www.noiseaddicts.com/samples_1w72b820/3740.mp3',
                'type': 'audio'
            })
        };
        this.base = GameNode(Colors.BLUE, () => {
            const soundThing = GameNode(Colors.BLUE, null, {x: 0, y: 0}, {x: 0, y: 0}, null, {clickSound: {
                size: {x: 0, y: 0},
                pos: {x: 0, y: 0}}});
            this.base.addChild(soundThing);
            setTimeout(() => {
                this.base.removeChild(soundThing.id);
            }, 500);
            console.log('iuj');
        }, {x: 0, y: 0}, {x: 100, y: 100});
    }

    getAssets() {
        return this.assets;
    }

    getRoot() {
        return this.base;
    }
}

module.exports = Jukebox;
