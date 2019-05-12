const gameNode = require("../GameNode");
const { randomColor } = require("../Colors");

class MoveTest {
    constructor() {
        this.base = gameNode(randomColor(), null, 
            {"x": 0, "y": 0}, {"x": 100, "y": 100});

        this.keysDown = {};

        const setActiveMover = function(mover) {
            this.activeMover = mover;
        }.bind(this);

        this.mover1 = gameNode(randomColor(), function() {
            console.log("CLICKED 1");
        }, {"x": 45, "y": 43.5}, {"x": 10, "y": 17});

        
        this.mover2 = gameNode(randomColor(), function() {
            console.log("CLICKED 2");
        }, {"x": 25, "y": 23.5}, {"x": 10, "y": 17});

        this.base.addChild(this.mover1);
        this.base.addChild(this.mover2);
        this.activeMover = null;
    }

    moveGuy(player, x, y) {
        if (this.activeMover) {
            this.activeMover.pos = {x: x * 100, y: y * 100};
        }
    }

    handleCollision(node1, node2) {
        console.log("STUFF COLLIDED");
    }

    handleKeyUp(player, key) {
        if(this.keyDownInterval){
            clearInterval(this.keyDownInterval);
        }
    }

    handleKeyDown(player, key) {
        this.keysDown[key] = true;
        if (this.keyDownInterval) {
            clearInterval(this.keyDownInterval);
        }
        
        this.keyDownInterval = setInterval(() => {

            if (key == "ArrowUp") {
                this.mover1.pos = {x: this.mover1.pos.x, y: this.mover1.pos.y - .1};
            }
        
            if (key == "ArrowDown") {
                this.mover1.pos = {x: this.mover1.pos.x, y: this.mover1.pos.y + .1};
            }
        
            if (key == "ArrowLeft") {
                this.mover1.pos = {x: this.mover1.pos.x - .1, y: this.mover1.pos.y};
            }

            if (key == "ArrowRight") {
                this.mover1.pos = {x: this.mover1.pos.x + .1, y: this.mover1.pos.y};
            }
        }, 10);
        // is 10ms a good number? who knows
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
