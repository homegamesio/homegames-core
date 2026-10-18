const { GameNode, Shapes } = require('squish-150');

const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const WHITE = [232, 242, 250];
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const finite = n => Number.isFinite(n);
const TAU = Math.PI * 2;

// Real polygon clipping matters here: pinning individual offscreen vertices to
// the edge distorts the silhouettes of large worlds into screen-wide wedges.
function clipPolygon(points, rect) {
    let output = points;
    const edges = [
        [0, rect.x, 1], [0, rect.x + rect.w, -1],
        [1, rect.y, 1], [1, rect.y + rect.h, -1],
    ];
    for (const [axis, edge, sign] of edges) {
        if (!output.length) break;
        const input = output;
        output = [];
        let previous = input[input.length - 1];
        let previousInside = (previous[axis] - edge) * sign >= 0;
        for (const current of input) {
            const inside = (current[axis] - edge) * sign >= 0;
            if (inside !== previousInside) {
                const fraction = (edge - previous[axis]) / (current[axis] - previous[axis]);
                output.push([
                    previous[0] + (current[0] - previous[0]) * fraction,
                    previous[1] + (current[1] - previous[1]) * fraction,
                ]);
            }
            if (inside) output.push(current);
            previous = current;
            previousInside = inside;
        }
    }
    return output;
}

class Painter {
    constructor(root, { shapes = 900, texts = 180 } = {}) {
        this.root = root;
        this.shapes = [];
        this.texts = [];
        this.shapeNodes = [];
        this.textNodes = [];
        this.clip = null;
        this.previousShapes = 0;
        this.previousTexts = 0;
        for (let i = 0; i < shapes; i++) {
            const node = new GameNode.Shape({ shapeType: Shapes.POLYGON,
                coordinates2d: HIDDEN, color: [0, 0, 0, 0], fill: [0, 0, 0, 0] });
            root.addChild(node, false);
            this.shapes.push(node.node);
            this.shapeNodes.push(node);
        }
        for (let i = 0; i < texts; i++) {
            const node = new GameNode.Text({ textInfo: this.textInfo('', 0, 0, 1, WHITE, 'left', 0) });
            root.addChild(node, false);
            this.texts.push(node.node);
            this.textNodes.push(node);
        }
        this.begin();
    }

    begin() {
        this.si = 0;
        this.ti = 0;
        this.activeNodes = [];
        this.overflow = 0;
        this.culled = 0;
        this.clip = null;
        this.ox = 0;
        this.oy = 0;
        return this;
    }

    setClip(rect = null) { this.clip = rect; return this; }

    poly(points, fill, stroke, width = .13, alpha = 1) {
        if (!(alpha > 0) || !points || points.length < 3) { this.culled++; return; }
        let coordinates = points.filter(point => point && finite(point[0]) && finite(point[1]))
            .map(([x, y]) => [x + this.ox, y + this.oy]);
        if (coordinates.length < 3) { this.culled++; return; }
        // 44 source vertices leave room for intersections with all four edges;
        // each coordinate payload remains well below the 510-byte wire limit.
        if (coordinates.length > 44) {
            const input = coordinates;
            coordinates = Array.from({ length: 44 }, (_, i) => input[Math.floor(i * input.length / 44)]);
        }
        const rect = this.clip ? {
            x: Math.max(0, this.clip.x), y: Math.max(0, this.clip.y),
            w: Math.max(0, Math.min(160, this.clip.x + this.clip.w) - Math.max(0, this.clip.x)),
            h: Math.max(0, Math.min(90, this.clip.y + this.clip.h) - Math.max(0, this.clip.y)),
        } : { x: 0, y: 0, w: 160, h: 90 };
        coordinates = clipPolygon(coordinates, rect);
        if (coordinates.length < 3) { this.culled++; return; }
        if (coordinates.length > 49) {
            const input = coordinates;
            coordinates = Array.from({ length: 49 }, (_, i) => input[Math.floor(i * input.length / 49)]);
        }
        const node = this.shapes[this.si];
        if (!node) { this.overflow++; return; }
        this.activeNodes.push(this.shapeNodes[this.si]);
        this.si++;
        // Close stroked polygons explicitly; the client does not close its path.
        if (stroke) coordinates.push(coordinates[0]);
        node.coordinates2d = coordinates.map(([x, y]) => [x / 1.6, y / .9]);
        const color = stroke || fill || WHITE;
        node.color = [color[0], color[1], color[2], Math.round(clamp(alpha, 0, 1) * 255)];
        node.fill = fill ? [fill[0], fill[1], fill[2], 255] : undefined;
        node.border = stroke ? clamp(Math.round(width * 15.9375), 1, 255) : undefined;
        node.effects = undefined;
        return node;
    }

    rect(x, y, width, height, fill, alpha = 1) {
        if (!width || !height) return;
        return this.poly([[x, y], [x + width, y], [x + width, y + height], [x, y + height]], fill, null, 0, alpha);
    }

    line(x, y, xx, yy, color = WHITE, width = .13, alpha = 1) {
        const length = Math.hypot(xx - x, yy - y);
        if (!length) return;
        const dx = (yy - y) / length * width / 2;
        const dy = (xx - x) / length * width / 2;
        return this.poly([[x - dx, y + dy], [xx - dx, yy + dy], [xx + dx, yy - dy], [x + dx, y - dy]], color, null, 0, alpha);
    }

    ngon(x, y, radius, sides = 6, rotation = 0, fill, stroke, alpha = 1) {
        if (!(radius > 0)) return;
        sides = clamp(Math.floor(sides), 3, 40);
        const points = Array.from({ length: sides }, (_, i) => {
            const angle = rotation + i * TAU / sides;
            return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
        });
        return this.poly(points, fill, stroke, .13, alpha);
    }

    circle(x, y, radius, fill, stroke, alpha = 1) {
        return this.ngon(x, y, radius, Math.min(40, Math.max(10, Math.ceil(radius * 3))), 0, fill, stroke, alpha);
    }

    arc(x, y, radius, start, span, color = WHITE, width = .18, alpha = 1) {
        if (!(radius > 0) || !span || !(alpha > 0)) return;
        // Split long annular strips; no polygon exceeds 44 vertices even on a
        // complete orbit, and clipping cannot create a giant concave crescent.
        const pieces = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI * .66)));
        for (let part = 0; part < pieces; part++) {
            const a = start + span * part / pieces;
            const sweep = span / pieces;
            const steps = clamp(Math.ceil(Math.abs(sweep) * Math.max(4, radius * .4)), 3, 20);
            const points = [];
            for (let i = 0; i <= steps; i++) {
                const angle = a + sweep * i / steps;
                points.push([x + Math.cos(angle) * (radius + width / 2), y + Math.sin(angle) * (radius + width / 2)]);
            }
            for (let i = steps; i >= 0; i--) {
                const angle = a + sweep * i / steps;
                points.push([x + Math.cos(angle) * Math.max(0, radius - width / 2), y + Math.sin(angle) * Math.max(0, radius - width / 2)]);
            }
            this.poly(points, color, null, 0, alpha);
        }
    }

    textInfo(text, x, y, size, color, align, alpha) {
        // The text serializer multiplies size by hypot(scale.x, scale.y).
        // Complete objects are also necessary when clearing pooled text nodes.
        return { text: [...String(text)].slice(0, 128).join(''), x: x / 1.6, y: y / .9,
            size: Math.max(.1, size) / 1.6 / Math.SQRT2,
            color: [color[0], color[1], color[2], Math.round(clamp(alpha, 0, 1) * 255)],
            align, font: 'sans-serif' };
    }

    text(value, x, y, size = 1.6, color = WHITE, align = 'left', alpha = 1) {
        x += this.ox; y += this.oy;
        const clip = this.clip || { x: 0, y: 0, w: 160, h: 90 };
        if (x < clip.x || x > clip.x + clip.w || y < clip.y || y + size > clip.y + clip.h || !(alpha > 0)) {
            this.culled++; return;
        }
        const node = this.texts[this.ti];
        if (!node) { this.overflow++; return; }
        this.activeNodes.push(this.textNodes[this.ti]);
        this.ti++;
        node.text = this.textInfo(value, x, y, size, color, align, alpha);
        return node;
    }

    end() {
        for (let i = this.si; i < this.previousShapes; i++) {
            const node = this.shapes[i];
            node.coordinates2d = HIDDEN;
            node.color = [0, 0, 0, 0];
            node.fill = [0, 0, 0, 0];
            node.border = undefined;
            node.effects = undefined;
        }
        for (let i = this.ti; i < this.previousTexts; i++) {
            this.texts[i].text = this.textInfo('', 0, 0, 1, WHITE, 'left', 0);
        }
        this.previousShapes = this.si;
        this.previousTexts = this.ti;
        // Keep the allocated pools, but only expose live nodes to Squish. The
        // scene root is dedicated to this painter; input nodes live elsewhere.
        // Preserve operation order so modal panels cover earlier world labels.
        this.root.node.children = this.activeNodes;
        this.diagnostics = { shapes: this.si, texts: this.ti, overflow: this.overflow, culled: this.culled,
            shapeCapacity: this.shapes.length, textCapacity: this.texts.length };
        return this.diagnostics;
    }
}

module.exports = { Painter, HIDDEN, clipPolygon };
