const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');
const CATALOG = require('./data/catalog');

const TICK_RATE = 60; // MUST match metadata().tickRate literal.
const DT = 1 / TICK_RATE;
const MAX_PLAYERS = 8;
const MAX_FISH = 224;
const MAX_FOOD = 240;
const MAX_ACCESSORIES = 160;
const MAX_BUBBLES = 140;
const MAX_FLOATERS = 72;
const MAX_SPECKS = 96;
const MAX_STATIC_WEEDS = 132;
const MAX_STATIC_ROCKS = 48;
const MAX_POINTS = 9000000000000000;

const COLORS = {
    waterTop: [8, 48, 102, 255],
    waterMid: [15, 88, 151, 255],
    waterLow: [31, 128, 178, 255],
    light: [122, 230, 245, 255],
    sandBack: [228, 195, 133, 255],
    sandFront: [207, 168, 102, 255],
    rockA: [76, 91, 103, 255],
    rockB: [52, 66, 80, 255],
    weedA: [37, 166, 115, 255],
    weedB: [76, 202, 142, 255],
    coralA: [255, 126, 107, 255],
    coralB: [235, 85, 166, 255],
    coralC: [250, 194, 80, 255],
    white: [244, 248, 250, 255],
    dark: [13, 25, 42, 255],
    panel: [15, 33, 53, 242],
    panelSoft: [34, 65, 88, 246],
    button: [46, 103, 137, 255],
    buttonHot: [58, 139, 145, 255],
    buttonDim: [53, 67, 81, 255],
    gold: [255, 210, 73, 255],
    transparent: [0, 0, 0, 0]
};

const PLAYER_COLORS = [
    [255, 153, 79, 255],
    [101, 221, 255, 255],
    [255, 107, 166, 255],
    [153, 237, 124, 255],
    [194, 138, 255, 255],
    [255, 221, 102, 255],
    [106, 255, 211, 255],
    [255, 129, 108, 255]
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const TAU = Math.PI * 2;

const makeShape = (coordinates2d, fill, extra = {}) => new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d,
    fill,
    ...extra
});

const makeText = (text, x, y, size, color, align = 'left', playerIds) => new GameNode.Text({
    textInfo: {
        text,
        x,
        y,
        size,
        align,
        color,
        font: 'monospace'
    },
    playerIds
});

const polyCircle = (cx, cy, radius, sides = 14) => {
    const points = [];
    for (let i = 0; i <= sides; i++) {
        const a = i / sides * TAU;
        points.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    }
    return points;
};

const diamond = (cx, cy, rx, ry) => [
    [cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry]
];

const thickLine = (x1, y1, x2, y2, width) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(a) * width / 2;
    const dy = Math.cos(a) * width / 2;
    return [
        [x1 - dx, y1 + dy], [x2 - dx, y2 + dy],
        [x2 + dx, y2 - dy], [x1 + dx, y1 - dy], [x1 - dx, y1 + dy]
    ];
};

const hideShape = (node) => {
    // Zero geometry and fill only. Do not overwrite `color`: pooled shapes such as
    // fish are repainted by changing `fill`, and the real renderer retains a
    // transparent color value between frames.
    node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
    node.node.fill = COLORS.transparent;
};

const updateText = (node, patch) => {
    const current = node.node.text && typeof node.node.text === 'object'
        ? node.node.text
        : {
            text: typeof node.node.text === 'string' ? node.node.text : '',
            x: Number.isFinite(node.node.x) ? node.node.x : 0,
            y: Number.isFinite(node.node.y) ? node.node.y : 0,
            size: Number.isFinite(node.node.size) ? node.node.size : 1,
            align: node.node.align || 'left',
            color: node.node.color || COLORS.white,
            font: node.node.font || 'monospace'
        };
    node.node.text = { ...current, ...patch };
};

const setText = (node, text) => updateText(node, { text: String(text) });
const setTextColor = (node, color) => updateText(node, { color });
const setTextPosition = (node, x, y) => updateText(node, { x, y });
const hideText = (node) => setText(node, '');

const formatNumber = (value) => {
    const n = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    if (n < 1000) return String(n);
    const units = [
        [1e15, 'Q'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']
    ];
    for (const [size, suffix] of units) {
        if (n >= size) {
            const scaled = n / size;
            const digits = scaled >= 100 ? 0 : (scaled >= 10 ? 1 : 2);
            let shown = scaled.toFixed(digits);
            while (shown.indexOf('.') >= 0 && shown.endsWith('0')) shown = shown.slice(0, -1);
            if (shown.endsWith('.')) shown = shown.slice(0, -1);
            return shown + suffix;
        }
    }
    return String(n);
};

const costFor = (baseCost, bought, growth) => {
    const raw = Math.floor(baseCost * Math.pow(growth, bought));
    return clamp(raw, 1, MAX_POINTS);
};

const fishBody = (x, y, dir, scale, species) => {
    const length = species.length * scale;
    const height = species.height * scale;
    const nose = x + dir * length * 0.58;
    const tail = x - dir * length * 0.6;
    return [
        [nose, y],
        [x + dir * length * 0.25, y - height * 0.54],
        [x - dir * length * 0.25, y - height * 0.48],
        [tail, y - height * 0.1],
        [tail - dir * length * 0.08, y],
        [tail, y + height * 0.1],
        [x - dir * length * 0.25, y + height * 0.48],
        [x + dir * length * 0.25, y + height * 0.54],
        [nose, y]
    ];
};

const fishTail = (x, y, dir, scale, species) => {
    const length = species.length * scale;
    const height = species.height * scale;
    const base = x - dir * length * 0.52;
    const tip = x - dir * length * 0.95;
    return [
        [base, y], [tip, y - height * 0.62],
        [tip + dir * length * 0.11, y], [tip, y + height * 0.62], [base, y]
    ];
};

const fishFin = (x, y, dir, scale, species, upper) => {
    const length = species.length * scale;
    const height = species.height * scale;
    const sign = upper ? -1 : 1;
    return [
        [x - dir * length * 0.08, y + sign * height * 0.3],
        [x - dir * length * 0.24, y + sign * height * 0.94],
        [x + dir * length * 0.18, y + sign * height * 0.4],
        [x - dir * length * 0.08, y + sign * height * 0.3]
    ];
};

const fishStripe = (x, y, dir, scale, species, offset, width) => {
    const length = species.length * scale;
    const height = species.height * scale;
    const cx = x + dir * length * offset;
    return [
        [cx - dir * length * width, y - height * 0.47],
        [cx + dir * length * width, y - height * 0.36],
        [cx + dir * length * width, y + height * 0.36],
        [cx - dir * length * width, y + height * 0.47],
        [cx - dir * length * width, y - height * 0.47]
    ];
};

class AquariumForever extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Aquarium Forever: Bigger Tank',
            author: 'Homegames',
            description: 'A shared endless aquarium clicker with persistent tank expansions, panning, zooming, fish, and decorations.',
            services: ['multiplayer'],
            aspectRatio: { x: 16, y: 9 },
            tickRate: 60,
            maxPlayers: 8
        };
    }

    constructor() {
        super();
        this.time = 0;
        this.nextAmbientBubble = 0.2;
        this.tankTier = 0;
        this.camera = { x: 50, targetX: 50, zoom: 1, targetZoom: 1, velocity: 0 };
        this.players = {};
        this.playerOrder = [];
        this.uiSlots = [];
        this.fish = [];
        this.food = [];
        this.accessories = [];
        this.bubbles = [];
        this.floaters = [];
        this.specks = [];
        this.caustics = [];
        this.staticWeeds = [];
        this.staticRocks = [];
        this.staticCorals = [];
        this.tankEdges = [];
        this.fishPurchases = { guppy: 0, clown: 0, tang: 0, angel: 0, puffer: 0 };
        this.decorCounts = { plant: 0, coral: 0, bubbler: 0, castle: 0 };
        this.base = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), COLORS.waterMid);

        this.buildBackground();
        this.buildStaticDecor();
        this.buildAccessoryPool();
        this.buildBubblePool();
        this.buildFoodPool();
        this.buildFishPool();
        this.buildFloaterPool();
        this.buildWorldClickSurface();
        this.buildCameraControls();

        this.addFish('guppy', 0, true);
        this.addFish('guppy', 0, true);
        this.addFish('guppy', 0, true);
        this.addFish('clown', 0, true);
        this.addFish('clown', 0, true);
        this.addFish('tang', 0, true);
        this.renderAll(true);
    }

    getLayers() {
        return [{ root: this.base }];
    }

    currentTank() {
        return CATALOG.tanks[this.tankTier] || CATALOG.tanks[0];
    }

    nextTank() {
        return CATALOG.tanks[this.tankTier + 1] || null;
    }

    tankBounds() {
        const half = this.currentTank().width / 2;
        return { min: 50 - half, max: 50 + half };
    }

    maxTankBounds() {
        const tank = CATALOG.tanks[CATALOG.tanks.length - 1];
        const half = tank.width / 2;
        return { min: 50 - half, max: 50 + half };
    }

    minZoom() {
        return Math.max(0.34, 100 / this.currentTank().width);
    }

    viewWidth() {
        return 100 / this.camera.zoom;
    }

    worldToScreenX(worldX) {
        return 50 + (worldX - this.camera.x) * this.camera.zoom;
    }

    screenToWorldX(screenX) {
        return this.camera.x + (screenX - 50) / this.camera.zoom;
    }

    visibleWorldBounds(margin = 0) {
        const half = this.viewWidth() / 2 + margin / Math.max(0.01, this.camera.zoom);
        return { min: this.camera.x - half, max: this.camera.x + half };
    }

    clampCamera() {
        const bounds = this.tankBounds();
        const half = Math.min(this.viewWidth() / 2, this.currentTank().width / 2);
        const minX = bounds.min + half;
        const maxX = bounds.max - half;
        if (minX > maxX) {
            this.camera.x = 50;
            this.camera.targetX = 50;
            return;
        }
        this.camera.targetX = clamp(this.camera.targetX, minX, maxX);
        this.camera.x = clamp(this.camera.x, minX, maxX);
    }

    panCamera(direction) {
        if (this.tankTier <= 0) return;
        this.camera.targetX += direction * this.viewWidth() * 0.62;
        this.clampCamera();
    }

    zoomCamera(delta) {
        if (this.tankTier <= 0 && delta < 0) return;
        this.camera.targetZoom = clamp(this.camera.targetZoom + delta, this.minZoom(), 1.35);
        this.camera.zoom = clamp(this.camera.zoom, this.minZoom(), 1.35);
        this.clampCamera();
    }

    centerCamera() {
        this.camera.targetX = 50;
        this.camera.targetZoom = 1;
        this.camera.velocity = 0;
        this.clampCamera();
    }

    worldXVisible(worldX, margin = 8) {
        const sx = this.worldToScreenX(worldX);
        return sx >= -margin && sx <= 100 + margin;
    }

    decorMax(item) {
        if (item.id === 'flakes') return item.max;
        return Math.floor(item.max * this.currentTank().decorScale);
    }

    economyCost(baseCost, bought, growth) {
        return costFor(baseCost * this.currentTank().storeScale, bought, growth);
    }

    handleNewPlayer({ playerId, info }) {
        let player = this.players[playerId];
        if (!player) {
            const colorIndex = this.playerOrder.length % PLAYER_COLORS.length;
            player = {
                id: playerId,
                name: info && info.name ? String(info.name).slice(0, 20) : `PLAYER ${playerId}`,
                color: PLAYER_COLORS[colorIndex],
                points: 20,
                totalEarned: 0,
                foodEaten: 0,
                foodLevel: 0,
                fishBuys: { guppy: 0, clown: 0, tang: 0, angel: 0, puffer: 0 },
                decorBuys: { plant: 0, coral: 0, bubbler: 0, castle: 0 },
                connected: true,
                shopOpen: false,
                shopTab: 'fish',
                feedCooldown: 0,
                status: '',
                statusTime: 0,
                uiTimer: 0,
                keys: {},
                ui: null
            };
            this.players[playerId] = player;
            this.playerOrder.push(playerId);
            this.assignPlayerUi(player);
        } else {
            player.connected = true;
            player.name = info && info.name ? String(info.name).slice(0, 20) : player.name;
            player.keys = {};
            if (!player.ui) this.assignPlayerUi(player);
        }
        this.updatePlayerUi(player, true);
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        const player = this.players[playerId];
        if (!player) return;
        player.connected = false;
        player.keys = {};
        player.shopOpen = false;
        this.updatePlayerUi(player, true);
        this.base.node.onStateChange();
    }

    handleKeyDown(playerId, key) {
        const player = this.players[playerId];
        if (!player) return;
        const k = String(key || '').toLowerCase();
        if (player.keys[k]) return;
        player.keys[k] = true;
        if (k === 'f' || k === ' ') this.dropFood(playerId, this.camera.x + rand(-12, 12) / this.camera.zoom, 17 + rand(-3, 5), false);
        if (k === 's' || k === 'tab') this.toggleShop(playerId);
        if (k === '1') this.setShopTab(playerId, 'fish');
        if (k === '2') this.setShopTab(playerId, 'decor');
        if (k === '3') this.setShopTab(playerId, 'tank');
        if (k === 'q' || k === '-') this.zoomCamera(-0.12);
        if (k === 'e' || k === '+' || k === '=') this.zoomCamera(0.12);
        if (k === 'h' || k === '0') this.centerCamera();
    }

    handleKeyUp(playerId, key) {
        const player = this.players[playerId];
        if (!player) return;
        delete player.keys[String(key || '').toLowerCase()];
    }

    buildBackground() {
        this.bgBands = [];
        [
            [0, 0, 100, 17, COLORS.waterTop],
            [0, 17, 100, 17, COLORS.waterMid],
            [0, 34, 100, 17, COLORS.waterMid],
            [0, 51, 100, 17, COLORS.waterLow],
            [0, 68, 100, 15, COLORS.waterLow]
        ].forEach((r) => {
            const node = makeShape(ShapeUtils.rectangle(r[0], r[1], r[2], r[3]), r[4]);
            this.bgBands.push(node);
            this.base.addChild(node);
        });

        this.causticLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        this.base.addChild(this.causticLayer);
        const maxBounds = this.maxTankBounds();
        for (let i = 0; i < 60; i++) {
            const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), [COLORS.light[0], COLORS.light[1], COLORS.light[2], 70]);
            this.caustics.push({
                node,
                x: maxBounds.min + 5 + i * ((maxBounds.max - maxBounds.min - 10) / 59),
                y: 7 + (i % 5) * 10.5,
                width: 8 + (i % 4) * 3.2,
                speed: 0.55 + (i % 6) * 0.13,
                phase: i * 0.7
            });
            this.causticLayer.addChild(node);
        }

        this.edgeLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        this.base.addChild(this.edgeLayer);
        for (let i = 0; i < 2; i++) {
            const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), [196, 238, 247, 90]);
            this.tankEdges.push(node);
            this.edgeLayer.addChild(node);
        }

        this.sandBack = makeShape([
            [0, 82], [15, 79], [31, 82], [48, 78], [66, 82], [84, 78], [100, 81],
            [100, 100], [0, 100], [0, 82]
        ], COLORS.sandBack);
        this.base.addChild(this.sandBack);

        this.rockLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        this.base.addChild(this.rockLayer);
        for (let i = 0; i < MAX_STATIC_ROCKS; i++) {
            const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), i % 2 ? COLORS.rockB : COLORS.rockA);
            this.staticRocks.push({
                node,
                x: maxBounds.min + 4 + i * ((maxBounds.max - maxBounds.min - 8) / (MAX_STATIC_ROCKS - 1)),
                y: 90 + (i % 3) * 1.4,
                width: 4.5 + (i % 5) * 0.9,
                height: 4.4 + (i % 4) * 0.8,
                phase: i * 0.93
            });
            this.rockLayer.addChild(node);
        }

        this.sandFront = makeShape([
            [0, 89], [13, 87], [28, 91], [44, 86], [61, 90], [76, 86], [91, 90], [100, 87],
            [100, 100], [0, 100], [0, 89]
        ], COLORS.sandFront);
        this.base.addChild(this.sandFront);

        this.speckLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        this.base.addChild(this.speckLayer);
        for (let i = 0; i < MAX_SPECKS; i++) {
            const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), i % 9 === 0 ? COLORS.light : COLORS.white);
            this.specks.push({
                node,
                x: rand(maxBounds.min, maxBounds.max),
                y: rand(4, 90),
                size: rand(0.08, 0.26),
                speed: rand(0.12, 0.45),
                phase: rand(0, TAU)
            });
            this.speckLayer.addChild(node);
        }
    }

    buildStaticDecor() {
        this.staticDecorLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        this.base.addChild(this.staticDecorLayer);
        const maxBounds = this.maxTankBounds();
        for (let i = 0; i < MAX_STATIC_WEEDS; i++) {
            const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), i % 2 ? COLORS.weedA : COLORS.weedB);
            this.staticWeeds.push({
                node,
                x: maxBounds.min + 2.5 + i * ((maxBounds.max - maxBounds.min - 5) / (MAX_STATIC_WEEDS - 1)),
                y: 91 + ((i % 5) - 2) * 0.32,
                height: 8 + (i % 8) * 1.7,
                width: 0.65 + (i % 4) * 0.18,
                phase: i * 0.79,
                speed: 0.65 + (i % 7) * 0.11
            });
            this.staticDecorLayer.addChild(node);
        }

        for (let i = 0; i < 24; i++) {
            const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), i % 3 === 0 ? COLORS.coralA : (i % 3 === 1 ? COLORS.coralB : COLORS.coralC));
            this.staticCorals.push({
                node,
                x: maxBounds.min + 12 + i * ((maxBounds.max - maxBounds.min - 24) / 23),
                y: 94,
                width: 2.8 + (i % 4) * 0.65,
                height: 7 + (i % 5) * 1.25,
                phase: i * 1.17
            });
            this.staticDecorLayer.addChild(node);
        }
    }

    buildAccessoryPool() {
        this.accessoryLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        this.base.addChild(this.accessoryLayer);
        for (let i = 0; i < MAX_ACCESSORIES; i++) {
            const nodes = [];
            for (let j = 0; j < 10; j++) {
                const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
                nodes.push(node);
                this.accessoryLayer.addChild(node);
            }
            this.accessories.push({
                active: false,
                type: '',
                ownerId: 0,
                x: 0,
                y: 91,
                phase: rand(0, TAU),
                nextAction: 0,
                nodes
            });
        }
    }

    buildBubblePool() {
        this.bubbleLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        this.base.addChild(this.bubbleLayer);
        for (let i = 0; i < MAX_BUBBLES; i++) {
            const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.white);
            this.bubbles.push({ node, active: false, x: 0, y: 0, speed: 0, size: 0, phase: 0 });
            this.bubbleLayer.addChild(node);
        }
    }

    buildFoodPool() {
        this.foodLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        this.base.addChild(this.foodLayer);
        for (let i = 0; i < MAX_FOOD; i++) {
            const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.gold);
            this.food.push({
                node,
                active: false,
                ownerId: 0,
                x: 0,
                y: 0,
                speed: 0,
                value: 1,
                golden: false,
                age: 0,
                settledTime: 0,
                phase: 0,
                color: COLORS.gold
            });
            this.foodLayer.addChild(node);
        }
    }

    buildFishPool() {
        this.fishLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        this.base.addChild(this.fishLayer);
        for (let i = 0; i < MAX_FISH; i++) {
            const nodes = [];
            for (let j = 0; j < 8; j++) {
                const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
                nodes.push(node);
                this.fishLayer.addChild(node);
            }
            this.fish.push({
                active: false,
                speciesId: '',
                species: null,
                ownerId: 0,
                x: 0,
                y: 0,
                dir: 1,
                scale: 1,
                speed: 0,
                phase: 0,
                targetX: 0,
                targetY: 0,
                targetTimer: 0,
                hungerPulse: 0,
                nodes
            });
        }
    }

    buildFloaterPool() {
        this.floaterLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        this.base.addChild(this.floaterLayer);
        for (let i = 0; i < MAX_FLOATERS; i++) {
            const node = makeText('', 0, 0, 1.8, COLORS.white, 'center');
            this.floaters.push({ node, active: false, x: 0, y: 0, ttl: 0, max: 0, color: COLORS.white, label: '' });
            this.floaterLayer.addChild(node);
        }
    }

    buildWorldClickSurface() {
        this.worldClickSurface = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), COLORS.transparent, {
            onClick: (playerId, x, y) => {
                const player = this.players[playerId];
                if (!player || !player.connected) return;
                if (player.shopOpen && x >= 64) return;
                if (y < 3 || y > 89) return;
                this.dropFood(playerId, this.screenToWorldX(x), y, false);
            }
        });
        this.base.addChild(this.worldClickSurface);
    }

    buildCameraControls() {
        this.cameraControlLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        this.base.addChild(this.cameraControlLayer);
        const controlFill = [13, 25, 42, 150];
        const controlLine = [235, 247, 250, 220];

        this.panLeftButton = makeShape([
            [1.2, 50], [6.7, 43.5], [9.2, 43.5], [6.2, 50], [9.2, 56.5], [6.7, 56.5], [1.2, 50]
        ], controlFill, { color: controlLine, border: 2, onClick: () => this.panCamera(-1) });
        this.panRightButton = makeShape([
            [98.8, 50], [93.3, 43.5], [90.8, 43.5], [93.8, 50], [90.8, 56.5], [93.3, 56.5], [98.8, 50]
        ], controlFill, { color: controlLine, border: 2, onClick: () => this.panCamera(1) });
        this.zoomOutButton = makeShape(polyCircle(43, 95, 2.6, 14), controlFill, {
            color: controlLine, border: 2, onClick: () => this.zoomCamera(-0.12)
        });
        this.zoomOutGlyph = makeShape(ShapeUtils.rectangle(41.7, 94.75, 2.6, 0.5), controlLine, {
            onClick: () => this.zoomCamera(-0.12)
        });
        this.centerButton = makeShape(polyCircle(50, 95, 2.6, 14), controlFill, {
            color: controlLine, border: 2, onClick: () => this.centerCamera()
        });
        this.centerGlyph = makeShape([
            [50, 92.9], [52.0, 95], [50, 97.1], [48.0, 95], [50, 92.9]
        ], controlLine, { onClick: () => this.centerCamera() });
        this.zoomInButton = makeShape(polyCircle(57, 95, 2.6, 14), controlFill, {
            color: controlLine, border: 2, onClick: () => this.zoomCamera(0.12)
        });
        this.zoomInGlyphH = makeShape(ShapeUtils.rectangle(55.7, 94.75, 2.6, 0.5), controlLine, {
            onClick: () => this.zoomCamera(0.12)
        });
        this.zoomInGlyphV = makeShape(ShapeUtils.rectangle(56.75, 93.7, 0.5, 2.6), controlLine, {
            onClick: () => this.zoomCamera(0.12)
        });
        [
            this.panLeftButton, this.panRightButton,
            this.zoomOutButton, this.zoomOutGlyph,
            this.centerButton, this.centerGlyph,
            this.zoomInButton, this.zoomInGlyphH, this.zoomInGlyphV
        ].forEach((node) => this.cameraControlLayer.addChild(node));
        this.updateCameraControls();
    }

    updateCameraControls() {
        const controls = [
            this.panLeftButton, this.panRightButton,
            this.zoomOutButton, this.zoomOutGlyph,
            this.centerButton, this.centerGlyph,
            this.zoomInButton, this.zoomInGlyphH, this.zoomInGlyphV
        ];
        if (!this.panLeftButton) return;
        if (this.tankTier <= 0) {
            controls.forEach(hideShape);
            return;
        }
        const controlFill = [13, 25, 42, 150];
        const controlLine = [235, 247, 250, 220];
        this.panLeftButton.node.fill = controlFill;
        this.panLeftButton.node.coordinates2d = [
            [1.2, 50], [6.7, 43.5], [9.2, 43.5], [6.2, 50], [9.2, 56.5], [6.7, 56.5], [1.2, 50]
        ];
        this.panRightButton.node.fill = controlFill;
        this.panRightButton.node.coordinates2d = [
            [98.8, 50], [93.3, 43.5], [90.8, 43.5], [93.8, 50], [90.8, 56.5], [93.3, 56.5], [98.8, 50]
        ];
        this.zoomOutButton.node.fill = controlFill;
        this.zoomOutButton.node.coordinates2d = polyCircle(43, 95, 2.6, 14);
        this.zoomOutGlyph.node.fill = controlLine;
        this.zoomOutGlyph.node.coordinates2d = ShapeUtils.rectangle(41.7, 94.75, 2.6, 0.5);
        this.centerButton.node.fill = controlFill;
        this.centerButton.node.coordinates2d = polyCircle(50, 95, 2.6, 14);
        this.centerGlyph.node.fill = controlLine;
        this.centerGlyph.node.coordinates2d = [[50,92.9],[52,95],[50,97.1],[48,95],[50,92.9]];
        this.zoomInButton.node.fill = controlFill;
        this.zoomInButton.node.coordinates2d = polyCircle(57, 95, 2.6, 14);
        this.zoomInGlyphH.node.fill = controlLine;
        this.zoomInGlyphH.node.coordinates2d = ShapeUtils.rectangle(55.7, 94.75, 2.6, 0.5);
        this.zoomInGlyphV.node.fill = controlLine;
        this.zoomInGlyphV.node.coordinates2d = ShapeUtils.rectangle(56.75, 93.7, 0.5, 2.6);
    }

    assignPlayerUi(player) {
        if (player.ui) return;
        let reusable = null;
        for (const playerId of this.playerOrder) {
            const candidate = this.players[playerId];
            if (candidate && !candidate.connected && candidate.ui) {
                reusable = candidate;
                break;
            }
        }
        if (reusable) {
            const ui = reusable.ui;
            reusable.ui = null;
            ui.playerId = player.id;
            ui.anchor.node.playerIds = [player.id];
            ui.root.node.playerIds = [player.id];
            player.ui = ui;
            player.shopOpen = false;
            this.setShopVisible(player, false);
            return;
        }
        if (this.uiSlots.length < MAX_PLAYERS) this.buildPlayerUi(player);
    }

    buildPlayerUi(player) {
        const ui = { playerId: player.id };
        const playerIds = [player.id];
        const anchor = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent, { playerIds });
        this.base.addChild(anchor);

        const root = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent, { playerIds });
        this.base.addChild(root);

        const scorePanel = makeShape(ShapeUtils.rectangle(2, 2, 18, 7), COLORS.panelSoft, { color: player.color, border: 3 });
        const scoreText = makeText('20', 11, 6.6, 2.6, COLORS.white, 'center');
        const shopButton = makeShape(ShapeUtils.rectangle(88, 2, 10, 7), COLORS.button, {
            color: COLORS.white,
            border: 3,
            onClick: () => this.toggleShop(ui.playerId)
        });
        const shopButtonText = makeText('SHOP', 93, 6.4, 1.55, COLORS.white, 'center');

        root.addChild(scorePanel);
        root.addChild(scoreText);
        root.addChild(shopButton);
        root.addChild(shopButtonText);

        const panel = makeShape(ShapeUtils.rectangle(64, 10, 34, 87), COLORS.panel, { color: player.color, border: 3 });
        const fishTab = makeShape(ShapeUtils.rectangle(66, 12, 9.4, 7), COLORS.buttonHot, {
            onClick: () => this.setShopTab(ui.playerId, 'fish')
        });
        const decorTab = makeShape(ShapeUtils.rectangle(76.1, 12, 9.4, 7), COLORS.button, {
            onClick: () => this.setShopTab(ui.playerId, 'decor')
        });
        const tankTab = makeShape(ShapeUtils.rectangle(86.2, 12, 9.8, 7), COLORS.button, {
            onClick: () => this.setShopTab(ui.playerId, 'tank')
        });
        const fishTabText = makeText('FISH', 70.7, 16.6, 1.15, COLORS.white, 'center');
        const decorTabText = makeText('DECOR', 80.8, 16.6, 1.05, COLORS.white, 'center');
        const tankTabText = makeText('TANK', 91.1, 16.6, 1.1, COLORS.white, 'center');
        const statusText = makeText('', 81, 94.5, 1.25, COLORS.gold, 'center');

        root.addChild(panel);
        root.addChild(fishTab);
        root.addChild(decorTab);
        root.addChild(tankTab);
        root.addChild(fishTabText);
        root.addChild(decorTabText);
        root.addChild(tankTabText);
        root.addChild(statusText);

        const rows = [];
        for (let i = 0; i < 5; i++) {
            const y = 21 + i * 13.5;
            const button = makeShape(ShapeUtils.rectangle(66, y, 30, 11.5), COLORS.button, {
                color: [88, 145, 161, 255],
                border: 2,
                onClick: () => this.buyRow(ui.playerId, i)
            });
            const name = makeText('', 67.2, y + 3.2, 1.28, COLORS.white, 'left');
            const detail = makeText('', 67.2, y + 6.3, 0.95, [190, 217, 224, 255], 'left');
            const cost = makeText('', 94.4, y + 8.9, 1.25, COLORS.gold, 'right');
            root.addChild(button);
            root.addChild(name);
            root.addChild(detail);
            root.addChild(cost);
            rows.push({ button, name, detail, cost, y });
        }

        Object.assign(ui, {
            anchor,
            root,
            scorePanel,
            scoreText,
            shopButton,
            shopButtonText,
            panel,
            fishTab,
            decorTab,
            tankTab,
            fishTabText,
            decorTabText,
            tankTabText,
            statusText,
            rows
        });
        player.ui = ui;
        this.uiSlots.push(ui);
        this.setShopVisible(player, false);
    }

    setShopVisible(player, visible) {
        if (!player.ui) return;
        const ui = player.ui;
        player.shopOpen = visible;
        setText(ui.shopButtonText, visible ? 'CLOSE' : 'SHOP');
        if (!visible) {
            hideShape(ui.panel);
            hideShape(ui.fishTab);
            hideShape(ui.decorTab);
            hideShape(ui.tankTab);
            hideText(ui.fishTabText);
            hideText(ui.decorTabText);
            hideText(ui.tankTabText);
            hideText(ui.statusText);
            ui.rows.forEach((row) => {
                hideShape(row.button);
                hideText(row.name);
                hideText(row.detail);
                hideText(row.cost);
            });
            return;
        }
        ui.panel.node.coordinates2d = ShapeUtils.rectangle(64, 10, 34, 87);
        ui.panel.node.fill = COLORS.panel;
        ui.panel.node.color = player.color;
        ui.fishTab.node.coordinates2d = ShapeUtils.rectangle(66, 12, 9.4, 7);
        ui.decorTab.node.coordinates2d = ShapeUtils.rectangle(76.1, 12, 9.4, 7);
        ui.tankTab.node.coordinates2d = ShapeUtils.rectangle(86.2, 12, 9.8, 7);
        setText(ui.fishTabText, 'FISH');
        setText(ui.decorTabText, 'DECOR');
        setText(ui.tankTabText, 'TANK');
        setText(ui.statusText, player.status);
        ui.rows.forEach((row) => {
            row.button.node.coordinates2d = ShapeUtils.rectangle(66, row.y, 30, 11.5);
        });
    }

    toggleShop(playerId) {
        const player = this.players[playerId];
        if (!player || !player.connected) return;
        this.setShopVisible(player, !player.shopOpen);
        this.updatePlayerUi(player, true);
        this.base.node.onStateChange();
    }

    setShopTab(playerId, tab) {
        const player = this.players[playerId];
        if (!player || !player.connected) return;
        player.shopTab = tab === 'tank' ? 'tank' : (tab === 'decor' ? 'decor' : 'fish');
        if (!player.shopOpen) this.setShopVisible(player, true);
        this.updatePlayerUi(player, true);
        this.base.node.onStateChange();
    }

    buyRow(playerId, rowIndex) {
        const player = this.players[playerId];
        if (!player || !player.connected || !player.shopOpen) return;
        if (player.shopTab === 'fish') {
            const item = CATALOG.fish[rowIndex];
            if (!item) return;
            this.buyFish(player, item);
        } else if (player.shopTab === 'decor') {
            const item = CATALOG.decor[rowIndex];
            if (!item) return;
            this.buyDecor(player, item);
        } else if (rowIndex === 0) {
            this.buyTankUpgrade(player);
        }
        this.updatePlayerUi(player, true);
        this.base.node.onStateChange();
    }

    buyFish(player, item) {
        const activeFish = this.fish.reduce((sum, fish) => sum + (fish.active ? 1 : 0), 0);
        if (activeFish >= this.currentTank().fishCap) return this.setStatus(player, 'TANK FULL');
        const slot = this.fish.find((fish) => !fish.active);
        if (!slot) return this.setStatus(player, 'TANK FULL');
        const bought = player.fishBuys[item.id] || 0;
        const cost = this.economyCost(item.baseCost, bought, 1.42);
        if (player.points < cost) return this.setStatus(player, `NEED ${formatNumber(cost - player.points)}`);
        player.points -= cost;
        player.fishBuys[item.id] = bought + 1;
        this.fishPurchases[item.id] = (this.fishPurchases[item.id] || 0) + 1;
        this.addFish(item.id, player.id, false);
        this.setStatus(player, `${item.name} ADDED`);
    }

    buyDecor(player, item) {
        if (item.id === 'flakes') {
            const cost = this.economyCost(item.baseCost, player.foodLevel, 1.55);
            if (player.points < cost) return this.setStatus(player, `NEED ${formatNumber(cost - player.points)}`);
            player.points -= cost;
            player.foodLevel++;
            this.setStatus(player, `FLAKES LV ${player.foodLevel}`);
            return;
        }
        const globalCount = this.decorCounts[item.id] || 0;
        const maxAllowed = this.decorMax(item);
        if (globalCount >= maxAllowed) return this.setStatus(player, 'MAXED OUT');
        const playerCount = player.decorBuys[item.id] || 0;
        const cost = this.economyCost(item.baseCost, playerCount, 1.5);
        if (player.points < cost) return this.setStatus(player, `NEED ${formatNumber(cost - player.points)}`);
        const slot = this.accessories.find((accessory) => !accessory.active);
        if (!slot) return this.setStatus(player, 'NO DECOR SLOTS');
        player.points -= cost;
        player.decorBuys[item.id] = playerCount + 1;
        this.decorCounts[item.id] = globalCount + 1;
        this.activateAccessory(slot, item.id, player.id);
        this.setStatus(player, `${item.name} ADDED`);
    }

    buyTankUpgrade(player) {
        const next = this.nextTank();
        if (!next) return this.setStatus(player, 'MAX TANK');
        const cost = next.upgradeCost;
        if (player.points < cost) return this.setStatus(player, `NEED ${formatNumber(cost - player.points)}`);
        player.points -= cost;
        this.tankTier++;
        this.camera.targetX = 50;
        this.camera.targetZoom = Math.max(this.minZoom(), this.tankTier === 1 ? 0.72 : 0.58);
        this.camera.zoom = clamp(this.camera.zoom, this.minZoom(), 1.35);
        this.clampCamera();
        this.updateCameraControls();
        const bounds = this.tankBounds();
        for (let i = 0; i < 28; i++) {
            this.emitBubbles(rand(bounds.min, bounds.max), rand(72, 91), 1);
        }
        for (const playerId of this.playerOrder) {
            const other = this.players[playerId];
            if (!other) continue;
            other.status = `${next.name}!`;
            other.statusTime = 2.5;
            this.updatePlayerUi(other, true);
        }
    }

    setStatus(player, text) {
        player.status = text;
        player.statusTime = 1.8;
        if (player.ui && player.shopOpen) setText(player.ui.statusText, text);
    }

    getFishCost(player, item) {
        return this.economyCost(item.baseCost, player.fishBuys[item.id] || 0, 1.42);
    }

    getDecorCost(player, item) {
        if (item.id === 'flakes') return this.economyCost(item.baseCost, player.foodLevel, 1.55);
        return this.economyCost(item.baseCost, player.decorBuys[item.id] || 0, 1.5);
    }

    updatePlayerUi(player, force) {
        if (!player.ui) return;
        const ui = player.ui;
        ui.scorePanel.node.coordinates2d = ShapeUtils.rectangle(2, 2, 18, 7);
        ui.scorePanel.node.fill = player.statusTime > 0 ? COLORS.panelSoft : COLORS.panel;
        ui.scorePanel.node.color = player.color;
        setText(ui.scoreText, formatNumber(player.points));
        setTextColor(ui.scoreText, COLORS.white);
        ui.shopButton.node.coordinates2d = ShapeUtils.rectangle(88, 2, 10, 7);
        ui.shopButton.node.fill = player.shopOpen ? COLORS.buttonHot : COLORS.button;
        ui.shopButton.node.color = COLORS.white;
        setText(ui.shopButtonText, player.shopOpen ? 'CLOSE' : 'SHOP');
        if (!player.shopOpen) return;

        this.setShopVisible(player, true);
        ui.fishTab.node.fill = player.shopTab === 'fish' ? COLORS.buttonHot : COLORS.buttonDim;
        ui.decorTab.node.fill = player.shopTab === 'decor' ? COLORS.buttonHot : COLORS.buttonDim;
        ui.tankTab.node.fill = player.shopTab === 'tank' ? COLORS.buttonHot : COLORS.buttonDim;
        setText(ui.statusText, player.status);

        if (player.shopTab === 'tank') {
            const current = this.currentTank();
            const next = this.nextTank();
            const rows = [
                next ? {
                    name: `EXPAND: ${next.name}`,
                    detail: `WIDTH ${next.width}  FISH ${next.fishCap}`,
                    cost: formatNumber(next.upgradeCost),
                    affordable: player.points >= next.upgradeCost,
                    unavailable: false
                } : {
                    name: 'MAXIMUM TANK',
                    detail: `WIDTH ${current.width}  FISH ${current.fishCap}`,
                    cost: 'MAX',
                    affordable: false,
                    unavailable: true
                },
                {
                    name: `CURRENT: ${current.name}`,
                    detail: `REWARDS x${formatNumber(current.rewardScale)}`,
                    cost: '', affordable: false, unavailable: false
                },
                {
                    name: 'KEEP EVERYTHING',
                    detail: 'FISH  DECOR  POINTS',
                    cost: '', affordable: false, unavailable: false
                },
                {
                    name: 'MOVE THROUGH TANK',
                    detail: 'A/D OR EDGE ARROWS',
                    cost: '', affordable: false, unavailable: false
                },
                {
                    name: 'CHANGE VIEW',
                    detail: 'Q/E OR -/+',
                    cost: '', affordable: false, unavailable: false
                }
            ];
            rows.forEach((item, index) => {
                const row = ui.rows[index];
                setText(row.name, item.name);
                setText(row.detail, item.detail);
                setText(row.cost, item.cost);
                const actionable = index === 0 && !item.unavailable;
                row.button.node.fill = actionable && item.affordable ? COLORS.buttonHot : COLORS.buttonDim;
                row.button.node.color = actionable && item.affordable ? player.color : [76, 92, 102, 255];
                setTextColor(row.name, item.unavailable ? [145,158,164,255] : COLORS.white);
                setTextColor(row.detail, [190,217,224,255]);
                setTextColor(row.cost, item.affordable ? COLORS.gold : [169,170,157,255]);
            });
            return;
        }

        const items = player.shopTab === 'fish' ? CATALOG.fish : CATALOG.decor;
        const activeFish = this.fish.reduce((sum, fish) => sum + (fish.active ? 1 : 0), 0);
        items.forEach((item, index) => {
            const row = ui.rows[index];
            if (!row) return;
            const cost = player.shopTab === 'fish' ? this.getFishCost(player, item) : this.getDecorCost(player, item);
            let detailText = '';
            let unavailable = false;
            if (player.shopTab === 'fish') {
                const speciesCount = this.fish.reduce((sum, fish) => sum + (fish.active && fish.speciesId === item.id ? 1 : 0), 0);
                const reward = item.reward * this.currentTank().rewardScale;
                detailText = `${speciesCount} OWNED  +${formatNumber(reward)}/BITE`;
                unavailable = activeFish >= this.currentTank().fishCap || !this.fish.some((fish) => !fish.active);
            } else if (item.id === 'flakes') {
                detailText = `LEVEL ${player.foodLevel}  ${item.description}`;
            } else {
                const maxAllowed = this.decorMax(item);
                detailText = `${this.decorCounts[item.id] || 0}/${maxAllowed}  ${item.description}`;
                unavailable = (this.decorCounts[item.id] || 0) >= maxAllowed;
            }
            setText(row.name, item.name);
            setText(row.detail, detailText);
            setText(row.cost, unavailable ? 'MAX' : formatNumber(cost));
            const affordable = player.points >= cost && !unavailable;
            row.button.node.fill = affordable ? COLORS.buttonHot : COLORS.buttonDim;
            row.button.node.color = affordable ? player.color : [76, 92, 102, 255];
            setTextColor(row.name, unavailable ? [145, 158, 164, 255] : COLORS.white);
            setTextColor(row.detail, unavailable ? [114, 127, 134, 255] : [190, 217, 224, 255]);
            setTextColor(row.cost, affordable ? COLORS.gold : [169, 170, 157, 255]);
        });
    }

    addFish(speciesId, ownerId, starter) {
        const species = CATALOG.fish.find((item) => item.id === speciesId);
        const fish = this.fish.find((slot) => !slot.active);
        if (!species || !fish) return false;
        fish.active = true;
        fish.speciesId = speciesId;
        fish.species = species;
        fish.ownerId = ownerId || 0;
        const bounds = this.tankBounds();
        const spawnMin = Math.max(bounds.min + 4, this.camera.x - 42);
        const spawnMax = Math.min(bounds.max - 4, this.camera.x + 42);
        fish.x = starter ? rand(7, 93) : rand(spawnMin, Math.max(spawnMin + 1, spawnMax));
        fish.y = rand(15, 76);
        fish.dir = Math.random() < 0.5 ? -1 : 1;
        fish.scale = rand(0.88, 1.18);
        fish.speed = species.speed * rand(0.88, 1.14);
        fish.phase = rand(0, TAU);
        fish.targetX = rand(bounds.min + 5, bounds.max - 5);
        fish.targetY = rand(14, 76);
        fish.targetTimer = rand(2, 7);
        fish.hungerPulse = 0;
        if (!starter) this.emitBubbles(fish.x, fish.y, 6);
        return true;
    }

    activateAccessory(accessory, type, ownerId) {
        const index = this.accessories.filter((item) => item.active).length;
        const bounds = this.tankBounds();
        const usable = Math.max(10, bounds.max - bounds.min - 10);
        const columns = Math.max(2, Math.floor(usable / 8.5) + 1);
        const column = index % columns;
        const row = Math.floor(index / columns) % 3;
        accessory.active = true;
        accessory.type = type;
        accessory.ownerId = ownerId;
        accessory.x = bounds.min + 5 + (columns <= 1 ? usable / 2 : column * usable / (columns - 1));
        accessory.y = 89.8 + row * 1.55;
        accessory.phase = rand(0, TAU);
        accessory.nextAction = this.time + rand(5, 12);
        this.renderAccessory(accessory);
    }

    dropFood(playerId, x, y, golden) {
        const player = this.players[playerId];
        if (!player || !player.connected && !golden) return false;
        if (!golden && player.feedCooldown > 0) return false;
        if (!golden) player.feedCooldown = 0.09;
        const food = this.findFoodSlot();
        if (!food) return false;
        food.active = true;
        food.ownerId = playerId;
        const bounds = this.tankBounds();
        food.x = clamp(x, bounds.min + 2.5, bounds.max - 2.5);
        food.y = clamp(y, 7, 80);
        food.speed = golden ? rand(2.4, 3.2) : rand(3.2, 4.8);
        food.value = Math.max(1, 1 + (player ? player.foodLevel : 0)) * (golden ? 2 : 1);
        food.golden = !!golden;
        food.age = 0;
        food.settledTime = 0;
        food.phase = rand(0, TAU);
        food.color = golden ? COLORS.gold : (player ? player.color : COLORS.gold);
        food.node.node.fill = food.color;
        this.emitBubbles(food.x, food.y, golden ? 4 : 2);
        return true;
    }

    findFoodSlot() {
        const free = this.food.find((food) => !food.active);
        if (free) return free;
        let oldest = this.food[0];
        for (let i = 1; i < this.food.length; i++) {
            if (this.food[i].age > oldest.age) oldest = this.food[i];
        }
        return oldest;
    }

    emitBubbles(x, y, count) {
        let spawned = 0;
        for (let i = 0; i < this.bubbles.length && spawned < count; i++) {
            const bubble = this.bubbles[i];
            if (bubble.active) continue;
            bubble.active = true;
            bubble.x = x + rand(-1.2, 1.2);
            bubble.y = y + rand(-0.5, 0.5);
            bubble.speed = rand(5, 10);
            bubble.size = rand(0.16, 0.48);
            bubble.phase = rand(0, TAU);
            spawned++;
        }
    }

    spawnFloater(x, y, value, color) {
        const floater = this.floaters.find((item) => !item.active);
        if (!floater) return;
        floater.active = true;
        floater.x = x;
        floater.y = y;
        floater.ttl = 1.0;
        floater.max = 1.0;
        floater.color = color;
        floater.label = `+${formatNumber(value)}`;
        setText(floater.node, floater.label);
        setTextColor(floater.node, color);
    }

    globalRewardMultiplier() {
        return this.currentTank().rewardScale * (1 + (this.decorCounts.plant || 0) * 0.02 + (this.decorCounts.coral || 0) * 0.05);
    }

    playerRewardMultiplier(player) {
        return 1 + (player.decorBuys.castle || 0) * 0.15;
    }

    awardFood(food, fish) {
        const player = this.players[food.ownerId];
        if (!player) return;
        const raw = food.value * fish.species.reward * this.globalRewardMultiplier() * this.playerRewardMultiplier(player);
        const gain = Math.max(1, Math.floor(raw));
        player.points = Math.min(MAX_POINTS, player.points + gain);
        player.totalEarned = Math.min(MAX_POINTS, player.totalEarned + gain);
        player.foodEaten++;
        player.statusTime = 0.35;
        this.spawnFloater(fish.x, fish.y - fish.species.height * fish.scale * 0.8, gain, player.color);
        if (gain >= 50) this.emitBubbles(fish.x, fish.y, 5);
    }

    nearestFood(x, y, radius) {
        let best = null;
        let bestDistance = radius;
        for (let i = 0; i < this.food.length; i++) {
            const food = this.food[i];
            if (!food.active) continue;
            const d = dist(x, y, food.x, food.y);
            if (d < bestDistance) {
                best = food;
                bestDistance = d;
            }
        }
        return { food: best, distance: bestDistance };
    }

    tick() {
        this.time += DT;
        this.nextAmbientBubble -= DT;
        if (this.nextAmbientBubble <= 0) {
            this.nextAmbientBubble = rand(0.22, 0.55);
            const visible = this.visibleWorldBounds(2);
            const bounds = this.tankBounds();
            this.emitBubbles(rand(Math.max(bounds.min, visible.min), Math.min(bounds.max, visible.max)), rand(82, 92), 1);
        }

        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player) continue;
            player.feedCooldown = Math.max(0, player.feedCooldown - DT);
            player.statusTime = Math.max(0, player.statusTime - DT);
            if (player.statusTime <= 0 && player.status) {
                player.status = '';
                if (player.ui && player.shopOpen) setText(player.ui.statusText, '');
            }
            player.uiTimer -= DT;
            if (player.uiTimer <= 0) {
                player.uiTimer = 0.15;
                this.updatePlayerUi(player, false);
            }
        }

        this.updateCamera();
        this.updateBackground();
        this.updateAccessories();
        this.updateFood();
        this.updateFish();
        this.updateBubbles();
        this.updateFloaters();
        this.base.node.onStateChange();
    }

    updateCamera() {
        let input = 0;
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player || !player.connected) continue;
            if (player.keys.a || player.keys.arrowleft) input -= 1;
            if (player.keys.d || player.keys.arrowright) input += 1;
        }
        input = clamp(input, -1, 1);
        if (this.tankTier > 0 && input !== 0) {
            this.camera.targetX += input * 62 * DT / Math.max(0.45, this.camera.zoom);
        }
        const zoomError = this.camera.targetZoom - this.camera.zoom;
        this.camera.zoom += zoomError * Math.min(1, DT * 7.5);
        this.camera.zoom = clamp(this.camera.zoom, this.minZoom(), 1.35);
        this.clampCamera();
        const error = this.camera.targetX - this.camera.x;
        const acceleration = error * 8.2 - this.camera.velocity * 5.8;
        this.camera.velocity += acceleration * DT;
        if (Math.abs(error) < 0.01 && Math.abs(this.camera.velocity) < 0.01) {
            this.camera.x = this.camera.targetX;
            this.camera.velocity = 0;
        } else {
            this.camera.x += this.camera.velocity * DT;
        }
        this.clampCamera();
        this.updateCameraControls();
    }

    updateBackground() {
        const bounds = this.tankBounds();
        this.caustics.forEach((item, index) => {
            const worldX = item.x + Math.sin(this.time * item.speed + item.phase) * (3 + index % 3);
            if (item.x < bounds.min - 8 || item.x > bounds.max + 8 || !this.worldXVisible(worldX, 14)) {
                hideShape(item.node);
                return;
            }
            const x = this.worldToScreenX(worldX);
            const y = item.y + Math.cos(this.time * 0.45 + item.phase) * 1.1;
            const width = item.width + Math.sin(this.time * 0.9 + index) * 1.5;
            item.node.node.fill = [COLORS.light[0], COLORS.light[1], COLORS.light[2], 70];
            item.node.node.coordinates2d = [
                [x - width / 2, y], [x - width / 6, y - 0.8],
                [x + width / 2, y], [x + width / 6, y + 0.8], [x - width / 2, y]
            ];
        });

        const edgeXs = [this.worldToScreenX(bounds.min), this.worldToScreenX(bounds.max)];
        this.tankEdges.forEach((node, index) => {
            const x = edgeXs[index];
            if (x < -2 || x > 102) {
                hideShape(node);
                return;
            }
            node.node.fill = [196, 238, 247, 90];
            node.node.coordinates2d = ShapeUtils.rectangle(x - 0.35, 0, 0.7, 100);
        });

        this.staticRocks.forEach((rock) => {
            if (rock.x < bounds.min || rock.x > bounds.max || !this.worldXVisible(rock.x, 9)) {
                hideShape(rock.node);
                return;
            }
            const x = this.worldToScreenX(rock.x);
            const w = rock.width;
            const h = rock.height;
            rock.node.node.fill = Math.floor(rock.phase) % 2 ? COLORS.rockB : COLORS.rockA;
            rock.node.node.coordinates2d = [
                [x - w * 0.55, rock.y + h * 0.35],
                [x - w * 0.42, rock.y - h * 0.42],
                [x - w * 0.08, rock.y - h * 0.68],
                [x + w * 0.38, rock.y - h * 0.34],
                [x + w * 0.55, rock.y + h * 0.35],
                [x - w * 0.55, rock.y + h * 0.35]
            ];
        });

        this.specks.forEach((item, index) => {
            item.y -= item.speed * DT;
            if (item.y < 3) item.y = 91;
            const baseX = 1 + ((index * 37) % 97);
            const x = baseX + Math.sin(this.time * 0.7 + item.phase) * 0.55;
            const radius = item.size * (0.75 + 0.25 * Math.sin(this.time * 2 + item.phase));
            item.node.node.coordinates2d = polyCircle(x, item.y, radius, 5);
        });

        this.staticWeeds.forEach((weed) => {
            if (weed.x < bounds.min || weed.x > bounds.max || !this.worldXVisible(weed.x, 8)) {
                hideShape(weed.node);
                return;
            }
            const rootX = this.worldToScreenX(weed.x);
            const sway = Math.sin(this.time * weed.speed + weed.phase) * 1.25;
            const tipX = rootX + sway;
            const midX = rootX + sway * 0.45;
            const topY = weed.y - weed.height;
            weed.node.node.fill = Math.floor(weed.phase * 10) % 2 ? COLORS.weedA : COLORS.weedB;
            weed.node.node.coordinates2d = [
                [rootX - weed.width / 2, weed.y], [rootX + weed.width / 2, weed.y],
                [midX + weed.width * 0.38, weed.y - weed.height * 0.48],
                [tipX + weed.width * 0.16, topY + 0.4], [tipX, topY],
                [tipX - weed.width * 0.16, topY + 0.4],
                [midX - weed.width * 0.38, weed.y - weed.height * 0.48],
                [rootX - weed.width / 2, weed.y]
            ];
        });

        this.staticCorals.forEach((coral, index) => {
            if (coral.x < bounds.min || coral.x > bounds.max || !this.worldXVisible(coral.x, 8)) {
                hideShape(coral.node);
                return;
            }
            const x = this.worldToScreenX(coral.x);
            const bend = Math.sin(this.time * 0.35 + coral.phase) * 0.32;
            const w = coral.width;
            const h = coral.height;
            coral.node.node.fill = index % 3 === 0 ? COLORS.coralA : (index % 3 === 1 ? COLORS.coralB : COLORS.coralC);
            coral.node.node.coordinates2d = [
                [x - w * 0.48, coral.y], [x - w * 0.28, coral.y - h * 0.65],
                [x - w * 0.05 + bend, coral.y - h], [x + w * 0.15, coral.y - h * 0.55],
                [x + w * 0.42, coral.y - h * 0.82], [x + w * 0.5, coral.y],
                [x - w * 0.48, coral.y]
            ];
        });
    }

    updateAccessories() {
        for (const accessory of this.accessories) {
            if (!accessory.active) {
                accessory.nodes.forEach(hideShape);
                continue;
            }
            if (accessory.type === 'bubbler' && this.time >= accessory.nextAction) {
                accessory.nextAction = this.time + rand(9, 14);
                this.dropFood(accessory.ownerId, accessory.x + rand(-1.5, 1.5), 72 + rand(-3, 4), true);
                this.emitBubbles(accessory.x, accessory.y - 2, 8);
            }
            this.renderAccessory(accessory);
        }
    }

    renderAccessory(accessory) {
        accessory.nodes.forEach(hideShape);
        const n = accessory.nodes;
        if (!this.worldXVisible(accessory.x, 10)) return;
        const x = this.worldToScreenX(accessory.x);
        const y = accessory.y;
        const owner = this.players[accessory.ownerId];
        const accent = owner ? owner.color : COLORS.gold;
        if (accessory.type === 'plant') {
            for (let i = 0; i < 5; i++) {
                const sway = Math.sin(this.time * (0.8 + i * 0.08) + accessory.phase + i) * (0.6 + i * 0.12);
                const bx = x + (i - 2) * 0.55;
                const height = 7 + i * 1.1;
                n[i].node.fill = i % 2 ? COLORS.weedA : COLORS.weedB;
                n[i].node.coordinates2d = [
                    [bx - 0.28, y], [bx + 0.28, y],
                    [bx + sway + 0.18, y - height + 0.5], [bx + sway, y - height],
                    [bx + sway - 0.18, y - height + 0.5], [bx - 0.28, y]
                ];
            }
            n[5].node.fill = accent;
            n[5].node.coordinates2d = diamond(x, y - 2.6, 0.34, 0.55);
        } else if (accessory.type === 'coral') {
            const branches = [
                [x - 2.2, y, x - 1.8, y - 7.5],
                [x - 0.9, y, x - 0.7, y - 10],
                [x + 0.4, y, x + 0.9, y - 8.5],
                [x + 1.7, y, x + 2.3, y - 6.8]
            ];
            branches.forEach((b, i) => {
                n[i].node.fill = i % 2 ? COLORS.coralB : COLORS.coralA;
                n[i].node.coordinates2d = thickLine(b[0], b[1], b[2], b[3], 0.9);
                n[i + 4].node.fill = i % 2 ? COLORS.coralA : COLORS.coralC;
                n[i + 4].node.coordinates2d = polyCircle(b[2], b[3], 0.9, 8);
            });
            n[8].node.fill = accent;
            n[8].node.coordinates2d = diamond(x, y - 2.2, 0.34, 0.52);
        } else if (accessory.type === 'bubbler') {
            n[0].node.fill = COLORS.rockB;
            n[0].node.coordinates2d = [[x-2,y],[x-1.4,y-2],[x+1.3,y-2.2],[x+2,y],[x-2,y]];
            n[1].node.fill = COLORS.rockA;
            n[1].node.coordinates2d = polyCircle(x, y - 1.5, 1.1, 9);
            n[2].node.fill = accent;
            n[2].node.coordinates2d = diamond(x, y - 1.6, 0.35, 0.55);
            for (let i = 0; i < 3; i++) {
                const by = y - 3.5 - i * 1.8 + Math.sin(this.time * 2 + accessory.phase + i) * 0.5;
                n[3 + i].node.fill = [COLORS.white[0], COLORS.white[1], COLORS.white[2], 175];
                n[3 + i].node.coordinates2d = polyCircle(x + Math.sin(this.time + i) * 0.5, by, 0.28 + i * 0.06, 7);
            }
        } else if (accessory.type === 'castle') {
            n[0].node.fill = [152, 128, 103, 255];
            n[0].node.coordinates2d = ShapeUtils.rectangle(x - 3.4, y - 6.6, 6.8, 6.6);
            n[1].node.fill = [131, 109, 91, 255];
            n[1].node.coordinates2d = ShapeUtils.rectangle(x - 4.4, y - 8.8, 2.8, 8.8);
            n[2].node.fill = [131, 109, 91, 255];
            n[2].node.coordinates2d = ShapeUtils.rectangle(x + 1.6, y - 8.8, 2.8, 8.8);
            n[3].node.fill = COLORS.dark;
            n[3].node.coordinates2d = [
                [x - 1.1, y], [x - 1.1, y - 3.2], [x, y - 4.2], [x + 1.1, y - 3.2], [x + 1.1, y], [x - 1.1, y]
            ];
            n[4].node.fill = accent;
            n[4].node.coordinates2d = diamond(x, y - 5.8, 0.5, 0.8);
            for (let i = 0; i < 4; i++) {
                const wx = x - 2.5 + (i % 2) * 5;
                const wy = y - 7.4 + Math.floor(i / 2) * 3;
                n[5 + i].node.fill = COLORS.gold;
                n[5 + i].node.coordinates2d = ShapeUtils.rectangle(wx - 0.28, wy - 0.5, 0.56, 1);
            }
        }
    }

    updateFood() {
        for (const food of this.food) {
            if (!food.active) {
                hideShape(food.node);
                continue;
            }
            food.age += DT;
            if (food.y < 87.5) {
                food.y += food.speed * DT;
                food.x += Math.sin(this.time * 2.2 + food.phase) * 0.025;
            } else {
                food.y = 87.5;
                food.settledTime += DT;
            }
            if (food.settledTime > 20 || food.age > 45) {
                food.active = false;
                hideShape(food.node);
                continue;
            }
            if (!this.worldXVisible(food.x, 4)) {
                hideShape(food.node);
                continue;
            }
            const screenX = this.worldToScreenX(food.x);
            const size = food.golden ? 0.48 : 0.31;
            food.node.node.fill = food.color;
            food.node.node.coordinates2d = food.golden
                ? diamond(screenX, food.y, size, size * 1.3)
                : [[screenX-size,food.y-size*0.45],[screenX+size,food.y-size*0.4],[screenX+size*0.65,food.y+size*0.55],[screenX-size*0.7,food.y+size*0.48],[screenX-size,food.y-size*0.45]];
        }
    }

    updateFish() {
        const attraction = 22 + (this.decorCounts.plant || 0) * 1.4;
        for (const fish of this.fish) {
            if (!fish.active) {
                fish.nodes.forEach(hideShape);
                continue;
            }
            fish.targetTimer -= DT;
            const nearest = this.nearestFood(fish.x, fish.y, attraction);
            let targetX;
            let targetY;
            let chasing = false;
            if (nearest.food) {
                targetX = nearest.food.x;
                targetY = nearest.food.y;
                chasing = true;
            } else {
                if (fish.targetTimer <= 0 || dist(fish.x, fish.y, fish.targetX, fish.targetY) < 2) {
                    fish.targetTimer = rand(2.5, 7);
                    const bounds = this.tankBounds();
                    fish.targetX = rand(bounds.min + 5, bounds.max - 5);
                    fish.targetY = rand(13, 76);
                }
                targetX = fish.targetX;
                targetY = fish.targetY + Math.sin(this.time * 1.15 + fish.phase) * 1.2;
            }
            const dx = targetX - fish.x;
            const dy = targetY - fish.y;
            const length = Math.max(0.001, Math.hypot(dx, dy));
            if (Math.abs(dx) > 0.15) fish.dir = dx >= 0 ? 1 : -1;
            const speed = fish.speed * (chasing ? 1.25 : 0.72);
            fish.x += dx / length * speed * DT;
            fish.y += dy / length * speed * DT * 0.64;
            const bounds = this.tankBounds();
            fish.x = clamp(fish.x, bounds.min + 4, bounds.max - 4);
            fish.y = clamp(fish.y, 10, 80);
            fish.hungerPulse += DT * (chasing ? 6 : 2);

            if (nearest.food && nearest.distance < Math.max(0.9, fish.species.length * fish.scale * 0.3)) {
                const food = nearest.food;
                food.active = false;
                hideShape(food.node);
                this.awardFood(food, fish);
                fish.targetTimer = 0;
            }
            this.renderFish(fish);
        }
    }

    renderFish(fish) {
        const species = fish.species;
        const n = fish.nodes;
        n.forEach(hideShape);
        if (!this.worldXVisible(fish.x, 12)) return;
        const renderX = this.worldToScreenX(fish.x);
        const body = fishBody(renderX, fish.y, fish.dir, fish.scale, species);
        const tail = fishTail(renderX, fish.y, fish.dir, fish.scale, species);
        const upperFin = fishFin(renderX, fish.y, fish.dir, fish.scale, species, true);
        const lowerFin = fishFin(renderX, fish.y, fish.dir, fish.scale, species, false);
        const eyeX = renderX + fish.dir * species.length * fish.scale * 0.31;
        const eyeY = fish.y - species.height * fish.scale * 0.08;
        const owner = this.players[fish.ownerId];
        const ownerColor = owner ? owner.color : species.colors[1];

        if (fish.speciesId === 'puffer') {
            n[0].node.fill = [194, 171, 97, 255];
            n[0].node.coordinates2d = polyCircle(renderX, fish.y, fish.scale * 1.95, 12);
            n[1].node.fill = species.colors[0];
            n[1].node.coordinates2d = polyCircle(renderX, fish.y, fish.scale * 1.4, 12);
            n[2].node.fill = species.colors[1];
            n[2].node.coordinates2d = tail;
            n[3].node.fill = species.colors[2];
            n[3].node.coordinates2d = polyCircle(eyeX, eyeY, 0.16 * fish.scale, 7);
            n[4].node.fill = species.colors[2];
            n[4].node.coordinates2d = polyCircle(renderX - fish.dir * 0.5, fish.y + 0.5, 0.12 * fish.scale, 6);
            n[5].node.fill = species.colors[2];
            n[5].node.coordinates2d = polyCircle(renderX, fish.y + 0.7, 0.11 * fish.scale, 6);
            n[6].node.fill = ownerColor;
            n[6].node.coordinates2d = diamond(renderX - fish.dir * 0.4, fish.y - 1.0 * fish.scale, 0.18, 0.28);
            return;
        }

        n[0].node.fill = species.colors[0];
        n[0].node.coordinates2d = body;
        n[1].node.fill = species.colors[1];
        n[1].node.coordinates2d = tail;
        n[2].node.fill = species.colors[1];
        n[2].node.coordinates2d = upperFin;
        n[3].node.fill = species.colors[1];
        n[3].node.coordinates2d = lowerFin;
        n[4].node.fill = species.colors[2];
        n[4].node.coordinates2d = polyCircle(eyeX, eyeY, 0.14 * fish.scale, 7);
        n[5].node.fill = ownerColor;
        n[5].node.coordinates2d = diamond(renderX - fish.dir * species.length * fish.scale * 0.12, fish.y + species.height * fish.scale * 0.28, 0.16, 0.24);

        if (fish.speciesId === 'clown') {
            n[6].node.fill = species.colors[1];
            n[6].node.coordinates2d = fishStripe(renderX, fish.y, fish.dir, fish.scale, species, 0.15, 0.055);
            n[7].node.fill = species.colors[1];
            n[7].node.coordinates2d = fishStripe(renderX, fish.y, fish.dir, fish.scale, species, -0.18, 0.05);
        } else if (fish.speciesId === 'tang') {
            n[6].node.fill = species.colors[1];
            n[6].node.coordinates2d = fishStripe(renderX, fish.y, fish.dir, fish.scale, species, -0.32, 0.08);
        } else if (fish.speciesId === 'angel') {
            n[2].node.fill = species.colors[2];
            n[2].node.coordinates2d = [
                [renderX - fish.dir * 0.2, fish.y - fish.scale],
                [renderX - fish.dir * 1.0, fish.y - fish.scale * 3.2],
                [renderX + fish.dir * 1.0, fish.y - fish.scale],
                [renderX - fish.dir * 0.2, fish.y - fish.scale]
            ];
            n[3].node.fill = species.colors[2];
            n[3].node.coordinates2d = [
                [renderX - fish.dir * 0.2, fish.y + fish.scale],
                [renderX - fish.dir * 0.8, fish.y + fish.scale * 3.0],
                [renderX + fish.dir * 0.2, fish.y + fish.scale * 1.4],
                [renderX - fish.dir * 0.2, fish.y + fish.scale]
            ];
            n[6].node.fill = species.colors[1];
            n[6].node.coordinates2d = fishStripe(renderX, fish.y, fish.dir, fish.scale, species, 0.16, 0.05);
            n[7].node.fill = species.colors[1];
            n[7].node.coordinates2d = fishStripe(renderX, fish.y, fish.dir, fish.scale, species, -0.08, 0.055);
        } else if (fish.speciesId === 'guppy') {
            n[1].node.fill = species.colors[0];
            n[6].node.fill = species.colors[1];
            n[6].node.coordinates2d = upperFin;
        }
    }

    updateBubbles() {
        for (const bubble of this.bubbles) {
            if (!bubble.active) {
                hideShape(bubble.node);
                continue;
            }
            bubble.y -= bubble.speed * DT;
            bubble.x += Math.sin(this.time * 2.3 + bubble.phase) * 0.055;
            if (bubble.y < 2) {
                bubble.active = false;
                hideShape(bubble.node);
                continue;
            }
            if (!this.worldXVisible(bubble.x, 4)) {
                hideShape(bubble.node);
                continue;
            }
            const size = bubble.size * (0.9 + 0.15 * Math.sin(this.time * 4 + bubble.phase));
            bubble.node.node.fill = [COLORS.white[0], COLORS.white[1], COLORS.white[2], 180];
            bubble.node.node.coordinates2d = polyCircle(this.worldToScreenX(bubble.x), bubble.y, size, 8);
        }
    }

    updateFloaters() {
        for (const floater of this.floaters) {
            if (!floater.active) {
                hideText(floater.node);
                continue;
            }
            floater.ttl -= DT;
            floater.y -= 4.5 * DT;
            if (floater.ttl <= 0) {
                floater.active = false;
                hideText(floater.node);
                continue;
            }
            if (!this.worldXVisible(floater.x, 5)) {
                hideText(floater.node);
                continue;
            }
            setText(floater.node, floater.label);
            setTextPosition(floater.node, this.worldToScreenX(floater.x), floater.y);
            setTextColor(floater.node, floater.color);
        }
    }

    renderAll(force) {
        this.updateBackground();
        this.updateAccessories();
        this.updateFood();
        this.updateFish();
        this.updateBubbles();
        this.updateFloaters();
        if (force) this.base.node.onStateChange();
    }

    exportCheckpoint() {
        const players = {};
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player) continue;
            players[playerId] = {
                name: player.name,
                points: player.points,
                totalEarned: player.totalEarned,
                foodEaten: player.foodEaten,
                foodLevel: player.foodLevel,
                fishBuys: Object.assign({}, player.fishBuys),
                decorBuys: Object.assign({}, player.decorBuys)
            };
        }
        return {
            kind: 'homegames.save',
            formatVersion: 2,
            game: 'aquarium-forever-expanded',
            elapsedSeconds: this.time,
            tankTier: this.tankTier,
            camera: { x: this.camera.x, zoom: this.camera.zoom },
            players,
            fish: this.fish.filter((fish) => fish.active).map((fish) => ({
                speciesId: fish.speciesId,
                ownerId: fish.ownerId,
                x: fish.x,
                y: fish.y,
                dir: fish.dir,
                scale: fish.scale
            })),
            accessories: this.accessories.filter((item) => item.active).map((item) => ({
                type: item.type,
                ownerId: item.ownerId,
                x: item.x,
                y: item.y,
                nextAction: item.nextAction
            })),
            decorCounts: Object.assign({}, this.decorCounts)
        };
    }
}

module.exports = AquariumForever;

