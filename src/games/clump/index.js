const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');
const { TYPES } = require('./shapes');

// tickRate / maxPlayers MUST stay in sync with the metadata() literals below.
const TUNING = {
    TICK: 120,             // tickRate - MUST match metadata()
    MAX_PLAYERS: 1,        // maxPlayers - MUST match metadata()
    WORLD: 900,
    START_R: 0.09,
    GOAL_R: 18,
    ROUND_SECONDS: 210,
    VIEW_MUL: 9,
    MIN_VIEW: 2.55,
    GAIN: 0.65,            // area added per pickup (2d clump)
    PICKUP: 0.9,           // can eat if obj.r <= player.r * PICKUP
    MAGNET: 1.72,          // sticky, not a vacuum
    BASE_SPEED: 0.032,     // per tick at 20Hz; scaled by STEP
    SPEED_K: 0.1,
    MAX_STUCK: 72,         // hard cap - stuck node pool size
    MAX_WORLD_DRAW: 180,   // hard cap - world node pool size
    MAX_TRAIL: 24,
    MAX_SPARKS: 48,
    MAX_RINGS: 8,
    MAX_GROUND: 28,
    FLY_TICKS: 10,         // at 20Hz; scaled by STEP
    PICKUP_GAP: 0.08       // seconds between absorbs so each one reads
};

const TICK = TUNING.TICK;
const STEP = 20 / TICK;    // original tune was 20Hz
const WORLD = TUNING.WORLD;
const ROUND_TICKS = TUNING.ROUND_SECONDS * TICK; // keep in sync with ROUND_SECONDS
const FLY_TICKS = Math.round(TUNING.FLY_TICKS / STEP);
const TAP_HOLD = Math.round(10 / STEP);
const TRAIL_EVERY = Math.max(1, Math.round(2 / STEP));
const SPARK_LIFE = Math.round(10 / STEP);
const RING_LIFE = Math.round(12 / STEP);
const SHAKE_TICKS = Math.round(5 / STEP);
const TRAIL_LIFE = Math.round(TUNING.MAX_TRAIL / STEP);
const DT = 1 / TICK;
const TAU = Math.PI * 2;

const ACT = {
    pin: 'fidget', crumb: 'fidget', key: 'fidget', crayon: 'roll',
    paperclip: 'fidget', banana: 'fidget', mug: 'mug', book: 'rock',
    coin: 'spin', die: 'spin',
    leaf: 'flutter',
    bug: 'critter', mouse: 'critter', fish: 'swim', duck: 'critter',
    cat: 'cat', dog: 'dog', person: 'person',
    chair: 'rock', lamp: 'sway', hydrant: 'rock', cone: 'rock',
    cactus: 'sway', bench: 'rock',
    bike: 'vehicle', car: 'vehicle', truck: 'vehicle', bus: 'vehicle',
    tree: 'sway', house: 'rock', tower: 'rock', hill: 'rock',
    cloud: 'drift', bird: 'fly',
    star: 'celestial', moon: 'celestial', planet: 'celestial', sun: 'celestial'
};

const BY_ID = {};
TYPES.forEach(t => { BY_ID[t.id] = t; });

// Each ring mixes snacks you can eat at that scale with bigger things that
// block, chase, or run you over until you grow into them.
const ZONES = [
    { r0: 0.55, r1: 4.2, packs: [
        ['pin', 80], ['crumb', 55], ['bug', 32], ['coin', 10], ['paperclip', 6]
    ] },
    { r0: 3.8, r1: 11, packs: [
        ['pin', 16], ['crayon', 8], ['key', 6], ['coin', 6]
    ] },
    { r0: 3.4, r1: 12, packs: [
        ['die', 6], ['book', 7], ['mug', 5], ['banana', 4]
    ] },
    { r0: 8, r1: 36, packs: [
        ['leaf', 16], ['mouse', 12], ['cat', 12], ['duck', 8], ['fish', 8],
        ['chair', 11], ['lamp', 7], ['dog', 8], ['person', 14], ['bench', 5]
    ] },
    { r0: 28, r1: 105, packs: [
        ['person', 28], ['dog', 6], ['cat', 6], ['bike', 10],
        ['cone', 12], ['hydrant', 8], ['cactus', 6],
        ['car', 14], ['tree', 8]
    ] },
    { r0: 85, r1: 230, packs: [
        ['car', 10], ['truck', 8], ['bus', 6], ['tree', 14],
        ['house', 14], ['person', 8], ['cloud', 5], ['bird', 10]
    ] },
    { r0: 190, r1: 430, packs: [
        ['cloud', 7], ['bird', 12], ['tower', 8], ['hill', 7],
        ['star', 14], ['moon', 3], ['planet', 2], ['sun', 1]
    ] }
];

const DESK_WALLS = [
    { id: 'book', ang: 0.55, d: 1.85 },
    { id: 'book', ang: 1.15, d: 2.05 },
    { id: 'die', ang: 0.7, d: 1.25 },
    { id: 'book', ang: 2.35, d: 1.9 },
    { id: 'mug', ang: 2.95, d: 1.5 },
    { id: 'book', ang: 3.55, d: 2.15 },
    { id: 'mug', ang: 4.45, d: 2.35 },
    { id: 'book', ang: 5.35, d: 1.95 },
    { id: 'banana', ang: 5.9, d: 1.45 }
];

const INK = [40, 32, 48, 255];
const CREAM = [255, 244, 226, 255];
const BAR_BG = [40, 30, 50, 255];
const BAR_FILL = [255, 90, 160, 255];

const SKIES = [
    { at: 3.2, c: [255, 236, 214, 255] },
    { at: 14, c: [186, 220, 168, 255] },
    { at: 45, c: [168, 198, 216, 255] },
    { at: 110, c: [78, 130, 188, 255] },
    { at: 220, c: [16, 12, 36, 255] }
];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
const lerp = (a, b, t) => a + (b - a) * t;
const hypot = Math.hypot;

const lerpColor = (a, b, t) => {
    t = clamp(t, 0, 1);
    return [clampByte(lerp(a[0], b[0], t)), clampByte(lerp(a[1], b[1], t)), clampByte(lerp(a[2], b[2], t)), 255];
};

const skyAt = (viewW) => {
    if (viewW <= SKIES[0].at) return SKIES[0].c.slice();
    for (let i = 1; i < SKIES.length; i++) {
        if (viewW <= SKIES[i].at) {
            const t = (viewW - SKIES[i - 1].at) / (SKIES[i].at - SKIES[i - 1].at);
            return lerpColor(SKIES[i - 1].c, SKIES[i].c, t);
        }
    }
    return SKIES[SKIES.length - 1].c.slice();
};

const hueColor = (h, s, v) => {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r, g, b;
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        default: r = v; g = p; b = q;
    }
    return [clampByte(r * 255), clampByte(g * 255), clampByte(b * 255), 255];
};

const polyCircle = (cx, cy, r, sides) => {
    const n = sides || 16;
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

const xform = (verts, x, y, angle, sx, sy) => {
    if (sy == null) sy = sx;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const out = [];
    for (let i = 0; i < verts.length; i++) {
        const vx = verts[i][0] * sx;
        const vy = verts[i][1] * sy;
        out.push([x + vx * c - vy * s, y + vx * s + vy * c]);
    }
    return out;
};

const turnToward = (heading, target, maxTurn) => {
    let d = target - heading;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return heading + clamp(d, -maxTurn, maxTurn);
};

const formatSize = (r) => {
    const cm = r * 80;
    if (cm < 100) return Math.max(1, Math.round(cm)) + ' cm';
    const m = cm / 100;
    if (m < 1000) return (m < 10 ? m.toFixed(1) : Math.round(m)) + ' m';
    return (m / 1000).toFixed(1) + ' km';
};

class Clump extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Clump',
            author: 'Joseph Garcia',
            description: 'A polygonal katamari. Roll up pins, cats, cars, and the moon before the King gets bored.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 120,       // keep in sync with TUNING.TICK
            maxPlayers: 1        // keep in sync with TUNING.MAX_PLAYERS
        };
    }

    constructor() {
        super();
        this._t = 0;
        this.phase = 'playing';
        this.keys = {};
        this.tapDX = 0;
        this.tapDY = 0;
        this.tapUntil = 0;
        this._cand = [];

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: SKIES[0].c.slice()
        });

        this.groundLayer = this.makeContainer();
        this.worldLayer = this.makeContainer();
        this.trailLayer = this.makeContainer();
        this.stuckLayer = this.makeContainer();
        this.fxLayer = this.makeContainer();
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (playerId, x, y) => this.handleTap(playerId, x, y)
        });
        this.hud = this.makeContainer();

        this.core = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(50, 50, 2, 16),
            fill: [255, 90, 170, 255],
            effects: glow([255, 90, 170, 255], 18)
        });
        this.coreInner = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(50, 50, 0.8, 12),
            fill: [255, 230, 160, 255]
        });

        this.worldPool = this.makePool(TUNING.MAX_WORLD_DRAW, this.worldLayer);
        this.stuckPool = this.makePool(TUNING.MAX_STUCK, this.stuckLayer);
        this.trailPool = this.makePool(TUNING.MAX_TRAIL, this.trailLayer);
        this.sparkPool = this.makePool(TUNING.MAX_SPARKS, this.fxLayer);
        this.ringPool = this.makePool(TUNING.MAX_RINGS, this.fxLayer);
        this.groundPool = this.makePool(TUNING.MAX_GROUND, this.groundLayer);

        this.base.addChildren(
            this.groundLayer,
            this.worldLayer,
            this.trailLayer,
            this.core,
            this.coreInner,
            this.stuckLayer,
            this.fxLayer,
            this.hud,
            this.tapCatcher
        );

        // Time remaining — a shrinking bar, no numbers. Size is the zoom.
        this.timeBarBg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(8, 2.2, 84, 1.1),
            fill: BAR_BG
        });
        this.timeBar = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(8, 2.2, 84, 1.1),
            fill: BAR_FILL
        });
        this.overText = this.makeText('', 50, 46, 3.4, CREAM, 'center');
        this.hud.addChildren(this.timeBarBg, this.timeBar, this.overText);

        this.stars = [];
        for (let i = 0; i < 80; i++) {
            this.stars.push({
                x: Math.random() * WORLD,
                y: Math.random() * WORLD,
                r: 0.4 + Math.random() * 1.2
            });
        }

        this.resetRun();
        this.phase = 'playing';
        this.roundStart = 0;
        this.clockArmed = false;
    }

    getLayers() {
        return [{ root: this.base }];
    }

    makeContainer() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    makeText(str, x, y, size, color, align) {
        return new GameNode.Text({
            textInfo: { text: str, x, y, size, align: align || 'left', font: 'monospace', color }
        });
    }

    makePool(n, layer) {
        const pool = [];
        for (let i = 0; i < n; i++) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: [0, 0, 0, 0]
            });
            layer.addChild(node);
            pool.push(node);
        }
        return pool;
    }

    hideNode(node) {
        node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        node.node.fill = [0, 0, 0, 0];
        node.node.color = [255, 255, 255, 255];
        node.node.effects = null;
    }

    setText(node, str, color) {
        const prev = node.node.text;
        if (prev.text === str && (!color || prev.color === color)) return;
        node.node.text = {
            text: str,
            x: prev.x,
            y: prev.y,
            size: prev.size,
            align: prev.align,
            font: prev.font,
            color: color || prev.color
        };
    }

    // --- lifecycle ---

    handleNewPlayer() {}

    handlePlayerDisconnect() {
        this.keys = {};
    }

    handleKeyDown(playerId, key) {
        this.keys[key] = true;
        if (this.phase === 'over') this.restart();
        else if (this.phase === 'playing') this.armClock();
    }

    handleKeyUp(playerId, key) {
        this.keys[key] = false;
    }

    handleTap(playerId, x, y) {
        if (this.phase === 'over') {
            this.restart();
            return;
        }
        if (this.phase !== 'playing') return;
        this.tapDX = x - 50;
        this.tapDY = y - 50;
        this.tapUntil = this._t + TAP_HOLD;
        this.armClock();
    }

    restart() {
        if (this.phase !== 'over') return;
        this.resetRun();
        this.phase = 'playing';
        this.roundStart = this._t;
        this.clockArmed = false;
        this.setText(this.overText, '');
    }

    resetRun() {
        this.player = {
            x: WORLD / 2,
            y: WORLD / 2,
            r: TUNING.START_R,
            angle: 0,
            vx: 0,
            vy: 0
        };
        this.volume = this.player.r * this.player.r;
        this.stuck = [];
        this.objects = [];
        this.sparks = [];
        this.rings = [];
        this.trail = [];
        this.eaten = 0;
        this.ateMoon = false;
        this.won = false;
        this._overDrawn = false;
        this.shakeT = 0;
        this.shakeMag = 0;
        this.camPunch = 0;
        this.viewW = TUNING.MIN_VIEW;
        this.viewX = this.player.x - this.viewW / 2;
        this.viewY = this.player.y - this.viewW / 2;
        this.roundStart = this._t;
        this.clockArmed = false;
        this.stunT = 0;
        this.pickupLock = 0;
        this.seedStuck();
        this.generateWorld();
        for (let i = 0; i < TUNING.MAX_TRAIL; i++) {
            this.trail.push({ x: this.player.x, y: this.player.y, life: 0 });
        }
    }

    armClock() {
        if (this.clockArmed) return;
        this.clockArmed = true;
        this.roundStart = this._t;
    }

    endRun(won) {
        this.phase = 'over';
        this.won = won;
        this.setText(this.overText, formatSize(this.player.r), this.viewW > 140 ? CREAM : INK);
    }

    seedStuck() {
        const pin = TYPES[0];
        for (let i = 0; i < 7; i++) {
            const col = pin.colors[i % pin.colors.length];
            this.stuck.push({
                verts: pin.verts,
                r: TUNING.START_R * (0.35 + i * 0.04),
                color: col.slice(),
                attach: (i / 7) * Math.PI * 2,
                ratio: 0.78 + (i % 3) * 0.08,
                spin: i * 0.7,
                fly: 0,
                fromX: 0,
                fromY: 0,
                glow: false
            });
        }
    }

    generateWorld() {
        const cx = WORLD / 2;
        const cy = WORLD / 2;
        this.placed = [];
        for (let i = 0; i < DESK_WALLS.length; i++) {
            const w = DESK_WALLS[i];
            this.spawnAt(w.id, cx + Math.cos(w.ang) * w.d, cy + Math.sin(w.ang) * w.d, 1, true);
        }
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * TAU + 0.11;
            const d = 0.52 + (i % 3) * 0.12;
            this.spawnAt(i % 2 ? 'pin' : 'crumb', cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.95, true);
        }
        for (let z = 0; z < ZONES.length; z++) {
            const zone = ZONES[z];
            for (let p = 0; p < zone.packs.length; p++) {
                const id = zone.packs[p][0];
                const count = zone.packs[p][1];
                for (let n = 0; n < count; n++) this.spawnInRing(id, zone.r0, zone.r1);
            }
        }
        this.placed = null;
    }

    spawnInRing(id, r0, r1) {
        const cx = WORLD / 2;
        const cy = WORLD / 2;
        const type = BY_ID[id];
        if (!type) return;
        for (let tries = 0; tries < 22; tries++) {
            const d = r0 + Math.random() * (r1 - r0);
            const a = Math.random() * TAU;
            const x = cx + Math.cos(a) * d;
            const y = cy + Math.sin(a) * d;
            if (this.spawnAt(id, x, y, 0.88 + Math.random() * 0.28)) return;
        }
    }

    spawnAt(id, x, y, scale, force) {
        const type = BY_ID[id];
        if (!type) return false;
        if (x < 8 || y < 8 || x > WORLD - 8 || y > WORLD - 8) return false;
        const r = type.r * scale;
        const cx = WORLD / 2;
        const cy = WORLD / 2;
        if (!force && r > 0.08 && hypot(x - cx, y - cy) < 1.2) return false;
        const pad = this.placed || [];
        for (let i = 0; i < pad.length; i++) {
            const o = pad[i];
            if (hypot(o.x - x, o.y - y) < (o.r + r) * 1.12) return false;
        }
        const heading = Math.random() * TAU;
        const obj = {
            type: type.id,
            label: type.label,
            verts: type.verts,
            x, y, r,
            homeX: x,
            homeY: y,
            angle: heading,
            heading,
            color: type.colors[pad.length % type.colors.length].slice(),
            act: ACT[type.id] || 'fidget',
            flee: type.flee || 0,
            glow: !!type.glow,
            taken: false,
            vx: 0,
            vy: 0,
            mood: 'idle',
            moodT: Math.random() * 1.2,
            phase: Math.random() * TAU,
            seed: Math.random() * TAU,
            spinRate: 0.8 + Math.random() * 2.4,
            walk: 0,
            bob: 0,
            squash: 1,
            rock: 0,
            destX: x,
            destY: y,
            restAngle: heading,
            orbit: 3 + Math.random() * 10,
            touching: false
        };
        this.objects.push(obj);
        pad.push(obj);
        return true;
    }

    // --- sim ---

    tick() {
        this._t++;
        if (this.phase === 'over') {
            if (!this._overDrawn) {
                this.render();
                this.base.node.onStateChange();
                this._overDrawn = true;
            }
            return;
        }

        this.updateLife();
        if (this.phase === 'playing') {
            this.updatePlayer();
            this.collide();
            if (this.phase !== 'playing') {
                this.render();
                this.base.node.onStateChange();
                this._overDrawn = true;
                return;
            }
            const elapsed = this.clockArmed ? (this._t - this.roundStart) : 0;
            const left = ROUND_TICKS - elapsed;
            if (this.player.r >= TUNING.GOAL_R || this.ateMoon) {
                this.endRun(true);
                this.render();
                this.base.node.onStateChange();
                this._overDrawn = true;
                return;
            } else if (this.clockArmed && left <= 0) {
                this.endRun(this.player.r >= TUNING.GOAL_R * 0.7);
                this.render();
                this.base.node.onStateChange();
                this._overDrawn = true;
                return;
            }
        }

        this.updateTrail();
        this.updateFx();
        this.updateCamera();
        this.render();
        this.base.node.onStateChange();
    }

    steer() {
        let dx = 0, dy = 0;
        if (this.keys.ArrowUp || this.keys.w || this.keys.W) dy -= 1;
        if (this.keys.ArrowDown || this.keys.s || this.keys.S) dy += 1;
        if (this.keys.ArrowLeft || this.keys.a || this.keys.A) dx -= 1;
        if (this.keys.ArrowRight || this.keys.d || this.keys.D) dx += 1;
        if (dx === 0 && dy === 0 && this._t < this.tapUntil) {
            dx = this.tapDX;
            dy = this.tapDY;
        }
        const mag = hypot(dx, dy);
        if (mag < 0.001) return { dx: 0, dy: 0, mag: 0 };
        return { dx: dx / mag, dy: dy / mag, mag };
    }

    updatePlayer() {
        if (this.pickupLock > 0) this.pickupLock -= DT;
        const { dx, dy, mag } = this.steer();
        let speed = (TUNING.BASE_SPEED + this.player.r * TUNING.SPEED_K) * STEP;
        if (this.stunT > 0) {
            this.stunT -= DT;
            speed *= 0.25;
            const damp = Math.pow(0.94, STEP * 6);
            this.player.vx *= damp;
            this.player.vy *= damp;
            if (mag > 0) {
                this.player.vx += dx * speed;
                this.player.vy += dy * speed;
            }
        } else if (mag > 0) {
            this.player.vx = dx * speed;
            this.player.vy = dy * speed;
            const dist = hypot(this.player.vx, this.player.vy);
            this.player.angle += dist / Math.max(0.08, this.player.r);
        } else {
            const damp = Math.pow(0.72, STEP);
            this.player.vx *= damp;
            this.player.vy *= damp;
            if (hypot(this.player.vx, this.player.vy) < 0.004 * STEP) {
                this.player.vx = 0;
                this.player.vy = 0;
            }
        }
        const margin = this.player.r * 1.25;
        this.player.x = clamp(this.player.x + this.player.vx, margin, WORLD - margin);
        this.player.y = clamp(this.player.y + this.player.vy, margin, WORLD - margin);
    }

    updateLife() {
        const p = this.player;
        this.wind = Math.sin(this._t * 0.0022) * 0.7 + Math.sin(this._t * 0.006) * 0.35;
        for (let i = 0; i < this.objects.length; i++) {
            const o = this.objects[i];
            if (o.taken) continue;
            o.phase += DT;
            o.moodT -= DT;
            if (o.rock > 0) o.rock = Math.max(0, o.rock - DT * 1.8);

            const dx = o.x - p.x;
            const dy = o.y - p.y;
            const dist = hypot(dx, dy);
            const canEat = o.r <= p.r * TUNING.PICKUP;
            const near = dist < o.r * 9 + p.r * 6 + 4;
            const threatened = near && (canEat || p.r > o.r * 0.42);
            const almost = near && !canEat && p.r > o.r * 0.62;

            switch (o.act) {
                case 'fidget': this.liveFidget(o, threatened || almost); break;
                case 'roll': this.liveRoll(o, threatened); break;
                case 'spin': this.liveSpin(o, threatened || almost); break;
                case 'flutter': this.liveFlutter(o); break;
                case 'mug': this.liveMug(o, threatened, dist); break;
                case 'critter': this.liveWalker(o, p, dist, threatened, 1.15, 2.4, true, false); break;
                case 'cat': this.liveWalker(o, p, dist, threatened, 0.7, 2.2, true, false); break;
                case 'dog': this.liveWalker(o, p, dist, threatened, 1.0, 2.6, true, true); break;
                case 'person': this.liveWalker(o, p, dist, threatened, 1.05, 2.7, false, false); break;
                case 'swim': this.liveSwim(o, p, dist, threatened); break;
                case 'vehicle': this.liveVehicle(o, p, dist, threatened); break;
                case 'sway': this.liveSway(o, almost || threatened); break;
                case 'rock': this.liveRock(o, almost || threatened); break;
                case 'drift': this.liveDrift(o); break;
                case 'fly': this.liveFly(o, p, dist, threatened); break;
                case 'celestial': this.liveCelestial(o); break;
                default: this.liveFidget(o, threatened); break;
            }

            o.x = clamp(o.x, 8, WORLD - 8);
            o.y = clamp(o.y, 8, WORLD - 8);
        }
    }

    pickDest(o, radius) {
        const a = Math.random() * TAU;
        const d = (0.3 + Math.random() * 0.7) * radius;
        o.destX = clamp(o.homeX + Math.cos(a) * d, 10, WORLD - 10);
        o.destY = clamp(o.homeY + Math.sin(a) * d, 10, WORLD - 10);
    }

    liveFidget(o, nervous) {
        o.angle = o.restAngle + Math.sin(o.phase * 2.2 + o.seed) * 0.12;
        o.bob = Math.sin(o.phase * 3.1 + o.seed) * o.r * 0.06;
        o.squash = 1;
        if (nervous) o.rock = Math.max(o.rock, 0.55);
        if (o.rock > 0) o.angle += Math.sin(this._t * 0.45 + o.seed) * o.rock * 0.25;
    }

    liveRoll(o, threatened) {
        if (threatened) {
            const a = Math.atan2(o.y - this.player.y, o.x - this.player.x);
            o.x += Math.cos(a) * 0.6 * DT;
            o.y += Math.sin(a) * 0.6 * DT;
            o.angle += 8 * DT;
        } else {
            o.angle += Math.sin(o.phase * 0.7 + o.seed) * 0.4 * DT;
            o.x += Math.cos(o.restAngle) * 0.08 * DT;
            o.y += Math.sin(o.restAngle) * 0.08 * DT;
        }
        o.bob = 0;
        o.squash = 1;
    }

    liveSpin(o, nervous) {
        o.angle += o.spinRate * DT * (nervous ? 4 : 1);
        o.bob = Math.sin(o.phase * 5 + o.seed) * o.r * 0.08;
        o.squash = 1 + Math.sin(o.phase * 5 + o.seed) * 0.06;
        if (nervous) o.rock = Math.max(o.rock, 0.4);
    }

    liveFlutter(o) {
        o.angle = o.restAngle + this.wind * 0.55 + Math.sin(o.phase * 7 + o.seed) * 0.4;
        o.x += this.wind * 0.35 * DT;
        o.y += Math.sin(o.phase * 2.4 + o.seed) * 0.25 * DT;
        o.bob = Math.sin(o.phase * 6 + o.seed) * o.r * 0.15;
        o.squash = 1;
    }

    liveMug(o, threatened, dist) {
        this.liveFidget(o, threatened);
        if (dist < this.viewW * 0.75 && Math.random() < 1.6 * DT) this.emitSteam(o.x, o.y - o.r * 0.85);
    }

    liveWalker(o, p, dist, threatened, walkSpd, runSpd, hops, chases) {
        const play = chases && !threatened && p.r < o.r * 0.55 && dist < o.r * 14 + 6;
        if (threatened) {
            o.mood = 'flee';
            o.moodT = 0.4;
        } else if (play && o.mood !== 'chase') {
            o.mood = 'chase';
            o.moodT = 1.2;
        } else if (o.moodT <= 0) {
            if (o.mood === 'walk' || o.mood === 'flee' || o.mood === 'chase') {
                o.mood = hops && Math.random() < 0.22 ? 'hop' : (Math.random() < 0.55 ? 'idle' : 'walk');
            } else if (o.mood === 'hop') {
                o.mood = 'idle';
            } else {
                o.mood = Math.random() < 0.7 ? 'walk' : (hops && Math.random() < 0.35 ? 'hop' : 'idle');
            }
            o.moodT = o.mood === 'idle' ? 0.6 + Math.random() * 2.2
                : o.mood === 'hop' ? 0.28
                : 1.1 + Math.random() * 2.4;
            if (o.mood === 'walk') this.pickDest(o, 8 + o.r * 14);
        }

        let spd = 0;
        if (o.mood === 'flee') {
            const away = Math.atan2(o.y - p.y, o.x - p.x);
            o.heading = turnToward(o.heading, away, 10 * DT);
            spd = runSpd * (0.85 + (o.flee || 1) * 0.2);
        } else if (o.mood === 'chase') {
            o.heading = turnToward(o.heading, Math.atan2(p.y - o.y, p.x - o.x), 7 * DT);
            spd = runSpd * 0.85;
        } else if (o.mood === 'walk') {
            o.heading = turnToward(o.heading, Math.atan2(o.destY - o.y, o.destX - o.x), 4 * DT);
            spd = walkSpd;
            if (hypot(o.destX - o.x, o.destY - o.y) < o.r * 1.2) o.moodT = 0;
        } else if (o.mood === 'hop') {
            o.heading = turnToward(o.heading, Math.atan2(o.destY - o.y, o.destX - o.x), 3 * DT);
            spd = walkSpd * 1.3;
        } else {
            o.heading = turnToward(o.heading, o.heading + Math.sin(o.phase + o.seed) * 0.4, 1.2 * DT);
            spd = 0;
        }

        o.x += Math.cos(o.heading) * spd * DT;
        o.y += Math.sin(o.heading) * spd * DT;
        o.walk += spd * DT * (2.8 / Math.max(0.2, o.r));
        const moving = spd > 0.05;
        const waddle = moving ? Math.sin(o.walk) * 0.22 : Math.sin(o.phase * 1.3) * 0.05;
        o.angle = o.heading + waddle;
        if (o.mood === 'hop') {
            const k = 1 - Math.abs(0.5 - (o.moodT / 0.28)) * 2;
            o.bob = Math.max(0, k) * o.r * 1.1;
            o.squash = 1 - Math.max(0, k) * 0.18;
        } else if (moving) {
            o.bob = Math.abs(Math.sin(o.walk)) * o.r * 0.18;
            o.squash = 1 + Math.sin(o.walk * 2) * 0.07;
        } else {
            o.bob = Math.sin(o.phase * 2.2 + o.seed) * o.r * 0.04;
            o.squash = 1;
        }
        if (o.rock > 0) o.angle += Math.sin(this._t * 0.5) * o.rock * 0.2;
    }

    liveSwim(o, p, dist, threatened) {
        if (threatened) {
            o.heading = turnToward(o.heading, Math.atan2(o.y - p.y, o.x - p.x), 8 * DT);
        } else {
            const home = Math.atan2(o.homeY - o.y, o.homeX - o.x);
            const wander = o.heading + Math.sin(o.phase * 1.7 + o.seed) * 0.8;
            const target = hypot(o.x - o.homeX, o.y - o.homeY) > 10 ? home : wander;
            o.heading = turnToward(o.heading, target, 2.2 * DT);
        }
        const spd = threatened ? 2.8 : 1.5;
        o.x += Math.cos(o.heading) * spd * DT;
        o.y += Math.sin(o.heading) * spd * DT;
        o.angle = o.heading + Math.sin(o.phase * 8) * 0.18;
        o.bob = Math.sin(o.phase * 8) * o.r * 0.12;
        o.squash = 1 + Math.sin(o.phase * 8) * 0.1;
    }

    liveVehicle(o, p, dist, threatened) {
        const cruise = o.type === 'bike' ? 2.2 : o.type === 'car' ? 4.2 : o.type === 'truck' ? 3.2 : 2.8;
        if (o.moodT <= 0) {
            o.mood = 'drive';
            o.moodT = 2 + Math.random() * 4;
            this.pickDest(o, 40 + o.r * 12);
        }
        let target = Math.atan2(o.destY - o.y, o.destX - o.x);
        let spd = cruise;
        if (threatened) {
            target = Math.atan2(o.y - p.y, o.x - p.x);
            spd = cruise * 1.35;
            o.rock = Math.max(o.rock, 0.35);
        }
        o.heading = turnToward(o.heading, target, (threatened ? 3.2 : 1.4) * DT);
        o.x += Math.cos(o.heading) * spd * DT;
        o.y += Math.sin(o.heading) * spd * DT;
        o.angle = o.heading;
        o.bob = Math.sin(o.phase * 14) * o.r * 0.03;
        o.squash = 1;
        if (hypot(o.destX - o.x, o.destY - o.y) < o.r * 2) o.moodT = 0;
        if (o.x < 12 || o.x > WORLD - 12 || o.y < 12 || o.y > WORLD - 12) {
            o.heading = Math.atan2(WORLD / 2 - o.y, WORLD / 2 - o.x);
        }
    }

    liveSway(o, nervous) {
        o.angle = o.restAngle + this.wind * (0.1 + o.r * 0.004) + Math.sin(o.phase * 0.9 + o.seed) * 0.04;
        o.bob = 0;
        o.squash = 1 + this.wind * 0.02;
        if (nervous) {
            o.rock = Math.max(o.rock, 0.7);
            o.angle += Math.sin(this._t * 0.55 + o.seed) * o.rock * 0.12;
        }
    }

    liveRock(o, nervous) {
        o.angle = o.restAngle;
        o.bob = 0;
        o.squash = 1;
        if (nervous) o.rock = Math.max(o.rock, 0.5);
        if (o.rock > 0) o.angle += Math.sin(this._t * 0.5 + o.seed) * o.rock * 0.18;
    }

    liveDrift(o) {
        o.x += (0.55 + this.wind * 0.4) * DT;
        o.y += Math.sin(o.phase * 0.5 + o.seed) * 0.35 * DT;
        o.angle = o.restAngle + this.wind * 0.12;
        o.bob = Math.sin(o.phase * 0.8) * o.r * 0.05;
        o.squash = 1 + Math.sin(o.phase * 0.8) * 0.04;
        if (o.x > WORLD - 8) o.x = 8;
    }

    liveFly(o, p, dist, threatened) {
        const t = o.phase * 0.9 + o.seed;
        const ox = o.homeX + Math.cos(t) * o.orbit;
        const oy = o.homeY + Math.sin(t * 2) * o.orbit * 0.55;
        if (threatened) {
            o.heading = turnToward(o.heading, Math.atan2(o.y - p.y, o.x - p.x), 9 * DT);
            o.x += Math.cos(o.heading) * 6.5 * DT;
            o.y += Math.sin(o.heading) * 6.5 * DT;
        } else {
            o.heading = turnToward(o.heading, Math.atan2(oy - o.y, ox - o.x), 5 * DT);
            o.x += Math.cos(o.heading) * 4.2 * DT;
            o.y += Math.sin(o.heading) * 4.2 * DT;
        }
        const flap = Math.sin(o.phase * 18);
        o.angle = o.heading;
        o.bob = flap * o.r * 0.2;
        o.squash = 1 + flap * 0.22;
    }

    liveCelestial(o) {
        o.angle += (0.15 + o.spinRate * 0.05) * DT;
        o.bob = Math.sin(o.phase * 0.6 + o.seed) * o.r * 0.03;
        o.squash = 1 + Math.sin(o.phase * 1.4 + o.seed) * 0.04;
    }

    collide() {
        const p = this.player;
        const magnet = p.r * TUNING.MAGNET;
        for (let i = 0; i < this.objects.length; i++) {
            const o = this.objects[i];
            if (o.taken) continue;
            const dx = o.x - p.x;
            const dy = o.y - p.y;
            const dist = hypot(dx, dy);
            const rad = p.r + o.r;
            if (dist > magnet + o.r && dist > rad) {
                o.touching = false;
                continue;
            }

            const canEat = o.r <= p.r * TUNING.PICKUP;
            if (canEat) {
                o.touching = false;
                if (dist > 0.001 && dist < magnet + o.r && dist > rad * 0.96) {
                    const pull = 0.55 * DT;
                    o.x -= (dx / dist) * pull;
                    o.y -= (dy / dist) * pull;
                }
                if (dist <= rad * 1.01 && this.pickupLock <= 0) this.pickup(o);
                continue;
            }
            if (dist < rad && dist > 0.001) {
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = rad - dist;
                p.x -= nx * overlap;
                p.y -= ny * overlap;
                if (!o.touching) {
                    o.touching = true;
                    const hazard = o.act === 'vehicle' || o.mood === 'chase' || o.mood === 'flee';
                    const hit = (hazard ? 0.07 : 0.04) + o.r * 0.018;
                    p.vx = -nx * hit;
                    p.vy = -ny * hit;
                    this.stunT = hazard ? 0.28 : 0.16;
                    this.shakeT = hazard ? SHAKE_TICKS * 1.6 : SHAKE_TICKS;
                    this.shakeMag = hazard ? 1.4 : 0.9;
                    o.rock = Math.max(o.rock, 1);
                    this.emitSparks(p.x + nx * p.r, p.y + ny * p.r, o.color, hazard ? 8 : 4);
                }
            } else {
                o.touching = false;
            }
        }
    }

    pickup(o) {
        o.taken = true;
        this.eaten++;
        this.volume += TUNING.GAIN * o.r * o.r;
        this.player.r = Math.sqrt(this.volume);
        const ang = Math.atan2(o.y - this.player.y, o.x - this.player.x) - this.player.angle;
        this.stuck.push({
            verts: o.verts,
            r: o.r,
            color: o.color,
            attach: ang,
            ratio: 0.74 + Math.random() * 0.28,
            spin: o.angle,
            fly: FLY_TICKS,
            fromX: o.x,
            fromY: o.y,
            glow: o.glow
        });
        while (this.stuck.length > TUNING.MAX_STUCK) {
            let smallest = 0;
            for (let i = 1; i < this.stuck.length; i++) {
                if (this.stuck[i].r < this.stuck[smallest].r) smallest = i;
            }
            this.stuck.splice(smallest, 1);
        }
        this.pickupLock = TUNING.PICKUP_GAP;
        this.emitSparks(o.x, o.y, o.color, 4);
        this.emitRing(this.player.x, this.player.y, o.color, Math.min(5, o.r * 1.4));
        this.camPunch = Math.min(0.12, this.camPunch + o.r * 0.02);
        if (o.type === 'moon' || o.type === 'sun' || o.type === 'planet') this.ateMoon = true;
    }

    emitSparks(x, y, color, count) {
        let need = count;
        for (let i = 0; i < this.sparks.length && need > 0; i++) {
            if (this.sparks[i].life > 0) continue;
            const a = Math.random() * Math.PI * 2;
            const sp = 0.15 + Math.random() * 0.35;
            this.sparks[i] = { x, y, vx: Math.cos(a) * sp * STEP, vy: Math.sin(a) * sp * STEP, life: SPARK_LIFE, max: SPARK_LIFE, color };
            need--;
        }
        while (need > 0 && this.sparks.length < TUNING.MAX_SPARKS) {
            const a = Math.random() * Math.PI * 2;
            const sp = 0.15 + Math.random() * 0.35;
            this.sparks.push({ x, y, vx: Math.cos(a) * sp * STEP, vy: Math.sin(a) * sp * STEP, life: SPARK_LIFE, max: SPARK_LIFE, color });
            need--;
        }
    }

    emitSteam(x, y) {
        const color = [220, 225, 235, 255];
        const puff = {
            x, y,
            vx: (Math.random() - 0.5) * 0.008,
            vy: -(0.01 + Math.random() * 0.01),
            life: SPARK_LIFE * 1.4,
            max: SPARK_LIFE * 1.4,
            color
        };
        for (let i = 0; i < this.sparks.length; i++) {
            if (this.sparks[i].life > 0) continue;
            this.sparks[i] = puff;
            return;
        }
        if (this.sparks.length < TUNING.MAX_SPARKS) this.sparks.push(puff);
    }

    emitRing(x, y, color, r) {
        let slot = this.rings.find(n => n.life <= 0);
        if (!slot) {
            if (this.rings.length >= TUNING.MAX_RINGS) return;
            slot = { x: 0, y: 0, r: 0, vr: 0, life: 0, max: 0, color: CREAM };
            this.rings.push(slot);
        }
        slot.x = x;
        slot.y = y;
        slot.r = r * 0.4;
        slot.vr = (0.35 + r * 0.08) * STEP;
        slot.life = RING_LIFE;
        slot.max = RING_LIFE;
        slot.color = color;
    }

    updateTrail() {
        if (this._t % TRAIL_EVERY !== 0) return;
        const slot = this.trail[this._t % this.trail.length];
        slot.x = this.player.x;
        slot.y = this.player.y;
        slot.life = TRAIL_LIFE;
        slot.r = this.player.r * 0.45;
        slot.color = hueColor(((this._t * 0.008 * STEP) % 1), 0.65, 1);
    }

    updateFx() {
        for (let i = 0; i < this.sparks.length; i++) {
            const s = this.sparks[i];
            if (s.life <= 0) continue;
            s.x += s.vx;
            s.y += s.vy;
            s.life--;
        }
        for (let i = 0; i < this.rings.length; i++) {
            const r = this.rings[i];
            if (r.life <= 0) continue;
            r.r += r.vr;
            r.life--;
        }
        for (let i = 0; i < this.trail.length; i++) {
            if (this.trail[i].life > 0) this.trail[i].life--;
        }
        if (this.shakeT > 0) this.shakeT--;
        this.camPunch *= Math.pow(0.82, STEP);
        if (this.camPunch < 0.01) this.camPunch = 0;
        for (let i = 0; i < this.stuck.length; i++) {
            const s = this.stuck[i];
            if (s.fly > 0) s.fly--;
        }
    }

    updateCamera() {
        const target = Math.max(TUNING.MIN_VIEW, this.player.r * TUNING.VIEW_MUL);
        const punched = target * (1 - this.camPunch);
        this.viewW = lerp(this.viewW, punched, 1 - Math.pow(1 - 0.12, STEP));
        this.viewW = clamp(this.viewW, TUNING.MIN_VIEW, WORLD * 0.98);
        let vx = this.player.x - this.viewW / 2;
        let vy = this.player.y - this.viewW / 2;
        if (this.shakeT > 0) {
            const m = this.shakeMag * (this.shakeT / SHAKE_TICKS) * this.viewW * 0.012;
            vx += (Math.random() - 0.5) * m;
            vy += (Math.random() - 0.5) * m;
        }
        this.viewX = clamp(vx, 0, WORLD - this.viewW);
        this.viewY = clamp(vy, 0, WORLD - this.viewW);
    }

    // --- render ---

    toView(wx, wy) {
        return [
            ((wx - this.viewX) / this.viewW) * 100,
            ((wy - this.viewY) / this.viewW) * 100
        ];
    }

    projectPoly(worldPoly) {
        const out = [];
        for (let i = 0; i < worldPoly.length; i++) {
            const p = this.toView(worldPoly[i][0], worldPoly[i][1]);
            out.push(p);
        }
        return out;
    }

    fullyOnLeftTop(sx, sy, half) {
        return sx - half >= 0 && sy - half >= 0;
    }

    render() {
        this.base.node.fill = skyAt(this.viewW);
        this.renderGround();
        this.renderWorld();
        this.renderTrail();
        this.renderStuck();
        this.renderCore();
        this.renderFx();
        this.renderHud();
    }

    renderGround() {
        const pool = this.groundPool;
        let used = 0;
        if (this.viewW > 140) {
            for (let i = 0; i < this.stars.length && used < pool.length; i++) {
                const s = this.stars[i];
                const [sx, sy] = this.toView(s.x, s.y);
                const sr = (s.r / this.viewW) * 100;
                if (!this.fullyOnLeftTop(sx, sy, sr)) continue;
                if (sx > 100 || sy > 100) continue;
                const node = pool[used++];
                node.node.coordinates2d = polyCircle(sx, sy, Math.max(0.15, sr), 8);
                node.node.fill = [255, 255, 230, 255];
                node.node.color = [255, 255, 255, 180];
                node.node.effects = null;
            }
        } else {
            const step = this.viewW < 8 ? 1.2 : this.viewW < 28 ? 4 : this.viewW < 70 ? 12 : 28;
            const x0 = Math.floor(this.viewX / step) * step;
            for (let gx = x0; gx <= this.viewX + this.viewW + step && used < pool.length; gx += step) {
                const sx = ((gx - this.viewX) / this.viewW) * 100;
                if (sx < 0 || sx > 100) continue;
                const node = pool[used++];
                const w = Math.max(0.12, 0.18 * (8 / this.viewW));
                node.node.coordinates2d = ShapeUtils.rectangle(sx, 0, w, 100);
                node.node.fill = this.viewW < 20 ? [230, 200, 170, 255] : [160, 200, 150, 255];
                node.node.effects = null;
            }
            const y0 = Math.floor(this.viewY / step) * step;
            for (let gy = y0; gy <= this.viewY + this.viewW + step && used < pool.length; gy += step) {
                const sy = ((gy - this.viewY) / this.viewW) * 100;
                if (sy < 0 || sy > 100) continue;
                const node = pool[used++];
                const h = Math.max(0.12, 0.18 * (8 / this.viewW));
                node.node.coordinates2d = ShapeUtils.rectangle(0, sy, 100, h);
                node.node.fill = this.viewW < 20 ? [230, 200, 170, 255] : [160, 200, 150, 255];
                node.node.effects = null;
            }
        }
        for (let i = used; i < pool.length; i++) this.hideNode(pool[i]);
    }

    renderWorld() {
        const vw = this.viewW;
        const vx = this.viewX;
        const vy = this.viewY;
        const cand = this._cand;
        cand.length = 0;
        for (let i = 0; i < this.objects.length; i++) {
            const o = this.objects[i];
            if (o.taken) continue;
            if (o.x + o.r < vx || o.x - o.r > vx + vw) continue;
            if (o.y + o.r < vy || o.y - o.r > vy + vw) continue;
            const sr = (o.r / vw) * 100;
            if (sr < 0.42) continue;
            cand.push(o);
        }
        cand.sort((a, b) => a.y - b.y);
        const n = Math.min(cand.length, this.worldPool.length);
        for (let i = 0; i < n; i++) {
            const o = cand[i];
            const jitter = o.rock > 0 ? Math.sin(this._t * 0.55 + o.seed) * o.rock * o.r * 0.14 : 0;
            const visX = o.x + jitter;
            const visY = o.y + (o.bob || 0);
            const [sx, sy] = this.toView(visX, visY);
            const sr = (o.r / vw) * 100;
            if (!this.fullyOnLeftTop(sx, sy, sr * 0.95)) {
                this.hideNode(this.worldPool[i]);
                continue;
            }
            const sq = o.squash || 1;
            const poly = this.projectPoly(xform(o.verts, visX, visY, o.angle, o.r * sq, o.r / sq));
            const node = this.worldPool[i];
            node.node.coordinates2d = poly;
            node.node.fill = o.color;
            node.node.color = [255, 255, 255, 255];
            node.node.effects = o.glow ? glow(o.color, 14) : null;
        }
        for (let i = n; i < this.worldPool.length; i++) this.hideNode(this.worldPool[i]);
    }

    renderTrail() {
        for (let i = 0; i < this.trailPool.length; i++) {
            const t = this.trail[i];
            const node = this.trailPool[i];
            if (!t || t.life <= 0) {
                this.hideNode(node);
                continue;
            }
            const [sx, sy] = this.toView(t.x, t.y);
            const sr = (t.r / this.viewW) * 100 * (t.life / TRAIL_LIFE);
            if (!this.fullyOnLeftTop(sx, sy, sr)) {
                this.hideNode(node);
                continue;
            }
            const a = clampByte(160 * (t.life / TRAIL_LIFE));
            node.node.coordinates2d = polyCircle(sx, sy, Math.max(0.2, sr), 8);
            node.node.fill = t.color;
            node.node.color = [255, 255, 255, a];
            node.node.effects = null;
        }
    }

    renderStuck() {
        const p = this.player;
        for (let i = 0; i < this.stuckPool.length; i++) {
            const s = this.stuck[i];
            const node = this.stuckPool[i];
            if (!s) {
                this.hideNode(node);
                continue;
            }
            const worldAng = p.angle + s.attach;
            const dist = p.r * s.ratio;
            let wx = p.x + Math.cos(worldAng) * dist;
            let wy = p.y + Math.sin(worldAng) * dist;
            if (s.fly > 0) {
                const t = 1 - s.fly / FLY_TICKS;
                const e = t * t;
                wx = lerp(s.fromX, wx, e);
                wy = lerp(s.fromY, wy, e);
            }
            const sr = (s.r / this.viewW) * 100;
            if (sr < 0.28) {
                this.hideNode(node);
                continue;
            }
            const [sx, sy] = this.toView(wx, wy);
            if (!this.fullyOnLeftTop(sx, sy, sr * 0.7)) {
                this.hideNode(node);
                continue;
            }
            const poly = this.projectPoly(xform(s.verts, wx, wy, worldAng + s.spin, s.r));
            node.node.coordinates2d = poly;
            node.node.fill = s.color;
            node.node.color = [255, 255, 255, 255];
            node.node.effects = s.glow ? glow(s.color, 12) : null;
        }
    }

    renderCore() {
        const p = this.player;
        const [sx, sy] = this.toView(p.x, p.y);
        const sr = (p.r / this.viewW) * 100;
        const hue = ((this._t * 0.008 * STEP) % 1);
        const col = hueColor(hue, 0.55, 1);
        const inner = hueColor((hue + 0.12) % 1, 0.25, 1);
        const coreR = Math.max(0.6, sr * 0.42);
        if (!this.fullyOnLeftTop(sx, sy, coreR)) {
            this.hideNode(this.core);
            this.hideNode(this.coreInner);
            return;
        }
        this.core.node.coordinates2d = polyCircle(sx, sy, coreR, 16);
        this.core.node.fill = col;
        this.core.node.effects = glow(col, 16);
        this.coreInner.node.coordinates2d = polyCircle(sx, sy, coreR * 0.42, 12);
        this.coreInner.node.fill = inner;
    }

    renderFx() {
        for (let i = 0; i < this.sparkPool.length; i++) {
            const s = this.sparks[i];
            const node = this.sparkPool[i];
            if (!s || s.life <= 0) {
                this.hideNode(node);
                continue;
            }
            const [sx, sy] = this.toView(s.x, s.y);
            const k = s.life / s.max;
            const sr = 0.55 * k;
            if (!this.fullyOnLeftTop(sx, sy, sr)) {
                this.hideNode(node);
                continue;
            }
            node.node.coordinates2d = ShapeUtils.rectangle(sx - sr, sy - sr, sr * 2, sr * 2);
            node.node.fill = s.color;
            node.node.color = [255, 255, 255, clampByte(220 * k)];
            node.node.effects = null;
        }
        for (let i = 0; i < this.ringPool.length; i++) {
            const r = this.rings[i];
            const node = this.ringPool[i];
            if (!r || r.life <= 0) {
                this.hideNode(node);
                continue;
            }
            const [sx, sy] = this.toView(r.x, r.y);
            const sr = (r.r / this.viewW) * 100;
            if (!this.fullyOnLeftTop(sx, sy, sr) || sr < 0.4) {
                this.hideNode(node);
                continue;
            }
            const k = r.life / r.max;
            node.node.coordinates2d = polyCircle(sx, sy, sr, 16);
            node.node.fill = [r.color[0], r.color[1], r.color[2], 255];
            node.node.color = [255, 255, 255, clampByte(160 * k)];
            node.node.effects = null;
        }
    }

    renderHud() {
        const elapsed = this.clockArmed ? (this._t - this.roundStart) : 0;
        const t = this.phase === 'over' ? 0 : clamp(1 - elapsed / ROUND_TICKS, 0, 1);
        this.timeBar.node.coordinates2d = ShapeUtils.rectangle(8, 2.2, Math.max(0, 84 * t), 1.1);
        if (this.phase !== 'over') this.setText(this.overText, '');
    }
}

module.exports = Clump;
