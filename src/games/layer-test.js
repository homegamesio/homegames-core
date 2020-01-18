const { Colors, GameNode } = require('squishjs');
const Game = require('./Game');

class LayerTest extends Game {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        this.base = GameNode(Colors.randomColor(), this.handleLayerClick, 
            {'x': 0, 'y': 0}, {'x': 100, 'y': 100});

        const increment = 1;
        let prev = this.base;
        for (let i = increment; i < 50; i+= 2 * increment) {
            const child = GameNode(Colors.randomColor(), this.handleLayerClick,
                {'x': i, 'y': i}, {'x': 100 - (2 * i), 'y': 100 - (2 * i)});
            prev.addChild(child);
            prev = child;
        }
    }

    handleNewPlayer() {
    }

    handlePlayerDisconnect() {
    }

    handleLayerClick() {
        this.color = Colors.randomColor();
    }

    getRoot() {
        return this.base;
    }
}

module.exports = LayerTest;
