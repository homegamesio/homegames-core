const ASSET_TYPE = 1;

class Squisher {
    constructor(width, height, game) {
        this.width = width;
        this.height = height;
        this.game = game;
        this.root = game.getRoot();
        this.listeners = new Set();
        this.assets = {};
        this.initialize();
        this.pastFirst = true;
    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    removeListener(listener) {
        this.listeners.remove(listener);
    }

    async initialize() {
        const gameAssets = this.game.getAssets ? this.game.getAssets() : [];
        
        this.stuff = {};
        this.ids = new Set();

        let assetBundleSize = 0;

        for (const key in gameAssets) {
            const payload = await gameAssets[key].getData();
            const assetKeyLength = 32;
            let keyIndex = 0;
            const assetKeyArray = new Array(32);
            while (keyIndex < assetKeyLength && keyIndex < key.length) {
                assetKeyArray[keyIndex] = key.charCodeAt(keyIndex);
                keyIndex++;
            }

            const encodedLength = (payload.length + assetKeyLength).toString(36);
            
            const assetType = gameAssets[key].info.type === "image" ? 1 : 2;

            this.assets[key] = [ASSET_TYPE, assetType, encodedLength.charCodeAt(0), encodedLength.charCodeAt(1), encodedLength.charCodeAt(2), encodedLength.charCodeAt(3), ...assetKeyArray, ...payload];
            assetBundleSize += this.assets[key].length;
        }

        this.assetBundle = new Array(assetBundleSize);
        
        for (let index = 0; index < assetBundleSize; index++) {
            for (const key in this.assets) {
                for (let y = 0; y < this.assets[key].length; y++) {
                    this.assetBundle[index++] = this.assets[key][y];
                }
            }
        }

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
        }

        this.stuff[node.id] = this.squish(node);
        
        if (!this.pastFirst) {
            for (let i = Math.floor((node.pos.x/100) * this.width); i < this.width * ((node.pos.x/100) + (node.size.x/100)); i++) {
                for (let j = Math.floor((node.pos.y/100) * this.height); j < this.height * ((node.pos.y/100) + (node.size.y/100)); j++) {
        //      console.log("CHANGE AT " + i + ', ' + j);
                //const prevNode = this.clickListeners[i * this.width + j];
                //if (prevNode && prevNode.handleClick) {
                //    const collisionKey = prevNode.id + ' ' + node.id;
                //    if (!this.collisionsRecorded.has(collisionKey)) {
                //        this.collisionsRecorded.add(collisionKey);
                //        this.game.handleCollision && this.game.handleCollision(prevNode, node);
                //    }
                //}
                    this.clickListeners[i * this.width + j] = node;
                }
            }
        }

        //console.log(this.squish(node));

        for (let i = 0; i < node.children.length; i++) {
            this.updateHelper(node.children[i]);
        }
    }

    updatePixelBoard() {
        //this.ids.forEach( {
        //    console.log("ay");
        //    console.log(nodeId);
        //}
        //const temp = new Array(this.entities.length);
        //for (let i = 0; i < this.entities.length; i++) {
        //    temp[i] = this.squish(this.entities[i]);
        //}
        //
        
        this.pixelBoard = Array.prototype.concat.apply([], Object.values(this.stuff));
        //this.pixelBoard = this.stuff[0].concat(this.stuff[1]);

        this.notifyListeners();
    }

    notifyListeners() {
        for (let listener of this.listeners) {
            listener.handleUpdate(this.pixelBoard);
        }
    }

    handlePlayerInput(player, input) {
        if (input.type === "click") {
            this.handleClick(player, input.data);
        } else if (input.type === "keydown") { 
            this.game.handleKeyDown && this.game.handleKeyDown(player, input.key);
        } else if (input.type === "keyup") {
            this.game.handleKeyUp && this.game.handleKeyUp(player, input.key);
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
        const node = this.clickListeners[click.x * this.width + click.y];
        if (node) {
            node.handleClick && node.handleClick(player, translatedX, translatedY);
        }
    }
    
    squish(entity) {
        // Type (1) + Size (1) + color (4) + pos (4) + size (4) + text position (2) + text (32) + assets (37 * assetCount)
        // TODO: store type in array to stop sending unnecessary data 
        let squishedSize = 1 + 1 + 4 + 4 + 4 + (entity.text ? 2 + 32 : 0) + (entity.assets ? 37 * Object.keys(entity.assets).length : 0);

        const squished = new Array(squishedSize);
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
            squished[squishedIndex++] = entity.text && entity.text.x;
            squished[squishedIndex++] = entity.text && entity.text.y;

            let textIndex = 0;
            while (textIndex < 32) {
                if (textIndex < entity.text.text.length) {
                    squished[squishedIndex++] = entity.text.text.charCodeAt(textIndex);
                } else {
                    squished[squishedIndex++] = null;
                }
                textIndex++;
            }
        }

        if (entity.assets) {
            for (const key in entity.assets) {
                const asset = entity.assets[key];
                squished[squishedIndex++] = asset.pos.x;
                squished[squishedIndex++] = asset.pos.y;
                squished[squishedIndex++] = asset.size.x;
                squished[squishedIndex++] = asset.size.y;
                for (let i = 0; i < 32; i++) {
                    if (i < key.length) {
                        squished[squishedIndex++] = key.charCodeAt(i);
                    } else {
                        squished[squishedIndex++] = null;
                    }
                }
            }
        }

        return squished;
    }

    getPixels() {
        return this.pixelBoard;
    }

    getAssets() {
        return this.assetBundle;
    }
}

module.exports = Squisher;
