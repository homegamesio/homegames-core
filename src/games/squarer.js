const gameNode = require("../common/GameNode");
const { randomColor, BLACK } = require("../common/Colors");

class Squarer {
    constructor() {
        this.base = gameNode(BLACK, null,
            {"x": 0, "y": 0}, {"x": 100, "y": 100});

        this.keysDown = {};

        const setActiveMover = function(mover) {
            this.activeMover = mover;
		}.bind(this);

		const destinationColor = randomColor([BLACK]);
        this.destination = gameNode(destinationColor, function() {}, {"x": 40, "y": 0}, {"x": 10, "y": 10});
        this.square = gameNode(destinationColor, function() {}, {"x": 85, "y": 85}, {"x": 10, "y": 10});

        this.base.addChild(this.destination);
        this.base.addChild(this.square);
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

    movePlayer(player, dir, dist = 1) {
        let newY = player.pos.y;
        let newX = player.pos.x;

        if (dir === 'up') {
            if (player.pos.y - dist < 0) {
                newY = 0;
            } else {
                newY = player.pos.y - dist;
            }
        } else if (dir === 'down') {
            if (player.pos.y + player.size.y + dist <= 100) {
                newY = player.pos.y + dist;
            } else {
                newY = 100 - player.size.y;
            }
        } else if (dir === 'left') {
            if (player.pos.x - dist < 0) {
                newX = 0;
            } else {
                newX = player.pos.x - dist;
            }
        } else if (dir === 'right') {
            if (player.pos.x + player.size.x + dist <= 100) {
                newX = player.pos.x + dist;
            } else {
                newX = 100 - player.size.x;
            }
		}
		player.pos = {'x': newX, 'y': newY};
    }

    handleKeyDown(player, key) {
        this.keysDown[key] = true;
		if (key == "ArrowUp" || key == "w") {
			this.movePlayer(this.square, 'up');
		} else if (key == "ArrowDown" || key == "s") {
			this.movePlayer(this.square, 'down');
		} else if (key == "ArrowLeft" || key == "a") {
			this.movePlayer(this.square, 'left');
		} else if (key == "ArrowRight" || key == "d") {
			this.movePlayer(this.square, 'right');
		}
    }

    getRoot() {
        return this.base;
    }
}

module.exports = Squarer;
