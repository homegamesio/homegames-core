class Squisher {
    constructor(width, height, game) {
        this.width = width;
        this.height = height;
        this.root = game.getRoot();
        this.root.addListener(this);
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
        let entities = new Array()//this.width);
        let clickListeners = new Array(this.width);
        for (let i = 0; i < this.width; i++) {
            clickListeners[i] = new Array(this.height);
        }

        this.clickListeners = clickListeners;
        this.entities = entities;
        this.initializeHelper(this.root);
        this.updatePixelBoard();
    }

    handleStateChange(node) {
        this.update(node);
    }

    initializeHelper(node) {
        //this.clickListeners = node;
        //this.updatePixelBoard();
        //return;
        this.entities.push(node);
        for (let i = Math.floor(node.pos.x * this.width); i < this.width * (node.pos.x + node.size.x); i++) {
            for (let j = Math.floor(node.pos.y * this.height); j < this.height * (node.pos.y + node.size.y); j++) {
                this.clickListeners[i][j] = node;
            }
        }

        for (let i = 0; i < node.children.length; i++) {
            this.initializeHelper(node.children[i]);
        }
    }

    update(node) {
        this.updatePixelBoard();
    }

    updatePixelBoard() {
        this.pixelBoard = new Array(8 * this.entities.length);
        for (let i = 0; i < this.entities.length; i++) {
            this.pixelBoard[i] = this.entities[i].color[0];
            this.pixelBoard[i + 1] = this.entities[i].color[1];
            this.pixelBoard[i + 2] = this.entities[i].color[2];
            this.pixelBoard[i + 3] = this.entities[i].color[3];
            this.pixelBoard[i + 4] = this.entities[i].pos.x;
            this.pixelBoard[i + 5] = this.entities[i].pos.y;
            this.pixelBoard[i + 6] = this.entities[i].size.x;
            this.pixelBoard[i + 7] = this.entities[i].size.y;
        }

       this.notifyListeners();
    }

    notifyListeners() {
        for (let listener of this.listeners) {
            listener.handleUpdate(this.pixelBoard);
        }
    }

    handlePlayerInput(player, input) {
        if (input.type === 'click') {
            this.handleClick(player, input.data);
        } else if (input.type === 'keydown' || input.type === 'keyup') {
            // TODO: something with key events
        } else {
            console.log("Unknown input type: " + input.type);
        }
    }

    handleClick(player, click) {
        let translatedX = (click.x / this.width);
        const translatedY = (click.y / this.height);
        if (translatedX >= 1 || translatedY >= 1) {
            return;
        }
        const entity = this.clickListeners[click.x][click.y];
        if (entity) {
            entity.handleClick(player, translatedX, translatedY);
        }
    }

    getPixels() {
        return this.pixelBoard;
    }
}

module.exports = Squisher;
