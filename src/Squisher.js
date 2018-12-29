class Squisher {
    constructor(width, height, game) {
        this.width = width;
        this.height = height;
        this.root = game.getRoot();
        this.listeners = new Set();
        this.tempPixels = new Uint8ClampedArray(this.width * this.height * 4);
        this.initialize();
    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    removeListener(listener) {
        this.listeners.remove(listener);
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

    handleStateChange(node) {
        this.update(node);
    }

    initializeHelper(node) {
        for (let i = Math.floor(node.pos.x * this.width); i < this.width * (node.pos.x + node.size.x); i++) {
            for (let j = Math.floor(node.pos.y * this.height); j < this.height * (node.pos.y + node.size.y); j++) {
                this.entities[i][j].push(node);
                node.index = this.entities[i][j].length - 1;
            }
        }

        node.addListener(this);

        for (let i = 0; i < node.children.length; i++) {
            this.initializeHelper(node.children[i]);
        }
    }

    update(node) {
        for (let i = Math.floor(node.pos.x * this.width); i < this.width * (node.pos.x + node.size.x); i++) {
            for (let j = Math.floor(node.pos.y * this.height); j < this.height * (node.pos.y + node.size.y); j++) {
                this.entities[i][j][node.index] = node;
            }
        }
        
        for (let i = 0; i < node.children.length; i++) {
            if (!node.children[i].index) {
                node.children[i].index = node.index + 1;
            }
            this.update(node.children[i]);
        }

        this.updatePixelBoard();
    }

    updatePixelBoard() {
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                let entityCount = this.entities[i][j].length;
                if (entityCount > 0) {
                    let k = 4 * ((j * this.width) + i);
                    let color = this.entities[i][j][entityCount - 1].color;
                    
                    this.tempPixels[k] = color[0];
                    this.tempPixels[k+ 1] = color[1];
                    this.tempPixels[k + 2] = color[2];
                    this.tempPixels[k + 3] = color[3];
                }
            }
        }

        this.pixelBoard = this.tempPixels;
        this.notifyListeners();
    }

    notifyListeners() {
        for (let listener of this.listeners) {
            listener.handleUpdate(this.pixelBoard);
        }
    }

    handlePlayerInput(player, input) {
        // currently assume all input is clicks
        let translatedX = (input.x / this.width);
        let translatedY = (input.y / this.height);
        if (translatedX >= 1 || translatedY >= 1) {
            return;
        }
        let entityCount = this.entities[input.x][input.y].length;
        if (entityCount > 0) {
            this.entities[input.x][input.y][entityCount - 1].handleClick(translatedX, translatedY);
        }
    }

    getPixels() {
        return this.pixelBoard;
    }
}

module.exports = Squisher;
