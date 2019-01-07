class Squisher {
    constructor(width, height, game) {
        this.width = width;
        this.height = height;
        this.game = game;
        this.root = game.getRoot();
        this.root.addListener(this);
        this.listeners = new Set();
        this.initialize();
    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    removeListener(listener) {
        this.listeners.remove(listener);
    }

    initialize() {
        this.ids = new Set();
        this.entities = new Array();
        this.clickListeners = new Array(this.width * this.height);
        this.update(this.root);
    }

    handleStateChange(node) {
        this.update(node);
    }

    update(node) {
        this.updateHelper(node);
        this.updatePixelBoard();
    }

    updateHelper(node) {

        if (!this.ids.has(node.id)) {
            this.ids.add(node.id);
            node.addListener(this);
            this.entities.push(node);
            for (let i = Math.floor(node.pos.x * this.width); i < this.width * (node.pos.x + node.size.x); i++) {
                for (let j = Math.floor(node.pos.y * this.height); j < this.height * (node.pos.y + node.size.y); j++) {
                    this.clickListeners[i * this.width + j] = node;
                }
            }
        }

        for (let i = 0; i < node.children.length; i++) {
            this.updateHelper(node.children[i]);
        }
    }

    updatePixelBoard() {
        const entityFrameSize = 44;
        this.pixelBoard = new Array(entityFrameSize * this.entities.length);
        for (let i = 0; i < this.entities.length; i++) {
            this.pixelBoard[entityFrameSize * i] = this.entities[i].color[0];
            this.pixelBoard[entityFrameSize * i + 1] = this.entities[i].color[1];
            this.pixelBoard[entityFrameSize * i + 2] = this.entities[i].color[2];
            this.pixelBoard[entityFrameSize * i + 3] = this.entities[i].color[3];
            this.pixelBoard[entityFrameSize * i + 4] = Math.floor(this.entities[i].pos.x * 100);
            this.pixelBoard[entityFrameSize * i + 5] = this.entities[i].pos.x * 10000 % 100;
            this.pixelBoard[entityFrameSize * i + 6] = Math.floor(this.entities[i].pos.y * 100);
            this.pixelBoard[entityFrameSize * i + 7] = this.entities[i].pos.y * 10000 % 100;
            this.pixelBoard[entityFrameSize * i + 8] = Math.floor(this.entities[i].size.x * 100);
            this.pixelBoard[entityFrameSize * i + 9] = this.entities[i].size.x * 10000 % 100;
            this.pixelBoard[entityFrameSize * i + 10] = Math.floor(this.entities[i].size.y * 100);
            this.pixelBoard[entityFrameSize * i + 11] = this.entities[i].size.y * 10000 % 100;

            if (this.entities[i].text) {
                this.pixelBoard[entityFrameSize * i + 12] = this.entities[i].text.x * 100;
                this.pixelBoard[entityFrameSize * i + 13] = this.entities[i].text.y * 100;
                for (let textIndex = 0; textIndex < 32 && textIndex < this.entities[i].text.text.length; textIndex++) {
                    this.pixelBoard[entityFrameSize * i + 14 + textIndex] = this.entities[i].text.text.charCodeAt(textIndex);
                }
            }
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
        } else if (input.type === 'keydown') { 
            this.game.handleKeyDown && this.game.handleKeyDown(player, input.key);
        } else if (input.type === 'keyup') {
            this.game.handleKeyUp && this.game.handleKeyUp(player, input.key);
        } else {
            console.log('Unknown input type: ' + input.type);
        }
    }

    handleClick(player, click) {
        let translatedX = (click.x / this.width);
        const translatedY = (click.y / this.height);
        if (translatedX >= 1 || translatedY >= 1) {
            return;
        }
        const entity = this.clickListeners[click.x * this.width + click.y];
        if (entity) {
            entity.handleClick(player, translatedX, translatedY);
        }
    }

    getPixels() {
        return this.pixelBoard;
    }
}

module.exports = Squisher;
