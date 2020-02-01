const gameNode = require("../common/GameNode");
const { randomColor, BLACK, GRAY, GOLD, GREEN } = require("../common/Colors");

class Squarer {
    constructor() {
        this.base = gameNode(BLACK, null, {x: 0, y: 0}, {x: 100, y: 100});
        this.startLine = gameNode(GRAY, null, {x: 0, y: 95}, {x: 100, y: 5});
        this.finishLine = gameNode(GRAY, null, {x: 0, y: 0}, {x: 100, y: 5});
        this.base.addChild(this.startLine);
        this.base.addChild(this.finishLine);

        const destinationColor = randomColor([BLACK, GRAY, GOLD, GREEN]);
        this.destination = gameNode(destinationColor, function() {}, {x: 40, y: 0}, {x: 5, y: 5});
        this.base.addChild(this.destination);

        this.keyCoolDowns = {};
        this.level = 1;
        this.usedColors = [BLACK, GRAY, GOLD, GREEN, destinationColor];
        this.playerArray = [];
        this.npc = [];

        this.createNpc();
    }

    handleNewPlayer(player) {
        this.keyCoolDowns[player.id] = {};
        const color = randomColor(this.usedColors);
        this.usedColors.push(color);
        const defaultX = (this.playerArray.length * 10) + 5;
        const square = gameNode(
            color,
            function() {},
            {x: defaultX, y: 95},
            {x: 5, y: 5},
            "",
            "",
            player.id
        );
        square.defaultX = defaultX;
        square.score = 0;
        this.playerArray.push(square);
        this.base.addChild(square);
    }

    handleKeyUp(player, key) {
        if (this.keyCoolDowns[player.id][key]) {
            clearTimeout(this.keyCoolDowns[player.id][key]);
            delete this.keyCoolDowns[player.id][key];
        }
    }

    movePlayer(player, dir, dist = 5) {
        let newX = player.pos.x;
        let newY = player.pos.y;

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
        let collided = this.checkForCollisions( player, this.npc);
        if (collided) {
            player.pos = {x: player.defaultX, y: 95};
        } else {
            player.pos = {x: newX, y: newY};
        }

        collided = this.checkForCollisions( player, [this.destination]);
        if (collided) {
            this.level++;
            player.score++;
            this.createNpc();
            this.bounceAllPlayersBack();
        } else {
            player.pos = {x: newX, y: newY};
        }
    }

    handleKeyDown(player, key) {
        const index = this.playerArray.findIndex(elem => elem.playerId === player.id );
        const square = this.playerArray[index];
        if (!this.keyCoolDowns[player.id] || !this.keyCoolDowns[player.id][key]) {
            if (key == "ArrowUp" || key == "w") {
                this.movePlayer(square, 'up');
            } else if (key == "ArrowDown" || key == "s") {
                this.movePlayer(square, 'down');
            } else if (key == "ArrowLeft" || key == "a") {
                this.movePlayer(square, 'left');
            } else if (key == "ArrowRight" || key == "d") {
                this.movePlayer(square, 'right');
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

    checkForCollisions(node, toCheck = [], bounceFound = false) {
        if (bounceFound) {
            toCheck.forEach(elem => {
                if (node.pos.x === elem.pos.x && (node.pos.x + node.size.x) === (elem.pos.x + elem.size.x)) {
                    if (node.pos.y === elem.pos.y && (node.pos.y + node.size.y) === (elem.pos.y + elem.size.y)) {
                        elem.pos = {x: elem.defaultX, y: 95};
                    }
                }
            });
        }
        return toCheck.some(elem => {
            if (node.pos.x === elem.pos.x && (node.pos.x + node.size.x) === (elem.pos.x + elem.size.x)) {
                if (node.pos.y === elem.pos.y && (node.pos.y + node.size.y) === (elem.pos.y + elem.size.y)) {
                    return true;
                }
            }
            return false;
        });
    }

    createNpc() {
        if (this.level > 9) {
            console.log("good job");
        }
        this.npc.forEach(npc => {
            clearInterval(npc.interval);
            this.base.removeChild([npc.id]);
        });
        this.npc = [];
        for( let l = 0; l < this.level && l < 9; l++) {
            for (let i = 5; i < 95; i+=5) {
                let color = i % 2 ? GOLD : GREEN;
                const temp = (gameNode(color, null, {x: (10 * l) + 5, y: i}, {x: 5, y: 5}));
                temp.interval = setInterval(() => {
                    this.checkForCollisions( temp, this.playerArray, true);
                    let newY = temp.pos.y;
                    let newX = temp.pos.x;
                    if (temp.pos.x + temp.size.x + 5 <= 100) {
                        newX = temp.pos.x + 5;
                    } else {
                        newX = 0;
                    }
                    temp.pos = {x: newX, y: newY};
                    this.checkForCollisions( temp, this.playerArray, true);
                }, Math.ceil(250 + Math.random() * i));
                this.npc.push(temp);
                this.base.addChild(temp);
            }
        }
    }

    bounceAllPlayersBack() {
        this.playerArray.forEach(elem => {
            elem.pos = {x: elem.defaultX, y: 95};
        });
    }
}

module.exports = Squarer;
