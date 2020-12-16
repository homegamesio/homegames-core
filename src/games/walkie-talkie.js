const { Game, GameNode, Colors, Shapes } = require('squishjs');

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

    handleNewPlayer() {
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
