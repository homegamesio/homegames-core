const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');

// SUNDOWN — polygonal Outrun. A Mode-7 road of pooled trapezoids,
// a single glowing sun, and billboard palms. Solo, 120Hz.

const TUNING = {
    TICK: 120,             // tickRate - MUST match metadata()
    MAX_PLAYERS: 1,        // maxPlayers - MUST match metadata()
    ROUND_SECONDS: 90,
    DRAW: 68,
    SEG: 8,
    CAM_D: 0.9,
    CAM_H: 7,
    ROAD_W: 1.32,
    FOV: 100,
    VFOV: 55,
    HORIZON: 41,
    MAX_SPEED: 210,
    ACCEL: 55,
    BRAKE: 90,
    OFFROAD: 118,
    STEER: 2.55,
    STEER_RESP: 10,
    STEER_RETURN: 13,
    CENTRIF: 26,
    CAR_LANE: 0.64,
    CAR_HALF: 0.26,
    PLAYER_HALF: 0.22,
    HIT_Z: 5.2,
    CRASH_SLOW: 32,
    CRASH_SECONDS: 4.5,
    PALMS: 18,
    CARS: 5,
    DUST: 22,
    SKY: 10
};

const TICK = TUNING.TICK;
const DT = 1 / TICK;
const ROUND_TICKS = TUNING.ROUND_SECONDS * TICK;
const TAP_HOLD = Math.round(0.18 * TICK);
const DRAW = TUNING.DRAW;
const SEG = TUNING.SEG;
const HORIZON = TUNING.HORIZON;
const ASPECT = 16 / 9;

const SKY_TOP = [18, 16, 48, 255];
const SKY_HORIZ = [255, 128, 78, 255];
const SUN = [255, 236, 170, 255];
const SUN_HALO = [255, 160, 90, 255];
const HILL_FAR = [92, 42, 62, 255];
const HILL_NEAR = [58, 28, 44, 255];
const GRASS_A = [72, 38, 58, 255];
const GRASS_B = [48, 28, 46, 255];
const ROAD_A = [48, 40, 52, 255];
const ROAD_B = [36, 30, 42, 255];
const RUMBLE_A = [230, 86, 72, 255];
const RUMBLE_B = [248, 228, 200, 255];
const LANE = [255, 210, 150, 255];
const PALM_TRUNK = [92, 52, 38, 255];
const PALM_LEAF = [36, 92, 58, 255];
const CAR_BODY = [
    [230, 70, 80, 255],
    [70, 150, 220, 255],
    [250, 200, 70, 255],
    [90, 200, 140, 255],
    [180, 90, 210, 255]
];
const HERO = [255, 92, 64, 255];
const HERO_STRIPE = [255, 236, 190, 255];
const BAR_BG = [30, 18, 28, 255];
const BAR_FILL = [255, 120, 70, 255];
const CREAM = [255, 240, 220, 255];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpColor = (a, b, t) => {
    t = clamp(t, 0, 1);
    return [
        Math.round(lerp(a[0], b[0], t)),
        Math.round(lerp(a[1], b[1], t)),
        Math.round(lerp(a[2], b[2], t)),
        255
    ];
};

const polyEllipse = (cx, cy, rx, ry, sides) => {
    const n = sides || 16;
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
};

const band = (y1, y2) => [
    [0, y1], [100, y1], [100, y2], [0, y2], [0, y1]
];

const clipX = (pts) => pts.map(p => [Math.max(0, p[0]), p[1]]);

class Sundown extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Sundown',
            author: 'Joseph Garcia',
            description: 'Race the sun. Distance is the score.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 120,       // keep in sync with TUNING.TICK
            maxPlayers: 1        // keep in sync with TUNING.MAX_PLAYERS
        };
    }

    constructor() {
        super();
        this._t = 0;
        this.phase = 'playing';
        this.keys = {};
        this.tapX = 50;
        this.tapUntil = 0;
        this.proj = new Array(DRAW + 1);

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: SKY_TOP
        });

        this.skyLayer = this.makeContainer();
        this.hillFar = this.mkShape(ShapeUtils.rectangle(0, HORIZON, 100, 2), HILL_FAR);
        this.sunHalo = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyEllipse(70, HORIZON - 5, 9, 9 * ASPECT, 16),
            fill: SUN_HALO,
            color: [255, 180, 80, 90]
        });
        this.sun = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyEllipse(70, HORIZON - 5, 5.2, 5.2 * ASPECT, 16),
            fill: SUN,
            effects: glow(SUN, 22)
        });
        this.hillNear = this.mkShape(ShapeUtils.rectangle(0, HORIZON, 100, 2), HILL_NEAR);
        this.groundLayer = this.makeContainer();
        this.spriteLayer = this.makeContainer();
        this.reflect = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyEllipse(70, HORIZON + 10, 4, 2.2 * ASPECT, 14),
            fill: SUN,
            color: [255, 220, 160, 70]
        });
        this.heroLayer = this.makeContainer();
        this.fxLayer = this.makeContainer();
        this.hud = this.makeContainer();
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (playerId, x, y) => this.handleTap(playerId, x, y)
        });

        this.sky = [];
        for (let i = 0; i < TUNING.SKY; i++) {
            const t = i / (TUNING.SKY - 1);
            const node = this.mkShape(ShapeUtils.rectangle(0, 0, 100, 0), lerpColor(SKY_TOP, SKY_HORIZ, t));
            this.sky.push(node);
            this.skyLayer.addChild(node);
        }

        this.grass = this.makePool(DRAW, this.groundLayer);
        this.rumble = this.makePool(DRAW, this.groundLayer);
        this.road = this.makePool(DRAW, this.groundLayer);
        this.lanes = this.makePool(Math.floor(DRAW / 2), this.groundLayer);

        this.palms = [];
        for (let i = 0; i < TUNING.PALMS; i++) {
            const trunk = this.mkShape(ShapeUtils.rectangle(0, 0, 0, 0), PALM_TRUNK);
            const leaf = this.mkShape(ShapeUtils.rectangle(0, 0, 0, 0), PALM_LEAF);
            this.spriteLayer.addChildren(trunk, leaf);
            this.palms.push({ trunk, leaf });
        }
        this.carNodes = [];
        for (let i = 0; i < TUNING.CARS; i++) {
            const body = this.mkShape(ShapeUtils.rectangle(0, 0, 0, 0), CAR_BODY[0]);
            const cabin = this.mkShape(ShapeUtils.rectangle(0, 0, 0, 0), [40, 36, 48, 255]);
            const light = this.mkShape(ShapeUtils.rectangle(0, 0, 0, 0), [255, 220, 140, 255]);
            this.spriteLayer.addChildren(body, cabin, light);
            this.carNodes.push({ body, cabin, light });
        }

        this.heroBody = this.mkShape(ShapeUtils.rectangle(0, 0, 0, 0), HERO);
        this.heroCabin = this.mkShape(ShapeUtils.rectangle(0, 0, 0, 0), [28, 24, 36, 255]);
        this.heroStripe = this.mkShape(ShapeUtils.rectangle(0, 0, 0, 0), HERO_STRIPE);
        this.heroLightL = this.mkShape(ShapeUtils.rectangle(0, 0, 0, 0), [255, 230, 160, 255]);
        this.heroLightR = this.mkShape(ShapeUtils.rectangle(0, 0, 0, 0), [255, 230, 160, 255]);
        this.heroLayer.addChildren(
            this.heroBody, this.heroCabin, this.heroStripe, this.heroLightL, this.heroLightR
        );

        this.dust = this.makePool(TUNING.DUST, this.fxLayer);

        this.timeBarBg = this.mkShape(ShapeUtils.rectangle(8, 2.4, 84, 1.2), BAR_BG);
        this.timeBar = this.mkShape(ShapeUtils.rectangle(8, 2.4, 84, 1.2), BAR_FILL);
        this.distText = new GameNode.Text({
            textInfo: { text: '0.00', x: 50, y: 5.2, size: 1.7, align: 'center', font: 'monospace', color: CREAM }
        });
        this.overText = new GameNode.Text({
            textInfo: { text: '', x: 50, y: 46, size: 3.2, align: 'center', font: 'monospace', color: CREAM }
        });
        this.hud.addChildren(this.timeBarBg, this.timeBar, this.distText, this.overText);

        this.base.addChildren(
            this.skyLayer,
            this.hillFar,
            this.sunHalo,
            this.sun,
            this.hillNear,
            this.groundLayer,
            this.reflect,
            this.spriteLayer,
            this.heroLayer,
            this.fxLayer,
            this.hud,
            this.tapCatcher
        );

        this.resetRun();
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

    mkShape(coords, fill) {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: coords,
            fill
        });
    }

    makePool(n, layer) {
        const pool = [];
        for (let i = 0; i < n; i++) {
            const node = this.mkShape(ShapeUtils.rectangle(0, 0, 0, 0), [0, 0, 0, 0]);
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
            text: str, x: prev.x, y: prev.y, size: prev.size,
            align: prev.align, font: prev.font, color: color || prev.color
        };
    }

    handleNewPlayer() {}
    handlePlayerDisconnect() { this.keys = {}; }

    handleKeyDown(playerId, key) {
        this.keys[key] = true;
        if (this.phase === 'over') this.restart();
    }

    handleKeyUp(playerId, key) {
        this.keys[key] = false;
    }

    handleTap(playerId, x, y) {
        if (this.phase === 'over') {
            this.restart();
            return;
        }
        this.tapX = x;
        this.tapUntil = this._t + TAP_HOLD;
    }

    restart() {
        if (this.phase !== 'over') return;
        this.resetRun();
        this.phase = 'playing';
        this.setText(this.overText, '');
        this.setText(this.distText, '0.00');
    }

    resetRun() {
        this.player = { z: 0, x: 0, speed: 90, steer: 0, vx: 0 };
        this.shakeT = 0;
        this.crashT = 0;
        this.barFlash = 0;
        this.timeDebt = 0;
        this.roundStart = this._t;
        this._overDrawn = false;
        this.distance = 0;
        this.dustBits = [];
        for (let i = 0; i < TUNING.DUST; i++) this.dustBits.push({ life: 0, x: 0, y: 0, vx: 0, vy: 0 });
        this.buildTrack();
        this.placeCars();
    }

    buildTrack() {
        this.segs = [];
        let y = 0;
        const add = (n, curve, dy) => {
            for (let i = 0; i < n; i++) {
                y += dy;
                const k = this.segs.length;
                this.segs.push({
                    z: k * SEG,
                    y,
                    curve,
                    palm: k % 7 === 0 ? (k % 14 === 0 ? -1 : 1) : 0,
                    shade: k % 2
                });
            }
        };
        add(80, 0, 0);
        add(46, -0.014, 0);
        add(28, 0, 0);
        add(36, 0.012, 0.07);
        add(40, 0.016, 0.04);
        add(26, 0, -0.11);
        add(64, 0, 0);
        add(32, -0.018, 0.05);
        add(32, 0.018, -0.05);
        add(40, 0, 0);
        add(54, 0.011, 0.08);
        add(22, 0, -0.13);
        add(72, 0, 0);
        add(44, -0.015, 0);
        add(36, 0.013, 0.05);
        add(48, 0, 0);
        this.trackLen = this.segs.length * SEG;
    }

    placeCars() {
        this.cars = [];
        for (let i = 0; i < TUNING.CARS; i++) {
            const lane = i % 2 === 0 ? -1 : 1;
            this.cars.push({
                z: 240 + i * 170,
                x: lane * TUNING.CAR_LANE,
                lane,
                speed: 52 + (i % 4) * 12,
                color: CAR_BODY[i % CAR_BODY.length],
                ghostUntil: 0
            });
        }
    }

    wrapZ(z) {
        const t = this.trackLen;
        z %= t;
        if (z < 0) z += t;
        return z;
    }

    segAt(z) {
        const i = Math.floor(this.wrapZ(z) / SEG) % this.segs.length;
        return this.segs[i];
    }

    relZ(worldZ) {
        let z = worldZ - this.player.z;
        if (z < -this.trackLen / 2) z += this.trackLen;
        if (z > this.trackLen / 2) z -= this.trackLen;
        return z;
    }

    project(worldX, worldY, relZ) {
        if (relZ < 0.65) return null;
        const scale = TUNING.CAM_D / relZ;
        return {
            x: 50 + scale * (worldX - this.player.x) * TUNING.FOV,
            y: HORIZON + scale * (TUNING.CAM_H - worldY) * TUNING.VFOV,
            w: scale * TUNING.ROAD_W * TUNING.FOV,
            scale,
            z: relZ
        };
    }

    kmLabel() {
        return (this.distance / 1000).toFixed(2);
    }

    timeElapsed() {
        return (this._t - this.roundStart) + this.timeDebt;
    }

    endRun() {
        this.phase = 'over';
        this.setText(this.overText, this.kmLabel(), CREAM);
        this.setText(this.distText, '');
    }

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

        this.updateDrive();
        if (this.timeElapsed() >= ROUND_TICKS) {
            this.endRun();
            this.render();
            this.base.node.onStateChange();
            this._overDrawn = true;
            return;
        }
        this.updateCars();
        this.updateDust();
        this.render();
        this.base.node.onStateChange();
    }

    steer() {
        let s = 0;
        if (this.keys.ArrowLeft || this.keys.a || this.keys.A) s -= 1;
        if (this.keys.ArrowRight || this.keys.d || this.keys.D) s += 1;
        if (s === 0 && this._t < this.tapUntil) s = this.tapX < 50 ? -1 : 1;
        return s;
    }

    updateDrive() {
        const p = this.player;
        const input = this.steer();
        const speedK = p.speed / TUNING.MAX_SPEED;
        const maxVx = TUNING.STEER * (0.58 + 0.42 * speedK);
        const resp = input === 0 ? TUNING.STEER_RETURN : TUNING.STEER_RESP;
        const targetVx = input * maxVx;
        p.vx += (targetVx - p.vx) * (1 - Math.exp(-resp * DT));
        p.steer = maxVx < 0.01 ? 0 : clamp(p.vx / maxVx, -1, 1);
        p.x += p.vx * DT;

        const curve = this.segAt(p.z).curve * 0.6 + this.segAt(p.z + SEG * 5).curve * 0.4;
        p.x -= curve * TUNING.CENTRIF * speedK * speedK * DT;

        const onRoad = Math.abs(p.x) < 1.28;
        if (!onRoad) p.vx *= Math.exp(-3.2 * DT);
        const limit = 1.72;
        if (p.x > limit) { p.x = limit; if (p.vx > 0) p.vx = 0; }
        if (p.x < -limit) { p.x = -limit; if (p.vx < 0) p.vx = 0; }

        const cap = onRoad ? TUNING.MAX_SPEED : TUNING.OFFROAD;
        if (p.speed < cap) p.speed = Math.min(cap, p.speed + TUNING.ACCEL * DT);
        else p.speed = Math.max(cap, p.speed - TUNING.BRAKE * DT);

        p.z = this.wrapZ(p.z + p.speed * DT);
        this.distance += p.speed * DT;

        if (!onRoad) this.emitDust(2);
        if (this.crashT > 0) this.crashT -= DT;
        if (this.shakeT > 0) this.shakeT--;
    }

    updateCars() {
        const p = this.player;
        for (let i = 0; i < this.cars.length; i++) {
            const c = this.cars[i];
            c.z = this.wrapZ(c.z + c.speed * DT);
            const dz = this.relZ(c.z);
            if (dz < -40) {
                let lane = Math.random() < 0.5 ? -1 : 1;
                let zNew = this.wrapZ(p.z + 400 + Math.random() * 120);
                for (let j = 0; j < this.cars.length; j++) {
                    if (j === i) continue;
                    const gap = Math.abs(this.relZ(this.cars[j].z) - this.relZ(zNew));
                    if (gap < 100) {
                        lane = -this.cars[j].lane;
                        if (gap < 55) zNew = this.wrapZ(zNew + 90);
                    }
                }
                c.z = zNew;
                c.lane = lane;
                c.x = lane * TUNING.CAR_LANE;
                c.speed = 50 + Math.random() * 42;
                c.ghostUntil = 0;
            }
            if (c.ghostUntil > this._t) continue;
            const dx = c.x - p.x;
            const hitX = TUNING.PLAYER_HALF + TUNING.CAR_HALF;
            if (dz > 1.2 && dz < TUNING.HIT_Z && Math.abs(dx) < hitX && this.crashT <= 0) {
                const side = dx === 0 ? (c.x >= 0 ? -1 : 1) : -Math.sign(dx);
                p.x += side * 0.18;
                p.vx = side * 1.65;
                p.speed = Math.max(c.speed + 18, p.speed - TUNING.CRASH_SLOW);
                c.ghostUntil = this._t + Math.round(0.85 * TICK);
                this.crashT = 0.22;
                this.shakeT = 10;
                this.barFlash = 22;
                this.timeDebt += Math.round(TUNING.CRASH_SECONDS * TICK);
                this.emitDust(6);
            }
        }
    }

    emitDust(n) {
        let need = n;
        for (let i = 0; i < this.dustBits.length && need > 0; i++) {
            if (this.dustBits[i].life > 0) continue;
            this.dustBits[i] = {
                x: 42 + Math.random() * 16,
                y: 88 + Math.random() * 10,
                vx: (Math.random() - 0.5) * 0.25,
                vy: -0.08 - Math.random() * 0.12,
                life: 18,
                max: 18
            };
            need--;
        }
    }

    updateDust() {
        for (let i = 0; i < this.dustBits.length; i++) {
            const d = this.dustBits[i];
            if (d.life <= 0) continue;
            d.x += d.vx;
            d.y += d.vy;
            d.life--;
        }
    }

    hillPoly(parallax, amp, base) {
        const pts = [[0, HORIZON + 3]];
        const off = this.player.z * parallax;
        for (let i = 0; i <= 28; i++) {
            const x = (i / 28) * 100;
            const h = amp * (
                0.55 + 0.35 * Math.sin((i + off) * 0.38) + 0.22 * Math.sin((i + off) * 0.91)
            );
            pts.push([x, HORIZON - base - h]);
        }
        pts.push([100, HORIZON + 3], [0, HORIZON + 3]);
        return pts;
    }

    render() {
        const rumble = Math.abs(this.player.x) > 1.28 ? Math.sin(this._t * 0.51) * 0.07 : 0;
        const hit = this.shakeT > 0 ? Math.sin(this._t * 0.9) * 0.16 * (this.shakeT / 10) : 0;
        const shakeX = rumble + hit;
        this.layoutSky();
        this.hillFar.node.coordinates2d = this.hillPoly(0.012, 7.5, 1.5);
        this.hillNear.node.coordinates2d = this.hillPoly(0.028, 11, 0.4);
        const sunX = 71 + shakeX * 0.3;
        const sunY = HORIZON - 6.2;
        this.sunHalo.node.coordinates2d = polyEllipse(sunX, sunY, 10, 10 * ASPECT, 16);
        this.sun.node.coordinates2d = polyEllipse(sunX, sunY, 5.4, 5.4 * ASPECT, 16);
        this.projectRoad(shakeX);
        this.renderSprites();
        this.renderHero();
        this.reflect.node.coordinates2d = polyEllipse(sunX, HORIZON + 11, 4.2, 2.4 * ASPECT, 14);
        this.reflect.node.color = [255, 210, 140, 75];
        this.renderDust();
        this.renderHud();
    }

    layoutSky() {
        const h = HORIZON / TUNING.SKY;
        for (let i = 0; i < this.sky.length; i++) {
            this.sky[i].node.coordinates2d = ShapeUtils.rectangle(0, i * h, 100, h + 0.15);
        }
    }

    projectRoad(shakeX) {
        const p = this.player;
        const base = Math.floor(this.wrapZ(p.z) / SEG);
        const camOff = this.wrapZ(p.z) - base * SEG;
        let x = 0;
        let dx = 0;
        const pts = this.proj;
        for (let n = 0; n <= DRAW; n++) {
            const seg = this.segs[(base + n) % this.segs.length];
            const rel = Math.max(2.8 + n * 1.05, n * SEG - camOff);
            const pr = this.project(x, seg.y, rel);
            pts[n] = pr ? { ...pr, x: pr.x + shakeX, wx: x, yWorld: seg.y } : null;
            x += dx;
            dx += seg.curve;
        }

        for (let n = DRAW - 1; n >= 0; n--) {
            const a = pts[n + 1];
            const b = pts[n];
            const gi = DRAW - 1 - n;
            if (!a || !b || a.z <= b.z) {
                this.hideNode(this.grass[gi]);
                this.hideNode(this.rumble[gi]);
                this.hideNode(this.road[gi]);
                continue;
            }
            const y1 = a.y;
            const y2 = b.y;
            if (y2 <= y1 + 0.04 || (y1 < 0 && y2 < 0) || y1 > 100) {
                this.hideNode(this.grass[gi]);
                this.hideNode(this.rumble[gi]);
                this.hideNode(this.road[gi]);
                continue;
            }
            const fog = clamp(n / DRAW, 0, 1);
            const seg = this.segs[(base + n) % this.segs.length];
            const grass = lerpColor(seg.shade ? GRASS_A : GRASS_B, SKY_HORIZ, fog * 0.55);
            const roadC = lerpColor(seg.shade ? ROAD_A : ROAD_B, SKY_HORIZ, fog * 0.4);
            const rumble = lerpColor(seg.shade ? RUMBLE_A : RUMBLE_B, SKY_HORIZ, fog * 0.35);
            const gy1 = clamp(y1, HORIZON, 102);
            const gy2 = clamp(y2, HORIZON, 102);
            if (gy2 > gy1 + 0.04) {
                this.grass[gi].node.coordinates2d = band(gy1, gy2);
                this.grass[gi].node.fill = grass;
            } else {
                this.hideNode(this.grass[gi]);
            }
            if (this.offLeft(a.x, a.w * 1.22, b.x, b.w * 1.22) || y1 < 0) {
                this.hideNode(this.rumble[gi]);
                this.hideNode(this.road[gi]);
                continue;
            }
            this.rumble[gi].node.coordinates2d = this.safeTrap(a.x, y1, a.w * 1.22, b.x, y2, b.w * 1.22);
            this.rumble[gi].node.fill = rumble;
            this.road[gi].node.coordinates2d = this.safeTrap(a.x, y1, a.w, b.x, y2, b.w);
            this.road[gi].node.fill = roadC;
        }

        for (let i = 0; i < this.lanes.length; i++) this.hideNode(this.lanes[i]);
        let li = 0;
        for (let n = DRAW - 1; n >= 1 && li < this.lanes.length; n--) {
            const seg = this.segs[(base + n) % this.segs.length];
            if (seg.shade) continue;
            const a = pts[n + 1];
            const b = pts[n];
            if (!a || !b || b.y <= a.y + 0.08 || a.w < 1.2 || a.y < 0) continue;
            this.lanes[li].node.coordinates2d = this.safeTrap(a.x, a.y, a.w * 0.028, b.x, b.y, b.w * 0.028);
            this.lanes[li].node.fill = lerpColor(LANE, SKY_HORIZ, (n / DRAW) * 0.5);
            li++;
        }
        this._pts = pts;
        this._base = base;
    }

    offLeft(x1, w1, x2, w2) {
        return x1 + w1 < 0 && x2 + w2 < 0;
    }

    safeTrap(x1, y1, w1, x2, y2, w2) {
        const clip = (x) => Math.max(0, x);
        return [
            [clip(x1 - w1), y1], [clip(x1 + w1), y1],
            [clip(x2 + w2), y2], [clip(x2 - w2), y2],
            [clip(x1 - w1), y1]
        ];
    }

    renderSprites() {
        const p = this.player;
        const base = this._base;
        const pts = this._pts;
        let used = 0;
        for (let n = DRAW - 1; n >= 2 && used < this.palms.length; n--) {
            const seg = this.segs[(base + n) % this.segs.length];
            if (!seg.palm) continue;
            const pr = pts[n];
            if (!pr || pr.z < 12 || pr.scale < 0.01) continue;
            const worldX = pr.wx + seg.palm * 1.62;
            const sp = this.project(worldX, seg.y, pr.z);
            if (!sp || sp.y < 0 || sp.y > 100) continue;
            const h = sp.scale * 140;
            const w = h * 0.11;
            if (h < 1.2) continue;
            const tx = sp.x;
            const ty = sp.y;
            const fw = h * 0.42;
            if (tx + fw < 0) continue;
            if (ty - h < 0) continue;
            this.palms[used].trunk.node.coordinates2d = clipX([
                [tx - w, ty], [tx + w, ty],
                [tx + w * 0.7, ty - h * 0.72], [tx - w * 0.7, ty - h * 0.72],
                [tx - w, ty]
            ]);
            this.palms[used].trunk.node.fill = PALM_TRUNK;
            const fy = ty - h * 0.68;
            this.palms[used].leaf.node.coordinates2d = clipX([
                [tx, fy - h * 0.38],
                [tx + fw, fy + h * 0.08],
                [tx, fy + h * 0.04],
                [tx - fw, fy + h * 0.08],
                [tx, fy - h * 0.38]
            ]);
            this.palms[used].leaf.node.fill = PALM_LEAF;
            used++;
        }
        for (let i = used; i < this.palms.length; i++) {
            this.hideNode(this.palms[i].trunk);
            this.hideNode(this.palms[i].leaf);
        }

        const order = this.cars.map((c) => ({ c, dz: this.relZ(c.z) }))
            .sort((a, b) => b.dz - a.dz);

        for (let k = 0; k < this.carNodes.length; k++) {
            const slot = this.carNodes[k];
            const item = order[k];
            if (!item || item.dz < 3.2 || item.dz > DRAW * SEG) {
                this.hideNode(slot.body);
                this.hideNode(slot.cabin);
                this.hideNode(slot.light);
                continue;
            }
            const hill = this.segAt(item.c.z).y;
            const sp = this.project(item.c.x, hill, item.dz);
            if (!sp || sp.y < HORIZON - 1 || sp.y > 102) {
                this.hideNode(slot.body);
                this.hideNode(slot.cabin);
                this.hideNode(slot.light);
                continue;
            }
            const nat = sp.scale * 38;
            const w = Math.max(nat, Math.min(1.25, sp.w * 0.42));
            const h = Math.max(w * 0.9 * ASPECT, 0.85);
            if (sp.x + w < 0 || sp.y - h < 0) {
                this.hideNode(slot.body);
                this.hideNode(slot.cabin);
                this.hideNode(slot.light);
                continue;
            }
            const x = sp.x;
            const y = sp.y;
            slot.body.node.coordinates2d = clipX([
                [x - w, y], [x + w, y],
                [x + w * 0.82, y - h * 0.55], [x - w * 0.82, y - h * 0.55],
                [x - w, y]
            ]);
            slot.body.node.fill = item.c.color;
            if (w < 1.05) {
                this.hideNode(slot.cabin);
            } else {
                slot.cabin.node.coordinates2d = clipX([
                    [x - w * 0.5, y - h * 0.42], [x + w * 0.5, y - h * 0.42],
                    [x + w * 0.36, y - h], [x - w * 0.36, y - h],
                    [x - w * 0.5, y - h * 0.42]
                ]);
                slot.cabin.node.fill = [32, 28, 40, 255];
            }
            const lw = Math.max(w * 0.22, 0.32);
            const lh = Math.max(h * 0.12, 0.28);
            const lx = Math.max(0, x - w * 0.5);
            slot.light.node.coordinates2d = ShapeUtils.rectangle(lx, y - h * 0.22, lw, lh);
            slot.light.node.fill = [255, 230, 150, 255];
        }
    }

    renderHero() {
        const lean = clamp(this.player.vx, -2.4, 2.4) * 2.15;
        const x = 50 + lean;
        const y = 97.2;
        const w = 7.4;
        const h = 9.6;
        this.heroBody.node.coordinates2d = [
            [x - w, y], [x + w, y],
            [x + w * 0.72, y - h * 0.58], [x - w * 0.72, y - h * 0.58],
            [x - w, y]
        ];
        this.heroBody.node.fill = HERO;
        this.heroCabin.node.coordinates2d = [
            [x - w * 0.48, y - h * 0.42], [x + w * 0.48, y - h * 0.42],
            [x + w * 0.32, y - h], [x - w * 0.32, y - h],
            [x - w * 0.48, y - h * 0.42]
        ];
        this.heroCabin.node.fill = [28, 24, 36, 255];
        this.heroStripe.node.coordinates2d = [
            [x - 0.55, y - 0.2], [x + 0.55, y - 0.2],
            [x + 0.4, y - h * 0.55], [x - 0.4, y - h * 0.55],
            [x - 0.55, y - 0.2]
        ];
        this.heroStripe.node.fill = HERO_STRIPE;
        this.heroLightL.node.coordinates2d = ShapeUtils.rectangle(x - w * 0.62, y - h * 0.22, 1.5, 0.7);
        this.heroLightR.node.coordinates2d = ShapeUtils.rectangle(x + w * 0.42, y - h * 0.22, 1.5, 0.7);
        this.heroLightL.node.fill = [255, 230, 160, 255];
        this.heroLightR.node.fill = [255, 230, 160, 255];
    }

    renderDust() {
        for (let i = 0; i < this.dust.length; i++) {
            const d = this.dustBits[i];
            const node = this.dust[i];
            if (!d || d.life <= 0) {
                this.hideNode(node);
                continue;
            }
            const k = d.life / d.max;
            const s = 0.7 * k;
            node.node.coordinates2d = ShapeUtils.rectangle(d.x, d.y, s, s * ASPECT);
            node.node.fill = [180, 140, 110, 255];
            node.node.color = [255, 255, 255, Math.round(180 * k)];
        }
    }

    renderHud() {
        const t = this.phase === 'over' ? 0 : clamp(1 - this.timeElapsed() / ROUND_TICKS, 0, 1);
        this.timeBar.node.coordinates2d = ShapeUtils.rectangle(8, 2.4, Math.max(0, 84 * t), 1.2);
        this.timeBar.node.fill = this.barFlash > 0 ? CREAM : BAR_FILL;
        if (this.barFlash > 0) this.barFlash--;
        if (this.phase === 'over') this.setText(this.distText, '');
        else this.setText(this.distText, this.kmLabel(), CREAM);
    }
}

module.exports = Sundown;
