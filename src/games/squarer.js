const { Colors, Game, GameNode } =  require('squishjs');
const { randomColor, BLACK, GRAY, GOLD, GREEN } = Colors;

class Squarer extends Game {
	static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: 'Yazeed Loonat'
        };
    }

	constructor() {
        super();
        this.defaultSize = { x: 5, y: 5 };
		this.base = GameNode(BLACK, null, {x: 0, y: 0}, {x: 100, y: 100});
        this.startLine = GameNode(GRAY, null, {x: 0, y: 95}, {x: 100, y: 5});
        this.finishLine = GameNode(GRAY, null, {x: 0, y: 0}, {x: 100, y: 5});
        this.base.addChild(this.startLine);
        this.base.addChild(this.finishLine);

        const destinationColor = randomColor([BLACK, GRAY, GOLD, GREEN]);
        this.destination = GameNode(destinationColor, null, {x: 40, y: 0}, this.defaultSize);
        this.base.addChild(this.destination);

        this.keyCoolDowns = {};
        this.level = 1;
        this.usedColors = [BLACK, GRAY, GOLD, GREEN, destinationColor];
        this.playerArray = [];
        this.movementQueue = [];
        this.npc = [];
        this.createNpc();
    }

    getRoot() {
        return this.base;
    }

    createNpc() {
        this.movementQueue = [];
        this.npc.forEach(npc => {
            clearInterval(npc.interval);
            this.base.removeChild(npc.id);
        });
        this.npc = [];
        if (this.level > 9) {
            console.log("good job");
            this.base.removeChild(this.destination.id)
            return;
        }
        for( let i = 5; i < 50; i+=5) {
            const tickRate = Math.ceil(250 + Math.random() * 100);
            let color = i % 2 ? GOLD : GREEN;
            for (let l = 0; l < this.level && l <= 9; l++) {
                const temp = GameNode(color, null, {x: (10 * l) + 5, y: i}, this.defaultSize);
                temp.interval = setInterval(() => {
                    this.movementQueue.push({ npc: true, node: temp, direction: 'left' });
                }, tickRate);
                this.npc.push(temp);
                this.base.addChild(temp);
            }
        }

        for( let i = 55; i < 95; i+=5) {
            const tickRate = Math.ceil(250 + Math.random() * 100);
            let color = i % 2 ? GOLD : GREEN;
            for (let l = 0; l < this.level && l <= 9; l++) {
                const temp = GameNode(color, null, {x: (10 * l) + 5, y: i}, this.defaultSize);
                temp.interval = setInterval(() => {
                    this.movementQueue.push({ npc: true, node: temp, direction: 'right' });
                }, tickRate);
                this.npc.push(temp);
                this.base.addChild(temp);
            }
        }
    }

    handleNewPlayer(player) {
        this.keyCoolDowns[player.id] = {};
        const color = randomColor(this.usedColors);
        this.usedColors.push(color);
        const defaultX = (this.playerArray.length * 10) + 5;
        const square = GameNode(color, null, { x: defaultX, y: 95 }, this.defaultSize, null, null);
        square.controllerID = player.id;
        square.defaultX = defaultX;
        square.score = 0;
        this.playerArray.push(square);
        this.base.addChild(square);
    }

    handleKeyDown(player, key) {
        const index = this.playerArray.findIndex(elem => elem.controllerID === player.id );
        const square = this.playerArray[index];
        if (!this.keyCoolDowns[player.id] || !this.keyCoolDowns[player.id][key]) {
            if (key === "ArrowUp" || key === "w") {
                this.movementQueue.push({ node: square, direction: 'up' });
            } else if (key === "ArrowDown" || key === "s") {
                this.movementQueue.push({ node: square, direction: 'down' });
            } else if (key === "ArrowLeft" || key === "a") {
                this.movementQueue.push({ node: square, direction: 'left' });
            } else if (key === "ArrowRight" || key === "d") {
                this.movementQueue.push({ node: square, direction: 'right' });
            } else {
                return;
            }
            this.keyCoolDowns[player.id][key] = setTimeout(() => {
                clearTimeout(this.keyCoolDowns[player.id][key]);
                delete this.keyCoolDowns[player.id][key];
            }, 250);
        }
    }

    handlePlayerDisconnect(player) {
        const index = this.playerArray.findIndex(elem => elem.playerId === player);
        if (index > -1) {
            this.base.removeChild(this.playerArray[index].id);
            this.playerArray.splice(index, 1);
        }
    }

    handleKeyUp(player, key) {
        if (this.keyCoolDowns[player.id][key]) {
            clearTimeout(this.keyCoolDowns[player.id][key]);
            delete this.keyCoolDowns[player.id][key];
        }
    }

    tick() {
        while(this.movementQueue.length) {
            const { npc, node, direction } = this.movementQueue.shift();
            let newX = node.pos.x;
            let newY = node.pos.y;
            if (npc) {
                if (direction === 'right') {
                    if (node.pos.x + node.size.x + 5 <= 100) {
                        newX = node.pos.x + 5;
                    } else {
                        newX = 0;
                    }
                } else {
                    if (node.pos.x - 5 >= 0) {
                        newX = node.pos.x - 5;
                    } else {
                        newX = 100;
                    }
                }
                node.pos = {x: newX, y: newY};
                this.checkForCollisions( node, this.playerArray, true);
            } else {
                if (direction === 'up') {
                    if (node.pos.y - 5 < 0) {
                        newY = 0;
                    } else {
                        newY = node.pos.y - 5;
                    }
                } else if (direction === 'down') {
                    if (node.pos.y + node.size.y + 5 <= 100) {
                        newY = node.pos.y + 5;
                    } else {
                        newY = 100 - node.size.y;
                    }
                } else if (direction === 'left') {
                    if (node.pos.x - 5 < 0) {
                        newX = 0;
                    } else {
                        newX = node.pos.x - 5;
                    }
                } else if (direction === 'right') {
                    if (node.pos.x + node.size.x + 5 <= 100) {
                        newX = node.pos.x + 5;
                    } else {
                        newX = 100 - node.size.x;
                    }
                }
                node.pos = {x: newX, y: newY};
                if (this.checkForCollisions(node, this.npc)) {
                    node.pos = {x: node.defaultX, y: 95};
                } else if (this.checkForCollisions(node, [this.destination])) {
                    this.level++;
                    node.score++;
                    this.createNpc();
                    this.bounceAllPlayersBack();
                    return;
                }
            }
        }
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

    bounceAllPlayersBack() {
        this.playerArray.forEach((elem, i) => {
            elem.defaultX = (i * 10) + 5
            elem.pos = {x: elem.defaultX, y: 95};
        });
    }

    close() {
        this.playerArray.forEach(player => {
            this.base.removeChild(player.id);
        });
        this.playerArray = [];
        this.npc.forEach(npc => {
            clearInterval(npc.interval);
            this.base.removeChild(npc.id);
        });
        this.npc = [];
    }

    canAddPlayer() {
        if (this.playerArray.length > 8) {
            return false;
        }
        return true;
    }
}

module.exports = Squarer;
