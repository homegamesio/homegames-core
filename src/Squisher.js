const squishMap = require('./common/squish-map');
let { squish, unsquish } = squishMap['063'];

const HomegamesRoot = require('./HomegamesRoot');
const HomegamesDashboard = require('./HomegamesDashboard');

const ASSET_TYPE = 1;

const INVISIBLE_NODE_PLAYER_ID = 0;

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const DEFAULT_TICK_RATE = getConfigValue('DEFAULT_TICK_RATE', 60);
const BEZEL_SIZE_X = getConfigValue('BEZEL_SIZE_X', 15);
const BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 15);

class Squisher {
    constructor(game) {
        this.gameMetadata = game && game.constructor.metadata ? game.constructor.metadata() : null;
        if (this.gameMetadata && this.gameMetadata.squishVersion) {
            const squishVersion = squishMap[this.gameMetadata.squishVersion];
            squish = squishVersion.squish;
            unsquish = squishVersion.unsquish;

        } else {
            const squishVersion = squishMap['063'];
            squish = squishVersion.squish;
            unsquish = squishVersion.unsquish;
        }
        this.assets = {};

        this.ids = new Set();
        const isDashboard = game instanceof HomegamesDashboard;
        this.hgRoot = new HomegamesRoot(game, isDashboard);
        this.game = game;
        this.listeners = new Set();
        this.hgRoot.getRoot().addListener(this);
        this.game && this.game.getRoot().addListener(this);
        this.game && this.update(this.hgRoot.getRoot());

        if (this.game.tick) {
            const tickRate = this.gameMetadata && this.gameMetadata.tickRate ? this.gameMetadata.tickRate : DEFAULT_TICK_RATE;
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
        const playerFrames = {'public': []};
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

    updateHelper(node, playerFrames, whitelist, scale) {
        if (this.game.getRoot() === node) {
            scale = {
                x: (100 - BEZEL_SIZE_X) / 100,
                y: (100 - BEZEL_SIZE_Y) / 100
            };
        }

        if (!this.ids.has(node.node.id)) {
            this.ids.add(node.node.id);
            node.addListener(this);
        }

        const squished = squish(node.node, scale);

        for (const i in node.node.playerIds) {
            whitelist.add(node.node.playerIds[i]);
        }

        const nodeIsInvisible = node.node.playerIds.length > 0 && 
            node.node.playerIds[0] === INVISIBLE_NODE_PLAYER_ID;

        // public node
        if (node.node.playerIds.length === 0 && whitelist.size == 0) {
            playerFrames['public'].push(squished);
            for (const playerId in playerFrames) {
                playerFrames[playerId].push(squished);
            }
        } else if (!nodeIsInvisible && !(whitelist.has(INVISIBLE_NODE_PLAYER_ID))) {
            for (const playerId of whitelist) {
                playerFrames[playerId].push(squished);
            }
        }

        for (let i = 0; i < node.node.children.length; i++) {
            this.updateHelper(node.node.children[i], playerFrames, whitelist, scale);
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
