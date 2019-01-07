const gameNode = require('../GameNode');
const { randomColor } = require('../Colors');

class LayerTest {
    constructor() {
        this.base = gameNode(randomColor(), this.handleLayerClick, 
            {'x': 0, 'y': 0}, {'x': 1, 'y': 1});

        const increment = .01;
        let prev = this.base;
        for (let i = increment; i < .5; i+= 2 * increment) {
            const child = gameNode(randomColor(), this.handleLayerClick,
                {'x': i, 'y': i}, {'x': 1 - (2 * i), 'y': 1 - (2 * i)});
            prev.addChild(child);
            prev = child;
        }
    }

    handleLayerClick() {
        this.color = randomColor();
    }

    getRoot() {
        return this.base;
    }
}

module.exports = LayerTest;
