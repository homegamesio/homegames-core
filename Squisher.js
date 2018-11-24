class Squisher {
    constructor(width, height, root) {
        this.width = width;
        this.height = height;
        this.root = root;
        this.tempPixels = new Uint8ClampedArray(this.width * this.height * 4);
        this.initialize();
    }

    initialize() {
        let entities = new Array(this.width);
        for (let i = 0; i < this.width; i++) {
            entities[i] = new Array(this.height);
        }

        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                entities[i][j] = new Array();
            }
        }

        this.entities = entities;
        this.initializeHelper(this.root);
        this.updatePixelBoard();
    }

    initializeHelper(node) {
        for (let i = Math.floor(node.pos.x * this.width); i < this.width * (node.pos.x + node.size.x); i++) {
            for (let j = Math.floor(node.pos.y * this.height); j < this.height * (node.pos.y + node.size.y); j++) {
                this.entities[i][j].push(node);
            }
        }

        for (let i = 0; i < node.children.length; i++) {
            this.initializeHelper(node.children[i]);
        }
    }

    update(node) {
        for (let i = Math.floor(node.pos.x * this.width); i < this.width * (node.pos.x + node.size.x); i++) {
            for (let j = Math.floor(node.pos.y * this.height); j < this.height * (node.pos.y + node.size.y); j++) {
                this.entities[i][j][1] = node;
            }
        }

        this.updatePixelBoard();
    }

    updatePixelBoard() {
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                let entityCount = this.entities[i][j].length;
                if (entityCount > 0) {
                    let k = 4 * ((j * this.width) + i);
                    this.tempPixels[k] = this.entities[i][j][entityCount - 1].color[0];
                    this.tempPixels[k+ 1] = this.entities[i][j][entityCount - 1].color[1];
                    this.tempPixels[k + 2] = this.entities[i][j][entityCount - 1].color[2];
                    this.tempPixels[k + 3] = this.entities[i][j][entityCount - 1].color[3];
                }
            }
        }

        this.pixelBoard = this.tempPixels;
    }

    handleClick(x, y) {
        let entityCount = this.entities[x][y].length;
        if (entityCount > 0) {
            this.entities[x][y][entityCount - 1].handleClick();
        }
    }

    getPixels() {
        return this.pixelBoard;
    }
}

module.exports = Squisher;
