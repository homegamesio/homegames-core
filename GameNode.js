class GameNode {
    constructor(color, onClick, pos, size) {
        this.children = new Array();
        this.color = color;
        this.onClick = onClick;
        this.pos = pos;
        this.size = size;
    }

    addChild(node) {
        this.children.push(node);
        // hack to trigger onupdate. should be able to selectively re-render a subtree based on update, then tell client to only re-render updated part of canvas.
        this.children = this.children;
    }

    handleClick(x, y) {
        this.onClick(x, y);
    }
}

module.exports = GameNode;
