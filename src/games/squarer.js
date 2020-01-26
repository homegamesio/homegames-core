const gameNode = require("../common/GameNode");
const { randomColor, BLACK, GRAY, GOLD, GREEN } = require("../common/Colors");

class Squarer {
    constructor() {
        this.base = gameNode(BLACK, null, {"x": 0, "y": 0}, {"x": 100, "y": 100});
        this.keyCoolDowns = {};
        this.npc = [];

        const setActiveMover = function(mover) {
            this.activeMover = mover;
		}.bind(this);

        this.startLine = gameNode(GRAY, null, {"x": 0, "y": 95}, {"x": 100, "y": 5});
        this.finishLine = gameNode(GRAY, null, {"x": 0, "y": 0}, {"x": 100, "y": 5});
        this.base.addChild(this.startLine);
        this.base.addChild(this.finishLine);

        for (let i = 5; i < 95; i+=5) {
            let color = i % 2 ? GOLD : GREEN;
            const temp = (gameNode(color, null, {"x": 0, "y": i}, {"x": 5, "y": 5}));
            this.npc.push(temp);
            this.base.addChild(temp);
            setInterval(() => {
                let newY = temp.pos.y;
                let newX = temp.pos.x;
                if (temp.pos.x + temp.size.x + 5 <= 100) {
                    newX = temp.pos.x + 5;
                } else {
                    newX = 0;
                }
                temp.pos = {'x': newX, 'y': newY};
            }, Math.ceil(250 + Math.random() * i));
        }

        const destinationColor = randomColor([BLACK, GRAY, GOLD, GREEN]);
        this.destination = gameNode(destinationColor, function() {}, {"x": 40, "y": 0}, {"x": 5, "y": 5});
        this.square = gameNode(destinationColor, function() {}, {"x": 95, "y": 95}, {"x": 5, "y": 5});
        this.base.addChild(this.destination);
        this.base.addChild(this.square);

        this.activeMover = null;
        this.collisions = {};
    }

    moveNPC() {
        this.npc.forEach(npc => {
            let newY = npc.pos.y;
            let newX = npc.pos.x;
            if (npc.pos.x + npc.size.x + 5 <= 100) {
                newX = npc.pos.x + 5;
            } else {
                newX = 0;
            }
            npc.pos = {'x': newX, 'y': newY};
        });
    }

    moveGuy(player, x, y) {
        if (this.activeMover) {
            this.activeMover.pos = {x: x * 100, y: y * 100};
        }
    }

    handleNewPlayer(player) {
        this.keyCoolDowns[player.id] = {};
    }

    handleKeyUp(player, key) {
        if (this.keyCoolDowns[player.id][key]) {
            clearTimeout(this.keyCoolDowns[player.id][key]);
            delete this.keyCoolDowns[player.id][key];
        }
    }

    movePlayer(player, dir, dist = 5) {
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
        if (!this.keyCoolDowns[player.id] || !this.keyCoolDowns[player.id][key]) {
            if (key == "ArrowUp" || key == "w") {
                this.movePlayer(this.square, 'up');
            } else if (key == "ArrowDown" || key == "s") {
                this.movePlayer(this.square, 'down');
            } else if (key == "ArrowLeft" || key == "a") {
                this.movePlayer(this.square, 'left');
            } else if (key == "ArrowRight" || key == "d") {
                this.movePlayer(this.square, 'right');
            } else {
                return;
            }
            this.keyCoolDowns[player.id][key] = setTimeout(() => {
                clearTimeout(this.keyCoolDowns[player.id][key]);
                delete this.keyCoolDowns[player.id][key];
            }, 250);
        }
    }

    getRoot() {
        return this.base;
    }
}

module.exports = Squarer;
