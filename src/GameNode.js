const listenable = require('./listenable');

class GameNode {
    constructor(color, onClick, pos, size) {
        this.children = new Array();
        this.color = color;
        this.handleClick = onClick;
        this.pos = pos;
        this.size = size;
        this.listeners = new Set();
    }

    addChild(node) {
        this.children.push(node);
        // hack to trigger onupdate. should be able to selectively re-render a subtree based on update, then tell client to only re-render updated part of canvas.
        this.children = this.children;
    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    onStateChange() {
        for (let listener of this.listeners) {
            listener.handleStateChange(this);
        }
    }
}

const gameNode = (color, onClick, pos, size) => {
    const node = new GameNode(color, onClick, pos, size);
    return listenable(node, node.onStateChange.bind(node));
}

module.exports = gameNode;
