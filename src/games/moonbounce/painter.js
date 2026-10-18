const { GameNode, Shapes } = require('squish-150');

const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const WHITE = [255, 245, 223];
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const TAU = Math.PI * 2;
const BODY_FONT = 'Trebuchet MS, sans-serif';
const DISPLAY_FONT = 'Arial Rounded MT Bold, Trebuchet MS, sans-serif';

// Reuse the scene graph every frame. All drawing coordinates are a 160 x 90
// world; the conversion preserves circles on the 16:9 Homegames canvas.
class Painter {
    constructor(root) {
        this.root = root;
        this.shapes = []; this.texts = []; this.shapeNodes = []; this.textNodes = []; this.images = [];
        for (let i = 0; i < 640; i++) {
            const node = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
            root.addChild(node, false); this.shapes.push(node.node); this.shapeNodes.push(node);
        }
        for (let i = 0; i < 110; i++) {
            const node = new GameNode.Text({ textInfo: this.textInfo('', 0, 0, 1, WHITE, 'left', 0) });
            root.addChild(node, false); this.texts.push(node.node); this.textNodes.push(node);
        }
        for (let i = 0; i < 4; i++) {
            const node = new GameNode.Asset({ coordinates2d: HIDDEN, assetInfo: {} });
            node.node.asset = undefined;
            root.addChild(node, false); this.images.push(node);
        }
        this.previousShapes = this.previousTexts = 0;
        this.begin();
    }

    begin() {
        this.si = this.ti = this.ii = this.overflow = 0;
        this.buttons = []; this.activeNodes = []; this.ox = this.oy = 0;
    }

    poly(points, fill, stroke, width = .13, alpha = 1) {
        if (!(alpha > 0) || points.length < 3) return;
        const n = this.shapes[this.si];
        if (!n) { this.overflow++; return; }
        this.activeNodes.push(this.shapeNodes[this.si]);
        this.si++;
        const coordinates = points.slice(0, 44).map(([x, y]) => [
            clamp((x + this.ox) / 1.6, 0, 99.99), clamp((y + this.oy) / .9, 0, 99.99),
        ]);
        if (stroke) coordinates.push(coordinates[0]);
        const c = stroke || fill || WHITE;
        n.coordinates2d = coordinates;
        // Fill opacity is controlled by the shape color in the Squish client.
        n.fill = fill ? [...fill.slice(0, 3), 255] : undefined;
        n.color = [...c.slice(0, 3), Math.round(clamp(alpha, 0, 1) * 255)];
        n.border = stroke ? clamp(Math.round(width * 15.9375), 1, 255) : undefined;
        n.effects = undefined;
    }

    rect(x, y, w, h, c, alpha = 1) {
        if (!(w > 0 && h > 0)) return;
        this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], c, null, 0, alpha);
    }

    roundRect(x, y, w, h, r, fill, stroke, alpha = 1) {
        r = Math.min(r, w / 2, h / 2);
        const points = [];
        for (const [cx, cy, start] of [[x + w - r, y + r, -Math.PI / 2],
            [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]]) {
            for (let i = 0; i <= 3; i++) {
                const a = start + i * Math.PI / 6;
                points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
            }
        }
        this.poly(points, fill, stroke, .12, alpha);
    }

    line(x, y, xx, yy, c, width = .14, alpha = 1) {
        const length = Math.hypot(xx - x, yy - y);
        if (!length) return;
        const dx = (yy - y) / length * width / 2, dy = (xx - x) / length * width / 2;
        this.poly([[x - dx, y + dy], [xx - dx, yy + dy], [xx + dx, yy - dy], [x + dx, y - dy]], c, null, 0, alpha);
    }

    ngon(x, y, r, sides, rotation, fill, stroke, alpha = 1) {
        if (!(r > 0)) return;
        sides = clamp(sides, 3, 40);
        this.poly(Array.from({ length: sides }, (_, i) => {
            const a = rotation + i * TAU / sides;
            return [x + Math.cos(a) * r, y + Math.sin(a) * r];
        }), fill, stroke, .12, alpha);
    }

    circle(x, y, r, fill, stroke, alpha = 1) {
        this.ngon(x, y, r, Math.min(32, Math.max(10, Math.ceil(r * 2))), 0, fill, stroke, alpha);
    }

    arc(x, y, r, start, span, c, width = .18, alpha = 1) {
        // Split rings to respect Squish's single-byte coordinate payload length.
        const pieces = Math.max(1, Math.ceil(Math.abs(span) / Math.PI));
        for (let part = 0; part < pieces; part++) {
            const a = start + span * part / pieces, sweep = span / pieces;
            const steps = Math.min(19, Math.max(3, Math.ceil(Math.abs(sweep) * Math.max(4, r * .25))));
            const pts = [];
            for (let i = 0; i <= steps; i++) {
                const t = a + sweep * i / steps;
                pts.push([x + Math.cos(t) * (r + width / 2), y + Math.sin(t) * (r + width / 2)]);
            }
            for (let i = steps; i >= 0; i--) {
                const t = a + sweep * i / steps;
                pts.push([x + Math.cos(t) * Math.max(0, r - width / 2), y + Math.sin(t) * Math.max(0, r - width / 2)]);
            }
            this.poly(pts, c, null, 0, alpha);
        }
    }

    star(x, y, r, c, alpha = 1) {
        this.poly([[x, y - r], [x + r * .25, y - r * .25], [x + r, y],
            [x + r * .25, y + r * .25], [x, y + r], [x - r * .25, y + r * .25],
            [x - r, y], [x - r * .25, y - r * .25]], c, null, 0, alpha);
    }

    textInfo(text, x, y, size, c, align, alpha, font = BODY_FONT) {
        return { text: String(text).slice(0, 128), x: x / 1.6, y: y / .9,
            size: size / 1.6 / Math.SQRT2, font, align,
            color: [...c.slice(0, 3), Math.round(clamp(alpha, 0, 1) * 255)] };
    }

    text(text, x, y, size = 1.6, c = WHITE, align = 'left', alpha = 1, font = BODY_FONT) {
        const n = this.texts[this.ti];
        if (!n) { this.overflow++; return; }
        this.activeNodes.push(this.textNodes[this.ti]);
        this.ti++;
        n.text = this.textInfo(text, x + this.ox, y + this.oy, size, c, align, alpha, font);
    }

    heading(text, x, y, size = 3, c = WHITE, align = 'left', alpha = 1) {
        this.text(text, x, y, size, c, align, alpha, DISPLAY_FONT);
    }

    image(key, x, y, w, h, alpha = 1, crop = {}) {
        const node = this.images[this.ii++];
        if (!node) { this.overflow++; return; }
        node.node.coordinates2d = HIDDEN;
        node.node.color = [255, 255, 255, Math.round(clamp(alpha, 0, 1) * 255)];
        node.node.asset = { [key]: { pos: { x: (x + this.ox) / 1.6, y: (y + this.oy) / .9 },
            size: { x: w / 1.6, y: h / .9 }, ...crop } };
        this.activeNodes.push(node);
    }

    button(label, x, y, w, h, action, primary = false, small = false) {
        const focused = this.focusAction === action || this.hoverAction === action;
        const fill = primary ? focused ? [255, 212, 101] : [255, 181, 64] : focused ? [111, 75, 160] : [56, 42, 94];
        this.roundRect(x, y + .7, w, h, 1.8, primary ? [142, 64, 62] : [23, 23, 51]);
        this.roundRect(x, y, w, h, 1.8, fill, focused ? WHITE : primary ? [255, 238, 159] : [140, 105, 177]);
        this.line(x + 2, y + .7, x + w - 2, y + .7, primary ? [255, 245, 179] : [157, 122, 193], .23, .8);
        this.heading(label, x + w / 2, y + (h - (small ? 2.6 : 3.2)) / 2 - .1,
            small ? 2.6 : 3.2, primary ? [75, 37, 48] : WHITE, 'center');
        this.buttons.push({ x, y, w, h, action });
    }

    end() {
        for (let i = this.si; i < this.previousShapes; i++) this.shapes[i].coordinates2d = HIDDEN;
        for (let i = this.ti; i < this.previousTexts; i++) this.texts[i].text = this.textInfo('', 0, 0, 1, WHITE, 'left', 0);
        this.previousShapes = Math.min(this.si, this.shapes.length);
        this.previousTexts = Math.min(this.ti, this.texts.length);
        // Rendering order also controls text stacking. Inactive pool members
        // stay allocated but are omitted from the transmitted scene graph.
        this.root.node.children = this.activeNodes;
        this.diagnostics = { shapes: this.si, texts: this.ti, images: this.ii, overflow: this.overflow };
    }
}

module.exports = { Painter, HIDDEN };
