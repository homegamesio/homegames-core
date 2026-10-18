'use strict';

// SPDX-License-Identifier: MIT

const { ViewableGame, GameNode, Shapes, ShapeUtils } = require('squish-150');

const WORLD_SIZE = 1800;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const MAX_PLAYERS = 4;
const NORMAL_VIEW_W = 300;
const MIN_VIEW_W = 220;
const MAX_VIEW_W = 560;

const C = {
    transparent: [0, 0, 0, 0],
    white: [247, 245, 232, 255],
    ink: [31, 37, 47, 255],
    rail: [73, 69, 70, 255],
    sleeper: [100, 77, 58, 255],
    road: [72, 75, 82, 255],
    roadLine: [235, 208, 114, 255],
    path: [218, 201, 164, 255],
    pathEdge: [143, 116, 82, 255],
    grassA: [98, 157, 89, 255],
    grassB: [77, 137, 82, 255],
    grassC: [126, 173, 92, 255],
    soil: [130, 94, 66, 255],
    water: [53, 137, 177, 255],
    waterLight: [115, 204, 215, 255],
    trunk: [103, 73, 54, 255],
    leafA: [54, 119, 73, 255],
    leafB: [83, 148, 79, 255],
    leafC: [127, 169, 86, 255],
    windowDay: [155, 205, 217, 255],
    windowNight: [255, 216, 110, 255],
    panel: [21, 29, 39, 185],
    panelLine: [233, 232, 217, 205],
    steam: [232, 234, 232, 190],
    red: [205, 66, 66, 255],
    blue: [59, 105, 169, 255],
    gold: [226, 171, 71, 255],
    teal: [49, 144, 139, 255],
    purple: [116, 83, 154, 255],
    skinA: [224, 179, 133, 255],
    skinB: [133, 83, 58, 255]
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

function polyCircle(cx, cy, radius, sides) {
    const result = [];
    const count = sides || 10;
    for (let i = 0; i <= count; i += 1) {
        const a = i / count * Math.PI * 2;
        result.push([clamp(cx + Math.cos(a) * radius, 0, 100), clamp(cy + Math.sin(a) * radius, 0, 100)]);
    }
    return result;
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
        const radius = i % 2 === 0 ? outer : inner;
        const a = -Math.PI / 2 + i / (points * 2) * Math.PI * 2;
        out.push([clamp(cx + Math.cos(a) * radius, 0, 100), clamp(cy + Math.sin(a) * radius, 0, 100)]);
    }
    return out;
}

function trackY(x) {
    return 910 + Math.sin(x * 0.0062) * 54 + Math.sin(x * 0.017) * 16;
}

function roadY(x) {
    return trackY(x) + 86 + Math.sin(x * 0.009 + 1.3) * 13;
}

function walkwayY(x) {
    return roadY(x) - 13 + Math.sin(x * 0.011 + 0.45) * 1.4;
}

function groundY(x) {
    return roadY(x) + 48 + Math.sin(x * 0.004 + 0.8) * 22;
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
    // A shape with a defined border must also retain a valid color array.
    // Keep color opaque rather than transparent: some render paths use color
    // even when border is zero.
    node.node.color = C.white;
    node.node.border = 0;
}

function hideRig(slot) {
    if (!slot.visible) return;
    for (const node of slot.nodes) setHidden(node);
    slot.visible = false;
}

function worldToScreen(camera, x, y) {
    const viewH = viewHeight(camera.viewW);
    return {
        x: ((x - (camera.x - camera.viewW / 2)) / camera.viewW) * 100,
        y: ((y - (camera.y - viewH / 2)) / viewH) * 100
    };
}

function screenToWorld(camera, x, y) {
    const viewH = viewHeight(camera.viewW);
    return {
        x: camera.x - camera.viewW / 2 + x / 100 * camera.viewW,
        y: camera.y - viewH / 2 + y / 100 * viewH
    };
}

function isVisible(camera, object, margin) {
    const viewH = viewHeight(camera.viewW);
    const m = margin || 0;
    return object.x >= camera.x - camera.viewW / 2 - m &&
        object.x <= camera.x + camera.viewW / 2 + m &&
        object.y >= camera.y - viewH / 2 - m &&
        object.y <= camera.y + viewH / 2 + m;
}

class RailwayReverie extends ViewableGame {
    static metadata() {
        return {
            isTest: true, // Catalog review: see docs/game-consolidation.md.

            squishVersion: '150',
            name: 'Railway Reverie',
            author: "Joseph Garcia",
            description: 'Explore a shared living model railway through independent cameras. Watch trains, towns, wildlife, traffic, weather, and tiny contextual events unfold across a huge polygon world.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30,
            maxPlayers: 4,
            services: ['multiplayer']
        };
    }

    constructor() {
        super(WORLD_SIZE);
        this.time = 0;
        this.day = 0.22;
        this.eventId = 1;
        this.players = {};
        this.stations = [];
        this.terrain = [];
        this.track = [];
        this.roads = [];
        this.paths = [];
        this.water = [];
        this.trees = [];
        this.buildings = [];
        this.trains = [];
        this.cars = [];
        this.people = [];
        this.animals = [];
        this.birds = [];
        this.clouds = [];
        this.aircraft = [];
        this.boats = [];
        this.events = [];
        this.createWorld();
    }

    getLayers() {
        return [{ root: this.getViewRoot() }];
    }

    createWorld() {
        this.createLandscape();
        this.createStationsAndTowns();
        this.createNature();
        this.createTraffic();
        this.createPopulation();
        this.createSkyLife();
    }

    createLandscape() {
        let id = 1;
        for (let x = 0; x < WORLD_SIZE; x += 80) {
            const y = groundY(x + 40);
            const palette = Math.floor(x / 240) % 3;
            this.terrain.push({ id: `terrain-${id++}`, x: x + 40, y, x1: x, x2: x + 82, color: [C.grassA, C.grassB, C.grassC][palette] });
        }
        id = 1;
        for (let x = 0; x < WORLD_SIZE; x += 46) {
            const x2 = Math.min(WORLD_SIZE, x + 48);
            this.track.push({ id: `track-${id++}`, x: (x + x2) / 2, y: trackY((x + x2) / 2), x1: x, y1: trackY(x), x2, y2: trackY(x2) });
            this.roads.push({ id: `road-${id}`, x: (x + x2) / 2, y: roadY((x + x2) / 2), x1: x, y1: roadY(x), x2, y2: roadY(x2) });
            this.paths.push({ id: `path-${id}`, x: (x + x2) / 2, y: walkwayY((x + x2) / 2), x1: x, y1: walkwayY(x), x2, y2: walkwayY(x2) });
        }
        this.water.push({ id: 'lake-main', x: 942, y: 1038, w: 300, h: 126, kind: 'lake' });
        this.water.push({ id: 'river-west', x: 238, y: 1024, w: 126, h: 88, kind: 'river' });
    }

    createStationsAndTowns() {
        const stationXs = [120, 390, 680, 930, 1240, 1570];
        const palettes = [C.red, C.teal, C.blue, C.gold, C.purple, C.red];
        let buildingId = 1;
        for (let i = 0; i < stationXs.length; i += 1) {
            const x = stationXs[i];
            const station = { id: `station-${i}`, x, y: trackY(x) - 31, color: palettes[i], kind: 'station', w: 50, h: 33 };
            this.stations.push(station);
            this.buildings.push(station);
            const count = i === 5 ? 7 : 4;
            for (let j = 0; j < count; j += 1) {
                const side = j % 2 === 0 ? -1 : 1;
                const bx = clamp(x + side * (45 + Math.floor(j / 2) * 40), 25, WORLD_SIZE - 25);
                const seed = i * 100 + j * 17;
                this.buildings.push({
                    id: `building-${buildingId++}`,
                    x: bx,
                    y: trackY(bx) - 35 - hash01(seed) * 22,
                    w: 26 + hash01(seed + 2) * 24,
                    h: 28 + hash01(seed + 3) * 38,
                    color: [C.blue, C.red, C.teal, C.gold, C.purple][(i + j) % 5],
                    kind: i === 5 && j > 2 ? 'tower' : (j === 3 ? 'shop' : 'house')
                });
            }
        }
        this.buildings.push({ id: 'barn-1', x: 510, y: groundY(510) - 44, w: 52, h: 40, color: C.red, kind: 'barn' });
        this.buildings.push({ id: 'mill-1', x: 765, y: groundY(765) - 54, w: 34, h: 54, color: C.white, kind: 'mill' });
        this.buildings.push({ id: 'lighthouse-1', x: 1720, y: groundY(1720) - 72, w: 24, h: 72, color: C.white, kind: 'lighthouse' });
    }

    createNature() {
        let treeId = 1;
        for (let i = 0; i < 108; i += 1) {
            const seed = 9000 + i * 71;
            let x = 20 + hash01(seed) * (WORLD_SIZE - 40);
            if (x > 820 && x < 1070) x += x < 945 ? -100 : 100;
            const y = groundY(x) - 13 - hash01(seed + 1) * 20;
            const zone = x > 560 && x < 830 ? 'forest' : (x > 1180 && x < 1490 ? 'mountain' : 'field');
            this.trees.push({
                id: `tree-${treeId++}`,
                x,
                y,
                size: 13 + hash01(seed + 2) * 17,
                tone: Math.floor(hash01(seed + 3) * 3),
                zone
            });
        }
        for (let i = 0; i < 24; i += 1) {
            const seed = 17000 + i * 41;
            const zone = i % 3;
            const minX = zone === 0 ? 270 : zone === 1 ? 520 : 1190;
            const maxX = zone === 0 ? 610 : zone === 1 ? 820 : 1490;
            const x = minX + hash01(seed) * (maxX - minX);
            this.animals.push({
                id: `animal-${i}`,
                x,
                y: groundY(x) - 8,
                homeX: x,
                range: 28 + hash01(seed + 2) * 35,
                speed: 3 + hash01(seed + 3) * 4,
                dir: hash01(seed + 4) > 0.5 ? 1 : -1,
                type: zone === 0 ? (i % 2 ? 'cow' : 'sheep') : zone === 1 ? 'deer' : 'goat',
                phase: hash01(seed + 5) * Math.PI * 2
            });
        }
    }

    createTraffic() {
        const trainColors = [C.red, C.blue, C.gold, C.teal];
        for (let i = 0; i < 4; i += 1) {
            const x = 100 + i * 420;
            this.trains.push({
                id: `train-${i}`,
                x,
                y: trackY(x),
                dir: i % 2 === 0 ? 1 : -1,
                speed: 19 + i * 2,
                color: trainColors[i],
                stopTimer: 0,
                stationCooldown: 2 + i,
                boostTimer: 0,
                steamTimer: i * 0.2,
                carriageCount: i === 2 ? 3 : 2
            });
        }
        for (let i = 0; i < 18; i += 1) {
            const x = hash01(30000 + i * 43) * WORLD_SIZE;
            this.cars.push({
                id: `car-${i}`,
                x,
                y: roadY(x),
                dir: i % 2 === 0 ? 1 : -1,
                speed: 15 + hash01(30001 + i * 43) * 15,
                color: [C.red, C.blue, C.gold, C.teal, C.purple][i % 5],
                phase: i * 0.4
            });
        }
        for (let i = 0; i < 4; i += 1) {
            const x = 835 + i * 62;
            this.boats.push({
                id: `boat-${i}`,
                x,
                y: 1020 + i * 16,
                homeX: x,
                range: 90,
                speed: 4 + i,
                dir: i % 2 ? -1 : 1,
                color: [C.red, C.blue, C.gold, C.teal][i]
            });
        }
    }

    createPopulation() {
        let id = 1;
        for (const station of this.stations) {
            for (let i = 0; i < 6; i += 1) {
                const seed = 45000 + id * 31;
                const x = station.x - 55 + hash01(seed) * 110;
                this.people.push({
                    id: `person-${id++}`,
                    x,
                    y: walkwayY(x) - 3,
                    homeX: station.x,
                    range: 60 + hash01(seed + 1) * 35,
                    speed: 5 + hash01(seed + 2) * 5,
                    dir: hash01(seed + 3) > 0.5 ? 1 : -1,
                    phase: hash01(seed + 4) * Math.PI * 2,
                    coat: [C.red, C.blue, C.gold, C.teal, C.purple][i % 5],
                    skin: i % 3 === 0 ? C.skinB : C.skinA,
                    role: i === 0 ? 'porter' : i === 1 ? 'cyclist' : 'walker'
                });
            }
        }
    }

    createSkyLife() {
        for (let i = 0; i < 24; i += 1) {
            const x = hash01(60000 + i * 19) * WORLD_SIZE;
            this.birds.push({
                id: `bird-${i}`,
                x,
                y: 680 + hash01(60001 + i * 19) * 170,
                speed: 10 + hash01(60002 + i * 19) * 18,
                dir: i % 3 === 0 ? -1 : 1,
                phase: i * 0.7,
                color: i % 5 === 0 ? C.white : C.ink
            });
        }
        for (let i = 0; i < 10; i += 1) {
            this.clouds.push({
                id: `cloud-${i}`,
                x: i * 190 + 40,
                y: 640 + (i % 4) * 45,
                speed: 2.4 + (i % 3),
                size: 36 + (i % 4) * 12
            });
        }
        this.aircraft.push({ id: 'aircraft-0', x: 100, y: 590, speed: 31, dir: 1, color: C.red });
        this.aircraft.push({ id: 'aircraft-1', x: 1500, y: 720, speed: 24, dir: -1, color: C.gold });
    }

    createPlayerView(playerId) {
        const root = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), [135, 197, 224, 255], { playerIds: [playerId] });
        const anchor = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), C.transparent, { playerIds: [playerId] });
        const background = makeContainer();
        const terrainLayer = makeContainer();
        const worldLayer = makeContainer();
        const actorLayer = makeContainer();
        const effectLayer = makeContainer();
        const tapCatcher = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), C.transparent, {
            onClick: (pid, x, y) => this.handleWorldTap(pid, x, y)
        });
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
            camera: { x: 930, y: 885, viewW: NORMAL_VIEW_W, targetX: 930, targetY: 885, targetViewW: NORMAL_VIEW_W },
            keys: {},
            pools: {},
            backdrop: this.createBackdrop(background),
            controls: []
        };

        pv.pools.terrain = this.createPool(terrainLayer, 12, 1);
        pv.pools.water = this.createPool(terrainLayer, 2, 2);
        pv.pools.track = this.createPool(worldLayer, 14, 3);
        pv.pools.road = this.createPool(worldLayer, 14, 2);
        pv.pools.path = this.createPool(worldLayer, 14, 2);
        pv.pools.tree = this.createPool(worldLayer, 18, 4);
        pv.pools.building = this.createPool(worldLayer, 10, 8);
        pv.pools.train = this.createPool(actorLayer, 4, 12);
        pv.pools.car = this.createPool(actorLayer, 7, 4);
        pv.pools.person = this.createPool(actorLayer, 10, 8);
        pv.pools.animal = this.createPool(actorLayer, 6, 5);
        pv.pools.bird = this.createPool(actorLayer, 8, 2);
        pv.pools.cloud = this.createPool(actorLayer, 5, 3);
        pv.pools.aircraft = this.createPool(actorLayer, 2, 5);
        pv.pools.boat = this.createPool(actorLayer, 3, 5);
        pv.pools.event = this.createPool(effectLayer, 12, 3);

        this.createControls(pv);
        this.players[playerId] = pv;
        this.getViewRoot().addChild(root);
        this.updatePlayerView(pv, true);
        return pv;
    }

    createBackdrop(layer) {
        const sky = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), [135, 197, 224, 255]);
        const sun = makeShape(polyCircle(78, 18, 4.5, 16), [255, 225, 126, 255]);
        const moonCut = makeShape(polyCircle(79.5, 16.8, 4.2, 16), [135, 197, 224, 255]);
        const farHillA = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), [104, 139, 126, 255]);
        const farHillB = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), [84, 120, 111, 255]);
        const stars = [];
        for (let i = 0; i < 14; i += 1) {
            const x = 4 + hash01(80000 + i * 17) * 92;
            const y = 4 + hash01(80001 + i * 17) * 38;
            const node = makeShape(star(x, y, 0.34 + (i % 3) * 0.1, 0.13, 4), C.transparent);
            stars.push(node);
        }
        layer.addChildren(sky, ...stars, farHillA, farHillB, sun, moonCut);
        return { sky, sun, moonCut, farHillA, farHillB, stars };
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
        const addButton = (shape, iconNodes, action) => {
            const button = makeShape(shape, C.panel, { color: C.panelLine, border: 2, onClick: action });
            pv.uiLayer.addChild(button);
            for (const icon of iconNodes) {
                icon.node.onClick = action;
                pv.uiLayer.addChild(icon);
            }
            pv.controls.push(button, ...iconNodes);
        };

        addButton(
            polygon([[0.6, 40], [5.7, 40], [5.7, 60], [0.6, 60], [0.6, 40]]),
            [makeShape(polygon([[4.5, 44], [1.8, 50], [4.5, 56], [4.5, 44]]), C.white)],
            (pid) => this.nudgeCamera(pid, -1, 0)
        );
        addButton(
            polygon([[94.3, 40], [99.4, 40], [99.4, 60], [94.3, 60], [94.3, 40]]),
            [makeShape(polygon([[95.5, 44], [98.2, 50], [95.5, 56], [95.5, 44]]), C.white)],
            (pid) => this.nudgeCamera(pid, 1, 0)
        );
        addButton(
            polygon([[45, 0.5], [55, 0.5], [55, 5.4], [45, 5.4], [45, 0.5]]),
            [makeShape(polygon([[46.5, 4.3], [50, 1.7], [53.5, 4.3], [46.5, 4.3]]), C.white)],
            (pid) => this.nudgeCamera(pid, 0, -1)
        );
        addButton(
            polygon([[45, 94.6], [55, 94.6], [55, 99.5], [45, 99.5], [45, 94.6]]),
            [makeShape(polygon([[46.5, 95.7], [50, 98.3], [53.5, 95.7], [46.5, 95.7]]), C.white)],
            (pid) => this.nudgeCamera(pid, 0, 1)
        );

        const zoomOut = (pid) => this.zoomCamera(pid, 1);
        const goHome = (pid) => this.homeCamera(pid);
        const zoomIn = (pid) => this.zoomCamera(pid, -1);
        const minusButton = makeShape(polyCircle(38, 96.7, 2.7, 14), C.panel, { color: C.panelLine, border: 2, onClick: zoomOut });
        const minus = makeShape(ShapeUtils.rectangle(36.6, 96.35, 2.8, 0.7), C.white, { onClick: zoomOut });
        const homeButton = makeShape(polyCircle(50, 96.7, 2.7, 14), C.panel, { color: C.panelLine, border: 2, onClick: goHome });
        const home = makeShape(diamond(50, 96.7, 1.45, 1.55), C.gold, { onClick: goHome });
        const plusButton = makeShape(polyCircle(62, 96.7, 2.7, 14), C.panel, { color: C.panelLine, border: 2, onClick: zoomIn });
        const plusH = makeShape(ShapeUtils.rectangle(60.6, 96.35, 2.8, 0.7), C.white, { onClick: zoomIn });
        const plusV = makeShape(ShapeUtils.rectangle(61.65, 95.3, 0.7, 2.8), C.white, { onClick: zoomIn });
        pv.uiLayer.addChildren(minusButton, minus, homeButton, home, plusButton, plusH, plusV);
        pv.controls.push(minusButton, minus, homeButton, home, plusButton, plusH, plusV);
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
    }

    handleKeyDown(playerId, key) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        const normalized = key.length === 1 ? key.toLowerCase() : key;
        pv.keys[normalized] = true;
        if (normalized === 'q' || normalized === '-') this.zoomCamera(playerId, 1);
        if (normalized === 'e' || normalized === '+' || normalized === '=') this.zoomCamera(playerId, -1);
        if (normalized === 'h' || normalized === '0' || normalized === 'Home') this.homeCamera(playerId);
        if (normalized === 'b') this.spawnFlock(pv.camera.x, pv.camera.y - 120, 4);
        if (normalized === 't') this.ringNearestTrain(pv.camera.x, pv.camera.y);
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
        const viewH = viewHeight(pv.camera.targetViewW);
        pv.camera.targetX = clamp(pv.camera.targetX + dx * pv.camera.targetViewW * 0.32, pv.camera.targetViewW / 2, WORLD_SIZE - pv.camera.targetViewW / 2);
        pv.camera.targetY = clamp(pv.camera.targetY + dy * viewH * 0.28, 570 + viewH / 2, 1160 - viewH / 2);
    }

    zoomCamera(playerId, direction) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        pv.camera.targetViewW = clamp(pv.camera.targetViewW * (direction > 0 ? 1.22 : 0.82), MIN_VIEW_W, MAX_VIEW_W);
        const viewH = viewHeight(pv.camera.targetViewW);
        pv.camera.targetX = clamp(pv.camera.targetX, pv.camera.targetViewW / 2, WORLD_SIZE - pv.camera.targetViewW / 2);
        pv.camera.targetY = clamp(pv.camera.targetY, 570 + viewH / 2, 1160 - viewH / 2);
    }

    homeCamera(playerId) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        pv.camera.targetX = 930;
        pv.camera.targetY = 885;
        pv.camera.targetViewW = NORMAL_VIEW_W;
    }

    handleWorldTap(playerId, sx, sy) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        if (sx < 6 || sx > 94 || sy < 6 || sy > 94) return;
        const point = screenToWorld(pv.camera, sx, sy);
        const nearestStation = this.nearest(this.stations, point.x, point.y);
        const nearLake = point.x > 790 && point.x < 1090 && point.y > 970;
        const nearTrack = Math.abs(point.y - trackY(point.x)) < 34;

        if (nearLake) {
            this.addEvent('splash', point.x, point.y, C.waterLight, 1.9);
            if (this.boats.length < 8) {
                this.boats.push({ id: `boat-extra-${this.eventId++}`, x: point.x, y: clamp(point.y, 1000, 1080), homeX: point.x, range: 70, speed: 4 + hash01(this.eventId) * 4, dir: 1, color: [C.red, C.blue, C.gold, C.teal][this.eventId % 4] });
            }
        } else if (nearestStation && nearestStation.distance < 92) {
            this.stationFestival(nearestStation.object);
        } else if (sy < 30 || point.y < trackY(point.x) - 42) {
            this.spawnFlock(point.x, point.y, 5);
            this.addEvent('skyburst', point.x, point.y, C.gold, 1.5);
        } else if (nearTrack) {
            this.ringNearestTrain(point.x, point.y);
        } else {
            this.addEvent('flowers', point.x, groundY(point.x) - 8, C.gold, 2.4);
            this.addAnimal(point.x);
        }
        this.getViewRoot().node.onStateChange();
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

    spawnFlock(x, y, count) {
        for (let i = 0; i < count; i += 1) {
            if (this.birds.length >= 42) this.birds.shift();
            this.birds.push({
                id: `bird-extra-${this.eventId++}`,
                x: clamp(x + (i - count / 2) * 11, 0, WORLD_SIZE),
                y: clamp(y + Math.sin(i) * 12, 580, 880),
                speed: 18 + i * 2,
                dir: i % 4 === 0 ? -1 : 1,
                phase: i * 0.8,
                color: i % 3 === 0 ? C.white : C.ink
            });
        }
    }

    ringNearestTrain(x, y) {
        const nearest = this.nearest(this.trains, x, y);
        if (!nearest) return;
        nearest.object.boostTimer = 5.5;
        nearest.object.stopTimer = 0;
        this.addEvent('whistle', nearest.object.x, nearest.object.y - 18, nearest.object.color, 2.1);
    }

    stationFestival(station) {
        this.addEvent('festival', station.x, station.y - 20, station.color, 3.1);
        for (let i = 0; i < 5; i += 1) {
            if (this.people.length >= 58) this.people.shift();
            const x = station.x - 35 + i * 17;
            this.people.push({
                id: `visitor-${this.eventId++}`,
                x,
                y: walkwayY(x) - 3,
                homeX: station.x,
                range: 65,
                speed: 6 + i,
                dir: i % 2 ? -1 : 1,
                phase: i,
                coat: [C.red, C.blue, C.gold, C.teal, C.purple][i],
                skin: i % 2 ? C.skinA : C.skinB,
                role: 'walker'
            });
        }
    }

    addAnimal(x) {
        if (this.animals.length >= 34) this.animals.shift();
        const id = this.eventId++;
        this.animals.push({
            id: `animal-extra-${id}`,
            x: clamp(x, 20, WORLD_SIZE - 20),
            y: groundY(x) - 8,
            homeX: x,
            range: 24,
            speed: 3 + hash01(id) * 3,
            dir: id % 2 ? -1 : 1,
            type: ['sheep', 'deer', 'goat'][id % 3],
            phase: id * 0.3
        });
    }

    addEvent(type, x, y, color, life) {
        if (this.events.length >= 28) this.events.shift();
        this.events.push({ id: `event-${this.eventId++}`, type, x, y, color, age: 0, life });
    }

    updateSimulation() {
        this.time += DT;
        this.day = (this.day + DT / 260) % 1;
        this.updateTrains();
        this.updateCars();
        this.updatePeople();
        this.updateAnimals();
        this.updateBirds();
        this.updateClouds();
        this.updateAircraft();
        this.updateBoats();
        for (const event of this.events) event.age += DT;
        this.events = this.events.filter((event) => event.age < event.life);
    }

    updateTrains() {
        for (const train of this.trains) {
            train.stationCooldown = Math.max(0, train.stationCooldown - DT);
            train.boostTimer = Math.max(0, train.boostTimer - DT);
            train.steamTimer -= DT;
            if (train.stopTimer > 0) {
                train.stopTimer -= DT;
            } else {
                train.x += train.dir * train.speed * (train.boostTimer > 0 ? 1.85 : 1) * DT;
                if (train.x < -45) train.x = WORLD_SIZE + 45;
                if (train.x > WORLD_SIZE + 45) train.x = -45;
                train.y = trackY(clamp(train.x, 0, WORLD_SIZE));
                if (train.stationCooldown <= 0) {
                    const nearest = this.nearest(this.stations, train.x, train.y);
                    if (nearest && nearest.distance < 8 && train.boostTimer <= 0) {
                        train.stopTimer = 2.3;
                        train.stationCooldown = 12;
                    }
                }
            }
            if (train.steamTimer <= 0) {
                train.steamTimer = 0.48;
                this.addEvent('steam', train.x - train.dir * 13, train.y - 19, C.steam, 1.4);
            }
        }
    }

    updateCars() {
        for (const car of this.cars) {
            car.x += car.dir * car.speed * DT;
            if (car.x < -30) car.x = WORLD_SIZE + 30;
            if (car.x > WORLD_SIZE + 30) car.x = -30;
            car.y = roadY(clamp(car.x, 0, WORLD_SIZE)) + Math.sin(this.time * 2 + car.phase) * 1.2;
        }
    }

    updatePeople() {
        for (const person of this.people) {
            person.x += person.dir * person.speed * DT;
            if (person.x < person.homeX - person.range) person.dir = 1;
            if (person.x > person.homeX + person.range) person.dir = -1;
            person.y = walkwayY(clamp(person.x, 0, WORLD_SIZE)) - 3;
        }
    }

    updateAnimals() {
        for (const animal of this.animals) {
            animal.x += animal.dir * animal.speed * DT;
            if (animal.x < animal.homeX - animal.range) animal.dir = 1;
            if (animal.x > animal.homeX + animal.range) animal.dir = -1;
            animal.y = groundY(clamp(animal.x, 0, WORLD_SIZE)) - 8;
        }
    }

    updateBirds() {
        for (const bird of this.birds) {
            bird.x += bird.dir * bird.speed * DT;
            if (bird.x < -30) bird.x = WORLD_SIZE + 30;
            if (bird.x > WORLD_SIZE + 30) bird.x = -30;
            bird.y += Math.sin(this.time * 2.2 + bird.phase) * 0.08;
        }
    }

    updateClouds() {
        for (const cloud of this.clouds) {
            cloud.x += cloud.speed * DT;
            if (cloud.x > WORLD_SIZE + 80) cloud.x = -80;
        }
    }

    updateAircraft() {
        for (const aircraft of this.aircraft) {
            aircraft.x += aircraft.dir * aircraft.speed * DT;
            if (aircraft.x < -100) aircraft.x = WORLD_SIZE + 100;
            if (aircraft.x > WORLD_SIZE + 100) aircraft.x = -100;
        }
    }

    updateBoats() {
        for (const boat of this.boats) {
            boat.x += boat.dir * boat.speed * DT;
            if (boat.x < boat.homeX - boat.range) boat.dir = 1;
            if (boat.x > boat.homeX + boat.range) boat.dir = -1;
        }
    }

    updateCamera(pv) {
        const keys = pv.keys;
        const pan = pv.camera.viewW * 0.42 * DT;
        const viewH = viewHeight(pv.camera.targetViewW);
        let dx = 0;
        let dy = 0;
        if (keys.a || keys.ArrowLeft) dx -= pan;
        if (keys.d || keys.ArrowRight) dx += pan;
        if (keys.w || keys.ArrowUp) dy -= pan * 0.56;
        if (keys.s || keys.ArrowDown) dy += pan * 0.56;
        pv.camera.targetX = clamp(pv.camera.targetX + dx, pv.camera.targetViewW / 2, WORLD_SIZE - pv.camera.targetViewW / 2);
        pv.camera.targetY = clamp(pv.camera.targetY + dy, 570 + viewH / 2, 1160 - viewH / 2);
        const follow = 1 - Math.exp(-9 * DT);
        pv.camera.x = lerp(pv.camera.x, pv.camera.targetX, follow);
        pv.camera.y = lerp(pv.camera.y, pv.camera.targetY, follow);
        pv.camera.viewW = lerp(pv.camera.viewW, pv.camera.targetViewW, follow);
    }

    bindPool(pv, pool, candidates, render) {
        const sorted = candidates.slice().sort((a, b) => {
            const da = Math.abs(a.x - pv.camera.x) + Math.abs(a.y - pv.camera.y) * 0.25;
            const db = Math.abs(b.x - pv.camera.x) + Math.abs(b.y - pv.camera.y) * 0.25;
            if (da !== db) return da - db;
            return String(a.id).localeCompare(String(b.id));
        }).slice(0, pool.slots.length);
        const selected = {};
        for (const object of sorted) selected[object.id] = object;

        for (const slot of pool.slots) {
            if (slot.objectId && !selected[slot.objectId]) {
                delete pool.byObject[slot.objectId];
                slot.objectId = null;
                hideRig(slot);
            }
        }

        for (const object of sorted) {
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
        let sky;
        let nightAmount;
        if (t < 0.22) {
            nightAmount = 1 - t / 0.22;
            sky = mixColor([103, 163, 198, 255], [26, 35, 76, 255], nightAmount);
        } else if (t < 0.48) {
            nightAmount = 0;
            sky = mixColor([122, 194, 225, 255], [92, 173, 218, 255], (t - 0.22) / 0.26);
        } else if (t < 0.72) {
            const dusk = (t - 0.48) / 0.24;
            nightAmount = dusk * 0.75;
            sky = mixColor([92, 173, 218, 255], [209, 108, 108, 255], dusk);
        } else {
            nightAmount = clamp((t - 0.72) / 0.18, 0, 1);
            sky = mixColor([209, 108, 108, 255], [26, 35, 76, 255], nightAmount);
        }
        pv.backdrop.sky.node.fill = sky;
        const sunAngle = t * Math.PI * 2 - Math.PI;
        const sx = 50 + Math.cos(sunAngle) * 37;
        const sy = 46 + Math.sin(sunAngle) * 31;
        pv.backdrop.sun.node.coordinates2d = polyCircle(sx, sy, 4.2, 16);
        pv.backdrop.sun.node.fill = nightAmount > 0.65 ? [242, 238, 202, 255] : [255, 225, 126, 255];
        pv.backdrop.moonCut.node.coordinates2d = nightAmount > 0.65 ? polyCircle(sx + 1.8, sy - 1.2, 3.8, 16) : ShapeUtils.rectangle(0, 0, 0, 0);
        pv.backdrop.moonCut.node.fill = sky;
        for (let i = 0; i < pv.backdrop.stars.length; i += 1) {
            pv.backdrop.stars[i].node.fill = [245, 241, 218, Math.round(220 * nightAmount)];
        }
        const p = pv.camera.x * 0.01;
        pv.backdrop.farHillA.node.coordinates2d = polygon([[0, 70], [12, 54 + Math.sin(p) * 4], [27, 66], [43, 45 + Math.cos(p * 0.7) * 5], [61, 64], [79, 49 + Math.sin(p * 0.5) * 4], [100, 67], [100, 100], [0, 100], [0, 70]]);
        pv.backdrop.farHillA.node.fill = mixColor([104, 139, 126, 255], [48, 65, 82, 255], nightAmount * 0.8);
        pv.backdrop.farHillB.node.coordinates2d = polygon([[0, 77], [17, 63 + Math.cos(p * 0.8) * 3], [34, 74], [54, 58 + Math.sin(p * 0.6) * 4], [72, 72], [89, 60 + Math.cos(p * 0.4) * 3], [100, 75], [100, 100], [0, 100], [0, 77]]);
        pv.backdrop.farHillB.node.fill = mixColor([84, 120, 111, 255], [38, 52, 68, 255], nightAmount * 0.85);
        pv.nightAmount = nightAmount;
    }

    updatePlayerView(pv) {
        this.updateBackdrop(pv);
        const c = pv.camera;
        this.bindPool(pv, pv.pools.terrain, this.terrain.filter((o) => isVisible(c, o, 100)), this.renderTerrain);
        this.bindPool(pv, pv.pools.water, this.water.filter((o) => Math.abs(o.x - c.x) < c.viewW * 0.75), this.renderWater);
        this.bindPool(pv, pv.pools.track, this.track.filter((o) => isVisible(c, o, 70)), this.renderTrack);
        this.bindPool(pv, pv.pools.road, this.roads.filter((o) => isVisible(c, o, 70)), this.renderRoad);
        this.bindPool(pv, pv.pools.path, this.paths.filter((o) => isVisible(c, o, 70)), this.renderPath);
        this.bindPool(pv, pv.pools.tree, this.trees.filter((o) => isVisible(c, o, 55)), this.renderTree);
        this.bindPool(pv, pv.pools.building, this.buildings.filter((o) => isVisible(c, o, 75)), this.renderBuilding);
        this.bindPool(pv, pv.pools.train, this.trains.filter((o) => isVisible(c, o, 90)), this.renderTrain);
        this.bindPool(pv, pv.pools.car, this.cars.filter((o) => isVisible(c, o, 50)), this.renderCar);
        this.bindPool(pv, pv.pools.person, this.people.filter((o) => isVisible(c, o, 30)), this.renderPerson);
        this.bindPool(pv, pv.pools.animal, this.animals.filter((o) => isVisible(c, o, 35)), this.renderAnimal);
        this.bindPool(pv, pv.pools.bird, this.birds.filter((o) => isVisible(c, o, 45)), this.renderBird);
        this.bindPool(pv, pv.pools.cloud, this.clouds.filter((o) => isVisible(c, o, 90)), this.renderCloud);
        this.bindPool(pv, pv.pools.aircraft, this.aircraft.filter((o) => isVisible(c, o, 120)), this.renderAircraft);
        this.bindPool(pv, pv.pools.boat, this.boats.filter((o) => isVisible(c, o, 45)), this.renderBoat);
        this.bindPool(pv, pv.pools.event, this.events.filter((o) => isVisible(c, o, 80)), this.renderEvent);
    }

    renderTerrain(pv, slot, object) {
        const a = worldToScreen(pv.camera, object.x1, groundY(object.x1));
        const b = worldToScreen(pv.camera, object.x2, groundY(object.x2));
        slot.nodes[0].node.coordinates2d = polygon([[a.x, a.y], [b.x, b.y], [b.x, 100], [a.x, 100], [a.x, a.y]]);
        slot.nodes[0].node.fill = mixColor(object.color, [36, 58, 57, 255], pv.nightAmount * 0.72);
    }

    renderWater(pv, slot, object) {
        const center = worldToScreen(pv.camera, object.x, object.y);
        const w = object.w / pv.camera.viewW * 100;
        const h = object.h / viewHeight(pv.camera.viewW) * 100;
        slot.nodes[0].node.coordinates2d = polygon([[center.x - w / 2, center.y - h / 2], [center.x + w / 2, center.y - h / 2], [center.x + w / 2, center.y + h / 2], [center.x - w / 2, center.y + h / 2], [center.x - w / 2, center.y - h / 2]]);
        slot.nodes[0].node.fill = mixColor(C.water, [24, 61, 91, 255], pv.nightAmount * 0.8);
        slot.nodes[1].node.coordinates2d = thickLine(center.x - w * 0.42, center.y - h * 0.16, center.x + w * 0.36, center.y - h * 0.16, 0.65);
        slot.nodes[1].node.fill = [C.waterLight[0], C.waterLight[1], C.waterLight[2], 165];
    }

    renderTrack(pv, slot, object) {
        const a = worldToScreen(pv.camera, object.x1, object.y1);
        const b = worldToScreen(pv.camera, object.x2, object.y2);
        const scale = 100 / viewHeight(pv.camera.viewW);
        slot.nodes[0].node.coordinates2d = thickLine(a.x, a.y, b.x, b.y, Math.max(1.3, 6 * scale));
        slot.nodes[0].node.fill = C.sleeper;
        slot.nodes[1].node.coordinates2d = thickLine(a.x, a.y - 0.7, b.x, b.y - 0.7, Math.max(0.35, 1.5 * scale));
        slot.nodes[1].node.fill = C.rail;
        slot.nodes[2].node.coordinates2d = thickLine(a.x, a.y + 0.7, b.x, b.y + 0.7, Math.max(0.35, 1.5 * scale));
        slot.nodes[2].node.fill = C.rail;
    }

    renderRoad(pv, slot, object) {
        const a = worldToScreen(pv.camera, object.x1, object.y1);
        const b = worldToScreen(pv.camera, object.x2, object.y2);
        const scale = 100 / viewHeight(pv.camera.viewW);
        slot.nodes[0].node.coordinates2d = thickLine(a.x, a.y, b.x, b.y, Math.max(2, 9 * scale));
        slot.nodes[0].node.fill = mixColor(C.road, [39, 43, 54, 255], pv.nightAmount * 0.65);
        slot.nodes[1].node.coordinates2d = thickLine(a.x, a.y, b.x, b.y, Math.max(0.28, 0.8 * scale));
        slot.nodes[1].node.fill = C.roadLine;
    }

    renderPath(pv, slot, object) {
        const a = worldToScreen(pv.camera, object.x1, object.y1);
        const b = worldToScreen(pv.camera, object.x2, object.y2);
        const scale = 100 / viewHeight(pv.camera.viewW);
        slot.nodes[0].node.coordinates2d = thickLine(a.x, a.y, b.x, b.y, Math.max(1.15, 6.2 * scale));
        slot.nodes[0].node.fill = mixColor(C.pathEdge, [50, 54, 61, 255], pv.nightAmount * 0.62);
        slot.nodes[1].node.coordinates2d = thickLine(a.x, a.y, b.x, b.y, Math.max(0.75, 4.4 * scale));
        slot.nodes[1].node.fill = mixColor(C.path, [83, 81, 77, 255], pv.nightAmount * 0.55);
    }

    renderTree(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const s = object.size / viewHeight(pv.camera.viewW) * 100;
        const leaves = [C.leafA, C.leafB, C.leafC][object.tone % 3];
        slot.nodes[0].node.coordinates2d = safeRect(p.x - s * 0.11, p.y - s * 0.05, s * 0.22, s * 0.72);
        slot.nodes[0].node.fill = C.trunk;
        slot.nodes[1].node.coordinates2d = polyCircle(p.x - s * 0.22, p.y - s * 0.2, s * 0.35, 8);
        slot.nodes[2].node.coordinates2d = polyCircle(p.x + s * 0.22, p.y - s * 0.22, s * 0.36, 8);
        slot.nodes[3].node.coordinates2d = polyCircle(p.x, p.y - s * 0.46, s * 0.42, 9);
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
        const body = mixColor(object.color, [38, 45, 58, 255], pv.nightAmount * 0.67);
        const roofY = object.kind === 'tower' ? y : y - sh * 0.2;
        slot.nodes[0].node.coordinates2d = safeRect(x, y, sw, sh);
        slot.nodes[0].node.fill = body;
        slot.nodes[1].node.coordinates2d = object.kind === 'tower'
            ? safeRect(x + sw * 0.08, roofY, sw * 0.84, sh * 0.13)
            : polygon([[x - sw * 0.08, y], [p.x, roofY], [x + sw * 1.08, y], [x - sw * 0.08, y]]);
        slot.nodes[1].node.fill = object.kind === 'station' ? C.ink : C.sleeper;
        slot.nodes[2].node.coordinates2d = safeRect(p.x - sw * 0.1, y + sh * 0.62, sw * 0.2, sh * 0.38);
        slot.nodes[2].node.fill = C.ink;
        const windowColor = mixColor(C.windowDay, C.windowNight, clamp(pv.nightAmount * 1.5, 0, 1));
        for (let i = 0; i < 4; i += 1) {
            const column = i % 2;
            const row = Math.floor(i / 2);
            slot.nodes[3 + i].node.coordinates2d = safeRect(
                x + sw * (0.18 + column * 0.47),
                y + sh * (0.18 + row * 0.28),
                sw * 0.16,
                sh * 0.16
            );
            slot.nodes[3 + i].node.fill = windowColor;
        }
        slot.nodes[7].node.coordinates2d = safeRect(x + sw * 0.05, y + sh * 0.72, sw * 0.9, sh * 0.08);
        slot.nodes[7].node.fill = object.kind === 'shop' || object.kind === 'station' ? C.white : body;
    }

    renderTrain(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const scaleX = 100 / pv.camera.viewW;
        const scaleY = 100 / viewHeight(pv.camera.viewW);
        const dir = object.dir;
        const unit = Math.min(scaleX, scaleY);
        const totalW = (32 + object.carriageCount * 28) * scaleX;
        const h = 26 * scaleY;
        const x = p.x - totalW / 2;
        const y = p.y - h;
        slot.nodes[0].node.coordinates2d = safeRect(x, y + h * 0.24, totalW * 0.34, h * 0.58);
        slot.nodes[0].node.fill = object.color;
        slot.nodes[1].node.coordinates2d = polygon(dir > 0
            ? [[x + totalW * 0.34, y + h * 0.24], [x + totalW * 0.45, y + h * 0.5], [x + totalW * 0.34, y + h * 0.82], [x + totalW * 0.34, y + h * 0.24]]
            : [[x, y + h * 0.24], [x - totalW * 0.11, y + h * 0.5], [x, y + h * 0.82], [x, y + h * 0.24]]);
        slot.nodes[1].node.fill = object.color;
        slot.nodes[2].node.coordinates2d = safeRect(x + totalW * 0.09, y, totalW * 0.16, h * 0.34);
        slot.nodes[2].node.fill = C.ink;
        for (let i = 0; i < 3; i += 1) {
            slot.nodes[3 + i].node.coordinates2d = safeRect(x + totalW * (0.08 + i * 0.11), y + h * 0.34, totalW * 0.07, h * 0.18);
            slot.nodes[3 + i].node.fill = mixColor(C.windowDay, C.windowNight, pv.nightAmount);
        }
        for (let i = 0; i < 2; i += 1) {
            const cx = x + totalW * (0.1 + i * 0.21);
            slot.nodes[6 + i].node.coordinates2d = polyCircle(cx, y + h * 0.84, Math.max(0.6, 4.3 * unit), 10);
            slot.nodes[6 + i].node.fill = C.ink;
        }
        for (let i = 0; i < 2; i += 1) {
            const carX = x + totalW * (0.42 + i * 0.28);
            slot.nodes[8 + i].node.coordinates2d = safeRect(carX, y + h * 0.3, totalW * 0.25, h * 0.5);
            slot.nodes[8 + i].node.fill = mixColor(object.color, C.white, 0.18 + i * 0.08);
        }
        slot.nodes[10].node.coordinates2d = polyCircle(x + totalW * 0.54, y + h * 0.84, Math.max(0.55, 4 * unit), 10);
        slot.nodes[10].node.fill = C.ink;
        slot.nodes[11].node.coordinates2d = polyCircle(x + totalW * 0.79, y + h * 0.84, Math.max(0.55, 4 * unit), 10);
        slot.nodes[11].node.fill = C.ink;
    }

    renderCar(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const sx = 100 / pv.camera.viewW;
        const sy = 100 / viewHeight(pv.camera.viewW);
        const w = 18 * sx;
        const h = 10 * sy;
        slot.nodes[0].node.coordinates2d = safeRect(p.x - w / 2, p.y - h, w, h * 0.68);
        slot.nodes[0].node.fill = object.color;
        slot.nodes[1].node.coordinates2d = polygon([[p.x - w * 0.2, p.y - h], [p.x, p.y - h * 1.45], [p.x + w * 0.25, p.y - h], [p.x - w * 0.2, p.y - h]]);
        slot.nodes[1].node.fill = mixColor(object.color, C.white, 0.22);
        slot.nodes[2].node.coordinates2d = polyCircle(p.x - w * 0.28, p.y - h * 0.22, Math.max(0.42, h * 0.2), 9);
        slot.nodes[3].node.coordinates2d = polyCircle(p.x + w * 0.28, p.y - h * 0.22, Math.max(0.42, h * 0.2), 9);
        slot.nodes[2].node.fill = C.ink;
        slot.nodes[3].node.fill = C.ink;
    }

    renderPerson(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const s = 100 / viewHeight(pv.camera.viewW);
        const bob = Math.sin(this.time * object.speed + object.phase) * 1.2 * s;
        const leg = Math.sin(this.time * object.speed * 1.6 + object.phase) * 3.5 * s;
        slot.nodes[0].node.coordinates2d = polygon([
            [p.x - 3.8 * s, p.y + 3.1 * s],
            [p.x, p.y + 2.35 * s],
            [p.x + 3.8 * s, p.y + 3.1 * s],
            [p.x, p.y + 3.85 * s],
            [p.x - 3.8 * s, p.y + 3.1 * s]
        ]);
        slot.nodes[0].node.fill = [24, 31, 36, 95];
        slot.nodes[1].node.coordinates2d = polyCircle(p.x, p.y - 14 * s + bob, Math.max(0.45, 3.1 * s), 9);
        slot.nodes[1].node.fill = object.skin;
        slot.nodes[2].node.coordinates2d = polygon([[p.x - 3.7 * s, p.y - 11 * s + bob], [p.x + 3.7 * s, p.y - 11 * s + bob], [p.x + 2.6 * s, p.y - 3.5 * s], [p.x - 2.6 * s, p.y - 3.5 * s], [p.x - 3.7 * s, p.y - 11 * s + bob]]);
        slot.nodes[2].node.fill = object.coat;
        slot.nodes[3].node.coordinates2d = thickLine(p.x - 1.5 * s, p.y - 3.8 * s, p.x - 2.2 * s + leg, p.y + 3 * s, Math.max(0.35, 1.3 * s));
        slot.nodes[4].node.coordinates2d = thickLine(p.x + 1.5 * s, p.y - 3.8 * s, p.x + 2.2 * s - leg, p.y + 3 * s, Math.max(0.35, 1.3 * s));
        slot.nodes[3].node.fill = C.ink;
        slot.nodes[4].node.fill = C.ink;
        slot.nodes[5].node.coordinates2d = thickLine(p.x - 3 * s, p.y - 9 * s, p.x - 5 * s - leg * 0.5, p.y - 3 * s, Math.max(0.3, 1.1 * s));
        slot.nodes[6].node.coordinates2d = thickLine(p.x + 3 * s, p.y - 9 * s, p.x + 5 * s + leg * 0.5, p.y - 3 * s, Math.max(0.3, 1.1 * s));
        slot.nodes[5].node.fill = object.skin;
        slot.nodes[6].node.fill = object.skin;
        slot.nodes[7].node.coordinates2d = object.role === 'porter'
            ? safeRect(p.x + 3 * s, p.y - 7 * s, 4 * s, 4 * s)
            : object.role === 'cyclist' ? polyCircle(p.x + 5 * s, p.y - 1 * s, Math.max(0.5, 3.5 * s), 10) : ShapeUtils.rectangle(0, 0, 0, 0);
        slot.nodes[7].node.fill = object.role === 'porter' ? C.sleeper : C.rail;
    }

    renderAnimal(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const s = 100 / viewHeight(pv.camera.viewW);
        const bodyColor = object.type === 'deer' ? C.sleeper : object.type === 'goat' ? [190, 181, 157, 255] : C.white;
        const w = 10 * s;
        const h = 6 * s;
        slot.nodes[0].node.coordinates2d = polyCircle(p.x, p.y - h, Math.max(0.65, w * 0.48), 9);
        slot.nodes[0].node.fill = bodyColor;
        slot.nodes[1].node.coordinates2d = polyCircle(p.x + object.dir * w * 0.52, p.y - h * 1.28, Math.max(0.45, h * 0.45), 8);
        slot.nodes[1].node.fill = bodyColor;
        slot.nodes[2].node.coordinates2d = thickLine(p.x - w * 0.22, p.y - h * 0.7, p.x - w * 0.28, p.y, Math.max(0.3, 1.2 * s));
        slot.nodes[3].node.coordinates2d = thickLine(p.x + w * 0.22, p.y - h * 0.7, p.x + w * 0.28, p.y, Math.max(0.3, 1.2 * s));
        slot.nodes[2].node.fill = C.ink;
        slot.nodes[3].node.fill = C.ink;
        slot.nodes[4].node.coordinates2d = object.type === 'deer' || object.type === 'goat'
            ? polygon([[p.x + object.dir * w * 0.4, p.y - h * 1.65], [p.x + object.dir * w * 0.62, p.y - h * 2], [p.x + object.dir * w * 0.65, p.y - h * 1.55], [p.x + object.dir * w * 0.4, p.y - h * 1.65]])
            : ShapeUtils.rectangle(0, 0, 0, 0);
        slot.nodes[4].node.fill = C.sleeper;
    }

    renderBird(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const wing = 1.2 + Math.sin(this.time * 8 + object.phase) * 0.8;
        slot.nodes[0].node.coordinates2d = thickLine(p.x, p.y, p.x - 2.3, p.y - wing, 0.45);
        slot.nodes[1].node.coordinates2d = thickLine(p.x, p.y, p.x + 2.3, p.y - wing, 0.45);
        slot.nodes[0].node.fill = object.color;
        slot.nodes[1].node.fill = object.color;
    }

    renderCloud(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const s = object.size / viewHeight(pv.camera.viewW) * 100;
        const color = [242, 242, 231, Math.round(210 - pv.nightAmount * 55)];
        slot.nodes[0].node.coordinates2d = polyCircle(p.x - s * 0.25, p.y, s * 0.32, 10);
        slot.nodes[1].node.coordinates2d = polyCircle(p.x, p.y - s * 0.15, s * 0.42, 10);
        slot.nodes[2].node.coordinates2d = polyCircle(p.x + s * 0.3, p.y, s * 0.3, 10);
        slot.nodes[0].node.fill = color;
        slot.nodes[1].node.fill = color;
        slot.nodes[2].node.fill = color;
    }

    renderAircraft(pv, slot, object) {
        const p = worldToScreen(pv.camera, object.x, object.y);
        const s = 100 / viewHeight(pv.camera.viewW);
        const d = object.dir;
        slot.nodes[0].node.coordinates2d = thickLine(p.x - d * 10 * s, p.y, p.x + d * 10 * s, p.y, Math.max(0.4, 2.5 * s));
        slot.nodes[0].node.fill = object.color;
        slot.nodes[1].node.coordinates2d = polygon([[p.x - 2 * s, p.y], [p.x - 7 * s, p.y - 7 * s], [p.x + 2 * s, p.y], [p.x - 2 * s, p.y]]);
        slot.nodes[2].node.coordinates2d = polygon([[p.x - 2 * s, p.y], [p.x - 7 * s, p.y + 7 * s], [p.x + 2 * s, p.y], [p.x - 2 * s, p.y]]);
        slot.nodes[1].node.fill = mixColor(object.color, C.white, 0.35);
        slot.nodes[2].node.fill = mixColor(object.color, C.white, 0.35);
        slot.nodes[3].node.coordinates2d = thickLine(p.x - d * 7 * s, p.y, p.x - d * 10 * s, p.y - 4 * s, Math.max(0.3, 1.5 * s));
        slot.nodes[3].node.fill = object.color;
        slot.nodes[4].node.coordinates2d = polyCircle(p.x + d * 10 * s, p.y, Math.max(0.35, 1.5 * s), 8);
        slot.nodes[4].node.fill = C.ink;
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

    renderEvent(pv, slot, object) {
        for (const node of slot.nodes) {
            node.node.border = 0;
            node.node.color = C.white;
        }
        const p = worldToScreen(pv.camera, object.x, object.y);
        const t = clamp(object.age / object.life, 0, 1);
        const alpha = Math.round(255 * (1 - t));
        const color = [object.color[0], object.color[1], object.color[2], alpha];
        if (object.type === 'steam') {
            const r = 1 + t * 4;
            slot.nodes[0].node.coordinates2d = polyCircle(p.x - t * 2, p.y - t * 7, r, 10);
            slot.nodes[1].node.coordinates2d = polyCircle(p.x + 2 + t, p.y - 2 - t * 6, r * 0.72, 9);
            slot.nodes[2].node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        } else if (object.type === 'whistle') {
            const r = 2 + t * 12;
            slot.nodes[0].node.coordinates2d = polyCircle(p.x, p.y, r, 18);
            slot.nodes[0].node.fill = C.transparent;
            slot.nodes[0].node.color = color;
            slot.nodes[0].node.border = 2;
            slot.nodes[1].node.coordinates2d = polyCircle(p.x, p.y, r * 0.65, 18);
            slot.nodes[1].node.fill = C.transparent;
            slot.nodes[1].node.color = color;
            slot.nodes[1].node.border = 2;
            slot.nodes[2].node.coordinates2d = star(p.x, p.y, 2.6 * (1 - t * 0.5), 1.1, 5);
            slot.nodes[2].node.fill = color;
        } else if (object.type === 'splash') {
            slot.nodes[0].node.coordinates2d = polyCircle(p.x, p.y, 2 + t * 8, 18);
            slot.nodes[0].node.fill = C.transparent;
            slot.nodes[0].node.color = color;
            slot.nodes[0].node.border = 2;
            slot.nodes[1].node.coordinates2d = thickLine(p.x - 3, p.y, p.x - 1, p.y - 6 * (1 - t), 0.7);
            slot.nodes[2].node.coordinates2d = thickLine(p.x + 3, p.y, p.x + 1, p.y - 7 * (1 - t), 0.7);
            slot.nodes[1].node.fill = color;
            slot.nodes[2].node.fill = color;
        } else if (object.type === 'festival') {
            slot.nodes[0].node.coordinates2d = star(p.x - 8 + t * 3, p.y - 8 - t * 11, 2.6, 1.0, 5);
            slot.nodes[1].node.coordinates2d = star(p.x + 7 - t * 2, p.y - 5 - t * 14, 2.2, 0.9, 5);
            slot.nodes[2].node.coordinates2d = star(p.x, p.y - 11 - t * 17, 3, 1.2, 6);
        } else if (object.type === 'flowers') {
            slot.nodes[0].node.coordinates2d = star(p.x - 4, p.y - t * 2, 1.8, 0.65, 5);
            slot.nodes[1].node.coordinates2d = star(p.x + 4, p.y - 1 - t * 2, 1.6, 0.6, 5);
            slot.nodes[2].node.coordinates2d = star(p.x, p.y - 3 - t * 3, 2.0, 0.7, 5);
        } else {
            slot.nodes[0].node.coordinates2d = star(p.x, p.y, 2 + t * 7, 0.8 + t * 2, 8);
            slot.nodes[1].node.coordinates2d = star(p.x - 7, p.y + 2, 1.8 + t * 3, 0.7, 5);
            slot.nodes[2].node.coordinates2d = star(p.x + 7, p.y - 1, 1.8 + t * 3, 0.7, 5);
        }
        for (const node of slot.nodes) {
            if (object.type !== 'whistle' && object.type !== 'splash') node.node.fill = color;
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

module.exports = RailwayReverie;
