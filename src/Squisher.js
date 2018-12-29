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
                this.entities[i][j] = node;
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
                this.entities[i][j] = node;
            }
        }
        
        for (let i = 0; i < node.children.length; i++) {
            this.update(node.children[i]);
        }

        this.updatePixelBoard();
    }

    updatePixelBoard() {
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                if (this.entities[i][j]) {
                    let k = 4 * ((j * this.width) + i);
                    let color = this.entities[i][j].color;
                    
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
        const translatedX = (input.x / this.width);
        const translatedY = (input.y / this.height);
        if (translatedX >= 1 || translatedY >= 1) {
            return;
        }
        const entity = this.entities[input.x][input.y];
        if (entity) {
            entity.handleClick(player, translatedX, translatedY);
        }
    }

    getPixels() {
        return this.pixelBoard;
    }
}

module.exports = Squisher;
