const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');

// AQUARIUM — cozy tank toy with light progression
// Watch colorful fish swim, tap to feed, earn coins when they're happy,
// unlock new fish & decor from a simple shop.

const TUNING = {
    TICK_RATE: 20, // MUST match metadata().tickRate
    MAX_FISH: 10,
    MAX_FOOD: 12,
    MAX_BUBBLES: 28,
    MAX_DECOR: 8,

    TANK: {
        waterTop: 14,
        sandTop: 88,
        wallPad: 4
    },
    FISH: {
        hungerDrainPerSecond: 0.035,
        eatRadius: 5,
        seekSpeedPerSecond: 22,
        cruiseSpeedPerSecond: 9,
        bobAmp: 1.4,
        bobHz: 0.55,
        happyThreshold: 0.55,
        coinIntervalSeconds: 2.2,
        coinHappyAmount: 1,
        feedBonusCoins: 1
    },
    FOOD: {
        fallPerSecond: 11,
        lifeSeconds: 9
    },
    BUBBLE: {
        risePerSecond: 8,
        spawnEverySeconds: 0.45
    },
    ALGAE: {
        buildPerSecond: 0.008,
        cleanAmount: 0.35
    }
};

const TICK_RATE = TUNING.TICK_RATE;
const DT = 1 / TICK_RATE;
const ticksFor = (seconds) => Math.max(1, Math.round(seconds * TICK_RATE));

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

const INK = [255, 252, 245, 255];
const INK_DIM = [210, 230, 240, 255];
const GOLD = [255, 210, 90, 255];
const PANEL_EDGE = [120, 220, 255, 255];
const SAND = [230, 200, 130, 255];
const SAND_DARK = [200, 160, 95, 255];

// Shop catalog — unlocks are one-time purchases.
const SHOP = [
    { id: 'tetra', kind: 'fish', name: 'NEON TETRA', cost: 12, blurb: 'Tiny & zippy' },
    { id: 'angel', kind: 'fish', name: 'ANGELFISH', cost: 22, blurb: 'Graceful fins' },
    { id: 'betta', kind: 'fish', name: 'BETTA', cost: 35, blurb: 'Royal flare' },
    { id: 'plant', kind: 'decor', name: 'KELP', cost: 10, blurb: 'Swaying green' },
    { id: 'rock', kind: 'decor', name: 'ROCK', cost: 8, blurb: 'Cozy cave' },
    { id: 'chest', kind: 'decor', name: 'CHEST', cost: 28, blurb: 'Bubbly treasure' },
    { id: 'lamp', kind: 'upgrade', name: 'NIGHT LAMP', cost: 18, blurb: 'Soft purple glow' }
];

const SPECIES = {
    goldie: {
        name: 'GOLDFISH',
        body: [255, 150, 60, 255],
        fin: [255, 100, 40, 255],
        size: 3.2,
        speed: 1.0,
        glowBlur: 10
    },
    tetra: {
        name: 'NEON TETRA',
        body: [40, 230, 200, 255],
        fin: [255, 80, 160, 255],
        size: 2.2,
        speed: 1.35,
        glowBlur: 12
    },
    angel: {
        name: 'ANGELFISH',
        body: [240, 240, 255, 255],
        fin: [160, 120, 255, 255],
        size: 3.8,
        speed: 0.75,
        glowBlur: 14
    },
    betta: {
        name: 'BETTA',
        body: [255, 70, 140, 255],
        fin: [255, 190, 60, 255],
        size: 3.4,
        speed: 0.9,
        glowBlur: 16
    }
};

const fishPoly = (x, y, facing, size, kind) => {
    // Simple fish silhouette: body diamond + tail, facing ±1.
    const s = size;
    const f = facing >= 0 ? 1 : -1;
    if (kind === 'angel') {
        return [
            [x - f * s * 0.2, y - s * 1.1],
            [x + f * s * 0.9, y],
            [x - f * s * 0.2, y + s * 1.1],
            [x - f * s * 1.1, y + s * 0.35],
            [x - f * s * 0.7, y],
            [x - f * s * 1.1, y - s * 0.35],
            [x - f * s * 0.2, y - s * 1.1]
        ];
    }
    return [
        [x + f * s, y],
        [x + f * s * 0.15, y - s * 0.55],
        [x - f * s * 0.55, y - s * 0.25],
        [x - f * s * 1.15, y - s * 0.55],
        [x - f * s * 0.75, y],
        [x - f * s * 1.15, y + s * 0.55],
        [x - f * s * 0.55, y + s * 0.25],
        [x + f * s * 0.15, y + s * 0.55],
        [x + f * s, y]
    ];
};

const plantPoly = (x, baseY, h, phase) => {
    const sway = Math.sin(phase) * 2.2;
    return [
        [x - 1.2, baseY],
        [x - 0.4 + sway * 0.3, baseY - h * 0.45],
        [x + sway, baseY - h],
        [x + 1.2 + sway * 0.3, baseY - h * 0.4],
        [x + 1.4, baseY],
        [x - 1.2, baseY]
    ];
};

class Aquarium extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Aquarium',
            author: 'Demo',
            description: 'A cozy colorful tank. Feed fish, earn coins, unlock new friends and decor.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 20 // keep in sync with TUNING.TICK_RATE
        };
    }

    constructor() {
        super();

        this._t = 0;
        this.dirty = false;
        this.coins = 8;
        this.unlocked = { goldie: true };
        this.nightLamp = false;
        this.algae = 0;
        this.mood = 1;
        this.nextCoinAt = ticksFor(TUNING.FISH.coinIntervalSeconds);
        this.nextBubbleAt = 0;
        this.toast = '';
        this.toastUntil = 0;
        this.shopOpen = false;
        this.fish = [];
        this.food = [];
        this.bubbles = [];
        this.decor = [];

        // --- backdrop layers ---
        this.base = this.rect(0, 0, 100, 100, [12, 40, 70, 255]);

        // Soft depth bands (fake water gradient).
        this.waterBands = [
            this.rect(0, 0, 100, 28, [70, 170, 220, 255]),
            this.rect(0, 24, 100, 28, [40, 130, 200, 255]),
            this.rect(0, 48, 100, 28, [25, 95, 170, 255]),
            this.rect(0, 72, 100, 28, [18, 70, 140, 255])
        ];

        this.nightWash = this.rect(0, 0, 100, 100, [40, 10, 80, 0], {
            color: [80, 40, 140, 0]
        });

        this.sand = this.rect(0, TUNING.TANK.sandTop, 100, 100 - TUNING.TANK.sandTop, SAND);
        this.sandRipple = this.rect(0, TUNING.TANK.sandTop - 1.2, 100, 2.2, SAND_DARK);

        this.decorLayer = this.container();
        this.bubbleLayer = this.container();
        this.foodLayer = this.container();
        this.fishLayer = this.container();
        this.algaeVeil = this.rect(0, 0, 100, 100, [40, 120, 50, 0], {
            color: [255, 255, 255, 0]
        });

        // Tap catcher above world, below HUD buttons.
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, TUNING.TANK.waterTop, 100, TUNING.TANK.sandTop - TUNING.TANK.waterTop),
            fill: [0, 0, 0, 0],
            onClick: (playerId, x, y) => this.dropFood(x, y)
        });

        this.hudLayer = this.container();
        this.shopLayer = this.container();

        this.base.addChildren(
            ...this.waterBands,
            this.nightWash,
            this.sand,
            this.sandRipple,
            this.decorLayer,
            this.bubbleLayer,
            this.foodLayer,
            this.fishLayer,
            this.algaeVeil,
            this.tapCatcher,
            this.hudLayer,
            this.shopLayer
        );

        // Pools
        this.initBubblePool();
        this.initFoodPool();
        this.initFishPool();
        this.initDecorPool();

        // Starter tank: two goldfish + a free kelp.
        this.spawnFish('goldie', 28, 50);
        this.spawnFish('goldie', 62, 58);
        this.placeDecor('plant', 78, TUNING.TANK.sandTop);

        this.buildHud();
        this.showToast('Tap the water to feed your fish!');
        this.dirty = true;
    }

    getLayers() {
        return [{ root: this.base }];
    }

    // ---- node helpers ----

    container() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    rect(x, y, w, h, fill, opts = {}) {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill,
            ...opts
        });
    }

    text(str, x, y, size, color, align = 'left') {
        return new GameNode.Text({
            textInfo: { text: str, x, y, size, align, font: 'monospace', color }
        });
    }

    setText(node, str, extra = {}) {
        const cur = node.node.text;
        if (cur.text === str && !Object.keys(extra).length) return;
        node.node.text = { ...cur, text: str, ...extra };
        this.dirty = true;
    }

    makeButton({ x, y, w, h, label, size = 1.4, fill, onClick }) {
        const bg = this.rect(x, y, w, h, fill, {
            border: 5,
            color: PANEL_EDGE,
            onClick,
            effects: glow(PANEL_EDGE, 8)
        });
        const labelY = y + (h - size * (16 / 9)) / 2;
        bg.addChild(this.text(label, x + w / 2, labelY, size, INK, 'center'));
        return bg;
    }

    showToast(msg) {
        this.toast = msg;
        this.toastUntil = this._t + ticksFor(2.4);
        this.setText(this.toastText, msg);
    }

    // ---- pools ----

    initBubblePool() {
        this.bubbles = [];
        for (let i = 0; i < TUNING.MAX_BUBBLES; i++) {
            const node = this.rect(0, 0, 0, 0, [0, 0, 0, 0], {
                color: [200, 240, 255, 0],
                effects: null
            });
            this.bubbleLayer.addChild(node);
            this.bubbles.push({ active: false, x: 0, y: 0, r: 0.6, life: 0, node });
        }
    }

    initFoodPool() {
        this.food = [];
        for (let i = 0; i < TUNING.MAX_FOOD; i++) {
            const node = this.rect(0, 0, 0, 0, [0, 0, 0, 0], {
                effects: glow(GOLD, 6)
            });
            this.foodLayer.addChild(node);
            this.food.push({ active: false, x: 0, y: 0, life: 0, node });
        }
    }

    initFishPool() {
        this.fishSlots = [];
        for (let i = 0; i < TUNING.MAX_FISH; i++) {
            const body = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: [0, 0, 0, 0],
                effects: null
            });
            const eye = this.rect(0, 0, 0, 0, [0, 0, 0, 0]);
            const heart = this.text('', 0, 0, 1.1, [255, 120, 160, 255], 'center');
            body.addChild(eye);
            body.addChild(heart);
            this.fishLayer.addChild(body);
            this.fishSlots.push({
                active: false,
                species: 'goldie',
                x: 50, y: 50, facing: 1,
                vx: 0, phase: Math.random() * Math.PI * 2,
                hunger: 0.85,
                targetFood: -1,
                turnAt: 0,
                body, eye, heart
            });
        }
    }

    initDecorPool() {
        this.decorSlots = [];
        for (let i = 0; i < TUNING.MAX_DECOR; i++) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: [0, 0, 0, 0],
                effects: null
            });
            const accent = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: [0, 0, 0, 0]
            });
            node.addChild(accent);
            this.decorLayer.addChild(node);
            this.decorSlots.push({
                active: false,
                kind: 'plant',
                x: 0, y: 0, phase: Math.random() * 10,
                node, accent
            });
        }
    }

    // ---- spawn / place ----

    spawnFish(speciesId, x, y) {
        const slot = this.fishSlots.find(s => !s.active);
        if (!slot) {
            this.showToast('Tank is full!');
            return null;
        }
        const spec = SPECIES[speciesId];
        slot.active = true;
        slot.species = speciesId;
        slot.x = x;
        slot.y = y;
        slot.facing = Math.random() < 0.5 ? -1 : 1;
        slot.vx = slot.facing * TUNING.FISH.cruiseSpeedPerSecond * spec.speed;
        slot.phase = Math.random() * Math.PI * 2;
        slot.hunger = 0.75 + Math.random() * 0.2;
        slot.targetFood = -1;
        slot.turnAt = this._t + ticksFor(2 + Math.random() * 4);
        this.drawFish(slot);
        this.dirty = true;
        return slot;
    }

    placeDecor(kind, x, y) {
        const slot = this.decorSlots.find(s => !s.active);
        if (!slot) return null;
        slot.active = true;
        slot.kind = kind;
        slot.x = x;
        slot.y = y;
        slot.phase = Math.random() * 10;
        this.drawDecor(slot);
        this.dirty = true;
        return slot;
    }

    drawFish(f) {
        if (!f.active) {
            f.body.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            f.body.node.fill = [0, 0, 0, 0];
            f.body.node.effects = null;
            f.eye.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            f.heart.node.text = { ...f.heart.node.text, text: '' };
            return;
        }
        const spec = SPECIES[f.species];
        const bob = Math.sin(f.phase) * TUNING.FISH.bobAmp;
        const y = f.y + bob;
        f.body.node.coordinates2d = fishPoly(f.x, y, f.facing, spec.size, f.species);
        f.body.node.fill = spec.body;
        f.body.node.effects = glow(spec.body, spec.glowBlur);

        const eyeX = f.x + f.facing * spec.size * 0.45;
        const eyeY = y - spec.size * 0.12;
        f.eye.node.coordinates2d = ShapeUtils.rectangle(eyeX - 0.35, eyeY - 0.35, 0.7, 0.7);
        f.eye.node.fill = [20, 30, 50, 255];

        if (f.hunger < 0.35) {
            f.heart.node.text = {
                text: '...',
                x: f.x,
                y: y - spec.size - 1.5,
                size: 1.1,
                align: 'center',
                font: 'monospace',
                color: [255, 180, 120, 255]
            };
        } else if (f.hunger > 0.85) {
            f.heart.node.text = {
                text: '<3',
                x: f.x,
                y: y - spec.size - 1.5,
                size: 1.1,
                align: 'center',
                font: 'monospace',
                color: [255, 120, 170, 255]
            };
        } else {
            f.heart.node.text = { ...f.heart.node.text, text: '' };
        }
    }

    drawDecor(d) {
        if (!d.active) {
            d.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            d.node.node.fill = [0, 0, 0, 0];
            d.node.node.effects = null;
            d.accent.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            d.accent.node.fill = [0, 0, 0, 0];
            return;
        }
        if (d.kind === 'plant') {
            const h = 16 + Math.sin(d.phase) * 1.5;
            d.node.node.coordinates2d = plantPoly(d.x, d.y, h, d.phase);
            d.node.node.fill = [60, 200, 110, 255];
            d.node.node.effects = glow([80, 255, 140, 255], 8);
            d.accent.node.coordinates2d = plantPoly(d.x + 2.2, d.y, h * 0.75, d.phase + 1.2);
            d.accent.node.fill = [40, 170, 90, 255];
        } else if (d.kind === 'rock') {
            d.node.node.coordinates2d = [
                [d.x - 5, d.y], [d.x - 3, d.y - 5], [d.x + 2, d.y - 6.5],
                [d.x + 6, d.y - 3], [d.x + 5, d.y], [d.x - 5, d.y]
            ];
            d.node.node.fill = [120, 130, 150, 255];
            d.node.node.effects = null;
            d.accent.node.coordinates2d = ShapeUtils.rectangle(d.x - 1.5, d.y - 3.5, 2.2, 1.4);
            d.accent.node.fill = [90, 100, 120, 255];
        } else if (d.kind === 'chest') {
            d.node.node.coordinates2d = ShapeUtils.rectangle(d.x - 4, d.y - 4.5, 8, 4.5);
            d.node.node.fill = [180, 110, 40, 255];
            d.node.node.effects = glow(GOLD, 12);
            d.accent.node.coordinates2d = ShapeUtils.rectangle(d.x - 3.2, d.y - 3.6, 6.4, 1.4);
            d.accent.node.fill = GOLD;
        }
    }

    // ---- HUD / shop ----

    buildHud() {
        this.hudLayer.clearChildren();

        this.titleText = this.text('AQUARIUM', 4, 2.2, 2.2, INK, 'left');
        this.coinText = this.text('', 50, 2.4, 1.8, GOLD, 'center');
        this.moodText = this.text('', 96, 2.6, 1.4, INK_DIM, 'right');
        this.toastText = this.text('', 50, 8.5, 1.5, INK, 'center');

        this.feedHint = this.text('tap water to feed', 50, 96.5, 1.2, INK_DIM, 'center');

        this.shopBtn = this.makeButton({
            x: 78, y: 1.5, w: 10, h: 6.5,
            label: 'SHOP', size: 1.5,
            fill: [20, 90, 130, 255],
            onClick: () => this.toggleShop()
        });
        this.cleanBtn = this.makeButton({
            x: 89.5, y: 1.5, w: 8, h: 6.5,
            label: 'CLEAN', size: 1.2,
            fill: [30, 120, 90, 255],
            onClick: () => this.cleanTank()
        });

        this.hudLayer.addChildren(
            this.titleText, this.coinText, this.moodText, this.toastText,
            this.feedHint, this.shopBtn, this.cleanBtn
        );
        this.refreshHud();
    }

    refreshHud() {
        this.setText(this.coinText, `COINS  ${this.coins}`);
        const moodLabel = this.mood > 0.75 ? 'HAPPY' : this.mood > 0.4 ? 'OKAY' : 'HUNGRY';
        const moodColor = this.mood > 0.75 ? [120, 255, 180, 255]
            : this.mood > 0.4 ? INK_DIM
            : [255, 160, 100, 255];
        this.setText(this.moodText, moodLabel, { color: moodColor });
    }

    toggleShop() {
        this.shopOpen = !this.shopOpen;
        if (this.shopOpen) this.buildShop();
        else this.shopLayer.clearChildren();
        this.dirty = true;
    }

    buildShop() {
        this.shopLayer.clearChildren();
        const panel = this.rect(8, 14, 84, 70, [12, 36, 58, 245], {
            border: 6,
            color: PANEL_EDGE,
            effects: glow(PANEL_EDGE, 10)
        });
        panel.addChild(this.text('SHOP — make your tank prettier', 50, 17, 2, INK, 'center'));
        panel.addChild(this.text(`You have ${this.coins} coins`, 50, 22, 1.4, GOLD, 'center'));

        SHOP.forEach((item, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = 12 + col * 40;
            const y = 27 + row * 12;
            const owned = item.kind === 'upgrade'
                ? this.nightLamp
                : !!this.unlocked[item.id];
            const canBuy = !owned && this.coins >= item.cost;
            const fill = owned ? [40, 70, 50, 255]
                : canBuy ? [25, 100, 140, 255]
                : [40, 50, 60, 255];
            const label = owned
                ? `${item.name}  OWNED`
                : `${item.name}  ${item.cost}c`;
            const btn = this.makeButton({
                x, y, w: 36, h: 9,
                label,
                size: 1.25,
                fill,
                onClick: () => this.buy(item.id)
            });
            panel.addChild(btn);
            panel.addChild(this.text(item.blurb, x + 18, y + 6.8, 1.0, INK_DIM, 'center'));
        });

        panel.addChild(this.makeButton({
            x: 38, y: 74, w: 24, h: 7,
            label: 'CLOSE', size: 1.5,
            fill: [80, 50, 70, 255],
            onClick: () => this.toggleShop()
        }));

        this.shopLayer.addChild(panel);
    }

    buy(id) {
        const item = SHOP.find(s => s.id === id);
        if (!item) return;

        if (item.kind === 'upgrade') {
            if (this.nightLamp) {
                this.showToast('Night lamp already on!');
                return;
            }
            if (this.coins < item.cost) {
                this.showToast('Need more coins — keep feeding!');
                return;
            }
            this.coins -= item.cost;
            this.nightLamp = true;
            this.applyNightLamp();
            this.showToast('Night lamp glowing...');
        } else if (item.kind === 'fish') {
            if (this.unlocked[id]) {
                // Already unlocked — buy another of this species.
                if (this.coins < Math.ceil(item.cost * 0.6)) {
                    this.showToast('Need more coins for another fish');
                    return;
                }
                if (!this.fishSlots.some(s => !s.active)) {
                    this.showToast('Tank is full!');
                    return;
                }
                this.coins -= Math.ceil(item.cost * 0.6);
                const x = 15 + Math.random() * 70;
                const y = 30 + Math.random() * 45;
                this.spawnFish(id, x, y);
                this.showToast(`Another ${SPECIES[id].name.toLowerCase()} joined!`);
            } else {
                if (this.coins < item.cost) {
                    this.showToast('Need more coins — keep feeding!');
                    return;
                }
                this.coins -= item.cost;
                this.unlocked[id] = true;
                const x = 20 + Math.random() * 60;
                const y = 32 + Math.random() * 40;
                this.spawnFish(id, x, y);
                this.showToast(`${SPECIES[id].name} unlocked!`);
            }
        } else if (item.kind === 'decor') {
            if (this.coins < item.cost) {
                this.showToast('Need more coins — keep feeding!');
                return;
            }
            if (!this.decorSlots.some(s => !s.active)) {
                this.showToast('No more room for decor');
                return;
            }
            this.coins -= item.cost;
            this.unlocked[id] = true;
            const x = 12 + Math.random() * 76;
            this.placeDecor(id, x, TUNING.TANK.sandTop);
            this.showToast(`${item.name} placed!`);
        }

        this.refreshHud();
        if (this.shopOpen) this.buildShop();
        this.dirty = true;
    }

    applyNightLamp() {
        // Soft purple wash via color-alpha fade trick.
        this.nightWash.node.fill = [50, 20, 90, 255];
        this.nightWash.node.color = [120, 60, 180, 90];
        this.dirty = true;
    }

    cleanTank() {
        if (this.algae < 0.08) {
            this.showToast('Glass is already sparkling');
            return;
        }
        this.algae = Math.max(0, this.algae - TUNING.ALGAE.cleanAmount);
        this.showToast('Sparkle! Algae wiped away');
        this.drawAlgae();
        this.dirty = true;
    }

    drawAlgae() {
        // Green veil fades in via color alpha (fill stays opaque hue).
        const a = clampByte(this.algae * 110);
        this.algaeVeil.node.fill = [50, 140, 60, 255];
        this.algaeVeil.node.color = [255, 255, 255, a];
        if (a < 4) {
            this.algaeVeil.node.fill = [0, 0, 0, 0];
            this.algaeVeil.node.color = [255, 255, 255, 0];
        }
    }

    // ---- feeding ----

    dropFood(x, y) {
        if (this.shopOpen) return;
        if (y < TUNING.TANK.waterTop + 2 || y > TUNING.TANK.sandTop - 2) return;
        const flake = this.food.find(f => !f.active);
        if (!flake) return;
        flake.active = true;
        flake.x = clamp(x, TUNING.TANK.wallPad + 2, 100 - TUNING.TANK.wallPad - 2);
        flake.y = clamp(y, TUNING.TANK.waterTop + 3, TUNING.TANK.sandTop - 8);
        flake.life = TUNING.FOOD.lifeSeconds;
        flake.node.node.coordinates2d = ShapeUtils.rectangle(flake.x - 0.6, flake.y - 0.6, 1.2, 1.2);
        flake.node.node.fill = GOLD;
        flake.node.node.effects = glow(GOLD, 8);

        // Nearest hungry-ish fish notices.
        let best = null;
        let bestD = 999;
        for (const f of this.fishSlots) {
            if (!f.active) continue;
            const d = Math.hypot(f.x - flake.x, f.y - flake.y);
            if (d < bestD) {
                bestD = d;
                best = f;
            }
        }
        if (best) best.targetFood = this.food.indexOf(flake);

        this.dirty = true;
    }

    // ---- simulation ----

    tick() {
        this._t++;
        let changed = false;

        changed = this.tickFood() || changed;
        changed = this.tickFish() || changed;
        changed = this.tickBubbles() || changed;
        changed = this.tickDecor() || changed;

        // Algae creeps slowly.
        this.algae = clamp(this.algae + TUNING.ALGAE.buildPerSecond * DT, 0, 1);
        if (this._t % ticksFor(1) === 0) {
            this.drawAlgae();
            changed = true;
        }

        // Mood + coins.
        const living = this.fishSlots.filter(f => f.active);
        if (living.length) {
            this.mood = living.reduce((s, f) => s + f.hunger, 0) / living.length;
        } else {
            this.mood = 0;
        }

        if (this._t >= this.nextCoinAt) {
            this.nextCoinAt = this._t + ticksFor(TUNING.FISH.coinIntervalSeconds);
            if (this.mood >= TUNING.FISH.happyThreshold && living.length) {
                this.coins += TUNING.FISH.coinHappyAmount;
                changed = true;
            }
            this.refreshHud();
        }

        if (this.toastUntil && this._t >= this.toastUntil) {
            this.toastUntil = 0;
            this.setText(this.toastText, '');
            changed = true;
        }

        // Occasional hud refresh for mood label.
        if (this._t % ticksFor(0.5) === 0) this.refreshHud();

        if (changed || this.dirty) {
            this.base.node.onStateChange();
            this.dirty = false;
        }
    }

    tickFood() {
        let changed = false;
        for (const flake of this.food) {
            if (!flake.active) continue;
            changed = true;
            flake.life -= DT;
            flake.y += TUNING.FOOD.fallPerSecond * DT;
            if (flake.y >= TUNING.TANK.sandTop - 1.5 || flake.life <= 0) {
                flake.active = false;
                flake.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                flake.node.node.fill = [0, 0, 0, 0];
                flake.node.node.effects = null;
                continue;
            }
            flake.node.node.coordinates2d = ShapeUtils.rectangle(flake.x - 0.6, flake.y - 0.6, 1.2, 1.2);
        }
        return changed;
    }

    tickFish() {
        let changed = false;
        const pad = TUNING.TANK.wallPad + 3;
        const top = TUNING.TANK.waterTop + 6;
        const bot = TUNING.TANK.sandTop - 5;

        for (const f of this.fishSlots) {
            if (!f.active) continue;
            changed = true;
            const spec = SPECIES[f.species];
            f.phase += DT * Math.PI * 2 * TUNING.FISH.bobHz;
            f.hunger = clamp(f.hunger - TUNING.FISH.hungerDrainPerSecond * DT, 0, 1);

            // Seek food if assigned and still active.
            let seeking = false;
            if (f.targetFood >= 0) {
                const flake = this.food[f.targetFood];
                if (flake && flake.active) {
                    seeking = true;
                    const dx = flake.x - f.x;
                    const dy = flake.y - f.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    f.facing = dx >= 0 ? 1 : -1;
                    const spd = TUNING.FISH.seekSpeedPerSecond * spec.speed;
                    f.x += (dx / dist) * spd * DT;
                    f.y += (dy / dist) * spd * DT;
                    if (dist < TUNING.FISH.eatRadius) {
                        flake.active = false;
                        flake.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                        flake.node.node.fill = [0, 0, 0, 0];
                        flake.node.node.effects = null;
                        f.targetFood = -1;
                        f.hunger = clamp(f.hunger + 0.45, 0, 1);
                        this.coins += TUNING.FISH.feedBonusCoins;
                        this.refreshHud();
                    }
                } else {
                    f.targetFood = -1;
                }
            }

            if (!seeking) {
                // Cruise + occasional turn.
                if (this._t >= f.turnAt) {
                    f.facing *= -1;
                    f.vx = f.facing * TUNING.FISH.cruiseSpeedPerSecond * spec.speed * (0.7 + Math.random() * 0.5);
                    f.turnAt = this._t + ticksFor(2.5 + Math.random() * 5);
                    // Drift vertically a bit.
                    f.y += (Math.random() - 0.5) * 6;
                }
                f.x += f.vx * DT;
            }

            if (f.x < pad) {
                f.x = pad;
                f.facing = 1;
                f.vx = Math.abs(f.vx) || TUNING.FISH.cruiseSpeedPerSecond * spec.speed;
            } else if (f.x > 100 - pad) {
                f.x = 100 - pad;
                f.facing = -1;
                f.vx = -(Math.abs(f.vx) || TUNING.FISH.cruiseSpeedPerSecond * spec.speed);
            }
            f.y = clamp(f.y, top, bot);

            this.drawFish(f);
        }
        return changed;
    }

    tickBubbles() {
        let changed = false;
        if (this._t >= this.nextBubbleAt) {
            this.nextBubbleAt = this._t + ticksFor(TUNING.BUBBLE.spawnEverySeconds);
            const b = this.bubbles.find(x => !x.active);
            if (b) {
                b.active = true;
                b.x = 8 + Math.random() * 84;
                b.y = TUNING.TANK.sandTop - 2;
                b.r = 0.4 + Math.random() * 0.7;
                b.life = 3 + Math.random() * 2;
                // Chest decor boosts bubbles nearby.
                for (const d of this.decorSlots) {
                    if (d.active && d.kind === 'chest' && Math.abs(d.x - b.x) < 8) {
                        b.x = d.x + (Math.random() - 0.5) * 3;
                        b.r *= 1.2;
                    }
                }
            }
        }

        for (const b of this.bubbles) {
            if (!b.active) continue;
            changed = true;
            b.y -= TUNING.BUBBLE.risePerSecond * DT;
            b.x += Math.sin(this._t * 0.08 + b.x) * 2 * DT;
            b.life -= DT;
            if (b.y < TUNING.TANK.waterTop + 2 || b.life <= 0) {
                b.active = false;
                b.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                b.node.node.fill = [0, 0, 0, 0];
                b.node.node.color = [255, 255, 255, 0];
                b.node.node.effects = null;
                continue;
            }
            const k = clamp(b.life / 4, 0, 1);
            b.node.node.coordinates2d = ShapeUtils.rectangle(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
            b.node.node.fill = [180, 230, 255, 255];
            b.node.node.color = [255, 255, 255, clampByte(180 * k)];
            b.node.node.effects = null;
        }
        return changed;
    }

    tickDecor() {
        let changed = false;
        for (const d of this.decorSlots) {
            if (!d.active || d.kind !== 'plant') continue;
            d.phase += DT * 1.4;
            this.drawDecor(d);
            changed = true;
        }
        return changed;
    }
}

module.exports = Aquarium;
