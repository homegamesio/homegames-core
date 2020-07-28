const { GameNode, Colors } = require('squishjs');
const Game = require('./Game');
const { COLORS: { WHITE }, randomColor } = Colors;

class PerfTest extends Game {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        this.base = GameNode(WHITE, (player) => {
        }, {'x': 0, 'y': 0}, {'x': 100, 'y': 100});

        let xCounter = 0;
        let yCounter = 0;

        this.filler = setInterval(() => {
            const dot = GameNode(randomColor(), null, {x: xCounter, y: yCounter}, {x: 1, y: 1});
            this.base.addChild(dot);
            xCounter += 1;
            if (xCounter >= 100) {
                xCounter = 0;
                yCounter++;
            }

            if (yCounter == 100 && xCounter == 100) {
                clearInterval(this.filler);
            }

        }, 14);
    }

    getRoot() {
        return this.base;
    }

    close() {
        clearInterval(this.filler);
    }

}

module.exports = PerfTest;
