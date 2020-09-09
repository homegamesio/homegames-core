const { squish } = require('squishjs');
const config = require('../config');
const HomegamesRoot = require('./HomegamesRoot');
const HomegamesDashboard = require('./HomegamesDashboard');

const ASSET_TYPE = 1;

const INVISIBLE_NODE_PLAYER_ID = 0;

class Squisher {
    constructor(game) {
        this.assets = {};
        this.gameMetadata = game && game.constructor.metadata ? game.constructor.metadata() : null;
        this.ids = new Set();
        const isDashboard = game instanceof HomegamesDashboard;
        this.hgRoot = new HomegamesRoot(game, isDashboard);
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

            const encodedMaxLength = 10;
            let encodedLengthString = '';
            for (let i = 0; i < (encodedMaxLength - encodedLength.length); i++) {
                encodedLengthString += '0';
            }
            for (let j = encodedLength.length; j < encodedMaxLength; j++) {
                encodedLengthString +=  encodedLength.charAt(j - encodedLength.length);
            }
            const encodedLengthArray = new Array(encodedMaxLength);
            for (let i = 0; i < encodedMaxLength; i++) {
                encodedLengthArray[i] = encodedLength.charCodeAt(i);
            }
            this.assets[key] = [ASSET_TYPE, assetType, ...encodedLengthArray, ...assetKeyArray, ...payload];
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
        const playerFrames = {};
        const playerIds = new Set(Object.keys(this.game.players));
        for (const playerId of playerIds) {
            playerFrames[playerId] = [];
        }
        this.updateHelper(node, playerFrames, new Set([]));
        for (const playerId in playerFrames) {
            playerFrames[playerId] = playerFrames[playerId].flat();
        }
        this.playerFrames = playerFrames;

        return this.playerFrames;
    }

    getPlayerIds(node, ids) {
        for (const i in node.node.playerIds) {
            if (node.node.playerIds[i] !== 0) {
                ids.add(node.node.playerIds[i]);
            }
        }

        for (let i = 0; i < node.node.children.length; i++) {
            this.getPlayerIds(node.node.children[i], ids);
        }
    }

    updateHelper(node, playerFrames, whitelist) {
        if (!this.ids.has(node.node.id)) {
            this.ids.add(node.node.id);
            node.addListener(this);
        }

        const squished = squish(node.node);

        for (const i in node.node.playerIds) {
            whitelist.add(node.node.playerIds[i]);
        }

        const nodeIsInvisible = node.node.playerIds.length > 0 && 
            node.node.playerIds[0] === INVISIBLE_NODE_PLAYER_ID;

        // public node
        if (node.node.playerIds.length === 0 && whitelist.size == 0) {
            for (const playerId in playerFrames) {
                playerFrames[playerId].push(squished);
            }
        } else if (!nodeIsInvisible && !(whitelist.has(INVISIBLE_NODE_PLAYER_ID))) {
            for (const playerId of whitelist) {
                playerFrames[playerId].push(squished);
            }
        }

        for (let i = 0; i < node.node.children.length; i++) {
            this.updateHelper(node.node.children[i], playerFrames, whitelist);
        }

        for (const i in node.node.playerIds) {
            whitelist.delete(node.node.playerIds[i]);
        }

    }

    handleStateChange(node) {
        const playerFrames = this.update(this.hgRoot.getRoot());

        for (const listener of this.listeners) {
            listener.handleSquisherUpdate(playerFrames);
        }
    }
}

module.exports = Squisher;
