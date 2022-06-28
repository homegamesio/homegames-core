const { Colors, Game, GameNode, Shapes, ShapeUtils } = require('squish-0756');
const { BLACK, GRAY, GOLD, GREEN } = Colors.COLORS;

class Squarer extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0756',
            author: 'Yazeed Loonat',
            thumbnail: 'dcd6e74ff94d51f9f323ce00669d98d4'
        };
    }

    constructor() {
        super();
        this.defaultSize = { x: 5, y: 5 };
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: BLACK,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100)
        });
        this.startLine = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: GRAY,
            coordinates2d: ShapeUtils.rectangle(0, 95, 100, 5)
        });
        this.finishLine = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: GRAY,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 5)
        });
        this.base.addChild(this.startLine);
        this.base.addChild(this.finishLine);

        const destinationColor = Colors.randomColor([BLACK, GRAY, GOLD, GREEN]);
        this.destination = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: destinationColor,
            coordinates2d: ShapeUtils.rectangle(40, 0, this.defaultSize.x, this.defaultSize.y)
        });
        this.base.addChild(this.destination);

        this.keyCoolDowns = {};
        this.level = 1;
        this.usedColors = [BLACK, GRAY, GOLD, GREEN, destinationColor];
        this.playerArray = [];
        this.movementQueue = [];
        this.npc = [];
        this.createNpc();
    }
    
    getLayers() {
        return [{root: this.base}];
    }

    createNpc() {
        this.movementQueue = [];
        this.npc.forEach(npc => {
            clearInterval(npc.interval);
            this.base.removeChild(npc.id);
        });
        this.npc = [];
        if (this.level > 9) {
            console.log('good job');
            this.base.removeChild(this.destination.id);
            return;
        }
        for( let i = 5; i < 50; i+=5) {
            const tickRate = Math.ceil(250 + Math.random() * 100);
            const color = i % 2 ? GOLD : GREEN;
            for (let l = 0; l < this.level && l <= 9; l++) {
                const temp = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    fill: color,
                    coordinates2d: ShapeUtils.rectangle((10 * l) + 5, i, this.defaultSize.x, this.defaultSize.y)
                });
                temp.interval = this.setInterval(() => {
                    this.movementQueue.push({ npc: true, node: temp, direction: 'left' });
                }, tickRate);
                this.npc.push(temp);
                this.base.addChild(temp);
            }
        }

        for( let i = 55; i < 95; i+=5) {
            const tickRate = Math.ceil(250 + Math.random() * 100);
            const color = i % 2 ? GOLD : GREEN;
            for (let l = 0; l < this.level && l <= 9; l++) {
                const temp = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    fill: color,
                    coordinates2d: ShapeUtils.rectangle((10 * l) + 5, i, this.defaultSize.x, this.defaultSize.y)
                });
                temp.interval = this.setInterval(() => {
                    this.movementQueue.push({ npc: true, node: temp, direction: 'right' });
                }, tickRate);
                this.npc.push(temp);
                this.base.addChild(temp);
            }
        }
    }

    handleNewPlayer({ playerId }) {
        this.keyCoolDowns[playerId] = {};
        const color = Colors.randomColor(this.usedColors);
        this.usedColors.push(color);
        const defaultX = (this.playerArray.length * 10) + 5;
        const square = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(defaultX, 95, this.defaultSize.x, this.defaultSize.y),
            fill: color
        });

        square.controllerID = playerId;
        square.defaultX = defaultX;
        square.score = 0;
        this.playerArray.push(square);
        this.base.addChild(square);
    }

    handleKeyDown(playerId, key) {
        const index = this.playerArray.findIndex(elem => elem.controllerID === playerId );
        const square = this.playerArray[index];
        if (!this.keyCoolDowns[playerId] || !this.keyCoolDowns[playerId][key]) {
            if (key === 'ArrowUp' || key === 'w') {
                this.movementQueue.push({ node: square, direction: 'up' });
            } else if (key === 'ArrowDown' || key === 's') {
                this.movementQueue.push({ node: square, direction: 'down' });
            } else if (key === 'ArrowLeft' || key === 'a') {
                this.movementQueue.push({ node: square, direction: 'left' });
            } else if (key === 'ArrowRight' || key === 'd') {
                this.movementQueue.push({ node: square, direction: 'right' });
            } else {
                return;
            }
            this.keyCoolDowns[playerId][key] = this.setTimeout(() => {
                clearTimeout(this.keyCoolDowns[playerId][key]);
                delete this.keyCoolDowns[playerId][key];
            }, 250);
        }
    }

    handlePlayerDisconnect(playerId) {
        const index = this.playerArray.findIndex(elem => elem.playerId === playerId);
        if (index > -1) {
            this.base.removeChild(this.playerArray[index].id);
            this.playerArray.splice(index, 1);
        }
    }

    handleKeyUp(playerId, key) {
        if (this.keyCoolDowns[playerId][key]) {
            clearTimeout(this.keyCoolDowns[playerId][key]);
            delete this.keyCoolDowns[playerId][key];
        }
    }

    tick() {
        while(this.movementQueue.length) {
            const { npc, node, direction } = this.movementQueue.shift();
            const nodePosX = node.node.coordinates2d[0][0];
            const nodePosY = node.node.coordinates2d[0][1];

            const nodeSizeX = node.node.coordinates2d[1][0] - nodePosX;
            const nodeSizeY = node.node.coordinates2d[2][1] - nodePosY;

            let newX = nodePosX;
            let newY = nodePosY;

            if (npc) {
                if (direction === 'right') {
                    if (nodePosX + nodeSizeX + 5 <= 100) {
                        newX = nodePosX + 5;
                    } else {
                        newX = 0;
                    }
                } else {
                    if (nodePosX - 5 >= 0) {
                        newX = nodePosX - 5;
                    } else {
                        newX = 100;
                    }
                }
                node.node.coordinates2d = ShapeUtils.rectangle(newX, newY, nodeSizeX, nodeSizeY);
                this.checkForCollisions( node, this.playerArray, true);
            } else {
                if (direction === 'up') {
                    if (nodePosY - 5 < 0) {
                        newY = 0;
                    } else {
                        newY = nodePosY - 5;
                    }
                } else if (direction === 'down') {
                    if (nodePosY + nodeSizeY + 5 <= 100) {
                        newY = nodePosY + 5;
                    } else {
                        newY = 100 - nodeSizeY;
                    }
                } else if (direction === 'left') {
                    if (nodePosX - 5 < 0) {
                        newX = 0;
                    } else {
                        newX = nodePosX - 5;
                    }
                } else if (direction === 'right') {
                    if (nodePosX + nodeSizeX + 5 <= 100) {
                        newX = nodePosX + 5;
                    } else {
                        newX = 100 - nodeSizeX;
                    }
                }
                node.node.coordinates2d = ShapeUtils.rectangle(newX, newY, nodeSizeX, nodeSizeY);
                if (this.checkForCollisions(node, this.npc)) {
                    node.node.coordinates2d = ShapeUtils.rectangle(node.node.defaultX, 95, nodeSizeX, nodeSizeY);
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
        const nodePosX = node.node.coordinates2d[0][0];
        const nodePosY = node.node.coordinates2d[0][1];

        const nodeSizeX = node.node.coordinates2d[1][0] - nodePosX;
        const nodeSizeY = node.node.coordinates2d[2][1] - nodePosY;

        if (bounceFound) {
            toCheck.forEach(elem => {
                const elemPosX = elem.node.coordinates2d[0][0];
                const elemPosY = elem.node.coordinates2d[0][1];
                
                const elemSizeX = elem.node.coordinates2d[1][0] - elemPosX;
                const elemSizeY = elem.node.coordinates2d[2][1] - elemPosY;

                if (nodePosX === elemPosX && (nodePosX + nodeSizeX) === (elemPosX + elemSizeX)) {
                    if (nodePosY === elemPosY && (nodePosY + nodeSizeY) === (elemPosY + elemSizeY)) {
                        elem.node.coordinates2d = ShapeUtils.rectangle(elem.defaultX, 95, elemSizeX, elemSizeY);
                    }
                }
            });
        }
        return toCheck.some(elem => {
            const elemPosX = elem.node.coordinates2d[0][0];
            const elemPosY = elem.node.coordinates2d[0][1];
            
            const elemSizeX = elem.node.coordinates2d[1][0] - elemPosX;
            const elemSizeY = elem.node.coordinates2d[2][1] - elemPosY;

            if (nodePosX === elemPosX && (nodePosX + nodeSizeX) === (elemPosX + elemSizeX)) {
                if (nodePosY === elemPosY && (nodePosY + nodeSizeY) === (elemPosY + elemSizeY)) {
                    return true;
                }
            }
            return false;
        });
    }

    bounceAllPlayersBack() {
        this.playerArray.forEach((elem, i) => {
            const elemPosX = elem.node.coordinates2d[0][0];
            const elemPosY = elem.node.coordinates2d[0][1];

            const elemSizeX = elem.node.coordinates2d[1][0] - elemPosX;
            const elemSizeY = elem.node.coordinates2d[2][1] - elemPosY;

            elem.defaultX = (i * 10) + 5;
            elem.node.coordinates2d = ShapeUtils.rectangle(elem.defaultX, 95, elemSizeX, elemSizeY);
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
