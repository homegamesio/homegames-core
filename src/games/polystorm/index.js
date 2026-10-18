// POLYSTORM — a 120-tick shoot-em-up campaign for Homegames (squish-150)
// WASD (or arrows) to fly, hold SPACE to fire. FIFTEEN handcrafted stages with
// distinct enemy identities and three unique bosses, looping forever with more
// enemies, tougher hulls, and faster fire each loop (stage 16 = a meaner
// stage 1). No bombs. Pure dodging. Boss kills award an extra ship.
//
// INPUT: standard squish key hooks handleKeyDown/handleKeyUp + tap fallback.
// TIME MODEL: tuning in 20-ticks/sec baseline units; DT converts. Drop
// TUNING.TICK + the metadata literal to 60 and the game plays identically.

const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

// ---------------------------------------------------------------- tuning ----
const TUNING = {
    TICK: 120,                   // MUST match the tickRate literal in metadata()

    FIELD: { X0: 2, X1: 98, Y0: 6, Y1: 98 },

    SHIP: {
        accel: 0.7, maxSpeed: 2.6, friction: 0.66,
        radius: 1.7,
        fireCd: 2.5,
        bulletSpeed: 4.6,
        lives: 3, maxLives: 5,
        invuln: 40
    },

    POWERUP: { dropChance: 0.1, fallSpeed: 0.55, duration: 240, radius: 2.0 },

    ENEMIES: {
        dart:     { hp: 1,  r: 2.0, speed: 1.5,  score: 50,   fire: 0 },
        swarm:    { hp: 1,  r: 1.4, speed: 1.15, score: 40,   fire: 0 },
        spinner:  { hp: 2,  r: 2.2, speed: 0.9,  score: 90,   fire: 70 },
        brute:    { hp: 4,  r: 3.2, speed: 0.42, score: 150,  fire: 55 },
        sniper:   { hp: 2,  r: 2.0, speed: 0.6,  score: 130,  fire: 62 },
        mine:     { hp: 1,  r: 2.4, speed: 0.35, score: 80,   fire: 0 },
        splitter: { hp: 3,  r: 2.8, speed: 0.6,  score: 120,  fire: 0 },
        charger:  { hp: 2,  r: 2.1, speed: 0.5,  score: 110,  fire: 0 },
        orbiter:  { hp: 2,  r: 2.0, speed: 0.5,  score: 120,  fire: 26 },
        decagon:  { hp: 60, r: 6.5, speed: 0.5,  score: 1500, fire: 26 },
        twin:     { hp: 42, r: 4.6, speed: 0.7,  score: 900,  fire: 34 },
        hydra:    { hp: 95, r: 7.5, speed: 0.42, score: 2500, fire: 20 }
    },
    E_BULLET_SPEED: 1.35,
    SNIPER_BULLET_SPEED: 2.7,
    CHARGE_SPEED: 3.1,
    MINE_TRIGGER: 7,

    // per-loop escalation (loop 0 = stages 1-15, loop 1 = stages 16-30 ...)
    LOOP: { hp: 0.35, speed: 0.12, speedCap: 1.6, fireMul: 0.88, bullet: 0.06, bulletCap: 1.45, extraSpawn: 1, bossHp: 26 },

    COMBO: { perTier: 8, maxMult: 8, decayEvery: 30 },
    STAGE_BONUS: 150,            // x stage number (+500 per loop)
    INTER_STAGE: 50,             // baseline ticks between stages

    MAX_STARS: 30,
    MAX_PBULLETS: 56,
    MAX_EBULLETS: 90,
    MAX_ENEMIES: 36,
    MAX_FX: 130,
    MAX_POWERUPS: 6,
    MAX_POPUPS: 4
};

// ---- time scale ------------------------------------------------------------
const BASE_TICK = 20;
const DT = BASE_TICK / TUNING.TICK;
const TK = (t) => Math.max(1, Math.round(t / DT));
const V = (v) => v * DT;
const FRICTION_DT = Math.pow(TUNING.SHIP.friction, DT);

// ---- palette ---------------------------------------------------------------
const C_SHIP = [120, 230, 255, 255];
const C_SHIP_DIM = [70, 150, 180, 255];
const C_PB = [180, 255, 240, 255];
const C_EB = [255, 120, 160, 255];
const C_EB_FAST = [255, 240, 130, 255];
const COLS = {
    dart: [255, 150, 80, 255], swarm: [255, 210, 90, 255], spinner: [200, 120, 255, 255],
    brute: [240, 90, 90, 255], sniper: [140, 255, 210, 255], mine: [255, 110, 70, 255],
    splitter: [255, 170, 220, 255], charger: [255, 250, 140, 255], orbiter: [130, 170, 255, 255],
    decagon: [255, 70, 110, 255], twin: [255, 130, 200, 255], hydra: [200, 60, 255, 255]
};
const C_POW = { spread: [120, 255, 140, 255], rapid: [255, 240, 110, 255], shield: [140, 200, 255, 255] };

// ---------------------------------------------------------------- helpers ---
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));

const polyN = (cx, cy, r, n, rot) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2 + (rot || 0);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

const shipShape = (cx, cy, r, tilt) => [
    [cx + tilt, cy - r * 1.3],
    [cx + r, cy + r],
    [cx, cy + r * 0.45],
    [cx - r, cy + r],
    [cx + tilt, cy - r * 1.3]
];

const KEYMAP = {
    w: 'up', a: 'left', s: 'down', d: 'right',
    arrowup: 'up', arrowleft: 'left', arrowdown: 'down', arrowright: 'right',
    up: 'up', left: 'left', down: 'down', right: 'right',
    ' ': 'fire', space: 'fire', spacebar: 'fire'
};
const normKey = (key) => KEYMAP[String(key).toLowerCase()] || null;

// ---- stage scripts ---------------------------------------------------------
// Each stage is a timeline of spawn events (t in baseline ticks from stage
// start). pat: 'row' spreads n across the width; 'sides' alternates edges;
// 'vee' is a centered wedge; 'arc' is the swarm formation; 'slots' uses the
// xs list; 'col' stacks n at one x with stagger. Loops add +extraSpawn to n.
const EV = (t, type, n, pat, opt) => Object.assign({ t, type, n, pat }, opt || {});
const STAGES = [
    { name: 'FIRST CONTACT', script: [
        EV(20, 'dart', 3, 'row'), EV(90, 'dart', 3, 'sides'), EV(160, 'dart', 4, 'row'),
        EV(240, 'dart', 3, 'vee'), EV(320, 'dart', 5, 'row'), EV(400, 'dart', 4, 'sides')
    ]},
    { name: 'THE SWARM', script: [
        EV(20, 'swarm', 1, 'arc', { x: 30 }), EV(90, 'swarm', 1, 'arc', { x: 70 }),
        EV(170, 'dart', 3, 'sides'), EV(240, 'swarm', 1, 'arc', { x: 50 }),
        EV(320, 'swarm', 1, 'arc', { x: 25 }), EV(325, 'swarm', 1, 'arc', { x: 75 }),
        EV(430, 'dart', 4, 'row')
    ]},
    { name: 'CROSSFIRE', script: [
        EV(20, 'spinner', 2, 'row'), EV(120, 'dart', 4, 'sides'),
        EV(200, 'spinner', 2, 'sides'), EV(300, 'dart', 3, 'vee'),
        EV(380, 'spinner', 3, 'row'), EV(480, 'dart', 4, 'row')
    ]},
    { name: 'HEAVY METAL', script: [
        EV(20, 'brute', 2, 'row'), EV(140, 'dart', 4, 'sides'),
        EV(230, 'brute', 1, 'col', { x: 50 }), EV(330, 'swarm', 1, 'arc', { x: 50 }),
        EV(400, 'brute', 2, 'sides'), EV(520, 'dart', 4, 'row')
    ]},
    { name: 'BOSS: DECAGON', script: [EV(30, 'decagon', 1, 'boss')] },
    { name: 'SNIPER ALLEY', script: [
        EV(20, 'sniper', 2, 'slots', { xs: [15, 85] }), EV(110, 'swarm', 1, 'arc', { x: 50 }),
        EV(200, 'sniper', 1, 'slots', { xs: [50] }), EV(280, 'dart', 4, 'sides'),
        EV(360, 'sniper', 2, 'slots', { xs: [30, 70] }), EV(460, 'swarm', 1, 'arc', { x: 35 })
    ]},
    { name: 'MINEFIELD', script: [
        EV(20, 'mine', 4, 'row'), EV(110, 'dart', 3, 'sides'),
        EV(190, 'mine', 5, 'row'), EV(290, 'dart', 4, 'vee'),
        EV(370, 'mine', 4, 'row'), EV(450, 'swarm', 1, 'arc', { x: 50 })
    ]},
    { name: 'SPLIT ENDS', script: [
        EV(20, 'splitter', 2, 'row'), EV(140, 'swarm', 1, 'arc', { x: 30 }),
        EV(220, 'splitter', 2, 'sides'), EV(340, 'dart', 3, 'row'),
        EV(420, 'splitter', 3, 'row')
    ]},
    { name: 'THE CHASE', script: [
        EV(20, 'charger', 2, 'row'), EV(120, 'spinner', 2, 'sides'),
        EV(220, 'charger', 3, 'row'), EV(330, 'dart', 3, 'vee'),
        EV(410, 'charger', 3, 'sides'), EV(510, 'spinner', 2, 'row')
    ]},
    { name: 'BOSS: THE TWINS', script: [EV(30, 'twin', 2, 'boss')] },
    { name: 'ORBIT', script: [
        EV(20, 'orbiter', 2, 'row'), EV(130, 'sniper', 1, 'slots', { xs: [50] }),
        EV(220, 'orbiter', 2, 'sides'), EV(330, 'swarm', 1, 'arc', { x: 60 }),
        EV(410, 'orbiter', 3, 'row'), EV(520, 'sniper', 2, 'slots', { xs: [20, 80] })
    ]},
    { name: 'AVALANCHE', script: [
        EV(20, 'dart', 5, 'row'), EV(80, 'dart', 5, 'row'), EV(150, 'mine', 3, 'row'),
        EV(230, 'dart', 6, 'row'), EV(300, 'dart', 5, 'vee'),
        EV(380, 'mine', 4, 'row'), EV(460, 'dart', 6, 'row')
    ]},
    { name: 'GAUNTLET', script: [
        EV(20, 'brute', 2, 'sides'), EV(130, 'sniper', 2, 'slots', { xs: [25, 75] }),
        EV(240, 'charger', 3, 'row'), EV(350, 'brute', 1, 'col', { x: 50 }),
        EV(450, 'charger', 2, 'sides'), EV(540, 'sniper', 1, 'slots', { xs: [50] })
    ]},
    { name: 'STORMFRONT', script: [
        EV(20, 'spinner', 2, 'row'), EV(100, 'splitter', 2, 'sides'),
        EV(200, 'orbiter', 2, 'row'), EV(300, 'mine', 3, 'row'),
        EV(380, 'charger', 2, 'row'), EV(470, 'brute', 2, 'sides'),
        EV(580, 'swarm', 1, 'arc', { x: 50 })
    ]},
    { name: 'BOSS: HYDRA', script: [EV(30, 'hydra', 1, 'boss')] }
];

// expand a stage script into a flat, time-sorted spawn list, applying loop
// density scaling (this is where "stage 16 = harder stage 1" happens)
const expandStage = (def, loop) => {
    const out = [];
    for (const ev of def.script) {
        if (ev.pat === 'boss') {
            for (let i = 0; i < ev.n; i++) out.push({ t: TK(ev.t), type: ev.type, x: 50, y: -5, k: i });
            continue;
        }
        const n = Math.min(10, ev.n + loop * TUNING.LOOP.extraSpawn);
        for (let i = 0; i < n; i++) {
            let x, y = 2, dt = 0;
            if (ev.pat === 'row') { x = 12 + (76 * (i + 0.5)) / n; y = 2 - (i % 2) * 2; }
            else if (ev.pat === 'sides') { x = i % 2 === 0 ? 10 : 90; dt = i * 12; }
            else if (ev.pat === 'vee') { x = 50 + (i - (n - 1) / 2) * 9; y = 2 - Math.abs(i - (n - 1) / 2) * 2.5; }
            else if (ev.pat === 'slots') { x = ev.xs[i % ev.xs.length]; dt = Math.floor(i / ev.xs.length) * 20; }
            else if (ev.pat === 'col') { x = ev.x; dt = i * 16; }
            else if (ev.pat === 'arc') { x = ev.x; }   // swarm handles its own formation
            out.push({ t: TK(ev.t + dt), type: ev.type, x, y, k: i });
        }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
};

// ------------------------------------------------------------------ game ----
class Polystorm extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            maxPlayers: 1,
            name: 'Polystorm',
            author: "Joseph Garcia",
            description: 'A 120-tick polygon shmup campaign: 15 handcrafted stages, 3 bosses, looping forever with meaner everything. WASD + SPACE. No bombs, no mercy.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 120,
            gameId: "7d66f3d1-35f1-5315-aa7b-41eae35ee1bc"
        };
    }

    constructor() {
        super();
        this._t = 0;
        this.keys = {};
        this.shake = 0;

        const mk = (fill) => new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill
        });
        const mkText = (text, x, y, size, color, align) => new GameNode.Text({
            textInfo: { text, x, y, size, align: align || 'center', color }
        });

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [8, 9, 16, 255]
        });

        this.stars = [];
        for (let i = 0; i < TUNING.MAX_STARS; i++) {
            this.stars.push({
                x: Math.random() * 100, y: Math.random() * 100,
                fast: i % 3 === 0,
                node: mk(i % 3 === 0 ? [190, 200, 230, 255] : [90, 96, 130, 255])
            });
        }

        this.pBullets = [];
        for (let i = 0; i < TUNING.MAX_PBULLETS; i++) {
            this.pBullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, node: mk([0, 0, 0, 0]) });
        }
        this.eBullets = [];
        for (let i = 0; i < TUNING.MAX_EBULLETS; i++) {
            this.eBullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, fast: false, node: mk([0, 0, 0, 0]) });
        }
        this.enemies = [];
        for (let i = 0; i < TUNING.MAX_ENEMIES; i++) {
            this.enemies.push({
                active: false, type: 'dart', x: 0, y: 0, vx: 0, vy: 0,
                hp: 1, hpMax: 1, phase: 0, fireT: 0, spin: 0, state: 0, sx: 0, sy: 0, patN: 0,
                node: mk([0, 0, 0, 0])
            });
        }
        this.powerups = [];
        for (let i = 0; i < TUNING.MAX_POWERUPS; i++) {
            this.powerups.push({ active: false, kind: 'spread', x: 0, y: 0, node: mk([0, 0, 0, 0]) });
        }
        this.fx = [];
        for (let i = 0; i < TUNING.MAX_FX; i++) {
            this.fx.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, fill: [255, 255, 255, 255], node: mk([0, 0, 0, 0]) });
        }
        this.popups = [];
        for (let i = 0; i < TUNING.MAX_POPUPS; i++) {
            this.popups.push({ active: false, x: 0, y: 0, life: 0, str: ' ', node: mkText(' ', 0, -10, 1.2, COLORS.WHITE) });
        }

        this.shipNode = mk(C_SHIP);
        this.flameNode = mk([255, 170, 60, 255]);
        this.shieldNode = mk([0, 0, 0, 0]);
        this.bossBarBack = mk([0, 0, 0, 0]);
        this.bossBar = mk([0, 0, 0, 0]);

        this.scoreText = mkText('SCORE 0', 3, 1, 1.6, COLORS.WHITE, 'left');
        this.comboText = mkText(' ', 50, 1, 1.6, [255, 220, 90, 255]);
        this.livesText = mkText('SHIPS 3', 97, 1, 1.6, C_SHIP, 'right');
        this.stageText = mkText(' ', 50, 3.6, 1.2, [170, 180, 210, 255]);
        this.powText = mkText(' ', 50, 96.8, 1.2, [140, 255, 170, 255]);
        this.bannerText = mkText(' ', 50, 42, 3.4, COLORS.WHITE);
        this.bannerSub = mkText(' ', 50, 50, 1.6, [190, 195, 215, 255]);

        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (playerId, x, y) => this.handleTap(playerId, x, y)
        });

        for (const s of this.stars) this.base.addChild(s.node);
        for (const p of this.powerups) this.base.addChild(p.node);
        for (const e of this.enemies) this.base.addChild(e.node);
        for (const b of this.pBullets) this.base.addChild(b.node);
        for (const b of this.eBullets) this.base.addChild(b.node);
        this.base.addChildren(this.flameNode, this.shipNode, this.shieldNode);
        for (const f of this.fx) this.base.addChild(f.node);
        for (const p of this.popups) this.base.addChild(p.node);
        this.base.addChildren(this.bossBarBack, this.bossBar);
        this.base.addChildren(this.scoreText, this.comboText, this.livesText, this.stageText, this.powText);
        this.base.addChildren(this.bannerText, this.bannerSub);
        this.base.addChild(this.tapCatcher);

        this.initRun();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    // --------------------------------------------------------- run state ----
    initRun() {
        this.gameOver = false;
        this.score = 0;
        this.lives = TUNING.SHIP.lives;
        this.streak = 0;
        this.mult = 1;
        this.comboDecay = 0;

        this.ship = { x: 50, y: 84, vx: 0, vy: 0, fireT: 0, invuln: TK(30), alive: true, respawnT: 0 };
        this.buffs = { spread: 0, rapid: 0, shield: false };

        this.stageIdx = 0;          // 0-based across ALL loops
        this.loop = 0;
        this.stageState = 'inter';  // inter | running
        this.interT = TK(30);
        this.stageT = 0;
        this.spawnList = [];
        this.spawnPtr = 0;
        this.bossAlive = false;

        for (const b of this.pBullets) b.active = false;
        for (const b of this.eBullets) b.active = false;
        for (const e of this.enemies) e.active = false;
        for (const p of this.powerups) p.active = false;
        for (const f of this.fx) f.active = false;
        for (const p of this.popups) p.active = false;
        this.shake = 0;
        this.uiDirty = true;
        this.bannerT = 0;

        this.setBanner(' ', ' ');
    }

    stageDef() { return STAGES[this.stageIdx % STAGES.length]; }
    stageNum() { return (this.stageIdx % STAGES.length) + 1; }

    startStage() {
        this.loop = Math.floor(this.stageIdx / STAGES.length);
        const def = this.stageDef();
        this.spawnList = expandStage(def, this.loop);
        this.spawnPtr = 0;
        this.stageT = 0;
        this.stageState = 'running';
        const loopStr = this.loop > 0 ? 'LOOP ' + (this.loop + 1) + ' - ' : '';
        this.setBanner('STAGE ' + this.stageNum(), loopStr + def.name);
        this.bannerT = TK(36);
        this.uiDirty = true;
    }

    // ------------------------------------------------------------ input ----
    handleKeyDown(player, key) {
        if (this.gameOver) { this.initRun(); this.base.node.onStateChange(); return; }
        const k = normKey(key);
        if (k) this.keys[k] = true;
    }

    handleKeyUp(player, key) {
        const k = normKey(key);
        if (k) delete this.keys[k];
    }

    handleTap(playerId, x, y) {
        if (this.gameOver) { this.initRun(); this.base.node.onStateChange(); return; }
        this.tapTarget = { x: clamp(x, TUNING.FIELD.X0, TUNING.FIELD.X1), y: clamp(y, TUNING.FIELD.Y0, TUNING.FIELD.Y1) };
        this.tapFireT = TK(30);
    }

    // ------------------------------------------------------------- ship ----
    updateShip() {
        const S = TUNING.SHIP, F = TUNING.FIELD;
        const sh = this.ship;
        if (!sh.alive) {
            sh.respawnT--;
            if (sh.respawnT <= 0 && this.lives > 0) {
                sh.alive = true;
                sh.x = 50; sh.y = 84; sh.vx = 0; sh.vy = 0;
                sh.invuln = TK(S.invuln);
            }
            return;
        }
        let ax = 0, ay = 0;
        if (this.keys.up) ay -= 1;
        if (this.keys.down) ay += 1;
        if (this.keys.left) ax -= 1;
        if (this.keys.right) ax += 1;
        if (ax === 0 && ay === 0 && this.tapTarget) {
            const dx = this.tapTarget.x - sh.x, dy = this.tapTarget.y - sh.y;
            const d = Math.hypot(dx, dy);
            if (d > 2) { ax = dx / d; ay = dy / d; }
            else this.tapTarget = null;
        }
        const alen = Math.hypot(ax, ay);
        if (alen > 0.001) {
            sh.vx += (ax / alen) * V(S.accel);
            sh.vy += (ay / alen) * V(S.accel);
        }
        sh.vx *= FRICTION_DT;
        sh.vy *= FRICTION_DT;
        const sp = Math.hypot(sh.vx, sh.vy);
        const mv = V(S.maxSpeed);
        if (sp > mv) { sh.vx = sh.vx / sp * mv; sh.vy = sh.vy / sp * mv; }
        sh.x = clamp(sh.x + sh.vx, F.X0 + 1.5, F.X1 - 1.5);
        sh.y = clamp(sh.y + sh.vy, F.Y0 + 2, F.Y1 - 1.5);

        if (sh.invuln > 0) sh.invuln--;
        if (sh.fireT > 0) sh.fireT--;
        const wantFire = this.keys.fire || (this.tapFireT > 0);
        if (this.tapFireT > 0) this.tapFireT--;
        if (wantFire && sh.fireT <= 0) {
            sh.fireT = TK(S.fireCd * (this.buffs.rapid > 0 ? 0.55 : 1));
            this.firePlayer();
        }
    }

    firePlayer() {
        const sh = this.ship;
        const spd = V(TUNING.SHIP.bulletSpeed);
        const shots = this.buffs.spread > 0 ? [-0.21, 0, 0.21] : [0];
        for (const a of shots) {
            for (const b of this.pBullets) {
                if (b.active) continue;
                b.active = true;
                b.x = sh.x; b.y = sh.y - 2;
                b.vx = Math.sin(a) * spd;
                b.vy = -Math.cos(a) * spd;
                break;
            }
        }
        this.emitBurst(sh.x, sh.y - 2.4, [200, 255, 245, 255], 1, 0.5);
    }

    damageShip() {
        const sh = this.ship;
        if (!sh.alive || sh.invuln > 0) return;
        if (this.buffs.shield) {
            this.buffs.shield = false;
            sh.invuln = TK(20);
            this.emitBurst(sh.x, sh.y, C_POW.shield, 14, 1.2);
            this.shake = Math.max(this.shake, 1.2);
            this.uiDirty = true;
            return;
        }
        this.lives--;
        this.streak = 0;
        this.mult = 1;
        this.emitBurst(sh.x, sh.y, C_SHIP, 24, 1.6);
        this.shake = Math.max(this.shake, 2.4);
        this.uiDirty = true;
        if (this.lives <= 0) {
            sh.alive = false;
            this.endRun();
            return;
        }
        sh.alive = false;
        sh.respawnT = TK(24);
    }

    endRun() {
        this.gameOver = true;
        this.bannerText.node.text = { text: 'GAME OVER', x: 50, y: 42, size: 3.4, align: 'center', color: COLS.decagon };
        this.bannerSub.node.text = {
            text: 'SCORE ' + this.score + ' - STAGE ' + (this.stageIdx + 1) + ' - ANY KEY / TAP TO RESTART',
            x: 50, y: 50, size: 1.6, align: 'center', color: [190, 195, 215, 255]
        };
    }

    // --------------------------------------------------------- director ----
    updateDirector() {
        if (this.stageState === 'inter') {
            this.interT--;
            if (this.interT <= 0) this.startStage();
            return;
        }
        this.stageT++;
        while (this.spawnPtr < this.spawnList.length && this.stageT >= this.spawnList[this.spawnPtr].t) {
            const s = this.spawnList[this.spawnPtr++];
            if (s.type === 'swarm') {
                for (let i = 0; i < 5; i++) this.spawnEnemy('swarm', s.x + (i - 2) * 4.5, s.y - Math.abs(i - 2) * 2.2, i);
            } else {
                this.spawnEnemy(s.type, s.x, s.y, s.k);
            }
        }
        if (this.spawnPtr >= this.spawnList.length && !this.enemies.some((e) => e.active)) {
            // stage clear
            const bonus = TUNING.STAGE_BONUS * this.stageNum() + this.loop * 500;
            this.score += bonus;
            this.popup('STAGE CLEAR +' + bonus, 50, 40);
            this.stageIdx++;
            this.stageState = 'inter';
            this.interT = TK(TUNING.INTER_STAGE);
            this.uiDirty = true;
        }
    }

    setBanner(a, b) {
        this.bannerText.node.text = { text: a, x: 50, y: 42, size: 3.4, align: 'center', color: COLORS.WHITE };
        this.bannerSub.node.text = { text: b, x: 50, y: 50, size: 1.6, align: 'center', color: [190, 195, 215, 255] };
    }

    // ---------------------------------------------------------- enemies ----
    loopHpMul() { return 1 + this.loop * TUNING.LOOP.hp; }
    loopSpeedMul() { return Math.min(TUNING.LOOP.speedCap, 1 + this.loop * TUNING.LOOP.speed); }
    loopFireMul() { return Math.pow(TUNING.LOOP.fireMul, this.loop); }
    loopBulletMul() { return Math.min(TUNING.LOOP.bulletCap, 1 + this.loop * TUNING.LOOP.bullet); }

    spawnEnemy(type, x, y, k) {
        const E = TUNING.ENEMIES[type];
        const isBoss = type === 'decagon' || type === 'twin' || type === 'hydra';
        for (const e of this.enemies) {
            if (e.active) continue;
            e.active = true;
            e.type = type;
            e.x = clamp(x, 4, 96); e.y = y;
            e.phase = (k || 0) * 0.8 + Math.random() * 6.28;
            e.spin = Math.random() * 6.28;
            e.state = 0;
            e.patN = 0;
            e.k = k || 0;
            const sp = E.speed * this.loopSpeedMul();
            e.hpMax = isBoss ? E.hp + this.loop * TUNING.LOOP.bossHp : Math.max(1, Math.round(E.hp * this.loopHpMul()));
            e.hp = e.hpMax;
            e.fireT = TK((20 + Math.random() * 30) * this.loopFireMul());
            e.vx = 0; e.vy = V(sp);
            if (type === 'spinner') e.vx = V(sp) * (Math.random() < 0.5 ? 1 : -1);
            if (type === 'sniper') { e.sx = e.x; e.state = 0; e.fireT = TK(TUNING.ENEMIES.sniper.fire * this.loopFireMul()); }
            if (type === 'orbiter') { e.sx = e.x; e.sy = -6; e.phase = (k || 0) * 1.6; }
            if (type === 'charger') { e.state = 0; e.fireT = TK(30 + (k || 0) * 8); }
            if (type === 'twin') { e.sx = k === 0 ? 30 : 70; e.vx = V(E.speed); }
            if (isBoss) this.bossAlive = true;
            return e;
        }
        return null;
    }

    fireEnemyBullet(x, y, vx, vy, fast) {
        for (const b of this.eBullets) {
            if (b.active) continue;
            b.active = true;
            b.x = x; b.y = y; b.vx = vx; b.vy = vy;
            b.fast = !!fast;
            return;
        }
    }

    fireAimed(x, y, speed, fast) {
        const sh = this.ship;
        const s = speed * this.loopBulletMul();
        const a = Math.atan2(sh.y - y, sh.x - x);
        this.fireEnemyBullet(x, y, Math.cos(a) * V(s), Math.sin(a) * V(s), fast);
    }

    fireRadial(x, y, n, speed, rot) {
        const s = speed * this.loopBulletMul();
        for (let i = 0; i < n; i++) {
            const a = (rot || 0) + (i / n) * Math.PI * 2;
            this.fireEnemyBullet(x, y, Math.cos(a) * V(s), Math.sin(a) * V(s));
        }
    }

    updateEnemies() {
        const F = TUNING.FIELD;
        const sh = this.ship;
        for (const e of this.enemies) {
            if (!e.active) continue;
            const E = TUNING.ENEMIES[e.type];
            e.phase += 0.14 * DT * 20;
            e.spin += 0.09 * DT * 20;

            if (e.type === 'dart') {
                e.x += Math.sin(e.phase) * V(0.7);
                e.y += e.vy;

            } else if (e.type === 'swarm') {
                e.x += Math.sin(e.phase) * V(0.9);
                e.y += e.vy;

            } else if (e.type === 'spinner') {
                e.x += e.vx; e.y += e.vy;
                if (e.x < F.X0 + 3 || e.x > F.X1 - 3) e.vx = -e.vx;
                if (e.fireT-- <= 0) {
                    e.fireT = TK(E.fire * this.loopFireMul());
                    for (let i = 0; i < 4; i++) {
                        const a = e.spin + i * Math.PI / 2;
                        const s = TUNING.E_BULLET_SPEED * this.loopBulletMul();
                        this.fireEnemyBullet(e.x, e.y, Math.cos(a) * V(s), Math.sin(a) * V(s));
                    }
                }

            } else if (e.type === 'brute') {
                e.y += e.vy;
                e.x += Math.sin(e.phase * 0.4) * V(0.25);
                if (e.fireT-- <= 0) {
                    e.fireT = TK(E.fire * this.loopFireMul());
                    this.fireAimed(e.x, e.y + 2, TUNING.E_BULLET_SPEED * 1.1);
                }

            } else if (e.type === 'sniper') {
                // descend to a perch, then telegraph -> fast aimed shot, repeat
                if (e.y < 13) { e.y += e.vy; }
                else if (e.state === 0) {
                    e.x += Math.sin(e.phase * 0.5) * V(0.3);
                    if (e.fireT-- <= 0) { e.state = 1; e.fireT = TK(14); }
                } else {
                    // telegraphing (renders bright); locks and fires at the end
                    if (e.fireT-- <= 0) {
                        this.fireAimed(e.x, e.y + 1.5, TUNING.SNIPER_BULLET_SPEED, true);
                        e.state = 0;
                        e.fireT = TK(E.fire * this.loopFireMul());
                    }
                }

            } else if (e.type === 'mine') {
                e.y += e.vy;
                e.x += Math.sin(e.phase * 0.3) * V(0.2);
                if (sh.alive && Math.hypot(e.x - sh.x, e.y - sh.y) < TUNING.MINE_TRIGGER) {
                    this.detonateMine(e, false);
                    continue;
                }

            } else if (e.type === 'splitter') {
                e.y += e.vy;
                e.x += Math.sin(e.phase * 0.6) * V(0.5);

            } else if (e.type === 'charger') {
                if (e.state === 0) {                      // drift in
                    e.y += e.vy;
                    if (e.y >= 18 + e.k * 4) { e.state = 1; e.fireT = TK(26); }
                } else if (e.state === 1) {               // telegraph lock
                    e.x += Math.sin(e.phase) * V(0.3);
                    if (e.fireT-- <= 0) {
                        e.state = 2;
                        const a = Math.atan2(sh.y - e.y, sh.x - e.x);
                        const s = TUNING.CHARGE_SPEED * this.loopSpeedMul();
                        e.vx = Math.cos(a) * V(s);
                        e.vy = Math.sin(a) * V(s);
                        this.emitBurst(e.x, e.y, COLS.charger, 4, 1);
                    }
                } else {                                   // committed dash
                    e.x += e.vx; e.y += e.vy;
                }

            } else if (e.type === 'orbiter') {
                // circles a slowly-descending center, leaking a spiral
                e.sy += V(E.speed * 0.5);
                e.phase += 0.06 * DT * 20;
                e.x = clamp(e.sx + Math.cos(e.phase) * 11, 3, 97);
                e.y = e.sy + Math.sin(e.phase) * 11;
                if (e.y > 0 && e.fireT-- <= 0) {
                    e.fireT = TK(E.fire * this.loopFireMul());
                    const s = TUNING.E_BULLET_SPEED * 0.85 * this.loopBulletMul();
                    this.fireEnemyBullet(e.x, e.y, Math.cos(e.phase) * V(s), Math.sin(e.phase) * V(s));
                }

            } else if (e.type === 'decagon') {
                if (e.y < 16) e.y += V(0.5);
                else {
                    e.x += e.vx || (e.vx = V(E.speed));
                    if (e.x < 18 || e.x > 82) e.vx = -e.vx;
                }
                if (e.y >= 10 && e.fireT-- <= 0) {
                    e.fireT = TK(E.fire * this.loopFireMul());
                    e.patN++;
                    if (e.patN % 3 === 0) this.fireRadial(e.x, e.y, 10 + Math.min(8, this.loop * 3), TUNING.E_BULLET_SPEED * 0.9, e.spin);
                    else {
                        this.fireAimed(e.x - 3, e.y + 3, TUNING.E_BULLET_SPEED * 1.2);
                        this.fireAimed(e.x + 3, e.y + 3, TUNING.E_BULLET_SPEED * 1.2);
                    }
                }

            } else if (e.type === 'twin') {
                // mirrored pair: k=0 haunts the left, k=1 the right
                if (e.y < 15) e.y += V(0.6);
                else {
                    const home = e.k === 0 ? 30 : 70;
                    e.x += (home + Math.sin(e.phase) * 14 - e.x) * 0.03 * DT * 20;
                }
                const partnerDead = !this.enemies.some((o) => o.active && o !== e && o.type === 'twin');
                if (e.y >= 10 && e.fireT-- <= 0) {
                    e.fireT = TK(E.fire * this.loopFireMul() * (partnerDead ? 0.5 : 1));   // survivor enrages
                    e.patN++;
                    if (e.patN % 4 === 0) this.fireRadial(e.x, e.y, 8, TUNING.E_BULLET_SPEED * 0.85, e.spin);
                    else {
                        // crossfire fan angled toward the middle
                        const toward = e.k === 0 ? 0.5 : Math.PI - 0.5;
                        for (let i = -1; i <= 1; i++) {
                            const a = Math.PI / 2 + (e.k === 0 ? 1 : -1) * 0.35 + i * 0.22;
                            const s = TUNING.E_BULLET_SPEED * this.loopBulletMul();
                            this.fireEnemyBullet(e.x, e.y + 2, Math.cos(a) * V(s), Math.sin(a) * V(s));
                        }
                    }
                }

            } else if (e.type === 'hydra') {
                if (e.y < 14) e.y += V(0.45);
                else {
                    e.x += e.vx || (e.vx = V(E.speed));
                    if (e.x < 22 || e.x > 78) e.vx = -e.vx;
                }
                if (e.y >= 9 && e.fireT-- <= 0) {
                    e.patN++;
                    const cyc = e.patN % 8;
                    if (cyc < 4) {
                        // spiral barrage: rapid rotating singles
                        e.fireT = TK(E.fire * 0.45 * this.loopFireMul());
                        const s = TUNING.E_BULLET_SPEED * 0.95 * this.loopBulletMul();
                        const a = e.spin * 2.4;
                        this.fireEnemyBullet(e.x, e.y, Math.cos(a) * V(s), Math.sin(a) * V(s));
                        this.fireEnemyBullet(e.x, e.y, Math.cos(a + Math.PI) * V(s), Math.sin(a + Math.PI) * V(s));
                    } else if (cyc === 4) {
                        // the wall: full-width rain with two gaps. walk the gaps.
                        e.fireT = TK(E.fire * 2.2 * this.loopFireMul());
                        const g1 = 12 + Math.floor(Math.random() * 6);
                        const g2 = g1 + 4 + Math.floor(Math.random() * 5);
                        const s = TUNING.E_BULLET_SPEED * 0.8 * this.loopBulletMul();
                        for (let i = 0; i < 22; i++) {
                            if (i === g1 || i === g1 + 1 || i === g2 || i === g2 + 1) continue;
                            this.fireEnemyBullet(5 + i * 4.2, e.y + 4, 0, V(s));
                        }
                    } else if (cyc === 6 && this.enemies.filter((o) => o.active && o.type === 'splitter').length < 2) {
                        e.fireT = TK(E.fire * 1.5 * this.loopFireMul());
                        this.spawnEnemy('splitter', e.x - 12, e.y + 2, 0);   // the heads regrow
                        this.spawnEnemy('splitter', e.x + 12, e.y + 2, 1);
                    } else {
                        e.fireT = TK(E.fire * this.loopFireMul());
                        this.fireAimed(e.x, e.y + 4, TUNING.E_BULLET_SPEED * 1.15);
                    }
                }
            }

            // ram
            if (sh.alive && Math.hypot(e.x - sh.x, e.y - sh.y) < E.r + TUNING.SHIP.radius) {
                this.damageShip();
                if (e.type === 'mine') { this.detonateMine(e, false); continue; }
                if (E.hp < 20) { this.killEnemy(e, false); continue; }
            }

            if (e.y > 104 || e.y < -14 || e.x < -10 || e.x > 110) {
                e.active = false;
                this.hide(e.node);
                this.checkBossDown();
            }
        }
    }

    detonateMine(e, scored) {
        e.active = false;
        this.hide(e.node);
        this.fireRadial(e.x, e.y, 8, TUNING.E_BULLET_SPEED * 0.9, e.spin);
        this.emitBurst(e.x, e.y, COLS.mine, 12, 1.4);
        this.shake = Math.max(this.shake, 1);
        if (scored) this.awardKill(e);
    }

    isBossType(t) { return t === 'decagon' || t === 'twin' || t === 'hydra'; }

    checkBossDown() {
        if (this.bossAlive && !this.enemies.some((e) => e.active && this.isBossType(e.type))) {
            this.bossAlive = false;
        }
    }

    awardKill(e) {
        const E = TUNING.ENEMIES[e.type];
        this.streak++;
        this.mult = Math.min(TUNING.COMBO.maxMult, 1 + Math.floor(this.streak / TUNING.COMBO.perTier));
        this.comboDecay = TK(TUNING.COMBO.decayEvery);
        const pts = (E.score + this.loop * Math.round(E.score * 0.5)) * this.mult;
        this.score += pts;
        this.popup('+' + pts, e.x, e.y);
        this.uiDirty = true;
    }

    killEnemy(e, scored) {
        e.active = false;
        this.hide(e.node);
        const big = this.isBossType(e.type);
        this.emitBurst(e.x, e.y, COLS[e.type], big ? 30 : 8, big ? 1.8 : 1);
        this.shake = Math.max(this.shake, big ? 2.6 : e.type === 'brute' ? 1 : 0.5);
        if (scored) {
            this.awardKill(e);
            if (e.type === 'splitter') {
                for (let i = -1; i <= 1; i++) {
                    const child = this.spawnEnemy('dart', e.x + i * 4, e.y, i + 1);
                    if (child) { child.vy = V(TUNING.ENEMIES.dart.speed * 1.25 * this.loopSpeedMul()); child.hpMax = 1; child.hp = 1; }
                }
            }
            if (big) {
                this.checkBossDown();
                if (!this.bossAlive) {
                    this.dropPowerup(e.x - 5, e.y);
                    this.dropPowerup(e.x + 5, e.y);
                    if (this.lives < TUNING.SHIP.maxLives) {
                        this.lives++;
                        this.popup('+1 SHIP', 50, 30);
                        this.uiDirty = true;
                    }
                }
            } else if (Math.random() < TUNING.POWERUP.dropChance) {
                this.dropPowerup(e.x, e.y);
            }
        } else if (big) {
            this.checkBossDown();
        }
    }

    // --------------------------------------------------------- powerups ----
    dropPowerup(x, y) {
        const kinds = ['spread', 'rapid', 'shield'];
        for (const p of this.powerups) {
            if (p.active) continue;
            p.active = true;
            p.kind = kinds[Math.floor(Math.random() * kinds.length)];
            p.x = clamp(x, 5, 95); p.y = y;
            return;
        }
    }

    updatePowerups() {
        const sh = this.ship;
        for (const p of this.powerups) {
            if (!p.active) continue;
            p.y += V(TUNING.POWERUP.fallSpeed);
            if (p.y > 103) { p.active = false; this.hide(p.node); continue; }
            if (sh.alive && Math.hypot(p.x - sh.x, p.y - sh.y) < TUNING.POWERUP.radius + TUNING.SHIP.radius) {
                p.active = false;
                this.hide(p.node);
                if (p.kind === 'shield') this.buffs.shield = true;
                else this.buffs[p.kind] = TK(TUNING.POWERUP.duration);
                this.emitBurst(sh.x, sh.y, C_POW[p.kind], 10, 1);
                this.popup(p.kind.toUpperCase(), p.x, p.y);
                this.uiDirty = true;
            }
        }
        if (this.buffs.spread > 0) { this.buffs.spread--; if (this.buffs.spread === 0) this.uiDirty = true; }
        if (this.buffs.rapid > 0) { this.buffs.rapid--; if (this.buffs.rapid === 0) this.uiDirty = true; }
    }

    // ---------------------------------------------------------- bullets ----
    updateBullets() {
        for (const b of this.pBullets) {
            if (!b.active) continue;
            b.x += b.vx; b.y += b.vy;
            if (b.y < -2 || b.x < -2 || b.x > 102) { b.active = false; this.hide(b.node); continue; }
            for (const e of this.enemies) {
                if (!e.active) continue;
                const E = TUNING.ENEMIES[e.type];
                if (Math.hypot(e.x - b.x, e.y - b.y) < E.r + 0.8) {
                    b.active = false;
                    this.hide(b.node);
                    e.hp--;
                    this.emitBurst(b.x, b.y, [255, 230, 160, 255], 2, 0.7);
                    if (this.isBossType(e.type)) this.uiDirty = true;
                    if (e.hp <= 0) {
                        if (e.type === 'mine') this.detonateMine(e, true);
                        else this.killEnemy(e, true);
                    }
                    break;
                }
            }
        }
        const sh = this.ship;
        for (const b of this.eBullets) {
            if (!b.active) continue;
            b.x += b.vx; b.y += b.vy;
            if (b.y < -3 || b.y > 103 || b.x < -3 || b.x > 103) { b.active = false; this.hide(b.node); continue; }
            if (sh.alive && Math.hypot(b.x - sh.x, b.y - sh.y) < 0.9 + TUNING.SHIP.radius) {
                b.active = false;
                this.hide(b.node);
                this.damageShip();
            }
        }
    }

    // --------------------------------------------------------------- fx ----
    emitBurst(x, y, fill, count, speed) {
        for (const f of this.fx) {
            if (count <= 0) break;
            if (f.active) continue;
            count--;
            f.active = true;
            f.life = TK(10); f.max = TK(10);
            f.x = x; f.y = y;
            const a = Math.random() * Math.PI * 2;
            const s = V((0.5 + Math.random() * 0.9) * (speed || 1));
            f.vx = Math.cos(a) * s;
            f.vy = Math.sin(a) * s;
            f.fill = fill;
        }
    }

    popup(str, x, y) {
        for (const p of this.popups) {
            if (p.active) continue;
            p.active = true;
            p.str = str;
            p.x = clamp(x, 6, 94); p.y = clamp(y, 6, 94);
            p.life = TK(18);
            return;
        }
    }

    hide(n) {
        n.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        n.node.fill = [0, 0, 0, 0];
    }

    // ---------------------------------------------------------- render ----
    render() {
        const ox = this.shake > 0.05 ? (Math.random() - 0.5) * this.shake : 0;
        const oy = this.shake > 0.05 ? (Math.random() - 0.5) * this.shake : 0;
        if (this.shake > 0.05) this.shake *= Math.pow(0.85, DT * 20);

        for (const s of this.stars) {
            s.y += V(s.fast ? 1.6 : 0.7);
            if (s.y > 100) { s.y -= 100; s.x = Math.random() * 100; }
            const sz = s.fast ? 0.5 : 0.32;
            s.node.node.coordinates2d = ShapeUtils.rectangle(s.x + ox * 0.3, s.y + oy * 0.3, sz, sz);
        }

        const sh = this.ship;
        if (sh.alive) {
            const blink = sh.invuln > 0 && (Math.floor(this._t / TK(2)) % 2 === 0);
            const tilt = clamp(sh.vx / V(TUNING.SHIP.maxSpeed), -1, 1) * 0.9;
            this.shipNode.node.coordinates2d = shipShape(sh.x + ox, sh.y + oy, TUNING.SHIP.radius, tilt);
            this.shipNode.node.fill = blink ? C_SHIP_DIM : C_SHIP;
            const thrust = Math.hypot(sh.vx, sh.vy) / V(TUNING.SHIP.maxSpeed);
            const fl = 1 + thrust * 2 + Math.random() * 0.6;
            this.flameNode.node.coordinates2d = [
                [sh.x - 0.7 + ox, sh.y + 1.5 + oy],
                [sh.x + 0.7 + ox, sh.y + 1.5 + oy],
                [sh.x + ox, sh.y + 1.5 + fl + oy],
                [sh.x - 0.7 + ox, sh.y + 1.5 + oy]
            ];
            this.flameNode.node.fill = [255, clampByte(140 + Math.random() * 90), 50, 255];
            if (this.buffs.shield) {
                this.shieldNode.node.coordinates2d = polyN(sh.x + ox, sh.y + oy, TUNING.SHIP.radius * 2, 10, this._t * 0.05);
                this.shieldNode.node.fill = [C_POW.shield[0], C_POW.shield[1], C_POW.shield[2], 70];
            } else this.hide(this.shieldNode);
        } else {
            this.hide(this.shipNode);
            this.hide(this.flameNode);
            this.hide(this.shieldNode);
        }

        for (const e of this.enemies) {
            if (!e.active) continue;
            const E = TUNING.ENEMIES[e.type];
            const ex = e.x + ox, ey = e.y + oy;
            const n = e.node.node;
            if (e.type === 'dart') n.coordinates2d = [[ex, ey + E.r], [ex + E.r * 0.9, ey - E.r], [ex - E.r * 0.9, ey - E.r], [ex, ey + E.r]];
            else if (e.type === 'swarm') n.coordinates2d = [[ex, ey - E.r], [ex + E.r, ey], [ex, ey + E.r], [ex - E.r, ey], [ex, ey - E.r]];
            else if (e.type === 'spinner') n.coordinates2d = polyN(ex, ey, E.r, 4, e.spin);
            else if (e.type === 'brute') n.coordinates2d = polyN(ex, ey, E.r, 6, e.spin * 0.3);
            else if (e.type === 'sniper') n.coordinates2d = [[ex, ey + E.r * 1.4], [ex + E.r * 0.6, ey - E.r], [ex - E.r * 0.6, ey - E.r], [ex, ey + E.r * 1.4]];
            else if (e.type === 'mine') n.coordinates2d = polyN(ex, ey, E.r, 8, e.spin * 0.5);
            else if (e.type === 'splitter') n.coordinates2d = [[ex, ey - E.r * 1.2], [ex + E.r, ey], [ex, ey + E.r * 1.2], [ex - E.r, ey], [ex, ey - E.r * 1.2]];
            else if (e.type === 'charger') n.coordinates2d = [[ex, ey + E.r * 1.5], [ex + E.r * 0.8, ey - E.r * 0.7], [ex, ey - E.r * 0.2], [ex - E.r * 0.8, ey - E.r * 0.7], [ex, ey + E.r * 1.5]];
            else if (e.type === 'orbiter') n.coordinates2d = polyN(ex, ey, E.r, 5, e.spin);
            else if (e.type === 'twin') n.coordinates2d = polyN(ex, ey, E.r, 7, e.spin * 0.4);
            else n.coordinates2d = polyN(ex, ey, E.r, e.type === 'hydra' ? 12 : 10, e.spin * 0.2);
            const hurt = e.hp < e.hpMax;
            const telegraph = (e.type === 'sniper' || e.type === 'charger') && e.state === 1;
            n.fill = telegraph && (this._t % TK(3) < TK(1.5)) ? [255, 255, 255, 255]
                : hurt && (this._t % TK(3) < TK(1.5)) ? [255, 255, 255, 255]
                : COLS[e.type];
        }

        for (const b of this.pBullets) {
            if (!b.active) continue;
            b.node.node.coordinates2d = ShapeUtils.rectangle(b.x - 0.35 + ox, b.y - 1.1 + oy, 0.7, 2.2);
            b.node.node.fill = C_PB;
        }
        for (const b of this.eBullets) {
            if (!b.active) continue;
            b.node.node.coordinates2d = polyN(b.x + ox, b.y + oy, b.fast ? 0.7 : 0.85, b.fast ? 3 : 6, 0);
            b.node.node.fill = b.fast ? C_EB_FAST : C_EB;
        }

        for (const p of this.powerups) {
            if (!p.active) continue;
            p.node.node.coordinates2d = polyN(p.x + ox, p.y + oy, TUNING.POWERUP.radius, 5, this._t * 0.04);
            p.node.node.fill = C_POW[p.kind];
        }

        for (const f of this.fx) {
            if (!f.active) continue;
            f.x += f.vx; f.y += f.vy;
            f.life--;
            const n = f.node.node;
            if (f.life <= 0 || f.y > 103 || f.y < -3) {
                f.active = false;
                this.hide(f.node);
                n.color = [255, 255, 255, 0];
                continue;
            }
            n.coordinates2d = ShapeUtils.rectangle(f.x - 0.3 + ox, f.y - 0.3 + oy, 0.6, 0.6);
            n.fill = [f.fill[0], f.fill[1], f.fill[2], 255];
            n.color = [255, 255, 255, clampByte(230 * f.life / f.max)];
        }

        for (const p of this.popups) {
            if (!p.active) continue;
            p.life--;
            p.y -= V(0.4);
            if (p.life <= 0) {
                p.active = false;
                p.node.node.text = { text: ' ', x: 0, y: -10, size: 1.2, align: 'center', color: COLORS.WHITE };
                continue;
            }
            p.node.node.text = { text: p.str, x: p.x, y: p.y, size: 1.2, align: 'center', color: [255, 235, 150, 255] };
        }

        const boss = this.enemies.find((e) => e.active && this.isBossType(e.type));
        if (boss) {
            // twins share the bar: sum hp of all boss-type actives
            let hp = 0, hpMax = 0;
            for (const e of this.enemies) if (e.active && this.isBossType(e.type)) { hp += e.hp; hpMax += e.hpMax; }
            this.bossBarBack.node.coordinates2d = ShapeUtils.rectangle(20, 5.4, 60, 1.4);
            this.bossBarBack.node.fill = [40, 20, 30, 255];
            this.bossBar.node.coordinates2d = ShapeUtils.rectangle(20, 5.4, Math.max(0.3, 60 * hp / Math.max(1, hpMax)), 1.4);
            this.bossBar.node.fill = COLS[boss.type];
        } else {
            this.hide(this.bossBarBack);
            this.hide(this.bossBar);
        }

        if (this.bannerT > 0) {
            this.bannerT--;
            if (this.bannerT === 0 && !this.gameOver) this.setBanner(' ', ' ');
        }
    }

    refreshHud() {
        this.scoreText.node.text = { text: 'SCORE ' + this.score, x: 3, y: 1, size: 1.6, align: 'left', color: COLORS.WHITE };
        this.comboText.node.text = {
            text: this.mult > 1 ? 'x' + this.mult + ' COMBO' : ' ',
            x: 50, y: 1, size: 1.6, align: 'center', color: [255, 220, 90, 255]
        };
        this.livesText.node.text = { text: 'SHIPS ' + this.lives, x: 97, y: 1, size: 1.6, align: 'right', color: C_SHIP };
        const loopStr = this.loop > 0 ? 'LOOP ' + (this.loop + 1) + ' ' : '';
        this.stageText.node.text = {
            text: loopStr + 'STAGE ' + this.stageNum() + ': ' + this.stageDef().name,
            x: 50, y: 3.6, size: 1.2, align: 'center', color: [170, 180, 210, 255]
        };
        const buffs = [];
        if (this.buffs.spread > 0) buffs.push('SPREAD');
        if (this.buffs.rapid > 0) buffs.push('RAPID');
        if (this.buffs.shield) buffs.push('SHIELD');
        this.powText.node.text = { text: buffs.join(' + ') || ' ', x: 50, y: 96.8, size: 1.2, align: 'center', color: [140, 255, 170, 255] };
    }

    // ------------------------------------------------------------- tick ----
    tick() {
        this._t++;
        if (this.gameOver) return;

        this.updateShip();
        this.updateDirector();
        this.updateEnemies();
        this.updateBullets();
        this.updatePowerups();

        if (this.comboDecay > 0) {
            this.comboDecay--;
            if (this.comboDecay === 0 && this.streak > 0) {
                this.streak = Math.max(0, this.streak - TUNING.COMBO.perTier);
                this.mult = Math.min(TUNING.COMBO.maxMult, 1 + Math.floor(this.streak / TUNING.COMBO.perTier));
                this.comboDecay = TK(TUNING.COMBO.decayEvery);
                this.uiDirty = true;
            }
        }

        this.render();
        if (this.uiDirty) { this.refreshHud(); this.uiDirty = false; }

        this.base.node.onStateChange();
    }
}

module.exports = Polystorm;
module.exports.STAGES = STAGES;
module.exports.expandStage = expandStage;
