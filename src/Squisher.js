const ASSET_TYPE = 1;

//class Squisher {
//    constructor(game) {
//        this.width = game.constructor.metadata ? game.constructor.metadata().res.width : 1280;
//        this.height = game.constructor.metadata ? game.constructor.metadata().res.height : 720;
//        this.game = game;
//        this.root = game.getRoot();
//        this.listeners = new Set();
//        this.assets = {};
//        this.initialize();
//    }
//
//    addListener(listener) {
//        this.listeners.add(listener);
//    }
//
//    removeListener(listener) {
//        this.listeners.remove(listener);
//    }
//
//    async initialize(cb) {
//        const gameAssets = this.game.getAssets ? this.game.getAssets() : [];
//        
//        this.squishedNodes = {};
//        this.ids = new Set();
//
//        let assetBundleSize = 0;
//
//        for (const key in gameAssets) {
//            const payload = await gameAssets[key].getData();
//            const assetKeyLength = 32;
//            let keyIndex = 0;
//            const assetKeyArray = new Array(32);
//            while (keyIndex < assetKeyLength && keyIndex < key.length) {
//                assetKeyArray[keyIndex] = key.charCodeAt(keyIndex);
//                keyIndex++;
//            }
//
//            const encodedLength = (payload.length + assetKeyLength).toString(36);
//            
//            const assetType = gameAssets[key].info.type === "image" ? 1 : 2;
//
//            this.assets[key] = [ASSET_TYPE, assetType, encodedLength.charCodeAt(0), encodedLength.charCodeAt(1), encodedLength.charCodeAt(2), encodedLength.charCodeAt(3), ...assetKeyArray, ...payload];
//            assetBundleSize += this.assets[key].length;
//        }
//
//        this.assetBundle = new Array(assetBundleSize);
//        
//        for (let index = 0; index < assetBundleSize; index++) {
//            for (const key in this.assets) {
//                for (let y = 0; y < this.assets[key].length; y++) {
//                    this.assetBundle[index++] = this.assets[key][y];
//                }
//            }
//        }
//
//        this.update(this.root);
//
//        if (this.game.renderType == "tick") {   
//            setInterval(this.game.tick.bind(this.game), 1000 / this.game.config.frameRate);
//        } else if (this.game.tick) {
//            setInterval(this.game.tick.bind(this.game), 16);
//        } else {
//            const heartbeat = this.notifyListeners.bind(this);
//            setInterval(heartbeat, 5000);
//        }
//
//        cb && cb();
//    }
//
//    handleStateChange(node) {
//        this.update(node);
//        this.checkCollisions(node);
//        this.notifyListeners();
//    }
//
//    checkCollisions(node, notify = true) {
//        const collidingNodes = this.collisionHelper(this.root, node);
//        if (notify && collidingNodes.length > 0) {
//            this.game.handleCollision && this.game.handleCollision([node, ...collidingNodes]);
//        }
//        return collidingNodes;
//    }
//
//    findClick(x, y, playerId = 0) {
//        return this.findClickHelper(x, y, playerId, this.root);
//    }
//
//    findClickHelper(x, y, playerId, node, clicked = null) {
//        if (node.handleClick && !node.playerId || playerId == node.playerId) {
//            const beginX = node.pos.x * this.width * .01;
//            const endX = (node.pos.x + node.size.x) * this.width * .01;
//            const beginY = node.pos.y * this.height * .01;
//            const endY = (node.pos.y + node.size.y) * this.height * .01;
//            const x1 = x * this.width;
//            const y1 = y * this.height;
//            const isClicked = (x1 >= beginX && x1 <= endX) && (y1 >= beginY && y1 <= endY);
//            if (isClicked) {
//                clicked = node;
//            }
//        }
//
//        for (const i in node.children) {
//            clicked = this.findClickHelper(x, y, playerId, node.children[i], clicked);
//        }
//
//        return clicked;
//    }
//
//    collisionHelper(node, nodeToCheck, collisions = []) {
//        if (node.pos && nodeToCheck.pos && node.handleClick && node.id !== nodeToCheck.id) {
//            const node1LeftX = this.width * .01 * (node.pos.x);
//            const node1RightX = this.width * .01 * (node.pos.x + node.size.x);
//            const node2LeftX = this.width * .01 * (nodeToCheck.pos.x);
//            const node2RightX = this.width * .01 * (nodeToCheck.pos.x + nodeToCheck.size.x);
//
//            const node1TopY = this.height * .01 * (node.pos.y);
//            const node1BottomY = this.height * .01 * (node.pos.y + node.size.y);
//            const node2TopY = this.height * .01 * (nodeToCheck.pos.y);
//            const node2BottomY = this.height * .01 * (nodeToCheck.pos.y + nodeToCheck.size.y);
//
//            const oneToTheLeft = node2RightX < node1LeftX || node1RightX < node2LeftX;
//            const oneBelow = node1TopY > node2BottomY || node2TopY > node1BottomY;
//            if (!(oneToTheLeft || oneBelow)) {
//                collisions.push(node);
//            }
//        }
//
//        for (const child in node.children) {
//            this.collisionHelper(node.children[child], nodeToCheck, collisions);
//        }
//
//        return collisions;
//    }
//
//    update(node) {
//        // todo: fix this
//        this.squishedNodes = {};
//        this.ids = new Set();
//        this.updateHelper(this.root);
//        this.updatePixelBoard();
//    }
//
//    updateHelper(node) {
//
//        if (!this.ids.has(node.id)) {
//            this.ids.add(node.id);
//            node.addListener(this);
//        }
//
//        this.squishedNodes[node.id] = this.squish(node);
//
//        for (let i = 0; i < node.children.length; i++) {
//            this.updateHelper(node.children[i]);
//        }
//    }
//
//    updatePixelBoard() {
//        this.pixelBoard = Array.prototype.concat.apply([], Object.values(this.squishedNodes));
//    }
//
//    notifyListeners() {
//        for (const listener of this.listeners) {
//            listener.handleUpdate(this.pixelBoard);
//        }
//    }
//
//    handlePlayerInput(player, input) {
//        if (input.type === "click") {
//            this.handleClick(player, input.data);
//        } else if (input.type === "keydown") { 
//            this.game.handleKeyDown && this.game.handleKeyDown(player, input.key);
//        } else if (input.type === "keyup") {
//            this.game.handleKeyUp && this.game.handleKeyUp(player, input.key);
//        } else {
//            console.log("Unknown input type: " + input.type);
//        }
//    }
//
//    handleClick(player, click) {
//        const translatedX = (click.x / this.width);
//        const translatedY = (click.y / this.height);
//        if (translatedX >= 1 || translatedY >= 1) {
//            return;
//        }
//        const clickedNode = this.findClick(translatedX, translatedY, player.id);
//        
//        if (clickedNode) {
//            clickedNode.handleClick && clickedNode.handleClick(player, translatedX, translatedY);
//        }
//    }
//    
//    squish(entity) {
//        // Type (1) + Player ID (1) + Size (1) + color (4) + pos (4) + size (4) + text position (2) + text size (1) + text (32) + assets (37 * assetCount)
//        // TODO: store type in array to stop sending unnecessary data 
//        const squishedSize = 1 + 1 + 1 + 4 + 4 + 4 + (entity.text ? 2 + + 1+ 32 : 0) + (entity.assets ? 37 * Object.keys(entity.assets).length : 0);
//
//        const squished = new Array(squishedSize);
//        let squishedIndex = 0;
//        squished[squishedIndex++] = 3;
//        squished[squishedIndex++] = entity.playerId;
//        squished[squishedIndex++] = squished.length;
// 
//        if (!(entity.pos && entity.color && entity.size)) {
//            return squished;
//        }
//        
//        squished[squishedIndex++] = entity.color[0];
//        squished[squishedIndex++] = entity.color[1];
//        squished[squishedIndex++] = entity.color[2];
//        squished[squishedIndex++] = entity.color[3];
//
//        squished[squishedIndex++] = Math.floor(entity.pos.x);
//        squished[squishedIndex++] = Math.floor(100 * (entity.pos.x - Math.floor(entity.pos.x)));
//
//        squished[squishedIndex++] = Math.floor(entity.pos.y);
//        squished[squishedIndex++] = Math.floor( 100 * (entity.pos.y - Math.floor(entity.pos.y)));
//
//        squished[squishedIndex++] = Math.floor(entity.size.x);
//        squished[squishedIndex++] = Math.floor(100 * (entity.size.x - Math.floor(entity.size.x)));
//
//        squished[squishedIndex++] = Math.floor(entity.size.y);
//        squished[squishedIndex++] = Math.floor(100 * (entity.size.y - Math.floor(entity.size.y)));
//
//        if (entity.text) {
//            squished[squishedIndex++] = entity.text && entity.text.x;
//            squished[squishedIndex++] = entity.text && entity.text.y;
//            squished[squishedIndex++] = entity.text.size || 12;
//
//            let textIndex = 0;
//            while (entity.text && textIndex < 32) {
//                if (textIndex < entity.text.text.length) {
//                    squished[squishedIndex++] = entity.text.text.charCodeAt(textIndex);
//                } else {
//                    squished[squishedIndex++] = null;
//                }
//                textIndex++;
//            }
//        }
//        
//        if (entity.assets) {
//            for (const key in entity.assets) {
//                const asset = entity.assets[key];
//                squished[squishedIndex++] = asset.pos.x;
//                squished[squishedIndex++] = asset.pos.y;
//                squished[squishedIndex++] = asset.size.x;
//                squished[squishedIndex++] = asset.size.y;
//                for (let i = 0; i < 32; i++) {
//                    if (i < key.length) {
//                        squished[squishedIndex++] = key.charCodeAt(i);
//                    } else {
//                        squished[squishedIndex++] = null;
//                    }
//                }
//            }
//        }
//
//        return squished;
//    }
//
//    getPixels() {
//        return this.pixelBoard;
//    }
//
//    getAssets() {
//        return this.assetBundle;
//    }
//}

class Squisher {
    constructor(game) {
        this.assets = {};
        this.gameMetadata = game.constructor.metadata ? game.constructor.metadata() : null;
        this.width = this.gameMetadata ? this.gameMetadata.res.width : 1280;
        this.height = this.gameMetadata ? this.gameMetadata.res.height : 720;

        this.ids = new Set();

        this.game = game;
        this.game.getRoot().addListener(this);
        this.listeners = new Set();
        setInterval(() => {
            this.handleStateChange();            
        }, 1000);

    }

    async initialize() {
        const gameAssets = this.game.getAssets ? this.game.getAssets() : [];
        
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

    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    removeListener(listener) {
        this.listeners.remove(listener);
    }

    update(node) {
        this.ids = new Set();
        let newSquished = [];
        // todo: fix this
        this.updateHelper(this.game.getRoot(), newSquished);
        this.squished = newSquished.flat();
    }

    updateHelper(node, squished) {
        squished.push(this.squish(node));

        for (let i = 0; i < node.children.length; i++) {
            this.updateHelper(node.children[i], squished);
        }
    }


    squish(entity) {
        // Type (1) + Player ID (1) + Size (1) + color (4) + pos (4) + size (4) + text position (2) + text size (1) + text (32) + assets (37 * assetCount)
        // TODO: store type in array to stop sending unnecessary data 
        const squishedSize = 1 + 1 + 1 + 4 + 4 + 4 + (entity.text ? 2 + + 1+ 32 : 0) + (entity.assets ? 37 * Object.keys(entity.assets).length : 0);

        const squished = new Array(squishedSize);
        let squishedIndex = 0;
        squished[squishedIndex++] = 3;
        squished[squishedIndex++] = entity.playerId;
        squished[squishedIndex++] = squished.length;
 
        if (!(entity.pos && entity.color && entity.size)) {
            return squished;
        }
        
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
            squished[squishedIndex++] = entity.text.size || 12;

            let textIndex = 0;
            while (entity.text && textIndex < 32) {
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

    handleStateChange(node) {
        this.update(this.game.getRoot());
        for (const listener of this.listeners) {
            listener.handleSquisherUpdate(this.squished);
        }
    }
}

module.exports = Squisher;
