const gameNode = require('../GameNode');
const {colors, randomColor} = require('../Colors');

class MoveTest {
    constructor() {
        this.base = gameNode(randomColor(), () => {}, 
            {'x': 0, 'y': 0}, {'x': 1, 'y': 1});

        this.mover = gameNode(randomColor(), this.handleLayerClick,
            {'x': .45, 'y': .435}, {'x': .1, 'y': .17});

        this.base.addChild(this.mover);
    }

    handleKeyDown(player, key) {
        if (key == 'ArrowUp') {
            this.mover.pos = {x: this.mover.pos.x, y: this.mover.pos.y - .01};
        }
        
        if (key == 'ArrowDown') {
            this.mover.pos = {x: this.mover.pos.x, y: this.mover.pos.y + .01};
        }
        
        if (key == 'ArrowLeft') {
            this.mover.pos = {x: this.mover.pos.x - .01, y: this.mover.pos.y};
        }

        if (key == 'ArrowRight') {
            this.mover.pos = {x: this.mover.pos.x + .01, y: this.mover.pos.y};
        }
    }

    handleKeyUp(player, key) {
        // nothing
    }

    handleLayerClick(player, x, y) {
        // todo: squisher needs to update pos after original
        this.color = randomColor();
    }

    handleNewPlayer() {
        // nothing
    }

    getRoot() {
        return this.base;
    }
}

module.exports = MoveTest;
