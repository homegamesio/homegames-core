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
    }

    handleClick() {
        this.onClick();
    }
}

module.exports = GameNode;
