// Warpoint — a zoomable single-player RTS for Homegames (squish-150)
// v2: three unit types (soldier / long-range ranger / melee brute), AI turrets,
// fog of war (enemies exist only where you have eyes; muzzle flashes betray),
// map presets + a seeded mirror-symmetric map generator, all on one screen
// with three semantic zoom levels and tap-to-possess at ground level.
//
// TIME MODEL: tuning numbers are in 20-ticks/sec baseline units; DT converts.
// SPACE MODEL: world is this.world.W x this.world.H (per map). The viewport is
// screen x 0..72, y 14..86; screen = (world - cam) * scale + viewportCenter.

const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

// ---------------------------------------------------------------- tuning ----
const TUNING = {
    TICK: 60,                    // MUST match the tickRate literal in metadata()

    UNITS: {
        soldier: { name: 'SOLDIER', cost: 50,  hp: 40,  dmg: 6,  range: 7,   fireCd: 16, speed: 0.9,  aggro: 12, xp: 20, radius: 1.4 },
        ranger:  { name: 'RANGER',  cost: 70,  hp: 26,  dmg: 8,  range: 13,  fireCd: 22, speed: 0.85, aggro: 15, xp: 26, radius: 1.3 },
        brute:   { name: 'BRUTE',   cost: 110, hp: 110, dmg: 14, range: 3.8, fireCd: 20, speed: 0.7,  aggro: 12, xp: 40, radius: 2.0 }
    },
    UNIT_CAP: 24,                // per side
    POSSESS: { dmgMult: 1.5, speedMult: 1.3, rangeMult: 1.2, cdMult: 0.6 },

    TURRET: { cost: 120, hp: 180, dmg: 8, range: 16, fireCd: 12, maxPerSide: 5 },
    SPIKE:  { cost: 60, charges: 12, dmg: 2, tickEvery: 8, radius: 3.5, max: 10 },

    BASE: { hp: 600, dmg: 9, range: 16, fireCd: 10 },

    CAP_RADIUS: 12,
    CAP_RATE: 0.35,              // presence differential per baseline tick
    CAP_FLIP: 60,

    BASE_INCOME: 1,
    START_RES: 100,

    LEVELS: [100, 250, 450, 700, 1000, 1400, 1900, 2500],
    UPGRADES: [
        { key: 'dmg',    label: '+20% DAMAGE',      apply: (u) => { u.dmgMult += 0.2; } },
        { key: 'hp',     label: '+25% UNIT HP',     apply: (u) => { u.hpMult += 0.25; } },
        { key: 'speed',  label: '+15% MOVE SPEED',  apply: (u) => { u.speedMult += 0.15; } },
        { key: 'turret', label: '+30% TURRET DMG',  apply: (u) => { u.turretMult += 0.3; } },
        { key: 'cheap',  label: 'UNITS COST -20%',  apply: (u) => { u.costMult -= 0.2; } },
        { key: 'dmg2',   label: '+20% DAMAGE',      apply: (u) => { u.dmgMult += 0.2; } },
        { key: 'hp2',    label: '+25% UNIT HP',     apply: (u) => { u.hpMult += 0.25; } },
        { key: 'range',  label: '+20% RANGE',       apply: (u) => { u.rangeMult += 0.2; } }
    ],
    XP_TURRET_KILL: 30,

    AI: {
        thinkEvery: 100,
        buyEvery: 250,
        retaskEvery: 600,
        attackArmy: 72,
        attackTime: 1800,
        incomeRamp: 0.0008,
        turretAt: 1320,           // AI banks a turret when it has this much spare
        mix: [['soldier', 0.5], ['ranger', 0.3], ['brute', 0.2]]
    },

    FOW: {
        sightUnit: 20,           // world units
        sightTurret: 22,
        sightBase: 26,
        sightPoint: 18,          // owned points give vision
        revealOnFire: 30         // baseline ticks a fog shooter stays exposed
    },

    MAX_TRACERS: 24,
    MAX_FX: 60,
    MAX_ICONS: 8
};

// ---- maps ------------------------------------------------------------------
// A map = world size + capture point layout. Bases always sit mid-left /
// mid-right. Generated maps place mirror-image point pairs so neither side
// gets a geometry advantage.
const MAPS = [
    {
        name: 'CLASSIC', W: 200, H: 200,
        pts: [
            { x: 60, y: 40, income: 2 }, { x: 140, y: 40, income: 2 },
            { x: 100, y: 100, income: 3 },
            { x: 60, y: 160, income: 2 }, { x: 140, y: 160, income: 2 }
        ]
    },
    {
        name: 'SKIRMISH', W: 160, H: 160,
        pts: [
            { x: 80, y: 42, income: 2 },
            { x: 80, y: 80, income: 3 },
            { x: 80, y: 118, income: 2 }
        ]
    },
    {
        name: 'GRAND', W: 280, H: 280,
        pts: [
            { x: 80, y: 60, income: 2 }, { x: 200, y: 60, income: 2 },
            { x: 66, y: 140, income: 2 }, { x: 214, y: 140, income: 2 },
            { x: 140, y: 140, income: 3 },
            { x: 80, y: 220, income: 2 }, { x: 200, y: 220, income: 2 }
        ]
    }
];

// seeded RNG so generated maps are reproducible
const mulberry32 = (seed) => {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

// generate a fair map: k mirrored point pairs (+ optional richer center)
const generateMap = (seed, W, H, nPoints) => {
    const rnd = mulberry32(seed);
    const pts = [];
    const bases = [{ x: 18, y: H / 2 }, { x: W - 18, y: H / 2 }];
    const pairs = Math.floor(nPoints / 2);
    const wantCenter = nPoints % 2 === 1;
    const minPt = Math.min(W, H) * 0.16;
    const minBase = Math.min(W, H) * 0.24;
    const okSpot = (x, y) => {
        for (const p of pts) if (Math.hypot(p.x - x, p.y - y) < minPt) return false;
        for (const b of bases) if (Math.hypot(b.x - x, b.y - y) < minBase) return false;
        return true;
    };
    for (let i = 0; i < pairs; i++) {
        let relax = 1;
        for (let tries = 0; tries < 400; tries++) {
            if (tries > 0 && tries % 100 === 0) relax *= 0.7;   // crowded map: shrink spacing until it fits
            const x = W * (0.18 + rnd() * 0.64);
            const y = H * (0.12 + rnd() * 0.76);
            const mx = W - x, my = H - y;
            const need = minPt * relax;
            const fits = (px, py) => {
                for (const p of pts) if (Math.hypot(p.x - px, p.y - py) < need) return false;
                for (const b of bases) if (Math.hypot(b.x - px, b.y - py) < minBase * relax) return false;
                return true;
            };
            if (fits(x, y) && fits(mx, my) && Math.hypot(x - mx, y - my) >= need) {
                pts.push({ x, y, income: 2 });
                pts.push({ x: mx, y: my, income: 2 });
                break;
            }
        }
    }
    if (wantCenter) pts.push({ x: W / 2, y: H / 2, income: 3 });
    return { name: 'RND-' + (seed % 1000) + ' ' + W + 'x' + H, W, H, pts };
};

// ---- time scale ------------------------------------------------------------
const BASE_TICK = 20;
const DT = BASE_TICK / TUNING.TICK;
const TK = (t) => Math.max(1, Math.round(t / DT));
const V = (v) => v * DT;

// ---- palette ---------------------------------------------------------------
const C_PLAYER = [90, 200, 250, 255];
const C_PLAYER_DIM = [60, 140, 180, 255];
const C_AI = [240, 110, 90, 255];
const C_AI_DIM = [170, 80, 65, 255];
const C_NEUTRAL = [150, 150, 160, 255];
const C_SELECT = [255, 220, 90, 255];
const C_GROUND = [30, 34, 30, 255];
const C_GROUND2 = [36, 41, 36, 255];

// ---------------------------------------------------------------- helpers ---
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

const polyCircle = (cx, cy, r, sides) => {
    const n = sides || 12;
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

const triangle = (cx, cy, r) => [[cx, cy - r], [cx + r * 0.9, cy + r * 0.8], [cx - r * 0.9, cy + r * 0.8], [cx, cy - r]];
const diamond = (cx, cy, r) => [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy], [cx, cy - r]];

const thickLine = (x1, y1, x2, y2, width) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(a) * width / 2, dy = Math.cos(a) * width / 2;
    return [[x1 - dx, y1 + dy], [x2 - dx, y2 + dy], [x2 + dx, y2 - dy], [x1 + dx, y1 - dy], [x1 - dx, y1 + dy]];
};

const VP = { X0: 0, X1: 72, Y0: 14, Y1: 86, CX: 36, CY: 50 };

// ------------------------------------------------------------------ game ----
class Warpoint extends Game {
    static metadata() {
        return {
            isTest: true, // Catalog review: see docs/game-consolidation.md.

            squishVersion: '150',
            maxPlayers: 1,
            name: 'Warpoint',
            author: "Joseph Garcia",
            description: 'Zoomable one-screen RTS with fog of war, three unit types, AI turrets, and generated mirror-fair maps. Take the points, kill the base.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 60   // keep in sync with TUNING.TICK (must stay a literal)
        };
    }

    constructor() {
        super();
        this._t = 0;
        this.mapIdx = 0;
        this.rndSeedBase = 12345;

        const mk = (fill, onClick) => {
            const opts = {
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill
            };
            if (onClick) opts.onClick = onClick;
            return new GameNode.Shape(opts);
        };
        const mkText = (text, x, y, size, color, align) => new GameNode.Text({
            textInfo: { text, x, y, size, align: align || 'center', color }
        });

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [12, 13, 17, 255]
        });

        // ---- map scenery ----------------------------------------------
        this.groundNode = mk(C_GROUND);
        this.groundBands = [mk(C_GROUND2), mk(C_GROUND2), mk(C_GROUND2)];

        this.MAX_POINTS = 17;            // node pool bound for point layouts
        this.pointNodes = [];
        for (let i = 0; i < this.MAX_POINTS; i++) {
            this.pointNodes.push({ ring: mk(C_NEUTRAL), core: mk([60, 62, 70, 255]), bar: mk([0, 0, 0, 0]) });
        }

        this.baseNodes = {
            player: { body: mk(C_PLAYER_DIM), inner: mk(C_PLAYER) },
            ai: { body: mk(C_AI_DIM), inner: mk(C_AI) }
        };

        this.turrets = [];
        for (let i = 0; i < TUNING.TURRET.maxPerSide * 2; i++) {
            this.turrets.push({ alive: false, side: 'player', x: 0, y: 0, hp: 0, cd: 0, revealT: 0, body: mk([0, 0, 0, 0]), barrel: mk([0, 0, 0, 0]) });
        }
        this.spikes = [];
        for (let i = 0; i < TUNING.SPIKE.max; i++) {
            this.spikes.push({ alive: false, x: 0, y: 0, charges: 0, node: mk([0, 0, 0, 0]) });
        }

        this.units = [];
        for (let i = 0; i < TUNING.UNIT_CAP * 2; i++) {
            this.units.push({
                id: i, alive: false, side: 'player', type: 'soldier',
                x: 0, y: 0, tx: 0, ty: 0, hp: 0, cd: 0, revealT: 0, visible: true,
                selected: false, possessed: false,
                body: mk([0, 0, 0, 0]), gun: mk([0, 0, 0, 0])
            });
        }
        this.possessRing = mk([0, 0, 0, 0]);

        this.icons = { player: [], ai: [] };
        for (const side of ['player', 'ai']) {
            for (let i = 0; i < TUNING.MAX_ICONS; i++) {
                this.icons[side].push({ shape: mk([0, 0, 0, 0]), label: mkText(' ', 0, -10, 1.2, COLORS.WHITE) });
            }
        }

        this.tracers = [];
        for (let i = 0; i < TUNING.MAX_TRACERS; i++) {
            this.tracers.push({ active: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0, side: 'player', node: mk([0, 0, 0, 0]) });
        }
        this.fx = [];
        for (let i = 0; i < TUNING.MAX_FX; i++) {
            this.fx.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, fill: [255, 255, 255, 255], node: mk([0, 0, 0, 0]) });
        }

        this.boxMark = mk([0, 0, 0, 0]);
        this.orderMark = { life: 0, x: 0, y: 0, node: mk([0, 0, 0, 0]) };

        // ---- HUD strip -------------------------------------------------
        this.hudBack = mk([16, 17, 22, 255]);
        this.hudBack.node.coordinates2d = ShapeUtils.rectangle(0, 0, 72, 14);
        this.pBaseLabel = mkText('YOUR BASE', 11, 1, 1.1, C_PLAYER);
        this.pBaseBarBack = mk([34, 36, 44, 255]);
        this.pBaseBarBack.node.coordinates2d = ShapeUtils.rectangle(2, 4, 18, 2);
        this.pBaseBar = mk(C_PLAYER);
        this.aBaseLabel = mkText('ENEMY BASE', 61, 1, 1.1, C_AI);
        this.aBaseBarBack = mk([34, 36, 44, 255]);
        this.aBaseBarBack.node.coordinates2d = ShapeUtils.rectangle(52, 4, 18, 2);
        this.aBaseBar = mk(C_AI);
        this.resText = mkText('RES 100', 36, 1, 1.6, COLORS.HG_YELLOW);
        this.lvlText = mkText('LV 1', 36, 5.2, 1.2, COLORS.WHITE);
        this.xpBarBack = mk([34, 36, 44, 255]);
        this.xpBarBack.node.coordinates2d = ShapeUtils.rectangle(26, 9, 20, 1.6);
        this.xpBar = mk([170, 120, 250, 255]);
        this.toastText = mkText(' ', 36, 11.2, 1.3, C_SELECT);
        this.toastLife = 0;

        this.bannerText = mkText(' ', 36, 44, 4, COLORS.WHITE);
        this.bannerSub = mkText(' ', 36, 52, 1.6, [200, 205, 220, 255]);

        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 14, 72, 72),
            onClick: (playerId, x, y) => this.handleTap(playerId, x, y)
        });

        // ---- command panel ---------------------------------------------
        this.panel = mk([16, 17, 22, 255]);
        this.panel.node.coordinates2d = ShapeUtils.rectangle(72, 0, 28, 100);

        this.buttons = {};
        const mkBtn = (key, label, x, y, w, h, cb) => {
            const bg = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, y, w, h),
                fill: [42, 44, 54, 255],
                onClick: () => cb()
            });
            const txt = mkText(label, x + w / 2, y + h / 2 - 0.8, 1.05, COLORS.WHITE);
            bg.addChild(txt);
            this.buttons[key] = { bg, txt, x, y, w, h };
            return bg;
        };
        const btnList = [];
        btnList.push(mkBtn('soldier', 'SOLDIER $50', 74, 14, 24, 4.2, () => this.trainClick('soldier')));
        btnList.push(mkBtn('ranger', 'RANGER $70', 74, 18.8, 24, 4.2, () => this.trainClick('ranger')));
        btnList.push(mkBtn('brute', 'BRUTE $110', 74, 23.6, 24, 4.2, () => this.trainClick('brute')));
        btnList.push(mkBtn('turret', 'TURRET $120', 74, 29, 24, 4.2, () => this.buildClick('turret')));
        btnList.push(mkBtn('spike', 'SPIKES $60', 74, 33.8, 24, 4.2, () => this.buildClick('spike')));
        btnList.push(mkBtn('all', 'SELECT ALL', 74, 39.2, 24, 4.2, () => this.selectAll()));
        btnList.push(mkBtn('box', 'BOX SELECT', 74, 44, 24, 4.2, () => this.boxClick()));
        btnList.push(mkBtn('ctrl', 'TAKE CONTROL', 74, 48.8, 24, 4.2, () => this.controlClick()));
        btnList.push(mkBtn('zin', 'ZOOM +', 74, 54.2, 11.5, 4.2, () => this.zoomClick(1)));
        btnList.push(mkBtn('zout', 'ZOOM -', 86.5, 54.2, 11.5, 4.2, () => this.zoomClick(-1)));
        btnList.push(mkBtn('pup', '^', 83, 59.6, 6, 3.6, () => this.panClick(0, -1)));
        btnList.push(mkBtn('pleft', '<', 75.5, 63.8, 6, 3.6, () => this.panClick(-1, 0)));
        btnList.push(mkBtn('pright', '>', 90.5, 63.8, 6, 3.6, () => this.panClick(1, 0)));
        btnList.push(mkBtn('pdown', 'v', 83, 68, 6, 3.6, () => this.panClick(0, 1)));
        btnList.push(mkBtn('mapnext', 'MAP: NEXT', 74, 73, 11.5, 4.2, () => this.mapNextClick()));
        btnList.push(mkBtn('maprnd', 'NEW RND', 86.5, 73, 11.5, 4.2, () => this.mapRandomClick()));
        btnList.push(mkBtn('fog', 'FOG: ON', 74, 78.4, 24, 3.6, () => this.fogClick()));

        this.statusText = mkText('NO SELECTION', 86, 83.2, 1.0, [160, 165, 180, 255]);
        this.modeText = mkText(' ', 86, 85.8, 1.0, C_SELECT);
        this.zoomText = mkText('ZOOM: MAP', 86, 88.4, 1.0, [160, 220, 180, 255]);
        this.mapText = mkText('CLASSIC', 86, 91, 1.0, [200, 205, 220, 255]);
        this.hintText = mkText('TAP UNITS TO SELECT', 86, 94, 0.9, [130, 135, 150, 255]);
        this.hint2Text = mkText('TAP MAP TO ORDER', 86, 96.6, 0.9, [130, 135, 150, 255]);

        // ---- assemble --------------------------------------------------
        this.base.addChild(this.groundNode);
        for (const b of this.groundBands) this.base.addChild(b);
        for (const p of this.pointNodes) this.base.addChildren(p.ring, p.core, p.bar);
        for (const s of this.spikes) this.base.addChild(s.node);
        this.base.addChildren(this.baseNodes.player.body, this.baseNodes.player.inner);
        this.base.addChildren(this.baseNodes.ai.body, this.baseNodes.ai.inner);
        for (const t of this.turrets) this.base.addChildren(t.body, t.barrel);
        for (const u of this.units) this.base.addChildren(u.body, u.gun);
        this.base.addChild(this.possessRing);
        for (const side of ['player', 'ai']) for (const ic of this.icons[side]) this.base.addChildren(ic.shape, ic.label);
        for (const tr of this.tracers) this.base.addChild(tr.node);
        for (const f of this.fx) this.base.addChild(f.node);
        this.base.addChildren(this.boxMark, this.orderMark.node);
        this.base.addChildren(this.hudBack, this.pBaseLabel, this.pBaseBarBack, this.pBaseBar, this.aBaseLabel, this.aBaseBarBack, this.aBaseBar);
        this.base.addChildren(this.resText, this.lvlText, this.xpBarBack, this.xpBar, this.toastText);
        this.base.addChildren(this.bannerText, this.bannerSub);
        this.base.addChild(this.tapCatcher);
        this.base.addChild(this.panel);
        for (const b of btnList) this.base.addChild(b);
        this.base.addChildren(this.statusText, this.modeText, this.zoomText, this.mapText, this.hintText, this.hint2Text);

        this.fogOn = true;
        this.initMatch(MAPS[0]);
    }

    getLayers() {
        return [{ root: this.base }];
    }

    // ------------------------------------------------------- match state ----
    initMatch(mapDef) {
        if (mapDef) this.map = mapDef;
        const M = this.map;
        this.world = { W: M.W, H: M.H };
        const z0 = 72 / Math.max(M.W, M.H);
        this.ZOOMS = [z0, Math.min(1.1, z0 * 2.2), 1.8];

        this.pb = { x: 18, y: M.H / 2 };            // player base spot
        this.ab = { x: M.W - 18, y: M.H / 2 };      // AI base spot

        this.gameOver = null;
        this.res = TUNING.START_RES;
        this.xp = 0;
        this.level = 1;
        this.upIdx = 0;
        this.up = { dmgMult: 1, hpMult: 1, speedMult: 1, turretMult: 1, costMult: 1, rangeMult: 1 };

        this.zoomIdx = 0;
        this.cam = { x: M.W / 2, y: M.H / 2 };
        this.lastTapW = { x: M.W / 2, y: M.H / 2 };
        this.mode = 'none';
        this.boxA = { x: 0, y: 0 };
        this.possessedId = -1;

        this.bases = {
            player: { x: this.pb.x, y: this.pb.y, hp: TUNING.BASE.hp, cd: 0 },
            ai: { x: this.ab.x, y: this.ab.y, hp: TUNING.BASE.hp, cd: 0 }
        };

        this.points = M.pts.slice(0, this.MAX_POINTS).map((p) => ({
            x: p.x, y: p.y, income: p.income, owner: 'neutral', knownOwner: 'neutral', prog: 0
        }));

        for (const u of this.units) { u.alive = false; u.selected = false; u.possessed = false; u.revealT = 0; u.visible = true; }
        for (const t of this.turrets) { t.alive = false; t.revealT = 0; }
        for (const s of this.spikes) s.alive = false;
        for (const tr of this.tracers) tr.active = false;
        for (const f of this.fx) f.active = false;

        for (let i = 0; i < 4; i++) this.spawnUnit('player', 'soldier', this.pb.x + 8, this.pb.y - 6 + i * 4);
        for (let i = 0; i < 4; i++) this.spawnUnit('ai', 'soldier', this.ab.x - 8, this.ab.y - 6 + i * 4);

        this.aiState = { res: TUNING.START_RES, mode: 'expand', lastRetask: -99999, lastBuy: -99999 };
        this.matchT = 0;
        this.uiDirty = true;
        this.worldDirty = true;
        this.bannerText.node.text = { text: ' ', x: 36, y: 44, size: 4, align: 'center', color: COLORS.WHITE };
        this.bannerSub.node.text = { text: ' ', x: 36, y: 52, size: 1.6, align: 'center', color: [200, 205, 220, 255] };
    }

    mapNextClick() {
        this.mapIdx = (this.mapIdx + 1) % (MAPS.length + 1);
        if (this.mapIdx < MAPS.length) this.initMatch(MAPS[this.mapIdx]);
        else this.initMatch(generateMap(this.rndSeedBase, 320, 320, 9));
        this.base.node.onStateChange();
    }

    mapRandomClick() {
        this.rndSeedBase = (this.rndSeedBase * 1103515245 + 12345) >>> 0;
        const size = 200 + (this.rndSeedBase % 3) * 80;                 // 200 / 280 / 360
        const npts = 5 + (this.rndSeedBase % 3) * 2;                    // 5 / 7 / 9
        this.mapIdx = MAPS.length;
        this.initMatch(generateMap(this.rndSeedBase, size, size, npts));
        this.base.node.onStateChange();
    }

    fogClick() {
        this.fogOn = !this.fogOn;
        this.uiDirty = true;
        this.worldDirty = true;
        this.base.node.onStateChange();
    }

    spawnUnit(side, type, x, y) {
        for (const u of this.units) {
            if (u.alive) continue;
            if (this.countUnits(side) >= TUNING.UNIT_CAP) return null;
            const T = TUNING.UNITS[type];
            u.alive = true;
            u.side = side;
            u.type = type;
            u.x = x; u.y = y;
            u.tx = x; u.ty = y;
            u.hp = T.hp * (side === 'player' ? this.up.hpMult : 1);
            u.cd = 0;
            u.revealT = 0;
            u.visible = side === 'player';
            u.selected = false;
            u.possessed = false;
            return u;
        }
        return null;
    }

    countUnits(side) {
        let n = 0;
        for (const u of this.units) if (u.alive && u.side === side) n++;
        return n;
    }

    countTurrets(side) {
        let n = 0;
        for (const t of this.turrets) if (t.alive && t.side === side) n++;
        return n;
    }

    // -------------------------------------------------------- projection ----
    scale() { return this.ZOOMS[this.zoomIdx]; }
    w2sX(wx) { return (wx - this.cam.x) * this.scale() + VP.CX; }
    w2sY(wy) { return (wy - this.cam.y) * this.scale() + VP.CY; }
    s2wX(sx) { return (sx - VP.CX) / this.scale() + this.cam.x; }
    s2wY(sy) { return (sy - VP.CY) / this.scale() + this.cam.y; }
    inView(sx, sy, pad) {
        const p = pad || 2;
        return sx > VP.X0 - p && sx < VP.X1 + p && sy > VP.Y0 - p && sy < VP.Y1 + p;
    }
    clampCam() {
        const half = 36 / this.scale();
        if (half >= Math.max(this.world.W, this.world.H) / 2) {
            this.cam.x = this.world.W / 2; this.cam.y = this.world.H / 2;
            return;
        }
        this.cam.x = clamp(this.cam.x, Math.min(half, this.world.W / 2), Math.max(this.world.W - half, this.world.W / 2));
        this.cam.y = clamp(this.cam.y, Math.min(half, this.world.H / 2), Math.max(this.world.H - half, this.world.H / 2));
    }

    // ---------------------------------------------------------- fog of war --
    // Fog = information. Enemy units/turrets only exist for your eyes when
    // they're inside sight range of your stuff — or when their own muzzle
    // flash betrays them (revealT). The AI keeps map knowledge of POINT
    // ownership only; it never chases what it can't see, so its "cheat" stays
    // strategic, not tactical.
    computeVisibility() {
        if (!this.fogOn) {
            for (const u of this.units) u.visible = true;
            for (const t of this.turrets) t.revealT = Math.max(t.revealT, 0);
            for (const p of this.points) p.knownOwner = p.owner;
            return;
        }
        const F = TUNING.FOW;
        const eyes = [];
        for (const u of this.units) if (u.alive && u.side === 'player') eyes.push({ x: u.x, y: u.y, r: F.sightUnit });
        for (const t of this.turrets) if (t.alive && t.side === 'player') eyes.push({ x: t.x, y: t.y, r: F.sightTurret });
        eyes.push({ x: this.pb.x, y: this.pb.y, r: F.sightBase });
        for (const p of this.points) if (p.owner === 'player') eyes.push({ x: p.x, y: p.y, r: F.sightPoint });

        const seen = (x, y) => {
            for (const e of eyes) if (dist(e.x, e.y, x, y) <= e.r) return true;
            return false;
        };
        for (const u of this.units) {
            if (!u.alive) continue;
            if (u.side === 'player') { u.visible = true; continue; }
            if (u.revealT > 0) u.revealT--;
            u.visible = u.revealT > 0 || seen(u.x, u.y);
        }
        for (const t of this.turrets) {
            if (!t.alive || t.side === 'player') continue;
            if (t.revealT > 0) t.revealT--;
        }
        for (const p of this.points) {
            if (seen(p.x, p.y)) p.knownOwner = p.owner;
        }
    }

    turretVisible(t) {
        if (!this.fogOn || t.side === 'player') return true;
        if (t.revealT > 0) return true;
        const F = TUNING.FOW;
        for (const u of this.units) if (u.alive && u.side === 'player' && dist(u.x, u.y, t.x, t.y) <= F.sightUnit) return true;
        for (const tt of this.turrets) if (tt.alive && tt.side === 'player' && dist(tt.x, tt.y, t.x, t.y) <= F.sightTurret) return true;
        if (dist(this.pb.x, this.pb.y, t.x, t.y) <= F.sightBase) return true;
        for (const p of this.points) if (p.owner === 'player' && dist(p.x, p.y, t.x, t.y) <= F.sightPoint) return true;
        return false;
    }

    // ------------------------------------------------------------ input ----
    handleTap(playerId, sx, sy) {
        if (this.gameOver) { this.initMatch(); this.base.node.onStateChange(); return; }
        const wx = clamp(this.s2wX(sx), 0, this.world.W);
        const wy = clamp(this.s2wY(sy), 0, this.world.H);
        this.lastTapW = { x: wx, y: wy };

        if (this.mode === 'turret' || this.mode === 'spike') {
            this.placeBuild(this.mode, wx, wy);
            this.mode = 'none';
            this.uiDirty = true;
            return;
        }
        if (this.mode === 'box1') {
            this.boxA = { x: wx, y: wy };
            this.mode = 'box2';
            this.uiDirty = true;
            return;
        }
        if (this.mode === 'box2') {
            this.applyBoxSelect(this.boxA.x, this.boxA.y, wx, wy);
            this.mode = 'none';
            this.uiDirty = true;
            return;
        }

        if (this.possessedId >= 0) {
            const u = this.units[this.possessedId];
            if (u && u.alive) {
                u.tx = wx; u.ty = wy;
                this.pingOrder(wx, wy);
                return;
            }
        }

        const pickR = Math.max(2.5, 2.2 / this.scale());
        let hit = null, hd = pickR;
        for (const u of this.units) {
            if (!u.alive || u.side !== 'player') continue;
            const d = dist(u.x, u.y, wx, wy);
            if (d < hd) { hd = d; hit = u; }
        }
        if (hit) {
            for (const u of this.units) u.selected = false;
            if (this.zoomIdx < 2) {
                const cl = this.clusterAt(hit.x, hit.y) || [hit];
                for (const u of cl) u.selected = true;
            } else {
                hit.selected = true;
            }
            this.uiDirty = true;
            return;
        }

        if (this.zoomIdx < 2) {
            const cl = this.clusterAt(wx, wy);
            if (cl) {
                for (const u of this.units) u.selected = false;
                for (const u of cl) u.selected = true;
                this.uiDirty = true;
                return;
            }
        }

        if (this.selectedUnits().length > 0) {
            this.issueOrder(wx, wy);
        }
    }

    selectedUnits() {
        return this.units.filter((u) => u.alive && u.side === 'player' && u.selected);
    }

    selectAll() {
        if (this.gameOver) return;
        let any = false;
        for (const u of this.units) {
            if (u.alive && u.side === 'player') { u.selected = true; any = true; }
        }
        this.mode = 'none';
        this.uiDirty = true;
        if (any) this.base.node.onStateChange();
    }

    boxClick() {
        if (this.gameOver) return;
        this.mode = this.mode === 'box1' || this.mode === 'box2' ? 'none' : 'box1';
        this.uiDirty = true;
        this.base.node.onStateChange();
    }

    applyBoxSelect(x1, y1, x2, y2) {
        const lo = { x: Math.min(x1, x2), y: Math.min(y1, y2) };
        const hi = { x: Math.max(x1, x2), y: Math.max(y1, y2) };
        for (const u of this.units) {
            if (!u.alive || u.side !== 'player') { u.selected = false; continue; }
            u.selected = u.x >= lo.x && u.x <= hi.x && u.y >= lo.y && u.y <= hi.y;
        }
    }

    clusterCell() { return (this.zoomIdx === 0 ? 0.2 : 0.08) * Math.max(this.world.W, this.world.H); }

    clusterAt(wx, wy) {
        const cell = this.clusterCell();
        const cx = Math.floor(wx / cell), cy = Math.floor(wy / cell);
        const out = [];
        for (const u of this.units) {
            if (!u.alive || u.side !== 'player') continue;
            if (Math.floor(u.x / cell) === cx && Math.floor(u.y / cell) === cy) out.push(u);
        }
        return out.length ? out : null;
    }

    issueOrder(wx, wy) {
        const sel = this.selectedUnits();
        sel.forEach((u, i) => {
            const ang = i * 2.4;
            const r = 2.5 * Math.sqrt(i);
            u.tx = clamp(wx + Math.cos(ang) * r, 2, this.world.W - 2);
            u.ty = clamp(wy + Math.sin(ang) * r, 2, this.world.H - 2);
        });
        this.pingOrder(wx, wy);
    }

    pingOrder(wx, wy) {
        this.orderMark.life = TK(14);
        this.orderMark.x = wx;
        this.orderMark.y = wy;
    }

    trainClick(type) {
        if (this.gameOver) return;
        const T = TUNING.UNITS[type];
        const cost = Math.round(T.cost * this.up.costMult);
        if (this.res < cost) return;
        if (this.countUnits('player') >= TUNING.UNIT_CAP) return;
        const u = this.spawnUnit('player', type, this.pb.x + 6 + Math.random() * 4, this.pb.y - 6 + Math.random() * 12);
        if (!u) return;
        this.res -= cost;
        u.tx = this.pb.x + 16; u.ty = this.pb.y;
        this.uiDirty = true;
        this.base.node.onStateChange();
    }

    buildClick(kind) {
        if (this.gameOver) return;
        const cost = kind === 'turret' ? TUNING.TURRET.cost : TUNING.SPIKE.cost;
        if (this.res < cost) { this.mode = 'none'; this.uiDirty = true; return; }
        this.mode = this.mode === kind ? 'none' : kind;
        this.uiDirty = true;
        this.base.node.onStateChange();
    }

    placeTurret(side, wx, wy) {
        if (this.countTurrets(side) >= TUNING.TURRET.maxPerSide) return null;
        for (const t of this.turrets) {
            if (t.alive) continue;
            t.alive = true;
            t.side = side;
            t.x = clamp(wx, 3, this.world.W - 3);
            t.y = clamp(wy, 3, this.world.H - 3);
            t.hp = TUNING.TURRET.hp;
            t.cd = 0;
            t.revealT = 0;
            this.emitBurst(t.x, t.y, side === 'player' ? C_PLAYER : C_AI, 6);
            this.worldDirty = true;
            return t;
        }
        return null;
    }

    placeBuild(kind, wx, wy) {
        if (kind === 'turret') {
            if (this.res < TUNING.TURRET.cost) return;
            if (this.placeTurret('player', wx, wy)) this.res -= TUNING.TURRET.cost;
        } else {
            if (this.res < TUNING.SPIKE.cost) return;
            for (const s of this.spikes) {
                if (s.alive) continue;
                s.alive = true;
                s.x = clamp(wx, 3, this.world.W - 3);
                s.y = clamp(wy, 3, this.world.H - 3);
                s.charges = TUNING.SPIKE.charges;
                this.res -= TUNING.SPIKE.cost;
                this.emitBurst(s.x, s.y, [200, 205, 220, 255], 5);
                this.worldDirty = true;
                return;
            }
        }
    }

    controlClick() {
        if (this.gameOver) return;
        if (this.possessedId >= 0) {
            const u = this.units[this.possessedId];
            if (u) u.possessed = false;
            this.possessedId = -1;
            this.uiDirty = true;
            this.base.node.onStateChange();
            return;
        }
        const sel = this.selectedUnits();
        if (!sel.length) return;
        const u = sel[0];
        u.possessed = true;
        this.possessedId = u.id;
        this.zoomIdx = 2;
        this.cam.x = u.x; this.cam.y = u.y;
        this.clampCam();
        this.uiDirty = true;
        this.base.node.onStateChange();
    }

    zoomClick(dir) {
        if (this.gameOver) return;
        const prev = this.zoomIdx;
        this.zoomIdx = clamp(this.zoomIdx + dir, 0, this.ZOOMS.length - 1);
        if (this.zoomIdx === prev) return;
        const sel = this.selectedUnits();
        if (dir > 0) {
            if (sel.length) {
                let cx = 0, cy = 0;
                for (const u of sel) { cx += u.x; cy += u.y; }
                this.cam.x = cx / sel.length; this.cam.y = cy / sel.length;
            } else {
                this.cam.x = this.lastTapW.x; this.cam.y = this.lastTapW.y;
            }
        }
        this.clampCam();
        this.uiDirty = true;
        this.worldDirty = true;
        this.base.node.onStateChange();
    }

    panClick(dx, dy) {
        if (this.gameOver) return;
        const step = 24 / this.scale() * 0.6;
        this.cam.x += dx * step;
        this.cam.y += dy * step;
        this.clampCam();
        this.worldDirty = true;
        this.base.node.onStateChange();
    }

    // ------------------------------------------------------------ combat ----
    fireTracer(x1, y1, x2, y2, side) {
        for (const tr of this.tracers) {
            if (tr.active) continue;
            tr.active = true;
            tr.x1 = x1; tr.y1 = y1; tr.x2 = x2; tr.y2 = y2;
            tr.life = TK(3);
            tr.side = side;
            return;
        }
    }

    emitBurst(x, y, fill, count) {
        for (const f of this.fx) {
            if (count <= 0) break;
            if (f.active) continue;
            count--;
            f.active = true;
            f.life = TK(10); f.max = TK(10);
            f.x = x; f.y = y;
            const a = Math.random() * Math.PI * 2;
            const s = V(0.5 + Math.random() * 0.8);
            f.vx = Math.cos(a) * s;
            f.vy = Math.sin(a) * s;
            f.fill = fill;
        }
    }

    killUnit(u, killerSide) {
        u.alive = false;
        u.selected = false;
        this.emitBurst(u.x, u.y, u.side === 'player' ? C_PLAYER : C_AI, 8);
        if (u.possessed) { u.possessed = false; this.possessedId = -1; this.uiDirty = true; }
        if (killerSide === 'player' && u.side === 'ai') this.gainXp(TUNING.UNITS[u.type].xp);
    }

    gainXp(n) {
        this.xp += n;
        const need = TUNING.LEVELS[this.level - 1];
        if (need !== undefined && this.xp >= need) {
            this.level++;
            const upg = TUNING.UPGRADES[this.upIdx % TUNING.UPGRADES.length];
            this.upIdx++;
            upg.apply(this.up);
            this.toastText.node.text = { text: 'LEVEL ' + this.level + ': ' + upg.label, x: 36, y: 11.2, size: 1.3, align: 'center', color: C_SELECT };
            this.toastLife = TK(70);
        }
        this.uiDirty = true;
    }

    nearestEnemyOf(side, x, y, maxD) {
        let best = null, bd = maxD;
        for (const u of this.units) {
            if (!u.alive || u.side === side) continue;
            const d = dist(u.x, u.y, x, y);
            if (d < bd) { bd = d; best = { kind: 'unit', ref: u, d }; }
        }
        for (const t of this.turrets) {
            if (!t.alive || t.side === side) continue;
            const d = dist(t.x, t.y, x, y);
            if (d < bd) { bd = d; best = { kind: 'turret', ref: t, d }; }
        }
        const eb = side === 'player' ? this.bases.ai : this.bases.player;
        const dB = dist(eb.x, eb.y, x, y) - 4;
        if (dB < bd) { bd = dB; best = { kind: 'base', ref: eb, d: dB }; }
        return best;
    }

    damageThing(target, dmg, killerSide) {
        if (target.kind === 'unit') {
            target.ref.hp -= dmg;
            if (target.ref.hp <= 0) this.killUnit(target.ref, killerSide);
        } else if (target.kind === 'turret') {
            target.ref.hp -= dmg;
            if (target.ref.hp <= 0) {
                target.ref.alive = false;
                this.emitBurst(target.ref.x, target.ref.y, [200, 200, 210, 255], 10);
                if (killerSide === 'player' && target.ref.side === 'ai') this.gainXp(TUNING.XP_TURRET_KILL);
                this.worldDirty = true;
            }
        } else {
            target.ref.hp -= dmg;
            this.uiDirty = true;
            if (target.ref.hp <= 0) this.endMatch(target.ref === this.bases.ai ? 'win' : 'lose');
        }
    }

    endMatch(result) {
        if (this.gameOver) return;
        this.gameOver = result;
        const win = result === 'win';
        this.bannerText.node.text = {
            text: win ? 'VICTORY' : 'DEFEAT', x: 36, y: 44, size: 4, align: 'center',
            color: win ? C_SELECT : C_AI
        };
        this.bannerSub.node.text = { text: 'TAP THE MAP TO PLAY AGAIN', x: 36, y: 52, size: 1.6, align: 'center', color: [200, 205, 220, 255] };
        this.emitBurst(win ? this.ab.x : this.pb.x, this.world.H / 2, win ? C_SELECT : C_AI, 20);
    }

    // -------------------------------------------------------------- sim ----
    unitStats(u) {
        const T = TUNING.UNITS[u.type], P = TUNING.POSSESS;
        const mine = u.side === 'player';
        return {
            dmg: T.dmg * (mine ? this.up.dmgMult : 1) * (u.possessed ? P.dmgMult : 1),
            rng: T.range * (mine ? this.up.rangeMult : 1) * (u.possessed ? P.rangeMult : 1),
            spd: V(T.speed * (mine ? this.up.speedMult : 1) * (u.possessed ? P.speedMult : 1)),
            cd: T.fireCd * (u.possessed ? P.cdMult : 1),
            aggro: T.aggro,
            melee: T.range < 4
        };
    }

    updateUnits() {
        for (const u of this.units) {
            if (!u.alive) continue;
            if (u.cd > 0) u.cd--;
            const S = this.unitStats(u);

            const foe = this.nearestEnemyOf(u.side, u.x, u.y, u.possessed ? Math.max(S.rng, S.aggro) : S.aggro);
            if (foe && foe.d <= S.rng) {
                if (u.cd <= 0) {
                    u.cd = TK(S.cd);
                    const tx = foe.ref.x, ty = foe.ref.y;
                    if (S.melee) {
                        this.emitBurst(tx, ty, [255, 240, 200, 255], 4);   // the maul
                    } else {
                        this.fireTracer(u.x, u.y, tx, ty, u.side);
                        this.emitBurst(tx, ty, [255, 220, 120, 255], 1);
                    }
                    u.revealT = TK(TUNING.FOW.revealOnFire);               // muzzle flash betrays
                    this.damageThing(foe, S.dmg, u.side);
                }
            } else if (foe && !u.possessed && foe.d <= S.aggro) {
                const a = Math.atan2(foe.ref.y - u.y, foe.ref.x - u.x);
                u.x += Math.cos(a) * S.spd;
                u.y += Math.sin(a) * S.spd;
            } else {
                const d = dist(u.x, u.y, u.tx, u.ty);
                if (d > 1.2) {
                    const a = Math.atan2(u.ty - u.y, u.tx - u.x);
                    u.x += Math.cos(a) * S.spd;
                    u.y += Math.sin(a) * S.spd;
                }
            }
            u.x = clamp(u.x, 1.5, this.world.W - 1.5);
            u.y = clamp(u.y, 1.5, this.world.H - 1.5);
        }

        for (let i = 0; i < this.units.length; i++) {
            const a = this.units[i];
            if (!a.alive) continue;
            for (let j = i + 1; j < this.units.length; j++) {
                const b = this.units[j];
                if (!b.alive) continue;
                const dx = b.x - a.x, dy = b.y - a.y;
                const d = Math.hypot(dx, dy);
                const want = TUNING.UNITS[a.type].radius + TUNING.UNITS[b.type].radius;
                if (d < want && d > 0.001) {
                    const push = (want - d) * 0.5;
                    const nx = dx / d, ny = dy / d;
                    a.x -= nx * push * 0.5; a.y -= ny * push * 0.5;
                    b.x += nx * push * 0.5; b.y += ny * push * 0.5;
                }
            }
        }
    }

    updateTurrets() {
        const T = TUNING.TURRET;
        for (const t of this.turrets) {
            if (!t.alive) continue;
            if (t.cd > 0) { t.cd--; continue; }
            const foe = this.nearestEnemyOf(t.side, t.x, t.y, T.range);
            if (foe && foe.kind === 'unit') {
                t.cd = TK(T.fireCd);
                this.fireTracer(t.x, t.y, foe.ref.x, foe.ref.y, t.side);
                t.revealT = TK(TUNING.FOW.revealOnFire);
                this.damageThing(foe, T.dmg * (t.side === 'player' ? this.up.turretMult : 1), t.side);
                this.emitBurst(foe.ref.x, foe.ref.y, [255, 220, 120, 255], 1);
            }
        }
    }

    updateSpikes() {
        const S = TUNING.SPIKE;
        if (this._t % TK(S.tickEvery) !== 0) return;
        for (const s of this.spikes) {
            if (!s.alive) continue;
            for (const u of this.units) {
                if (!u.alive || u.side !== 'ai') continue;
                if (dist(u.x, u.y, s.x, s.y) <= S.radius) {
                    u.hp -= S.dmg;
                    s.charges--;
                    this.emitBurst(u.x, u.y, [220, 220, 230, 255], 1);
                    if (u.hp <= 0) this.killUnit(u, 'player');
                    if (s.charges <= 0) { s.alive = false; this.worldDirty = true; break; }
                }
            }
        }
    }

    updateBases() {
        const B = TUNING.BASE;
        for (const side of ['player', 'ai']) {
            const b = this.bases[side];
            if (b.hp <= 0) continue;
            if (b.cd > 0) { b.cd--; continue; }
            const foe = this.nearestEnemyOf(side, b.x, b.y, B.range);
            if (foe && foe.kind === 'unit') {
                b.cd = TK(B.fireCd);
                this.fireTracer(b.x, b.y, foe.ref.x, foe.ref.y, side);
                this.damageThing(foe, B.dmg, side);
            }
        }
    }

    updatePoints() {
        const R = TUNING.CAP_RADIUS;
        for (const p of this.points) {
            let pl = 0, ai = 0;
            for (const u of this.units) {
                if (!u.alive) continue;
                if (dist(u.x, u.y, p.x, p.y) <= R) {
                    if (u.side === 'player') pl++; else ai++;
                }
            }
            if (pl === ai) continue;
            p.prog = clamp(p.prog + (pl - ai) * TUNING.CAP_RATE * DT, -100, 100);
            const before = p.owner;
            if (p.prog >= TUNING.CAP_FLIP) p.owner = 'player';
            else if (p.prog <= -TUNING.CAP_FLIP) p.owner = 'ai';
            if (p.owner !== before) {
                this.emitBurst(p.x, p.y, p.owner === 'player' ? C_PLAYER : C_AI, 10);
                this.worldDirty = true;
                this.uiDirty = true;
            }
        }
    }

    updateEconomy() {
        if (this._t % TK(20) !== 0) return;
        let inc = TUNING.BASE_INCOME;
        let aiInc = TUNING.BASE_INCOME;
        for (const p of this.points) {
            if (p.owner === 'player') inc += p.income;
            if (p.owner === 'ai') aiInc += p.income;
        }
        this.res += inc;
        this.aiState.res += aiInc * (1 + this.matchT * TUNING.AI.incomeRamp);
        this.uiDirty = true;
    }

    aiPickType() {
        const r = Math.random();
        let acc = 0;
        for (const [type, w] of TUNING.AI.mix) {
            acc += w;
            if (r <= acc) return type;
        }
        return 'soldier';
    }

    updateAiBrain() {
        const A = TUNING.AI, S = this.aiState;
        if (this._t % TK(A.thinkEvery) !== 0) return;

        // production: units on tempo; turrets from surplus
        if (this._t - S.lastBuy >= TK(A.buyEvery) && this.countUnits('ai') < TUNING.UNIT_CAP) {
            const type = this.aiPickType();
            const cost = TUNING.UNITS[type].cost;
            if (S.res >= cost) {
                S.lastBuy = this._t;
                S.res -= cost;
                const u = this.spawnUnit('ai', type, this.ab.x - 6 - Math.random() * 4, this.ab.y - 6 + Math.random() * 12);
                if (u) { u.tx = this.ab.x - 16; u.ty = this.ab.y; }
            }
        }
        if (S.res >= A.turretAt && this.countTurrets('ai') < TUNING.TURRET.maxPerSide) {
            S.res -= TUNING.TURRET.cost;
            const nT = this.countTurrets('ai');
            if (nT === 0) {
                this.placeTurret('ai', this.ab.x - 14, this.ab.y - 8);        // guard the mouth
            } else if (nT === 1) {
                this.placeTurret('ai', this.ab.x - 14, this.ab.y + 8);
            } else {
                // forward turret at its owned point nearest the player
                const own = this.points.filter((p) => p.owner === 'ai')
                    .sort((a, b) => dist(a.x, a.y, this.pb.x, this.pb.y) - dist(b.x, b.y, this.pb.x, this.pb.y));
                if (own.length) this.placeTurret('ai', own[0].x + 4, own[0].y - 4);
                else this.placeTurret('ai', this.ab.x - 20, this.ab.y);
            }
        }

        const army = this.countUnits('ai');
        if (this._t - S.lastRetask < TK(A.retaskEvery)) return;
        S.lastRetask = this._t;
        S.mode = (army >= A.attackArmy || this.matchT >= A.attackTime) ? 'attack' : 'expand';

        if (S.mode === 'attack') {
            for (const u of this.units) {
                if (!u.alive || u.side !== 'ai') continue;
                u.tx = this.pb.x + (Math.random() - 0.5) * 10;
                u.ty = this.pb.y + (Math.random() - 0.5) * 10;
            }
            return;
        }

        const targets = this.points
            .filter((p) => p.owner !== 'ai')
            .sort((a, b) => dist(a.x, a.y, this.ab.x, this.ab.y) - dist(b.x, b.y, this.ab.x, this.ab.y));
        const rally = targets.length ? null : { x: this.world.W * 0.7, y: this.world.H / 2 };
        let i = 0;
        for (const u of this.units) {
            if (!u.alive || u.side !== 'ai') continue;
            const p = rally || targets[Math.floor(i / 4) % targets.length];
            const ang = i * 2.4;
            u.tx = clamp(p.x + Math.cos(ang) * 4, 2, this.world.W - 2);
            u.ty = clamp(p.y + Math.sin(ang) * 4, 2, this.world.H - 2);
            i++;
        }
    }

    // -------------------------------------------------------- rendering ----
    hideShape(n) {
        n.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        n.node.fill = [0, 0, 0, 0];
    }

    renderWorldStatics() {
        const s = this.scale();
        const gx = this.w2sX(0), gy = this.w2sY(0);
        const gw = this.world.W * s, gh = this.world.H * s;
        const x0 = clamp(gx, VP.X0, VP.X1), y0 = clamp(gy, VP.Y0, VP.Y1);
        const x1 = clamp(gx + gw, VP.X0, VP.X1), y1 = clamp(gy + gh, VP.Y0, VP.Y1);
        this.groundNode.node.coordinates2d = ShapeUtils.rectangle(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
        this.groundNode.node.fill = C_GROUND;
        for (let i = 0; i < 3; i++) {
            const wxa = this.world.W * (0.125 + i * 0.3);
            const wxb = this.world.W * (0.275 + i * 0.3);
            const bx0 = clamp(this.w2sX(wxa), VP.X0, VP.X1);
            const bx1 = clamp(this.w2sX(wxb), VP.X0, VP.X1);
            this.groundBands[i].node.coordinates2d = ShapeUtils.rectangle(bx0, y0, Math.max(0, bx1 - bx0), Math.max(0, y1 - y0));
            this.groundBands[i].node.fill = C_GROUND2;
        }

        for (let i = 0; i < this.pointNodes.length; i++) {
            const n = this.pointNodes[i];
            const p = this.points[i];
            if (!p) { this.hideShape(n.ring); this.hideShape(n.core); this.hideShape(n.bar); continue; }
            const sx = this.w2sX(p.x), sy = this.w2sY(p.y);
            if (!this.inView(sx, sy, 10 * s)) { this.hideShape(n.ring); this.hideShape(n.core); this.hideShape(n.bar); continue; }
            const rr = Math.max(1.6, TUNING.CAP_RADIUS * s * 0.55);
            const shownOwner = this.fogOn ? p.knownOwner : p.owner;
            const ownCol = shownOwner === 'player' ? C_PLAYER : shownOwner === 'ai' ? C_AI : C_NEUTRAL;
            n.ring.node.coordinates2d = polyCircle(sx, sy, rr, 12);
            n.ring.node.fill = [ownCol[0], ownCol[1], ownCol[2], 90];
            n.core.node.coordinates2d = polyCircle(sx, sy, Math.max(0.8, rr * 0.4), 8);
            n.core.node.fill = ownCol;
            const frac = clamp(p.prog / 100, -1, 1);
            const bw = rr * 1.6;
            const showBar = (!this.fogOn || p.knownOwner === p.owner) && Math.abs(frac) > 0.03 && Math.abs(p.prog) < 100;
            if (showBar) {
                n.bar.node.coordinates2d = ShapeUtils.rectangle(sx - bw / 2, sy - rr - 1.6, bw * Math.abs(frac), 0.8);
                n.bar.node.fill = frac > 0 ? C_PLAYER : C_AI;
            } else this.hideShape(n.bar);
        }

        for (const side of ['player', 'ai']) {
            const b = this.bases[side], nn = this.baseNodes[side];
            const sx = this.w2sX(b.x), sy = this.w2sY(b.y);
            const r = Math.max(2, 6 * s);
            if (!this.inView(sx, sy, r + 2)) { this.hideShape(nn.body); this.hideShape(nn.inner); continue; }
            nn.body.node.coordinates2d = ShapeUtils.rectangle(sx - r, sy - r, r * 2, r * 2);
            nn.body.node.fill = side === 'player' ? C_PLAYER_DIM : C_AI_DIM;
            const frac = clamp(b.hp / TUNING.BASE.hp, 0, 1);
            nn.inner.node.coordinates2d = ShapeUtils.rectangle(sx - r * 0.7, sy - r * 0.7 + r * 1.4 * (1 - frac), r * 1.4, r * 1.4 * frac);
            nn.inner.node.fill = side === 'player' ? C_PLAYER : C_AI;
        }

        for (const t of this.turrets) {
            if (!t.alive || !this.turretVisible(t)) { this.hideShape(t.body); this.hideShape(t.barrel); continue; }
            const sx = this.w2sX(t.x), sy = this.w2sY(t.y);
            const r = Math.max(1.1, 2.4 * s);
            if (!this.inView(sx, sy, r + 2)) { this.hideShape(t.body); this.hideShape(t.barrel); continue; }
            t.body.node.coordinates2d = polyCircle(sx, sy, r, 8);
            t.body.node.fill = t.side === 'player' ? [70, 120, 150, 255] : [150, 85, 70, 255];
            t.barrel.node.coordinates2d = ShapeUtils.rectangle(sx - r * 0.25, sy - r * 1.6, r * 0.5, r * 1.6);
            t.barrel.node.fill = t.side === 'player' ? C_PLAYER : C_AI;
        }

        for (const sp of this.spikes) {
            if (!sp.alive) { this.hideShape(sp.node); continue; }
            const sx = this.w2sX(sp.x), sy = this.w2sY(sp.y);
            const r = Math.max(1, TUNING.SPIKE.radius * this.scale() * 0.7);
            if (!this.inView(sx, sy, r + 2)) { this.hideShape(sp.node); continue; }
            sp.node.node.coordinates2d = diamond(sx, sy, r);
            sp.node.node.fill = [150, 155, 170, clampByte(120 + 110 * (sp.charges / TUNING.SPIKE.charges))];
        }
    }

    unitShape(u, sx, sy, r) {
        if (u.type === 'ranger') return triangle(sx, sy, r * 1.15);
        if (u.type === 'brute') return polyCircle(sx, sy, r, 6);
        return polyCircle(sx, sy, r, 9);
    }

    renderUnitsAndIcons() {
        const s = this.scale();
        const zoomedIn = this.zoomIdx === 2;

        if (zoomedIn) {
            for (const side of ['player', 'ai']) for (const ic of this.icons[side]) {
                this.hideShape(ic.shape);
                ic.label.node.text = { text: ' ', x: 0, y: -10, size: 1, align: 'center', color: COLORS.WHITE };
            }
            for (const u of this.units) {
                if (!u.alive || !u.visible) { this.hideShape(u.body); this.hideShape(u.gun); continue; }
                const sx = this.w2sX(u.x), sy = this.w2sY(u.y);
                if (!this.inView(sx, sy, 5)) { this.hideShape(u.body); this.hideShape(u.gun); continue; }
                const r = TUNING.UNITS[u.type].radius * s;
                const col = u.side === 'player' ? (u.selected ? C_SELECT : C_PLAYER) : C_AI;
                const hurt = u.hp < TUNING.UNITS[u.type].hp * 0.4;
                u.body.node.coordinates2d = this.unitShape(u, sx, sy, r);
                u.body.node.fill = hurt ? [col[0], clampByte(col[1] * 0.6), clampByte(col[2] * 0.6), 255] : col;
                const a = Math.atan2(u.ty - u.y, u.tx - u.x);
                u.gun.node.coordinates2d = thickLine(sx, sy, sx + Math.cos(a) * r * 1.7, sy + Math.sin(a) * r * 1.7, r * 0.45);
                u.gun.node.fill = u.type === 'brute' ? [255, 200, 160, 255] : [230, 232, 240, 255];
            }
            if (this.possessedId >= 0) {
                const u = this.units[this.possessedId];
                if (u && u.alive) {
                    const sx = this.w2sX(u.x), sy = this.w2sY(u.y);
                    this.possessRing.node.coordinates2d = polyCircle(sx, sy, TUNING.UNITS[u.type].radius * s * 1.8, 10);
                    this.possessRing.node.fill = [255, 255, 255, 70];
                } else this.hideShape(this.possessRing);
            } else this.hideShape(this.possessRing);
            return;
        }

        this.hideShape(this.possessRing);
        for (const u of this.units) { this.hideShape(u.body); this.hideShape(u.gun); }
        const cell = this.clusterCell();
        for (const side of ['player', 'ai']) {
            const cells = new Map();
            for (const u of this.units) {
                if (!u.alive || u.side !== side) continue;
                if (side === 'ai' && !u.visible) continue;                     // fog hides counts too
                const key = Math.floor(u.x / cell) + '_' + Math.floor(u.y / cell);
                let c = cells.get(key);
                if (!c) { c = { n: 0, sx: 0, sy: 0, sel: false }; cells.set(key, c); }
                c.n++; c.sx += u.x; c.sy += u.y;
                if (u.selected) c.sel = true;
            }
            const arr = [...cells.values()].sort((a, b) => b.n - a.n).slice(0, TUNING.MAX_ICONS);
            let i = 0;
            for (const ic of this.icons[side]) {
                const c = arr[i++];
                if (!c) {
                    this.hideShape(ic.shape);
                    ic.label.node.text = { text: ' ', x: 0, y: -10, size: 1, align: 'center', color: COLORS.WHITE };
                    continue;
                }
                const wx = c.sx / c.n, wy = c.sy / c.n;
                const sx = this.w2sX(wx), sy = this.w2sY(wy);
                if (!this.inView(sx, sy, 4)) { this.hideShape(ic.shape); ic.label.node.text = { text: ' ', x: 0, y: -10, size: 1, align: 'center', color: COLORS.WHITE }; continue; }
                const r = this.zoomIdx === 0 ? 2.2 : 1.8;
                ic.shape.node.coordinates2d = side === 'player' ? triangle(sx, sy, r + Math.min(1.4, c.n * 0.12)) : diamond(sx, sy, r + Math.min(1.4, c.n * 0.12));
                ic.shape.node.fill = side === 'player' ? (c.sel ? C_SELECT : C_PLAYER) : C_AI;
                ic.label.node.text = { text: '' + c.n, x: sx, y: sy + r + 0.6, size: 1.1, align: 'center', color: COLORS.WHITE };
            }
        }
    }

    renderTransients() {
        let any = false;
        for (const tr of this.tracers) {
            if (!tr.active) continue;
            any = true;
            tr.life--;
            if (tr.life <= 0) { tr.active = false; this.hideShape(tr.node); continue; }
            const x1 = this.w2sX(tr.x1), y1 = this.w2sY(tr.y1);
            const x2 = this.w2sX(tr.x2), y2 = this.w2sY(tr.y2);
            if (!this.inView(x1, y1, 6) && !this.inView(x2, y2, 6)) { this.hideShape(tr.node); continue; }
            tr.node.node.coordinates2d = thickLine(
                clamp(x1, VP.X0, VP.X1), clamp(y1, VP.Y0, VP.Y1),
                clamp(x2, VP.X0, VP.X1), clamp(y2, VP.Y0, VP.Y1), 0.35);
            tr.node.node.fill = tr.side === 'player' ? [180, 240, 255, 220] : [255, 190, 160, 220];
        }
        for (const f of this.fx) {
            if (!f.active) continue;
            any = true;
            f.x += f.vx; f.y += f.vy;
            f.life--;
            const n = f.node.node;
            if (f.life <= 0) { f.active = false; this.hideShape(f.node); n.color = [255, 255, 255, 0]; continue; }
            const sx = this.w2sX(f.x), sy = this.w2sY(f.y);
            if (!this.inView(sx, sy, 2)) { this.hideShape(f.node); continue; }
            n.coordinates2d = ShapeUtils.rectangle(sx - 0.3, sy - 0.3, 0.6, 0.6);
            n.fill = [f.fill[0], f.fill[1], f.fill[2], 255];
            n.color = [255, 255, 255, clampByte(220 * f.life / f.max)];
        }
        if (this.orderMark.life > 0) {
            any = true;
            this.orderMark.life--;
            if (this.orderMark.life <= 0) this.hideShape(this.orderMark.node);
            else {
                const sx = this.w2sX(this.orderMark.x), sy = this.w2sY(this.orderMark.y);
                const k = 1 - this.orderMark.life / TK(14);
                this.orderMark.node.node.coordinates2d = polyCircle(sx, sy, 1 + k * 3.5, 10);
                this.orderMark.node.node.fill = [C_SELECT[0], C_SELECT[1], C_SELECT[2], clampByte(200 * (1 - k))];
            }
        }
        if (this.mode === 'box2') {
            const sx = this.w2sX(this.boxA.x), sy = this.w2sY(this.boxA.y);
            this.boxMark.node.coordinates2d = polyCircle(sx, sy, 1.2, 6);
            this.boxMark.node.fill = C_SELECT;
            any = true;
        } else this.hideShape(this.boxMark);
        return any;
    }

    refreshHud() {
        this.resText.node.text = { text: 'RES ' + Math.floor(this.res), x: 36, y: 1, size: 1.6, align: 'center', color: COLORS.HG_YELLOW };
        this.lvlText.node.text = { text: 'LV ' + this.level, x: 36, y: 5.2, size: 1.2, align: 'center', color: COLORS.WHITE };
        const need = TUNING.LEVELS[this.level - 1];
        const prev = this.level >= 2 ? TUNING.LEVELS[this.level - 2] : 0;
        const frac = need === undefined ? 1 : clamp((this.xp - prev) / (need - prev), 0, 1);
        this.xpBar.node.coordinates2d = ShapeUtils.rectangle(26, 9, Math.max(0.2, 20 * frac), 1.6);
        this.xpBar.node.fill = [170, 120, 250, 255];
        this.pBaseBar.node.coordinates2d = ShapeUtils.rectangle(2, 4, Math.max(0.2, 18 * clamp(this.bases.player.hp / TUNING.BASE.hp, 0, 1)), 2);
        this.pBaseBar.node.fill = C_PLAYER;
        this.aBaseBar.node.coordinates2d = ShapeUtils.rectangle(52, 4, Math.max(0.2, 18 * clamp(this.bases.ai.hp / TUNING.BASE.hp, 0, 1)), 2);
        this.aBaseBar.node.fill = C_AI;

        const nSel = this.selectedUnits().length;
        this.statusText.node.text = {
            text: nSel > 0 ? nSel + ' SELECTED' : 'NO SELECTION',
            x: 86, y: 83.2, size: 1.0, align: 'center', color: nSel > 0 ? C_SELECT : [160, 165, 180, 255]
        };
        const modeStr = this.mode === 'box1' ? 'BOX: TAP CORNER 1'
            : this.mode === 'box2' ? 'BOX: TAP CORNER 2'
            : this.mode === 'turret' ? 'TAP MAP: PLACE TURRET'
            : this.mode === 'spike' ? 'TAP MAP: PLACE SPIKES'
            : this.possessedId >= 0 ? 'CONTROLLING UNIT' : ' ';
        this.modeText.node.text = { text: modeStr, x: 86, y: 85.8, size: 1.0, align: 'center', color: C_SELECT };
        this.zoomText.node.text = {
            text: 'ZOOM: ' + ['MAP', 'AREA', 'GROUND'][this.zoomIdx],
            x: 86, y: 88.4, size: 1.0, align: 'center', color: [160, 220, 180, 255]
        };
        this.mapText.node.text = { text: this.map.name, x: 86, y: 91, size: 1.0, align: 'center', color: [200, 205, 220, 255] };
        this.buttons.ctrl.txt.node.text = {
            text: this.possessedId >= 0 ? 'RELEASE' : 'TAKE CONTROL',
            x: 86, y: this.buttons.ctrl.y + this.buttons.ctrl.h / 2 - 0.8, size: 1.05, align: 'center', color: COLORS.WHITE
        };
        for (const type of ['soldier', 'ranger', 'brute']) {
            const b = this.buttons[type];
            b.txt.node.text = {
                text: TUNING.UNITS[type].name + ' $' + Math.round(TUNING.UNITS[type].cost * this.up.costMult),
                x: b.x + b.w / 2, y: b.y + b.h / 2 - 0.8, size: 1.05, align: 'center', color: COLORS.WHITE
            };
        }
        this.buttons.fog.txt.node.text = {
            text: 'FOG: ' + (this.fogOn ? 'ON' : 'OFF'),
            x: 86, y: this.buttons.fog.y + this.buttons.fog.h / 2 - 0.8, size: 1.05, align: 'center', color: COLORS.WHITE
        };
        this.buttons.turret.bg.node.fill = this.mode === 'turret' ? [46, 122, 74, 255] : [42, 44, 54, 255];
        this.buttons.spike.bg.node.fill = this.mode === 'spike' ? [46, 122, 74, 255] : [42, 44, 54, 255];
        this.buttons.box.bg.node.fill = this.mode === 'box1' || this.mode === 'box2' ? [46, 122, 74, 255] : [42, 44, 54, 255];
        this.buttons.ctrl.bg.node.fill = this.possessedId >= 0 ? [122, 74, 46, 255] : [42, 44, 54, 255];
        this.buttons.fog.bg.node.fill = this.fogOn ? [42, 64, 54, 255] : [42, 44, 54, 255];
    }

    // ------------------------------------------------------------- tick ----
    tick() {
        this._t++;
        let changed = false;

        if (!this.gameOver) {
            this.matchT += DT / BASE_TICK;
            this.updateUnits();
            this.updateTurrets();
            this.updateSpikes();
            this.updateBases();
            this.updatePoints();
            this.updateEconomy();
            this.updateAiBrain();
            if (this._t % TK(4) === 0) this.computeVisibility();

            if (this.possessedId >= 0) {
                const u = this.units[this.possessedId];
                if (u && u.alive) {
                    this.cam.x += (u.x - this.cam.x) * 0.15;
                    this.cam.y += (u.y - this.cam.y) * 0.15;
                    this.clampCam();
                }
            }
            changed = true;
        }

        this.renderWorldStatics();
        this.renderUnitsAndIcons();
        if (this.renderTransients()) changed = true;
        if (this.worldDirty) { this.worldDirty = false; changed = true; }

        if (this.toastLife > 0) {
            this.toastLife--;
            if (this.toastLife === 0) {
                this.toastText.node.text = { text: ' ', x: 36, y: 11.2, size: 1.3, align: 'center', color: C_SELECT };
                changed = true;
            }
        }

        if (this.uiDirty) { this.refreshHud(); this.uiDirty = false; changed = true; }

        if (changed) this.base.node.onStateChange();
    }
}

module.exports = Warpoint;
module.exports.MAPS = MAPS;
module.exports.generateMap = generateMap;
