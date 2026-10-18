// Buddy Box — a modern Interactive Buddy for Homegames (squish-150)
// A muscle-driven ragdoll buddy runs for his life across a THREE-LAYER
// destructible world. Blast through the dirt into a barrel-filled cavern,
// then through the rock beneath into the deep: crystals, stalactites, lava.
//
// TIME MODEL: all tuning numbers are expressed at a 20-ticks/sec baseline.
// TUNING.TICK is the REAL tick rate; DT converts baseline -> real ticks.
//
// SPACE MODEL: the world is 72 wide x 260 tall. The screen is a 100-tall
// window at this.camY; screenY = worldY - camY. Panel/HUD are screen-space.
//   y 0..86     surface air
//   y 86..100   dirt slab    (36 cols x 2 wide, 2 hp)   <- rockets dig here
//   y 100..170  cavern       (barrels, mushrooms)
//   y 170..184  rock slab    (18 cols x 4 wide, 3 hp)   <- keep digging
//   y 184..252  the deep     (crystals, stalactites, mushrooms)
//   y 252..260  bedrock, with LAVA pools set into it

const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

// ---------------------------------------------------------------- tuning ----
const TUNING = {
    TICK: 60,                 // MUST match the tickRate literal in metadata()
    GRAVITY: 0.16,
    DRAG: 0.992,
    BOUNCE: 0.4,
    MAX_VEL: 6,
    WALL_L: 1,
    WALL_R: 71,

    WORLD: {
        SLABS: [
            { top: 86,  bot: 100, nCols: 36, colW: 2, hp: 2, fills: [[96, 72, 52, 255], [70, 52, 40, 255]] },
            { top: 170, bot: 184, nCols: 18, colW: 4, hp: 3, fills: [[74, 68, 88, 255], [58, 52, 70, 255], [44, 40, 54, 255]] }
        ],
        DEEP_FLOOR: 252, H: 260,
        LAVA: [{ x0: 14, x1: 30 }, { x0: 44, x1: 58 }]
    },

    BUDDY: {
        hpMax: 100, regen: 0.06,
        koBonus: 30, koBonusStep: 10,
        stunKnockdown: 12, stunDecay: 0.35,
        getupTicks: 18,
        walkSpeed: 0.18, fleeSpeed: 0.55, panicSpeed: 0.8, fleeTicks: 55,
        threatRange: 26,
        cowerHp: 30,
        freezeTicks: 55, frozenDmgMult: 1.5,
        burnTicks: 70
    },

    BARREL:  { count: 6, dmg: 24, push: 5.5, radius: 14, digRadius: 6, chainFuse: 6, shotFuse: 2, respawn: 400, bounty: 15 },
    CRYSTAL: { count: 5, bounty: 25, respawn: 600 },
    STAL:    { count: 8, dmg: 16, respawn: 700 },
    LAVA_DOT: { dmg: 3, interval: 4 },
    SHROOM:  { launch: 5.2, cooldown: 80 },

    WEAPONS: {
        hand:    { name: 'HAND',         cost: 0,    dmg: 2,   push: 2.6, radius: 11, cooldown: 1 },
        ball:    { name: 'BASEBALL',     cost: 40,   dmg: 9,   push: 3.2, radius: 6,  cooldown: 2 },
        duck:    { name: 'RUBBER DUCK',  cost: 90,   dmg: 3.5, push: 2.4, radius: 5,  cooldown: 2,  life: 110 },
        bowling: { name: 'BOWLING BALL', cost: 140,  dmg: 12,  push: 4.5, radius: 8,  cooldown: 5,  life: 150 },
        grenade: { name: 'GRENADE',      cost: 200,  dmg: 26,  push: 5.5, radius: 17, cooldown: 4,  fuse: 26 },
        anvil:   { name: 'ANVIL',        cost: 300,  dmg: 34,  push: 3.5, radius: 10, cooldown: 5 },
        freeze:  { name: 'FREEZE RAY',   cost: 450,  dmg: 6,   push: 0.5, radius: 13, cooldown: 8 },
        tesla:   { name: 'TESLA BOLT',   cost: 550,  dmg: 18,  push: 2.5, radius: 10, cooldown: 5 },
        minigun: { name: 'MINIGUN',      cost: 650,  dmg: 4,   push: 1.5, radius: 5,  cooldown: 3,  pellets: 8 },
        bees:    { name: 'BEE SWARM',    cost: 750,  dmg: 1.5, push: 1.2, radius: 4,  cooldown: 6,  count: 8, life: 160 },
        molotov: { name: 'MOLOTOV',      cost: 850,  dmg: 14,  push: 3.0, radius: 12, cooldown: 5 },
        rocket:  { name: 'HOMING ROCKET',cost: 1000, dmg: 22,  push: 5.0, radius: 13, cooldown: 6,  life: 140 },
        hole:    { name: 'BLACK HOLE',   cost: 1200, dmg: 30,  push: 6.5, radius: 20, cooldown: 20, life: 44 },
        grav:    { name: 'GRAVITY FLIP', cost: 1500, dmg: 0,   push: 0,   radius: 0,  cooldown: 30, duration: 60 }
    },

    MAX_PROJ: 48,
    MAX_FX: 120,
    MAX_RINGS: 10
};

const TERRAIN_POWER = { rocket: 2, grenade: 1, anvil: 2, hole: 2 };
const THREATS = { rocket: 1, grenade: 1, anvil: 1, bowling: 1, molotov: 1, bee: 1, stal: 1 };

// ---- time scale ------------------------------------------------------------
const BASE_TICK = 20;
const DT = BASE_TICK / TUNING.TICK;
const TK  = (t) => Math.max(1, Math.round(t / DT));
const V   = (v) => v * DT;
const ACC = (a) => a * DT * DT;
const PR  = (p) => 1 - Math.pow(1 - p, DT);
const G       = ACC(TUNING.GRAVITY);
const DRAG_DT = Math.pow(TUNING.DRAG, DT);
const FRIC_DT = Math.pow(0.86, DT);
const DAMP_X  = Math.pow(0.9, DT);
const DAMP_Y  = Math.pow(0.92, DT);
const ROLL_DT = Math.pow(0.996, DT);
const DUCK_FR = Math.pow(0.985, DT);
const CAM_LERP = 1 - Math.pow(0.94, DT * 3);
const MOVED_EPS = 0.08 * DT;

const WEAPON_ORDER = ['hand', 'ball', 'duck', 'bowling', 'grenade', 'anvil', 'freeze', 'tesla', 'minigun', 'bees', 'molotov', 'rocket', 'hole', 'grav'];
const SHOP_PAGE_SIZE = 5;

const PROJ_VIS = {
    ball:    { r: 1.2, fill: [235, 235, 225, 255] },
    pellet:  { r: 0.6, fill: [255, 225, 90, 255] },
    duck:    { r: 1.5, fill: [255, 210, 50, 255] },
    bowling: { r: 2.2, fill: [70, 72, 88, 255] },
    grenade: { r: 1.4, fill: [96, 180, 96, 255] },
    anvil:   { r: 2.2, fill: [90, 94, 106, 255] },
    molotov: { r: 1.1, fill: [255, 140, 60, 255] },
    bee:     { r: 0.7, fill: [255, 200, 30, 255] },
    rocket:  { r: 1.3, fill: [230, 90, 70, 255] },
    stal:    { r: 1.1, fill: [205, 205, 218, 255] }
};

const RING_FILL = {
    grenade: [255, 170, 60, 255],
    anvil:   [165, 165, 175, 255],
    molotov: [255, 110, 40, 255],
    freeze:  [150, 220, 250, 255],
    tesla:   [140, 220, 255, 255],
    rocket:  [255, 120, 50, 255],
    hole:    [150, 70, 230, 255],
    barrel:  [255, 150, 40, 255]
};

const LINES = {
    idle:   ['hi :)', 'nice day huh', 'la la la', 'sup', 'just vibing'],
    ow:     ['OW!', 'HEY!', 'rude.', 'why tho', 'OOF'],
    flee:   ['AAAH!', 'NOPE NOPE', 'RUN AWAY!'],
    panic:  ['RUN!!', 'WHY ME', 'HELP', 'NOT LIKE THIS'],
    cower:  ['please no', 'mercy!!', 'im just a buddy'],
    frozen: ['B-BRRR'],
    burn:   ['HOT HOT HOT'],
    lava:   ['LAVA?! WHO PUT LAVA', 'MY FEET MY FEET'],
    duck:   ['NOT THE DUCK'],
    bees:   ['BEES?!', 'WHY BEES'],
    grav:   ['WHOA', 'WRONG WAY', 'IM FLYING'],
    zap:    ['BZZT', 'TINGLY'],
    fall:   ['AAAAAAA', 'WHATS DOWN HERE'],
    deep:   ['ITS SO DEEP', 'hello? hello? hello?', 'ominous down here'],
    boing:  ['BOING', 'WHEE'],
    ko:     ['x_x']
};
const pickLine = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------- helpers ---
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const polyCircle = (cx, cy, r, sides) => {
    const n = sides || 14;
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

const thickLine = (x1, y1, x2, y2, width) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(a) * width / 2, dy = Math.cos(a) * width / 2;
    return [[x1 - dx, y1 + dy], [x2 - dx, y2 + dy], [x2 + dx, y2 - dy], [x1 + dx, y1 - dy], [x1 - dx, y1 + dy]];
};

// ------------------------------------------------------------------ game ----
class BuddyBox extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            maxPlayers: 1,
            name: 'Buddy Box',
            author: "Joseph Garcia",
            description: 'A panicking ragdoll buddy in a three-layer destructible world: dirt, cavern, rock, and the lava-lit deep.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 60,
            gameId: "ff0165bc-efa5-5323-a223-8e933ae96a2f"
        };
    }

    constructor() {
        super();
        const W = TUNING.WORLD;
        this._t = 0;
        this.money = 0;
        this.hp = TUNING.BUDDY.hpMax;
        this.lastHpShown = -1;
        this.hurt = 0;
        this._hurtPrev = 0;
        this.owned = { hand: true };
        this.selected = 'hand';
        this.fireReady = 0;
        this.koLife = 0;
        this.koCount = 0;
        this.uiDirty = true;
        this.shopDirty = true;
        this.bubbleLife = 0;
        this.bubbleStr = ' ';
        this.hintLife = 0;
        this.rocketHintShown = false;

        this.camY = 0;
        this.depthLevel = 0;         // 0 surface, 1 cavern, 2 deep
        this._worldDirty = true;
        this._lavaTouch = false;

        this.gravT = 0;
        this.boltLife = 0;
        this.boltX = 0; this.boltTX = 0; this.boltTY = 0;

        this.ai = {
            state: 'ragdoll',
            stun: 16,
            timer: 0,
            x: 36, dir: 1, speed: 0, phase: 0,
            fleeT: 0,
            freezeT: 0, frozenPose: null,
            burnT: 0,
            bubbleCd: TK(40)
        };

        this.hole = { active: false, x: 0, y: 0, life: 0 };

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [24, 26, 34, 255]
        });

        const mk = (fill) => new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill
        });

        // ---- world scenery ---------------------------------------------
        this.cavernBg = mk([14, 13, 24, 255]);
        this.deepBg   = mk([11, 8, 18, 255]);
        this.deepFloorNode = mk([34, 30, 44, 255]);
        this.lavaNodes = W.LAVA.map(() => mk([255, 120, 40, 255]));

        // destructible slabs: parallel arrays of column hp + nodes
        this.slabs = W.SLABS.map((def) => ({
            def,
            cols: Array.from({ length: def.nCols }, () => def.hp),
            nodes: Array.from({ length: def.nCols }, () => mk(def.fills[0]))
        }));

        this.shrooms = [];
        for (const sx of [12, 36, 58]) this.shrooms.push({ x: sx, fy: W.SLABS[1].top, cd: 0, stem: mk([220, 214, 200, 255]), cap: mk([235, 90, 140, 255]) });
        for (const sx of [37, 64])     this.shrooms.push({ x: sx, fy: W.DEEP_FLOOR,   cd: 0, stem: mk([220, 214, 200, 255]), cap: mk([235, 90, 140, 255]) });

        this.barrels = [];
        for (let i = 0; i < TUNING.BARREL.count; i++) {
            this.barrels.push({
                alive: true, fuse: 0, respawn: 0, vy: 0,
                x: 6 + i * 11.5, y: W.SLABS[1].top - 1.6,
                node: mk([200, 70, 50, 255])
            });
        }

        this.crystals = [];
        for (const cx of [6, 34, 40, 62, 68]) {
            this.crystals.push({ alive: true, x: cx, respawn: 0, node: mk([120, 230, 220, 255]) });
        }

        this.stals = [];
        for (let i = 0; i < TUNING.STAL.count; i++) {
            this.stals.push({ alive: true, x: 5 + i * 9 + Math.random() * 3, respawn: 0, node: mk([205, 205, 218, 255]) });
        }

        // ---- buddy -----------------------------------------------------
        const P = (x, y, r) => ({ x, y, px: x, py: y, r });
        this.pts = {
            head:  P(36, 62, 3.4),
            chest: P(36, 68, 1.6),
            hip:   P(36, 74, 1.8),
            handL: P(31, 70, 1.2),
            handR: P(41, 70, 1.2),
            footL: P(33, 82, 1.4),
            footR: P(39, 82, 1.4)
        };
        const C = (a, b, k) => ({
            a, b, k: k || 1,
            len: Math.hypot(this.pts[a].x - this.pts[b].x, this.pts[a].y - this.pts[b].y)
        });
        this.cons = [
            C('head', 'chest'), C('chest', 'hip'),
            C('chest', 'handL'), C('chest', 'handR'),
            C('hip', 'footL'), C('hip', 'footR'),
            C('head', 'hip', 0.35)
        ];

        this.armLNode  = mk([168, 172, 184, 255]);
        this.armRNode  = mk([168, 172, 184, 255]);
        this.legLNode  = mk([168, 172, 184, 255]);
        this.legRNode  = mk([168, 172, 184, 255]);
        this.torsoNode = mk([150, 156, 172, 255]);
        this.headNode  = mk([198, 202, 212, 255]);
        this.eyeLNode  = mk([40, 42, 52, 255]);
        this.eyeRNode  = mk([40, 42, 52, 255]);
        this.mouthNode = mk([40, 42, 52, 255]);

        this.holeRing = mk([0, 0, 0, 0]);
        this.holeCore = mk([0, 0, 0, 0]);
        this.boltNode = mk([0, 0, 0, 0]);

        // ---- pools -----------------------------------------------------
        this.rings = [];
        for (let i = 0; i < TUNING.MAX_RINGS; i++) {
            this.rings.push({ active: false, x: 0, y: 0, life: 0, max: 1, targetR: 0, fill: [255, 170, 60, 255], node: mk([0, 0, 0, 0]) });
        }
        this.fx = [];
        for (let i = 0; i < TUNING.MAX_FX; i++) {
            this.fx.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, fill: [255, 255, 255, 255], node: mk([0, 0, 0, 0]) });
        }
        this.projs = [];
        for (let i = 0; i < TUNING.MAX_PROJ; i++) {
            this.projs.push({ active: false, type: 'ball', x: 0, y: 0, vx: 0, vy: 0, fuse: 0, delay: 0, life: 0, hitCd: 0, node: mk([0, 0, 0, 0]) });
        }

        // ---- HUD (screen-space) ----------------------------------------
        this.hpBack = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(3, 3, 34, 2.4),
            fill: [34, 36, 44, 255]
        });
        this.hpFill = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(3, 3, 34, 2.4),
            fill: [80, 220, 100, 255]
        });
        this.instrText = new GameNode.Text({
            textInfo: { text: 'TAP THE ROOM - DAMAGE EARNS $', x: 36, y: 96.5, size: 1.3, align: 'center', color: [140, 145, 160, 255] }
        });
        this.koText = new GameNode.Text({
            textInfo: { text: ' ', x: 36, y: 26, size: 3, align: 'center', color: COLORS.SHARP_YELLOW }
        });
        this.hintText = new GameNode.Text({
            textInfo: { text: ' ', x: 36, y: 32, size: 1.7, align: 'center', color: COLORS.CANDY_RED }
        });
        this.bubbleNode = new GameNode.Text({
            textInfo: { text: ' ', x: 36, y: 50, size: 1.6, align: 'center', color: COLORS.WHITE }
        });

        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 72, 100),
            onClick: (playerId, x, y) => this.handleTap(playerId, x, y)
        });

        this.panel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(72, 0, 28, 100),
            fill: [16, 17, 22, 255]
        });
        this.moneyText = new GameNode.Text({
            textInfo: { text: '$0', x: 86, y: 2, size: 2.2, align: 'center', color: COLORS.HG_YELLOW }
        });
        this.weaponText = new GameNode.Text({
            textInfo: { text: 'USING: HAND', x: 86, y: 7.8, size: 1.2, align: 'center', color: [160, 220, 180, 255] }
        });

        this.shopBtns = {};
        this.shopPage = 0;
        const btnRows = [];
        WEAPON_ORDER.forEach((key, i) => {
            const w = TUNING.WEAPONS[key];
            const y = 14 + (i % SHOP_PAGE_SIZE) * 14;
            const bg = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(74.5, y, 23, 12),
                fill: [42, 44, 54, 255],
                onClick: (playerId) => {
                    if (Math.floor(i / SHOP_PAGE_SIZE) === this.shopPage) this.shopClick(key);
                }
            });
            const label = new GameNode.Text({
                textInfo: { text: w.name, x: 86, y: y + 2, size: 1.65, align: 'center', color: COLORS.WHITE }
            });
            const price = new GameNode.Text({
                textInfo: { text: '$' + w.cost, x: 86, y: y + 7, size: 1.6, align: 'center', color: [200, 205, 220, 255] }
            });
            bg.addChildren(label, price);
            this.shopBtns[key] = { bg, price, y };
            btnRows.push(bg);
        });

        // ---- assemble (draw order) -------------------------------------
        this.base.addChildren(this.cavernBg, this.deepBg, this.deepFloorNode);
        for (const ln of this.lavaNodes) this.base.addChild(ln);
        for (const s of this.slabs) for (const n of s.nodes) this.base.addChild(n);
        for (const s of this.shrooms) { this.base.addChild(s.stem); this.base.addChild(s.cap); }
        for (const c of this.crystals) this.base.addChild(c.node);
        for (const s of this.stals) this.base.addChild(s.node);
        for (const b of this.barrels) this.base.addChild(b.node);
        this.base.addChildren(this.holeRing, this.holeCore, this.boltNode);
        this.base.addChildren(this.armLNode, this.armRNode, this.legLNode, this.legRNode, this.torsoNode, this.headNode, this.eyeLNode, this.eyeRNode, this.mouthNode);
        for (const r of this.rings) this.base.addChild(r.node);
        for (const f of this.fx) this.base.addChild(f.node);
        for (const p of this.projs) this.base.addChild(p.node);
        this.base.addChildren(this.hpBack, this.hpFill, this.instrText, this.koText, this.hintText, this.bubbleNode);
        this.base.addChildren(this.tapCatcher);
        this.base.addChildren(this.panel, this.moneyText, this.weaponText);
        for (const b of btnRows) this.base.addChild(b);
        this.shopPageText = new GameNode.Text({ textInfo: { text: '', x: 86, y: 90, size: 1.7, align: 'center', color: COLORS.WHITE } });
        this.base.addChild(this.shopPageText);
        this.shopNav = [-1, 1].map(direction => {
            const x = direction < 0 ? 74 : 91;
            const button = new GameNode.Shape({ shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, 87, 8, 10), fill: [60, 62, 76, 255],
                onClick: () => this.changeShopPage(direction) });
            button.addChild(new GameNode.Text({ textInfo: { text: direction < 0 ? '‹' : '›', x: x + 4, y: 89, size: 3, align: 'center', color: COLORS.WHITE } }));
            this.base.addChild(button); return button;
        });
        this.refreshShop();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    // -------------------------------------------------------- terrain ------
    solidAtS(si, x) {
        const s = this.slabs[si];
        const i = clamp(Math.floor(x / s.def.colW), 0, s.def.nCols - 1);
        return s.cols[i] > 0;
    }

    // does (x, yNew) hit any solid slab? -> { si, face, top, bot } | null
    slabHitAny(x, yNew, yPrev, r) {
        for (let si = 0; si < this.slabs.length; si++) {
            const d = this.slabs[si].def;
            if (!this.solidAtS(si, x)) continue;
            if (yNew > d.top - r && yNew < d.bot + r) {
                return { si, face: yPrev <= (d.top + d.bot) / 2 ? 'top' : 'bottom', top: d.top, bot: d.bot };
            }
        }
        return null;
    }

    inLava(x) {
        return TUNING.WORLD.LAVA.some(L => x >= L.x0 && x <= L.x1);
    }

    damageGround(si, x, radius, power) {
        if (!power) return;
        const s = this.slabs[si], d = s.def;
        for (let i = 0; i < d.nCols; i++) {
            const cx = i * d.colW + d.colW / 2;
            if (Math.abs(cx - x) > radius) continue;
            if (s.cols[i] <= 0) continue;
            s.cols[i] -= power;
            if (s.cols[i] <= 0) {
                s.cols[i] = 0;
                this.emitBurst(cx, d.top + 5, d.fills[0], 5);
                // a broken rock column shakes loose any stalactite hanging from it
                if (si === 1) this.dropStalsNear(cx, d.colW);
            }
            this._worldDirty = true;
        }
    }

    // blast at (x, y): chew whichever slab bands it reaches
    blastGround(x, y, radius, power) {
        for (let si = 0; si < this.slabs.length; si++) {
            const d = this.slabs[si].def;
            const mid = (d.top + d.bot) / 2;
            if (Math.abs(y - mid) < radius + 8) this.damageGround(si, x, radius * 0.55, power);
        }
    }

    dropStalsNear(x, range) {
        for (const s of this.stals) {
            if (!s.alive || Math.abs(s.x - x) > range) continue;
            s.alive = false;
            s.respawn = TK(TUNING.STAL.respawn);
            this.spawnProj('stal', s.x, TUNING.WORLD.SLABS[1].bot + 2.5, 0, V(0.2), 0);
            this._worldDirty = true;
        }
    }

    barrelAt(x, y, r) {
        for (const b of this.barrels) {
            if (!b.alive) continue;
            if (Math.hypot(b.x - x, b.y - y) <= r + 2) return b;
        }
        return null;
    }

    crystalAt(x, y, r) {
        for (const c of this.crystals) {
            if (!c.alive) continue;
            if (Math.hypot(c.x - x, (TUNING.WORLD.DEEP_FLOOR - 2) - y) <= r + 2.2) return c;
        }
        return null;
    }

    shatterCrystal(c) {
        c.alive = false;
        c.respawn = TK(TUNING.CRYSTAL.respawn);
        this.emitBurst(c.x, TUNING.WORLD.DEEP_FLOOR - 2.5, [140, 240, 230, 255], 12);
        this.addMoney(TUNING.CRYSTAL.bounty);
        this._worldDirty = true;
    }

    // ------------------------------------------------------------ input ----
    handleTap(playerId, x, y) {
        if (this._t < this.fireReady) return;
        const key = this.selected;
        const w = TUNING.WEAPONS[key];
        if (key === 'hole' && this.hole.active) return;
        this.fireReady = this._t + TK(w.cooldown);
        const wy = y + this.camY;
        const cy = this.camY;
        const W = TUNING.WORLD;

        if (key === 'hand') {
            this.slap(x, wy);
        } else if (key === 'ball') {
            const T = TK(12), x0 = 2, y0 = cy + 5;
            this.spawnProj('ball', x0, y0, (x - x0) / T, (wy - y0) / T - G * (T + 1) / 2, 0);
        } else if (key === 'duck') {
            const T = TK(14), x0 = 2, y0 = cy + 5;
            const p = this.spawnProj('duck', x0, y0, (x - x0) / T, (wy - y0) / T - G * (T + 1) / 2, 0);
            if (p) p.life = TK(w.life);
        } else if (key === 'bowling') {
            const fromLeft = x >= 36;
            let floorY = W.DEEP_FLOOR;
            for (const s of this.slabs) { if (wy < s.def.top + 12) { floorY = s.def.top; break; } }
            const p = this.spawnProj('bowling', fromLeft ? 2 : 70, floorY - 2.2, fromLeft ? V(2.6) : -V(2.6), 0, 0);
            if (p) p.life = TK(w.life);
        } else if (key === 'grenade') {
            const T = TK(20), x0 = 3, y0 = cy + 80;
            this.spawnProj('grenade', x0, y0, (x - x0) / T, (wy - y0) / T - G * (T + 1) / 2, 0);
        } else if (key === 'anvil') {
            this.spawnProj('anvil', clamp(x, 5, 67), cy + 2, 0, V(0.5), 0);
        } else if (key === 'freeze') {
            this.fireFreeze(x, wy);
        } else if (key === 'tesla') {
            this.fireTesla(x, wy);
        } else if (key === 'minigun') {
            for (let i = 0; i < w.pellets; i++) {
                const sx = clamp(x + (Math.random() - 0.5) * 4, 2, 70);
                this.spawnProj('pellet', sx, cy + 1, V((Math.random() - 0.5) * 0.3), V(5.2), i * TK(2));
            }
        } else if (key === 'bees') {
            for (let i = 0; i < w.count; i++) {
                const p = this.spawnProj('bee', 1, cy + 10 + Math.random() * 30, V(1), V(Math.random() - 0.5), i * TK(1.5));
                if (p) p.life = TK(w.life);
            }
            if (Math.random() < 0.6) this.setBubble(pickLine(LINES.bees), 24);
        } else if (key === 'molotov') {
            const T = TK(18), x0 = 3, y0 = cy + 78;
            this.spawnProj('molotov', x0, y0, (x - x0) / T, (wy - y0) / T - G * (T + 1) / 2, 0);
        } else if (key === 'rocket') {
            const p = this.spawnProj('rocket', 1, cy + 20, V(1.9), 0, 0);
            if (p) p.life = TK(w.life);
        } else if (key === 'hole') {
            this.hole.active = true;
            this.hole.x = clamp(x, 8, 64);
            this.hole.y = clamp(wy, 10, W.DEEP_FLOOR - 8);
            this.hole.life = TK(w.life);
        } else if (key === 'grav') {
            this.gravT = TK(w.duration);
            this.base.node.fill = [40, 28, 58, 255];
            for (const k in this.pts) this.pts[k].py += V(1.5);
            this.setBubble(pickLine(LINES.grav), 30);
        }
    }

    shopClick(key) {
        const w = TUNING.WEAPONS[key];
        if (this.owned[key]) {
            this.selected = key;
        } else if (this.money >= w.cost) {
            this.money -= w.cost;
            this.owned[key] = true;
            this.selected = key;
            if (key === 'rocket' && !this.rocketHintShown) {
                this.rocketHintShown = true;
                this.hintLife = TK(90);
                this.hintText.node.text = { text: 'TIP: ROCKETS BLOW UP THE GROUND', x: 36, y: 32, size: 1.7, align: 'center', color: COLORS.CANDY_RED };
            }
        } else {
            return;
        }
        this.refreshHud();
        this.refreshShop();
        this.base.node.onStateChange();
    }

    // ---------------------------------------------------------- weapons ----
    slap(x, y) {
        const w = TUNING.WEAPONS.hand;
        let total = 0;
        for (const k in this.pts) {
            const p = this.pts[k];
            const d = Math.hypot(p.x - x, p.y - y);
            if (d > w.radius) continue;
            const fall = 1 - d / w.radius;
            const ang = Math.atan2(p.y - y, p.x - x);
            p.px -= Math.cos(ang) * V(w.push) * fall;
            p.py -= (Math.sin(ang) * V(w.push) * fall - V(0.6) * fall);
            total += w.dmg * fall;
        }
        this.emitBurst(x, y, [230, 235, 245, 255], 5);
        this.damageBuddy(total, x);
    }

    fireFreeze(x, y) {
        const w = TUNING.WEAPONS.freeze;
        this.spawnRing(x, y, w.radius, RING_FILL.freeze);
        this.emitBurst(x, y, [180, 230, 250, 255], 10);
        const c = this.pts.chest;
        if (Math.hypot(c.x - x, c.y - y) <= w.radius) {
            this.damageBuddy(w.dmg, null, { dot: true });
            this.freezeBuddy();
        }
    }

    fireTesla(x, wy) {
        const w = TUNING.WEAPONS.tesla;
        const c = this.pts.chest;
        const hitBuddy = Math.abs(c.x - x) <= w.radius;
        this.boltX = x;
        this.boltTX = hitBuddy ? c.x : x;
        this.boltTY = hitBuddy ? c.y : wy;
        this.boltLife = TK(6);
        this.boltNode.node.effects = { shadow: { color: [120, 200, 255, 255], blur: 16 } };
        this.emitBurst(this.boltTX, this.boltTY, [180, 230, 255, 255], 10);
        this.spawnRing(this.boltTX, this.boltTY, 6, RING_FILL.tesla);
        const b = this.barrelAt(this.boltTX, this.boltTY, 4);
        if (b && b.fuse <= 0) b.fuse = TK(TUNING.BARREL.shotFuse);
        const cr = this.crystalAt(this.boltTX, this.boltTY, 4);
        if (cr) this.shatterCrystal(cr);
        if (hitBuddy) {
            for (const k in this.pts) {
                const p = this.pts[k];
                p.py += V(w.push) * (0.6 + Math.random() * 0.8);
                p.px += (Math.random() - 0.5) * V(1.5);
            }
            this.damageBuddy(w.dmg, null);
            this.ai.stun += 6;
            if (Math.random() < 0.35 && this.ai.freezeT <= 0) this.ignite();
            else if (Math.random() < 0.5) this.setBubble(pickLine(LINES.zap), 20);
        }
    }

    freezeBuddy() {
        const A = this.ai;
        A.burnT = 0;
        A.freezeT = TK(TUNING.BUDDY.freezeTicks);
        A.frozenPose = {};
        for (const k in this.pts) A.frozenPose[k] = { x: this.pts[k].x, y: this.pts[k].y };
        this.setBubble(pickLine(LINES.frozen), 30);
    }

    thaw(shatter) {
        const A = this.ai;
        A.freezeT = 0;
        A.frozenPose = null;
        A.state = 'ragdoll';
        A.stun = shatter ? 16 : 6;
        if (shatter) this.emitBurst(this.pts.chest.x, this.pts.chest.y, [180, 230, 250, 255], 12);
    }

    ignite() {
        const A = this.ai;
        if (A.freezeT > 0) this.thaw(false);
        A.burnT = TK(TUNING.BUDDY.burnTicks);
        this.setBubble(pickLine(LINES.burn), 26);
    }

    spawnProj(type, x, y, vx, vy, delay) {
        for (const p of this.projs) {
            if (p.active) continue;
            p.active = true;
            p.type = type;
            p.x = x; p.y = y; p.vx = vx; p.vy = vy;
            p.delay = delay || 0;
            p.life = 0;
            p.hitCd = 0;
            p.fuse = type === 'grenade' ? TK(TUNING.WEAPONS.grenade.fuse) : 0;
            return p;
        }
        return null;
    }

    hideProj(p) {
        p.active = false;
        p.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        p.node.node.fill = [0, 0, 0, 0];
    }

    spawnRing(x, y, targetR, fill) {
        for (const r of this.rings) {
            if (r.active) continue;
            r.active = true;
            r.x = x; r.y = y;
            r.life = TK(10); r.max = TK(10);
            r.targetR = targetR;
            r.fill = fill;
            return;
        }
    }

    radialBlast(x, y, dmg, push, radius) {
        let total = 0;
        for (const k in this.pts) {
            const p = this.pts[k];
            const d = Math.hypot(p.x - x, p.y - y);
            if (d > radius) continue;
            const fall = 1 - d / (radius + 0.001);
            const ang = Math.atan2(p.y - y, p.x - x);
            p.px -= Math.cos(ang) * V(push) * fall;
            p.py -= (Math.sin(ang) * V(push) * fall - V(1.2) * fall);
            total += dmg * fall;
        }
        return total;
    }

    // side effects shared by every explosion: dirt, barrels, crystals, stals
    blastWorld(x, y, radius, terrainPower) {
        this.blastGround(x, y, radius, terrainPower || 0);
        for (const b of this.barrels) {
            if (b.alive && b.fuse <= 0 && Math.hypot(b.x - x, b.y - y) <= radius + 2) {
                b.fuse = TK(TUNING.BARREL.chainFuse);
            }
        }
        for (const c of this.crystals) {
            if (c.alive && Math.hypot(c.x - x, (TUNING.WORLD.DEEP_FLOOR - 2) - y) <= radius + 2) {
                this.shatterCrystal(c);
            }
        }
        // shake stalactites loose if the blast is near the rock underside
        const underside = TUNING.WORLD.SLABS[1].bot;
        if (Math.abs(y - underside) < radius + 6) this.dropStalsNear(x, radius);
    }

    explode(x, y, wkey) {
        const w = TUNING.WEAPONS[wkey];
        this.damageBuddy(this.radialBlast(x, y, w.dmg, w.push, w.radius), x);
        this.emitBurst(x, y, RING_FILL[wkey] || [255, 180, 70, 255], 18);
        this.spawnRing(x, y, w.radius, RING_FILL[wkey] || [255, 170, 60, 255]);
        this.blastWorld(x, y, w.radius, TERRAIN_POWER[wkey]);
        if (wkey === 'molotov') {
            const c = this.pts.chest;
            if (Math.hypot(c.x - x, c.y - y) <= w.radius + 3) this.ignite();
        }
    }

    barrelBoom(b) {
        const B = TUNING.BARREL;
        b.alive = false;
        b.fuse = 0;
        b.respawn = TK(B.respawn);
        this.damageBuddy(this.radialBlast(b.x, b.y, B.dmg, B.push, B.radius), b.x);
        this.emitBurst(b.x, b.y, RING_FILL.barrel, 18);
        this.spawnRing(b.x, b.y, B.radius, RING_FILL.barrel);
        this.addMoney(B.bounty);
        this._worldDirty = true;
        this.blastWorld(b.x, b.y, B.digRadius + 6, 2);   // barrels are excellent shovels
        for (const other of this.barrels) {
            if (other !== b && other.alive && other.fuse <= 0 && Math.hypot(other.x - b.x, other.y - b.y) <= B.radius) {
                other.fuse = TK(B.chainFuse);
            }
        }
    }

    pointHit(x, y, r) {
        for (const k in this.pts) {
            const q = this.pts[k];
            if (Math.hypot(q.x - x, q.y - y) <= q.r + r) return q;
        }
        return null;
    }

    nearestPoint(x, y) {
        let best = this.pts.chest, bd = Infinity;
        for (const k in this.pts) {
            const q = this.pts[k];
            const d = Math.hypot(q.x - x, q.y - y);
            if (d < bd) { bd = d; best = q; }
        }
        return best;
    }

    // ------------------------------------------------------------ buddy ----
    buddyFloorY() {
        const hip = this.pts.hip.y, W = TUNING.WORLD;
        if (hip < W.SLABS[0].top + 9) return W.SLABS[0].top;
        if (hip < W.SLABS[1].top + 9) return W.SLABS[1].top;
        return W.DEEP_FLOOR;
    }

    // is there something to stand on at x, for the given floor reference?
    footingAt(F, x) {
        const W = TUNING.WORLD;
        const cx = clamp(x, 1, 71);
        if (F === W.SLABS[0].top) return this.solidAtS(0, cx);
        if (F === W.SLABS[1].top) return this.solidAtS(1, cx);
        return !this.inLava(cx);          // you cannot stand on lava. he tries.
    }

    damageBuddy(d, impactX, opts) {
        opts = opts || {};
        if (d < 0.4) return;
        const A = this.ai;
        let dmg = d;
        if (A.freezeT > 0) {
            dmg *= TUNING.BUDDY.frozenDmgMult;
            if (d > 8) this.thaw(true);
        }
        this.hp -= dmg;
        this.hurt = TK(12);
        this.uiDirty = true;
        this.addMoney(dmg);
        if (!opts.dot && A.freezeT <= 0) {
            A.stun += d * 1.1;
            if (A.stun > TUNING.BUDDY.stunKnockdown) {
                A.state = 'ragdoll';
            } else if (impactX !== null && impactX !== undefined && A.state !== 'ragdoll') {
                A.state = 'flee';
                A.fleeT = TK(TUNING.BUDDY.fleeTicks);
                A.dir = this.pts.hip.x >= impactX ? 1 : -1;
                A.speed = TUNING.BUDDY.fleeSpeed;
                if (Math.random() < 0.4) this.setBubble(pickLine(LINES.flee), 22);
            }
            if (A.state !== 'flee' && Math.random() < 0.35) this.setBubble(pickLine(LINES.ow), 20);
        }
        if (this.hp <= 0) this.knockOut();
    }

    addMoney(n) {
        this.money += Math.max(1, Math.round(n));
        this.uiDirty = true;
        this.shopDirty = true;
    }

    knockOut() {
        this.koCount++;
        const bonus = TUNING.BUDDY.koBonus + (this.koCount - 1) * TUNING.BUDDY.koBonusStep;
        this.money += bonus;
        this.hp = TUNING.BUDDY.hpMax;
        this.koLife = TK(34);
        this.koText.node.text = {
            text: 'KO! +$' + bonus, x: 36, y: 26, size: 3, align: 'center', color: COLORS.SHARP_YELLOW
        };
        this.setBubble(pickLine(LINES.ko), 40);
        const A = this.ai;
        A.state = 'ragdoll';
        A.stun = 45;
        A.freezeT = 0; A.frozenPose = null; A.burnT = 0;
        for (const k in this.pts) {
            const p = this.pts[k];
            p.py += V(2.2 + Math.random());
            p.px += (Math.random() - 0.5) * V(2);
        }
        this.emitBurst(this.pts.chest.x, this.pts.chest.y, [255, 220, 90, 255], 16);
        this.uiDirty = true;
        this.shopDirty = true;
    }

    setBubble(text, life) {
        this.bubbleStr = text;
        this.bubbleLife = TK(life || 26);
    }

    // ---- the brain -----------------------------------------------------
    updateAI() {
        const A = this.ai, B = TUNING.BUDDY;

        if (A.freezeT > 0) {
            A.freezeT--;
            if (A.freezeT <= 0) this.thaw(false);
            return;
        }

        if (A.burnT > 0) {
            A.burnT--;
            if (A.burnT % TK(5) === 0) this.damageBuddy(1.6, null, { dot: true });
            if (A.burnT % TK(2) === 0) {
                const keys = Object.keys(this.pts);
                const p = this.pts[keys[Math.floor(Math.random() * keys.length)]];
                this.emitBurst(p.x, p.y - 1, [255, clampByte(120 + Math.random() * 90), 40, 255], 1);
            }
            if (A.state === 'wander') {
                A.state = 'flee';
                A.fleeT = TK(20);
                A.dir = Math.random() < 0.5 ? -1 : 1;
                A.speed = B.fleeSpeed;
            }
        }

        if (this.gravT > 0) {
            A.state = 'ragdoll';
            A.stun = Math.max(A.stun, 8);
            return;
        }

        // THREAT SCAN
        if (this._t % TK(3) === 0 && A.state !== 'ragdoll') {
            const c = this.pts.chest;
            let threatX = null, best = B.threatRange;
            for (const p of this.projs) {
                if (!p.active || p.delay > 0 || !THREATS[p.type]) continue;
                const d = Math.hypot(p.x - c.x, p.y - c.y);
                if (d < best) { best = d; threatX = p.x; }
            }
            if (this.hole.active) {
                const d = Math.hypot(this.hole.x - c.x, this.hole.y - c.y);
                if (d < B.threatRange + 6) { best = d; threatX = this.hole.x; }
            }
            for (const b of this.barrels) {
                if (!b.alive || b.fuse <= 0) continue;
                const d = Math.hypot(b.x - c.x, b.y - c.y);
                if (d < best) { best = d; threatX = b.x; }
            }
            if (threatX !== null) {
                A.state = 'flee';
                A.fleeT = Math.max(A.fleeT, TK(16));
                A.dir = c.x >= threatX ? 1 : -1;
                A.speed = B.panicSpeed;
                if (Math.random() < PR(0.1)) {
                    this.pts.hip.py += V(1.0);
                    this.pts.footL.py += V(0.8);
                    this.pts.footR.py += V(0.8);
                }
                if (A.bubbleCd <= 0 && Math.random() < PR(0.06)) {
                    this.setBubble(pickLine(LINES.panic), 20);
                    A.bubbleCd = TK(40);
                }
            }
        }

        A.stun = Math.max(0, A.stun - B.stunDecay * DT);

        if (A.state === 'ragdoll') {
            if (A.stun <= 3) {
                A.state = 'getup';
                A.timer = TK(B.getupTicks);
                A.x = clamp(this.pts.hip.x, 6, 66);
            }
            return;
        }

        if (A.state === 'getup') {
            this.applyMuscles(0.55);
            A.timer--;
            if (A.timer <= 0) {
                A.state = 'wander';
                A.speed = B.walkSpeed;
                if (Math.random() < 0.5) A.dir *= -1;
            }
            return;
        }

        if (A.state === 'flee') {
            A.fleeT--;
            if (A.fleeT <= 0) {
                A.state = 'wander';
                A.speed = B.walkSpeed;
            }
            this.walkAndMuscle();
            return;
        }

        // wander
        if (this.hp < B.cowerHp) {
            A.speed = 0;
            if (A.bubbleCd <= 0 && Math.random() < PR(0.02)) {
                this.setBubble(pickLine(LINES.cower), 26);
                A.bubbleCd = TK(70);
            }
        } else {
            // calm buddies avoid pits AND lava (panicking ones can still be thrown in)
            const F = this.buddyFloorY();
            if (!this.footingAt(F, A.x + A.dir * 6)) A.dir *= -1;
            if (Math.random() < PR(0.008)) A.dir *= -1;
            if (Math.random() < PR(0.006)) A.speed = A.speed > 0 ? 0 : B.walkSpeed;
            if (A.bubbleCd <= 0 && Math.random() < PR(0.004)) {
                this.setBubble(pickLine(LINES.idle), 26);
                A.bubbleCd = TK(90);
            }
        }
        if (A.bubbleCd > 0) A.bubbleCd--;
        this.walkAndMuscle();
    }

    walkAndMuscle() {
        const A = this.ai;
        // even in a blind panic he won't deliberately sprint INTO lava
        // (being knocked, launched, or dropped into it is another story)
        if (this.buddyFloorY() === TUNING.WORLD.DEEP_FLOOR && !this.inLava(this.pts.hip.x)) {
            if (this.inLava(clamp(A.x + A.dir * 3, 1, 71))) A.dir *= -1;
        }
        A.x += A.dir * V(A.speed);
        if (A.x < 6) { A.x = 6; A.dir = 1; }
        if (A.x > 66) { A.x = 66; A.dir = -1; }
        A.phase += (A.speed > 0.3 ? 0.45 : 0.22) * DT;
        this.applyMuscles(1);
    }

    applyMuscles(strength) {
        const A = this.ai, pts = this.pts;
        const F = this.buddyFloorY();
        const crouch = this.hp < TUNING.BUDDY.cowerHp && A.state !== 'flee';
        const hipY = crouch ? F - 5.5 : F - 8.5;
        const step = A.speed > 0.05 ? Math.sin(A.phase) * 1.9 : 0;
        const lean = A.dir * Math.min(1.2, A.speed * 2);
        const tremble = crouch ? (Math.random() - 0.5) * 0.6 : 0;
        const M = (p, tx, ty, kx, ky) => {
            p.px -= (tx - p.x) * kx;
            p.py -= (ty - p.y) * ky;
        };
        const dt2 = DT * DT;
        const k = 0.055 * strength * dt2;
        const kf = 0.16 * strength * dt2;
        const lx = A.x - 2.2 + step, rx = A.x + 2.2 - step;
        const supL = this.footingAt(F, lx);
        const supR = this.footingAt(F, rx);
        const anySup = supL || supR;
        M(pts.footL, lx, F - 1.4, kf, supL ? kf : 0);
        M(pts.footR, rx, F - 1.4, kf, supR ? kf : 0);
        M(pts.hip,   A.x + tremble, hipY, k * 1.6, anySup ? k * 1.6 : 0);
        M(pts.chest, A.x + lean + tremble, hipY - 6, k * 1.3, anySup ? k * 1.3 : 0);
        M(pts.head,  A.x + lean * 1.6, crouch ? hipY - 9 : hipY - 11.5, k * 1.2, anySup ? k * 1.2 : 0);
        const flail = A.state === 'flee' ? Math.abs(Math.sin(A.phase * 2)) * 6 : 0;
        M(pts.handL, A.x - 4, hipY - 2 - flail, 0.05 * dt2, 0.05 * dt2);
        M(pts.handR, A.x + 4, hipY - 2 - flail, 0.05 * dt2, 0.05 * dt2);
        for (const key of ['head', 'chest', 'hip']) {
            const p = pts[key];
            p.px = p.x - (p.x - p.px) * DAMP_X;
            p.py = p.y - (p.y - p.py) * DAMP_Y;
        }
    }

    stepPhysics() {
        let moved = 0;
        const W = TUNING.WORLD;
        const MV = V(TUNING.MAX_VEL);
        const gSign = this.gravT > 0 ? -1 : 1;
        const settle = (p, ty) => {
            const vy = p.y - p.py, vx = p.x - p.px;
            p.y = ty;
            p.py = ty + vy * TUNING.BOUNCE;
            p.px = p.x - vx * FRIC_DT;
        };
        for (const k in this.pts) {
            const p = this.pts[k];
            let vx = (p.x - p.px) * DRAG_DT;
            let vy = (p.y - p.py) * DRAG_DT + G * gSign;
            vx = clamp(vx, -MV, MV);
            vy = clamp(vy, -MV, MV);
            p.px = p.x; p.py = p.y;
            p.x += vx; p.y += vy;
            moved += Math.abs(vx) + Math.abs(vy);
        }
        this._lavaTouch = false;
        for (let iter = 0; iter < 4; iter++) {
            for (const c of this.cons) {
                const a = this.pts[c.a], b = this.pts[c.b];
                const dx = b.x - a.x, dy = b.y - a.y;
                const d = Math.hypot(dx, dy) || 0.001;
                const diff = ((d - c.len) / d) * 0.5 * c.k;
                a.x += dx * diff; a.y += dy * diff;
                b.x -= dx * diff; b.y -= dy * diff;
            }
            for (const k in this.pts) {
                const p = this.pts[k];
                if (p.y > W.DEEP_FLOOR - p.r) {
                    settle(p, W.DEEP_FLOOR - p.r);
                    if (this.inLava(p.x)) this._lavaTouch = true;
                }
                for (const s of this.slabs) {
                    const d = s.def;
                    if (!this.solidAtS(this.slabs.indexOf(s), p.x)) continue;
                    if (p.y > d.top - p.r && p.y < d.bot + p.r) {
                        if (p.py <= (d.top + d.bot) / 2) settle(p, d.top - p.r);
                        else settle(p, d.bot + p.r);
                    }
                }
                if (p.y < p.r) settle(p, p.r);
                if (p.x < TUNING.WALL_L + p.r) p.x = TUNING.WALL_L + p.r;
                if (p.x > TUNING.WALL_R - p.r) p.x = TUNING.WALL_R - p.r;
            }
        }
        if (this.ai.freezeT > 0 && this.ai.frozenPose) {
            for (const k in this.pts) {
                const p = this.pts[k], q = this.ai.frozenPose[k];
                p.x = q.x; p.y = q.y; p.px = q.x; p.py = q.y;
            }
            moved = 0;
        }
        return moved;
    }

    // lava contact damage (evaluated once per interval, set during physics)
    updateLava() {
        if (!this._lavaTouch) return;
        if (this._t % TK(TUNING.LAVA_DOT.interval) !== 0) return;
        this.damageBuddy(TUNING.LAVA_DOT.dmg, null, { dot: true });
        if (this.ai.burnT <= 0 && this.ai.freezeT <= 0) {
            this.ignite();
            this.setBubble(pickLine(LINES.lava), 26);
        }
        // the recoil: lava kicks the whole body up and away from the pool,
        // so even an unconscious ragdoll gets bounced out instead of cooking
        const hx = this.pts.hip.x;
        const pool = TUNING.WORLD.LAVA.find(L => hx >= L.x0 - 6 && hx <= L.x1 + 6);
        const away = pool ? (hx >= (pool.x0 + pool.x1) / 2 ? 1 : -1) : (Math.random() < 0.5 ? -1 : 1);
        for (const k in this.pts) {
            this.pts[k].px -= away * V(1.8);
            this.pts[k].py += V(2.0);
        }
        this.ai.dir = away;
        this.emitBurst(this.pts.footL.x, TUNING.WORLD.DEEP_FLOOR - 2, [255, 150, 50, 255], 3);
    }

    updateShrooms() {
        const S = TUNING.SHROOM, W = TUNING.WORLD;
        for (const s of this.shrooms) {
            if (s.cd > 0) { s.cd--; continue; }
            if (s.fy === W.SLABS[1].top && !this.solidAtS(1, s.x)) continue;   // its ground is gone
            const hip = this.pts.hip;
            const falling = (hip.y - hip.py) > 0;
            if (!falling) continue;
            for (const key of ['footL', 'footR', 'hip']) {
                const p = this.pts[key];
                if (Math.abs(p.x - s.x) < 3.4 && p.y > s.fy - 8 && p.y < s.fy + 2) {
                    const kick = (Math.random() < 0.5 ? -1 : 1) * V(1.4);
                    for (const k2 in this.pts) {
                        this.pts[k2].py += V(S.launch);
                        this.pts[k2].px -= kick;
                    }
                    this.ai.dir = kick > 0 ? 1 : -1;
                    this.ai.x = clamp(this.ai.x + this.ai.dir * 10, 6, 66);
                    s.cd = TK(S.cooldown);
                    this.emitBurst(s.x, s.fy - 5, [245, 140, 190, 255], 8);
                    this.setBubble(pickLine(LINES.boing), 18);
                    break;
                }
            }
        }
    }

    updateBarrels() {
        let changed = false;
        const W = TUNING.WORLD;
        for (const b of this.barrels) {
            if (!b.alive) {
                b.respawn--;
                if (b.respawn <= 0) {
                    b.alive = true;
                    b.vy = 0;
                    b.x = 5 + Math.random() * 62;
                    b.y = this.solidAtS(1, b.x) ? W.SLABS[1].top - 1.6 : W.DEEP_FLOOR - 1.6;
                    changed = true;
                    this._worldDirty = true;
                }
                continue;
            }
            // barrels fall when the rock under them is blown away
            const restY = this.solidAtS(1, b.x) && b.y < W.SLABS[1].top ? W.SLABS[1].top - 1.6 : W.DEEP_FLOOR - 1.6;
            if (b.y < restY - 0.3) {
                b.vy += G * 1.6;
                b.y += b.vy;
                changed = true;
                this._worldDirty = true;
                if (b.y >= restY - 0.3) {
                    b.y = restY;
                    b.vy = 0;
                    if (b.y > W.DEEP_FLOOR - 3 && this.inLava(b.x)) { this.barrelBoom(b); continue; }   // landed in lava
                }
            }
            if (b.fuse > 0) {
                b.fuse--;
                changed = true;
                if (b.fuse <= 0) this.barrelBoom(b);
            }
        }
        return changed;
    }

    updateDeepStuff() {
        let changed = false;
        for (const c of this.crystals) {
            if (c.alive) continue;
            c.respawn--;
            if (c.respawn <= 0) {
                c.alive = true;
                changed = true;
                this._worldDirty = true;
            }
        }
        for (const s of this.stals) {
            if (s.alive) continue;
            s.respawn--;
            if (s.respawn <= 0) {
                // re-grow under a still-solid rock column
                const d = TUNING.WORLD.SLABS[1];
                for (let tries = 0; tries < 6; tries++) {
                    const x = 4 + Math.random() * 64;
                    if (this.solidAtS(1, x)) { s.x = x; s.alive = true; this._worldDirty = true; changed = true; break; }
                }
                if (!s.alive) s.respawn = TK(120);   // no ceiling left; try later
            }
        }
        return changed;
    }

    renderBuddy() {
        const b = this.pts, A = this.ai, cy = this.camY;
        const frozen = A.freezeT > 0;
        const limbFill = frozen ? [150, 210, 240, 255] : [168, 172, 184, 255];
        const torsoFill = frozen ? [130, 195, 235, 255] : [150, 156, 172, 255];
        const headFill = frozen ? [185, 228, 250, 255] : [198, 202, 212, 255];

        this.torsoNode.node.coordinates2d = thickLine(b.chest.x, b.chest.y - cy, b.hip.x, b.hip.y - cy, 3.4);
        this.armLNode.node.coordinates2d = thickLine(b.chest.x, b.chest.y - cy, b.handL.x, b.handL.y - cy, 1.5);
        this.armRNode.node.coordinates2d = thickLine(b.chest.x, b.chest.y - cy, b.handR.x, b.handR.y - cy, 1.5);
        this.legLNode.node.coordinates2d = thickLine(b.hip.x, b.hip.y - cy, b.footL.x, b.footL.y - cy, 1.8);
        this.legRNode.node.coordinates2d = thickLine(b.hip.x, b.hip.y - cy, b.footR.x, b.footR.y - cy, 1.8);
        this.headNode.node.coordinates2d = polyCircle(b.head.x, b.head.y - cy, b.head.r, 14);
        this.torsoNode.node.fill = torsoFill;
        this.armLNode.node.fill = limbFill;
        this.armRNode.node.fill = limbFill;
        this.legLNode.node.fill = limbFill;
        this.legRNode.node.fill = limbFill;
        this.headNode.node.fill = headFill;

        const hx = b.head.x, hy = b.head.y - cy;
        const scared = A.state === 'flee' || (this.hp < TUNING.BUDDY.cowerHp && !frozen);
        const eyeW = scared ? 1.1 : 0.8, eyeH = scared ? 1.3 : 0.8;
        this.eyeLNode.node.coordinates2d = ShapeUtils.rectangle(hx - 1.7, hy - 1.5, eyeW, eyeH);
        this.eyeRNode.node.coordinates2d = ShapeUtils.rectangle(hx + 0.9 - (eyeW - 0.8), hy - 1.5, eyeW, eyeH);
        if (this.hurt > 0 && !frozen) {
            this.mouthNode.node.coordinates2d = ShapeUtils.rectangle(hx - 0.9, hy + 0.3, 1.8, 1.6);
            this.mouthNode.node.fill = [190, 60, 60, 255];
        } else if (scared) {
            this.mouthNode.node.coordinates2d = ShapeUtils.rectangle(hx - 0.7, hy + 0.6, 1.4, 1.1);
            this.mouthNode.node.fill = [40, 42, 52, 255];
        } else {
            this.mouthNode.node.coordinates2d = ShapeUtils.rectangle(hx - 1.2, hy + 0.9, 2.4, 0.5);
            this.mouthNode.node.fill = frozen ? [30, 80, 120, 255] : [40, 42, 52, 255];
        }
    }

    renderWorld() {
        const W = TUNING.WORLD, cy = this.camY;
        const band = (top, bot) => {
            const t = clamp(top - cy, 0, 100), b2 = clamp(bot - cy, 0, 100);
            return b2 > t ? ShapeUtils.rectangle(0, t, 72, b2 - t) : ShapeUtils.rectangle(0, 0, 0, 0);
        };
        this.cavernBg.node.coordinates2d = band(W.SLABS[0].bot, W.SLABS[1].top);
        this.deepBg.node.coordinates2d = band(W.SLABS[1].bot, W.DEEP_FLOOR);
        this.deepFloorNode.node.coordinates2d = band(W.DEEP_FLOOR, W.H);

        for (let li = 0; li < W.LAVA.length; li++) {
            const L = W.LAVA[li];
            const n = this.lavaNodes[li].node;
            const t = clamp(W.DEEP_FLOOR - 1.2 - cy, 0, 100), b2 = clamp(W.H - cy, 0, 100);
            if (b2 <= t) { n.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0); continue; }
            n.coordinates2d = ShapeUtils.rectangle(L.x0, t, L.x1 - L.x0, b2 - t);
            const glow = (Math.floor(this._t / TK(6)) % 2) === 0;
            n.fill = glow ? [255, 130, 45, 255] : [235, 100, 35, 255];
        }

        for (const s of this.slabs) {
            const d = s.def;
            const top = clamp(d.top - cy, 0, 100);
            const bot = clamp(d.bot - cy, 0, 100);
            const visible = bot > top;
            for (let i = 0; i < d.nCols; i++) {
                const n = s.nodes[i].node;
                if (!visible || s.cols[i] <= 0) {
                    n.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                    continue;
                }
                n.coordinates2d = ShapeUtils.rectangle(i * d.colW, top, d.colW, bot - top);
                n.fill = d.fills[clamp(d.hp - s.cols[i], 0, d.fills.length - 1)];
            }
        }

        for (const s of this.shrooms) {
            const gone = s.fy === W.SLABS[1].top && !this.solidAtS(1, s.x);
            const baseY = s.fy - cy;
            if (gone || baseY < -8 || baseY > 108) {
                s.stem.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                s.cap.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                continue;
            }
            s.stem.node.coordinates2d = ShapeUtils.rectangle(s.x - 0.7, baseY - 4, 1.4, 4);
            s.cap.node.coordinates2d = ShapeUtils.rectangle(s.x - 2.6, baseY - 5.6, 5.2, 2);
            s.cap.node.fill = s.cd > 0 ? [190, 120, 150, 255] : [235, 90, 140, 255];
        }

        for (const c of this.crystals) {
            const n = c.node.node;
            const sy = W.DEEP_FLOOR - 2 - cy;
            if (!c.alive || sy < -8 || sy > 108) {
                n.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                continue;
            }
            n.coordinates2d = polyCircle(c.x, sy, 2.1, 4);   // 4 sides = diamond
            n.fill = [120, 230, 220, 255];
        }

        for (const s of this.stals) {
            const n = s.node.node;
            const sy = W.SLABS[1].bot - cy;
            if (!s.alive || sy < -10 || sy > 108) {
                n.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                continue;
            }
            n.coordinates2d = [[s.x - 1.1, sy], [s.x + 1.1, sy], [s.x, sy + 3.4], [s.x - 1.1, sy]];   // hanging spike
            n.fill = [205, 205, 218, 255];
        }

        for (const b of this.barrels) {
            const n = b.node.node;
            const sy = b.y - cy;
            if (!b.alive || sy < -8 || sy > 108) {
                n.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                n.fill = [0, 0, 0, 0];
                continue;
            }
            n.coordinates2d = ShapeUtils.rectangle(b.x - 1.2, sy - 3, 2.4, 3);
            n.fill = b.fuse > 0 && (b.fuse % TK(2) < TK(1)) ? [255, 230, 210, 255] : [200, 70, 50, 255];
        }
    }

    // ------------------------------------------------------------ pools ----
    emitBurst(x, y, fill, count) {
        for (const f of this.fx) {
            if (count <= 0) break;
            if (f.active) continue;
            count--;
            f.active = true;
            f.life = TK(12); f.max = TK(12);
            f.x = x; f.y = y;
            const a = Math.random() * Math.PI * 2;
            const s = V(0.5 + Math.random() * 1.1);
            f.vx = Math.cos(a) * s;
            f.vy = Math.sin(a) * s - V(0.4);
            f.fill = fill;
        }
    }

    updateParticles() {
        let any = false;
        const gSign = this.gravT > 0 ? -1 : 1;
        const cy = this.camY;
        for (const f of this.fx) {
            if (!f.active) continue;
            any = true;
            f.vy += ACC(0.07) * gSign;
            f.x += f.vx; f.y += f.vy;
            f.life--;
            const n = f.node.node;
            if (f.life <= 0 || f.x < 0 || f.x > 72 || f.y > TUNING.WORLD.H - 2 || f.y < 0) {
                f.active = false;
                n.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                n.fill = [0, 0, 0, 0];
                n.color = [255, 255, 255, 0];
                continue;
            }
            const sy = f.y - cy;
            if (sy < -2 || sy > 102) { n.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0); n.fill = [0, 0, 0, 0]; continue; }
            n.coordinates2d = ShapeUtils.rectangle(f.x - 0.35, sy - 0.35, 0.7, 0.7);
            n.fill = [f.fill[0], f.fill[1], f.fill[2], 255];
            n.color = [255, 255, 255, clampByte(230 * f.life / f.max)];
        }
        return any;
    }

    updateRings() {
        let any = false;
        const cy = this.camY;
        for (const r of this.rings) {
            if (!r.active) continue;
            any = true;
            r.life--;
            const n = r.node.node;
            const sy = r.y - cy;
            if (r.life <= 0 || sy < -20 || sy > 120) {
                r.active = false;
                n.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                n.fill = [0, 0, 0, 0];
                n.color = [255, 255, 255, 0];
                continue;
            }
            const k = 1 - r.life / r.max;
            n.coordinates2d = polyCircle(r.x, sy, 2 + r.targetR * k, 16);
            n.fill = [r.fill[0], r.fill[1], r.fill[2], 255];
            n.color = [255, 255, 255, clampByte(200 * (r.life / r.max))];
        }
        return any;
    }

    updateBolt() {
        if (this.boltLife <= 0) return false;
        this.boltLife--;
        const n = this.boltNode.node;
        if (this.boltLife <= 0) {
            n.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            n.fill = [0, 0, 0, 0];
            n.effects = null;
            return true;
        }
        const j1 = (Math.random() - 0.5) * 2.4;
        const j2 = (Math.random() - 0.5) * 1.6;
        n.coordinates2d = thickLine(this.boltX + j1, 0, this.boltTX + j2, this.boltTY - this.camY, 0.7);
        n.fill = [200, 240, 255, 255];
        return true;
    }

    updateHole() {
        if (!this.hole.active) return false;
        const H = this.hole;
        const cy = this.camY;
        H.life--;
        if (H.life <= 0) {
            H.active = false;
            this.explode(H.x, H.y, 'hole');
            this.holeCore.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            this.holeCore.node.fill = [0, 0, 0, 0];
            this.holeRing.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            this.holeRing.node.fill = [0, 0, 0, 0];
            return true;
        }
        for (const k in this.pts) {
            const p = this.pts[k];
            const dx = H.x - p.x, dy = H.y - p.y;
            const d = Math.hypot(dx, dy) + 1.5;
            const s = Math.min(0.85, 30 / d) * DT * DT * 3;
            p.px -= (dx / d) * s;
            p.py -= (dy / d) * s;
        }
        if (this.ai.freezeT <= 0) {
            this.ai.state = 'ragdoll';
            this.ai.stun = Math.max(this.ai.stun, 8);
        }
        for (const p of this.projs) {
            if (!p.active || p.delay > 0) continue;
            const dx = H.x - p.x, dy = H.y - p.y;
            const d = Math.hypot(dx, dy) + 1.5;
            const s = Math.min(0.7, 22 / d) * DT * DT * 3;
            p.vx += (dx / d) * s;
            p.vy += (dy / d) * s;
        }
        if (H.life % 2 === 0) {
            const a = Math.random() * Math.PI * 2;
            const r = 6 + Math.random() * 5;
            for (const f of this.fx) {
                if (f.active) continue;
                f.active = true;
                f.life = TK(10); f.max = TK(10);
                f.x = H.x + Math.cos(a) * r;
                f.y = H.y + Math.sin(a) * r;
                f.vx = (-Math.cos(a) * 0.9 + Math.sin(a) * 0.7) * DT;
                f.vy = (-Math.sin(a) * 0.9 - Math.cos(a) * 0.7) * DT;
                f.fill = [170, 100, 240, 255];
                break;
            }
        }
        const pulse = 1 + 0.25 * Math.sin(this._t * 0.5 * DT);
        this.holeRing.node.coordinates2d = polyCircle(H.x, H.y - cy, 4.2 * pulse, 14);
        this.holeRing.node.fill = [120, 50, 200, 255];
        this.holeRing.node.color = [255, 255, 255, 150];
        this.holeCore.node.coordinates2d = polyCircle(H.x, H.y - cy, 2.4, 12);
        this.holeCore.node.fill = [12, 6, 20, 255];
        this.holeCore.node.color = [255, 255, 255, 255];
        return true;
    }

    updateProjectiles() {
        let any = false;
        const W = TUNING.WORLD;
        const DF = W.DEEP_FLOOR;
        const cy = this.camY;
        const gSign = this.gravT > 0 ? -1 : 1;
        for (const p of this.projs) {
            if (!p.active) continue;
            any = true;
            if (p.delay > 0) { p.delay--; continue; }
            if (p.hitCd > 0) p.hitCd--;
            const t = p.type;
            const yPrev = p.y;

            if (t === 'anvil') p.vy += G * 2.6 * gSign;
            else if (t === 'stal') p.vy += G * 1.6;
            else if (t !== 'pellet' && t !== 'bee' && t !== 'rocket') p.vy += G * gSign;
            p.x += p.vx;
            p.y += p.vy;

            // barrels + crystals react to solid projectiles passing through
            if (t !== 'bee') {
                const barrel = this.barrelAt(p.x, p.y, PROJ_VIS[t].r);
                if (barrel && barrel.fuse <= 0) barrel.fuse = TK(TUNING.BARREL.shotFuse);
                const cr = this.crystalAt(p.x, p.y, PROJ_VIS[t].r);
                if (cr) this.shatterCrystal(cr);
            }
            // lava consumes most things
            if (t !== 'bee' && p.y > DF - 1.5 && this.inLava(p.x)) {
                if (t === 'grenade' || t === 'molotov' || t === 'rocket') this.explode(p.x, DF - 2, t === 'rocket' ? 'rocket' : t);
                else this.emitBurst(p.x, DF - 1.5, [255, 140, 50, 255], 5);
                this.hideProj(p);
                continue;
            }

            if (t === 'grenade') {
                if (p.x < TUNING.WALL_L + 1) { p.x = TUNING.WALL_L + 1; p.vx = -p.vx * 0.6; }
                if (p.x > TUNING.WALL_R - 1) { p.x = TUNING.WALL_R - 1; p.vx = -p.vx * 0.6; }
                const sh = this.slabHitAny(p.x, p.y, yPrev, 1.4);
                if (sh && sh.face === 'top') { p.y = sh.top - 1.4; p.vy = -Math.abs(p.vy) * 0.45; p.vx *= 0.75; }
                if (sh && sh.face === 'bottom') { p.y = sh.bot + 1.4; p.vy = Math.abs(p.vy) * 0.45; }
                if (p.y > DF - 1.4) { p.y = DF - 1.4; p.vy = -Math.abs(p.vy) * 0.45; p.vx *= 0.75; }
                if (p.y < 1.4) { p.y = 1.4; p.vy = Math.abs(p.vy) * 0.45; }
                p.fuse--;
                if (p.fuse <= 0) { this.explode(p.x, p.y, 'grenade'); this.hideProj(p); continue; }

            } else if (t === 'duck') {
                const R = 1.5;
                const sh = this.slabHitAny(p.x, p.y, yPrev, R);
                if (sh && sh.face === 'top') { p.y = sh.top - R; p.vy = -Math.abs(p.vy) * 0.85; p.vx *= DUCK_FR; }
                if (sh && sh.face === 'bottom') { p.y = sh.bot + R; p.vy = Math.abs(p.vy) * 0.85; }
                if (p.y > DF - R) { p.y = DF - R; p.vy = -Math.abs(p.vy) * 0.85; p.vx *= DUCK_FR; }
                if (p.y < R) { p.y = R; p.vy = Math.abs(p.vy) * 0.85; }
                if (p.x < TUNING.WALL_L + R) { p.x = TUNING.WALL_L + R; p.vx = Math.abs(p.vx) * 0.9; }
                if (p.x > TUNING.WALL_R - R) { p.x = TUNING.WALL_R - R; p.vx = -Math.abs(p.vx) * 0.9; }
                if (p.hitCd <= 0) {
                    const q = this.pointHit(p.x, p.y, R);
                    if (q) {
                        const w = TUNING.WEAPONS.duck;
                        const sp = Math.hypot(p.vx, p.vy) || 1;
                        q.px -= (p.vx / sp) * V(w.push);
                        q.py -= (p.vy / sp) * V(w.push);
                        this.damageBuddy(w.dmg, p.x);
                        if (Math.random() < 0.25) this.setBubble(pickLine(LINES.duck), 18);
                        this.emitBurst(p.x, p.y, [255, 220, 90, 255], 3);
                        p.hitCd = TK(8);
                        p.vx = -p.vx * 0.75;
                        p.vy = -Math.abs(p.vy) * 0.7 - V(0.5);
                    }
                }
                p.life--;
                if (p.life <= 0) { this.emitBurst(p.x, p.y, [255, 210, 50, 255], 5); this.hideProj(p); continue; }

            } else if (t === 'bowling') {
                const R = 2.2;
                if (this.gravT <= 0) {
                    const sh = this.slabHitAny(p.x, p.y, yPrev, R);
                    if (sh && sh.face === 'top') { p.y = sh.top - R; p.vy = 0; p.vx *= ROLL_DT; }
                    if (p.y > DF - R) { p.y = DF - R; p.vy = 0; p.vx *= ROLL_DT; }
                } else {
                    const sh = this.slabHitAny(p.x, p.y, yPrev, R);
                    if (sh && sh.face === 'bottom') { p.y = sh.bot + R; p.vy = 0; p.vx *= ROLL_DT; }
                    if (p.y < R) { p.y = R; p.vy = 0; p.vx *= ROLL_DT; }
                }
                if (p.x < TUNING.WALL_L + R) { p.x = TUNING.WALL_L + R; p.vx = Math.abs(p.vx) * 0.65; }
                if (p.x > TUNING.WALL_R - R) { p.x = TUNING.WALL_R - R; p.vx = -Math.abs(p.vx) * 0.65; }
                if (p.hitCd <= 0) {
                    const q = this.pointHit(p.x, p.y, R);
                    if (q) {
                        const w = TUNING.WEAPONS.bowling;
                        q.px -= Math.sign(p.vx || 1) * V(w.push);
                        q.py -= V(1.4);
                        this.damageBuddy(w.dmg, p.x);
                        this.emitBurst(p.x, p.y, [140, 145, 165, 255], 6);
                        p.hitCd = TK(10);
                        p.vx *= 0.85;
                    }
                }
                p.life--;
                if (p.life <= 0 || Math.abs(p.vx) < V(0.15)) {
                    this.emitBurst(p.x, p.y, [120, 125, 140, 255], 4);
                    this.hideProj(p);
                    continue;
                }

            } else if (t === 'anvil') {
                const q = this.pointHit(p.x, p.y + 1, 2.4);
                if (q) {
                    const w = TUNING.WEAPONS.anvil;
                    q.py -= V(w.push) * gSign;
                    q.px -= (Math.random() - 0.5) * V(2);
                    this.damageBuddy(w.dmg, null);
                    this.emitBurst(p.x, p.y, [200, 200, 210, 255], 10);
                    this.hideProj(p);
                    continue;
                }
                if (this.gravT <= 0) {
                    const sh = this.slabHitAny(p.x, p.y, yPrev, 1.4);
                    if (sh && sh.face === 'top') {
                        this.damageGround(sh.si, p.x, 3, TERRAIN_POWER.anvil);
                        this.explode(p.x, sh.top - 1.5, 'anvil');
                        this.hideProj(p);
                        continue;
                    }
                    if (p.y > DF - 1.4) {
                        this.explode(p.x, DF - 1.5, 'anvil');
                        this.hideProj(p);
                        continue;
                    }
                } else if (p.y < 0.5) { this.hideProj(p); continue; }

            } else if (t === 'molotov') {
                const q = this.pointHit(p.x, p.y, 1.2);
                const sh = this.slabHitAny(p.x, p.y, yPrev, 1.2);
                if (q || sh || p.y > DF - 1.2 || p.y < 1 || p.x < TUNING.WALL_L + 1 || p.x > TUNING.WALL_R - 1) {
                    this.explode(p.x, clamp(p.y, 2, DF - 1.5), 'molotov');
                    this.hideProj(p);
                    continue;
                }

            } else if (t === 'bee') {
                const c = this.nearestPoint(p.x, p.y);
                const jit = (Math.random() - 0.5) * 0.9;
                const ang = Math.atan2(c.y - p.y, c.x - p.x) + jit;
                const s = V(1.15);
                const steer = 1 - Math.pow(0.75, DT);
                p.vx += (Math.cos(ang) * s - p.vx) * steer;
                p.vy += (Math.sin(ang) * s - p.vy) * steer;
                const q = this.pointHit(p.x, p.y, 0.7);
                if (q) {
                    const w = TUNING.WEAPONS.bees;
                    q.px -= p.vx * 2;
                    q.py -= p.vy * 2;
                    this.damageBuddy(w.dmg, p.x);
                    this.emitBurst(p.x, p.y, [255, 200, 30, 255], 2);
                    this.hideProj(p);
                    continue;
                }
                p.life--;
                if (p.life <= 0) { this.hideProj(p); continue; }

            } else if (t === 'rocket') {
                const c = this.pts.chest;
                const cur = Math.atan2(p.vy, p.vx);
                const want = Math.atan2(c.y - p.y, c.x - p.x);
                let diff = want - cur;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                const turnRate = 0.12 * DT;
                const na = cur + clamp(diff, -turnRate, turnRate);
                const sp = V(1.9);
                p.vx = Math.cos(na) * sp;
                p.vy = Math.sin(na) * sp;
                if (p.life % TK(2) === 0) this.emitBurst(p.x - p.vx * 2, p.y - p.vy * 2, [255, 160, 60, 255], 1);
                const q = this.pointHit(p.x, p.y, 1.4);
                const sh = this.slabHitAny(p.x, p.y, yPrev, 1.2);
                if (q || sh || p.y > DF - 1 || p.y < 1 || p.x < TUNING.WALL_L + 0.5 || p.x > TUNING.WALL_R - 0.5) {
                    this.explode(clamp(p.x, 2, 70), clamp(p.y, 2, DF - 1.5), 'rocket');
                    this.hideProj(p);
                    continue;
                }
                p.life--;
                if (p.life <= 0) { this.explode(p.x, p.y, 'rocket'); this.hideProj(p); continue; }

            } else if (t === 'stal') {
                const q = this.pointHit(p.x, p.y + 0.8, 1.2);
                if (q) {
                    q.py += V(2.2);                                  // spiked downward
                    this.damageBuddy(TUNING.STAL.dmg, p.x);
                    this.emitBurst(p.x, p.y, [205, 205, 218, 255], 6);
                    this.hideProj(p);
                    continue;
                }
                const sh = this.slabHitAny(p.x, p.y, yPrev, 1.1);
                if (sh || p.y > DF - 1.1) {
                    this.emitBurst(p.x, Math.min(p.y, DF - 1.5), [205, 205, 218, 255], 6);
                    this.hideProj(p);
                    continue;
                }

            } else {
                // ball / pellet
                const R = PROJ_VIS[t].r;
                const q = this.pointHit(p.x, p.y, R);
                if (q) {
                    const w = TUNING.WEAPONS[t === 'ball' ? 'ball' : 'minigun'];
                    const sp = Math.hypot(p.vx, p.vy) || 1;
                    q.px -= (p.vx / sp) * V(w.push);
                    q.py -= (p.vy / sp) * V(w.push);
                    this.damageBuddy(w.dmg, p.x);
                    this.emitBurst(p.x, p.y, t === 'ball' ? [255, 170, 80, 255] : [255, 230, 120, 255], t === 'ball' ? 7 : 3);
                    this.hideProj(p);
                    continue;
                }
                const sh = this.slabHitAny(p.x, p.y, yPrev, R);
                if (sh || p.y > DF - 0.5 || p.y < -1) {
                    this.emitBurst(p.x, clamp(p.y, 1, DF - 1), [120, 125, 140, 255], 4);
                    this.hideProj(p);
                    continue;
                }
                if (p.x < 0 || p.x > 72) { this.hideProj(p); continue; }
            }

            const sy = p.y - cy;
            if (sy < -6 || sy > 106) {
                p.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                p.node.node.fill = [0, 0, 0, 0];
                continue;
            }
            if (t === 'anvil') {
                p.node.node.coordinates2d = ShapeUtils.rectangle(p.x - 2.2, sy - 1.3, 4.4, 2.6);
            } else if (t === 'stal') {
                p.node.node.coordinates2d = [[p.x - 1.1, sy - 1.7], [p.x + 1.1, sy - 1.7], [p.x, sy + 1.7], [p.x - 1.1, sy - 1.7]];
            } else {
                p.node.node.coordinates2d = polyCircle(p.x, sy, PROJ_VIS[t].r, 10);
            }
            p.node.node.fill = PROJ_VIS[t].fill;
        }
        return any;
    }

    // -------------------------------------------------------------- hud ----
    refreshHud() {
        this.moneyText.node.text = { text: '$' + this.money, x: 86, y: 2, size: 2.2, align: 'center', color: COLORS.HG_YELLOW };
        this.weaponText.node.text = {
            text: 'USING: ' + TUNING.WEAPONS[this.selected].name,
            x: 86, y: 7.8, size: 1.2, align: 'center', color: [160, 220, 180, 255]
        };
        const frac = Math.max(0, this.hp / TUNING.BUDDY.hpMax);
        this.hpFill.node.coordinates2d = ShapeUtils.rectangle(3, 3, Math.max(0.2, 34 * frac), 2.4);
        this.hpFill.node.fill = [clampByte(255 * (1 - frac) * 1.5), clampByte(60 + 180 * frac), 70, 255];
        this.lastHpShown = this.hp;
    }

    changeShopPage(direction) {
        this.shopPage = Math.max(0, Math.min(Math.ceil(WEAPON_ORDER.length / SHOP_PAGE_SIZE) - 1, this.shopPage + direction));
        this.refreshShop();
        this.base.node.onStateChange();
    }

    refreshShop() {
        WEAPON_ORDER.forEach((key, index) => {
            const btn = this.shopBtns[key];
            const visible = Math.floor(index / SHOP_PAGE_SIZE) === this.shopPage;
            // Visibility applies to the card and its text; stale clicks are also
            // checked against the current page in the card's handler.
            btn.bg.node.playerIds = visible ? [] : [0];
            for (const child of btn.bg.node.children) child.node.playerIds = visible ? [] : [0];
            const w = TUNING.WEAPONS[key];
            const sel = this.selected === key;
            const own = !!this.owned[key];
            btn.bg.node.fill = sel ? [46, 122, 74, 255] : own ? [60, 62, 76, 255] : [42, 44, 54, 255];
            const priceStr = sel ? '✓' : own ? 'USE' : '$' + w.cost;
            const priceColor = sel ? [200, 255, 210, 255]
                : own ? [200, 205, 220, 255]
                : (this.money >= w.cost ? COLORS.HG_YELLOW : [130, 120, 110, 255]);
            btn.price.node.text = { text: priceStr, x: 86, y: btn.y + 7, size: 1.6, align: 'center', color: priceColor };
        });
        this.shopPageText.node.text = { ...this.shopPageText.node.text, text: `${this.shopPage + 1} / ${Math.ceil(WEAPON_ORDER.length / SHOP_PAGE_SIZE)}` };
        this.shopNav.forEach((button, index) => {
            const enabled = index === 0 ? this.shopPage > 0 : this.shopPage < Math.ceil(WEAPON_ORDER.length / SHOP_PAGE_SIZE) - 1;
            button.node.fill = enabled ? [60, 62, 76, 255] : [24, 26, 32, 255];
        });
    }

    // ------------------------------------------------------------- tick ----
    tick() {
        this._t++;
        let changed = false;

        this.updateAI();
        this.updateShrooms();
        const moved = this.stepPhysics();
        this.updateLava();
        if (moved > MOVED_EPS) changed = true;

        const chestY = this.pts.chest.y;
        const camTarget = chestY < 92 ? 0 : clamp(chestY - 50, 0, TUNING.WORLD.H - 100);
        const camDelta = (camTarget - this.camY) * CAM_LERP;
        if (Math.abs(camDelta) > 0.004) { this.camY += camDelta; changed = true; }

        // depth screams
        const level = chestY <= 102 ? 0 : chestY <= 190 ? 1 : 2;
        if (level > this.depthLevel) this.setBubble(pickLine(level === 1 ? LINES.fall : LINES.deep), 30);
        this.depthLevel = level;

        this.renderBuddy();
        this.renderWorld();
        if (this._worldDirty) { this._worldDirty = false; changed = true; }

        if (this.hurt > 0 || this._hurtPrev > 0) changed = true;
        this._hurtPrev = this.hurt;
        if (this.hurt > 0) this.hurt--;

        if (this.hp < TUNING.BUDDY.hpMax) {
            this.hp = Math.min(TUNING.BUDDY.hpMax, this.hp + TUNING.BUDDY.regen * DT);
            if (Math.abs(this.hp - this.lastHpShown) >= 0.5) this.uiDirty = true;
        }

        if (this.gravT > 0) {
            this.gravT--;
            changed = true;
            if (this.gravT === 0) this.base.node.fill = [24, 26, 34, 255];
        }

        if (this.updateBarrels()) changed = true;
        if (this.updateDeepStuff()) changed = true;
        if (this.updateHole()) changed = true;
        if (this.updateBolt()) changed = true;
        if (this.updateProjectiles()) changed = true;
        if (this.updateParticles()) changed = true;
        if (this.updateRings()) changed = true;

        if (this.bubbleLife > 0) {
            this.bubbleLife--;
            const bx = clamp(this.pts.head.x, 8, 64);
            const by = clamp(this.pts.head.y - this.camY - 7, 2, 94);
            const str = this.bubbleLife === 0 ? ' ' : this.bubbleStr;
            this.bubbleNode.node.text = { text: str, x: bx, y: by, size: 1.6, align: 'center', color: COLORS.WHITE };
            changed = true;
        }

        if (this.koLife > 0) {
            this.koLife--;
            if (this.koLife === 0) {
                this.koText.node.text = { text: ' ', x: 36, y: 26, size: 3, align: 'center', color: COLORS.SHARP_YELLOW };
                changed = true;
            }
        }
        if (this.hintLife > 0) {
            this.hintLife--;
            if (this.hintLife === 0) {
                this.hintText.node.text = { text: ' ', x: 36, y: 32, size: 1.7, align: 'center', color: COLORS.CANDY_RED };
                changed = true;
            }
        }

        if (this.uiDirty) { this.refreshHud(); this.uiDirty = false; changed = true; }
        if (this.shopDirty) { this.refreshShop(); this.shopDirty = false; changed = true; }

        if (changed) this.base.node.onStateChange();
    }
}

module.exports = BuddyBox;
