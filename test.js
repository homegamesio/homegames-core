const { socketServer } = require('./src/util/socket');
const gameNode = require('./src/common/GameNode');
const Colors = require('./src/common/Colors');

const ASSET_TYPE = 1;

class Game {
    constructor() {
        this.players = {};
        this.listeners = new Set();
        this.root = null;
    }

    addPlayer(player) {
        this.players[player.id] = player;
    }

    removePlayer(playerId) {
        delete this.players[playerId];
    }

    addUpdateListener(listener) {
        this.listeners.add(listener);
    }

    getRoot() {
        return this.root;
    }

    initialize() {
        console.log("INITTING");
    }
}

class PerfTest extends Game {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: "Joseph Garcia"
        };
    }

    constructor() {
        super();
        this.base = gameNode(Colors.WHITE, (player) => {
        }, {"x": 0, "y": 0}, {"x": 100, "y": 100});

        let xCounter = 0;
        let yCounter = 0;

        const filler = setInterval(() => {
            let dot = gameNode(Colors.randomColor(), null, {x: xCounter, y: yCounter}, {x: 1, y: 1});
            this.base.addChild(dot);
            xCounter += 1;
            if (xCounter >= 100) {
                xCounter = 0;
                yCounter++;
            }

            if (yCounter == 100 && xCounter == 100) {
                clearInterval(filler);
            }

        }, 2);
    }

    getRoot() {
        return this.base;
    }
}

const thang = new PerfTest();

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

class GameSession {
    constructor(squisher) {
        this.game = squisher.game;
        this.squisher = squisher;
        this.squisher.addListener(this);
    }

    handleSquisherUpdate(squished) {
        for (const playerId in this.game.players) {
            this.game.players[playerId].receiveUpdate(squished);
        }
    }

    addPlayer(player) {
        this.squisher.assetBundle && player.receiveUpdate(this.squisher.assetBundle);
        player.receiveUpdate(this.squisher.squished);
        this.game.addPlayer(player);
    }

    handlePlayerDisconnect(player) {
    }

    initialize(cb) {
        if (this.initialized) {
            cb && cb();
        } else {
            this.squisher.initialize().then(() => {
                this.initialized = true;
                cb && cb();
            });
        }
    }
    
}

const squisher = new Squisher(thang);

const session = new GameSession(squisher);

session.initialize(() => {
    socketServer(session, 7000);
})
