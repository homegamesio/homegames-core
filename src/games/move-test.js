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
        }, {"x": 45, "y": 43.5}, {"x": 10, "y": 17});


        this.mover2 = gameNode(randomColor(), function() {
        }, {"x": 20, "y": 23.5}, {"x": 10, "y": 17});

        this.base.addChild(this.mover1);
        this.base.addChild(this.mover2);
        this.activeMover = null;
        this.collisions = {};
    }

    moveGuy(player, x, y) {
        if (this.activeMover) {
            this.activeMover.pos = {x: x * 100, y: y * 100};
        }
    }

    handleKeyUp(player, key) {
        this.keysDown[key] = true;
    }

    movePlayer(player, dir, dist = .1) {
        let newY = player.pos.y;
        let newX = player.pos.x;

        if (dir === 'up') {
            if (player.pos.y - dist < 0) {
                newY = 0;
            } else {
                newY = player.pos.y - dist;
            }
        }

        if (dir === 'down') {
            if (player.pos.y + player.size.y + dist <= 100) {
                newY = player.pos.y + dist;
            } else {
                newY = 100 - player.size.y;
            }
        }

        if (dir === 'left') {
            if (player.pos.x - dist < 0) {
                newX = 0;
            } else {
                newX = player.pos.x - dist;
            }
        }

        if (dir === 'right') {
            if (player.pos.x + player.size.x + dist <= 100) {
                newX = player.pos.x + dist;
            } else {
                newX = 100 - player.size.x;
            }
        }

        let wouldBeCollisions = this.squisher.checkCollisions({'id': player.id, 'pos': {'x': newX, 'y': newY}, 'size': player.size}, false);

        if (wouldBeCollisions.length == 0) {
            player.pos = {'x': newX, 'y': newY};
        }
    }

    handleKeyDown(player, key) {
        this.keysDown[key] = true;

            if (key == "ArrowUp") {
                this.movePlayer(this.mover1, 'up', .2);
            }

            if (key == "ArrowDown") {
                this.movePlayer(this.mover1, 'down', .2);
            }

            if (key == "ArrowLeft") {
                this.movePlayer(this.mover1, 'left', .2);
            }

            if (key == "ArrowRight") {
                this.movePlayer(this.mover1, 'right', .2);
            }

            if (key == "w") {
                this.movePlayer(this.mover2, 'up', .2);
            }

            if (key == "s") {
                this.movePlayer(this.mover2, 'down', .2);
            }

            if (key == "a") {
                this.movePlayer(this.mover2, 'left', .2);
            }

            if (key == "d") {
                this.movePlayer(this.mover2, 'right', .2);
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
