const { GameNode, Shapes } = require('squish-150');
const { BIOMES, clamp } = require('./settings');
const tint = (c, n, alpha = c[3]) => [clamp(Math.round(c[0] * n), 0, 255), clamp(Math.round(c[1] * n), 0, 255), clamp(Math.round(c[2] * n), 0, 255), alpha];
const polygon = (x, y, rx, ry, sides = 8, angle = 0) => Array.from({ length: sides }, (_, i) => [x + Math.cos(angle + i * Math.PI * 2 / sides) * rx, y + Math.sin(angle + i * Math.PI * 2 / sides) * ry]);
function clip(points) {
    let output = points;
    for (const [axis, bound, direction] of [[0, 0, 1], [0, 100, -1], [1, 0, 1], [1, 79, -1]]) {
        const input = output; output = []; if (!input.length) return output;
        let prev = input[input.length - 1], inside = (prev[axis] - bound) * direction >= 0;
        for (const point of input) {
            const next = (point[axis] - bound) * direction >= 0;
            if (next !== inside) {
                const t = (bound - prev[axis]) / (point[axis] - prev[axis]);
                const edge = [prev[0] + (point[0] - prev[0]) * t, prev[1] + (point[1] - prev[1]) * t]; edge[axis] = bound; output.push(edge);
            }
            if (next) output.push(point); prev = point; inside = next;
        }
    }
    return output;
}

// Nodes are reused by painter slot, and only used slots enter the scene tree.
// Worlds are data. Distant islands, projectiles and effects cost no wire nodes.
class Painter {
    constructor(root, limit = 320) { this.root = root; this.pool = []; this.limit = limit; this.peak = 0; this.overflow = 0; }
    begin() { this.used = 0; this.nodes = []; }
    poly(points, fill, stroke, border = 0) {
        if (points.some(p => !p.every(Number.isFinite))) return;
        points = clip(points); if (points.length < 3) return;
        if (this.used >= this.limit) { this.overflow++; return; }
        let node = this.pool[this.used];
        if (!node) node = this.pool[this.used] = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0], [0, 0], [0, 0]], fill });
        node.node.coordinates2d = [...points, points[0]]; node.node.fill = stroke ? undefined : fill;
        node.node.color = stroke || [255, 255, 255, fill?.[3] ?? 255];
        node.node.border = stroke && border ? border : undefined; this.nodes.push(node); this.used++;
    }
    line(a, b, width, color) {
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1, nx = -dy / length * width, ny = dx / length * width;
        this.poly([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], color);
    }
    end() { this.root.node.children = this.nodes; this.peak = Math.max(this.peak, this.used); }
}

class SkyScene {
    constructor(root) { this.painter = new Painter(root); this.camera = { x: 0, y: 0 }; }
    project(x, y, z = 0) { const dx = x - this.camera.x, dy = y - this.camera.y; return [50 + (dx - dy) * .62, 46 + (dx + dy) * .25 - z * .58]; }
    unproject(x, y) { const a = (x - 50) / .62, b = (y - 46 + 3.48) / .25; return { x: this.camera.x + (a + b) / 2, y: this.camera.y + (b - a) / 2 }; }
    face(points, color, stroke, border) { this.painter.poly(points.map(p => this.project(...p)), color, stroke, border); }
    render(e, preview = false) {
        this.camera = { x: preview ? -25 : e.ship.x, y: preview ? 12 : e.ship.y };
        const dawn = e.phase === 'won' || e.phase === 'sunrise';
        const palette = dawn ? { sky: [44, 81, 103, 255], haze: [237, 165, 130, 255], rock: [99, 103, 137, 255], top: [165, 198, 163, 255], light: [255, 224, 163, 255], flora: [186, 228, 161, 255] } : BIOMES[Math.min(2, e.leg)];
        this.palette = palette; const p = this.painter;
        p.begin();
        p.poly([[0, 0], [100, 0], [100, 79], [0, 79]], palette.sky);
        for (let i = 0; i < 6; i++) p.poly([[0, 12 + i * 10], [100, 3 + i * 12], [100, 26 + i * 11], [0, 31 + i * 9]], tint(palette.haze, .55 + i * .065, 95));
        const light = dawn ? [255, 218, 140, 255] : palette.light;
        if (dawn) for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4 + e.time * .025;
            p.poly([[76, 24], [76 + Math.cos(a) * 110, 24 + Math.sin(a) * 130], [76 + Math.cos(a + .13) * 110, 24 + Math.sin(a + .13) * 130]], [255, 224, 164, 27]);
        }
        p.poly(polygon(76, 24, e.phase === 'won' ? 19 : 10, e.phase === 'won' ? 29 : 15, 32), tint(light, 1, 22));
        p.poly(polygon(76, 24, 7, 10.5, 20), tint(light, 1, e.phase === 'won' ? 255 : 180));
        for (let i = 0; i < 9; i++) {
            const x = ((i * 19.1 - this.camera.x * .035) % 125 + 125) % 125 - 10, y = 24 + (i % 4) * 10;
            p.poly([[x - 9, y], [x - 3, y - 1.3], [x + 12, y], [x + 5, y + 1.8]], tint(palette.haze, 1.5, 58));
        }
        const islands = preview ? [
            { x: -25, y: -24, r: 18, depth: 28, seed: .4, trees: true },
            { x: 40, y: -24, r: 13, depth: 22, seed: .6, trees: true },
            { x: 60, y: 30, r: 20, depth: 35, seed: .2, trees: true },
            { x: -18, y: 56, r: 12, depth: 20, seed: .7, trees: false },
        ] : e.islands;
        const entities = islands.map(item => ({ item, type: 'island', depth: item.x + item.y }));
        for (const item of e.loot) if (item.active) entities.push({ item, type: 'loot', depth: item.x + item.y });
        for (const item of e.enemies) if (item.hp > 0) entities.push({ item, type: 'enemy', depth: item.x + item.y });
        if (!preview && e.goal && e.leg < 3) entities.push({ item: e.goal, type: 'beacon', depth: e.goal.x + e.goal.y });
        if (e.boss?.hp > 0) entities.push({ item: e.boss, type: 'boss', depth: e.boss.x + e.boss.y });
        if (e.whale && !preview) entities.push({ item: e.whale, type: 'whale', depth: e.whale.x + e.whale.y - 8 });
        entities.push({ item: preview ? { ...e.ship, x: 8, y: 0, angle: -.25 } : e.ship, type: 'ship', depth: e.ship.x + e.ship.y + .5 });
        entities.sort((a, b) => a.depth - b.depth);
        for (const { item, type } of entities) {
            const [x, y] = this.project(item.x, item.y);
            if (x < -22 || x > 122 || y < -10 || y > 105) continue;
            this[type](item, e);
        }
        if (!preview) this.overlays(e);
        p.end(); return p.used;
    }
    island(i) {
        const c = this.palette, r = i.r;
        const ring = Array.from({ length: 6 }, (_, n) => [i.x + Math.cos(n * Math.PI / 3) * r, i.y + Math.sin(n * Math.PI / 3) * r, 0]);
        const bottom = [i.x + r * .13, i.y + r * .2, -i.depth];
        for (let n = 0; n < 6; n++) this.face([ring[n], ring[(n + 1) % 6], bottom], tint(c.rock, .65 + n * .1));
        this.face(ring, c.top);
        this.face([ring[0], ring[1], ring[3], [i.x, i.y, .5]], tint(c.top, 1.15));
        if (i.trees) {
            for (let n = 0; n < 2; n++) {
                const x = i.x + (n ? 3 : -3), y = i.y - 1, h = 5 + i.seed * 6;
                this.face([[x - 3, y, 0], [x, y, h], [x + 3, y, 0]], c.flora);
                this.face([[x, y + 3, 0], [x, y, h], [x + 3, y, 0]], tint(c.flora, .65));
            }
        } else this.face([[i.x - 2, i.y, 0], [i.x, i.y, 7], [i.x + 2, i.y, 0]], tint(c.light, 1, 210));
    }
    ship(s, e) {
        const p = this.painter, a = s.angle, t = e.time, bob = Math.sin(t * 2) * .4;
        const v = (x, y, z) => [s.x + x * Math.cos(a) - y * Math.sin(a), s.y + x * Math.sin(a) + y * Math.cos(a), z + bob];
        const hull = [[-10, -4, 4], [6, -4, 4], [13, 0, 5], [6, 4, 4], [-10, 4, 4], [-13, 0, 4]].map(q => v(...q));
        const keel = v(-1, 0, -1);
        this.face([hull[0], hull[1], hull[2], keel], [119, 68, 65, 255]);
        this.face([hull[2], hull[3], hull[4], keel], [61, 53, 74, 255]);
        this.face(hull, s.hurt > 0 ? [255, 119, 108, 255] : [189, 132, 102, 255]);
        this.face([v(-8, -2, 4.2), v(5, -2, 4.2), v(8, 0, 4.2), v(5, 2, 4.2), v(-8, 2, 4.2)], [234, 188, 132, 255]);
        for (let i = -6; i <= 6; i += 4) p.line(this.project(...v(i, -2, 4.4)), this.project(...v(i, 2, 4.4)), .065, [128, 88, 72, 170]);
        for (const side of [-1, 1]) {
            this.face([v(-6, side * 3, 5), v(-2, side * 15, 6), v(8, side * 6, 5)], [100, 194, 191, 255]);
            this.face([v(-2, side * 15, 6), v(9, side * 9, 7), v(8, side * 6, 5)], [48, 119, 144, 255]);
            p.line(this.project(...v(-7, side * 3, 5)), this.project(...v(-5, side * 5, 17)), .10, [225, 189, 134, 220]);
            p.line(this.project(...v(6, side * 3, 5)), this.project(...v(7, side * 4, 17)), .10, [225, 189, 134, 220]);
        }
        this.face([v(-14, 0, 18), v(-7, -6, 19), v(9, -5, 19), v(16, 0, 18), v(8, 0, 25), v(-6, 0, 25)], [255, 195, 116, 255]);
        this.face([v(-14, 0, 18), v(-7, 6, 19), v(9, 5, 19), v(16, 0, 18), v(8, 0, 25), v(-6, 0, 25)], [213, 116, 83, 255]);
        this.face([v(-6, 0, 25), v(8, 0, 25), v(9, -5, 19), v(-7, -6, 19)], [255, 218, 157, 255]);
        this.face([v(-2, -5.6, 19.5), v(2, -5.4, 19.5), v(2, 0, 25.1), v(-2, 0, 25.1)], [252, 237, 204, 255]);
        this.face([v(-2, 5.6, 19.5), v(2, 5.4, 19.5), v(2, 0, 25.1), v(-2, 0, 25.1)], [229, 174, 122, 255]);
        this.face([v(-14, 0, 18), v(-7, -6, 19), v(-6, 0, 25)], [239, 157, 103, 255]);
        this.face([v(8, 0, 25), v(9, 5, 19), v(16, 0, 18)], [173, 87, 74, 255]);
        const flame = 3 + (s.boost ? 6 : 0) + Math.sin(t * 17) * .6;
        this.face([v(-12, -2, 4), v(-12 - flame, 0, 4), v(-12, 2, 4)], [255, 199, 95, 240]);
        this.face([v(-12, -1, 4), v(-12 - flame * .65, 0, 4), v(-12, 1, 4)], [242, 251, 206, 255]);
        // A visible engine crystal ties the reactor meter to the ship itself.
        const core = this.project(...v(-6, 0, 7)); p.poly(polygon(core[0], core[1], .65, 1.2, 4), [155, 244, 227, 255]);
        const spots = { helm: [7, 0], gunner: [11, 0], engineer: [-6, 1], scout: [-2, 3] };
        const colors = { helm: [255, 214, 132, 255], gunner: [242, 138, 154, 255], engineer: [141, 231, 178, 255], scout: [144, 205, 247, 255] };
        const counts = {};
        for (const person of e.players.values()) {
            const spot = spots[person.role], offset = (counts[person.role] || 0) * 2; counts[person.role] = (counts[person.role] || 0) + 1;
            const x = spot[0] - offset, y = spot[1], at = this.project(...v(x, y, 7));
            p.poly([[at[0] - .45, at[1] + .6], [at[0] + .45, at[1] + .6], [at[0] + .65, at[1] + 2.1], [at[0] - .65, at[1] + 2.1]], colors[person.role]);
            p.poly(polygon(at[0], at[1], .42, .65, 5), [255, 218, 175, 255]);
        }
        if (s.shield > 5 && (s.hurt > 0 || s.focus === 3)) {
            const center = this.project(s.x, s.y, 10);
            p.poly(polygon(center[0], center[1], 14, 11, 12), [112, 223, 238, 18], [137, 231, 244, 170], 1);
        }
    }
    whale(w, e) {
        const bob = Math.sin(e.time * 1.4) * 1.4, z = 4 + bob, c = w.free ? [123, 221, 210, 255] : [121, 143, 165, 255];
        const v = (x, y, h) => [w.x + x, w.y + y, z + h];
        this.face([v(-20, 0, 4), v(-12, -7, 6), v(8, -8, 7), v(16, -2, 6), v(14, 6, 4), v(-8, 7, 2)], tint(c, .65));
        this.face([v(-20, 0, 4), v(-12, -7, 6), v(8, -8, 7), v(11, 0, 12), v(-7, 0, 11)], c);
        this.face([v(-7, 0, 11), v(11, 0, 12), v(14, 6, 4), v(-8, 7, 2)], tint(c, .82));
        this.face([v(-18, 0, 4), v(-31, -8, 7 + bob), v(-25, 0, 3), v(-30, 9, 4 - bob)], tint(c, .8));
        this.face([v(-4, 5, 4), v(-9, 18, 0 - bob), v(7, 8, 4)], tint(c, .7));
        this.face([v(-7, -5, 5), v(-10, -16, 6 + bob), v(4, -8, 5)], tint(c, 1.12));
        const eye = this.project(...v(12, 4, 7)); this.painter.poly(polygon(eye[0], eye[1], .6, .8, 5), [255, 235, 157, 255]);
        if (!w.free) for (const chain of e.enemies.filter(enemy => enemy.kind === 'chain' && enemy.hp > 0)) {
            this.painter.line(this.project(w.x, w.y, z + 6), this.project(chain.x, chain.y, 3), .14, [251, 146, 135, 220]);
        }
    }
    enemy(e) {
        const x = e.x, y = e.y, w = e.kind === 'warden' ? 8 : 4, c = e.exposed > 0 ? [255, 212, 124, 255] : [196, 110, 161, 255];
        this.face([[x - w, y, 5], [x, y - w, 4], [x + w, y, 6], [x, y + w, 4]], [50, 43, 76, 255]);
        this.face([[x - w, y, 5], [x, y, 14], [x + w, y, 6]], c);
        this.face([[x, y - w, 4], [x, y, 14], [x + w, y, 6]], tint(c, .58));
        this.face([[x, y + w, 4], [x, y, 14], [x + w, y, 6]], tint(c, .8));
        const at = this.project(x, y, 16);
        this.painter.line([at[0] - 2, at[1]], [at[0] + 2, at[1]], .23, [27, 24, 48, 255]);
        this.painter.line([at[0] - 2, at[1]], [at[0] - 2 + 4 * e.hp / e.maxHp, at[1]], .13, c);
    }
    loot(l, e) {
        const z = 5 + Math.sin(e.time * 2 + l.id) * 1.2, at = this.project(l.x, l.y, z);
        const c = l.kind === 'survivor' ? [165, 255, 199, 255] : [255, 204, 129, 255];
        this.painter.poly(polygon(at[0], at[1], l.kind === 'survivor' ? 1.2 : .8, 1.6, 4), c);
        this.painter.poly(polygon(at[0], at[1] + 2.8, 2.1, .5, 6), tint(c, 1, 65));
        if (l.kind === 'survivor') this.painter.line([at[0], at[1] - 2], [at[0], at[1] - 3.5], .15, c);
    }
    beacon(b, e) {
        const lit = b.charge > 0, c = lit ? [255, 220, 139, 255] : [126, 183, 211, 255], x = b.x, y = b.y;
        this.island({ x, y, r: 11, depth: 24, seed: .2, trees: false });
        this.face([[x - 3, y - 3, 0], [x - 3, y - 3, 19], [x + 3, y - 3, 19], [x + 3, y - 3, 0]], tint(c, .55));
        this.face([[x + 3, y - 3, 0], [x + 3, y - 3, 19], [x + 3, y + 3, 19], [x + 3, y + 3, 0]], tint(c, .8));
        const top = this.project(x, y, 23); this.painter.poly(polygon(top[0], top[1], 2.7, 4.1, 6, e.time * .3), c);
        if (lit) {
            const low = this.project(x, y, 21), high = this.project(x, y, 90);
            this.painter.poly([[low[0] - 1, low[1]], [high[0] - 4, high[1]], [high[0] + 4, high[1]], [low[0] + 1, low[1]]], [255, 224, 159, 70]);
        }
    }
    boss(b, e) {
        const p = this.painter, at = this.project(b.x, b.y, 16), c = b.hp <= 0 ? [255, 225, 154, 255] : [182, 112, 151, 255];
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4 + b.angle * .2, outer = [at[0] + Math.cos(a) * 18, at[1] + Math.sin(a) * 23];
            const inner = [at[0] + Math.cos(a + .25) * 9, at[1] + Math.sin(a + .25) * 12];
            const next = [at[0] + Math.cos(a + .65) * 12, at[1] + Math.sin(a + .65) * 15];
            p.poly([outer, inner, next], tint(c, .35 + i * .045));
        }
        p.poly(polygon(at[0], at[1], 10, 14, 12, b.angle), [29, 25, 45, 255], tint(c, .9), 2);
        p.poly(polygon(at[0], at[1], 5.5, 8, 6, -b.angle), b.exposed > 0 || b.hp <= 0 ? [255, 222, 137, 255] : [99, 54, 97, 255]);
        p.poly(polygon(at[0], at[1], 2.3, 3.5, 6), [255, 237, 201, 255]);
        for (let i = 0; i < 3; i++) {
            const a = i * Math.PI * 2 / 3 - Math.PI / 2;
            p.poly(polygon(at[0] + Math.cos(a) * 8, at[1] + Math.sin(a) * 11, 1.4, 2, 4), i < b.phase ? [46, 37, 55, 255] : [240, 131, 127, 255]);
        }
    }
    overlays(e) {
        const p = this.painter, s = e.ship;
        for (const shot of e.shots) {
            const a = this.project(shot.x, shot.y, 7), b = this.project(shot.x - shot.vx * .07, shot.y - shot.vy * .07, 7);
            p.line(a, b, shot.hostile ? .22 : .16, shot.hostile ? [255, 114, 141, 255] : [255, 229, 158, 255]);
        }
        for (const w of e.warnings) {
            const at = this.project(w.x, w.y, 4), flash = w.time < 0 ? 160 : 22 + Math.round(Math.sin(w.time * 15) * 12);
            p.poly(polygon(at[0], at[1], w.radius * .82, w.radius * .35, 14), [255, 97, 124, flash], [255, 130, 148, 240], 1.5);
            if (w.time > 0) p.poly(polygon(at[0], at[1], (1 - w.time / 2.8) * w.radius * .8, (1 - w.time / 2.8) * w.radius * .35, 12), [255, 130, 148, 40]);
        }
        if (e.scanWave > 0) {
            const at = this.project(s.x, s.y, 6), r = (1 - e.scanWave) * 50;
            p.poly(polygon(at[0], at[1], r, r * .45, 28), [128, 218, 239, 8], [128, 218, 239, Math.round(e.scanWave * 170)], 1);
        }
        if (e.tether?.life > 0) p.line(this.project(s.x, s.y, 6), this.project(e.tether.x, e.tether.y, 6), .22, [159, 255, 202, 230]);
        if (e.ping?.life > 0) { const at = this.project(e.ping.x, e.ping.y, 6); p.poly(polygon(at[0], at[1], 2.5, 3.5, 4), [153, 207, 255, 25], [153, 207, 255, 200], 1); }
        for (const effect of e.effects) {
            if (effect.type === 'shot' || effect.type === 'switch') continue;
            const at = this.project(effect.x, effect.y, 8), life = effect.life / effect.total, r = (1 - life) * (effect.type === 'burst' ? 6 : 3) + .5;
            p.poly(polygon(at[0], at[1], r, r * 1.1, 6, e.time), [255, 214, 158, Math.round(life * 95)]);
        }
        // A destination marker remains visible when the beacon is beyond view.
        if (e.goal && e.phase === 'sail') {
            const at = this.project(e.goal.x, e.goal.y, 24), x = clamp(at[0], 6, 94), y = clamp(at[1], 19, 72);
            p.poly([[x, y - 2], [x + 1.3, y], [x, y + 2], [x - 1.3, y]], [255, 231, 174, 230]);
        }
    }
}
module.exports = { SkyScene, Painter, clip, polygon, tint };
