// Drag ’n’ Drop — a local solo dragon sanctuary. Physics advances at a fixed 60 Hz.
const { Asset, Game } = require('squish-150');
const view = require('./view');

// ---------------------------------------------------------------- tuning ----
const TUNING = {
    TICK: 60,                    // MUST match the tickRate literal in metadata()

    PIT: { X0: 17, X1: 83, FLOOR: 89, TOP: 31, OVERFLOW: 43 },

    BALLS: {
        radius: 3.6,
        pool: 96,               // fixed body budget, independent of run length
        fillTo: 67,              // initial population fills floor up to this y
        colors: 6
    },

    PHYS: {
        gravity: 0.16,
        drag: 0.996,
        restitution: 0.3,
        friction: 0.94,
        iterations: 6,
        maxSpeed: 2.2,           // terminal velocity < one radius/tick: NO tunneling
        sleepV: 0.25,            // calm threshold (must exceed the per-tick gravity residual)
        sleepTicks: 6            // baseline ticks of calm before hard-stopping
    },

    MATCH: {
        minGroup: 3,
        chargeTime: 10,
        chainWindow: 55,         // staged cascades (blast -> settle -> new match) count
        scorePer: 10,
        blastRadius: 13,          // per detonating member; impulses sum
        blastPower: 1.15,
        upBias: 0.4,
        maxKick: 2.2             // per-ball speed cap from one detonation (= terminal)
    },

    OVERFLOW_TIME: 40,
    HAND: 3,
    MAX_FX: 64,
    MAX_POPUPS: 5
};

const BASE_TICK = 20;
const DT = BASE_TICK / TUNING.TICK;
const TK = (t) => Math.max(1, Math.round(t / DT));
const V = (v) => v * DT;

const DCOLORS = view.PALETTE.map((body, i) => ({ name: view.NAMES[i], body }));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ game ----
class DragonDrop extends Game {
    static metadata() {
        return {
            thumbnail: './assets/thumbnail.png',
            assets: {
                'pointer-grab': new Asset({ path: './assets/cursor-grab.png', type: 'image' }),
                'pointer-hold': new Asset({ path: './assets/cursor-hold.png', type: 'image' }),
                'sanctuary': new Asset({ path: './assets/sanctuary.svg', type: 'image' }),
                'dragon-0-open': new Asset({ path: './assets/dragon-0-open.svg', type: 'image' }),
                'dragon-0-happy': new Asset({ path: './assets/dragon-0-happy.svg', type: 'image' }),
                'dragon-0-blink': new Asset({ path: './assets/dragon-0-blink.svg', type: 'image' }),
                'dragon-1-open': new Asset({ path: './assets/dragon-1-open.svg', type: 'image' }),
                'dragon-1-happy': new Asset({ path: './assets/dragon-1-happy.svg', type: 'image' }),
                'dragon-1-blink': new Asset({ path: './assets/dragon-1-blink.svg', type: 'image' }),
                'dragon-2-open': new Asset({ path: './assets/dragon-2-open.svg', type: 'image' }),
                'dragon-2-happy': new Asset({ path: './assets/dragon-2-happy.svg', type: 'image' }),
                'dragon-2-blink': new Asset({ path: './assets/dragon-2-blink.svg', type: 'image' }),
                'dragon-3-open': new Asset({ path: './assets/dragon-3-open.svg', type: 'image' }),
                'dragon-3-happy': new Asset({ path: './assets/dragon-3-happy.svg', type: 'image' }),
                'dragon-3-blink': new Asset({ path: './assets/dragon-3-blink.svg', type: 'image' }),
                'dragon-4-open': new Asset({ path: './assets/dragon-4-open.svg', type: 'image' }),
                'dragon-4-happy': new Asset({ path: './assets/dragon-4-happy.svg', type: 'image' }),
                'dragon-4-blink': new Asset({ path: './assets/dragon-4-blink.svg', type: 'image' }),
                'dragon-5-open': new Asset({ path: './assets/dragon-5-open.svg', type: 'image' }),
                'dragon-5-happy': new Asset({ path: './assets/dragon-5-happy.svg', type: 'image' }),
                'dragon-5-blink': new Asset({ path: './assets/dragon-5-blink.svg', type: 'image' }),
                'sound-pick': new Asset({ path: './assets/pick.wav', type: 'audio' }),
                'sound-drop': new Asset({ path: './assets/drop.wav', type: 'audio' }),
                'sound-match': new Asset({ path: './assets/match.wav', type: 'audio' }),
                'sound-end': new Asset({ path: './assets/end.wav', type: 'audio' }),
            },
            maxPlayers: 1,
            name: 'Dragon Drop',
            author: "Joseph Garcia",
            description: 'Drag a little dragon, find its landing, and let go. A cozy solo physics puzzler with six expressive dragons, soft tumbles, and cascading flyaway matches.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 60,
            gameId: "92ea33cc-9bb7-5f5c-ac52-9bd7a77a2324"
        };
    }

    constructor({ setCursor, saveGame, saveData, random = Math.random } = {}) {
        super();
        this.setCursor = setCursor; this.saveGame = saveGame; this.random = random;
        this.playerId = null; this.drag = null; this._t = 0; this.radius = TUNING.BALLS.radius; this.keys = new Set();
        const saved = saveData?.schema === 1 ? saveData : {};
        this.best = Number.isSafeInteger(saved.best) && saved.best >= 0 ? saved.best : 0;
        this.sound = saved.sound !== false; this.reduced = saved.reduced === true;
        this.balls = Array.from({ length: TUNING.BALLS.pool }, (_, id) => ({ id, active: false, rx: -999 }));
        view.create(this); this.initRun();
    }
    getLayers() { return [{ root: this.base }]; }
    handleNewPlayer({ playerId }) { if (this.playerId === null) this.playerId = Number(playerId); }
    owns(id) { return this.playerId === null || this.playerId === Number(id); }
    persist() {
        try { Promise.resolve(this.saveGame?.({ schema: 1, best: this.best, sound: this.sound, reduced: this.reduced })).catch(() => {}); }
        catch (_) { /* A storage failure never interrupts play. */ }
    }
    playSound(name) {
        if (!this.sound) return;
        const voice = this.voices.find(v => !v.until);
        if (voice) { voice.node.node.asset = { ['sound-' + name]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 } } }; voice.until = this._t + (name === 'match' ? 30 : name === 'end' ? 42 : 13); }
    }
    toggleSound() {
        this.sound = !this.sound;
        if (!this.sound) for (const v of this.voices) { v.node.node.asset = undefined; v.until = 0; }
        else this.playSound('pick');
        this.uiDirty = true; this.persist(); this.refreshHud(); this.base.node.onStateChange();
    }
    toggleMotion() {
        this.reduced = !this.reduced;
        if (this.reduced) {
            for (const f of this.flyers) { f.active = false; f.node.node.playerIds = [0]; }
            for (const f of this.fx) { f.active = false; f.node.node.coordinates2d = [[0,0],[0,0],[0,0]]; }
            for (const b of this.balls) b.squash = 0;
        }
        this.render(); this.persist(); this.refreshHud(); this.base.node.onStateChange();
    }
    togglePause() {
        if (this.gameOver) return;
        if (this.drag) this.cancelDrop(this.drag.id);
        this.paused = !this.paused; this.refreshHud(); this.base.node.onStateChange();
    }
    initRun() {
        if (this.drag) this.cancelDrop(this.drag.id);
        this.gameOver = false; this.paused = false; this.score = 0; this.rescued = 0;
        this.selected = -1; this.chainMult = 1; this.chainT = 0;
        this._live = []; this._cA = []; this._cB = []; this._lastCharging = false;
        this.pitDirty = true; this.supportDirty = true;
        for (const b of this.balls) { b.active = false; b.node.node.playerIds = [0]; b.halo.node.coordinates2d = [[0,0],[0,0],[0,0]]; b.rx = -999; }
        for (const f of this.flyers) { f.active = false; f.node.node.playerIds = [0]; }
        for (const f of this.fx) { f.active = false; f.node.node.coordinates2d = [[0,0],[0,0],[0,0]]; }
        for (const p of this.popups) { p.active = false; p.node.node.text.text = ''; }
        this.populatePit();
        for (const slot of this.slots) slot.color = Math.floor(this.random() * TUNING.BALLS.colors);
        this.uiDirty = true; this.forceNotify = true;
        this.render(); this.refreshHud(); this.base.node.onStateChange();
    }

    // fill the pit floor->fillTo with a hex lattice, colored so that NO
    // same-color connected component reaches 3. verified, not just hoped.
    populatePit() {
        const P = TUNING.PIT, R = TUNING.BALLS.radius, NC = TUNING.BALLS.colors;
        const spacing = R * 2.02;
        const rowH = spacing * 0.87;
        const placed = [];
        let row = 0;
        for (let y = P.FLOOR - R - 0.2; y > TUNING.BALLS.fillTo; y -= rowH, row++) {
            const off = (row % 2) * spacing * 0.5;
            for (let x = P.X0 + R + 0.3 + off; x < P.X1 - R - 0.2; x += spacing) {
                placed.push({ x, y, color: -1, nbrs: [] });
            }
        }
        // neighbor lists (touch distance)
        const touch = R * 2 + 0.35;
        for (let i = 0; i < placed.length; i++) {
            for (let j = i + 1; j < placed.length; j++) {
                const a = placed[i], b = placed[j];
                if (Math.abs(a.y - b.y) > touch) continue;
                if (Math.hypot(a.x - b.x, a.y - b.y) < touch) { a.nbrs.push(b); b.nbrs.push(a); }
            }
        }
        // greedy coloring: a color is legal if it creates no component of 3
        // (i.e. not 2+ same-color neighbors, and no same-color neighbor that
        // already has a same-color neighbor of its own)
        for (const p of placed) {
            const order = [...Array(NC).keys()].sort(() => this.random() - 0.5);
            p.color = order[0];
            for (const c of order) {
                const sameN = p.nbrs.filter((q) => q.color === c);
                if (sameN.length >= 2) continue;
                if (sameN.length === 1 && sameN[0].nbrs.some((q) => q !== p && q.color === c)) continue;
                p.color = c;
                break;
            }
        }
        // hard verify with the real union-find; re-roll any violators
        for (let pass = 0; pass < 20; pass++) {
            const parent = placed.map((_, i) => i);
            const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
            placed.forEach((p, i) => p._i = i);
            for (const p of placed) for (const q of p.nbrs) {
                if (p.color === q.color && p._i < q._i) {
                    const a = find(p._i), b = find(q._i);
                    if (a !== b) parent[a] = b;
                }
            }
            const sizes = new Map();
            for (let i = 0; i < placed.length; i++) {
                const r = find(i);
                sizes.set(r, (sizes.get(r) || 0) + 1);
            }
            const bad = placed.filter((p, i) => sizes.get(find(i)) >= TUNING.MATCH.minGroup);
            if (!bad.length) break;
            for (const p of bad) p.color = Math.floor(this.random() * NC);
        }
        for (const p of placed) {
            const b = this.spawnBall(p.color, p.x, p.y);
            if (b) { b.asleep = true; }
        }
        this.initialCount = placed.length;
    }

    spawnBall(color, x, y) {
        for (const b of this.balls) {
            if (b.active) continue;
            b.active = true;
            b.color = color;
            b.x = x; b.y = y;
            b.vx = 0; b.vy = 0;
            b.chargeT = 0;
            b.overT = 0;
            b.asleep = false;
            b.calmT = 0; b.squash = 0; b.renderKey = null; b.onBedrock = false;
            this.pitDirty = true;
            return b;
        }
        return null;
    }

    // ------------------------------------------------------------ input ----
    pointerCursor(id, mode) {
        if (typeof this.setCursor === 'function') this.setCursor(id, mode ? { assetKey: 'pointer-' + mode, size: { width: 32, height: 32 }, hotspot: { x: 16, y: 16 } } : null);
    }

    beginDrop(id, index, x, y) {
        if (!this.owns(id) || this.drag || this.gameOver || this.paused || !this.slots[index]) return;
        this.selected = index;
        this.drag = { id, slot: index, x, y, startX: x, startY: y, lastT: this._t, vx: 0, moved: false };
        this.playSound('pick'); this.pointerCursor(id, 'hold'); this.uiDirty = true;
        this.refreshHud(); this.base.node.onStateChange();
    }
    dropPosition(x, y) {
        const P = TUNING.PIT, R = this.radius, validX = x >= P.X0 && x <= P.X1;
        x = clamp(x, P.X0 + R, P.X1 - R);
        let landing = P.FLOOR - R;
        for (const b of this.balls) {
            const dx = b.x - x;
            if (b.active && Math.abs(dx) < R * 2) landing = Math.min(landing, b.y - Math.sqrt(R * R * 4 - dx * dx) - .06);
        }
        const valid = validX && y >= P.TOP && y <= P.FLOOR + 3 && landing >= P.TOP + R;
        return { x, y: valid ? clamp(y, P.TOP + R, landing) : clamp(y, 14, 92), landing, valid };
    }
    handleMouseMove(id, pos) {
        const d = this.drag;
        if (!d || d.id !== id || !pos || ![pos.x,pos.y].every(Number.isFinite)) return;
        d.moved ||= Math.hypot(pos.x-d.startX,pos.y-d.startY)>1;
        const elapsed = Math.max(1, this._t - d.lastT);
        if (pos.x !== d.x || pos.y !== d.y) {
            d.vx = clamp((pos.x - d.x) / elapsed, -.14, .14); d.lastT = this._t;
        }
        d.x = pos.x; d.y = pos.y;
        view.preview(this); this.refreshHud(); this.base.node.onStateChange();
    }
    handleMouseUp(id, pos) {
        const d = this.drag;
        if (!d || d.id !== id) return;
        if (pos && !pos.cancelled && [pos.x,pos.y].every(Number.isFinite)) {
            this.handleMouseMove(id, pos);
            const p = this.dropPosition(pos.x, pos.y);
            if (d.moved && p.valid) this.commitDrop(p, this._t - d.lastT < 8 ? d.vx : 0);
        }
        this.cancelDrop(id);
    }
    cancelDrop(id) {
        if (!this.drag || this.drag.id !== id) return;
        this.drag = null; view.preview(this); this.uiDirty = true;
        this.pointerCursor(id, null); this.refreshHud(); this.base.node.onStateChange();
    }
    handlePlayerDisconnect(id) {
        this.cancelDrop(id); this.pointerCursor(id, null);
        if (this.playerId === Number(id)) { this.playerId = null; this.paused = true; this.refreshHud(); }
    }
    handleKeyDown(id, key) {
        if (!this.owns(id)) return;
        if (this.keys.has(key)) return;
        this.keys.add(key);
        if (key === 'Escape' && this.drag) { this.cancelDrop(id); this.selected = -1; this.refreshHud(); }
        else if (key === 'Escape' || key.toLowerCase() === 'p') this.togglePause();
        else if (key.toLowerCase() === 'm') this.toggleSound();
        else if (!this.paused && !this.gameOver && ['1','2','3'].includes(key)) this.slotClick(Number(key)-1);
    }
    handleKeyUp(id, key) { if (this.owns(id)) this.keys.delete(key); }
    slotClick(i) { if (this.paused || this.gameOver) return; this.selected = this.selected === i ? -1 : i; this.refreshHud(); this.base.node.onStateChange(); }
    commitDrop(p, vx = 0) {
        if (this.selected < 0 || !p.valid || this.gameOver || this.paused) return false;
        const slot = this.slots[this.selected], b = this.spawnBall(slot.color, p.x, p.y);
        if (!b) return false;
        b.vx = vx; b.vy = V(.35);
        slot.color = Math.floor(this.random() * TUNING.BALLS.colors);
        this.selected = -1; this.uiDirty = true; this.playSound('drop');
        this.render(); this.refreshHud(); this.base.node.onStateChange(); return true;
    }
    handleTap(id, x, y) {
        if (!this.owns(id) || this.drag || ![x,y].every(Number.isFinite)) return;
        this.commitDrop(this.dropPosition(x, y));
    }

    // ---------------------------------------------------------- physics ----
    // spatial hash: cell size ~ diameter; pairs checked within the half-
    // neighborhood only. rebuilt per solver iteration (cheap), contacts
    // recorded on the first pass for the matcher.
    stepPhysics() {
        const PH = TUNING.PHYS, P = TUNING.PIT, R = TUNING.BALLS.radius;
        const drag = Math.pow(PH.drag, DT);
        const sleepV = V(PH.sleepV);

        const live = [];
        let awake = 0;
        for (const b of this.balls) if (b.active) { live.push(b); if (!b.asleep) awake++; }
        this._live = live;

        // CALM FAST PATH: a fully sleeping pit with no new spawns and verified
        // support costs nothing
        if (awake === 0 && !this.pitDirty && !this.supportDirty) return false;
        const forceSweep = this.pitDirty;      // fresh spawns => support unknown
        this.pitDirty = false;

        let anyMoving = false;
        const maxV = V(PH.maxSpeed);
        for (const b of live) {
            b.pen = 0;                       // deepest overlap this tick (sleep gate)
            if (b.asleep) continue;
            b.vy += PH.gravity * DT * DT;
            b.vx *= drag;
            b.vy *= drag;
            const sp = Math.hypot(b.vx, b.vy);
            if (sp > maxV) { b.vx = b.vx / sp * maxV; b.vy = b.vy / sp * maxV; }
            b.x += b.vx;
            b.y += b.vy;
            anyMoving = true;
        }

        const cell = R * 2.2;
        // flat int grid: head[cell] -> ball index chain via next[] (no Map boxing)
        const GX0 = P.X0 - 4, GY0 = P.TOP - 10;
        const cols = Math.ceil((P.X1 - P.X0 + 8) / cell);
        const rows = Math.ceil((P.FLOOR - P.TOP + 14) / cell);
        if (!this._gridHead || this._gridHead.length < cols * rows || this._gridNext.length < live.length) {
            this._gridHead = new Int32Array(cols * rows);
            this._gridNext = new Int32Array(Math.max(live.length, TUNING.BALLS.pool));
        }
        const head = this._gridHead, next = this._gridNext;
        if (!this._cA) { this._cA = []; this._cB = []; }
        this._cA.length = 0; this._cB.length = 0;
        const touchD = R * 2 + 0.3;

        const iters = PH.iterations + (awake > 40 ? 1 : 0) + (awake > 150 ? 1 : 0)
            + (this._maxPen > 0.35 ? 2 : 0);  // crush detected last tick: dig harder
        this._maxPen = 0;
        for (let it = 0; it < iters; it++) {
            const record = it === 0;
            // the sleep gate must judge RESIDUAL overlap, not the transient
            // spike gravity creates before the solver corrects it — otherwise a
            // normally-loaded resting pile reads as "squished" and never sleeps
            if (it === iters - 1) for (const b of live) b.pen = 0;
            // clamps FIRST, pair resolution LAST: if clamps ran last, corner
            // funnels would re-merge rescued pairs after every iteration and
            // coincident balls would render merged. resolution gets the final say.
            for (const b of live) {
                if (b.x < P.X0 + R) { b.x = P.X0 + R; if (b.vx < 0) b.vx = -b.vx * PH.restitution; }
                if (b.x > P.X1 - R) { b.x = P.X1 - R; if (b.vx > 0) b.vx = -b.vx * PH.restitution; }
                if (b.y > P.FLOOR - R) {
                    b.y = P.FLOOR - R;
                    if (b.vy > 0) { b.squash = Math.min(.15, b.vy * .3); b.vy = -b.vy * PH.restitution * 0.6; }   // the ground absorbs
                    b.vx *= PH.friction;
                    b.onBedrock = true;                                   // floor = bedrock
                }
                if (b.y < P.TOP - 8) b.y = P.TOP - 8;
            }
            head.fill(-1);
            for (let i = 0; i < live.length; i++) {
                const b = live[i];
                const cx = clamp(Math.floor((b.x - GX0) / cell), 0, cols - 1);
                const cy = clamp(Math.floor((b.y - GY0) / cell), 0, rows - 1);
                const k = cy * cols + cx;
                next[i] = head[k];
                head[k] = i;
            }
            const resolvePair = (a, b, ia, ib) => {
                let dx = b.x - a.x, dy = b.y - a.y;
                let dsq = dx * dx + dy * dy;
                if (dsq >= touchD * touchD) return;
                if (dsq < 0.0001) {
                    // COINCIDENCE RESCUE: merged balls must never be skipped —
                    // skipping is how they stay merged forever. exact merges
                    // come from clamp funnels (floor, walls, CORNERS), which
                    // defeat any fixed separation axis — so separate INWARD
                    // toward the pit center, the one direction no clamp undoes.
                    const icx = (P.X0 + P.X1) / 2, icy = (P.TOP + P.FLOOR) / 2;
                    let ux = icx - a.x, uy = icy - a.y;
                    const ul = Math.hypot(ux, uy) || 1;
                    ux /= ul; uy /= ul;
                    b.x += ux * R * 1.05; b.y += uy * R * 1.05;   // b escapes inward
                    a.x -= ux * R * 0.4; a.y -= uy * R * 0.4;    // a hugs the clamp
                    b.vx += ux * V(0.25); b.vy += uy * V(0.25);
                    a.asleep = false; b.asleep = false;
                    a.calmT = 0; b.calmT = 0;
                    return;
                }
                const dist = Math.sqrt(dsq);
                if (record) { this._cA.push(ia); this._cB.push(ib); }
                const minD = R * 2;
                if (dist >= minD) return;
                const pen = minD - dist;
                if (pen > a.pen) a.pen = pen;
                if (pen > b.pen) b.pen = pen;
                if (pen > this._maxPen) this._maxPen = pen;
                const nx = dx / dist, ny = dy / dist;
                const overlap = minD - dist;
                // waking: only a GENUINELY MOVING ball shoves sleepers awake
                // (slow rolling contact must not spread insomnia)
                if (a.asleep !== b.asleep) {
                    const mover = a.asleep ? b : a;
                    if (Math.hypot(mover.vx, mover.vy) > V(0.4)) {
                        a.asleep = false; b.asleep = false;
                        a.calmT = 0; b.calmT = 0;
                    }
                }
                if (a.asleep && b.asleep) {
                    // frozen squish repair: gently decompress WITHOUT waking
                    if (pen > 0.05) {
                        const nxs = (b.x - a.x) / dist, nys = (b.y - a.y) / dist;
                        const c = pen * 0.3;
                        a.x -= nxs * c * 0.5; a.y -= nys * c * 0.5;
                        b.x += nxs * c * 0.5; b.y += nys * c * 0.5;
                    }
                    return;
                }
                if (a.asleep !== b.asleep) {
                    // SLEEPERS ARE (99%) BEDROCK: the awake ball takes nearly
                    // all the correction — but the sleeper yields 10%, position
                    // only, no waking. without that, a ball WEDGED between two
                    // sleepers has its corrections cancel and stays compressed
                    // (and sleepless) forever.
                    const w = a.asleep ? b : a, sl = a.asleep ? a : b, sgn = a.asleep ? 1 : -1;
                    w.onBedrock = true;
                    w.x += sgn * nx * overlap * 0.9; w.y += sgn * ny * overlap * 0.9;
                    sl.x -= sgn * nx * overlap * 0.1; sl.y -= sgn * ny * overlap * 0.1;
                    const vn2 = (w.vx * nx + w.vy * ny) * sgn;
                    if (vn2 < 0) {
                        const imp = -(1 + PH.restitution) * vn2;
                        w.vx += sgn * nx * imp; w.vy += sgn * ny * imp;
                        w.vx *= PH.friction;
                    }
                    return;
                }
                a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
                b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
                const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
                const vn = rvx * nx + rvy * ny;
                if (vn < 0) {
                    const imp = -(1 + PH.restitution) * vn * 0.5;
                    a.squash = b.squash = Math.min(.12, -vn * .16);
                    a.vx -= nx * imp; a.vy -= ny * imp;
                    b.vx += nx * imp; b.vy += ny * imp;
                    a.vx *= PH.friction; b.vx *= PH.friction;
                }
                // CROWD-CRUSH PENALTY: deep overlap generates persistent outward
                // velocity, so decompression carries momentum across ticks —
                // pure position corrections cancel out in the middle of a crowd.
                // SPEED-GATED: crush zones are fast; a statically wedged pair
                // must NOT receive free energy every tick (that's an insomnia
                // engine — it oscillates forever above the sleep threshold).
                if (pen > 0.18 && Math.hypot(a.vx, a.vy) + Math.hypot(b.vx, b.vy) > V(0.5)) {
                    const push = Math.min(pen, 1.0) * V(0.2);
                    a.vx -= nx * push; a.vy -= ny * push;
                    b.vx += nx * push; b.vy += ny * push;
                }
            };
            for (let cy = 0; cy < rows; cy++) {
                for (let cx = 0; cx < cols; cx++) {
                    const k = cy * cols + cx;
                    for (let i = head[k]; i >= 0; i = next[i]) {
                        // within cell (chain after i)
                        for (let j = next[i]; j >= 0; j = next[j]) resolvePair(live[i], live[j], i, j);
                        // half neighborhood: E, S, SE, SW
                        if (cx + 1 < cols) for (let j = head[k + 1]; j >= 0; j = next[j]) resolvePair(live[i], live[j], i, j);
                        if (cy + 1 < rows) {
                            const kr = k + cols;
                            for (let j = head[kr]; j >= 0; j = next[j]) resolvePair(live[i], live[j], i, j);
                            if (cx + 1 < cols) for (let j = head[kr + 1]; j >= 0; j = next[j]) resolvePair(live[i], live[j], i, j);
                            if (cx - 1 >= 0) for (let j = head[kr - 1]; j >= 0; j = next[j]) resolvePair(live[i], live[j], i, j);
                        }
                    }
                }
            }
        }

        // sleep: calm for a few consecutive ticks -> hard stop. the threshold
        // sits above the per-tick gravity residual so supported balls CAN sleep.
        // slow movers get extra damping so crater-pocket rockers bleed out
        // instead of oscillating forever just above the threshold.
        for (const b of live) {
            if (b.asleep) { b.onBedrock = false; continue; }
            const spd = Math.hypot(b.vx, b.vy);
            if (spd < V(0.5)) { b.vx *= 0.93; b.vy *= 0.93; }
            // perched on sleeping bedrock and slow = done. rockers get snapped.
            const threshold = b.onBedrock ? V(0.45) : sleepV;
            if (spd < threshold && b.pen < 0.15) {   // never freeze while squished
                // dead-obvious sleepers (seated on bedrock, half-threshold
                // speed) fast-track: big post-cascade carpets converge sooner
                b.calmT += (b.onBedrock && spd < threshold * 0.5) ? 2 : 1;
                if (b.calmT >= TK(PH.sleepTicks)) {
                    b.vx = 0; b.vy = 0;
                    b.asleep = true;
                }
            } else if (spd >= threshold) b.calmT = 0;
            b.onBedrock = false;
        }

        // SUPPORT SWEEP: gravity applies to sleeping chunks too. a sleeper is
        // supported by the floor or by a STEADY ball beneath it (asleep OR
        // slow — an awake-but-still ball is fine support; only balls actively
        // falling away don't count). without the slow clause, one awake seam
        // ball invalidates its uppers and a wake-wave avalanches the pile.
        if (this._t % 3 === 0 || this.supportDirty || forceSweep) {
            if (!this._supported || this._supported.length < live.length) {
                this._supported = new Uint8Array(TUNING.BALLS.pool);
            }
            const supported = this._supported;
            supported.fill(0, 0, live.length);
            const steadyV = V(0.5);
            for (let i = 0; i < live.length; i++) {
                if (live[i].y >= P.FLOOR - R - 0.2) supported[i] = 1;
            }
            const cA = this._cA, cB = this._cB;
            const steady = (b) => b.asleep || Math.hypot(b.vx, b.vy) < steadyV;
            for (let c = 0; c < cA.length; c++) {
                const i = cA[c], j = cB[c];
                const a = live[i], b = live[j];
                if (!a || !b) continue;
                // arch support is real: saddle supporters up to ~65 degrees
                // off vertical count, or a ball wedged between two near-lateral
                // neighbors gets sweep-woken forever without ever falling
                if (b.y - a.y > R * 0.45 && steady(b)) supported[i] = 1;   // b holds a up
                if (a.y - b.y > R * 0.45 && steady(a)) supported[j] = 1;   // a holds b up
            }
            let anyWoke = false;
            for (let i = 0; i < live.length; i++) {
                const b = live[i];
                if (b.asleep && !supported[i]) {
                    b.asleep = false;
                    b.calmT = 0;
                    anyWoke = true;
                }
            }
            this.supportDirty = anyWoke;   // keep sweeping until the pile is honest
        }
        return anyMoving;
    }

    // ---------------------------------------------------------- matching ----
    updateMatching() {
        // throttled: every 3rd tick, charge advancing by 3 to keep timing
        if (this._t % 3 !== 0) return this._lastCharging || false;
        const STEP = 3;
        const live = this._live || [];
        const parent = new Array(live.length);
        for (let i = 0; i < parent.length; i++) parent[i] = i;
        const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
        const cA = this._cA || [], cB = this._cB || [];
        for (let c = 0; c < cA.length; c++) {
            const i = cA[c], j = cB[c];
            if (!live[i] || !live[j] || live[i].color !== live[j].color) continue;
            const a = find(i), b = find(j);
            if (a !== b) parent[a] = b;
        }
        const groups = new Map();
        for (let i = 0; i < live.length; i++) {
            const r = find(i);
            let g = groups.get(r);
            if (!g) { g = []; groups.set(r, g); }
            g.push(live[i]);
        }
        const charged = new Set();
        const calmV = V(0.6);
        for (const [, members] of groups) {
            if (members.length < TUNING.MATCH.minGroup) continue;
            // matches form when balls LAND, not mid-flight: without this, one
            // blast chains instantaneously through flying debris and deletes
            // the whole pit. staged cascades read better and score saner.
            let calm = 0;
            for (const b of members) if (b.asleep || Math.hypot(b.vx, b.vy) < calmV) calm++;
            if (calm < members.length * 0.6) continue;
            let maxCharge = 0;
            for (const b of members) { b.chargeT += STEP; charged.add(b); maxCharge = Math.max(maxCharge, b.chargeT); }
            if (maxCharge >= TK(TUNING.MATCH.chargeTime)) this.detonate(members);
        }
        for (const b of live) if (!charged.has(b)) b.chargeT = 0;
        this._lastCharging = charged.size > 0;
        return this._lastCharging;
    }

    detonate(members) {
        const M = TUNING.MATCH;
        if (this.chainT > 0) this.chainMult++;
        else this.chainMult = 1;
        this.chainT = TK(M.chainWindow);

        const sizeBonus = 1 + (members.length - M.minGroup) * 0.35;
        const pts = Math.round(M.scorePer * members.length * sizeBonus * this.chainMult);
        this.score += pts;
        if (this.score > this.best) this.best = this.score;
        this.rescued += members.length; this.persist(); this.playSound('match');

        let cx = 0, cy = 0;
        for (const b of members) { cx += b.x; cy += b.y; }
        cx /= members.length; cy /= members.length;
        this.popup((this.chainMult > 1 ? 'x' + this.chainMult + '  ' : '') + '+' + pts, cx, cy - 3);

        this.supportDirty = true;                 // sleepers above may now be floating
        const col = DCOLORS[members[0].color].body;
        let fxBudget = this.reduced ? 0 : Math.min(32, 4 + members.length * 2);
        for (const b of members) {
            b.active = false;
            if (!this.reduced) {
                const f = this.flyers.find(f => !f.active);
                if (f) Object.assign(f, { active: true, color: b.color, x: b.x, y: b.y, seed: b.id, life: 52, max: 52 });
            }
            if (fxBudget > 0) { this.emitBurst(b.x, b.y, col, 3, 1.4); fxBudget -= 3; }
        }

        // summed per-member radial impulses via the spatial answer: brute loop
        // over live balls but early-out by radius — members are local anyway
        const maxKick = V(M.maxKick);
        for (const b of this.balls) {
            if (!b.active) continue;
            let ix = 0, iy = 0;
            for (const m of members) {
                const dx = b.x - m.x, dy = b.y - m.y;
                const dist = Math.max(1.2, Math.hypot(dx, dy));
                if (dist > M.blastRadius) continue;
                const fall = Math.pow(1 - dist / M.blastRadius, 0.7);
                const p = V(M.blastPower) * fall;
                ix += (dx / dist) * p;
                iy += (dy / dist) * p - V(M.upBias) * fall;
            }
            if (ix !== 0 || iy !== 0) {
                const mag = Math.hypot(ix, iy);
                if (mag > maxKick) { ix = ix / mag * maxKick; iy = iy / mag * maxKick; }
                b.vx += ix; b.vy += iy;
                b.asleep = false;
                b.calmT = 0;
            }
        }
        this.uiDirty = true;
    }

    // ---------------------------------------------------------- overflow ----
    updateOverflow() {
        const line = TUNING.PIT.OVERFLOW;
        let ended = false;
        for (const b of this.balls) {
            if (!b.active) continue;
            const slow = b.asleep || Math.hypot(b.vx, b.vy) < V(0.6);
            if (b.y < line && slow) {
                b.overT += 1;
                if (b.overT >= TK(TUNING.OVERFLOW_TIME)) ended = true;
            } else {
                b.overT = Math.max(0, b.overT - 2);
            }
        }
        if (ended) this.endRun();
    }

    endRun() {
        if (this.gameOver) return;
        if (this.drag) this.cancelDrop(this.drag.id);
        this.gameOver = true; this.playSound('end'); this.persist();
        this.refreshHud(); this.base.node.onStateChange();
    }

    // --------------------------------------------------------------- fx ----
    emitBurst(x, y, fill, count, speed) {
        for (const f of this.fx) {
            if (count <= 0) break;
            if (f.active) continue;
            count--;
            f.active = true;
            f.life = TK(11); f.max = TK(11);
            f.x = x; f.y = y;
            const a = this.random() * Math.PI * 2;
            const s = V((0.5 + this.random() * 1.0) * (speed || 1));
            f.vx = Math.cos(a) * s;
            f.vy = Math.sin(a) * s - V(0.2);
            f.fill = fill;
        }
    }

    popup(str, x, y) {
        for (const p of this.popups) {
            if (p.active) continue;
            p.active = true;
            p.str = str;
            p.x = clamp(x, 8, 92); p.y = clamp(y, 8, 92);
            p.life = TK(22);
            return;
        }
    }

    render() { return view.render(this); }
    refreshHud() { view.hud(this); }
    tick() {
        if (this.paused) return;
        this._t++;
        if (!this.gameOver) {
            this.stepPhysics(); this.updateMatching(); this.updateOverflow();
        }
        const wrote = this.render(), hudChanged = this.uiDirty;
        if (this.drag?.moved) view.preview(this);
        if (this.uiDirty) { this.refreshHud(); this.uiDirty = false; }
        if (wrote || hudChanged || this.forceNotify) this.base.node.onStateChange();
        this.forceNotify = false;
    }
    close() { if (this.drag) this.cancelDrop(this.drag.id); this.persist(); super.close(); }
}
module.exports = DragonDrop;
module.exports.DCOLORS = DCOLORS;
module.exports.TUNING = TUNING;
