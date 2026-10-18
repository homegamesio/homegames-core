'use strict';

// SPDX-License-Identifier: MIT

const { ViewableGame, GameNode, Shapes, ShapeUtils } = require('squish-150');

const WORLD_SIZE = 2400;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const MAX_PLAYERS = 4;
const NORMAL_VIEW_W = 360;
const MIN_VIEW_W = 230;
const MAX_VIEW_W = 700;

const C = {
    transparent: [0, 0, 0, 0],
    white: [247, 244, 226, 255],
    cream: [238, 224, 184, 255],
    ink: [29, 35, 43, 255],
    panel: [22, 29, 38, 186],
    panelLine: [240, 235, 210, 218],
    skyDay: [112, 190, 225, 255],
    skyDusk: [222, 127, 117, 255],
    skyNight: [25, 35, 76, 255],
    mountainA: [104, 134, 123, 255],
    mountainB: [78, 112, 105, 255],
    grassA: [99, 160, 85, 255],
    grassB: [72, 133, 78, 255],
    grassC: [141, 179, 87, 255],
    field: [178, 173, 83, 255],
    soil: [134, 94, 61, 255],
    water: [51, 138, 183, 255],
    waterLight: [128, 211, 222, 255],
    road: [70, 75, 83, 255],
    roadLine: [238, 209, 112, 255],
    rail: [63, 62, 66, 255],
    sleeper: [105, 78, 57, 255],
    path: [220, 203, 165, 255],
    pathEdge: [141, 114, 79, 255],
    trunk: [102, 72, 51, 255],
    leafA: [45, 116, 70, 255],
    leafB: [76, 145, 76, 255],
    leafC: [121, 171, 84, 255],
    red: [208, 66, 68, 255],
    blue: [58, 103, 170, 255],
    gold: [229, 172, 68, 255],
    teal: [49, 146, 139, 255],
    purple: [119, 84, 156, 255],
    orange: [231, 126, 57, 255],
    pink: [218, 104, 139, 255],
    steam: [235, 237, 231, 195],
    cloud: [242, 242, 230, 220],
    storm: [108, 118, 135, 235],
    skinA: [225, 181, 136, 255],
    skinB: [139, 88, 61, 255],
    windowDay: [155, 207, 219, 255],
    windowNight: [255, 219, 111, 255]
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function mixColor(a, b, t) {
    return [
        Math.round(lerp(a[0], b[0], t)),
        Math.round(lerp(a[1], b[1], t)),
        Math.round(lerp(a[2], b[2], t)),
        Math.round(lerp(a[3] === undefined ? 255 : a[3], b[3] === undefined ? 255 : b[3], t))
    ];
}

function hash01(seed) {
    let x = seed | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1000000) / 1000000;
}

function polygon(points) {
    return points.map((p) => [clamp(p[0], 0, 100), clamp(p[1], 0, 100)]);
}

function safeRect(x, y, width, height) {
    const x1 = clamp(x, 0, 100);
    const y1 = clamp(y, 0, 100);
    const x2 = clamp(x + width, 0, 100);
    const y2 = clamp(y + height, 0, 100);
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
}

function polyCircle(cx, cy, radius, sides) {
    const points = [];
    const count = sides || 10;
    for (let i = 0; i <= count; i += 1) {
        const angle = i / count * Math.PI * 2;
        points.push([clamp(cx + Math.cos(angle) * radius, 0, 100), clamp(cy + Math.sin(angle) * radius, 0, 100)]);
    }
    return points;
}

function thickLine(x1, y1, x2, y2, width) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(angle) * width * 0.5;
    const dy = Math.cos(angle) * width * 0.5;
    return polygon([
        [x1 - dx, y1 + dy],
        [x2 - dx, y2 + dy],
        [x2 + dx, y2 - dy],
        [x1 + dx, y1 - dy],
        [x1 - dx, y1 + dy]
    ]);
}

function diamond(cx, cy, rx, ry) {
    return polygon([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry]]);
}

function star(cx, cy, outer, inner, points) {
    const out = [];
    for (let i = 0; i <= points * 2; i += 1) {
        const r = i % 2 === 0 ? outer : inner;
        const angle = -Math.PI / 2 + i / (points * 2) * Math.PI * 2;
        out.push([clamp(cx + Math.cos(angle) * r, 0, 100), clamp(cy + Math.sin(angle) * r, 0, 100)]);
    }
    return out;
}

function groundY(x) {
    return 1060 + Math.sin(x * 0.0043) * 25 + Math.sin(x * 0.013) * 8;
}

function railY(x) {
    return groundY(x) - 105 + Math.sin(x * 0.008 + 0.4) * 8;
}

function roadY(x) {
    return groundY(x) - 52 + Math.sin(x * 0.006 + 1.2) * 7;
}

function walkY(x) {
    return roadY(x) - 15 + Math.sin(x * 0.012) * 1.2;
}

function wildlifeTrailY(x) {
    if (x <= 1420 || x >= 1660) return groundY(x) - 7;
    if (x <= 1540) {
        const t = (x - 1420) / 120;
        return lerp(groundY(x) - 7, railY(x) - 1, t);
    }
    const t = (x - 1540) / 120;
    return lerp(railY(x) - 1, groundY(x) - 7, t);
}

function viewHeight(viewW) {
    return viewW * 9 / 16;
}

function makeContainer() {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
        fill: C.transparent
    });
}

function makeShape(coords, fill, options) {
    const config = {
        shapeType: Shapes.POLYGON,
        coordinates2d: coords || ShapeUtils.rectangle(0, 0, 0, 0),
        fill: fill || C.transparent
    };
    if (options) {
        if (options.color) config.color = options.color;
        if (Number.isFinite(options.border)) config.border = options.border;
        if (options.onClick) config.onClick = options.onClick;
        if (options.playerIds) config.playerIds = options.playerIds;
    }
    return new GameNode.Shape(config);
}

function setHidden(node) {
    node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
    node.node.fill = C.transparent;
    node.node.color = C.white;
    node.node.border = 0;
}

function hideRig(slot) {
    if (!slot.visible) return;
    for (const node of slot.nodes) setHidden(node);
    slot.visible = false;
}

function worldToScreen(camera, x, y) {
    const h = viewHeight(camera.viewW);
    return {
        x: ((x - (camera.x - camera.viewW / 2)) / camera.viewW) * 100,
        y: ((y - (camera.y - h / 2)) / h) * 100
    };
}

function screenToWorld(camera, x, y) {
    const h = viewHeight(camera.viewW);
    return {
        x: camera.x - camera.viewW / 2 + x / 100 * camera.viewW,
        y: camera.y - h / 2 + y / 100 * h
    };
}

function isVisible(camera, object, margin) {
    const h = viewHeight(camera.viewW);
    const m = margin || 0;
    return object.x >= camera.x - camera.viewW / 2 - m &&
        object.x <= camera.x + camera.viewW / 2 + m &&
        object.y >= camera.y - h / 2 - m &&
        object.y <= camera.y + h / 2 + m;
}

class LittleConsequences extends ViewableGame {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Little Consequences',
            author: "Joseph Garcia",
            description: 'Explore a shared living world where rain, rivers, farms, deliveries, shops, traffic, trains, wildlife, and crowds create visible consequences across independent player cameras.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30,
            maxPlayers: 4,
            gameId: "877fc3d5-2063-5113-aafe-50afaf9286b8"
        };
    }

    constructor() {
        super(WORLD_SIZE);
        this.time = 0;
        this.day = 0.3;
        this.nextId = 1;
        this.players = {};
        this.systems = {
            rainMountain: 0,
            rainFarm: 0,
            river: 0.2,
            soil: 0.44,
            crop: 0.72,
            bakeryFlour: 0.95,
            bakeryCrowd: 0.3,
            cafeCrowd: 0.15,
            stationCrowd: 0.2,
            lakeTourism: 0.1,
            traffic: 0.16,
            forestDisturbance: 0,
            wildlifeFlow: 0,
            festival: 0,
            bridgeAlarm: 0,
            trainDelay: 0
        };
        this.terrain = [];
        this.track = [];
        this.roads = [];
        this.paths = [];
        this.water = [];
        this.bridges = [];
        this.trees = [];
        this.buildings = [];
        this.crops = [];
        this.trains = [];
        this.vehicles = [];
        this.people = [];
        this.animals = [];
        this.birds = [];
        this.clouds = [];
        this.boats = [];
        this.fish = [];
        this.effects = [];
        this.delivery = null;
        this.createWorld();
    }

    getLayers() {
        return [{ root: this.getViewRoot() }];
    }

    createWorld() {
        this.createLandscape();
        this.createPlaces();
        this.createNature();
        this.createTransport();
        this.createPopulation();
        this.createSkyAndWaterLife();
    }

    createLandscape() {
        let id = 1;
        for (let x = 0; x < WORLD_SIZE; x += 100) {
            const midpoint = x + 50;
            let color = C.grassA;
            if (midpoint < 500) color = C.mountainA;
            else if (midpoint < 850) color = C.grassB;
            else if (midpoint < 1170) color = C.field;
            else if (midpoint < 1510) color = C.grassC;
            else if (midpoint > 1900) color = [87, 128, 102, 255];
            this.terrain.push({ id: `terrain-${id++}`, x: midpoint, y: groundY(midpoint), x1: x, x2: Math.min(WORLD_SIZE, x + 102), color });
        }
        id = 1;
        for (let x = 0; x < WORLD_SIZE; x += 54) {
            const x2 = Math.min(WORLD_SIZE, x + 56);
            const mid = (x + x2) / 2;
            this.track.push({ id: `track-${id}`, x: mid, y: railY(mid), x1: x, y1: railY(x), x2, y2: railY(x2) });
            this.roads.push({ id: `road-${id}`, x: mid, y: roadY(mid), x1: x, y1: roadY(x), x2, y2: roadY(x2) });
            this.paths.push({ id: `path-${id}`, x: mid, y: walkY(mid), x1: x, y1: walkY(x), x2, y2: walkY(x2) });
            id += 1;
        }
        this.water.push({ id: 'mountain-stream', x: 520, y: 1030, w: 440, h: 22, kind: 'stream' });
        this.water.push({ id: 'lake', x: 1330, y: 1040, w: 360, h: 155, kind: 'lake' });
        this.water.push({ id: 'river-crossing', x: 1540, y: 1010, w: 92, h: 135, kind: 'river' });
        this.bridges.push({ id: 'bridge-road', x: 1540, y: roadY(1540), kind: 'road', w: 112 });
        this.bridges.push({ id: 'bridge-rail', x: 1540, y: railY(1540), kind: 'rail', w: 112 });
        for (let x = 1420; x < 1660; x += 40) {
            const x2 = x + 42;
            this.paths.push({ id: `wildlife-path-${x}`, x: (x + x2) / 2, y: wildlifeTrailY((x + x2) / 2), x1: x, y1: wildlifeTrailY(x), x2, y2: wildlifeTrailY(x2), kind: 'wildlife' });
        }
    }

    createPlaces() {
        const addBuilding = (id, x, y, w, h, color, kind) => this.buildings.push({ id, x, y, w, h, color, kind });
        addBuilding('ranger', 370, groundY(370) - 48, 44, 42, C.teal, 'ranger');
        addBuilding('sawmill', 690, groundY(690) - 50, 58, 45, C.sleeper, 'sawmill');
        addBuilding('barn', 910, groundY(910) - 53, 72, 48, C.red, 'barn');
        addBuilding('farmhouse', 1030, groundY(1030) - 45, 48, 40, C.gold, 'house');
        addBuilding('boathouse', 1260, groundY(1260) - 39, 50, 36, C.blue, 'boathouse');
        addBuilding('station-town', 1650, railY(1650) - 35, 68, 38, C.red, 'station');
        addBuilding('bakery', 1715, groundY(1715) - 48, 54, 44, C.gold, 'bakery');
        addBuilding('cafe', 1790, groundY(1790) - 46, 50, 42, C.teal, 'cafe');
        addBuilding('bus-depot', 1870, groundY(1870) - 42, 58, 36, C.blue, 'depot');
        addBuilding('station-city', 2070, railY(2070) - 42, 78, 46, C.purple, 'station');
        for (let i = 0; i < 10; i += 1) {
            const x = 1930 + i * 42;
            addBuilding(`tower-${i}`, x, groundY(x) - 58 - (i % 4) * 18, 32 + (i % 3) * 8, 70 + (i % 4) * 25, [C.blue, C.purple, C.teal, C.red][i % 4], 'tower');
        }
        for (let i = 0; i < 18; i += 1) {
            const x = 790 + (i % 6) * 48;
            const row = Math.floor(i / 6);
            this.crops.push({ id: `crop-${i}`, x, y: groundY(x) - 9 - row * 13, row, phase: i * 0.47 });
        }
    }

    createNature() {
        for (let i = 0; i < 132; i += 1) {
            const seed = 10000 + i * 71;
            let x = 25 + hash01(seed) * (WORLD_SIZE - 50);
            if (x > 830 && x < 1150) x += x < 990 ? -120 : 120;
            if (x > 1220 && x < 1460) x += x < 1340 ? -110 : 110;
            const zone = x < 500 ? 'mountain' : x < 820 ? 'forest' : x < 1200 ? 'farm' : x < 1550 ? 'lake' : x < 1900 ? 'town' : 'city';
            this.trees.push({
                id: `tree-${i}`,
                x,
                y: groundY(x) - 12 - hash01(seed + 1) * 20,
                size: 13 + hash01(seed + 2) * 20,
                tone: Math.floor(hash01(seed + 3) * 3),
                zone
            });
        }
        for (let i = 0; i < 28; i += 1) {
            const forest = i < 16;
            const x = forest ? 500 + hash01(20000 + i * 43) * 320 : 1160 + hash01(20000 + i * 43) * 300;
            this.animals.push({
                id: `animal-${i}`,
                x,
                y: groundY(x) - 7,
                homeX: x,
                targetX: x,
                speed: 3.5 + hash01(20001 + i * 43) * 4,
                dir: i % 2 ? -1 : 1,
                type: forest ? (i % 3 === 0 ? 'deer' : 'fox') : (i % 2 ? 'duck' : 'deer'),
                phase: i * 0.61,
                migrating: false
            });
        }
    }

    createTransport() {
        const trainColors = [C.red, C.blue, C.gold];
        for (let i = 0; i < 3; i += 1) {
            const x = 160 + i * 760;
            this.trains.push({
                id: `train-${i}`,
                x,
                y: railY(x),
                dir: i % 2 ? -1 : 1,
                speed: 24 + i * 2,
                color: trainColors[i],
                stopTimer: 0,
                stationCooldown: 3 + i,
                boostTimer: 0,
                steamTimer: 0.2 + i * 0.15,
                delayReason: 0
            });
        }
        for (let i = 0; i < 14; i += 1) {
            const x = hash01(30000 + i * 47) * WORLD_SIZE;
            this.vehicles.push({
                id: `car-${i}`,
                type: i % 6 === 0 ? 'taxi' : 'car',
                x,
                y: roadY(x),
                dir: i % 2 ? -1 : 1,
                speed: 18 + hash01(30001 + i * 47) * 16,
                color: [C.red, C.blue, C.gold, C.teal, C.purple][i % 5],
                dwell: 0,
                phase: i * 0.4
            });
        }
        this.vehicles.push({ id: 'bus-town', type: 'bus', x: 1830, y: roadY(1830), dir: -1, speed: 17, color: C.blue, dwell: 0, phase: 1.3 });
        this.vehicles.push({ id: 'bus-city', type: 'bus', x: 2120, y: roadY(2120), dir: 1, speed: 19, color: C.red, dwell: 0, phase: 2.1 });
        this.delivery = { id: 'delivery', type: 'truck', x: 920, y: roadY(920), dir: 1, speed: 23, color: C.cream, state: 'waiting', cargo: 0, timer: 2.4, phase: 0 };
        this.vehicles.push(this.delivery);
    }

    createPopulation() {
        const centers = [360, 690, 960, 1280, 1660, 1760, 1840, 2050, 2200];
        let id = 0;
        for (const center of centers) {
            for (let i = 0; i < 6; i += 1) {
                const seed = 40000 + id * 37;
                const x = center - 55 + hash01(seed) * 110;
                this.people.push({
                    id: `person-${id++}`,
                    x,
                    y: walkY(x) - 3,
                    homeX: center,
                    targetX: center,
                    range: 50 + hash01(seed + 1) * 50,
                    speed: 5 + hash01(seed + 2) * 5,
                    dir: i % 2 ? -1 : 1,
                    phase: hash01(seed + 3) * Math.PI * 2,
                    coat: [C.red, C.blue, C.gold, C.teal, C.purple, C.orange][i % 6],
                    skin: i % 3 === 0 ? C.skinB : C.skinA,
                    role: i === 0 ? 'coffee' : i === 1 ? 'bag' : i === 2 ? 'cyclist' : 'walker',
                    purpose: center < 1200 ? 'local' : center < 1500 ? 'tourist' : center < 1900 ? 'shopper' : 'commuter',
                    queue: null
                });
            }
        }
    }

    createSkyAndWaterLife() {
        for (let i = 0; i < 26; i += 1) {
            const x = hash01(50000 + i * 19) * WORLD_SIZE;
            this.birds.push({ id: `bird-${i}`, x, y: 860 + hash01(50001 + i * 19) * 78, speed: 12 + hash01(50002 + i * 19) * 18, dir: i % 4 === 0 ? -1 : 1, phase: i * 0.7, color: i % 5 === 0 ? C.white : C.ink });
        }
        for (let i = 0; i < 10; i += 1) {
            this.clouds.push({ id: `cloud-${i}`, x: 70 + i * 245, y: 855 + (i % 4) * 18, speed: 2.1 + (i % 3), size: 42 + (i % 4) * 14, storm: false, life: 9999 });
        }
        for (let i = 0; i < 5; i += 1) {
            this.boats.push({ id: `boat-${i}`, x: 1220 + i * 55, y: 1020 + i * 18, homeX: 1320, range: 150, speed: 4 + i * 0.8, dir: i % 2 ? -1 : 1, color: [C.red, C.blue, C.gold, C.teal, C.purple][i] });
        }
        for (let i = 0; i < 18; i += 1) {
            this.fish.push({ id: `fish-${i}`, x: 1190 + hash01(60000 + i * 31) * 280, y: 1040 + hash01(60001 + i * 31) * 80, speed: 2 + hash01(60002 + i * 31) * 3, dir: i % 2 ? -1 : 1, phase: i * 0.4, color: [C.gold, C.red, C.teal, C.purple][i % 4] });
        }
    }

    createPlayerView(playerId) {
        const root = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), C.skyDay, { playerIds: [playerId] });
        const anchor = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), C.transparent, { playerIds: [playerId] });
        const background = makeContainer();
        const terrainLayer = makeContainer();
        const worldLayer = makeContainer();
        const actorLayer = makeContainer();
        const effectLayer = makeContainer();
        const tapCatcher = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), C.transparent, { onClick: (pid, x, y) => this.handleWorldTap(pid, x, y) });
        const uiLayer = makeContainer();
        root.addChildren(anchor, background, terrainLayer, worldLayer, actorLayer, effectLayer, tapCatcher, uiLayer);

        const pv = {
            playerId,
            root,
            anchor,
            background,
            terrainLayer,
            worldLayer,
            actorLayer,
            effectLayer,
            tapCatcher,
            uiLayer,
            camera: { x: 1630, y: 980, viewW: NORMAL_VIEW_W, targetX: 1630, targetY: 980, targetViewW: NORMAL_VIEW_W },
            keys: {},
            pools: {},
            backdrop: this.createBackdrop(background),
            controls: [],
            nightAmount: 0
        };

        pv.pools.terrain = this.createPool(terrainLayer, 12, 1);
        pv.pools.water = this.createPool(terrainLayer, 5, 3);
        pv.pools.track = this.createPool(worldLayer, 18, 3);
        pv.pools.road = this.createPool(worldLayer, 18, 2);
        pv.pools.path = this.createPool(worldLayer, 24, 2);
        pv.pools.bridge = this.createPool(worldLayer, 2, 8);
        pv.pools.tree = this.createPool(worldLayer, 60, 4);
        pv.pools.building = this.createPool(worldLayer, 16, 9);
        pv.pools.crop = this.createPool(worldLayer, 18, 4);
        pv.pools.train = this.createPool(actorLayer, 3, 12);
        pv.pools.vehicle = this.createPool(actorLayer, 9, 5);
        pv.pools.person = this.createPool(actorLayer, 12, 10);
        pv.pools.animal = this.createPool(actorLayer, 8, 5);
        pv.pools.bird = this.createPool(actorLayer, 10, 2);
        pv.pools.cloud = this.createPool(actorLayer, 6, 4);
        pv.pools.boat = this.createPool(actorLayer, 4, 5);
        pv.pools.fish = this.createPool(actorLayer, 6, 2);
        pv.pools.effect = this.createPool(effectLayer, 14, 3);

        this.createControls(pv);
        this.players[playerId] = pv;
        this.getViewRoot().addChild(root);
        this.updatePlayerView(pv);
        return pv;
    }

    createBackdrop(layer) {
        const sky = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), C.skyDay);
        const stars = [];
        for (let i = 0; i < 14; i += 1) {
            const x = 4 + hash01(70000 + i * 23) * 92;
            const y = 4 + hash01(70001 + i * 23) * 36;
            const node = makeShape(star(x, y, 0.3 + (i % 3) * 0.1, 0.12, 4), C.transparent);
            stars.push(node);
        }
        const farA = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), C.mountainA);
        const farB = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), C.mountainB);
        const sun = makeShape(polyCircle(79, 17, 4.3, 16), [255, 226, 124, 255]);
        const moonCut = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), C.skyDay);
        layer.addChildren(sky, ...stars, farA, farB, sun, moonCut);
        return { sky, stars, farA, farB, sun, moonCut };
    }

    createPool(layer, count, nodeCount) {
        const pool = { slots: [], byObject: {} };
        for (let i = 0; i < count; i += 1) {
            const nodes = [];
            for (let j = 0; j < nodeCount; j += 1) {
                const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), C.transparent);
                nodes.push(node);
                layer.addChild(node);
            }
            pool.slots.push({ nodes, objectId: null, visible: false });
        }
        return pool;
    }

    createControls(pv) {
        const addButton = (shape, icons, action) => {
            const button = makeShape(shape, C.panel, { color: C.panelLine, border: 2, onClick: action });
            pv.uiLayer.addChild(button);
            for (const icon of icons) {
                icon.node.onClick = action;
                pv.uiLayer.addChild(icon);
            }
            pv.controls.push(button, ...icons);
        };
        addButton(polygon([[0.6, 40], [5.8, 40], [5.8, 60], [0.6, 60], [0.6, 40]]), [makeShape(polygon([[4.6, 44], [1.8, 50], [4.6, 56], [4.6, 44]]), C.white)], (pid) => this.nudgeCamera(pid, -1, 0));
        addButton(polygon([[94.2, 40], [99.4, 40], [99.4, 60], [94.2, 60], [94.2, 40]]), [makeShape(polygon([[95.4, 44], [98.2, 50], [95.4, 56], [95.4, 44]]), C.white)], (pid) => this.nudgeCamera(pid, 1, 0));
        addButton(polygon([[45, 0.5], [55, 0.5], [55, 5.2], [45, 5.2], [45, 0.5]]), [makeShape(polygon([[46.4, 4.2], [50, 1.6], [53.6, 4.2], [46.4, 4.2]]), C.white)], (pid) => this.nudgeCamera(pid, 0, -1));
        addButton(polygon([[45, 94.8], [55, 94.8], [55, 99.5], [45, 99.5], [45, 94.8]]), [makeShape(polygon([[46.4, 95.8], [50, 98.4], [53.6, 95.8], [46.4, 95.8]]), C.white)], (pid) => this.nudgeCamera(pid, 0, 1));
        const zoomOut = (pid) => this.zoomCamera(pid, 1);
        const home = (pid) => this.homeCamera(pid);
        const zoomIn = (pid) => this.zoomCamera(pid, -1);
        addButton(polyCircle(38, 96.8, 2.7, 14), [makeShape(ShapeUtils.rectangle(36.6, 96.45, 2.8, 0.7), C.white)], zoomOut);
        addButton(polyCircle(50, 96.8, 2.7, 14), [makeShape(diamond(50, 96.8, 1.5, 1.6), C.gold)], home);
        addButton(polyCircle(62, 96.8, 2.7, 14), [makeShape(ShapeUtils.rectangle(60.6, 96.45, 2.8, 0.7), C.white), makeShape(ShapeUtils.rectangle(61.65, 95.4, 0.7, 2.8), C.white)], zoomIn);
    }

    handleNewPlayer({ playerId }) {
        const id = Number(playerId);
        if (this.players[id]) return;
        this.createPlayerView(id);
        this.getViewRoot().node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        const id = Number(playerId);
        const pv = this.players[id];
        if (!pv) return;
        this.getViewRoot().removeChild(pv.root.node.id);
        delete this.players[id];
        this.getViewRoot().node.onStateChange();
    }

    handleKeyDown(playerId, key) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        const normalized = key.length === 1 ? key.toLowerCase() : key;
        pv.keys[normalized] = true;
        if (normalized === 'q' || normalized === '-') this.zoomCamera(playerId, 1);
        if (normalized === 'e' || normalized === '+' || normalized === '=') this.zoomCamera(playerId, -1);
        if (normalized === 'h' || normalized === '0' || normalized === 'Home') this.homeCamera(playerId);
        if (normalized === 'r') this.spawnStorm(pv.camera.x - 80, 875);
        if (normalized === 'f') this.triggerFestival(1760);
        if (normalized === 't') this.boostNearestTrain(pv.camera.x, pv.camera.y);
    }

    handleKeyUp(playerId, key) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        const normalized = key.length === 1 ? key.toLowerCase() : key;
        pv.keys[normalized] = false;
    }

    nudgeCamera(playerId, dx, dy) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        const h = viewHeight(pv.camera.targetViewW);
        pv.camera.targetX = clamp(pv.camera.targetX + dx * pv.camera.targetViewW * 0.32, pv.camera.targetViewW / 2, WORLD_SIZE - pv.camera.targetViewW / 2);
        pv.camera.targetY = clamp(pv.camera.targetY + dy * h * 0.28, 570 + h / 2, 1190 - h / 2);
    }

    zoomCamera(playerId, direction) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        pv.camera.targetViewW = clamp(pv.camera.targetViewW * (direction > 0 ? 1.22 : 0.82), MIN_VIEW_W, MAX_VIEW_W);
        const h = viewHeight(pv.camera.targetViewW);
        pv.camera.targetX = clamp(pv.camera.targetX, pv.camera.targetViewW / 2, WORLD_SIZE - pv.camera.targetViewW / 2);
        pv.camera.targetY = clamp(pv.camera.targetY, 570 + h / 2, 1190 - h / 2);
    }

    homeCamera(playerId) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        pv.camera.targetX = 1630;
        pv.camera.targetY = 980;
        pv.camera.targetViewW = NORMAL_VIEW_W;
    }

    handleWorldTap(playerId, sx, sy) {
        const pv = this.players[Number(playerId)];
        if (!pv || sx < 6 || sx > 94 || sy < 6 || sy > 94) return;
        const point = screenToWorld(pv.camera, sx, sy);
        const nearRail = Math.abs(point.y - railY(point.x)) < 30;
        const nearRoad = Math.abs(point.y - roadY(point.x)) < 28;
        const inLake = point.x > 1140 && point.x < 1510 && point.y > 960;
        if (point.y < 925) {
            this.spawnStorm(point.x, point.y);
        } else if (inLake) {
            this.lakeEvent(point.x, point.y);
        } else if (point.x < 510) {
            this.spawnStorm(point.x, 875);
            this.addEffect('sparkle', point.x, groundY(point.x) - 18, C.waterLight, 2.4);
        } else if (point.x < 830) {
            this.disturbForest(point.x);
        } else if (point.x < 1170) {
            this.harvestEvent(point.x);
        } else if (nearRail) {
            this.boostNearestTrain(point.x, point.y);
        } else if (nearRoad) {
            this.trafficEvent(point.x);
        } else if (point.x > 1560 && point.x < 1900) {
            this.triggerFestival(point.x);
        } else if (point.x >= 1900) {
            this.commuterRush(point.x);
        } else {
            this.addEffect('flowers', point.x, groundY(point.x) - 8, C.gold, 2.6);
            this.spawnBirds(point.x, point.y - 80, 4);
        }
        this.getViewRoot().node.onStateChange();
    }

    spawnStorm(x, y) {
        if (this.clouds.length >= 16) this.clouds.shift();
        const id = this.nextId++;
        this.clouds.push({ id: `storm-${id}`, x: clamp(x, 40, WORLD_SIZE - 40), y: clamp(y, 850, 915), speed: 1.5, size: 64, storm: true, life: 22, rainTimer: 0.08 });
        this.addEffect('lightning', x, y + 55, C.gold, 0.9);
        this.spawnBirds(x + 50, y + 20, 4);
    }

    disturbForest(x) {
        this.systems.forestDisturbance = clamp(this.systems.forestDisturbance + 0.75, 0, 1.5);
        this.systems.wildlifeFlow = clamp(this.systems.wildlifeFlow + 0.8, 0, 1.5);
        for (const animal of this.animals) {
            if (animal.x > 480 && animal.x < 840 && (animal.type === 'deer' || animal.type === 'fox')) {
                animal.migrating = true;
                animal.targetX = 1500 + hash01(this.nextId++) * 180;
                animal.dir = 1;
            }
        }
        this.addEffect('rustle', x, groundY(x) - 25, C.leafC, 2.8);
    }

    harvestEvent(x) {
        this.systems.crop = clamp(this.systems.crop + 0.45, 0, 1.3);
        this.systems.soil = clamp(this.systems.soil + 0.18, 0, 1);
        this.addEffect('harvest', x, groundY(x) - 18, C.gold, 2.8);
        this.spawnVisitors(960, 3, 'farmer');
    }

    lakeEvent(x, y) {
        this.systems.lakeTourism = clamp(this.systems.lakeTourism + 0.55, 0, 1.8);
        this.addEffect('splash', x, y, C.waterLight, 2.2);
        if (this.boats.length < 9) {
            const id = this.nextId++;
            this.boats.push({ id: `boat-extra-${id}`, x: clamp(x, 1180, 1480), y: clamp(y, 1000, 1100), homeX: 1330, range: 155, speed: 4 + hash01(id) * 3, dir: id % 2 ? -1 : 1, color: [C.red, C.blue, C.gold, C.teal][id % 4] });
        }
        if (this.fish.length < 30) {
            const id = this.nextId++;
            this.fish.push({ id: `fish-extra-${id}`, x: clamp(x, 1180, 1480), y: clamp(y + 15, 1030, 1110), speed: 2.5 + hash01(id) * 3, dir: id % 2 ? -1 : 1, phase: id * 0.4, color: [C.gold, C.red, C.teal, C.purple][id % 4] });
        }
        this.spawnVisitors(1280, 4, 'tourist');
    }

    trafficEvent(x) {
        this.systems.traffic = clamp(this.systems.traffic + 0.7, 0, 1.8);
        this.addEffect('traffic', x, roadY(x) - 8, C.orange, 2.5);
        if (this.vehicles.length < 24) {
            const id = this.nextId++;
            this.vehicles.push({ id: `taxi-extra-${id}`, type: 'taxi', x, y: roadY(x), dir: id % 2 ? -1 : 1, speed: 20 + hash01(id) * 10, color: C.gold, dwell: 0, phase: id * 0.2 });
        }
    }

    triggerFestival(x) {
        this.systems.festival = clamp(this.systems.festival + 1, 0, 2);
        this.systems.cafeCrowd = clamp(this.systems.cafeCrowd + 0.7, 0, 2.5);
        this.systems.stationCrowd = clamp(this.systems.stationCrowd + 0.45, 0, 2);
        this.addEffect('festival', x, groundY(x) - 70, C.pink, 3.4);
        this.spawnVisitors(1760, 7, 'festival');
    }

    commuterRush(x) {
        this.systems.stationCrowd = clamp(this.systems.stationCrowd + 0.9, 0, 2.5);
        this.systems.traffic = clamp(this.systems.traffic + 0.35, 0, 2);
        this.addEffect('commute', x, railY(x) - 45, C.blue, 2.6);
        this.spawnVisitors(clamp(x, 1980, 2180), 6, 'commuter');
    }

    boostNearestTrain(x, y) {
        const nearest = this.nearest(this.trains, x, y);
        if (!nearest) return;
        nearest.object.boostTimer = 6;
        nearest.object.stopTimer = 0;
        this.addEffect('whistle', nearest.object.x, nearest.object.y - 20, nearest.object.color, 2.1);
    }

    spawnVisitors(center, count, purpose) {
        for (let i = 0; i < count; i += 1) {
            if (this.people.length >= 78) this.people.shift();
            const id = this.nextId++;
            const x = center - 30 + i * 12;
            this.people.push({
                id: `visitor-${id}`,
                x,
                y: walkY(x) - 3,
                homeX: center,
                targetX: center,
                range: 65,
                speed: 6 + hash01(id) * 4,
                dir: i % 2 ? -1 : 1,
                phase: id * 0.4,
                coat: [C.red, C.blue, C.gold, C.teal, C.purple, C.orange][id % 6],
                skin: id % 3 === 0 ? C.skinB : C.skinA,
                role: purpose === 'commuter' ? 'bag' : purpose === 'tourist' ? 'camera' : 'walker',
                purpose,
                queue: null
            });
        }
    }

    spawnBirds(x, y, count) {
        for (let i = 0; i < count; i += 1) {
            if (this.birds.length >= 44) this.birds.shift();
            const id = this.nextId++;
            this.birds.push({ id: `bird-extra-${id}`, x: clamp(x + i * 9, 0, WORLD_SIZE), y: clamp(y + Math.sin(i) * 10, 850, 940), speed: 18 + i * 2, dir: i % 4 === 0 ? -1 : 1, phase: id * 0.7, color: i % 3 === 0 ? C.white : C.ink });
        }
    }

    addEffect(type, x, y, color, life) {
        if (this.effects.length >= 36) this.effects.shift();
        this.effects.push({ id: `effect-${this.nextId++}`, type, x, y, color, age: 0, life });
    }

    nearest(list, x, y) {
        let best = null;
        for (const object of list) {
            const dx = object.x - x;
            const dy = object.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (!best || distance < best.distance) best = { object, distance };
        }
        return best;
    }

    updateSimulation() {
        this.time += DT;
        this.day = (this.day + DT / 240) % 1;
        this.updateWeatherAndSystems();
        this.updateDelivery();
        this.updateTrains();
        this.updateVehicles();
        this.updatePeople();
        this.updateAnimals();
        this.updateBirdsAndClouds();
        this.updateWaterLife();
        for (const effect of this.effects) effect.age += DT;
        this.effects = this.effects.filter((effect) => effect.age < effect.life);
    }

    updateWeatherAndSystems() {
        let mountainRain = 0;
        let farmRain = 0;
        for (const cloud of this.clouds) {
            if (!cloud.storm) continue;
            const intensity = clamp(cloud.life / 6, 0, 1);
            if (cloud.x < 800) mountainRain += intensity;
            if (cloud.x > 760 && cloud.x < 1220) farmRain += intensity;
        }
        this.systems.rainMountain = lerp(this.systems.rainMountain, clamp(mountainRain, 0, 1.5), 0.08);
        this.systems.rainFarm = lerp(this.systems.rainFarm, clamp(farmRain, 0, 1.5), 0.08);
        this.systems.river = clamp(this.systems.river + this.systems.rainMountain * 0.055 * DT - 0.007 * DT, 0.12, 1.2);
        this.systems.soil = clamp(this.systems.soil + this.systems.rainFarm * 0.07 * DT + this.systems.river * 0.008 * DT - 0.012 * DT, 0.1, 1);
        this.systems.crop = clamp(this.systems.crop + (0.004 + this.systems.soil * 0.022) * DT, 0, 1.3);
        this.systems.bridgeAlarm = clamp((this.systems.river - 0.55) * 2.4, 0, 1);
        this.systems.traffic = Math.max(0.08, this.systems.traffic - 0.018 * DT);
        this.systems.forestDisturbance = Math.max(0, this.systems.forestDisturbance - 0.025 * DT);
        this.systems.wildlifeFlow = Math.max(0, this.systems.wildlifeFlow - 0.018 * DT);
        this.systems.festival = Math.max(0, this.systems.festival - 0.018 * DT);
        this.systems.lakeTourism = Math.max(0.05, this.systems.lakeTourism - 0.012 * DT);
        this.systems.stationCrowd = Math.max(0.08, this.systems.stationCrowd - 0.016 * DT);
        this.systems.bakeryCrowd = clamp(0.16 + this.systems.stationCrowd * 0.38 + this.systems.festival * 0.18, 0, 2.3);
        const demand = (0.018 + this.systems.bakeryCrowd * 0.028) * DT;
        this.systems.bakeryFlour = Math.max(0, this.systems.bakeryFlour - demand);
        const shortage = clamp((0.75 - this.systems.bakeryFlour) * 1.4, 0, 1.2);
        this.systems.cafeCrowd = clamp(this.systems.cafeCrowd + shortage * 0.045 * DT + this.systems.lakeTourism * 0.012 * DT - 0.019 * DT, 0.05, 2.6);
    }

    updateDelivery() {
        const truck = this.delivery;
        if (truck.state === 'waiting') {
            truck.timer -= DT;
            if (this.systems.crop >= 1 && truck.timer <= 0) {
                truck.state = 'loading';
                truck.timer = 2.2;
                this.addEffect('harvest', 920, groundY(920) - 30, C.gold, 2.2);
            }
        } else if (truck.state === 'loading') {
            truck.timer -= DT;
            if (truck.timer <= 0) {
                this.systems.crop -= 1;
                truck.cargo = 1;
                truck.state = 'toBakery';
                truck.dir = 1;
            }
        } else if (truck.state === 'toBakery') {
            let multiplier = 1 - this.systems.traffic * 0.28;
            if (Math.abs(truck.x - 1540) < 85) multiplier *= 1 - this.systems.bridgeAlarm * 0.72;
            truck.x += truck.speed * Math.max(0.16, multiplier) * DT;
            if (truck.x >= 1700) {
                truck.x = 1700;
                truck.state = 'unloading';
                truck.timer = 2.1;
                this.addEffect('steam', 1715, groundY(1715) - 70, C.steam, 2.6);
            }
        } else if (truck.state === 'unloading') {
            truck.timer -= DT;
            if (truck.timer <= 0) {
                this.systems.bakeryFlour = clamp(this.systems.bakeryFlour + 3.6, 0, 5);
                truck.cargo = 0;
                truck.state = 'returning';
                truck.dir = -1;
                this.addEffect('festival', 1715, groundY(1715) - 66, C.gold, 2.8);
                this.spawnVisitors(1715, 4, 'shopper');
            }
        } else if (truck.state === 'returning') {
            let multiplier = 1 - this.systems.traffic * 0.25;
            if (Math.abs(truck.x - 1540) < 85) multiplier *= 1 - this.systems.bridgeAlarm * 0.72;
            truck.x -= truck.speed * Math.max(0.16, multiplier) * DT;
            if (truck.x <= 920) {
                truck.x = 920;
                truck.state = 'waiting';
                truck.timer = 2.8;
            }
        }
        truck.y = roadY(truck.x);
    }

    updateTrains() {
        let delaySignal = 0;
        const buses = this.vehicles.filter((v) => v.type === 'bus');
        for (const train of this.trains) {
            train.stationCooldown = Math.max(0, train.stationCooldown - DT);
            train.boostTimer = Math.max(0, train.boostTimer - DT);
            train.steamTimer -= DT;
            let blocked = false;
            for (const bus of buses) {
                if (bus.dwell > 0 && Math.abs(bus.x - 1810) < 35 && Math.abs(train.x - 1810) < 72) blocked = true;
            }
            for (const animal of this.animals) {
                if (animal.migrating && Math.abs(animal.x - train.x) < 22 && Math.abs(animal.y - railY(animal.x)) < 38) blocked = true;
            }
            if (Math.abs(train.x - 1540) < 70 && this.systems.bridgeAlarm > 0.72) blocked = true;
            if (blocked && train.boostTimer <= 0) {
                train.stopTimer = Math.max(train.stopTimer, 0.7);
                train.delayReason = 1;
                delaySignal = 1;
            }
            if (train.stopTimer > 0) {
                train.stopTimer -= DT;
            } else {
                train.delayReason = 0;
                train.x += train.dir * train.speed * (train.boostTimer > 0 ? 1.75 : 1) * DT;
                if (train.x < -60) train.x = WORLD_SIZE + 60;
                if (train.x > WORLD_SIZE + 60) train.x = -60;
                train.y = railY(clamp(train.x, 0, WORLD_SIZE));
                if (train.stationCooldown <= 0 && train.boostTimer <= 0) {
                    if (Math.abs(train.x - 1650) < 8 || Math.abs(train.x - 2070) < 8) {
                        train.stopTimer = 2.1 + this.systems.stationCrowd * 0.8;
                        train.stationCooldown = 10;
                    }
                }
            }
            if (train.steamTimer <= 0) {
                train.steamTimer = 0.5;
                this.addEffect('steam', train.x - train.dir * 14, train.y - 20, C.steam, 1.4);
            }
        }
        this.systems.trainDelay = lerp(this.systems.trainDelay, delaySignal, 0.12);
    }

    updateVehicles() {
        for (const vehicle of this.vehicles) {
            if (vehicle === this.delivery) continue;
            if (vehicle.dwell > 0) {
                vehicle.dwell -= DT;
            } else {
                let speed = vehicle.speed * (1 - this.systems.traffic * 0.32);
                if (Math.abs(vehicle.x - 1540) < 80) speed *= 1 - this.systems.bridgeAlarm * 0.7;
                vehicle.x += vehicle.dir * Math.max(4, speed) * DT;
                if (vehicle.x < -40) vehicle.x = WORLD_SIZE + 40;
                if (vehicle.x > WORLD_SIZE + 40) vehicle.x = -40;
                if (vehicle.type === 'bus' && Math.abs(vehicle.x - 1810) < 7) {
                    vehicle.dwell = 1.2 + this.systems.cafeCrowd * 1.8;
                    this.spawnVisitors(1790, Math.min(3, Math.ceil(this.systems.cafeCrowd)), 'shopper');
                }
                if (vehicle.type === 'bus' && Math.abs(vehicle.x - 2070) < 7) vehicle.dwell = 0.8 + this.systems.stationCrowd;
            }
            vehicle.y = roadY(clamp(vehicle.x, 0, WORLD_SIZE)) + Math.sin(this.time * 2 + vehicle.phase) * 0.8;
        }
    }

    updatePeople() {
        for (const person of this.people) {
            let center = person.homeX;
            if (person.purpose === 'shopper') center = this.systems.bakeryFlour < 0.7 ? 1790 : 1715;
            if (person.purpose === 'tourist') center = this.systems.lakeTourism > 0.6 ? 1320 : 1790;
            if (person.purpose === 'commuter') center = this.systems.trainDelay > 0.45 ? 1790 : 2070;
            person.targetX = center;
            const min = center - person.range;
            const max = center + person.range;
            person.x += person.dir * person.speed * DT;
            if (person.x < min) person.dir = 1;
            if (person.x > max) person.dir = -1;
            person.y = walkY(clamp(person.x, 0, WORLD_SIZE)) - 3;
        }
    }

    updateAnimals() {
        for (const animal of this.animals) {
            if (animal.migrating) {
                const direction = animal.targetX > animal.x ? 1 : -1;
                animal.dir = direction;
                animal.x += direction * animal.speed * 1.8 * DT;
                if (Math.abs(animal.targetX - animal.x) < 10) {
                    animal.migrating = false;
                    animal.homeX = animal.x;
                }
            } else {
                animal.x += animal.dir * animal.speed * DT;
                if (animal.x < animal.homeX - 28) animal.dir = 1;
                if (animal.x > animal.homeX + 28) animal.dir = -1;
            }
            animal.y = animal.migrating ? wildlifeTrailY(clamp(animal.x, 0, WORLD_SIZE)) : groundY(clamp(animal.x, 0, WORLD_SIZE)) - 7;
        }
    }

    updateBirdsAndClouds() {
        for (const bird of this.birds) {
            bird.x += bird.dir * bird.speed * DT;
            if (bird.x < -40) bird.x = WORLD_SIZE + 40;
            if (bird.x > WORLD_SIZE + 40) bird.x = -40;
            bird.y += Math.sin(this.time * 2.1 + bird.phase) * 0.08;
        }
        for (const cloud of this.clouds) {
            cloud.x += cloud.speed * DT;
            if (cloud.x > WORLD_SIZE + 100) cloud.x = -100;
            if (cloud.storm) {
                cloud.life -= DT;
                cloud.rainTimer -= DT;
                if (cloud.life > 0 && cloud.rainTimer <= 0) {
                    cloud.rainTimer = 0.42;
                    this.addEffect('rain', cloud.x, cloud.y + 45, C.waterLight, 0.8);
                }
            }
        }
        this.clouds = this.clouds.filter((cloud) => !cloud.storm || cloud.life > 0);
    }

    updateWaterLife() {
        for (const boat of this.boats) {
            boat.x += boat.dir * boat.speed * (1 + this.systems.lakeTourism * 0.18) * DT;
            if (boat.x < boat.homeX - boat.range) boat.dir = 1;
            if (boat.x > boat.homeX + boat.range) boat.dir = -1;
        }
        for (const fish of this.fish) {
            fish.x += fish.dir * fish.speed * DT;
            if (fish.x < 1180) fish.dir = 1;
            if (fish.x > 1480) fish.dir = -1;
            fish.y += Math.sin(this.time * 2 + fish.phase) * 0.06;
        }
    }

    updateCamera(pv) {
        const pan = pv.camera.viewW * 0.42 * DT;
        const h = viewHeight(pv.camera.targetViewW);
        let dx = 0;
        let dy = 0;
        if (pv.keys.a || pv.keys.ArrowLeft) dx -= pan;
        if (pv.keys.d || pv.keys.ArrowRight) dx += pan;
        if (pv.keys.w || pv.keys.ArrowUp) dy -= pan * 0.56;
        if (pv.keys.s || pv.keys.ArrowDown) dy += pan * 0.56;
        pv.camera.targetX = clamp(pv.camera.targetX + dx, pv.camera.targetViewW / 2, WORLD_SIZE - pv.camera.targetViewW / 2);
        pv.camera.targetY = clamp(pv.camera.targetY + dy, 570 + h / 2, 1190 - h / 2);
        const follow = 1 - Math.exp(-9 * DT);
        pv.camera.x = lerp(pv.camera.x, pv.camera.targetX, follow);
        pv.camera.y = lerp(pv.camera.y, pv.camera.targetY, follow);
        pv.camera.viewW = lerp(pv.camera.viewW, pv.camera.targetViewW, follow);
    }

    selectStableSpread(pv, pool, candidates, limit, alreadySelected) {
        if (limit <= 0 || candidates.length === 0) return [];
        const selectedIds = alreadySelected || {};
        const byId = {};
        for (const object of candidates) byId[object.id] = object;

        const chosen = [];
        // Keep existing bindings first. This prevents visible objects from changing
        // identity or draw order during small camera movements.
        for (const slot of pool.slots) {
            const object = slot.objectId ? byId[slot.objectId] : null;
            if (object && !selectedIds[object.id] && chosen.length < limit) {
                chosen.push(object);
                selectedIds[object.id] = true;
            }
        }

        const remaining = candidates.filter((object) => !selectedIds[object.id]).sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            if (a.y !== b.y) return a.y - b.y;
            return String(a.id).localeCompare(String(b.id));
        });
        const needed = limit - chosen.length;
        if (needed <= 0) return chosen;
        if (remaining.length <= needed) {
            for (const object of remaining) {
                chosen.push(object);
                selectedIds[object.id] = true;
            }
            return chosen;
        }

        // When a logical category is denser than its render budget, sample it
        // across the complete viewport instead of taking only objects nearest the
        // camera center. This gives graceful LOD without a center-only bubble.
        const usedIndexes = {};
        for (let i = 0; i < needed; i += 1) {
            const target = needed === 1 ? (remaining.length - 1) / 2 : i * (remaining.length - 1) / (needed - 1);
            let index = Math.round(target);
            let offset = 0;
            while (usedIndexes[index] && offset < remaining.length) {
                offset += 1;
                const right = Math.min(remaining.length - 1, index + offset);
                const left = Math.max(0, index - offset);
                index = !usedIndexes[right] ? right : left;
            }
            usedIndexes[index] = true;
            const object = remaining[index];
            chosen.push(object);
            selectedIds[object.id] = true;
        }
        return chosen;
    }

    bindPool(pv, pool, candidates, render) {
        const capacity = pool.slots.length;
        const selectedIds = {};
        const onscreen = [];
        const preload = [];
        for (const object of candidates) {
            if (isVisible(pv.camera, object, 0)) onscreen.push(object);
            else preload.push(object);
        }

        const selectedObjects = this.selectStableSpread(pv, pool, onscreen, capacity, selectedIds);
        if (selectedObjects.length < capacity) {
            selectedObjects.push(...this.selectStableSpread(
                pv,
                pool,
                preload,
                capacity - selectedObjects.length,
                selectedIds
            ));
        }

        const selected = {};
        for (const object of selectedObjects) selected[object.id] = object;
        for (const slot of pool.slots) {
            if (slot.objectId && !selected[slot.objectId]) {
                delete pool.byObject[slot.objectId];
                slot.objectId = null;
                hideRig(slot);
            }
        }
        for (const object of selectedObjects) {
            let slot = pool.byObject[object.id];
            if (!slot) {
                slot = pool.slots.find((candidate) => candidate.objectId === null);
                if (!slot) continue;
                slot.objectId = object.id;
                pool.byObject[object.id] = slot;
            }
            slot.visible = true;
            render.call(this, pv, slot, object);
        }
    }

    updateBackdrop(pv) {
        const t = this.day;
        let night = 0;
        let sky;
        if (t < 0.2) {
            night = 1 - t / 0.2;
            sky = mixColor(C.skyDay, C.skyNight, night);
        } else if (t < 0.55) {
            sky = C.skyDay;
        } else if (t < 0.76) {
            const dusk = (t - 0.55) / 0.21;
            night = dusk * 0.7;
            sky = mixColor(C.skyDay, C.skyDusk, dusk);
        } else {
            night = clamp((t - 0.76) / 0.18, 0, 1);
            sky = mixColor(C.skyDusk, C.skyNight, night);
        }
        pv.nightAmount = night;
        pv.backdrop.sky.node.fill = sky;
        const angle = t * Math.PI * 2 - Math.PI;
        const sx = 50 + Math.cos(angle) * 37;
        const sy = 44 + Math.sin(angle) * 30;
        pv.backdrop.sun.node.coordinates2d = polyCircle(sx, sy, 4.2, 16);
        pv.backdrop.sun.node.fill = night > 0.65 ? [242, 238, 202, 255] : [255, 226, 124, 255];
        pv.backdrop.moonCut.node.coordinates2d = night > 0.65 ? polyCircle(sx + 1.8, sy - 1.1, 3.8, 16) : ShapeUtils.rectangle(0, 0, 0, 0);
        pv.backdrop.moonCut.node.fill = sky;
        for (const starNode of pv.backdrop.stars) starNode.node.fill = [245, 241, 218, Math.round(220 * night)];
        const p = pv.camera.x * 0.01;
        pv.backdrop.farA.node.coordinates2d = polygon([[0, 70], [16, 52 + Math.sin(p) * 4], [31, 67], [48, 44 + Math.cos(p * 0.7) * 5], [65, 65], [83, 50 + Math.sin(p * 0.5) * 4], [100, 68], [100, 100], [0, 100], [0, 70]]);
        pv.backdrop.farA.node.fill = mixColor(C.mountainA, [45, 61, 76, 255], night * 0.82);
        pv.backdrop.farB.node.coordinates2d = polygon([[0, 78], [20, 64 + Math.cos(p * 0.8) * 3], [38, 75], [58, 59 + Math.sin(p * 0.6) * 4], [77, 73], [92, 62], [100, 76], [100, 100], [0, 100], [0, 78]]);
        pv.backdrop.farB.node.fill = mixColor(C.mountainB, [37, 52, 67, 255], night * 0.86);
    }

    updatePlayerView(pv) {
        this.updateBackdrop(pv);
        const c = pv.camera;
        this.bindPool(pv, pv.pools.terrain, this.terrain.filter((o) => isVisible(c, o, 120)), this.renderTerrain);
        this.bindPool(pv, pv.pools.water, this.water.filter((o) => Math.abs(o.x - c.x) < c.viewW * 0.78), this.renderWater);
        this.bindPool(pv, pv.pools.track, this.track.filter((o) => isVisible(c, o, 80)), this.renderTrack);
        this.bindPool(pv, pv.pools.road, this.roads.filter((o) => isVisible(c, o, 80)), this.renderRoad);
        this.bindPool(pv, pv.pools.path, this.paths.filter((o) => isVisible(c, o, 80)), this.renderPath);
        this.bindPool(pv, pv.pools.bridge, this.bridges.filter((o) => isVisible(c, o, 100)), this.renderBridge);
        this.bindPool(pv, pv.pools.tree, this.trees.filter((o) => isVisible(c, o, 70)), this.renderTree);
        this.bindPool(pv, pv.pools.building, this.buildings.filter((o) => isVisible(c, o, 90)), this.renderBuilding);
        this.bindPool(pv, pv.pools.crop, this.crops.filter((o) => isVisible(c, o, 55)), this.renderCrop);
        this.bindPool(pv, pv.pools.train, this.trains.filter((o) => isVisible(c, o, 110)), this.renderTrain);
        this.bindPool(pv, pv.pools.vehicle, this.vehicles.filter((o) => isVisible(c, o, 65)), this.renderVehicle);
        this.bindPool(pv, pv.pools.person, this.people.filter((o) => isVisible(c, o, 45)), this.renderPerson);
        this.bindPool(pv, pv.pools.animal, this.animals.filter((o) => isVisible(c, o, 50)), this.renderAnimal);
        this.bindPool(pv, pv.pools.bird, this.birds.filter((o) => isVisible(c, o, 70)), this.renderBird);
        this.bindPool(pv, pv.pools.cloud, this.clouds.filter((o) => isVisible(c, o, 120)), this.renderCloud);
        this.bindPool(pv, pv.pools.boat, this.boats.filter((o) => isVisible(c, o, 60)), this.renderBoat);
        this.bindPool(pv, pv.pools.fish, this.fish.filter((o) => isVisible(c, o, 40)), this.renderFish);
        this.bindPool(pv, pv.pools.effect, this.effects.filter((o) => isVisible(c, o, 100)), this.renderEffect);
    }

    renderTerrain(pv, slot, object) {
        const a = worldToScreen(pv.camera, object.x1, groundY(object.x1));
        const b = worldToScreen(pv.camera, object.x2, groundY(object.x2));
        slot.nodes[0].node.coordinates2d = polygon([[a.x, a.y], [b.x, b.y], [b.x, 100], [a.x, 100], [a.x, a.y]]);
        slot.nodes[0].node.fill = mixColor(object.color, [35, 57, 56, 255], pv.nightAmount * 0.72);
    }

    renderWater(pv, slot, object) {
        const center = worldToScreen(pv.camera, object.x, object.y);
        const w = object.w / pv.camera.viewW * 100;
        let h = object.h / viewHeight(pv.camera.viewW) * 100;
        if (object.kind === 'river') h *= 0.55 + this.systems.river * 0.75;
        if (object.kind === 'stream') h *= 0.7 + this.systems.river * 0.55;
        slot.nodes[0].node.coordinates2d = safeRect(center.x - w / 2, center.y - h / 2, w, h);
        slot.nodes[0].node.fill = mixColor(C.water, [24, 60, 88, 255], pv.nightAmount * 0.8);
        slot.nodes[1].node.coordinates2d = thickLine(center.x - w * 0.4, center.y - h * 0.18, center.x + w * 0.35, center.y - h * 0.18, 0.55);
        slot.nodes[1].node.fill = [C.waterLight[0], C.waterLight[1], C.waterLight[2], 165];
        slot.nodes[2].node.coordinates2d = object.kind === 'river' ? thickLine(center.x - w * 0.3, center.y + h * 0.16, center.x + w * 0.38, center.y + h * 0.16, 0.42) : ShapeUtils.rectangle(0, 0, 0, 0);
        slot.nodes[2].node.fill = C.waterLight;
    }

    renderTrack(pv, slot, object) {
        const a = worldToScreen(pv.camera, object.x1, object.y1);
        const b = worldToScreen(pv.camera, object.x2, object.y2);
        const scale = 100 / viewHeight(pv.camera.viewW);
        slot.nodes[0].node.coordinates2d = thickLine(a.x, a.y, b.x, b.y, Math.max(1.25, 6 * scale));
        slot.nodes[0].node.fill = C.sleeper;
        slot.nodes[1].node.coordinates2d = thickLine(a.x, a.y - 0.65, b.x, b.y - 0.65, Math.max(0.35, 1.45 * scale));
        slot.nodes[2].node.coordinates2d = thickLine(a.x, a.y + 0.65, b.x, b.y + 0.65, Math.max(0.35, 1.45 * scale));
        slot.nodes[1].node.fill = C.rail;
        slot.nodes[2].node.fill = C.rail;
    }

    renderRoad(pv, slot, object) {
        const a = worldToScreen(pv.camera, object.x1, object.y1);
        const b = worldToScreen(pv.camera, object.x2, object.y2);
        const scale = 100 / viewHeight(pv.camera.viewW);
        slot.nodes[0].node.coordinates2d = thickLine(a.x, a.y, b.x, b.y, Math.max(1.9, 8.8 * scale));
        slot.nodes[0].node.fill = mixColor(C.road, [38, 43, 53, 255], pv.nightAmount * 0.65);
        slot.nodes[1].node.coordinates2d = thickLine(a.x, a.y, b.x, b.y, Math.max(0.27, 0.75 * scale));
        slot.nodes[1].node.fill = C.roadLine;
    }

    renderPath(pv, slot, object) {
        const a = worldToScreen(pv.camera, object.x1, object.y1);
        const b = worldToScreen(pv.camera, object.x2, object.y2);
        const scale = 100 / viewHeight(pv.camera.viewW);
        const outerWidth = object.kind === 'wildlife' ? Math.max(0.65, 3.1 * scale) : Math.max(1.05, 5.6 * scale);
        const innerWidth = object.kind === 'wildlife' ? Math.max(0.4, 1.9 * scale) : Math.max(0.68, 4 * scale);
        slot.nodes[0].node.coordinates2d = thickLine(a.x, a.y, b.x, b.y, outerWidth);
        slot.nodes[0].node.fill = mixColor(C.pathEdge, [49, 53, 60, 255], pv.nightAmount * 0.62);
        slot.nodes[1].node.coordinates2d = thickLine(a.x, a.y, b.x, b.y, innerWidth);
        slot.nodes[1].node.fill = object.kind === 'wildlife' ? mixColor(C.soil, C.path, 0.35) : mixColor(C.path, [82, 80, 76, 255], pv.nightAmount * 0.55);
    }

    renderBridge(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const w = object.w / pv.camera.viewW * 100;
        const scale = 100 / viewHeight(pv.camera.viewW);
        const y = p.y;
        slot.nodes[0].node.coordinates2d = thickLine(p.x - w / 2, y, p.x + w / 2, y, Math.max(2.2, 9 * scale));
        slot.nodes[0].node.fill = object.kind === 'road' ? C.road : C.sleeper;
        slot.nodes[1].node.coordinates2d = thickLine(p.x - w / 2, y - 1.4, p.x + w / 2, y - 1.4, Math.max(0.35, 1.2 * scale));
        slot.nodes[2].node.coordinates2d = thickLine(p.x - w / 2, y + 1.4, p.x + w / 2, y + 1.4, Math.max(0.35, 1.2 * scale));
        slot.nodes[1].node.fill = C.white;
        slot.nodes[2].node.fill = C.white;
        for (let i = 0; i < 3; i += 1) {
            const x = p.x - w * 0.35 + i * w * 0.35;
            slot.nodes[3 + i].node.coordinates2d = thickLine(x, y + 1.5, x, y + 8 * scale, Math.max(0.3, 1.2 * scale));
            slot.nodes[3 + i].node.fill = C.sleeper;
        }
        const blink = Math.sin(this.time * 8) > 0 ? 255 : 70;
        slot.nodes[6].node.coordinates2d = polyCircle(p.x - w * 0.42, y - 3.1, 0.8, 8);
        slot.nodes[7].node.coordinates2d = polyCircle(p.x + w * 0.42, y - 3.1, 0.8, 8);
        slot.nodes[6].node.fill = [255, 84, 64, Math.round(blink * this.systems.bridgeAlarm)];
        slot.nodes[7].node.fill = [255, 84, 64, Math.round(blink * this.systems.bridgeAlarm)];
    }

    renderTree(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const s = object.size / viewHeight(pv.camera.viewW) * 100;
        const leaves = [C.leafA, C.leafB, C.leafC][object.tone % 3];
        slot.nodes[0].node.coordinates2d = safeRect(p.x - s * 0.1, p.y - s * 0.05, s * 0.2, s * 0.72);
        slot.nodes[0].node.fill = C.trunk;
        slot.nodes[1].node.coordinates2d = polyCircle(p.x - s * 0.22, p.y - s * 0.22, s * 0.35, 8);
        slot.nodes[2].node.coordinates2d = polyCircle(p.x + s * 0.22, p.y - s * 0.22, s * 0.36, 8);
        slot.nodes[3].node.coordinates2d = polyCircle(p.x, p.y - s * 0.47, s * 0.42, 9);
        slot.nodes[1].node.fill = mixColor(leaves, [35, 56, 50, 255], pv.nightAmount * 0.72);
        slot.nodes[2].node.fill = mixColor(leaves, [35, 56, 50, 255], pv.nightAmount * 0.68);
        slot.nodes[3].node.fill = mixColor(leaves, [35, 56, 50, 255], pv.nightAmount * 0.62);
    }

    renderBuilding(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const sw = object.w / pv.camera.viewW * 100;
        const sh = object.h / viewHeight(pv.camera.viewW) * 100;
        const x = p.x - sw / 2;
        const y = p.y - sh / 2;
        const body = mixColor(object.color, [38, 45, 57, 255], pv.nightAmount * 0.67);
        slot.nodes[0].node.coordinates2d = safeRect(x, y, sw, sh);
        slot.nodes[0].node.fill = body;
        slot.nodes[1].node.coordinates2d = object.kind === 'tower'
            ? safeRect(x + sw * 0.08, y - sh * 0.08, sw * 0.84, sh * 0.12)
            : polygon([[x - sw * 0.08, y], [p.x, y - sh * 0.22], [x + sw * 1.08, y], [x - sw * 0.08, y]]);
        slot.nodes[1].node.fill = object.kind === 'station' ? C.ink : C.sleeper;
        slot.nodes[2].node.coordinates2d = safeRect(p.x - sw * 0.1, y + sh * 0.62, sw * 0.2, sh * 0.38);
        slot.nodes[2].node.fill = C.ink;
        const windowColor = mixColor(C.windowDay, C.windowNight, clamp(pv.nightAmount * 1.5, 0, 1));
        for (let i = 0; i < 4; i += 1) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            slot.nodes[3 + i].node.coordinates2d = safeRect(x + sw * (0.18 + col * 0.47), y + sh * (0.18 + row * 0.28), sw * 0.16, sh * 0.16);
            slot.nodes[3 + i].node.fill = windowColor;
        }
        slot.nodes[7].node.coordinates2d = safeRect(x + sw * 0.05, y + sh * 0.73, sw * 0.9, sh * 0.08);
        slot.nodes[7].node.fill = object.kind === 'bakery' || object.kind === 'cafe' || object.kind === 'station' ? C.white : body;
        if (object.kind === 'bakery') {
            const steam = this.systems.bakeryFlour > 0.3 ? 1 : 0;
            slot.nodes[8].node.coordinates2d = steam ? polyCircle(p.x + sw * 0.2, y - sh * 0.28 - Math.sin(this.time * 2) * 0.4, Math.max(0.35, sw * 0.1), 8) : ShapeUtils.rectangle(0, 0, 0, 0);
            slot.nodes[8].node.fill = C.steam;
        } else if (object.kind === 'cafe') {
            const crowd = clamp(this.systems.cafeCrowd / 2.4, 0, 1);
            slot.nodes[8].node.coordinates2d = safeRect(x + sw * 0.12, y + sh * 0.86, sw * 0.76 * crowd, sh * 0.05);
            slot.nodes[8].node.fill = C.orange;
        } else {
            setHidden(slot.nodes[8]);
        }
    }

    renderCrop(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const scale = 100 / viewHeight(pv.camera.viewW);
        const growth = clamp(this.systems.crop, 0.08, 1);
        const height = (4 + growth * 15) * scale;
        slot.nodes[0].node.coordinates2d = thickLine(p.x, p.y, p.x, p.y - height, Math.max(0.28, 1.1 * scale));
        slot.nodes[0].node.fill = mixColor(C.field, C.gold, growth * 0.55);
        slot.nodes[1].node.coordinates2d = polygon([[p.x, p.y - height * 0.45], [p.x - 3 * scale, p.y - height * 0.68], [p.x, p.y - height * 0.58], [p.x, p.y - height * 0.45]]);
        slot.nodes[2].node.coordinates2d = polygon([[p.x, p.y - height * 0.63], [p.x + 3 * scale, p.y - height * 0.82], [p.x, p.y - height * 0.76], [p.x, p.y - height * 0.63]]);
        slot.nodes[1].node.fill = C.grassC;
        slot.nodes[2].node.fill = C.grassC;
        slot.nodes[3].node.coordinates2d = polyCircle(p.x, p.y - height, Math.max(0.3, 1.4 * scale * growth), 7);
        slot.nodes[3].node.fill = C.gold;
    }

    renderTrain(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const sx = 100 / pv.camera.viewW;
        const sy = 100 / viewHeight(pv.camera.viewW);
        const d = object.dir;
        const bodyW = 38 * sx;
        const bodyH = 20 * sy;
        slot.nodes[0].node.coordinates2d = safeRect(p.x - bodyW * 0.45, p.y - bodyH, bodyW, bodyH);
        slot.nodes[0].node.fill = object.color;
        slot.nodes[1].node.coordinates2d = safeRect(p.x - bodyW * 0.34, p.y - bodyH * 1.45, bodyW * 0.46, bodyH * 0.48);
        slot.nodes[1].node.fill = object.color;
        slot.nodes[2].node.coordinates2d = safeRect(p.x + d * bodyW * 0.25 - bodyW * 0.09, p.y - bodyH * 1.65, bodyW * 0.18, bodyH * 0.68);
        slot.nodes[2].node.fill = C.ink;
        for (let i = 0; i < 3; i += 1) {
            slot.nodes[3 + i].node.coordinates2d = polyCircle(p.x - bodyW * 0.3 + i * bodyW * 0.3, p.y, Math.max(0.55, 4.2 * sy), 10);
            slot.nodes[3 + i].node.fill = C.ink;
        }
        for (let car = 0; car < 2; car += 1) {
            const cx = p.x - d * bodyW * (0.7 + car * 0.62);
            slot.nodes[6 + car * 3].node.coordinates2d = safeRect(cx - bodyW * 0.28, p.y - bodyH * 0.82, bodyW * 0.55, bodyH * 0.82);
            slot.nodes[6 + car * 3].node.fill = mixColor(object.color, C.white, 0.2);
            slot.nodes[7 + car * 3].node.coordinates2d = safeRect(cx - bodyW * 0.16, p.y - bodyH * 0.62, bodyW * 0.12, bodyH * 0.24);
            slot.nodes[8 + car * 3].node.coordinates2d = safeRect(cx + bodyW * 0.04, p.y - bodyH * 0.62, bodyW * 0.12, bodyH * 0.24);
            slot.nodes[7 + car * 3].node.fill = C.windowNight;
            slot.nodes[8 + car * 3].node.fill = C.windowNight;
        }
    }

    renderVehicle(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const sx = 100 / pv.camera.viewW;
        const sy = 100 / viewHeight(pv.camera.viewW);
        const bus = object.type === 'bus';
        const truck = object.type === 'truck';
        const w = (bus ? 34 : truck ? 30 : 21) * sx;
        const h = (bus ? 17 : 12) * sy;
        slot.nodes[0].node.coordinates2d = safeRect(p.x - w / 2, p.y - h, w, h);
        slot.nodes[0].node.fill = object.color;
        slot.nodes[1].node.coordinates2d = polygon([[p.x - w * 0.32, p.y - h], [p.x - w * 0.18, p.y - h * 1.45], [p.x + w * 0.28, p.y - h * 1.45], [p.x + w * 0.43, p.y - h], [p.x - w * 0.32, p.y - h]]);
        slot.nodes[1].node.fill = mixColor(object.color, C.white, 0.18);
        slot.nodes[2].node.coordinates2d = polyCircle(p.x - w * 0.3, p.y, Math.max(0.45, 3 * sy), 9);
        slot.nodes[3].node.coordinates2d = polyCircle(p.x + w * 0.3, p.y, Math.max(0.45, 3 * sy), 9);
        slot.nodes[2].node.fill = C.ink;
        slot.nodes[3].node.fill = C.ink;
        if (truck && object.cargo > 0) {
            slot.nodes[4].node.coordinates2d = safeRect(p.x - w * 0.15, p.y - h * 1.2, w * 0.45, h * 0.45);
            slot.nodes[4].node.fill = C.gold;
        } else if (bus) {
            slot.nodes[4].node.coordinates2d = safeRect(p.x - w * 0.2, p.y - h * 0.78, w * 0.55, h * 0.28);
            slot.nodes[4].node.fill = C.windowNight;
        } else {
            setHidden(slot.nodes[4]);
        }
    }

    renderPerson(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const s = 100 / viewHeight(pv.camera.viewW);
        const bob = Math.sin(this.time * 7 + object.phase) * 0.8 * s;
        const leg = Math.sin(this.time * 7 + object.phase) * 3.2 * s;
        slot.nodes[0].node.coordinates2d = polygon([[p.x - 3.8 * s, p.y + 3.1 * s], [p.x, p.y + 2.35 * s], [p.x + 3.8 * s, p.y + 3.1 * s], [p.x, p.y + 3.85 * s], [p.x - 3.8 * s, p.y + 3.1 * s]]);
        slot.nodes[0].node.fill = [24, 31, 36, 90];
        slot.nodes[1].node.coordinates2d = polyCircle(p.x, p.y - 14 * s + bob, Math.max(0.45, 3.1 * s), 9);
        slot.nodes[1].node.fill = object.skin;
        slot.nodes[2].node.coordinates2d = polygon([[p.x - 3.7 * s, p.y - 11 * s + bob], [p.x + 3.7 * s, p.y - 11 * s + bob], [p.x + 2.6 * s, p.y - 3.5 * s], [p.x - 2.6 * s, p.y - 3.5 * s], [p.x - 3.7 * s, p.y - 11 * s + bob]]);
        slot.nodes[2].node.fill = object.coat;
        slot.nodes[3].node.coordinates2d = thickLine(p.x - 1.5 * s, p.y - 3.8 * s, p.x - 2.2 * s + leg, p.y + 3 * s, Math.max(0.35, 1.3 * s));
        slot.nodes[4].node.coordinates2d = thickLine(p.x + 1.5 * s, p.y - 3.8 * s, p.x + 2.2 * s - leg, p.y + 3 * s, Math.max(0.35, 1.3 * s));
        slot.nodes[3].node.fill = C.ink;
        slot.nodes[4].node.fill = C.ink;
        slot.nodes[5].node.coordinates2d = thickLine(p.x - 3 * s, p.y - 9 * s, p.x - 5 * s - leg * 0.45, p.y - 3 * s, Math.max(0.3, 1.05 * s));
        slot.nodes[6].node.coordinates2d = thickLine(p.x + 3 * s, p.y - 9 * s, p.x + 5 * s + leg * 0.45, p.y - 3 * s, Math.max(0.3, 1.05 * s));
        slot.nodes[5].node.fill = object.skin;
        slot.nodes[6].node.fill = object.skin;
        slot.nodes[7].node.coordinates2d = object.role === 'bag' ? safeRect(p.x + 3 * s, p.y - 7 * s, 4 * s, 4 * s) : object.role === 'coffee' ? safeRect(p.x + 4 * s, p.y - 6 * s, 2.2 * s, 3.2 * s) : object.role === 'camera' ? safeRect(p.x + 3 * s, p.y - 8 * s, 3 * s, 2.2 * s) : ShapeUtils.rectangle(0, 0, 0, 0);
        slot.nodes[7].node.fill = object.role === 'coffee' ? C.cream : C.sleeper;
        slot.nodes[8].node.coordinates2d = safeRect(p.x - 2.7 * s, p.y - 17.2 * s + bob, 5.4 * s, 1.4 * s);
        slot.nodes[8].node.fill = object.purpose === 'commuter' ? C.ink : mixColor(object.coat, C.ink, 0.3);
        slot.nodes[9].node.coordinates2d = object.role === 'cyclist' ? polyCircle(p.x + 5 * s, p.y - 1 * s, Math.max(0.5, 3.5 * s), 10) : ShapeUtils.rectangle(0, 0, 0, 0);
        slot.nodes[9].node.fill = C.rail;
    }

    renderAnimal(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const s = 100 / viewHeight(pv.camera.viewW);
        const body = object.type === 'fox' ? C.orange : object.type === 'duck' ? C.gold : C.sleeper;
        const w = (object.type === 'duck' ? 7 : 10) * s;
        const h = (object.type === 'duck' ? 4 : 6) * s;
        slot.nodes[0].node.coordinates2d = polyCircle(p.x, p.y - h, Math.max(0.55, w * 0.48), 9);
        slot.nodes[1].node.coordinates2d = polyCircle(p.x + object.dir * w * 0.52, p.y - h * 1.25, Math.max(0.4, h * 0.44), 8);
        slot.nodes[0].node.fill = body;
        slot.nodes[1].node.fill = body;
        slot.nodes[2].node.coordinates2d = thickLine(p.x - w * 0.22, p.y - h * 0.7, p.x - w * 0.28, p.y, Math.max(0.28, 1.1 * s));
        slot.nodes[3].node.coordinates2d = thickLine(p.x + w * 0.22, p.y - h * 0.7, p.x + w * 0.28, p.y, Math.max(0.28, 1.1 * s));
        slot.nodes[2].node.fill = C.ink;
        slot.nodes[3].node.fill = C.ink;
        slot.nodes[4].node.coordinates2d = object.type === 'deer' ? polygon([[p.x + object.dir * w * 0.4, p.y - h * 1.65], [p.x + object.dir * w * 0.62, p.y - h * 2], [p.x + object.dir * w * 0.65, p.y - h * 1.55], [p.x + object.dir * w * 0.4, p.y - h * 1.65]]) : ShapeUtils.rectangle(0, 0, 0, 0);
        slot.nodes[4].node.fill = C.sleeper;
    }

    renderBird(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const wing = 1.1 + Math.sin(this.time * 8 + object.phase) * 0.75;
        slot.nodes[0].node.coordinates2d = thickLine(p.x, p.y, p.x - 2.2, p.y - wing, 0.42);
        slot.nodes[1].node.coordinates2d = thickLine(p.x, p.y, p.x + 2.2, p.y - wing, 0.42);
        slot.nodes[0].node.fill = object.color;
        slot.nodes[1].node.fill = object.color;
    }

    renderCloud(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const s = object.size / viewHeight(pv.camera.viewW) * 100;
        const base = object.storm ? C.storm : C.cloud;
        const color = mixColor(base, [70, 74, 92, 255], pv.nightAmount * 0.35);
        slot.nodes[0].node.coordinates2d = polyCircle(p.x - s * 0.28, p.y, s * 0.32, 10);
        slot.nodes[1].node.coordinates2d = polyCircle(p.x, p.y - s * 0.15, s * 0.42, 10);
        slot.nodes[2].node.coordinates2d = polyCircle(p.x + s * 0.3, p.y, s * 0.3, 10);
        slot.nodes[0].node.fill = color;
        slot.nodes[1].node.fill = color;
        slot.nodes[2].node.fill = color;
        if (object.storm) {
            const rain = clamp(object.life / 4, 0, 1);
            slot.nodes[3].node.coordinates2d = thickLine(p.x - s * 0.25, p.y + s * 0.35, p.x - s * 0.4, p.y + s * (0.8 + rain * 0.2), Math.max(0.25, s * 0.05));
            slot.nodes[3].node.fill = C.waterLight;
        } else {
            setHidden(slot.nodes[3]);
        }
    }

    renderBoat(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const s = 100 / viewHeight(pv.camera.viewW);
        slot.nodes[0].node.coordinates2d = polygon([[p.x - 9 * s, p.y], [p.x + 9 * s, p.y], [p.x + 5 * s, p.y + 5 * s], [p.x - 6 * s, p.y + 5 * s], [p.x - 9 * s, p.y]]);
        slot.nodes[0].node.fill = object.color;
        slot.nodes[1].node.coordinates2d = thickLine(p.x, p.y, p.x, p.y - 16 * s, Math.max(0.3, 1.2 * s));
        slot.nodes[1].node.fill = C.ink;
        slot.nodes[2].node.coordinates2d = polygon([[p.x, p.y - 15 * s], [p.x + 10 * s, p.y - 4 * s], [p.x, p.y - 4 * s], [p.x, p.y - 15 * s]]);
        slot.nodes[2].node.fill = C.white;
        slot.nodes[3].node.coordinates2d = thickLine(p.x - 12 * s, p.y + 7 * s, p.x + 12 * s, p.y + 7 * s, Math.max(0.25, 0.8 * s));
        slot.nodes[3].node.fill = C.waterLight;
        slot.nodes[4].node.coordinates2d = polyCircle(p.x - 7 * s, p.y + 7 * s, Math.max(0.25, 1.1 * s), 8);
        slot.nodes[4].node.fill = C.white;
    }

    renderFish(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const s = 100 / viewHeight(pv.camera.viewW);
        const d = object.dir;
        slot.nodes[0].node.coordinates2d = polygon([[p.x - d * 5 * s, p.y], [p.x, p.y - 3 * s], [p.x + d * 6 * s, p.y], [p.x, p.y + 3 * s], [p.x - d * 5 * s, p.y]]);
        slot.nodes[0].node.fill = object.color;
        slot.nodes[1].node.coordinates2d = polygon([[p.x - d * 5 * s, p.y], [p.x - d * 8 * s, p.y - 4 * s], [p.x - d * 8 * s, p.y + 4 * s], [p.x - d * 5 * s, p.y]]);
        slot.nodes[1].node.fill = mixColor(object.color, C.white, 0.25);
    }

    renderEffect(pv, slot, object) {
        for (const node of slot.nodes) {
            node.node.border = 0;
            node.node.color = C.white;
        }
        const p = worldToScreen(pv.camera, object.x, object.y);
        const t = clamp(object.age / object.life, 0, 1);
        const alpha = Math.round(255 * (1 - t));
        const color = [object.color[0], object.color[1], object.color[2], alpha];
        if (object.type === 'steam' || object.type === 'rain') {
            const r = 1 + t * 4;
            slot.nodes[0].node.coordinates2d = object.type === 'rain' ? thickLine(p.x - 5, p.y - 2, p.x - 8, p.y + 10, 0.5) : polyCircle(p.x - t * 2, p.y - t * 7, r, 10);
            slot.nodes[1].node.coordinates2d = object.type === 'rain' ? thickLine(p.x + 1, p.y - 4, p.x - 2, p.y + 11, 0.5) : polyCircle(p.x + 2 + t, p.y - 2 - t * 6, r * 0.72, 9);
            slot.nodes[2].node.coordinates2d = object.type === 'rain' ? thickLine(p.x + 7, p.y - 1, p.x + 4, p.y + 9, 0.5) : ShapeUtils.rectangle(0, 0, 0, 0);
        } else if (object.type === 'splash' || object.type === 'whistle') {
            const r = 2 + t * 11;
            slot.nodes[0].node.coordinates2d = polyCircle(p.x, p.y, r, 18);
            slot.nodes[0].node.fill = C.transparent;
            slot.nodes[0].node.color = color;
            slot.nodes[0].node.border = 2;
            slot.nodes[1].node.coordinates2d = polyCircle(p.x, p.y, r * 0.63, 18);
            slot.nodes[1].node.fill = C.transparent;
            slot.nodes[1].node.color = color;
            slot.nodes[1].node.border = 2;
            slot.nodes[2].node.coordinates2d = star(p.x, p.y, 2.4, 1, 5);
            slot.nodes[2].node.fill = color;
        } else if (object.type === 'lightning') {
            slot.nodes[0].node.coordinates2d = polygon([[p.x - 1, p.y - 8], [p.x + 3, p.y - 2], [p.x, p.y - 2], [p.x + 2, p.y + 7], [p.x - 4, p.y], [p.x - 1, p.y], [p.x - 1, p.y - 8]]);
            slot.nodes[1].node.coordinates2d = star(p.x - 6, p.y + 2, 2 + t * 3, 0.7, 6);
            slot.nodes[2].node.coordinates2d = star(p.x + 6, p.y - 1, 2 + t * 3, 0.7, 6);
        } else if (object.type === 'festival' || object.type === 'commute' || object.type === 'harvest') {
            slot.nodes[0].node.coordinates2d = star(p.x - 7 + t * 2, p.y - 5 - t * 12, 2.5, 0.9, 5);
            slot.nodes[1].node.coordinates2d = star(p.x + 7 - t * 2, p.y - 8 - t * 15, 2.2, 0.8, 5);
            slot.nodes[2].node.coordinates2d = star(p.x, p.y - 12 - t * 17, 2.8, 1, 6);
        } else if (object.type === 'traffic') {
            slot.nodes[0].node.coordinates2d = diamond(p.x - 5, p.y - t * 8, 2.4, 3.1);
            slot.nodes[1].node.coordinates2d = diamond(p.x + 5, p.y - 2 - t * 9, 2.4, 3.1);
            slot.nodes[2].node.coordinates2d = star(p.x, p.y - 7 - t * 11, 2.3, 0.8, 6);
        } else {
            slot.nodes[0].node.coordinates2d = star(p.x - 5, p.y - t * 6, 2, 0.65, 5);
            slot.nodes[1].node.coordinates2d = star(p.x + 5, p.y - 1 - t * 7, 1.8, 0.6, 5);
            slot.nodes[2].node.coordinates2d = star(p.x, p.y - 4 - t * 9, 2.2, 0.75, 5);
        }
        for (const node of slot.nodes) {
            if (object.type !== 'splash' && object.type !== 'whistle') node.node.fill = color;
        }
    }

    tick() {
        this.updateSimulation();
        const ids = Object.keys(this.players);
        for (const id of ids) {
            const pv = this.players[id];
            this.updateCamera(pv);
            this.updatePlayerView(pv);
        }
        if (ids.length > 0) this.getViewRoot().node.onStateChange();
    }
}

module.exports = LittleConsequences;
