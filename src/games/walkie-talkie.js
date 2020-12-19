const { Game, GameNode, Colors, Shapes, StateSignals } = require('squishjs');

class WalkieTalkie extends Game {
    static metadata() {
        return {
            aspectRatio: {
                x: 3,
                y: 3
            },
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/layer-test.png'
        };
    }

    constructor() {
        super();
        const baseColor = Colors.COLORS.RED;//randomColor();
        this.microphone = {

        };

        this.base = new GameNode.Shape(
            baseColor,
            Shapes.POLYGON,
            {
                coordinates2d: [
                    [0, 0],
                    [100, 0],
                    [100, 100],
                    [0, 100],
                    [0, 0]
                ],
                fill: baseColor
            },
            null);//,
//            this.activateMic.bind(this));

    }

    handleStream(player, data) {
        const ting = new GameNode.Audio(null, Object.values(data));
        this.base.clearChildren();
        this.base.addChild(ting);
    }

    handleNewPlayer() {
//        const fs = require('fs');
//        fs.readFile('/Users/josephgarcia/test.mp3', (err, data) => {
//            console.log("hello");
//            console.log(err);
//            console.log(data[0]);
//            console.log(data.length);
//            const thing = new Uint8Array(data);
//            console.log(thing.length);
//
//            this.speaker = new GameNode.Audio(
//                null,
//                thing
//            );
//
//            console.log(this.speaker);
//
//            this.base.addChild(this.speaker);
//        });
    }

    handleKeyDown(player, key) {
        if (key === ' ') {
            this.activateMic(player);
        }
    }

    handleKeyUp(player, key) {
        if (key === ' ') {
            if (this.microphone.player && this.microphone.player.id === player.id) {
                this.microphone.player = null;
                this.base.node.text = null;
            }
        }
    }

    handlePlayerDisconnect() {
    }

    activateMic(player) {
        if (this.microphone.player && this.microphone.player.id === player.id) {
            return
        } else if (this.microphone.player && this.microphone.player.id !== player.id) {
            console.log('someone already has the mic');
        } else {
            this.microphone.player = player;
            const stateSignal = new GameNode.State(StateSignals.START_RECORDING_AUDIO, [player.id]);
            this.base.node.addChild(stateSignal);
            this.base.node.text = {
                text: 'Player ' + player.id + ' has the mic',
                size: 3,
                align: 'center',
                color: Colors.COLORS.BLACK,
                x: 50,
                y: 50
            };
        }
    }

    getRoot() {
        return this.base;
    }
}

module.exports = WalkieTalkie;
