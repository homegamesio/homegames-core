const { ShapeUtils, Game, GameNode, Colors, Shapes, StateSignals } = require('squishjs');

const COLORS = Colors.COLORS;

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
        const baseColor = COLORS.RED;//randomColor();
        this.microphone = {};

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
            });

        this.button = new GameNode.Shape(
            COLORS.BLUE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(40, 40, 20, 20),
                fill: COLORS.BLUE
            },
            null, 
            () => {
            },
            null,
            null,
            {
                onHold: (player, x, y) => {
                    this.button.node.fill = COLORS.WHITE;
                    this.activateMic(player);
                },
                offHold: (player, x, y) => {
                    this.button.node.fill = COLORS.BLUE;
                    this.killMic(player);
                }
            }
        );

        this.stateSignal = new GameNode.State(StateSignals.STOP_RECORDING_AUDIO);

        this.base.addChild(this.stateSignal);
        this.base.addChild(this.button);
        this.currentAudioNode = null;
    }

    handleStream(player, data) {
        if (!this.microphone.player || player.id !== this.microphone.player.id) {
            return;
        }
        
        const playerIds = Object.keys(this.players);
        const filteredIds = playerIds.filter(x => Number(x) !== player.id);

        const ting = new GameNode.Audio(filteredIds, Object.values(data));
        if (this.currentAudioNode) {
            this.base.removeChild(this.currentAudioNode.node.id);
        }

        this.currentAudioNode = ting;

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
        if (key === ' ' && !this.microphone.player) {
            this.activateMic(player);
        }
    }

    handleKeyUp(player, key) {
        if (key === ' ' && this.microphone.player && this.microphone.player.id === player.id) {
            this.killMic(player);
        }
    }

    handlePlayerDisconnect() {
    }

    killMic(player) {
        this.microphone = {};
        this.base.clearChildren([this.stateSignal.node.id, this.button.node.id]);
        this.stateSignal.node.playerIds = [];
    }

    activateMic(player) {
        if (this.microphone.player && this.microphone.player.id === player.id) {
            return
        } else if (this.microphone.player && this.microphone.player.id !== player.id) {
            console.log('someone already has the mic');
        } else {
            this.microphone.player = player;
            
            const playerIds = Object.keys(this.players);
            const filteredIds = playerIds.filter(x => Number(x) !== player.id);
            this.stateSignal.node.playerIds = filteredIds;

            if (this.microphone.node) {
                this.base.removeChild(this.microphone.node.id);
            }
            
            this.microphone.node = new GameNode.State(StateSignals.START_RECORDING_AUDIO, [player.id]);
            
            this.stateSignal.node.playerIds = filteredIds;
            this.base.node.addChild(this.microphone.node);
            this.microphone.node.node.text = {
                text: player.name + ' has the mic',
                size: 4,
                align: 'center',
                color: Colors.COLORS.BLACK,
                x: 50,
                y: 65
            };
        }
    }

    getRoot() {
        return this.base;
    }
}

module.exports = WalkieTalkie;
