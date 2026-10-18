'use strict';

const { GameNode, Shapes, ShapeUtils } = require('squish-150');
const { THEMES } = require('./themes');
const BALL_COLORS = [[239, 133, 61, 255], [99, 175, 225, 255], [204, 133, 198, 255], [131, 197, 121, 255]];
const TAU = Math.PI * 2;
const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const C = {
    wall: [178, 204, 198, 255], lower: [151, 182, 176, 255],
    cream: [255, 249, 229, 255], line: [243, 223, 192, 255],
    floor: [213, 151, 117, 255], floorShade: [193, 128, 100, 255],
    ink: [58, 75, 72, 255], rim: [194, 78, 55, 255],
    ball: [239, 133, 61, 255], ballShade: [207, 97, 46, 255],
    seam: [122, 66, 42, 255], gold: [255, 214, 116, 255],
};
const alpha = (color, opacity) => [...color.slice(0, 3), Math.round(opacity * 255)];
// At a 1000px-wide court, the default polygon deviates from the ellipse by
// at most 0.25px until the original 40-segment ceiling is reached. Tiny lights,
// snow and aim dots need far fewer points than basketballs or court markings.
const ellipseSteps = (rx, ry) => Math.max(8, Math.min(40,
    Math.ceil(Math.PI / Math.acos(1 - Math.min(.025 / Math.max(rx, ry), 1)))));
const ellipse = (x, y, rx, ry = rx, steps = ellipseSteps(rx, ry)) => Array.from({ length: steps + 1 }, (_, i) => {
    const a = i * TAU / steps; return [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
});
const stroke = (points, width) => {
    const a = [], b = [];
    points.forEach(([x, y], i) => {
        const previous = points[Math.max(i - 1, 0)], next = points[Math.min(i + 1, points.length - 1)];
        const angle = Math.atan2(next[1] - previous[1], next[0] - previous[0]);
        const dx = Math.sin(angle) * width / 2, dy = Math.cos(angle) * width / 2;
        a.push([x - dx, y + dy]); b.unshift([x + dx, y - dy]);
    });
    return [...a, ...b, a[0]];
};
const shape = (points, fill, options = {}) => new GameNode.Shape({ shapeType: Shapes.POLYGON,
    coordinates2d: points, ...(fill ? { fill } : {}), ...options });
function add(parent, points, fill, options) { const node = shape(points, fill, options); parent.addChild(node, false); return node; }
function group(parent) { return add(parent, HIDDEN); }
function paint(node, points, fill) {
    node.node.coordinates2d = points;
    if (fill) node.node.fill = fill;
    node.node.onStateChange();
}

class Art {
    constructor(root, theme = 'classic') {
        this.root = root; this.theme = theme; this.colors = { ...C, ...THEMES[theme].colors };
        const colors = this.colors;
        add(root, ShapeUtils.rectangle(0, 0, 100, 100), colors.wall);
        // Keep the original court composition across seasons.
        add(root, [[0, 0], [37, 0], [82, 73], [33, 73], [0, 24], [0, 0]], colors.light);
        add(root, ShapeUtils.rectangle(0, 66, 100, 7), colors.lower);
        add(root, ShapeUtils.rectangle(0, 73, 100, 27), colors.floor);
        add(root, ShapeUtils.rectangle(0, 73, 100, 1), colors.floorShade);
        add(root, [[33, 74], [82, 74], [100, 100], [50, 100], [33, 74]], colors.floorLight);
        add(root, stroke([[0, 96], [100, 96]], .32), C.line);
        add(root, stroke(ellipse(50, 100, 33, 19), .32), C.line);
        add(root, stroke([[10, 100], [25, 77], [75, 77], [90, 100]], .32), C.line);
        this.decorate(root, theme);
        this.board = group(root); this.boardParts = [];
        const part = (points, color) => this.boardParts.push({ points, node: add(this.board, points, color) });
        part(ShapeUtils.rectangle(-12, -21, 27, 20), colors.boardShadow);
        part(ShapeUtils.rectangle(-13.5, -22.5, 27, 20), C.cream);
        part(ShapeUtils.rectangle(-12.3, -21.3, 24.6, 17.6), colors.glass);
        part(stroke([[-5.4, -3.2], [-5.4, -11], [5.4, -11], [5.4, -3.2]], .6), C.cream);
        part(ellipse(-11, -20, .35), colors.lower); part(ellipse(11, -20, .35), colors.lower);
        this.net = Array.from({ length: 13 }, () => add(root, HIDDEN, C.cream));
        this.rimBack = add(root, HIDDEN, C.rim);
        this.obstacleParts = Array.from({ length: 2 }, () => Array.from({ length: 16 }, () => add(root, HIDDEN, C.cream)));
        this.ballLayer = group(root); this.views = new Map();
        this.rimFront = add(root, HIDDEN, C.rim);
        this.rimShine = add(root, HIDDEN, C.cream);
        this.burst = Array.from({ length: 40 }, () => add(root, HIDDEN, C.gold));
        this.guide = add(root, HIDDEN, C.cream);
        this.guideRing = add(root, HIDDEN, C.cream);
        this.sparkRing = add(root, HIDDEN, C.gold);
        this.drawNodes = [...root.node.children];
    }
    drawHoop(h, celebration) {
        for (const p of this.boardParts) paint(p.node, p.points.map(([x, y]) => [h.x + x, h.y + y]));
        const stretch = celebration ? Math.sin(Math.min(1, celebration / .65) * Math.PI) * 3.8 : 0;
        const sway = celebration ? Math.sin(celebration * 18) * Math.exp(-celebration * 5) * 1.2 : 0;
        const top = h.half - .3, bottom = top * .58, depth = 9 + stretch;
        for (let i = 0; i < 6; i++) {
            for (const sign of [-1, 1]) {
                const cord = Array.from({ length: 5 }, (_, row) => {
                    const progress = row / 4, width = top + (bottom - top) * progress;
                    const t = Math.max(0, Math.min(1, i / 5 + (row % 2 ? sign * .1 : 0)));
                    return [h.x - width + width * 2 * t + sway * progress, h.y + .3 + (depth - .3) * progress];
                });
                paint(this.net[i + (sign === 1 ? 6 : 0)], stroke(cord, .23), alpha(C.cream, .9));
            }
        }
        paint(this.net[12], stroke([[h.x - bottom + sway, h.y + depth], [h.x + bottom + sway, h.y + depth]], .3));
        paint(this.rimBack, stroke(ellipse(h.x, h.y, h.half, 1.3), .65));
        paint(this.rimFront, stroke(Array.from({ length: 25 }, (_, i) => {
            const a = i * Math.PI / 24; return [h.x + Math.cos(a) * h.half, h.y + Math.sin(a) * 1.3];
        }), .85), celebration ? C.gold : C.rim);
        paint(this.rimShine, stroke([[h.x - h.half + 1, h.y + 1.2], [h.x + h.half - 1, h.y + 1.2]], .16), alpha(C.cream, .6));
    }
    addPlayer(id, seat) {
        const root = group(this.ballLayer), color = BALL_COLORS[seat];
        const view = { root, parts: [], shadow: add(root, HIDDEN, C.ink),
            halo: add(root, HIDDEN, C.cream, { playerIds: [id] }),
            dots: Array.from({ length: 7 }, () => add(root, HIDDEN, color, { playerIds: [id] })) };
        const part = (points, fill) => view.parts.push({ points, node: add(root, points, fill) });
        part(ellipse(0, 0, 2.8), C.seam);
        part(ellipse(0, -.06, 2.61), color.map((v, i) => i === 3 ? v : Math.round(v * .82)));
        part(ellipse(-.34, -.43, 2.18), color);
        part(stroke([[-2.7, 0], [2.7, 0]], .18), C.seam);
        part(stroke([[0, -2.7], [0, 2.7]], .18), C.seam);
        for (const sign of [-1, 1]) part(stroke(Array.from({ length: 17 }, (_, i) => {
            const y = -2.65 + i * 5.3 / 16; return [sign * (1.9 - y * y * .18), y];
        }), .15), C.seam);
        view.drawNodes = [...root.node.children];
        this.views.set(id, view);
    }
    removePlayer(id) { const view = this.views.get(id); if (view) this.ballLayer.removeChild(view.root.id); this.views.delete(id); }
    prune() {
        // Keep reusable visual slots in our arrays, but omit empty polygons
        // from complete scene frames. Original order and private scopes stay
        // intact. The ball layer remains live for joins and departures.
        const visible = node => node.node.children?.length ||
            node.node.coordinates2d?.some(([x, y]) => x !== 0 || y !== 0);
        this.root.node.children = this.drawNodes.filter(node => node === this.ballLayer || visible(node));
        for (const view of this.views.values()) view.root.node.children = view.drawNodes.filter(visible);
        // The game's draw() notifies its base after all slots are updated and
        // reattached, so even a previously omitted node reaches the next frame.
    }
    drawBall(ball, scale = 1, ready = false, shot = null, time = 0) {
        const view = this.views.get(ball.id); if (!view) return;
        const ca = Math.cos(ball.rotation), sa = Math.sin(ball.rotation);
        for (const part of view.parts) paint(part.node, part.points.map(([x, y]) => [
            ball.x + (x * ca - y * sa) * scale, ball.y + (x * sa + y * ca) * scale,
        ]));
        const height = Math.max(0, 88 - ball.y), width = Math.max(1.1, 3.6 - height * .025);
        paint(view.shadow, ellipse(ball.x, 91, width * scale, .65 * scale), [80, 70, 65, Math.round(Math.max(20, 100 - height))]);
        paint(view.halo, ready ? stroke(ellipse(ball.x, ball.y, 4.6 + Math.sin(time * 3) * .25), .18) : HIDDEN, alpha(C.cream, .6));
        this.aim(view, ball, shot);
    }
    aim(view, ball, shot) {
        // Only the first 0.22 seconds: direction and a hint of strength, never
        // the apex, descending arc, future obstacle collisions or landing point.
        view.dots.forEach((node, i) => {
            if (!shot) return paint(node, HIDDEN);
            const t = (i + 1) / view.dots.length * .22;
            const x = ball.x + shot.vx * t, y = ball.y + shot.vy * t + 50 * t * t;
            paint(node, ellipse(x, y, .38 - i * .025), alpha(C.cream, .9 - i * .09));
        });
    }
    decorate(root, theme) {
        if (theme === 'halloween') {
            add(root, ellipse(91, 23, 5), [240, 220, 169, 255]);
            add(root, ellipse(93, 21, 4.7), this.colors.wall);
            icon(root, 'halloween', 8, 78, 1);
            add(root, stroke([[0, 17], [10, 24], [0, 30]], .12), alpha(C.cream, .3));
            add(root, stroke([[0, 17], [6, 30]], .12), alpha(C.cream, .3));
        } else if (theme === 'christmas') {
            icon(root, 'christmas', 8, 76, 1.3);
            for (let i = 0; i < 13; i++) add(root, ellipse(4 + i * 7.7, 2 + Math.sin(i / 12 * Math.PI), .42), i % 2 ? C.gold : C.cream);
            for (let i = 0; i < 18; i++) add(root, ellipse(4 + i * 31 % 92, 18 + i * 17 % 48, .16), alpha(C.cream, .6));
        }
    }
    drawObstacles(objects, time) {
        this.obstacleParts.forEach((parts, slot) => {
            const o = objects[slot]; let n = 0;
            const put = (points, color) => paint(parts[n++], points, color);
            const line = (points, width, color) => put(stroke(points, width), color);
            const disk = (x, y, r, color, ry = r) => put(ellipse(x, y, r, ry), color);
            if (o?.kind === 'bar') {
                line([[o.ax, o.ay], [o.bx, o.by]], o.radius * 2, this.colors.accent);
                disk(o.ax, o.ay, o.radius, this.colors.accent); disk(o.bx, o.by, o.radius, this.colors.accent);
                line([[o.ax, o.ay], [o.bx, o.by]], .3, C.cream); disk(o.x, o.y, .8, C.gold);
            } else if (o?.kind === 'bumper') {
                disk(o.x, o.y, o.radius, this.colors.accent); disk(o.x, o.y, o.radius * .65, C.gold);
                disk(o.x, o.y, o.radius * .35, this.colors.accent);
            } else if (o?.kind === 'bat') {
                const flap = Math.sin(time * 12) * 1.1;
                for (const sign of [-1, 1]) put([[o.x, o.y], [o.x + sign * 2, o.y - 2], [o.x + sign * 5.3, o.y - 2.3 + flap],
                    [o.x + sign * 4.3, o.y + 1.6], [o.x + sign * 3, o.y + .5], [o.x + sign * 1.8, o.y + 1.8], [o.x, o.y]], [29, 23, 42, 255]);
                disk(o.x, o.y, 1.8, [29, 23, 42, 255]);
                for (const sign of [-1, 1]) { put([[o.x + sign * .4, o.y - 1], [o.x + sign * 1.5, o.y - 3], [o.x + sign * 1.7, o.y], [o.x + sign * .4, o.y - 1]], [29, 23, 42, 255]); disk(o.x + sign * .65, o.y - .2, .32, C.gold); }
            } else if (o?.kind === 'spider') {
                line([[o.x, 14], [o.x, o.y]], .12, alpha(C.cream, .7));
                for (const sign of [-1, 1]) for (let leg = 0; leg < 3; leg++) line([[o.x, o.y], [o.x + sign * 4, o.y - 2 + leg * 2], [o.x + sign * 5, o.y - 3 + leg * 3]], .28, [29, 23, 42, 255]);
                disk(o.x, o.y, o.radius, [29, 23, 42, 255]);
                disk(o.x - 1, o.y - .5, .6, C.cream); disk(o.x + 1, o.y - .5, .6, C.cream);
            } else if (o?.kind === 'ornament') {
                line([[50, 17], [o.x, o.y - o.radius]], .15, C.cream);
                put(ShapeUtils.rectangle(o.x - 1, o.y - 5, 2, 2), C.gold);
                disk(o.x, o.y, o.radius, [182, 64, 66, 255]);
                line([[o.x - 3.8, o.y], [o.x + 3.8, o.y]], .8, C.gold);
                disk(o.x - 1.3, o.y - 1.7, .7, alpha(C.cream, .65));
            } else if (o?.kind === 'present') {
                put(ShapeUtils.rectangle(o.x - o.hw, o.y - o.hh, o.hw * 2, o.hh * 2), [53, 122, 103, 255]);
                put(ShapeUtils.rectangle(o.x - .6, o.y - o.hh, 1.2, o.hh * 2), C.gold);
                put(ShapeUtils.rectangle(o.x - o.hw, o.y - .6, o.hw * 2, 1.2), C.gold);
                put(stroke(ellipse(o.x - 1, o.y - o.hh, 1, .7), .35), C.gold);
                put(stroke(ellipse(o.x + 1, o.y - o.hh, 1, .7), .35), C.gold);
            }
            while (n < parts.length) paint(parts[n++], HIDDEN);
        });
    }

    hint(x, y, opacity) {
        // A small translucent fingertip traces the gesture, never a text prompt.
        const finger = [[-.8, 4], [-2, 1.5], [-2, .9], [-1.6, .6], [-.7, 1.2], [-.7, -2.2], [-.4, -2.7], [.3, -2.7], [.7, -2.2], [.7, -.2], [2.6, .5], [3, 1.2], [2.6, 4], [-.8, 4]];
        paint(this.guide, opacity > 0 ? finger.map(([px, py]) => [px + x, py + y]) : HIDDEN, alpha(C.cream, opacity));
        paint(this.guideRing, opacity > 0 ? stroke(ellipse(x, y - 1.8, 1.6), .2) : HIDDEN, alpha(C.cream, opacity * .45));
    }
}

function text(parent, value, x, y, size, color = C.ink, align = 'center', playerIds) {
    const node = new GameNode.Text({ textInfo: { text: String(value), x, y, size: size / Math.SQRT2, color, align, font: 'Trebuchet MS, sans-serif' }, ...(playerIds ? { playerIds } : {}) });
    parent.addChild(node, false); return node;
}
function setText(node, value, color) {
    if (node.node.text.text === String(value) && !color) return;
    node.node.text = { ...node.node.text, text: String(value), ...(color ? { color } : {}) }; node.node.onStateChange();
}
function icon(root, theme, x, y, scale = 1) {
    const put = (points, fill) => add(root, points.map(([px, py]) => [x + px * scale, y + py * scale]), fill);
    if (theme === 'classic') {
        put(ellipse(0, 0, 3.2), C.ball); put(stroke([[-3.1, 0], [3.1, 0]], .22), C.seam);
        put(stroke([[0, -3.1], [0, 3.1]], .22), C.seam);
        put(stroke([[-2, -2.5], [-1.1, 0], [-2, 2.5]], .2), C.seam);
        put(stroke([[2, -2.5], [1.1, 0], [2, 2.5]], .2), C.seam);
    } else if (theme === 'halloween') {
        put(ShapeUtils.rectangle(-.4, -4.1, .8, 1.5), [84, 115, 78, 255]);
        put(ellipse(0, 0, 3.9, 3.3), C.ball); put(stroke(ellipse(0, 0, 1.8, 3.2), .18), C.ballShade);
        for (const sign of [-1, 1]) put([[sign * .7, -.4], [sign * 2.4, -.4], [sign * 1.6, -1.8], [sign * .7, -.4]], C.seam);
        put([[-1.8, 1], [0, 1.6], [1.8, 1], [1, 2.3], [-1, 2.3], [-1.8, 1]], C.seam);
    } else {
        put(ShapeUtils.rectangle(-.6, 2, 1.2, 2), C.seam);
        for (let i = 0; i < 3; i++) put([[0, -4 + i * 1.8], [2 + i, -.5 + i * 1.7], [-2 - i, -.5 + i * 1.7], [0, -4 + i * 1.8]], [55, 120 + i * 9, 99, 255]);
        put(ellipse(0, -4.3, .65, .65, 5), C.gold);
        put(ellipse(-1.2, .8, .4), C.rim); put(ellipse(.6, -1, .4), C.gold);
    }
}
module.exports = { Art, C, BALL_COLORS, HIDDEN, shape, add, group, paint, ellipse, stroke, alpha, text, setText, icon };
