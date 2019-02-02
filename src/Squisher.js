class Squisher {
    constructor(width, height, game) {
        this.width = width;
        this.height = height;
        this.game = game;
        this.root = game.getRoot();
        this.root.addListener(this);
        this.listeners = new Set();
        this.assets = {};
        this.assetBundle = [];
    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    removeListener(listener) {
        this.listeners.remove(listener);
    }

    async initialize() {
        const gameAssets = this.game.getAssets ? this.game.getAssets() : [];
        
        console.log("INITIALIZING");

        for (const key in gameAssets) {
            const payload = await gameAssets[key].getData();
            const base32 = (payload.length).toString(32);
            this.assets[key] = [1, base32.charCodeAt(0), base32.charCodeAt(1), base32.charCodeAt(2), base32.charCodeAt(3), ...payload];// payload.charCodeAt(4)];//(...payload)];
            this.assetBundle.push(...this.assets[key]);
        }
        
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
            for (let i = Math.floor((node.pos.x/100) * this.width); i < this.width * ((node.pos.x/100) + (node.size.x/100)); i++) {
                for (let j = Math.floor((node.pos.y/100) * this.height); j < this.height * ((node.pos.y/100) + (node.size.y/100)); j++) {
                    this.clickListeners[i * this.width + j] = node;
                }
            }
        }

        for (let i = 0; i < node.children.length; i++) {
            this.updateHelper(node.children[i]);
        }
    }

    updatePixelBoard() {
        const temp = new Array(this.entities.length);
        for (let i = 0; i < this.entities.length; i++) {
            temp[i] = this.squish(this.entities[i]);
        }

        this.pixelBoard = Array.prototype.concat.apply([], temp);

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
            entity.handleClick && entity.handleClick(player, translatedX, translatedY);
        }
    }
    
    squish(entity) {
        const squishedSize = entity.text ? 13 + ((entity.text.text.length % 32) + 2) : 13;
        const squished = new Array(squishedSize + 2);
        let squishedIndex = 0;
        squished[squishedIndex++] = 3;
        squished[squishedIndex++] = squished.length;
        squished[squishedIndex++] = entity.color[0];
        squished[squishedIndex++] = entity.color[1];
        squished[squishedIndex++] = entity.color[2];
        squished[squishedIndex++] = entity.color[3];

        squished[squishedIndex++] = Math.floor(entity.pos.x);
        squished[squishedIndex++] = Math.floor(100 * (entity.pos.x - Math.floor(entity.pos.x)));

        squished[squishedIndex++] = Math.floor(entity.pos.y);
        squished[squishedIndex++] = Math.floor( 100 * (entity.pos.y - Math.floor(entity.pos.y)));

        squished[squishedIndex++] = Math.floor(entity.size.x);
        squished[squishedIndex++] = Math.floor(100 * (entity.size.x - Math.floor(entity.size.x)));

        squished[squishedIndex++] = Math.floor(entity.size.y);
        squished[squishedIndex++] = Math.floor(100 * (entity.size.y - Math.floor(entity.size.y)));

        if (entity.text) {
            squished[squishedIndex++] = entity.text.x;
            squished[squishedIndex++] = entity.text.y;

            let textIndex = 0;
            while (squishedIndex < squished.length) {
                squished[squishedIndex++] = entity.text.text.charCodeAt(textIndex++);
            }
        }

        if (entity.assets) {
            for (const key in entity.assets) {
                console.log(key);
                console.log(key in this.assets);
            }
        }

        return squished;
    }

    getPixels() {
        return this.pixelBoard;
    }

    async getAssets() {
        if (this.assets && !this.assetBundle.length) {
            return this.initialize().then(_ => this.assetBundle);
        }

        return this.assetBundle;
    }
}

module.exports = Squisher;
