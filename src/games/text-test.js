const gameNode = require('../GameNode');
const { randomColor } = require('../Colors');

class TextTest {
    constructor() {
        this.baseText = 'Hello, World!';
        this.count = 0;
        this.base = gameNode(randomColor(), this.handleLayerClick.bind(this), 
            {'x': 0, 'y': 0}, {'x': 1, 'y': 1}, {'x': .5, 'y': .5, 'text': this.baseText});

    }

    handleLayerClick() {
        this.base.color = randomColor();
        this.base.text.text = this.baseText + ' ' + ++this.count;
        this.base.text = this.base.text;
    }

    getRoot() {
        return this.base;
    }
}

module.exports = TextTest;
