const gameNode = require('../GameNode');
const { colors, randomColor } = require('../Colors');

class LayerTest {
    constructor() {
        this.base = gameNode(randomColor(), this.handleLayerClick, 
            {'x': 50, 'y': 0}, {'x': 50, 'y': 50});

        const increment = 1;
        let prev = this.base;
        const self = this;
        for (let x = this.base.pos.x + increment; x < this.base.pos.x * 1.5; x+= increment) {
            const child = gameNode(randomColor(), function() {
                this.color = randomColor();
                self.parent.addClick();
            }, {'x': x, 'y': x - 50}, {'x': 50 - (2 * (x - 50)), 'y': 50 - (2 * (x - 50))});
            prev.addChild(child);
            prev = child;
        }
    }
    
    setParent(parent) {
        this.parent = parent;
    }

    getRoot() {
        return this.base;
    }
}

class Demo {
    constructor() {
        this.base = gameNode(colors.WHITE, null, {'x': 0, 'y': 0}, {'x': 0, 'y': 0}, {'x': 25, 'y': 25, 'text': 'ayy lmao'}); 
        this.layerTest = new LayerTest();
        this.layerTest.setParent(this);
        this.base.addChild(this.layerTest.getRoot());
    }

    addClick() {
    }

    handleNewPlayer(player) {
    }

    handlePlayerDisconnect(player) {
    }

    getRoot() {
        return this.base;
    }
}

module.exports = Demo;
