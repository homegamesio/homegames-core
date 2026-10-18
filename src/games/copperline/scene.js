const { GameNode, Shapes } = require('squish-150');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const tint = (c, n, alpha = c[3] === undefined ? 255 : c[3]) => [clamp(Math.round(c[0] * n), 0, 255), clamp(Math.round(c[1] * n), 0, 255), clamp(Math.round(c[2] * n), 0, 255), Math.round(alpha)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const ring = (x, y, rx, ry, n = 8, a = 0) => Array.from({ length: n }, (_, i) => [x + Math.cos(a + i * Math.PI * 2 / n) * rx, y + Math.sin(a + i * Math.PI * 2 / n) * ry]);
const noise = (x, y = 0) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
const C = { ink: [40, 44, 53, 255], dark: [68, 54, 62, 255], wood: [126, 71, 58, 255], pale: [255, 225, 167, 255], gold: [240, 177, 70, 255], teal: [56, 135, 131, 255], mint: [126, 203, 172, 255], red: [209, 87, 86, 255], skin: [228, 166, 115, 255] };

// Squish polygons must remain inside its unsigned 0..100 coordinate space.
function clip(points) {
    let out = points;
    for (const [axis, bound, sign] of [[0, 0, 1], [0, 100, -1], [1, 0, 1], [1, 100, -1]]) {
        const input = out; out = []; if (!input.length) break;
        let prev = input[input.length - 1], inside = (prev[axis] - bound) * sign >= 0;
        for (const point of input) {
            const next = (point[axis] - bound) * sign >= 0;
            if (next !== inside) {
                const t = (bound - prev[axis]) / (point[axis] - prev[axis]);
                const edge = [prev[0] + (point[0] - prev[0]) * t, prev[1] + (point[1] - prev[1]) * t]; edge[axis] = bound; out.push(edge);
            }
            if (next) out.push(point); prev = point; inside = next;
        }
    }
    return out;
}
class Painter {
    constructor(root) { this.root = root; this.pool = []; this.labels = []; this.limit = 900; this.peak = 0; this.overflow = 0; }
    begin() { this.used = 0; this.labelUsed = 0; this.nodes = []; }
    poly(points, fill) {
        if (points.some(q => !q.every(Number.isFinite))) return;
        points = clip(points); if (points.length < 3) return;
        if (this.used >= this.limit) { this.overflow++; return; }
        let node = this.pool[this.used];
        if (!node) node = this.pool[this.used] = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0], [0, 0], [0, 0]], fill, color: [255, 255, 255, 255] });
        node.node.coordinates2d = [...points, points[0]]; node.node.fill = fill; node.node.color = [255, 255, 255, fill[3] === undefined ? 255 : fill[3]];
        this.nodes.push(node); this.used++;
    }
    line(a, b, width, color) {
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1, nx = -dy / length * width, ny = dx / length * width;
        this.poly([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], color);
    }
    text(text, x, y, size, color = C.pale) {
        if (x < 4 || x > 96 || y < 1 || y > 97 || this.labelUsed >= 20) return;
        const textInfo = { text, x, y, size, align: 'center', color };
        let node = this.labels[this.labelUsed];
        if (!node) node = this.labels[this.labelUsed] = new GameNode.Text({ textInfo });
        node.node.text = textInfo; this.nodes.push(node); this.labelUsed++;
    }
    end() { this.root.node.children = this.nodes; this.peak = Math.max(this.peak, this.used); }
}

// Shared silhouette for carried guns and their physical display racks. Every
// purchased modification changes geometry: barrel, copper coil, or drum.
function drawWeapon(p, x, y, scale = 1, weapon = 'revolver', mods = [], angle = 0) {
    const grip = Math.cos(angle) < 0 ? -1 : 1;
    const v = (a, b) => [x + (a * Math.cos(angle) - b * Math.sin(angle) * grip) * scale, y + (a * Math.sin(angle) + b * Math.cos(angle) * grip) * scale];
    const f = (pts, c) => p.poly(pts.map(q => v(...q)), c);
    const has = id => mods.includes(id), long = weapon === 'repeater' || weapon === 'voltaic', barrel = (long ? 4.2 : weapon === 'scattergun' ? 3.3 : 2.5) + (has('longbarrel') ? 1.5 : 0);
    f([[-1, -.1], [-.35, -.3], [.45, .3], [-.1, 1.8], [-.8, 1.55]], C.wood);
    if (long || weapon === 'scattergun') f([[-3.1, -.35], [-1, -.4], [.5, 0], [-1, .7], [-3.4, .8]], [159, 89, 54, 255]);
    f([[-.7, -.6], [barrel, -.6], [barrel + .1, -.12], [.4, .25], [-.7, .25]], C.ink);
    f([[-.5, -.55], [barrel, -.55], [barrel, -.38], [-.5, -.15]], [179, 191, 178, 255]);
    if (weapon === 'scattergun') f([[.5, -.08], [barrel, -.2], [barrel, .2], [.5, .35]], [87, 93, 95, 255]);
    if (weapon === 'revolver') f([[-.7, -.5], [.65, -.5], [.65, .32], [-.7, .32]], C.gold);
    if (weapon === 'voltaic' || has('brasscoil')) {
        f([[.6, -.95], [2.3, -.95], [2.45, .15], [.5, .15]], [163, 97, 58, 255]);
        for (let i = 0; i < 3; i++) f([[.7 + i * .47, -.9], [.9 + i * .47, -.9], [1.1 + i * .47, .1], [.85 + i * .47, .1]], C.gold);
        f([[1.1, -1.15], [1.8, -1.15], [2, -.95], [.95, -.95]], [141, 250, 225, 255]);
    }
    if (has('drummag')) f([[-.4, .05], [.7, .05], [1, .65], [.7, 1.3], [-.35, 1.3], [-.6, .6]], [102, 122, 121, 255]);
    if (has('longbarrel')) f([[barrel - .7, -.78], [barrel, -.78], [barrel, -.24], [barrel - .7, -.24]], C.gold);
}

class FrontierScene {
    constructor(root) { this.painter = new Painter(root); this.camera = { x: 62, y: 67 }; this.sx = .95; this.sy = .50; this.origin = [50, 53]; }
    project(x, y, z = 0) { return [this.origin[0] + (x - this.camera.x - y + this.camera.y) * this.sx, this.origin[1] + (x - this.camera.x + y - this.camera.y) * this.sy - z * .9]; }
    unproject(sx, sy) { const a = (sx - this.origin[0]) / this.sx, b = (sy - this.origin[1]) / this.sy; return { x: this.camera.x + (a + b) / 2, y: this.camera.y + (b - a) / 2 }; }
    face(points, color) { this.painter.poly(points.map(q => this.project(...q)), color); }
    line(a, b, width, color) { this.painter.line(this.project(...a), this.project(...b), width, color); }
    visible(x, y, r = 8, h = 12) { const q = this.project(x, y); return q[0] > -r && q[0] < 100 + r && q[1] > -r && q[1] - h < 100 + r; }
    shade(c, n = 1, alpha) { return tint(mix(c, [53, 69, 96, c[3] === undefined ? 255 : c[3]], this.night * .62), n, alpha === undefined ? 255 : alpha); }
    box(x, y, w, d, h, color, z = 0) {
        const a = x - w / 2, b = y - d / 2;
        this.face([[a, b + d, z], [a + w, b + d, z], [a + w, b + d, z + h], [a, b + d, z + h]], this.shade(color, .84));
        this.face([[a + w, b, z], [a + w, b + d, z], [a + w, b + d, z + h], [a + w, b, z + h]], this.shade(color, .61));
        this.face([[a, b, z + h], [a + w, b, z + h], [a + w, b + d, z + h], [a, b + d, z + h]], this.shade(color, 1.18));
    }
    shadow(x, y, rx, ry = rx * .43) { const a = this.project(x + 1.5, y + 1, .05); this.painter.poly(ring(a[0], a[1], rx, ry, 7, .2), [68, 47, 66, 51]); }
    render(e, preview = false) {
        this.preview = preview; this.e = e; this.night = Math.max(0, Math.sin((e.time || 0) / 100 - .8)) * .8;
        this.camera = { x: preview ? 62 : e.player.x, y: preview ? 63 : e.player.y }; this.origin = preview ? [72, 65] : [50, 53];
        this.sx = preview ? 1.02 : .95; this.sy = preview ? .51 : .50;
        const p = this.painter; p.begin(); this.terrain(e);
        const entities = [];
        for (const item of e.world.props || []) if (this.visible(item.x, item.y, (item.size || 4) * 2 + 5, (item.size || 4) * 4 + 10)) entities.push({ type: 'prop', item, depth: item.x + item.y });
        for (const item of e.world.buildings || []) if (this.visible(item.x, item.y, (item.w + item.d) * .6 + 8, item.h * 1.2 + 10)) entities.push({ type: 'building', item, depth: item.x + item.y + item.d / 2 });
        for (const item of e.world.npcs || []) if (this.visible(item.x, item.y)) entities.push({ type: 'npc', item, depth: item.x + item.y + 1 });
        for (const item of e.enemies || []) if (item.hp > 0 && this.visible(item.x, item.y)) entities.push({ type: 'enemy', item, depth: item.x + item.y + (item.trainOffset !== undefined ? 14 : 1) });
        for (const item of e.loot || []) if (this.visible(item.x, item.y)) entities.push({ type: 'loot', item, depth: item.x + item.y });
        if (e.train) for (let i = 3; i >= 0; i--) { const item = { x: e.train.x - i * 15 * (e.train.direction || 1), y: e.train.y, car: i, direction: e.train.direction || 1 }; if (this.visible(item.x, item.y, 25, 25)) entities.push({ type: 'train', item, depth: item.x + item.y + 3 }); }
        if (!e.player.mounted && e.horse) entities.push({ type: 'horse', item: e.horse, depth: e.horse.x + e.horse.y + 1 });
        entities.push({ type: 'player', item: e.player, depth: e.player.x + e.player.y + (e.player.aboard ? 14 : 2) });
        entities.sort((a, b) => a.depth - b.depth);
        for (const entity of entities) { if (p.used > 785 && entity.type === 'prop') continue; this[entity.type](entity.item, e); }
        this.atmosphere(e); p.end(); return p.used;
    }
    terrain(e) {
        const p = this.painter, sand = this.shade([213, 156, 91, 255]);
        p.poly([[0, 0], [100, 0], [100, 100], [0, 100]], sand);
        // Large deterministic triangles give every district a faceted terrain.
        const step = 20, cx = Math.floor(this.camera.x / step), cy = Math.floor(this.camera.y / step);
        for (let j = cy - 4; j <= cy + 4; j++) for (let i = cx - 4; i <= cx + 4; i++) {
            const x = i * step, y = j * step;
            if (!this.visible(x + 10, y + 10, 34, 0)) continue;
            let base = [220, 165, 98, 255];
            if (x > 130 && y < 100) base = [220, 185, 144, 255];
            if (x > 170 && y > 120) base = [111, 153, 126, 255];
            if (x > 225 && y < 110) base = [170, 123, 112, 255];
            if (y > 150 && x < 150) base = [214, 137, 107, 255];
            const n = noise(i, j);
            this.face([[x, y, 0], [x + step, y, 0], [x + step, y + step, 0]], this.shade(base, .94 + n * .1));
            this.face([[x, y, 0], [x + step, y + step, 0], [x, y + step, 0]], this.shade(base, 1.01 + n * .075));
        }
        // Worn carriage roads bind the settlements into the landscape.
        const road = this.shade([242, 186, 116, 255]);
        this.face([[0, 58, .03], [320, 58, .03], [320, 68, .03], [0, 68, .03]], road);
        this.face([[58, 0, .03], [67, 0, .03], [67, 240, .03], [58, 240, .03]], road);
        this.face([[173, 56, .04], [181, 56, .04], [221, 240, .04], [213, 240, .04]], this.shade([209, 162, 112, 255]));
        for (const yy of [60.5, 65]) this.line([0, yy, .05], [320, yy, .05], .065, [164, 113, 84, 68]);
        for (const xx of [60, 65]) this.line([xx, 0, .05], [xx, 240, .05], .065, [164, 113, 84, 68]);
        // A teal river cut in flat, bright ribbons; bridge is at the railway.
        for (let y = 0; y < 240; y += 20) {
            const x = 135 + Math.sin(y * .026) * 10, nx = 135 + Math.sin((y + 20) * .026) * 10;
            if (!this.visible(x, y, 32, 0)) continue;
            this.face([[x - 5, y, .08], [nx - 5, y + 20, .08], [nx + 6, y + 20, .08], [x + 6, y, .08]], this.shade([92, 142, 128, 255]));
            this.face([[x - 2, y, .1], [nx - 2, y + 20, .1], [nx + 3, y + 20, .1], [x + 3, y, .1]], this.shade([76, 172, 166, 255]));
            this.line([x, y + 2, .12], [nx, y + 14, .12], .07, [174, 234, 200, 120]);
        }
        this.face([[0, 88.5, .1], [320, 88.5, .1], [320, 95.5, .1], [0, 95.5, .1]], this.shade([166, 125, 101, 255]));
        for (let x = 0; x < 320; x += 5) if (this.visible(x, 92, 6, 0)) this.line([x, 88.6, .2], [x, 95.3, .2], .34, this.shade([105, 77, 68, 255]));
        for (const yy of [90, 94]) { this.line([0, yy, .35], [320, yy, .35], .20, this.shade([72, 77, 80, 255])); this.line([0, yy - .16, .4], [320, yy - .16, .4], .065, this.shade([226, 218, 166, 255])); }
        if (this.preview) this.horizon(e);
    }
    horizon(e) {
        const p = this.painter;
        p.poly([[0, 0], [100, 0], [100, 14], [0, 14]], [36, 85, 101, 255]);
        p.poly([[0, 8], [100, 5], [100, 16], [0, 17]], [90, 144, 145, 255]);
        p.poly([[0, 12], [100, 10], [100, 19], [0, 20]], [240, 172, 115, 255]);
        p.poly(ring(81, 12.5, 6.3, 10, 18), [255, 224, 160, 245]);
        for (let i = 0; i < 8; i++) { const x = i * 16 - 8; p.poly([[x, 23], [x + 4, 9 + i % 3 * 2], [x + 11, 9 + i % 3 * 2], [x + 14, 22], [x + 19, 26]], i % 2 ? [154, 90, 115, 255] : [177, 103, 112, 255]); }
        p.poly([[0, 20], [12, 22], [28, 17], [43, 25], [62, 21], [78, 24], [100, 19], [100, 27], [0, 29]], [208, 138, 107, 255]);
        p.poly([[79, 13], [100, 56], [100, 68], [75, 14]], [255, 228, 171, 23]);
    }
    building(b, e) {
        const x = b.x, y = b.y, w = b.w || 12, d = b.d || 9, h = b.h || 9, a = x - w / 2, front = y + d / 2;
        const owned = e.player.properties.includes(b.id), near = Math.hypot(e.player.x - x, e.player.y - y) < 21;
        const base = b.color || ({ saloon: [165, 78, 75, 255], shop: [55, 133, 139, 255], sheriff: [194, 153, 89, 255], station: [88, 125, 122, 255], barn: [180, 79, 70, 255], fort: [107, 96, 105, 255], mine: [92, 82, 101, 255] })[b.kind] || [189, 120, 86, 255];
        this.shadow(x, y, (w + d) * .62, (w + d) * .23);
        if (owned && near && !this.preview) { this.interior(b, e); return; }
        this.box(x, y, w + 1, d + 1, .7, [126, 83, 72, 255]);
        this.box(x, y, w, d, h, base, .7);
        // Sun bleached board lines stop at the front corners.
        for (let i = 1; i <= 3; i++) this.line([a, front + .03, h * i / 4], [a + w, front + .03, h * i / 4], .055, this.shade(base, .64));
        this.face([[a - .5, front + .12, h], [a - .5, front + .12, h + 2.7], [x, front + .12, h + 3.4], [a + w + .5, front + .12, h + 2.7], [a + w + .5, front + .12, h]], this.shade(base, 1.02));
        this.line([a - .5, front + .2, h + 2.7], [a + w + .5, front + .2, h + 2.7], .15, this.shade(C.pale, .91));
        this.face([[a - .3, y - d / 2 - .5, h + .9], [a + w + .5, y - d / 2 - .5, h + .9], [a + w + .5, front, h + .9], [a - .3, front, h + .9]], this.shade([112, 76, 82, 255]));
        for (let i = 0; i < 3; i++) this.line([a + w / 4 * (i + 1), y - d / 2, h + 1], [a + w / 4 * (i + 1), front, h + 1], .06, this.shade([184, 125, 95, 255]));
        const doorW = Math.min(2.7, w * .22);
        this.face([[x - doorW / 2, front + .07, .8], [x + doorW / 2, front + .07, .8], [x + doorW / 2, front + .07, 5.5], [x - doorW / 2, front + .07, 5.5]], [57, 62, 66, 255]);
        this.line([x + doorW / 2, front + .09, .8], [x + doorW / 2, front + .09, 5.5], .14, this.shade(C.pale));
        if (b.kind === 'saloon') this.face([[x - doorW / 2, front + .1, 1.8], [x + doorW / 2, front + .1, 1.8], [x + doorW / 2, front + .1, 4], [x, front + .1, 3.5], [x - doorW / 2, front + .1, 4]], this.shade([165, 103, 65, 255]));
        for (const side of [-1, 1]) {
            const xx = x + side * w * .32, ww = Math.min(2.5, w * .2);
            this.face([[xx - ww / 2, front + .07, 3], [xx + ww / 2, front + .07, 3], [xx + ww / 2, front + .07, 6.1], [xx - ww / 2, front + .07, 6.1]], this.night > .3 ? [255, 193, 87, 255] : [100, 184, 171, 255]);
            this.line([xx - ww / 2, front + .1, 3], [xx + ww / 2, front + .1, 3], .13, C.pale);
            this.line([xx, front + .1, 3], [xx, front + .1, 6.1], .08, C.pale);
        }
        this.box(x, front + 1.2, w + 1.3, 2.4, .6, [186, 131, 84, 255]);
        for (const side of [-1, 1]) this.line([x + side * w * .46, front + 1.9, .5], [x + side * w * .46, front + 1.9, 4.0], .14, this.shade([222, 178, 115, 255]));
        this.face([[a - .7, front - .2, 4.6], [a + w + .7, front - .2, 4.6], [a + w + .7, front + 2.1, 3.8], [a - .7, front + 2.1, 3.8]], this.shade(base, 1.25));
        const sign = this.project(x, front + .21, h + 2.5), name = b.name || ({ shop: 'GUNSMITH', saloon: 'SALOON', sheriff: 'SHERIFF', station: 'COPPERLINE', house: 'HOMESTEAD', barn: 'LIVERY', fort: 'CROWN FORT', mine: 'SILVER MINE', pump: 'PUMP HOUSE', warehouse: 'FREIGHT', manor: 'VALE ESTATE' })[b.kind] || b.name;

        this.lantern(a + w + .4, front + 2, 3.2);
        if (h >= 11 && b.kind !== 'mine') for (const offset of [-.3, 0, .3]) { const xx = x + w * offset; this.face([[xx - 1, front + .12, h - 4.5], [xx + 1, front + .12, h - 4.5], [xx + 1, front + .12, h - 1.3], [xx - 1, front + .12, h - 1.3]], [255, 205, 128, 255]); this.line([xx, front + .14, h - 4.5], [xx, front + .14, h - 1.3], .09, C.wood); }
        if (b.kind === 'mine') { for (const offset of [-.27, .27]) { this.box(x + w * offset, y - d * .2, 2.2, 2.2, 10, [86, 81, 97, 255], h + 1); this.box(x + w * offset, y - d * .2, 3, 3, .7, [157, 120, 110, 255], h + 10.6); } const core = this.project(x, front + .3, h - 5); this.painter.poly(ring(core[0], core[1], 2, 3, 6), e.flags.dynamo ? C.teal : [172, 100, 209, 255]); this.painter.poly(ring(core[0], core[1], .7, 1.1, 6), e.flags.dynamo ? C.mint : [238, 179, 255, 255]); }
        if (b.kind === 'fort' || b.kind === 'manor') { this.line([x + w * .3, y, h + 1], [x + w * .3, y, h + 10], .11, C.wood); const at = this.project(x + w * .3, y, h + 10); this.painter.poly([[at[0], at[1]], [at[0] + 3.4, at[1] + .5], [at[0] + 3.1 + Math.sin(e.time * 3) * .3, at[1] + 2.8], [at[0], at[1] + 2.3]], e.flags.finished ? C.teal : [174, 69, 104, 255]); }
        if (b.kind === 'station') { const at = this.project(x - w * .37, front + .15, h - 1.4); this.painter.poly(ring(at[0], at[1], .6, .9, 10), C.pale); this.painter.line(at, [at[0], at[1] - .55], .055, C.ink); this.painter.line(at, [at[0] + .34, at[1] + .1], .055, C.ink); }
        if (name) { this.painter.poly([[sign[0] - w * .40, sign[1] - .7], [sign[0] + w * .40, sign[1] - .7], [sign[0] + w * .40, sign[1] + 1.35], [sign[0] - w * .40, sign[1] + 1.35]], this.shade([78, 57, 60, 255])); this.painter.text(name, sign[0], sign[1] - .45, Math.min(.92, w * .68 / (name.length * .66)), C.pale); }
        if (owned) { const at = this.project(x, front + 3.4, 1); this.painter.poly(ring(at[0], at[1], 1.2, 1.2, 4), [131, 233, 183, 255]); if (Math.hypot(e.player.x - x, e.player.y - y) < 38) this.furnishings(b, e, false); else this.box(x + w / 2 + 2, y + 1, 2.3, 2, 2.3, [72, 91, 97, 255]); }
    }
    interior(b, e) {
        const x = b.x, y = b.y, w = b.w, d = b.d, back = y - d / 2;
        this.box(x, y, w, d, .7, [194, 137, 90, 255]);
        this.face([[x - w / 2, back, .7], [x + w / 2, back, .7], [x + w / 2, back, b.h], [x - w / 2, back, b.h]], this.shade([120, 88, 91, 255]));
        this.face([[x - w / 2, back, .7], [x - w / 2, y + d / 2, .7], [x - w / 2, y + d / 2, b.h], [x - w / 2, back, b.h]], this.shade([182, 124, 93, 255]));
        this.face([[x - 3, y - 1, .76], [x + 3, y - 1, .76], [x + 3, y + 3, .76], [x - 3, y + 3, .76]], [57, 136, 141, 255]);
        this.face([[x - 2, y, .78], [x + 2, y, .78], [x + 2, y + 2, .78], [x - 2, y + 2, .78]], [235, 153, 95, 255]);
        for (let i = 0; i < 4; i++) this.line([x - w / 2, back + 1 + i * 2, .72], [x + w / 2, back + 1 + i * 2, .72], .04, [123, 82, 70, 255]);
        this.box(x - w / 2 + 2, y + 1, 2.5, 5, 1.3, [75, 100, 106, 255], .8);
        this.box(x - w / 2 + 2, y - .8, 2.3, 1.5, .35, C.pale, 2.1);
        this.furnishings(b, e, true); this.lantern(x + w / 2, y + d / 2, 5);
        const at = this.project(x, back, b.h + 1); this.painter.text('YOUR ' + (b.id === 'ranch' ? 'RANCH' : b.id === 'saloon' ? 'SALOON' : 'HOMESTEAD'), at[0], at[1], 1, C.pale);
    }
    furnishings(b, e, inside) {
        const p = this.painter, x = b.x + (inside ? 1 : b.w / 2 + 3), y = b.y + (inside ? -b.d / 2 + 1.2 : 1);
        this.box(x, y, 4.5, 1, 5, [97, 71, 60, 255], .8);
        for (let i = 0; i < Math.min(4, e.player.weapons.length); i++) { const at = this.project(x - 1.5 + i, y + .7, 2.5); drawWeapon(p, at[0], at[1], .42, e.player.weapons[i], e.player.mods, -Math.PI / 2); }
        this.box(x + 3, y + 2, 2.5, 2.1, 2.5, [72, 91, 97, 255], .7);
        const cash = this.project(x + 3, y + 3.1, 2); p.poly(ring(cash[0], cash[1], .35, .5, 8), C.gold);
        for (let i = 0; i < Math.min(3, Math.floor(e.player.money / 80)); i++) this.box(x + 2.6 + i * .5, y + 2, .4, .65, .18, C.gold, 3.22 + i * .07);
        this.box(x - 3.4, y + .3, 2.1, 1.5, 4.4, [168, 112, 70, 255], .7);
        for (let i = 0; i < Math.min(3, (e.player.outfits || [e.player.outfit]).length); i++) { const id = (e.player.outfits || [e.player.outfit])[i], outfit = id === 'redponcho' ? C.red : id === 'duster' ? [107, 72, 148, 255] : [68, 114, 159, 255]; const at = this.project(x - 3.8 + i * .7, y + 1.1, 3.7); p.poly([[at[0] - .42, at[1]], [at[0] + .42, at[1]], [at[0] + .65, at[1] + 2.1], [at[0] - .65, at[1] + 2.1]], outfit); p.poly(ring(at[0], at[1] - .3, .6, .21, 5), id === 'trailcoat' ? C.pale : C.dark); }
        for (let i = 0; i < Math.min(3, Math.ceil(e.player.reserve / 60)); i++) this.box(x + 1, y + 2.2, 1.1, .7, .45, [162, 107, 55, 255], .7 + i * .45);
        if ((e.mission || 0) > 1) { const trophy = this.project(x + 1, y, 6); p.poly(ring(trophy[0], trophy[1], .65, 1, 5, -Math.PI / 2), C.gold); }
        for (let i = 0; i < Math.min(3, e.player.medkits || 0); i++) this.box(x + 1 + i * .45, y + 2.2, .4, .6, .65, [231, 212, 170, 255], .7);
    }
    lantern(x, y, z) {
        const p = this.painter, at = this.project(x, y, z);
        if (this.night > .12) p.poly(ring(at[0], at[1], 3.7, 5.8, 10), [255, 181, 69, Math.round(35 * this.night)]);
        p.poly([[at[0] - .4, at[1]], [at[0], at[1] - .5], [at[0] + .4, at[1]], [at[0] + .32, at[1] + 1], [at[0] - .32, at[1] + 1]], [255, 204, 112, 255]);
        p.line([at[0] - .4, at[1]], [at[0] + .4, at[1]], .1, C.dark);
    }
    prop(q, e) {
        const x = q.x, y = q.y, s = q.size || 3, n = q.seed || noise(x, y), p = this.painter;
        if (q.kind === 'mesa' || q.kind === 'rock' || q.kind === 'crystal') {
            const mesa = q.kind === 'mesa', crystal = q.kind === 'crystal', r = mesa ? s : s * .7, h = mesa ? s * 1.7 : crystal ? s * 1.8 : s * .65;
            const base = q.id === 'dynamo' ? (e.flags.dynamo ? [99, 196, 185, 255] : [193, 108, 210, 255]) : crystal ? [99, 196, 185, 255] : mesa ? [185, 89, 106, 255] : [173, 128, 104, 255];
            const top = [[x - r * .62, y - r * .45, h], [x + r * .6, y - r * .45, h * .91], [x + r * .64, y + r * .46, h * .9], [x - r * .55, y + r * .57, h * 1.03]];
            this.face([[x - r, y + r * .7, 0], [x + r, y + r * .7, 0], top[2], top[3]], this.shade(base, .8));
            this.face([[x + r, y - r * .7, 0], [x + r, y + r * .7, 0], top[2], top[1]], this.shade(base, .62));
            this.face(top, this.shade(base, 1.35));
            this.face([[x - r, y + r * .7, 0], top[3], [x, y + r * .7, h * .35]], this.shade(base, 1.03));
            if (mesa) { this.face([[x - r, y + r * .7, h * .2], [x + r, y + r * .7, h * .2], [x + r * .8, y + r * .65, h * .39], [x - r * .85, y + r * .65, h * .39]], this.shade([223, 134, 97, 255])); this.face([top[0], top[1], [x, y, h * 1.01]], this.shade([234, 164, 109, 255])); }
            return;
        }
        if (q.kind === 'cactus') {
            const at = this.project(x, y), h = 3.8 + s * .7, w = .5 + s * .10;
            this.shadow(x, y, s * .7, .45);
            p.poly([[at[0] - w, at[1]], [at[0] - w, at[1] - h * .4], [at[0] - w * 2.7, at[1] - h * .4], [at[0] - w * 3, at[1] - h * .68], [at[0] - w * 2, at[1] - h * .71], [at[0] - w * 1.7, at[1] - h * .52], [at[0] - w, at[1] - h * .52], [at[0] - w, at[1] - h], [at[0] + w * .2, at[1] - h * 1.05], [at[0] + w, at[1] - h], [at[0] + w, at[1] - h * .7], [at[0] + w * 1.8, at[1] - h * .7], [at[0] + w * 1.8, at[1] - h * .9], [at[0] + w * 2.6, at[1] - h * .9], [at[0] + w * 2.6, at[1] - h * .54], [at[0] + w, at[1] - h * .54], [at[0] + w, at[1]]], this.shade([47, 126, 120, 255]));
            p.poly([[at[0] - w * .3, at[1]], [at[0] - w * .3, at[1] - h], [at[0] + w * .4, at[1] - h], [at[0] + w * .4, at[1]]], this.shade([95, 172, 143, 255]));
            if (n > .6) p.poly(ring(at[0], at[1] - h * 1.02, .48, .48, 5), [247, 128, 113, 255]); return;
        }
        if (q.kind === 'tree') {
            this.shadow(x, y, s * 1.3, s * .5); this.line([x, y, 0], [x, y, s * 2.8], .22, this.shade([117, 86, 77, 255]));
            for (let i = 0; i < 3; i++) { const at = this.project(x, y, s * (1.4 + i * .55)); p.poly([[at[0] - s * (1.2 - i * .25), at[1]], [at[0], at[1] - s * 1.9], [at[0] + s * (1.2 - i * .25), at[1] + .3]], this.shade(i % 2 ? [57, 121, 117, 255] : [79, 147, 127, 255])); } return;
        }
        if (q.kind === 'fence') {
            const r = s * 1.4;
            for (const xx of [-r, r]) this.line([x + xx, y, 0], [x + xx, y, 3], .14, this.shade([153, 104, 71, 255]));
            for (const z of [1.1, 2.4]) this.line([x - r, y, z], [x + r, y, z], .14, this.shade([207, 157, 96, 255])); return;
        }
        if (q.kind === 'windmill') {
            for (const xx of [-1.6, 1.6]) this.line([x + xx, y, 0], [x, y, 14], .14, this.shade(C.wood));
            this.line([x - 1, y, 5], [x + 1, y, 9], .08, this.shade(C.wood));
            const at = this.project(x, y, 14), a = e.time * .7;
            for (let i = 0; i < 8; i++) { const t = a + i * Math.PI / 4; p.poly([[at[0], at[1]], [at[0] + Math.cos(t) * 3, at[1] + Math.sin(t) * 4.7], [at[0] + Math.cos(t + .3) * 3, at[1] + Math.sin(t + .3) * 4.7]], this.shade(i % 2 ? [197, 211, 191, 255] : [238, 209, 155, 255])); } return;
        }
        if (q.kind === 'water') { this.box(x, y, s * 2, s * 2, .45, [104, 95, 86, 255]); this.face([[x - s + .3, y - s + .3, .47], [x + s - .3, y - s + .3, .47], [x + s - .3, y + s - .3, .47], [x - s + .3, y + s - .3, .47]], this.shade(q.id === 'pump-water' && !e.flags.water ? [145, 111, 87, 255] : [72, 163, 160, 255])); return; }
        if (q.kind === 'grave') { this.box(x, y, 1.5, .7, 2.5, [125, 116, 119, 255]); this.line([x, y + .4, 1.3], [x, y + .4, 2.2], .07, C.dark); this.line([x - .3, y + .4, 1.9], [x + .3, y + .4, 1.9], .07, C.dark); return; }
        if (q.kind === 'camp') {
            this.face([[x - 3, y + 2, 0], [x, y, 5], [x + 3, y + 2, 0]], this.shade([223, 169, 108, 255]));
            this.face([[x + 3, y + 2, 0], [x, y, 5], [x, y - 4, 5], [x + 3, y - 2, 0]], this.shade([154, 91, 73, 255]));
            const at = this.project(x - 4, y + 3); p.poly(ring(at[0], at[1], 1.5, .65, 6), C.dark); p.poly([[at[0] - .65, at[1]], [at[0] + .15, at[1] - 2.1 - Math.sin(e.time * 11) * .3], [at[0] + .75, at[1]]], [255, 179, 64, 255]); return;
        }
        if (q.kind === 'wagon') {
            this.box(x, y, 6, 3, 2, [164, 98, 63, 255], 1);
            for (const xx of [-2, 2]) { const at = this.project(x + xx, y + 1.6, 1); p.poly(ring(at[0], at[1], .8, 1.3, 8), C.dark); p.poly(ring(at[0], at[1], .55, .9, 8), this.shade(C.gold)); }
            this.face([[x - 3, y - 1.5, 3], [x - 3, y - .8, 5], [x - 3, y + .8, 5], [x - 3, y + 1.5, 3]], this.shade(C.pale));
            this.face([[x - 3, y + .8, 5], [x + 3, y + .8, 5], [x + 3, y + 1.5, 3], [x - 3, y + 1.5, 3]], this.shade(C.pale, .83)); return;
        }
        this.box(x, y, 2, 2, 2, [165, 111, 73, 255]);
        this.line([x - 1, y + 1.03, 0], [x + 1, y + 1.03, 2], .09, this.shade(C.pale, .8));
    }
    person(q, e, options = {}) {
        const p = this.painter, scale = options.scale || 1, at = this.project(q.x, q.y, options.z || 0), x = at[0], y = at[1], bob = options.rider ? 0 : Math.sin(e.time * 10 + q.x) * (q.moving ? .18 : .025);
        const f = (pts, c) => p.poly(pts.map(v => [x + v[0] * scale, y + (v[1] + bob) * scale]), this.shade(c));
        const coat = options.color || (q.outfit === 'redponcho' ? [231, 89, 75, 255] : q.outfit === 'duster' ? [107, 72, 148, 255] : [68, 114, 159, 255]);
        const blackHat = options.enemy || q.outfit === 'redponcho' || q.outfit === 'duster';
        if (!options.rider) this.shadow(q.x, q.y, 2.3, .7);
        const step = q.moving ? Math.sin(e.time * 14) * .38 : .12;
        f([[-.78, -.15], [-.1, -.15], [-.16, -2.5], [-.75, -2.7]], [52, 63, 76, 255]);
        f([[.22, -.15 - step], [.95, -.15 - step], [.72, -2.7], [.03, -2.5]], [82, 87, 99, 255]);
        f([[-1.06, -.12], [-.13, -.12], [-.13, -.72], [-.81, -.72]], C.wood); f([[.05, -.14 - step], [1.12, -.14 - step], [.91, -.7 - step], [.22, -.7 - step]], C.wood);
        f([[-1.1, -4.5], [.95, -4.5], [1.12, -2], [.55, -1.55], [.1, -2.25], [-.3, -1.7], [-1.25, -2.1]], coat);
        f([[-1.1, -4.5], [-.16, -4.8], [-.08, -2], [-1.25, -2.1]], tint(coat, 1.2));
        if (q.outfit === 'redponcho') { f([[-1.3, -4.3], [1.2, -4.3], [1.6, -2.4], [0, -1.7], [-1.6, -2.4]], [231, 89, 75, 255]); f([[-1.4, -2.9], [1.4, -2.9], [1.55, -2.6], [-1.55, -2.6]], C.gold); }
        if (q.outfit === 'duster') { f([[-.7, -4.3], [.1, -3.8], [-.18, -1.9], [-.65, -2.1]], [70, 180, 149, 255]); f([[-1.14, -4.5], [-.64, -4.5], [-.64, -4.16], [-1.14, -4.16]], C.gold); }
        f([[-.9, -2.6], [.95, -2.6], [.95, -2.32], [-1, -2.32]], C.wood); f([[-.08, -2.64], [.29, -2.64], [.29, -2.27], [-.08, -2.27]], C.gold);
        f([[-.62, -5.4], [.49, -5.4], [.56, -4.65], [0, -4.32], [-.58, -4.65]], q.hurt > 0 ? [255, 218, 194, 255] : C.skin);
        f([[-.72, -4.55], [.62, -4.55], [.12, -3.9], [-.12, -4.3]], options.enemy ? C.dark : q.outfit === 'duster' ? [70, 180, 149, 255] : [242, 116, 94, 255]);
        f([[-1.48, -5.46], [-.87, -5.73], [.98, -5.68], [1.47, -5.34], [.8, -5.1], [-.82, -5.18]], blackHat ? C.dark : [243, 223, 179, 255]);
        f([[-.8, -5.61], [-.58, -6.4], [.56, -6.5], [.87, -5.56]], blackHat ? [68, 58, 72, 255] : [226, 204, 158, 255]);
        f([[-.8, -5.61], [.87, -5.56], [.8, -5.83], [-.72, -5.93]], options.enemy ? C.red : C.wood);
        if (options.hero) { f([[-1.2, -2.8], [-.85, -2.8], [-.85, -1.75], [-1.38, -1.75]], C.wood); }
        const a = Number.isFinite(q.angle) ? q.angle : -.3, dir = Math.cos(a) - Math.sin(a), gunAngle = dir < 0 ? Math.PI + .18 : -.18;
        f([[.65 * Math.sign(dir || 1), -4.3], [1.8 * Math.sign(dir || 1), -3.7], [1.6 * Math.sign(dir || 1), -3.18], [.6 * Math.sign(dir || 1), -3.5]], coat);
        if (!options.civilian) drawWeapon(p, x + Math.sign(dir || 1) * 1.3 * scale, y - 3.3 * scale, .47 * scale, q.weapon || (q.kind === 'gunner' ? 'repeater' : 'revolver'), q.mods || [], gunAngle);
        if (options.hero) { const t = this.project(q.x, q.y, .05); p.poly([[t[0] - .5, t[1] + .6], [t[0], t[1] + 1.25], [t[0] + .5, t[1] + .6]], [185, 252, 214, 255]); }
    }
    player(q, e) {
        if (q.mounted) { this.horse({ x: q.x, y: q.y, angle: q.angle, moving: q.moving }, e); this.person(q, e, { z: 3.7, scale: .9, rider: true, hero: true }); }
        else this.person(q, e, { z: q.aboard ? 8 : 0, scale: 1.12, hero: true });
    }
    npc(q, e) {
        const colors = { june: [218, 123, 74, 255], inez: [63, 147, 156, 255], ezra: [163, 110, 159, 255], sol: [102, 131, 80, 255], ada: [220, 190, 139, 255], vale: [100, 97, 116, 255] };
        this.person(q, e, { color: q.color || colors[q.id], civilian: q.id !== 'june' });
        if (Math.hypot(e.player.x - q.x, e.player.y - q.y) < 13 && !this.preview) { const at = this.project(q.x, q.y, 9); this.painter.poly(ring(at[0], at[1] - .8, .4, .65, 4), C.gold); this.painter.text(({ june: 'JUNE', inez: 'INEZ', ezra: 'EZRA', sol: 'DR. SOL', ada: 'ADA', vale: 'VALE' })[q.id] || q.id.toUpperCase(), at[0], at[1] - 3, .82, C.pale); }
    }
    enemy(q, e) {
        if (q.kind === 'boss' || q.kind === 'brute') {
            const at = this.project(q.x, q.y, q.trainOffset !== undefined ? 13 : 5), p = this.painter, wide = q.kind === 'boss' ? 2.5 : 1.8;
            p.poly([[at[0] - wide, at[1] - .5], [at[0] + wide, at[1] - .5], [at[0] + wide + .3, at[1] + 2.7], [at[0] - wide - .3, at[1] + 2.7]], [69, 76, 90, 255]);
            for (const side of [-1, 1]) { p.poly([[at[0] + side * 1.1, at[1] - .8], [at[0] + side * (wide + .5), at[1]], [at[0] + side * wide, at[1] + 1.2], [at[0] + side * 1.2, at[1] + 1.1]], [172, 129, 80, 255]); p.line([at[0] + side * wide, at[1] + 1.1], [at[0] + side * wide, at[1] + 3.5], .16, [121, 190, 181, 255]); }
            if (q.kind === 'boss') drawWeapon(p, at[0] + 1.7, at[1] - .1, .8, 'voltaic', ['brasscoil', 'drummag'], -.1);
        }
        if (q.windup > 0) { const at = this.project(q.x, q.y); this.painter.poly(ring(at[0], at[1], q.kind === 'brute' ? 5 : 2.8, 1.25, 10), [236, 85, 79, 55]); }
        this.person(q, e, { color: q.kind === 'boss' ? [98, 68, 116, 255] : q.kind === 'brute' ? [133, 82, 68, 255] : [178, 76, 76, 255], scale: q.kind === 'boss' ? 1.3 : q.kind === 'brute' ? 1.15 : 1, z: q.trainOffset !== undefined ? 8 : 0, enemy: true });
        if (q.hp < q.maxHp || q.windup > 0) { const at = this.project(q.x, q.y, 8.5); this.painter.line([at[0] - 1.8, at[1]], [at[0] + 1.8, at[1]], .19, [60, 46, 62, 255]); this.painter.line([at[0] - 1.8, at[1]], [at[0] - 1.8 + 3.6 * q.hp / q.maxHp, at[1]], .12, [245, 119, 96, 255]); }
    }
    horse(q, e) {
        if (!this.visible(q.x, q.y, 10, 10)) return;
        const a = q.angle || 0, moving = !!q.moving;
        const v = (x, y, z) => [q.x + x * Math.cos(a) - y * Math.sin(a), q.y + x * Math.sin(a) + y * Math.cos(a), z];
        this.shadow(q.x, q.y, 4.4, 1.5);
        for (const x of [-2.1, 1.9]) for (const y of [-.65, .65]) { const stride = moving ? Math.sin(e.time * 13 + x + y * 3) * .7 : 0; this.line(v(x, y, 2.7), v(x + stride, y, .3), .2, this.shade(y < 0 ? [104, 69, 63, 255] : [132, 86, 65, 255])); }
        this.face([v(-2.8, -.8, 2.8), v(2.3, -.8, 2.8), v(2.4, .8, 2.8), v(-2.8, .8, 2.8)], this.shade([173, 104, 63, 255]));
        this.face([v(-2.8, .8, 2.8), v(2.4, .8, 2.8), v(1.8, .8, 4.2), v(-2.1, .8, 4.1)], this.shade([182, 112, 71, 255]));
        this.face([v(-2.1, -.8, 4.1), v(1.8, -.8, 4.2), v(1.8, .8, 4.2), v(-2.1, .8, 4.1)], this.shade([214, 151, 89, 255]));
        this.face([v(1.7, -.55, 3.6), v(2.3, -.5, 6.1), v(3.5, -.5, 5.8), v(4.2, -.5, 4.7), v(3.4, -.5, 4.3), v(2.6, -.5, 4.6)], this.shade([196, 125, 73, 255]));
        this.face([v(1.7, .55, 3.6), v(2.3, .5, 6.1), v(3.5, .5, 5.8), v(4.2, .5, 4.7), v(3.4, .5, 4.3), v(2.6, .5, 4.6)], this.shade([146, 86, 63, 255]));
        this.face([v(2.3, -.5, 6.1), v(2.3, .5, 6.1), v(3.5, .5, 5.8), v(3.5, -.5, 5.8)], this.shade([233, 175, 109, 255]));
        this.line(v(2.55, -.5, 6.1), v(2.3, -.5, 6.9), .12, this.shade(C.wood)); this.line(v(2.55, .5, 6.1), v(2.3, .5, 6.9), .12, this.shade(C.wood));
        this.face([v(-1.3, -1, 4.25), v(.9, -1, 4.25), v(.9, 1, 4.25), v(-1.3, 1, 4.25)], [64, 155, 151, 255]);
        this.face([v(-.8, -.7, 4.5), v(.65, -.7, 4.5), v(.65, .7, 4.5), v(-.8, .7, 4.5)], this.shade(C.wood));
        this.line(v(-2.7, 0, 3.8), v(-3.6, .1, 1.8), .28, this.shade([67, 54, 57, 255]));
        this.line(v(3.55, .58, 5.2), v(.7, .75, 4.4), .06, C.gold);
    }
    train(q, e) {
        const x = q.x, y = q.y, p = this.painter, direction = q.direction || 1;
        const turn = point => [x + (point[0] - x) * direction, point[1], point[2] || 0];
        const project = (xx, yy, z = 0) => this.project(...turn([xx, yy, z]));
        const face = (points, c) => this.face(points.map(turn), c);
        const line = (a, b, w, c) => this.line(turn(a), turn(b), w, c);
        const box = (xx, yy, w, d, h, c, z = 0) => this.box(x + (xx - x) * direction, yy, w, d, h, c, z);
        this.shadow(x, y, 11, 3.4);
        box(x, y, 13, 4.7, 1.4, [64, 75, 83, 255], 1.1);
        for (const dx of [-4.5, -1.5, 1.5, 4.5]) { const at = project(x + dx, y + 2.5, 1.4); p.poly(ring(at[0], at[1], 1.1, 1.6, 8), [45, 53, 62, 255]); p.poly(ring(at[0], at[1], .65, 1, 8), [187, 128, 77, 255]); p.line([at[0], at[1]], [at[0] + Math.cos(e.time * 7) * .7, at[1] + Math.sin(e.time * 7)], .08, C.pale); }
        if (q.car === 0) {
            box(x - 4, y, 3.5, 4.6, 5.8, [42, 116, 117, 255], 2.3);
            box(x - 4, y, 4.2, 5.4, .5, [56, 65, 74, 255], 8.1);
            face([[x - 5.4, y + 2.35, 5], [x - 2.6, y + 2.35, 5], [x - 2.6, y + 2.35, 7.5], [x - 5.4, y + 2.35, 7.5]], [245, 184, 91, 255]);
            box(x + 1.3, y, 7, 3.6, 3.1, [57, 101, 105, 255], 2.8);
            face([[x - 2, y - 1.8, 5.9], [x + 4.8, y - 1.8, 5.9], [x + 4.8, y, 6.7], [x - 2, y, 6.7]], this.shade([94, 146, 141, 255]));
            face([[x - 2, y, 6.7], [x + 4.8, y, 6.7], [x + 4.8, y + 1.8, 5.9], [x - 2, y + 1.8, 5.9]], this.shade([71, 126, 125, 255]));
            for (const dx of [-.8, 2.9]) line([x + dx, y + 1.9, 2.9], [x + dx, y + 1.9, 5.9], .17, C.gold);
            box(x + 3.2, y, 1.8, 1.8, 3.3, [61, 66, 72, 255], 6.3);
            box(x + 3.2, y, 2.3, 2.3, .6, [77, 81, 84, 255], 9.6);
            face([[x + 6.5, y - 2.2, 2.3], [x + 9, y, .8], [x + 6.5, y + 2.2, 2.3]], [183, 111, 72, 255]);
            const light = project(x + 5, y, 4.9); p.poly(ring(light[0], light[1], .85, 1.2, 8), [255, 216, 119, 255]);
            for (let i = 0; i < 6; i++) { const age = (e.time * .7 + i / 6) % 1, at = project(x + 3.2 - age * 12, y - age * 2, 10 + age * 15); p.poly(ring(at[0], at[1], 1 + age * 4, 1.5 + age * 3, 7, age), [236, 219, 179, Math.round(110 * (1 - age))]); }
        } else if (q.car === 1) {
            box(x, y, 12, 4.6, 2.2, [120, 70, 68, 255], 2.5);
            for (let i = 0; i < 4; i++) face([[x - 5 + i * 2.8, y - 1.7, 4.8], [x - 3.4 + i * 2.8, y + .5, 6.2], [x - 2.3 + i * 2.8, y + 1.7, 4.8]], [54, 54, 63, 255]);
            for (const xx of [-4.7, 4.7]) for (const yy of [-.8, .8]) line([x + xx, y + yy, 4.7], [x + xx, y + yy, 7.7], .11, [130, 128, 119, 255]);
            box(x, y, 13.2, 1.8, .35, [171, 129, 88, 255], 7.65);
            for (let xx = -5; xx < 6; xx += 2) line([x + xx, y - .85, 8.02], [x + xx, y + .85, 8.02], .05, C.wood);
        } else {
            box(x, y, 12, 4.5, 4.7, q.car === 2 ? [149, 77, 73, 255] : [51, 113, 121, 255], 2.5);
            box(x, y, 12.8, 5.1, .8, [88, 87, 88, 255], 7.2);
            for (let i = 0; i < 4; i++) face([[x - 4.8 + i * 2.7, y + 2.3, 4.1], [x - 3.1 + i * 2.7, y + 2.3, 4.1], [x - 3.1 + i * 2.7, y + 2.3, 6.6], [x - 4.8 + i * 2.7, y + 2.3, 6.6]], [245, 193, 112, 255]);
            line([x - 5.8, y + 2.32, 3.5], [x + 5.8, y + 2.32, 3.5], .1, C.gold);
            if (q.car === 3) for (let i = 0; i < 3; i++) {
                const at = project(x - 4 + i * 2.7, y + 2.34, 5.2);
                p.poly(ring(at[0], at[1], .3, .45, 5), C.skin);
                p.poly([[at[0] - .38, at[1] + .3], [at[0] + .38, at[1] + .3], [at[0] + .42, at[1] + 1]], e.flags.prisoners ? C.teal : C.dark);
                if (!e.flags.prisoners) for (const dx of [-.5, .5]) line([x - 4 + i * 2.7 + dx, y + 2.4, 4.1], [x - 4 + i * 2.7 + dx, y + 2.4, 6.6], .055, C.ink);
            }
        }
        line([x - 7.6, y, 1.8], [x - 6.2, y, 1.8], .18, C.dark);
        if (q.car < 3) box(x - 7.5, y, 2, 1.5, .24, [162, 149, 117, 255], 7.76);
    }
    loot(q, e) {
        const p = this.painter, at = this.project(q.x, q.y, 1.5 + Math.sin(e.time * 3 + q.x) * .3), c = q.kind === 'health' || q.kind === 'medkit' || q.kind === 'medicine' ? [144, 234, 181, 255] : C.gold;
        this.shadow(q.x, q.y, 1, .35); p.poly(ring(at[0], at[1], .65, .9, q.kind === 'ammo' ? 4 : 6), c); p.poly(ring(at[0] - .15, at[1] - .25, .16, .3, 4), C.pale);
    }
    atmosphere(e) {
        const p = this.painter;
        for (const shot of e.shots || []) { const at = this.project(shot.x, shot.y, shot.z || 3.3), old = this.project(shot.px === undefined ? shot.x - 1 : shot.px, shot.py === undefined ? shot.y - 1 : shot.py, shot.z || 3.3); p.line(old, at, .12, shot.enemy ? [255, 114, 92, 255] : [255, 244, 184, 255]); }
        for (const effect of e.effects || []) {
            const at = this.project(effect.x, effect.y, effect.z === undefined ? (effect.kind === 'dust' ? .2 : 2) : effect.z), life = clamp(effect.life || .2, 0, 1);
            if (effect.kind === 'dust') p.poly(ring(at[0], at[1], 1.5 + life, .6 + life * .4, 6), [240, 189, 119, Math.round(life * 75)]);
            else { const c = effect.kind === 'heal' ? [142, 247, 187, 190] : effect.kind === 'electric' ? [128, 251, 231, 255] : [255, 220, 140, 230]; for (let i = 0; i < 3; i++) { const a = i * 2.094 + effect.x; p.line([at[0] + Math.cos(a) * .6, at[1] + Math.sin(a) * .6], [at[0] + Math.cos(a) * (2.3 - life), at[1] + Math.sin(a) * (2.3 - life)], .10, c); } }
        }
        if (!this.preview && e.objective) { const objective = e.objective(); if (objective && Number.isFinite(objective.x) && Number.isFinite(objective.y)) { const at = this.project(objective.x, objective.y, 9); if (this.visible(objective.x, objective.y, 0, 0)) { const bob = Math.sin(e.time * 3) * .45; p.poly([[at[0] - .7, at[1] - 1 + bob], [at[0], at[1] + bob], [at[0] + .7, at[1] - 1 + bob]], [255, 224, 136, 245]); } } }
        if (e.player.focusTime > 0) {
            const glow = [255, 215, 120, Math.round(22 + Math.sin(e.time * 6) * 5)];
            p.poly([[0, 12], [3, 12], [8, 88], [0, 88]], glow); p.poly([[97, 12], [100, 12], [100, 88], [92, 88]], glow);
            const at = this.project(e.player.x, e.player.y, .1);
            for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + e.time * .1; p.line([at[0] + Math.cos(a) * 3.4, at[1] + Math.sin(a) * 1.5], [at[0] + Math.cos(a) * 4, at[1] + Math.sin(a) * 1.8], .06, C.gold); }
        }
        // Sparse drifting dust catches the late afternoon light without obscuring play.
        for (let i = 0; i < 12; i++) { const x = ((noise(i, 8) * 110 + e.time * .55) % 110) - 5, y = 18 + noise(i, 2) * 76; p.line([x, y], [x + .25, y - .12], .035, [255, 236, 182, 80]); }
        if (this.night > .2) p.poly([[0, 0], [100, 0], [100, 100], [0, 100]], [32, 48, 84, Math.round(this.night * 30)]);
        if (e.player.hurt > 0) { const alpha = Math.round(clamp(e.player.hurt, 0, 1) * 65); p.poly([[0, 0], [3, 0], [3, 100], [0, 100]], [217, 77, 86, alpha]); p.poly([[97, 0], [100, 0], [100, 100], [97, 100]], [217, 77, 86, alpha]); }
    }
}
module.exports = { FrontierScene, Painter, drawWeapon };
