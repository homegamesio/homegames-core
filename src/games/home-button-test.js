const { GameNode, Colors } = require('squishjs');
const Game = require('./Game');
const { COLORS: BLUE } = Colors;

class HomeButtonTest extends Game {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: 'Joseph Garcia',
            name: 'Home Button Test'
        };
    }

    constructor() {
        super();
        this.base = GameNode(BLUE, (player) => {
            player.receiveUpdate([5, 70, 0]);
        }, {'x': 0, 'y': 0}, {'x': 100, 'y': 100}, {'text': 'ayy lmao', x: 50, y: 5});
    }

    handleNewPlayer(player) {
        const textCopy = this.base.text;
        textCopy.text = player.name;
        this.base.text = textCopy;
    }

    handlePlayerDisconnect() {
    }

    getRoot() {
        return this.base;
    }

}

module.exports = HomeButtonTest;
