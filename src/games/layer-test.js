const gameNode = require('../GameNode');
const { randomColor } = require('../Colors');

class LayerTest {
    constructor() {
        this.base = gameNode(randomColor(), this.handleLayerClick, 
            {'x': 0, 'y': 0}, {'x': 100, 'y': 100});

        const increment = 1;
        let prev = this.base;
        for (let i = increment; i < 50; i+= 2 * increment) {
            const child = gameNode(randomColor(), this.handleLayerClick,
                {'x': i, 'y': i}, {'x': 100 - (2 * i), 'y': 100 - (2 * i)});
            prev.addChild(child);
            prev = child;
        }
    }

    handleNewPlayer(player) {
    }

    handlePlayerDisconnect(player) {
    }

    handleLayerClick() {
        this.color = randomColor();
    }

    getRoot() {
        return this.base;
    }
}

module.exports = LayerTest;
