const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { RainbowAudio } = require('./audio');

const PALETTE = [
    { name: 'Red', color: [244, 112, 119, 255] },
    { name: 'Orange', color: [251, 167, 91, 255] },
    { name: 'Yellow', color: [249, 208, 83, 255] },
    { name: 'Green', color: [111, 193, 147, 255] },
    { name: 'Blue', color: [114, 184, 228, 255] },
    { name: 'Purple', color: [180, 146, 217, 255] },
];
const C = {
    sky: [255, 245, 228, 255], white: [255, 253, 244, 255], ink: [85, 66, 90, 255],
    muted: [139, 116, 127, 255], grass: [212, 234, 179, 255], hill: [229, 239, 200, 255],
    green: [141, 182, 124, 255], pink: [247, 185, 182, 255], shadow: [189, 213, 157, 255],
};
const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const TAU = Math.PI * 2;
const closed = points => [...points, points[0]];
const tint = (color, amount) => color.map((v, i) => i === 3 ? 255 : Math.round(v + (255 - v) * amount));
const oval = (x, y, rx, ry = rx, n = 32) => Array.from({ length: n + 1 }, (_, i) => [
    x + Math.cos(i * TAU / n) * rx, y + Math.sin(i * TAU / n) * ry,
]);
const star = (x, y, r, turn = 0) => closed(Array.from({ length: 10 }, (_, i) => {
    const a = turn - Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? r * .48 : r;
    return [x + Math.cos(a) * radius, y + Math.sin(a) * radius];
}));
const band = (x, y, r, width) => {
    const outer = Array.from({ length: 41 }, (_, i) => [x + Math.cos(Math.PI + i * Math.PI / 40) * r, y + Math.sin(Math.PI + i * Math.PI / 40) * r]);
    const inner = Array.from({ length: 41 }, (_, i) => [x + Math.cos(TAU - i * Math.PI / 40) * (r - width), y + Math.sin(TAU - i * Math.PI / 40) * (r - width)]);
    return closed([...outer, ...inner]);
};
const stroke = (points, width) => {
    const top = [], bottom = [];
    points.forEach(([x, y], i) => {
        const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        top.push([x - Math.sin(angle) * width / 2, y + Math.cos(angle) * width / 2]);
        bottom.unshift([x + Math.sin(angle) * width / 2, y - Math.cos(angle) * width / 2]);
    });
    return closed([...top, ...bottom]);
};

class RainbowPop extends Game {
    static metadata() {
        return {
            isTest: true, // Showcase review: docs/game-curation.json.

            thumbnail: './assets/thumbnail.png',
            name: 'Rainbow Pop', squishVersion: '150', author: "Joseph Garcia", createdBy: "Joseph Garcia",
            description: 'Find Bunny’s favorite colors among gently drifting balloons, pop a rainbow, and discover a new arrangement each round.',
            aspectRatio: { x: 1, y: 1 }, tickRate: 30, maxPlayers: 1, services: [], assets: {},
            gamepadBindings: { ' ': ['FACE_1', 'FACE_2', 'FACE_3', 'FACE_4'] },
        };
    }

    constructor({ addAsset } = {}) {
        super();
        this.addAsset = addAsset;
        this.players = new Map(); this.time = 0; this.round = 0; this.phase = 'play';
        this.sound = true; this.cheerUntil = 0; this.messageUntil = 0; this.celebrateUntil = 0;
        this.matches = 0; this.matchUntil = 0; this.wishIndex = 2;
        this.base = this.shape(ShapeUtils.rectangle(0, 0, 100, 100), C.sky);
        this.scenery = this.group(this.base); this.rainbow = this.group(this.base);
        this.balloonLayer = this.group(this.base); this.bunnyLayer = this.group(this.base);
        this.effects = this.group(this.base); this.hud = this.group(this.base); this.audioRoot = this.group(this.base);
        this.audio = new RainbowAudio(this.audioRoot);
        this.buildGarden(); this.buildBunny(); this.buildHud();
        this.particles = Array.from({ length: 64 }, () => ({ life: 0, node: this.put(this.effects, this.shape(HIDDEN, C.white)) }));
        this.newRound();
        // Squish hits the topmost polygon, including non-interactive artwork.
        // One transparent surface keeps eyes, highlights and text tappable too.
        const touch = this.put(this.base, this.shape(ShapeUtils.rectangle(0, 0, 100, 100), null, {
            onClick: (id, x, y) => this.pointerDown(id, x, y),
        }));
        // The shared dispatcher supports release hooks; Squish 1.5.0's older
        // constructor does not forward this option, so attach it to the node.
        touch.node.offClick = id => { const player = this.players.get(id); if (player) player.pointer = false; };
    }

    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    shape(points, fill, options = {}) {
        return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: points, ...(fill ? { fill } : {}), ...options });
    }
    put(parent, node) { parent.addChild(node, false); return node; }
    group(parent) { return this.put(parent, this.shape(HIDDEN)); }
    disk(parent, x, y, rx, ry, color) {
        const points = oval(x, y, rx, ry).map(([px, py]) => [Math.max(0, Math.min(100, px)), Math.max(0, Math.min(100, py))]);
        return this.put(parent, this.shape(points, color));
    }
    text(parent, value, x, y, size, color = C.ink, align = 'center') {
        return this.put(parent, new GameNode.Text({ textInfo: {
            text: value, x, y, size: size / Math.SQRT2, color, align, font: 'Trebuchet MS, sans-serif',
        } }));
    }
    setText(node, value, color = C.ink) { node.node.text = { ...node.node.text, text: value, color }; }
    dirty() { this.base.node.onStateChange(); }
    cloud(parent, x, y, size) {
        this.disk(parent, x, y, size * 1.8, size * .58, C.white);
        this.disk(parent, x - size * .65, y - size * .45, size * .85, size * .85, C.white);
        this.disk(parent, x + size * .45, y - size * .65, size, size, C.white);
    }
    flower(x, y, size, color) {
        this.put(this.scenery, this.shape(stroke([[x, y], [x, y + size * 2]], .25), C.green));
        this.disk(this.scenery, x + size * .55, y + size * 1.2, size * .6, size * .25, C.green);
        for (let i = 0; i < 5; i++) {
            const a = i * TAU / 5;
            this.disk(this.scenery, x + Math.cos(a) * size * .65, y + Math.sin(a) * size * .65, size * .55, size * .55, color);
        }
        this.disk(this.scenery, x, y, size * .38, size * .38, C.white);
    }
    buildGarden() {
        this.cloud(this.scenery, 5, 32, 4); this.cloud(this.scenery, 96, 52, 4.5);
        this.cloud(this.scenery, 70, 26, 2.2);
        for (let i = 0; i < 10; i++) {
            const a = i * TAU / 10;
            this.put(this.scenery, this.shape(stroke([[89 + Math.cos(a) * 4.9, 23 + Math.sin(a) * 4.9], [89 + Math.cos(a) * 5.8, 23 + Math.sin(a) * 5.8]], .5), PALETTE[2].color));
        }
        this.disk(this.scenery, 89, 23, 3.8, 3.8, PALETTE[2].color);
        this.disk(this.scenery, 88, 22.8, .25, .38, C.ink); this.disk(this.scenery, 90, 22.8, .25, .38, C.ink);
        this.put(this.scenery, this.shape(stroke([[88.4, 24], [89, 24.3], [89.6, 24]], .25), C.ink));
        this.put(this.scenery, this.shape(closed([[0, 83], [12, 78], [25, 79], [44, 88], [69, 78], [82, 77], [100, 82], [100, 100], [0, 100]]), C.hill));
        this.put(this.scenery, this.shape(closed([[0, 90], [15, 86], [35, 87], [54, 91], [78, 86], [100, 88], [100, 100], [0, 100]]), C.grass));
        [[8, 86, 1.4, 0], [18, 94, 1.1, 2], [30, 89, 1, 5], [74, 93, 1.2, 0], [89, 87, 1.6, 5], [96, 96, 1, 2]].forEach(([x, y, s, c]) => this.flower(x, y, s, PALETTE[c].color));
        this.disk(this.scenery, 50, 96, 9, 1.4, C.shadow);
    }
    buildHud() {

        this.message = this.text(this.hud, 'Find Bunny’s color', 50, 16.5, 2.25);
        this.progress = PALETTE.map((p, i) => this.disk(this.hud, 39 + i * 4.4, 23.3, 1.35, 1.35, tint(p.color, .78)));
        this.disk(this.hud, 91, 8.3, 6, 3.1, C.white);
        this.soundLabel = this.text(this.hud, 'sound on', 91, 7.35, 1.5, C.muted);
        this.disk(this.hud, 73, 85, 9, 7, C.white); this.disk(this.hud, 63, 89, 2, 1.6, C.white);
        this.wishBalloon = this.disk(this.hud, 73, 83, 3.3, 3.7, PALETTE[2].color);
        this.wishString = this.put(this.hud, this.shape(stroke([[73, 86], [72.3, 88], [73, 90]], .25), C.muted));
        this.matchBadge = this.text(this.hud, '', 73, 82, 3.8, PALETTE[2].color);

    }

    // Parts retain their local coordinates so animation never allocates new nodes.
    part(object, points, color) {
        const node = this.put(object.root, this.shape(points, color));
        object.parts.push({ points, node }); return node;
    }
    place(object, x, y, scale = 1, angle = 0) {
        const ca = Math.cos(angle), sa = Math.sin(angle);
        for (const part of object.parts) part.node.node.coordinates2d = part.points.map(([px, py]) => [
            x + (px * ca - py * sa) * scale, y + (px * sa + py * ca) * scale,
        ]);
    }
    makeBalloon(index) {
        const slot = this.round ? (index * 5 + this.round) % 6 : index;
        const p = PALETTE[index], b = { index, x: 21 + slot % 3 * 29, y: slot < 3 ? 39 : 65,
            popped: false, root: this.group(this.balloonLayer), parts: [] };
        this.part(b, stroke([[0, 9.7], [-.9, 12.1], [.7, 14.1], [0, 16]], .26), [203, 186, 178, 255]);
        this.part(b, oval(.45, .8, 9.45, 10.55), tint(p.color, .48));
        this.part(b, oval(0, 0, 9.3, 10.4), p.color);
        this.part(b, closed([[-1.2, 11], [0, 9.1], [1.2, 11]]), p.color);
        this.part(b, oval(-3.9, -5.1, 1.65, 2.8, 20), tint(p.color, .68));
        this.part(b, oval(-5.4, -1.1, .65, .9, 16), tint(p.color, .55));
        this.part(b, oval(-3.6, 3, 1.2, .65), tint(p.color, .4));
        this.part(b, oval(3.6, 3, 1.2, .65), tint(p.color, .4));
        this.part(b, oval(-2.35, 1.2, .46, .7, 16), C.ink);
        this.part(b, oval(2.35, 1.2, .46, .7, 16), C.ink);
        this.part(b, stroke([[-1.2, 3.1], [-.6, 3.6], [0, 3.75], [.6, 3.6], [1.2, 3.1]], .32), C.ink);
        this.place(b, b.x, b.y); return b;
    }
    buildBunny() {
        const b = this.bunny = { root: this.group(this.bunnyLayer), parts: [] };
        const cream = [255, 250, 237, 255], edge = [236, 222, 203, 255];
        this.part(b, oval(-3.15, -10.9, 1.8, 5.6), edge);
        this.part(b, oval(3.15, -10.9, 1.8, 5.6), edge);
        this.part(b, oval(-3.15, -11.1, 1.4, 5), cream);
        this.part(b, oval(3.15, -11.1, 1.4, 5), cream);
        this.part(b, oval(-3.15, -11.1, .65, 3.5), C.pink);
        this.part(b, oval(3.15, -11.1, .65, 3.5), C.pink);
        this.part(b, oval(0, 0, 5.7, 5.5), cream);
        this.part(b, oval(-4.5, 4, 2.7, 1.6), cream); this.part(b, oval(4.5, 4, 2.7, 1.6), cream);
        this.part(b, oval(0, -5.2, 6.4, 5.4), cream);
        this.part(b, oval(-4, -3.9, 1.4, .75), C.pink); this.part(b, oval(4, -3.9, 1.4, .75), C.pink);
        this.part(b, oval(-2.15, -5.3, .43, .65), C.ink); this.part(b, oval(2.15, -5.3, .43, .65), C.ink);
        this.part(b, closed([[-.65, -3.9], [.65, -3.9], [0, -3.3]]), C.pink);
        this.part(b, stroke([[-1.2, -2.9], [-.6, -2.55], [0, -3], [.6, -2.55], [1.2, -2.9]], .22), C.ink);
        this.part(b, closed([[-2.6, -.9], [0, .1], [-2.6, 1.5]]), PALETTE[4].color);
        this.part(b, closed([[2.6, -.9], [0, .1], [2.6, 1.5]]), PALETTE[4].color);
        this.part(b, oval(0, .2, .6, .6), tint(PALETTE[4].color, .3));
        this.place(b, 50, 91);
    }
    newRound() {
        this.phase = 'play'; this.collected = 0; this.celebrateUntil = 0; this.matches = 0;
        this.rainbow.clearChildren(); this.balloonLayer.clearChildren();
        this.balloons = PALETTE.map((_, i) => this.makeBalloon(i));
        this.progress.forEach((n, i) => { n.node.fill = tint(PALETTE[i].color, .78); });
        this.chooseWish(); this.setText(this.message, 'Find Bunny’s color'); this.messageUntil = 0; this.dirty();
    }
    chooseWish() {
        const offset = (this.round * 3 + this.collected * 2 + 2) % 6;
        const next = Array.from({ length: 6 }, (_, i) => (i + offset) % 6).find(i => !this.balloons[i].popped);
        this.wishIndex = next ?? -1;
        this.wishBalloon.node.coordinates2d = next === undefined ? HIDDEN : oval(73, 83, 3.3, 3.7);
        this.wishString.node.coordinates2d = next === undefined ? HIDDEN : stroke([[73, 86], [72.3, 88], [73, 90]], .25);
        if (next !== undefined) this.wishBalloon.node.fill = PALETTE[next].color;
        this.setText(this.matchBadge, next === undefined ? '♥' : '', PALETTE[0].color);
    }
    burst(x, y, color, count = 10, big = false) {
        for (const p of this.particles) {
            if (count <= 0) break;
            if (p.life > 0) continue;
            const a = Math.random() * TAU, speed = (big ? 12 : 6) + Math.random() * 7;
            p.x = x; p.y = y; p.vx = Math.cos(a) * speed; p.vy = Math.sin(a) * speed - 5;
            p.life = 1.1 + Math.random() * .5; p.total = p.life; p.turn = a;
            p.size = .55 + Math.random() * .6; p.node.node.fill = color || PALETTE[count % 6].color;
            count--;
        }
    }
    pop(index) {
        const b = this.balloons[index];
        if (this.phase !== 'play' || !b || b.popped) return;
        const matched = index === this.wishIndex;
        b.popped = true; this.collected++;
        this.balloonLayer.removeChild(b.root.id);
        this.progress[index].node.fill = PALETTE[index].color;
        this.burst(b.drawX ?? b.x, b.drawY ?? b.y, PALETTE[index].color, 12);
        this.cheerUntil = this.time + 1;
        if (matched) { this.matches++; this.matchUntil = this.time + 1.5; this.burst(50, 78, PALETTE[index].color, 12, true); }
        this.setText(this.message, matched ? PALETTE[index].name + '! Bunny’s favorite!' : PALETTE[index].name + '!', C.ink); this.messageUntil = this.time + 1.2;
        if (matched || this.collected === 6) this.chooseWish();
        if (this.sound) this.audio.play(index);
        if (this.collected === PALETTE.length) this.celebrate();
        this.dirty();
    }
    celebrate() {
        this.phase = 'celebrate'; this.round++; this.celebrateUntil = this.time + 4.2;
        this.cheerUntil = this.celebrateUntil; this.messageUntil = 0;
        this.setText(this.message, 'You made a rainbow!');
        PALETTE.forEach((p, i) => this.put(this.rainbow, this.shape(band(50, 72, 33 - i * 3.7, 3.75), p.color)));
        this.cloud(this.rainbow, 20, 72, 5.5); this.cloud(this.rainbow, 80, 72, 5.5);
        this.text(this.rainbow, 'hooray!', 50, 61, 6.2);
        this.burst(29, 45, null, 22, true); this.burst(71, 45, null, 22, true);
        if (this.sound) this.audio.play('celebrate');
    }
    handleNewPlayer({ playerId }) {
        this.players.set(playerId, { pointer: false, keys: new Set() });
        if (!this.assetsRegistered && typeof this.addAsset === 'function') {
            this.assetsRegistered = true;
            for (const [key, asset] of Object.entries(this.audio.assets)) {
                try { this.addAsset(key, asset)?.catch(() => {}); } catch (_) { /* Play remains available without audio. */ }
            }
        }
    }
    handlePlayerDisconnect(id) { this.players.delete(id); }
    pointerDown(id, x, y) {
        const player = this.players.get(id);
        if (!player || player.pointer) return;
        player.pointer = true; this.tap(x, y);
    }
    handleMouseUp(id, position) {
        const player = this.players.get(id); if (!player) return;
        // Hosted runtimes can deliver a quick release before a held click frame.
        if (!player.pointer && position) this.tap(position.x, position.y);
        player.pointer = false;
    }
    tap(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return;
        if (x >= 83 && y <= 13) {
            this.sound = !this.sound;
            if (!this.sound) this.audio.mute();
            else this.audio.play(4);
            this.setText(this.soundLabel, this.sound ? 'sound on' : 'sound off', C.muted); this.dirty(); return;
        }
        const b = this.balloons.find(b => !b.popped && Math.abs(x - (b.drawX ?? b.x)) <= 12 && Math.abs(y - (b.drawY ?? b.y)) <= 12);
        if (b && this.phase === 'play') this.pop(b.index);
        else {
            this.burst(x, y, PALETTE[Math.floor(Math.random() * 6)].color, 5);
            this.cheerUntil = Math.max(this.cheerUntil, this.time + .7); this.dirty();
        }
    }
    handleKeyDown(id, key) {
        const p = this.players.get(id);
        if (!p || typeof key !== 'string' || p.keys.has(key)) return;
        if (!(key === 'Enter' || key.startsWith('Arrow') || key === ' ' || /^[a-z0-9]$/i.test(key))) return;
        p.keys.add(key);
        const b = this.balloons.find(b => !b.popped);
        if (b && this.phase === 'play') this.pop(b.index);
        else this.tap(50, 82);
    }
    handleKeyUp(id, key) { this.players.get(id)?.keys.delete(key); }
    tick() {
        if (!this.players.size) return;
        const dt = 1 / 30; this.time += dt; this.audio.tick(dt);
        if (this.phase === 'celebrate' && this.time >= this.celebrateUntil) this.newRound();
        if (this.messageUntil && this.time >= this.messageUntil) {
            this.messageUntil = 0; this.setText(this.message, this.phase === 'play' ? 'Find Bunny’s color' : 'You made a rainbow!');
        }
        for (const b of this.balloons) {
            if (b.popped) continue;
            b.drawX = b.x + Math.sin(this.time * .65 + b.index * 1.7) * (this.round ? 3 : 1);
            b.drawY = b.y + Math.sin(this.time * 1.1 + b.index * 1.3) * (this.round ? 1.8 : .7);
            this.place(b, b.drawX, b.drawY, 1, Math.sin(this.time * 1.2 + b.index) * .025);
        }
        const happy = this.time < this.cheerUntil;
        const hop = this.time < this.matchUntil ? Math.abs(Math.sin(this.time * 7)) * 4 : happy ? Math.abs(Math.sin(this.time * 6)) * 2 : Math.sin(this.time * 2) * .15;
        this.place(this.bunny, 50, 91 - hop, 1, happy ? Math.sin(this.time * 7) * .07 : 0);
        for (const p of this.particles) {
            if (p.life <= 0) continue;
            p.life -= dt;
            if (p.life <= 0) { p.node.node.coordinates2d = HIDDEN; continue; }
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += dt * 9;
            const size = p.size * Math.min(1, p.life * 3);
            // Keep particle vertices inside the serializable game plane.
            const x = Math.max(size, Math.min(100 - size, p.x)), y = Math.max(size, Math.min(100 - size, p.y));
            p.node.node.coordinates2d = star(x, y, size, p.turn + this.time);
        }
        this.dirty();
    }
    close() { this.audio.close(); this.players.clear(); super.close(); }
}

module.exports = RainbowPop;
