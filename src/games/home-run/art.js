'use strict';

const { GameNode, Shapes, ShapeUtils } = require('squish-150');
const { THEMES, themeIds } = require('./themes');
const { flightAt, CONTACT_AT, clamp } = require('./engine');
const C = { cream: [255, 248, 224, 255], ink: [39, 66, 60, 255], gold: [255, 210, 105, 255],
    red: [193, 77, 61, 255], skin: [217, 155, 109, 255], wood: [235, 185, 113, 255], white: [255, 253, 243, 255] };
const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const close = points => [...points, points[0]];
const ellipse = (x, y, rx, ry = rx, n = 20) => Array.from({ length: n + 1 }, (_, i) => {
    const a = i * Math.PI * 2 / n; return [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
});
const stroke = (points, width) => {
    const a = [], b = [];
    points.forEach(([x, y], i) => {
        const p = points[Math.max(0, i - 1)], q = points[Math.min(points.length - 1, i + 1)];
        const t = Math.atan2(q[1] - p[1], q[0] - p[0]), dx = Math.sin(t) * width / 2, dy = Math.cos(t) * width / 2;
        a.push([x - dx, y + dy]); b.unshift([x + dx, y - dy]);
    }); return close([...a, ...b]);
};
const star = (x, y, r) => close(Array.from({ length: 10 }, (_, i) => {
    const a = i * Math.PI / 5 - Math.PI / 2, s = i % 2 ? r * .45 : r;
    return [x + Math.cos(a) * s, y + Math.sin(a) * s];
}));
const shape = (points, fill, options = {}) => new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: points, ...(fill ? { fill } : {}), ...options });
function add(root, points, fill, options) { const node = shape(points, fill, options); root.addChild(node, false); return node; }
const group = root => add(root, HIDDEN);
const rect = (root, x, y, w, h, c) => add(root, ShapeUtils.rectangle(x, y, w, h), c);
const disk = (root, x, y, rx, ry, c) => add(root, ellipse(x, y, rx, ry), c);
const line = (root, points, width, c) => add(root, stroke(points, width), c);
function text(root, value, x, y, size, color = C.ink, font = 'Trebuchet MS, sans-serif') {
    const node = new GameNode.Text({ textInfo: { text: String(value), x, y, size: size / Math.SQRT2, color, align: 'center', font } });
    root.addChild(node, false); return node;
}
function setText(node, value) {
    value = String(value);
    if (node.node.text.text !== value) { node.node.text = { ...node.node.text, text: value }; node.node.onStateChange(); }
}
function paint(node, points, color) { node.node.coordinates2d = points; if (color) node.node.fill = color; }
function actor(root) { return { root: group(root), parts: [] }; }
function part(a, points, color) { const node = add(a.root, points, color); a.parts.push({ node, points }); return node; }
function place(a, x, y, scale = 1, angle = 0) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (const p of a.parts) paint(p.node, p.points.map(([px, py]) => [x + (px * cos - py * sin) * scale, y + (px * sin + py * cos) * scale]));
}

function pumpkin(root, x, y, s) {
    disk(root, x, y, s, s * .8, [232, 139, 58, 255]);
    line(root, [[x, y - s * .65], [x + .15, y - s * 1.1]], s * .19, [85, 100, 65, 255]);
    for (const side of [-1, 1]) add(root, close([[x + side * s * .32, y - s * .35], [x + side * s * .57, y], [x + side * s * .12, y]]), C.gold);
    line(root, [[x - s * .4, y + s * .26], [x, y + s * .47], [x + s * .4, y + s * .26]], s * .13, C.gold);
}
function tree(root, x, y, s, snow) {
    rect(root, x - s * .13, y, s * .26, s * .8, [112, 89, 67, 255]);
    add(root, close([[x, y - s * 2.3], [x + s, y + .25], [x - s, y + .25]]), [54, 112, 90, 255]);
    if (snow) {
        add(root, close([[x, y - s * 2.3], [x + s * .46, y - s * 1.2], [x - s * .46, y - s * 1.2]]), C.white);
        add(root, star(x, y - s * 2.5, s * .3), C.gold);
        for (let i = 0; i < 4; i++) disk(root, x + (i % 2 ? -.35 : .35) * s, y - s * (1.15 - i * .3), s * .13, s * .13, i % 2 ? C.red : C.gold);
    }
}
function baseball(root, x, y, s) {
    disk(root, x, y, s, s, C.white);
    for (const side of [-1, 1]) line(root, [[x + side * s * .6, y - s * .75], [x + side * s * .3, y], [x + side * s * .6, y + s * .75]], s * .12, C.red);
}
function seasonIcon(root, id, x, y, s) {
    if (id === 'halloween') pumpkin(root, x, y, s);
    else if (id === 'christmas') tree(root, x, y + s * .6, s * .65, true);
    else baseball(root, x, y, s);
}

class Art {
    constructor(root, theme) {
        this.root = root; this.theme = theme; this.c = THEMES[theme];
        this.park = group(root); this.people = group(root); this.moving = group(root);
        this.fx = group(root); this.hud = group(root); this.menu = group(root); this.overlay = group(root);
        this.buildPark(); this.buildActors();
        this.shadow = disk(this.moving, 54, 76, 2, .5, [28, 52, 43, 50]);
        this.ring = add(this.moving, HIDDEN, C.cream);
        this.trail = Array.from({ length: 6 }, () => add(this.moving, HIDDEN, C.cream));
        this.ball = actor(this.moving);
        part(this.ball, ellipse(.15, .2, 1.5), [220, 219, 200, 255]);
        part(this.ball, ellipse(0, 0, 1.45), C.white);
        for (const side of [-1, 1]) {
            part(this.ball, stroke([[side * .85, -1.15], [side * .45, 0], [side * .85, 1.15]], .16), C.red);
            for (const y of [-.65, .1, .75]) part(this.ball, stroke([[side * .3, y - .16], [side * .9, y + .16]], .1), C.red);
        }
        this.bursts = Array.from({ length: 22 }, () => add(this.fx, HIDDEN, C.gold));
        this.weather = Array.from({ length: theme === 'christmas' ? 16 : theme === 'halloween' ? 3 : 0 }, () => add(this.fx, HIDDEN, C.cream));
        this.buildHud();
    }
    buildPark() {
        const r = this.park, c = this.c;
        rect(r, 0, 0, 100, 100, c.sky);
        disk(r, 82, 31, 4.7, 4.7, this.theme === 'halloween' ? C.cream : c.light);
        if (this.theme === 'halloween') disk(r, 84, 29.4, 4.3, 4.3, c.sky);
        else {
            for (const [x, y, s] of [[16, 30, 3], [66, 29, 2]]) {
                disk(r, x, y, s * 2.3, s * .48, c.haze); disk(r, x - s * .4, y - s * .4, s, s * .7, c.haze);
            }
        }
        add(r, close([[0, 39], [14, 33], [26, 38], [42, 32], [58, 36], [72, 34], [100, 38], [100, 55], [0, 55]]), c.haze);
        [6, 17, 86, 95].forEach((x, i) => tree(r, x, 40 + i % 2, 2.5 + i % 2, this.theme === 'christmas'));
        // Terraced little stands and a curved outfield fence.
        rect(r, 0, 39, 100, 7, c.dark);
        for (let row = 0; row < 2; row++) for (let i = 0; i < 24; i++) {
            const x = 2 + i * 4.25, y = 40.1 + row * 2.6;
            disk(r, x, y, .68, .73, [c.light, C.cream, c.shirt, c.sky][(i + row) % 4]);
        }
        const fence = Array.from({ length: 21 }, (_, i) => [i * 5, 41 + 5 * Math.pow((i * 5 - 50) / 50, 2)]);
        add(r, close([...fence, [100, 100], [0, 100]]), c.grass);
        for (let i = 0; i < 6; i++) {
            const y = 45 + i * 6;
            add(r, close([[0, y], [100, y - 3], [100, y], [0, y + 3]]), c.stripe);
        }
        line(r, fence, 4, c.fence); line(r, fence.map(([x, y]) => [x, y - 2]), .42, c.light);
        for (let i = 0; i < 12; i++) {
            const x = i * 9, y = 41 + 5 * Math.pow((x - 50) / 50, 2);
            line(r, [[x, y - 1.7], [x, y + 1.7]], .18, c.dark);
        }
        text(r, '90 m', 50, 39.7, 1.8, C.cream);
        line(r, [[7, 42], [7, 31]], .45, c.light); line(r, [[93, 42], [93, 31]], .45, c.light);
        add(r, close([[7, 31], [12, 32], [7, 34]]), c.shirt);
        add(r, close([[93, 31], [88, 32], [93, 34]]), c.shirt);
        add(r, close([[50, 50], [76, 65], [54, 81], [27, 65]]), c.dirt);
        add(r, close([[50, 54], [68, 65], [54, 75], [35, 65]]), c.grass);
        line(r, [[7, 44], [54, 80], [93, 44]], .28, C.cream);
        for (const [x, y] of [[50, 51], [75, 65], [28, 65]]) add(r, close([[x, y - .8], [x + 1.3, y], [x, y + .8], [x - 1.3, y]]), C.white);
        disk(r, 51, 58, 4, 1.8, c.dirt);
        rect(r, 49.8, 57.4, 2.3, .55, C.cream);
        disk(r, 53, 79, 10, 3.6, c.dirt);
        add(r, close([[51.7, 78], [56.3, 78], [56.3, 79.8], [54, 81.2], [51.7, 79.8]]), C.white);
        line(r, [[41.5, 75], [47.8, 75], [47.8, 81], [41.5, 81], [41.5, 75]], .23, C.cream);
        if (this.theme === 'halloween') {
            [[12, 59, 3.5], [88, 59, 4], [7, 65, 2.4]].forEach(([x, y, s]) => pumpkin(r, x, y, s));
            // Friendly ghosts, with eyes and a scalloped hem.
            for (const [x, y] of [[21, 35], [76, 36]]) {
                disk(r, x, y, 1.7, 1.8, C.cream);
                add(r, close([[x - 1.7, y], [x + 1.7, y], [x + 2.1, y + 3], [x + .7, y + 2.5], [x, y + 3.1], [x - .7, y + 2.5], [x - 2.1, y + 3]]), C.cream);
                disk(r, x - .55, y, .2, .35, c.dark); disk(r, x + .55, y, .2, .35, c.dark);
            }
        } else if (this.theme === 'christmas') {
            for (const x of [12, 87]) {
                tree(r, x, 59, 3.6, true);
                rect(r, x - 3.7, 59, 3.5, 3.2, C.red); rect(r, x - 2.3, 59, .6, 3.2, C.gold);
                rect(r, x + .4, 60, 3, 2.4, c.fence); rect(r, x + 1.5, 60, .5, 2.4, C.gold);
            }
            line(r, fence.map(([x, y]) => [x, y - 2.4]), .5, C.white);
            for (let i = 0; i < 17; i++) {
                const x = 2 + i * 6, y = 39 + 5 * Math.pow((x - 50) / 50, 2);
                disk(r, x, y, .36, .5, i % 2 ? C.red : C.gold);
            }
        } else {
            for (const x of [14, 86]) {
                rect(r, x - 4, 55, 8, 2, c.fence);
                rect(r, x - 3, 57, .7, 2.4, c.dark); rect(r, x + 2, 57, .7, 2.4, c.dark);
            }
        }
    }
    kid(root, pitcher = false) {
        const a = actor(root), c = this.c, shirt = pitcher ? C.cream : c.shirt;
        part(a, ellipse(0, 1, 4.7, 1), [30, 55, 45, 60]);
        part(a, stroke([[-1.7, -4], [-2.5, .1]], 1.8), C.cream);
        part(a, stroke([[1.5, -4], [3, .1]], 1.8), C.cream);
        part(a, ellipse(-2.8, .3, 1.8, .7), c.cap); part(a, ellipse(3.3, .3, 1.8, .7), c.cap);
        part(a, close([[-2.7, -10], [2.8, -10], [3.5, -4], [-3.1, -4]]), shirt);
        part(a, stroke([[0, -9], [0, -4]], .16), c.dark);
        part(a, star(-1.4, -7.6, .85), pitcher ? c.accent : C.cream);
        part(a, ellipse(0, -13, 3.5, 3.7), C.skin);
        part(a, ellipse(-3.3, -12.7, .7, 1), C.skin);
        part(a, ellipse(1.5, -13.1, .24, .4), c.dark);
        part(a, stroke([[1.2, -11.5], [1.8, -11.1], [2.4, -11.6]], .18), c.dark);
        part(a, close([[-3.6, -13.6], [-3.5, -15.8], [-2.1, -17.2], [.9, -17.5], [3, -16.2], [3.6, -13.8]]), c.cap);
        part(a, ellipse(1.8, -13.8, 3.8, .6), c.cap);
        part(a, stroke([[-2.5, -9], [-3.8, -6.8], [-2.2, -5.5]], 1.5), C.skin);
        part(a, stroke([[2.2, -9], [4, -7.5], [5.3, -8.3]], 1.6), C.skin);
        if (this.theme === 'halloween' && !pitcher) {
            part(a, close([[-3.6, -14], [-1.5, -21.5], [2.7, -14]]), c.cap);
            part(a, stroke([[-2.7, -16], [1.7, -16]], .55), c.light);
        } else if (this.theme === 'christmas' && !pitcher) {
            part(a, close([[-3.2, -15], [-1.8, -19], [2, -19], [4.1, -16], [.5, -16]]), c.shirt);
            part(a, ellipse(4.1, -16, .85), C.white);
            part(a, stroke([[-3.4, -14.5], [3.4, -14.5]], .7), C.white);
        }
        return a;
    }
    buildActors() {
        this.pitcher = this.kid(this.people, true); place(this.pitcher, 51, 57.7, .43);
        this.batter = this.kid(this.people); place(this.batter, 39, 78);
        this.bat = actor(this.people);
        part(this.bat, close([[-.4, 1], [.4, 1], [.55, -3], [1, -10], [.8, -11.4], [-.8, -11.4], [-1, -10], [-.55, -3]]), C.wood);
        part(this.bat, stroke([[-.25, -4], [-.4, -10]], .2), C.cream);
        part(this.bat, ellipse(0, 1, .8, .38), this.c.dark);
        part(this.bat, ellipse(0, 0, 1, .8), C.skin);
        place(this.bat, 44.5, 70, 1, -.42);
    }
    buildHud() {
        const r = this.hud, c = this.c;
        rect(r, 0, 0, 100, 23, c.dark);
        text(r, 'HOME RUN', 50, 1.5, 5.2, C.cream, 'Georgia, serif');
        this.soundLabel = text(r, 'SOUND ON', 12, 4.5, 1.8, C.cream);
        this.pauseLabel = text(r, '', 89, 4.5, 2, C.cream);
        this.stats = [];
        for (const [i, label] of ['SCORE', 'BALL', 'BEST'].entries()) {
            const x = 19 + i * 31;
            rect(r, x - 13.5, 10, 27, 11, c.dark.map((v, i) => i === 3 ? 255 : v + 15));
            text(r, label, x, 10.4, 1.8, C.cream);
            this.stats.push(text(r, i === 1 ? '0 / 10' : '0', x, 13, 4.8, i === 0 ? C.gold : C.cream));
        }
        this.message = text(r, '', 50, 24.2, 3, this.theme === 'halloween' ? C.cream : c.dark);
        this.distance = text(r, '', 50, 28.5, 1.9, this.theme === 'halloween' ? C.gold : c.dark);
        rect(r, 0, 83, 100, 17, C.cream);
    }
    buildMenu(game) {
        const r = this.menu, c = this.c; r.clearChildren();
        const menu = ['setup', 'results'].includes(game.match.phase);
        if (menu) {
            themeIds.forEach((id, i) => {
                const x = 3 + i * 32;
                rect(r, x, 84, 30, 7, id === game.theme ? c.dark : [232, 229, 208, 255]);
                seasonIcon(r, id, x + 4.4, 87.5, 1.7);
                text(r, THEMES[id].name, x + 18.5, 85.5, 2.4, id === game.theme ? C.cream : C.ink);
            });
            rect(r, 25, 92.5, 50, 6.5, c.accent);
            text(r, game.match.phase === 'results' ? 'PLAY AGAIN' : 'LET’S PLAY', 50, 93.5, 3.1, C.cream);
            text(r, '10 balls', 12, 94.5, 2, C.ink);
            text(r, '1 player', 88, 94.5, 2, C.ink);
        } else {
            this.swingButton = rect(r, 23, 86, 54, 10.2, c.accent);
            this.swingLabel = text(r, 'SWING', 50, 87.3, 4.6, C.cream);
            this.dots = Array.from({ length: 10 }, (_, i) => disk(r, 7 + i * 9.55, 98.2, .8, .8, [215, 216, 195, 255]));
            text(r, 'TAP', 11, 88.5, 2.4); text(r, 'SPACE', 88, 88.5, 2.4);
        }
    }
    buildOverlay(game) {
        const r = this.overlay, m = game.match; r.clearChildren();
        if (!game.paused && m.phase !== 'results') return;
        rect(r, 13, 33, 76, 37, [24, 43, 40, 50]); rect(r, 12, 32, 76, 37, C.cream);
        if (game.paused) {
            text(r, 'Take a breather', 50, 35, 5, this.c.dark, 'Georgia, serif');
            text(r, 'Your ball will wait for you.', 50, 43, 2.6);
            rect(r, 26, 50, 48, 7, this.c.accent); text(r, 'KEEP PLAYING', 50, 51.2, 3, C.cream);
            text(r, 'Choose a park', 50, 60, 2.7);
        } else {
            text(r, m.hits ? 'Nice swinging!' : 'Let’s try again!', 50, 35, 5, this.c.dark, 'Georgia, serif');
            text(r, `${m.score} points`, 50, 42.2, 6.2, this.c.accent);
            text(r, `${m.hits} hits   ·   ${m.homers} home runs`, 50, 52, 3);
            text(r, m.longest ? `Longest hit  ${m.longest} m` : 'Tap when the ball reaches the ring.', 50, 57.5, 2.5);
            text(r, game.saveFailed ? 'Record not saved · tap here to retry' : `Best at this park: ${game.records.best[game.theme]}`, 50, 64, 2.3);
        }
    }
    project(hit, age) {
        const p = flightAt(hit, age), depth = p.distance / (p.distance + 65);
        return { x: 54 + Math.sin(hit.angle) * depth * 62, y: 73 - depth * 65 - p.height * .65,
            groundY: 78 - depth * 65, scale: 1.05 - depth * .8 };
    }
    draw(game) {
        const m = game.match, c = this.c, active = !['setup', 'results'].includes(m.phase);
        const ready = m.contactReady(), swingAge = m.time - m.swingAt;
        setText(this.stats[0], m.score); setText(this.stats[1], `${m.pitch} / 10`); setText(this.stats[2], game.records.best[game.theme]);
        setText(this.soundLabel, game.records.sound ? 'SOUND ON' : 'SOUND OFF');
        setText(this.pauseLabel, active ? game.paused ? 'RESUME' : 'PAUSE' : '');
        setText(this.message, m.phase === 'setup' ? 'Tap or press Space to swing.' : m.phase === 'results' ? 'A little practice. A little magic.' : m.message);
        setText(this.distance, m.hit ? `${Math.round(m.hit.distance)} m  ·  +${m.hit.points} points` : m.phase === 'setup' ? c.park : ready ? 'The ring is ready!' : '');
        place(this.pitcher, 51, 57.7, .43, m.phase === 'windup' ? -.1 * Math.sin(m.age * Math.PI / .85) : 0);
        const swing = swingAge < .42 ? m.phase === 'flight' ? Math.cos(swingAge / .42 * Math.PI / 2)
            : Math.sin(clamp(swingAge / .42, 0, 1) * Math.PI) : 0;
        place(this.batter, 39 + swing * .7, 78, 1, swing * .045);
        place(this.bat, 44.5 + swing * .8, 70, 1, -.42 + swing * 2.35);
        paint(this.ring, active && ['windup', 'pitch'].includes(m.phase) ? stroke(ellipse(54, 73, ready ? 4.1 : 3.5), ready ? .55 : .25) : HIDDEN, ready ? C.gold : C.cream);
        let ball = { x: 52.8, y: 53.5, scale: .45, groundY: 58 };
        if (m.phase === 'pitch') {
            const t = m.age / CONTACT_AT;
            ball = { x: 52.8 + t * 1.2, y: 53.5 + t * 19.5 - Math.sin(Math.min(1, t) * Math.PI) * 4,
                scale: .45 + .6 * t, groundY: 58 + 20 * t };
        } else if (m.hit && ['flight', 'rest'].includes(m.phase)) ball = this.project(m.hit, m.phase === 'rest' ? 99 : m.age);
        else if (m.phase === 'rest' || m.phase === 'results') ball.scale = 0;
        place(this.ball, ball.x, ball.y, ball.scale, m.time * 2);
        paint(this.shadow, ball.scale ? ellipse(ball.x, ball.groundY, ball.scale * 1.8, ball.scale * .4) : HIDDEN);
        this.trail.forEach((node, i) => {
            if (m.phase !== 'flight' || m.age <= i * .035) return paint(node, HIDDEN);
            const p = this.project(m.hit, m.age - (i + 1) * .035);
            paint(node, ellipse(p.x, p.y, p.scale * (.7 - i * .08)), [...C.cream.slice(0, 3), 135 - i * 18]);
        });
        this.bursts.forEach((node, i) => {
            const t = m.age;
            if (!m.hit || m.phase !== 'flight' || t > 1) return paint(node, HIDDEN);
            const angle = i * Math.PI * 2 / this.bursts.length;
            const r = (4 + t * (12 + i % 4)) * (m.hit.points === 4 ? 1.5 : .8);
            paint(node, star(54 + Math.cos(angle) * r, 72 + Math.sin(angle) * r - t * 14, (1 - t) * .7), i % 2 ? c.light : C.cream);
        });
        this.weather.forEach((node, i) => {
            if (this.theme === 'christmas') {
                const x = (i * 19.7 + Math.sin(m.time + i) * 1.3 + 100) % 100, y = 29 + (i * 7.3 + m.time * 2) % 51;
                paint(node, ellipse(x, y, .16 + i % 3 * .08), [255, 253, 243, 165]);
            } else {
                const x = 22 + i * 27 + Math.sin(m.time * .6 + i) * 4, y = 31 + Math.sin(m.time + i) * 2;
                const w = 1 + Math.sin(m.time * 7 + i) * .5;
                paint(node, close([[x - 2.3, y - w], [x - .8, y], [x, y - .5], [x + .8, y], [x + 2.3, y - w], [x + 1.3, y + .8], [x, y + .3], [x - 1.3, y + .8]]), c.dark);
            }
        });
        if (active && this.swingButton) {
            this.swingButton.node.fill = ready ? c.dark : c.accent;
            setText(this.swingLabel, m.phase === 'flight' || m.phase === 'rest' ? m.hit ? 'NICE HIT!' : 'NEXT BALL…' : ready ? 'SWING!' : 'SWING');
            this.dots.forEach((node, i) => { node.node.fill = i < m.history.length ? m.history[i] === 4 ? C.gold : m.history[i] ? c.fence : [161, 168, 155, 255] : i === m.pitch - 1 ? c.accent : [215, 216, 195, 255]; });
        }
        this.root.node.onStateChange();
    }
}

module.exports = { Art, C, HIDDEN, shape, add, group };
