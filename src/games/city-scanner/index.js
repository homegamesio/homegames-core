'use strict';

const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { VisibleScene } = require('./world/scene');
const {
    WORLD_WIDTH,
    PARK_LEFT,
    PARK_RIGHT,
    LAKE_LEFT,
    LAKE_RIGHT,
    generateWorld,
    isParkX,
    isLakePoint,
    randomFrom,
    range,
    pick
} = require('./world/layout');

const TICK_RATE = 30; // MUST match metadata().tickRate literal.
const DT = 1 / TICK_RATE;
const BASE_VIEW_WIDTH = 260;
const EMPTY_POLYGON = ShapeUtils.rectangle(0, 0, 0, 0);
const STOPS = [
    { name: 'Downtown', x: 270, hint: 'Tap a cafe for a coffee rush, or the street to call a taxi.' },
    { name: 'Park Gate', x: 835, hint: 'Tap the paths to bring out walkers. Tap the sky for birds.' },
    { name: 'The Lake', x: 1145, hint: 'Tap the water to feed the fish. Watch the little sailboats.' },
    { name: 'Gardens', x: 1465, hint: 'Tap the gardens to bring the park to life.' },
    { name: 'East Side', x: 1844, hint: 'Tap a cafe for a coffee rush, or a building to start the day.' }
];

const POOLS = {
    farBuildings: 96,
    midBuildings: 52,
    frontBuildings: 40,
    trees: 64,
    props: 48,
    people: 96,
    cars: 26,
    buses: 6,
    bikes: 16,
    birds: 42,
    fish: 32,
    planes: 5,
    boats: 8,
    effects: 96
};

const COLORS = {
    transparent: [0, 0, 0, 0],
    white: [247, 249, 250, 255],
    ink: [21, 30, 40, 255],
    skyDayTop: [93, 184, 229, 255],
    skyDayLow: [185, 226, 239, 255],
    skyDuskTop: [90, 74, 157, 255],
    skyDuskLow: [246, 154, 126, 255],
    skyNightTop: [18, 30, 67, 255],
    skyNightLow: [52, 73, 112, 255],
    sun: [255, 224, 119, 255],
    moon: [246, 240, 207, 255],
    waterA: [69, 167, 204, 255],
    waterB: [102, 197, 222, 255],
    grassA: [83, 170, 98, 255],
    grassB: [108, 192, 111, 255],
    path: [211, 198, 166, 255],
    road: [72, 78, 88, 255],
    roadDark: [53, 58, 67, 255],
    lane: [239, 221, 144, 255],
    sidewalk: [176, 181, 186, 255],
    treeTrunk: [104, 72, 48, 255],
    windowDay: [142, 190, 207, 255],
    windowNight: [255, 215, 116, 255],
    coffee: [123, 73, 49, 255],
    panel: [17, 27, 42, 220],
    panelSoft: [30, 46, 64, 220],
    accent: [255, 195, 83, 255],
    event: [255, 241, 166, 255]
};

const BUILDING_COLORS = [
    [92, 112, 135, 255], [123, 111, 112, 255], [109, 129, 121, 255], [138, 123, 104, 255],
    [80, 103, 130, 255], [126, 96, 105, 255], [101, 118, 139, 255], [143, 129, 117, 255]
];
const TREE_COLORS = [
    [52, 133, 73, 255], [65, 151, 82, 255], [75, 163, 87, 255], [42, 119, 70, 255], [92, 170, 94, 255]
];
const CLOTHING = [
    [231, 92, 92, 255], [68, 122, 205, 255], [238, 166, 70, 255], [84, 166, 133, 255],
    [162, 105, 194, 255], [229, 119, 167, 255], [66, 80, 112, 255], [202, 202, 197, 255]
];
const SKIN = [
    [246, 199, 159, 255], [220, 164, 119, 255], [170, 116, 82, 255], [113, 76, 58, 255], [236, 181, 142, 255]
];
const VEHICLE_COLORS = [
    [235, 185, 55, 255], [203, 69, 69, 255], [65, 122, 195, 255], [79, 159, 123, 255],
    [225, 225, 220, 255], [70, 74, 84, 255], [167, 101, 188, 255]
];

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
    Math.round(lerp(a[3] === undefined ? 255 : a[3], b[3] === undefined ? 255 : b[3], t))
];
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

const makeShape = (coordinates2d, fill, extra = {}) => new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d,
    fill,
    ...extra
});

const hide = (node) => {
    // Visibility must never erase a pooled object's paint or opacity.
    node.node.coordinates2d = EMPTY_POLYGON;
};

const polyCircle = (cx, cy, radius, sides = 12) => {
    const points = [];
    for (let index = 0; index <= sides; index += 1) {
        const angle = index / sides * Math.PI * 2;
        points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
    return points;
};

const thickLine = (x1, y1, x2, y2, width) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(angle) * width * 0.5;
    const dy = Math.cos(angle) * width * 0.5;
    return [
        [x1 - dx, y1 + dy], [x2 - dx, y2 + dy], [x2 + dx, y2 - dy],
        [x1 + dx, y1 - dy], [x1 - dx, y1 + dy]
    ];
};

const diamond = (cx, cy, rx, ry) => [
    [cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry]
];

const triangle = (x1, y1, x2, y2, x3, y3) => [[x1, y1], [x2, y2], [x3, y3], [x1, y1]];

class CityScanner extends Game {
    static metadata() {
        return {
            isTest: true, // Catalog review: see docs/game-consolidation.md.

            squishVersion: '150',
            name: 'City Scanner',
            author: "Joseph Garcia",
            description: 'Explore a little living city together. Feed the fish, call a taxi, and find a favorite neighborhood.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30,
            maxPlayers: 8,
            services: ['multiplayer']
        };
    }

    constructor() {
        super();
        this.world = generateWorld(142042);
        this.rng = randomFrom(77142);
        this.time = 0;
        this.dayClock = 0.23;
        this.camera = { x: 1120, zoom: 1, velocity: 0, targetX: 1120 };
        this.keys = new Map();
        this.pressedPlayers = new Set();
        this.lastAction = new Map();
        this.inputTime = 0;
        this.paused = false;
        this.feedback = '';
        this.feedbackUntil = 0;
        this.sceneryKey = '';
        this.eventCount = 0;
        this.changed = true;

        this.people = [];
        this.cars = [];
        this.buses = [];
        this.bikes = [];
        this.birds = [];
        this.fish = [];
        this.planes = [];
        this.boats = [];
        this.effects = [];

        this.base = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), COLORS.skyDayLow);
        this.buildBackdrop();
        this.buildWorldPools();
        this.buildDynamicPools();
        this.overlay = makeShape(EMPTY_POLYGON, COLORS.transparent);
        this.buildClickLayer();
        this.buildHud();
        this.seedSimulation();
        this.scene = new VisibleScene(this.base);
        this.render(true);
    }

    getLayers() {
        return [{ root: this.base }, { root: this.overlay }];
    }

    handleNewPlayer({ playerId }) {
        this.keys.set(playerId, new Set());
    }

    handlePlayerDisconnect(playerId) {
        this.keys.delete(playerId);
        this.pressedPlayers.delete(playerId);
        this.lastAction.delete(playerId);
    }

    handleKeyDown(playerId, key) {
        const k = String(key || '').toLowerCase();
        const keys = this.keys.get(playerId);
        if (!keys || keys.has(k)) return;
        keys.add(k);
        if (k === 'q' || k === '-') this.changeZoom(-0.12);
        if (k === 'e' || k === '+') this.changeZoom(0.12);
        if (k === 'home') this.centerOnPark();
        if (k === ' ' || k === 'p') this.togglePause();
        if (/^[1-5]$/.test(k)) this.visitStop(Number(k) - 1);
        if (k === 'b') this.handleWorldClick(50, 24, playerId);
        if (k === 'enter') this.handleWorldClick(50, isParkX(this.camera.x) ? 65 : 71, playerId);
    }

    handleKeyUp(playerId, key) {
        this.keys.get(playerId)?.delete(String(key || '').toLowerCase());
    }

    handleMouseUp(playerId) {
        this.pressedPlayers.delete(playerId);
    }

    press(playerId, action) {
        if (!this.keys.has(playerId) || this.pressedPlayers.has(playerId)) return;
        this.pressedPlayers.add(playerId);
        action();
    }

    togglePause() {
        this.paused = !this.paused;
        this.changed = true;
    }

    visitStop(index) {
        const stop = STOPS[index];
        if (!stop) return;
        // Jump directly to landmarks; continuous arrows are for strolling.
        this.camera.x = stop.x;
        this.camera.targetX = stop.x;
        this.camera.velocity = 0;
        this.clampCamera();
        this.changed = true;
    }

    viewWidth() {
        return BASE_VIEW_WIDTH / this.camera.zoom;
    }

    scale() {
        return 100 / this.viewWidth();
    }

    worldToScreenX(worldX, parallax = 1) {
        return 50 + (worldX - this.camera.x) * this.scale() * parallax;
    }

    screenToWorldX(screenX) {
        return this.camera.x + (screenX - 50) / this.scale();
    }

    visibleWorldX(worldX, worldWidth = 0, parallax = 1, margin = 8) {
        const sx = this.worldToScreenX(worldX, parallax);
        const sw = worldWidth * this.scale() * parallax;
        return sx + sw >= -margin && sx <= 100 + margin;
    }

    assignStablePool(pool, items, keyFor = (item) => item.id) {
        const itemsByKey = new Map();
        for (const item of items) itemsByKey.set(keyFor(item), item);

        const assigned = new Map();
        const usedKeys = new Set();
        for (const slot of pool) {
            if (slot.key === null || slot.key === undefined) continue;
            const item = itemsByKey.get(slot.key);
            if (!item) continue;
            assigned.set(slot, item);
            usedKeys.add(slot.key);
        }

        const freeSlots = pool.filter((slot) => !assigned.has(slot));
        let freeIndex = 0;
        for (const item of items) {
            const key = keyFor(item);
            if (usedKeys.has(key)) continue;
            const slot = freeSlots[freeIndex];
            if (!slot) break;
            freeIndex += 1;
            slot.key = key;
            assigned.set(slot, item);
            usedKeys.add(key);
        }

        for (const slot of pool) {
            if (!assigned.has(slot)) slot.key = null;
        }
        return assigned;
    }

    changeZoom(delta) {
        this.camera.zoom = clamp(this.camera.zoom + delta, 0.72, 1.42);
        this.clampCamera();
        this.changed = true;
    }

    centerOnPark() {
        this.visitStop(2);
    }

    nudgeCamera(direction) {
        this.camera.targetX += direction * this.viewWidth() * 0.48;
        this.clampCameraTarget();
        this.changed = true;
    }

    clampCameraTarget() {
        const half = this.viewWidth() * 0.5;
        this.camera.targetX = clamp(this.camera.targetX, half, WORLD_WIDTH - half);
    }

    clampCamera() {
        const half = this.viewWidth() * 0.5;
        this.camera.x = clamp(this.camera.x, half, WORLD_WIDTH - half);
        this.clampCameraTarget();
    }

    buildBackdrop() {
        this.skyBands = [];
        [[0,0,100,18],[0,18,100,18],[0,36,100,18],[0,54,100,18]].forEach((rect) => {
            const node = makeShape(ShapeUtils.rectangle(...rect), COLORS.skyDayLow);
            this.skyBands.push(node);
            this.base.addChild(node);
        });

        this.sunNode = makeShape(polyCircle(78, 14, 4.2, 20), COLORS.sun);
        this.moonNode = makeShape(polyCircle(22, 14, 3.6, 20), COLORS.moon);
        this.moonCut = makeShape(polyCircle(23.5, 13.1, 3.4, 20), COLORS.skyNightTop);
        this.base.addChild(this.sunNode);
        this.base.addChild(this.moonNode);
        this.base.addChild(this.moonCut);

        this.clouds = [];
        for (let i = 0; i < 12; i += 1) {
            const nodes = [
                makeShape(ShapeUtils.rectangle(0,0,0,0), [255,255,255,185]),
                makeShape(ShapeUtils.rectangle(0,0,0,0), [255,255,255,185]),
                makeShape(ShapeUtils.rectangle(0,0,0,0), [255,255,255,185])
            ];
            nodes.forEach((n) => this.base.addChild(n));
            this.clouds.push({
                x: i * 220 + range(this.rng, -80, 80),
                y: range(this.rng, 8, 26),
                speed: range(this.rng, 1.2, 3.2),
                size: range(this.rng, 0.8, 1.5),
                nodes
            });
        }

        this.farLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.transparent);
        this.midLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.transparent);
        this.groundLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.transparent);
        this.frontLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.transparent);
        this.dynamicLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.transparent);
        this.effectLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.transparent);
        this.base.addChild(this.farLayer);
        this.base.addChild(this.midLayer);
        this.base.addChild(this.groundLayer);
        this.base.addChild(this.frontLayer);
        this.base.addChild(this.dynamicLayer);
        this.base.addChild(this.effectLayer);

        this.parkGround = makeShape(ShapeUtils.rectangle(0, 38, 0, 44), COLORS.grassA);
        this.parkGround2 = makeShape(ShapeUtils.rectangle(0, 43, 0, 37), COLORS.grassB);
        this.parkPathA = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.path);
        this.parkPathB = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.path);
        this.lakeNode = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.waterA, { color: COLORS.waterB, border: 2 });
        this.lakeHighlight = makeShape(ShapeUtils.rectangle(0,0,0,0), [180,231,236,130]);
        this.sidewalk = makeShape(ShapeUtils.rectangle(0, 76, 100, 7), COLORS.sidewalk);
        this.road = makeShape(ShapeUtils.rectangle(0, 83, 100, 17), COLORS.road);
        this.roadShadow = makeShape(ShapeUtils.rectangle(0, 83, 100, 2), COLORS.roadDark);
        this.laneNodes = [];
        for (let i = 0; i < 16; i += 1) {
            const lane = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.lane);
            this.laneNodes.push(lane);
            this.groundLayer.addChild(lane);
        }
        this.groundLayer.addChildren(
            this.parkGround,
            this.parkGround2,
            this.parkPathA,
            this.parkPathB,
            this.lakeNode,
            this.lakeHighlight,
            this.sidewalk,
            this.road,
            this.roadShadow
        );
    }

    buildWorldPools() {
        this.farBuildingPool = [];
        for (let i = 0; i < POOLS.farBuildings; i += 1) {
            const body = makeShape(ShapeUtils.rectangle(0,0,0,0), BUILDING_COLORS[0]);
            const roof = makeShape(ShapeUtils.rectangle(0,0,0,0), BUILDING_COLORS[1]);
            this.farBuildingPool.push({ key: null, body, roof });
            this.farLayer.addChildren(body, roof);
        }

        this.midBuildingPool = [];
        for (let i = 0; i < POOLS.midBuildings; i += 1) {
            const body = makeShape(ShapeUtils.rectangle(0,0,0,0), BUILDING_COLORS[2]);
            const side = makeShape(ShapeUtils.rectangle(0,0,0,0), BUILDING_COLORS[3]);
            const roof = makeShape(ShapeUtils.rectangle(0,0,0,0), BUILDING_COLORS[4]);
            this.midBuildingPool.push({ key: null, body, side, roof });
            this.midLayer.addChildren(body, side, roof);
        }

        this.frontBuildingPool = [];
        for (let i = 0; i < POOLS.frontBuildings; i += 1) {
            const bundle = {
                key: null,
                body: makeShape(ShapeUtils.rectangle(0,0,0,0), BUILDING_COLORS[0]),
                side: makeShape(ShapeUtils.rectangle(0,0,0,0), BUILDING_COLORS[1]),
                roof: makeShape(ShapeUtils.rectangle(0,0,0,0), BUILDING_COLORS[2]),
                cornice: makeShape(ShapeUtils.rectangle(0,0,0,0), BUILDING_COLORS[3]),
                door: makeShape(ShapeUtils.rectangle(0,0,0,0), [58,64,72,255]),
                awning: makeShape(ShapeUtils.rectangle(0,0,0,0), [214,101,94,255]),
                windows: [],
                store: makeShape(ShapeUtils.rectangle(0,0,0,0), BUILDING_COLORS[3])
            };
            for (let w = 0; w < 6; w += 1) bundle.windows.push(makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.windowDay));
            this.frontBuildingPool.push(bundle);
            this.frontLayer.addChildren(bundle.body, bundle.side, bundle.roof, bundle.cornice, bundle.store, bundle.door, bundle.awning, ...bundle.windows);
        }

        this.treePool = [];
        for (let i = 0; i < POOLS.trees; i += 1) {
            const bundle = {
                key: null,
                shadow: makeShape(ShapeUtils.rectangle(0,0,0,0), [30, 75, 50, 80]),
                trunk: makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.treeTrunk),
                branchA: makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.treeTrunk),
                branchB: makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.treeTrunk),
                canopyA: makeShape(ShapeUtils.rectangle(0,0,0,0), TREE_COLORS[0]),
                canopyB: makeShape(ShapeUtils.rectangle(0,0,0,0), TREE_COLORS[1]),
                canopyC: makeShape(ShapeUtils.rectangle(0,0,0,0), TREE_COLORS[2])
            };
            this.treePool.push(bundle);
            this.frontLayer.addChildren(bundle.shadow, bundle.trunk, bundle.branchA, bundle.branchB, bundle.canopyA, bundle.canopyB, bundle.canopyC);
        }

        this.propPool = [];
        for (let i = 0; i < POOLS.props; i += 1) {
            const bundle = {
                key: null,
                a: makeShape(ShapeUtils.rectangle(0,0,0,0), [80,80,80,255]),
                b: makeShape(ShapeUtils.rectangle(0,0,0,0), [120,120,120,255]),
                c: makeShape(ShapeUtils.rectangle(0,0,0,0), [180,180,180,255])
            };
            this.propPool.push(bundle);
            this.frontLayer.addChildren(bundle.a, bundle.b, bundle.c);
        }
    }

    buildDynamicPools() {
        for (let i = 0; i < POOLS.people; i += 1) {
            const nodes = [];
            for (let n = 0; n < 12; n += 1) {
                const node = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.white);
                nodes.push(node);
                this.dynamicLayer.addChild(node);
            }
            this.people.push({ active: false, nodes, x: 0, y: 0, dir: 1, speed: 0, type: 'commuter', targetX: 0, pause: 0, phase: 0, clothing: CLOTHING[0], skin: SKIN[0], accessory: 0 });
        }

        for (let i = 0; i < POOLS.cars; i += 1) {
            const nodes = [];
            for (let n = 0; n < 4; n += 1) {
                const node = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.white);
                nodes.push(node);
                this.dynamicLayer.addChild(node);
            }
            this.cars.push({ active: false, nodes, x: 0, y: 0, dir: 1, speed: 0, color: VEHICLE_COLORS[0], taxi: false });
        }

        for (let i = 0; i < POOLS.buses; i += 1) {
            const nodes = [];
            for (let n = 0; n < 7; n += 1) {
                const node = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.white);
                nodes.push(node);
                this.dynamicLayer.addChild(node);
            }
            this.buses.push({ active: false, nodes, x: 0, y: 0, dir: 1, speed: 0, stopTimer: 0, route: i });
        }

        for (let i = 0; i < POOLS.bikes; i += 1) {
            const nodes = [];
            for (let n = 0; n < 4; n += 1) {
                const node = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.white);
                nodes.push(node);
                this.dynamicLayer.addChild(node);
            }
            this.bikes.push({ active: false, nodes, x: 0, y: 0, dir: 1, speed: 0, color: CLOTHING[i % CLOTHING.length], phase: 0 });
        }

        for (let i = 0; i < POOLS.birds; i += 1) {
            const nodes = [
                makeShape(ShapeUtils.rectangle(0,0,0,0), [39,48,61,255]),
                makeShape(ShapeUtils.rectangle(0,0,0,0), [39,48,61,255])
            ];
            this.dynamicLayer.addChildren(...nodes);
            this.birds.push({ active: false, nodes, x: 0, y: 0, dir: 1, speed: 0, phase: 0, altitude: 0 });
        }

        for (let i = 0; i < POOLS.fish; i += 1) {
            const nodes = [
                makeShape(ShapeUtils.rectangle(0,0,0,0), [245,165,76,255]),
                makeShape(ShapeUtils.rectangle(0,0,0,0), [245,195,89,255])
            ];
            this.dynamicLayer.addChildren(...nodes);
            this.fish.push({ active: false, nodes, x: 0, y: 0, dir: 1, speed: 0, phase: 0, color: [245,165,76,255] });
        }

        for (let i = 0; i < POOLS.planes; i += 1) {
            const nodes = [];
            for (let n = 0; n < 5; n += 1) {
                const node = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.white);
                nodes.push(node);
                this.dynamicLayer.addChild(node);
            }
            this.planes.push({ active: false, nodes, x: 0, y: 0, dir: 1, speed: 0, color: [238,242,245,255] });
        }

        for (let i = 0; i < POOLS.boats; i += 1) {
            const nodes = [];
            for (let n = 0; n < 4; n += 1) {
                const node = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.white);
                nodes.push(node);
                this.dynamicLayer.addChild(node);
            }
            this.boats.push({ active: false, nodes, x: 0, y: 0, dir: 1, speed: 0, color: VEHICLE_COLORS[i % VEHICLE_COLORS.length], phase: 0 });
        }

        for (let i = 0; i < POOLS.effects; i += 1) {
            const node = makeShape(ShapeUtils.rectangle(0,0,0,0), COLORS.event, { color: COLORS.white, border: 2 });
            this.effects.push({ active: false, node, x: 0, y: 0, ttl: 0, max: 0, type: 'ring', color: COLORS.event, size: 1 });
            this.effectLayer.addChild(node);
        }
    }

    buildClickLayer() {
        this.clickSurface = makeShape(ShapeUtils.rectangle(0, 13, 100, 80), COLORS.transparent, {
            onClick: (playerId, x, y) => this.press(playerId, () => this.handleWorldClick(x, (y - 13) / 0.81, playerId))
        });
        this.overlay.addChild(this.clickSurface);
    }

    buildHud() {
        this.hudLayer = makeShape(EMPTY_POLYGON, COLORS.transparent);
        this.overlay.addChild(this.hudLayer);
        const ink = [27, 43, 55, 255];
        const cream = [250, 245, 223, 255];
        const text = (value, x, y, size, color = cream, align = 'center') => {
            const node = new GameNode.Text({ textInfo: { text: value, x, y, size, color, align, font: 'default' } });
            this.hudLayer.addChild(node);
            return node;
        };
        const button = (x, y, w, h, label, action, size = 1.4) => {
            const background = makeShape(ShapeUtils.rectangle(x, y, w, h), [46, 66, 76, 255], {
                onClick: (playerId) => this.press(playerId, action)
            });
            this.hudLayer.addChild(background);
            const caption = text(label, x + w / 2, y + h / 2 - size * 0.75, size);
            return { background, caption };
        };
        this.hudLayer.addChild(makeShape(ShapeUtils.rectangle(0, 0, 100, 13), ink));
        text('CITY SCANNER', 2.5, 2.0, 2.35, cream, 'left');
        text('Explore together · one shared view', 2.5, 8.4, 1.05, [180, 207, 205, 255], 'left');
        this.stopButtons = STOPS.map((stop, index) => button(27 + index * 14.2, 2.6, 13, 8,
            `${index + 1}  ${stop.name}`, () => this.visitStop(index), 1.3));

        this.hudLayer.addChild(makeShape(ShapeUtils.rectangle(17, 14, 66, 6.2), [250, 245, 223, 255]));
        this.hintText = text('', 50, 15.6, 1.25, ink);
        button(1.5, 44, 7, 11, '<', () => this.nudgeCamera(-1), 3);
        button(91.5, 44, 7, 11, '>', () => this.nudgeCamera(1), 3);
        button(1.5, 15, 6.5, 8, '-', () => this.changeZoom(-0.12), 2.5);
        button(9, 15, 6.5, 8, '+', () => this.changeZoom(0.12), 2.5);
        this.pauseButton = button(84.5, 15, 14, 8, 'Pause', () => this.togglePause(), 1.5);

        this.hudLayer.addChild(makeShape(ShapeUtils.rectangle(0, 94, 100, 6), ink));
        this.controlsText = text('Tap the city · Arrows move · 1–5 visit · +/- zoom · Space pauses · Enter explores', 50, 95.7, 1.15);
    }

    renderHud() {
        const nearest = STOPS.reduce((best, stop) => Math.abs(stop.x - this.camera.x) < Math.abs(best.x - this.camera.x) ? stop : best);
        for (let i = 0; i < this.stopButtons.length; i++) {
            this.stopButtons[i].background.node.fill = STOPS[i] === nearest ? [56, 107, 99, 255] : [46, 66, 76, 255];
        }
        this.hintText.node.text.text = this.paused ? 'City paused. Explore at your own pace, then press Play.'
            : this.inputTime < this.feedbackUntil ? this.feedback : nearest.hint;
        this.pauseButton.caption.node.text.text = this.paused ? 'Play' : 'Pause';
    }

    seedSimulation() {
        const parkTypes = ['tourist', 'jogger', 'dogwalker', 'tourist', 'jogger', 'commuter'];
        for (let i = 0; i < 34; i += 1) {
            this.activatePerson(pick(this.rng, parkTypes), range(this.rng, PARK_LEFT + 20, PARK_RIGHT - 20), null);
        }
        for (const cafe of this.world.cafes) {
            for (let i = 0; i < 4; i += 1) this.activatePerson('coffee', cafe.x + range(this.rng, -35, 35), cafe.queueX + range(this.rng, -3, 4));
        }
        for (let i = 0; i < 28; i += 1) {
            this.activatePerson(pick(this.rng, ['commuter', 'commuter', 'tourist', 'cyclist']), range(this.rng, 0, WORLD_WIDTH), null);
        }
        for (let i = 0; i < 20; i += 1) this.activateCar(i % 4 === 0);
        for (let i = 0; i < 5; i += 1) this.activateBus(i);
        for (let i = 0; i < 12; i += 1) this.activateBike();
        for (let i = 0; i < 30; i += 1) {
            const x = i < 16 ? range(this.rng, PARK_LEFT, PARK_RIGHT) : range(this.rng, 0, WORLD_WIDTH);
            this.activateBird(x, range(this.rng, 11, 33));
        }
        for (let i = 0; i < 24; i += 1) this.activateFish(range(this.rng, LAKE_LEFT + 20, LAKE_RIGHT - 20));
        for (let i = 0; i < 4; i += 1) this.activatePlane();
        for (let i = 0; i < 6; i += 1) this.activateBoat();
    }

    activatePerson(type, x, targetX) {
        let person = this.people.find((item) => !item.active);
        if (!person) person = this.people[Math.floor(this.rng() * this.people.length)];
        person.active = true;
        person.type = type || 'commuter';
        person.x = finite(x, this.camera.x);
        person.dir = this.rng() < 0.5 ? -1 : 1;
        person.speed = person.type === 'jogger' ? range(this.rng, 10, 14) : person.type === 'cyclist' ? range(this.rng, 14, 18) : range(this.rng, 4, 7);
        person.phase = range(this.rng, 0, Math.PI * 2);
        person.pause = range(this.rng, 0, 2);
        person.clothing = pick(this.rng, CLOTHING);
        person.skin = pick(this.rng, SKIN);
        person.accessory = Math.floor(this.rng() * 4);
        if (person.type === 'jogger' || person.type === 'dogwalker' || person.type === 'tourist') {
            person.x = clamp(person.x, PARK_LEFT + 18, PARK_RIGHT - 18);
            person.y = person.type === 'jogger' ? 72.5 : range(this.rng, 56, 75);
            person.targetX = targetX === null ? range(this.rng, PARK_LEFT + 20, PARK_RIGHT - 20) : targetX;
            this.keepOnPath(person);
        } else if (person.type === 'coffee') {
            const cafe = pick(this.rng, this.world.cafes);
            person.y = 75.2;
            person.targetX = targetX === null ? cafe.queueX + range(this.rng, -3, 3) : targetX;
        } else if (person.type === 'cyclist') {
            person.y = 80.3;
            person.targetX = targetX === null ? (person.dir > 0 ? WORLD_WIDTH + 40 : -40) : targetX;
        } else {
            person.y = 76.1;
            person.targetX = targetX === null ? clamp(person.x + person.dir * range(this.rng, 80, 360), 0, WORLD_WIDTH) : targetX;
        }
        return person;
    }

    keepOnPath(person) {
        // Walk around the southern shore whenever a route crosses the lake.
        // Testing only the start point lets walkers enter the water later.
        if (Math.min(person.x, person.targetX) < LAKE_RIGHT
            && Math.max(person.x, person.targetX) > LAKE_LEFT
            && person.y >= 55 && person.y < 78) person.y = 78.2;
    }

    activateCar(taxi) {
        let car = this.cars.find((item) => !item.active);
        if (!car) car = this.cars[Math.floor(this.rng() * this.cars.length)];
        car.active = true;
        car.dir = this.rng() < 0.5 ? -1 : 1;
        car.x = car.dir > 0 ? range(this.rng, -100, WORLD_WIDTH) : range(this.rng, 0, WORLD_WIDTH + 100);
        car.y = car.dir > 0 ? 88.3 : 94.0;
        car.speed = range(this.rng, 20, 34);
        car.taxi = !!taxi;
        car.color = taxi ? [237,190,54,255] : pick(this.rng, VEHICLE_COLORS);
        return car;
    }

    activateBus(route) {
        let bus = this.buses.find((item) => !item.active);
        if (!bus) bus = this.buses[Math.floor(this.rng() * this.buses.length)];
        bus.active = true;
        bus.route = Number.isFinite(route) ? route : Math.floor(this.rng() * 3);
        bus.dir = bus.route % 2 === 0 ? 1 : -1;
        bus.x = bus.dir > 0 ? range(this.rng, -150, WORLD_WIDTH) : range(this.rng, 0, WORLD_WIDTH + 150);
        bus.y = bus.dir > 0 ? 86.4 : 92.0;
        bus.speed = range(this.rng, 13, 18);
        bus.stopTimer = 0;
        return bus;
    }

    activateBike() {
        let bike = this.bikes.find((item) => !item.active);
        if (!bike) bike = this.bikes[Math.floor(this.rng() * this.bikes.length)];
        bike.active = true;
        bike.dir = this.rng() < 0.5 ? -1 : 1;
        bike.x = range(this.rng, 0, WORLD_WIDTH);
        bike.y = 80.2;
        bike.speed = range(this.rng, 12, 18);
        bike.color = pick(this.rng, CLOTHING);
        bike.phase = range(this.rng, 0, Math.PI * 2);
        return bike;
    }

    activateBird(x, y) {
        let bird = this.birds.find((item) => !item.active);
        if (!bird) bird = this.birds[Math.floor(this.rng() * this.birds.length)];
        bird.active = true;
        bird.x = finite(x, this.camera.x);
        bird.y = finite(y, range(this.rng, 11, 32));
        bird.dir = this.rng() < 0.5 ? -1 : 1;
        bird.speed = range(this.rng, 10, 18);
        bird.phase = range(this.rng, 0, Math.PI * 2);
        bird.altitude = range(this.rng, -1.5, 1.5);
        return bird;
    }

    activateFish(x) {
        let fish = this.fish.find((item) => !item.active);
        if (!fish) fish = this.fish[Math.floor(this.rng() * this.fish.length)];
        fish.active = true;
        fish.x = clamp(finite(x, (LAKE_LEFT + LAKE_RIGHT) * 0.5), LAKE_LEFT + 8, LAKE_RIGHT - 8);
        fish.y = range(this.rng, 61, 73);
        fish.dir = this.rng() < 0.5 ? -1 : 1;
        fish.speed = range(this.rng, 3.5, 7.5);
        fish.phase = range(this.rng, 0, Math.PI * 2);
        fish.color = pick(this.rng, [[241,149,62,255], [239,206,82,255], [92,166,205,255], [219,104,121,255], [92,181,144,255]]);
        return fish;
    }

    activatePlane() {
        let plane = this.planes.find((item) => !item.active);
        if (!plane) plane = this.planes[Math.floor(this.rng() * this.planes.length)];
        plane.active = true;
        plane.dir = this.rng() < 0.5 ? -1 : 1;
        plane.x = plane.dir > 0 ? -160 : WORLD_WIDTH + 160;
        plane.y = range(this.rng, 8, 18);
        plane.speed = range(this.rng, 28, 42);
        plane.color = pick(this.rng, [[238,242,245,255], [220,229,236,255], [238,222,216,255]]);
        return plane;
    }

    activateBoat() {
        let boat = this.boats.find((item) => !item.active);
        if (!boat) boat = this.boats[Math.floor(this.rng() * this.boats.length)];
        boat.active = true;
        boat.dir = this.rng() < 0.5 ? -1 : 1;
        boat.x = range(this.rng, LAKE_LEFT + 30, LAKE_RIGHT - 30);
        boat.y = range(this.rng, 62, 72);
        boat.speed = range(this.rng, 1.5, 3.2);
        boat.phase = range(this.rng, 0, Math.PI * 2);
        boat.color = pick(this.rng, VEHICLE_COLORS);
        return boat;
    }

    spawnEffect(x, y, type, color, size) {
        let effect = this.effects.find((item) => !item.active);
        if (!effect) effect = this.effects[Math.floor(this.rng() * this.effects.length)];
        effect.active = true;
        effect.x = x;
        effect.y = y;
        effect.type = type || 'ring';
        effect.ttl = effect.type === 'spark' ? 0.9 : 1.3;
        effect.max = effect.ttl;
        effect.color = color || COLORS.event;
        effect.size = size || 1;
        effect.node.node.fill = effect.color;
        effect.node.node.color = COLORS.white;
    }

    spawnBirdFlock(worldX, count) {
        for (let i = 0; i < count; i += 1) {
            this.activateBird(worldX + range(this.rng, -18, 18), range(this.rng, 11, 30));
            this.spawnEffect(worldX + range(this.rng, -12, 12), range(this.rng, 12, 27), 'spark', [234,243,247,255], 0.7);
        }
        if (this.rng() < 0.22) this.activatePlane();
    }

    spawnFishSchool(worldX, count) {
        for (let i = 0; i < count; i += 1) this.activateFish(worldX + range(this.rng, -22, 22));
        for (let i = 0; i < 5; i += 1) this.spawnEffect(worldX + range(this.rng, -18, 18), range(this.rng, 61, 73), 'ripple', [191,236,241,255], range(this.rng, 0.7, 1.4));
        if (this.rng() < 0.2) this.activateBoat();
    }

    spawnParkMoment(worldX) {
        const types = ['jogger', 'tourist', 'dogwalker', 'tourist', 'jogger'];
        const count = 2 + Math.floor(this.rng() * 4);
        for (let i = 0; i < count; i += 1) {
            this.activatePerson(pick(this.rng, types), clamp(worldX + range(this.rng, -35, 35), PARK_LEFT + 15, PARK_RIGHT - 15), null);
            this.spawnEffect(worldX + range(this.rng, -22, 22), range(this.rng, 53, 75), 'spark', pick(this.rng, [[255,210,102,255], [244,151,173,255], [126,219,160,255]]), 0.8);
        }
        if (this.rng() < 0.55) this.spawnBirdFlock(worldX, 2);
    }

    spawnCafeRush(cafe) {
        const count = 3 + Math.floor(this.rng() * 4);
        for (let i = 0; i < count; i += 1) {
            this.activatePerson('coffee', cafe.queueX + range(this.rng, -20, 20), cafe.queueX + range(this.rng, -2, 4));
        }
        for (let i = 0; i < 8; i += 1) this.spawnEffect(cafe.x + range(this.rng, -4, 5), range(this.rng, 55, 68), 'steam', [238,238,228,220], range(this.rng, 0.5, 1.1));
    }

    spawnStreetRush(worldX) {
        const taxi = this.activateCar(true);
        taxi.x = clamp(worldX - taxi.dir * 24, 0, WORLD_WIDTH);
        if (this.rng() < 0.45) this.activateBus();
        if (this.rng() < 0.65) this.activateBike();
        for (let i = 0; i < 3; i += 1) this.activatePerson('commuter', worldX + range(this.rng, -18, 18), null);
        this.spawnEffect(worldX, 85, 'ring', [255,214,92,255], 1.1);
    }

    spawnOfficeMoment(worldX) {
        for (let i = 0; i < 4; i += 1) this.activatePerson('commuter', worldX + range(this.rng, -14, 14), null);
        for (let i = 0; i < 7; i += 1) this.spawnEffect(worldX + range(this.rng, -16, 16), range(this.rng, 32, 66), 'window', [255,218,116,255], range(this.rng, 0.5, 0.9));
    }

    nearestCafe(worldX) {
        let best = null;
        let distance = Infinity;
        for (const cafe of this.world.cafes) {
            const d = Math.abs(cafe.x - worldX);
            if (d < distance) {
                distance = d;
                best = cafe;
            }
        }
        return distance < 28 ? best : null;
    }

    handleWorldClick(screenX, screenY, playerId) {
        if (!this.keys.has(playerId) || !Number.isFinite(screenX) || !Number.isFinite(screenY)
            || screenX < 0 || screenX > 100 || screenY < 0 || screenY > 100 || this.paused) return;
        if (this.inputTime - (this.lastAction.get(playerId) ?? -Infinity) < 0.3) return;
        this.lastAction.set(playerId, this.inputTime);
        const worldX = this.screenToWorldX(screenX);
        this.eventCount += 1;
        if (screenY < 31) {
            this.spawnBirdFlock(worldX, 4 + Math.floor(this.rng() * 4));
            this.feedback = 'A little company in the sky. Follow the flock!';
        } else if (isLakePoint(worldX, screenY)) {
            this.spawnFishSchool(worldX, 3 + Math.floor(this.rng() * 4));
            this.feedback = 'Feeding time! The fish are gathering.';
        } else {
            const cafe = this.nearestCafe(worldX);
            if (cafe && screenY >= 48 && screenY <= 78) {
                this.spawnCafeRush(cafe);
                this.feedback = 'Coffee is on. Here come the regulars!';
            } else if (isParkX(worldX) && screenY >= 36 && screenY <= 79) {
                this.spawnParkMoment(worldX);
                this.feedback = 'A perfect day for a walk in the park.';
            } else if (screenY >= 80) {
                this.spawnStreetRush(worldX);
                this.feedback = 'Taxi! Your ride is on the way.';
            } else {
                this.spawnOfficeMoment(worldX);
                this.feedback = 'The neighborhood is waking up.';
            }
        }
        this.spawnEffect(worldX, screenY, 'ring', COLORS.event, 1.5);
        this.feedbackUntil = this.inputTime + 4;
        this.changed = true;
    }

    tick() {
        this.inputTime += DT;
        this.updateCamera();
        if (!this.paused) {
            this.time += DT;
            this.dayClock = (this.dayClock + DT / 260) % 1;
            this.updateSimulation();
        } else if (!this.changed) {
            return;
        }
        this.render(false);
    }

    updateCamera() {
        let input = 0;
        for (const keys of this.keys.values()) {
            if (keys.has('arrowleft') || keys.has('a')) input -= 1;
            if (keys.has('arrowright') || keys.has('d')) input += 1;
        }
        input = Math.sign(input);
        if (input !== 0) {
            this.camera.targetX += input * 72 * DT / this.camera.zoom;
            this.clampCameraTarget();
        }
        const error = this.camera.targetX - this.camera.x;
        const acceleration = error * 7.5 - this.camera.velocity * 5.4;
        this.camera.velocity += acceleration * DT;
        if (Math.abs(error) < 0.01 && Math.abs(this.camera.velocity) < 0.01) {
            this.camera.x = this.camera.targetX;
            this.camera.velocity = 0;
        } else {
            this.camera.x += this.camera.velocity * DT;
            this.changed = true;
        }
        this.clampCamera();
    }

    updateSimulation() {
        this.updateClouds();
        this.updatePeople();
        this.updateVehicles();
        this.updateBirds();
        this.updateFish();
        this.updatePlanes();
        this.updateBoats();
        this.updateEffects();
    }

    updateClouds() {
        for (const cloud of this.clouds) {
            cloud.x += cloud.speed * DT;
            if (cloud.x > WORLD_WIDTH + 180) cloud.x = -180;
        }
    }

    updatePeople() {
        for (const person of this.people) {
            if (!person.active) continue;
            person.phase += person.speed * DT * 0.48;
            if (person.pause > 0) {
                person.pause -= DT;
                continue;
            }
            const dx = person.targetX - person.x;
            if (Math.abs(dx) < 1.2) {
                person.pause = person.type === 'tourist' ? range(this.rng, 1.5, 4.0) : person.type === 'coffee' ? range(this.rng, 2.5, 6.0) : range(this.rng, 0.2, 1.2);
                if (person.type === 'jogger' || person.type === 'dogwalker' || person.type === 'tourist') {
                    person.targetX = range(this.rng, PARK_LEFT + 20, PARK_RIGHT - 20);
                    person.y = person.type === 'jogger' ? 72.5 : range(this.rng, 55, 75);
                    this.keepOnPath(person);
                } else if (person.type === 'coffee') {
                    person.type = 'commuter';
                    person.targetX = clamp(person.x + (this.rng() < 0.5 ? -1 : 1) * range(this.rng, 80, 300), 0, WORLD_WIDTH);
                } else if (person.type === 'cyclist') {
                    person.targetX = person.dir > 0 ? WORLD_WIDTH + 60 : -60;
                } else {
                    person.targetX = clamp(person.x + (this.rng() < 0.5 ? -1 : 1) * range(this.rng, 70, 360), 0, WORLD_WIDTH);
                }
            } else {
                person.dir = dx >= 0 ? 1 : -1;
                person.x += person.dir * person.speed * DT;
            }
            if (person.x < -80 || person.x > WORLD_WIDTH + 80) {
                person.x = person.dir > 0 ? -40 : WORLD_WIDTH + 40;
            }
        }
    }

    updateVehicles() {
        for (const car of this.cars) {
            if (!car.active) continue;
            car.x += car.dir * car.speed * DT;
            if (car.x > WORLD_WIDTH + 120) car.x = -120;
            if (car.x < -120) car.x = WORLD_WIDTH + 120;
        }
        for (const bus of this.buses) {
            if (!bus.active) continue;
            if (bus.stopTimer > 0) {
                bus.stopTimer -= DT;
            } else {
                const previousX = bus.x;
                bus.x += bus.dir * bus.speed * DT;
                for (const stop of this.world.busStops) {
                    if (stop.direction === bus.dir && (stop.x - previousX) * bus.dir > 0
                        && (stop.x - bus.x) * bus.dir <= 0) {
                        bus.x = stop.x;
                        bus.stopTimer = range(this.rng, 1.0, 2.5);
                        if (this.rng() < 0.5) this.activatePerson('commuter', stop.x + range(this.rng, -3, 3), null);
                        break;
                    }
                }
            }
            if (bus.x > WORLD_WIDTH + 180) bus.x = -180;
            if (bus.x < -180) bus.x = WORLD_WIDTH + 180;
        }
        for (const bike of this.bikes) {
            if (!bike.active) continue;
            bike.phase += bike.speed * DT * 0.5;
            bike.x += bike.dir * bike.speed * DT;
            if (bike.x > WORLD_WIDTH + 80) bike.x = -80;
            if (bike.x < -80) bike.x = WORLD_WIDTH + 80;
        }
    }

    updateBirds() {
        for (const bird of this.birds) {
            if (!bird.active) continue;
            bird.phase += bird.speed * DT * 0.45;
            bird.x += bird.dir * bird.speed * DT;
            bird.y += Math.sin(bird.phase * 0.27) * DT * 0.28;
            if (bird.x > WORLD_WIDTH + 90) bird.x = -90;
            if (bird.x < -90) bird.x = WORLD_WIDTH + 90;
        }
    }

    updateFish() {
        for (const fish of this.fish) {
            if (!fish.active) continue;
            fish.phase += fish.speed * DT * 0.5;
            fish.x += fish.dir * fish.speed * DT;
            fish.y += Math.sin(fish.phase) * DT * 0.35;
            if (fish.x > LAKE_RIGHT - 8) fish.dir = -1;
            if (fish.x < LAKE_LEFT + 8) fish.dir = 1;
        }
    }

    updatePlanes() {
        for (const plane of this.planes) {
            if (!plane.active) continue;
            plane.x += plane.dir * plane.speed * DT;
            if (plane.x > WORLD_WIDTH + 240 || plane.x < -240) {
                plane.dir = this.rng() < 0.5 ? -1 : 1;
                plane.x = plane.dir > 0 ? -220 : WORLD_WIDTH + 220;
                plane.y = range(this.rng, 8, 18);
                plane.speed = range(this.rng, 28, 42);
            }
        }
    }

    updateBoats() {
        for (const boat of this.boats) {
            if (!boat.active) continue;
            boat.phase += boat.speed * DT;
            boat.x += boat.dir * boat.speed * DT;
            boat.y += Math.sin(boat.phase * 0.8) * DT * 0.08;
            if (boat.x > LAKE_RIGHT - 20) boat.dir = -1;
            if (boat.x < LAKE_LEFT + 20) boat.dir = 1;
        }
    }

    updateEffects() {
        for (const effect of this.effects) {
            if (!effect.active) continue;
            effect.ttl -= DT;
            if (effect.ttl <= 0) effect.active = false;
        }
    }

    render(force) {
        this.renderSky();
        this.renderClouds();
        // Scenery only changes with the camera or a visible lighting step.
        const sceneryKey = `${this.camera.x}:${this.camera.zoom}:${Math.round(this.nightStrength * 64)}`;
        if (force || sceneryKey !== this.sceneryKey) {
            this.renderGround();
            this.renderFarBuildings();
            this.renderMidBuildings();
            this.renderFrontBuildings();
            this.renderTreesAndProps();
            this.sceneryKey = sceneryKey;
        }
        this.renderPeople();
        this.renderVehicles();
        this.renderBirds();
        this.renderFish();
        this.renderPlanes();
        this.renderBoats();
        this.renderEffects();
        this.renderHud();
        this.scene.update();
        this.changed = false;
        this.base.node.onStateChange();
    }

    renderSky() {
        const phase = this.dayClock;
        let top;
        let low;
        let nightStrength;
        if (phase < 0.45) {
            const t = phase / 0.45;
            top = mix(COLORS.skyDayTop, COLORS.skyDayTop, t);
            low = mix(COLORS.skyDayLow, COLORS.skyDayLow, t);
            nightStrength = 0;
        } else if (phase < 0.62) {
            const t = (phase - 0.45) / 0.17;
            top = mix(COLORS.skyDayTop, COLORS.skyDuskTop, t);
            low = mix(COLORS.skyDayLow, COLORS.skyDuskLow, t);
            nightStrength = t * 0.4;
        } else if (phase < 0.82) {
            const t = (phase - 0.62) / 0.2;
            top = mix(COLORS.skyDuskTop, COLORS.skyNightTop, t);
            low = mix(COLORS.skyDuskLow, COLORS.skyNightLow, t);
            nightStrength = 0.4 + t * 0.6;
        } else {
            const t = (phase - 0.82) / 0.18;
            top = mix(COLORS.skyNightTop, COLORS.skyDayTop, t);
            low = mix(COLORS.skyNightLow, COLORS.skyDayLow, t);
            nightStrength = 1 - t;
        }
        this.nightStrength = nightStrength;
        this.skyBands[0].node.fill = top;
        this.skyBands[1].node.fill = mix(top, low, 0.33);
        this.skyBands[2].node.fill = mix(top, low, 0.66);
        this.skyBands[3].node.fill = low;
        this.base.node.fill = low;

        const sunAngle = (phase - 0.08) * Math.PI * 2;
        const sunX = 50 + Math.cos(sunAngle) * 42;
        const sunY = 36 - Math.sin(sunAngle) * 27;
        const moonX = 50 + Math.cos(sunAngle + Math.PI) * 42;
        const moonY = 36 - Math.sin(sunAngle + Math.PI) * 27;
        this.sunNode.node.coordinates2d = sunY > -5 && sunY < 40 ? polyCircle(sunX, sunY, 3.7, 20) : ShapeUtils.rectangle(0,0,0,0);
        this.moonNode.node.coordinates2d = moonY > -5 && moonY < 40 ? polyCircle(moonX, moonY, 3.3, 20) : ShapeUtils.rectangle(0,0,0,0);
        this.moonCut.node.coordinates2d = moonY > -5 && moonY < 40 ? polyCircle(moonX + 1.3, moonY - 0.7, 3.1, 20) : ShapeUtils.rectangle(0,0,0,0);
        this.moonCut.node.fill = top;
    }

    renderClouds() {
        for (const cloud of this.clouds) {
            const x = this.worldToScreenX(cloud.x, 0.22);
            const size = cloud.size;
            if (x < -12 || x > 112) {
                cloud.nodes.forEach(hide);
                continue;
            }
            const alpha = Math.round(175 - this.nightStrength * 90);
            const color = [247,249,247,alpha];
            cloud.nodes[0].node.fill = color;
            cloud.nodes[1].node.fill = color;
            cloud.nodes[2].node.fill = color;
            cloud.nodes[0].node.coordinates2d = polyCircle(x - 2.0 * size, cloud.y, 2.4 * size, 12);
            cloud.nodes[1].node.coordinates2d = polyCircle(x + 0.2 * size, cloud.y - 0.9 * size, 3.0 * size, 12);
            cloud.nodes[2].node.coordinates2d = polyCircle(x + 3.0 * size, cloud.y + 0.1 * size, 2.4 * size, 12);
        }
    }

    renderGround() {
        const parkX = this.worldToScreenX(PARK_LEFT);
        const parkW = (PARK_RIGHT - PARK_LEFT) * this.scale();
        this.parkGround.node.coordinates2d = ShapeUtils.rectangle(parkX, 38, parkW, 44);
        this.parkGround2.node.coordinates2d = ShapeUtils.rectangle(parkX, 44, parkW, 36);
        const pathLeft = this.worldToScreenX(PARK_LEFT + 35);
        const pathWidth = (PARK_RIGHT - PARK_LEFT - 70) * this.scale();
        this.parkPathA.node.coordinates2d = [
            [pathLeft, 72], [pathLeft + pathWidth * 0.23, 68], [pathLeft + pathWidth * 0.48, 74],
            [pathLeft + pathWidth * 0.72, 66], [pathLeft + pathWidth, 71], [pathLeft + pathWidth, 75],
            [pathLeft + pathWidth * 0.72, 70], [pathLeft + pathWidth * 0.48, 78],
            [pathLeft + pathWidth * 0.23, 72], [pathLeft, 76], [pathLeft, 72]
        ];
        this.parkPathB.node.coordinates2d = [
            [pathLeft + pathWidth * 0.08, 53], [pathLeft + pathWidth * 0.31, 57], [pathLeft + pathWidth * 0.58, 50],
            [pathLeft + pathWidth * 0.88, 56], [pathLeft + pathWidth * 0.88, 59], [pathLeft + pathWidth * 0.58, 54],
            [pathLeft + pathWidth * 0.31, 61], [pathLeft + pathWidth * 0.08, 56], [pathLeft + pathWidth * 0.08, 53]
        ];

        const lakeCenter = this.worldToScreenX((LAKE_LEFT + LAKE_RIGHT) * 0.5);
        const lakeRx = (LAKE_RIGHT - LAKE_LEFT) * 0.5 * this.scale();
        this.lakeNode.node.coordinates2d = this.ellipsePolygon(lakeCenter, 66, lakeRx, 11.5, 32);
        this.lakeHighlight.node.coordinates2d = this.ellipsePolygon(lakeCenter - lakeRx * 0.13, 63.7, lakeRx * 0.68, 4.2, 24);

        for (let i = 0; i < this.laneNodes.length; i += 1) {
            const worldX = Math.floor((this.camera.x - this.viewWidth() * 0.6) / 24) * 24 + i * 24;
            const sx = this.worldToScreenX(worldX);
            this.laneNodes[i].node.coordinates2d = ShapeUtils.rectangle(sx, 91.2, 4.8 * this.scale(), 0.55);
        }
    }

    ellipsePolygon(cx, cy, rx, ry, sides) {
        const points = [];
        for (let i = 0; i <= sides; i += 1) {
            const angle = i / sides * Math.PI * 2;
            points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
        }
        return points;
    }

    renderFarBuildings() {
        const visible = this.world.farBuildings
            .filter((building) => this.visibleWorldX(building.x, building.width, 0.26, 30));
        const assigned = this.assignStablePool(this.farBuildingPool, visible);
        for (const slot of this.farBuildingPool) {
            const building = assigned.get(slot);
            if (!building) {
                hide(slot.body); hide(slot.roof); continue;
            }
            const x = this.worldToScreenX(building.x, 0.26);
            const width = building.width * this.scale() * 0.26;
            const height = building.height * 0.68;
            const y = 58 - height;
            const shade = mix([63,82,105,255], [86,93,122,255], building.shade / 5);
            slot.body.node.fill = mix(shade, [28,38,60,255], this.nightStrength * 0.45);
            slot.body.node.coordinates2d = ShapeUtils.rectangle(x, y, width, height);
            slot.roof.node.fill = mix(shade, [20,28,47,255], 0.35 + this.nightStrength * 0.35);
            slot.roof.node.coordinates2d = building.antenna
                ? [[x + width * 0.32, y], [x + width * 0.68, y], [x + width * 0.54, y - 4.2],
                    [x + width * 0.49, y - 8], [x + width * 0.46, y - 4.2], [x + width * 0.32, y]]
                : ShapeUtils.rectangle(x + width * 0.12, y - 1.3, width * 0.76, 1.3);
        }
    }

    renderMidBuildings() {
        const visible = this.world.midBuildings
            .filter((building) => this.visibleWorldX(building.x, building.width, 0.52, 27));
        const assigned = this.assignStablePool(this.midBuildingPool, visible);
        for (const slot of this.midBuildingPool) {
            const building = assigned.get(slot);
            if (!building) {
                hide(slot.body); hide(slot.side); hide(slot.roof); continue;
            }
            const x = this.worldToScreenX(building.x, 0.52);
            const width = building.width * this.scale() * 0.52;
            const height = building.height * 0.8;
            const y = 67 - height;
            const base = BUILDING_COLORS[(building.shade + 2) % BUILDING_COLORS.length];
            slot.body.node.fill = mix(base, [31,39,57,255], this.nightStrength * 0.35);
            slot.body.node.coordinates2d = ShapeUtils.rectangle(x, y, width, height);
            slot.side.node.fill = mix(base, [28,31,43,255], 0.34 + this.nightStrength * 0.32);
            slot.side.node.coordinates2d = [[x + width * 0.78, y],[x + width, y + 1.2],[x + width, 67],[x + width * 0.78,67],[x + width * 0.78,y]];
            slot.roof.node.fill = [46,51,66,255];
            slot.roof.node.coordinates2d = building.roof % 2 === 0
                ? ShapeUtils.rectangle(x + width * 0.18, y - 1.2, width * 0.64, 1.2)
                : triangle(x + width * 0.15, y, x + width * 0.5, y - 3.2, x + width * 0.85, y);
        }
    }

    renderFrontBuildings() {
        const visible = this.world.frontBuildings
            .filter((building) => this.visibleWorldX(building.x, building.width, 1, 24));
        const assigned = this.assignStablePool(this.frontBuildingPool, visible);
        const windowColor = mix(COLORS.windowDay, COLORS.windowNight, clamp(this.nightStrength * 1.25, 0, 1));
        for (const slot of this.frontBuildingPool) {
            const building = assigned.get(slot);
            if (!building) {
                hide(slot.body); hide(slot.side); hide(slot.roof); hide(slot.cornice);
                hide(slot.store); hide(slot.door); hide(slot.awning); slot.windows.forEach(hide); continue;
            }
            const x = this.worldToScreenX(building.x);
            const width = building.width * this.scale();
            const height = building.height;
            const y = 75.8 - height;
            const base = BUILDING_COLORS[building.colorIndex % BUILDING_COLORS.length];
            slot.body.node.fill = mix(base, [30,34,43,255], this.nightStrength * 0.22);
            slot.body.node.coordinates2d = ShapeUtils.rectangle(x, y, width, height);
            slot.side.node.fill = mix(base, [35,35,42,255], 0.36 + this.nightStrength * 0.22);
            slot.side.node.coordinates2d = [[x + width * 0.84,y],[x + width,y + 1.8],[x + width,75.8],[x + width * 0.84,75.8],[x + width * 0.84,y]];
            slot.roof.node.fill = [58,58,67,255];
            slot.roof.node.coordinates2d = building.roof % 2 === 0
                ? ShapeUtils.rectangle(x + width * 0.12, y - 1.2, width * 0.72, 1.2)
                : triangle(x + width * 0.15, y, x + width * 0.5, y - 3.2, x + width * 0.82, y);
            slot.cornice.node.fill = mix(base, [228,220,196,255], 0.22);
            slot.cornice.node.coordinates2d = ShapeUtils.rectangle(x + width * 0.05, y + 1.8, width * 0.84, 0.55);

            const storeHeight = building.storefront ? 6.8 : 2.4;
            slot.store.node.fill = building.cafe ? [105,70,55,255] : mix(base, [45,45,50,255], 0.48);
            slot.store.node.coordinates2d = ShapeUtils.rectangle(x + 0.8, 75.8 - storeHeight, Math.max(0, width - 1.8), storeHeight);
            slot.door.node.fill = mix([55,63,70,255], COLORS.windowNight, this.nightStrength * 0.3);
            slot.door.node.coordinates2d = ShapeUtils.rectangle(x + width * 0.44, 71.2, Math.max(0.6, width * 0.12), 4.6);
            if (building.storefront) {
                slot.awning.node.fill = building.cafe ? [221,102,86,255] : [76,146,151,255];
                slot.awning.node.coordinates2d = [[x + 0.7, 68.7], [x + width - 1.0, 68.7], [x + width - 1.6, 70.2], [x + 1.25, 70.2], [x + 0.7,68.7]];
            } else {
                hide(slot.awning);
            }

            for (let w = 0; w < slot.windows.length; w += 1) {
                const wx = x + width * (0.10 + w * 0.125);
                const columnWidth = Math.max(0.34, width * 0.065);
                slot.windows[w].node.fill = w % 2 === 0 ? windowColor : mix(windowColor, [224,239,241,255], 0.12);
                slot.windows[w].node.coordinates2d = ShapeUtils.rectangle(wx, y + 3.4 + (w % 2) * 0.8, columnWidth, Math.max(0, height - storeHeight - 7.2 - (w % 2) * 0.8));
            }
        }
    }

    renderTreesAndProps() {
        const visibleTrees = this.world.trees
            .filter((tree) => this.visibleWorldX(tree.x, 10, 1, 24));
        const assignedTrees = this.assignStablePool(this.treePool, visibleTrees);
        for (const slot of this.treePool) {
            const tree = assignedTrees.get(slot);
            if (!tree) {
                hide(slot.shadow); hide(slot.trunk); hide(slot.branchA); hide(slot.branchB);
                hide(slot.canopyA); hide(slot.canopyB); hide(slot.canopyC); continue;
            }
            const x = this.worldToScreenX(tree.x);
            const size = tree.size * clamp(this.scale() * 1.4, 0.7, 1.35);
            const y = tree.y;
            const c1 = TREE_COLORS[tree.colorIndex % TREE_COLORS.length];
            const c2 = mix(c1, [142,201,105,255], 0.35);
            const c3 = mix(c1, [37,107,67,255], 0.28);
            slot.shadow.node.coordinates2d = this.ellipsePolygon(x, y + 1.2, 4.2 * size, 1.15 * size, 14);
            slot.trunk.node.fill = mix(COLORS.treeTrunk, [60,50,42,255], this.nightStrength * 0.2);
            slot.trunk.node.coordinates2d = [[x-0.7*size,y],[x+0.72*size,y],[x+0.46*size,y-8.8*size],[x-0.38*size,y-8.8*size],[x-0.7*size,y]];
            slot.branchA.node.fill = slot.trunk.node.fill;
            slot.branchA.node.coordinates2d = thickLine(x - 0.1 * size, y - 5.8 * size, x - 3.0 * size, y - 10.0 * size, 0.42 * size);
            slot.branchB.node.fill = slot.trunk.node.fill;
            slot.branchB.node.coordinates2d = thickLine(x + 0.05 * size, y - 6.4 * size, x + 3.1 * size, y - 10.6 * size, 0.38 * size);
            slot.canopyA.node.fill = mix(c1, [41,68,56,255], this.nightStrength * 0.25);
            slot.canopyB.node.fill = mix(c2, [47,77,63,255], this.nightStrength * 0.25);
            slot.canopyC.node.fill = mix(c3, [34,62,50,255], this.nightStrength * 0.25);
            if (tree.shape % 2 === 0) {
                slot.canopyA.node.coordinates2d = polyCircle(x - 2.7 * size, y - 10.2 * size, 3.5 * size, 14);
                slot.canopyB.node.coordinates2d = polyCircle(x + 2.6 * size, y - 10.8 * size, 3.8 * size, 14);
                slot.canopyC.node.coordinates2d = polyCircle(x, y - 13.0 * size, 4.1 * size, 15);
            } else {
                slot.canopyA.node.coordinates2d = triangle(x - 4.5 * size, y - 6.8 * size, x - 1.0 * size, y - 16.5 * size, x + 1.2 * size, y - 6.8 * size);
                slot.canopyB.node.coordinates2d = triangle(x - 1.6 * size, y - 7.2 * size, x + 2.3 * size, y - 16.2 * size, x + 4.8 * size, y - 7.2 * size);
                slot.canopyC.node.coordinates2d = triangle(x - 3.2 * size, y - 10.0 * size, x, y - 19.0 * size, x + 3.2 * size, y - 10.0 * size);
            }
        }

        const props = [];
        for (const lamp of this.world.lamps) if (this.visibleWorldX(lamp.x, 2, 1, 22)) props.push({ id: `lamp:${lamp.id}`, type: 'lamp', data: lamp });
        for (const bench of this.world.benches) if (this.visibleWorldX(bench.x, 5, 1, 22)) props.push({ id: `bench:${bench.id}`, type: 'bench', data: bench });
        for (const stop of this.world.busStops) if (this.visibleWorldX(stop.x, 4, 1, 22)) props.push({ id: `stop:${stop.id}`, type: 'stop', data: stop });
        for (const feature of this.world.parkFeatures) if (this.visibleWorldX(feature.x, 12, 1, 24)) props.push({ id: `feature:${feature.id}`, type: feature.type, data: feature });
        for (const cafe of this.world.cafes) if (this.visibleWorldX(cafe.x, cafe.width, 1, 24)) props.push({ id: `cafe:${cafe.id}`, type: 'cafe', data: cafe });
        const assignedProps = this.assignStablePool(this.propPool, props);

        for (const slot of this.propPool) {
            const prop = assignedProps.get(slot);
            if (!prop) {
                hide(slot.a); hide(slot.b); hide(slot.c); continue;
            }
            const x = this.worldToScreenX(prop.data.x);
            if (prop.type === 'lamp') {
                slot.a.node.fill = [63,69,76,255];
                slot.a.node.coordinates2d = ShapeUtils.rectangle(x - 0.22, 68.2, 0.44, 10.5);
                slot.b.node.fill = mix([255,233,147,255], [245,247,205,255], 0.2);
                slot.b.node.coordinates2d = polyCircle(x, 67.6, 1.05, 8);
                slot.c.node.fill = [63,69,76,255];
                slot.c.node.coordinates2d = ShapeUtils.rectangle(x - 0.9, 78.4, 1.8, 0.45);
            } else if (prop.type === 'bench') {
                slot.a.node.fill = [107,76,52,255];
                slot.a.node.coordinates2d = ShapeUtils.rectangle(x - 2.6, 75.2, 5.2, 1.1);
                slot.b.node.fill = [96,69,49,255];
                slot.b.node.coordinates2d = ShapeUtils.rectangle(x - 2.4, 73.5, 4.8, 1.2);
                slot.c.node.fill = [62,62,65,255];
                slot.c.node.coordinates2d = thickLine(x - 1.8, 76.2, x - 1.8, 77.6, 0.22);
            } else if (prop.type === 'stop') {
                slot.a.node.fill = [67,73,82,255];
                slot.a.node.coordinates2d = ShapeUtils.rectangle(x - 0.18, 69, 0.36, 11.5);
                slot.b.node.fill = [64,126,184,255];
                slot.b.node.coordinates2d = ShapeUtils.rectangle(x - 1.6, 68.4, 3.2, 2.5);
                slot.c.node.fill = COLORS.white;
                slot.c.node.coordinates2d = polyCircle(x, 69.65, 0.55, 8);
            } else if (prop.type === 'cafe') {
                const width = prop.data.width * this.scale();
                slot.a.node.fill = [75,50,45,255];
                slot.a.node.coordinates2d = ShapeUtils.rectangle(x - width * 0.5, 62.5, width, 13.2);
                slot.b.node.fill = prop.data.awning % 2 ? [237,101,101,255] : [77,159,143,255];
                slot.b.node.coordinates2d = [[x - width * 0.5, 62.5], [x + width * 0.5, 62.5], [x + width * 0.42, 66.0], [x - width * 0.42, 66.0], [x - width * 0.5, 62.5]];
                slot.c.node.fill = [180,221,225,255];
                slot.c.node.coordinates2d = ShapeUtils.rectangle(x - width * 0.32, 67.2, width * 0.64, 6.8);
            } else if (prop.type === 'fountain') {
                slot.a.node.fill = [154,162,168,255];
                slot.a.node.coordinates2d = this.ellipsePolygon(x, 73, 5.6, 1.5, 14);
                slot.b.node.fill = [190,229,236,255];
                slot.b.node.coordinates2d = triangle(x - 0.3, 71.8, x, 62.5, x + 0.3, 71.8);
                slot.c.node.fill = [139,147,154,255];
                slot.c.node.coordinates2d = ShapeUtils.rectangle(x - 0.55, 69.8, 1.1, 2.6);
            } else if (prop.type === 'bridge') {
                slot.a.node.fill = [164,145,121,255];
                slot.a.node.coordinates2d = [[x - 8, 62], [x - 5, 58.5], [x + 5, 58.5], [x + 8, 62], [x + 8, 64], [x - 8, 64], [x - 8, 62]];
                slot.b.node.fill = [103,88,73,255];
                slot.b.node.coordinates2d = thickLine(x - 7, 61.2, x + 7, 61.2, 0.45);
                slot.c.node.fill = [210,195,170,255];
                slot.c.node.coordinates2d = ShapeUtils.rectangle(x - 5.3, 58.2, 10.6, 0.55);
            } else if (prop.type === 'arch' || prop.type === 'gazebo') {
                slot.a.node.fill = [176,172,159,255];
                slot.a.node.coordinates2d = ShapeUtils.rectangle(x - 3.8, 57, 1.1, 18);
                slot.b.node.fill = [176,172,159,255];
                slot.b.node.coordinates2d = ShapeUtils.rectangle(x + 2.7, 57, 1.1, 18);
                slot.c.node.fill = [151,145,134,255];
                slot.c.node.coordinates2d = [[x - 4.5, 57], [x, 51.5], [x + 4.5, 57], [x + 3.6, 58.2], [x - 3.6, 58.2], [x - 4.5,57]];
            } else {
                slot.a.node.fill = [240,120,141,255];
                slot.a.node.coordinates2d = polyCircle(x - 2, 73.5, 1.4, 8);
                slot.b.node.fill = [251,191,82,255];
                slot.b.node.coordinates2d = polyCircle(x + 1.4, 72.8, 1.6, 8);
                slot.c.node.fill = [113,181,94,255];
                slot.c.node.coordinates2d = ShapeUtils.rectangle(x - 3.7, 74.7, 7.4, 1.1);
            }
        }
    }

    renderPeople() {
        for (const person of this.people) {
            if (!person.active || !this.visibleWorldX(person.x, 6, 1, 12)) {
                person.nodes.forEach(hide);
                continue;
            }
            const x = this.worldToScreenX(person.x);
            const y = person.y;
            const moving = person.pause > 0 ? 0.08 : 1;
            const stride = Math.sin(person.phase) * moving;
            const bob = Math.abs(Math.sin(person.phase)) * 0.26 * moving;
            const dir = person.dir;
            const crouch = person.type === 'cyclist' ? 0.42 : 0;
            const shoulderY = y - 4.25 - bob + crouch;
            const hipY = y - 1.75 - bob;
            const leftFootX = x - 0.35 - stride * 0.58;
            const rightFootX = x + 0.35 + stride * 0.58;
            const leftHandX = x - dir * 0.28 + dir * stride * 0.54;
            const rightHandX = x + dir * 0.45 - dir * stride * 0.54;
            const hair = mix(person.clothing, [36,34,38,255], 0.72);
            const trouser = mix(person.clothing, [39,47,58,255], 0.62);

            person.nodes[0].node.fill = [28,36,48,82];
            person.nodes[0].node.coordinates2d = this.ellipsePolygon(x, y + 1.2, 1.35, 0.34, 10);

            person.nodes[1].node.fill = person.clothing;
            person.nodes[1].node.coordinates2d = [[x - 0.72, shoulderY], [x + 0.72, shoulderY], [x + 0.54, hipY], [x - 0.5, hipY], [x - 0.72, shoulderY]];

            person.nodes[2].node.fill = person.skin;
            person.nodes[2].node.coordinates2d = polyCircle(x + dir * 0.05, y - 5.55 - bob + crouch, 0.68, 11);

            person.nodes[3].node.fill = trouser;
            person.nodes[3].node.coordinates2d = thickLine(x - 0.25, hipY, leftFootX, y + 0.55, 0.32);
            person.nodes[4].node.fill = trouser;
            person.nodes[4].node.coordinates2d = thickLine(x + 0.25, hipY, rightFootX, y + 0.55, 0.32);

            person.nodes[5].node.fill = person.skin;
            person.nodes[5].node.coordinates2d = thickLine(x - 0.55, shoulderY + 0.35, leftHandX, y - 2.25 - bob + crouch, 0.24);
            person.nodes[6].node.fill = person.skin;
            person.nodes[6].node.coordinates2d = thickLine(x + 0.55, shoulderY + 0.35, rightHandX, y - 2.25 - bob + crouch, 0.24);

            person.nodes[7].node.fill = hair;
            person.nodes[7].node.coordinates2d = person.accessory % 2 === 0
                ? [[x - 0.68, y - 5.7 - bob + crouch], [x - 0.42, y - 6.25 - bob + crouch], [x + 0.58, y - 6.15 - bob + crouch], [x + 0.72, y - 5.72 - bob + crouch], [x - 0.68, y - 5.7 - bob + crouch]]
                : ShapeUtils.rectangle(x - 0.78, y - 6.0 - bob + crouch, 1.55, 0.36);

            person.nodes[8].node.fill = [41,43,48,255];
            person.nodes[8].node.coordinates2d = thickLine(leftFootX - 0.25, y + 0.64, leftFootX + dir * 0.48, y + 0.64, 0.22);
            person.nodes[9].node.fill = [41,43,48,255];
            person.nodes[9].node.coordinates2d = thickLine(rightFootX - 0.25, y + 0.64, rightFootX + dir * 0.48, y + 0.64, 0.22);

            person.nodes[10].node.fill = mix(person.clothing, COLORS.white, 0.22);
            person.nodes[10].node.coordinates2d = person.type === 'jogger'
                ? ShapeUtils.rectangle(x - 0.52, shoulderY + 1.0, 1.04, 0.34)
                : thickLine(x - 0.5, shoulderY + 0.25, x + 0.45, hipY - 0.2, 0.18);

            if (person.type === 'dogwalker') {
                const dogX = x - dir * 2.15;
                person.nodes[10].node.fill = [93,79,68,255];
                person.nodes[10].node.coordinates2d = thickLine(x - dir * 0.35, y - 2.7, dogX, y - 1.0, 0.08);
                person.nodes[11].node.fill = [145,104,69,255];
                person.nodes[11].node.coordinates2d = [[dogX - 0.85, y - 0.65], [dogX + 0.75, y - 0.72], [dogX + dir * 1.15, y - 1.35], [dogX + 0.92, y + 0.22], [dogX - 0.72, y + 0.22], [dogX - 0.85, y - 0.65]];
            } else if (person.type === 'coffee') {
                person.nodes[11].node.fill = [246,239,222,255];
                person.nodes[11].node.coordinates2d = [[rightHandX - 0.25, y - 3.2 - bob], [rightHandX + 0.28, y - 3.2 - bob], [rightHandX + 0.2, y - 2.35 - bob], [rightHandX - 0.18, y - 2.35 - bob], [rightHandX - 0.25, y - 3.2 - bob]];
            } else if (person.type === 'tourist') {
                person.nodes[11].node.fill = [58,66,80,255];
                person.nodes[11].node.coordinates2d = ShapeUtils.rectangle(x - dir * 1.0, shoulderY + 0.3, 0.82, 1.75);
            } else if (person.type === 'cyclist') {
                person.nodes[11].node.fill = [236,202,78,255];
                person.nodes[11].node.coordinates2d = polyCircle(x + dir * 0.06, y - 6.0 - bob + crouch, 0.75, 10);
            } else {
                person.nodes[11].node.fill = person.accessory === 3 ? [54,62,75,255] : person.clothing;
                person.nodes[11].node.coordinates2d = person.accessory === 3
                    ? ShapeUtils.rectangle(x - dir * 0.95, shoulderY + 0.55, 0.7, 1.45)
                    : polyCircle(rightHandX, y - 2.25 - bob + crouch, 0.18, 6);
            }
        }
    }

    renderVehicles() {
        for (const car of this.cars) {
            if (!car.active || !this.visibleWorldX(car.x, 10, 1, 7)) {
                car.nodes.forEach(hide);
                continue;
            }
            const x = this.worldToScreenX(car.x);
            const y = car.y;
            const dir = car.dir;
            car.nodes[0].node.fill = car.color;
            car.nodes[0].node.coordinates2d = [
                [x - dir * 4.4, y - 2.4], [x + dir * 3.5, y - 2.4], [x + dir * 4.7, y - 0.8],
                [x + dir * 4.3, y + 1.2], [x - dir * 4.6, y + 1.2], [x - dir * 4.4, y - 2.4]
            ];
            car.nodes[1].node.fill = [157,207,220,255];
            car.nodes[1].node.coordinates2d = [
                [x - dir * 1.8, y - 2.5], [x - dir * 0.7, y - 4.5], [x + dir * 2.2, y - 4.5],
                [x + dir * 3.3, y - 2.5], [x - dir * 1.8, y - 2.5]
            ];
            car.nodes[2].node.fill = [35,40,48,255];
            car.nodes[2].node.coordinates2d = polyCircle(x - dir * 2.8, y + 1.4, 0.85, 9);
            car.nodes[3].node.fill = [35,40,48,255];
            car.nodes[3].node.coordinates2d = polyCircle(x + dir * 2.7, y + 1.4, 0.85, 9);
        }

        for (const bus of this.buses) {
            if (!bus.active || !this.visibleWorldX(bus.x, 18, 1, 9)) {
                bus.nodes.forEach(hide);
                continue;
            }
            const x = this.worldToScreenX(bus.x);
            const y = bus.y;
            const dir = bus.dir;
            const bodyColor = bus.route % 2 === 0 ? [72,145,196,255] : [211,84,79,255];
            bus.nodes[0].node.fill = bodyColor;
            bus.nodes[0].node.coordinates2d = ShapeUtils.rectangle(x - 8.5, y - 7.2, 17, 7.7);
            bus.nodes[1].node.fill = [181,220,229,255];
            bus.nodes[1].node.coordinates2d = ShapeUtils.rectangle(x - 6.8, y - 6.1, 12.4, 2.8);
            bus.nodes[2].node.fill = [246,214,90,255];
            bus.nodes[2].node.coordinates2d = ShapeUtils.rectangle(x + dir * 5.8 - 1.2, y - 2.5, 2.4, 1.1);
            bus.nodes[3].node.fill = [33,39,47,255];
            bus.nodes[3].node.coordinates2d = polyCircle(x - 5.1, y + 0.7, 1.05, 10);
            bus.nodes[4].node.fill = [33,39,47,255];
            bus.nodes[4].node.coordinates2d = polyCircle(x + 5.1, y + 0.7, 1.05, 10);
            bus.nodes[5].node.fill = [224,230,232,255];
            bus.nodes[5].node.coordinates2d = ShapeUtils.rectangle(x + dir * 6.2, y - 6.0, 1.3, 4.2);
            bus.nodes[6].node.fill = [47,54,63,255];
            bus.nodes[6].node.coordinates2d = ShapeUtils.rectangle(x - 8.5, y - 7.6, 17, 0.5);
        }

        for (const bike of this.bikes) {
            if (!bike.active || !this.visibleWorldX(bike.x, 6, 1, 6)) {
                bike.nodes.forEach(hide);
                continue;
            }
            const x = this.worldToScreenX(bike.x);
            const y = bike.y;
            const dir = bike.dir;
            bike.nodes[0].node.fill = COLORS.transparent;
            bike.nodes[0].node.color = [44,49,56,255];
            bike.nodes[0].node.border = 3;
            bike.nodes[0].node.coordinates2d = polyCircle(x - dir * 1.7, y, 1.1, 10);
            bike.nodes[1].node.fill = COLORS.transparent;
            bike.nodes[1].node.color = [44,49,56,255];
            bike.nodes[1].node.border = 3;
            bike.nodes[1].node.coordinates2d = polyCircle(x + dir * 1.7, y, 1.1, 10);
            bike.nodes[2].node.fill = bike.color;
            bike.nodes[2].node.coordinates2d = [
                [x - dir * 1.7, y], [x, y - 1.9], [x + dir * 1.7, y], [x - dir * 0.4, y], [x - dir * 1.7, y]
            ];
            bike.nodes[3].node.fill = SKIN[0];
            bike.nodes[3].node.coordinates2d = polyCircle(x, y - 4.2 - Math.abs(Math.sin(bike.phase)) * 0.25, 0.65, 8);
        }
    }

    renderBirds() {
        for (const bird of this.birds) {
            if (!bird.active || !this.visibleWorldX(bird.x, 4, 0.92, 8)) {
                bird.nodes.forEach(hide);
                continue;
            }
            const x = this.worldToScreenX(bird.x, 0.92);
            const y = bird.y + bird.altitude;
            const flap = Math.sin(bird.phase) * 1.3;
            bird.nodes[0].node.fill = [39,48,61,255];
            bird.nodes[0].node.coordinates2d = triangle(x, y, x - 2.2, y - flap, x - 0.25, y + 0.4);
            bird.nodes[1].node.fill = [39,48,61,255];
            bird.nodes[1].node.coordinates2d = triangle(x, y, x + 2.2, y + flap, x + 0.25, y + 0.4);
        }
    }

    renderFish() {
        const lakeVisible = this.visibleWorldX(LAKE_LEFT, LAKE_RIGHT - LAKE_LEFT, 1, 8);
        for (const fish of this.fish) {
            if (!fish.active || !lakeVisible || !this.visibleWorldX(fish.x, 5, 1, 5)) {
                fish.nodes.forEach(hide);
                continue;
            }
            const x = this.worldToScreenX(fish.x);
            const y = fish.y;
            const dir = fish.dir;
            const size = 0.75 + Math.sin(fish.phase * 0.3) * 0.08;
            fish.nodes[0].node.fill = fish.color;
            fish.nodes[0].node.coordinates2d = [
                [x + dir * 2.0 * size, y], [x + dir * 0.5 * size, y - 0.8 * size],
                [x - dir * 1.1 * size, y - 0.65 * size], [x - dir * 1.1 * size, y + 0.65 * size],
                [x + dir * 0.5 * size, y + 0.8 * size], [x + dir * 2.0 * size, y]
            ];
            fish.nodes[1].node.fill = mix(fish.color, [255,236,146,255], 0.25);
            fish.nodes[1].node.coordinates2d = triangle(x - dir * 1.1 * size, y, x - dir * 2.1 * size, y - 0.9 * size, x - dir * 2.1 * size, y + 0.9 * size);
        }
    }

    renderPlanes() {
        for (const plane of this.planes) {
            if (!plane.active || !this.visibleWorldX(plane.x, 20, 0.6, 15)) {
                plane.nodes.forEach(hide);
                continue;
            }
            const x = this.worldToScreenX(plane.x, 0.6);
            const y = plane.y;
            const dir = plane.dir;
            plane.nodes[0].node.fill = plane.color;
            plane.nodes[0].node.coordinates2d = [
                [x + dir * 6.8, y], [x + dir * 3.4, y - 0.8], [x - dir * 5.6, y - 0.65],
                [x - dir * 7.0, y], [x - dir * 5.6, y + 0.65], [x + dir * 3.4, y + 0.8], [x + dir * 6.8, y]
            ];
            plane.nodes[1].node.fill = mix(plane.color, [154,174,189,255], 0.3);
            plane.nodes[1].node.coordinates2d = triangle(x - dir * 0.5, y, x - dir * 3.0, y - 4.5, x + dir * 2.2, y - 0.1);
            plane.nodes[2].node.fill = mix(plane.color, [154,174,189,255], 0.3);
            plane.nodes[2].node.coordinates2d = triangle(x - dir * 0.5, y, x - dir * 3.0, y + 4.5, x + dir * 2.2, y + 0.1);
            plane.nodes[3].node.fill = [60,117,166,255];
            plane.nodes[3].node.coordinates2d = ShapeUtils.rectangle(x - dir * 3.2, y - 0.45, 3.8, 0.35);
            plane.nodes[4].node.fill = plane.color;
            plane.nodes[4].node.coordinates2d = triangle(x - dir * 5.2, y, x - dir * 6.3, y - 2.1, x - dir * 3.9, y);
        }
    }

    renderBoats() {
        const lakeVisible = this.visibleWorldX(LAKE_LEFT, LAKE_RIGHT - LAKE_LEFT, 1, 8);
        for (const boat of this.boats) {
            if (!boat.active || !lakeVisible || !this.visibleWorldX(boat.x, 10, 1, 8)) {
                boat.nodes.forEach(hide);
                continue;
            }
            const x = this.worldToScreenX(boat.x);
            const y = boat.y;
            const dir = boat.dir;
            boat.nodes[0].node.fill = boat.color;
            boat.nodes[0].node.coordinates2d = [
                [x - 3.8, y], [x + 3.8, y], [x + 2.3, y + 1.5], [x - 2.7, y + 1.5], [x - 3.8, y]
            ];
            boat.nodes[1].node.fill = [229,230,221,255];
            boat.nodes[1].node.coordinates2d = ShapeUtils.rectangle(x - 0.15, y - 4.5, 0.3, 4.6);
            boat.nodes[2].node.fill = [244,228,175,255];
            boat.nodes[2].node.coordinates2d = triangle(x + dir * 0.1, y - 4.2, x + dir * 3.2, y - 1.8, x + dir * 0.1, y - 1.7);
            boat.nodes[3].node.fill = [255,255,255,110];
            boat.nodes[3].node.coordinates2d = thickLine(x - dir * 4.5, y + 1.7, x - dir * 8.0, y + 1.9 + Math.sin(boat.phase) * 0.25, 0.25);
        }
    }

    renderEffects() {
        for (const effect of this.effects) {
            if (!effect.active || !this.visibleWorldX(effect.x, 6, 1, 8)) {
                hide(effect.node);
                continue;
            }
            const x = this.worldToScreenX(effect.x);
            const k = clamp(effect.ttl / effect.max, 0, 1);
            const size = effect.size * (1.0 + (1 - k) * 2.5);
            effect.node.node.color = [255,255,255,Math.round(210 * k)];
            effect.node.node.fill = [effect.color[0], effect.color[1], effect.color[2], Math.round(120 * k)];
            if (effect.type === 'ripple') {
                effect.node.node.coordinates2d = this.ellipsePolygon(x, effect.y, size * 2.4, size * 0.8, 16);
            } else if (effect.type === 'steam') {
                effect.node.node.coordinates2d = [
                    [x - 0.4 * size, effect.y + size], [x + Math.sin(this.time * 2 + effect.x) * size, effect.y],
                    [x - Math.sin(this.time * 2.3 + effect.x) * size, effect.y - 2.2 * size],
                    [x + 0.4 * size, effect.y + size], [x - 0.4 * size, effect.y + size]
                ];
            } else if (effect.type === 'window') {
                effect.node.node.coordinates2d = ShapeUtils.rectangle(x - 0.4 * size, effect.y - 0.7 * size, 0.8 * size, 1.4 * size);
            } else if (effect.type === 'spark') {
                effect.node.node.coordinates2d = diamond(x, effect.y - (1 - k) * 3.0, 0.45 * size, 0.9 * size);
            } else {
                effect.node.node.coordinates2d = polyCircle(x, effect.y, size * 1.4, 16);
            }
        }
    }

}

module.exports = CityScanner;
