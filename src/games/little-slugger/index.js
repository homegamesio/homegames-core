const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { SluggerAudio } = require('./audio');

const TUNING = { TICK: 30, FLIGHT: 1.35, REPLAY: 2.45, SWING: .5, PITCH: 2.8, MAX_PARTICLES: 48, TRAIL: 7 };
const C = {
    sky: [229, 246, 249, 255], cream: [255, 253, 240, 255], ink: [63, 80, 92, 255],
    muted: [112, 139, 145, 255], grass: [170, 211, 149, 255], hill: [202, 225, 172, 255],
    field: [239, 203, 160, 255], line: [255, 240, 212, 255], fence: [255, 247, 223, 255],
    bear: [199, 143, 96, 255], bearLight: [225, 175, 124, 255], blush: [242, 170, 151, 255],
    blue: [92, 162, 193, 255], navy: [66, 115, 151, 255], wood: [226, 164, 99, 255],
};
const COLORS = [[240, 139, 139, 255], [245, 199, 96, 255], [159, 159, 218, 255], [100, 185, 167, 255], [102, 179, 218, 255], [222, 156, 201, 255]];
const TARGETS = [{ x: 22, y: 43 }, { x: 51, y: 35 }, { x: 80, y: 43 }];
const TAU = Math.PI * 2, HIDDEN = [[0, 0], [0, 0], [0, 0]];
const close = points => [...points, points[0]];
const oval = (x, y, rx, ry = rx, n = 28) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos(i * TAU / n) * rx, y + Math.sin(i * TAU / n) * ry]);
const pale = c => c.map((v, i) => i === 3 ? 255 : Math.round(v + (255 - v) * .55));
const star = (x, y, radius, angle = 0) => close(Array.from({ length: 10 }, (_, i) => {
    const a = angle - Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * .48 : radius;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
}));
const stroke = (points, width) => {
    const top = [], bottom = [];
    points.forEach(([x, y], i) => {
        const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
        const angle = Math.atan2(after[1] - before[1], after[0] - before[0]);
        top.push([x - Math.sin(angle) * width / 2, y + Math.cos(angle) * width / 2]);
        bottom.unshift([x + Math.sin(angle) * width / 2, y - Math.cos(angle) * width / 2]);
    });
    return close([...top, ...bottom]);
};

class LittleSlugger extends Game {
    static metadata() {
        return {
            isTest: true, // Showcase review: docs/game-curation.json.

            thumbnail: './assets/thumbnail.png',
            name: 'Little Slugger', squishVersion: '150', author: "Joseph Garcia", createdBy: "Joseph Garcia",
            description: 'Choose a star, swing from the tee or try a gentle pitch, and collect a whole outfield of happy hits with Teddy.',
            aspectRatio: { x: 1, y: 1 }, tickRate: 30, maxPlayers: 1, services: [], assets: {},
            gamepadBindings: { ' ': ['FACE_1'], p: ['FACE_2'], ArrowLeft: ['DPAD_LEFT'], ArrowRight: ['DPAD_RIGHT'] },
        };
    }

    constructor({ addAsset } = {}) {
        super();
        this.addAsset = addAsset; this.players = new Map(); this.time = 0; this.hits = 0;
        this.phase = 'ready'; this.hitAt = 0; this.targetIndex = 0; this.sound = true;
        this.mode = 'pitch'; this.round = 0; this.collected = [false, false, false];
        this.pitchAt = 0; this.queuedSwing = false; this.shot = 'bounce'; this.shotTarget = null;
        this.lastOutcome = ''; this.bigHits = 0; this.aimDots = [];
        this.base = this.shape(ShapeUtils.rectangle(0, 0, 100, 100), C.sky);
        this.scenery = this.group(this.base); this.targetLayer = this.group(this.base);
        this.actorLayer = this.group(this.base); this.ballLayer = this.group(this.base);
        this.effects = this.group(this.base); this.hud = this.group(this.base); this.audioRoot = this.group(this.base);
        this.audio = new SluggerAudio(this.audioRoot);
        this.buildPark(); this.buildTargets(); this.buildTeddy(); this.buildBall(); this.buildHud();
        this.particles = Array.from({ length: TUNING.MAX_PARTICLES }, () => ({ life: 0, node: this.put(this.effects, this.shape(HIDDEN, [0, 0, 0, 0])) }));
        this.trail = Array.from({ length: TUNING.TRAIL }, () => this.put(this.ballLayer, this.shape(HIDDEN, [0, 0, 0, 0])));
        this.prepareBall();
        // Decorative polygons are hit-testable in Squish. A final, transparent
        // input surface routes generous target and control hit areas consistently.
        const touch = this.put(this.base, this.shape(ShapeUtils.rectangle(0, 0, 100, 100), null, { onClick: (id, x, y) => this.pointerDown(id, x, y) }));
        // Squish 1.5.0 does not forward offClick through its constructor.
        touch.node.offClick = id => { const player = this.players.get(id); if (player) player.pointer = false; };
    }

    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    shape(points, fill, options = {}) { return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: points, ...(fill ? { fill } : {}), ...options }); }
    put(parent, child) { parent.addChild(child, false); return child; }
    group(parent) { return this.put(parent, this.shape(HIDDEN)); }
    disk(parent, x, y, rx, ry, color) { return this.put(parent, this.shape(oval(x, y, rx, ry), color)); }
    line(parent, points, width, color) { return this.put(parent, this.shape(stroke(points, width), color)); }
    text(parent, value, x, y, size, color = C.ink) {
        return this.put(parent, new GameNode.Text({ textInfo: { text: value, x, y, size: size / Math.SQRT2, align: 'center', color, font: 'Trebuchet MS, sans-serif' } }));
    }
    setText(node, text) { node.node.text = { ...node.node.text, text }; }
    dirty() { this.base.node.onStateChange(); }
    cloud(x, y, size) {
        this.disk(this.scenery, x, y, size * 1.7, size * .6, C.cream);
        this.disk(this.scenery, x - size * .6, y - size * .45, size * .8, size * .8, C.cream);
        this.disk(this.scenery, x + size * .45, y - size * .5, size, size, C.cream);
    }
    buildPark() {
        this.cloud(15, 29, 4); this.cloud(81, 27, 5);
        this.disk(this.scenery, 92, 24, 4.5, 4.5, COLORS[1]);
        this.disk(this.scenery, 90.8, 24, .3, .45, C.ink); this.disk(this.scenery, 93.2, 24, .3, .45, C.ink);
        this.line(this.scenery, [[91, 25.5], [92, 26], [93, 25.5]], .25, C.ink);
        this.put(this.scenery, this.shape(close([[0, 50], [13, 41], [34, 46], [60, 43], [82, 39], [100, 46], [100, 100], [0, 100]]), C.hill));
        this.put(this.scenery, this.shape(ShapeUtils.rectangle(0, 53, 100, 47), C.grass));
        // A picket fence and little pennants frame the miniature ballpark.
        this.line(this.scenery, [[0, 56], [100, 56]], .7, C.fence);
        this.line(this.scenery, [[0, 60], [100, 60]], .7, C.fence);
        for (let x = 3; x < 100; x += 7) this.put(this.scenery, this.shape(close([[x - .65, 61], [x - .65, 52], [x, 51], [x + .65, 52], [x + .65, 61]]), C.fence));
        this.line(this.scenery, [[7, 49], [50, 55], [93, 49]], .25, C.muted);
        for (let i = 0; i < 11; i++) {
            const x = 10 + i * 8, y = 49.4 + (1 - Math.abs(x - 50) / 43) * 5.5;
            this.put(this.scenery, this.shape(close([[x - 2.4, y], [x + 2.4, y + .2], [x, y + 4]]), COLORS[i % COLORS.length]));
        }
        this.put(this.scenery, this.shape(close([[50, 57], [91, 75], [53, 98], [13, 75]]), C.field));
        this.put(this.scenery, this.shape(close([[50, 63], [77, 75], [53, 90], [27, 75]]), C.grass));
        this.line(this.scenery, [[19, 76], [53, 94], [86, 76]], .5, C.line);
        [[50, 58], [88, 75], [16, 75]].forEach(([x, y]) => this.put(this.scenery, this.shape(close([[x, y - 1.2], [x + 2, y], [x, y + 1.2], [x - 2, y]]), C.cream)));
        this.put(this.scenery, this.shape(close([[49, 85], [58, 85], [58, 88], [53.5, 90], [49, 88]]), C.cream));
        this.disk(this.scenery, 33, 85, 11, 2, [149, 185, 131, 255]);
        this.disk(this.scenery, 54, 84.5, 5.5, 1.1, [207, 170, 130, 255]);
        this.teeParts = [
            this.disk(this.scenery, 54, 84, 4, .8, C.navy),
            this.line(this.scenery, [[54, 84], [54, 72]], 1.1, C.navy),
            this.disk(this.scenery, 54, 72, 2, .65, C.blue),
        ].map(node => ({ node, points: node.node.coordinates2d }));
        this.crowd = [];
        [[9, 66, COLORS[0]], [89, 68, COLORS[2]], [77, 62, COLORS[3]]].forEach(([x, y, shirt], index) => {
            const friend = { root: this.group(this.scenery), parts: [], x, y, index };
            const fur = index === 1 ? C.cream : C.bearLight;
            this.part(friend, oval(0, 2, 3.8, 4), shirt);
            this.part(friend, oval(-2.6, -4, 1.5, 1.7), fur); this.part(friend, oval(2.6, -4, 1.5, 1.7), fur);
            this.part(friend, oval(0, -1, 3.9, 3.5), fur);
            this.part(friend, oval(-1.3, -1.4, .3, .4), C.ink); this.part(friend, oval(1.3, -1.4, .3, .4), C.ink);
            this.part(friend, stroke([[-.8, .1], [0, .6], [.8, .1]], .25), C.ink);
            this.part(friend, oval(-3.9, 1.5, 1.4, 1.4), fur); this.part(friend, oval(3.9, 1.5, 1.4, 1.4), fur);
            this.place(friend, x, y); this.crowd.push(friend);
        });
    }
    buildTargets() {
        this.aimRing = this.disk(this.targetLayer, 22, 43, 8.2, 8.2, C.navy);
        this.targets = TARGETS.map((position, i) => {
            const target = { ...position, root: this.group(this.targetLayer), parts: [] };
            this.part(target, oval(0, .7, 6.8, 6.8), pale(COLORS[i]));
            this.part(target, oval(0, 0, 6.4, 6.4), C.cream);
            this.part(target, oval(0, 0, 5.55, 5.55), COLORS[i]);
            this.part(target, star(0, 0, 3.8), C.cream);
            this.part(target, oval(-1, -.3, .23, .35), C.ink); this.part(target, oval(1, -.3, .23, .35), C.ink);
            this.part(target, stroke([[-.6, .65], [0, .95], [.6, .65]], .2), C.ink);
            this.place(target, target.x, target.y); return target;
        });
    }
    part(object, points, color) { const node = this.put(object.root, this.shape(points, color)); object.parts.push({ points, node }); return node; }
    place(object, x, y, scale = 1, angle = 0) {
        const ca = Math.cos(angle), sa = Math.sin(angle);
        object.parts.forEach(part => { part.node.node.coordinates2d = part.points.map(([px, py]) => [x + (px * ca - py * sa) * scale, y + (px * sa + py * ca) * scale]); });
    }
    buildTeddy() {
        const b = this.teddy = { root: this.group(this.actorLayer), parts: [] };
        this.part(b, oval(-4.4, 7, 3.4, 2.7), C.bear); this.part(b, oval(4.4, 7, 3.4, 2.7), C.bear);
        this.part(b, oval(0, 1.5, 7.5, 8), C.blue);
        this.part(b, stroke([[0, -3], [0, 7]], .35), C.cream);
        this.part(b, oval(2, 2, .4, .4), C.cream); this.part(b, oval(2, 5, .4, .4), C.cream);
        this.part(b, star(-3.2, 1.5, 1.7), COLORS[1]);
        this.part(b, oval(-5.7, -12.3, 3.3, 3.4), C.bear); this.part(b, oval(5.7, -12.3, 3.3, 3.4), C.bear);
        this.part(b, oval(-5.7, -12.3, 1.7, 1.9), C.blush); this.part(b, oval(5.7, -12.3, 1.7, 1.9), C.blush);
        this.part(b, oval(0, -7.7, 8.4, 7.7), C.bearLight);
        this.part(b, oval(-5.2, -5.5, 1.8, 1), C.blush); this.part(b, oval(5.2, -5.5, 1.8, 1), C.blush);
        this.part(b, oval(0, -4.6, 3.7, 2.7), [251, 221, 174, 255]);
        this.part(b, oval(-2.8, -8.1, .55, .8), C.ink); this.part(b, oval(2.8, -8.1, .55, .8), C.ink);
        this.part(b, oval(0, -5.2, 1, .7), C.ink);
        this.part(b, stroke([[-1.4, -3.8], [-.7, -3.2], [0, -3.8], [.7, -3.2], [1.4, -3.8]], .28), C.ink);
        this.part(b, close([[-7, -12], [-6.3, -15], [-3, -17], [2, -17], [5.5, -15], [6.5, -12]]), C.navy);
        this.part(b, oval(1, -12.3, 8.2, 1.3), C.blue);
        this.part(b, star(-.6, -14.8, 1.4), COLORS[1]);
        this.part(b, oval(-6, .6, 2.4, 4.1), C.bearLight);
        this.part(b, oval(7, -.7, 3.8, 2.5), C.bearLight);
        this.place(b, 33, 75);
        this.bat = { root: this.group(this.actorLayer), parts: [] };
        this.part(this.bat, close([[-.65, 1], [.65, 1], [.8, -4], [1.7, -12.8], [1.4, -15], [.7, -16], [-.7, -16], [-1.4, -15], [-1.7, -12.8], [-.8, -4]]), C.wood);
        this.part(this.bat, stroke([[-.3, -4.5], [-.7, -13.5]], .3), [251, 211, 154, 255]);
        this.part(this.bat, oval(0, 1.1, 1.3, .6), [175, 121, 78, 255]);
        this.part(this.bat, oval(0, 0, 1.7, 1.5), C.bearLight);
        this.place(this.bat, 42, 74, 1, -.2);
    }
    buildBall() {
        this.contactRing = this.disk(this.ballLayer, 54, 68.5, 4.8, 4.8, [0, 0, 0, 0]);
        this.ball = { root: this.group(this.ballLayer), parts: [] };
        this.part(this.ball, oval(.2, .3, 3.2, 3.2), [223, 224, 206, 255]);
        this.part(this.ball, oval(0, 0, 3.15, 3.15), C.cream);
        this.ball.seams = [];
        [-1, 1].forEach(side => {
            this.ball.seams.push(this.part(this.ball, stroke([[side * 2, -2.3], [side * 1.3, -1.2], [side, 0], [side * 1.3, 1.2], [side * 2, 2.3]], .25), COLORS[0]));
            [-1.4, 0, 1.4].forEach(y => this.ball.seams.push(this.part(this.ball, stroke([[side * .7, y - .2], [side * 1.8, y + .2]], .2), COLORS[0])));
        });
    }
    buildHud() {

        this.message = this.text(this.hud, 'Choose a star', 50, 16, 2.15);
        this.disk(this.hud, 10.5, 8.3, 9, 3.8, C.cream);
        this.disk(this.hud, 4.5, 7.3, 1.4, 1.4, C.navy);
        this.disk(this.hud, 4.5, 7.3, 1.16, 1.16, C.cream);
        this.line(this.hud, [[4, 6.3], [4.4, 7.3], [4, 8.3]], .23, COLORS[0]);
        this.modeTee = this.line(this.hud, [[4.5, 8.8], [4.5, 10.8]], .45, C.navy);
        this.modeTeePoints = this.modeTee.node.coordinates2d;
        this.modeLabel = this.text(this.hud, 'pitch ball', 12.5, 6.25, 1.6, C.navy);

        this.disk(this.hud, 91, 8.3, 7, 3.1, C.cream);
        this.soundLabel = this.text(this.hud, 'sound on', 91, 7.35, 1.5, C.muted);
        this.stickers = [0, 1, 2].map(i => this.put(this.hud, this.shape(star(42 + i * 8, 23, 2.6), pale(COLORS[i]))));
        this.roundLabel = this.text(this.hud, 'collect all three!', 24, 22.2, 1.55, C.muted);
        this.swingButton = this.disk(this.hud, 51, 94, 23, 4.3, COLORS[1]);
        this.prompt = this.text(this.hud, 'SWING!', 51, 92.5, 2.8);

        for (let i = 0; i < 5; i++) this.aimDots.push(this.disk(this.targetLayer, 0, 0, .45, .45, C.cream));
    }
    updatePrompt() {
        if (this.phase === 'ready') this.setText(this.prompt, this.mode === 'tee' ? 'SWING!' : 'PITCH!');
        else if (this.phase === 'pitch') this.setText(this.prompt, this.queuedSwing ? 'Ready... swing!' : this.contactReady() ? 'SWING NOW!' : 'SWING!');
        else this.setText(this.prompt, this.phase === 'celebrate' ? 'Hooray!' : 'Go, ball, go!');
        this.swingButton.node.fill = this.phase === 'pitch' && this.contactReady() ? COLORS[3] : COLORS[1];
        this.setText(this.modeLabel, this.mode === 'tee' ? 'tee ball' : 'pitch ball');
        this.modeTee.node.coordinates2d = this.mode === 'tee' ? this.modeTeePoints : HIDDEN;
    }
    prepareBall() {
        this.phase = 'ready'; this.queuedSwing = false;
        this.ball.seams.forEach(node => { node.node.fill = COLORS[this.targetIndex]; });
        this.place(this.ball, this.mode === 'tee' ? 54 : 77, this.mode === 'tee' ? 68.5 : 58, this.mode === 'tee' ? 1 : .8);
        this.place(this.bat, 42, 74, 1, -.2);
        this.trail.forEach(node => { node.node.coordinates2d = HIDDEN; node.node.fill = [0, 0, 0, 0]; });
        this.contactRing.node.fill = [0, 0, 0, 0];
        this.teeParts.forEach(part => { part.node.node.coordinates2d = this.mode === 'tee' ? part.points : HIDDEN; });
        this.setText(this.message, this.round ? 'Moving stars! Choose where to hit.' : this.mode === 'pitch' ? 'Choose a star. Tap PITCH, then SWING!' : 'Tap a star to aim. Then swing!');
        this.updatePrompt(); this.dirty();
    }
    selectTarget(index) {
        if (this.phase !== 'ready' && this.phase !== 'pitch') return;
        this.targetIndex = (index + 3) % 3;
        this.ball.seams.forEach(node => { node.node.fill = COLORS[this.targetIndex]; });
        this.setText(this.message, ['Red star! Aim left.', 'Yellow star! Aim up.', 'Purple star! Aim right.'][this.targetIndex]);
        this.dirty();
    }
    toggleMode() {
        if (this.phase !== 'ready' && this.phase !== 'pitch') return;
        this.mode = this.mode === 'tee' ? 'pitch' : 'tee'; this.prepareBall();
        this.setText(this.message, this.mode === 'tee' ? 'Tee time! Choose a star and swing.' : 'Tap PITCH. Swing when the ring is green!');
    }
    pitchProgress() { return ((this.time - this.pitchAt) % TUNING.PITCH) / TUNING.PITCH; }
    contactReady() { const p = this.pitchProgress(); return this.phase === 'pitch' && p >= .51 && p <= .84; }
    swing() {
        if (this.phase === 'ready' && this.mode === 'pitch') {
            this.phase = 'pitch'; this.pitchAt = this.time; this.queuedSwing = false;
            this.setText(this.message, 'Watch the ball... green means swing!'); this.updatePrompt(); this.dirty(); return;
        }
        if (this.phase === 'pitch') {
            if (this.contactReady()) this.hit('sky');
            else { this.queuedSwing = true; this.setText(this.message, 'Ready! Teddy will help with this one.'); this.updatePrompt(); this.dirty(); }
        } else if (this.phase === 'ready') this.hit('bounce');
    }
    hit(shot = 'bounce') {
        if (this.phase !== 'ready' && this.phase !== 'pitch') return false;
        this.shot = shot; this.queuedSwing = false;
        this.shotTarget = { x: this.targets[this.targetIndex].x, y: this.targets[this.targetIndex].y };
        this.phase = 'flight'; this.hitAt = this.time; this.hits++;
        if (shot === 'sky') this.bigHits++;
        this.lastOutcome = shot === 'sky' ? 'Big sky hit!' : shot === 'line' ? 'A speedy line drive!' : 'Bouncy ground ball!';
        this.setText(this.message, this.lastOutcome); this.updatePrompt();
        this.contactRing.node.fill = [0, 0, 0, 0];
        this.burst(54, 68.5, 12, COLORS[this.targetIndex]);
        if (this.sound) this.audio.play(this.targetIndex + (shot === 'sky' ? 3 : 0));
        this.dirty(); return true;
    }
    burst(x, y, count, color) {
        for (const particle of this.particles) {
            if (count <= 0) break;
            if (particle.life > 0) continue;
            const angle = Math.random() * TAU;
            particle.x = x; particle.y = y; particle.vx = Math.cos(angle) * (6 + Math.random() * 9);
            particle.vy = Math.sin(angle) * 10 - 5; particle.life = 1 + Math.random() * .65;
            particle.size = .65 + Math.random() * .65; particle.angle = angle;
            particle.node.node.fill = color || COLORS[count % COLORS.length]; count--;
        }
    }
    handleNewPlayer({ playerId }) {
        this.players.set(playerId, { pointer: false, keys: new Set() });
        if (!this.assetsRegistered && typeof this.addAsset === 'function') {
            this.assetsRegistered = true;
            Object.entries(this.audio.assets).forEach(([key, asset]) => { try { this.addAsset(key, asset)?.catch(() => {}); } catch (_) { /* Sound is optional. */ } });
        }
    }
    handlePlayerDisconnect(id) { this.players.delete(id); if (!this.players.size) { this.audio.mute(); this.queuedSwing = false; if (this.phase === 'pitch') this.prepareBall(); } }
    pointerDown(id, x, y) { const p = this.players.get(id); if (!p || p.pointer) return; p.pointer = true; this.tap(x, y); }
    handleMouseUp(id, position) {
        const p = this.players.get(id); if (!p) return;
        if (!p.pointer && position) this.tap(position.x, position.y);
        p.pointer = false;
    }
    tap(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return;
        if (x >= 83 && y <= 13) {
            this.sound = !this.sound;
            if (this.sound) this.audio.play(4); else this.audio.mute();
            this.setText(this.soundLabel, this.sound ? 'sound on' : 'sound off'); this.dirty(); return;
        }
        if (x <= 21 && y <= 13) { this.toggleMode(); return; }
        if ((this.phase === 'ready' || this.phase === 'pitch') && y >= 29 && y <= 54) {
            const index = this.targets.findIndex(target => Math.hypot(x - target.x, y - target.y) <= 10);
            if (index >= 0) this.selectTarget(index);
            return;
        }
        if ((x >= 25 && x <= 78 && y >= 88) || (x >= 26 && x <= 62 && y >= 57 && y <= 85)) this.swing();
    }
    handleKeyDown(id, key) {
        const p = this.players.get(id);
        if (!p || typeof key !== 'string' || p.keys.has(key)) return;
        if (![' ', 'Enter', 'ArrowLeft', 'ArrowRight', '1', '2', '3', 'p', 'P'].includes(key)) return;
        p.keys.add(key);
        if (key === 'ArrowLeft') this.selectTarget(this.targetIndex - 1);
        else if (key === 'ArrowRight') this.selectTarget(this.targetIndex + 1);
        else if (['1', '2', '3'].includes(key)) this.selectTarget(Number(key) - 1);
        else if (key.toLowerCase() === 'p') this.toggleMode();
        else this.swing();
    }
    handleKeyUp(id, key) { this.players.get(id)?.keys.delete(key); }
    flightPosition(progress) {
        const destination = this.shotTarget || this.targets[this.targetIndex], t = Math.max(0, Math.min(1, progress));
        const height = this.shot === 'sky' ? 21 : this.shot === 'line' ? 11 : 0;
        // Grounders visibly bounce; a well-timed pitch takes the high arc.
        const bounce = this.shot === 'bounce' ? Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 7 : 0;
        return { x: 54 + (destination.x - 54) * t, y: 68.5 + (destination.y - 68.5) * t - Math.sin(t * Math.PI) * height - bounce, scale: 1 - t * .43 };
    }
    tick() {
        if (!this.players.size) return;
        const dt = 1 / TUNING.TICK; this.time += dt; this.audio.tick(dt);
        let elapsed = this.time - this.hitAt;
        if (this.phase === 'pitch') {
            const p = this.pitchProgress();
            const t = p <= .55 ? p / .55 : p <= .84 ? 1 : 1 - (p - .84) / .16;
            this.place(this.ball, 77 - 23 * t, 58 + 10.5 * t - Math.sin(t * Math.PI) * 7, .8 + .2 * t, this.time * 2);
            this.contactRing.node.fill = this.contactReady() ? [100, 185, 167, 110] : [245, 199, 96, 75];
            this.updatePrompt();
            if (this.queuedSwing && this.contactReady()) this.hit('line');
        }
        elapsed = this.time - this.hitAt;
        if (this.phase === 'flight') {
            const progress = (this.time - this.hitAt) / TUNING.FLIGHT, position = this.flightPosition(progress);
            this.place(this.ball, position.x, position.y, position.scale, elapsed * 4);
            this.trail.forEach((node, i) => {
                const p = this.flightPosition(progress - (i + 1) * .038);
                const size = Math.max(.1, .75 - i * .09);
                node.node.coordinates2d = oval(p.x, p.y, size); node.node.fill = pale(COLORS[this.targetIndex]);
            });
            if (progress >= 1) {
                this.phase = 'celebrate';
                this.trail.forEach(node => { node.node.coordinates2d = HIDDEN; node.node.fill = [0, 0, 0, 0]; });
                this.burst(position.x, position.y, 24);
                const fresh = !this.collected[this.targetIndex];
                this.collected[this.targetIndex] = true;
                this.stickers.forEach((node, i) => { node.node.fill = this.collected[i] ? COLORS[i] : pale(COLORS[i]); });
                this.setText(this.message, this.collected.every(Boolean) ? 'All three! A whole star team!' : fresh ? 'A new star! Pick another color next.' : 'Great hit! Try a new star next.');
                this.setText(this.prompt, 'Hooray!');
                if (this.sound) this.audio.play('celebrate');
            }
        }
        if (this.phase === 'celebrate') {
            const target = this.shotTarget;
            this.place(this.ball, target.x, target.y, .57, elapsed * 2);
            if (elapsed >= TUNING.REPLAY) {
                if (this.collected.every(Boolean)) {
                    this.round++; this.collected = [false, false, false];
                    this.stickers.forEach((node, i) => { node.node.fill = pale(COLORS[i]); });
                    this.setText(this.roundLabel, `star team ${this.round + 1}`);
                }
                this.prepareBall();
            }
        }
        const playing = this.phase === 'flight' || this.phase === 'celebrate';
        const hop = this.phase === 'celebrate' ? Math.abs(Math.sin(elapsed * 7)) * 1.5 : Math.sin(this.time * 2) * .15;
        this.place(this.teddy, 33, 75 - hop, 1, this.phase === 'celebrate' ? Math.sin(elapsed * 7) * .035 : 0);
        const swing = playing ? Math.sin(Math.min(1, elapsed / TUNING.SWING) * Math.PI) * 1.7 : Math.sin(this.time * 2) * .025;
        this.place(this.bat, 42, 74 - hop, 1, -.2 + swing);
        this.crowd.forEach(friend => this.place(friend, friend.x, friend.y - (playing ? Math.abs(Math.sin(this.time * 6 + friend.index)) * 1.2 : 0), 1, playing ? Math.sin(this.time * 5 + friend.index) * .09 : 0));
        this.targets.forEach((target, i) => {
            if (!playing) {
                target.x = TARGETS[i].x + (this.round ? Math.sin(this.time * .7 + i * 2) * 4 : 0);
                target.y = TARGETS[i].y + (this.round ? Math.sin(this.time * .9 + i) * 2 : 0);
            }
            const active = i === this.targetIndex;
            const pulse = active ? Math.sin(this.time * 3) * .035 : 0;
            this.place(target, target.x, target.y, 1 + pulse, active && this.phase === 'celebrate' ? Math.sin(elapsed * 6) * .18 : 0);
        });
        const aimed = this.targets[this.targetIndex];
        this.aimRing.node.coordinates2d = oval(aimed.x, aimed.y, 7.6 + Math.sin(this.time * 3) * .3);
        this.aimDots.forEach((node, i) => {
            const t = (i + 1) / 7;
            node.node.coordinates2d = playing ? HIDDEN : oval(54 + (aimed.x - 54) * t, 65 + (aimed.y - 65) * t, .45);
        });
        for (const p of this.particles) {
            if (p.life <= 0) continue;
            p.life -= dt;
            if (p.life <= 0) { p.node.node.coordinates2d = HIDDEN; p.node.node.fill = [0, 0, 0, 0]; continue; }
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += dt * 9;
            const size = p.size * Math.min(1, p.life * 3);
            const x = Math.max(size, Math.min(100 - size, p.x)), y = Math.max(size, Math.min(100 - size, p.y));
            p.node.node.coordinates2d = star(x, y, size, p.angle + this.time);
        }
        this.dirty();
    }
    close() { this.audio.close(); this.players.clear(); super.close(); }
}

module.exports = LittleSlugger;
