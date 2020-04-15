const { squish } = require('squishjs');
const config = require('../config');
const HomegamesRoot = require('./HomegamesRoot');

const ASSET_TYPE = 1;

class Squisher {
    constructor(game) {
        this.assets = {};
        this.gameMetadata = game && game.constructor.metadata ? game.constructor.metadata() : null;
        this.width = this.gameMetadata ? this.gameMetadata.res.width : 1280;
        this.height = this.gameMetadata ? this.gameMetadata.res.height : 720;

        this.ids = new Set();
        this.hgRoot = new HomegamesRoot(game);
        this.game = game;
        this.listeners = new Set();
        this.hgRoot.getRoot().addListener(this);
        this.game && this.game.getRoot().addListener(this);
        this.game && this.update(this.hgRoot.getRoot());

        if (this.game.tick) {
            const tickRate = this.gameMetadata && this.gameMetadata.tickRate ? this.gameMetadata.tickRate : config.DEFAULT_TICK_RATE;
            setInterval(this.game.tick.bind(this.game), 1000 / tickRate);
        }
    }

    async initialize() {
        const gameAssets = this.game.getAssets ? this.game.getAssets() || {} : {};
        if (this.hgRoot.getAssets()) {
            Object.assign(gameAssets, this.hgRoot.getAssets());
        }
        
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
            
            const assetType = gameAssets[key].info.type === 'image' ? 1 : 2;

            this.assets[key] = [ASSET_TYPE, assetType, encodedLength.charCodeAt(0), encodedLength.charCodeAt(1), encodedLength.charCodeAt(2), encodedLength.charCodeAt(3), ...assetKeyArray, ...payload];
            assetBundleSize += this.assets[key].length;
        }

        const newAssetBundle = new Array(assetBundleSize);

        for (let index = 0; index < assetBundleSize; index++) {
            for (const key in this.assets) {
                for (let y = 0; y < this.assets[key].length; y++) {
                    newAssetBundle[index++] = this.assets[key][y];
                }
            }
        }

        this.assetBundle = newAssetBundle;

    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    removeListener(listener) {
        this.listeners.remove(listener);
    }

    update(node) {
        const newSquished = [];
        this.updateHelper(node, newSquished);
        this.squished = newSquished.flat();
    }

    updateHelper(node, squished) {
        if (!this.ids.has(node.id)) {
            this.ids.add(node.id);
            node.addListener(this);
        }
        const newSquish = squish(node);
        squished.push(newSquish);

        for (let i = 0; i < node.children.length; i++) {
            this.updateHelper(node.children[i], squished);
        }
    }

    handleStateChange(node) {
        // todo: fix this
        console.log('this is happening bruv');
        this.update(this.hgRoot.getRoot());//game.getRoot());
        for (const listener of this.listeners) {
            listener.handleSquisherUpdate(this.squished);
        }
    }
}

module.exports = Squisher;
