const listenable = require("./util/listenable");

let id = 0;

class GameNode {
    constructor(color, onClick, pos, size, text, assets) {
        this.id = id++;
        this.children = new Array();
        this.color = color;
        this.handleClick = onClick;
        this.pos = pos;
        this.size = size;
        this.text = text;
        this.assets = assets;
        this.listeners = new Set();
    }

    addChild(node) {
        this.children.push(node);
        this.onStateChange();
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

const gameNode = (color, onClick, pos, size, text, assets) => {
    const node = new GameNode(color, onClick, pos, size, text, assets);
    return listenable(node, node.onStateChange.bind(node));
};

module.exports = gameNode;
