const { Game, GameNode, Shapes } = require('squish-150');
const { ScoopAudio } = require('./audio');

const C = {
    cream: [255, 247, 218, 255], ink: [79, 55, 88, 255], lilac: [221, 205, 241, 255],
    purple: [127, 88, 155, 255], pink: [240, 142, 167, 255], rose: [202, 72, 114, 255],
    mint: [158, 217, 197, 255], teal: [57, 134, 124, 255], white: [255, 253, 242, 255],
    gold: [247, 197, 91, 255], cone: [224, 169, 97, 255], waffle: [189, 132, 75, 255],
};
const FLAVORS = [
    { name: 'vanilla', color: [255, 231, 167, 255], shade: [234, 199, 128, 255], bits: [165, 113, 69, 255] },
    { name: 'chocolate', color: [148, 92, 69, 255], shade: [118, 68, 57, 255], bits: [84, 49, 46, 255] },
    { name: 'strawberry', color: [246, 155, 176, 255], shade: [224, 117, 144, 255], bits: [196, 68, 106, 255] },
    { name: 'mint chip', color: [160, 222, 192, 255], shade: [119, 191, 161, 255], bits: [99, 61, 55, 255] },
    { name: 'blueberry', color: [180, 171, 232, 255], shade: [151, 138, 205, 255], bits: [96, 80, 157, 255] },
    { name: 'mango', color: [255, 190, 79, 255], shade: [234, 157, 54, 255], bits: [231, 131, 52, 255] },
];
const HIDDEN = [[0, 0], [0, 0], [0, 0]], TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = v => { const p = clamp(v); return p * p * (3 - 2 * p); };
const mix = (a, b, p) => a + (b - a) * p;
const oval = (x, y, rx, ry = rx, n = 24) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos(i * TAU / n) * rx, y + Math.sin(i * TAU / n) * ry]);
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
const line = (x1, y1, x2, y2, w) => {
    const a = Math.atan2(y2 - y1, x2 - x1), x = Math.sin(a) * w / 2, y = Math.cos(a) * w / 2;
    return [[x1 - x, y1 + y], [x2 - x, y2 + y], [x2 + x, y2 - y], [x1 + x, y1 - y], [x1 - x, y1 + y]];
};
const heart = (x, y, s) => Array.from({ length: 33 }, (_, i) => {
    const t = i * TAU / 32;
    return [x + Math.sin(t) ** 3 * s, y - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s / 16];
});
const ring = (x, y, rx, ry, width) => [...oval(x, y, rx, ry, 32), ...oval(x, y, rx - width, ry - width, 32).reverse()];

class LittleScoopShop extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Little Scoop Shop',
            author: "Joseph Garcia",
            createdBy: "Joseph Garcia",
            description: 'Mix colorful ice cream scoops in a cone or cup, add toppings, and share a sweet treat with a bunny friend.',
            aspectRatio: { x: 3, y: 2 },
            tickRate: 30,
            maxPlayers: 1,
            assets: {},
            gameId: "5b00dc2e-6dbc-5bae-a040-f99e5bfe61a4"
        };
    }
    constructor({ addAsset } = {}) {
        super(); this.addAsset = addAsset; this.players = new Map(); this.sound = true; this.time = 0;
        this.phase = 'ready'; this.phaseStarted = 0; this.container = 'cone'; this.scoops = [];
        this.sprinkles = false; this.cherry = false; this.served = 0; this.matched = false; this.favoritesServed = 0;
        this.base = this.shape(rect(0, 0, 150, 100), C.cream);
        this.room = this.group(this.base); this.controls = this.group(this.base); this.friendLayer = this.group(this.base);
        this.orderLayer = this.group(this.base); this.treatLayer = this.group(this.base); this.effects = this.group(this.base); this.hud = this.group(this.base); this.audioRoot = this.group(this.base);
        this.audio = new ScoopAudio(this.audioRoot);
        this.buildRoom(); this.buildControls(); this.buildFriend(); this.buildTreat(); this.buildOrder();
        this.instruction = this.text(this.hud, '', 76, 14.2, 3.3);
        this.soundLabel = this.text(this.hud, 'sound on', 13, 5.1, 2.1, C.teal);
        this.friendLabel = this.text(this.hud, 'hello, friend!', 124, 20, 2.5, C.purple);
        this.particles = Array.from({ length: 20 }, (_, i) => ({ index: i, node: this.put(this.effects, this.shape(HIDDEN, i % 2 ? C.pink : C.gold)) }));
        this.friendRing = this.put(this.effects, this.shape(HIDDEN, C.gold));
        this.draw();
        const touch = this.put(this.base, this.shape(rect(0, 0, 150, 100), null, { onClick: (id, x, y) => this.pointerDown(id, x, y) }));
        touch.node.offClick = id => { const player = this.players.get(id); if (player) player.pointer = false; };
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    shape(points, fill, options = {}) {
        return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: this.project(points), ...(fill ? { fill } : {}), ...options });
    }
    project(points) { return points.map(([x, y]) => [clamp(x / 1.5, 0, 100), clamp(y, 0, 100)]); }
    coords(node, points) { node.node.coordinates2d = this.project(points); }
    put(parent, child) { parent.addChild(child, false); return child; }
    group(parent) { return this.put(parent, this.shape(HIDDEN)); }
    text(parent, text, x, y, size, color = C.ink) {
        return this.put(parent, new GameNode.Text({ textInfo: { text, x: x / 1.5, y, size: size / (1.5 * Math.SQRT2), color, align: 'center', font: 'Trebuchet MS, sans-serif' } }));
    }
    setText(node, text) { if (node.node.text.text !== text) node.node.text = { ...node.node.text, text }; }
    disk(parent, x, y, rx, ry, fill) { return this.put(parent, this.shape(oval(x, y, rx, ry), fill)); }
    object(parent) { return { root: this.group(parent), parts: [] }; }
    part(object, points, fill) { const part = { points, node: this.put(object.root, this.shape(points, fill)) }; object.parts.push(part); return part; }
    place(object, x, y, scale = 1, angle = 0) {
        const ca = Math.cos(angle), sa = Math.sin(angle);
        for (const part of object.parts) this.coords(part.node, part.points.map(([px, py]) => [x + (px * ca - py * sa) * scale, y + (px * sa + py * ca) * scale]));
    }
    hide(object) { for (const part of object.parts) this.coords(part.node, HIDDEN); }
    pill(parent, x, y, w, h, fill) {
        const object = this.object(parent);
        this.part(object, rect(-w / 2 + h / 2, -h / 2, w - h, h), fill);
        this.part(object, oval(-w / 2 + h / 2, 0, h / 2), fill); this.part(object, oval(w / 2 - h / 2, 0, h / 2), fill);
        this.place(object, x, y); return object;
    }
    buildRoom() {
        for (let i = 0; i < 10; i++) {
            const fill = i % 2 ? C.mint : C.white;
            this.put(this.room, this.shape(rect(i * 15, 0, 15, 9), fill));
            this.disk(this.room, i * 15 + 7.5, 9, 7.5, 3, fill);
        }
        this.pill(this.room, 75, 6.3, 71, 9, C.cream);

        this.pill(this.room, 13, 6.6, 22, 7, C.white);
        this.put(this.room, this.shape(rect(0, 76, 150, 24), C.lilac));
        this.put(this.room, this.shape(rect(0, 75, 150, 2), C.purple));
        this.disk(this.room, 74, 73.1, 17.5, 2.1, [216, 194, 193, 255]);
        // A tiny wall print anchors the parlor without adding extra controls.
        this.pill(this.room, 78, 46, 45, 45, [255, 241, 210, 255]);
    }
    makeVessel(parent, type) {
        const object = this.object(parent);
        if (type === 'cone') {
            this.part(object, [[-9, -6], [9, -6], [0, 15], [-9, -6]], C.waffle);
            this.part(object, [[-8, -6], [8, -6], [0, 13], [-8, -6]], C.cone);
            for (let i = 0; i < 4; i++) {
                const y = -4 + i * 3.5, w = (13 - y) / 19 * 8;
                this.part(object, line(-w, y, w * .56, y + 3.6, .48), C.waffle);
                this.part(object, line(w, y, -w * .56, y + 3.6, .48), C.waffle);
            }
            this.part(object, oval(0, -6, 9, 1.9), C.cone);
        } else {
            this.part(object, [[-10, -6], [10, -6], [7.4, 9], [-7.4, 9], [-10, -6]], C.pink);
            this.part(object, [[-8.8, -5], [8.8, -5], [6.7, 8], [-6.7, 8], [-8.8, -5]], C.white);
            this.part(object, [[-8.2, -1.5], [8.2, -1.5], [7, 5.7], [-7, 5.7], [-8.2, -1.5]], C.pink);
            this.part(object, heart(0, 2, 2.2), C.white);
            this.part(object, oval(0, -6, 10.4, 2), C.pink);
            this.part(object, oval(0, -6.2, 8.7, 1.2), [242, 219, 211, 255]);
        }
        return object;
    }
    makeScoop(parent, flavor) {
        const object = this.object(parent), f = FLAVORS[flavor];
        this.part(object, oval(0, 1.2, 10.3, 7.9), f.shade);
        this.part(object, oval(0, -.2, 9.9, 8.3), f.color);
        for (let i = 0; i < 5; i++) this.part(object, oval(-7.5 + i * 3.75, 5.7, 3, 2), f.color);
        this.part(object, oval(-3.7, -3.9, 3.2, 1.2), f.color.map((v, i) => i === 3 ? 255 : Math.round(v + (255 - v) * .27)));
        for (let i = 0; i < (flavor === 0 ? 3 : 5); i++) {
            const x = [-4.6, 3.8, -.5, 5.5, -5.4][i], y = [-1.7, .4, -5.1, -3.2, 2.4][i];
            this.part(object, flavor === 3 || flavor === 1 ? rect(x, y, 1.1, .85) : oval(x, y, flavor === 0 ? .25 : .53, flavor === 2 ? .8 : .5), f.bits);
        }
        return object;
    }
    buildControls() {
        this.coneChoice = this.pill(this.controls, 20, 34, 29, 24, C.mint);
        this.cupChoice = this.pill(this.controls, 20, 62, 29, 24, C.white);
        const cone = this.makeVessel(this.controls, 'cone'); this.place(cone, 20, 30.5, .64);
        const cup = this.makeVessel(this.controls, 'cup'); this.place(cup, 20, 60, .73);
        this.text(this.controls, 'cone', 20, 41.2, 2.5); this.text(this.controls, 'cup', 20, 69.4, 2.5);
        this.flavorTargets = FLAVORS.map((flavor, i) => {
            const x = 13.5 + i * 24.6;
            this.pill(this.controls, x, 88.7, 22, 18.3, C.white);
            const scoop = this.makeScoop(this.controls, i); this.place(scoop, x, 87.2, .6);
            this.text(this.controls, flavor.name, x, 93.8, 2.12, C.ink);
            return { x: x / 1.5, y: 88.7, radiusX: 11.6 / 1.5, radiusY: 9.8 };
        });
        this.sprinkleButton = this.pill(this.controls, 111, 67, 21, 13, C.white);
        this.cherryButton = this.pill(this.controls, 137, 67, 21, 13, C.white);
        for (let i = 0; i < 8; i++) {
            const x = 106 + (i % 4) * 3.1, y = 63 + Math.floor(i / 4) * 3;
            this.put(this.controls, this.shape(line(x, y, x + 1.2, y + (i % 2 ? .8 : -.6), .6), [C.pink, C.gold, C.teal, C.purple][i % 4]));
        }
        this.text(this.controls, 'sprinkles', 111, 70, 1.8); this.text(this.controls, 'cherry', 137, 70, 1.8);
        this.put(this.controls, this.shape(line(136.8, 64.8, 138.6, 60.8, .7), C.teal)); this.disk(this.controls, 137, 65.8, 2.3, 2.1, C.rose);
    }
    buildFriend() {
        this.friend = this.object(this.friendLayer);
        const p = (points, color) => this.part(this.friend, points, color);
        p(oval(-6, -13.5, 3.5, 9), C.white); p(oval(6, -13.5, 3.5, 9), C.white);
        p(oval(-6, -14.2, 1.45, 6.6), C.pink); p(oval(6, -14.2, 1.45, 6.6), C.pink);
        this.shirtPart = p(oval(0, 13.5, 11, 10), C.mint);
        p(heart(0, 14, 3.2), C.white); p(oval(0, 0, 11.4, 10.2), C.white);
        p(oval(-8, 3.8, 2.4, 1.5), [250, 201, 199, 255]); p(oval(8, 3.8, 2.4, 1.5), [250, 201, 199, 255]);
        p(oval(-4.2, -.5, .8, 1.25), C.ink); p(oval(4.2, -.5, .8, 1.25), C.ink);
        p([[-1.5, 2.1], [1.5, 2.1], [0, 3.8], [-1.5, 2.1]], C.rose);
        p(line(0, 3.6, -1.5, 5, .5), C.ink); p(line(0, 3.6, 1.5, 5, .5), C.ink);
        p(oval(-10, 12, 3.4, 2.7), C.white); p(oval(10, 12, 3.4, 2.7), C.white);
    }
    buildTreat() {
        this.cone = this.makeVessel(this.treatLayer, 'cone'); this.cup = this.makeVessel(this.treatLayer, 'cup');
        this.scoopLayer = this.group(this.treatLayer); this.toppingLayer = this.group(this.treatLayer);
        this.scoopObjects = [];
        this.sprinkleParts = Array.from({ length: 24 }, (_, i) => this.put(this.toppingLayer, this.shape(HIDDEN, [C.gold, C.rose, C.teal, C.purple, C.white][i % 5])));
        this.cherryObject = this.object(this.toppingLayer);
        this.part(this.cherryObject, line(0, -1, 2.2, -5.5, .65), C.teal);
        this.part(this.cherryObject, oval(0, .5, 2.3, 2.3), C.rose);
        this.part(this.cherryObject, oval(-.8, -.4, .55, .6), C.pink);
    }
    rebuildScoops() {
        this.scoopLayer.node.children = []; this.scoopObjects = this.scoops.map(index => this.makeScoop(this.scoopLayer, index));
    }
    buildOrder() {
        this.put(this.orderLayer, this.shape([[89.5, 20], [104.5, 20], [108.5, 24], [108.5, 46], [104.5, 50], [89.5, 50], [85.5, 46], [85.5, 24], [89.5, 20]], C.white));
        this.put(this.orderLayer, this.shape([[108, 36], [114, 39], [108, 41], [108, 36]], C.white));
        this.text(this.orderLayer, 'my wish', 97, 22, 1.9, C.purple);
        this.orderPicture = this.group(this.orderLayer);
        this.nextOrder();
    }
    nextOrder() {
        // Short wishes introduce matching, then alternate more interesting mixtures.
        const n = this.served, count = n < 2 ? 1 : 2 + Math.floor(n / 4) % 2;
        this.order = { container: n % 2 ? 'cup' : 'cone',
            scoops: Array.from({ length: count }, (_, i) => (n * 5 + i * 2 + 2) % FLAVORS.length),
            sprinkles: n % 4 === 2, cherry: n % 4 === 3 };
        this.orderPicture.node.children = [];
        this.place(this.makeVessel(this.orderPicture, this.order.container), 97, 43, .4);
        this.order.scoops.forEach((flavor, i) => this.place(this.makeScoop(this.orderPicture, flavor), 97, 39 - i * 3.6, .4));
        const top = 39 - (count - 1) * 3.6;
        if (this.order.cherry) {
            this.put(this.orderPicture, this.shape(line(97, top - 3.7, 98, top - 6, .35), C.teal));
            this.disk(this.orderPicture, 97, top - 3.5, 1.15, 1.15, C.rose);
        }
        if (this.order.sprinkles) for (let i = 0; i < 7; i++) {
            const x = 94.2 + i % 4 * 1.7, y = top - 1.6 + Math.floor(i / 4) * 2;
            this.put(this.orderPicture, this.shape(line(x, y, x + .7, y + .4, .4), [C.gold, C.rose, C.teal][i % 3]));
        }
    }
    matchesOrder() {
        // Scoop order is deliberately forgiving: the pictured flavors and amount matter.
        return this.container === this.order.container && this.sprinkles === this.order.sprinkles && this.cherry === this.order.cherry &&
            this.scoops.slice().sort().join(',') === this.order.scoops.slice().sort().join(',');
    }
    play(name) { if (this.sound) this.audio.play(name); }
    tap(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return;
        const wx = x * 1.5;
        if (wx <= 26 && y <= 12) {
            this.sound = !this.sound; if (this.sound) this.audio.play('choose'); else this.audio.mute();
            this.setText(this.soundLabel, this.sound ? 'sound on' : 'sound off'); this.base.node.onStateChange(); return;
        }
        if (this.phase !== 'ready') return;
        if (wx >= 4 && wx <= 36 && y >= 21 && y <= 75) {
            const next = y < 48 ? 'cone' : 'cup';
            if (next !== this.container) { this.container = next; this.play('choose'); }
        } else if (y >= 79 && y <= 99) {
            const index = this.flavorTargets.findIndex(t => Math.abs(x - t.x) <= t.radiusX);
            if (index < 0) return;
            if (this.scoops.length === 3) this.scoops[2] = index; else this.scoops.push(index);
            this.rebuildScoops(); this.phase = 'scooping'; this.phaseStarted = this.time; this.play('scoop');
        } else if (wx >= 99 && wx <= 149 && y >= 59 && y <= 75 && this.scoops.length) {
            if (wx < 124) { this.sprinkles = !this.sprinkles; this.play('sprinkle'); }
            else { this.cherry = !this.cherry; this.play('cherry'); }
            this.phase = 'topping'; this.phaseStarted = this.time;
        } else if (wx >= 104 && wx <= 146 && y >= 19 && y < 59 && this.scoops.length) {
            this.matched = this.matchesOrder(); this.phase = 'serving'; this.phaseStarted = this.time; this.play('choose');
        }
        this.draw(); this.base.node.onStateChange();
    }
    draw() {
        const elapsed = this.time - this.phaseStarted, celebrating = this.phase === 'celebrate';
        const moving = this.phase === 'serving' || celebrating;
        const progress = celebrating ? 1 : this.phase === 'serving' ? ease(elapsed / .85) : 0;
        const x = mix(73, 124, progress), y = mix(this.container === 'cone' ? 60 : 65, 51, progress), scale = mix(1, .58, progress);
        this.place(this.friend, 124, 41 - (celebrating ? Math.abs(Math.sin(elapsed * 6)) * (this.matched ? 4 : 1.7) : Math.sin(this.time * 1.8) * .12), .75, celebrating ? Math.sin(elapsed * 6) * (this.matched ? .1 : .04) : 0);
        this.place(this.container === 'cone' ? this.cone : this.cup, x, y, scale);
        this.hide(this.container === 'cone' ? this.cup : this.cone);
        for (let i = 0; i < this.scoopObjects.length; i++) {
            let sy = y - (10 + i * 9) * scale, sx = x;
            let size = scale * (1 - i * .035);
            if (this.phase === 'scooping' && i === this.scoops.length - 1) {
                const p = clamp(elapsed / .55); sy -= Math.sin((1 - p) * Math.PI / 2) * 15;
                size *= .88 + .12 * ease(p); sx += Math.sin(p * Math.PI) * 3;
            }
            this.place(this.scoopObjects[i], sx, sy, size);
        }
        const topY = y - (10 + (this.scoops.length - 1) * 9) * scale;
        const toppingP = this.phase === 'topping' ? ease(elapsed / .5) : 1;
        for (let i = 0; i < this.sprinkleParts.length; i++) {
            if (!this.sprinkles || !this.scoops.length) { this.coords(this.sprinkleParts[i], HIDDEN); continue; }
            const level = i % this.scoops.length, a = i * 2.39996;
            const px = x + Math.cos(a) * (3 + i % 4) * scale, py = y - (10 + level * 9) * scale + Math.sin(a) * 4 * scale - (1 - toppingP) * (9 + i % 5);
            this.coords(this.sprinkleParts[i], line(px, py, px + .9 * scale, py + (i % 2 ? .6 : -.6) * scale, .65 * scale));
        }
        if (this.cherry && this.scoops.length) this.place(this.cherryObject, x, topY - 8 * scale - (1 - toppingP) * 11, scale);
        else this.hide(this.cherryObject);
        for (const [choice, selected] of [[this.coneChoice, this.container === 'cone'], [this.cupChoice, this.container === 'cup'], [this.sprinkleButton, this.sprinkles], [this.cherryButton, this.cherry]]) {
            choice.parts.forEach(part => { part.node.node.fill = selected ? C.mint : C.white; });
        }
        const readyToServe = this.phase === 'ready' && this.scoops.length;
        this.coords(this.friendRing, readyToServe ? ring(124, 41, 15.3 + Math.sin(this.time * 3) * .4, 18, .7) : HIDDEN);
        this.setText(this.instruction, celebrating ? this.matched ? 'My favorite! Hooray!' : 'Yum! Thank you!' : this.phase === 'serving' ? 'A treat for our friend!' : this.scoops.length === 3 ? 'Add toppings or share!' : this.scoops.length ? 'Another scoop? A little topping?' : 'Make the picture, or your own!');
        this.setText(this.friendLabel, celebrating ? this.matched ? 'my favorite!' : 'so yummy!' : this.scoops.length ? 'tap to share!' : 'hello, friend!');
        for (const p of this.particles) {
            if (!celebrating || !this.matched && p.index >= 8) { this.coords(p.node, HIDDEN); continue; }
            const age = elapsed + p.index * .04, cycle = age % 1.5, a = p.index * 2.39996;
            const px = 124 + Math.cos(a) * (5 + cycle * 9), py = 39 - cycle * 14 + Math.sin(a) * 6;
            this.coords(p.node, heart(clamp(px, 1, 149), clamp(py, 14, 72), Math.sin(cycle / 1.5 * Math.PI) * 1.5));
        }
    }
    handleNewPlayer({ playerId }) {
        this.players.set(playerId, { pointer: false });
        if (!this.assetsRegistered && typeof this.addAsset === 'function') {
            this.assetsRegistered = true;
            for (const [key, asset] of Object.entries(this.audio.assets)) {
                try { this.addAsset(key, asset)?.catch(() => {}); } catch (_) { /* The parlor remains playable without audio. */ }
            }
        }
    }
    handlePlayerDisconnect(id) { this.players.delete(id); }
    pointerDown(id, x, y) { const player = this.players.get(id); if (!player || player.pointer) return; player.pointer = true; this.tap(x, y); }
    handleMouseUp(id, position) {
        const player = this.players.get(id); if (!player) return;
        if (!player.pointer && position) this.tap(position.x, position.y); player.pointer = false;
    }
    handleKeyDown() {}
    handleKeyUp() {}
    tick() {
        if (!this.players.size) return;
        this.time += 1 / 30; this.audio.tick(1 / 30);
        const elapsed = this.time - this.phaseStarted;
        if (this.phase === 'scooping' && elapsed >= .55) { this.phase = 'ready'; this.play('plop'); }
        else if (this.phase === 'topping' && elapsed >= .5) this.phase = 'ready';
        else if (this.phase === 'serving' && elapsed >= .85) {
            this.phase = 'celebrate'; this.phaseStarted = this.time; this.served++; if (this.matched) this.favoritesServed++; this.play('serve');
        } else if (this.phase === 'celebrate' && elapsed >= 2) {
            this.phase = 'ready'; this.scoops = []; this.sprinkles = false; this.cherry = false; this.rebuildScoops();
            this.shirtPart.node.node.fill = [C.mint, C.pink, C.lilac, C.gold][this.served % 4];
            this.nextOrder();
        }
        this.draw(); this.base.node.onStateChange();
    }
    close() { this.audio.close(); this.players.clear(); super.close(); }
}
LittleScoopShop.FLAVORS = FLAVORS;
module.exports = LittleScoopShop;
