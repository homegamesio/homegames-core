'use strict';
const { GameNode, Shapes, ShapeUtils } = require('squish-150');

const C = {
    ink: [18, 31, 40, 255], panel: [27, 46, 55, 255], line: [45, 66, 73, 255],
    paper: [248, 242, 220, 255], muted: [169, 190, 187, 255],
    gold: [255, 199, 91, 255], mint: [129, 222, 184, 255],
    coral: [255, 136, 112, 255], blue: [137, 192, 239, 255], purple: [196, 171, 244, 255],
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function polygon(x, y, radius, sides = 24, aspect = 1.6) {
    return Array.from({ length: sides }, (_, i) => {
        const a = i * Math.PI * 2 / sides - Math.PI / 2;
        return [x + Math.cos(a) * radius, y + Math.sin(a) * radius * aspect];
    });
}
function shape(points, fill, extra = {}) {
    return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: points, fill, ...extra });
}
function rect(x, y, w, h, fill, extra) { return shape(ShapeUtils.rectangle(x, y, w, h), fill, extra); }
function group(playerId) { return rect(0, 0, 0, 0, C.ink, playerId === undefined ? {} : { playerIds: [playerId] }); }
class UI {
    constructor(root) { this.root = root; }
    add(node) { this.root.addChild(node); return node; }
    rect(x, y, w, h, color, extra) { return this.add(rect(x, y, w, h, color, extra)); }
    shape(points, color, extra) { return this.add(shape(points, color, extra)); }
    text(text, x, y, size = 1.6, color = C.paper, align = 'left', font = 'default') {
        return this.add(new GameNode.Text({ textInfo: { text: String(text), x, y, size, color, align, font } }));
    }
    lines(lines, x, y, size = 1.5, color = C.muted, spacing = size * 2.25) {
        return lines.map((line, i) => this.text(line, x, y + i * spacing, size, color));
    }
    button(label, x, y, w, action, color = C.gold, h = 7, extra = {}) {
        const button = this.rect(x, y, w, h, color, { onClick: action, ...extra });
        new UI(button).text(label, x + w / 2, y + (h - 2.8) / 2, 1.75, C.ink, 'center');
        return button;
    }
}
function setText(node, value) {
    if (node && node.node.text.text !== String(value)) {
        node.node.text.text = String(value); node.node.onStateChange();
    }
}
function robot(root, x, y, size, design = {}) {
    const u = new UI(root), color = [C.gold, C.mint, C.coral][design.color || 0];
    const body = design.shape === 1 ? polygon(x, y, size, 3) : design.shape === 2
        ? polygon(x, y, size) : ShapeUtils.rectangle(x - size, y - size * 1.2, size * 2, size * 2.4);
    u.shape(body, color, design.glow ? { effects: { shadow: { color, blur: 14 } } } : {});
    u.rect(x - size * .5, y - size * .2, size * .26, size * .4, C.ink);
    u.rect(x + size * .24, y - size * .2, size * .26, size * .4, C.ink);
    u.rect(x - size * .25, y + size * .5, size * .5, size * .12, C.ink);
    u.rect(x - size * .09, y - size * 1.8, size * .18, size * .6, C.paper);
    u.shape(polygon(x, y - size * 1.9, size * .22, 10), C.coral);
}
module.exports = { C, UI, clamp, polygon, rect, group, robot, setText };
