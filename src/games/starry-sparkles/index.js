const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');
const { SparkleAudio } = require('./audio');

const TAU = Math.PI * 2;
const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const PALETTE = [
    [255, 133, 167, 255], [255, 183, 121, 255], [255, 220, 124, 255],
    [135, 230, 196, 255], [132, 201, 255, 255], [200, 163, 255, 255],
];
const C = {
    sky: [39, 34, 72, 255], lowerSky: [48, 40, 80, 255], horizon: [61, 49, 91, 255],
    white: [255, 246, 219, 255], muted: [191, 174, 217, 255], ink: [71, 55, 83, 255],
    backHill: [72, 72, 111, 255], hill: [84, 103, 127, 255], grass: [110, 139, 151, 255],
    pink: [243, 166, 180, 255], cream: [250, 232, 205, 255], shadow: [65, 77, 104, 255],
};
const clamp = value => Math.max(0, Math.min(100, value));
const onPlane = points => points.map(([x, y]) => [clamp(x), clamp(y)]);
const closed = points => [...points, points[0]];
const tint = (color, amount) => color.map((v, i) => i === 3 ? 255 : Math.round(v + (255 - v) * amount));
const oval = (x, y, rx, ry = rx, n = 24) => Array.from({ length: n + 1 }, (_, i) => [
    x + Math.cos(i * TAU / n) * rx, y + Math.sin(i * TAU / n) * ry,
]);
const star = (x, y, r, turn = 0) => closed(Array.from({ length: 10 }, (_, i) => {
    const angle = turn - Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? r * .46 : r;
    return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
}));
const line = (x1, y1, x2, y2, width) => {
    const angle = Math.atan2(y2 - y1, x2 - x1), dx = Math.sin(angle) * width / 2, dy = Math.cos(angle) * width / 2;
    return closed([[x1 - dx, y1 + dy], [x2 - dx, y2 + dy], [x2 + dx, y2 - dy], [x1 + dx, y1 - dy]]);
};
const petal = (x, y, radius, angle) => oval(0, 0, radius, radius * .47, 12).map(([px, py]) => [
    x + px * Math.cos(angle) - py * Math.sin(angle), y + px * Math.sin(angle) + py * Math.cos(angle),
]);

class StarrySparkles extends Game {
    static metadata() {
        return {
            name: 'Starry Sparkles', squishVersion: '142', author: 'Joseph Garcia', createdBy: 'Joseph Garcia',
            description: 'Tap the twilight sky to grow colorful flower, star and heart fireworks. Choose a color and make gentle musical sparkles with Bunny and Bear. Endless play, no scores or time limits.',
            aspectRatio: { x: 1, y: 1 }, tickRate: 30, maxPlayers: 1, services: [], assets: {},
            gamepadBindings: { ' ': ['FACE_1', 'FACE_2', 'FACE_3', 'FACE_4'] },
        };
    }

    constructor({ addAsset } = {}) {
        super();
        this.addAsset = addAsset; this.players = new Map(); this.time = 0; this.sound = true;
        this.selectedColor = null; this.nextColor = 0; this.launched = 0; this.cheerUntil = 0;
        this.base = this.shape(ShapeUtils.rectangle(0, 0, 100, 100), C.sky);
        this.scenery = this.group(this.base); this.skyEffects = this.group(this.base);
        this.friendsLayer = this.group(this.base); this.hud = this.group(this.base); this.audioRoot = this.group(this.base);
        this.audio = new SparkleAudio(this.audioRoot);
        this.buildScenery(); this.buildFriends(); this.buildHud();
        // A fixed budget of six fireworks, with sixteen sparks each. Even rapid
        // taps reuse old slots instead of accumulating a scene full of nodes.
        this.bursts = Array.from({ length: 6 }, () => ({
            active: false, age: 0, trail: this.put(this.skyEffects, this.shape(HIDDEN, C.white)),
            core: this.put(this.skyEffects, this.shape(HIDDEN, C.white)),
            petals: Array.from({ length: 16 }, () => this.put(this.skyEffects, this.shape(HIDDEN, C.white))),
        }));
        this.burstCursor = 0;
        this.welcomeBurst(28, 39, 0, 0, .9); this.welcomeBurst(69, 47, 3, 1, 1.1);
        this.welcomeBurst(49, 29, 2, 2, .85);
        // Artwork must never block a little finger. Route every hit through one
        // topmost surface, including the generous palette and sound hit areas.
        const touch = this.put(this.base, this.shape(ShapeUtils.rectangle(0, 0, 100, 100), null, {
            onClick: (id, x, y) => this.pointerDown(id, x, y),
        }));
        // Squish 142 drops offClick constructor options; the shared dispatcher
        // reads the node directly and closes a stale press before a new one.
        touch.node.offClick = id => { const player = this.players.get(id); if (player) player.pointer = false; };
    }

    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    shape(points, fill, options = {}) {
        return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: onPlane(points), ...(fill ? { fill } : {}), ...options });
    }
    put(parent, node) { parent.addChild(node, false); return node; }
    group(parent) { return this.put(parent, this.shape(HIDDEN)); }
    disk(parent, x, y, rx, ry, color) { return this.put(parent, this.shape(oval(x, y, rx, ry), color)); }
    text(parent, value, x, y, size, color = C.white, align = 'center') {
        return this.put(parent, new GameNode.Text({ textInfo: {
            text: value, x, y, size: size / Math.SQRT2, color, align, font: 'Trebuchet MS, sans-serif',
        } }));
    }
    dirty() { this.base.node.onStateChange(); }
    buildScenery() {
        this.put(this.scenery, this.shape(ShapeUtils.rectangle(0, 37, 100, 63), C.lowerSky));
        this.put(this.scenery, this.shape(ShapeUtils.rectangle(0, 64, 100, 36), C.horizon));
        const skyStars = [[8, 25], [18, 57], [39, 20], [58, 39], [93, 45], [6, 60], [33, 61], [62, 22], [76, 63], [92, 64], [10, 42], [43, 47], [57, 64], [69, 31], [92, 24]];
        skyStars.forEach(([x, y], i) => {
            this.put(this.scenery, this.shape(i % 3 ? oval(x, y, .2, .2, 8) : star(x, y, .65), i % 2 ? C.muted : C.white));
        });
        // A sleepy, smiling crescent and a tiny companion star.
        this.disk(this.scenery, 83, 27, 6.8, 6.8, [249, 222, 160, 255]);
        this.disk(this.scenery, 86, 24.7, 6.1, 6.1, C.sky);
        this.disk(this.scenery, 79.4, 28.2, .3, .42, C.ink);
        this.disk(this.scenery, 79.1, 30, 1, .45, [235, 177, 160, 255]);
        this.put(this.scenery, this.shape(line(80.5, 31, 81.5, 31.3, .22), C.ink));
        this.put(this.scenery, this.shape(star(91.2, 20, 1.25, .15), PALETTE[2]));
        this.put(this.scenery, this.shape(closed([[0, 79], [15, 71], [34, 72], [53, 78], [73, 70], [89, 71], [100, 76], [100, 100], [0, 100]]), C.backHill));
        this.put(this.scenery, this.shape(closed([[0, 83], [17, 80], [32, 82], [52, 85], [77, 78], [100, 82], [100, 100], [0, 100]]), C.hill));
        this.put(this.scenery, this.shape(closed([[0, 87], [19, 88], [39, 86], [59, 87], [79, 86], [100, 87], [100, 100], [0, 100]]), C.grass));
        [[4, 84], [31, 83], [67, 82], [96, 84]].forEach(([x, y], i) => {
            this.put(this.scenery, this.shape(line(x, y, x, y + 3, .25), C.grass));
            this.put(this.scenery, this.shape(star(x, y, .8, .2), PALETTE[(i + 1) % 6]));
        });
        this.disk(this.scenery, 16, 86, 7.3, 1.1, C.shadow); this.disk(this.scenery, 83, 86, 7, 1.1, C.shadow);
        // A dotted path joins the two friends behind the paint buttons.
        for (let i = 0; i < 8; i++) this.disk(this.scenery, 36 + i * 4, 84 + Math.sin(i) * .6, .35, .16, [155, 175, 174, 255]);
    }
    part(object, points, color) {
        const node = this.put(object.root, this.shape(HIDDEN, color)); object.parts.push({ points, node }); return node;
    }
    place(object, x, y, angle = 0) {
        const ca = Math.cos(angle), sa = Math.sin(angle);
        for (const p of object.parts) p.node.node.coordinates2d = onPlane(p.points.map(([px, py]) => [x + px * ca - py * sa, y + px * sa + py * ca]));
    }
    buildFriends() {
        this.friends = ['bunny', 'bear'].map((kind, index) => {
            const f = { root: this.group(this.friendsLayer), parts: [], x: index ? 83 : 16, y: 81 };
            const fur = index ? [213, 172, 140, 255] : C.cream;
            for (const sign of [-1, 1]) {
                this.part(f, oval(sign * 2.7, index ? -6.8 : -8.6, index ? 1.8 : 1.25, index ? 1.8 : 4), fur);
                this.part(f, oval(sign * 2.7, index ? -6.8 : -8.8, index ? 1 : .55, index ? 1 : 2.7), C.pink);
            }
            this.part(f, oval(0, 1.6, 4.4, 4.4), fur);
            this.part(f, oval(0, 2, 2.5, 2.7), index ? C.cream : [245, 211, 193, 255]);
            for (const sign of [-1, 1]) {
                this.part(f, oval(sign * 3.5, 4.6, 2, 1.1), fur);
                this.part(f, oval(sign * 4.3, .2, 1.25, 1.8), fur);
            }
            this.part(f, oval(0, -3.2, 4.9, 4.2), fur);
            if (index) this.part(f, oval(0, -1.5, 2.4, 1.8), C.cream);
            for (const sign of [-1, 1]) {
                this.part(f, oval(sign * 1.7, -3.5, .32, .49), C.ink);
                this.part(f, oval(sign * 3.2, -1.8, .85, .43), C.pink);
            }
            this.part(f, oval(0, -1.7, .48, .32), index ? C.ink : C.pink);
            this.part(f, this.smile(0, -.9, 1.2), C.ink);
            this.part(f, closed([[-1.8, .5], [0, 1.1], [-1.8, 2]]), PALETTE[index ? 2 : 4]);
            this.part(f, closed([[1.8, .5], [0, 1.1], [1.8, 2]]), PALETTE[index ? 2 : 4]);
            this.place(f, f.x, f.y); return f;
        });
    }
    smile(x, y, r) {
        const outer = Array.from({ length: 9 }, (_, i) => [x + Math.cos(.2 + i * (Math.PI - .4) / 8) * r, y + Math.sin(.2 + i * (Math.PI - .4) / 8) * r * .5]);
        const inner = [...outer].reverse().map(([px, py]) => [px, py - .18]); return closed([...outer, ...inner]);
    }
    buildHud() {
        this.text(this.hud, 'L I T T L E   P L A Y T I M E', 50, 3.6, 1.35, C.muted);
        this.text(this.hud, 'starry sparkles', 48, 8.7, 5.7, C.white);
        this.text(this.hud, 'Tap the sky. Make it sparkle!', 50, 16.3, 2.25, C.muted);
        this.disk(this.hud, 91, 7.7, 6.2, 3.3, [68, 56, 97, 255]);
        this.soundLabel = this.text(this.hud, 'sound on', 91, 6.8, 1.5);
        this.swatches = PALETTE.map((color, index) => {
            const x = 20 + index * 12;
            const ring = this.disk(this.hud, x, 92.4, 5.3, 5.3, C.shadow);
            this.disk(this.hud, x, 92, 4.65, 4.65, color);
            this.disk(this.hud, x - 1.5, 90.4, .85, .65, tint(color, .58));
            this.put(this.hud, this.shape(star(x, 92.5, 1.65), tint(color, .8)));
            return { x, y: 92, ring };
        });
        this.text(this.hud, 'tap / click / space', 50, 98.1, 1.2, C.ink);
    }

    welcomeBurst(x, y, color, kind, age) {
        const b = this.bursts[this.burstCursor++ % this.bursts.length];
        Object.assign(b, { active: true, x, y, color, kind, age, origin: x, sounded: true });
        this.drawBurst(b);
    }
    launch(x, y) {
        const color = this.selectedColor === null ? this.nextColor++ % PALETTE.length : this.selectedColor;
        const b = this.bursts[this.burstCursor++ % this.bursts.length];
        Object.assign(b, { active: true, x: Math.max(5, Math.min(95, x)), y: Math.max(22, Math.min(77, y)),
            color, kind: this.launched % 3, age: 0, origin: 40 + this.launched % 5 * 5, sounded: false });
        this.launched++; this.cheerUntil = this.time + 2.1;
        this.drawBurst(b); this.dirty();
    }
    drawBurst(b) {
        const paint = PALETTE[b.color], bloomAge = b.age - .42;
        if (bloomAge < 0) {
            const u = b.age / .42, eased = 1 - Math.pow(1 - u, 2);
            const x = b.origin + (b.x - b.origin) * eased, y = 83 + (b.y - 83) * eased;
            b.trail.node.coordinates2d = onPlane(line(x, y, x - (b.x - b.origin) * .07, Math.min(85, y + 4), .32));
            b.trail.node.fill = tint(paint, .4); b.trail.node.color = [255, 255, 255, 170];
            // A small star appears at the touch immediately while the trail rises.
            b.core.node.coordinates2d = onPlane(star(b.x, b.y, .7 + u * .5));
            b.core.node.fill = paint; b.core.node.color = [255, 255, 255, 220];
            for (const p of b.petals) p.node.coordinates2d = HIDDEN;
            return;
        }
        b.trail.node.coordinates2d = HIDDEN;
        const expansion = 1 - Math.exp(-bloomAge * 2.3), radius = 1.4 + expansion * 9;
        const fade = Math.max(0, Math.min(1, (2.75 - bloomAge) / .95));
        const alpha = Math.round(255 * fade), size = (1.5 - expansion * .5) * Math.min(1, fade * 1.6);
        b.core.node.fill = tint(paint, .65); b.core.node.color = [255, 255, 255, alpha];
        b.core.node.coordinates2d = onPlane(star(b.x, b.y, (b.kind === 2 ? .85 : 1.9) * Math.min(1, fade * 2), .06 * bloomAge));
        b.petals.forEach((p, i) => {
            const angle = i * TAU / b.petals.length - Math.PI / 2;
            let dx, dy;
            if (b.kind === 2) {
                const a = i * TAU / b.petals.length;
                dx = Math.pow(Math.sin(a), 3) * radius;
                dy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 * radius;
            } else {
                const r = b.kind === 1 && i % 2 ? radius * .55 : radius;
                dx = Math.cos(angle) * r; dy = Math.sin(angle) * r;
            }
            const x = b.x + dx, y = b.y + dy + bloomAge * .38;
            p.node.fill = i % 3 ? paint : tint(paint, .48); p.node.color = [255, 255, 255, alpha];
            p.node.coordinates2d = onPlane(b.kind === 0 ? petal(x, y, size * 1.35, angle) : star(x, y, size, angle * .3));
        });
    }
    hideBurst(b) {
        b.active = false; b.trail.node.coordinates2d = HIDDEN; b.core.node.coordinates2d = HIDDEN;
        for (const p of b.petals) p.node.coordinates2d = HIDDEN;
    }
    handleNewPlayer({ playerId }) {
        this.players.set(playerId, { pointer: false, keys: new Set() });
        if (!this.assetsRegistered && typeof this.addAsset === 'function') {
            this.assetsRegistered = true;
            for (const [key, asset] of Object.entries(this.audio.assets)) {
                try { this.addAsset(key, asset)?.catch(() => {}); } catch (_) { /* Play continues if audio is unavailable. */ }
            }
        }
    }
    handlePlayerDisconnect(id) { this.players.delete(id); if (!this.players.size) this.audio.mute(); }
    pointerDown(id, x, y) {
        const player = this.players.get(id); if (!player || player.pointer) return;
        player.pointer = true; this.tap(x, y);
    }
    handleMouseUp(id, position) {
        const player = this.players.get(id); if (!player) return;
        if (!player.pointer && position) this.tap(position.x, position.y);
        player.pointer = false;
    }
    tap(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return;
        if (x >= 83 && y <= 13) {
            this.sound = !this.sound;
            if (!this.sound) this.audio.mute(); else this.audio.play(4);
            this.soundLabel.node.text = { ...this.soundLabel.node.text, text: this.sound ? 'sound on' : 'sound off' };
            this.dirty(); return;
        }
        const index = this.swatches.findIndex(s => Math.abs(x - s.x) <= 5.8 && Math.abs(y - s.y) <= 6.3);
        if (index >= 0) {
            this.selectedColor = index;
            this.swatches.forEach((s, i) => { s.ring.node.fill = i === index ? C.white : C.shadow; });
            // Choosing paint also makes a firework, so every button is rewarding.
            this.launch(22 + index * 11.2, 37 + index % 2 * 12); return;
        }
        this.launch(x, y);
    }
    handleKeyDown(id, key) {
        const player = this.players.get(id);
        if (!player || typeof key !== 'string' || player.keys.has(key)) return;
        if (!(key === 'Enter' || key.startsWith('Arrow') || key === ' ' || /^[a-z0-9]$/i.test(key))) return;
        player.keys.add(key);
        const positions = [[28, 38], [70, 48], [49, 29], [38, 56], [68, 32], [25, 53]];
        this.launch(...positions[this.launched % positions.length]);
    }
    handleKeyUp(id, key) { this.players.get(id)?.keys.delete(key); }
    tick() {
        if (!this.players.size) return;
        const dt = 1 / 30; this.time += dt;
        let changed = this.audio.tick(dt);
        for (const b of this.bursts) {
            if (!b.active) continue;
            b.age += dt; changed = true;
            if (!b.sounded && b.age >= .42) { b.sounded = true; if (this.sound) this.audio.play(b.color); }
            if (b.age >= 3.17) this.hideBurst(b); else this.drawBurst(b);
        }
        if (this.time <= this.cheerUntil + dt) {
            this.friends.forEach((f, i) => {
                const cheering = this.time < this.cheerUntil;
                const hop = cheering ? Math.abs(Math.sin(this.time * 4 + i)) * .85 : 0;
                this.place(f, f.x, f.y - hop, cheering ? Math.sin(this.time * 4 + i) * .035 : 0);
            });
            changed = true;
        }
        if (changed) this.dirty();
    }
    close() { this.audio.close(); this.players.clear(); super.close(); }
}

module.exports = StarrySparkles;
