'use strict';
const { GameNode, Shapes } = require('squish-150');
const { TOWERS, ENEMIES, THEMES, stats, clamp, fieldFor } = require('./content');
const { VIEWPORT, worldToScreen } = require('./camera');
const C = { ink: [44, 48, 47], deep: [47, 66, 61], cream: [255, 239, 202], paper: [247, 222, 176], muted: [166, 155, 125], gold: [250, 190, 65], red: [206, 88, 68], mint: [124, 198, 158], white: [255, 250, 229], brown: [111, 74, 54] };
const tint = (c, v) => c.slice(0, 3).map(n => clamp(Math.round(n * v), 0, 255));
const ring = (x, y, rx, ry = rx, n = 12, angle = 0) => Array.from({ length: n }, (_, i) => [x + Math.cos(angle + i / n * Math.PI * 2) * rx, y + Math.sin(angle + i / n * Math.PI * 2) * ry]);
function clip(points, bounds = { x: 0, y: 0, w: 159.98, h: 99.98 }) {
    let out = points;
    for (const [axis, bound, sign] of [[0, bounds.x, 1], [0, bounds.x + bounds.w, -1], [1, bounds.y, 1], [1, bounds.y + bounds.h, -1]]) {
        const input = out; out = []; if (!input.length) break;
        let prev = input.at(-1), inside = (prev[axis] - bound) * sign >= 0;
        for (const p of input) {
            const next = (p[axis] - bound) * sign >= 0;
            if (next !== inside) { const t = (bound - prev[axis]) / (p[axis] - prev[axis]); const q = [prev[0] + (p[0] - prev[0]) * t, prev[1] + (p[1] - prev[1]) * t]; q[axis] = bound; out.push(q); }
            if (next) out.push(p); prev = p; inside = next;
        }
    }
    return out;
}
class Painter {
    constructor(root) { this.root = root; this.shapes = []; this.labels = []; this.limit = 4096; this.peak = 0; this.overflow = 0; }
    begin() { this.si = 0; this.ti = 0; this.nodes = []; this.buttons = []; this.overflow = 0; this.camera = null; }
    world(camera) { this.camera = camera; }
    screen() { this.camera = null; }
    poly(points, color, alpha = 1) {
        if (points.some(p => !p.every(Number.isFinite))) return;
        if (this.camera) points = clip(points.map(([x, y]) => { const p = worldToScreen(this.camera, x, y); return [p.x, p.y]; }), VIEWPORT);
        points = clip(points); if (points.length < 3 || alpha <= 0) return;
        if (this.si >= this.limit) { this.overflow++; return; }
        let n = this.shapes[this.si];
        if (!n) n = this.shapes[this.si] = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0], [0, 0], [0, 0]] });
        n.node.coordinates2d = [...points, points[0]].map(([x, y]) => [x / 1.6, y]);
        n.node.fill = [...color.slice(0, 3), 255]; n.node.color = [255, 255, 255, Math.round(clamp(alpha, 0, 1) * 255)];
        this.nodes.push(n); this.si++;
    }
    rect(x, y, w, h, c, a = 1) { if (w > 0 && h > 0) this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], c, a); }
    panel(x, y, w, h, c, bevel = 1) { this.poly([[x + bevel, y], [x + w - bevel, y], [x + w, y + bevel], [x + w, y + h - bevel], [x + w - bevel, y + h], [x + bevel, y + h], [x, y + h - bevel], [x, y + bevel]], c); }
    oval(x, y, rx, ry, c, a = 1, n = 12) { this.poly(ring(x, y, rx, ry, n), c, a); }
    line(x, y, tx, ty, w, c, a = 1) { const length = Math.hypot(tx - x, ty - y); if (!length) return; const dx = (ty - y) / length * w / 2, dy = (tx - x) / length * w / 2; this.poly([[x - dx, y + dy], [tx - dx, ty + dy], [tx + dx, ty - dy], [x + dx, y - dy]], c, a); }
    outline(x, y, r, c, a = 1, n = 28) {
        // Opposite winding cuts out the center. Fewer than 64 vertices keeps
        // Squish's one-byte polygon coordinate length from overflowing.
        const outer = ring(x, y, r, r, n), inner = ring(x, y, Math.max(0, r - .22), Math.max(0, r - .22), n);
        this.poly([...outer, outer[0], inner[0], ...inner.slice(1).reverse(), inner[0]], c, a);
    }
    star(x, y, r, c) { this.poly(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, s = i % 2 ? r * .46 : r; return [x + Math.cos(a) * s, y + Math.sin(a) * s]; }), c); }
    text(value, x, y, size = 2, c = C.ink, align = 'left', bold = false) {
        if (this.camera) {
            const p = worldToScreen(this.camera, x, y); x = p.x; y = p.y; size *= this.camera.zoom;
            if (x < VIEWPORT.x || x > VIEWPORT.x + VIEWPORT.w || y < VIEWPORT.y || y + size > VIEWPORT.y + VIEWPORT.h) return;
        }
        if (x < 0 || x > 160 || y < 0 || y > 99 || this.ti >= 180) return;
        const textInfo = { text: String(value).slice(0, 120), x: x / 1.6, y, size: size / (Math.sqrt(2) * 1.6), color: [...c, 255], align, font: bold ? 'Georgia, serif' : 'Trebuchet MS, sans-serif' };
        let n = this.labels[this.ti]; if (!n) n = this.labels[this.ti] = new GameNode.Text({ textInfo });
        n.node.text = textInfo; this.nodes.push(n); this.ti++;
    }
    button(id, label, x, y, w, h, color = C.deep, enabled = true, icon) {
        this.panel(x, y + .6, w, h, tint(color, .68)); this.panel(x, y, w, h, enabled ? color : tint(color, .7));
        const ink = color[0] + color[1] + color[2] > 470 ? C.deep : C.cream;
        if (icon) symbol(this, icon, x + w / 2, y + h / 2, Math.min(w, h) * .25, enabled ? ink : C.muted);
        if (label) this.text(label, x + w / 2, y + h / 2 - 1, 2.05, ink, 'center');
        this.buttons.push({ id, x, y, w, h, enabled });
    }
    end() { this.root.node.children = this.nodes; this.peak = Math.max(this.peak, this.si); }
}
function symbol(p, kind, x, y, r, c = C.cream) {
    if (kind === 'pan') { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { p.line(x, y, x + dx * r, y + dy * r, .25, c); p.line(x + dx * r, y + dy * r, x + dx * r * .5 - dy * r * .35, y + dy * r * .5 + dx * r * .35, .25, c); } }
    else if (kind === 'fit') { for (const dx of [-1, 1]) for (const dy of [-1, 1]) { p.line(x + dx * r, y + dy * r * .35, x + dx * r, y + dy * r, .25, c); p.line(x + dx * r, y + dy * r, x + dx * r * .35, y + dy * r, .25, c); } }
    else if (kind === 'play') p.poly([[x - r * .65, y - r], [x + r, y], [x - r * .65, y + r]], c);
    else if (kind === 'pause') { p.rect(x - r, y - r, r * .65, r * 2, c); p.rect(x + r * .35, y - r, r * .65, r * 2, c); }
    else if (kind === 'home') { p.poly([[x - r, y], [x, y - r], [x + r, y], [x + r * .7, y], [x + r * .7, y + r], [x - r * .7, y + r], [x - r * .7, y]], c); p.rect(x - r * .2, y + r * .2, r * .4, r * .8, C.deep); }
    else if (kind === 'coin') { p.oval(x, y, r, r, C.gold, 1, 8); p.line(x, y - r * .6, x, y + r * .6, r * .3, C.brown); }
    else if (kind === 'gold') { p.poly([[x - r, y + r * .6], [x - r * .65, y - r * .6], [x + r * .6, y - r * .6], [x + r, y + r * .6]], C.gold); p.line(x - r * .5, y - r * .3, x + r * .4, y - r * .3, .25, C.white); }
    else if (kind === 'star') p.star(x, y, r, c);
    else if (kind === 'close') { p.line(x - r, y - r, x + r, y + r, .5, c); p.line(x - r, y + r, x + r, y - r, .5, c); }
    else if (kind === 'plus') { p.line(x - r, y, x + r, y, .5, c); p.line(x, y - r, x, y + r, .5, c); }
    else if (kind === 'minus') p.line(x - r, y, x + r, y, .5, c);
    else if (kind === 'up') { p.line(x, y + r, x, y - r, .5, c); p.line(x, y - r, x - r, y, .5, c); p.line(x, y - r, x + r, y, .5, c); }
    else if (kind === 'target' || kind === 'ring') { p.outline(x, y, r, c, 1, 12); if (kind === 'target') { p.line(x - r * 1.3, y, x + r * 1.3, y, .3, c); p.line(x, y - r * 1.3, x, y + r * 1.3, .3, c); } }
    else if (kind === 'fast') { for (let i = -1; i <= 1; i += 2) p.poly([[x + i * r * .55 - r * .45, y - r], [x + i * r * .55 + r * .45, y], [x + i * r * .55 - r * .45, y + r]], c); }
    else if (kind === 'shield') p.poly([[x - r, y - r], [x + r, y - r], [x + r * .8, y + r * .4], [x, y + r], [x - r * .8, y + r * .4]], c);
    else if (kind === 'burst' || kind === 'fire') p.poly(Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6, s = i % 2 ? r * .5 : r; return [x + Math.cos(a) * s, y + Math.sin(a) * s]; }), c);
    else if (kind === 'music') { p.line(x - r * .2, y + r * .7, x - r * .2, y - r, .4, c); p.line(x - r * .2, y - r, x + r * .7, y - r * .5, .4, c); p.oval(x - r * .6, y + r * .7, r * .5, r * .3, c); }
    else if (kind === 'lock') { p.outline(x, y - r * .4, r * .6, c, 1, 8); p.rect(x - r, y - r * .2, r * 2, r * 1.4, c); }
    else if (kind === 'edit') { p.line(x - r, y + r, x + r * .7, y - r * .7, r * .6, c); p.poly([[x - r * 1.2, y + r * 1.2], [x - r * .4, y + r], [x - r, y + r * .4]], C.gold); }
    else if (kind === 'save' || kind === 'import') { p.line(x - r, y + r * .6, x - r, y + r, .35, c); p.line(x - r, y + r, x + r, y + r, .35, c); p.line(x + r, y + r, x + r, y + r * .6, .35, c); const sign = kind === 'save' ? -1 : 1; p.line(x, y - r, x, y + r * .4, .4, c); p.line(x, y + sign * r * .4, x - r * .55, y - sign * r * .2, .4, c); p.line(x, y + sign * r * .4, x + r * .55, y - sign * r * .2, .4, c); }
    else if (kind === 'sound' || kind === 'mute') { p.poly([[x - r, y - r * .4], [x - r * .5, y - r * .4], [x + r * .2, y - r], [x + r * .2, y + r], [x - r * .5, y + r * .4], [x - r, y + r * .4]], c); if (kind === 'mute') p.line(x + r * .4, y - r, x + r * .9, y + r, .3, c); else p.line(x + r * .65, y - r * .6, x + r * .65, y + r * .6, .3, c); }
    else if (kind === 'back') { p.line(x + r, y, x - r, y, .5, c); p.line(x - r, y, x, y - r, .5, c); p.line(x - r, y, x, y + r, .5, c); }
}

function cowboyHat(p, x, y, s, color) {
    p.poly([[-2, .1], [-1, -.4], [-.9, -1.5], [.9, -1.5], [1.1, -.4], [2.2, 0], [1.5, .4], [-1.4, .4]].map(([a, b]) => [x + a * s, y + b * s]), color);
    p.rect(x - .9 * s, y - .4 * s, 1.8 * s, .35 * s, tint(color, .6));
}
function horse(p, x, y, s, time) {
    const stride = Math.sin(time * 15) * .6;
    p.poly([[-3, -2], [-2.5, -3.8], [1.5, -3.8], [2, -5.5], [3.7, -5.4], [4, -3.8], [2.5, -3], [2, -1.6]].map(([a, b]) => [x + a * s, y + b * s]), [135, 81, 53]);
    for (const dx of [-2, 1.5]) p.line(x + dx * s, y - 2 * s, x + (dx + stride) * s, y, .6 * s, C.brown);
    p.line(x - 3 * s, y - 3 * s, x - 4 * s, y - 1.7 * s, .5 * s, C.ink);
}
function cowboy(p, kind, x, y, scale = 1, time = 0, options = {}) {
    const enemy = options.enemy, data = (enemy ? ENEMIES : TOWERS)[kind], rank = enemy ? 0 : options.rank || 0;
    const c = options.flash ? C.white : data.color, s = scale * (kind === 'baron' ? 1.6 : kind === 'brute' ? 1.3 : 1), bob = options.walk ? Math.sin(time * 13) * .25 : Math.sin(time * 2) * .07;
    const r = (a, b, w, h, color) => p.rect(x + a * s, y + (b + bob) * s, w * s, h * s, color);
    const poly = (points, color) => p.poly(points.map(([a, b]) => [x + a * s, y + (b + bob) * s]), color);
    if (options.shadow !== false) p.oval(x + .5 * s, y + .3 * s, 2.3 * s, .8 * s, C.brown, .18);
    if (kind === 'wagon') {
        r(-3, -3.1, 6, 2.4, c); r(-2.8, -3.6, 5.6, .7, C.paper); r(-2, -4.8, 4, 1.2, C.gold);
        for (const dx of [-2, 2]) { p.oval(x + dx * s, y, .9 * s, .9 * s, C.ink, 1, 8); p.line(x + (dx - .6) * s, y, x + (dx + .6) * s, y, .2, C.paper); }
        return;
    }
    let lift = 0;
    if (kind === 'rider') {
        if (options.mount !== false) horse(p, x, y, s, time);
        lift = -2;
    }
    const stride = options.walk && !lift ? Math.sin(time * 13) * .45 : 0;
    if (rank >= 2) poly([[-1.2, -3.8], [1.2, -3.8], [2, rank === 3 ? .6 : -.4], [.45, -.1], [0, -1], [-.45, -.1], [-2, rank === 3 ? .6 : -.4]], tint(c, .72));
    r(-1.15 - stride, -1.3 + lift, .85, 1.5, C.ink); r(.3 + stride, -1.3 + lift, .85, 1.5, C.ink);
    poly([[-1.3, -3.9 + lift], [1.3, -3.9 + lift], [1.75, -1.1 + lift], [-1.75, -1.1 + lift]], c);
    poly([[0, -3.9 + lift], [1.3, -3.9 + lift], [1.75, -1.1 + lift], [.4, -1.1 + lift]], tint(c, .8));
    if (rank) poly([[-1.35, -3.9], [1.35, -3.9], [.3, -2.9], [0, -3.5], [-.3, -2.9]], C.gold);
    if (rank >= 2) poly([[-1.3, -3.8], [-.6, -3.9], [1.6, -1.5], [1.1, -1.1]], options.branch ? C.cream : C.gold);
    if (rank === 3) { r(-1.5, -3.9, .7, .45, C.gold); r(.8, -3.9, .7, .45, C.gold); }
    r(-.9, -5.4 + lift, 1.8, 1.5, [232, 170, 117]);
    if (enemy) { r(-1, -4.5 + lift, 2, .6, C.deep); } else { p.star(x - .6 * s, y + (-3 + lift) * s, .4 * s, C.gold); }
    const hat = enemy ? kind === 'baron' ? C.ink : [119, 73, 52] : rank >= 2 ? C.deep : rank ? C.cream : [243, 199, 126];
    if (options.hat !== false) cowboyHat(p, x, y + (-5.5 + lift + bob) * s, s, hat);
    if (rank) r(-1, -5.95, 2, .55, rank === 2 ? C.cream : C.gold);
    if (rank === 3) { r(-1.8, -5.4, 3.7, .25, C.gold); p.star(x, y + (-6.55 + bob) * s, .42 * s, C.gold); }
    if (kind === 'iron' || kind === 'brute') { poly([[-1.5, -3.7], [1.3, -3.7], [1.2, -1.7], [0, -.9], [-1.4, -1.7]], [141, 157, 159]); r(-.8, -3.3, .3, 1.6, C.white); }
    if (!enemy) {
        const a = options.aim ?? -.4, recoil = options.recoil > 0 ? .35 : 0, hand = [x + Math.cos(a) * s, y - 2.7 * s];
        if (kind === 'lasso') { const size = 1 + rank * .12; p.oval(x + 2.1 * s, y - 3.2 * s, 1.1 * s * size, .65 * s * size, C.gold); p.oval(x + 2.1 * s, y - 3.2 * s, .75 * s * size, .4 * s * size, c); }
        else if (kind === 'dynamite') { r(1, -3.5, .65, 2, C.red); r(1.8, -3.7, .65, 2, C.red); if (rank >= 2) r(2.6, -3.5, .65, 2, C.red); if (rank) r(.9, -2.8, rank >= 2 ? 2.5 : 1.7, .45, C.gold); p.line(x + 1.8 * s, y - 4.4 * s, x + 2 * s, y - 3.5 * s, .2, C.gold); }
        else if (kind === 'banjo') { const size = (1.1 + rank * .1) * s; p.oval(x + 1.3 * s, y - 2.4 * s, size, size, rank ? C.gold : C.paper); if (rank) p.oval(x + 1.3 * s, y - 2.4 * s, size * .7, size * .7, C.paper); p.line(x + 1.4 * s, y - 2.4 * s, x + 2.8 * s, y - 5.2 * s, .45 * s, C.brown); }
        else {
            const len = (kind === 'rifle' ? 4 : kind === 'gatling' ? 3.3 : 2.1) + rank * .25, width = (kind === 'gatling' ? 1.1 : .5) + rank * .08;
            p.line(...hand, hand[0] + Math.cos(a) * (len - recoil) * s, hand[1] + Math.sin(a) * (len - recoil) * s, width * s, C.ink);
            if (rank) p.line(hand[0] + Math.cos(a) * (len - recoil - .7) * s, hand[1] + Math.sin(a) * (len - recoil - .7) * s, hand[0] + Math.cos(a) * (len - recoil - .3) * s, hand[1] + Math.sin(a) * (len - recoil - .3) * s, (width + .16) * s, C.gold);
            if (options.recoil > .08) p.star(hand[0] + Math.cos(a) * len * s, hand[1] + Math.sin(a) * len * s, .9 * s, C.gold);
        }
    }
}
function upgradeBadge(p, x, y, rank, scale = 1) {
    p.panel(x - 2.65 * scale, y - 1.1 * scale, 5.3 * scale, 2.2 * scale, rank === 3 ? C.gold : C.deep, .35 * scale);
    if (rank === 3) p.panel(x - 2.45 * scale, y - .9 * scale, 4.9 * scale, 1.8 * scale, C.deep, .2 * scale);
    for (let i = 0; i < 3; i++) p.star(x + (i - 1) * 1.55 * scale, y, .65 * scale, i < rank ? C.gold : [85, 104, 94]);
}
// All painter primitives resolve to polygons, so the same art can topple and fade.
function transformed(p, x, y, angle, alpha) {
    const brush = Object.create(p), c = Math.cos(angle), s = Math.sin(angle);
    brush.poly = (points, color, opacity = 1) => p.poly(points.map(([a, b]) => [x + a * c - b * s, y + a * s + b * c]), color, opacity * alpha);
    return brush;
}
function defeated(p, fx, hatOnly = false) {
    const t = clamp(fx.age / fx.life, 0, 1), fade = 1 - clamp((t - .3) / .7, 0, 1), kind = fx.enemyKind;
    const s = .65 * (kind === 'baron' ? 1.6 : kind === 'brute' ? 1.3 : 1), dir = fx.direction;
    if (hatOnly) {
        if (kind === 'wagon') return;
        const x = fx.x + dir * t * 1.8, y = fx.y - (kind === 'rider' ? 7.5 : 5.5) * s - Math.sin(t * Math.PI) * 1.3 + t * t * 2.5;
        cowboyHat(transformed(p, x, y, dir * t * 2, fade), 0, 0, s, kind === 'baron' ? C.ink : [119, 73, 52]);
        return;
    }
    const fall = Math.min(1, fx.age / .24), ease = fall * fall * (3 - 2 * fall), lift = kind === 'rider' ? 1.3 : 0;
    p.oval(fx.x + dir * ease * 1.3, fx.y + .2, 2.3 * s, .8 * s, C.brown, .18 * fade);
    // The rider slips out of the saddle while the horse takes a small step away.
    if (kind === 'rider') horse(transformed(p, fx.x + t, fx.y, 0, fade), 0, 0, s, fx.age);
    const body = transformed(p, fx.x + dir * ease * .35, fx.y - lift * (1 - ease), dir * ease * (kind === 'wagon' ? .18 : Math.PI / 2), fade);
    cowboy(body, kind, 0, lift, .65, 0, { enemy: true, hat: false, shadow: false, mount: false });
}
function scenery(p, d, theme, time = 0, scale = 1) {
    const { x, y, kind } = d, s = scale, c = THEMES[theme];
    if (kind === 'cactus') {
        p.oval(x + s, y + s, 2.6 * s, .65 * s, C.brown, .13);
        p.poly([[x - .8 * s, y], [x - .8 * s, y - 4 * s], [x - 2.5 * s, y - 4 * s], [x - 2.5 * s, y - 6 * s], [x - 1.7 * s, y - 6 * s], [x - 1.7 * s, y - 4.8 * s], [x - .8 * s, y - 4.8 * s], [x - .8 * s, y - 8 * s], [x + .7 * s, y - 8 * s], [x + .7 * s, y - 3.6 * s], [x + 1.7 * s, y - 3.6 * s], [x + 1.7 * s, y - 5.3 * s], [x + 2.6 * s, y - 5.3 * s], [x + 2.6 * s, y - 2.7 * s], [x + .7 * s, y - 2.7 * s], [x + .7 * s, y]], c.sage);
        p.line(x, y - 7.5 * s, x, y - .3 * s, .3 * s, tint(c.sage, 1.3));
    } else if (kind === 'rock') {
        p.poly([[x - 3 * s, y], [x - 2 * s, y - 3.8 * s], [x + .7 * s, y - 4.7 * s], [x + 3 * s, y - 2.4 * s], [x + 3.4 * s, y + .5 * s]], c.rock);
        p.poly([[x - 2 * s, y - 3.8 * s], [x + .7 * s, y - 4.7 * s], [x + 1.1 * s, y - .8 * s], [x - 3 * s, y]], tint(c.rock, 1.2));
    } else if (kind === 'barrel') {
        p.panel(x - 1.5 * s, y - 3.5 * s, 3 * s, 3.5 * s, C.brown, .5); p.line(x - 1.5 * s, y - 2.7 * s, x + 1.5 * s, y - 2.7 * s, .4 * s, C.ink); p.line(x - 1.5 * s, y - .8 * s, x + 1.5 * s, y - .8 * s, .4 * s, C.ink);
    } else if (kind === 'fence') {
        for (const dx of [-4, 0, 4]) p.rect(x + dx * s, y - 3 * s, .65 * s, 3 * s, C.brown);
        p.line(x - 4 * s, y - 2.4 * s, x + 4.7 * s, y - 2.4 * s, .45 * s, C.paper); p.line(x - 4 * s, y - .9 * s, x + 4.7 * s, y - .9 * s, .45 * s, C.paper);
    } else if (kind === 'trough') { p.poly([[x - 3 * s, y - 2.2 * s], [x + 3 * s, y - 2.2 * s], [x + 2.5 * s, y], [x - 2.5 * s, y]], C.brown); p.rect(x - 2.6 * s, y - 2 * s, 5.2 * s, .8 * s, [93, 170, 176]); }
    else {
        p.oval(x, y - 1.3 * s, 1.7 * s, 1.6 * s, [167, 127, 70], .7, 8);
        for (let i = 0; i < 3; i++) { const a = time * .6 + i * Math.PI / 3; p.line(x + Math.cos(a) * 1.8 * s, y - 1.3 * s + Math.sin(a) * 1.8 * s, x - Math.cos(a) * 1.8 * s, y - 1.3 * s - Math.sin(a) * 1.8 * s, .18 * s, C.paper); }
    }
}
function saloon(p, x, y, time = 0, hit = 0, scale = 1) {
    const s = scale, roof = hit > 0 ? C.red : [190, 91, 65];
    p.oval(x + s, y + s, 7 * s, 2.1 * s, C.brown, .2);
    p.rect(x - 5.5 * s, y - 9 * s, 11 * s, 9 * s, [166, 106, 65]);
    p.poly([[x + 5.5 * s, y - 9 * s], [x + 7 * s, y - 7 * s], [x + 7 * s, y + .5 * s], [x + 5.5 * s, y]], [117, 79, 55]);
    p.rect(x - 5.8 * s, y - 10.5 * s, 11.6 * s, 4 * s, [229, 180, 106]);
    p.poly([[x - 6.5 * s, y - 6 * s], [x - 5.5 * s, y - 8 * s], [x + 5.5 * s, y - 8 * s], [x + 6.5 * s, y - 6 * s]], roof);
    p.rect(x - 5.9 * s, y - 11 * s, 11.8 * s, .7 * s, C.brown);
    p.text('SALOON', x, y - 10 * s, 1.5 * s, C.brown, 'center', true);
    for (const dx of [-3.5, 3.5]) { p.rect(x + (dx - 1) * s, y - 4.8 * s, 2 * s, 2.8 * s, C.gold); p.line(x + dx * s, y - 4.8 * s, x + dx * s, y - 2 * s, .3 * s, C.brown); }
    p.rect(x - 1.3 * s, y - 4.8 * s, 2.6 * s, 4.8 * s, C.deep);
    p.rect(x - 1.3 * s, y - 3 * s, 1.1 * s, 2 * s, [210, 148, 87]); p.rect(x + .2 * s, y - 3 * s, 1.1 * s, 2 * s, [210, 148, 87]);
    p.rect(x - 6.3 * s, y, 12.6 * s, .9 * s, [222, 171, 105]);
    for (const dx of [-5.6, 5.2]) p.rect(x + dx * s, y - 6 * s, .5 * s, 6 * s, C.brown);
    // Two friends keep watch from the lit upstairs windows.
    for (const dx of [-3, 3]) { p.oval(x + dx * s, y - 5.1 * s + Math.sin(time * 2 + dx) * .08 * s, .55 * s, .6 * s, [241, 191, 133]); p.rect(x + (dx - .8) * s, y - 5.8 * s, 1.6 * s, .3 * s, C.ink); }
}
function landscape(p, level, time) {
    const c = THEMES[level.theme], field = fieldFor(level), w = Math.max(160, field.w + 8), h = Math.max(100, field.h + 28);
    p.rect(0, 0, w, h, c.sand);
    for (let y = 10; y < h; y += 15) for (let x = 0; x < w; x += 24) {
        const n = Math.sin(x * 6 + y * 8); p.poly([[x, y], [x + 26, y + 4], [x + 12 + n * 5, y + 21]], n > 0 ? c.light : tint(c.sand, .97), .6);
    }
    p.rect(0, 11, w, 7, c.sky);
    for (let x = 0; x < w; x += 21) p.poly([[x - 5, 18], [x + 2, 13], [x + 13, 13], [x + 17, 18]], tint(c.rock, 1.1), .85);
    for (const path of level.paths) {
        for (let pass = 0; pass < 2; pass++) {
            const color = pass ? [245, 219, 163] : tint(c.rock, 1.03), width = pass ? 4.8 : 6;
            path.slice(1).forEach((b, i) => p.line(...path[i], ...b, width, color)); path.forEach(a => p.oval(...a, width / 2, width / 2, color, 1, 10));
        }
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i], b = path[i + 1], angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
            const x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2;
            for (const side of [-1, 1]) p.line(x - Math.cos(angle + side * .8) * 1.1, y - Math.sin(angle + side * .8) * 1.1, x, y, .28, tint(c.rock, 1.1), .6);
        }
        const [x, y] = path[0]; p.oval(x, y, 2.5, 2.5, C.red, .9, 6); symbol(p, 'play', x, y, 1, C.cream);
    }
    level.decor.filter(d => d.kind === 'fence').forEach(d => scenery(p, d, level.theme, time));
}
module.exports = { Painter, C, tint, ring, symbol, cowboy, upgradeBadge, defeated, scenery, saloon, landscape };
