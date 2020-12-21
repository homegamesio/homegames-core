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
                    this.activateMic(player);
                },
                offHold: (player, x, y) => {
                    if (this.microphone.player && this.microphone.player.id === player.id) {
                        this.killMic(player);
                    }
                }
            }
        );

        this.base.addChild(this.button);
        this.currentAudioNode = null;

        this.resetMicText();
    }

    handleStream(player, data) {
        if (!this.microphone.player || player.id !== this.microphone.player.id) {
            return;
        }
        
        const playerIds = Object.keys(this.players);
        const filteredIds = playerIds.filter(x => Number(x) !== player.id);

        if (filteredIds.length === 0) {
            return;
        }

        const ting = new GameNode.Audio(filteredIds, Object.values(data));
        if (this.currentAudioNode) {
            this.base.removeChild(this.currentAudioNode.node.id);
        }

        this.currentAudioNode = ting;

        this.base.addChild(ting);
    }

    resetMicText() {
        if (this.micStateText) {
            this.base.removeChild(this.micStateText.node.id);
        }

        this.micStateText = new GameNode.Text({
            text: `Click (or tap) and hold to grab the mic`,
            x: 50,
            y: 75,
            align: 'center',
            size: 3,
            color: COLORS.WHITE
        });

        this.base.addChild(this.micStateText);
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
        this.button.node.fill = COLORS.BLUE;
        this.button.node.color = COLORS.BLUE;

        this.microphone.player = null;
        player.receiveStateMessage(StateSignals.STOP_RECORDING_AUDIO);
        this.resetMicText();
    }

    activateMic(player) {
        if (this.microphone.player && this.microphone.player.id === player.id) {
            return
        } else if (this.microphone.player && this.microphone.player.id !== player.id) {
        } else {
            this.button.node.fill = COLORS.WHITE;
            this.button.node.color = COLORS.WHITE;

            this.microphone.player = player;
            
            player.receiveStateMessage(StateSignals.START_RECORDING_AUDIO);

            if (this.micStateText) {
                this.base.removeChild(this.micStateText.node.id);
            }

            this.micStateText = new GameNode.Text({
                text: `${player.name} has the mic`,
                x: 50,
                y: 75,
                align: 'center',
                size: 3,
                color: COLORS.WHITE
            });

            this.base.addChild(this.micStateText);
            
//            this.microphone.node.node.text = {
//                text: player.name + ' has the mic',
//                size: 4,
//                align: 'center',
//                color: Colors.COLORS.BLACK,
//                x: 50,
//                y: 65
//            };
        }
    }

    getRoot() {
        return this.base;
    }
}

module.exports = WalkieTalkie;
