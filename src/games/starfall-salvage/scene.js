'use strict';
const { GameNode, Shapes } = require('squish-150');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tint = (c, n = 1, alpha = 255) => [clamp(Math.round(c[0] * n), 0, 255), clamp(Math.round(c[1] * n), 0, 255), clamp(Math.round(c[2] * n), 0, 255), Math.round(alpha)];
const C = { ink: [12, 19, 40, 255], dark: [26, 39, 60, 255], cream: [244, 240, 216, 255], mint: [103, 233, 210, 255], coral: [255, 139, 107, 255], lilac: [163, 152, 246, 255], yellow: [255, 210, 115, 255], blue: [63, 117, 152, 255] };
const hash = (n, m = 0) => { const a = Math.sin(n * 127.1 + m * 311.7) * 43758.5453; return a - Math.floor(a); };
const ring = (x, y, rx, ry, n = 8, a = 0) => Array.from({ length: n }, (_, i) => [x + Math.cos(a + i * Math.PI * 2 / n) * rx, y + Math.sin(a + i * Math.PI * 2 / n) * ry]);
function clip(points) {
    let out = points;
    for (const [axis, bound, sign] of [[0, 0, 1], [0, 100, -1], [1, 0, 1], [1, 100, -1]]) {
        const input = out; out = []; if (!input.length) break;
        let a = input[input.length - 1], inside = (a[axis] - bound) * sign >= 0;
        for (const b of input) {
            const next = (b[axis] - bound) * sign >= 0;
            if (next !== inside) { const t = (bound - a[axis]) / (b[axis] - a[axis]); const edge = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; edge[axis] = bound; out.push(edge); }
            if (next) out.push(b); a = b; inside = next;
        }
    }
    return out;
}
class Painter {
    constructor(root, limit = 720) { this.root = root; this.pool = []; this.labels = []; this.limit = limit; this.peak = 0; this.overflow = 0; }
    begin() { this.used = 0; this.labelUsed = 0; this.nodes = []; }
    poly(points, fill) {
        if (!fill || points.some(q => !q.every(Number.isFinite))) return;
        points = clip(points); if (points.length < 3) return;
        if (this.used >= this.limit) { this.overflow++; return; }
        let shape = this.pool[this.used];
        if (!shape) shape = this.pool[this.used] = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0], [0, 0], [0, 0]], fill, color: [255, 255, 255, 255] });
        shape.node.coordinates2d = [...points, points[0]]; shape.node.fill = fill; shape.node.color = [255, 255, 255, fill[3] === undefined ? 255 : fill[3]];
        this.nodes.push(shape); this.used++;
    }
    line(a, b, width, color) {
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1, nx = -dy / length * width, ny = dx / length * width;
        this.poly([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], color);
    }
    text(text, x, y, size = .8, color = C.cream) {
        if (x < 5 || x > 95 || y < 1 || y > 96 || this.labelUsed >= 20) return;
        const info = { text, x, y, size, color, align: 'center' };
        let label = this.labels[this.labelUsed]; if (!label) label = this.labels[this.labelUsed] = new GameNode.Text({ textInfo: info });
        label.node.text = info; this.nodes.push(label); this.labelUsed++;
    }
    end() { this.root.node.children = this.nodes; this.peak = Math.max(this.peak, this.used); }
}

// Screen-space ship art; one x unit is 1.6 y units, so the silhouette remains
// physically proportionate on the 16:10 game canvas at every preview scale.
function drawShip(p, x, y, scale = 1, angle = -Math.PI / 2, loadout = {}, options = {}) {
    const t = options.time || 0, s = scale, a = angle, v = (u, w) => [x + (u * Math.cos(a) - w * Math.sin(a)) * s, y + (u * Math.sin(a) + w * Math.cos(a)) * s * 1.6];
    const f = (points, c) => p.poly(points.map(q => v(...q)), c), l = (a, b, w, c) => p.line(v(...a), v(...b), w * s, c);
    const drive = loadout.drive || 'ion-drive', weapon = loadout.weapon || 'spark', hull = loadout.hull || 'patchwork-hull';
    const primary = options.hurt > 0 ? [255, 242, 215, 255] : hull === 'aegis-hull' ? [170, 163, 236, 255] : hull === 'cargo-hull' ? [225, 165, 113, 255] : [224, 221, 193, 255];
    const engineColor = drive === 'fold-drive' ? C.lilac : drive === 'comet-drive' ? C.mint : C.yellow;
    const flame = options.preview ? 0 : (options.boost ? 8.5 : 3.3) + Math.sin(t * 19) * .6;
    for (const side of [-1, 1]) {
        f([[-5.7, side * 3 - .65], [-7.8 - flame, side * 3], [-5.7, side * 3 + .65]], tint(engineColor, 1, 80));
        f([[-5.7, side * 3 - .28], [-6.8 - flame * .65, side * 3], [-5.7, side * 3 + .28]], C.cream);
    }
    // Unequal salvaged wings give Kestrel its familiar patchwork silhouette.
    for (const side of [-1, 1]) {
        const module = side < 0 ? loadout.port || 'port-wing' : loadout.starboard || 'starboard-wing';
        f([[-5, side * 1.7], [-5.9, side * 4.3], [-2.4, side * 7], [2.1, side * 5.5], [3.4, side * 1.8]], side < 0 ? [59, 103, 127, 255] : [77, 82, 120, 255]);
        f([[-4.6, side * 2.5], [-2.4, side * 6.4], [1.5, side * 5.1], [2.6, side * 2]], side < 0 ? C.coral : C.yellow);
        f([[-2.4, side * 6.4], [-1.8, side * 3.1], [2.6, side * 2], [1.5, side * 5.1]], side < 0 ? [225, 104, 94, 255] : [204, 155, 82, 255]);
        l([-4.5, side * 3.5], [-1.9, side * 5.7], .11, C.cream);
        f([[-6.3, side * 2.1], [-6.3, side * 3.7], [-2.7, side * 3.7], [-1.4, side * 2.9], [-2.7, side * 2.1]], [52, 77, 93, 255]);
        f([[-5.8, side * 2.35], [-5.8, side * 3.4], [-2.9, side * 3.4], [-2.9, side * 2.35]], engineColor);
        f([[-5.9, side * 2.5], [-5.9, side * 3.25], [-4, side * 3.25], [-4, side * 2.5]], C.dark);
        if (module === 'tractor') {
            f([[-2, side * 6], [-.5, side * 7.5], [3.7, side * 7.1], [4.5, side * 5.5], [3.4, side * 5.2], [2.5, side * 6], [.5, side * 6]], C.mint);
            l([-.3, side * 6.9], [2.5, side * 6.6], .17, C.mint);
        } else if (module === 'arc-pod' || module === 'missile-pod') {
            f([[-1.7, side * 5], [3.1, side * 5], [4.3, side * 6], [2.8, side * 7.2], [-2.2, side * 7.2]], module === 'arc-pod' ? [78, 143, 155, 255] : [172, 111, 97, 255]);
            for (let i = 0; i < (module === 'arc-pod' ? 3 : 4); i++) f([[.1 + i * .9, side * 5.5], [.7 + i * .9, side * 5.5], [.7 + i * .9, side * 6.8], [.1 + i * .9, side * 6.8]], module === 'arc-pod' ? C.lilac : C.coral);
        } else if (module === 'bulwark') {
            f([[-3.1, side * 5.7], [-2.4, side * 8], [2.7, side * 8], [4.2, side * 6.3], [2, side * 5.7]], [142, 172, 188, 255]);
            f([[-2.2, side * 6.1], [-1.9, side * 7.5], [2.4, side * 7.5], [3.1, side * 6.5]], C.mint);
        }
    }
    f([[-6.7, -1.8], [-4, -3.1], [2.7, -2.5], [8.8, -.8], [9.7, 0], [8.8, .8], [2.7, 2.5], [-4, 3.1], [-6.7, 1.8]], [44, 65, 81, 255]);
    f([[-6, -1.4], [-3.7, -2.5], [2.7, -2.1], [8.7, -.55], [9.3, 0], [-2, 0]], tint(primary, 1.03));
    f([[-6, 1.4], [-3.7, 2.5], [2.7, 2.1], [8.7, .55], [9.3, 0], [-2, 0]], tint(primary, .77));
    f([[-6, -1.4], [-2, 0], [-6, 1.4], [-7, .5], [-7, -.5]], [88, 115, 125, 255]);
    f([[-1.7, -.6], [2.9, -1.5], [6.9, -.4], [7.5, 0], [2.1, .7], [-1.7, .5]], [24, 67, 88, 255]);
    f([[.1, -.5], [3, -1.1], [6.3, -.35], [3.2, .05]], [141, 242, 222, 255]);
    l([3.6, -.8], [3.6, .35], .10, C.cream);
    f([[-4.5, -1.8], [-2.7, -1.5], [-2.7, 1.5], [-4.5, 1.8]], C.coral);
    for (let i = 0; i < 3; i++) l([-4.2 + i * .5, -.9], [-4.2 + i * .5, .9], .085, C.dark);
    if (hull === 'cargo-hull') for (const side of [-1, 1]) f([[-4.5, side * 1.9], [-1.3, side * 1.5], [-.8, side * 3.2], [-4.2, side * 3.9]], [226, 184, 101, 255]);
    if (hull === 'aegis-hull') for (const side of [-1, 1]) f([[-3.8, side * 1.7], [-1.8, side * 3.5], [3.8, side * 2.8], [6.2, side * 1.1]], [150, 160, 199, 255]);
    if (drive !== 'ion-drive') {
        f([[-6, -.6], [-8.5, -.9], [-9.5, 0], [-8.5, .9], [-6, .6]], [89, 104, 127, 255]);
        f([[-8, -.55], [-9.3 - flame * .6, 0], [-8, .55]], engineColor);
        l([-7.2, -1.4], [-7.2, 1.4], .18, engineColor);
    }
    if (drive === 'fold-drive') for (const side of [-1, 1]) { f([[-9.2, side * 2.2], [-9.2, side * 3.6], [-8.2, side * 4.3], [-7.2, side * 3.6], [-7.2, side * 2.2], [-8.2, side * 1.5]], C.lilac); f([[-8.8, side * 2.4], [-8.8, side * 3.4], [-8.2, side * 3.8], [-7.6, side * 3.4], [-7.6, side * 2.4], [-8.2, side * 2]], C.dark); }
    if (hull === 'aegis-hull') f([[-3, -.22], [5.7, -.12], [6.4, 0], [5.7, .12], [-3, .22]], C.mint);
    if (weapon === 'lance' || weapon === 'sunblade') {
        f([[3, -2.2], [10.7, -1.2], [11.3, -.3], [7.3, -.35], [2.6, -1.2]], weapon === 'sunblade' ? C.yellow : [93, 163, 176, 255]);
        l([5, -1.35], [11, -.6], .14, weapon === 'sunblade' ? C.coral : C.mint);
    } else if (weapon === 'scatter') for (let i = -2; i <= 2; i++) {
        const tip = 9 - Math.abs(i) * .7;
        f([[3.2, i * .7 - .28], [tip, i * 1.4 - .4], [tip, i * 1.4 + .4], [3.2, i * .7 + .28]], i % 2 ? C.coral : [233, 153, 165, 255]);
        l([tip - .7, i * 1.4], [tip, i * 1.4], .10, C.yellow);
    } else if (weapon === 'orbit') {
        for (const side of [-1, 1]) { const d = 8 + Math.sin(t * 2) * .3; f([[0, side * d], [1.6, side * (d + 1)], [3, side * d], [1.6, side * (d - 1)]], C.lilac); l([.8, side * d], [2.2, side * d], .13, C.mint); }
    } else for (const side of [-1, 1]) l([3, side * 2], [6.5, side * 1.5], .20, C.yellow);
    f([[5.7, -.25], [7.6, 0], [5.7, .25]], C.cream);
}

function drawPortrait(p, x, y, size = 8, crewId = 'moth') {
    const v = (a, b) => [x + a * size, y + b * size * 1.6], f = (a, c) => p.poly(a.map(q => v(...q)), c);
    if (crewId === 'unknown') {
        f([[-.4, -.3], [0, -.52], [.4, -.3], [.4, .25], [0, .5], [-.4, .25]], [44, 62, 83, 255]);
        f([[-.26, -.15], [.26, -.15], [.26, .12], [-.26, .12]], [68, 92, 109, 255]);
        p.text('?', x, y - size * .18, size * .26, C.lilac);
    } else if (crewId === 'heart') {
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, r = i % 2 ? .49 : .62;
            f([[Math.cos(a - .16) * .34, Math.sin(a - .16) * .34], [Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a + .16) * .34, Math.sin(a + .16) * .34]], i % 2 ? C.coral : C.yellow);
        }
        const halo = ring(0, 0, .39, .39, 8, Math.PI / 8);
        for (let i = 0; i < 8; i++) f([[0, 0], halo[i], halo[(i + 1) % 8]], [C.yellow, C.cream, C.mint, [87, 177, 167, 255], C.coral, [226, 129, 116, 255], C.yellow, C.cream][i]);
        f([[-.18, 0], [0, -.24], [.18, 0], [0, .25]], C.dark);
        f([[-.09, 0], [0, -.15], [.09, 0], [0, .15]], C.cream);
    } else if (crewId === 'signal') {
        p.line(v(-.27, -.24), v(-.43, -.55), size * .025, C.lilac);
        p.line(v(.24, -.26), v(.38, -.49), size * .025, C.mint);
        f([[-.51, -.23], [-.37, -.34], [.41, -.34], [.53, -.22], [.47, .38], [-.47, .38]], [59, 89, 112, 255]);
        f([[-.51, -.23], [-.37, -.34], [-.31, .25], [-.47, .38]], [37, 59, 85, 255]);
        f([[-.35, -.2], [.37, -.2], [.34, .13], [-.32, .13]], C.ink);
        const wave = [[-.26, -.035], [-.17, -.035], [-.12, -.12], [-.03, .065], [.06, -.12], [.14, .025], [.19, -.035], [.29, -.035]];
        for (let i = 1; i < wave.length; i++) p.line(v(...wave[i - 1]), v(...wave[i]), size * .012, C.mint);
        for (let i = 0; i < 4; i++) f([[-.28 + i * .11, .22], [-.21 + i * .11, .22], [-.21 + i * .11, .27], [-.28 + i * .11, .27]], i === 3 ? C.coral : C.yellow);
        f([[.22, .19], [.32, .19], [.32, .29], [.22, .29]], C.lilac);
    } else if (crewId === 'moth') {
        f([[-.47, -.25], [-.23, -.54], [.24, -.54], [.47, -.25], [.38, .28], [0, .5], [-.38, .28]], C.lilac);
        f([[-.47, -.25], [-.23, -.54], [0, -.1], [0, .5], [-.38, .28]], [116, 117, 179, 255]);
        f([[-.3, -.2], [0, -.38], [.3, -.2], [.3, .13], [0, .29], [-.3, .13]], C.dark);
        f([[-.13, -.1], [0, -.26], [.13, -.1], [0, .14]], C.mint);
        p.line(v(-.22, -.03), v(.22, -.03), size * .014, C.cream);
        f([[-.45, -.15], [-.74, -.34], [-.63, .11], [-.37, .3]], C.coral); f([[.45, -.15], [.74, -.34], [.63, .11], [.37, .3]], C.yellow);
        p.line(v(0, -.54), v(.16, -.6), size * .028, C.cream);
    } else if (crewId === 'pip') {
        f([[-.42, -.37], [.35, -.42], [.51, -.15], [.43, .32], [.19, .44], [-.4, .3]], C.coral);
        f([[-.33, -.21], [.36, -.21], [.33, .18], [-.33, .18]], C.dark);
        f([[-.22, -.1], [-.08, -.1], [-.08, .02], [-.22, .02]], C.mint); f([[.1, -.1], [.24, -.1], [.24, .02], [.1, .02]], C.mint);
        f([[-.2, .29], [.27, .29], [.21, .46], [-.13, .46]], C.yellow);
        p.line(v(0, -.41), v(.1, -.555), size * .035, C.cream); p.poly(ring(...v(.1, -.565), size * .05, size * .08, 5), C.mint);
    } else {
        const color = crewId === 'oru' ? C.mint : C.lilac;
        f([[-.5, .45], [-.4, .11], [-.21, -.03], [.26, -.03], [.47, .2], [.51, .45]], color);
        f([[-.3, -.37], [-.12, -.53], [.2, -.48], [.34, -.22], [.27, .17], [.03, .32], [-.24, .11]], crewId === 'oru' ? [159, 117, 105, 255] : [224, 178, 164, 255]);
        f([[-.32, -.19], [-.3, -.4], [-.09, -.57], [.25, -.5], [.39, -.22], [.1, -.28], [.05, -.42], [-.08, -.25]], crewId === 'oru' ? [51, 70, 81, 255] : [146, 126, 207, 255]);
        f([[-.31, -.09], [.33, -.09], [.33, .05], [-.31, .05]], [41, 67, 85, 255]);
        f([[-.25, -.055], [-.04, -.055], [-.04, .01], [-.25, .01]], C.mint); f([[.08, -.055], [.29, -.055], [.29, .01], [.08, .01]], C.mint);
        f([[-.13, .4], [.15, .4], [.07, .6]], C.yellow);
    }
}

class SalvageScene {
    constructor(root) { this.painter = new Painter(root); this.camera = { x: 0, y: 0 }; this.origin = [50, 53]; this.scale = .48; }
    project(x, y) { return [this.origin[0] + (x - this.camera.x) * this.scale, this.origin[1] + (y - this.camera.y) * this.scale * 1.6]; }
    unproject(x, y) { return { x: this.camera.x + (x - this.origin[0]) / this.scale, y: this.camera.y + (y - this.origin[1]) / (this.scale * 1.6) }; }
    face(points, c) { this.painter.poly(points.map(q => this.project(...q)), c); }
    line(a, b, width, c) { this.painter.line(this.project(...a), this.project(...b), width * this.scale, c); }
    rect(x, y, w, h, c) { this.face([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], c); }
    visible(x, y, r = 8) { const p = this.project(x, y); return p[0] > -r * this.scale && p[0] < 100 + r * this.scale && p[1] > -r * this.scale * 1.6 && p[1] < 100 + r * this.scale * 1.6; }
    previewShip(parent, engine, x, y, scale = 1.5) { const p = new Painter(parent, 140); p.begin(); drawShip(p, x, y, scale * (engine.loadout.weapon === 'lance' || engine.loadout.weapon === 'sunblade' ? .87 : 1), -Math.PI / 2, engine.loadout, { time: engine.time, preview: true }); p.end(); return p; }
    portrait(parent, crewId, x, y, size = 8) { const p = new Painter(parent, 40); p.begin(); drawPortrait(p, x, y, size, crewId); p.end(); return p; }
    render(e, preview = false) {
        this.e = e; this.preview = preview; this.board = e.mode === 'board' && !preview;
        this.camera = this.board ? { x: e.pilot.x, y: e.pilot.y } : { x: e.ship.x, y: e.ship.y };
        this.origin = preview ? [76, 70] : [50, 53]; this.scale = this.board ? 1.6 : .48;
        const p = this.painter; p.begin();
        if (this.board && e.interior) this.interior(e); else this.space(e);
        this.effects(e); p.end(); return p.used;
    }
    background(e) {
        const p = this.painter, sector = e.sector || 0;
        const palettes = [[29, 54, 82, 255], [62, 38, 73, 255], [26, 67, 77, 255], [70, 45, 91, 255], [80, 44, 65, 255], [33, 66, 98, 255]], c = palettes[sector % 6];
        p.poly([[0, 0], [100, 0], [100, 100], [0, 100]], C.ink);
        for (let i = 0; i < 9; i++) { const x = i * 16 - 22 - this.camera.x * .015, y = 69 - i * 5 + Math.sin(i) * 10; p.poly([[x - 17, y + 20], [x + 4, y - 17], [x + 29, y - 6], [x + 12, y + 9]], tint(c, .7 + (i % 3) * .17, 100)); }
        p.poly([[0, 88], [24, 59], [51, 66], [70, 38], [100, 42], [100, 49], [70, 46], [50, 75], [23, 69], [0, 95]], tint(e.world.color || C.lilac, .65, 27));
        for (let i = 0; i < 62; i++) {
            const x = ((hash(i, 3) * 110 - this.camera.x * .019 * (1 + i % 3)) % 110 + 110) % 110 - 5, y = ((hash(i, 7) * 110 - this.camera.y * .023) % 110 + 110) % 110 - 5;
            const s = i % 12 === 0 ? .18 : .06, alpha = 100 + Math.round(hash(i, 11) * 135);
            p.poly([[x - s, y], [x, y - s * 1.6], [x + s, y], [x, y + s * 1.6]], tint(i % 3 === 0 ? C.mint : C.cream, 1, alpha));
            if (i % 12 === 0) { p.line([x - .5, y], [x + .5, y], .02, tint(C.cream, 1, 90)); p.line([x, y - .8], [x, y + .8], .02, tint(C.cream, 1, 90)); }
        }
        if (this.preview || (e.sector || 0) === 0) this.moon(e); else this.landmark(e);
        for (let i = 0; i < 9; i++) { const x = ((hash(i, 91) * 120 - this.camera.x * .055) % 120 + 120) % 120 - 10, y = ((hash(i, 56) * 110 - this.camera.y * .055) % 110 + 110) % 110 - 5, r = .8 + hash(i, 81) * 1.5; p.poly([[x - r, y], [x, y - r * 1.4], [x + r * .8, y], [x + r * .4, y + r]], tint(c, 1.2, 120)); }
    }
    landmark(e) {
        const p = this.painter, x = 85 - this.camera.x * .075, y = 36 - this.camera.y * .05;
        const v = (a, b) => [x + a, y + b * 1.6], f = (a, c) => p.poly(a.map(q => v(...q)), c), sector = e.sector;
        if (sector === 1) {
            for (let i = 0; i < 3; i++) {
                const dx = -12 + i * 16, dy = -14 + i * 13;
                f([[dx - 25, dy - 4], [dx - 8, dy - 8], [dx + 11, dy - 4], [dx + 19, dy + 2], [dx - 3, dy + 6], [dx - 24, dy + 3]], [67 + i * 10, 58 + i * 5, 89 + i * 7, 255]);
                f([[dx - 25, dy - 4], [dx - 8, dy - 8], [dx + 11, dy - 4], [dx - 5, dy - 1]], [99 + i * 7, 79 + i * 5, 118 + i * 8, 255]);
                f([[dx - 24, dy + 3], [dx - 5, dy - 1], [dx + 19, dy + 2], [dx - 3, dy + 6]], [79 + i * 6, 54 + i * 4, 96 + i * 8, 255]);
                f([[dx - 13, dy + 3], [dx - 10, dy + 3], [dx - 8, dy + 15], [dx - 18, dy + 12]], [100, 66, 105, 255]);
                for (let j = 0; j < 4; j++) f([[dx - 19 + j * 6, dy - 4], [dx - 17 + j * 6, dy - 4], [dx - 17 + j * 6, dy - 2], [dx - 19 + j * 6, dy - 2]], [125, 123, 151, 130]);
                f([[dx - 1, dy - 7], [dx + 3, dy - 6], [dx - 5, dy + 5], [dx - 9, dy + 5]], C.ink);
            }
        } else if (sector === 2) {
            for (let i = 0; i < 5; i++) {
                const xx = -30 + i * 14, yy = (i % 2) * 10, h = 17 + i % 3 * 8, w = 5 + i % 2;
                f([[xx - w, yy], [xx, yy - h], [xx + w, yy], [xx + 2, yy + 13]], [43, 99, 120, 255]);
                f([[xx - w, yy], [xx, yy - h], [xx - 1, yy + 3], [xx + 2, yy + 13]], [63, 143, 152, 255]);
                f([[xx, yy - h], [xx + w, yy], [xx - 1, yy + 3]], [78, 171, 166, 255]);
                p.line(v(xx, yy - h), v(xx - 1, yy + 3), .04, [134, 242, 215, 120]);
                f([[xx - 3, yy + 4], [xx + 4, yy + 1], [xx + 1, yy + 5]], [186, 162, 226, 170]);
            }
        } else if (sector === 3) {
            for (let i = 0; i < 22; i++) {
                if (i === 3 || i === 4 || i === 14) continue;
                const a = i * Math.PI * 2 / 22, b = a + .235, pt = (r, t) => [Math.cos(t) * r, Math.sin(t) * r * .65 + Math.cos(t) * r * .17];
                f([pt(34, a), pt(34, b), pt(27, b), pt(27, a)], i % 2 ? [86, 72, 130, 255] : [119, 98, 158, 255]);
                p.line(v(...pt(27.5, a)), v(...pt(27.5, b)), .065, [158, 145, 225, 200]);
                if (i % 2 === 0) p.line(v(...pt(29, a + .11)), v(...pt(32, a + .11)), .12, [133, 187, 190, 150]);
            }
            f([[-9, -6], [0, -12], [9, -5], [7, 7], [-4, 11], [-11, 2]], [47, 48, 80, 255]);
            f([[-9, -6], [0, -12], [9, -5], [0, 2]], [67, 62, 103, 255]);
            for (let i = 0; i < 4; i++) f([[-5 + i * 3, -3], [-4 + i * 3, -3], [-4 + i * 3, 5], [-5 + i * 3, 5]], [119, 115, 167, 110]);
        } else if (sector === 4) {
            for (let i = 0; i < 5; i++) { const xx = -30 + i * 16, yy = i % 2 * 8; f([[xx - 16, yy - 24], [xx + 7, yy - 13], [xx - 3, yy + 4], [xx + 15, yy + 16], [xx - 4, yy + 32], [xx - 19, yy + 3]], [79 + i * 8, 39 + i * 3, 75 + i * 7, 150]); }
            const flash = 100 + Math.round(Math.max(0, Math.sin(e.time * .53)) * 45);
            f([[-10, -30], [1, -13], [-4, -5], [8, 3], [3, 16], [14, 34], [-1, 17], [2, 5], [-10, -3], [-5, -12]], [228, 133, 162, flash]);
            f([[-4, -4], [-19, 2], [-22, 13], [-17, 3]], [216, 126, 162, flash * .65]);
            f([[5, 5], [22, 12], [18, 24], [26, 11]], [216, 126, 162, flash * .65]);
        } else {
            p.poly(ring(x, y, 35, 56, 12, e.time * .005), [237, 163, 84, 15]);
            p.poly(ring(x, y, 28, 44.8, 12, -.1), [238, 166, 92, 23]);
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + e.time * .008; f([[Math.cos(a) * 19, Math.sin(a) * 19], [Math.cos(a + .15) * 31, Math.sin(a + .15) * 31], [Math.cos(a + .4) * 19, Math.sin(a + .4) * 19]], [157, 118, 81, 90]); }
            for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; f([[Math.cos(a) * 20, Math.sin(a) * 20], [Math.cos(a + Math.PI / 4) * 20, Math.sin(a + Math.PI / 4) * 20], [1, -2]], [164 + i * 7, 123 + i * 7, 86 + i * 5, 255]); }
            f([[-6, -5], [3, -8], [8, -1], [4, 6], [-5, 7], [-9, 0]], [235, 191, 125, 255]);
            f([[-3, -2], [1, -4], [4, 0], [0, 4], [-4, 1]], [248, 229, 175, 255]);
        }
    }
    moon(e) {
        const p = this.painter, x = this.preview ? 76 : 85 - this.camera.x * .075, y = this.preview ? 28 : 25 - this.camera.y * .05, s = this.preview ? 1.05 : .88;
        const v = (a, b) => [x + a * s, y + b * s * 1.6], f = (pts, c) => p.poly(pts.map(q => v(...q)), c);
        const base = [[95, 126, 155, 255], [130, 103, 158, 255], [93, 157, 161, 255], [159, 133, 194, 255], [184, 131, 129, 255], [145, 184, 187, 255]][(e.sector || 0) % 6];
        // The moon has separated into continental shards around a luminous fault.
        f([[-22, -3], [-18, -14], [-7, -21], [1, -21], [-1, -10], [-6, -5], [-4, 3], [-12, 8], [-21, 4]], tint(base, .77));
        f([[-18, -14], [-7, -21], [1, -21], [-1, -10], [-9, -8]], tint(base, 1.1));
        f([[-22, -3], [-18, -14], [-9, -8], [-6, -5], [-12, 8], [-21, 4]], tint(base, .8));
        f([[-21, 4], [-12, 8], [-4, 3], [-8, 13], [-14, 15]], tint(base, .57));
        f([[4, -23], [15, -17], [23, -6], [20, 3], [13, 1], [11, -8], [2, -11]], tint(base, .92));
        f([[4, -23], [15, -17], [11, -8], [2, -11]], tint(base, 1.25));
        f([[15, -17], [23, -6], [20, 3], [13, 1], [11, -8]], tint(base, .64));
        f([[-4, 8], [7, 3], [13, 6], [21, 6], [17, 16], [8, 22], [-4, 21], [-10, 17]], tint(base, .68));
        f([[-4, 8], [7, 3], [13, 6], [7, 14], [-4, 21], [-10, 17]], tint(base, .97));
        f([[7, 14], [13, 6], [21, 6], [17, 16], [8, 22], [-4, 21]], tint(base, .52));
        f([[-1, -17], [-3, -7], [1, -2], [-2, 5], [1, 9], [7, 2], [9, -3], [6, -10]], tint(C.mint, 1, 25));
        f([[.6, -13], [-.7, -5], [3, -1], [.4, 6], [4, 4], [6.3, -3]], tint(C.mint, 1, 100));
        for (const q of [[-13, -8, 3], [-16, 2, 2], [12, -13, 2.8], [6, 14, 2.2]]) {
            p.poly(ring(...v(q[0], q[1]), q[2] * s, q[2] * 1.1 * s, 6, .3), tint(base, .55));
            p.poly(ring(...v(q[0] + .4, q[1] + .3), q[2] * .66 * s, q[2] * .72 * s, 6, .3), tint(base, .88));
        }
        for (let i = 0; i < 7; i++) { const a = i * .85 + e.time * .005, px = Math.cos(a) * (27 + i % 3), py = Math.sin(a) * 12; f([[px - 1, py], [px + .3, py - 1.8], [px + 1.8, py], [px, py + .8]], tint(base, .55 + i * .065)); }
        // A broken orbital ribbon makes the scale of the moon immediately legible.
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; p.line(v(Math.cos(a) * 31, Math.sin(a) * 7 + 3), v(Math.cos(a + .20) * 31, Math.sin(a + .20) * 7 + 3), .05, [138, 207, 213, 60]); }
    }
    space(e) {
        this.background(e);
        for (const rock of e.world.rocks || []) if (rock.hp !== 0 && !rock.mined && this.visible(rock.x, rock.y, (rock.radius || 3) * 2)) this.rock(rock, e);
        if (this.preview) { const station = (e.world.pois || []).find(q => q.kind === 'station'); if (station) this.poi({ ...station, x: e.ship.x + 31, y: e.ship.y + 8, radius: 6 }, e); }
        else for (const poi of e.world.pois || []) if (this.visible(poi.x, poi.y, (poi.radius || 16) * 2.6)) this.poi(poi, e);
        for (const item of e.loot || []) if (this.visible(item.x, item.y, 3)) this.loot(item, e);
        if (e.tractorTarget) { const a = e.ship.angle || 0, reach = e.loadout.port === 'tractor' ? 6 : 0; this.painter.line(this.project(e.ship.x + Math.sin(a) * reach, e.ship.y - Math.cos(a) * reach), this.project(e.tractorTarget.x, e.tractorTarget.y), .06, [103, 233, 210, 110]); }
        this.telegraphs(e);
        for (const enemy of e.enemies || []) if (enemy.hp > 0 && this.visible(enemy.x, enemy.y, 20)) this.enemy(enemy, e);
        const at = this.project(e.ship.x, e.ship.y);
        if (e.ship.shield > 0 && (e.ship.hurt > 0 || e.ship.shield > e.ship.maxShield * .9)) this.painter.poly(ring(at[0], at[1], this.preview ? 10 : 5.4, this.preview ? 16 : 8.64, 14, e.time * .1), [116, 227, 221, e.ship.hurt > 0 ? 40 : 9]);
        drawShip(this.painter, at[0], at[1], this.preview ? .95 : .48, this.preview ? -.65 : e.ship.angle, e.loadout, { time: e.time, boost: e.ship.boosting || e.ship.dash > 0, hurt: e.ship.hurt });
        if (!this.preview) this.beacon(e);
    }
    rock(q, e) {
        const r = q.radius || 3, a = (q.seed || hash(q.x, q.y)) * .37, verts = Array.from({ length: 6 }, (_, i) => [q.x + Math.cos(i * Math.PI / 3 + a) * r * (.82 + hash(i, q.x) * .23), q.y + Math.sin(i * Math.PI / 3 + a) * r]);
        const c = (e.sector || 0) === 2 ? [72, 126, 142, 255] : (e.sector || 0) === 4 ? [141, 90, 118, 255] : [103, 106, 145, 255];
        this.face(verts, tint(c, .67));
        this.face([verts[0], verts[1], verts[2], [q.x - r * .1, q.y - r * .2]], tint(c, .98));
        this.face([verts[2], verts[3], verts[4], [q.x - r * .1, q.y - r * .2]], tint(c, 1.21));
        if (q.crystal || (q.seed || 1) % 3 === 0 || q.kind === 'crystal') this.face([[q.x, q.y - r * .5], [q.x + r * .35, q.y], [q.x, q.y + r * .3], [q.x - r * .16, q.y]], C.mint);
    }
    poi(q, e) {
        const scale = (q.radius || (q.kind === 'station' ? 16 : 12)) / (q.kind === 'station' ? 16 : 12), a = q.angle || -.15;
        const v = (x, y) => [q.x + (x * Math.cos(a) - y * Math.sin(a)) * scale, q.y + (x * Math.sin(a) + y * Math.cos(a)) * scale];
        const f = (points, c) => this.face(points.map(pt => v(...pt)), c), l = (a, b, w, c) => this.line(v(...a), v(...b), w, c);
        if (q.kind === 'station') {
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2, r = (x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
                const g = (pts, c) => f(pts.map(pt => r(...pt)), c);
                g([[4, -3], [14, -3], [18, -6], [23, -5], [24, 4], [16, 6], [12, 3], [4, 3]], [42, 73, 100, 255]);
                g([[5, -2], [14, -2], [17, -4], [22, -4], [23, 0], [15, 1], [5, 1]], i % 2 ? [192, 155, 145, 255] : [168, 197, 192, 255]);
                g([[16, 1], [23, 0], [23, 3], [17, 4]], i % 2 ? C.coral : C.lilac);
                for (let n = 0; n < 3; n++) g([[17 + n * 1.8, -3], [18 + n * 1.8, -3], [18 + n * 1.8, -1], [17 + n * 1.8, -1]], C.mint);
                g([[9, -2.3], [10.1, -2.3], [10.1, 2.6], [9, 2.6]], C.yellow);
            }
            f([[-8, -5], [-3, -9], [5, -8], [9, -2], [7, 6], [0, 9], [-7, 5]], [54, 86, 112, 255]);
            f([[-7, -4], [-3, -8], [4, -7], [8, -2], [1, 1]], [209, 210, 185, 255]);
            f([[-7, -4], [1, 1], [6, 5], [0, 8], [-6, 4]], [112, 143, 157, 255]);
            f([[1, 1], [8, -2], [6, 5], [0, 8]], [66, 94, 128, 255]);
            f([[-3, -3], [2, -4], [4, -.4], [2, 3], [-2, 3], [-4, 0]], [43, 95, 111, 255]);
            f([[-2, -2], [1.6, -3], [3, -.2], [1.5, 1.7], [-2, 1.6]], C.mint);
            l([-.5, -1.5], [1.1, .8], .13, C.cream);
            l([-18, -7], [-20, -15], .22, C.cream); l([-20, -15], [-23, -12], .15, C.yellow);
            f([[-5, 10], [7, 10], [10, 18], [-8, 18]], [48, 66, 91, 255]);
            for (let i = 0; i < 3; i++) f([[-3.2, 11 + i * 2], [5.1, 11 + i * 2], [5.8, 12 + i * 2], [-4, 12 + i * 2]], i % 2 ? C.coral : C.yellow);
        } else if (q.kind === 'gate' || q.kind === 'relay') {
            const gate = q.kind === 'gate', r = gate ? 12 : 8;
            for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3, points = [[Math.cos(t) * r, Math.sin(t) * r], [Math.cos(t + .55) * r, Math.sin(t + .55) * r], [Math.cos(t + .55) * (r - 2.2), Math.sin(t + .55) * (r - 2.2)], [Math.cos(t) * (r - 2.2), Math.sin(t) * (r - 2.2)]]; f(points, i % 2 ? [154, 144, 178, 255] : [88, 126, 147, 255]); l(points[2], points[3], .14, gate ? C.lilac : C.mint); }
            if (gate) { f([[-6, -4], [0, -7], [6, -3], [5, 4], [-1, 7], [-6, 3]], [101, 146, 245, 35]); f([[-2, -3], [1, -4], [3, 1], [0, 4], [-3, 1]], [126, 230, 233, 75]); }
            else { f([[-2, -6], [2, -6], [4, 5], [0, 9], [-4, 5]], [184, 192, 188, 255]); f([[-1, -3], [1, -3], [2, 3], [-2, 3]], C.mint); l([0, -5], [0, -14], .17, C.cream); f([[-3, -12], [0, -15], [3, -12], [0, -10]], C.coral); }
        } else if (q.kind === 'boss') {
            f([[-22, 0], [-10, -17], [8, -20], [23, -3], [14, 15], [-5, 18]], [57, 53, 83, 255]);
            for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3 + e.time * .02; f([[Math.cos(t) * 19, Math.sin(t) * 19], [Math.cos(t + .6) * 19, Math.sin(t + .6) * 19], [Math.cos(t + .3) * 10, Math.sin(t + .3) * 10]], tint(C.lilac, .7 + i * .04)); }
            f([[-7, -5], [1, -8], [8, -2], [5, 6], [-4, 8], [-8, 1]], [61, 148, 150, 255]);
            f([[-3, -3], [2, -4], [4, 1], [0, 5], [-4, 1]], C.yellow);
        } else {
            // Broken freighters expose decks, cables and warm, inhabited cabins.
            f([[-19, -7], [-7, -10], [3, -7], [1, -2], [6, 1], [1, 5], [-11, 8], [-21, 3]], [62, 71, 97, 255]);
            f([[-19, -6], [-7, -9], [2, -6], [-2, -2], [-12, 0]], [154, 156, 176, 255]);
            f([[-19, -6], [-12, 0], [-10, 7], [-21, 3]], [107, 120, 146, 255]);
            f([[-12, 0], [-2, -2], [4, 1], [0, 4], [-10, 7]], [68, 109, 128, 255]);
            f([[7, -7], [15, -6], [25, -1], [21, 4], [9, 6], [11, 2], [6, 0], [9, -3]], [153, 119, 133, 255]);
            f([[7, -7], [15, -6], [25, -1], [14, 0], [9, -3]], [224, 166, 146, 255]);
            f([[14, 0], [25, -1], [21, 4], [9, 6], [11, 2]], [139, 84, 107, 255]);
            for (let i = 0; i < 4; i++) f([[-16 + i * 3, -6], [-14 + i * 3, -6.5], [-14 + i * 3, -4], [-16 + i * 3, -3.5]], i % 2 ? C.yellow : C.mint);
            for (const yy of [-4, 4]) { l([0, yy], [6, yy + 1], .14, C.coral); l([6, yy + 1], [11, yy], .14, C.coral); }
            f([[-16, 7], [-11, 8], [-14, 15], [-21, 14]], C.coral); f([[13, 5], [20, 4], [18, 12], [12, 10]], [100, 129, 164, 255]);
            f([[-4, -2], [0, -3], [2, 0], [-1, 3], [-4, 2]], C.yellow);
            l([-2, -.9], [-.4, .7], .19, C.dark);
            for (let i = 0; i < 3; i++) { const xx = -13 + i * 6, yy = 12 + Math.sin(e.time * .25 + i) * 1.2; f([[xx, yy], [xx + 2, yy - 1], [xx + 3, yy + 1], [xx + .7, yy + 2]], [115, 143, 164, 255]); }
        }
        if (q.kind === 'relay' && e.flags && e.flags['relay:' + q.id]) { const at = this.project(q.x, q.y); this.painter.poly(ring(at[0], at[1], 1.4, 2.24, 6), C.cream); this.painter.poly(ring(at[0], at[1], 2.4 + Math.sin(e.time * 2) * .2, 3.84, 6), [103, 233, 210, 25]); }
        if (!this.preview) { const at = this.project(q.x, q.y + (q.radius || 12) + 6); this.painter.text(q.name || q.id, at[0], at[1], .77, q.kind === 'wreck' ? C.coral : C.mint); }
    }
    telegraphs(e) {
        for (const enemy of e.enemies || []) if (enemy.hp > 0 && enemy.windup > 0 && this.visible(enemy.x, enemy.y, 10)) {
            const target = this.board ? e.pilot : e.ship, a = this.project(enemy.x, enemy.y), angle = Number.isFinite(enemy.targetAngle) ? enemy.targetAngle : enemy.angle || 0, length = Math.min(this.board ? 40 : 75, Math.hypot(target.x - enemy.x, target.y - enemy.y) + 10);
            const offsets = enemy.boss ? [-.2, 0, .2] : [0];
            if (enemy.boss && enemy.hp < enemy.maxHp * .5 && ((enemy.volleys || 0) + 1) % 3 === 0) for (let i = 1; i < 8; i++) offsets.push(i * Math.PI / 4);
            for (const offset of offsets) { const b = this.project(enemy.x + Math.cos(angle + offset) * length, enemy.y + Math.sin(angle + offset) * length); this.painter.line(a, b, .045, [255, 143, 117, 65]); }
            this.painter.poly(ring(a[0], a[1], 1.4, 2.24, 6), [255, 145, 113, 33]);
        }
    }
    enemy(q, e) {
        if (this.board) { this.robot(q, e); return; }
        const at = this.project(q.x, q.y), p = this.painter, boss = q.boss || String(q.type).includes('boss'), size = boss ? Math.min(2, (q.radius || 12) / 9) : .48 * (q.radius || 3) / 3;
        const royal = q.type === 'warden', a = q.angle || 0, v = (x, y) => [at[0] + (x * Math.cos(a) - y * Math.sin(a)) * size, at[1] + (x * Math.sin(a) + y * Math.cos(a)) * size * 1.6], f = (pts, c) => p.poly(pts.map(pt => v(...pt)), c);
        if (boss) {
            for (const side of [-1, 1]) { f([[-7, side * 2], [-9, side * 7], [-3, side * 10], [5, side * 7], [10, side * 3], [4, side * 2]], royal ? [119, 120, 110, 255] : [102, 71, 124, 255]); f([[-7, side * 5], [-3, side * 9], [4, side * 6], [7, side * 3], [0, side * 4]], royal ? [213, 186, 111, 255] : [190, 109, 162, 255]); for (let i = 0; i < 3; i++) f([[-4 + i * 3, side * 5], [-3 + i * 3, side * 6], [-1 + i * 3, side * 5], [-2 + i * 3, side * 4]], royal ? C.mint : C.coral); }
            f([[-10, 0], [-5, -4], [5, -3], [12, 0], [5, 3], [-5, 4]], [102, 95, 130, 255]);
            f([[-4, -2], [3, -2], [7, 0], [0, 2], [-5, 1]], royal ? C.yellow : C.coral); f([[-1, -1], [2, -1], [3, 0], [0, 1]], C.yellow);
        } else {
            const color = String(q.type).includes('drone') ? C.lilac : C.coral;
            f([[-6, -1], [-3, -5], [2, -3], [7, 0], [2, 3], [-3, 5], [-6, 1]], [75, 58, 90, 255]);
            f([[-5, -.8], [-2, -4], [2, -2.5], [6, 0], [0, 0]], color);
            f([[-5, .8], [-2, 4], [2, 2.5], [6, 0], [0, 0]], tint(color, .72));
            f([[-2, -.9], [2, -.7], [4, 0], [-1, 1]], C.dark); f([[0, -.45], [2, -.4], [3, 0], [0, .4]], C.yellow);
            f([[-5.5, -.4], [-9 - Math.sin(e.time * 20) * .5, 0], [-5.5, .4]], C.coral);
        }
        if (q.hp < q.maxHp || boss) { const width = boss ? 5 : 1.8, yy = at[1] - (boss ? 15 : 6); p.line([at[0] - width, yy], [at[0] + width, yy], .15, C.dark); p.line([at[0] - width, yy], [at[0] - width + width * 2 * q.hp / q.maxHp, yy], .10, C.coral); }
    }
    interior(e) {
        const p = this.painter, interior = e.interior;
        p.poly([[0, 0], [100, 0], [100, 100], [0, 100]], [7, 14, 28, 255]);
        for (let i = 0; i < 20; i++) { const x = hash(i, 5) * 100, y = hash(i, 8) * 100; p.poly(ring(x, y, .04, .064, 4), [122, 171, 192, 140]); }
        // Draw hull borders before any floor so overlapping rooms form open
        // doorways rather than decorative solid-looking walls across the route.
        for (const room of interior.rooms || []) if (this.visible(room.x + room.w / 2, room.y + room.h / 2, Math.max(room.w, room.h))) this.rect(room.x - .5, room.y - .5, room.w + 1, room.h + 1, [56, 78, 99, 255]);
        for (const room of interior.rooms || []) {
            if (!this.visible(room.x + room.w / 2, room.y + room.h / 2, Math.max(room.w, room.h))) continue;
            this.rect(room.x, room.y, room.w, room.h, room.color || [24, 46, 63, 255]);
            this.face([[room.x + .5, room.y + .5], [room.x + room.w - .5, room.y + .5], [room.x + room.w - .5, room.y + room.h - .5]], [37, 61, 78, 255]);
            for (let xx = room.x + 4; xx < room.x + room.w; xx += 4) this.line([xx, room.y + .5], [xx, room.y + room.h - .5], .025, [69, 103, 119, 90]);
            for (let yy = room.y + 4; yy < room.y + room.h; yy += 4) this.line([room.x + .5, yy], [room.x + room.w - .5, yy], .025, [69, 103, 119, 90]);
            this.line([room.x + .7, room.y + .7], [room.x + room.w - .7, room.y + .7], .07, C.mint);
            this.line([room.x + room.w - .7, room.y + .7], [room.x + room.w - .7, room.y + room.h - .7], .07, [84, 139, 166, 255]);
            for (const side of [-1, 1]) { const xx = room.x + (side < 0 ? 1.1 : room.w - 3.5); this.rect(xx, room.y + 2.4, 2.4, 1.1, [31, 55, 73, 255]); this.line([xx + .25, room.y + 2.8], [xx + 2.1, room.y + 2.8], .055, side < 0 ? C.coral : C.yellow); }
            if (room.h > 15 && room.w > 15) { this.face([[room.x + 1, room.y + 4], [room.x + 5, room.y + 4], [room.x + 13, room.y + room.h - 2], [room.x + 8, room.y + room.h - 2]], [138, 207, 199, 13]); this.line([room.x + 3, room.y + room.h - 2], [room.x + room.w - 3, room.y + room.h - 2], .15, [103, 126, 136, 130]); }
            const at = this.project(room.x + room.w / 2, room.y + 1.6);
            if (room.name || room.id) p.text((room.name || room.id).toUpperCase(), at[0], at[1], .70, [111, 165, 181, 255]);
        }
        for (const wall of interior.walls || []) {
            if (!this.visible(wall.x + wall.w / 2, wall.y + wall.h / 2, Math.max(wall.w, wall.h))) continue;
            this.rect(wall.x + .3, wall.y + .6, wall.w, wall.h, [9, 22, 38, 255]);
            this.rect(wall.x, wall.y, wall.w, wall.h, [64, 83, 104, 255]);
            this.rect(wall.x + .1, wall.y + .1, Math.max(.1, wall.w - .2), Math.min(.45, wall.h * .4), [130, 152, 164, 255]);
        }
        const props = (interior.props || []).filter(q => this.visible(q.x, q.y, 6));
        for (const q of props) this.roomProp(q, e);
        if (interior.exit) { const at = this.project(interior.exit.x, interior.exit.y); p.poly(ring(at[0], at[1], 3, 4.8, 6), [103, 233, 210, 30]); p.text('AIRLOCK', at[0], at[1] + 4.7, .65, C.mint); }
        for (const q of e.loot || []) if (this.visible(q.x, q.y, 3)) this.loot(q, e);
        this.telegraphs(e);
        for (const q of e.enemies || []) if (q.hp > 0 && this.visible(q.x, q.y, 6)) this.robot(q, e);
        this.astronaut(e.pilot, e);
        this.beacon(e);
    }
    roomProp(q, e) {
        const x = q.x, y = q.y, p = this.painter;
        if (q.kind === 'crew') { const id = q.crewId || q.crew || 'moth', at = this.project(x, y); drawPortrait(p, at[0], at[1] - 1, 2, id); p.text(id.toUpperCase(), at[0], at[1] + 4, .65, C.yellow); }
        else if (q.kind === 'bed') { this.rect(x - 1.1, y - 2, 2.2, 4, [68, 99, 127, 255]); this.rect(x - .9, y - 1.8, 1.8, 3.6, C.lilac); this.rect(x - .8, y - 1.6, 1.6, 1, C.cream); this.line([x - .9, y + 1], [x + .9, y + 1], .06, C.coral); }
        else if (q.kind === 'reactor') {
            this.face([[x - 2.8, y - 1.6], [x, y - 3], [x + 2.8, y - 1.6], [x + 2.8, y + 1.6], [x, y + 3], [x - 2.8, y + 1.6]], [62, 76, 104, 255]);
            const at = this.project(x, y); p.poly(ring(at[0], at[1], 2.6, 4.16, 6, e.time * .15), [111, 232, 217, 48]); p.poly(ring(at[0], at[1], 1.5, 2.4, 6, -e.time * .2), C.mint); p.poly(ring(at[0], at[1], .6, .96, 4), C.cream);
            for (const side of [-1, 1]) { this.rect(x + side * 3 - .4, y - 1.6, .8, 3.2, [124, 132, 153, 255]); this.line([x + side * 3, y - 1], [x + side * 3, y + 1], .13, C.coral); }
        } else if (q.kind === 'console' || q.kind === 'terminal') {
            this.face([[x - 2, y - 1.1], [x + 2, y - 1.1], [x + 2.4, y + 1.2], [x - 2.4, y + 1.2]], [84, 103, 123, 255]);
            this.rect(x - 1.75, y - .9, 3.5, 1.1, [26, 67, 83, 255]);
            this.line([x - 1.5, y - .3], [x + .8, y - .3], .09, C.mint); this.line([x - 1, y - .7], [x + 1.5, y - .7], .045, C.yellow);
            for (let i = 0; i < 3; i++) this.rect(x - 1.2 + i * .8, y + .45, .5, .25, i === 0 ? C.coral : C.cream);
        } else if (q.kind === 'airlock') {
            this.rect(x - 1.5, y - 2.5, 3, 5, [52, 84, 101, 255]); this.rect(x - 1.2, y - 2.2, 2.4, 4.4, [85, 140, 153, 255]); this.line([x, y - 2], [x, y + 2], .1, C.mint);
            for (const side of [-1, 1]) this.rect(x + side * 1.4 - .2, y - 2.6, .4, 5.2, C.yellow);
        } else {
            this.rect(x - 1, y - .8, 2.2, 2, [30, 43, 62, 255]); this.rect(x - 1.2, y - 1.2, 2.2, 2, q.looted ? [70, 83, 96, 255] : [153, 122, 104, 255]);
            this.face([[x - 1.2, y - 1.2], [x + 1, y - 1.2], [x + 1, y + .8]], q.looted ? [39, 53, 70, 255] : [212, 160, 119, 255]); this.line([x - .3, y - 1], [x - .3, y + .6], .13, C.yellow);
        }
    }
    astronaut(q, e) {
        const p = this.painter, at = this.project(q.x, q.y), a = q.angle || 0, v = (x, y) => [at[0] + (x * Math.cos(a) - y * Math.sin(a)) * 1.45, at[1] + (x * Math.sin(a) + y * Math.cos(a)) * 2.32], f = (pts, c) => p.poly(pts.map(q => v(...q)), c);
        p.poly(ring(at[0] + .3, at[1] + .7, 2.2, 2.7, 7), [0, 0, 0, 55]);
        for (const side of [-1, 1]) { f([[-.65, side * .32], [-1.7, side * .32], [-1.85, side * .74], [-.7, side * .74]], [100, 130, 154, 255]); f([[-1.55, side * .32], [-1.85, side * .32], [-1.85, side * .74], [-1.55, side * .74]], C.cream); }
        f([[-1.1, -.6], [-1.4, -.7], [-1.4, .7], [-1.1, .6]], C.coral);
        f([[-.7, -1.1], [.1, -1.1], [.4, -.5], [.6, .5], [.1, 1.1], [-.7, 1.1], [-1, .4], [-1, -.4]], q.hurt > 0 ? C.coral : C.cream);
        f([[-.7, -.7], [-.1, -.6], [-.1, .6], [-.7, .7]], [149, 168, 183, 255]);
        f([[.7, -.65], [1.4, -.3], [1.4, .3], [.7, .65], [.1, .4], [.1, -.4]], [199, 215, 216, 255]);
        f([[.7, -.45], [1.27, -.22], [1.27, .22], [.7, .45], [.35, .3], [.35, -.3]], [31, 75, 104, 255]);
        f([[.77, -.28], [1.1, -.1], [.62, .04], [.48, -.18]], C.mint);
        f([[.4, .6], [1.5, .75], [1.8, .55], [1.8, .9], [.2, 1.1]], [99, 138, 161, 255]);
        f([[1.1, .58], [2.5, .58], [2.5, .83], [1.1, .83]], C.yellow);
        if (q.dash > 0) p.poly(ring(at[0], at[1], 3.7, 5.92, 8), [115, 235, 223, 15]);
    }
    robot(q, e) {
        const p = this.painter, at = this.project(q.x, q.y), r = q.boss ? 2.8 : q.type === 'sentinel' ? 1.9 : 1.5, color = q.type === 'sentinel' || String(q.type).includes('drone') ? C.lilac : C.coral;
        p.poly(ring(at[0] + .3, at[1] + .6, r * 1.3, r * 1.8, 6), [0, 0, 0, 75]);
        p.poly([[at[0] - r, at[1] - r], [at[0], at[1] - r * 1.65], [at[0] + r, at[1] - r], [at[0] + r, at[1] + r], [at[0], at[1] + r * 1.6], [at[0] - r, at[1] + r]], color);
        p.poly([[at[0] - r * .7, at[1] - .4], [at[0] + r * .7, at[1] - .4], [at[0] + r * .7, at[1] + .6], [at[0] - r * .7, at[1] + .6]], C.dark);
        p.line([at[0] - r * .45, at[1]], [at[0] + r * .45, at[1]], .15, C.yellow);
        for (const side of [-1, 1]) { p.line([at[0] + side * r, at[1]], [at[0] + side * (r + .6), at[1] + 1.5], .19, [103, 130, 150, 255]); }
        if (q.type === 'turret') { const a = q.angle || 0; p.line(at, [at[0] + Math.cos(a) * 3, at[1] + Math.sin(a) * 4.8], .32, [113, 138, 156, 255]); p.line([at[0] + Math.cos(a) * 2.2, at[1] + Math.sin(a) * 3.52], [at[0] + Math.cos(a) * 3.1, at[1] + Math.sin(a) * 4.96], .18, C.yellow); }
        if (q.hp < q.maxHp) { p.line([at[0] - 1.5, at[1] - 3.5], [at[0] + 1.5, at[1] - 3.5], .12, C.dark); p.line([at[0] - 1.5, at[1] - 3.5], [at[0] - 1.5 + 3 * q.hp / q.maxHp, at[1] - 3.5], .07, C.coral); }
    }
    loot(q, e) {
        const at = this.project(q.x, q.y), p = this.painter, color = q.kind === 'crystal' ? C.lilac : q.kind === 'medkit' || q.kind === 'medicine' ? C.mint : C.yellow, r = this.board ? .8 : .4, bob = Math.sin(e.time * 3 + q.x) * .24;
        p.poly([[at[0], at[1] - r * 1.8 + bob], [at[0] + r, at[1] + bob], [at[0], at[1] + r * 1.8 + bob], [at[0] - r, at[1] + bob]], color);
        p.poly([[at[0], at[1] - r * 1.8 + bob], [at[0] - r, at[1] + bob], [at[0], at[1] + r * .6 + bob]], tint(color, .6));
    }
    beacon(e) {
        if (!e.objective) return; const goal = e.objective();
        if (!goal || !Number.isFinite(goal.x) || !Number.isFinite(goal.y) || goal.sector !== undefined && goal.sector !== e.sector) return;
        const at = this.project(goal.x, goal.y), p = this.painter;
        if (at[0] < 6 || at[0] > 94 || at[1] < 17 || at[1] > 84) return;
        const r = this.board ? 2.8 : 2.1;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + e.time * .3; p.line([at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r * 1.6], [at[0] + Math.cos(a + .23) * r, at[1] + Math.sin(a + .23) * r * 1.6], .07, C.yellow); }
    }
    effects(e) {
        const p = this.painter;
        for (const shot of e.shots || []) {
            if (!this.visible(shot.x, shot.y, 3)) continue;
            const at = this.project(shot.x, shot.y), old = this.project(shot.x - (shot.vx || 0) * .06, shot.y - (shot.vy || 0) * .06), color = shot.owner === 'enemy' ? C.coral : shot.kind === 'rocket' ? C.lilac : shot.kind === 'lance' && e.loadout.weapon !== 'sunblade' || shot.kind === 'arc' ? C.mint : C.yellow;
            p.line(old, at, shot.kind === 'lance' ? .16 : .095, color);
        }
        for (const effect of e.effects || []) {
            if (!this.visible(effect.x, effect.y, effect.radius || 10) || p.used > 680) continue;
            const at = this.project(effect.x, effect.y), life = clamp((effect.life || .1) / (effect.maxLife || 1), 0, 1), r = (effect.radius || 4) * this.scale, kind = effect.kind;
            if (kind === 'pulse' || kind === 'shield' || kind === 'warp') {
                const radius = r * (1.4 - life), c = kind === 'warp' ? C.lilac : C.mint;
                for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p.line([at[0] + Math.cos(a) * radius, at[1] + Math.sin(a) * radius * 1.6], [at[0] + Math.cos(a + .42) * radius, at[1] + Math.sin(a + .42) * radius * 1.6], .12, tint(c, 1, 180 * life)); }
            } else if (kind === 'explosion' || kind === 'death' || kind === 'salvage' || kind === 'debris') {
                p.poly(ring(at[0], at[1], r * (1.2 - life * .5), r * (1.2 - life * .5) * 1.6, 8), [255, 166, 121, Math.round(100 * life)]);
                for (let i = 0; i < 5; i++) { const a = i * Math.PI * .4 + effect.x, d = r * (1.2 - life); p.poly([[at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d * 1.6], [at[0] + Math.cos(a + .2) * (d + .5), at[1] + Math.sin(a + .2) * (d + .5) * 1.6], [at[0] + Math.cos(a + .4) * d, at[1] + Math.sin(a + .4) * d * 1.6]], tint(i % 2 ? C.yellow : C.coral, 1, 255 * life)); }
            } else { const c = kind === 'heal' ? C.mint : kind === 'electric' || kind === 'arc' ? C.lilac : C.yellow; for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + effect.y; p.line([at[0], at[1]], [at[0] + Math.cos(a) * (.5 + r * life), at[1] + Math.sin(a) * (.5 + r * life) * 1.6], .07, tint(c, 1, 220 * life)); } }
        }
        const hurt = this.board ? e.pilot.hurt : e.ship.hurt;
        if (hurt > 0) { const c = [255, 133, 115, Math.round(clamp(hurt, 0, 1) * 65)]; p.poly([[0, 0], [2, 0], [3, 100], [0, 100]], c); p.poly([[98, 0], [100, 0], [100, 100], [97, 100]], c); }
    }
}
module.exports = { SalvageScene, Painter, drawShip, drawPortrait };
