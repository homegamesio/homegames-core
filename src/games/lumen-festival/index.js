const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');

const TICK_RATE = 60; // MUST match metadata().tickRate literal.
const DT = 1 / TICK_RATE;

const MAX_LANTERNS = 36;
const MAX_PARTICLES = 1100;
const MAX_EXPLOSIONS = 72;
const MAX_TRAILS = 320;
const MAX_COMETS = 120;
const MAX_CHARGES = 6;

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const PALETTES = [
    {
        skyTop: [11, 10, 49, 255], skyMid: [52, 27, 98, 255], skyLow: [232, 78, 124, 255],
        moon: [255, 236, 196, 255], mountainA: [42, 24, 62, 255], mountainB: [28, 16, 46, 255],
        waterA: [22, 25, 81, 255], waterB: [46, 28, 90, 255], city: [16, 11, 30, 255],
        aurora: [[116,235,255,255], [178,115,255,255], [255,118,197,255]],
        lanterns: [[255,198,76,255],[255,119,140,255],[110,232,247,255],[182,131,255,255],[124,255,189,255],[255,162,90,255]],
        fireworks: [[255,216,82,255],[255,93,153,255],[100,233,255,255],[188,120,255,255],[255,140,74,255],[108,255,201,255]]
    },
    {
        skyTop: [3, 27, 56, 255], skyMid: [4, 76, 118, 255], skyLow: [44, 177, 154, 255],
        moon: [220, 255, 233, 255], mountainA: [16, 57, 70, 255], mountainB: [8, 34, 48, 255],
        waterA: [6, 51, 82, 255], waterB: [10, 34, 64, 255], city: [7, 22, 34, 255],
        aurora: [[87,244,179,255], [107,206,255,255], [240,118,255,255]],
        lanterns: [[255,225,107,255],[255,138,79,255],[95,244,191,255],[111,193,255,255],[244,133,255,255],[255,197,116,255]],
        fireworks: [[255,234,112,255],[255,126,80,255],[84,245,197,255],[102,199,255,255],[240,120,255,255],[143,255,118,255]]
    },
    {
        skyTop: [20, 5, 44, 255], skyMid: [79, 18, 90, 255], skyLow: [244, 81, 92, 255],
        moon: [255, 226, 192, 255], mountainA: [68, 22, 71, 255], mountainB: [36, 10, 48, 255],
        waterA: [51, 14, 72, 255], waterB: [28, 9, 48, 255], city: [20, 7, 30, 255],
        aurora: [[255,125,171,255], [118,232,255,255], [255,208,90,255]],
        lanterns: [[255,183,64,255],[255,85,146,255],[130,231,255,255],[208,122,255,255],[255,221,89,255],[124,255,198,255]],
        fireworks: [[255,213,73,255],[255,91,152,255],[117,232,255,255],[211,131,255,255],[255,122,83,255],[134,255,182,255]]
    }
];

const makeShape = (coords, fill, extra = {}) => new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d: coords,
    fill,
    ...extra
});

const polyCircle = (cx, cy, r, sides = 14) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = i / sides * TAU;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

const star = (cx, cy, outer, inner, points = 5, rotation = -Math.PI / 2) => {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
        const a = rotation + i / (points * 2) * TAU;
        const r = i % 2 === 0 ? outer : inner;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    pts.push(pts[0]);
    return pts;
};

const diamond = (cx, cy, rx, ry) => [
    [cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry]
];

const rocketIcon = (cx, cy, s) => [
    [cx, cy - 1.45 * s],
    [cx + 0.52 * s, cy - 0.62 * s],
    [cx + 0.52 * s, cy + 0.52 * s],
    [cx + 0.92 * s, cy + 1.18 * s],
    [cx + 0.26 * s, cy + 0.82 * s],
    [cx, cy + 1.48 * s],
    [cx - 0.26 * s, cy + 0.82 * s],
    [cx - 0.92 * s, cy + 1.18 * s],
    [cx - 0.52 * s, cy + 0.52 * s],
    [cx - 0.52 * s, cy - 0.62 * s],
    [cx, cy - 1.45 * s]
];

const burstIcon = (cx, cy, s) => [
    [cx, cy - 1.42 * s],
    [cx + 0.34 * s, cy - 0.34 * s],
    [cx + 1.42 * s, cy],
    [cx + 0.34 * s, cy + 0.34 * s],
    [cx, cy + 1.42 * s],
    [cx - 0.34 * s, cy + 0.34 * s],
    [cx - 1.42 * s, cy],
    [cx - 0.34 * s, cy - 0.34 * s],
    [cx, cy - 1.42 * s]
];

const thickLine = (x1, y1, x2, y2, width) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(a) * width / 2;
    const dy = Math.cos(a) * width / 2;
    return [[x1-dx,y1+dy],[x2-dx,y2+dy],[x2+dx,y2-dy],[x1+dx,y1-dy],[x1-dx,y1+dy]];
};

const hide = (node) => {
    node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
    node.node.fill = [0, 0, 0, 0];
    node.node.color = [0, 0, 0, 0];
};

class LumenFestivalBonkers extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Lumen Festival: Bonkers',
            author: "Joseph Garcia",
            description: 'An over-the-top polygon fireworks festival with chain reactions, comets, aurora, fountains, and huge lantern waves.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 60,
            maxPlayers: 1,
            gameId: "f08b1c3d-0eb0-5b2d-a111-31c606b51f78"
        };
    }

    constructor() {
        super();
        this.time = 0;
        this.paletteIndex = 0;
        this.wave = 0;
        this.charges = MAX_CHARGES;
        this.chargeProgress = 0;
        this.combo = 0;
        this.waveDelay = 0;
        this.autoLaunchTimer = 0.4;
        this.finaleTriggered = false;
        this.keys = {};

        this.base = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), PALETTES[0].skyMid);
        this.stars = [];
        this.reflections = [];
        this.auroras = [];
        this.caustics = [];
        this.lanterns = [];
        this.particles = [];
        this.explosions = [];
        this.trails = [];
        this.comets = [];

        this.buildBackdrop();
        this.buildLaunchPads();
        this.buildTrails();
        this.buildComets();
        this.buildLanterns();
        this.buildParticles();
        this.buildExplosions();
        this.buildClickLayer();
        this.buildHud();
        this.startWave(true);
    }

    getLayers() { return [{ root: this.base }]; }

    handleKeyDown(playerId, key) {
        const k = String(key || '').toLowerCase();
        if (this.keys[k]) return;
        this.keys[k] = true;
        if (k === ' ' || k === 'f' || k === 'enter') this.manualBurst(50, 44);
        if (k === 'c') this.cyclePalette();
        if (k === 'x') this.superVolley();
    }

    handleKeyUp(playerId, key) {
        delete this.keys[String(key || '').toLowerCase()];
    }

    buildBackdrop() {
        this.skyBands = [];
        [[0,0,100,17],[0,17,100,17],[0,34,100,17],[0,51,100,17],[0,68,100,14]].forEach((r) => {
            const n = makeShape(ShapeUtils.rectangle(...r), PALETTES[0].skyMid);
            this.skyBands.push(n);
            this.base.addChild(n);
        });

        this.auroraLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), [0,0,0,0]);
        this.base.addChild(this.auroraLayer);
        for (let i = 0; i < 7; i++) {
            const n = makeShape(ShapeUtils.rectangle(0,0,0,0), PALETTES[0].aurora[i % 3]);
            this.auroras.push({
                node: n,
                baseY: 14 + i * 5.2,
                amp: 0.8 + (i % 3) * 0.45,
                phase: i * 0.72,
                width: 18 + (i % 4) * 8,
                thickness: 1.6 + (i % 3) * 0.45,
                left: 6 + (i % 2) * 3 + i * 2.8,
                right: 64 + (i % 3) * 9 + i * 2.0
            });
            this.auroraLayer.addChild(n);
        }

        this.moonOuter = makeShape(polyCircle(84, 14, 7.0, 24), PALETTES[0].moon);
        this.moonCut = makeShape(polyCircle(87, 12.6, 6.7, 24), PALETTES[0].skyTop);
        this.base.addChild(this.moonOuter);
        this.base.addChild(this.moonCut);

        this.starLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), [0,0,0,0]);
        this.base.addChild(this.starLayer);
        for (let i = 0; i < 110; i++) {
            const x = rand(1, 99), y = rand(2, 60), r = rand(0.06, 0.32);
            const n = makeShape(i % 8 === 0 ? star(x, y, r * 2.6, r * 0.75, 4) : polyCircle(x, y, r, 5), [245,241,218,255]);
            this.stars.push({ node: n, phase: rand(0, TAU), baseR: r, x, y, special: i % 8 === 0 });
            this.starLayer.addChild(n);
        }

        this.mountainFar = makeShape([[0,78],[9,58],[18,70],[31,44],[43,66],[54,51],[66,72],[75,48],[87,68],[100,43],[100,100],[0,100],[0,78]], PALETTES[0].mountainA);
        this.mountainNear = makeShape([[0,84],[11,69],[20,79],[30,63],[42,80],[53,68],[65,82],[75,66],[86,79],[100,71],[100,100],[0,100],[0,84]], PALETTES[0].mountainB);
        this.base.addChild(this.mountainFar);
        this.base.addChild(this.mountainNear);

        this.cityLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), [0,0,0,0]);
        this.base.addChild(this.cityLayer);
        this.buildCity();

        this.water = makeShape(ShapeUtils.rectangle(0,81,100,19), PALETTES[0].waterA);
        this.base.addChild(this.water);
        this.waterStripes = [];
        for (let i = 0; i < 20; i++) {
            const n = makeShape(ShapeUtils.rectangle(0,0,0,0), PALETTES[0].waterB);
            this.waterStripes.push({ node: n, y: 82.6 + i * 0.8, phase: i * 0.56, width: 7 + (i % 6) * 3.5 });
            this.base.addChild(n);
        }

        this.reflectionLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), [0,0,0,0]);
        this.base.addChild(this.reflectionLayer);
        for (let i = 0; i < 70; i++) {
            const n = makeShape(ShapeUtils.rectangle(0,0,0,0), [255,200,100,255]);
            this.reflections.push({ node: n, x: rand(4, 96), y: rand(82.5, 99), w: rand(0.7, 4.8), phase: rand(0, TAU), colorIndex: i % 6 });
            this.reflectionLayer.addChild(n);
        }
    }

    buildCity() {
        const silhouetteXs = [];
        let x = 0;
        while (x < 100) {
            const w = rand(2.2, 5.4);
            const h = rand(5.5, 21);
            silhouetteXs.push({ x, w, h });
            x += w - rand(0.1, 0.35);
        }
        silhouetteXs.forEach((b, i) => {
            const building = makeShape(ShapeUtils.rectangle(b.x, 81 - b.h, b.w, b.h), PALETTES[0].city);
            this.cityLayer.addChild(building);
            if (i % 4 === 0) {
                const spire = makeShape([[b.x+b.w*0.5,81-b.h-4.8],[b.x+b.w*0.72,81-b.h],[b.x+b.w*0.28,81-b.h],[b.x+b.w*0.5,81-b.h-4.8]], PALETTES[0].city);
                this.cityLayer.addChild(spire);
            }
            const cols = Math.max(1, Math.floor(b.w / 1.25));
            const rows = Math.max(1, Math.floor(b.h / 3.0));
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (Math.random() < 0.35) continue;
                    const win = makeShape(ShapeUtils.rectangle(b.x + 0.35 + c * 1.05, 81 - b.h + 0.65 + r * 2.55, 0.42, 0.72), [255,198,92,255]);
                    this.cityLayer.addChild(win);
                }
            }
        });
    }


    buildLaunchPads() {
        this.launchPadLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), [0,0,0,0]);
        this.base.addChild(this.launchPadLayer);
        this.launchPads = [];
        [12, 26, 40, 58, 74, 88].forEach((x, idx) => {
            const base = makeShape(ShapeUtils.rectangle(x - 0.7, 78.8, 1.4, 2.3), [30, 22, 40, 255]);
            const head = makeShape([[x - 1.0, 78.8], [x + 1.0, 78.8], [x + 0.55, 77.8], [x - 0.55, 77.8], [x - 1.0, 78.8]], [58, 45, 72, 255]);
            const glow = makeShape(ShapeUtils.rectangle(0,0,0,0), [255,180,100,80]);
            this.launchPads.push({ x, base, head, glow, phase: idx * 0.6 });
            this.launchPadLayer.addChild(base);
            this.launchPadLayer.addChild(head);
            this.launchPadLayer.addChild(glow);
        });
    }

    buildTrails() {
        this.trailLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), [0,0,0,0]);
        this.base.addChild(this.trailLayer);
        for (let i = 0; i < MAX_TRAILS; i++) {
            const n = makeShape(ShapeUtils.rectangle(0,0,0,0), [255,255,255,255]);
            this.trails.push({ node: n, active: false, x1:0, y1:0, x2:0, y2:0, ttl:0, max:0, color:[255,255,255,255], width:0.2 });
            this.trailLayer.addChild(n);
        }
    }

    buildComets() {
        this.cometLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), [0,0,0,0]);
        this.base.addChild(this.cometLayer);
        for (let i = 0; i < MAX_COMETS; i++) {
            const n = makeShape(ShapeUtils.rectangle(0,0,0,0), [255,255,255,255], { color: [255,255,255,180] });
            this.comets.push({ node: n, active: false, x:0, y:0, vx:0, vy:0, ttl:0, color:[255,255,255,255], pattern:'ring', power:1, burstCount:0 });
            this.cometLayer.addChild(n);
        }
    }

    buildLanterns() {
        this.lanternLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), [0,0,0,0]);
        this.base.addChild(this.lanternLayer);
        for (let i = 0; i < MAX_LANTERNS; i++) {
            const parts = [];
            for (let j = 0; j < 6; j++) {
                const n = makeShape(ShapeUtils.rectangle(0,0,0,0), [255,255,255,255]);
                if (j === 0 || j === 4) n.node.onClick = () => this.clickLantern(i);
                parts.push(n);
                this.lanternLayer.addChild(n);
            }
            this.lanterns.push({ active:false, lit:false, x:0, y:0, vx:0, vy:0, phase:0, size:1, color:[255,180,80,255], pattern:'ring', parts });
        }
    }

    buildParticles() {
        this.particleLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), [0,0,0,0]);
        this.base.addChild(this.particleLayer);
        for (let i = 0; i < MAX_PARTICLES; i++) {
            const n = makeShape(ShapeUtils.rectangle(0,0,0,0), [255,255,255,255], { color: [255,255,255,0] });
            this.particles.push({ node: n, active:false, x:0, y:0, vx:0, vy:0, ttl:0, max:0, size:0, color:[255,255,255,255], spin:0, shape:0, burst:false });
            this.particleLayer.addChild(n);
        }
    }

    buildExplosions() {
        this.explosionLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), [0,0,0,0]);
        this.base.addChild(this.explosionLayer);
        for (let i = 0; i < MAX_EXPLOSIONS; i++) {
            const n = makeShape(ShapeUtils.rectangle(0,0,0,0), [255,255,255,255], { color: [255,255,255,0] });
            this.explosions.push({ node: n, active:false, x:0, y:0, r:0, speed:0, ttl:0, max:0, color:[255,255,255,255] });
            this.explosionLayer.addChild(n);
        }
    }

    buildClickLayer() {
        this.clickSurface = makeShape(ShapeUtils.rectangle(0, 0, 100, 81), [0,0,0,0], {
            onClick: (playerId, x, y) => this.manualBurst(x, y)
        });
        this.base.addChild(this.clickSurface);
    }

    buildHud() {
        this.hudLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), [0,0,0,0]);
        this.base.addChild(this.hudLayer);
        this.chargeIcons = [];
        for (let i = 0; i < MAX_CHARGES; i++) {
            const x = 4.8 + i * 3.4;
            const n = makeShape(rocketIcon(x, 6, 0.92), [255,218,88,255]);
            this.chargeIcons.push(n);
            this.hudLayer.addChild(n);
        }
        this.paletteButton = makeShape(polyCircle(94.2, 7.1, 3.2, 16), [32,43,86,255], {
            color: [242,239,220,255], border: 4, onClick: () => this.cyclePalette()
        });
        this.paletteMoon = makeShape(polyCircle(93.7, 6.6, 1.45, 14), [245,235,200,255]);
        this.paletteCut = makeShape(polyCircle(94.35, 6.2, 1.35, 14), [32,43,86,255]);
        this.superButton = makeShape(polyCircle(84.8, 7.1, 3.2, 16), [32,43,86,255], {
            color: [242,239,220,255], border: 4, onClick: () => this.superVolley()
        });
        this.superStar = makeShape(burstIcon(84.8, 7.1, 1.0), [255,170,110,255]);
        this.hudLayer.addChild(this.superButton);
        this.hudLayer.addChild(this.superStar);
        this.guideRing = makeShape(ShapeUtils.rectangle(0,0,0,0), [255,255,255,0], { color: [255,238,190,180], border: 4 });
        this.base.addChild(this.guideRing);
        this.hudLayer.addChild(this.paletteButton);
        this.hudLayer.addChild(this.paletteMoon);
        this.hudLayer.addChild(this.paletteCut);
    }

    renderCharges() {
        this.chargeIcons.forEach((n, i) => {
            n.node.fill = i < this.charges ? [255,218,88,255] : [80,73,104,255];
        });
    }

    currentPalette() { return PALETTES[this.paletteIndex]; }

    startWave(initial) {
        this.wave++;
        this.combo = 0;
        this.charges = clamp(this.charges + (initial ? 0 : 2), 0, MAX_CHARGES);
        this.chargeProgress = 0;
        this.waveDelay = 0;
        this.autoLaunchTimer = this.wave === 1 ? 1.2 : 0.22;
        this.finaleTriggered = false;
        const p = this.currentPalette();
        const patterns = ['ring','flower','spiral','star','cascade','crown','galaxy','palm'];
        const activeCount = Math.min(MAX_LANTERNS, 10 + Math.floor(this.wave * 2.2));
        for (let i = 0; i < this.lanterns.length; i++) {
            const l = this.lanterns[i];
            l.active = i < activeCount;
            l.lit = false;
            l.x = rand(6, 94);
            l.y = rand(16, 70);
            l.vx = rand(-1.8, 1.8);
            l.vy = rand(-2.6, -0.5);
            l.phase = rand(0, TAU);
            l.size = rand(0.72, 1.28);
            l.color = p.lanterns[i % p.lanterns.length];
            l.pattern = patterns[(i + this.wave) % patterns.length];
            if (!l.active) l.parts.forEach(hide);
        }
        this.renderCharges();
        this.base.node.onStateChange();
    }

    cyclePalette() {
        this.paletteIndex = (this.paletteIndex + 1) % PALETTES.length;
        this.applyPalette();
    }

    applyPalette() {
        const p = this.currentPalette();
        [p.skyTop, p.skyMid, p.skyMid, p.skyLow, p.skyLow].forEach((c, i) => { this.skyBands[i].node.fill = c; });
        this.base.node.fill = p.skyMid;
        this.moonOuter.node.fill = p.moon;
        this.moonCut.node.fill = p.skyTop;
        this.mountainFar.node.fill = p.mountainA;
        this.mountainNear.node.fill = p.mountainB;
        this.water.node.fill = p.waterA;
        this.waterStripes.forEach((s) => { s.node.node.fill = p.waterB; });
        this.auroras.forEach((a, i) => { a.node.node.fill = p.aurora[i % p.aurora.length]; });
        this.paletteButton.node.fill = p.mountainB;
        this.paletteCut.node.fill = p.mountainB;
        this.superButton.node.fill = p.mountainB;
        this.lanterns.forEach((l, i) => { l.color = p.lanterns[i % p.lanterns.length]; });
        this.base.node.onStateChange();
    }


    clickLantern(index) {
        const l = this.lanterns[index];
        if (!l || !l.active || l.lit) return;
        this.manualBurst(l.x, l.y);
    }

    manualBurst(x, y) {
        if (this.charges <= 0) return;
        this.charges--;
        this.combo = 0;
        const p = this.currentPalette();
        const color = pick(p.fireworks);
        this.spawnExplosion(x, y, color, 1.2);
        this.emitPattern('flower', x, y, color, 28, 1.0);
        this.emitPattern('star', x, y, pick(p.fireworks), 18, 0.9);
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * TAU;
            this.spawnComet(x, y, Math.cos(a) * rand(8, 14), Math.sin(a) * rand(8, 14), pick(p.fireworks), pick(['ring', 'cascade', 'spiral']), 0.72, 12);
        }
        this.renderCharges();
        this.base.node.onStateChange();
    }

    superVolley() {
        if (this.charges < 2) return;
        this.charges -= 2;
        const p = this.currentPalette();
        for (let i = 0; i < 6; i++) {
            const sx = 14 + i * 14 + rand(-2, 2);
            const ex = 18 + i * 12 + rand(-3, 3);
            const ey = rand(14, 40);
            const color = p.fireworks[i % p.fireworks.length];
            this.spawnComet(sx, 80.6, (ex - sx) * 0.95, -rand(22, 29), color, pick(['galaxy', 'palm', 'crown', 'star']), 1.4, 28);
        }
        this.renderCharges();
        this.base.node.onStateChange();
    }

    spawnExplosion(x, y, color, power) {
        for (const e of this.explosions) {
            if (e.active) continue;
            e.active = true;
            e.x = x; e.y = y; e.r = 0.4; e.speed = 24 * power; e.ttl = 0.78; e.max = 0.78; e.color = color;
            e.node.node.fill = color;
            e.node.node.color = [255,255,255,200];
            return;
        }
    }

    igniteLantern(l) {
        if (!l.active || l.lit) return;
        l.lit = true;
        this.combo++;
        this.chargeProgress++;
        if (this.chargeProgress >= 4) {
            this.chargeProgress -= 4;
            this.charges = Math.min(MAX_CHARGES, this.charges + 1);
            this.renderCharges();
        }
        const p = this.currentPalette();
        const power = 0.85 + Math.min(1.6, this.combo * 0.035);
        this.spawnExplosion(l.x, l.y, l.color, power);
        this.emitPattern(l.pattern, l.x, l.y, l.color, 24 + Math.min(40, this.combo), power);
        // Second accent burst.
        this.emitPattern(pick(['ring', 'spiral', 'crown']), l.x, l.y, pick(p.fireworks), 12 + Math.min(22, Math.floor(this.combo * 0.6)), power * 0.9);
        for (let i = 0; i < 6; i++) this.spawnTrail(l.x, l.y, l.x + rand(-5,5), l.y + rand(-5,5), l.color, 0.5, 0.24);
    }

    emitPattern(pattern, x, y, color, count, power) {
        const p = this.currentPalette();
        if (pattern === 'ring') {
            for (let i = 0; i < count; i++) {
                const a = i / count * TAU;
                this.spawnParticle(x, y, Math.cos(a) * rand(10, 17) * power, Math.sin(a) * rand(10, 17) * power, color, rand(0.8, 1.3), rand(0.14, 0.32), i % 3);
            }
        } else if (pattern === 'flower') {
            const petals = 7;
            for (let i = 0; i < count; i++) {
                const petal = i % petals;
                const a = petal / petals * TAU + rand(-0.1, 0.1);
                const speed = rand(8, 15) * power * (0.75 + 0.3 * Math.sin(i));
                this.spawnParticle(x, y, Math.cos(a) * speed, Math.sin(a) * speed, color, rand(0.9, 1.35), rand(0.17, 0.38), 1, i % 7 === 0);
            }
        } else if (pattern === 'spiral') {
            for (let i = 0; i < count; i++) {
                const a = i * 0.53;
                const speed = (6 + i * 0.25) * power;
                this.spawnParticle(x, y, Math.cos(a) * speed, Math.sin(a) * speed, color, rand(0.9, 1.4), rand(0.15, 0.32), i % 4 === 0 ? 2 : 0);
            }
        } else if (pattern === 'star') {
            for (let i = 0; i < count; i++) {
                const arm = i % 5;
                const a = arm / 5 * TAU - Math.PI / 2 + rand(-0.08, 0.08);
                const speed = rand(9, 17) * power;
                this.spawnParticle(x, y, Math.cos(a) * speed, Math.sin(a) * speed, color, rand(0.9, 1.3), rand(0.16, 0.34), 2, i % 6 === 0);
            }
        } else if (pattern === 'cascade') {
            for (let i = 0; i < count; i++) {
                const a = rand(Math.PI * 0.15, Math.PI * 0.85);
                const speed = rand(10, 17) * power;
                this.spawnParticle(x, y, Math.cos(a) * speed, Math.sin(a) * speed, color, rand(1.0, 1.6), rand(0.14, 0.28), i % 2, i % 8 === 0);
            }
        } else if (pattern === 'crown') {
            for (let i = 0; i < count; i++) {
                const t = i / Math.max(1, count - 1);
                const a = -Math.PI + t * Math.PI;
                const speed = rand(9, 16) * power;
                this.spawnParticle(x, y, Math.cos(a) * speed, -Math.abs(Math.sin(a)) * speed * 0.92, color, rand(0.9, 1.35), rand(0.16, 0.34), t > 0.35 && t < 0.65 ? 2 : 1, i % 7 === 0);
            }
        } else if (pattern === 'galaxy') {
            for (let i = 0; i < count; i++) {
                const a = i / count * TAU;
                const color2 = p.fireworks[i % p.fireworks.length];
                this.spawnParticle(x, y, Math.cos(a) * rand(3, 6) * power, Math.sin(a) * rand(3, 6) * power, color2, rand(1.1, 1.8), rand(0.15, 0.32), i % 3);
                if (i % 4 === 0) this.spawnComet(x, y, Math.cos(a) * rand(5, 9) * power, Math.sin(a) * rand(5, 9) * power, color2, pick(['ring', 'star']), 0.65, 10);
            }
        } else if (pattern === 'palm') {
            for (let i = 0; i < count; i++) {
                const side = i % 2 === 0 ? -1 : 1;
                const spread = rand(0.15, 0.95) * side;
                const speed = rand(10, 18) * power;
                this.spawnParticle(x, y, spread * speed, -speed * rand(0.7, 1.15), color, rand(1.1, 1.8), rand(0.15, 0.28), 1, i % 8 === 0);
            }
        }
    }

    spawnParticle(x, y, vx, vy, color, life, size, shapeType, burst) {
        for (const p of this.particles) {
            if (p.active) continue;
            p.active = true;
            p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.ttl = life; p.max = life; p.size = size; p.color = color; p.spin = rand(0, TAU); p.shape = shapeType; p.burst = !!burst;
            p.node.node.fill = color;
            p.node.node.color = [255,255,255,180];
            return;
        }
    }

    spawnTrail(x1, y1, x2, y2, color, life, width) {
        for (const t of this.trails) {
            if (t.active) continue;
            t.active = true; t.x1 = x1; t.y1 = y1; t.x2 = x2; t.y2 = y2; t.ttl = life; t.max = life; t.color = color; t.width = width || 0.18;
            t.node.node.fill = color;
            return;
        }
    }

    spawnComet(x, y, vx, vy, color, pattern, power, burstCount) {
        for (const c of this.comets) {
            if (c.active) continue;
            c.active = true;
            c.x = x; c.y = y; c.vx = vx; c.vy = vy; c.ttl = rand(0.48, 0.88); c.color = color; c.pattern = pattern; c.power = power; c.burstCount = burstCount || 16;
            c.node.node.fill = color;
            c.node.node.color = [255,255,255,160];
            return;
        }
    }

    tick() {
        this.time += DT;
        this.autoLaunchTimer -= DT;
        this.updateBackdrop();
        this.updateGuideRing();
        this.updateLanterns();
        this.updateExplosions();
        this.updateComets();
        this.updateParticles();
        this.updateTrails();
        this.updateAutoLaunchers();
        this.checkWave();
        this.base.node.onStateChange();
    }

    updateBackdrop() {
        const p = this.currentPalette();
        this.auroras.forEach((a, idx) => {
            const ptsTop = [];
            const ptsBottom = [];
            const left = a.left + Math.sin(this.time * 0.18 + idx) * 1.5;
            const right = a.right + Math.cos(this.time * 0.16 + idx * 0.4) * 1.5;
            const span = Math.max(10, right - left);
            const segments = 16;
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const taper = Math.sin(t * Math.PI);
                const x = left + span * t;
                const centerY = a.baseY
                    + Math.sin(this.time * 0.55 + a.phase + t * 3.6) * a.amp
                    + Math.cos(this.time * 0.28 + idx * 0.7 + t * 5.2) * 0.45;
                const thick = a.thickness * (0.2 + 0.8 * taper);
                ptsTop.push([x, centerY - thick * 0.5]);
                ptsBottom.push([x, centerY + thick * 0.5]);
            }
            const poly = ptsTop.concat(ptsBottom.reverse());
            poly.push(poly[0]);
            a.node.node.coordinates2d = poly;
            const c = p.aurora[idx % p.aurora.length];
            a.node.node.fill = [c[0], c[1], c[2], 140];
        });

        this.stars.forEach((s, i) => {
            const twinkle = 0.56 + 0.44 * Math.sin(this.time * (1.2 + (i % 5) * 0.15) + s.phase);
            const r = s.baseR * twinkle;
            s.node.node.coordinates2d = s.special ? star(s.x, s.y, r * 2.5, r * 0.7, 4) : polyCircle(s.x, s.y, r, 5);
        });

        this.waterStripes.forEach((s, i) => {
            const x = (i * 6 + this.time * (3 + i % 4)) % 118 - 9;
            const wobble = Math.sin(this.time * 1.8 + s.phase) * 1.9;
            s.node.node.coordinates2d = ShapeUtils.rectangle(x + wobble, s.y, s.width, 0.22);
        });

        this.reflections.forEach((r, i) => {
            const w = r.w * (0.6 + 0.5 * Math.sin(this.time * 2.3 + r.phase));
            const x = r.x + Math.sin(this.time * 1.1 + r.phase) * 1.2;
            r.node.node.fill = p.fireworks[r.colorIndex % p.fireworks.length];
            r.node.node.coordinates2d = ShapeUtils.rectangle(x - w / 2, r.y, w, 0.16);
        });

        this.launchPads.forEach((pad, idx) => {
            const pulse = Math.max(0, 0.5 + 0.5 * Math.sin(this.time * 4 + pad.phase));
            pad.base.node.fill = p.mountainB;
            pad.head.node.fill = p.mountainA;
            pad.glow.node.fill = [p.fireworks[idx % p.fireworks.length][0], p.fireworks[idx % p.fireworks.length][1], p.fireworks[idx % p.fireworks.length][2], 90];
            pad.glow.node.coordinates2d = ShapeUtils.rectangle(pad.x - 0.35 - pulse * 0.15, 77.6 - pulse * 0.2, 0.7 + pulse * 0.3, 0.45 + pulse * 0.25);
        });
    }


    updateGuideRing() {
        if (this.wave > 2 || this.charges <= 0) {
            return hide(this.guideRing);
        }
        const target = this.lanterns.find((l) => l.active && !l.lit);
        if (!target) return hide(this.guideRing);
        const pulse = 1 + Math.sin(this.time * 3.2) * 0.12;
        this.guideRing.node.coordinates2d = polyCircle(target.x, target.y - 0.2, 2.35 * pulse, 18);
        this.guideRing.node.fill = [255,255,255,0];
        this.guideRing.node.color = [255,241,190,180];
    }

    updateLanterns() {
        this.lanterns.forEach((l) => {
            if (!l.active) return l.parts.forEach(hide);
            if (!l.lit) {
                l.x += l.vx * DT;
                l.y += l.vy * DT;
                l.x += Math.sin(this.time * 0.9 + l.phase) * 0.014;
                if (l.x < 4 || l.x > 96) l.vx *= -1;
                if (l.y < 10) { l.y = 76 + rand(0, 4); l.x = rand(6, 94); }
            }
            const pulse = 1 + Math.sin(this.time * 2 + l.phase) * 0.08;
            const s = l.size * pulse;
            const body = [[l.x-1.3*s,l.y-1.95*s],[l.x+1.3*s,l.y-1.95*s],[l.x+1.05*s,l.y+1.65*s],[l.x-1.05*s,l.y+1.65*s],[l.x-1.3*s,l.y-1.95*s]];
            const top = ShapeUtils.rectangle(l.x - 0.76 * s, l.y - 2.33 * s, 1.52 * s, 0.35 * s);
            const bottom = ShapeUtils.rectangle(l.x - 0.68 * s, l.y + 1.68 * s, 1.36 * s, 0.26 * s);
            const glow = polyCircle(l.x, l.y - 0.1 * s, 1.35 * s, 10);
            const flame = diamond(l.x, l.y + 0.92 * s, 0.26 * s, 0.44 * s);
            const tassel = thickLine(l.x, l.y + 1.86 * s, l.x + Math.sin(this.time * 2 + l.phase) * 0.32, l.y + 2.95 * s, 0.12 * s);
            l.parts[0].node.fill = l.lit ? [63,57,69,255] : l.color; l.parts[0].node.coordinates2d = body;
            l.parts[1].node.fill = [57,39,49,255]; l.parts[1].node.coordinates2d = top;
            l.parts[2].node.fill = [57,39,49,255]; l.parts[2].node.coordinates2d = bottom;
            l.parts[3].node.fill = l.lit ? [0,0,0,0] : [255,236,150,255]; l.parts[3].node.coordinates2d = l.lit ? ShapeUtils.rectangle(0,0,0,0) : flame;
            l.parts[4].node.fill = l.lit ? [0,0,0,0] : [255,255,200,70]; l.parts[4].node.coordinates2d = l.lit ? ShapeUtils.rectangle(0,0,0,0) : glow;
            l.parts[5].node.fill = [63,44,54,255]; l.parts[5].node.coordinates2d = tassel;
        });
    }

    updateExplosions() {
        this.explosions.forEach((e) => {
            if (!e.active) return hide(e.node);
            e.ttl -= DT;
            e.r += e.speed * DT;
            if (e.ttl <= 0) { e.active = false; return hide(e.node); }
            const k = e.ttl / e.max;
            e.node.node.coordinates2d = polyCircle(e.x, e.y, e.r, 28);
            e.node.node.fill = e.color;
            e.node.node.color = [255,255,255,Math.round(180 * k)];
            for (const l of this.lanterns) {
                if (!l.active || l.lit) continue;
                const d = Math.hypot(l.x - e.x, l.y - e.y);
                if (d <= e.r + l.size * 1.5) this.igniteLantern(l);
            }
        });
    }

    updateComets() {
        this.comets.forEach((c) => {
            if (!c.active) return hide(c.node);
            const oldX = c.x, oldY = c.y;
            c.ttl -= DT;
            c.vy += 5.2 * DT;
            c.x += c.vx * DT;
            c.y += c.vy * DT;
            if (Math.random() < 0.9) this.spawnTrail(oldX, oldY, c.x, c.y, c.color, 0.25, 0.18);
            c.node.node.coordinates2d = diamond(c.x, c.y, 0.4 + c.power * 0.18, 0.8 + c.power * 0.26);
            c.node.node.fill = c.color;
            if (c.ttl <= 0 || c.y > 86 || c.y < 8) {
                this.spawnExplosion(c.x, c.y, c.color, c.power);
                this.emitPattern(c.pattern, c.x, c.y, c.color, c.burstCount, c.power);
                c.active = false;
                hide(c.node);
            }
        });
    }

    updateParticles() {
        this.particles.forEach((p) => {
            if (!p.active) return hide(p.node);
            p.ttl -= DT;
            if (p.ttl <= 0 || p.y > 90) {
                if (p.burst) {
                    p.burst = false;
                    this.spawnExplosion(p.x, p.y, p.color, 0.55);
                    this.emitPattern('ring', p.x, p.y, p.color, 8, 0.45);
                }
                p.active = false;
                return hide(p.node);
            }
            const oldX = p.x, oldY = p.y;
            p.vy += 5.0 * DT;
            p.x += p.vx * DT;
            p.y += p.vy * DT;
            p.vx *= 0.993;
            p.vy *= 0.996;
            const k = p.ttl / p.max;
            const size = p.size * (0.54 + 0.46 * k);
            p.spin += DT * 3.2;
            if (p.shape === 2) p.node.node.coordinates2d = star(p.x, p.y, size * 1.8, size * 0.66, 5, p.spin);
            else if (p.shape === 1) p.node.node.coordinates2d = diamond(p.x, p.y, size, size * 1.65);
            else p.node.node.coordinates2d = polyCircle(p.x, p.y, size, 6);
            p.node.node.fill = p.color;
            p.node.node.color = [255,255,255,Math.round(255 * k)];
            if (Math.random() < 0.22) this.spawnTrail(oldX, oldY, p.x, p.y, p.color, 0.16, 0.12 + size * 0.1);
        });
    }

    updateTrails() {
        this.trails.forEach((t) => {
            if (!t.active) return hide(t.node);
            t.ttl -= DT;
            if (t.ttl <= 0) { t.active = false; return hide(t.node); }
            const k = t.ttl / t.max;
            t.node.node.coordinates2d = thickLine(t.x1, t.y1, t.x2, t.y2, t.width * k + 0.03);
            t.node.node.fill = t.color;
            t.node.node.color = [255,255,255,Math.round(180 * k)];
        });
    }

    updateAutoLaunchers() {
        if (this.wave === 1 && this.combo === 0 && this.time < 2.5) return;
        if (this.autoLaunchTimer > 0) return;
        this.autoLaunchTimer = Math.max(0.08, 0.42 - Math.min(0.28, this.wave * 0.015));
        const p = this.currentPalette();
        const style = this.wave > 4 && Math.random() < 0.55 ? 'fan' : (Math.random() < 0.5 ? 'shell' : 'fountain');
        if (style === 'shell') {
            const sx = rand(12, 88);
            const ex = sx + rand(-8, 8);
            const ey = rand(14, 42);
            this.spawnComet(sx, 80.7, (ex - sx) * 1.05, -rand(22, 31), pick(p.fireworks), pick(['ring','flower','galaxy','star']), 1.0 + Math.min(0.7, this.wave * 0.05), 20 + Math.min(26, this.wave * 2));
        } else if (style === 'fan') {
            const baseX = rand(16, 84);
            for (let i = 0; i < 4; i++) {
                const vx = -5 + i * 3.4 + rand(-0.8, 0.8);
                this.spawnComet(baseX, 80.7, vx, -rand(17, 24), pick(p.fireworks), pick(['cascade','crown','palm']), 0.95, 14 + i * 2);
            }
        } else {
            const baseX = rand(10, 90);
            for (let i = 0; i < 8; i++) {
                const a = -Math.PI / 2 + rand(-0.25, 0.25);
                const speed = rand(8, 17);
                this.spawnParticle(baseX + rand(-0.6, 0.6), 80.4, Math.cos(a) * speed * rand(0.3, 0.6), Math.sin(a) * speed, pick(p.fireworks), rand(0.9, 1.5), rand(0.11, 0.24), i % 3, i % 7 === 0);
            }
        }
    }


    launchFinale() {
        const p = this.currentPalette();
        for (let i = 0; i < 7; i++) {
            const sx = 10 + i * 13;
            const vx = rand(-2.5, 2.5);
            this.spawnComet(sx, 80.6, vx, -rand(24, 31), p.fireworks[i % p.fireworks.length], pick(['galaxy', 'palm', 'crown', 'star']), 1.35, 24 + i * 3);
        }
    }

    checkWave() {
        const remaining = this.lanterns.some(l => l.active && !l.lit);
        const activeEffects = this.explosions.some(e => e.active) || this.particles.some(p => p.active) || this.comets.some(c => c.active);
        if (!remaining) {
            if (!this.finaleTriggered) {
                this.finaleTriggered = true;
                this.launchFinale();
            }
            if (!activeEffects) {
                this.waveDelay += DT;
                if (this.waveDelay > 1.25) {
                    this.paletteIndex = (this.paletteIndex + 1) % PALETTES.length;
                    this.applyPalette();
                    this.startWave(false);
                }
            }
        } else {
            this.waveDelay = 0;
            this.finaleTriggered = false;
        }
        if (this.charges === 0 && remaining) {
            this.chargeProgress += DT * 0.7;
            if (this.chargeProgress >= 1) {
                this.chargeProgress = 0;
                this.charges = 1;
                this.renderCharges();
            }
        }
    }
}

module.exports = LumenFestivalBonkers;
