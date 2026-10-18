const { GameNode, Shapes, ShapeUtils } = require('squish-150');
const C = {
    ink: [22, 31, 48, 255], night: [15, 25, 43, 255], cream: [249, 237, 211, 255],
    muted: [164, 181, 188, 255], gold: [246, 192, 81, 255], rose: [231, 120, 112, 255],
    mint: [114, 201, 173, 255], blue: [121, 181, 224, 255], purple: [187, 151, 220, 255],
    wall: [54, 69, 87, 255], wallTop: [91, 111, 128, 255], white: [255, 250, 230, 255],
    floor: [58, 55, 72, 255], red: [248, 109, 99, 255], shadow: [8, 18, 33, 90],
};
const CREW = [C.mint, C.rose, C.blue, C.gold];
const poly = (x, y, r, n = 16, rotation = 0, ry = r) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos(i / n * Math.PI * 2 + rotation) * r, y + Math.sin(i / n * Math.PI * 2 + rotation) * ry]);
const closed = p => p.concat([p[0]]);
function group(options = {}) { return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0], [0, 0], [0, 0]], ...options }); }
function shape(parent, points, fill, options = {}) { const n = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: points, fill, color: fill, ...options }); parent.addChild(n, false); return n; }
function rect(parent, x, y, w, h, fill, options) { return shape(parent, ShapeUtils.rectangle(x, y, w, h), fill, options); }
function circle(parent, x, y, r, fill, ry = r, options) { return shape(parent, poly(x, y, r, 16, 0, ry), fill, options); }
function text(parent, value, x, y, size = 1.5, color = C.cream, align = 'left', options = {}) {
    const n = new GameNode.Text({ textInfo: { text: String(value), x, y, size, color, align, font: 'sans-serif' }, ...options }); parent.addChild(n, false); return n;
}
function line(parent, x, y, xx, yy, width, color) {
    const a = Math.atan2(yy - y, xx - x), dx = Math.sin(a) * width / 2, dy = Math.cos(a) * width / 2;
    return shape(parent, closed([[x - dx, y + dy], [xx - dx, yy + dy], [xx + dx, yy - dy], [x + dx, y - dy]]), color);
}
function wall(parent, r) {
    rect(parent, r.x + .7, r.y + 1.1, r.w, r.h, C.shadow);
    rect(parent, r.x, r.y - 1.4, r.w, r.h + 1.4, C.wall);
    rect(parent, r.x, r.y - 1.4, r.w, r.h, C.wallTop);
    rect(parent, r.x, r.y - 1.4, r.w, .22, [138, 157, 164, 255]);
}
function plant(parent, x, y, scale = 1) {
    circle(parent, x + .5, y + 1, 2 * scale, C.shadow, scale);
    rect(parent, x - scale, y, scale * 2, 1.4 * scale, [168, 107, 83, 255]);
    for (let i = 0; i < 5; i++) { const a = i * 2.3; circle(parent, x + Math.cos(a) * scale, y - 1 + Math.sin(a) * scale, 1.5 * scale, i % 2 ? [80, 152, 120, 255] : [101, 183, 140, 255], scale); }
}
function treasure(parent, kind, x, y, scale = 1, shine = false) {
    const p = (xx, yy) => [x + xx * scale, y + yy * scale];
    const s = (points, color) => shape(parent, closed(points.map(v => p(...v))), color);
    const r = (xx, yy, w, h, color) => rect(parent, x + xx * scale, y + yy * scale, w * scale, h * scale, color);
    const c = (xx, yy, rad, color, ry = rad) => circle(parent, x + xx * scale, y + yy * scale, rad * scale, color, ry * scale);
    c(.4, 1.6, kind === 'dino' ? 5.2 : 3, C.shadow, 1.4);
    if (kind === 'goose') {
        c(-.6, -.3, 2.7, C.gold, 1.9); s([[-2, -1], [-4, -2], [-2.7, .2]], C.gold);
        r(1.1, -4.2, 1.15, 4, C.gold); c(1.9, -4, 1.2, C.gold); s([[2.7, -4], [4.4, -3.6], [2.7, -3.1]], C.rose);
        c(2.2, -4.3, .19, C.ink); c(-.8, -.8, 1.4, [255, 215, 118, 255], .85);
        r(-1.5, 1.2, .4, 1.6, C.rose); r(.1, 1.2, .4, 1.6, C.rose); r(-2, 2.5, 1.1, .4, C.rose); r(-.2, 2.5, 1.1, .4, C.rose);
    } else if (kind === 'cactus') {
        s([[-2.7, -.2], [2.7, -.2], [2, 3], [-2, 3]], [214, 133, 98, 255]); r(-3, -.7, 6, 1, C.rose);
        r(-1.2, -6, 2.4, 5.5, C.mint); c(0, -6, 1.2, C.mint);
        r(-3, -4.5, 1, 3, C.mint); r(-3, -2.3, 3, 1, C.mint); r(1, -4.2, 2.1, 1, C.mint); r(2.1, -6, 1, 2.6, C.mint);
        for (let i = 0; i < 4; i++) r(-.5, -5.6 + i, .18, .5, C.cream);
        c(0, -7.2, .65, C.rose); c(.5, -7, .5, C.gold);
    } else if (kind === 'dino') {
        line(parent, ...p(-4.5, -.6), ...p(2.8, -1.8), .6 * scale, C.cream);
        for (let i = 0; i < 6; i++) { const xx = -3.5 + i; line(parent, ...p(xx, -1), ...p(xx + .5, 1.2), .38 * scale, C.cream); }
        s([[2, -2], [2.6, -4.2], [6, -4.2], [6, -2.8], [4.5, -2.6], [4, -1.3]], C.cream); c(3.2, -3.4, .42, C.ink);
        for (let i = 0; i < 3; i++) r(4 + i * .55, -2.9, .2, .55, C.ink);
        line(parent, ...p(-4, -.6), ...p(-6, -2), .4 * scale, C.cream);
        for (const xx of [-2.6, .8]) { line(parent, ...p(xx, .1), ...p(xx - .4, 2.6), .5 * scale, C.cream); r(xx - 1, 2.5, 1.7, .45, C.cream); }
    } else if (kind === 'gem') {
        s([[-1.6, -.9], [-.8, -2], [.8, -2], [1.6, -.9], [0, 1.5]], C.blue); s([[-.8, -2], [0, 1.5], [.6, -1.4]], C.cream);
    } else if (kind === 'painting') {
        r(-1.8, -2.3, 3.6, 3.8, C.gold); r(-1.3, -1.8, 2.6, 2.8, C.purple); c(0, -.9, .65, C.rose); r(-.7, -.2, 1.4, 1, C.blue);
    } else if (kind === 'flower') {
        r(-.18, -1.4, .36, 3, C.mint); for (let i = 0; i < 5; i++) c(Math.cos(i * 1.26) * .8, -1.2 + Math.sin(i * 1.26) * .8, .6, C.rose); c(0, -1.2, .45, C.gold);
    } else if (kind === 'egg') { c(0, -.4, 1.3, C.cream, 1.8); c(.5, -1, .35, C.rose); c(-.5, .1, .28, C.blue); }
    else { r(-1.2, -1.4, 2.4, 2, C.gold); c(1.4, -.5, .7, C.gold); c(1.4, -.5, .38, C.ink); r(-1.5, .8, 3, .4, C.cream); }
    if (shine) { line(parent, x - 3 * scale, y - 4.4 * scale, x - 3 * scale, y - 3.2 * scale, .16, C.cream); line(parent, x - 3.6 * scale, y - 3.8 * scale, x - 2.4 * scale, y - 3.8 * scale, .16, C.cream); }
}
function person(parent, p, time, guard = false) {
    const x = p.x, y = p.y, color = guard ? [86, 121, 153, 255] : CREW[p.color];
    const bob = Math.sin(time * 10 + (p.color || 0)) * .15;
    circle(parent, x + .4, y + 1, 1.6, C.shadow, .65);
    rect(parent, x - 1.1, y + .3 + bob, .7, 1.2, C.ink); rect(parent, x + .35, y + .3 - bob, .7, 1.2, C.ink);
    circle(parent, x, y - .5, 1.45, color, 1.5);
    circle(parent, x, y - 2.1, 1.05, [232, 188, 154, 255]);
    rect(parent, x - 1.1, y - 2.3, 2.2, .6, C.ink);
    const look = Math.cos(p.face) * .22;
    circle(parent, x - .4 + look, y - 2.05, .15, C.cream); circle(parent, x + .45 + look, y - 2.05, .15, C.cream);
    circle(parent, x, y - 2.9, 1.2, color, .6);
    if (guard) { rect(parent, x - 1.2, y - 2.85, 2.8, .4, C.ink); circle(parent, x + .55, y - .7, .3, C.gold); }
    else { rect(parent, x - 1, y - .7, 2, .32, C.cream); rect(parent, x - 1, y + .1, 2, .3, C.cream); }
}
function van(parent, x, y, loaded = false) {
    rect(parent, x - 4.7, y - 7.4, 10.6, 16.3, C.shadow);
    for (const yy of [-4.5, 4]) { rect(parent, x - 5, y + yy, 1.4, 3, C.ink); rect(parent, x + 3.6, y + yy, 1.4, 3, C.ink); }
    rect(parent, x - 4, y - 7.5, 8, 15, C.mint); rect(parent, x - 3.5, y - 7, 7, 3.4, [65, 112, 123, 255]);
    rect(parent, x - 3, y - 6.6, 6, 2.2, C.blue); rect(parent, x - 4, y + 1.5, 8, 2, C.cream);
    rect(parent, x - 3.5, y + 7, 7, 1, C.ink); rect(parent, x - 3.5, y - 7.6, 1.2, .7, C.gold); rect(parent, x + 2.4, y - 7.6, 1.2, .7, C.gold);
    text(parent, loaded ? 'GO!' : 'VAN', x, y - .9, 1.7, C.ink, 'center');
}
function scenery(parent, e) {
    rect(parent, 0, 0, 100, 100, C.night);
    rect(parent, 2, 15, 96, 66, [33, 49, 62, 255]);
    rect(parent, 22, 19, 72, 58, e.level.color === 'mint' ? [46, 74, 70, 255] : e.level.color === 'blue' ? [48, 63, 85, 255] : C.floor);
    for (let y = 21; y < 76; y += 7) for (let x = 24; x < 94; x += 7) rect(parent, x, y, 6.6, 6.6, [255, 244, 205, (Math.round(x + y) % 3 ? 5 : 10)]);
    // Sidewalk and the conspicuous escape lane.
    for (let y = 20; y < 79; y += 8) rect(parent, 9.5, y, .7, 3, [128, 165, 166, 90]);
    rect(parent, 18, 59, 11, 15, [114, 201, 173, 28]);
    text(parent, 'EXIT', 23, 75, 1.15, C.mint, 'center');
    const floor = group(); parent.addChild(floor, false);
    // World geometry is drawn with a +12 screen offset.
    for (const r of e.level.props) {
        rect(parent, r.x + .6, r.y + 13, r.w, r.h, C.shadow); rect(parent, r.x, r.y + 11.3, r.w, r.h, [103, 111, 126, 255]);
        if (e.level.color === 'mint') plant(parent, r.x + r.w / 2, r.y + 12 + r.h / 2, 1.5);
        else treasure(parent, 'egg', r.x + r.w / 2, r.y + 12 + r.h / 2, 1.1);
    }
    for (const h of e.level.hiding) { rect(parent, h.x, h.y + 12, h.w, h.h, [90, 168, 128, 60]); for (let x = h.x + 2; x < h.x + h.w; x += 3) plant(parent, x, h.y + 15, 1.1); }
    for (const [x, y, kind] of e.level.art) {
        if (kind === 'plant') plant(parent, x, y + 12, 1);
        else { rect(parent, x - 2.2, y + 9.5, 4.4, 4.8, C.gold); rect(parent, x - 1.7, y + 10, 3.4, 3.8, C.ink); circle(parent, x, y + 11.5, 1, kind === 'planet' ? C.blue : C.rose); }
    }
    for (const r of e.level.walls) wall(parent, { ...r, y: r.y + 12 });
    const b = e.level.bell; rect(parent, b.x - 1.7, b.y + 12, 3.4, 1.1, C.ink); circle(parent, b.x, b.y + 11.6, 1.3, C.gold, 1); circle(parent, b.x, b.y + 10.7, .25, C.cream);
    if (e.level.panel) { const p = e.level.panel; rect(parent, p.x - 1.8, p.y + 10, 3.6, 4, C.blue); rect(parent, p.x - 1, p.y + 10.5, 2, 1, C.ink); line(parent, p.x, p.y + 12, p.x + 1, p.y + 13.4, .5, C.cream); }
}
module.exports = { C, CREW, poly, group, shape, rect, circle, text, line, wall, plant, treasure, person, van, scenery };
