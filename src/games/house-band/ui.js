'use strict';
const { GameNode, Shapes, ShapeUtils } = require('squish-150');
const C = { ink: [19, 26, 39, 255], panel: [28, 37, 52, 255], line: [48, 59, 76, 255], muted: [159, 176, 192, 255],
    white: [248, 244, 231, 255], coral: [255, 132, 110, 255], mint: [141, 230, 194, 255], gold: [245, 204, 118, 255], violet: [187, 166, 246, 255] };
const COLORS = [C.coral, C.gold, C.violet, C.mint];
const circle = (x, y, r) => Array.from({ length: 13 }, (_, i) => [x + Math.cos(i * Math.PI / 6) * r, y + Math.sin(i * Math.PI / 6) * r]);
class UI {
    constructor(root) { this.root = root; this.hits = []; }
    shape(points, fill, extra = {}, parent = this.root) {
        // Squish hit-tests the topmost shape, including decorative children.
        // Lights and pad markings must forward their containing control.
        const node = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: points, ...(fill ? { fill } : {}),
            onClick: parent.node.handleClick, onDrag: parent.node.onDrag, offClick: parent.node.offClick, ...extra });
        parent.addChild(node, false); return node;
    }
    rect(x, y, w, h, fill, extra = {}, parent) { return this.shape(ShapeUtils.rectangle(x, y, w, h), fill, extra, parent); }
    text(text, x, y, size = 2, color = C.white, align = 'left', parent = this.root) {
        const node = new GameNode.Text({ textInfo: { text: String(text), x, y, size, color, align, font: 'sans-serif' } });
        parent.addChild(node, false); return node;
    }
    button(label, x, y, w, h, action, color = C.panel, size = 2.2) {
        this.hits.push({ x, y, w, h, action });
        const node = this.rect(x, y, w, h, color, { onClick: action });
        if (size) node.label = this.text(label, x + w / 2, y + (h - size) / 2, size, color === C.panel || color === C.line ? C.white : C.ink, 'center', node);
        return node;
    }
    static set(node, value) { node.node.text.text = String(value); }
    static move(node, x, y, w, h) { node.node.coordinates2d = ShapeUtils.rectangle(x, y, w, h); }
}
module.exports = { UI, C, COLORS, circle };
