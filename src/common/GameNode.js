const listenable = require("./util/listenable");

let id = 0;

class GameNode {
    constructor(color, onClick, pos, size, text, assets, playerId = 0) {
        this.id = id++;
        this.children = new Array();
        this.color = color;
        this.handleClick = onClick;
        this.pos = pos;
        this.size = size;
        this.text = text;
        this.assets = assets;
        this.listeners = new Set();
        this.playerId = Number(playerId);
    }

    addChild(node) {
        this.children.push(node);
        this.onStateChange();
    }

    removeChild(nodeId) {
        const removeIndex = this.children.findIndex(child => child.id == nodeId);
        removeIndex >= 0 && this.children.splice(removeIndex, 1);
    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    onStateChange() {
        for (let listener of this.listeners) {
            listener.handleStateChange(this);
        }
    }

    clearChildren() {
        this.children = new Array();
    }
}

const gameNode = (color, onClick, pos, size, text, assets, playerId) => {
    const node = new GameNode(color, onClick, pos, size, text, assets, playerId);
    return listenable(node, node.onStateChange.bind(node));
};

module.exports = gameNode;
