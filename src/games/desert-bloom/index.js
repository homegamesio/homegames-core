const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');

const { COLORS } = Colors;

const TICK_RATE = 30; // MUST match metadata().tickRate literal.
const DT = 1 / TICK_RATE;

const PALETTE = {
    night: [10, 16, 34, 255],
    dawn: [250, 147, 102, 255],
    day: [117, 203, 232, 255],
    dusk: [111, 78, 145, 255],
    sandBack: [226, 175, 105, 255],
    sandFront: [238, 190, 112, 255],
    soil: [92, 55, 39, 255],
    pot: [191, 91, 61, 255],
    potDark: [137, 58, 46, 255],
    cactus: [52, 159, 104, 255],
    cactusLight: [80, 188, 119, 255],
    cactusStress: [146, 146, 76, 255],
    cactusWet: [43, 130, 121, 255],
    flower: [244, 104, 151, 255],
    flower2: [255, 179, 71, 255],
    flowerCenter: [255, 224, 92, 255],
    water: [84, 172, 238, 255],
    sun: [255, 210, 69, 255],
    shade: [83, 91, 139, 255],
    good: [99, 205, 133, 255],
    panel: [22, 30, 49, 255],
    panelSoft: [42, 52, 73, 255],
    white: [246, 247, 249, 255],
    shadow: [79, 46, 44, 255],
    transparent: [0, 0, 0, 0]
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mixColor = (a, b, t) => [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
    255
];

const polyCircle = (cx, cy, r, sides = 16) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

const thickLine = (x1, y1, x2, y2, width) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(a) * width / 2;
    const dy = Math.cos(a) * width / 2;
    return [
        [x1 - dx, y1 + dy],
        [x2 - dx, y2 + dy],
        [x2 + dx, y2 - dy],
        [x1 + dx, y1 - dy],
        [x1 - dx, y1 + dy]
    ];
};

const diamond = (cx, cy, rx, ry) => [
    [cx, cy - ry],
    [cx + rx, cy],
    [cx, cy + ry],
    [cx - rx, cy],
    [cx, cy - ry]
];

const petal = (cx, cy, angle, length, width) => {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const px = -uy;
    const py = ux;
    const bx = cx + ux * length * 0.18;
    const by = cy + uy * length * 0.18;
    const tx = cx + ux * length;
    const ty = cy + uy * length;
    return [
        [cx + px * width * 0.24, cy + py * width * 0.24],
        [bx + px * width * 0.5, by + py * width * 0.5],
        [tx, ty],
        [bx - px * width * 0.5, by - py * width * 0.5],
        [cx - px * width * 0.24, cy - py * width * 0.24],
        [cx + px * width * 0.24, cy + py * width * 0.24]
    ];
};

const stalkPolygon = (cx, bottom, width, height, lean) => {
    const half = width / 2;
    const topY = bottom - height;
    const topX = cx + lean;
    return [
        [cx - half, bottom],
        [cx + half, bottom],
        [topX + half, topY + half],
        [topX + half * 0.72, topY + half * 0.22],
        [topX, topY],
        [topX - half * 0.72, topY + half * 0.22],
        [topX - half, topY + half],
        [cx - half, bottom]
    ];
};

const trapezoid = (x, y, w, h, inset) => [
    [x, y],
    [x + w, y],
    [x + w - inset, y + h],
    [x + inset, y + h],
    [x, y]
];

const makeShape = (coordinates2d, fill, extra = {}) => new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d,
    fill,
    ...extra
});

class DesertBloom extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Desert Bloom',
            author: "Joseph Garcia",
            description: 'Balance water and sunlight to grow a cactus into bloom. Drawn entirely with polygons.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 30,
            maxPlayers: 1,
            gameId: "04ee99b8-9b85-59be-a41d-221775851747"
        };
    }

    constructor() {
        super();

        this.phase = 'title';
        this.keys = {};
        this.time = 0;
        this.dayTime = 8;
        this.water = 54;
        this.growth = 0;
        this.shadeOn = false;
        this.waterCooldown = 0;
        this.shadeCooldown = 0;
        this.goodTime = 0;
        this.bloomTime = 0;
        this.lastSolar = 0;
        this._changed = false;

        this.base = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), PALETTE.day);

        this.buildSky();
        this.buildLandscape();
        this.buildPlant();
        this.buildHud();
        this.buildParticles();
        this.buildControls();
        this.buildOverlay();

        this.setPhase('title');
        this.renderAll(true);
    }

    getLayers() {
        return [{ root: this.base }];
    }

    handleNewPlayer() {}

    handlePlayerDisconnect() {
        this.keys = {};
    }

    handleKeyDown(playerId, key) {
        const k = String(key || '').toLowerCase();
        if (this.keys[k]) return;
        this.keys[k] = true;

        if (k === 'enter' || k === ' ') {
            if (this.phase === 'title' || this.phase === 'won') this.startGame();
            return;
        }
        if (this.phase !== 'playing') return;
        if (k === 'w' || k === 'arrowup') this.waterPlant();
        if (k === 's' || k === 'arrowdown') this.toggleShade();
    }

    handleKeyUp(playerId, key) {
        delete this.keys[String(key || '').toLowerCase()];
    }

    startGame() {
        this.keys = {};
        this.time = 0;
        this.dayTime = 8;
        this.water = 54;
        this.growth = 0;
        this.shadeOn = false;
        this.waterCooldown = 0;
        this.shadeCooldown = 0;
        this.goodTime = 0;
        this.bloomTime = 0;
        this.resetParticles();
        this.setPhase('playing');
        this.renderAll(true);
    }

    waterPlant() {
        if (this.phase !== 'playing' || this.waterCooldown > 0) return;
        this.water = clamp(this.water + 19, 0, 100);
        this.waterCooldown = 0.42;
        this.emitBurst(22, 88, PALETTE.water, 7, 0.65);
        this.renderAll(true);
    }

    toggleShade() {
        if (this.phase !== 'playing' || this.shadeCooldown > 0) return;
        this.shadeOn = !this.shadeOn;
        this.shadeCooldown = 0.2;
        this.emitBurst(78, 88, this.shadeOn ? PALETTE.shade : PALETTE.sun, 6, 0.45);
        this.renderAll(true);
    }

    setPhase(next) {
        this.phase = next;
        const playing = next === 'playing' || next === 'blooming';
        this.setControlsVisible(playing);
        this.setOverlayVisible(next === 'title' || next === 'won', next === 'won');
        this.keys = {};
    }

    tick() {
        if (this.phase !== 'playing' && this.phase !== 'blooming') return;

        this.time += DT;
        this.dayTime += DT;
        this.waterCooldown = Math.max(0, this.waterCooldown - DT);
        this.shadeCooldown = Math.max(0, this.shadeCooldown - DT);

        const solar = this.getSolar();
        const effectiveSun = solar * (this.shadeOn ? 0.44 : 1);
        this.lastSolar = effectiveSun;

        if (this.phase === 'playing') {
            this.water = clamp(this.water - (0.28 + effectiveSun * 0.52) * DT, 0, 100);

            const waterQuality = this.bandQuality(this.water, 34, 65, 16);
            const sunQuality = this.bandQuality(effectiveSun * 100, 37, 78, 20);
            const quality = Math.min(waterQuality, sunQuality);

            if (quality > 0.05) {
                const rate = 0.35 + quality * 2.25;
                this.growth = clamp(this.growth + rate * DT, 0, 100);
                this.goodTime += DT;
                if (this.goodTime >= 0.55) {
                    this.goodTime = 0;
                    this.emitGrowthSparkle();
                }
            } else {
                this.goodTime = Math.max(0, this.goodTime - DT * 0.5);
            }

            if (this.growth >= 100) {
                this.phase = 'blooming';
                this.bloomTime = 0;
                this.emitBloomBurst();
            }
        } else {
            this.bloomTime += DT;
            if (this.bloomTime < 2.8 && Math.floor(this.bloomTime * 8) !== Math.floor((this.bloomTime - DT) * 8)) {
                this.emitBloomBurst(4);
            }
            if (this.bloomTime >= 3.2) {
                this.setPhase('won');
                this.renderAll(true);
                return;
            }
        }

        this.updateParticles();
        this.renderAll(false);
    }

    getSolar() {
        const cycle = 54;
        const p = (this.dayTime % cycle) / cycle;
        return clamp((Math.sin(p * Math.PI * 2 - Math.PI / 2) + 1) / 2, 0, 1);
    }

    bandQuality(value, lo, hi, falloff) {
        if (value >= lo && value <= hi) return 1;
        if (value < lo) return clamp(1 - (lo - value) / falloff, 0, 1);
        return clamp(1 - (value - hi) / falloff, 0, 1);
    }

    buildSky() {
        this.stars = [];
        const starPoints = [
            [10, 12], [18, 27], [29, 16], [39, 8], [53, 18], [65, 10],
            [76, 24], [88, 13], [93, 31], [7, 39], [34, 34], [59, 35]
        ];
        for (let i = 0; i < starPoints.length; i++) {
            const p = starPoints[i];
            const star = makeShape(diamond(p[0], p[1], 0.35, 0.65), PALETTE.white);
            star._home = p;
            this.stars.push(star);
            this.base.addChild(star);
        }

        this.sunNode = makeShape(polyCircle(80, 17, 5.5, 18), PALETTE.sun, {
            effects: { shadow: { color: PALETTE.sun, blur: 18 } }
        });
        this.base.addChild(this.sunNode);

        this.sunRays = [];
        for (let i = 0; i < 8; i++) {
            const ray = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), PALETTE.sun);
            this.sunRays.push(ray);
            this.base.addChild(ray);
        }

        this.moonNode = makeShape(polyCircle(18, 18, 4.6, 16), [232, 236, 224, 255], {
            effects: { shadow: { color: [205, 218, 255, 255], blur: 9 } }
        });
        this.base.addChild(this.moonNode);
        this.moonCutout = makeShape(polyCircle(20.4, 16.7, 4.5, 16), PALETTE.night);
        this.base.addChild(this.moonCutout);

        this.clouds = [];
        const cloudData = [
            [17, 22, 3.0], [21, 20.8, 4.2], [25, 22, 3.2],
            [68, 31, 2.8], [72, 29.8, 3.8], [76, 31, 2.7]
        ];
        for (const [x, y, r] of cloudData) {
            const cloud = makeShape(polyCircle(x, y, r, 14), [245, 239, 220, 255]);
            this.clouds.push({ node: cloud, x, y, r });
            this.base.addChild(cloud);
        }
    }

    buildLandscape() {
        this.backDune = makeShape([
            [0, 63], [12, 56], [25, 58], [38, 51], [52, 56], [68, 49], [82, 55], [100, 50], [100, 100], [0, 100], [0, 63]
        ], PALETTE.sandBack);
        this.base.addChild(this.backDune);

        this.frontDune = makeShape([
            [0, 73], [14, 67], [28, 72], [44, 64], [61, 70], [78, 63], [100, 69], [100, 100], [0, 100], [0, 73]
        ], PALETTE.sandFront);
        this.base.addChild(this.frontDune);

        this.pebbles = [];
        const pebbleData = [[8,84,2],[14,78,1.2],[86,84,1.7],[92,77,1.1],[72,88,1.0],[31,87,0.9]];
        for (const [x, y, r] of pebbleData) {
            const pebble = makeShape(polyCircle(x, y, r, 9), [164, 111, 81, 255]);
            this.pebbles.push(pebble);
            this.base.addChild(pebble);
        }

        this.potShadow = makeShape(polyCircle(50, 87.3, 10.5, 18), PALETTE.shadow);
        this.base.addChild(this.potShadow);
        this.potBody = makeShape(trapezoid(42, 78, 16, 12, 2.4), PALETTE.pot);
        this.base.addChild(this.potBody);
        this.potRim = makeShape(ShapeUtils.rectangle(40.5, 76.8, 19, 3.1), PALETTE.potDark);
        this.base.addChild(this.potRim);
        this.soilNode = makeShape(polyCircle(50, 77.7, 7.7, 18), PALETTE.soil);
        this.base.addChild(this.soilNode);
    }

    buildPlant() {
        this.mainStalk = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), PALETTE.cactus, {
            effects: { shadow: { color: [53, 158, 105, 255], blur: 7 } }
        });
        this.base.addChild(this.mainStalk);
        this.mainHighlight = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), PALETTE.cactusLight);
        this.base.addChild(this.mainHighlight);

        this.leftArmH = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), PALETTE.cactus);
        this.leftArmV = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), PALETTE.cactus);
        this.rightArmH = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), PALETTE.cactus);
        this.rightArmV = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), PALETTE.cactus);
        this.topBud = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), PALETTE.cactusLight);
        this.base.addChildren(this.leftArmH, this.leftArmV, this.rightArmH, this.rightArmV, this.topBud);

        this.spines = [];
        for (let i = 0; i < 16; i++) {
            const spine = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), [232, 238, 206, 255]);
            this.spines.push(spine);
            this.base.addChild(spine);
        }

        this.flowers = [];
        const flowerColors = [PALETTE.flower, PALETTE.flower2, [181, 118, 230, 255]];
        for (let f = 0; f < 3; f++) {
            const petals = [];
            for (let i = 0; i < 5; i++) {
                const p = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), flowerColors[f]);
                petals.push(p);
                this.base.addChild(p);
            }
            const center = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), PALETTE.flowerCenter, {
                effects: { shadow: { color: PALETTE.flowerCenter, blur: 5 } }
            });
            this.base.addChild(center);
            this.flowers.push({ petals, center, color: flowerColors[f] });
        }

        this.potFrontLip = makeShape(ShapeUtils.rectangle(40.5, 78.2, 19, 1.7), PALETTE.potDark);
        this.base.addChild(this.potFrontLip);
    }

    buildHud() {
        this.growthTrack = makeShape(ShapeUtils.rectangle(19, 5, 62, 3.2), PALETTE.panelSoft);
        this.growthFill = makeShape(ShapeUtils.rectangle(19, 5, 0, 3.2), PALETTE.good);
        this.base.addChildren(this.growthTrack, this.growthFill);

        this.waterTrack = makeShape(ShapeUtils.rectangle(8, 93, 31, 2.8), PALETTE.panelSoft);
        this.waterFill = makeShape(ShapeUtils.rectangle(8, 93, 0, 2.8), PALETTE.water);
        this.waterGoodA = makeShape(ShapeUtils.rectangle(8 + 31 * 0.34, 92.4, 0.45, 4), PALETTE.good);
        this.waterGoodB = makeShape(ShapeUtils.rectangle(8 + 31 * 0.65, 92.4, 0.45, 4), PALETTE.good);
        this.base.addChildren(this.waterTrack, this.waterFill, this.waterGoodA, this.waterGoodB);

        this.sunTrack = makeShape(ShapeUtils.rectangle(61, 93, 31, 2.8), PALETTE.panelSoft);
        this.sunFill = makeShape(ShapeUtils.rectangle(61, 93, 0, 2.8), PALETTE.sun);
        this.sunGoodA = makeShape(ShapeUtils.rectangle(61 + 31 * 0.37, 92.4, 0.45, 4), PALETTE.good);
        this.sunGoodB = makeShape(ShapeUtils.rectangle(61 + 31 * 0.78, 92.4, 0.45, 4), PALETTE.good);
        this.base.addChildren(this.sunTrack, this.sunFill, this.sunGoodA, this.sunGoodB);
    }

    buildControls() {
        this.waterButtonVisual = makeShape(polyCircle(22, 86, 6.2, 18), [40, 78, 120, 255], {
            effects: { shadow: { color: PALETTE.water, blur: 9 } }
        });
        this.waterDrop = makeShape([
            [22, 81], [25, 85.2], [24.4, 88.1], [22, 89.2], [19.6, 88.1], [19, 85.2], [22, 81]
        ], PALETTE.water);
        this.waterHint = makeShape(polyCircle(22, 86, 7.5, 18), PALETTE.transparent, {
            color: PALETTE.good,
            border: 7
        });
        this.waterHit = makeShape(ShapeUtils.rectangle(14, 78, 16, 16), PALETTE.transparent, {
            onClick: () => this.waterPlant()
        });

        this.shadeButtonVisual = makeShape(polyCircle(78, 86, 6.2, 18), [91, 73, 98, 255], {
            effects: { shadow: { color: PALETTE.sun, blur: 7 } }
        });
        this.shadeCanopy = makeShape([
            [72, 85], [73.5, 81.6], [78, 80], [82.5, 81.6], [84, 85], [72, 85]
        ], PALETTE.sun);
        this.shadeStem = makeShape(thickLine(78, 84.5, 78, 90, 0.8), PALETTE.white);
        this.shadeHint = makeShape(polyCircle(78, 86, 7.5, 18), PALETTE.transparent, {
            color: PALETTE.good,
            border: 7
        });
        this.shadeHit = makeShape(ShapeUtils.rectangle(70, 78, 16, 16), PALETTE.transparent, {
            onClick: () => this.toggleShade()
        });

        // Draw order matters: transparent hit boxes are last so icons never swallow clicks.
        this.base.addChildren(
            this.waterButtonVisual, this.waterDrop, this.waterHint,
            this.shadeButtonVisual, this.shadeCanopy, this.shadeStem, this.shadeHint,
            this.waterHit, this.shadeHit
        );
    }

    buildParticles() {
        this.particles = [];
        for (let i = 0; i < 28; i++) {
            const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), PALETTE.transparent);
            this.particles.push({
                active: false,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                life: 0,
                maxLife: 1,
                size: 0.5,
                color: PALETTE.white,
                node
            });
            this.base.addChild(node);
        }
    }

    buildOverlay() {
        this.overlayBg = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), [8, 13, 27, 255]);
        this.base.addChild(this.overlayBg);

        this.logoNodes = [];


        this.overlayCactus = makeShape(stalkPolygon(50, 68, 8, 28, 0), PALETTE.cactus, {
            effects: { shadow: { color: PALETTE.cactusLight, blur: 12 } }
        });
        this.overlayLeftArm = makeShape(thickLine(46, 52, 38, 47, 4.4), PALETTE.cactus);
        this.overlayRightArm = makeShape(thickLine(54, 47, 62, 42, 4.4), PALETTE.cactus);
        this.base.addChildren(this.overlayCactus, this.overlayLeftArm, this.overlayRightArm);

        this.overlayFlower = [];
        for (let i = 0; i < 5; i++) {
            const p = makeShape(petal(50, 39, -Math.PI / 2 + i * Math.PI * 0.4, 4.2, 2.8), PALETTE.flower);
            this.overlayFlower.push(p);
            this.base.addChild(p);
        }
        this.overlayFlowerCenter = makeShape(polyCircle(50, 39, 1.5, 12), PALETTE.flowerCenter);
        this.base.addChild(this.overlayFlowerCenter);

        this.playRing = makeShape(polyCircle(50, 82, 8, 18), PALETTE.panelSoft, {
            effects: { shadow: { color: PALETTE.good, blur: 10 } }
        });
        this.playTriangle = makeShape(ShapeUtils.triangle(47.5, 77.5, 47.5, 86.5, 55.8, 82), PALETTE.white);
        this.overlayClick = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), PALETTE.transparent, {
            onClick: () => {
                if (this.phase === 'title' || this.phase === 'won') this.startGame();
            }
        });
        this.base.addChildren(this.playRing, this.playTriangle, this.overlayClick);
    }

    buildPolygonWord() {
        const x0 = 20;
        const y0 = 14;
        const h = 11;
        const t = 1.6;
        const gap = 2.5;
        const w = 8;
        const addRect = (x, y, rw, rh) => {
            const node = makeShape(ShapeUtils.rectangle(x, y, rw, rh), PALETTE.white);
            node._homeCoords = ShapeUtils.rectangle(x, y, rw, rh);
            this.logoNodes.push(node);
            this.base.addChild(node);
        };
        const addLine = (x1, y1, x2, y2, width) => {
            const coords = thickLine(x1, y1, x2, y2, width);
            const node = makeShape(coords, PALETTE.white);
            node._homeCoords = coords;
            this.logoNodes.push(node);
            this.base.addChild(node);
        };

        let x = x0;
        // B
        addRect(x, y0, t, h); addRect(x, y0, w - 1, t); addRect(x, y0 + h / 2 - t / 2, w - 1, t);
        addRect(x, y0 + h - t, w - 1, t); addRect(x + w - t, y0 + 0.8, t, h / 2 - 1.1); addRect(x + w - t, y0 + h / 2 + 0.2, t, h / 2 - 1);
        x += w + gap;
        // L
        addRect(x, y0, t, h); addRect(x, y0 + h - t, w, t);
        x += w + gap;
        // O
        addRect(x, y0, w, t); addRect(x, y0 + h - t, w, t); addRect(x, y0, t, h); addRect(x + w - t, y0, t, h);
        x += w + gap;
        // O
        addRect(x, y0, w, t); addRect(x, y0 + h - t, w, t); addRect(x, y0, t, h); addRect(x + w - t, y0, t, h);
        x += w + gap;
        // M
        addRect(x, y0, t, h); addRect(x + w - t, y0, t, h);
        addLine(x + t * 0.7, y0 + t * 0.3, x + w / 2, y0 + 5.2, t);
        addLine(x + w / 2, y0 + 5.2, x + w - t * 0.7, y0 + t * 0.3, t);
    }

    setControlsVisible(visible) {
        const hide = ShapeUtils.rectangle(0, 0, 0, 0);
        const entries = [
            [this.waterButtonVisual, polyCircle(22, 86, 6.2, 18)],
            [this.waterDrop, [[22,81],[25,85.2],[24.4,88.1],[22,89.2],[19.6,88.1],[19,85.2],[22,81]]],
            [this.waterHint, polyCircle(22, 86, 7.5, 18)],
            [this.shadeButtonVisual, polyCircle(78, 86, 6.2, 18)],
            [this.shadeCanopy, [[72,85],[73.5,81.6],[78,80],[82.5,81.6],[84,85],[72,85]]],
            [this.shadeStem, thickLine(78,84.5,78,90,0.8)],
            [this.shadeHint, polyCircle(78, 86, 7.5, 18)],
            [this.waterHit, ShapeUtils.rectangle(14, 78, 16, 16)],
            [this.shadeHit, ShapeUtils.rectangle(70, 78, 16, 16)],
            [this.growthTrack, ShapeUtils.rectangle(19, 5, 62, 3.2)],
            [this.growthFill, ShapeUtils.rectangle(19, 5, 0, 3.2)],
            [this.waterTrack, ShapeUtils.rectangle(8, 93, 31, 2.8)],
            [this.waterFill, ShapeUtils.rectangle(8, 93, 0, 2.8)],
            [this.waterGoodA, ShapeUtils.rectangle(8 + 31 * 0.34, 92.4, 0.45, 4)],
            [this.waterGoodB, ShapeUtils.rectangle(8 + 31 * 0.65, 92.4, 0.45, 4)],
            [this.sunTrack, ShapeUtils.rectangle(61, 93, 31, 2.8)],
            [this.sunFill, ShapeUtils.rectangle(61, 93, 0, 2.8)],
            [this.sunGoodA, ShapeUtils.rectangle(61 + 31 * 0.37, 92.4, 0.45, 4)],
            [this.sunGoodB, ShapeUtils.rectangle(61 + 31 * 0.78, 92.4, 0.45, 4)]
        ];
        for (const [node, home] of entries) node.node.coordinates2d = visible ? home : hide;
    }

    setOverlayVisible(visible, won) {
        const hide = ShapeUtils.rectangle(0, 0, 0, 0);
        this.overlayBg.node.coordinates2d = visible ? ShapeUtils.rectangle(0, 0, 100, 100) : hide;
        this.overlayClick.node.coordinates2d = visible ? ShapeUtils.rectangle(0, 0, 100, 100) : hide;
        this.playRing.node.coordinates2d = visible ? polyCircle(50, 82, 8, 18) : hide;
        this.playTriangle.node.coordinates2d = visible ? ShapeUtils.triangle(47.5, 77.5, 47.5, 86.5, 55.8, 82) : hide;

        for (const node of this.logoNodes) node.node.coordinates2d = visible ? node._homeCoords : hide;

        this.overlayCactus.node.coordinates2d = visible ? stalkPolygon(50, 68, 8, won ? 31 : 28, 0) : hide;
        this.overlayLeftArm.node.coordinates2d = visible ? thickLine(46, 52, 38, 47, 4.4) : hide;
        this.overlayRightArm.node.coordinates2d = visible ? thickLine(54, 47, 62, 42, 4.4) : hide;
        for (let i = 0; i < this.overlayFlower.length; i++) {
            this.overlayFlower[i].node.coordinates2d = visible
                ? petal(50, 39, -Math.PI / 2 + i * Math.PI * 0.4, won ? 5 : 4.2, won ? 3.4 : 2.8)
                : hide;
        }
        this.overlayFlowerCenter.node.coordinates2d = visible ? polyCircle(50, 39, won ? 1.8 : 1.5, 12) : hide;
    }

    renderAll(force) {
        if (this.phase === 'playing' || this.phase === 'blooming') {
            this.renderSky();
            this.renderPlant();
            this.renderHud();
            this.renderControls();
        }
        this.renderParticles();
        if (force || this.phase === 'playing' || this.phase === 'blooming') this.base.node.onStateChange();
    }

    renderSky() {
        const solar = this.getSolar();
        const phase = (this.dayTime % 54) / 54;
        let sky;
        if (solar > 0.62) sky = mixColor(PALETTE.dawn, PALETTE.day, clamp((solar - 0.62) / 0.38, 0, 1));
        else if (phase < 0.5) sky = mixColor(PALETTE.night, PALETTE.dawn, solar / 0.62);
        else sky = mixColor(PALETTE.night, PALETTE.dusk, solar / 0.62);
        this.base.node.fill = sky;

        const sunA = phase * Math.PI * 2;
        const sunX = 50 + Math.cos(sunA + Math.PI) * 39;
        const sunY = 36 + Math.sin(sunA + Math.PI) * 25;
        this.sunNode.node.coordinates2d = polyCircle(sunX, sunY, 5.4, 18);
        for (let i = 0; i < this.sunRays.length; i++) {
            const a = i * Math.PI / 4 + this.time * 0.08;
            const x1 = sunX + Math.cos(a) * 7;
            const y1 = sunY + Math.sin(a) * 7;
            const x2 = sunX + Math.cos(a) * 9.5;
            const y2 = sunY + Math.sin(a) * 9.5;
            this.sunRays[i].node.coordinates2d = thickLine(x1, y1, x2, y2, 0.75);
        }

        const moonX = 50 + Math.cos(sunA) * 39;
        const moonY = 36 + Math.sin(sunA) * 25;
        this.moonNode.node.coordinates2d = polyCircle(moonX, moonY, 4.5, 16);
        this.moonCutout.node.coordinates2d = polyCircle(moonX + 2.4, moonY - 1.3, 4.4, 16);
        this.moonCutout.node.fill = sky;

        const darkness = 1 - solar;
        for (let i = 0; i < this.stars.length; i++) {
            const s = this.stars[i];
            const twinkle = 0.7 + Math.sin(this.time * 1.6 + i * 1.7) * 0.3;
            if (darkness > 0.43) {
                const scale = 0.25 + darkness * 0.55 * twinkle;
                s.node.coordinates2d = diamond(s._home[0], s._home[1], scale * 0.45, scale * 0.8);
            } else {
                s.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            }
        }

        for (let i = 0; i < this.clouds.length; i++) {
            const c = this.clouds[i];
            const drift = (this.time * (0.7 + i * 0.05) + i * 11) % 120;
            const x = ((c.x + drift + 20) % 120) - 10;
            c.node.node.coordinates2d = polyCircle(x, c.y + Math.sin(this.time * 0.22 + i) * 0.35, c.r, 14);
            c.node.node.fill = solar > 0.25 ? [245, 239, 220, 255] : [126, 132, 157, 255];
        }
    }

    renderPlant() {
        const g = this.growth / 100;
        const height = 8 + g * 39;
        const lean = Math.sin(this.time * 1.1) * (0.25 + g * 0.45);
        const bottom = 77.4;
        const topY = bottom - height;
        const topX = 50 + lean;

        let cactusColor = PALETTE.cactus;
        if (this.water < 20 || this.lastSolar * 100 > 90) cactusColor = PALETTE.cactusStress;
        else if (this.water > 82) cactusColor = PALETTE.cactusWet;

        this.mainStalk.node.fill = cactusColor;
        this.mainStalk.node.coordinates2d = stalkPolygon(50, bottom, 7.4, height, lean);
        this.mainHighlight.node.coordinates2d = stalkPolygon(48.6, bottom - 1, 1.1, Math.max(4, height - 2), lean * 0.75);
        this.mainHighlight.node.fill = mixColor(cactusColor, PALETTE.white, 0.22);

        const leftProgress = clamp((g - 0.24) / 0.32, 0, 1);
        const rightProgress = clamp((g - 0.48) / 0.34, 0, 1);
        const leftY = bottom - height * 0.48;
        const rightY = bottom - height * 0.68;

        if (leftProgress > 0) {
            const lx = 46.7;
            const reach = 3 + 8 * leftProgress;
            this.leftArmH.node.coordinates2d = thickLine(lx, leftY, lx - reach, leftY - 0.5, 4.1);
            this.leftArmV.node.coordinates2d = stalkPolygon(lx - reach, leftY + 1, 4.1, 4 + 8 * leftProgress, -0.2);
            this.leftArmH.node.fill = cactusColor;
            this.leftArmV.node.fill = cactusColor;
        } else {
            this.leftArmH.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            this.leftArmV.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        }

        if (rightProgress > 0) {
            const rx = 53.2;
            const reach = 3 + 8 * rightProgress;
            this.rightArmH.node.coordinates2d = thickLine(rx, rightY, rx + reach, rightY + 0.3, 4.1);
            this.rightArmV.node.coordinates2d = stalkPolygon(rx + reach, rightY + 1.2, 4.1, 4 + 9 * rightProgress, 0.2);
            this.rightArmH.node.fill = cactusColor;
            this.rightArmV.node.fill = cactusColor;
        } else {
            this.rightArmH.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            this.rightArmV.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        }

        const budScale = clamp((g - 0.72) / 0.22, 0, 1);
        this.topBud.node.coordinates2d = budScale > 0
            ? polyCircle(topX, topY + 0.4, 1.2 + budScale * 1.3, 12)
            : ShapeUtils.rectangle(0, 0, 0, 0);

        for (let i = 0; i < this.spines.length; i++) {
            const row = Math.floor(i / 2);
            const side = i % 2 === 0 ? -1 : 1;
            const t = (row + 1) / 9;
            if (t > g + 0.08) {
                this.spines[i].node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                continue;
            }
            const y = bottom - height * t;
            const x = lerp(50, topX, t) + side * 4;
            this.spines[i].node.coordinates2d = ShapeUtils.triangle(
                x, y,
                x + side * 1.9, y - 0.65,
                x + side * 0.4, y + 0.65
            );
        }

        const leftTip = [35.7, leftY - 11 * leftProgress];
        const rightTip = [64.3, rightY - 12 * rightProgress];
        this.renderFlower(0, topX, topY - 0.7, clamp((g - 0.78) / 0.16, 0, 1));
        this.renderFlower(1, leftTip[0], leftTip[1], clamp((g - 0.88) / 0.1, 0, 1));
        this.renderFlower(2, rightTip[0], rightTip[1], clamp((g - 0.94) / 0.06, 0, 1));
    }

    renderFlower(index, cx, cy, scale) {
        const flower = this.flowers[index];
        if (scale <= 0.02) {
            for (const p of flower.petals) p.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            flower.center.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            return;
        }
        const pulse = 1 + Math.sin(this.time * 2 + index) * 0.04;
        for (let i = 0; i < flower.petals.length; i++) {
            const angle = -Math.PI / 2 + i * Math.PI * 0.4 + Math.sin(this.time * 0.6 + index) * 0.05;
            flower.petals[i].node.coordinates2d = petal(cx, cy, angle, 3.6 * scale * pulse, 2.6 * scale);
        }
        flower.center.node.coordinates2d = polyCircle(cx, cy, 1.25 * scale, 12);
    }

    renderHud() {
        this.growthFill.node.coordinates2d = ShapeUtils.rectangle(19, 5, 62 * this.growth / 100, 3.2);
        this.waterFill.node.coordinates2d = ShapeUtils.rectangle(8, 93, 31 * this.water / 100, 2.8);
        this.sunFill.node.coordinates2d = ShapeUtils.rectangle(61, 93, 31 * this.lastSolar, 2.8);
    }

    renderControls() {
        const waterNeedsHelp = this.water < 32;
        const sunNeedsShade = this.lastSolar * 100 > 80 && !this.shadeOn;
        const sunNeedsOpen = this.lastSolar * 100 < 34 && this.shadeOn;
        const pulse = 7.2 + Math.sin(this.time * 4) * 0.6;

        this.waterHint.node.coordinates2d = waterNeedsHelp ? polyCircle(22, 86, pulse, 18) : ShapeUtils.rectangle(0, 0, 0, 0);
        this.shadeHint.node.coordinates2d = (sunNeedsShade || sunNeedsOpen) ? polyCircle(78, 86, pulse, 18) : ShapeUtils.rectangle(0, 0, 0, 0);

        this.shadeButtonVisual.node.fill = this.shadeOn ? PALETTE.shade : [91, 73, 98, 255];
        this.shadeCanopy.node.fill = this.shadeOn ? PALETTE.shade : PALETTE.sun;
        if (this.shadeOn) {
            this.shadeCanopy.node.coordinates2d = [[72,85],[73.5,81.6],[78,80],[82.5,81.6],[84,85],[72,85]];
        } else {
            this.shadeCanopy.node.coordinates2d = [[73.5,85],[75,82.8],[78,82],[81,82.8],[82.5,85],[73.5,85]];
        }
    }

    emitGrowthSparkle() {
        const g = this.growth / 100;
        const height = 8 + g * 39;
        const y = 77.4 - height * (0.35 + Math.random() * 0.6);
        const x = 50 + (Math.random() - 0.5) * 11;
        this.emitBurst(x, y, PALETTE.good, 2, 0.35);
    }

    emitBloomBurst(count = 16) {
        const colors = [PALETTE.flower, PALETTE.flower2, PALETTE.flowerCenter, [181, 118, 230, 255], PALETTE.good];
        for (let i = 0; i < count; i++) {
            this.emitParticle(50, 30, colors[i % colors.length], 0.65 + Math.random() * 0.7, true);
        }
    }

    emitBurst(x, y, color, count, speed) {
        for (let i = 0; i < count; i++) this.emitParticle(x, y, color, speed, false);
    }

    emitParticle(x, y, color, speed, upward) {
        const p = this.particles.find(q => !q.active);
        if (!p) return;
        const a = upward ? (-Math.PI * 0.92 + Math.random() * Math.PI * 0.84) : Math.random() * Math.PI * 2;
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * speed * (7 + Math.random() * 9);
        p.vy = Math.sin(a) * speed * (7 + Math.random() * 9);
        p.life = 0.8 + Math.random() * 0.75;
        p.maxLife = p.life;
        p.size = 0.35 + Math.random() * 0.55;
        p.color = color;
        p.node.node.fill = color;
        p.node.node.color = [255, 255, 255, 255];
    }

    updateParticles() {
        for (const p of this.particles) {
            if (!p.active) continue;
            p.life -= DT;
            if (p.life <= 0) {
                p.active = false;
                p.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                continue;
            }
            p.vy += 7.5 * DT;
            p.x += p.vx * DT;
            p.y += p.vy * DT;
        }
    }

    renderParticles() {
        for (const p of this.particles) {
            if (!p.active) {
                p.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                continue;
            }
            const k = clamp(p.life / p.maxLife, 0, 1);
            p.node.node.coordinates2d = diamond(p.x, p.y, p.size * k, p.size * 1.35 * k);
            p.node.node.fill = p.color;
            p.node.node.color = [255, 255, 255, Math.round(255 * k)];
        }
    }

    resetParticles() {
        for (const p of this.particles) {
            p.active = false;
            p.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        }
    }
}

module.exports = DesertBloom;
