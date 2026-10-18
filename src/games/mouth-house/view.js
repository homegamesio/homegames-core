'use strict';
const { GameNode, Shapes, ShapeUtils } = require('squish-150');
const { MOODS, COURSE_NAMES, TITLES, matches } = require('./content');
const R = 9 / 19, HIDDEN = [[0, 0], [0, 0], [0, 0]];
const C = { ink: [27, 35, 32, 255], dim: [103, 111, 96, 255], cream: [245, 239, 219, 255],
    paper: [255, 250, 234, 255], pink: [242, 148, 161, 255], pinkDark: [199, 90, 111, 255],
    lime: [208, 232, 109, 255], purple: [170, 153, 210, 255], green: [78, 113, 87, 255],
    red: [168, 55, 67, 255], gold: [244, 199, 101, 255], faded: [219, 217, 197, 255] };
const COLORS = [C.lime, C.purple, C.pink];
function oval(x, y, rx, ry = rx * R, steps = 30) {
    return Array.from({ length: steps + 1 }, (_, i) => { const a = i / steps * Math.PI * 2; return [x + Math.cos(a) * rx, y + Math.sin(a) * ry]; });
}
function round(x, y, w, h, radius = 2) {
    const ry = Math.min(h / 2, radius * R), rx = Math.min(w / 2, radius), points = [];
    for (const [cx, cy, start] of [[x + w - rx, y + ry, -Math.PI / 2], [x + w - rx, y + h - ry, 0],
        [x + rx, y + h - ry, Math.PI / 2], [x + rx, y + ry, Math.PI]]) {
        for (let i = 0; i <= 5; i++) { const a = start + i * Math.PI / 10; points.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    }
    points.push(points[0]); return points;
}
function line(points, width = .5) {
    const left = [], right = [];
    points.forEach(([x, y], i) => {
        const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
        const angle = Math.atan2((b[1] - a[1]) / R, b[0] - a[0]);
        const dx = Math.sin(angle) * width / 2, dy = Math.cos(angle) * width / 2 * R;
        left.push([x - dx, y + dy]); right.unshift([x + dx, y - dy]);
    }); return [...left, ...right, left[0]];
}
function group(parent, ids) {
    const node = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN, playerIds: ids });
    parent.addChild(node, false); return node;
}
// Reuse node identities during animation instead of allocating an entire tree
// each frame. Unused text is cleared as well as hidden from serialization.
class Pen {
    constructor(parent, ids) { this.root = group(parent, ids); this.nodes = []; this.cursor = 0; }
    begin() { this.cursor = 0; }
    put(points, fill, text) {
        const i = this.cursor++;
        if (!this.nodes[i]) { this.nodes[i] = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN }); this.root.addChild(this.nodes[i], false); }
        const n = this.nodes[i].node; n.coordinates2d = points; n.fill = fill; n.text = text; return n;
    }
    shape(points, fill) { return this.put(points, fill); }
    box(x, y, w, h, fill, radius = 2) { return this.shape(round(x, y, w, h, radius), fill); }
    disk(x, y, rx, ry, fill) { return this.shape(oval(x, y, rx, ry), fill); }
    stroke(points, width, fill) { return this.shape(line(points, width), fill); }
    text(text, x, y, size = 3.5, color = C.ink, align = 'left', font = 'sans-serif') {
        return this.put(HIDDEN, undefined, { text: String(text), x, y, size, color, align, font });
    }
    end() { for (let i = this.cursor; i < this.nodes.length; i++) { const n = this.nodes[i].node; n.coordinates2d = HIDDEN; n.fill = undefined; n.text = undefined; } }
}
const cardRect = i => ({ x: i % 2 ? 52 : 5, y: 66 + Math.floor(i / 2) * 9.2, w: 43, h: 8.2 });
function cardAt(x, y) { for (let i = 0; i < 6; i++) { const b = cardRect(i); if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i; } return -1; }
function star(p, x, y, size, color) { p.shape([[x, y - size * R], [x + size * .28, y - size * R * .25], [x + size, y], [x + size * .28, y + size * R * .25], [x, y + size * R], [x - size * .28, y + size * R * .25], [x - size, y], [x - size * .28, y - size * R * .25], [x, y - size * R]], color); }

function foodIcon(p, food, x, y, scale = 1) {
    const color = COLORS[food.place], s = scale;
    const poly = (pts, fill) => p.shape(pts.map(([a, b]) => [x + a * s, y + b * s * R]), fill);
    const disk = (a, b, rx, ry, fill) => p.disk(x + a * s, y + b * s * R, rx * s, ry * s * R, fill);
    const stroke = (pts, w, fill) => p.stroke(pts.map(([a, b]) => [x + a * s, y + b * s * R]), w * s, fill);
    if (food.thing === 0) {
        p.box(x - 4.7 * s, y - 3.3 * s * R, 9.4 * s, 6.6 * s * R, C.ink, 2 * s);
        p.box(x - 4.1 * s, y - 3 * s * R, 8.2 * s, 5.8 * s * R, color, 1.7 * s);
        disk(-2.1, -1.2, 1.1, .55, C.paper); disk(3, -5, 1.2, 1.2, color); disk(5, -3.5, .7, .7, color);
    } else if (food.thing === 1) {
        poly([[-2, -5], [3, -5], [3, 1], [5, 2], [4, 5], [-3, 5], [-4, 3], [-2, 1], [-2, -5]], C.ink);
        poly([[-1.4, -4.4], [2.4, -4.4], [2.4, 1.4], [4.2, 2.3], [3.5, 4.3], [-2.6, 4.3], [-3.2, 3], [-1.4, 1.3], [-1.4, -4.4]], color);
        stroke([[-1.3, -2.7], [2.3, -2.7]], .8, C.paper);
    } else if (food.thing === 2) {
        poly([[-5, 3.8], [-4, -2], [3, -4], [5, 4], [-5, 3.8]], C.ink);
        poly([[-4.3, 3.2], [-3.5, -1.4], [2.5, -3.3], [4.2, 3.3], [-4.3, 3.2]], color);
        disk(-1.9, .6, 1, 1, C.ink); disk(1.8, 2, .75, .75, C.ink); disk(.5, -1.4, .65, .65, C.ink);
    } else if (food.thing === 3) {
        poly([[-4, -4], [0, -3], [4, -4], [5, -1], [3, 5], [1, 5], [0, 1], [-1, 5], [-3, 5], [-5, -1], [-4, -4]], C.ink);
        poly([[-3.6, -3.3], [0, -2.3], [3.6, -3.3], [4.2, -1], [2.5, 4.3], [1.5, 4.3], [0, -.2], [-1.5, 4.3], [-2.5, 4.3], [-4.2, -1], [-3.6, -3.3]], color);
    } else if (food.thing === 4) {
        disk(3.5, -.3, 2.7, 2.8, C.ink); disk(3.5, -.3, 1.7, 1.8, C.paper);
        poly([[-4.5, -3], [3, -3], [2, 4], [-3, 4], [-4.5, -3]], C.ink);
        poly([[-3.7, -2.3], [2.2, -2.3], [1.4, 3.3], [-2.4, 3.3], [-3.7, -2.3]], color);
        stroke([[-1.5, -4], [-2, -5.5], [-.5, -6.5]], .6, C.dim);
    } else {
        stroke([[-4, 3], [-2, 3], [-2, -2], [0, -3], [2, -2], [2, 1], [4, 1], [4, -2]], 3.5, C.ink);
        stroke([[-4, 3], [-2, 3], [-2, -2], [0, -3], [2, -2], [2, 1], [4, 1], [4, -2]], 2.4, color);
        disk(4, -2.5, 1.7, 1.7, color);
    }
    // A tiny face makes even a bar of soap a questionable dinner guest.
    for (const side of [-1, 1]) {
        const ex = food.thing === 5 ? 3.4 + side * .65 : side * 1.3;
        if (food.mood === 2) stroke([[ex - .4, -.4], [ex + .4, -.4]], .45, C.ink);
        else { disk(ex, -.5, .38, .52, C.ink); if (food.mood === 1) stroke([[ex - .5, -1.9 + side * .3], [ex + .5, -1.9 - side * .3]], .5, C.ink); }
    }
}

class View {
    constructor(game) {
        this.game = game; this.people = new Map(); this.back = new Pen(game.base); this.creature = new Pen(game.base);
        this.over = group(game.base); this.back.begin();
        this.back.box(0, 0, 100, 100, C.cream, 0);
        this.back.box(0, 0, 100, 46.5, C.lime, 0);
        for (let i = 0; i < 11; i++) this.back.stroke([[i * 12 - 18, 17], [i * 12 + 30, 46.5]], .22, [179, 202, 87, 255]);
        this.back.stroke([[5, 46.5], [95, 46.5]], .4, C.ink);
        this.back.end();
    }
    join(id) { this.people.set(id, { ui: new Pen(this.over, [id]), held: new Pen(this.over, [id]) }); }
    leave(id) {
        const p = this.people.get(id); if (!p) return;
        this.over.removeChild(p.ui.root.node.id, false); this.over.removeChild(p.held.root.node.id, false); this.people.delete(id);
    }
    button(p, label, y = 79, fill = C.ink, color = C.paper) {
        p.box(8, y + .7, 84, 8.2, C.dim, 3); p.box(8, y, 84, 8.2, fill, 3);
        p.text(label, 50, y + 2.8, 4.2, color, 'center');
    }
    ui() {
        const g = this.game;
        for (const [id, view] of this.people) {
            const p = view.ui, player = g.players.get(id); p.begin();
            p.text('MOUTH HOUSE', 5, 3.2, 7.2, C.ink, 'left', 'Georgia');
            p.text(g.players.size === 1 ? 'TABLE FOR ONE' : `TABLE FOR ${g.players.size}`, 5, 8.4, 2.9);
            p.text('EST. JUST NOW', 95, 8.4, 2.7, C.ink, 'right');
            const menu = g.phase === 'welcome', end = ['won', 'lost'].includes(g.phase);
            if (menu) {
                p.text('Your phone has a roommate.', 50, 12.5, 4.1, C.ink, 'center');
                p.text('It has terrible taste.', 50, 15.2, 3.5, C.dim, 'center');
                p.text('A very small dinner party.', 50, 49, 5.4, C.ink, 'center', 'Georgia');
                const lines = [['01', 'Read its weird food rules.', 'There is one right snack on each tray.'],
                    ['02', 'Flick a snack up. Gulp.', 'Five courses. Six burps. No rush.'],
                    ['03', 'Friends hear different whispers.', 'Trade clues. Grow a strange roommate.']];
                lines.forEach(([n, title, sub], i) => {
                    const y = 55 + i * 6.6;
                    p.disk(11, y + 1.5, 4.8, 2.28, i === 2 ? C.purple : C.lime); p.text(n, 11, y + .7, 3.2, C.ink, 'center');
                    p.text(title, 19, y, 3.8); p.text(sub, 19, y + 2.5, 2.85, C.dim);
                });
                this.button(p, 'FEED THE HOUSE');
                p.text('Solo is ready. Friends can join any time.', 50, 90, 3.1, C.dim, 'center');
                p.text(`${g.records.dinners} dinners served   /   ${g.records.collection.length} of ${TITLES.length} odd roommates`, 50, 95, 2.9, C.dim, 'center');
            } else {
                for (let i = 0; i < 5; i++) {
                    const x = 7 + i * 5.3;
                    p.disk(x, 14, 1.7, 1.7 * R, i < g.eaten.length ? C.ink : [165, 184, 89, 255]);
                }
                p.text(`${g.eaten.length}/5 COURSES`, 5, 16.1, 2.7);
                p.text(`${g.burps} BURPS LEFT`, 95, 13.1, 3.2, g.burps <= 2 ? C.red : C.ink, 'right');
                p.text(end ? (g.phase === 'won' ? 'DINNER COMPLETE' : 'STILL HUNGRY') : COURSE_NAMES[g.courseNumber].toUpperCase(), 95, 16.1, 2.5, C.dim, 'right');
                if (end) this.ending(p);
                else if (g.phase === 'feedback') this.feedback(p);
                else this.tray(p, id, player);
            }
            p.end();
        }
    }
    tray(p, id, player) {
        const g = this.game, c = g.course, own = g.ownRules(id);
        const shared = c.shared, solo = g.players.size === 1;
        p.text(g.feedback || (g.phase === 'swallowing' ? 'Please hold. Judging your snack.' : 'What does the little weirdo want?'), 50, 42.2, 3.5, g.feedback ? C.red : C.ink, 'center');
        p.text(solo ? 'A WHISPER FROM THE HOUSE' : 'YOUR SECRET WHISPER', 5, 48.3, 2.8, C.dim);
        c.rules.forEach((r, i) => {
            const visible = own.includes(i) || shared.includes(i), y = 51 + i * 2.8;
            p.disk(7, y + .7, .8, .8 * R, visible ? C.ink : C.dim);
            p.text(visible ? r.text : `A friend heard rule ${i + 1}...`, 10, y, 3.65, visible ? C.ink : C.dim);
        });
        const allShared = own.every(i => shared.includes(i));
        p.text(player.selected >= 0 ? 'TAP THE MOUTH TO FEED' : 'FLICK A SNACK UP', 5, 61.3, 2.75, C.dim);
        if (!solo) {
            p.box(57, 59.6, 38, 5.4, allShared ? C.faded : C.purple, 2);
            p.text(allShared ? 'CLUE SHARED' : 'SHARE MY CLUE', 76, 61.5, 2.9, C.ink, 'center');
        }
        c.deck.forEach((food, i) => {
            const b = cardRect(i), rejected = c.rejected.includes(i), selected = player.selected === i;
            p.box(b.x, b.y + .45, b.w, b.h, C.faded, 2.3);
            p.box(b.x, b.y, b.w, b.h, selected ? C.ink : rejected ? C.faded : C.paper, 2.3);
            if (!rejected) foodIcon(p, food, b.x + 7.2, b.y + 4.3, .95);
            else { p.stroke([[b.x + 5, b.y + 3], [b.x + 9, b.y + 5]], .5, C.dim); p.stroke([[b.x + 9, b.y + 3], [b.x + 5, b.y + 5]], .5, C.dim); }
            p.text(food.name, b.x + 14, b.y + 2.2, food.name.length > 11 ? 2.8 : 3.1, selected ? C.paper : rejected ? C.dim : C.ink);
            p.text(rejected ? 'POLITELY REJECTED' : MOODS[food.mood], b.x + 14, b.y + 4.8, rejected ? 2.2 : 2.6, selected ? C.lime : C.dim);
        });
        p.text('Flick up · or tap a snack, then the mouth', 50, 95, 2.85, C.dim, 'center');
    }
    feedback(p) {
        const g = this.game, food = g.eaten[g.eaten.length - 1];
        p.text(g.feedback, 50, 42.2, 3.6, C.ink, 'center');
        p.text('EXCELLENTLY QUESTIONABLE.', 50, 49, 3.1, C.dim, 'center');
        foodIcon(p, food, 50, 57, 2.1);
        p.text(food.name, 50, 64, 6, C.ink, 'center', 'Georgia');
        p.text(['It grew a new pair of ears.', 'A moustache. Of course.', 'Those are probably wings.', 'It has achieved antenna.'][g.courseNumber], 50, 69, 3.6, C.dim, 'center');
        p.text(`${g.burps} burps left. Its standards keep getting worse.`, 50, 73, 3.1, C.dim, 'center');
        this.button(p, 'NEXT COURSE');
        p.text('No hurry. Let everyone admire the damage.', 50, 94, 2.9, C.dim, 'center');
    }
    ending(p) {
        const g = this.game, won = g.phase === 'won';
        p.text(won ? 'Your roommate has become sentient.' : 'A burp too far. It still likes you.', 50, 42.2, 3.4, C.ink, 'center');
        p.text(won ? 'PLEASE WELCOME' : 'DINNER HAS LEFT THE BUILDING', 50, 49.5, 3, C.dim, 'center');
        const title = won ? TITLES[g.titleIndex] : 'The Unfed Legend';
        const words = title.split(' '), half = Math.ceil(words.length / 2);
        p.text(words.slice(0, half).join(' '), 50, 54, 6.2, C.ink, 'center', 'Georgia');
        p.text(words.slice(half).join(' '), 50, 58, 6.2, C.ink, 'center', 'Georgia');
        p.stroke([[19, 64], [81, 64]], .3, C.dim);
        p.text(won ? `${g.eaten.length} courses  /  ${g.burps} burps to spare` : `${g.eaten.length} of 5 courses made it down`, 50, 67, 3.5, C.ink, 'center');
        if (won) p.text(`${g.records.collection.length} / ${TITLES.length} roommates discovered`, 50, 71, 3.2, C.dim, 'center');
        else {
            const answer = g.course.deck.find(f => matches(f, g.course.rules));
            p.text(`It wanted: ${MOODS[answer.mood].toLowerCase()} ${answer.name.toLowerCase()}`, 50, 71, 3.2, C.dim, 'center');
        }
        this.button(p, won ? 'ANOTHER BAD DINNER' : 'TRY ANOTHER DINNER');
        p.text(g.saveFailed ? 'Could not save. Tap here to retry.' : `BEST DINNER: ${g.records.best} BURPS TO SPARE`, 50, 94, 2.9, g.saveFailed ? C.red : C.dim, 'center');
    }
    animate() {
        const g = this.game, p = this.creature, n = g.eaten.length, t = g.time;
        p.begin();
        const chewing = g.phase === 'swallowing', happy = ['feedback', 'won'].includes(g.phase);
        const recoil = g.motion && !g.motion.good && g.motion.age > .65 && g.motion.age < 1.2 ? Math.sin(g.motion.age * 48) * 1.1 : 0;
        const bounce = Math.sin(t * 2.4) * .35 + (chewing ? Math.sin(g.motion.age * 17) * .6 : 0);
        const cx = 50 + recoil, cy = 29 + bounce;
        p.disk(50, 40.6, 28, 1.2, [174, 191, 91, 255]);
        // Mutations accumulate into a single absurd portrait over five courses.
        if (n >= 3) for (const side of [-1, 1]) {
            p.shape([[cx + side * 18, cy], [cx + side * 41, cy - 5], [cx + side * 36, cy + 1], [cx + side * 31, cy + 3], [cx + side * 21, cy + 7], [cx + side * 18, cy]], C.ink);
            p.shape([[cx + side * 21, cy + .3], [cx + side * 38, cy - 3.8], [cx + side * 34, cy + .5], [cx + side * 30, cy + 2], [cx + side * 22, cy + 5], [cx + side * 21, cy + .3]], C.purple);
        }
        if (n >= 1) for (const side of [-1, 1]) {
            p.shape([[cx + side * 16, cy - 5], [cx + side * 29, cy - 11], [cx + side * 28, cy + 1], [cx + side * 16, cy - 5]], C.ink);
            p.shape([[cx + side * 19, cy - 5], [cx + side * 27, cy - 9], [cx + side * 25, cy - 1], [cx + side * 19, cy - 5]], C.purple);
        }
        if (n >= 4) {
            p.stroke([[cx, cy - 7], [cx + Math.sin(t) * 3, cy - 12]], 1.2, C.ink);
            star(p, cx + Math.sin(t) * 3, cy - 12.3, 3.4, C.pinkDark);
        }
        const body = Array.from({ length: 61 }, (_, i) => {
            const a = i / 60 * Math.PI * 2, bump = 1 + .032 * Math.sin(a * 7 + t * 2);
            return [cx + Math.cos(a) * 28 * bump, cy + Math.sin(a) * 10.8 * bump];
        });
        p.shape(body, C.ink); p.shape(body.map(([x, y]) => [cx + (x - cx) * .966, cy + (y - cy) * .956]), C.pink);
        p.disk(cx - 9, cy - 6, 11, 2.3, [249, 173, 180, 255]);
        const blink = t % 5.6 > 5.42;
        for (const side of [-1, 1]) {
            const ex = cx + side * 11, ey = cy - 4.7;
            p.disk(ex, ey, 6.8, 3.7, C.ink); p.disk(ex, ey - .1, 6.1, blink ? .3 : 3.35, C.paper);
            if (!blink) { p.disk(ex + Math.sin(t * .7) * 1.2, ey + .4, 2, 1.55, C.ink); p.disk(ex + .5, ey - .3, .6, .4, C.paper); }
            p.disk(cx + side * 22, cy + 1.2, 3.5, 1, C.pinkDark);
            p.stroke([[cx + side * 12, cy + 9], [cx + side * 15, cy + 11], [cx + side * 21, cy + 11]], 1.3, C.ink);
        }
        const selected = [...g.players.values()].some(v => v.selected >= 0);
        const mouthH = chewing ? 4.5 + Math.sin(g.motion.age * 13) : selected ? 5.3 : happy ? 3.1 : 3.8;
        p.disk(cx, cy + 3.4, 15.5, mouthH, C.ink);
        p.disk(cx + 1, cy + 3.4 + mouthH * .55, 7.8, mouthH * .32, C.pinkDark);
        for (const side of [-1, 1]) p.box(cx + side * 7 - 1.7, cy + 3.2 - mouthH, 3.4, 1.7, C.paper, .7);
        if (n >= 2) for (const side of [-1, 1]) {
            p.shape([[cx, cy - .7], [cx + side * 6, cy - 1.6], [cx + side * 10, cy - .3], [cx + side * 15, cy - 1.7], [cx + side * 12, cy + 1.4], [cx + side * 4, cy + 1], [cx, cy - .7]], C.ink);
        }
        if (n >= 5) {
            p.shape([[cx - 9, cy - 10], [cx - 11, cy - 14], [cx - 4, cy - 12], [cx, cy - 15], [cx + 4, cy - 12], [cx + 11, cy - 14], [cx + 9, cy - 10], [cx - 9, cy - 10]], C.ink);
            p.shape([[cx - 8, cy - 10.6], [cx - 9, cy - 12.8], [cx - 4, cy - 11.2], [cx, cy - 13.9], [cx + 4, cy - 11.2], [cx + 9, cy - 12.8], [cx + 8, cy - 10.6], [cx - 8, cy - 10.6]], C.gold);
        }
        for (let i = 0; i < 5; i++) star(p, 8 + i * 21, 24 + (i % 2) * 12 + Math.sin(t + i) * .5, i % 2 ? 1.7 : 1, C.ink);
        if (g.motion && g.phase === 'swallowing') {
            const a = Math.min(1, g.motion.age / .55), b = cardRect(g.motion.index), ease = 1 - (1 - a) ** 2;
            foodIcon(p, g.motion.food, b.x + 21 + (50 - b.x - 21) * ease, b.y + 4 + (cy + 3 - b.y - 4) * ease, 1.6 - a * .9);
        }
        if (happy) for (let i = 0; i < 12; i++) {
            const a = i * 2.4 + t * .3, x = 50 + Math.cos(a) * (34 + i % 3), y = 29 + Math.sin(a) * 10;
            star(p, x, y, 1.1 + .4 * Math.sin(t * 3 + i), i % 2 ? C.paper : C.purple);
        }
        p.end();
        for (const [id, view] of this.people) {
            const pen = view.held, d = g.players.get(id).drag; pen.begin();
            if (d?.moved && g.phase === 'choosing') {
                const x = Math.max(12, Math.min(88, d.x)), y = Math.max(8, d.y - 6);
                pen.disk(x, y + 3, 7, 1.5, [27, 35, 32, 35]); foodIcon(pen, g.course.deck[d.index], x, y, 1.8);
                pen.text(d.startY - d.y >= 7 ? 'LET GO. GULP.' : 'A LITTLE HIGHER', x, y - 7, 2.8, C.ink, 'center');
            }
            pen.end();
        }
    }
}
module.exports = { View, cardAt, cardRect };
