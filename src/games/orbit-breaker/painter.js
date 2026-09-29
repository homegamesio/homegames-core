const { GameNode, Shapes } = require('squish-142');
const { clamp } = require('./engine');
const { C } = require('./settings');
const HIDDEN = [[0, 0], [0, 0], [0, 0]];

// A fixed pool per screen. Geometry uses a 160 x 90 world, not stretched circles.
class Painter {
    constructor(root, phase) {
        this.shapes = []; this.texts = [];
        for (let i = 0; i < (phase === 'play' ? 400 : 180); i++) {
            const node = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
            root.addChild(node, false); this.shapes.push(node.node);
        }
        for (let i = 0; i < 65; i++) {
            const node = new GameNode.Text({ textInfo: { text: '', x: 0, y: 0, size: 1, color: C.white } });
            root.addChild(node, false); this.texts.push(node.node);
        }
    }
    begin() { this.si = this.ti = this.overflow = 0; this.buttons = []; this.ox = this.oy = 0; }
    poly(points, fill, stroke, width = .13, alpha = 1, glow = false) {
        const n = this.shapes[this.si++]; if (!n) { this.overflow++; return; }
        const color = stroke || fill || C.white;
        n.coordinates2d = points.map(([x, y]) => [clamp((x + this.ox) / 1.6, 0, 99.99), clamp((y + this.oy) / .9, 0, 99.99)]);
        n.fill = fill ? [...fill.slice(0, 3), 255] : undefined;
        n.color = [...color.slice(0, 3), Math.round(clamp(alpha, 0, 1) * 255)];
        n.border = stroke ? Math.max(1, Math.round(width * 15.9375)) : undefined;
        n.effects = glow ? { shadow: { color: [...color.slice(0, 3), 255], blur: 9 } } : undefined;
    }
    rect(x, y, w, h, c, alpha = 1) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], c, null, 0, alpha); }
    line(x, y, xx, yy, c, width = .12, alpha = 1) {
        const a = Math.atan2(yy - y, xx - x), dx = Math.sin(a) * width / 2, dy = Math.cos(a) * width / 2;
        this.poly([[x - dx, y + dy], [xx - dx, yy + dy], [xx + dx, yy - dy], [x + dx, y - dy]], c, null, 0, alpha);
    }
    arc(x, y, r, start, span, c, width = .18, alpha = 1, glow = false) {
        const points = [], steps = Math.max(4, Math.ceil(Math.abs(span) * 6));
        for (let i = 0; i <= steps; i++) { const a = start + span * i / steps; points.push([x + Math.cos(a) * (r + width / 2), y + Math.sin(a) * (r + width / 2)]); }
        for (let i = steps; i >= 0; i--) { const a = start + span * i / steps; points.push([x + Math.cos(a) * (r - width / 2), y + Math.sin(a) * (r - width / 2)]); }
        this.poly(points, c, null, 0, alpha, glow);
    }
    ngon(x, y, r, sides, rotation, fill, stroke, alpha = 1, glow = false) {
        const points = Array.from({ length: sides + 1 }, (_, i) => [x + Math.cos(rotation + i * Math.PI * 2 / sides) * r, y + Math.sin(rotation + i * Math.PI * 2 / sides) * r]);
        this.poly(points, fill, stroke, .13, alpha, glow);
    }
    text(text, x, y, size = 1.6, c = C.white, align = 'left', alpha = 1) {
        const n = this.texts[this.ti++]; if (!n) { this.overflow++; return; }
        n.text = { text: String(text), x: x / 1.6, y: y / .9, size: size / 1.6 / Math.SQRT2,
            color: [...c.slice(0, 3), Math.round(clamp(alpha, 0, 1) * 255)], align, font: 'sans-serif' };
    }
    button(label, x, y, w, h, action, selected = false) {
        this.rect(x, y, w, h, selected ? C.teal : C.panel);
        this.rect(x, y, .4, h, selected ? C.white : C.line);
        this.text(label, x + 2.5, y + h / 2 - .9, 1.8, selected ? C.bg : C.white);
        this.text(selected ? '>' : '+', x + w - 3, y + h / 2 - .9, 1.8, selected ? C.bg : C.muted);
        this.buttons.push({ x, y, w, h, action });
    }
    end() {
        for (let i = this.si; i < this.shapes.length; i++) { this.shapes[i].coordinates2d = HIDDEN; this.shapes[i].effects = undefined; }
        for (let i = this.ti; i < this.texts.length; i++) this.texts[i].text = { ...this.texts[i].text, text: '' };
    }
}
module.exports = { Painter, HIDDEN };
