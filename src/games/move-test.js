const gameNode = require('../GameNode');
const { randomColor } = require('../Colors');

class MoveTest {
    constructor() {
        this.base = gameNode(randomColor(), this.moveGuy.bind(this), 
            {'x': 0, 'y': 0}, {'x': 1, 'y': 1});

        const setActiveMover = function(mover) {
            this.activeMover = mover;
        }.bind(this);

        const mover1 = gameNode(randomColor(), function() {
            setActiveMover(this);
        }, {'x': .45, 'y': .435}, {'x': .1, 'y': .17});

        
        const mover2 = gameNode(randomColor(), function() {
            setActiveMover(this);
        }, {'x': .25, 'y': .235}, {'x': .1, 'y': .17});

        this.base.addChild(mover1);
        this.base.addChild(mover2);
        this.activeMover = null;
    }

    moveGuy(player, x, y) {
        if (this.activeMover) {
            this.activeMover.pos = {x: x, y: y};
        }
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

    handleLayerClick() {
        // todo: squisher needs to update pos after original
        this.color = randomColor();
    }

    getRoot() {
        return this.base;
    }
}

module.exports = MoveTest;
