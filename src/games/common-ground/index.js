'use strict';

// SPDX-License-Identifier: MIT

const { ViewableGame, GameNode, Shapes, ShapeUtils } = require('squish-150');

const WORLD_SIZE = 1200;
const GRID_SIZE = 44;
const TILE_SIZE = 24;
const GRID_ORIGIN = (WORLD_SIZE - GRID_SIZE * TILE_SIZE) / 2;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const MAX_PLAYERS = 4;

const NORMAL_VIEW_W = 216;
const MIN_VIEW_W = 156;
const MAX_VIEW_W = 280;
const TILE_POOL_SIZE = 156;
const TILE_PARTS = 5;
const AGENT_POOL_SIZE = 20;
const AGENT_PARTS = 5;
const TWO_PLAYER_RENDER_INTERVAL = 0.1;
const MANY_PLAYER_RENDER_INTERVAL = 0.125;
const CONSTRUCTION_RENDER_INTERVAL = 0.5;
const MAX_LOGICAL_AGENTS = 70;

const TOOL_ORDER = ['inspect', 'road', 'res', 'com', 'ind', 'park', 'bulldoze'];
const TOOL_COSTS = {
    inspect: 0,
    road: 30,
    bridge: 150,
    res: 20,
    com: 25,
    ind: 30,
    park: 80,
    bulldoze: 15
};

const C = {
    transparent: [0, 0, 0, 0],
    white: [247, 245, 232, 255],
    cream: [239, 226, 191, 255],
    ink: [27, 34, 43, 255],
    mutedInk: [58, 69, 78, 255],
    panel: [25, 31, 39, 230],
    panelSoft: [36, 45, 56, 214],
    panelLine: [242, 237, 218, 225],
    grassA: [103, 157, 84, 255],
    grassB: [114, 167, 91, 255],
    grassLocked: [78, 105, 79, 255],
    soil: [136, 100, 67, 255],
    water: [59, 143, 185, 255],
    waterLight: [133, 211, 221, 255],
    road: [68, 72, 78, 255],
    roadEdge: [105, 106, 105, 255],
    lane: [237, 205, 100, 255],
    residential: [82, 174, 106, 255],
    commercial: [75, 132, 206, 255],
    industrial: [220, 167, 67, 255],
    park: [62, 145, 77, 255],
    parkLight: [111, 179, 83, 255],
    trunk: [104, 75, 50, 255],
    roof: [110, 75, 64, 255],
    glass: [164, 217, 225, 255],
    glassNight: [255, 220, 114, 255],
    construction: [235, 181, 74, 255],
    pollution: [117, 108, 92, 190],
    red: [212, 76, 72, 255],
    orange: [232, 132, 62, 255],
    blue: [65, 117, 187, 255],
    teal: [57, 158, 149, 255],
    purple: [126, 90, 164, 255],
    gold: [232, 180, 69, 255],
    carRed: [208, 74, 72, 255],
    carBlue: [71, 126, 190, 255],
    carGold: [225, 169, 65, 255],
    carTeal: [55, 151, 143, 255],
    shadow: [24, 29, 35, 90],
    lockedOverlay: [27, 35, 38, 105]
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function hash01(seed) {
    let x = seed | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1000000) / 1000000;
}

function safeRect(x, y, width, height) {
    const x1 = clamp(x, 0, 100);
    const y1 = clamp(y, 0, 100);
    const x2 = clamp(x + width, 0, 100);
    const y2 = clamp(y + height, 0, 100);
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
}

function polygon(points) {
    return points.map((point) => [clamp(point[0], 0, 100), clamp(point[1], 0, 100)]);
}

function polyCircle(cx, cy, radius, sides) {
    const count = sides || 12;
    const points = [];
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

function makeContainer(playerIds) {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
        fill: C.transparent,
        color: C.white,
        border: 0,
        playerIds
    });
}

function makeShape(coords, fill, options) {
    const extra = options || {};
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: coords || ShapeUtils.rectangle(0, 0, 0, 0),
        fill: fill || C.transparent,
        color: extra.color || C.white,
        border: Number.isFinite(extra.border) ? extra.border : 0,
        onClick: extra.onClick,
        playerIds: extra.playerIds
    });
}

function makeText(text, x, y, size, color, align, playerIds) {
    return new GameNode.Text({
        textInfo: {
            text,
            x,
            y,
            size,
            align: align || 'left',
            color: color || C.white,
            font: 'monospace'
        },
        playerIds
    });
}

function setText(node, patch) {
    const current = node.node.text && typeof node.node.text === 'object'
        ? node.node.text
        : {
            text: '', x: 0, y: 0, size: 2, align: 'left', color: C.white, font: 'monospace'
        };
    node.node.text = Object.assign({}, current, patch);
}

function hideNode(node) {
    node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
    node.node.fill = C.transparent;
    node.node.color = C.white;
    node.node.border = 0;
}

function hideSlot(slot) {
    if (!slot.visible) return;
    for (const node of slot.nodes) hideNode(node);
    slot.visible = false;
}

function viewHeight(viewW) {
    return viewW * 9 / 16;
}

function worldToScreen(camera, x, y) {
    const height = viewHeight(camera.viewW);
    return {
        x: ((x - (camera.x - camera.viewW / 2)) / camera.viewW) * 100,
        y: ((y - (camera.y - height / 2)) / height) * 100
    };
}

function screenToWorld(camera, x, y) {
    const height = viewHeight(camera.viewW);
    return {
        x: camera.x - camera.viewW / 2 + x / 100 * camera.viewW,
        y: camera.y - height / 2 + y / 100 * height
    };
}

function formatMoney(value) {
    const amount = Math.max(0, Math.floor(value));
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(amount >= 10000000 ? 0 : 1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}K`;
    return `$${amount}`;
}

class CommonGround extends ViewableGame {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Common Ground',
            author: "Joseph Garcia",
            description: 'A calm shared city builder where players independently explore one living city, place roads and zones, and watch buildings, traffic, population, and revenue grow over time.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30,
            maxPlayers: 4,
            gameId: "cb6f1527-ca3a-5375-a6db-a8ab7aad2b34"
        };
    }

    constructor() {
        super(WORLD_SIZE);
        this.time = 0;
        this.nextId = 1;
        this.players = {};
        this.treasury = 4200;
        this.taxTimer = 5;
        this.metricsTimer = 0;
        this.agentSyncTimer = 0;
        this.viewRenderTimer = 0;
        this.constructionRenderTimer = 0;
        this.worldRevision = 1;
        this.roadRevision = 1;
        this.pathCache = {};
        this.expansionLevel = 0;
        this.metrics = {
            population: 0,
            jobs: 0,
            filledJobs: 0,
            revenuePerSecond: 0,
            happiness: 0.55,
            residentialCapacity: 0,
            commercialCapacity: 0,
            industrialCapacity: 0
        };
        this.demand = { res: 0.7, com: 0.5, ind: 0.45 };
        this.tiles = [];
        this.tilesByKey = {};
        this.agents = [];
        this.initializeGrid();
        this.seedStarterTown();
        this.updateMetrics(true);
        this.syncAgents(true);
    }

    getLayers() {
        return [{ root: this.getViewRoot() }];
    }

    initializeGrid() {
        for (let row = 0; row < GRID_SIZE; row += 1) {
            const riverCenter = 29 + Math.sin(row * 0.47) * 1.25 + Math.sin(row * 0.17) * 0.7;
            for (let col = 0; col < GRID_SIZE; col += 1) {
                const x = GRID_ORIGIN + col * TILE_SIZE + TILE_SIZE / 2;
                const y = GRID_ORIGIN + row * TILE_SIZE + TILE_SIZE / 2;
                const water = Math.abs(col - riverCenter) < 1.25;
                const tile = {
                    id: `tile-${row}-${col}`,
                    row,
                    col,
                    x,
                    y,
                    terrain: water ? 'water' : 'land',
                    road: false,
                    zone: null,
                    special: null,
                    stage: 0,
                    progress: 0,
                    occupancy: 0,
                    landValue: 0.5,
                    pollution: 0,
                    seed: row * 97 + col * 193
                };
                this.tiles.push(tile);
                this.tilesByKey[this.tileKey(col, row)] = tile;
            }
        }
    }

    seedStarterTown() {
        for (let col = 12; col <= 33; col += 1) this.seedRoad(col, 22);
        for (let row = 14; row <= 31; row += 1) this.seedRoad(20, row);
        for (let col = 16; col <= 27; col += 1) this.seedRoad(col, 18);
        for (let row = 18; row <= 27; row += 1) this.seedRoad(25, row);
        for (let col = 20; col <= 26; col += 1) this.seedRoad(col, 27);

        const zones = [
            [15, 21, 'res', 1], [16, 21, 'res', 1], [17, 21, 'res', 2],
            [15, 23, 'res', 1], [16, 23, 'res', 1], [18, 23, 'res', 1],
            [18, 17, 'res', 1], [19, 17, 'res', 1],
            [21, 21, 'com', 1], [22, 21, 'com', 1], [23, 21, 'com', 1],
            [21, 23, 'com', 1], [22, 23, 'com', 1],
            [26, 19, 'ind', 1], [27, 19, 'ind', 1], [26, 20, 'ind', 1],
            [17, 24, 'park', 1], [24, 17, 'park', 1], [23, 26, 'park', 1]
        ];
        for (const [col, row, zone, stage] of zones) this.seedZone(col, row, zone, stage);

        const hall = this.getTile(21, 20);
        if (hall && hall.terrain === 'land' && !hall.road) {
            hall.special = 'cityHall';
            hall.stage = 2;
        }
    }

    seedRoad(col, row) {
        const tile = this.getTile(col, row);
        if (!tile) return;
        tile.road = true;
        tile.zone = null;
        tile.stage = 0;
    }

    seedZone(col, row, zone, stage) {
        const tile = this.getTile(col, row);
        if (!tile || tile.terrain !== 'land' || tile.road) return;
        tile.zone = zone;
        tile.stage = stage;
        tile.progress = hash01(tile.seed) * 0.35;
        if (zone === 'res') tile.occupancy = this.capacityFor(tile) * 0.75;
        if (zone === 'com' || zone === 'ind') tile.occupancy = this.capacityFor(tile) * 0.55;
    }

    tileKey(col, row) {
        return `${col},${row}`;
    }

    getTile(col, row) {
        return this.tilesByKey[this.tileKey(col, row)] || null;
    }

    tileFromWorld(x, y) {
        const col = Math.floor((x - GRID_ORIGIN) / TILE_SIZE);
        const row = Math.floor((y - GRID_ORIGIN) / TILE_SIZE);
        return this.getTile(col, row);
    }

    getNeighbors(tile) {
        return [
            this.getTile(tile.col - 1, tile.row),
            this.getTile(tile.col + 1, tile.row),
            this.getTile(tile.col, tile.row - 1),
            this.getTile(tile.col, tile.row + 1)
        ].filter(Boolean);
    }

    hasRoadAccess(tile) {
        return this.getNeighbors(tile).some((neighbor) => neighbor.road);
    }

    adjacentRoad(tile) {
        return this.getNeighbors(tile).find((neighbor) => neighbor.road) || null;
    }

    unlockBounds(level) {
        const tiers = [
            { c1: 12, c2: 33, r1: 13, r2: 31 },
            { c1: 8, c2: 37, r1: 9, r2: 35 },
            { c1: 4, c2: 41, r1: 5, r2: 39 },
            { c1: 0, c2: 43, r1: 0, r2: 43 }
        ];
        return tiers[clamp(level, 0, tiers.length - 1)];
    }

    isUnlocked(tile) {
        const bounds = this.unlockBounds(this.expansionLevel);
        return tile.col >= bounds.c1 && tile.col <= bounds.c2 && tile.row >= bounds.r1 && tile.row <= bounds.r2;
    }

    capacityFor(tile) {
        const stage = clamp(tile.stage, 0, 3);
        if (tile.zone === 'res') return [0, 4, 11, 28][stage];
        if (tile.zone === 'com') return [0, 5, 14, 34][stage];
        if (tile.zone === 'ind') return [0, 7, 20, 46][stage];
        return 0;
    }

    zoneColor(zone) {
        if (zone === 'res') return C.residential;
        if (zone === 'com') return C.commercial;
        if (zone === 'ind') return C.industrial;
        return C.park;
    }

    createPlayerView(playerId) {
        const root = makeContainer([playerId]);
        const worldClick = (pid, x, y) => this.handleWorldClick(pid, x, y);
        const background = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), C.grassLocked, { onClick: worldClick });
        const tileLayer = makeContainer();
        const agentLayer = makeContainer();
        const selectionNode = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), C.transparent, { color: C.white, border: 4, onClick: worldClick });
        const hudLayer = makeContainer();
        const privacyAnchor = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), C.transparent, { playerIds: [playerId] });

        root.addChild(background);
        root.addChild(tileLayer);
        root.addChild(agentLayer);
        root.addChild(selectionNode);
        root.addChild(hudLayer);
        root.addChild(privacyAnchor);

        const tilePool = { slots: [], byObject: {} };
        for (let i = 0; i < TILE_POOL_SIZE; i += 1) {
            const slot = { objectId: null, visible: false, nodes: [] };
            for (let n = 0; n < TILE_PARTS; n += 1) {
                const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), C.transparent, { onClick: worldClick });
                slot.nodes.push(node);
                tileLayer.addChild(node);
            }
            tilePool.slots.push(slot);
        }

        const agentPool = { slots: [], byObject: {} };
        for (let i = 0; i < AGENT_POOL_SIZE; i += 1) {
            const slot = { objectId: null, visible: false, nodes: [] };
            for (let n = 0; n < AGENT_PARTS; n += 1) {
                const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), C.transparent, { onClick: worldClick });
                slot.nodes.push(node);
                agentLayer.addChild(node);
            }
            agentPool.slots.push(slot);
        }

        const topPanel = makeShape(safeRect(1.5, 1.5, 38, 8.5), C.panel, { color: C.panelLine, border: 2 });
        const moneyText = makeText(formatMoney(this.treasury), 3.5, 3.9, 1.5, C.white, 'left');
        const populationText = makeText('POP 0', 16.5, 4.1, 1.15, C.white, 'left');
        const incomeText = makeText('+$0/s', 28, 4.1, 1.1, C.cream, 'left');
        hudLayer.addChild(topPanel);
        hudLayer.addChild(moneyText);
        hudLayer.addChild(populationText);
        hudLayer.addChild(incomeText);

        const demandPanel = makeShape(safeRect(75.5, 1.5, 23, 8.5), C.panel, { color: C.panelLine, border: 2 });
        hudLayer.addChild(demandPanel);
        const demandBars = [];
        const demandLabels = ['HOMES', 'SHOPS', 'JOBS'];
        const demandColors = [C.residential, C.commercial, C.industrial];
        for (let i = 0; i < 3; i += 1) {
            const base = makeShape(safeRect(85, 3 + i * 2.05, 11, 1.15), C.mutedInk);
            const fill = makeShape(safeRect(85, 3 + i * 2.05, 5, 1.15), demandColors[i]);
            hudLayer.addChild(makeText(demandLabels[i], 77, 2.6 + i * 2.05, 0.72, demandColors[i]));
            hudLayer.addChild(base);
            hudLayer.addChild(fill);
            demandBars.push(fill);
        }

        const statusPanel = makeShape(safeRect(28, 80.5, 44, 5.2), C.panelSoft, { color: C.panelLine, border: 1 });
        const statusText = makeText('TAP TO BUILD ROAD  $30', 50, 81.9, 1.05, C.white, 'center');
        hudLayer.addChild(statusPanel);
        hudLayer.addChild(statusText);

        const toolbar = makeShape(safeRect(1.5, 87, 70, 11.5), C.panel, { color: C.panelLine, border: 2 });
        hudLayer.addChild(toolbar);
        const toolButtons = {};
        TOOL_ORDER.forEach((tool, index) => {
            const x = 3 + index * 9.55;
            const handler = () => this.selectTool(playerId, tool);
            const button = makeShape(safeRect(x, 88.2, 8.1, 8.8), C.panelSoft, { color: C.panelLine, border: 1, onClick: handler });
            const icons = this.createToolIcon(tool, x + 4.05, 92.6, handler);
            hudLayer.addChild(button);
            for (const icon of icons) hudLayer.addChild(icon);
            toolButtons[tool] = { button, icons };
        });

        const cameraControls = this.createCameraControls(playerId);
        for (const node of cameraControls.nodes) hudLayer.addChild(node);

        const pv = {
            playerId,
            root,
            background,
            tileLayer,
            agentLayer,
            selectionNode,
            hudLayer,
            tilePool,
            agentPool,
            camera: {
                x: GRID_ORIGIN + 22 * TILE_SIZE,
                y: GRID_ORIGIN + 22 * TILE_SIZE,
                targetX: GRID_ORIGIN + 22 * TILE_SIZE,
                targetY: GRID_ORIGIN + 22 * TILE_SIZE,
                viewW: NORMAL_VIEW_W,
                targetViewW: NORMAL_VIEW_W
            },
            keys: {},
            tool: 'road',
            selectedTileId: null,
            status: this.defaultToolStatus('road'),
            statusTimer: 0,
            hudDirty: false,
            lastWorldRevision: -1,
            lastCameraX: NaN,
            lastCameraY: NaN,
            lastViewW: NaN,
            hud: {
                moneyText,
                populationText,
                incomeText,
                demandBars,
                statusText,
                statusPanel,
                toolButtons,
                cameraControls
            }
        };

        this.players[playerId] = pv;
        this.getViewRoot().addChild(root);
        this.updatePlayerView(pv, true);
        return pv;
    }

    createToolIcon(tool, cx, cy, handler) {
        const nodes = [];
        if (tool === 'inspect') {
            nodes.push(makeShape(polyCircle(cx - 0.7, cy - 0.5, 1.8, 12), C.transparent, { color: C.cream, border: 4, onClick: handler }));
            nodes.push(makeShape(thickLine(cx + 0.5, cy + 0.7, cx + 2.2, cy + 2.4, 0.65), C.cream, { onClick: handler }));
        } else if (tool === 'road') {
            nodes.push(makeShape(thickLine(cx - 2.6, cy + 1.7, cx + 2.6, cy - 1.7, 2.3), C.road, { color: C.cream, border: 2, onClick: handler }));
            nodes.push(makeShape(thickLine(cx - 2.2, cy + 1.4, cx + 2.2, cy - 1.4, 0.35), C.lane, { onClick: handler }));
        } else if (tool === 'res') {
            nodes.push(makeShape(polygon([[cx - 2.7, cy], [cx, cy - 2.7], [cx + 2.7, cy], [cx + 2.3, cy], [cx + 2.3, cy + 2.6], [cx - 2.3, cy + 2.6], [cx - 2.3, cy], [cx - 2.7, cy]]), C.residential, { color: C.cream, border: 2, onClick: handler }));
        } else if (tool === 'com') {
            nodes.push(makeShape(safeRect(cx - 2.6, cy - 1.8, 5.2, 4.5), C.commercial, { color: C.cream, border: 2, onClick: handler }));
            nodes.push(makeShape(polygon([[cx - 3, cy - 1.8], [cx + 3, cy - 1.8], [cx + 2.4, cy - 0.5], [cx - 2.4, cy - 0.5], [cx - 3, cy - 1.8]]), C.cream, { onClick: handler }));
        } else if (tool === 'ind') {
            nodes.push(makeShape(polygon([[cx - 2.8, cy + 2.5], [cx - 2.8, cy - 1.2], [cx - 1.1, cy - 2.5], [cx - 1.1, cy - 1.1], [cx + 0.6, cy - 2.5], [cx + 0.6, cy - 1.1], [cx + 2.8, cy - 2.5], [cx + 2.8, cy + 2.5], [cx - 2.8, cy + 2.5]]), C.industrial, { color: C.cream, border: 2, onClick: handler }));
        } else if (tool === 'park') {
            nodes.push(makeShape(safeRect(cx - 0.45, cy + 0.5, 0.9, 2.6), C.trunk, { onClick: handler }));
            nodes.push(makeShape(polyCircle(cx, cy - 0.7, 2.5, 10), C.parkLight, { color: C.cream, border: 2, onClick: handler }));
        } else if (tool === 'bulldoze') {
            nodes.push(makeShape(thickLine(cx - 2.2, cy - 2.2, cx + 2.2, cy + 2.2, 1.1), C.red, { onClick: handler }));
            nodes.push(makeShape(thickLine(cx + 2.2, cy - 2.2, cx - 2.2, cy + 2.2, 1.1), C.red, { onClick: handler }));
        }
        return nodes;
    }

    createCameraControls(playerId) {
        const nodes = [];
        const addButton = (coords, iconCoords, action) => {
            const handler = () => action();
            const button = makeShape(coords, C.panel, { color: C.panelLine, border: 2, onClick: handler });
            const icon = makeShape(iconCoords, C.cream, { onClick: handler });
            nodes.push(button, icon);
        };
        addButton(safeRect(0.6, 42, 5.4, 16), polygon([[4.6, 45], [2.1, 50], [4.6, 55], [4.6, 45]]), () => this.nudgeCamera(playerId, -1, 0));
        addButton(safeRect(94, 42, 5.4, 16), polygon([[95.4, 45], [97.9, 50], [95.4, 55], [95.4, 45]]), () => this.nudgeCamera(playerId, 1, 0));
        addButton(safeRect(47.3, 1.2, 5.4, 5.6), polygon([[48.5, 5.5], [50, 2.7], [51.5, 5.5], [48.5, 5.5]]), () => this.nudgeCamera(playerId, 0, -1));
        addButton(safeRect(47.3, 73.5, 5.4, 5.6), polygon([[48.5, 75.1], [50, 77.9], [51.5, 75.1], [48.5, 75.1]]), () => this.nudgeCamera(playerId, 0, 1));
        addButton(safeRect(73.5, 88.2, 7.2, 8.8), thickLine(75.2, 92.6, 79, 92.6, 0.7), () => this.zoomCamera(playerId, 1));
        addButton(safeRect(82, 88.2, 7.2, 8.8), [
            [84, 92.2], [85.6, 90.6], [87.2, 92.2], [87.2, 94.4], [84, 94.4], [84, 92.2]
        ], () => this.homeCamera(playerId));
        addButton(safeRect(90.5, 88.2, 7.2, 8.8), polygon([[92.2, 92.2], [94.1, 92.2], [94.1, 90.3], [94.9, 90.3], [94.9, 92.2], [96.8, 92.2], [96.8, 93], [94.9, 93], [94.9, 94.9], [94.1, 94.9], [94.1, 93], [92.2, 93], [92.2, 92.2]]), () => this.zoomCamera(playerId, -1));
        return { nodes };
    }

    handleNewPlayer({ playerId }) {
        const id = Number(playerId);
        if (!Number.isFinite(id) || this.players[id]) return;
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
        pv.keys[key] = true;
        const lower = typeof key === 'string' ? key.toLowerCase() : key;
        const toolKeys = { '1': 'inspect', '2': 'road', '3': 'res', '4': 'com', '5': 'ind', '6': 'park', '7': 'bulldoze' };
        if (toolKeys[key]) this.selectTool(playerId, toolKeys[key]);
        if (lower === 'q' || key === '-') this.zoomCamera(playerId, 1);
        if (lower === 'e' || key === '+') this.zoomCamera(playerId, -1);
        if (lower === 'h' || key === 'Home' || key === '0') this.homeCamera(playerId);
    }

    handleKeyUp(playerId, key) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        delete pv.keys[key];
    }

    selectTool(playerId, tool) {
        const pv = this.players[Number(playerId)];
        if (!pv || !TOOL_ORDER.includes(tool)) return;
        pv.tool = tool;
        pv.status = this.defaultToolStatus(tool);
        pv.statusTimer = 0;
        this.updateHud(pv);
        this.getViewRoot().node.onStateChange();
    }

    defaultToolStatus(tool) {
        if (tool === 'inspect') return 'TAP A BUILDING TO INSPECT';
        if (tool === 'road') return 'TAP TO BUILD ROAD  $30';
        if (tool === 'res') return 'HOMES  $20  |  PLACE BESIDE A ROAD';
        if (tool === 'com') return 'SHOPS  $25  |  PLACE BESIDE A ROAD';
        if (tool === 'ind') return 'JOBS  $30  |  PLACE BESIDE A ROAD';
        if (tool === 'park') return 'TAP TO PLANT A PARK  $80';
        return 'TAP TO REMOVE  $15';
    }

    setStatus(pv, text, seconds) {
        pv.status = text;
        pv.statusTimer = seconds || 1.8;
    }

    nudgeCamera(playerId, dx, dy) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        pv.camera.targetX += dx * pv.camera.targetViewW * 0.55;
        pv.camera.targetY += dy * viewHeight(pv.camera.targetViewW) * 0.55;
        this.clampCamera(pv.camera);
    }

    zoomCamera(playerId, direction) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        const scale = direction > 0 ? 1.22 : 1 / 1.22;
        pv.camera.targetViewW = clamp(pv.camera.targetViewW * scale, MIN_VIEW_W, MAX_VIEW_W);
        this.clampCamera(pv.camera);
    }

    homeCamera(playerId) {
        const pv = this.players[Number(playerId)];
        if (!pv) return;
        pv.camera.targetX = GRID_ORIGIN + 22 * TILE_SIZE;
        pv.camera.targetY = GRID_ORIGIN + 22 * TILE_SIZE;
        pv.camera.targetViewW = NORMAL_VIEW_W;
        this.clampCamera(pv.camera);
    }

    clampCamera(camera) {
        const h = viewHeight(camera.targetViewW);
        camera.targetX = clamp(camera.targetX, camera.targetViewW / 2, WORLD_SIZE - camera.targetViewW / 2);
        camera.targetY = clamp(camera.targetY, h / 2, WORLD_SIZE - h / 2);
    }

    handleWorldClick(playerId, screenX, screenY) {
        const pv = this.players[Number(playerId)];
        if (!pv || screenY >= 80) return;
        const point = screenToWorld(pv.camera, screenX, screenY);
        const tile = this.tileFromWorld(point.x, point.y);
        if (!tile) {
            this.setStatus(pv, 'OUTSIDE CITY MAP', 1.8);
            this.updateHud(pv);
            this.getViewRoot().node.onStateChange();
            return;
        }
        pv.selectedTileId = tile.id;
        if (pv.tool === 'inspect') {
            this.inspectTile(pv, tile);
            this.updatePlayerView(pv, true);
            this.getViewRoot().node.onStateChange();
            return;
        }
        const result = this.applyTool(pv, tile);
        this.setStatus(pv, result.message, 2.1);
        if (result.changed) {
            this.worldRevision += 1;
            this.updateMetrics(true);
            for (const view of Object.values(this.players)) this.updatePlayerView(view, true);
        } else {
            this.updatePlayerView(pv, true);
        }
        this.getViewRoot().node.onStateChange();
    }

    inspectTile(pv, tile) {
        if (!this.isUnlocked(tile)) {
            this.setStatus(pv, 'LOCKED LAND', 2.2);
            return;
        }
        if (tile.road) {
            this.setStatus(pv, tile.terrain === 'water' ? 'BRIDGE' : 'ROAD', 2.2);
            return;
        }
        if (tile.special === 'cityHall') {
            this.setStatus(pv, 'CITY HALL', 2.2);
            return;
        }
        if (tile.zone) {
            const type = tile.zone === 'res' ? 'HOME' : tile.zone === 'com' ? 'BUSINESS' : tile.zone === 'ind' ? 'INDUSTRY' : 'PARK';
            const suffix = tile.zone === 'park' ? '' : `  L${tile.stage}  ${Math.round(tile.occupancy)}`;
            this.setStatus(pv, `${type}${suffix}`, 2.4);
            return;
        }
        this.setStatus(pv, tile.terrain === 'water' ? 'RIVER' : `LAND VALUE ${Math.round(tile.landValue * 100)}`, 2.4);
    }

    applyTool(pv, tile) {
        const tool = pv.tool;
        if (!this.isUnlocked(tile)) return { changed: false, message: 'LOCKED — GROW POPULATION' };
        if (tool === 'road') {
            if (tile.road) return { changed: false, message: 'ROAD ALREADY HERE' };
            if (tile.special || tile.zone) return { changed: false, message: 'BULLDOZE FIRST' };
            const cost = tile.terrain === 'water' ? TOOL_COSTS.bridge : TOOL_COSTS.road;
            if (!this.spend(cost)) return { changed: false, message: `NEED ${formatMoney(cost)}` };
            tile.road = true;
            this.roadRevision += 1;
            this.pathCache = {};
            return { changed: true, message: tile.terrain === 'water' ? 'BRIDGE BUILT' : 'ROAD BUILT' };
        }
        if (tool === 'res' || tool === 'com' || tool === 'ind' || tool === 'park') {
            if (tile.terrain === 'water') return { changed: false, message: 'CANNOT ZONE WATER' };
            if (tile.road || tile.special || tile.zone) return { changed: false, message: 'PARCEL OCCUPIED' };
            const cost = TOOL_COSTS[tool];
            if (!this.spend(cost)) return { changed: false, message: `NEED ${formatMoney(cost)}` };
            tile.zone = tool;
            tile.stage = tool === 'park' ? 1 : 0;
            tile.progress = 0;
            tile.occupancy = 0;
            return { changed: true, message: tool === 'park' ? 'PARK PLANTED' : `${tool.toUpperCase()} ZONED` };
        }
        if (tool === 'bulldoze') {
            if (tile.special === 'cityHall') return { changed: false, message: 'CITY HALL IS PROTECTED' };
            if (!tile.road && !tile.zone) return { changed: false, message: 'NOTHING TO REMOVE' };
            if (!this.spend(TOOL_COSTS.bulldoze)) return { changed: false, message: 'NEED $15' };
            if (tile.road) {
                tile.road = false;
                this.roadRevision += 1;
                this.pathCache = {};
            }
            tile.zone = null;
            tile.stage = 0;
            tile.progress = 0;
            tile.occupancy = 0;
            return { changed: true, message: 'CLEARED' };
        }
        return { changed: false, message: 'SELECT A TOOL' };
    }

    spend(cost) {
        if (this.treasury < cost) return false;
        this.treasury -= cost;
        return true;
    }

    updateMetrics(force) {
        let residentialCapacity = 0;
        let commercialCapacity = 0;
        let industrialCapacity = 0;
        let population = 0;
        let commercialWorkers = 0;
        let industrialWorkers = 0;
        let residentialValue = 0;
        let residentialCount = 0;

        for (const tile of this.tiles) {
            if (tile.terrain === 'water') {
                tile.landValue = 0;
                tile.pollution = 0;
                continue;
            }
            let parkBonus = 0;
            let waterBonus = 0;
            let industrialPenalty = 0;
            for (let dr = -3; dr <= 3; dr += 1) {
                for (let dc = -3; dc <= 3; dc += 1) {
                    const neighbor = this.getTile(tile.col + dc, tile.row + dr);
                    if (!neighbor) continue;
                    const distance = Math.abs(dc) + Math.abs(dr);
                    if (neighbor.zone === 'park' && distance <= 3) parkBonus += 0.025 * (4 - distance);
                    if (neighbor.terrain === 'water' && distance <= 2) waterBonus = Math.max(waterBonus, 0.14 - distance * 0.03);
                    if (neighbor.zone === 'ind' && neighbor.stage > 0 && distance <= 3) industrialPenalty += 0.02 * neighbor.stage * (4 - distance);
                }
            }
            tile.pollution = clamp(industrialPenalty, 0, 0.75);
            tile.landValue = clamp(0.38 + (this.hasRoadAccess(tile) ? 0.1 : 0) + parkBonus + waterBonus - industrialPenalty, 0.08, 1);

            const capacity = this.capacityFor(tile);
            if (tile.zone === 'res') {
                residentialCapacity += capacity;
                population += tile.occupancy;
                residentialValue += tile.landValue;
                residentialCount += 1;
            } else if (tile.zone === 'com') {
                commercialCapacity += capacity;
                commercialWorkers += tile.occupancy;
            } else if (tile.zone === 'ind') {
                industrialCapacity += capacity;
                industrialWorkers += tile.occupancy;
            }
        }

        const jobs = commercialCapacity + industrialCapacity;
        const filledJobs = commercialWorkers + industrialWorkers;
        this.metrics.residentialCapacity = residentialCapacity;
        this.metrics.commercialCapacity = commercialCapacity;
        this.metrics.industrialCapacity = industrialCapacity;
        this.metrics.population = Math.max(0, Math.round(population));
        this.metrics.jobs = Math.round(jobs);
        this.metrics.filledJobs = Math.round(filledJobs);
        this.metrics.happiness = residentialCount ? clamp(residentialValue / residentialCount, 0, 1) : 0.5;
        this.metrics.revenuePerSecond = Math.max(1, population * 0.55 + filledJobs * 0.8);

        this.demand.res = clamp(0.48 + (jobs - population * 0.78) / Math.max(80, population + 80), 0.08, 1);
        this.demand.com = clamp(0.3 + population / 130 - commercialCapacity / 210, 0.08, 1);
        this.demand.ind = clamp(0.32 + population / 180 - industrialCapacity / 250, 0.08, 1);

        const oldLevel = this.expansionLevel;
        if (population >= 280) this.expansionLevel = 3;
        else if (population >= 120) this.expansionLevel = 2;
        else if (population >= 40) this.expansionLevel = 1;
        else this.expansionLevel = 0;
        if (this.expansionLevel > oldLevel) {
            this.treasury += [0, 600, 1800, 5000][this.expansionLevel];
            for (const pv of Object.values(this.players)) this.setStatus(pv, 'CITY LIMITS EXPANDED', 4);
            this.worldRevision += 1;
        }
        if (force) this.metricsTimer = 1;
    }

    updateGrowth() {
        let stageChanged = false;
        let constructing = false;
        for (const tile of this.tiles) {
            if (!tile.zone || tile.zone === 'park') continue;
            const access = this.hasRoadAccess(tile);
            const demand = this.demand[tile.zone];
            const capacity = this.capacityFor(tile);
            const targetOccupancy = access ? capacity * clamp(0.35 + demand * 0.75 + tile.landValue * 0.2, 0, 1) : 0;
            const occupancyFollow = 1 - Math.exp(-0.13 * DT);
            tile.occupancy = lerp(tile.occupancy, targetOccupancy, occupancyFollow);

            if (!access || tile.stage >= 3 || demand < 0.14) continue;
            const durations = [8, 27, 70];
            const duration = durations[tile.stage] || 70;
            const growth = DT * demand * (0.45 + tile.landValue * 0.8) / duration;
            tile.progress += growth;
            constructing = true;
            if (tile.progress >= 1) {
                tile.progress = 0;
                tile.stage += 1;
                stageChanged = true;
            }
        }
        return { stageChanged, constructing };
    }

    syncAgents(force) {
        const target = Math.min(MAX_LOGICAL_AGENTS, Math.max(4, Math.floor(this.metrics.population / 3) + 3));
        while (this.agents.length < target) {
            const agent = this.createAgent();
            if (!agent) break;
            this.agents.push(agent);
        }
        while (this.agents.length > target) this.agents.pop();
        if (force) {
            for (const agent of this.agents) this.refreshAgentPath(agent);
        }
    }

    createAgent() {
        const homes = this.tiles.filter((tile) => tile.zone === 'res' && tile.stage > 0 && tile.occupancy > 0.5 && this.adjacentRoad(tile));
        const works = this.tiles.filter((tile) => (tile.zone === 'com' || tile.zone === 'ind') && tile.stage > 0 && tile.occupancy > 0.5 && this.adjacentRoad(tile));
        if (!homes.length || !works.length) return null;
        const id = this.nextId++;
        const home = homes[Math.floor(hash01(id * 31) * homes.length) % homes.length];
        const work = works[Math.floor(hash01(id * 47 + 9) * works.length) % works.length];
        const type = this.metrics.population > 45 && id % 9 === 0 ? 'bus' : 'car';
        const agent = {
            id: `agent-${id}`,
            homeId: home.id,
            workId: work.id,
            path: [],
            pathIndex: 0,
            pathRevision: -1,
            wait: hash01(id * 7) * 2,
            x: home.x,
            y: home.y,
            dx: 1,
            dy: 0,
            speed: type === 'bus' ? 23 : 30 + hash01(id * 61) * 8,
            type,
            color: [C.carRed, C.carBlue, C.carGold, C.carTeal, C.purple][id % 5]
        };
        this.refreshAgentPath(agent);
        return agent;
    }

    refreshAgentPath(agent) {
        const home = this.tiles.find((tile) => tile.id === agent.homeId);
        const work = this.tiles.find((tile) => tile.id === agent.workId);
        if (!home || !work) return false;
        const start = this.adjacentRoad(home);
        const end = this.adjacentRoad(work);
        if (!start || !end) return false;
        const path = this.findRoadPath(start, end);
        if (!path || path.length < 2) return false;
        agent.path = path.map((tile) => ({ id: tile.id, x: tile.x, y: tile.y }));
        agent.pathIndex = 1;
        agent.pathRevision = this.roadRevision;
        agent.x = agent.path[0].x;
        agent.y = agent.path[0].y;
        return true;
    }

    findRoadPath(start, end) {
        const key = `${this.roadRevision}:${start.id}:${end.id}`;
        if (this.pathCache[key]) return this.pathCache[key].slice();
        const queue = [start];
        const previous = {};
        previous[start.id] = null;
        let index = 0;
        while (index < queue.length) {
            const current = queue[index++];
            if (current.id === end.id) break;
            for (const neighbor of this.getNeighbors(current)) {
                if (!neighbor.road || Object.prototype.hasOwnProperty.call(previous, neighbor.id)) continue;
                previous[neighbor.id] = current.id;
                queue.push(neighbor);
            }
        }
        if (!Object.prototype.hasOwnProperty.call(previous, end.id)) return null;
        const result = [];
        let cursor = end;
        while (cursor) {
            result.push(cursor);
            const priorId = previous[cursor.id];
            cursor = priorId ? this.tiles.find((tile) => tile.id === priorId) : null;
        }
        result.reverse();
        this.pathCache[key] = result.slice();
        return result;
    }

    updateAgents() {
        let changed = false;
        for (const agent of this.agents) {
            if (agent.pathRevision !== this.roadRevision || !agent.path.length) {
                if (!this.refreshAgentPath(agent)) continue;
            }
            if (agent.wait > 0) {
                agent.wait -= DT;
                continue;
            }
            const target = agent.path[agent.pathIndex];
            if (!target) {
                agent.path.reverse();
                agent.pathIndex = 1;
                agent.wait = 1.5 + hash01(this.nextId++) * 2.5;
                continue;
            }
            const dx = target.x - agent.x;
            const dy = target.y - agent.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 0.001) {
                agent.pathIndex += 1;
                continue;
            }
            const step = Math.min(distance, agent.speed * DT);
            agent.dx = dx / distance;
            agent.dy = dy / distance;
            agent.x += agent.dx * step;
            agent.y += agent.dy * step;
            if (step >= distance - 0.001) agent.pathIndex += 1;
            changed = true;
        }
        return changed;
    }

    updateCamera(pv) {
        const pan = pv.camera.viewW * 0.5 * DT;
        let dx = 0;
        let dy = 0;
        if (pv.keys.a || pv.keys.ArrowLeft) dx -= pan;
        if (pv.keys.d || pv.keys.ArrowRight) dx += pan;
        if (pv.keys.w || pv.keys.ArrowUp) dy -= pan * 0.62;
        if (pv.keys.s || pv.keys.ArrowDown) dy += pan * 0.62;
        pv.camera.targetX += dx;
        pv.camera.targetY += dy;
        this.clampCamera(pv.camera);
        const follow = 1 - Math.exp(-10 * DT);
        const oldX = pv.camera.x;
        const oldY = pv.camera.y;
        const oldW = pv.camera.viewW;
        pv.camera.x = lerp(pv.camera.x, pv.camera.targetX, follow);
        pv.camera.y = lerp(pv.camera.y, pv.camera.targetY, follow);
        pv.camera.viewW = lerp(pv.camera.viewW, pv.camera.targetViewW, follow);
        return Math.abs(pv.camera.x - oldX) > 0.001 || Math.abs(pv.camera.y - oldY) > 0.001 || Math.abs(pv.camera.viewW - oldW) > 0.001;
    }

    tick() {
        this.time += DT;
        const growth = this.updateGrowth();
        if (growth.stageChanged) this.worldRevision += 1;
        const agentsMoved = this.updateAgents();

        let hudChanged = false;
        this.taxTimer -= DT;
        if (this.taxTimer <= 0) {
            this.taxTimer += 5;
            this.treasury += Math.max(5, Math.floor(this.metrics.revenuePerSecond * 5));
            hudChanged = true;
        }

        this.metricsTimer -= DT;
        if (this.metricsTimer <= 0) {
            this.metricsTimer += 1;
            this.updateMetrics(false);
            hudChanged = true;
        }

        this.agentSyncTimer -= DT;
        if (this.agentSyncTimer <= 0) {
            this.agentSyncTimer += 2;
            this.syncAgents(false);
        }

        this.constructionRenderTimer -= DT;
        if (growth.constructing && this.constructionRenderTimer <= 0) {
            this.constructionRenderTimer += CONSTRUCTION_RENDER_INTERVAL;
            this.worldRevision += 1;
        }

        this.viewRenderTimer -= DT;
        const renderDue = this.viewRenderTimer <= 0;
        if (renderDue) this.viewRenderTimer += this.currentViewRenderInterval();

        let sceneChanged = false;
        for (const pv of Object.values(this.players)) {
            if (hudChanged) pv.hudDirty = true;
            if (pv.statusTimer > 0) {
                pv.statusTimer -= DT;
                if (pv.statusTimer <= 0) {
                    pv.status = this.defaultToolStatus(pv.tool);
                    pv.hudDirty = true;
                }
            }

            const cameraMovedLogically = this.updateCamera(pv);
            const cameraNeedsRender = renderDue && cameraMovedLogically;
            const worldNeedsRender = pv.lastWorldRevision !== this.worldRevision;

            if (worldNeedsRender || cameraNeedsRender) {
                this.renderTiles(pv);
                this.renderSelection(pv);
                pv.lastCameraX = pv.camera.x;
                pv.lastCameraY = pv.camera.y;
                pv.lastViewW = pv.camera.viewW;
                pv.lastWorldRevision = this.worldRevision;
                sceneChanged = true;
            }

            if (renderDue && (agentsMoved || cameraMovedLogically)) {
                this.renderAgents(pv);
                sceneChanged = true;
            }

            if (pv.hudDirty) {
                this.updateHud(pv);
                pv.hudDirty = false;
                sceneChanged = true;
            }
        }

        if (sceneChanged) this.getViewRoot().node.onStateChange();
    }

    currentViewRenderInterval() {
        const playerCount = Object.keys(this.players).length;
        if (playerCount <= 1) return DT;
        if (playerCount === 2) return TWO_PLAYER_RENDER_INTERVAL;
        return MANY_PLAYER_RENDER_INTERVAL;
    }

    updatePlayerView(pv, force) {
        const cameraMoved = force || Math.abs(pv.camera.x - pv.lastCameraX) > 0.01 || Math.abs(pv.camera.y - pv.lastCameraY) > 0.01 || Math.abs(pv.camera.viewW - pv.lastViewW) > 0.01;
        const worldChanged = force || pv.lastWorldRevision !== this.worldRevision;
        if (cameraMoved || worldChanged) this.renderTiles(pv);
        this.renderAgents(pv);
        this.renderSelection(pv);
        this.updateHud(pv);
        pv.hudDirty = false;
        pv.lastCameraX = pv.camera.x;
        pv.lastCameraY = pv.camera.y;
        pv.lastViewW = pv.camera.viewW;
        pv.lastWorldRevision = this.worldRevision;
    }

    visibleTileCandidates(camera) {
        const height = viewHeight(camera.viewW);
        const margin = TILE_SIZE * 0.75;
        const left = camera.x - camera.viewW / 2 - margin;
        const right = camera.x + camera.viewW / 2 + margin;
        const top = camera.y - height / 2 - margin;
        const bottom = camera.y + height / 2 + margin;
        return this.tiles.filter((tile) => tile.x + TILE_SIZE / 2 >= left && tile.x - TILE_SIZE / 2 <= right && tile.y + TILE_SIZE / 2 >= top && tile.y - TILE_SIZE / 2 <= bottom);
    }

    bindStable(pool, candidates, render) {
        const selected = {};
        for (const object of candidates.slice(0, pool.slots.length)) selected[object.id] = object;

        for (const slot of pool.slots) {
            if (slot.objectId && !selected[slot.objectId]) {
                delete pool.byObject[slot.objectId];
                slot.objectId = null;
                hideSlot(slot);
            }
        }

        for (const object of candidates.slice(0, pool.slots.length)) {
            let slot = pool.byObject[object.id];
            if (!slot) {
                slot = pool.slots.find((candidate) => !candidate.objectId);
                if (!slot) break;
                slot.objectId = object.id;
                pool.byObject[object.id] = slot;
            }
            render(slot, object);
            slot.visible = true;
        }
    }

    renderTiles(pv) {
        const candidates = this.visibleTileCandidates(pv.camera).sort((a, b) => a.row - b.row || a.col - b.col);
        this.bindStable(pv.tilePool, candidates, (slot, tile) => this.renderTileSlot(pv, slot, tile));
    }

    renderTileSlot(pv, slot, tile) {
        const p = worldToScreen(pv.camera, tile.x, tile.y);
        const h = viewHeight(pv.camera.viewW);
        const sw = TILE_SIZE / pv.camera.viewW * 100;
        const sh = TILE_SIZE / h * 100;
        const nodes = slot.nodes;
        for (const node of nodes) hideNode(node);

        const unlocked = this.isUnlocked(tile);
        const checker = (tile.row + tile.col) % 2 === 0;
        let ground = tile.terrain === 'water' ? C.water : checker ? C.grassA : C.grassB;
        if (!unlocked) ground = C.grassLocked;
        nodes[0].node.coordinates2d = safeRect(p.x - sw / 2, p.y - sh / 2, sw + 0.12, sh + 0.12);
        nodes[0].node.fill = ground;
        nodes[0].node.color = unlocked ? [73, 112, 74, 100] : C.lockedOverlay;
        nodes[0].node.border = 1;

        if (!unlocked) {
            nodes[1].node.coordinates2d = thickLine(p.x - sw * 0.35, p.y - sh * 0.35, p.x + sw * 0.35, p.y + sh * 0.35, Math.max(0.18, sw * 0.04));
            nodes[1].node.fill = C.lockedOverlay;
            return;
        }

        if (tile.terrain === 'water') {
            nodes[1].node.coordinates2d = thickLine(p.x - sw * 0.34, p.y - sh * 0.18, p.x + sw * 0.26, p.y - sh * 0.18, Math.max(0.12, sw * 0.035));
            nodes[1].node.fill = C.waterLight;
            nodes[2].node.coordinates2d = thickLine(p.x - sw * 0.18, p.y + sh * 0.18, p.x + sw * 0.36, p.y + sh * 0.18, Math.max(0.12, sw * 0.035));
            nodes[2].node.fill = C.waterLight;
        }

        if (tile.road) {
            const insetX = sw * 0.05;
            const insetY = sh * 0.05;
            nodes[1].node.coordinates2d = safeRect(p.x - sw / 2 + insetX, p.y - sh / 2 + insetY, sw - insetX * 2, sh - insetY * 2);
            nodes[1].node.fill = C.road;
            nodes[1].node.color = tile.terrain === 'water' ? C.cream : C.roadEdge;
            nodes[1].node.border = tile.terrain === 'water' ? 3 : 1;
            const left = this.getTile(tile.col - 1, tile.row);
            const right = this.getTile(tile.col + 1, tile.row);
            const up = this.getTile(tile.col, tile.row - 1);
            const down = this.getTile(tile.col, tile.row + 1);
            if ((left && left.road) || (right && right.road)) {
                nodes[2].node.coordinates2d = thickLine(p.x - sw / 2, p.y, p.x + sw / 2, p.y, Math.max(0.12, sw * 0.035));
                nodes[2].node.fill = C.lane;
            }
            if ((up && up.road) || (down && down.road)) {
                nodes[3].node.coordinates2d = thickLine(p.x, p.y - sh / 2, p.x, p.y + sh / 2, Math.max(0.12, sw * 0.035));
                nodes[3].node.fill = C.lane;
            }
            return;
        }

        if (tile.special === 'cityHall') {
            this.renderBuilding(nodes, tile, p, sw, sh, 'civic');
            return;
        }

        if (tile.zone === 'park') {
            nodes[1].node.coordinates2d = safeRect(p.x - sw * 0.43, p.y - sh * 0.42, sw * 0.86, sh * 0.84);
            nodes[1].node.fill = C.park;
            nodes[2].node.coordinates2d = safeRect(p.x - sw * 0.05, p.y - sh * 0.08, sw * 0.1, sh * 0.4);
            nodes[2].node.fill = C.trunk;
            nodes[3].node.coordinates2d = polyCircle(p.x, p.y - sh * 0.16, Math.max(0.3, sw * 0.29), 12);
            nodes[3].node.fill = C.parkLight;
            nodes[4].node.coordinates2d = thickLine(p.x - sw * 0.32, p.y + sh * 0.22, p.x + sw * 0.32, p.y + sh * 0.22, Math.max(0.12, sw * 0.04));
            nodes[4].node.fill = C.cream;
            return;
        }

        if (tile.zone && tile.stage === 0) {
            const color = this.zoneColor(tile.zone);
            nodes[1].node.coordinates2d = safeRect(p.x - sw * 0.42, p.y - sh * 0.4, sw * 0.84, sh * 0.8);
            nodes[1].node.fill = [color[0], color[1], color[2], 125];
            nodes[1].node.color = color;
            nodes[1].node.border = 2;
            if (tile.progress > 0.02) {
                nodes[2].node.coordinates2d = safeRect(p.x - sw * 0.3, p.y + sh * 0.17, sw * 0.6 * clamp(tile.progress, 0.05, 1), sh * 0.12);
                nodes[2].node.fill = C.construction;
                nodes[3].node.coordinates2d = thickLine(p.x - sw * 0.2, p.y + sh * 0.12, p.x - sw * 0.2, p.y - sh * 0.28, Math.max(0.16, sw * 0.05));
                nodes[3].node.fill = C.construction;
                nodes[4].node.coordinates2d = thickLine(p.x - sw * 0.2, p.y - sh * 0.25, p.x + sw * 0.2, p.y - sh * 0.25, Math.max(0.12, sw * 0.035));
                nodes[4].node.fill = C.construction;
            }
            return;
        }

        if (tile.zone && tile.stage > 0) this.renderBuilding(nodes, tile, p, sw, sh, tile.zone);
    }

    renderBuilding(nodes, tile, p, sw, sh, type) {
        const stage = type === 'civic' ? 2 : tile.stage;
        const baseColor = type === 'res' ? C.residential : type === 'com' ? C.commercial : type === 'ind' ? C.industrial : C.cream;
        const heightFactor = [0, 0.48, 0.72, 1.05][stage];
        const bodyW = sw * (stage === 1 ? 0.56 : stage === 2 ? 0.66 : 0.72);
        const bodyH = sh * heightFactor;
        const bx = p.x - bodyW / 2;
        const by = p.y + sh * 0.32 - bodyH;

        nodes[1].node.coordinates2d = safeRect(bx + sw * 0.08, by + sh * 0.09, bodyW, bodyH);
        nodes[1].node.fill = C.shadow;
        nodes[2].node.coordinates2d = safeRect(bx, by, bodyW, bodyH);
        nodes[2].node.fill = baseColor;
        nodes[2].node.color = C.cream;
        nodes[2].node.border = 1;

        if (type === 'res' && stage === 1) {
            nodes[3].node.coordinates2d = polygon([[p.x - bodyW * 0.58, by + sh * 0.08], [p.x, by - sh * 0.22], [p.x + bodyW * 0.58, by + sh * 0.08], [p.x - bodyW * 0.58, by + sh * 0.08]]);
            nodes[3].node.fill = C.roof;
            nodes[4].node.coordinates2d = safeRect(p.x - bodyW * 0.3, p.y + sh * 0.01, bodyW * 0.6, sh * 0.16);
            nodes[4].node.fill = C.glass;
            return;
        }

        if (type === 'ind') {
            nodes[3].node.coordinates2d = polygon([[bx + bodyW * 0.52, by], [bx + bodyW * 0.68, by - sh * 0.26], [bx + bodyW * 0.82, by], [bx + bodyW * 0.52, by]]);
            nodes[3].node.fill = C.ink;
        } else {
            nodes[3].node.coordinates2d = safeRect(bx - sw * 0.03, by - sh * 0.04, bodyW + sw * 0.06, sh * 0.1);
            nodes[3].node.fill = type === 'civic' ? C.roof : C.cream;
        }
        const windowColor = (Math.floor(this.time / 6) + tile.seed) % 3 === 0 ? C.glassNight : C.glass;
        nodes[4].node.coordinates2d = safeRect(bx + bodyW * 0.14, by + bodyH * 0.28, bodyW * 0.72, Math.max(0.16, bodyH * 0.16));
        nodes[4].node.fill = windowColor;
    }

    renderAgents(pv) {
        const height = viewHeight(pv.camera.viewW);
        const margin = 20;
        const candidates = this.agents.filter((agent) => agent.x >= pv.camera.x - pv.camera.viewW / 2 - margin && agent.x <= pv.camera.x + pv.camera.viewW / 2 + margin && agent.y >= pv.camera.y - height / 2 - margin && agent.y <= pv.camera.y + height / 2 + margin);
        const sorted = candidates.sort((a, b) => a.x - b.x || a.y - b.y);
        let selected = sorted;
        if (sorted.length > AGENT_POOL_SIZE) {
            selected = [];
            for (let i = 0; i < AGENT_POOL_SIZE; i += 1) {
                const index = Math.round(i * (sorted.length - 1) / Math.max(1, AGENT_POOL_SIZE - 1));
                selected.push(sorted[index]);
            }
        }
        this.bindStable(pv.agentPool, selected, (slot, agent) => this.renderAgentSlot(pv, slot, agent));
    }

    renderAgentSlot(pv, slot, agent) {
        const p = worldToScreen(pv.camera, agent.x, agent.y);
        const scale = 100 / pv.camera.viewW;
        const horizontal = Math.abs(agent.dx) >= Math.abs(agent.dy);
        const length = (agent.type === 'bus' ? 12 : 7.5) * scale;
        const width = (agent.type === 'bus' ? 4.8 : 4.2) * scale;
        const nodes = slot.nodes;
        for (const node of nodes) hideNode(node);

        const bodyW = horizontal ? length : width;
        const bodyH = horizontal ? width : length;
        nodes[0].node.coordinates2d = safeRect(p.x - bodyW / 2 + scale, p.y - bodyH / 2 + scale, bodyW, bodyH);
        nodes[0].node.fill = C.shadow;
        nodes[1].node.coordinates2d = safeRect(p.x - bodyW / 2, p.y - bodyH / 2, bodyW, bodyH);
        nodes[1].node.fill = agent.color;
        nodes[1].node.color = C.cream;
        nodes[1].node.border = 1;
        nodes[2].node.coordinates2d = horizontal
            ? safeRect(p.x - bodyW * 0.18, p.y - bodyH * 0.36, bodyW * 0.42, bodyH * 0.72)
            : safeRect(p.x - bodyW * 0.36, p.y - bodyH * 0.18, bodyW * 0.72, bodyH * 0.42);
        nodes[2].node.fill = C.glass;
        if (horizontal) {
            nodes[3].node.coordinates2d = polyCircle(p.x - bodyW * 0.28, p.y + bodyH * 0.48, Math.max(0.12, scale * 0.75), 8);
            nodes[4].node.coordinates2d = polyCircle(p.x + bodyW * 0.28, p.y + bodyH * 0.48, Math.max(0.12, scale * 0.75), 8);
        } else {
            nodes[3].node.coordinates2d = polyCircle(p.x - bodyW * 0.48, p.y - bodyH * 0.28, Math.max(0.12, scale * 0.75), 8);
            nodes[4].node.coordinates2d = polyCircle(p.x - bodyW * 0.48, p.y + bodyH * 0.28, Math.max(0.12, scale * 0.75), 8);
        }
        nodes[3].node.fill = C.ink;
        nodes[4].node.fill = C.ink;
    }

    renderSelection(pv) {
        const tile = pv.selectedTileId ? this.tiles.find((candidate) => candidate.id === pv.selectedTileId) : null;
        if (!tile) {
            hideNode(pv.selectionNode);
            return;
        }
        const p = worldToScreen(pv.camera, tile.x, tile.y);
        const height = viewHeight(pv.camera.viewW);
        const sw = TILE_SIZE / pv.camera.viewW * 100;
        const sh = TILE_SIZE / height * 100;
        if (p.x < -sw || p.x > 100 + sw || p.y < -sh || p.y > 100 + sh) {
            hideNode(pv.selectionNode);
            return;
        }
        pv.selectionNode.node.coordinates2d = safeRect(p.x - sw * 0.48, p.y - sh * 0.48, sw * 0.96, sh * 0.96);
        pv.selectionNode.node.fill = C.transparent;
        pv.selectionNode.node.color = C.white;
        pv.selectionNode.node.border = 4;
    }

    updateHud(pv) {
        setText(pv.hud.moneyText, { text: formatMoney(this.treasury) });
        setText(pv.hud.populationText, { text: `POP ${this.metrics.population}` });
        setText(pv.hud.incomeText, { text: `+${formatMoney(this.metrics.revenuePerSecond)}/s` });
        setText(pv.hud.statusText, { text: pv.status });
        const demandValues = [this.demand.res, this.demand.com, this.demand.ind];
        for (let i = 0; i < 3; i += 1) {
            pv.hud.demandBars[i].node.coordinates2d = safeRect(85, 3 + i * 2.05, 11 * demandValues[i], 1.15);
        }
        for (const tool of TOOL_ORDER) {
            const selected = pv.tool === tool;
            const button = pv.hud.toolButtons[tool].button;
            button.node.fill = selected ? [65, 80, 96, 255] : C.panelSoft;
            button.node.color = selected ? C.gold : C.panelLine;
            button.node.border = selected ? 4 : 1;
        }
    }

    exportCheckpoint() {
        return {
            version: 1,
            treasury: Math.floor(this.treasury),
            expansionLevel: this.expansionLevel,
            worldRevision: this.worldRevision,
            roadRevision: this.roadRevision,
            tiles: this.tiles.map((tile) => ({
                id: tile.id,
                road: tile.road,
                zone: tile.zone,
                special: tile.special,
                stage: tile.stage,
                progress: tile.progress,
                occupancy: tile.occupancy
            })),
            agents: this.agents.map((agent) => ({
                id: agent.id,
                homeId: agent.homeId,
                workId: agent.workId,
                type: agent.type,
                color: agent.color,
                x: agent.x,
                y: agent.y
            }))
        };
    }
}

module.exports = CommonGround;
