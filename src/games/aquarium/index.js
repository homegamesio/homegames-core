
const { ViewableGame, GameNode, Shapes, ShapeUtils } = require('squish-150');
const CATALOG = require('./data/catalog');
const { restoreCheckpoint } = require('./save-state');

const TICK_RATE = 30; // MUST match metadata().tickRate literal.
const DT = 1 / TICK_RATE;
// A few ambient drift terms were authored as per-frame nudges at 30 Hz.
// Keep those terms expressed relative to elapsed time when adjusting the tick rate.
const LEGACY_30HZ_FRAME_SCALE = 30 * DT;
const MAX_ZOOM = 8; // Extreme inspection zoom: close enough to make individual creatures feel collectible.
const ZOOM_STEP = 1.34;
const CAMERA_WORLD_MIN_Y = 0;
const CAMERA_WORLD_MAX_Y = 100;
const MAX_PLAYERS = 8;
const POOL_LIMITS = [
    { fish: 72, food: 64, accessories: 31, bubbles: 32, floaters: 16, specks: 28, caustics: 24, weeds: 36, rocks: 14, corals: 6 },
    { fish: 180, food: 96, accessories: 55, bubbles: 40, floaters: 20, specks: 36, caustics: 32, weeds: 56, rocks: 20, corals: 10 },
    { fish: 420, food: 128, accessories: 90, bubbles: 52, floaters: 28, specks: 48, caustics: 44, weeds: 80, rocks: 28, corals: 16 },
    { fish: 1000, food: 160, accessories: 140, bubbles: 64, floaters: 36, specks: 64, caustics: 60, weeds: 112, rocks: 40, corals: 24 }
];
const INITIAL_POOL = { food: 32, bubbles: 24, floaters: 12 };
const POOL_CHUNK = { food: 16 };
const WORLD_PLANE_SIZE = 1000000; // Manual projection world; leaves room for effectively unbounded Horizon eras.
const WORLD_CENTER_X = 512; // Preserve existing aquarium/checkpoint coordinates while the ViewableGame plane expands.
const BEHAVIOR_RATE = 5;
const BEHAVIOR_INTERVAL = 1 / BEHAVIOR_RATE;
const FISH_GRID_SIZE = 10;
const FOOD_GRID_SIZE = 12;
const RENDER_GRID_SIZE = 32; // Shared per-tick visibility index for large creature populations.
const MAX_NEIGHBORS = 14;
const FOOD_MAX_CHASERS = 3;
const MANUAL_FOOD_PRIORITY_SECONDS = 4;
const MANUAL_FOOD_ATTRACTION = 30;
const MANUAL_FOOD_INSTANT_RADIUS = 6.5;
const MANUAL_FOOD_CHASE_SPEED = 1.7;
const MANUAL_FOOD_EAT_RADIUS = 3.25;
const FISH_CLUSTER_REFRESH_SECONDS = [1.8, 1.15, 0.68, 0.28, 0];
const FISH_CLUSTER_FOCUS_SECONDS = 2.4;
const FISH_CLUSTER_FOCUS_REFRESH_SECONDS = 0.14;
const FISH_CLUSTER_FOCUS_SCREEN_RADIUS = 19;
const VIEW_CAP = {
    // These are hard upper bounds, not constructor-time allocations. Each view
    // creates only the slots it currently needs and removes excess immediately.
    // Detailed fish capacity now scales with camera zoom; this value is the
    // inspection-mode ceiling, not a permanent allocation.
    fish: 24,
    fishLite: 48,
    food: 24,
    accessoryLite: 20,
    bubbles: 14,
    floaters: 6,
    caustics: 8,
    specks: 10,
    weeds: 12,
    rocks: 6,
    corals: 4
};
const SHOP_PAGE_SIZE = 3;
const MAX_POINTS = 9000000000000000;
const SAVE_INTERVAL_SECONDS = 10;

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

const NUMBER_UNITS = [[1e15, 'Q'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
const FISH_DETAIL_PRIORITY = { turtle: 34, shark: 32, puffer: 24, lionfish: 18, betta: 14, angel: 10 };
const ALIEN_DETAIL_PRIORITY = { leviathan: 80, tripod: 55, ray: 35, blob: 20 };
const ACCESSORY_RENDER_PRIORITY = { feeder: 5, current: 5, cave: 4, beacon: 5, treasure: 5, bubbler: 3 };

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

const polyEllipse = (cx, cy, rx, ry, sides = 14) => {
    const points = [];
    for (let i = 0; i <= sides; i++) {
        const a = i / sides * TAU;
        points.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
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

const sameValue = (a, b) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
};

const updateText = (node, patch) => {
    if (!node || !node.node) return false;
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
    let changed = false;
    for (const key in patch) {
        if (!sameValue(current[key], patch[key])) {
            changed = true;
            break;
        }
    }
    if (!changed) return false;
    node.node.text = { ...current, ...patch };
    return true;
};

const setText = (node, text) => updateText(node, { text: String(text) });
const setTextColor = (node, color) => updateText(node, { color });
const setTextPosition = (node, x, y) => updateText(node, { x, y });
const setTextSize = (node, size) => updateText(node, { size });

const formatNumber = (value) => {
    const n = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    if (n < 1000) return String(n);
    for (const [size, suffix] of NUMBER_UNITS) {
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


// Beyond-the-surface world bounds and presentation budgets.
const AQUARIUM_MIN_Y = 0;
const AQUARIUM_MAX_Y = 100;
const SPACE_TRANSITION_Y = -38;
const SPACE_MIN_Y = -260;
const SPACE_CREATURE_MIN_Y = -232;
const SPACE_CREATURE_MAX_Y = -58;
const SPACE_VIEW_CAP = { stars: 42, rocks: 12, alienLite: 48, alienDetail: 20 };
const SPACE_POOL_LIMITS = {
    fish: 1000, food: 200, accessories: 180, bubbles: 72, floaters: 40,
    specks: 64, caustics: 60, weeds: 112, rocks: 40, corals: 24
};

// The Horizon is a procedural, mostly-static achievement world extending east.
// Each era contributes six permanent monuments; the current era reveals its six
// markers as lifetime-in-that-era earnings rise. Completed eras never disappear.
const HORIZON_MARKERS_PER_ERA = 6;
const HORIZON_MARKER_SPACING = 138;
const HORIZON_GAP = 92;
const HORIZON_VIEW_CAP = 8;
const HORIZON_MARKER_NODES = 7;
const HORIZON_PRELOAD_MIN_X = 120;
const HORIZON_PRELOAD_VIEW_FACTOR = 0.42;
const HORIZON_LABEL_MIN_SCREEN_Y = 75;
const HORIZON_LABEL_MAX_SCREEN_Y = 81;
const HORIZON_CELEBRATION_SECONDS = 3.6;
const HORIZON_ERA_CELEBRATION_SECONDS = 5.2;
const HORIZON_MILESTONE_FRACTIONS = [0.05, 0.12, 0.25, 0.45, 0.70, 1];
const HORIZON_ERA_COST_GROWTH = 3;
const HORIZON_ERA_REWARD_GROWTH = 1.75;
const HORIZON_MAX_REWARD_MULTIPLIER = 1000000;
const HORIZON_NAMES = ['BEACON', 'PALM ISLE', 'OCEAN ARCH', 'LEVIATHAN', 'SKYLINE', 'ERA GATE'];
const HORIZON_ERA_COLORS = [
    [255, 205, 92, 255], [104, 224, 201, 255], [247, 132, 176, 255],
    [156, 139, 255, 255], [121, 197, 255, 255], [255, 151, 92, 255]
];

// Rare visitors turn feeding into a shared event instead of passive income.
// Exactly one may exist at a time. The first bite pays a base 50x jackpot;
// permanent Aurora Whale upgrades can increase both payout and arrival rate.
const GOLDEN_REWARD_MULTIPLIER = 50;
const GOLDEN_EVENT_MIN_SECONDS = 85;
const GOLDEN_EVENT_MAX_SECONDS = 155;
const GOLDEN_FIRST_EVENT_MIN_SECONDS = 42;
const GOLDEN_FIRST_EVENT_MAX_SECONDS = 72;
const GOLDEN_EVENT_LIFETIME_SECONDS = 32;
const GOLDEN_COLORS = [
    [255, 214, 64, 255], [255, 242, 157, 255], [255, 174, 26, 255]
];

// Creature individuality is logical state, not extra scene-graph weight. Every
// creature can be inspected at close zoom; rare mutations affect both appearance
// and economics while still rendering through the same capped LOD pools.
const CREATURE_NAMES = [
    'BUBBLES','MARBLE','WINSTON','PEBBLE','NORI','TANGO','MISO','PIP','COMET','DOT','BEAN','MOCHI',
    'SPROCKET','LUNA','GILL','ZIGGY','PONCHO','RIPPLE','NOVA','PICKLE','CORAL','DASH','BUTTON','FIZZ',
    'ORBIT','JELLY','TULIP','MANGO','PLUTO','WIGGLE','CLOVER','PIXEL','COSMO','TINY','ROCKET','SUNNY',
    'WAVE','BISCUIT','POPPY','QUASAR','MINT','DUMPLING','SKIP','GLOW','MOSS','PRISM','SCOOT','NIMBUS'
];
const CREATURE_TRAITS = [
    { id: 'giant', name: 'GIANT', reward: 1.75, scale: 1.34 },
    { id: 'tiny', name: 'TINY', reward: 2.25, scale: 0.72 },
    { id: 'neon', name: 'NEON', reward: 2.5, scale: 1.0 },
    { id: 'royal', name: 'ROYAL', reward: 4.0, scale: 1.10 },
    { id: 'ancient', name: 'ANCIENT', reward: 3.0, scale: 1.18 },
    { id: 'prism', name: 'PRISM', reward: 3.5, scale: 1.04 }
];
const BASE_MUTATION_CHANCE = 0.018;
const INSPECTION_SECONDS = 6;

// World events are intentionally sparse but dramatic. They reuse existing food,
// creature and view budgets: the event changes rules and presentation rather than
// creating another permanently simulated population.
const WORLD_EVENT_MIN_SECONDS = 105;
const WORLD_EVENT_MAX_SECONDS = 185;
const WORLD_FIRST_EVENT_MIN_SECONDS = 38;
const WORLD_FIRST_EVENT_MAX_SECONDS = 68;
const WORLD_EVENT_DURATION_SECONDS = 22;
const WORLD_EVENT_TYPES = [
    { id: 'feeding-frenzy', name: 'FEEDING FRENZY', subtext: 'WATER BITES', biome: 'water', reward: 2.25 },
    { id: 'bioluminescent-bloom', name: 'BIOLUMINESCENT BLOOM', subtext: 'WATER BITES', biome: 'water', reward: 1.8 },
    { id: 'great-migration', name: 'THE GREAT MIGRATION', subtext: 'WATER BITES', biome: 'water', reward: 2.5 },
    { id: 'treasure-tide', name: 'TREASURE TIDE', subtext: 'GOLDEN FOOD · WATER BITES', biome: 'water', reward: 1.5 },
    { id: 'meteor-shower', name: 'METEOR SHOWER', subtext: 'COSMIC FOOD · SPACE BITES', biome: 'space', reward: 1.8 }
];

// Permanent world purchases. Every one has BOTH a visible world change and a
// mechanical effect. They survive New Era resets so an old aquarium is stronger
// and visibly richer than a fresh one.
const WORLD_UPGRADES = [
    { id: 'sun-shafts', name: 'SUN SHAFTS', description: 'LIGHT COLUMNS THROUGH THE TANK', baseCost: 2500, growth: 5, maxLevel: 4, unlockTier: 1 },
    { id: 'giant-kelp', name: 'GIANT KELP', description: 'TALL KELP GROVES FROM THE FLOOR', baseCost: 25000, growth: 5.5, maxLevel: 5, unlockTier: 2 },
    { id: 'crown-reef', name: 'CROWN REEF', description: 'MONUMENTAL CORAL SPIRES', baseCost: 250000, growth: 6, maxLevel: 4, unlockTier: 3 },
    { id: 'nebula-clouds', name: 'NEBULA CLOUDS', description: 'COLOR BLOOMS ACROSS DEEP SPACE', baseCost: 25000000, growth: 7, maxLevel: 4, requiresSpace: true },
    { id: 'orbital-station', name: 'ORBITAL SANCTUARY', description: 'BUILD A STATION ABOVE THE SURFACE', baseCost: 250000000, growth: 7.5, maxLevel: 4, requiresSpace: true },
    { id: 'horizon-lights', name: 'HORIZON LIGHTS', description: 'BEACONS GLOW ABOVE YOUR HISTORY', baseCost: 2500000000, growth: 8, maxLevel: 5, requiresHorizon: true },
    { id: 'aurora-whales', name: 'AURORA WHALES', description: 'GIANTS DRIFT THROUGH THE UPPER VOID', baseCost: 50000000000, growth: 9, maxLevel: 3, minEra: 2 },
    { id: 'world-crown', name: 'WORLD CROWN', description: 'A COLOSSAL ORBITAL CROWN', baseCost: 500000000000, growth: 10, maxLevel: 3, minEra: 3 },
    { id: 'gene-garden', name: 'GENE GARDEN', description: 'A GLOWING SANCTUARY FOR RARE MUTATIONS', baseCost: 5000000000000, growth: 8, maxLevel: 3, minEra: 2 },
    { id: 'event-engine', name: 'WORLD ENGINE', description: 'A MACHINE THAT WAKES THE WHOLE WORLD', baseCost: 50000000000000, growth: 8, maxLevel: 3, minEra: 3 },
    { id: 'migration-gate', name: 'MIGRATION GATE', description: 'A COLOSSAL ARCH THE SCHOOLS ANSWER TO', baseCost: 500000000000000, growth: 6, maxLevel: 2, minEra: 4 }
];

// Creature infrastructure is biome-driven. Simulation/behavior can remain unique
// per biome, while visibility, LOD, pooled rendering, clicks, and feeding share
// one path. Adding a future creature biome should mostly mean adding one profile.
const CREATURE_BIOMES = {
    water: {
        id: 'water',
        kind: 'fish',
        collectionKey: 'fish',
        hideHidden: true,
        litePoolKey: 'fishLiteSlots',
        detailPoolKey: 'fishSlots',
        liteLayerKey: 'fishLiteLayer',
        detailLayerKey: 'fishLayer',
        detailNodes: 6,
        detailLimitMethod: 'fishDetailLimit',
        detailPriorityMethod: 'fishDetailPriority',
        liteRendererMethod: 'renderFishLite',
        detailRendererMethod: 'renderFishRig',
        hitboxX: 0.95,
        hitboxY: 0.90,
        hitboxMinX: 2.1,
        hitboxMinY: 1.7
    },
    space: {
        id: 'space',
        kind: 'alien',
        collectionKey: 'aliens',
        hideHidden: false,
        litePoolKey: 'alienLiteSlots',
        detailPoolKey: 'alienSlots',
        liteLayerKey: 'alienLiteLayer',
        detailLayerKey: 'alienLayer',
        detailNodes: 6,
        detailLimitMethod: 'alienDetailLimit',
        detailPriorityMethod: 'alienDetailPriority',
        liteRendererMethod: 'renderAlienLite',
        detailRendererMethod: 'renderAlienRig',
        hitboxX: 0.80,
        hitboxY: 0.80,
        hitboxMinX: 2.2,
        hitboxMinY: 2.0
    }
};

const ALIEN_CLUSTER_PROFILE = {
    biome: 'space',
    margin: 5,
    liteCap: SPACE_VIEW_CAP.alienLite,
    singletonZoom: 0.92,
    lowZoom: 0.38,
    midZoom: 0.58,
    cellLow: 42,
    cellMid: 28,
    cellHigh: 18,
    cellGrowth: 1.45,
    maxAttempts: 4,
    clusterScaleGrowth: 0.16,
    clusterScaleMin: 0.75,
    clusterScaleMax: 2.4,
    idPrefix: 'acluster'
};

const interpolateColor = (a, b, t) => {
    const amount = clamp(t, 0, 1);
    return [
        Math.round(a[0] + (b[0] - a[0]) * amount),
        Math.round(a[1] + (b[1] - a[1]) * amount),
        Math.round(a[2] + (b[2] - a[2]) * amount),
        Math.round(a[3] + (b[3] - a[3]) * amount)
    ];
};

class AquariumForever extends ViewableGame {
    static metadata() {
        return {
            thumbnail: './assets/thumbnail.png',
            name: 'Aquarium',
            author: "Joseph Garcia",
            description: 'Manage an aquarium until it gets unreasonable',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30,
            maxPlayers: 8,
            gameId: "49f97a9a-18a3-5584-ac00-4a2bbb1b9a52"
        };
    }

    constructor({ saveData, saveGame } = {}) {
        super(WORLD_PLANE_SIZE);
        this.time = 0;
        this.nextAmbientBubble = 0.2;
        this.behaviorAccumulator = 0;
        this.behaviorFrame = 0;
        this.tankTier = 0;
        this.players = {};
        this.playerOrder = [];

        const decorIds = CATALOG.decor
            .filter((item) => item.id !== 'flakes')
            .map((item) => item.id);
        this.economy = {
            money: 20,
            totalEarned: 0,
            foodEaten: 0,
            foodLevel: 0,
            fishPurchases: CATALOG.fish.reduce((counts, item) => {
                counts[item.id] = 0;
                return counts;
            }, {}),
            decorPurchases: decorIds.reduce((counts, id) => {
                counts[id] = 0;
                return counts;
            }, {})
        };

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

        this.fishById = new Map();
        this.foodById = new Map();
        this.accessoryById = new Map();
        this.fishCounts = CATALOG.fish.reduce((counts, item) => {
            counts[item.id] = 0;
            return counts;
        }, {});

        this.nextFishId = 1;
        this.nextFoodId = 1;
        this.nextAccessoryId = 1;
        this.nextBubbleId = 1;
        this.nextFloaterId = 1;
        this.nextStaticId = 1;
        this.decorCounts = decorIds.reduce((counts, id) => {
            counts[id] = 0;
            return counts;
        }, {});

        this.expandStaticWorld(0);
        this.addFoodSlots(INITIAL_POOL.food);
        this.addBubbleSlots(INITIAL_POOL.bubbles);
        this.addFloaterSlots(INITIAL_POOL.floaters);

        this.addFish('guppy', true);
        this.addFish('guppy', true);
        this.addFish('guppy', true);
        this.addFish('clown', true);
        this.addFish('clown', true);
        this.addFish('tang', true);

        this.spaceUnlocked = this.tankTier >= 4;
        this.spaceBuilt = false;
        this.aliens = [];
        this.alienById = new Map();
        this.nextAlienId = 1;
        this.alienBehaviorAccumulator = 0;
        this.spaceStars = [];
        this.spaceRocks = [];
        this.nextSpaceSceneryId = 1;

        // Shared visibility indexes: one grid per creature biome, rebuilt once
        // after simulation and queried from every player's camera. Keep the legacy
        // aliases for debug tooling/older tests, but all game code uses the registry.
        this._renderSpatialIndexTime = -1;
        this._renderCreatureGrids = {
            water: new Map(),
            space: new Map()
        };
        this._renderFishGrid = this._renderCreatureGrids.water;
        this._renderAlienGrid = this._renderCreatureGrids.space;

        const alienCatalog = Array.isArray(CATALOG.aliens) ? CATALOG.aliens : [];
        for (const species of alienCatalog) {
            this.fishCounts[species.id] = 0;
            this.economy.fishPurchases[species.id] = 0;
        }
        if (this.spaceUnlocked) this.buildSpaceWorld();

        this.progression = {
            era: 1,
            completedEras: 0,
            lifetimeEarned: 0,
            lastCurrentUnlocked: 0,
            eraVotes: new Set(),
            worldUpgrades: WORLD_UPGRADES.reduce((levels, item) => {
                levels[item.id] = 0;
                return levels;
            }, {}),
            celebration: { text: '', subtext: '', until: 0, markerIndex: -1, kind: '' }
        };
        this.goldenEvent = {
            active: null,
            nextAt: this.time + this.nextFirstGoldenVisitorDelay()
        };
        this.worldEvent = {
            active: null,
            nextAt: this.time + this.nextFirstWorldEventDelay(),
            serial: 0
        };
        const restored = restoreCheckpoint(this, saveData, {
            upgrades: WORLD_UPGRADES, events: WORLD_EVENT_TYPES, eventDuration: WORLD_EVENT_DURATION_SECONDS,
            spaceMinY: SPACE_CREATURE_MIN_Y, spaceMaxY: SPACE_CREATURE_MAX_Y
        });
        this.saveGame = typeof saveGame === 'function' ? saveGame : null;
        this.saveBlocked = saveData != null && !restored;
        this.saveState = this.saveBlocked ? 'blocked' : this.saveGame ? 'ready' : 'disabled';
        this.saveMessage = this.saveBlocked ? 'Saved progress could not be loaded. Autosave is off to preserve it.' : '';
        this.saveTail = Promise.resolve();
        this.saveInFlight = false;
        this.saveRequested = false;
        this.nextSaveAt = this.time + SAVE_INTERVAL_SECONDS;
        this.closed = false;
    }

    persist() {
        if (!this.saveGame || this.saveBlocked) return this.saveTail;
        this.saveRequested = true;
        if (this.saveInFlight) return this.saveTail;
        this.saveInFlight = true;
        // One write in flight plus a flag for the newest state. A slow store
        // cannot build an unbounded queue of large creature snapshots.
        this.saveTail = (async () => {
            try {
                do {
                    this.saveRequested = false;
                    await this.writeCheckpoint();
                } while (this.saveRequested && !this.closed);
            } finally { this.saveInFlight = false; }
        })();
        return this.saveTail;
    }

    async writeCheckpoint() {
        this.saveState = 'saving';
        try {
            await this.saveGame(this.exportCheckpoint());
            this.saveState = 'saved';
            this.saveMessage = '';
        } catch (_) {
            this.saveState = 'error';
            this.saveMessage = 'Progress could not be saved. Keep this game open; saving will retry.';
            this.setGlobalStatus(this.saveMessage, 5);
        }
    }

    close() {
        if (this.closed) return this.saveTail;
        this.closed = true;
        super.close();
        if (this.saveInFlight) {
            // The portable bridge stops accepting new requests after close()
            // returns. Enqueue the final state now, behind the backend's prior
            // write, rather than waiting for that write's acknowledgement.
            this.saveRequested = false;
            const pending = this.saveTail;
            this.saveTail = Promise.all([pending, this.writeCheckpoint()]).then(() => {});
            return this.saveTail;
        }
        return this.persist();
    }

    getLayers() {
        return [{ root: this.getViewRoot() }];
    }

    currentTank() {
        return CATALOG.tanks[this.tankTier] || CATALOG.tanks[0];
    }

    nextTank() {
        return CATALOG.tanks[this.tankTier + 1] || null;
    }

    tankBounds() {
        const half = this.currentTank().width / 2;
        return { min: WORLD_CENTER_X - half, max: WORLD_CENTER_X + half };
    }

    _aquariumBase_poolLimits() {
        return POOL_LIMITS[this.tankTier] || POOL_LIMITS[0];
    }

    tierNewRanges(tierIndex) {
        const tank = CATALOG.tanks[tierIndex] || CATALOG.tanks[0];
        const half = tank.width / 2;
        const next = { min: WORLD_CENTER_X - half, max: WORLD_CENTER_X + half };
        if (tierIndex <= 0) return [next];
        const previousTank = CATALOG.tanks[tierIndex - 1];
        const previousHalf = previousTank.width / 2;
        return [
            { min: next.min, max: WORLD_CENTER_X - previousHalf },
            { min: WORLD_CENTER_X + previousHalf, max: next.max }
        ];
    }

    distributedX(ranges, index, count, padding) {
        const range = ranges[index % ranges.length];
        const slotsInRange = Math.max(1, Math.ceil(count / ranges.length));
        const localIndex = Math.floor(index / ranges.length);
        const usable = Math.max(1, range.max - range.min - padding * 2);
        const t = slotsInRange <= 1 ? 0.5 : localIndex / (slotsInRange - 1);
        return range.min + padding + usable * clamp(t, 0, 1);
    }

    expandStaticWorld(tierIndex) {
        const limits = POOL_LIMITS[tierIndex] || POOL_LIMITS[0];
        const previous = tierIndex > 0
            ? POOL_LIMITS[tierIndex - 1]
            : { specks: 0, caustics: 0, weeds: 0, rocks: 0, corals: 0 };
        const ranges = this.tierNewRanges(tierIndex);

        const addCaustics = limits.caustics - previous.caustics;
        for (let i = 0; i < addCaustics; i++) {
            const index = this.caustics.length;
            this.caustics.push({
                id: this.nextStaticId++,
                x: this.distributedX(ranges, i, addCaustics, 5),
                y: 7 + (index % 5) * 10.5,
                width: 8 + (index % 4) * 3.2,
                speed: 0.55 + (index % 6) * 0.13,
                phase: index * 0.7
            });
        }

        const addRocks = limits.rocks - previous.rocks;
        for (let i = 0; i < addRocks; i++) {
            const index = this.staticRocks.length;
            this.staticRocks.push({
                id: this.nextStaticId++,
                x: this.distributedX(ranges, i, addRocks, 4),
                y: 90 + (index % 3) * 1.4,
                width: 4.5 + (index % 5) * 0.9,
                height: 4.4 + (index % 4) * 0.8,
                phase: index * 0.93
            });
        }

        const addSpecks = limits.specks - previous.specks;
        for (let i = 0; i < addSpecks; i++) {
            const index = this.specks.length;
            this.specks.push({
                id: this.nextStaticId++,
                x: this.distributedX(ranges, i, addSpecks, 1.5),
                y: 4 + ((index * 17) % 86),
                size: 0.08 + (index % 7) * 0.025,
                speed: 0.12 + (index % 8) * 0.045,
                phase: index * 0.61,
                bright: index % 9 === 0
            });
        }

        const addWeeds = limits.weeds - previous.weeds;
        for (let i = 0; i < addWeeds; i++) {
            const index = this.staticWeeds.length;
            this.staticWeeds.push({
                id: this.nextStaticId++,
                x: this.distributedX(ranges, i, addWeeds, 2.5),
                y: 91 + ((index % 5) - 2) * 0.32,
                height: 8 + (index % 8) * 1.7,
                width: 0.65 + (index % 4) * 0.18,
                phase: index * 0.79,
                speed: 0.65 + (index % 7) * 0.11
            });
        }

        const addCorals = limits.corals - previous.corals;
        for (let i = 0; i < addCorals; i++) {
            const index = this.staticCorals.length;
            this.staticCorals.push({
                id: this.nextStaticId++,
                x: this.distributedX(ranges, i, addCorals, 8),
                y: 94,
                width: 2.8 + (index % 4) * 0.65,
                height: 7 + (index % 5) * 1.25,
                phase: index * 1.17,
                colorIndex: index % 3
            });
        }
    }

    minZoom() {
        // Expanded tanks can now zoom all the way out to their full width. Fish
        // clustering, rather than a hard zoom floor, protects the render budget.
        return Math.max(0.18, 100 / this.currentTank().width);
    }

    viewWidth(player) {
        return 100 / player.camera.zoom;
    }

    viewHeight(player) {
        return 100 / player.camera.zoom;
    }

    worldToScreenX(player, worldX) {
        return 50 + (worldX - player.camera.x) * player.camera.zoom;
    }

    worldToScreenY(player, worldY) {
        return 50 + (worldY - player.camera.y) * player.camera.zoom;
    }

    screenScale(player) {
        return clamp(player.camera.zoom, this.minZoom(), MAX_ZOOM);
    }

    scalePolygonAround(points, centerX, centerY, scale) {
        if (!Array.isArray(points) || !Number.isFinite(scale)) return points;
        return points.map((point) => [
            centerX + (point[0] - centerX) * scale,
            centerY + (point[1] - centerY) * scale
        ]);
    }

    scaleRigAround(nodes, centerX, centerY, scale) {
        if (Math.abs(scale - 1) < 0.0001) return;
        for (const node of nodes) {
            const points = node && node.node && node.node.coordinates2d;
            if (!Array.isArray(points) || points.length === 0) continue;
            const first = points[0];
            const collapsed = points.every((point) => point[0] === first[0] && point[1] === first[1]);
            if (collapsed) continue;
            node.node.coordinates2d = this.scalePolygonAround(points, centerX, centerY, scale);
        }
    }

    _aquariumBase_renderSand(player) {
        const view = player.view;
        const makeSurface = (baseY, amplitude, phase) => {
            const points = [];
            for (let screenX = 0; screenX <= 100; screenX += 5) {
                const worldX = this.screenToWorldX(player, screenX);
                const wave = (
                    Math.sin(worldX * 0.055 + phase) * 1.35 +
                    Math.sin(worldX * 0.128 + phase * 1.7) * 0.65
                ) * amplitude;
                points.push([screenX, this.worldToScreenY(player, baseY + wave)]);
            }
            const bottomY = Math.max(100, this.worldToScreenY(player, CAMERA_WORLD_MAX_Y));
            points.push([100, bottomY], [0, bottomY], points[0]);
            return points;
        };
        view.sandBack.node.coordinates2d = makeSurface(81.2, 1.05, 0.4);
        view.sandFront.node.coordinates2d = makeSurface(88.6, 1.15, 2.1);
    }

    screenToWorldX(player, screenX) {
        return player.camera.x + (screenX - 50) / player.camera.zoom;
    }

    screenToWorldY(player, screenY) {
        return player.camera.y + (screenY - 50) / player.camera.zoom;
    }

    visibleWorldBounds(player, margin = 0) {
        const half = this.viewWidth(player) / 2 + margin / Math.max(0.01, player.camera.zoom);
        return { min: player.camera.x - half, max: player.camera.x + half };
    }

    visibleWorldRect(player, margin = 0) {
        const scaledMargin = margin / Math.max(0.01, player.camera.zoom);
        const halfWidth = this.viewWidth(player) / 2 + scaledMargin;
        const halfHeight = this.viewHeight(player) / 2 + scaledMargin;
        return {
            minX: player.camera.x - halfWidth,
            maxX: player.camera.x + halfWidth,
            minY: player.camera.y - halfHeight,
            maxY: player.camera.y + halfHeight
        };
    }

    worldXVisible(player, worldX, margin = 8) {
        const sx = this.worldToScreenX(player, worldX);
        return sx >= -margin && sx <= 100 + margin;
    }

    panCamera(playerId, dx, dy = 0) {
        const player = this.players[playerId];
        if (!player || !player.connected) return;
        player.camera.targetX += dx * this.viewWidth(player) * 0.46;
        player.camera.targetY += dy * this.viewHeight(player) * 0.46;
        this.clampCamera(player);
    }

    zoomCamera(playerId, direction) {
        const player = this.players[playerId];
        if (!player || !player.connected) return;
        const factor = direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        player.camera.targetZoom = clamp(
            player.camera.targetZoom * factor,
            this.minZoom(),
            MAX_ZOOM
        );
        player.camera.zoom = clamp(player.camera.zoom, this.minZoom(), MAX_ZOOM);
        this.clampCamera(player);
    }

    centerCamera(playerId) {
        const player = this.players[playerId];
        if (!player || !player.connected) return;
        player.camera.targetX = WORLD_CENTER_X;
        player.camera.targetY = 50;
        player.camera.targetZoom = 1;
        player.camera.velocity = 0;
        player.camera.velocityY = 0;
        this.clampCamera(player);
    }

    focusFloorCamera(playerId) {
        const player = this.players[playerId];
        if (!player || !player.connected) return;
        player.camera.targetZoom = Math.max(player.camera.targetZoom, 3.2);
        const halfY = 50 / player.camera.targetZoom;
        player.camera.targetY = CAMERA_WORLD_MAX_Y - halfY;
        this.clampCamera(player);
    }

    decorMax(item) {
        if (item.id === 'flakes') return item.max;
        if (Array.isArray(item.maxByTier)) {
            const value = item.maxByTier[this.tankTier];
            return Math.max(0, Number.isFinite(value) ? value : 0);
        }
        return Math.floor((item.max || 0) * this.currentTank().decorScale);
    }

    economyCost(baseCost, bought, growth) {
        return costFor(baseCost * this.currentTank().storeScale, bought, growth);
    }

    handleNewPlayer({ playerId, info }) {
        if (!Number.isSafeInteger(playerId) || playerId <= 0) return;
        let player = this.players[playerId];
        if (!player && this.playerOrder.length >= MAX_PLAYERS) return;
        if (!player) {
            const colorIndex = this.playerOrder.length % PLAYER_COLORS.length;
            player = {
                id: playerId,
                name: info && info.name ? String(info.name).slice(0, 20) : `PLAYER ${playerId}`,
                color: PLAYER_COLORS[colorIndex],
                connected: true,
                shopOpen: false,
                shopTab: 'fish',
                shopPage: 0,
                feedCooldown: 0,
                status: '',
                statusTime: 0,
                uiTimer: 0,
                keys: {},
                eraConfirmUntil: 0,
                eraFlyHomeAt: 0,
                inspection: null,
                camera: {
                    x: WORLD_CENTER_X,
                    y: 50,
                    targetX: WORLD_CENTER_X,
                    targetY: 50,
                    zoom: 1,
                    targetZoom: 1,
                    velocity: 0,
                    velocityY: 0
                },
                view: null
            };
            this.players[playerId] = player;
            this.playerOrder.push(playerId);
        } else {
            player.connected = true;
            player.name = info && info.name ? String(info.name).slice(0, 20) : player.name;
            player.keys = {};
            player.shopOpen = false;
            player.shopPage = 0;
        }

        if (player.view) this.removePlayerView(player);
        this.createPlayerView(player);
        this.updatePlayerUi(player, true);
        this.renderPlayerView(player);
        this.getViewRoot().node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        const player = this.players[playerId];
        if (!player) return;
        player.connected = false;
        player.keys = {};
        player.shopOpen = false;
        this.removePlayerView(player);
        delete this.players[playerId];
        this.playerOrder = this.playerOrder.filter(id => id !== playerId);
        if (this.progression && this.progression.eraVotes) {
            this.progression.eraVotes.delete(playerId);
            this.checkEraVotes();
        }
        this.persist();
    }

    _aquariumBase_handleKeyDown(playerId, key) {
        const player = this.players[playerId];
        if (!player || !player.connected) return;
        const k = String(key || '').toLowerCase();
        if (player.keys[k]) return;
        player.keys[k] = true;
        if (k === 'f' || k === ' ') {
            const x = player.camera.x + rand(-12, 12) / player.camera.zoom;
            const y = player.camera.y - this.viewHeight(player) * 0.34 + rand(-2, 2);
            this.dropFoodForBiome(playerId, this.biomeAtWorldPosition(x, y), x, y);
        }
        if (k === 's' || k === 'tab') this.toggleShop(playerId);
        if (k === '1') this.setShopTab(playerId, 'fish');
        if (k === '2') this.setShopTab(playerId, 'decor');
        if (k === '3') this.setShopTab(playerId, 'tank');
        if (k === 'q' || k === '-') this.zoomCamera(playerId, -1);
        if (k === 'e' || k === '+' || k === '=') this.zoomCamera(playerId, 1);
        if (k === 'g') this.focusFloorCamera(playerId);
        if (k === 'h' || k === '0') this.centerCamera(playerId);
    }

    handleKeyUp(playerId, key) {
        const player = this.players[playerId];
        if (!player) return;
        delete player.keys[String(key || '').toLowerCase()];
    }

    createPlayerView(player) {
        const root = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), COLORS.waterMid, {
            playerIds: [player.id]
        });
        const view = {
            root,
            backgroundBands: [],
            tankEdges: [],
            causticSlots: [],
            speckSlots: [],
            weedSlots: [],
            rockSlots: [],
            coralSlots: [],
            fishLiteSlots: [],
            fishSlots: [],
            accessoryLiteSlots: [],
            foodSlots: [],
            bubbleSlots: [],
            floaterSlots: [],
            fishClusterLevel: -1,
            fishClusterMergeStep: 0,
            fishClusterSnapshot: [],
            fishClusterNextRefresh: 0,
            fishClusterCameraX: player.camera.x,
            fishClusterCameraY: player.camera.y,
            fishClusterCameraZoom: player.camera.zoom,
            fishClusterFocus: null,
            nextFishClusterId: 1,
            closeFishIds: [],
            feedTargets: [],
            // Detached presentation slots are retained in server memory but are not
            // children of the render tree, so camera churn reuses nodes without
            // increasing the payload sent to this player.
            detachedShapePools: {},
            detachedTextPools: {},
            sunShaftSlots: [],
            giantKelpSlots: [],
            crownReefSlots: [],
            nebulaUpgradeSlots: [],
            orbitalStationSlots: [],
            horizonLightSlots: [],
            auroraWhaleSlots: [],
            worldCrownSlots: [],
            geneGardenSlots: [],
            worldEngineSlots: [],
            migrationGateSlots: [],
            waterEventSlots: [],
            spaceEventSlots: [],
            ui: null,
            controls: null
        };
        player.view = view;

        this.buildViewBackground(player);
        this.buildViewPools(player);
        this.buildWorldClickSurface(player);
        this.buildCameraControls(player);
        this.buildPlayerUi(player);
        this.buildProgressionOverlay(player);
        this.buildCreatureInspectionOverlay(player);
        this.getViewRoot().addChild(root);
    }

    buildProgressionOverlay(player) {
        const view = player.view;
        if (!view || view.progressionOverlay) return;
        const panel = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), [12, 28, 45, 0], {
            color: [255, 222, 115, 0],
            border: 2
        });
        const title = makeText('', 50, 5.35, 1.72, COLORS.white, 'center');
        const detail = makeText('', 50, 8.65, 1.02, [220, 236, 240, 255], 'center');
        view.root.addChild(panel);
        view.root.addChild(title);
        view.root.addChild(detail);
        view.progressionOverlay = { panel, title, detail, visible: false };
        this.updateProgressionOverlay(player);
    }

    updateProgressionOverlay(player) {
        const view = player && player.view;
        const overlay = view && view.progressionOverlay;
        if (!overlay) return;
        const celebration = this.progression && this.progression.celebration;
        const visible = Boolean(!player.shopOpen && celebration && celebration.until > this.time && celebration.text);
        if (!visible) {
            if (overlay.visible) {
                overlay.panel.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                overlay.panel.node.fill = COLORS.transparent;
                overlay.panel.node.color = COLORS.transparent;
                setText(overlay.title, '');
                setText(overlay.detail, '');
                overlay.visible = false;
            }
            return;
        }
        const remaining = Math.max(0, celebration.until - this.time);
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 7.5);
        const alpha = Math.round(218 + pulse * 25);
        const borderAlpha = Math.round(190 + pulse * 65);
        const width = 92;
        const x = 50 - width / 2;
        overlay.panel.node.coordinates2d = ShapeUtils.rectangle(x, 20, width, 19);
        overlay.panel.node.fill = [12, 28, 45, alpha];
        overlay.panel.node.color = celebration.kind === 'era'
            ? [255, 222, 115, borderAlpha]
            : [137, 235, 224, borderAlpha];
        setText(overlay.title, celebration.text);
        setText(overlay.detail, celebration.subtext || '');
        setTextPosition(overlay.title, 50, 22);
        setTextSize(overlay.title, Math.min(3.2, 88 / Math.max(1, celebration.text.length * .87)));
        setTextPosition(overlay.detail, 50, 31);
        setTextSize(overlay.detail, Math.min(2.6, 88 / Math.max(1, (celebration.subtext || '').length * .87)));
        const fade = clamp(remaining / 0.6, 0, 1);
        setTextColor(overlay.title, [244, 248, 250, Math.round(255 * fade)]);
        setTextColor(overlay.detail, [220, 236, 240, Math.round(245 * fade)]);
        overlay.visible = true;
    }

    setProgressionCelebration(text, subtext = '', options = {}) {
        if (!this.progression) return;
        const duration = Number.isFinite(options.duration) ? options.duration : HORIZON_CELEBRATION_SECONDS;
        this.progression.celebration = {
            text: String(text || ''),
            subtext: String(subtext || ''),
            until: this.time + Math.max(0.5, duration),
            markerIndex: Number.isFinite(options.markerIndex) ? options.markerIndex : -1,
            kind: options.kind || 'milestone'
        };
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (player && player.connected && player.view) this.updateProgressionOverlay(player);
        }
    }

    removePlayerView(player) {
        if (!player.view) return;
        this.getViewRoot().removeChild(player.view.root.node.id);
        player.view = null;
    }

    _aquariumBase_buildViewBackground(player) {
        const view = player.view;

        // One scoped presentation root per player. Logical aquarium state remains
        // plain JavaScript data; only currently visible objects are attached below.
        view.worldRoot = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        view.root.addChild(view.worldRoot);

        [
            [0, 0, 100, 17, COLORS.waterTop],
            [0, 17, 100, 17, COLORS.waterMid],
            [0, 34, 100, 17, COLORS.waterMid],
            [0, 51, 100, 17, COLORS.waterLow],
            [0, 68, 100, 15, COLORS.waterLow]
        ].forEach((r) => {
            const node = makeShape(ShapeUtils.rectangle(r[0], r[1], r[2], r[3]), r[4]);
            view.backgroundBands.push(node);
            view.worldRoot.addChild(node);
        });

        // These zero-geometry nodes are structural z-order anchors, not hidden
        // world objects. They keep streamed children in a deterministic draw order
        // even when pools grow, shrink, or rebind as the camera moves.
        const addLayer = () => {
            const layer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
            view.worldRoot.addChild(layer);
            return layer;
        };

        view.causticLayer = addLayer();
        view.edgeLayer = addLayer();

        view.sandBackLayer = addLayer();
        view.sandBack = makeShape([
            [0, 82], [15, 79], [31, 82], [48, 78], [66, 82], [84, 78], [100, 81],
            [100, 100], [0, 100], [0, 82]
        ], COLORS.sandBack);
        view.sandBackLayer.addChild(view.sandBack);
        view.sandBackAttached = true;

        // Rocks always sit behind the front sand and vegetation. Their individual
        // streamed nodes may come and go, but their parent never changes order.
        view.rockLayer = addLayer();

        view.sandFrontLayer = addLayer();
        view.sandFront = makeShape([
            [0, 89], [13, 87], [28, 91], [44, 86], [61, 90], [76, 86], [91, 90], [100, 87],
            [100, 100], [0, 100], [0, 89]
        ], COLORS.sandFront);
        view.sandFrontLayer.addChild(view.sandFront);
        view.sandFrontAttached = true;

        // Bottom-of-tank order is explicit and stable:
        // rocks -> sand lip -> seaweed -> coral -> purchased decorations.
        view.weedLayer = addLayer();
        view.coralLayer = addLayer();
        view.accessoryLiteLayer = addLayer();

        // Water-column and foreground presentation layers.
        view.speckLayer = addLayer();
        view.foodLayer = addLayer();
        view.fishLiteLayer = addLayer();
        view.fishLayer = addLayer();
        view.bubbleLayer = addLayer();
        view.floaterLayer = addLayer();
    }

    makeShapeSlots(layer, count, nodesPerSlot = 1) {
        const slots = [];
        for (let i = 0; i < count; i++) {
            const nodes = [];
            for (let j = 0; j < nodesPerSlot; j++) {
                const node = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
                nodes.push(node);
                layer.addChild(node);
            }
            slots.push({ boundId: 0, boundItem: null, nodes });
        }
        return slots;
    }

    buildViewPools(player) {
        // Presentation starts with zero streamed entity/effect slots. Logical
        // objects exist only in plain server memory until this camera needs them.
    }

    ensureShapePool(view, key, layer, required, nodesPerSlot = 1) {
        const slots = view[key];
        const target = Math.max(0, Math.floor(required));
        const detachedPools = view.detachedShapePools || (view.detachedShapePools = {});
        const detached = detachedPools[key] || (detachedPools[key] = []);

        while (slots.length < target) {
            let slot = detached.pop();
            if (!slot || slot.nodes.length !== nodesPerSlot) {
                slot = this.makeShapeSlots(layer, 1, nodesPerSlot)[0];
            } else {
                slot.boundId = 0;
                slot.boundItem = null;
                for (const node of slot.nodes) layer.addChild(node);
            }
            slots.push(slot);
        }
        while (slots.length > target) {
            const slot = slots.pop();
            slot.boundId = 0;
            slot.boundItem = null;
            for (const node of slot.nodes) layer.removeChild(node.node.id);
            detached.push(slot);
        }
        return slots;
    }

    ensureTextPool(view, key, layer, required) {
        const slots = view[key];
        const target = Math.max(0, Math.floor(required));
        const detachedPools = view.detachedTextPools || (view.detachedTextPools = {});
        const detached = detachedPools[key] || (detachedPools[key] = []);

        while (slots.length < target) {
            let slot = detached.pop();
            if (!slot) {
                const node = makeText('', 0, 0, 1.8, COLORS.white, 'center');
                layer.addChild(node);
                slot = { boundId: 0, boundItem: null, node };
            } else {
                slot.boundId = 0;
                slot.boundItem = null;
                layer.addChild(slot.node);
            }
            slots.push(slot);
        }
        while (slots.length > target) {
            const slot = slots.pop();
            slot.boundId = 0;
            slot.boundItem = null;
            layer.removeChild(slot.node.node.id);
            detached.push(slot);
        }
        return slots;
    }

    findRenderedFishForClick(player, screenX, screenY) {
        const targets = player && player.view && Array.isArray(player.view.feedTargets)
            ? player.view.feedTargets
            : [];
        let bestTarget = null;
        let bestScore = Infinity;

        for (const target of targets) {
            const nx = (screenX - target.screenX) / Math.max(0.5, target.halfWidth);
            const ny = (screenY - target.screenY) / Math.max(0.5, target.halfHeight);
            const score = nx * nx + ny * ny;
            if (score <= 1.25 && score < bestScore) {
                bestTarget = target;
                bestScore = score;
            }
        }
        if (!bestTarget || !bestTarget.members || bestTarget.members.length === 0) return null;

        const worldX = this.screenToWorldX(player, screenX);
        const worldY = this.screenToWorldY(player, screenY);
        let bestFish = null;
        let bestDistance = Infinity;
        for (const fish of bestTarget.members) {
            if (!fish.active || fish.hidden) continue;
            const d = dist(worldX, worldY, fish.x, fish.y);
            if (d < bestDistance) {
                bestFish = fish;
                bestDistance = d;
            }
        }
        return bestFish;
    }

    _aquariumBase_buildCameraControls(player) {
        const view = player.view;
        const controlLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        view.root.addChild(controlLayer);
        const controlFill = [13, 25, 42, 150];
        const controlLine = [235, 247, 250, 220];
        const arrow = (cx, cy, dx, dy, onClick) => makeShape([
            [cx + dx * 3.8, cy + dy * 3.8],
            [cx - dy * 3.2 - dx * 1.4, cy + dx * 3.2 - dy * 1.4],
            [cx - dy * 1.5 - dx * 1.4, cy + dx * 1.5 - dy * 1.4],
            [cx - dy * 1.5 - dx * 3.8, cy + dx * 1.5 - dy * 3.8],
            [cx + dy * 1.5 - dx * 3.8, cy - dx * 1.5 - dy * 3.8],
            [cx + dy * 1.5 - dx * 1.4, cy - dx * 1.5 - dy * 1.4],
            [cx + dy * 3.2 - dx * 1.4, cy - dx * 3.2 - dy * 1.4],
            [cx + dx * 3.8, cy + dy * 3.8]
        ], controlFill, { color: controlLine, border: 2, onClick });

        const controls = {
            layer: controlLayer,
            panLeftButton: arrow(6.4, 50, -1, 0, () => this.panCamera(player.id, -1, 0)),
            panRightButton: arrow(93.6, 50, 1, 0, () => this.panCamera(player.id, 1, 0)),
            panUpButton: arrow(50, 5.5, 0, -1, () => this.panCamera(player.id, 0, -1)),
            panDownButton: arrow(50, 86.5, 0, 1, () => this.panCamera(player.id, 0, 1)),
            zoomOutButton: makeShape(polyCircle(39.5, 95, 2.6, 14), controlFill, {
                color: controlLine, border: 2, onClick: () => this.zoomCamera(player.id, -1)
            }),
            zoomOutGlyph: makeShape(ShapeUtils.rectangle(38.2, 94.75, 2.6, 0.5), controlLine, {
                onClick: () => this.zoomCamera(player.id, -1)
            }),
            centerButton: makeShape(polyCircle(46.5, 95, 2.6, 14), controlFill, {
                color: controlLine, border: 2, onClick: () => this.centerCamera(player.id)
            }),
            centerGlyph: makeShape([
                [46.5, 92.9], [48.5, 95], [46.5, 97.1], [44.5, 95], [46.5, 92.9]
            ], controlLine, { onClick: () => this.centerCamera(player.id) }),
            floorButton: makeShape(polyCircle(53.5, 95, 2.6, 14), controlFill, {
                color: controlLine, border: 2, onClick: () => this.focusFloorCamera(player.id)
            }),
            floorGlyph: makeShape([
                [51.7, 96.6], [55.3, 96.6], [54.6, 95.2], [52.4, 95.2], [51.7, 96.6]
            ], controlLine, { onClick: () => this.focusFloorCamera(player.id) }),
            zoomInButton: makeShape(polyCircle(60.5, 95, 2.6, 14), controlFill, {
                color: controlLine, border: 2, onClick: () => this.zoomCamera(player.id, 1)
            }),
            zoomInGlyphH: makeShape(ShapeUtils.rectangle(59.2, 94.75, 2.6, 0.5), controlLine, {
                onClick: () => this.zoomCamera(player.id, 1)
            }),
            zoomInGlyphV: makeShape(ShapeUtils.rectangle(60.25, 93.7, 0.5, 2.6), controlLine, {
                onClick: () => this.zoomCamera(player.id, 1)
            })
        };
        [
            controls.zoomOutButton, controls.zoomOutGlyph,
            controls.centerButton, controls.centerGlyph,
            controls.floorButton, controls.floorGlyph,
            controls.zoomInButton, controls.zoomInGlyphH, controls.zoomInGlyphV
        ].forEach((node) => controlLayer.addChild(node));
        controls.horizontalPanAttached = false;
        controls.verticalPanAttached = false;
        view.controls = controls;
        this.updateCameraControls(player);
    }

    _aquariumBase_updateCameraControls(player) {
        if (!player.view) return;
        if (!player.view.controls) {
            this.buildCameraControls(player);
            return;
        }
        const controls = player.view.controls;
        const horizontalNeeded = this.currentTank().width > this.viewWidth(player) + 0.1;
        const verticalNeeded = this.viewHeight(player) < 99.9;

        if (horizontalNeeded !== controls.horizontalPanAttached) {
            const nodes = [controls.panLeftButton, controls.panRightButton];
            if (horizontalNeeded) nodes.forEach((node) => controls.layer.addChild(node));
            else nodes.forEach((node) => controls.layer.removeChild(node.node.id));
            controls.horizontalPanAttached = horizontalNeeded;
        }
        if (verticalNeeded !== controls.verticalPanAttached) {
            const nodes = [controls.panUpButton, controls.panDownButton];
            if (verticalNeeded) nodes.forEach((node) => controls.layer.addChild(node));
            else nodes.forEach((node) => controls.layer.removeChild(node.node.id));
            controls.verticalPanAttached = verticalNeeded;
        }
    }

    buildPlayerUi(player) {
        const root = player.view.root;
        const scorePanel = makeShape(ShapeUtils.rectangle(2, 2, 24, 16), COLORS.panelSoft, {
            color: player.color,
            border: 3
        });
        const scoreText = makeText(formatNumber(this.economy.money), 14, 4, 4, COLORS.white, 'center');
        const saveText = makeText('', 14, 13, 1.9, COLORS.white, 'center');
        const shopButton = makeShape(ShapeUtils.rectangle(81, 2, 17, 16), COLORS.button, {
            color: COLORS.white,
            border: 3,
            onClick: () => this.toggleShop(player.id)
        });
        const shopButtonText = makeText('SHOP', 89.5, 6, 3.2, COLORS.white, 'center');
        root.addChild(scorePanel);
        root.addChild(scoreText);
        root.addChild(saveText);
        root.addChild(shopButton);
        root.addChild(shopButtonText);
        player.view.ui = {
            scorePanel, scoreText, saveText, shopButton, shopButtonText,
            shopRoot: null, rows: []
        };
    }

    _aquariumBase_buildShopUi(player) {
        const ui = player.view.ui;
        if (ui.shopRoot) return;
        const shopRoot = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        player.view.root.addChild(shopRoot);

        const panel = makeShape(ShapeUtils.rectangle(2, 20, 96, 79), COLORS.panel, {
            color: player.color,
            border: 3
        });
        const fishTab = makeShape(ShapeUtils.rectangle(4, 21, 29, 11), COLORS.buttonHot, {
            onClick: () => this.setShopTab(player.id, 'fish')
        });
        const decorTab = makeShape(ShapeUtils.rectangle(35.5, 21, 29, 11), COLORS.button, {
            onClick: () => this.setShopTab(player.id, 'decor')
        });
        const tankTab = makeShape(ShapeUtils.rectangle(67, 21, 29, 11), COLORS.button, {
            onClick: () => this.setShopTab(player.id, 'tank')
        });
        const fishTabText = makeText('FISH', 18.5, 23, 3, COLORS.white, 'center');
        const decorTabText = makeText('DECOR', 50, 23, 3, COLORS.white, 'center');
        const tankTabText = makeText('TANK', 81.5, 23, 3, COLORS.white, 'center');
        const statusText = makeText('', 53, 3, 2.4, COLORS.gold, 'center');
        const statusTail = makeText('', 53, 11, 2.4, COLORS.gold, 'center');
        const prevPageButton = makeShape(ShapeUtils.rectangle(4, 88, 18, 10), COLORS.buttonDim, {
            color: [88, 145, 161, 255],
            border: 2,
            onClick: () => this.changeShopPage(player.id, -1)
        });
        const nextPageButton = makeShape(ShapeUtils.rectangle(78, 88, 18, 10), COLORS.buttonDim, {
            color: [88, 145, 161, 255],
            border: 2,
            onClick: () => this.changeShopPage(player.id, 1)
        });
        const prevPageText = makeText('<', 13, 89, 3.2, COLORS.white, 'center');
        const nextPageText = makeText('>', 87, 89, 3.2, COLORS.white, 'center');
        const pageText = makeText('', 50, 89, 3, [190, 217, 224, 255], 'center');
        [
            panel, fishTab, decorTab, tankTab,
            fishTabText, decorTabText, tankTabText,
            prevPageButton, nextPageButton, prevPageText, nextPageText, pageText
        ].forEach((node) => shopRoot.addChild(node));

        const rows = [];
        for (let i = 0; i < SHOP_PAGE_SIZE; i++) {
            const y = 34 + i * 18;
            const button = makeShape(ShapeUtils.rectangle(4, y, 92, 16), COLORS.button, {
                color: [88, 145, 161, 255],
                border: 2,
                onClick: () => this.buyRow(player.id, i)
            });
            const name = makeText('', 6, y + 1.5, 3.1, COLORS.white, 'left');
            const detail = makeText('', 6, y + 9.5, 2.65, [190, 217, 224, 255], 'left');
            const cost = makeText('', 94, y + 1.5, 3.1, COLORS.gold, 'right');
            [button, name, detail, cost].forEach((node) => shopRoot.addChild(node));
            rows.push({ button, name, detail, cost, y, attached: true, costAttached: true });
        }

        Object.assign(ui, {
            shopRoot, panel, fishTab, decorTab, tankTab,
            fishTabText, decorTabText, tankTabText, statusText, statusTail,
            prevPageButton, nextPageButton, prevPageText, nextPageText, pageText, rows,
            pagingAttached: true, statusAttached: false
        });
    }

    destroyShopUi(player) {
        const ui = player.view && player.view.ui;
        if (!ui || !ui.shopRoot) return;
        player.view.root.removeChild(ui.shopRoot.node.id);
        Object.assign(ui, {
            shopRoot: null, panel: null, fishTab: null, decorTab: null, tankTab: null,
            fishTabText: null, decorTabText: null, tankTabText: null, statusText: null, statusTail: null,
            prevPageButton: null, nextPageButton: null, prevPageText: null,
            nextPageText: null, pageText: null, rows: [], pagingAttached: false, statusAttached: false
        });
    }

    setShopVisible(player, visible) {
        if (!player.view || !player.view.ui) return;
        player.shopOpen = visible;
        setText(player.view.ui.shopButtonText, visible ? 'CLOSE' : 'SHOP');
        if (visible) this.buildShopUi(player);
        else this.destroyShopUi(player);
    }

    toggleShop(playerId) {
        const player = this.players[playerId];
        if (!player || !player.connected) return;
        this.setShopVisible(player, !player.shopOpen);
        this.updatePlayerUi(player, true);
        this.getViewRoot().node.onStateChange();
    }

    setShopTab(playerId, tab) {
        const player = this.players[playerId];
        if (!player || !player.connected) return;
        player.shopTab = tab === 'tank' ? 'tank' : (tab === 'decor' ? 'decor' : 'fish');
        player.shopPage = 0;
        if (!player.shopOpen) this.setShopVisible(player, true);
        this.updatePlayerUi(player, true);
        this.getViewRoot().node.onStateChange();
    }

    _aquariumBase_shopItems(player) {
        // Show the full creature catalog at every tank tier. Locked creatures remain
        // visible so players can see what future expansions will unlock.
        if (player.shopTab === 'fish') return CATALOG.fish;
        if (player.shopTab === 'decor') return CATALOG.decor;
        return [];
    }

    shopPageCount(player) {
        return Math.max(1, Math.ceil(this.shopItems(player).length / SHOP_PAGE_SIZE));
    }

    changeShopPage(playerId, direction) {
        const player = this.players[playerId];
        if (!player || !player.connected || !player.shopOpen) return;
        const pageCount = this.shopPageCount(player);
        player.shopPage = (player.shopPage + direction + pageCount) % pageCount;
        this.updatePlayerUi(player, true);
        this.getViewRoot().node.onStateChange();
    }

    buyRow(playerId, rowIndex) {
        const player = this.players[playerId];
        if (!player || !player.connected || !player.shopOpen) return;
        const items = this.shopItems(player);
        const item = items[player.shopPage * SHOP_PAGE_SIZE + rowIndex];
        if (item) {
            if (player.shopTab === 'fish') this.buyFish(player, item);
            else if (player.shopTab === 'decor') this.buyDecor(player, item);
            else this.buyWorldItem(player, item);
        }
        this.refreshAllPlayerUi();
        this.getViewRoot().node.onStateChange();
    }

    _aquariumBase_buyFish(player, item) {
        const unlockTier = item.unlockTier || 0;
        if (unlockTier > this.tankTier) {
            const requiredTank = CATALOG.tanks[unlockTier];
            return this.setStatus(player, requiredTank ? `NEEDS ${requiredTank.name}` : 'LOCKED');
        }
        if (this.fish.filter((fish) => !fish.golden).length >= this.effectiveFishCap()) return this.setStatus(player, 'TANK FULL');
        const bought = this.economy.fishPurchases[item.id] || 0;
        const cost = this.economyCost(item.baseCost, bought, 1.42);
        if (this.economy.money < cost) {
            return this.setStatus(player, `NEED ${formatNumber(cost - this.economy.money)}`);
        }
        this.economy.money -= cost;
        this.economy.fishPurchases[item.id] = bought + 1;
        this.addFish(item.id, false, player.camera.x);
        this.setStatus(player, `${item.name} ADDED`);
        this.persist();
    }

    buyDecor(player, item) {
        const unlockTier = item.unlockTier || 0;
        if (unlockTier > this.tankTier) {
            const requiredTank = CATALOG.tanks[unlockTier];
            return this.setStatus(player, requiredTank ? `NEEDS ${requiredTank.name}` : 'LOCKED');
        }
        if (item.id === 'flakes') {
            const cost = this.economyCost(item.baseCost, this.economy.foodLevel, 1.55);
            if (this.economy.money < cost) {
                return this.setStatus(player, `NEED ${formatNumber(cost - this.economy.money)}`);
            }
            this.economy.money -= cost;
            this.economy.foodLevel++;
            this.setGlobalStatus(`FLAKES LV ${this.economy.foodLevel}`);
            this.persist();
            return;
        }

        const globalCount = this.decorCounts[item.id] || 0;
        const maxAllowed = this.decorMax(item);
        if (globalCount >= maxAllowed) return this.setStatus(player, 'MAXED OUT');
        const bought = this.economy.decorPurchases[item.id] || 0;
        const cost = this.economyCost(item.baseCost, bought, 1.5);
        if (this.economy.money < cost) {
            return this.setStatus(player, `NEED ${formatNumber(cost - this.economy.money)}`);
        }
        if (this.accessories.length >= this.poolLimits().accessories) {
            return this.setStatus(player, 'NO DECOR SLOTS');
        }
        this.economy.money -= cost;
        this.economy.decorPurchases[item.id] = bought + 1;
        this.decorCounts[item.id] = globalCount + 1;
        this.activateAccessory(item.id);
        this.setStatus(player, `${item.name} ADDED`);
        this.persist();
    }

    _aquariumBase_buyTankUpgrade(player) {
        const next = this.nextTank();
        if (!next) return this.setStatus(player, 'MAX TANK');
        const cost = next.upgradeCost;
        if (this.economy.money < cost) {
            return this.setStatus(player, `NEED ${formatNumber(cost - this.economy.money)}`);
        }
        this.economy.money -= cost;
        this.tankTier++;
        this.expandStaticWorld(this.tankTier);

        for (const playerId of this.playerOrder) {
            const other = this.players[playerId];
            if (!other || !other.connected) continue;
            other.camera.targetX = WORLD_CENTER_X;
            other.camera.targetY = 50;
            other.camera.targetZoom = Math.max(this.minZoom(), this.tankTier === 1 ? 0.72 : 0.58);
            other.camera.zoom = clamp(other.camera.zoom, this.minZoom(), MAX_ZOOM);
            other.camera.velocity = 0;
            other.camera.velocityY = 0;
            this.clampCamera(other);
            this.updateCameraControls(other);
        }

        const bounds = this.tankBounds();
        for (let i = 0; i < 28; i++) this.emitBubbles(rand(bounds.min, bounds.max), rand(72, 91), 1);
        const newlyUnlocked = CATALOG.fish.filter((item) => (item.unlockTier || 0) === this.tankTier);
        const unlockText = newlyUnlocked.length
            ? `${newlyUnlocked.map((item) => item.name).join(' + ')} UNLOCKED!`
            : `${next.name}!`;
        this.setGlobalStatus(unlockText, 3.5);
        this.persist();
    }

    setStatus(player, text, duration = 1.8) {
        player.status = text;
        player.statusTime = duration;
        if (player.view && player.view.ui && player.shopOpen && player.view.ui.statusText) {
            this.updateShopStatus(player.view.ui, text);
        }
    }

    setGlobalStatus(text, duration = 1.8) {
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player || !player.connected) continue;
            this.setStatus(player, text, duration);
        }
    }

    getFishCost(item) {
        return this.economyCost(item.baseCost, this.economy.fishPurchases[item.id] || 0, 1.42);
    }

    getDecorCost(item) {
        if (item.id === 'flakes') {
            return this.economyCost(item.baseCost, this.economy.foodLevel, 1.55);
        }
        return this.economyCost(item.baseCost, this.economy.decorPurchases[item.id] || 0, 1.5);
    }

    refreshAllPlayerUi() {
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (player && player.connected) this.updatePlayerUi(player, true);
        }
    }

    hideShopPaging(ui) {
        if (!ui.pagingAttached || !ui.shopRoot) return;
        [ui.prevPageButton, ui.nextPageButton, ui.prevPageText, ui.nextPageText, ui.pageText]
            .forEach((node) => ui.shopRoot.removeChild(node.node.id));
        ui.pagingAttached = false;
    }

    showShopPaging(ui) {
        if (ui.pagingAttached || !ui.shopRoot) return;
        [ui.prevPageButton, ui.nextPageButton, ui.prevPageText, ui.nextPageText, ui.pageText]
            .forEach((node) => ui.shopRoot.addChild(node));
        ui.pagingAttached = true;
    }

    updateShopPaging(player) {
        const ui = player.view.ui;
        const pageCount = this.shopPageCount(player);
        player.shopPage = clamp(player.shopPage, 0, pageCount - 1);
        if (pageCount <= 1) {
            this.hideShopPaging(ui);
            return;
        }
        this.showShopPaging(ui);
        ui.prevPageButton.node.coordinates2d = ShapeUtils.rectangle(4, 88, 18, 10);
        ui.prevPageButton.node.fill = COLORS.buttonDim;
        ui.nextPageButton.node.coordinates2d = ShapeUtils.rectangle(78, 88, 18, 10);
        ui.nextPageButton.node.fill = COLORS.buttonDim;
        setText(ui.prevPageText, '<');
        setText(ui.nextPageText, '>');
        setText(ui.pageText, `${player.shopPage + 1}/${pageCount}`);
    }

    setShopStatusAttached(ui, attached) {
        if (!ui.shopRoot || !ui.statusText || ui.statusAttached === attached) return;
        for (const node of [ui.statusText, ui.statusTail]) {
            if (attached) ui.shopRoot.addChild(node);
            else ui.shopRoot.removeChild(node.node.id);
        }
        ui.statusAttached = attached;
    }

    updateShopStatus(ui, text) {
        this.setShopStatusAttached(ui, Boolean(text));
        if (!text) return;
        const split = text.length <= 24 ? text.length : Math.max(1, text.lastIndexOf(' ', 24));
        const lines = [text.slice(0, split), text.slice(split).trim()];
        [ui.statusText, ui.statusTail].forEach((node, index) => {
            setText(node, lines[index]);
            setTextSize(node, Math.min(2.4, 50 / Math.max(1, lines[index].length * .87)));
        });
    }

    setShopCostAttached(ui, row, attached) {
        if (!ui.shopRoot || row.costAttached === attached) return;
        if (attached) ui.shopRoot.addChild(row.cost);
        else ui.shopRoot.removeChild(row.cost.node.id);
        row.costAttached = attached;
    }

    setShopRowAttached(ui, row, attached) {
        if (!ui.shopRoot || row.attached === attached) return;
        const nodes = [row.button, row.name, row.detail, row.cost];
        if (attached) {
            [row.button, row.name, row.detail].forEach((node) => ui.shopRoot.addChild(node));
            if (row.costAttached) ui.shopRoot.addChild(row.cost);
        } else {
            nodes.forEach((node) => ui.shopRoot.removeChild(node.node.id));
        }
        row.attached = attached;
    }

    _aquariumBase_updatePlayerUi(player) {
        if (!player.view || !player.view.ui) return;
        const ui = player.view.ui;
        ui.scorePanel.node.coordinates2d = ShapeUtils.rectangle(2, 2, 24, 16);
        ui.scorePanel.node.fill = player.statusTime > 0 ? COLORS.panelSoft : COLORS.panel;
        ui.scorePanel.node.color = player.color;
        setText(ui.scoreText, formatNumber(this.economy.money));
        setTextColor(ui.scoreText, COLORS.white);
        setText(ui.saveText, { ready: 'Autosave on', saving: 'Saving…', saved: 'Saved', error: 'Save failed', blocked: 'Save unreadable', disabled: 'Session only' }[this.saveState]);
        setTextColor(ui.saveText, this.saveMessage ? COLORS.gold : COLORS.white);
        ui.shopButton.node.coordinates2d = ShapeUtils.rectangle(81, 2, 17, 16);
        ui.shopButton.node.fill = player.shopOpen ? COLORS.buttonHot : COLORS.button;
        ui.shopButton.node.color = COLORS.white;
        setText(ui.shopButtonText, player.shopOpen ? 'CLOSE' : 'SHOP');
        if (!player.shopOpen) return;

        if (!ui.shopRoot) this.buildShopUi(player);
        ui.fishTab.node.fill = player.shopTab === 'fish' ? COLORS.buttonHot : COLORS.buttonDim;
        ui.decorTab.node.fill = player.shopTab === 'decor' ? COLORS.buttonHot : COLORS.buttonDim;
        ui.tankTab.node.fill = player.shopTab === 'tank' ? COLORS.buttonHot : COLORS.buttonDim;
        const status = this.saveMessage
            ? (this.saveBlocked ? 'SAVE UNREADABLE · AUTOSAVE OFF' : 'SAVE FAILED · RETRYING')
            : player.status;
        this.updateShopStatus(ui, status);
        this.updateShopPaging(player);

        // WORLD/tank rows are authored by updatePlayerUi(); the old tutorial/help
        // rows were deliberately removed so every visible row is a real action.
        if (player.shopTab === 'tank') return;

        const allItems = this.shopItems(player);
        const pageStart = player.shopPage * SHOP_PAGE_SIZE;
        const items = allItems.slice(pageStart, pageStart + SHOP_PAGE_SIZE);
        const activeFish = this.fish.reduce((count, fish) => count + (!fish.golden ? 1 : 0), 0);
        ui.rows.forEach((row, index) => {
            const item = items[index];
            if (!item) {
                this.setShopRowAttached(ui, row, false);
                return;
            }
            this.setShopRowAttached(ui, row, true);
            const cost = player.shopTab === 'fish' ? this.getFishCost(item) : this.getDecorCost(item);
            let detailText = '';
            let unavailable = false;
            const unlockTier = item.unlockTier || 0;
            const locked = unlockTier > this.tankTier;
            if (player.shopTab === 'fish') {
                const speciesCount = this.fishCounts[item.id] || 0;
                const reward = item.reward * this.currentTank().rewardScale;
                if (locked) {
                    const requiredTank = CATALOG.tanks[unlockTier];
                    detailText = requiredTank ? `UNLOCK: ${requiredTank.name}` : 'LOCKED';
                } else {
                    detailText = `${speciesCount} OWNED  +${formatNumber(reward)}/BITE`;
                }
                unavailable = locked || activeFish >= this.effectiveFishCap();
            } else if (item.id === 'flakes') {
                detailText = `LEVEL ${this.economy.foodLevel}  ${item.description}`;
            } else if (locked) {
                const requiredTank = CATALOG.tanks[unlockTier];
                detailText = requiredTank ? `UNLOCK: ${requiredTank.name}` : 'LOCKED';
                unavailable = true;
            } else {
                const maxAllowed = this.decorMax(item);
                detailText = `${this.decorCounts[item.id] || 0}/${maxAllowed}  ${item.description}`;
                unavailable = (this.decorCounts[item.id] || 0) >= maxAllowed;
            }
            setText(row.name, item.name);
            setText(row.detail, detailText);
            setTextSize(row.detail, Math.min(2.65, 88 / Math.max(1, detailText.length * .87)));
            this.setShopCostAttached(ui, row, true);
            setText(row.cost, locked ? 'LOCKED' : (unavailable ? 'MAX' : formatNumber(cost)));
            const affordable = this.economy.money >= cost && !unavailable;
            row.button.node.fill = affordable ? COLORS.buttonHot : COLORS.buttonDim;
            row.button.node.color = affordable ? player.color : [76, 92, 102, 255];
            setTextColor(row.name, unavailable ? [145, 158, 164, 255] : COLORS.white);
            setTextColor(row.detail, unavailable ? [114, 127, 134, 255] : [190, 217, 224, 255]);
            setTextColor(row.cost, affordable ? COLORS.gold : [169, 170, 157, 255]);
        });
    }

    addFoodSlots(count) {
        const limit = this.poolLimits().food;
        const amount = Math.max(0, Math.min(count, limit - this.food.length));
        for (let i = 0; i < amount; i++) {
            const food = {
                id: this.nextFoodId++, active: false, x: 0, y: 0, speed: 0, value: 1,
                golden: false, age: 0, settledTime: 0, phase: 0, color: COLORS.gold,
                manualUntil: 0, preferredFishId: 0
            };
            this.food.push(food);
            this.foodById.set(food.id, food);
        }
    }

    ensureFoodSlots(required) {
        while (this.food.length < required && this.food.length < this.poolLimits().food) {
            this.addFoodSlots(POOL_CHUNK.food);
        }
        return this.food.length >= required;
    }

    addBubbleSlots(count) {
        const limit = this.poolLimits().bubbles;
        const amount = Math.max(0, Math.min(count, limit - this.bubbles.length));
        for (let i = 0; i < amount; i++) {
            this.bubbles.push({
                id: this.nextBubbleId++, active: false, x: 0, y: 0,
                speed: 0, size: 0, phase: 0
            });
        }
    }

    ensureBubbleSlots(required) {
        while (this.bubbles.length < required && this.bubbles.length < this.poolLimits().bubbles) {
            this.addBubbleSlots(8);
        }
    }

    addFloaterSlots(count) {
        const limit = this.poolLimits().floaters;
        const amount = Math.max(0, Math.min(count, limit - this.floaters.length));
        for (let i = 0; i < amount; i++) {
            this.floaters.push({
                id: this.nextFloaterId++, active: false, x: 0, y: 0,
                ttl: 0, max: 0, color: COLORS.white, label: ''
            });
        }
    }

    creatureName(kind, id) {
        const offset = kind === 'alien' ? 19 : 0;
        return CREATURE_NAMES[(Math.max(1, id) * 7 + offset) % CREATURE_NAMES.length];
    }

    mutationChance() {
        const gene = this.worldUpgradeLevel ? this.worldUpgradeLevel('gene-garden') : 0;
        const eras = this.progression ? this.progression.completedEras : 0;
        return clamp(BASE_MUTATION_CHANCE + gene * 0.025 + Math.min(0.02, eras * 0.002), 0, 0.14);
    }

    rollCreatureTrait(starter = false) {
        const chance = this.mutationChance() * (starter ? 0.55 : 1);
        if (Math.random() >= chance) return '';
        return CREATURE_TRAITS[Math.floor(Math.random() * CREATURE_TRAITS.length)].id;
    }

    creatureTraitInfo(creatureOrTrait) {
        const id = typeof creatureOrTrait === 'string' ? creatureOrTrait : (creatureOrTrait && creatureOrTrait.trait);
        return CREATURE_TRAITS.find((item) => item.id === id) || null;
    }

    creatureTraitScale(trait) {
        const info = this.creatureTraitInfo(trait);
        return info ? info.scale : 1;
    }

    creatureTraitRewardMultiplier(creature) {
        const info = this.creatureTraitInfo(creature);
        if (!info) return 1;
        const geneLevel = this.worldUpgradeLevel('gene-garden');
        return info.reward * (1 + geneLevel * 0.25);
    }

    creaturePalette(creature) {
        if (creature && creature.golden) return GOLDEN_COLORS;
        const base = creature && creature.species && creature.species.colors ? creature.species.colors : [COLORS.light, COLORS.white, COLORS.gold];
        const trait = creature && creature.trait;
        if (trait === 'neon') return [[49, 245, 225, 255], [82, 129, 255, 255], [238, 255, 255, 255]];
        if (trait === 'royal') return [[129, 78, 211, 255], [255, 207, 72, 255], [255, 244, 194, 255]];
        if (trait === 'ancient') return [[116, 151, 128, 255], [196, 176, 121, 255], [242, 231, 194, 255]];
        if (trait === 'prism') return [[195, 101, 255, 255], [76, 223, 230, 255], [255, 226, 101, 255]];
        if (trait === 'giant') return [interpolateColor(base[0], [255,255,255,255], 0.12), base[1], base[2]];
        if (trait === 'tiny') return [interpolateColor(base[0], [255,255,255,255], 0.28), interpolateColor(base[1], [122,230,245,255], 0.18), base[2]];
        return base;
    }

    applyCreatureIdentity(creature, kind, starter = false) {
        if (!creature) return creature;
        creature.name = creature.name || this.creatureName(kind, creature.id);
        creature.trait = creature.trait || this.rollCreatureTrait(starter);
        creature.bornAt = Number.isFinite(creature.bornAt) ? creature.bornAt : this.time;
        creature.bites = Number.isFinite(creature.bites) ? creature.bites : 0;
        creature.lifetimeEarned = Number.isFinite(creature.lifetimeEarned) ? creature.lifetimeEarned : 0;
        creature.lastFedBy = creature.lastFedBy || '';
        return creature;
    }

    formatCreatureAge(creature) {
        const seconds = Math.max(0, Math.floor(this.time - (creature.bornAt || 0)));
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    }

    buildCreatureInspectionOverlay(player) {
        const view = player && player.view;
        if (!view || view.inspectionOverlay) return;
        const panel = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent, { color: COLORS.transparent, border: 2 });
        const title = makeText('', 4, 21, 3.2, COLORS.white, 'left');
        const species = makeText('', 4, 29, 2.6, [190,217,224,255], 'left');
        const stats = makeText('', 4, 36, 2.6, [220,236,240,255], 'left');
        const bonus = makeText('', 4, 43, 2.6, COLORS.gold, 'left');
        const history = makeText('', 4, 50, 2.4, [180,205,214,255], 'left');
        view.root.addChildren(panel, title, species, stats, bonus, history);
        view.inspectionOverlay = { panel, title, species, stats, bonus, history, visible: false };
    }

    inspectCreature(player, creature) {
        if (!player || !creature) return;
        player.inspection = { kind: creature.kind || 'fish', id: creature.id, until: this.time + INSPECTION_SECONDS };
        this.updateCreatureInspectionOverlay(player);
    }

    inspectedCreature(player) {
        const inspection = player && player.inspection;
        if (!inspection || inspection.until <= this.time) return null;
        return inspection.kind === 'alien' ? this.alienById.get(inspection.id) : this.fishById.get(inspection.id);
    }

    updateCreatureInspectionOverlay(player) {
        const overlay = player && player.view && player.view.inspectionOverlay;
        if (!overlay) return;
        const creature = this.inspectedCreature(player);
        if (player.shopOpen || !creature || !creature.active) {
            if (overlay.visible) {
                overlay.panel.node.coordinates2d = ShapeUtils.rectangle(0,0,0,0);
                overlay.panel.node.fill = COLORS.transparent;
                overlay.panel.node.color = COLORS.transparent;
                [overlay.title, overlay.species, overlay.stats, overlay.bonus, overlay.history].forEach((node) => setText(node, ''));
                overlay.visible = false;
            }
            return;
        }
        const traitInfo = this.creatureTraitInfo(creature);
        const palette = this.creaturePalette(creature);
        const label = creature.golden ? 'GOLDEN' : (traitInfo ? traitInfo.name : '');
        overlay.panel.node.coordinates2d = ShapeUtils.rectangle(2, 20, 76, 36);
        overlay.panel.node.fill = [11,27,43,235];
        overlay.panel.node.color = creature.golden ? GOLDEN_COLORS[0] : (traitInfo ? palette[1] : [95,174,195,220]);
        setText(overlay.title, `${label ? label + ' ' : ''}${creature.name}`);
        setTextSize(overlay.title, Math.min(3.2, 72 / Math.max(1, overlay.title.node.text.text.length * .87)));
        setTextColor(overlay.title, creature.golden ? GOLDEN_COLORS[1] : COLORS.white);
        setText(overlay.species, `${creature.species.name || creature.speciesId} · AGE ${this.formatCreatureAge(creature)}`);
        setText(overlay.stats, `${creature.bites || 0} BITES · ${this.formatCompact(creature.lifetimeEarned || 0)} EARNED`);
        const multiplier = (creature.golden ? this.goldenRewardMultiplier() : 1) * this.creatureTraitRewardMultiplier(creature);
        setText(overlay.bonus, multiplier > 1 ? `PERSONAL VALUE x${this.formatMultiplier(multiplier)}` : 'STANDARD VALUE');
        setText(overlay.history, creature.lastFedBy ? `LAST FED BY ${creature.lastFedBy}` : 'CLICKING CLOSE-UP ALSO FEEDS');
        overlay.visible = true;
    }

    addFish(speciesId, starter, preferredX = WORLD_CENTER_X) {
        const species = CATALOG.fish.find((item) => item.id === speciesId);
        if (!species || this.fish.filter((fish) => !fish.golden).length >= this.effectiveFishCap()) return false;
        const bounds = this.tankBounds();
        const spawnMin = Math.max(bounds.min + 4, preferredX - 42);
        const spawnMax = Math.min(bounds.max - 4, preferredX + 42);
        const dir = Math.random() < 0.5 ? -1 : 1;
        const profile = species.behavior || {};
        const fish = {
            id: this.nextFishId++,
            active: true,
            hidden: false,
            hiddenUntil: 0,
            biome: 'water',
            kind: 'fish',
            speciesId,
            species,
            x: starter ? rand(bounds.min + 7, bounds.max - 7) : rand(spawnMin, Math.max(spawnMin + 1, spawnMax)),
            y: rand(profile.depthMin || 15, profile.depthMax || 76),
            dir,
            scale: rand(0.88, 1.18),
            speed: species.speed * rand(0.88, 1.14),
            phase: rand(0, TAU),
            vx: dir * species.speed * rand(0.35, 0.62),
            vy: rand(-0.5, 0.5),
            desiredVx: dir * species.speed * 0.55,
            desiredVy: 0,
            targetX: rand(bounds.min + 5, bounds.max - 5),
            targetY: rand(profile.depthMin || 14, profile.depthMax || 76),
            targetTimer: rand(2, 7),
            activity: profile.temperament === 'school' ? 'school' : 'cruise',
            activityUntil: this.time + rand(2, 7),
            interestId: 0,
            partnerId: 0,
            foodTargetId: 0,
            hunger: rand(0.05, 0.75),
            hungerPulse: 0
        };
        this.applyCreatureIdentity(fish, 'fish', starter);
        fish.scale *= this.creatureTraitScale(fish.trait);
        this.fish.push(fish);
        this.fishById.set(fish.id, fish);
        this.fishCounts[speciesId] = (this.fishCounts[speciesId] || 0) + 1;
        this._renderSpatialIndexTime = -1;
        if (!starter) this.emitBubbles(fish.x, fish.y, 6);
        return true;
    }

    _aquariumBase_activateAccessory(type) {
        const typeIndex = this.accessories.reduce((count, item) => count + (item.type === type ? 1 : 0), 0);
        const bounds = this.tankBounds();
        const usable = Math.max(10, bounds.max - bounds.min - 10);
        const typeOffsets = {
            plant: 0.08, coral: 0.42, bubbler: 0.72, castle: 0.25,
            feeder: 0.58, current: 0.9, cave: 0.16, beacon: 0.66, treasure: 0.36
        };
        const t = ((typeOffsets[type] || 0) + typeIndex * 0.61803398875) % 1;
        const row = typeIndex % 3;
        let x = bounds.min + 5 + usable * t;
        let y = 89.8 + row * 1.55;
        if (type === 'feeder') y = 8.5 + row * 2.2;
        if (type === 'current') y = 73 + row * 5;
        if (type === 'beacon') y = 84 + row * 2.4;
        const accessory = {
            id: this.nextAccessoryId++,
            active: true,
            type,
            x,
            y,
            phase: rand(0, TAU),
            direction: Math.random() < 0.5 ? -1 : 1,
            speed: type === 'feeder' ? rand(3.2, 5.2) : 0,
            nextAction: this.time + rand(5, 12)
        };
        this.accessories.push(accessory);
        this.accessoryById.set(accessory.id, accessory);
    }

    dropFood(playerId, x, y, golden, targetFishId = 0) {
        const player = this.players[playerId];
        if (!golden && (!player || !player.connected)) return false;
        if (!golden && player.feedCooldown > 0) return false;
        if (!golden) {
            player.feedCooldown = 0.09;
            this.requestFishClusterFocus(player, x, y);
        }
        return this.spawnFood(x, y, {
            golden: !!golden,
            color: golden ? COLORS.gold : player.color,
            valueMultiplier: golden ? 2 : 1,
            allowGrow: !golden,
            manual: true,
            ownerPlayerId: playerId,
            targetFishId
        });
    }

    spawnSystemFood(x, y, options = {}) {
        return this.spawnFood(x, y, {
            golden: !!options.golden,
            color: options.color || (options.golden ? COLORS.gold : [222, 174, 96, 255]),
            valueMultiplier: Number.isFinite(options.valueMultiplier) ? options.valueMultiplier : 1,
            allowGrow: options.allowGrow !== false,
            manual: false
        });
    }

    _aquariumBase_spawnFood(x, y, options = {}) {
        const golden = !!options.golden;
        const manual = !!options.manual;
        const food = this.findFoodSlot(options.allowGrow !== false);
        if (!food) return false;
        food.active = true;
        const bounds = this.tankBounds();
        food.x = clamp(x, bounds.min + 2.5, bounds.max - 2.5);
        food.y = clamp(y, 7, 80);
        food.speed = golden ? rand(2.4, 3.2) : (manual ? rand(2.0, 2.8) : rand(3.2, 4.8));
        const multiplier = Math.max(0.1, Number.isFinite(options.valueMultiplier) ? options.valueMultiplier : 1);
        food.value = Math.max(1, Math.floor((1 + this.economy.foodLevel) * multiplier));
        food.golden = golden;
        food.age = 0;
        food.settledTime = 0;
        food.phase = rand(0, TAU);
        food.color = options.color || (golden ? COLORS.gold : [222, 174, 96, 255]);
        food.manualUntil = manual ? this.time + MANUAL_FOOD_PRIORITY_SECONDS : 0;
        food.preferredFishId = 0;
        food.ownerPlayerId = Number.isFinite(options.ownerPlayerId) ? options.ownerPlayerId : 0;
        this.emitBubbles(food.x, food.y, golden ? 4 : 2);

        // Manual clicks are the core clicker interaction. If the player drops a
        // pellet directly on a fish, consume it immediately instead of waiting for
        // the lower-frequency behavior pass to claim it. Otherwise reserve the
        // fresh pellet for the nearest fish and point that fish at it immediately.
        if (manual) this.primeManualFood(food, options.targetFishId);
        return true;
    }

    findFoodSlot(allowGrow) {
        const free = this.food.find((food) => !food.active);
        if (free) return free;
        if (allowGrow && this.food.length < this.poolLimits().food) {
            const before = this.food.length;
            this.ensureFoodSlots(before + 1);
            if (this.food.length > before) return this.food[before];
        }
        let oldest = this.food[0];
        for (let i = 1; i < this.food.length; i++) {
            if (this.food[i].age > oldest.age) oldest = this.food[i];
        }
        return oldest;
    }

    fishContainsPoint(fish, x, y) {
        if (!fish || !fish.active || fish.hidden) return false;
        const halfWidth = Math.max(1.7, fish.species.length * fish.scale * 0.72);
        const halfHeight = Math.max(1.2, fish.species.height * fish.scale * 0.78);
        const nx = (x - fish.x) / halfWidth;
        const ny = (y - fish.y) / halfHeight;
        return nx * nx + ny * ny <= 1;
    }

    pointFishAtFood(fish, food, speedFactor = 1.28) {
        if (!fish || !food || !fish.active || fish.hidden || !food.active) return false;
        const dx = food.x - fish.x;
        const dy = food.y - fish.y;
        const length = Math.max(0.001, Math.hypot(dx, dy));
        const speed = fish.speed * speedFactor;
        fish.foodTargetId = food.id;
        fish.activity = 'feeding';
        fish.activityUntil = this.time + MANUAL_FOOD_PRIORITY_SECONDS;
        fish.desiredVx = dx / length * speed;
        fish.desiredVy = dy / length * speed;
        if (Math.abs(dx) > 0.05) fish.dir = dx >= 0 ? 1 : -1;
        return true;
    }

    consumeFood(food, fish, feedbackX = fish.x, feedbackY = fish.y) {
        if (!food || !fish || !food.active || !fish.active || fish.hidden) return false;
        food.active = false;
        food.manualUntil = 0;
        food.preferredFishId = 0;
        const gain = this.awardFood(food, fish, feedbackX, feedbackY);
        fish.hunger = 0;
        fish.foodTargetId = 0;
        fish.activity = 'cruise';
        fish.activityUntil = 0;
        if (fish.golden) this.claimGoldenVisitor(fish, gain);
        return true;
    }

    primeManualFood(food, targetFishId = 0) {
        if (!food || !food.active) return false;

        // A rendered cluster is a truthful visual summary of several logical fish.
        // Clicking that representative should feed one of its actual members even
        // when no logical fish happens to sit at the cluster centroid.
        if (targetFishId) {
            const targeted = this.fishById.get(targetFishId);
            if (targeted && targeted.active && !targeted.hidden) {
                return this.consumeFood(food, targeted, food.x, food.y);
            }
        }

        let nearest = null;
        let nearestDistance = Infinity;
        for (const fish of this.fish) {
            if (!fish.active || fish.hidden) continue;
            if (this.fishContainsPoint(fish, food.x, food.y)) {
                return this.consumeFood(food, fish, food.x, food.y);
            }
            const d = dist(fish.x, fish.y, food.x, food.y);
            const instantRadius = Math.max(
                MANUAL_FOOD_INSTANT_RADIUS,
                fish.species.length * fish.scale * 1.05
            );
            if (d <= instantRadius) {
                return this.consumeFood(food, fish, food.x, food.y);
            }
            if (d < nearestDistance && d <= MANUAL_FOOD_ATTRACTION) {
                nearest = fish;
                nearestDistance = d;
            }
        }

        if (nearest) {
            food.preferredFishId = nearest.id;
            this.pointFishAtFood(nearest, food);
        }
        return false;
    }

    emitBubbles(x, y, count) {
        this.ensureBubbleSlots(Math.min(this.poolLimits().bubbles, this.bubbles.length + count));
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
        let floater = this.floaters.find((item) => !item.active);
        if (!floater && this.floaters.length < this.poolLimits().floaters) {
            const before = this.floaters.length;
            this.addFloaterSlots(4);
            floater = this.floaters[before];
        }
        if (!floater) return;
        floater.active = true;
        floater.x = x;
        floater.y = y;
        floater.ttl = 1;
        floater.max = 1;
        floater.color = color;
        floater.label = `+${formatNumber(value)}`;
    }

    globalRewardMultiplier() {
        return this.currentTank().rewardScale * this.eraRewardMultiplier() * this.worldCrownRewardMultiplier() * (
            1 +
            (this.decorCounts.plant || 0) * 0.02 +
            (this.decorCounts.coral || 0) * 0.05 +
            (this.decorCounts.castle || 0) * 0.15
        );
    }

    awardFood(food, fish, feedbackX = fish.x, feedbackY = fish.y) {
        const rareMultiplier = fish.golden ? this.goldenRewardMultiplier() : 1;
        const traitMultiplier = this.creatureTraitRewardMultiplier(fish);
        const eventMultiplier = this.worldEventRewardMultiplier('water');
        const raw = food.value * this.waterFoodValueMultiplier() * fish.species.reward * this.globalRewardMultiplier() * this.waterRewardMultiplier() * rareMultiplier * traitMultiplier * eventMultiplier;
        const gain = Math.max(1, Math.floor(raw));
        this.economy.money = Math.min(MAX_POINTS, this.economy.money + gain);
        this.economy.totalEarned = Math.min(MAX_POINTS, this.economy.totalEarned + gain);
        this.recordProgressionGain(gain);
        this.economy.foodEaten++;
        fish.bites = (fish.bites || 0) + 1;
        fish.lifetimeEarned = Math.min(MAX_POINTS, (fish.lifetimeEarned || 0) + gain);
        const owner = food.ownerPlayerId ? this.players[food.ownerPlayerId] : null;
        if (owner) fish.lastFedBy = owner.name;
        this.spawnFloater(
            feedbackX,
            feedbackY - fish.species.height * fish.scale * 0.8,
            gain,
            fish.golden ? GOLDEN_COLORS[0] : food.color
        );
        if (gain >= 50) this.emitBubbles(feedbackX, feedbackY, fish.golden ? 16 : 5);
        return gain;
    }

    buildSpatialGrid(items, cellSize, predicate) {
        const grid = new Map();
        for (const item of items) {
            if (predicate && !predicate(item)) continue;
            const cx = Math.floor(item.x / cellSize);
            const cy = Math.floor(item.y / cellSize);
            const key = cx * 4096 + cy;
            let bucket = grid.get(key);
            if (!bucket) {
                bucket = [];
                grid.set(key, bucket);
            }
            bucket.push(item);
        }
        return grid;
    }

    querySpatialGrid(grid, x, y, radius, cellSize, maxItems = Infinity) {
        const result = [];
        const minX = Math.floor((x - radius) / cellSize);
        const maxX = Math.floor((x + radius) / cellSize);
        const minY = Math.floor((y - radius) / cellSize);
        const maxY = Math.floor((y + radius) / cellSize);
        for (let cx = minX; cx <= maxX; cx++) {
            for (let cy = minY; cy <= maxY; cy++) {
                const bucket = grid.get(cx * 4096 + cy);
                if (!bucket) continue;
                for (const item of bucket) {
                    result.push(item);
                    if (result.length >= maxItems) return result;
                }
            }
        }
        return result;
    }


    rebuildRenderGrid(grid, items, predicate) {
        grid.clear();
        for (const item of items) {
            if (predicate && !predicate(item)) continue;
            const cx = Math.floor(item.x / RENDER_GRID_SIZE);
            const cy = Math.floor(item.y / RENDER_GRID_SIZE);
            const key = cx * 4096 + cy;
            let bucket = grid.get(key);
            if (!bucket) {
                bucket = [];
                grid.set(key, bucket);
            }
            bucket.push(item);
        }
    }

    creatureBiomeProfile(biomeId) {
        return CREATURE_BIOMES[biomeId] || null;
    }

    creatureBiomeItems(biomeId) {
        const profile = this.creatureBiomeProfile(biomeId);
        if (!profile) return [];
        const items = this[profile.collectionKey];
        return Array.isArray(items) ? items : [];
    }

    rebuildRenderSpatialIndexes() {
        for (const biomeId in CREATURE_BIOMES) {
            const profile = CREATURE_BIOMES[biomeId];
            const grid = this._renderCreatureGrids[biomeId];
            if (!grid) continue;
            this.rebuildRenderGrid(
                grid,
                this.creatureBiomeItems(biomeId),
                (creature) => creature.active && (!profile.hideHidden || !creature.hidden)
            );
        }
        this._renderSpatialIndexTime = this.time;
    }

    ensureRenderSpatialIndexes() {
        if (this._renderSpatialIndexTime !== this.time) this.rebuildRenderSpatialIndexes();
    }

    queryRenderGridRect(grid, rect) {
        const result = [];
        const minCellX = Math.floor(rect.minX / RENDER_GRID_SIZE);
        const maxCellX = Math.floor(rect.maxX / RENDER_GRID_SIZE);
        const minCellY = Math.floor(rect.minY / RENDER_GRID_SIZE);
        const maxCellY = Math.floor(rect.maxY / RENDER_GRID_SIZE);
        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cy = minCellY; cy <= maxCellY; cy++) {
                const bucket = grid.get(cx * 4096 + cy);
                if (!bucket) continue;
                for (const item of bucket) {
                    if (
                        item.x >= rect.minX && item.x <= rect.maxX &&
                        item.y >= rect.minY && item.y <= rect.maxY
                    ) result.push(item);
                }
            }
        }
        return result;
    }

    visibleRenderCreatures(player, biomeId, margin = 0) {
        this.ensureRenderSpatialIndexes();
        const grid = this._renderCreatureGrids[biomeId];
        if (!grid) return [];
        return this.queryRenderGridRect(grid, this.visibleWorldRect(player, margin));
    }

    // Compatibility/readability wrappers for behavior-specific code.
    visibleRenderFish(player, margin = 0) {
        return this.visibleRenderCreatures(player, 'water', margin);
    }

    visibleRenderAliens(player, margin = 0) {
        return this.visibleRenderCreatures(player, 'space', margin);
    }

    behaviorProfile(fish) {
        const species = fish.species;
        if (species._aquariumBehaviorProfile) return species._aquariumBehaviorProfile;
        const profile = species.behavior || {};
        const normalized = {
            temperament: profile.temperament || 'social',
            schooling: Number.isFinite(profile.schooling) ? profile.schooling : 0.4,
            curiosity: Number.isFinite(profile.curiosity) ? profile.curiosity : 0.5,
            separation: Number.isFinite(profile.separation) ? profile.separation : 1,
            depthMin: Number.isFinite(profile.depthMin) ? profile.depthMin : 14,
            depthMax: Number.isFinite(profile.depthMax) ? profile.depthMax : 76
        };
        species._aquariumBehaviorProfile = normalized;
        return normalized;
    }

    nearbyAccessory(fish, accessories, maxDistance) {
        let best = null;
        let bestDistance = maxDistance;
        for (const accessory of accessories) {
            const d = dist(fish.x, fish.y, accessory.x, accessory.y - 4);
            if (d < bestDistance) {
                best = accessory;
                bestDistance = d;
            }
        }
        return best;
    }

    chooseFishActivity(fish, context, neighbors) {
        const profile = this.behaviorProfile(fish);
        fish.interestId = 0;
        fish.partnerId = 0;
        fish.activityUntil = this.time + rand(3.5, 9);

        if (profile.temperament === 'patrol') {
            fish.activity = 'patrol';
            const bounds = this.tankBounds();
            fish.targetX = fish.dir > 0 ? bounds.max - 6 : bounds.min + 6;
            fish.targetY = clamp(fish.y + rand(-9, 9), profile.depthMin, profile.depthMax);
            return;
        }

        const nearbyCave = context.caves.length && Math.random() < profile.curiosity * 0.18
            ? this.nearbyAccessory(fish, context.caves, 95)
            : null;
        if (nearbyCave) {
            fish.activity = 'cave';
            fish.interestId = nearbyCave.id;
            fish.activityUntil = this.time + rand(8, 15);
            return;
        }

        const sameSpecies = neighbors.filter((other) => other.id !== fish.id && other.speciesId === fish.speciesId);
        if (sameSpecies.length && Math.random() < (0.08 + profile.curiosity * 0.13)) {
            const partner = sameSpecies[Math.floor(Math.random() * sameSpecies.length)];
            fish.activity = 'play';
            fish.partnerId = partner.id;
            fish.activityUntil = this.time + rand(2.5, 5.5);
            return;
        }

        const inspectable = context.inspectable;
        if (inspectable.length && Math.random() < profile.curiosity * 0.42) {
            const accessory = this.nearbyAccessory(fish, inspectable, 120);
            if (accessory) {
                fish.activity = 'inspect';
                fish.interestId = accessory.id;
                fish.activityUntil = this.time + rand(4, 9);
                return;
            }
        }

        if (profile.temperament === 'school' || Math.random() < profile.schooling * 0.62) {
            fish.activity = 'school';
            return;
        }

        fish.activity = profile.temperament === 'lurker' ? 'lurk' : 'cruise';
        const bounds = this.tankBounds();
        fish.targetX = rand(bounds.min + 5, bounds.max - 5);
        fish.targetY = rand(profile.depthMin, profile.depthMax);
        fish.targetTimer = rand(3, 9);
    }

    chooseFoodTarget(fish, foodGrid, claims) {
        const attraction = Math.max(
            MANUAL_FOOD_ATTRACTION,
            24 + (this.decorCounts.plant || 0) * 0.35
        );
        const candidates = this.querySpatialGrid(foodGrid, fish.x, fish.y, attraction, FOOD_GRID_SIZE);
        let best = null;
        let bestScore = Infinity;
        for (const food of candidates) {
            if (!food.active) continue;
            const d = dist(fish.x, fish.y, food.x, food.y);
            if (d > attraction) continue;

            const manualPriority = food.manualUntil > this.time;
            if (manualPriority && food.preferredFishId && food.preferredFishId !== fish.id) continue;

            const claimCount = claims.get(food.id) || 0;
            const maxClaims = manualPriority ? 1 : (food.golden ? FOOD_MAX_CHASERS + 2 : FOOD_MAX_CHASERS);
            if (claimCount >= maxClaims) continue;
            if (!food.golden && !manualPriority && fish.hunger < 0.2) continue;

            const score =
                d +
                claimCount * 5.5 -
                (food.golden ? 5 : 0) -
                (manualPriority ? 18 : 0) -
                fish.hunger * 3;
            if (score < bestScore) {
                best = food;
                bestScore = score;
            }
        }
        if (best) claims.set(best.id, (claims.get(best.id) || 0) + 1);
        return best;
    }

    updateFishBehavior() {
        this.behaviorFrame++;
        const visibleFish = this.fish.filter((fish) => fish.active && !fish.hidden);
        const fishGrid = this.buildSpatialGrid(visibleFish, FISH_GRID_SIZE);
        const foodGrid = this.buildSpatialGrid(this.food, FOOD_GRID_SIZE, (food) => food.active);
        const claims = new Map();
        const context = {
            caves: this.accessories.filter((item) => item.active && item.type === 'cave'),
            beacons: this.accessories.filter((item) => item.active && item.type === 'beacon'),
            currents: this.accessories.filter((item) => item.active && item.type === 'current'),
            inspectable: this.accessories.filter((item) => item.active && (
                item.type === 'plant' || item.type === 'coral' || item.type === 'castle' ||
                item.type === 'treasure' || item.type === 'current' || item.type === 'beacon'
            ))
        };

        // Hungrier fish get first choice, but every food item accepts only a few
        // chasers. This prevents one bubbler flake from pulling the entire tank.
        const ordered = visibleFish.slice().sort((a, b) => b.hunger - a.hunger || a.id - b.id);
        for (const fish of ordered) {
            const profile = this.behaviorProfile(fish);
            const neighbors = this.querySpatialGrid(fishGrid, fish.x, fish.y, 16, FISH_GRID_SIZE, MAX_NEIGHBORS * 4);
            const food = this.chooseFoodTarget(fish, foodGrid, claims);
            let targetX = fish.targetX;
            let targetY = fish.targetY;
            let targetWeight = 0.65;
            let speedFactor = 0.72;

            if (food) {
                fish.foodTargetId = food.id;
                fish.activity = 'feeding';
                targetX = food.x;
                targetY = food.y;
                targetWeight = 1.5;
                speedFactor = 1.18;
            } else {
                fish.foodTargetId = 0;
                if (fish.activityUntil <= this.time || fish.activity === 'feeding') {
                    this.chooseFishActivity(fish, context, neighbors);
                }

                if (fish.activity === 'cave') {
                    const cave = this.accessoryById.get(fish.interestId);
                    if (!cave || !cave.active) {
                        fish.activityUntil = 0;
                    } else {
                        targetX = cave.x;
                        targetY = cave.y - 3.2;
                        targetWeight = 1.25;
                        speedFactor = 0.65;
                        if (dist(fish.x, fish.y, targetX, targetY) < 1.7) {
                            fish.hidden = true;
                            fish.hiddenUntil = this.time + rand(2.5, 6.5);
                            fish.vx = 0;
                            fish.vy = 0;
                            fish.desiredVx = 0;
                            fish.desiredVy = 0;
                            continue;
                        }
                    }
                } else if (fish.activity === 'inspect') {
                    const accessory = this.accessoryById.get(fish.interestId);
                    if (!accessory || !accessory.active) {
                        fish.activityUntil = 0;
                    } else {
                        const orbit = 4 + fish.scale * 1.5;
                        targetX = accessory.x + Math.cos(this.time * 0.7 + fish.phase) * orbit;
                        targetY = accessory.y - 5 + Math.sin(this.time * 0.9 + fish.phase) * 3;
                        targetWeight = 0.9;
                        speedFactor = profile.temperament === 'lurker' ? 0.42 : 0.58;
                    }
                } else if (fish.activity === 'play') {
                    const partner = this.fishById.get(fish.partnerId);
                    if (!partner || !partner.active || partner.hidden) {
                        fish.activityUntil = 0;
                    } else {
                        const angle = this.time * 1.3 + fish.phase;
                        targetX = partner.x + Math.cos(angle) * 4.5;
                        targetY = partner.y + Math.sin(angle) * 2.8;
                        targetWeight = 0.95;
                        speedFactor = 0.82;
                    }
                } else if (fish.activity === 'patrol') {
                    if (Math.abs(fish.targetX - fish.x) < 5) {
                        const bounds = this.tankBounds();
                        fish.dir *= -1;
                        fish.targetX = fish.dir > 0 ? bounds.max - 6 : bounds.min + 6;
                        fish.targetY = rand(profile.depthMin, profile.depthMax);
                    }
                    targetX = fish.targetX;
                    targetY = fish.targetY;
                    targetWeight = 1.05;
                    speedFactor = 0.82;
                } else if (fish.activity === 'lurk') {
                    if (fish.targetTimer <= 0 || dist(fish.x, fish.y, fish.targetX, fish.targetY) < 2) {
                        const bounds = this.tankBounds();
                        fish.targetTimer = rand(5, 12);
                        fish.targetX = rand(bounds.min + 5, bounds.max - 5);
                        fish.targetY = rand(Math.max(40, profile.depthMin), profile.depthMax);
                    }
                    targetX = fish.targetX;
                    targetY = fish.targetY;
                    targetWeight = 0.55;
                    speedFactor = 0.38;
                } else if (fish.activity === 'cruise') {
                    if (fish.targetTimer <= 0 || dist(fish.x, fish.y, fish.targetX, fish.targetY) < 2) {
                        const bounds = this.tankBounds();
                        fish.targetTimer = rand(3, 9);
                        fish.targetX = rand(bounds.min + 5, bounds.max - 5);
                        fish.targetY = rand(profile.depthMin, profile.depthMax);
                    }
                    targetX = fish.targetX;
                    targetY = fish.targetY + Math.sin(this.time * 0.8 + fish.phase) * 1.4;
                    speedFactor = profile.temperament === 'glider' ? 0.58 : 0.68;
                } else {
                    targetWeight = 0.28;
                    speedFactor = 0.66;
                }
            }

            let steerX = 0;
            let steerY = 0;
            const dx = targetX - fish.x;
            const dy = targetY - fish.y;
            const targetLength = Math.max(0.001, Math.hypot(dx, dy));
            steerX += dx / targetLength * targetWeight;
            steerY += dy / targetLength * targetWeight * 0.72;

            let separationX = 0;
            let separationY = 0;
            let alignX = 0;
            let alignY = 0;
            let cohesionX = 0;
            let cohesionY = 0;
            let sameCount = 0;
            let neighborCount = 0;
            for (const other of neighbors) {
                if (other.id === fish.id || other.hidden) continue;
                const ndx = fish.x - other.x;
                const ndy = fish.y - other.y;
                const d2 = ndx * ndx + ndy * ndy;
                if (d2 <= 0.0001 || d2 > 256) continue;
                const d = Math.sqrt(d2);
                const personalSpace = (fish.species.length * fish.scale + other.species.length * other.scale) * 0.42;
                if (d < personalSpace + 2.4) {
                    const force = (personalSpace + 2.4 - d) / Math.max(0.5, d);
                    separationX += ndx * force;
                    separationY += ndy * force;
                }
                if (other.speciesId === fish.speciesId && sameCount < MAX_NEIGHBORS) {
                    alignX += other.vx;
                    alignY += other.vy;
                    cohesionX += other.x;
                    cohesionY += other.y;
                    sameCount++;
                }
                neighborCount++;
                if (neighborCount >= MAX_NEIGHBORS * 2) break;
            }

            let schooling = profile.schooling;
            let nearestBeacon = null;
            let beaconDistance = 34;
            for (const beacon of context.beacons) {
                const d = dist(fish.x, fish.y, beacon.x, beacon.y - 8);
                if (d < beaconDistance) {
                    nearestBeacon = beacon;
                    beaconDistance = d;
                }
            }
            if (nearestBeacon) {
                schooling = Math.min(1.25, schooling + 0.55 * (1 - beaconDistance / 34));
                const bx = nearestBeacon.x - fish.x;
                const by = nearestBeacon.y - 9 - fish.y;
                const bl = Math.max(1, Math.hypot(bx, by));
                steerX += bx / bl * 0.16;
                steerY += by / bl * 0.1;
            }

            if (sameCount > 0 && schooling > 0) {
                alignX /= sameCount;
                alignY /= sameCount;
                cohesionX = cohesionX / sameCount - fish.x;
                cohesionY = cohesionY / sameCount - fish.y;
                const al = Math.max(0.001, Math.hypot(alignX, alignY));
                const cl = Math.max(0.001, Math.hypot(cohesionX, cohesionY));
                steerX += alignX / al * schooling * 0.55;
                steerY += alignY / al * schooling * 0.34;
                steerX += cohesionX / cl * schooling * 0.38;
                steerY += cohesionY / cl * schooling * 0.25;
            }

            const sl = Math.hypot(separationX, separationY);
            if (sl > 0.001) {
                steerX += separationX / sl * profile.separation * 1.15;
                steerY += separationY / sl * profile.separation * 0.9;
            }

            for (const current of context.currents) {
                const d = dist(fish.x, fish.y, current.x, current.y - 4);
                if (d > 32) continue;
                const strength = (1 - d / 32) * 0.9;
                steerX += current.direction * strength;
                steerY += Math.sin(this.time * 1.2 + current.phase + fish.phase) * strength * 0.16;
                speedFactor += strength * 0.22;
            }

            if (profile.temperament === 'territorial') {
                steerX += separationX * 0.06;
                steerY += separationY * 0.04;
            }
            if (profile.temperament === 'glider') {
                steerY += Math.sin(this.time * 0.34 + fish.phase) * 0.18;
            }

            const steerLength = Math.max(0.001, Math.hypot(steerX, steerY));
            const desiredSpeed = fish.speed * clamp(speedFactor, 0.25, 1.45);
            fish.desiredVx = steerX / steerLength * desiredSpeed;
            fish.desiredVy = steerY / steerLength * desiredSpeed * 0.62;
            if (Math.abs(fish.desiredVx) > 0.12) fish.dir = fish.desiredVx >= 0 ? 1 : -1;
        }
    }

    activeWorldEvent(id) {
        const active = this.worldEvent && this.worldEvent.active;
        return active && (!id || active.id === id) && active.until > this.time ? active : null;
    }

    worldEventRewardMultiplier(biome) {
        const active = this.activeWorldEvent();
        if (!active || active.biome !== biome) return 1;
        let base = active.reward || 1;
        if (active.id === 'great-migration') base = 1 + (base - 1) * this.migrationBonusMultiplier();
        return 1 + (base - 1) * this.eventBonusStrength();
    }

    chooseWorldEvent() {
        const available = WORLD_EVENT_TYPES.filter((event) => event.biome !== 'space' || this.spaceUnlocked);
        if (!available.length) return null;
        // Avoid immediate repeats when possible.
        const previous = this.worldEvent && this.worldEvent.lastId;
        const choices = available.filter((event) => event.id !== previous);
        const pool = choices.length ? choices : available;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    startWorldEvent() {
        const type = this.chooseWorldEvent();
        if (!type) return false;
        const serial = (this.worldEvent.serial || 0) + 1;
        this.worldEvent.serial = serial;
        this.worldEvent.lastId = type.id;
        this.worldEvent.active = {
            id: type.id,
            name: type.name,
            subtext: type.subtext,
            biome: type.biome,
            reward: type.reward,
            until: this.time + WORLD_EVENT_DURATION_SECONDS,
            nextPulse: this.time,
            direction: Math.random() < 0.5 ? -1 : 1,
            serial
        };
        if (type.id === 'feeding-frenzy') {
            for (const fish of this.fish) if (fish.active && !fish.golden) fish.hunger = Math.max(fish.hunger, 0.92);
        }
        this.setGlobalStatus(type.name, 4.0);
        this.setProgressionCelebration(type.name, `${type.subtext} x${this.formatMultiplier(this.worldEventRewardMultiplier(type.biome))}`, { kind: 'era', duration: 5.0 });
        return true;
    }

    endWorldEvent() {
        const active = this.worldEvent && this.worldEvent.active;
        if (!active) return;
        this.setGlobalStatus(`${active.name} ENDED`, 2.2);
        this.worldEvent.active = null;
        this.worldEvent.nextAt = this.time + this.nextWorldEventDelay();
    }

    updateWorldEvent(hasConnectedPlayer) {
        const state = this.worldEvent;
        if (!state) return;
        const active = state.active;
        if (!active) {
            if (hasConnectedPlayer && this.time >= state.nextAt) this.startWorldEvent();
            return;
        }
        if (this.time >= active.until) {
            this.endWorldEvent();
            return;
        }
        const bounds = this.tankBounds();
        if (active.id === 'great-migration') {
            for (const fish of this.fish) {
                if (!fish.active || fish.hidden || fish.golden || fish.foodTargetId) continue;
                fish.activity = 'migration';
                fish.desiredVx = active.direction * fish.speed * 1.18;
                fish.desiredVy = Math.sin(this.time * 0.55 + fish.phase) * fish.speed * 0.18;
                fish.dir = active.direction;
            }
        }
        if (this.time < active.nextPulse) return;
        if (active.id === 'meteor-shower' && this.spaceUnlocked) {
            active.nextPulse = this.time + 0.38;
            this.spawnCosmicFood(rand(bounds.min + 6, bounds.max - 6), rand(-88, -60), { valueMultiplier: 3.5 });
        } else if (active.id === 'treasure-tide') {
            active.nextPulse = this.time + 0.52;
            this.spawnSystemFood(rand(bounds.min + 5, bounds.max - 5), rand(7, 13), { golden: true, valueMultiplier: 3.2 });
        } else if (active.id === 'feeding-frenzy') {
            active.nextPulse = this.time + 1.5;
            for (let i = 0; i < this.fish.length; i += 3) {
                const fish = this.fish[i];
                if (fish && fish.active && !fish.golden) fish.hunger = Math.max(fish.hunger, 0.78);
            }
        } else {
            active.nextPulse = this.time + 1.0;
        }
    }

    renderWorldEventEffects(player) {
        const view = player && player.view;
        if (!view) return;
        const active = this.activeWorldEvent();
        if (!active) {
            this.ensureShapePool(view, 'waterEventSlots', view.causticLayer, 0);
            if (view.spaceStarLayer) this.ensureShapePool(view, 'spaceEventSlots', view.spaceStarLayer, 0);
            return;
        }
        const rect = this.visibleWorldRect(player, 4);
        const waterVisible = rect.maxY >= 0 && rect.minY <= 100;
        const spaceVisible = rect.minY <= -18 && rect.maxY >= SPACE_MIN_Y;
        const z = this.screenScale(player);
        const waterCount = active.biome === 'water' && waterVisible ? 6 : 0;
        this.ensureShapePool(view, 'waterEventSlots', view.causticLayer, waterCount);
        for (let i = 0; i < waterCount; i++) {
            const node = view.waterEventSlots[i].nodes[0];
            const phase = this.time * (active.id === 'great-migration' ? 1.3 : 0.6) + i * 1.11;
            if (active.id === 'bioluminescent-bloom') {
                node.node.fill = i % 2 ? [62, 255, 220, 30] : [180, 92, 255, 28];
                node.node.coordinates2d = polyEllipse((i * 19 + 7 + Math.sin(phase) * 5) % 110 - 5, 18 + (i % 3) * 25, (10 + i % 2 * 6) * z, (4 + i % 3) * z, 10);
            } else if (active.id === 'feeding-frenzy') {
                node.node.fill = [255, 183, 83, 22];
                node.node.coordinates2d = polyCircle(8 + i * 18, 52 + Math.sin(phase) * 13, (3 + (0.5 + 0.5*Math.sin(phase))*4) * z, 10);
            } else if (active.id === 'great-migration') {
                node.node.fill = [183, 238, 255, 45];
                const y = 18 + i * 12 + Math.sin(phase) * 2;
                const x = active.direction > 0 ? 12 : 88;
                node.node.coordinates2d = thickLine(x, y, x + active.direction * 22, y, Math.max(0.25, 0.45*z));
            } else {
                node.node.fill = [255, 221, 102, 34];
                node.node.coordinates2d = diamond(10 + i * 16, 18 + (i % 3) * 22 + Math.sin(phase)*3, 1.2*z, 2.2*z);
            }
        }
        const spaceCount = active.id === 'meteor-shower' && spaceVisible ? 8 : 0;
        if (view.spaceStarLayer) this.ensureShapePool(view, 'spaceEventSlots', view.spaceStarLayer, spaceCount);
        for (let i = 0; i < spaceCount; i++) {
            const node = view.spaceEventSlots[i].nodes[0];
            const x = ((i * 17 + this.time * 34) % 130) - 15;
            const y = 8 + ((i * 23 + this.time * 19) % 88);
            node.node.fill = i % 2 ? [255, 220, 105, 150] : [127, 235, 255, 145];
            node.node.coordinates2d = thickLine(x, y, x - 5*z, y + 8*z, Math.max(0.2, 0.38*z));
        }
    }

    tick() {
        if (this.closed) return;
        this.time += DT;
        this.nextAmbientBubble -= DT;
        if (this.nextAmbientBubble <= 0) {
            this.nextAmbientBubble = rand(0.22, 0.55);
            const bounds = this.tankBounds();
            this.emitBubbles(rand(bounds.min, bounds.max), rand(82, 92), 1);
        }

        let hasConnectedPlayer = false;
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player || !player.connected) continue;
            hasConnectedPlayer = true;
            player.feedCooldown = Math.max(0, player.feedCooldown - DT);
            player.statusTime = Math.max(0, player.statusTime - DT);
            if (player.statusTime <= 0 && player.status) {
                player.status = '';
                if (player.view && player.view.ui && player.shopOpen && player.view.ui.statusText) {
                    this.setShopStatusAttached(player.view.ui, false);
                }
            }
            player.uiTimer -= DT;
            if (player.uiTimer <= 0) {
                player.uiTimer = 0.15;
                this.updatePlayerUi(player);
                this.updateCreatureInspectionOverlay(player);
            }
            if (player.eraFlyHomeAt > 0 && this.time >= player.eraFlyHomeAt) {
                player.eraFlyHomeAt = 0;
                player.camera.targetX = WORLD_CENTER_X;
                player.camera.targetY = 50;
                player.camera.targetZoom = 1;
                player.camera.velocity = 0;
                player.camera.velocityY = 0;
            }
            this.updateCamera(player);
            this.updateProgressionOverlay(player);
        }

        this.updateAccessoriesState();
        this.updateFoodState();
        this.updateFishState();
        this.updateGoldenEvent(hasConnectedPlayer);
        this.updateWorldEvent(hasConnectedPlayer);
        this.updateBubblesState();
        this.updateFloatersState();
        this.updateSpecksState();

        if (this.time >= this.nextSaveAt) {
            this.nextSaveAt = this.time + SAVE_INTERVAL_SECONDS;
            this.persist();
        }

        if (!hasConnectedPlayer) return;
        this.rebuildRenderSpatialIndexes();
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (player && player.connected && player.view) this.renderPlayerView(player);
        }
        this.getViewRoot().node.onStateChange();
    }

    updateGoldenEvent(hasConnectedPlayer) {
        const event = this.goldenEvent;
        if (!event) return;
        const active = event.active;
        if (active) {
            const collection = active.kind === 'alien' ? this.aliens : this.fish;
            const creature = collection.find((item) => item.id === active.id && item.golden);
            if (!creature || !creature.active) {
                this.cleanupGoldenVisitor(active.kind, active.id);
                return;
            }
            creature.hidden = false;
            creature.hiddenUntil = 0;
            if (this.time >= creature.goldenExpiresAt) {
                creature.active = false;
                this.setGlobalStatus(`${active.kind === 'alien' ? 'GOLDEN ALIEN' : 'GOLDEN FISH'} LEFT`, 2.8);
                this.setProgressionCelebration(
                    'THE GOLDEN VISITOR ESCAPED',
                    '',
                    { duration: 3.0 }
                );
                this.cleanupGoldenVisitor(active.kind, active.id);
            }
            return;
        }
        if (!hasConnectedPlayer || this.time < event.nextAt) return;
        this.spawnGoldenVisitor();
    }

    spawnGoldenVisitor() {
        const canSpawnAlien = this.spaceUnlocked && Array.isArray(CATALOG.aliens) && CATALOG.aliens.length > 0;
        const kind = canSpawnAlien && Math.random() < 0.42 ? 'alien' : 'fish';
        const creature = kind === 'alien' ? this.spawnGoldenAlien() : this.spawnGoldenFish();
        if (!creature) {
            this.goldenEvent.nextAt = this.time + 20;
            return false;
        }
        this.goldenEvent.active = { kind, id: creature.id };
        const label = kind === 'alien' ? 'GOLDEN ALIEN' : 'GOLDEN FISH';
        this.setGlobalStatus(`${label} · BITE x${this.goldenRewardMultiplier()}`, 4.5);
        this.setProgressionCelebration(
            label,
            `NEXT BITE x${this.goldenRewardMultiplier()} · 32 SECONDS`,
            { duration: 5.0 }
        );
        this._renderSpatialIndexTime = -1;
        return true;
    }

    spawnGoldenFish() {
        const unlocked = (CATALOG.fish || []).filter((species) => (species.unlockTier || 0) <= this.tankTier);
        if (!unlocked.length) return null;
        const species = unlocked[Math.floor(Math.random() * unlocked.length)];
        const profile = species.behavior || {};
        const bounds = this.tankBounds();
        const fromLeft = Math.random() < 0.5;
        const dir = fromLeft ? 1 : -1;
        const fish = {
            id: this.nextFishId++, active: true, hidden: false, hiddenUntil: 0,
            biome: 'water', kind: 'fish', speciesId: species.id, species,
            x: fromLeft ? bounds.min + 4 : bounds.max - 4,
            y: rand(Math.max(14, profile.depthMin || 15), Math.min(76, profile.depthMax || 76)),
            dir, scale: rand(1.08, 1.28), speed: species.speed * 1.12,
            phase: rand(0, TAU), vx: dir * species.speed * 0.72, vy: rand(-0.25, 0.25),
            desiredVx: dir * species.speed * 0.72, desiredVy: 0,
            targetX: fromLeft ? bounds.max - 8 : bounds.min + 8,
            targetY: rand(profile.depthMin || 18, profile.depthMax || 72), targetTimer: rand(4, 7),
            activity: 'cruise', activityUntil: this.time + 8, interestId: 0, partnerId: 0,
            foodTargetId: 0, hunger: 1, hungerPulse: 0,
            golden: true, goldenExpiresAt: this.time + GOLDEN_EVENT_LIFETIME_SECONDS,
            name: 'AURELIA', trait: '', bornAt: this.time, bites: 0, lifetimeEarned: 0, lastFedBy: ''
        };
        this.fish.push(fish);
        this.fishById.set(fish.id, fish);
        return fish;
    }

    spawnGoldenAlien() {
        const unlocked = (CATALOG.aliens || []).filter((species) => (species.unlockTier || 0) <= this.tankTier);
        if (!unlocked.length) return null;
        const species = unlocked[Math.floor(Math.random() * unlocked.length)];
        const bounds = this.tankBounds();
        const fromLeft = Math.random() < 0.5;
        const dir = fromLeft ? 1 : -1;
        const alien = {
            id: this.nextAlienId++, active: true, hidden: false,
            biome: 'space', kind: 'alien', speciesId: species.id, species,
            x: fromLeft ? bounds.min + 6 : bounds.max - 6,
            y: rand(SPACE_CREATURE_MIN_Y + 18, SPACE_CREATURE_MAX_Y - 12),
            dir, scale: rand(1.08, 1.28), speed: species.speed * 1.12,
            phase: rand(0, TAU), vx: dir * species.speed * 0.72, vy: rand(-0.25, 0.25),
            desiredVx: dir * species.speed * 0.72, desiredVy: 0,
            targetX: fromLeft ? bounds.max - 8 : bounds.min + 8,
            targetY: rand(SPACE_CREATURE_MIN_Y + 14, SPACE_CREATURE_MAX_Y - 12), targetTimer: rand(4, 7),
            foodTargetId: 0, hunger: 1,
            golden: true, goldenExpiresAt: this.time + GOLDEN_EVENT_LIFETIME_SECONDS,
            name: 'SOLARIS', trait: '', bornAt: this.time, bites: 0, lifetimeEarned: 0, lastFedBy: ''
        };
        this.aliens.push(alien);
        this.alienById.set(alien.id, alien);
        return alien;
    }

    claimGoldenVisitor(creature, gain) {
        if (!creature || !creature.golden || !creature.active) return;
        creature.active = false;
        const label = creature.kind === 'alien' ? 'GOLDEN ALIEN' : 'GOLDEN FISH';
        this.setGlobalStatus(`${label} +${this.formatCompact(gain)}`, 4.2);
        this.setProgressionCelebration(
            'GOLDEN BITE',
            `${creature.lastFedBy ? creature.lastFedBy + ' FED IT · ' : ''}+${this.formatCompact(gain)}`,
            { duration: 4.8 }
        );
    }

    cleanupGoldenVisitor(kind, id) {
        if (kind === 'alien') {
            this.aliens = this.aliens.filter((item) => !(item.id === id && item.golden));
            this.alienById.delete(id);
        } else {
            this.fish = this.fish.filter((item) => !(item.id === id && item.golden));
            this.fishById.delete(id);
        }
        this.goldenEvent.active = null;
        this.goldenEvent.nextAt = this.time + this.nextGoldenVisitorDelay();
        this._renderSpatialIndexTime = -1;
        if (kind === 'fish') {
            for (const playerId of this.playerOrder) {
                const player = this.players[playerId];
                if (!player || !player.view) continue;
                player.view.fishClusterSnapshot = [];
                player.view.fishClusterNextRefresh = 0;
                player.view.closeFishIds = [];
            }
        }
    }

    updateCamera(player) {
        let inputX = 0;
        let inputY = 0;
        if (player.keys.a || player.keys.arrowleft) inputX -= 1;
        if (player.keys.d || player.keys.arrowright) inputX += 1;
        if (player.keys.w || player.keys.arrowup) inputY -= 1;
        if (player.keys.x || player.keys.arrowdown) inputY += 1;
        inputX = clamp(inputX, -1, 1);
        inputY = clamp(inputY, -1, 1);
        if (inputX !== 0) {
            player.camera.targetX += inputX * 62 * DT / Math.max(0.45, player.camera.zoom);
        }
        if (inputY !== 0) {
            player.camera.targetY += inputY * 62 * DT / Math.max(0.45, player.camera.zoom);
        }

        const zoomError = player.camera.targetZoom - player.camera.zoom;
        const zoomBlend = 1 - Math.exp(-7.5 * DT);
        player.camera.zoom += zoomError * zoomBlend;
        player.camera.zoom = clamp(player.camera.zoom, this.minZoom(), MAX_ZOOM);
        this.clampCamera(player);

        const errorX = player.camera.targetX - player.camera.x;
        const accelerationX = errorX * 8.2 - player.camera.velocity * 5.8;
        player.camera.velocity += accelerationX * DT;
        if (Math.abs(errorX) < 0.01 && Math.abs(player.camera.velocity) < 0.01) {
            player.camera.x = player.camera.targetX;
            player.camera.velocity = 0;
        } else {
            player.camera.x += player.camera.velocity * DT;
        }

        const errorY = player.camera.targetY - player.camera.y;
        const accelerationY = errorY * 8.2 - player.camera.velocityY * 5.8;
        player.camera.velocityY += accelerationY * DT;
        if (Math.abs(errorY) < 0.01 && Math.abs(player.camera.velocityY) < 0.01) {
            player.camera.y = player.camera.targetY;
            player.camera.velocityY = 0;
        } else {
            player.camera.y += player.camera.velocityY * DT;
        }
        this.clampCamera(player);
        this.updateCameraControls(player);
    }

    _aquariumBase_updateAccessoriesState() {
        const bounds = this.tankBounds();
        for (const accessory of this.accessories) {
            if (!accessory.active) continue;
            if (accessory.type === 'feeder') {
                accessory.x += accessory.direction * accessory.speed * DT;
                if (accessory.x < bounds.min + 5 || accessory.x > bounds.max - 5) {
                    accessory.x = clamp(accessory.x, bounds.min + 5, bounds.max - 5);
                    accessory.direction *= -1;
                }
                if (this.time >= accessory.nextAction) {
                    accessory.nextAction = this.time + rand(4.5, 7.5);
                    const drops = 2 + Math.floor(Math.random() * 2);
                    for (let i = 0; i < drops; i++) {
                        this.spawnSystemFood(accessory.x + rand(-5, 5), 13 + rand(-1, 2), {
                            color: [231, 177, 92, 255],
                            valueMultiplier: 1.15
                        });
                    }
                }
            } else if (accessory.type === 'bubbler' && this.time >= accessory.nextAction) {
                accessory.nextAction = this.time + rand(10, 16);
                this.spawnSystemFood(accessory.x + rand(-2, 2), 72 + rand(-3, 4), {
                    golden: true,
                    valueMultiplier: 2
                });
                this.emitBubbles(accessory.x, accessory.y - 2, 8);
            } else if (accessory.type === 'treasure' && this.time >= accessory.nextAction) {
                accessory.nextAction = this.time + rand(25, 38);
                const drops = 4 + Math.floor(Math.random() * 3);
                for (let i = 0; i < drops; i++) {
                    this.spawnSystemFood(accessory.x + rand(-7, 7), 68 + rand(-4, 5), {
                        golden: true,
                        valueMultiplier: 3
                    });
                }
                this.emitBubbles(accessory.x, accessory.y - 3, 14);
            } else if (accessory.type === 'beacon' && this.time >= accessory.nextAction) {
                accessory.nextAction = this.time + rand(4, 7);
                this.emitBubbles(accessory.x, accessory.y - 8, 3);
            }
        }
    }

    _aquariumBase_updateFishState() {
        this.behaviorAccumulator += DT;
        if (this.behaviorAccumulator >= BEHAVIOR_INTERVAL) {
            this.behaviorAccumulator %= BEHAVIOR_INTERVAL;
            this.updateFishBehavior();
        }

        const bounds = this.tankBounds();
        for (const fish of this.fish) {
            if (!fish.active) continue;
            fish.hunger = clamp(fish.hunger + DT * 0.014, 0, 1);
            fish.targetTimer -= DT;

            if (fish.hidden) {
                if (this.time < fish.hiddenUntil) continue;
                fish.hidden = false;
                fish.activity = 'cruise';
                fish.activityUntil = 0;
                fish.x = clamp(fish.x + rand(-2.5, 2.5), bounds.min + 4, bounds.max - 4);
                fish.y = clamp(fish.y - rand(1.5, 4), 10, 80);
                fish.vx = fish.dir * fish.speed * 0.35;
                fish.vy = rand(-0.4, 0.1);
                this.emitBubbles(fish.x, fish.y, 3);
            }

            // A manual click is a direct player command, not merely another AI
            // influence. While its reservation is alive, track the moving pellet on
            // every simulation tick so schooling/current forces cannot make a
            // nearby fish appear to ignore the click.
            if (fish.foodTargetId) {
                const manualFood = this.foodById.get(fish.foodTargetId);
                if (
                    manualFood && manualFood.active &&
                    manualFood.manualUntil > this.time &&
                    manualFood.preferredFishId === fish.id
                ) {
                    const dx = manualFood.x - fish.x;
                    const dy = manualFood.y - fish.y;
                    const length = Math.max(0.001, Math.hypot(dx, dy));
                    const speed = fish.speed * MANUAL_FOOD_CHASE_SPEED;
                    fish.activity = 'feeding';
                    fish.activityUntil = Math.max(fish.activityUntil, manualFood.manualUntil);
                    fish.desiredVx = dx / length * speed;
                    fish.desiredVy = dy / length * speed;
                    if (Math.abs(dx) > 0.05) fish.dir = dx >= 0 ? 1 : -1;
                }
            }

            const acceleration = fish.activity === 'feeding' ? 7.8 : 3.5;
            const blend = 1 - Math.exp(-acceleration * DT);
            fish.vx += (fish.desiredVx - fish.vx) * blend;
            fish.vy += (fish.desiredVy - fish.vy) * blend;
            fish.x += fish.vx * DT;
            fish.y += fish.vy * DT;

            if (fish.x < bounds.min + 4) {
                fish.x = bounds.min + 4;
                fish.vx = Math.abs(fish.vx);
                fish.desiredVx = Math.abs(fish.desiredVx);
            } else if (fish.x > bounds.max - 4) {
                fish.x = bounds.max - 4;
                fish.vx = -Math.abs(fish.vx);
                fish.desiredVx = -Math.abs(fish.desiredVx);
            }
            if (fish.y < 10) {
                fish.y = 10;
                fish.vy = Math.abs(fish.vy);
            } else if (fish.y > 80) {
                fish.y = 80;
                fish.vy = -Math.abs(fish.vy);
            }
            if (Math.abs(fish.vx) > 0.12) fish.dir = fish.vx >= 0 ? 1 : -1;
            fish.hungerPulse += DT * (fish.activity === 'feeding' ? 6 : 2);

            if (fish.foodTargetId) {
                const food = this.foodById.get(fish.foodTargetId);
                if (!food || !food.active) {
                    fish.foodTargetId = 0;
                    if (fish.activity === 'feeding') fish.activityUntil = 0;
                } else {
                    const manualReserved = (
                        food.manualUntil > this.time &&
                        food.preferredFishId === fish.id
                    );
                    const eatRadius = Math.max(
                        1.15,
                        fish.species.length * fish.scale * 0.36,
                        manualReserved ? MANUAL_FOOD_EAT_RADIUS : 0
                    );
                    if (dist(fish.x, fish.y, food.x, food.y) < eatRadius) {
                        this.consumeFood(food, fish);
                    }
                }
            }
        }
    }

    updateBubblesState() {
        for (const bubble of this.bubbles) {
            if (!bubble.active) continue;
            bubble.y -= bubble.speed * DT;
            bubble.x += Math.sin(this.time * 2.3 + bubble.phase) * 0.055 * LEGACY_30HZ_FRAME_SCALE;
            if (bubble.y < 2) bubble.active = false;
        }
    }

    updateFloatersState() {
        for (const floater of this.floaters) {
            if (!floater.active) continue;
            floater.ttl -= DT;
            floater.y -= 4.5 * DT;
            if (floater.ttl <= 0) floater.active = false;
        }
    }

    updateSpecksState() {
        for (const item of this.specks) {
            item.y -= item.speed * DT;
            if (item.y < 3) item.y = 91;
        }
    }

    selectVisible(player, items, limit, margin, priority) {
        const rect = this.visibleWorldRect(player, margin);
        const visible = items.filter((item) => (
            item.active !== false &&
            item.x >= rect.minX && item.x <= rect.maxX &&
            (!Number.isFinite(item.y) || (item.y >= rect.minY && item.y <= rect.maxY))
        ));
        if (visible.length <= limit) return visible.sort((a, b) => a.id - b.id);

        // Spread capped selections across a 2D screen grid. At inspection zoom the
        // viewport is small, so this keeps every corner represented without
        // favoring the camera center.
        const columns = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(limit))));
        const rows = Math.max(1, Math.ceil(limit / columns));
        const cells = Array.from({ length: columns * rows }, () => []);
        for (const item of visible) {
            const screenX = this.worldToScreenX(player, item.x);
            const screenY = Number.isFinite(item.y) ? this.worldToScreenY(player, item.y) : 50;
            const nx = clamp((screenX + margin) / (100 + margin * 2), 0, 0.999999);
            const ny = clamp((screenY + margin) / (100 + margin * 2), 0, 0.999999);
            const column = Math.min(columns - 1, Math.floor(nx * columns));
            const row = Math.min(rows - 1, Math.floor(ny * rows));
            cells[row * columns + column].push(item);
        }
        const comparator = priority || ((a, b) => a.id - b.id);
        cells.forEach((cell) => cell.sort(comparator));

        const selected = [];
        let depth = 0;
        while (selected.length < limit) {
            let added = false;
            for (const cell of cells) {
                if (selected.length >= limit) break;
                if (depth < cell.length) {
                    selected.push(cell[depth]);
                    added = true;
                }
            }
            if (!added) break;
            depth++;
        }
        return selected;
    }

    selectDetailed(player, items, slots, limit, score) {
        if (limit <= 0 || items.length === 0) return [];

        // LOD is a deterministic camera decision. Slot history is deliberately
        // ignored: the same camera, zoom, and visible fish must produce the same
        // detailed set regardless of which fish happened to render first.
        return items
            .slice()
            .sort((a, b) => score(b) - score(a) || a.id - b.id)
            .slice(0, limit);
    }

    fishDetailLimit(player, visibleSingletons) {
        const zoom = this.screenScale(player);
        let limit = 0;

        // At ordinary 1x play, the initial aquarium and several new purchases can
        // all remain detailed. Higher inspection zooms raise the budget because the
        // two-axis viewport is physically smaller and therefore streams fewer fish.
        if (zoom >= 2.4) limit = 24;
        else if (zoom >= 1.55) limit = 18;
        else if (zoom >= 0.92) limit = 10;
        else if (zoom >= 0.72) limit = 4;

        return Math.min(VIEW_CAP.fish, visibleSingletons, limit);
    }

    fishDetailPriority(fish, zoom) {
        if (fish.golden) return 1000000;
        if (fish.trait) return 500000 + this.creatureTraitRewardMultiplier(fish) * 1000;
        const renderType = fish.species.renderType || fish.speciesId;
        const speciesPriority = FISH_DETAIL_PRIORITY[renderType] || 0;
        const screenArea = (
            fish.species.length * fish.species.height *
            fish.scale * fish.scale * zoom * zoom
        );
        return speciesPriority + screenArea;
    }

    bindSlots(slots, selected, idKey = 'id') {
        // Stable slot assignment with one lookup table. The selected object is kept
        // on the slot so render loops don't allocate a second id->object Map.
        const remaining = new Map();
        for (const item of selected) remaining.set(item[idKey], item);
        const freeSlots = [];

        for (const slot of slots) {
            const item = slot.boundId ? remaining.get(slot.boundId) : null;
            if (item) {
                slot.boundItem = item;
                remaining.delete(slot.boundId);
            } else {
                slot.boundId = 0;
                slot.boundItem = null;
                freeSlots.push(slot);
            }
        }

        let freeIndex = 0;
        for (const item of selected) {
            const id = item[idKey];
            if (!remaining.has(id)) continue;
            const slot = freeSlots[freeIndex++];
            if (!slot) break;
            slot.boundId = id;
            slot.boundItem = item;
            remaining.delete(id);
        }
    }

    appendCreatureFeedTargets(player, biomeId, representatives) {
        const profile = this.creatureBiomeProfile(biomeId);
        if (!profile || !player.view) return;
        const targets = player.view.feedTargets || (player.view.feedTargets = []);
        const zoom = this.screenScale(player);
        for (const item of representatives) {
            targets.push({
                biome: profile.id,
                kind: profile.kind,
                screenX: this.worldToScreenX(player, item.x),
                screenY: this.worldToScreenY(player, item.y),
                halfWidth: Math.max(profile.hitboxMinX, item.species.length * item.scale * zoom * profile.hitboxX),
                halfHeight: Math.max(profile.hitboxMinY, item.species.height * item.scale * zoom * profile.hitboxY),
                members: item.members
            });
        }
    }

    renderCreaturePopulation(player, biomeId, representatives) {
        const profile = this.creatureBiomeProfile(biomeId);
        if (!profile || !player.view) return;
        const view = player.view;
        const zoom = this.screenScale(player);
        const singleton = [];
        for (const item of representatives) {
            if (item.count === 1 && item.representative) singleton.push(item.representative);
        }

        const detailLimit = this[profile.detailLimitMethod](player, singleton.length);
        const detailed = detailLimit > 0
            ? this.selectDetailed(
                player,
                singleton,
                view[profile.detailPoolKey],
                detailLimit,
                (creature) => this[profile.detailPriorityMethod](creature, zoom)
            )
            : [];
        const detailedIds = new Set(detailed.map((creature) => creature.id));
        const lightweight = representatives.filter((item) => !(
            item.count === 1 && item.representative && detailedIds.has(item.representative.id)
        ));

        this.ensureShapePool(
            view,
            profile.litePoolKey,
            view[profile.liteLayerKey],
            lightweight.length
        );
        this.bindSlots(view[profile.litePoolKey], lightweight);
        for (const slot of view[profile.litePoolKey]) {
            const creature = slot.boundItem;
            if (creature) {
                this[profile.liteRendererMethod](player, creature, slot.nodes[0]);
                this.applyGoldenCreatureStyle(creature, slot.nodes);
            }
        }

        this.ensureShapePool(
            view,
            profile.detailPoolKey,
            view[profile.detailLayerKey],
            detailed.length,
            profile.detailNodes
        );
        this.bindSlots(view[profile.detailPoolKey], detailed);
        for (const slot of view[profile.detailPoolKey]) {
            const creature = slot.boundItem;
            if (creature) {
                this[profile.detailRendererMethod](player, creature, slot.nodes);
                this.applyGoldenCreatureStyle(creature, slot.nodes);
            }
        }

        this.appendCreatureFeedTargets(player, biomeId, representatives);
    }

    applyGoldenCreatureStyle(creature, nodes) {
        if (!creature || !creature.golden) return;
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (!node || !node.node) continue;
            const fill = node.node.fill;
            if (Array.isArray(fill) && fill[3] === 0) continue;
            node.node.fill = GOLDEN_COLORS[i % GOLDEN_COLORS.length];
        }
    }

    _aquariumBase_renderPlayerView(player) {
        this.renderBackground(player);
        this.renderAccessories(player);
        this.renderFood(player);
        this.renderFish(player);
        this.renderBubbles(player);
        this.renderFloaters(player);
    }

    _aquariumBase_renderBackground(player) {
        const view = player.view;
        const bounds = this.tankBounds();
        const zoom = this.screenScale(player);
        this.renderSand(player);

        const caustics = this.selectVisible(player, this.caustics, VIEW_CAP.caustics, 10);
        this.ensureShapePool(view, 'causticSlots', view.causticLayer, caustics.length);
        this.bindSlots(view.causticSlots, caustics);
        for (const slot of view.causticSlots) {
            if (!slot.boundId) continue;
            const item = slot.boundItem;
            if (!item) continue;
            const node = slot.nodes[0];
            const worldX = item.x + Math.sin(this.time * item.speed + item.phase) * 3;
            const x = this.worldToScreenX(player, worldX);
            const worldY = item.y + Math.cos(this.time * 0.45 + item.phase) * 1.1;
            const y = this.worldToScreenY(player, worldY);
            const width = item.width + Math.sin(this.time * 0.9 + item.id) * 1.5;
            node.node.fill = [COLORS.light[0], COLORS.light[1], COLORS.light[2], 70];
            node.node.coordinates2d = this.scalePolygonAround([
                [x - width / 2, y], [x - width / 6, y - 0.8],
                [x + width / 2, y], [x + width / 6, y + 0.8], [x - width / 2, y]
            ], x, y, zoom);
        }

        const visibleEdges = [bounds.min, bounds.max]
            .map((worldX, index) => ({ id: index + 1, worldX, x: this.worldToScreenX(player, worldX) }))
            .filter((edge) => edge.x >= -1 && edge.x <= 101);
        this.ensureShapePool(view, 'tankEdges', view.edgeLayer, visibleEdges.length);
        this.bindSlots(view.tankEdges, visibleEdges);
        for (const slot of view.tankEdges) {
            const edge = slot.boundItem;
            if (!edge) continue;
            const node = slot.nodes[0];
            const edgeWidth = Math.max(0.22, 0.7 * zoom);
            node.node.fill = [196, 238, 247, 90];
            const top = clamp(this.worldToScreenY(player, CAMERA_WORLD_MIN_Y), 0, 100);
            const bottom = clamp(this.worldToScreenY(player, CAMERA_WORLD_MAX_Y), 0, 100);
            node.node.coordinates2d = ShapeUtils.rectangle(edge.x - edgeWidth / 2, top, edgeWidth, Math.max(0, bottom - top));
        }

        const rocks = this.selectVisible(player, this.staticRocks, VIEW_CAP.rocks, 4);
        this.ensureShapePool(view, 'rockSlots', view.rockLayer, rocks.length);
        this.bindSlots(view.rockSlots, rocks);
        for (const slot of view.rockSlots) {
            if (!slot.boundId) continue;
            const rock = slot.boundItem;
            if (!rock) continue;
            const node = slot.nodes[0];
            const x = this.worldToScreenX(player, rock.x);
            const y = this.worldToScreenY(player, rock.y);
            const w = rock.width;
            const h = rock.height;
            node.node.fill = Math.floor(rock.phase) % 2 ? COLORS.rockB : COLORS.rockA;
            node.node.coordinates2d = this.scalePolygonAround([
                [x - w * 0.55, y + h * 0.35], [x - w * 0.42, y - h * 0.42],
                [x - w * 0.08, y - h * 0.68], [x + w * 0.38, y - h * 0.34],
                [x + w * 0.55, y + h * 0.35], [x - w * 0.55, y + h * 0.35]
            ], x, y, zoom);
        }

        const specks = this.selectVisible(player, this.specks, VIEW_CAP.specks, 0.5);
        this.ensureShapePool(view, 'speckSlots', view.speckLayer, specks.length);
        this.bindSlots(view.speckSlots, specks);
        for (const slot of view.speckSlots) {
            if (!slot.boundId) continue;
            const item = slot.boundItem;
            if (!item) continue;
            const node = slot.nodes[0];
            const x = this.worldToScreenX(player, item.x + Math.sin(this.time * 0.7 + item.phase) * 0.55);
            const radius = item.size * (0.75 + 0.25 * Math.sin(this.time * 2 + item.phase)) * zoom;
            node.node.fill = item.bright ? COLORS.light : COLORS.white;
            node.node.coordinates2d = polyCircle(x, this.worldToScreenY(player, item.y), radius, 5);
        }

        const weeds = this.selectVisible(player, this.staticWeeds, VIEW_CAP.weeds, 2);
        this.ensureShapePool(view, 'weedSlots', view.weedLayer, weeds.length);
        this.bindSlots(view.weedSlots, weeds);
        for (const slot of view.weedSlots) {
            if (!slot.boundId) continue;
            const weed = slot.boundItem;
            if (!weed) continue;
            const node = slot.nodes[0];
            const rootX = this.worldToScreenX(player, weed.x);
            const rootY = this.worldToScreenY(player, weed.y);
            const sway = Math.sin(this.time * weed.speed + weed.phase) * 1.25;
            const tipX = rootX + sway;
            const midX = rootX + sway * 0.45;
            const topY = rootY - weed.height;
            node.node.fill = Math.floor(weed.phase * 10) % 2 ? COLORS.weedA : COLORS.weedB;
            node.node.coordinates2d = this.scalePolygonAround([
                [rootX - weed.width / 2, rootY], [rootX + weed.width / 2, rootY],
                [midX + weed.width * 0.38, rootY - weed.height * 0.48],
                [tipX + weed.width * 0.16, topY + 0.4], [tipX, topY],
                [tipX - weed.width * 0.16, topY + 0.4],
                [midX - weed.width * 0.38, rootY - weed.height * 0.48],
                [rootX - weed.width / 2, rootY]
            ], rootX, rootY, zoom);
        }

        const corals = this.selectVisible(player, this.staticCorals, VIEW_CAP.corals, 4);
        this.ensureShapePool(view, 'coralSlots', view.coralLayer, corals.length);
        this.bindSlots(view.coralSlots, corals);
        for (const slot of view.coralSlots) {
            if (!slot.boundId) continue;
            const coral = slot.boundItem;
            if (!coral) continue;
            const node = slot.nodes[0];
            const x = this.worldToScreenX(player, coral.x);
            const y = this.worldToScreenY(player, coral.y);
            const bend = Math.sin(this.time * 0.35 + coral.phase) * 0.32;
            const w = coral.width;
            const h = coral.height;
            node.node.fill = coral.colorIndex === 0 ? COLORS.coralA : (coral.colorIndex === 1 ? COLORS.coralB : COLORS.coralC);
            node.node.coordinates2d = this.scalePolygonAround([
                [x - w * 0.48, y], [x - w * 0.28, y - h * 0.65],
                [x - w * 0.05 + bend, y - h], [x + w * 0.15, y - h * 0.55],
                [x + w * 0.42, y - h * 0.82], [x + w * 0.5, y],
                [x - w * 0.48, y]
            ], x, y, zoom);
        }
    }

    renderAccessories(player) {
        const view = player.view;
        const visible = this.selectVisible(
            player,
            this.accessories,
            VIEW_CAP.accessoryLite,
            5,
            (a, b) => {
                return (ACCESSORY_RENDER_PRIORITY[b.type] || 0) - (ACCESSORY_RENDER_PRIORITY[a.type] || 0) || a.id - b.id;
            }
        );
        this.ensureShapePool(view, 'accessoryLiteSlots', view.accessoryLiteLayer, visible.length);
        this.bindSlots(view.accessoryLiteSlots, visible);
        for (const slot of view.accessoryLiteSlots) {
            const accessory = slot.boundItem;
            if (accessory) this.renderAccessoryLite(player, accessory, slot.nodes[0]);
        }
    }

    _aquariumBase_renderAccessoryLite(player, accessory, node) {
        const x = this.worldToScreenX(player, accessory.x);
        const y = this.worldToScreenY(player, accessory.y);
        const zoom = this.screenScale(player);
        let points;
        if (accessory.type === 'plant') {
            points = [
                [x - 1.5, y], [x - 0.9, y - 5.8], [x - 0.25, y - 2.1],
                [x + 0.25, y - 7.4], [x + 0.85, y - 2.5], [x + 1.5, y], [x - 1.5, y]
            ];
            node.node.fill = COLORS.weedA;
        } else if (accessory.type === 'coral') {
            points = [
                [x - 2.1, y], [x - 1.6, y - 5.6], [x - 0.7, y - 2.9],
                [x - 0.25, y - 8], [x + 0.45, y - 3.3], [x + 1.4, y - 6.4],
                [x + 2.1, y], [x - 2.1, y]
            ];
            node.node.fill = COLORS.coralA;
        } else if (accessory.type === 'castle') {
            points = [
                [x - 3.8, y], [x - 3.8, y - 8.2], [x - 1.8, y - 8.2],
                [x - 1.8, y - 6.1], [x + 1.8, y - 6.1], [x + 1.8, y - 8.2],
                [x + 3.8, y - 8.2], [x + 3.8, y], [x - 3.8, y]
            ];
            node.node.fill = [142, 118, 96, 255];
        } else if (accessory.type === 'feeder') {
            points = [
                [x - 3.5, y - 1.2], [x - 2.2, y - 2.8], [x + 2.2, y - 2.8],
                [x + 3.5, y - 1.2], [x + 1.5, y + 1.2], [x - 1.5, y + 1.2],
                [x - 3.5, y - 1.2]
            ];
            node.node.fill = COLORS.gold;
        } else if (accessory.type === 'current') {
            points = polyCircle(x, y - 2.2, 2.8, 10);
            node.node.fill = COLORS.buttonHot;
        } else if (accessory.type === 'cave') {
            points = [
                [x - 4.8, y], [x - 4, y - 4.2], [x - 2.2, y - 7],
                [x + 2.2, y - 7], [x + 4, y - 4.2], [x + 4.8, y],
                [x + 2.1, y], [x + 1.7, y - 3.8], [x - 1.7, y - 3.8],
                [x - 2.1, y], [x - 4.8, y]
            ];
            node.node.fill = COLORS.rockB;
        } else if (accessory.type === 'beacon') {
            points = [
                [x - 1.8, y], [x - 1.2, y - 8], [x - 0.45, y - 11],
                [x + 0.45, y - 11], [x + 1.2, y - 8], [x + 1.8, y], [x - 1.8, y]
            ];
            node.node.fill = COLORS.light;
        } else if (accessory.type === 'treasure') {
            points = [
                [x - 3.6, y], [x - 3.6, y - 4], [x - 2.6, y - 5.5],
                [x + 2.6, y - 5.5], [x + 3.6, y - 4], [x + 3.6, y], [x - 3.6, y]
            ];
            node.node.fill = [145, 91, 48, 255];
        } else {
            points = [
                [x - 1.9, y], [x - 1.35, y - 2.1], [x + 1.35, y - 2.1],
                [x + 1.9, y], [x - 1.9, y]
            ];
            node.node.fill = COLORS.rockA;
        }
        node.node.coordinates2d = this.scalePolygonAround(points, x, y, zoom);
    }

    renderFood(player) {
        const view = player.view;
        const zoom = this.screenScale(player);
        const selected = this.selectVisible(player, this.food, VIEW_CAP.food, 1, (a, b) => {
            if (a.golden !== b.golden) return a.golden ? -1 : 1;
            const da = Math.abs(a.x - player.camera.x);
            const db = Math.abs(b.x - player.camera.x);
            return da - db || a.id - b.id;
        });
        this.ensureShapePool(view, 'foodSlots', view.foodLayer, selected.length);
        this.bindSlots(view.foodSlots, selected);
        for (const slot of view.foodSlots) {
            if (!slot.boundId) continue;
            const food = slot.boundItem;
            if (!food) continue;
            const node = slot.nodes[0];
            const screenX = this.worldToScreenX(player, food.x);
            const screenY = this.worldToScreenY(player, food.y);
            const size = (food.golden ? 0.48 : 0.31) * zoom;
            node.node.fill = food.color;
            node.node.coordinates2d = food.golden
                ? diamond(screenX, screenY, size, size * 1.3)
                : [
                    [screenX-size,screenY-size*0.45], [screenX+size,screenY-size*0.4],
                    [screenX+size*0.65,screenY+size*0.55], [screenX-size*0.7,screenY+size*0.48],
                    [screenX-size,screenY-size*0.45]
                ];
        }
    }

    fishClusterLevel(player) {
        const zoom = player.camera.zoom;
        if (zoom < 0.38) return 0;
        if (zoom < 0.56) return 1;
        if (zoom < 0.78) return 2;
        if (zoom < 0.92) return 3;
        return 4;
    }

    fishClusterBaseSize(level) {
        return [30, 18, 10, 5, 1.7][clamp(level, 0, 4)];
    }

    fishClusterRefreshSeconds(level) {
        return FISH_CLUSTER_REFRESH_SECONDS[clamp(level, 0, 4)];
    }

    requestFishClusterFocus(player, worldX, worldY) {
        if (!player || !player.view) return;
        player.view.fishClusterFocus = {
            x: worldX,
            y: worldY,
            until: this.time + FISH_CLUSTER_FOCUS_SECONDS,
            nextRefresh: 0
        };
    }

    computeFishClusters(player, budget, level) {
        const view = player.view;
        const visible = this.visibleRenderFish(player, 6);
        const baseSize = this.fishClusterBaseSize(level);

        const makeClusters = (mergeStep) => {
            const cellSize = baseSize * Math.pow(1.5, mergeStep);
            const buckets = new Map();
            for (const fish of visible) {
                const cx = Math.floor(fish.x / cellSize);
                const cy = Math.floor(fish.y / (cellSize * 0.72));
                const key = fish.golden ? `golden:${fish.id}` : (fish.trait ? `mutation:${fish.id}` : `${fish.speciesId}:${cx}:${cy}`);
                let cluster = buckets.get(key);
                if (!cluster) {
                    cluster = {
                        sourceId: `fish-cluster:${level}:${mergeStep}:${key}`,
                        speciesId: fish.speciesId,
                        species: fish.species,
                        x: 0,
                        y: 0,
                        dirSum: 0,
                        scale: 0,
                        count: 0,
                        members: [],
                        representative: fish,
                        phase: fish.phase,
                        golden: !!fish.golden,
                        trait: fish.trait || '',
                        cellSize
                    };
                    buckets.set(key, cluster);
                }
                cluster.x += fish.x;
                cluster.y += fish.y;
                cluster.dirSum += fish.dir;
                cluster.scale += fish.scale;
                cluster.count++;
                cluster.members.push(fish);
                if (fish.id < cluster.representative.id) cluster.representative = fish;
            }
            const clusters = Array.from(buckets.values());
            for (const cluster of clusters) {
                cluster.x /= cluster.count;
                cluster.y /= cluster.count;
                cluster.scale = cluster.scale / cluster.count * (
                    1 + Math.min(0.24, Math.log2(cluster.count) * 0.045)
                );
                cluster.dir = cluster.dirSum >= 0 ? 1 : -1;
            }
            return clusters.sort((a, b) => (
                a.sourceId < b.sourceId ? -1 : (a.sourceId > b.sourceId ? 1 : 0)
            ));
        };

        let mergeStep = view.fishClusterMergeStep;
        let clusters = makeClusters(mergeStep);
        while (clusters.length > budget && mergeStep < 12) {
            mergeStep++;
            clusters = makeClusters(mergeStep);
        }
        if (mergeStep > 0) {
            const finer = makeClusters(mergeStep - 1);
            if (finer.length <= Math.floor(budget * 0.7)) {
                mergeStep--;
                clusters = finer;
            }
        }
        view.fishClusterMergeStep = mergeStep;
        return clusters;
    }

    stabilizeFishClusters(player, fresh, previous) {
        const view = player.view;
        const unused = new Set(previous);
        const stable = [];

        for (const cluster of fresh) {
            let best = null;
            let bestDistance = Infinity;
            const matchRadius = Math.max(4, cluster.cellSize * 1.45);
            for (const candidate of unused) {
                if (candidate.speciesId !== cluster.speciesId) continue;
                if (!!candidate.golden !== !!cluster.golden) continue;
                const d = dist(
                    candidate.targetX === undefined ? candidate.x : candidate.targetX,
                    candidate.targetY === undefined ? candidate.y : candidate.targetY,
                    cluster.x,
                    cluster.y
                );
                if (d < bestDistance && d <= matchRadius) {
                    best = candidate;
                    bestDistance = d;
                }
            }

            if (best) {
                unused.delete(best);
                const targetDir = cluster.dir;
                let shownDir = best.dir;
                let lastDirChange = best.lastDirChange || 0;
                if (shownDir !== targetDir && this.time - lastDirChange > 2.5) {
                    shownDir = targetDir;
                    lastDirChange = this.time;
                }
                stable.push({
                    ...cluster,
                    id: best.id,
                    x: best.x,
                    y: best.y,
                    scale: Number.isFinite(best.scale) ? best.scale : cluster.scale,
                    targetX: cluster.x,
                    targetY: cluster.y,
                    targetScale: cluster.scale,
                    dir: shownDir,
                    lastDirChange,
                    phase: best.phase
                });
            } else {
                stable.push({
                    ...cluster,
                    id: `fish-view:${player.id}:${view.nextFishClusterId++}`,
                    targetX: cluster.x,
                    targetY: cluster.y,
                    targetScale: cluster.scale,
                    lastDirChange: this.time
                });
            }
        }
        return stable;
    }

    advanceFishClusterSnapshot(player, clusters, level) {
        if (level >= 4) return clusters;
        const speed = [1.35, 1.8, 2.5, 4.2, 12][level];
        const blend = 1 - Math.exp(-speed * DT);
        for (const cluster of clusters) {
            cluster.x += ((cluster.targetX ?? cluster.x) - cluster.x) * blend;
            cluster.y += ((cluster.targetY ?? cluster.y) - cluster.y) * blend;
            cluster.scale += ((cluster.targetScale ?? cluster.scale) - cluster.scale) * blend;
        }
        return clusters;
    }

    refreshFishClustersNearFocus(player, budget, level, focus) {
        const view = player.view;
        const fresh = this.computeFishClusters(player, budget, level);
        const radius = FISH_CLUSTER_FOCUS_SCREEN_RADIUS / Math.max(0.12, player.camera.zoom);
        const keepRadius = radius * 1.22;
        const oldInside = view.fishClusterSnapshot.filter((cluster) => (
            dist(cluster.x, cluster.y, focus.x, focus.y) <= keepRadius
        ));
        const oldOutside = view.fishClusterSnapshot.filter((cluster) => (
            dist(cluster.x, cluster.y, focus.x, focus.y) > keepRadius
        ));
        const freshInside = fresh.filter((cluster) => (
            dist(cluster.x, cluster.y, focus.x, focus.y) <= radius
        ));
        const refreshedInside = this.stabilizeFishClusters(player, freshInside, oldInside);
        let combined = oldOutside.concat(refreshedInside);

        // A focused feeding area gets priority, but the overview still stays within
        // its fixed representative budget. Remove the least relevant old overview
        // samples first instead of causing the entire screen to reshuffle.
        if (combined.length > budget) {
            const insideIds = new Set(refreshedInside.map((cluster) => cluster.id));
            const outside = combined
                .filter((cluster) => !insideIds.has(cluster.id))
                .sort((a, b) => (
                    dist(b.x, b.y, focus.x, focus.y) - dist(a.x, a.y, focus.x, focus.y)
                ));
            const removeCount = combined.length - budget;
            const removed = new Set(outside.slice(0, removeCount).map((cluster) => cluster.id));
            combined = combined.filter((cluster) => !removed.has(cluster.id));
        }
        view.fishClusterSnapshot = combined;
        focus.nextRefresh = this.time + FISH_CLUSTER_FOCUS_REFRESH_SECONDS;
    }

    buildCloseFishRepresentatives(player, budget) {
        const view = player.view;
        const visible = this.visibleRenderFish(player, 6).sort((a, b) => a.id - b.id);

        let selected;
        if (visible.length <= budget) {
            selected = visible;
        } else {
            // Close zoom renders real logical fish, not grid cells. Preserve the
            // previous fish identities while they remain visible, then fill any
            // vacancies evenly across the viewport. This prevents a moving fish
            // from flickering merely because it crossed an arbitrary cell edge.
            const visibleById = new Map(visible.map((fish) => [fish.id, fish]));
            const kept = [];
            const keptIds = new Set();
            for (const id of view.closeFishIds) {
                const fish = visibleById.get(id);
                if (!fish || keptIds.has(id)) continue;
                kept.push(fish);
                keptIds.add(id);
                if (kept.length >= budget) break;
            }

            const remaining = visible.filter((fish) => !keptIds.has(fish.id));
            const additions = this.selectVisible(
                player,
                remaining,
                budget - kept.length,
                6,
                (a, b) => a.id - b.id
            );
            selected = kept.concat(additions);
        }

        const goldenVisible = visible.find((fish) => fish.golden);
        if (goldenVisible && !selected.some((fish) => fish.id === goldenVisible.id)) {
            if (selected.length >= budget && selected.length > 0) selected[selected.length - 1] = goldenVisible;
            else selected.push(goldenVisible);
        }

        view.closeFishIds = selected.map((fish) => fish.id);
        return selected.map((fish) => ({
            id: `fish-view:${player.id}:logical:${fish.id}`,
            sourceId: `fish:${fish.id}`,
            speciesId: fish.speciesId,
            species: fish.species,
            x: fish.x,
            y: fish.y,
            dir: fish.dir,
            scale: fish.scale,
            count: 1,
            members: [fish],
            representative: fish,
            phase: fish.phase,
            golden: !!fish.golden,
            targetX: fish.x,
            targetY: fish.y,
            targetScale: fish.scale
        }));
    }

    buildFishClusters(player, budget) {
        const view = player.view;
        const level = this.fishClusterLevel(player);
        const interval = this.fishClusterRefreshSeconds(level);

        if (view.fishClusterLevel !== level) {
            view.fishClusterLevel = level;
            view.fishClusterMergeStep = 0;
            view.fishClusterSnapshot = [];
            view.fishClusterNextRefresh = 0;
            view.closeFishIds = [];
        }

        // At close zoom, every representative is a real logical fish with a
        // stable fish-derived id. Spatial clustering begins only after zooming
        // out. This keeps the starter aquarium completely free of grid-boundary
        // flicker while retaining the map-style overview at wider zoom levels.
        if (level >= 4) {
            return this.buildCloseFishRepresentatives(player, budget);
        }

        const cameraMoved = (
            Math.abs(player.camera.x - view.fishClusterCameraX) > this.viewWidth(player) * 0.16 ||
            Math.abs(player.camera.y - (view.fishClusterCameraY ?? player.camera.y)) > this.viewHeight(player) * 0.16
        );
        const zoomChanged = Math.abs(player.camera.zoom - view.fishClusterCameraZoom) > 0.1;
        const needsFullRefresh = (
            view.fishClusterSnapshot.length === 0 ||
            this.time >= view.fishClusterNextRefresh ||
            cameraMoved ||
            zoomChanged
        );

        if (needsFullRefresh) {
            const fresh = this.computeFishClusters(player, budget, level);
            view.fishClusterSnapshot = this.stabilizeFishClusters(
                player,
                fresh,
                view.fishClusterSnapshot
            );
            view.fishClusterNextRefresh = this.time + interval;
            view.fishClusterCameraX = player.camera.x;
            view.fishClusterCameraY = player.camera.y;
            view.fishClusterCameraZoom = player.camera.zoom;
        }

        const focus = view.fishClusterFocus;
        if (focus && focus.until > this.time) {
            if (this.time >= focus.nextRefresh) {
                this.refreshFishClustersNearFocus(player, budget, level, focus);
            }
        } else if (focus) {
            view.fishClusterFocus = null;
        }

        this.advanceFishClusterSnapshot(player, view.fishClusterSnapshot, level);
        const bounds = this.visibleWorldRect(player, 8);
        return view.fishClusterSnapshot.filter((cluster) => (
            cluster.x >= bounds.minX && cluster.x <= bounds.maxX &&
            cluster.y >= bounds.minY && cluster.y <= bounds.maxY
        ));
    }

    renderFish(player) {
        const clusters = this.buildFishClusters(player, VIEW_CAP.fishLite);
        this.renderCreaturePopulation(player, 'water', clusters);
    }

    renderFishLite(player, fish, node) {
        const species = fish.species;
        const renderType = species.renderType || fish.speciesId;
        const x = this.worldToScreenX(player, fish.x);
        const y = this.worldToScreenY(player, fish.y);
        const zoom = this.screenScale(player);
        const length = species.length * fish.scale;
        const height = species.height * fish.scale;
        let points;

        if (renderType === 'puffer') {
            points = polyEllipse(x, y, length * 0.48, height * 0.5, 10);
        } else if (renderType === 'turtle') {
            const head = x + fish.dir * length * 0.5;
            points = [
                [head + fish.dir * length * 0.13, y],
                [head, y - height * 0.2],
                [x + fish.dir * length * 0.18, y - height * 0.52],
                [x - fish.dir * length * 0.34, y - height * 0.42],
                [x - fish.dir * length * 0.62, y],
                [x - fish.dir * length * 0.34, y + height * 0.42],
                [x + fish.dir * length * 0.18, y + height * 0.52],
                [head, y + height * 0.2],
                [head + fish.dir * length * 0.13, y]
            ];
        } else {
            const nose = x + fish.dir * length * 0.58;
            const tailBase = x - fish.dir * length * 0.48;
            const tailTip = x - fish.dir * length * (renderType === 'shark' ? 0.94 : 0.86);
            const tailHeight = renderType === 'shark' ? height * 0.82 : height * 0.68;
            points = [
                [nose, y],
                [x + fish.dir * length * 0.18, y - height * 0.5],
                [tailBase, y - height * 0.3],
                [tailTip, y - tailHeight],
                [tailTip + fish.dir * length * 0.1, y],
                [tailTip, y + tailHeight],
                [tailBase, y + height * 0.3],
                [x + fish.dir * length * 0.18, y + height * 0.5],
                [nose, y]
            ];
        }
        node.node.fill = this.creaturePalette(fish)[0];
        node.node.coordinates2d = this.scalePolygonAround(points, x, y, zoom);
    }

    renderFishRig(player, fish, n) {
        const species = fish.species;
        const renderType = species.renderType || fish.speciesId;
        const x = this.worldToScreenX(player, fish.x);
        const y = this.worldToScreenY(player, fish.y);
        const zoom = this.screenScale(player);
        const length = species.length * fish.scale;
        const height = species.height * fish.scale;
        const colors = this.creaturePalette(fish);
        const eyeX = x + fish.dir * length * 0.31;
        const eyeY = y - height * 0.08;

        if (renderType === 'puffer') {
            n[0].node.fill = [194, 171, 97, 255];
            n[0].node.coordinates2d = polyCircle(x, y, fish.scale * 1.95, 12);
            n[1].node.fill = colors[0];
            n[1].node.coordinates2d = polyCircle(x, y, fish.scale * 1.4, 12);
            n[2].node.fill = colors[1];
            n[2].node.coordinates2d = fishTail(x, y, fish.dir, fish.scale, species);
            n[3].node.fill = colors[1];
            n[3].node.coordinates2d = fishFin(x, y, fish.dir, fish.scale, species, true);
            n[4].node.fill = colors[2];
            n[4].node.coordinates2d = polyCircle(eyeX, eyeY, 0.16 * fish.scale, 7);
            n[5].node.fill = colors[1];
            n[5].node.coordinates2d = diamond(x - fish.dir * length * 0.12, y + height * 0.2, 0.24 * fish.scale, 0.18 * fish.scale);
            this.scaleRigAround(n, x, y, zoom);
            return;
        }

        if (renderType === 'turtle') {
            const headX = x + fish.dir * length * 0.48;
            n[0].node.fill = colors[0];
            n[0].node.coordinates2d = polyEllipse(x - fish.dir * length * 0.08, y, length * 0.5, height * 0.52, 12);
            n[1].node.fill = colors[1];
            n[1].node.coordinates2d = polyEllipse(headX, y, length * 0.18, height * 0.2, 9);
            n[2].node.fill = colors[1];
            n[2].node.coordinates2d = [
                [x + fish.dir * length * 0.14, y - height * 0.18],
                [x + fish.dir * length * 0.42, y - height * 0.72],
                [x - fish.dir * length * 0.02, y - height * 0.34],
                [x + fish.dir * length * 0.14, y - height * 0.18]
            ];
            n[3].node.fill = colors[1];
            n[3].node.coordinates2d = [
                [x - fish.dir * length * 0.16, y + height * 0.12],
                [x - fish.dir * length * 0.48, y + height * 0.58],
                [x + fish.dir * length * 0.02, y + height * 0.32],
                [x - fish.dir * length * 0.16, y + height * 0.12]
            ];
            n[4].node.fill = colors[2];
            n[4].node.coordinates2d = polyCircle(headX + fish.dir * length * 0.06, y - height * 0.08, 0.11 * fish.scale, 7);
            n[5].node.fill = colors[2];
            n[5].node.coordinates2d = diamond(x - fish.dir * length * 0.08, y, length * 0.2, height * 0.23);
            this.scaleRigAround(n, x, y, zoom);
            return;
        }

        if (renderType === 'shark') {
            n[0].node.fill = colors[0];
            n[0].node.coordinates2d = fishBody(x, y, fish.dir, fish.scale, species);
            n[1].node.fill = colors[1];
            n[1].node.coordinates2d = fishTail(x, y, fish.dir, fish.scale, species);
            n[2].node.fill = colors[1];
            n[2].node.coordinates2d = [
                [x - fish.dir * length * 0.05, y - height * 0.28],
                [x - fish.dir * length * 0.28, y - height * 1.05],
                [x + fish.dir * length * 0.2, y - height * 0.35],
                [x - fish.dir * length * 0.05, y - height * 0.28]
            ];
            n[3].node.fill = colors[1];
            n[3].node.coordinates2d = fishFin(x, y, fish.dir, fish.scale, species, false);
            n[4].node.fill = colors[2];
            n[4].node.coordinates2d = polyCircle(eyeX, eyeY, 0.14 * fish.scale, 7);
            n[5].node.fill = colors[2];
            n[5].node.coordinates2d = thickLine(
                x + fish.dir * length * 0.23, y - height * 0.08,
                x + fish.dir * length * 0.23, y + height * 0.28,
                0.09 * fish.scale
            );
            this.scaleRigAround(n, x, y, zoom);
            return;
        }

        n[0].node.fill = colors[0];
        n[0].node.coordinates2d = fishBody(x, y, fish.dir, fish.scale, species);
        n[1].node.fill = renderType === 'guppy' ? colors[0] : colors[1];
        n[1].node.coordinates2d = fishTail(x, y, fish.dir, fish.scale, species);
        n[2].node.fill = colors[1];
        n[2].node.coordinates2d = fishFin(x, y, fish.dir, fish.scale, species, true);
        n[3].node.fill = colors[1];
        n[3].node.coordinates2d = fishFin(x, y, fish.dir, fish.scale, species, false);
        n[4].node.fill = colors[2];
        n[4].node.coordinates2d = polyCircle(eyeX, eyeY, 0.14 * fish.scale, 7);

        n[5].node.fill = colors[1];
        if (renderType === 'neon') {
            n[5].node.coordinates2d = thickLine(
                x - fish.dir * length * 0.42, y - height * 0.12,
                x + fish.dir * length * 0.36, y - height * 0.12,
                0.14 * fish.scale
            );
        } else if (renderType === 'betta') {
            n[5].node.coordinates2d = [
                [x - fish.dir * length * 0.42, y],
                [x - fish.dir * length * 1.05, y - height * 0.95],
                [x - fish.dir * length * 0.85, y],
                [x - fish.dir * length * 1.05, y + height * 0.95],
                [x - fish.dir * length * 0.42, y]
            ];
        } else if (renderType === 'lionfish') {
            n[5].node.coordinates2d = fishStripe(x, y, fish.dir, fish.scale, species, 0.15, 0.055);
        } else if (renderType === 'clown') {
            n[5].node.coordinates2d = fishStripe(x, y, fish.dir, fish.scale, species, 0.15, 0.055);
        } else if (renderType === 'tang') {
            n[5].node.coordinates2d = fishStripe(x, y, fish.dir, fish.scale, species, -0.32, 0.08);
        } else if (renderType === 'angel') {
            n[5].node.coordinates2d = fishStripe(x, y, fish.dir, fish.scale, species, -0.08, 0.055);
        } else {
            n[5].node.coordinates2d = diamond(x - fish.dir * length * 0.12, y + height * 0.28, 0.16, 0.24);
        }
        this.scaleRigAround(n, x, y, zoom);
    }

    renderBubbles(player) {
        const view = player.view;
        const zoom = this.screenScale(player);
        const selected = this.selectVisible(player, this.bubbles, VIEW_CAP.bubbles, 1);
        this.ensureShapePool(view, 'bubbleSlots', view.bubbleLayer, selected.length);
        this.bindSlots(view.bubbleSlots, selected);
        for (const slot of view.bubbleSlots) {
            if (!slot.boundId) continue;
            const bubble = slot.boundItem;
            if (!bubble) continue;
            const node = slot.nodes[0];
            const size = bubble.size * zoom;
            node.node.fill = [COLORS.white[0], COLORS.white[1], COLORS.white[2], 150];
            node.node.coordinates2d = polyCircle(this.worldToScreenX(player, bubble.x), this.worldToScreenY(player, bubble.y), size, 8);
        }
    }

    renderFloaters(player) {
        const view = player.view;
        const zoom = this.screenScale(player);
        const selected = this.selectVisible(player, this.floaters, VIEW_CAP.floaters, 2);
        this.ensureTextPool(view, 'floaterSlots', view.floaterLayer, selected.length);
        this.bindSlots(view.floaterSlots, selected);
        for (const slot of view.floaterSlots) {
            if (!slot.boundId) continue;
            const floater = slot.boundItem;
            if (!floater) continue;
            setText(slot.node, floater.label);
            setTextPosition(slot.node, this.worldToScreenX(player, floater.x), this.worldToScreenY(player, floater.y));
            setTextSize(slot.node, clamp(1.8 * zoom, 0.8, 2.4));
            setTextColor(slot.node, floater.color);
        }
    }

    _aquariumBase_exportCheckpoint() {
        return {
            kind: 'homegames.save',
            formatVersion: 4,
            game: 'aquarium-forever-strict-streaming',
            elapsedSeconds: this.time,
            tankTier: this.tankTier,
            economy: {
                money: this.economy.money,
                totalEarned: this.economy.totalEarned,
                foodEaten: this.economy.foodEaten,
                foodLevel: this.economy.foodLevel,
                fishPurchases: Object.assign({}, this.economy.fishPurchases),
                decorPurchases: Object.assign({}, this.economy.decorPurchases)
            },
            fish: this.fish.filter(fish => !fish.golden).map((fish) => ({
                speciesId: fish.speciesId,
                x: fish.x,
                y: fish.y,
                dir: fish.dir,
                scale: fish.scale,
                name: fish.name,
                trait: fish.trait || '',
                bornAt: fish.bornAt || 0,
                bites: fish.bites || 0,
                lifetimeEarned: fish.lifetimeEarned || 0
            })),
            accessories: this.accessories.map((item) => ({
                type: item.type,
                x: item.x,
                y: item.y,
                nextAction: item.nextAction
            })),
            decorCounts: Object.assign({}, this.decorCounts)
        };
    }

    // ---------------------------------------------------------------------
    // Beyond the Surface
    // Formerly implemented as AquariumSpace extends AquariumBase. Keeping
    // these behaviors on the directly-exported ViewableGame satisfies the
    // publishing contract without sacrificing per-player view streaming.
    // ---------------------------------------------------------------------

    poolLimits() {
        return this.tankTier >= 4 ? SPACE_POOL_LIMITS : this._aquariumBase_poolLimits();
    }

    shopItems(player) {
        if (player.shopTab === 'fish') {
            return CATALOG.fish.concat(Array.isArray(CATALOG.aliens) ? CATALOG.aliens : []);
        }
        if (player.shopTab === 'tank') return this.worldShopItems();
        return this._aquariumBase_shopItems(player);
    }

    buildShopUi(player) {
        this._aquariumBase_buildShopUi(player);
        if (!player.view || !player.view.ui) return;
        const ui = player.view.ui;
        if (ui.fishTabText) setText(ui.fishTabText, 'LIFE');
        if (ui.tankTabText) setText(ui.tankTabText, 'WORLD');
    }

    worldUpgradeLevel(id) {
        return Math.max(0, (this.progression && this.progression.worldUpgrades && this.progression.worldUpgrades[id]) || 0);
    }

    worldUpgradeUnlocked(item) {
        if (!item) return false;
        if ((item.unlockTier || 0) > this.tankTier) return false;
        if (item.requiresSpace && !this.spaceUnlocked) return false;
        if (item.requiresHorizon && !this.horizonAccessible()) return false;
        if ((item.minEra || 1) > (this.progression ? this.progression.era : 1)) return false;
        return true;
    }

    worldUpgradeLockText(item) {
        if ((item.unlockTier || 0) > this.tankTier) {
            const tank = CATALOG.tanks[item.unlockTier];
            return tank ? `UNLOCK: ${tank.name}` : 'LOCKED';
        }
        if (item.requiresSpace && !this.spaceUnlocked) return 'UNLOCK: SPACE';
        if (item.requiresHorizon && !this.horizonAccessible()) return 'UNLOCK: HORIZON';
        if ((item.minEra || 1) > this.progression.era) return `UNLOCK: ERA ${item.minEra}`;
        return '';
    }

    worldUpgradeCost(item) {
        const level = this.worldUpgradeLevel(item.id);
        return clamp(Math.floor(item.baseCost * Math.pow(item.growth || 6, level)), 1, MAX_POINTS);
    }

    effectiveFishCap() {
        return (this.currentTank().fishCap || 0) + this.worldUpgradeLevel('giant-kelp') * 12 + this.worldUpgradeLevel('migration-gate') * 20;
    }

    effectiveAlienCap() {
        return (this.currentTank().alienCap || 400) + this.worldUpgradeLevel('orbital-station') * 40;
    }

    waterFoodValueMultiplier() {
        return 1 + this.worldUpgradeLevel('sun-shafts') * 0.15;
    }

    waterRewardMultiplier() {
        return 1 + this.worldUpgradeLevel('crown-reef') * 0.20;
    }

    spaceFoodValueMultiplier() {
        return 1 + this.worldUpgradeLevel('nebula-clouds') * 0.20;
    }

    worldCrownRewardMultiplier() {
        return 1 + this.worldUpgradeLevel('world-crown') * 0.25;
    }

    horizonGoalMultiplier() {
        return Math.max(0.60, 1 - this.worldUpgradeLevel('horizon-lights') * 0.08);
    }

    goldenRewardMultiplier() {
        return GOLDEN_REWARD_MULTIPLIER + this.worldUpgradeLevel('aurora-whales') * 25;
    }

    goldenVisitorIntervalMultiplier() {
        return Math.max(0.70, 1 - this.worldUpgradeLevel('aurora-whales') * 0.10);
    }

    eventIntervalMultiplier() {
        return Math.max(0.55, 1 - this.worldUpgradeLevel('event-engine') * 0.15);
    }

    eventBonusStrength() {
        return 1 + this.worldUpgradeLevel('event-engine') * 0.25;
    }

    migrationBonusMultiplier() {
        return 1 + this.worldUpgradeLevel('migration-gate') * 0.75;
    }

    nextWorldEventDelay() {
        return rand(WORLD_EVENT_MIN_SECONDS, WORLD_EVENT_MAX_SECONDS) * this.eventIntervalMultiplier();
    }

    nextFirstWorldEventDelay() {
        return rand(WORLD_FIRST_EVENT_MIN_SECONDS, WORLD_FIRST_EVENT_MAX_SECONDS) * this.eventIntervalMultiplier();
    }

    nextGoldenVisitorDelay() {
        return rand(GOLDEN_EVENT_MIN_SECONDS, GOLDEN_EVENT_MAX_SECONDS) * this.goldenVisitorIntervalMultiplier();
    }

    nextFirstGoldenVisitorDelay() {
        return rand(GOLDEN_FIRST_EVENT_MIN_SECONDS, GOLDEN_FIRST_EVENT_MAX_SECONDS) * this.goldenVisitorIntervalMultiplier();
    }

    worldUpgradeEffectText(item, level = this.worldUpgradeLevel(item && item.id)) {
        if (!item) return '';
        const lv = Math.max(0, Math.floor(level));
        switch (item.id) {
            case 'sun-shafts': return `WATER FOOD +${lv * 15}%`;
            case 'giant-kelp': return `FISH CAP +${lv * 12}`;
            case 'crown-reef': return `WATER BITES +${lv * 20}%`;
            case 'nebula-clouds': return `COSMIC FOOD +${lv * 20}%`;
            case 'orbital-station': return `ALIEN CAP +${lv * 40}`;
            case 'horizon-lights': return `ERA GOAL -${lv * 8}%`;
            case 'aurora-whales': return `GOLDEN ${GOLDEN_REWARD_MULTIPLIER + lv * 25}x · ${lv * 10}% SOONER`;
            case 'world-crown': return `ALL BITES +${lv * 25}%`;
            case 'gene-garden': return `MUTATIONS +${(lv * 2.5).toFixed(1).replace('.0','')}% · MUTANT VALUE +${lv * 25}%`;
            case 'event-engine': return `EVENTS ${lv * 15}% SOONER · EVENT POWER +${lv * 25}%`;
            case 'migration-gate': return `FISH CAP +${lv * 20} · MIGRATION POWER +${lv * 75}%`;
            default: return '';
        }
    }

    worldShopItems() {
        const items = [];
        const next = this.nextTank();
        if (next) {
            items.push({
                id: `expand:${next.id}`,
                worldType: 'expand',
                name: next.id === 'space' ? 'BREAK THE SURFACE' : `EXPAND: ${next.name}`,
                description: next.id === 'space' ? 'UNLOCK SPACE + ALIEN LIFE' : `WIDTH ${next.width} · FISH ${next.fishCap}`,
                cost: next.upgradeCost
            });
        } else if (this.spaceUnlocked) {
            items.push({
                id: 'visit-horizon', worldType: 'horizon', name: 'VISIT THE HORIZON',
                description: this.horizonAccessible() ? `${this.totalHorizonMarkerCount()} MONUMENTS TO THE EAST` : 'EARN THE FIRST MONUMENT'
            });
            items.push({
                id: 'new-era', worldType: 'era', name: 'BEGIN A NEW ERA',
                description: 'PRESERVE HISTORY · RESET FOR A PERMANENT BONUS'
            });
        }
        for (const upgrade of WORLD_UPGRADES) items.push({ ...upgrade, worldType: 'upgrade' });
        return items;
    }

    buyWorldItem(player, item) {
        if (!item) return;
        if (item.worldType === 'expand') {
            this.buyTankUpgrade(player);
            return;
        }
        if (item.worldType === 'horizon') {
            if (!this.horizonAccessible()) return this.setStatus(player, `NEED ${this.formatCompact(this.currentEraMilestoneThreshold(0))}`);
            this.focusHorizonCamera(player.id);
            return;
        }
        if (item.worldType === 'era') {
            if (this.currentEraMarkerCount() < HORIZON_MARKERS_PER_ERA) return this.setStatus(player, 'COMPLETE THE HORIZON FIRST');
            this.voteNewEra(player.id);
            return;
        }
        if (item.worldType !== 'upgrade') return;
        const level = this.worldUpgradeLevel(item.id);
        if (!this.worldUpgradeUnlocked(item)) return this.setStatus(player, this.worldUpgradeLockText(item));
        if (level >= item.maxLevel) return this.setStatus(player, 'MAXED OUT');
        const cost = this.worldUpgradeCost(item);
        if (this.economy.money < cost) return this.setStatus(player, `NEED ${this.formatCompact(cost - this.economy.money)}`);
        this.economy.money -= cost;
        this.progression.worldUpgrades[item.id] = level + 1;
        if (item.id === 'horizon-lights') this.refreshHorizonUnlocks(false);
        // Aurora Whales affects the next arrival immediately, not only after the
        // currently scheduled long interval has elapsed.
        if (item.id === 'aurora-whales' && this.goldenEvent && !this.goldenEvent.active) {
            this.goldenEvent.nextAt = Math.min(this.goldenEvent.nextAt, this.time + this.nextGoldenVisitorDelay());
        }
        if (item.id === 'event-engine' && this.worldEvent && !this.worldEvent.active) {
            this.worldEvent.nextAt = Math.min(this.worldEvent.nextAt, this.time + this.nextWorldEventDelay());
        }
        const effect = this.worldUpgradeEffectText(item, level + 1);
        this.setGlobalStatus(`${item.name} LV ${level + 1} · ${effect}`, 3.2);
        this.setProgressionCelebration(
            `${item.name} · LV ${level + 1}`,
            effect,
            { kind: 'milestone', duration: 3.6 }
        );
        this.persist();
    }

    worldMinY() {
        return this.spaceUnlocked ? SPACE_MIN_Y : AQUARIUM_MIN_Y;
    }

    clampCamera(player) {
        const bounds = this.tankBounds();
        const minY = this.worldMinY();
        const maxY = AQUARIUM_MAX_Y;
        const clampAxis = (value, targetValue, currentHalf, targetHalf, min, max, fallback) => {
            const currentMin = min + Math.min(currentHalf, (max - min) / 2);
            const currentMax = max - Math.min(currentHalf, (max - min) / 2);
            const targetMin = min + Math.min(targetHalf, (max - min) / 2);
            const targetMax = max - Math.min(targetHalf, (max - min) / 2);
            return {
                value: currentMin > currentMax ? fallback : clamp(value, currentMin, currentMax),
                target: targetMin > targetMax ? fallback : clamp(targetValue, targetMin, targetMax)
            };
        };

        const worldMaxX = this.horizonAccessible() ? Math.max(bounds.max, this.horizonMaxX()) : bounds.max;
        const xAxis = clampAxis(
            player.camera.x, player.camera.targetX,
            50 / player.camera.zoom, 50 / player.camera.targetZoom,
            bounds.min, worldMaxX, WORLD_CENTER_X
        );
        player.camera.x = xAxis.value;
        player.camera.targetX = xAxis.target;

        const fallbackY = this.spaceUnlocked ? -80 : 50;
        const yAxis = clampAxis(
            player.camera.y, player.camera.targetY,
            50 / player.camera.zoom, 50 / player.camera.targetZoom,
            minY, maxY, fallbackY
        );
        player.camera.y = yAxis.value;
        player.camera.targetY = yAxis.target;
    }

    focusSpaceCamera(playerId) {
        const player = this.players[playerId];
        if (!player || !player.connected || !this.spaceUnlocked) return;
        player.camera.targetX = WORLD_CENTER_X;
        player.camera.targetY = -142;
        player.camera.targetZoom = Math.max(this.minZoom(), 0.72);
        player.camera.velocity = 0;
        player.camera.velocityY = 0;
        this.clampCamera(player);
    }

    handleKeyDown(playerId, key) {
        const normalized = String(key || '').toLowerCase();
        if (normalized === 'r' || normalized === 'v') this.focusSpaceCamera(playerId);
        if (normalized === 't') this.focusHorizonCamera(playerId);
        this._aquariumBase_handleKeyDown(playerId, key);
    }

    buildCameraControls(player) {
        this._aquariumBase_buildCameraControls(player);
        const controls = player.view && player.view.controls;
        if (!controls || controls.spaceButton) return;
        const controlFill = [13, 25, 42, 150];
        const controlLine = [235, 247, 250, 220];
        controls.spaceButton = makeShape(polyCircle(67.5, 95, 2.6, 14), controlFill, {
            color: controlLine,
            border: 2,
            onClick: () => this.focusSpaceCamera(player.id)
        });
        controls.spaceGlyph = makeShape([
            [67.5, 92.9], [68.1, 94.2], [69.5, 94.4], [68.45, 95.35],
            [68.75, 96.8], [67.5, 96.05], [66.25, 96.8], [66.55, 95.35],
            [65.5, 94.4], [66.9, 94.2], [67.5, 92.9]
        ], controlLine, { onClick: () => this.focusSpaceCamera(player.id) });
        controls.horizonButton = makeShape(polyCircle(74.5, 95, 2.6, 14), controlFill, {
            color: controlLine,
            border: 2,
            onClick: () => this.focusHorizonCamera(player.id)
        });
        controls.horizonGlyph = makeShape([
            [72.6, 96.4], [73.5, 94.2], [74.35, 95.0], [75.15, 93.1],
            [76.4, 96.4], [72.6, 96.4]
        ], controlLine, { onClick: () => this.focusHorizonCamera(player.id) });
        // Keep the wide aquarium, but give the bottom camera controls distinct
        // touch targets instead of tightly packed, flattened circles.
        const buttons = [
            ['zoomOutButton', 39.5, 10, ['zoomOutGlyph']],
            ['centerButton', 46.5, 26, ['centerGlyph']],
            ['floorButton', 53.5, 42, ['floorGlyph']],
            ['zoomInButton', 60.5, 58, ['zoomInGlyphH', 'zoomInGlyphV']],
            ['spaceButton', 67.5, 74, ['spaceGlyph']],
            ['horizonButton', 74.5, 90, ['horizonGlyph']]
        ];
        for (const [button, oldX, x, glyphs] of buttons) {
            controls[button].node.coordinates2d = ShapeUtils.rectangle(x - 6, 89, 12, 11);
            for (const glyph of glyphs) {
                controls[glyph].node.coordinates2d = controls[glyph].node.coordinates2d.map(([gx, gy]) =>
                    [x + (gx - oldX) * 1.7, 94.5 + (gy - 95) * 1.7]);
            }
        }
        controls.spaceAttached = false;
        controls.horizonAttached = false;
        this.updateCameraControls(player);
    }

    updateCameraControls(player) {
        this._aquariumBase_updateCameraControls(player);
        const controls = player.view && player.view.controls;
        if (!controls) return;

        // Once space exists, vertical panning is meaningful even at 1x zoom.
        const verticalNeeded = this.spaceUnlocked || this.viewHeight(player) < 99.9;
        if (verticalNeeded !== controls.verticalPanAttached) {
            const nodes = [controls.panUpButton, controls.panDownButton];
            if (verticalNeeded) nodes.forEach((node) => controls.layer.addChild(node));
            else nodes.forEach((node) => controls.layer.removeChild(node.node.id));
            controls.verticalPanAttached = verticalNeeded;
        }

        // The Horizon extends east beyond the physical tank. Once any monument
        // exists, horizontal panning stays available even when the tank itself fits.
        const horizontalNeeded = this.horizonAccessible() || this.currentTank().width > this.viewWidth(player) + 0.1;
        if (horizontalNeeded !== controls.horizontalPanAttached) {
            const nodes = [controls.panLeftButton, controls.panRightButton];
            if (horizontalNeeded) nodes.forEach((node) => controls.layer.addChild(node));
            else nodes.forEach((node) => controls.layer.removeChild(node.node.id));
            controls.horizontalPanAttached = horizontalNeeded;
        }

        if (!controls.spaceButton) return;
        if (this.spaceUnlocked !== controls.spaceAttached) {
            const nodes = [controls.spaceButton, controls.spaceGlyph];
            if (this.spaceUnlocked) nodes.forEach((node) => controls.layer.addChild(node));
            else nodes.forEach((node) => controls.layer.removeChild(node.node.id));
            controls.spaceAttached = this.spaceUnlocked;
        }
        const horizonNeeded = this.horizonAccessible();
        if (controls.horizonButton && horizonNeeded !== controls.horizonAttached) {
            const nodes = [controls.horizonButton, controls.horizonGlyph];
            if (horizonNeeded) nodes.forEach((node) => controls.layer.addChild(node));
            else nodes.forEach((node) => controls.layer.removeChild(node.node.id));
            controls.horizonAttached = horizonNeeded;
        }
    }

    buildViewBackground(player) {
        this._aquariumBase_buildViewBackground(player);
        const view = player.view;
        view.starSlots = [];
        view.surfaceSlots = [];
        view.spaceRockSlots = [];
        view.alienLiteSlots = [];
        view.alienSlots = [];
        view.horizonMarkerSlots = [];
        view.horizonLabelSlots = [];

        // Reuse the existing ordered presentation layers. This keeps stars behind
        // food/creatures, asteroids with other rocks, and aliens in the creature
        // layers without adding empty structural branches to every player view.
        view.spaceStarLayer = view.causticLayer;
        view.spaceRockLayer = view.rockLayer;
        view.alienLiteLayer = view.fishLiteLayer;
        view.alienLayer = view.fishLayer;

        // Horizon content is procedural and only exists in the player's tree while
        // visible. It sits in front of the ambient world but behind screen-space UI.
        view.horizonLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        view.horizonTextLayer = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), COLORS.transparent);
        view.worldRoot.addChild(view.horizonLayer);
        view.worldRoot.addChild(view.horizonTextLayer);
    }

    renderSand(player) {
        const view = player.view;
        const rect = this.visibleWorldRect(player, 2);
        const tank = this.tankBounds();
        const horizontalTank = rect.maxX >= tank.min - 4 && rect.minX <= tank.max + 4;
        const needed = horizontalTank && rect.maxY >= 77 && rect.minY <= 103;
        if (needed) {
            if (!view.sandBackAttached) {
                view.sandBackLayer.addChild(view.sandBack);
                view.sandBackAttached = true;
            }
            if (!view.sandFrontAttached) {
                view.sandFrontLayer.addChild(view.sandFront);
                view.sandFrontAttached = true;
            }
            this._aquariumBase_renderSand(player);
        } else {
            if (view.sandBackAttached) {
                view.sandBackLayer.removeChild(view.sandBack.node.id);
                view.sandBackAttached = false;
            }
            if (view.sandFrontAttached) {
                view.sandFrontLayer.removeChild(view.sandFront.node.id);
                view.sandFrontAttached = false;
            }
        }
    }

    backgroundColorAt(worldY) {
        if (worldY >= 0) {
            if (worldY < 20) return [8, 48, 102, 255];
            if (worldY < 52) return [15, 88, 151, 255];
            return [31, 128, 178, 255];
        }
        if (worldY > SPACE_TRANSITION_Y) {
            const t = -worldY / -SPACE_TRANSITION_Y;
            return interpolateColor([8, 48, 102, 255], [8, 11, 31, 255], t);
        }
        const t = clamp((-worldY - 38) / 180, 0, 1);
        return interpolateColor([8, 11, 31, 255], [2, 3, 12, 255], t);
    }

    renderBackground(player) {
        this._aquariumBase_renderBackground(player);
        const view = player.view;
        const horizonView = this.isHorizonCamera(player);
        for (let i = 0; i < view.backgroundBands.length; i++) {
            const screenY = i * 17 + 8.5;
            view.backgroundBands[i].node.fill = horizonView
                ? this.horizonBackgroundColor(screenY)
                : this.backgroundColorAt(this.screenToWorldY(player, screenY));
        }
        // The original aquarium background stopped at y=83 because sand covered
        // the rest. Space and Horizon views may detach the sand, so the final band
        // fills the bottom of the viewport as well.
        if (view.backgroundBands[4]) {
            view.backgroundBands[4].node.coordinates2d = ShapeUtils.rectangle(0, 68, 100, 32);
        }
        view.root.node.fill = horizonView
            ? this.horizonBackgroundColor(96)
            : this.backgroundColorAt(this.screenToWorldY(player, 96));

        const rect = this.visibleWorldRect(player, 0);
        if (rect.maxY < AQUARIUM_MIN_Y || rect.minY > AQUARIUM_MAX_Y || horizonView) {
            this.ensureShapePool(view, 'tankEdges', view.edgeLayer, 0);
        }
        if (horizonView) {
            this.ensureShapePool(view, 'surfaceSlots', view.edgeLayer, 0);
            this.ensureShapePool(view, 'starSlots', view.spaceStarLayer, 0);
            this.ensureShapePool(view, 'spaceRockSlots', view.spaceRockLayer, 0);
        } else {
            this.renderSurfaceBoundary(player);
            this.renderSpaceScenery(player);
        }
    }

    renderSurfaceBoundary(player) {
        const view = player.view;
        if (!this.spaceUnlocked) {
            this.ensureShapePool(view, 'surfaceSlots', view.edgeLayer, 0);
            return;
        }
        const screenY = this.worldToScreenY(player, 0);
        if (screenY < -3 || screenY > 103) {
            this.ensureShapePool(view, 'surfaceSlots', view.edgeLayer, 0);
            return;
        }
        const bounds = this.tankBounds();
        const left = this.worldToScreenX(player, bounds.min);
        const right = this.worldToScreenX(player, bounds.max);
        const x = Math.max(0, Math.min(left, right));
        const width = Math.max(0, Math.min(100, Math.max(left, right)) - x);
        if (width <= 0) {
            this.ensureShapePool(view, 'surfaceSlots', view.edgeLayer, 0);
            return;
        }
        this.ensureShapePool(view, 'surfaceSlots', view.edgeLayer, 1);
        const node = view.surfaceSlots[0].nodes[0];
        const thickness = clamp(0.7 * this.screenScale(player), 0.35, 2.1);
        node.node.fill = [176, 239, 255, 210];
        node.node.coordinates2d = ShapeUtils.rectangle(x, screenY - thickness / 2, width, thickness);
    }

    buildSpaceWorld() {
        if (this.spaceBuilt) return;
        this.spaceBuilt = true;
        const bounds = this.tankBounds();
        for (let i = 0; i < 260; i++) {
            this.spaceStars.push({
                id: this.nextSpaceSceneryId++,
                x: rand(bounds.min - 20, bounds.max + 20),
                y: rand(SPACE_MIN_Y + 8, -18),
                size: rand(0.08, 0.34),
                phase: rand(0, TAU),
                bright: Math.random() < 0.18
            });
        }
        for (let i = 0; i < 36; i++) {
            this.spaceRocks.push({
                id: this.nextSpaceSceneryId++,
                x: rand(bounds.min + 4, bounds.max - 4),
                y: rand(SPACE_CREATURE_MIN_Y, SPACE_CREATURE_MAX_Y),
                width: rand(2.4, 7.5),
                height: rand(1.8, 5.2),
                phase: rand(0, TAU)
            });
        }
    }

    renderSpaceScenery(player) {
        const view = player.view;
        if (!this.spaceUnlocked || this.visibleWorldRect(player, 0).minY > -10) {
            this.ensureShapePool(view, 'starSlots', view.spaceStarLayer, 0);
            this.ensureShapePool(view, 'spaceRockSlots', view.spaceRockLayer, 0);
            return;
        }
        const zoom = this.screenScale(player);
        const stars = this.selectVisible(player, this.spaceStars, SPACE_VIEW_CAP.stars, 2);
        this.ensureShapePool(view, 'starSlots', view.spaceStarLayer, stars.length);
        this.bindSlots(view.starSlots, stars);
        for (const slot of view.starSlots) {
            const star = slot.boundItem;
            if (!star) continue;
            const pulse = 0.78 + Math.sin(this.time * 1.2 + star.phase) * 0.22;
            const radius = clamp(star.size * zoom * pulse, 0.06, 0.75);
            slot.nodes[0].node.fill = star.bright ? [195, 236, 255, 235] : [225, 230, 255, 175];
            slot.nodes[0].node.coordinates2d = polyCircle(
                this.worldToScreenX(player, star.x),
                this.worldToScreenY(player, star.y),
                radius,
                5
            );
        }

        const rocks = this.selectVisible(player, this.spaceRocks, SPACE_VIEW_CAP.rocks, 3);
        this.ensureShapePool(view, 'spaceRockSlots', view.spaceRockLayer, rocks.length);
        this.bindSlots(view.spaceRockSlots, rocks);
        for (const slot of view.spaceRockSlots) {
            const rock = slot.boundItem;
            if (!rock) continue;
            const x = this.worldToScreenX(player, rock.x);
            const y = this.worldToScreenY(player, rock.y);
            const w = rock.width * zoom;
            const h = rock.height * zoom;
            slot.nodes[0].node.fill = Math.floor(rock.phase * 2) % 2 ? [58, 55, 77, 255] : [83, 74, 103, 255];
            slot.nodes[0].node.coordinates2d = [
                [x - w * 0.55, y], [x - w * 0.32, y - h * 0.55],
                [x + w * 0.2, y - h * 0.48], [x + w * 0.58, y - h * 0.08],
                [x + w * 0.34, y + h * 0.5], [x - w * 0.34, y + h * 0.44],
                [x - w * 0.55, y]
            ];
        }
    }

    biomeAtWorldPosition(worldX, worldY) {
        const bounds = this.tankBounds();
        if (worldX < bounds.min - 2 || worldX > bounds.max + 2) return null;
        if (this.spaceUnlocked && worldY < SPACE_TRANSITION_Y) return 'space';
        if (worldY >= AQUARIUM_MIN_Y - 3 && worldY <= AQUARIUM_MAX_Y + 3) return 'water';
        return null;
    }

    dropFoodForBiome(playerId, biomeId, worldX, worldY, targetCreatureId = 0) {
        if (!biomeId) return false;
        if (biomeId === 'space') {
            return this.dropCosmicFood(playerId, worldX, worldY, targetCreatureId);
        }
        return this.dropFood(playerId, worldX, clamp(worldY, 3, 89), false, targetCreatureId);
    }

    buildWorldClickSurface(player) {
        const clickSurface = makeShape(ShapeUtils.rectangle(0, 0, 100, 100), [0, 0, 0, 0], {
            onClick: (playerId, x, y) => {
                const current = this.players[playerId];
                if (!current || !current.connected) return;
                if (current.shopOpen) return;
                if (y < 3 || y > 89) return;
                const target = this.findRenderedCreatureForClick(current, x, y);
                const worldX = this.screenToWorldX(current, x);
                const worldY = this.screenToWorldY(current, y);
                const biomeId = this.biomeAtWorldPosition(worldX, worldY);
                const targetCreatureId = target && target.biome === biomeId ? target.creature.id : 0;
                if (target && (current.camera.zoom >= 1.6 || target.creature.trait || target.creature.golden)) {
                    this.inspectCreature(current, target.creature);
                }
                this.dropFoodForBiome(playerId, biomeId, worldX, worldY, targetCreatureId);
            }
        });
        player.view.worldClickSurface = clickSurface;
        player.view.root.addChild(clickSurface);
    }

    findRenderedCreatureForClick(player, screenX, screenY) {
        const targets = player && player.view && Array.isArray(player.view.feedTargets)
            ? player.view.feedTargets
            : [];
        let best = null;
        let bestScore = Infinity;
        for (const target of targets) {
            const nx = (screenX - target.screenX) / Math.max(0.5, target.halfWidth);
            const ny = (screenY - target.screenY) / Math.max(0.5, target.halfHeight);
            const score = nx * nx + ny * ny;
            if (score <= 1.25 && score < bestScore) {
                best = target;
                bestScore = score;
            }
        }
        if (!best || !Array.isArray(best.members) || best.members.length === 0) return null;
        const worldX = this.screenToWorldX(player, screenX);
        const worldY = this.screenToWorldY(player, screenY);
        let creature = null;
        let nearest = Infinity;
        for (const member of best.members) {
            if (!member || !member.active || member.hidden) continue;
            const distance = dist(worldX, worldY, member.x, member.y);
            if (distance < nearest) {
                creature = member;
                nearest = distance;
            }
        }
        return creature ? {
            biome: best.biome || creature.biome || 'water',
            kind: best.kind || creature.kind || 'fish',
            creature
        } : null;
    }

    spawnFood(x, y, options = {}) {
        if (options.biome !== 'space') return this._aquariumBase_spawnFood(x, y, options);
        const food = this.findFoodSlot(options.allowGrow !== false);
        if (!food) return false;
        const bounds = this.tankBounds();
        food.active = true;
        food.biome = 'space';
        food.x = clamp(x, bounds.min + 2.5, bounds.max - 2.5);
        food.y = clamp(y, SPACE_CREATURE_MIN_Y + 6, SPACE_CREATURE_MAX_Y + 8);
        food.speed = rand(4.0, 6.2);
        food.value = Math.max(1, Math.floor((1 + this.economy.foodLevel) * (options.valueMultiplier || 1)));
        food.golden = true;
        food.age = 0;
        food.settledTime = 0;
        food.phase = rand(0, TAU);
        food.color = options.color || [133, 244, 255, 255];
        food.manualUntil = options.manual ? this.time + 4 : 0;
        food.preferredFishId = 0;
        food.preferredAlienId = 0;
        food.ownerPlayerId = Number.isFinite(options.ownerPlayerId) ? options.ownerPlayerId : 0;
        if (options.manual) this.primeCosmicFood(food, options.targetAlienId || 0);
        return true;
    }

    dropCosmicFood(playerId, x, y, targetAlienId = 0) {
        const player = this.players[playerId];
        if (!player || !player.connected || !this.spaceUnlocked || player.feedCooldown > 0) return false;
        player.feedCooldown = 0.09;
        return this.spawnFood(x, y, {
            biome: 'space',
            manual: true,
            ownerPlayerId: playerId,
            targetAlienId,
            color: player.color,
            valueMultiplier: 1,
            allowGrow: true
        });
    }

    spawnCosmicFood(x, y, options = {}) {
        return this.spawnFood(x, y, {
            biome: 'space',
            manual: false,
            color: options.color || [133, 244, 255, 255],
            valueMultiplier: options.valueMultiplier || 1,
            allowGrow: true
        });
    }

    updateFoodState() {
        for (const food of this.food) {
            if (!food.active) continue;
            food.age += DT;
            if (food.biome === 'space') {
                if (food.y > SPACE_CREATURE_MIN_Y + 2) {
                    food.y -= food.speed * DT;
                    food.x += Math.sin(this.time * 1.9 + food.phase) * 0.035 * LEGACY_30HZ_FRAME_SCALE;
                } else {
                    food.y = SPACE_CREATURE_MIN_Y + 2;
                    food.settledTime += DT;
                }
                if (food.settledTime > 18 || food.age > 42) food.active = false;
            } else {
                food.biome = 'water';
                if (food.y < 87.5) {
                    food.y += food.speed * DT;
                    food.x += Math.sin(this.time * 2.2 + food.phase) * 0.025 * LEGACY_30HZ_FRAME_SCALE;
                } else {
                    food.y = 87.5;
                    food.settledTime += DT;
                }
                if (food.settledTime > 20 || food.age > 45) food.active = false;
            }
        }
    }

    addAlien(speciesId, starter = false, preferredX = WORLD_CENTER_X) {
        const species = (CATALOG.aliens || []).find((item) => item.id === speciesId);
        if (!species || !this.spaceUnlocked) return false;
        const cap = this.effectiveAlienCap();
        if (this.aliens.filter((alien) => !alien.golden).length >= cap) return false;
        const bounds = this.tankBounds();
        const spawnMin = Math.max(bounds.min + 5, preferredX - 55);
        const spawnMax = Math.min(bounds.max - 5, preferredX + 55);
        const direction = Math.random() < 0.5 ? -1 : 1;
        const alien = {
            id: this.nextAlienId++,
            active: true,
            hidden: false,
            biome: 'space',
            kind: 'alien',
            speciesId,
            species,
            x: starter ? rand(bounds.min + 8, bounds.max - 8) : rand(spawnMin, Math.max(spawnMin + 1, spawnMax)),
            y: rand(SPACE_CREATURE_MIN_Y + 12, SPACE_CREATURE_MAX_Y - 8),
            dir: direction,
            scale: rand(0.88, 1.2),
            speed: species.speed * rand(0.88, 1.12),
            phase: rand(0, TAU),
            vx: direction * species.speed * rand(0.2, 0.5),
            vy: rand(-0.45, 0.45),
            desiredVx: direction * species.speed * 0.4,
            desiredVy: 0,
            targetX: rand(bounds.min + 5, bounds.max - 5),
            targetY: rand(SPACE_CREATURE_MIN_Y + 8, SPACE_CREATURE_MAX_Y - 8),
            targetTimer: rand(2, 7),
            foodTargetId: 0,
            hunger: rand(0.08, 0.75)
        };
        this.applyCreatureIdentity(alien, 'alien', starter);
        alien.scale *= this.creatureTraitScale(alien.trait);
        this.aliens.push(alien);
        this.alienById.set(alien.id, alien);
        this.fishCounts[speciesId] = (this.fishCounts[speciesId] || 0) + 1;
        this._renderSpatialIndexTime = -1;
        return true;
    }

    buyFish(player, item) {
        if (item && item.biome === 'space') {
            if (!this.spaceUnlocked || (item.unlockTier || 0) > this.tankTier) {
                return this.setStatus(player, 'BREAK THE SURFACE FIRST');
            }
            const cap = this.effectiveAlienCap();
            if (this.aliens.filter((alien) => !alien.golden).length >= cap) return this.setStatus(player, 'SPACE FULL');
            const bought = this.economy.fishPurchases[item.id] || 0;
            const cost = this.getFishCost(item);
            if (this.economy.money < cost) {
                return this.setStatus(player, `NEED ${this.formatCompact(cost - this.economy.money)}`);
            }
            this.economy.money -= cost;
            this.economy.fishPurchases[item.id] = bought + 1;
            this.addAlien(item.id, false, player.camera.x);
            this.setStatus(player, `${item.name} ARRIVED`);
            this.persist();
            return;
        }
        this._aquariumBase_buyFish(player, item);
    }

    formatCompact(value) {
        const n = Math.max(0, Math.floor(value || 0));
        if (n < 1000) return String(n);
        for (const [size, suffix] of NUMBER_UNITS) {
            if (n >= size) {
                const scaled = n / size;
                return `${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, '')}${suffix}`;
            }
        }
        return String(n);
    }

    formatMultiplier(value) {
        const n = Math.max(1, Number.isFinite(value) ? value : 1);
        if (n < 10) return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
        if (n < 100) return n.toFixed(1).replace(/\.0$/, '');
        return this.formatCompact(n);
    }

    buyTankUpgrade(player) {
        const next = this.nextTank();
        if (!next || next.id !== 'space') {
            this._aquariumBase_buyTankUpgrade(player);
            return;
        }
        if (this.economy.money < next.upgradeCost) {
            return this.setStatus(player, `NEED ${this.formatCompact(next.upgradeCost - this.economy.money)}`);
        }
        this.economy.money -= next.upgradeCost;
        this.tankTier++;
        this.spaceUnlocked = true;
        this.buildSpaceWorld();

        const seeds = [
            ['orbit-blob', 6], ['prism-ray', 3], ['tripod-grazer', 2], ['void-leviathan', 1]
        ];
        for (const [speciesId, count] of seeds) {
            for (let i = 0; i < count; i++) this.addAlien(speciesId, true);
        }

        for (const playerId of this.playerOrder) {
            const other = this.players[playerId];
            if (!other || !other.connected) continue;
            other.camera.targetX = WORLD_CENTER_X;
            other.camera.targetY = -110;
            other.camera.targetZoom = 0.72;
            other.camera.velocity = 0;
            other.camera.velocityY = 0;
            this.clampCamera(other);
            this.updateCameraControls(other);
        }
        this.refreshHorizonUnlocks(true);
        this.setGlobalStatus('SPACE UNLOCKED', 4.2);
        this.persist();
    }

    activateAccessory(type) {
        const spaceTypes = new Set(['orbital-feeder', 'gravity-well', 'asteroid-garden', 'signal-beacon', 'wormhole']);
        if (!spaceTypes.has(type)) {
            this._aquariumBase_activateAccessory(type);
            return;
        }
        const bounds = this.tankBounds();
        const index = this.accessories.reduce((count, item) => count + (item.type === type ? 1 : 0), 0);
        const offsets = {
            'orbital-feeder': -70,
            'gravity-well': -145,
            'asteroid-garden': -205,
            'signal-beacon': -108,
            'wormhole': -175
        };
        const t = ((0.17 + index * 0.61803398875) % 1);
        const accessory = {
            id: this.nextAccessoryId++,
            active: true,
            type,
            x: bounds.min + 7 + (bounds.max - bounds.min - 14) * t,
            y: offsets[type] + (index % 3) * 5,
            phase: rand(0, TAU),
            direction: Math.random() < 0.5 ? -1 : 1,
            speed: type === 'orbital-feeder' ? rand(4, 6) : 0,
            nextAction: this.time + rand(4, 10)
        };
        this.accessories.push(accessory);
        this.accessoryById.set(accessory.id, accessory);
    }

    updateAccessoriesState() {
        this._aquariumBase_updateAccessoriesState();
        if (!this.spaceUnlocked) return;
        const bounds = this.tankBounds();
        for (const accessory of this.accessories) {
            if (!accessory.active) continue;
            if (accessory.type === 'orbital-feeder') {
                accessory.x += accessory.direction * accessory.speed * DT;
                if (accessory.x < bounds.min + 6 || accessory.x > bounds.max - 6) {
                    accessory.x = clamp(accessory.x, bounds.min + 6, bounds.max - 6);
                    accessory.direction *= -1;
                }
                if (this.time >= accessory.nextAction) {
                    accessory.nextAction = this.time + rand(4.5, 7.5);
                    this.spawnCosmicFood(accessory.x + rand(-4, 4), accessory.y - 2, {
                        valueMultiplier: 1.4,
                        color: [122, 243, 255, 255]
                    });
                }
            } else if (accessory.type === 'wormhole' && this.time >= accessory.nextAction) {
                accessory.nextAction = this.time + rand(8, 13);
                const candidates = this.aliens.filter((alien) => alien.active);
                if (candidates.length) {
                    const alien = candidates[Math.floor(Math.random() * candidates.length)];
                    alien.x = WORLD_CENTER_X + (alien.x < WORLD_CENTER_X ? 1 : -1) * rand(35, 120);
                    alien.y = clamp(alien.y + rand(-35, 35), SPACE_CREATURE_MIN_Y + 8, SPACE_CREATURE_MAX_Y - 8);
                    alien.targetTimer = 0;
                }
            }
        }
    }

    renderAccessoryLite(player, accessory, node) {
        const x = this.worldToScreenX(player, accessory.x);
        const y = this.worldToScreenY(player, accessory.y);
        const zoom = this.screenScale(player);
        if (accessory.type === 'orbital-feeder') {
            node.node.fill = [102, 210, 240, 255];
            node.node.coordinates2d = [
                [x - 3.2 * zoom, y], [x - 1.4 * zoom, y - 1.2 * zoom],
                [x + 1.4 * zoom, y - 1.2 * zoom], [x + 3.2 * zoom, y],
                [x + 1.4 * zoom, y + 1.2 * zoom], [x - 1.4 * zoom, y + 1.2 * zoom],
                [x - 3.2 * zoom, y]
            ];
            return;
        }
        if (accessory.type === 'gravity-well') {
            node.node.fill = [133, 75, 232, 230];
            node.node.coordinates2d = polyCircle(x, y, 2.8 * zoom, 14);
            return;
        }
        if (accessory.type === 'asteroid-garden') {
            node.node.fill = [92, 80, 112, 255];
            node.node.coordinates2d = [
                [x - 4 * zoom, y + 1.4 * zoom], [x - 2.5 * zoom, y - 1.8 * zoom],
                [x + 0.4 * zoom, y - 2.6 * zoom], [x + 4.2 * zoom, y - 0.4 * zoom],
                [x + 2.7 * zoom, y + 2.1 * zoom], [x - 1.6 * zoom, y + 2.5 * zoom],
                [x - 4 * zoom, y + 1.4 * zoom]
            ];
            return;
        }
        if (accessory.type === 'signal-beacon') {
            node.node.fill = [255, 209, 85, 255];
            node.node.coordinates2d = diamond(x, y, 2.1 * zoom, 4.2 * zoom);
            return;
        }
        if (accessory.type === 'wormhole') {
            node.node.fill = [219, 92, 255, 220];
            node.node.coordinates2d = polyEllipse(x, y, 3.8 * zoom, 2.4 * zoom, 16);
            return;
        }
        this._aquariumBase_renderAccessoryLite(player, accessory, node);
    }

    primeCosmicFood(food, targetAlienId = 0) {
        if (targetAlienId) {
            const targeted = this.alienById.get(targetAlienId);
            if (targeted && targeted.active) return this.consumeCosmicFood(food, targeted, food.x, food.y);
        }
        let nearest = null;
        let nearestDistance = Infinity;
        for (const alien of this.aliens) {
            if (!alien.active) continue;
            if (this.alienContainsPoint(alien, food.x, food.y)) {
                return this.consumeCosmicFood(food, alien, food.x, food.y);
            }
            const distance = dist(alien.x, alien.y, food.x, food.y);
            if (distance < nearestDistance && distance <= 42) {
                nearest = alien;
                nearestDistance = distance;
            }
        }
        if (nearest) {
            food.preferredAlienId = nearest.id;
            this.pointAlienAtFood(nearest, food);
        }
        return false;
    }

    alienContainsPoint(alien, x, y) {
        const halfWidth = Math.max(2, alien.species.length * alien.scale * 0.65);
        const halfHeight = Math.max(1.8, alien.species.height * alien.scale * 0.7);
        const nx = (x - alien.x) / halfWidth;
        const ny = (y - alien.y) / halfHeight;
        return nx * nx + ny * ny <= 1;
    }

    pointAlienAtFood(alien, food) {
        const dx = food.x - alien.x;
        const dy = food.y - alien.y;
        const length = Math.max(0.001, Math.hypot(dx, dy));
        alien.foodTargetId = food.id;
        alien.desiredVx = dx / length * alien.speed * 1.3;
        alien.desiredVy = dy / length * alien.speed * 1.3;
        if (Math.abs(dx) > 0.05) alien.dir = dx >= 0 ? 1 : -1;
    }

    consumeCosmicFood(food, alien, feedbackX = alien.x, feedbackY = alien.y) {
        if (!food || !alien || !food.active || !alien.active) return false;
        food.active = false;
        food.manualUntil = 0;
        food.preferredAlienId = 0;
        alien.foodTargetId = 0;
        alien.hunger = 0;
        const signalBonus = 1 + (this.decorCounts['signal-beacon'] || 0) * 0.2;
        const rareMultiplier = alien.golden ? this.goldenRewardMultiplier() : 1;
        const traitMultiplier = this.creatureTraitRewardMultiplier(alien);
        const eventMultiplier = this.worldEventRewardMultiplier('space');
        const raw = food.value * this.spaceFoodValueMultiplier() * alien.species.reward * this.globalRewardMultiplier() * signalBonus * rareMultiplier * traitMultiplier * eventMultiplier;
        const gain = Math.max(1, Math.floor(raw));
        this.economy.money = Math.min(MAX_POINTS, this.economy.money + gain);
        this.economy.totalEarned = Math.min(MAX_POINTS, this.economy.totalEarned + gain);
        this.recordProgressionGain(gain);
        this.economy.foodEaten++;
        alien.bites = (alien.bites || 0) + 1;
        alien.lifetimeEarned = Math.min(MAX_POINTS, (alien.lifetimeEarned || 0) + gain);
        const owner = food.ownerPlayerId ? this.players[food.ownerPlayerId] : null;
        if (owner) alien.lastFedBy = owner.name;
        this.spawnFloater(feedbackX, feedbackY - alien.species.height * alien.scale * 0.7, gain, alien.golden ? GOLDEN_COLORS[0] : food.color);
        if (alien.golden) {
            this.emitBubbles(feedbackX, feedbackY, 16);
            this.claimGoldenVisitor(alien, gain);
        }
        return true;
    }

    updateFishState() {
        this._aquariumBase_updateFishState();
        this.updateAliensState();
    }

    updateAliensState() {
        if (!this.spaceUnlocked || this.aliens.length === 0) return;
        this.alienBehaviorAccumulator += DT;
        if (this.alienBehaviorAccumulator >= 0.2) {
            this.alienBehaviorAccumulator %= 0.2;
            this.updateAlienBehavior();
        }
        const bounds = this.tankBounds();
        for (const alien of this.aliens) {
            if (!alien.active) continue;
            alien.hunger = clamp(alien.hunger + DT * 0.01, 0, 1);
            const blend = 1 - Math.exp(-3.2 * DT);
            alien.vx += (alien.desiredVx - alien.vx) * blend;
            alien.vy += (alien.desiredVy - alien.vy) * blend;
            alien.x += alien.vx * DT;
            alien.y += alien.vy * DT;
            if (alien.x < bounds.min + 5) {
                alien.x = bounds.min + 5;
                alien.vx = Math.abs(alien.vx);
                alien.desiredVx = Math.abs(alien.desiredVx);
            } else if (alien.x > bounds.max - 5) {
                alien.x = bounds.max - 5;
                alien.vx = -Math.abs(alien.vx);
                alien.desiredVx = -Math.abs(alien.desiredVx);
            }
            if (alien.y < SPACE_CREATURE_MIN_Y) {
                alien.y = SPACE_CREATURE_MIN_Y;
                alien.vy = Math.abs(alien.vy);
            } else if (alien.y > SPACE_CREATURE_MAX_Y) {
                alien.y = SPACE_CREATURE_MAX_Y;
                alien.vy = -Math.abs(alien.vy);
            }
            if (Math.abs(alien.vx) > 0.08) alien.dir = alien.vx >= 0 ? 1 : -1;
            if (alien.foodTargetId) {
                const food = this.foodById.get(alien.foodTargetId);
                if (!food || !food.active || food.biome !== 'space') {
                    alien.foodTargetId = 0;
                } else {
                    const radius = Math.max(1.7, alien.species.length * alien.scale * 0.34);
                    if (dist(alien.x, alien.y, food.x, food.y) < radius) this.consumeCosmicFood(food, alien);
                }
            }
        }
    }

    updateAlienBehavior() {
        const spaceFood = this.food.filter((food) => food.active && food.biome === 'space');
        const gravityWells = this.accessories.filter((item) => item.active && item.type === 'gravity-well');
        const gardens = this.accessories.filter((item) => item.active && item.type === 'asteroid-garden');
        const claims = new Map();
        for (const alien of this.aliens) {
            if (!alien.active) continue;
            alien.targetTimer -= 0.2;
            let bestFood = null;
            let bestScore = Infinity;
            for (const food of spaceFood) {
                if (food.preferredAlienId && food.preferredAlienId !== alien.id) continue;
                const claimCount = claims.get(food.id) || 0;
                if (claimCount >= (food.manualUntil > this.time ? 1 : 3)) continue;
                const distance = dist(alien.x, alien.y, food.x, food.y);
                if (distance > 70) continue;
                const score = distance - (food.manualUntil > this.time ? 100 : 0) - alien.hunger * 8;
                if (score < bestScore) {
                    bestFood = food;
                    bestScore = score;
                }
            }
            if (bestFood) {
                claims.set(bestFood.id, (claims.get(bestFood.id) || 0) + 1);
                this.pointAlienAtFood(alien, bestFood);
                continue;
            }
            alien.foodTargetId = 0;
            if (alien.targetTimer <= 0) {
                alien.targetTimer = rand(2.5, 7);
                alien.targetX = rand(this.tankBounds().min + 6, this.tankBounds().max - 6);
                alien.targetY = rand(SPACE_CREATURE_MIN_Y + 8, SPACE_CREATURE_MAX_Y - 8);
                if (alien.species.renderType === 'tripod' && gardens.length) {
                    const garden = gardens[Math.floor(Math.random() * gardens.length)];
                    alien.targetX = garden.x + rand(-10, 10);
                    alien.targetY = garden.y + rand(-7, 7);
                }
            }
            let dx = alien.targetX - alien.x;
            let dy = alien.targetY - alien.y;
            for (const well of gravityWells) {
                const wx = well.x - alien.x;
                const wy = well.y - alien.y;
                const distance = Math.max(3, Math.hypot(wx, wy));
                if (distance < 58) {
                    const strength = (1 - distance / 58) * 0.8;
                    dx += wx / distance * 18 * strength;
                    dy += wy / distance * 18 * strength;
                    dx += -wy / distance * 11 * strength * alien.dir;
                    dy += wx / distance * 11 * strength * alien.dir;
                }
            }
            const type = alien.species.renderType;
            if (type === 'blob') dy += Math.sin(this.time * 1.1 + alien.phase) * 8;
            if (type === 'ray') dy += Math.sin(this.time * 0.55 + alien.phase) * 14;
            if (type === 'leviathan') {
                dx += alien.dir * 18;
                dy += Math.sin(this.time * 0.22 + alien.phase) * 5;
            }
            const length = Math.max(0.001, Math.hypot(dx, dy));
            alien.desiredVx = dx / length * alien.speed;
            alien.desiredVy = dy / length * alien.speed * (type === 'tripod' ? 0.42 : 0.75);
        }
    }

    renderPlayerView(player) {
        if (player.view) player.view.feedTargets = [];
        this._aquariumBase_renderPlayerView(player);
        this.renderWorldUpgrades(player);
        this.renderWorldEventEffects(player);
        this.renderAliens(player);
        this.renderHorizon(player);
    }

    renderWorldUpgrades(player) {
        const view = player.view;
        if (!view || !this.progression) return;
        const rect = this.visibleWorldRect(player, 8);
        const tank = this.tankBounds();
        const waterVisible = rect.maxY >= 0 && rect.minY <= 100 && rect.maxX >= tank.min - 20 && rect.minX <= tank.max + 20;
        const spaceVisible = this.spaceUnlocked && rect.minY <= -18 && rect.maxY >= SPACE_MIN_Y;
        const zoom = this.screenScale(player);

        const sunLevel = this.worldUpgradeLevel('sun-shafts');
        const sunCount = waterVisible ? sunLevel * 2 : 0;
        this.ensureShapePool(view, 'sunShaftSlots', view.causticLayer, sunCount);
        for (let i = 0; i < view.sunShaftSlots.length; i++) {
            const node = view.sunShaftSlots[i].nodes[0];
            const t = (i + 0.7) / Math.max(1, sunCount);
            const wx = tank.min + (tank.max - tank.min) * t + Math.sin(this.time * 0.18 + i * 1.7) * 4;
            const topX = this.worldToScreenX(player, wx);
            const topY = this.worldToScreenY(player, 3);
            const bottomY = this.worldToScreenY(player, 82);
            const width = (4.2 + (i % 3) * 1.7) * zoom;
            node.node.fill = [154, 235, 255, 20 + sunLevel * 9];
            node.node.coordinates2d = [
                [topX - width * 0.35, topY], [topX + width * 0.35, topY],
                [topX + width, bottomY], [topX - width, bottomY], [topX - width * 0.35, topY]
            ];
        }

        const kelpLevel = this.worldUpgradeLevel('giant-kelp');
        const kelpCount = waterVisible ? kelpLevel * 2 : 0;
        this.ensureShapePool(view, 'giantKelpSlots', view.weedLayer, kelpCount);
        for (let i = 0; i < view.giantKelpSlots.length; i++) {
            const node = view.giantKelpSlots[i].nodes[0];
            const t = ((i * 0.381966 + 0.09) % 1);
            const wx = tank.min + 8 + (tank.max - tank.min - 16) * t;
            const baseY = 91;
            const height = 24 + kelpLevel * 5 + (i % 3) * 6;
            const sway = Math.sin(this.time * 0.55 + i * 1.31) * 2.2;
            const x0 = this.worldToScreenX(player, wx);
            const y0 = this.worldToScreenY(player, baseY);
            const x1 = this.worldToScreenX(player, wx + sway);
            const y1 = this.worldToScreenY(player, baseY - height);
            const w = Math.max(0.45, 0.9 * zoom);
            node.node.fill = i % 2 ? [52, 169, 112, 245] : [35, 132, 94, 250];
            node.node.coordinates2d = thickLine(x0, y0, x1, y1, w);
        }

        const reefLevel = this.worldUpgradeLevel('crown-reef');
        const reefCount = waterVisible ? reefLevel * 2 : 0;
        this.ensureShapePool(view, 'crownReefSlots', view.coralLayer, reefCount);
        for (let i = 0; i < view.crownReefSlots.length; i++) {
            const node = view.crownReefSlots[i].nodes[0];
            const t = ((i * 0.61803398875 + 0.24) % 1);
            const wx = tank.min + 10 + (tank.max - tank.min - 20) * t;
            const x = this.worldToScreenX(player, wx);
            const y = this.worldToScreenY(player, 89.5);
            const h = (8 + reefLevel * 2.8 + (i % 2) * 3) * zoom;
            const w = (2.2 + reefLevel * 0.35) * zoom;
            node.node.fill = i % 3 === 0 ? [255, 126, 107, 255] : (i % 3 === 1 ? [235, 85, 166, 255] : [250, 194, 80, 255]);
            node.node.coordinates2d = [
                [x - w, y], [x - w * 0.55, y - h * 0.42], [x - w * 1.5, y - h * 0.68],
                [x - w * 0.25, y - h * 0.56], [x, y - h], [x + w * 0.3, y - h * 0.52],
                [x + w * 1.4, y - h * 0.72], [x + w * 0.62, y - h * 0.34], [x + w, y], [x - w, y]
            ];
        }

        const nebulaLevel = this.worldUpgradeLevel('nebula-clouds');
        const nebulaCount = spaceVisible ? nebulaLevel * 2 : 0;
        this.ensureShapePool(view, 'nebulaUpgradeSlots', view.spaceStarLayer, nebulaCount);
        for (let i = 0; i < view.nebulaUpgradeSlots.length; i++) {
            const node = view.nebulaUpgradeSlots[i].nodes[0];
            const t = ((i * 0.4142 + 0.16) % 1);
            const wx = tank.min + (tank.max - tank.min) * t;
            const wy = -70 - ((i * 47) % 150);
            const x = this.worldToScreenX(player, wx + Math.sin(this.time * 0.08 + i) * 6);
            const y = this.worldToScreenY(player, wy);
            const rx = (11 + nebulaLevel * 3 + (i % 3) * 4) * zoom;
            const ry = (4 + nebulaLevel * 1.5) * zoom;
            const colors = [[108, 85, 224, 42], [219, 92, 255, 38], [77, 202, 220, 38]];
            node.node.fill = colors[i % colors.length];
            node.node.coordinates2d = polyEllipse(x, y, rx, ry, 14);
        }

        const stationLevel = this.worldUpgradeLevel('orbital-station');
        const stationCount = spaceVisible && stationLevel > 0 ? 1 : 0;
        this.ensureShapePool(view, 'orbitalStationSlots', view.spaceRockLayer, stationCount, 5);
        if (stationCount) {
            const nodes = view.orbitalStationSlots[0].nodes;
            const x = this.worldToScreenX(player, WORLD_CENTER_X + 42);
            const y = this.worldToScreenY(player, -132);
            const z = zoom * (1 + stationLevel * 0.12);
            const spin = Math.sin(this.time * 0.45) * 1.5 * z;
            nodes[0].node.fill = [186, 207, 222, 255];
            nodes[0].node.coordinates2d = ShapeUtils.rectangle(x - 5 * z, y - 2.2 * z, 10 * z, 4.4 * z);
            nodes[1].node.fill = [84, 152, 205, 255];
            nodes[1].node.coordinates2d = ShapeUtils.rectangle(x - 13 * z, y - 1.1 * z + spin, 7 * z, 2.2 * z);
            nodes[2].node.fill = [84, 152, 205, 255];
            nodes[2].node.coordinates2d = ShapeUtils.rectangle(x + 6 * z, y - 1.1 * z - spin, 7 * z, 2.2 * z);
            nodes[3].node.fill = [255, 219, 106, 255];
            nodes[3].node.coordinates2d = polyCircle(x, y, (1.1 + stationLevel * 0.22) * z, 8);
            nodes[4].node.fill = [224, 238, 245, 230];
            nodes[4].node.coordinates2d = diamond(x, y - 6.3 * z, 1.3 * z, 3.2 * z);
        }

        const whaleLevel = this.worldUpgradeLevel('aurora-whales');
        const whaleCount = spaceVisible ? whaleLevel : 0;
        this.ensureShapePool(view, 'auroraWhaleSlots', view.spaceStarLayer, whaleCount);
        for (let i = 0; i < view.auroraWhaleSlots.length; i++) {
            const node = view.auroraWhaleSlots[i].nodes[0];
            const span = Math.max(120, tank.max - tank.min + 70);
            const wx = tank.min - 35 + ((this.time * (5 + i) + i * 91) % span);
            const wy = -205 + i * 42 + Math.sin(this.time * 0.17 + i) * 8;
            const x = this.worldToScreenX(player, wx);
            const y = this.worldToScreenY(player, wy);
            const l = (18 + i * 4 + whaleLevel * 2) * zoom;
            const h = (4.2 + whaleLevel * 0.5) * zoom;
            node.node.fill = [135, 239, 226, 42 + whaleLevel * 14];
            node.node.coordinates2d = [
                [x + l * 0.55, y], [x + l * 0.15, y - h], [x - l * 0.35, y - h * 0.72],
                [x - l * 0.58, y - h * 1.4], [x - l * 0.5, y], [x - l * 0.58, y + h * 1.4],
                [x - l * 0.35, y + h * 0.72], [x + l * 0.15, y + h], [x + l * 0.55, y]
            ];
        }

        const crownLevel = this.worldUpgradeLevel('world-crown');
        const crownCount = spaceVisible && crownLevel > 0 ? 1 : 0;
        this.ensureShapePool(view, 'worldCrownSlots', view.spaceRockLayer, crownCount, 4);
        if (crownCount) {
            const nodes = view.worldCrownSlots[0].nodes;
            const x = this.worldToScreenX(player, WORLD_CENTER_X);
            const y = this.worldToScreenY(player, -212);
            const z = zoom * (1 + crownLevel * 0.18);
            const r = 22 * z;
            const pts = [
                [x - r, y], [x - r * 0.45, y - r * 0.35], [x, y - r * 0.5],
                [x + r * 0.45, y - r * 0.35], [x + r, y]
            ];
            for (let i = 0; i < 4; i++) {
                nodes[i].node.fill = i % 2 ? [255, 220, 104, 230] : [205, 192, 255, 215];
                nodes[i].node.coordinates2d = thickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], (1.3 + crownLevel * 0.32) * z);
            }
        }

        const horizonLevel = this.worldUpgradeLevel('horizon-lights');
        const horizonCount = this.horizonAccessible() && horizonLevel > 0 && this.isHorizonCamera(player)
            ? Math.min(this.totalHorizonMarkerCount(), horizonLevel * 2)
            : 0;
        this.ensureShapePool(view, 'horizonLightSlots', view.horizonLayer, horizonCount);
        for (let i = 0; i < view.horizonLightSlots.length; i++) {
            const node = view.horizonLightSlots[i].nodes[0];
            const marker = this.horizonMarkerDescriptor(Math.max(0, this.totalHorizonMarkerCount() - 1 - i));
            const x = this.worldToScreenX(player, marker.x);
            const y = this.worldToScreenY(player, marker.y - 28 - (i % 2) * 7);
            const pulse = 0.75 + Math.sin(this.time * 2.1 + i) * 0.25;
            node.node.fill = [255, 226, 118, Math.round(145 + pulse * 95)];
            node.node.coordinates2d = diamond(x, y, (1.1 + pulse * 0.5) * zoom, (2.4 + pulse) * zoom);
        }

        const geneLevel = this.worldUpgradeLevel('gene-garden');
        const geneCount = waterVisible && geneLevel > 0 ? 1 : 0;
        this.ensureShapePool(view, 'geneGardenSlots', view.accessoryLiteLayer, geneCount, 5);
        if (geneCount) {
            const nodes = view.geneGardenSlots[0].nodes;
            const x = this.worldToScreenX(player, tank.min + 22);
            const y = this.worldToScreenY(player, 88);
            const z = zoom * (1 + geneLevel * 0.08);
            nodes[0].node.fill = [22, 72, 78, 245];
            nodes[0].node.coordinates2d = ShapeUtils.rectangle(x - 5*z, y - 3*z, 10*z, 3*z);
            for (let i = 0; i < 2; i++) {
                const phase = this.time * 1.2 + i * Math.PI;
                const dx = Math.sin(phase) * 2.4*z;
                nodes[i + 1].node.fill = i ? [181, 91, 255, 235] : [72, 255, 211, 235];
                nodes[i + 1].node.coordinates2d = polyCircle(x + dx, y - (6 + i*2.4)*z, (0.75 + geneLevel*0.12)*z, 8);
                nodes[i + 3].node.fill = [185, 243, 236, 150];
                nodes[i + 3].node.coordinates2d = thickLine(x - dx, y - (4.6 + i*2.4)*z, x + dx, y - (7 + i*2.4)*z, Math.max(0.18,0.3*z));
            }
        }

        const engineLevel = this.worldUpgradeLevel('event-engine');
        const engineCount = spaceVisible && engineLevel > 0 ? 1 : 0;
        this.ensureShapePool(view, 'worldEngineSlots', view.spaceRockLayer, engineCount, 5);
        if (engineCount) {
            const nodes = view.worldEngineSlots[0].nodes;
            const x = this.worldToScreenX(player, WORLD_CENTER_X - 62);
            const y = this.worldToScreenY(player, -174);
            const z = zoom * (1 + engineLevel * 0.12);
            const pulse = 0.72 + Math.sin(this.time * 2.4) * 0.18;
            nodes[0].node.fill = [73, 93, 142, 255];
            nodes[0].node.coordinates2d = diamond(x, y, 8*z, 8*z);
            nodes[1].node.fill = [117, 244, 235, 230];
            nodes[1].node.coordinates2d = diamond(x, y, (3.5+pulse)*z, (3.5+pulse)*z);
            for (let i = 0; i < 3; i++) {
                const a = this.time * (0.7 + i*0.18) + i*TAU/3;
                const ex = x + Math.cos(a) * 12*z;
                const ey = y + Math.sin(a) * 6*z;
                nodes[i+2].node.fill = i===1 ? [255,205,90,220] : [181,119,255,220];
                nodes[i+2].node.coordinates2d = polyCircle(ex, ey, 1.0*z, 7);
            }
        }

        const gateLevel = this.worldUpgradeLevel('migration-gate');
        const gateCount = waterVisible && gateLevel > 0 ? 1 : 0;
        this.ensureShapePool(view, 'migrationGateSlots', view.rockLayer, gateCount, 4);
        if (gateCount) {
            const nodes = view.migrationGateSlots[0].nodes;
            const gx = this.worldToScreenX(player, tank.max - 20);
            const gy = this.worldToScreenY(player, 89);
            const z = zoom * (1 + gateLevel * 0.16);
            const top = gy - 22*z;
            nodes[0].node.fill = [82, 98, 118, 255];
            nodes[0].node.coordinates2d = thickLine(gx-8*z, gy, gx-8*z, top+5*z, 2.2*z);
            nodes[1].node.fill = [82, 98, 118, 255];
            nodes[1].node.coordinates2d = thickLine(gx+8*z, gy, gx+8*z, top+5*z, 2.2*z);
            nodes[2].node.fill = [126, 235, 224, 230];
            nodes[2].node.coordinates2d = [[gx-8*z,top+5*z],[gx-5*z,top],[gx,top-3*z],[gx+5*z,top],[gx+8*z,top+5*z],[gx+6.5*z,top+7*z],[gx,top+1*z],[gx-6.5*z,top+7*z],[gx-8*z,top+5*z]];
            const pulse = 0.8 + Math.sin(this.time*2.0)*0.2;
            nodes[3].node.fill = [255,220,108,Math.round(155+pulse*90)];
            nodes[3].node.coordinates2d = diamond(gx, top+5*z, (1.5+pulse)*z, (3+pulse)*z);
        }
    }

    buildSimpleCreatureRepresentatives(player, profile) {
        const visible = this.visibleRenderCreatures(player, profile.biome, profile.margin);
        visible.sort((a, b) => (Number(!!b.golden) - Number(!!a.golden)) || (Number(!!b.trait) - Number(!!a.trait)) || a.id - b.id);
        if (visible.length <= profile.liteCap || player.camera.zoom >= profile.singletonZoom) {
            return visible.slice(0, profile.liteCap).map((creature) => ({
                id: `${profile.biome}:${creature.id}`,
                count: 1,
                x: creature.x,
                y: creature.y,
                dir: creature.dir,
                scale: creature.scale,
                species: creature.species,
                golden: !!creature.golden,
                representative: creature,
                members: [creature]
            }));
        }

        let cell = player.camera.zoom < profile.lowZoom
            ? profile.cellLow
            : (player.camera.zoom < profile.midZoom ? profile.cellMid : profile.cellHigh);
        let clusters = [];
        for (let attempts = 0; attempts < profile.maxAttempts; attempts++) {
            const buckets = new Map();
            for (const creature of visible) {
                const cx = Math.floor(creature.x / cell);
                const cy = Math.floor(creature.y / cell);
                const key = creature.golden ? `golden:${creature.id}` : (creature.trait ? `mutation:${creature.id}` : `${creature.speciesId}:${cx}:${cy}`);
                let bucket = buckets.get(key);
                if (!bucket) {
                    bucket = {
                        key,
                        members: [],
                        x: 0,
                        y: 0,
                        dir: 0,
                        scale: 0,
                        species: creature.species,
                        golden: !!creature.golden,
                        trait: creature.trait || ''
                    };
                    buckets.set(key, bucket);
                }
                bucket.members.push(creature);
                bucket.x += creature.x;
                bucket.y += creature.y;
                bucket.dir += creature.dir;
                bucket.scale += creature.scale;
            }
            clusters = Array.from(buckets.values()).map((bucket) => {
                const count = bucket.members.length;
                return {
                    id: `${profile.idPrefix}:${bucket.key}:${Math.round(cell)}`,
                    count,
                    x: bucket.x / count,
                    y: bucket.y / count,
                    dir: bucket.dir >= 0 ? 1 : -1,
                    scale: clamp(
                        (bucket.scale / count) * (1 + Math.log2(count) * profile.clusterScaleGrowth),
                        profile.clusterScaleMin,
                        profile.clusterScaleMax
                    ),
                    species: bucket.species,
                    golden: !!bucket.golden,
                    trait: bucket.trait || '',
                    representative: bucket.members[0],
                    members: bucket.members
                };
            });
            if (clusters.length <= profile.liteCap) break;
            cell *= profile.cellGrowth;
        }
        clusters.sort((a, b) => (Number(!!b.golden) - Number(!!a.golden)) || (Number(!!b.trait) - Number(!!a.trait)) || String(a.id).localeCompare(String(b.id)));
        return clusters.slice(0, profile.liteCap);
    }

    buildAlienRepresentatives(player) {
        return this.buildSimpleCreatureRepresentatives(player, ALIEN_CLUSTER_PROFILE);
    }

    alienDetailLimit(player, visibleSingletons) {
        const limit = player.camera.zoom >= 2.2 ? 20 : (player.camera.zoom >= 0.92 ? 12 : 0);
        return Math.min(visibleSingletons, SPACE_VIEW_CAP.alienDetail, limit);
    }

    alienDetailPriority(alien, zoom) {
        if (alien.golden) return 1000000;
        if (alien.trait) return 500000 + this.creatureTraitRewardMultiplier(alien) * 1000;
        return (ALIEN_DETAIL_PRIORITY[alien.species.renderType] || 0) + alien.species.length * alien.scale * zoom * 4 + alien.id * 0.00001;
    }

    renderAliens(player) {
        const view = player.view;
        if (!this.spaceUnlocked) {
            this.ensureShapePool(view, 'alienLiteSlots', view.alienLiteLayer, 0);
            this.ensureShapePool(view, 'alienSlots', view.alienLayer, 0, 6);
            return;
        }
        this.renderCreaturePopulation(player, 'space', this.buildAlienRepresentatives(player));
    }

    renderAlienLite(player, alien, node) {
        const x = this.worldToScreenX(player, alien.x);
        const y = this.worldToScreenY(player, alien.y);
        const zoom = this.screenScale(player);
        const length = alien.species.length * alien.scale * zoom;
        const height = alien.species.height * alien.scale * zoom;
        const type = alien.species.renderType;
        let points;
        if (type === 'blob') {
            points = polyCircle(x, y, Math.max(length, height) * 0.42, 9);
        } else if (type === 'ray') {
            points = [
                [x + alien.dir * length * 0.52, y], [x, y - height * 0.5],
                [x - alien.dir * length * 0.32, y], [x - alien.dir * length * 0.8, y + height * 0.16],
                [x - alien.dir * length * 0.32, y], [x, y + height * 0.5],
                [x + alien.dir * length * 0.52, y]
            ];
        } else if (type === 'tripod') {
            points = [
                [x, y - height * 0.5], [x + length * 0.42, y - height * 0.05],
                [x + length * 0.28, y + height * 0.18], [x + length * 0.48, y + height * 0.5],
                [x, y + height * 0.18], [x - length * 0.48, y + height * 0.5],
                [x - length * 0.28, y + height * 0.18], [x - length * 0.42, y - height * 0.05],
                [x, y - height * 0.5]
            ];
        } else {
            points = [
                [x + alien.dir * length * 0.52, y], [x + alien.dir * length * 0.22, y - height * 0.42],
                [x - alien.dir * length * 0.18, y - height * 0.35], [x - alien.dir * length * 0.5, y],
                [x - alien.dir * length * 0.18, y + height * 0.35], [x + alien.dir * length * 0.22, y + height * 0.42],
                [x + alien.dir * length * 0.52, y]
            ];
        }
        node.node.fill = this.creaturePalette(alien)[0];
        node.node.coordinates2d = points;
    }

    renderAlienRig(player, alien, nodes) {
        const x = this.worldToScreenX(player, alien.x);
        const y = this.worldToScreenY(player, alien.y);
        const zoom = this.screenScale(player);
        const length = alien.species.length * alien.scale * zoom;
        const height = alien.species.height * alien.scale * zoom;
        const type = alien.species.renderType;
        const colors = this.creaturePalette(alien);
        if (type === 'blob') {
            nodes[0].node.fill = colors[0];
            nodes[0].node.coordinates2d = polyCircle(x, y, Math.max(length, height) * 0.42, 12);
            nodes[1].node.fill = colors[1];
            nodes[1].node.coordinates2d = polyCircle(x + alien.dir * length * 0.12, y - height * 0.08, height * 0.18, 9);
            nodes[2].node.fill = colors[2];
            nodes[2].node.coordinates2d = polyCircle(x + alien.dir * length * 0.15, y - height * 0.08, height * 0.07, 7);
            nodes[3].node.fill = colors[1];
            nodes[3].node.coordinates2d = diamond(x - length * 0.46, y - height * 0.46, height * 0.1, height * 0.18);
            nodes[4].node.fill = colors[1];
            nodes[4].node.coordinates2d = diamond(x + length * 0.5, y + height * 0.34, height * 0.08, height * 0.15);
            nodes[5].node.fill = colors[2];
            nodes[5].node.coordinates2d = diamond(x - alien.dir * length * 0.18, y + height * 0.24, height * 0.12, height * 0.08);
            return;
        }
        if (type === 'ray') {
            nodes[0].node.fill = colors[0];
            nodes[0].node.coordinates2d = diamond(x, y, length * 0.5, height * 0.5);
            nodes[1].node.fill = colors[1];
            nodes[1].node.coordinates2d = [
                [x - alien.dir * length * 0.36, y], [x - alien.dir * length * 0.95, y - height * 0.12],
                [x - alien.dir * length * 0.78, y + height * 0.08], [x - alien.dir * length * 0.36, y]
            ];
            nodes[2].node.fill = colors[2];
            nodes[2].node.coordinates2d = diamond(x + alien.dir * length * 0.18, y, length * 0.08, height * 0.12);
            nodes[3].node.fill = colors[1];
            nodes[3].node.coordinates2d = [
                [x - length * 0.08, y - height * 0.42], [x + length * 0.12, y],
                [x - length * 0.08, y + height * 0.42], [x - length * 0.08, y - height * 0.42]
            ];
            nodes[4].node.fill = colors[2];
            nodes[4].node.coordinates2d = polyCircle(x + alien.dir * length * 0.25, y - height * 0.08, height * 0.055, 7);
            nodes[5].node.fill = colors[1];
            nodes[5].node.coordinates2d = diamond(x - alien.dir * length * 0.1, y, length * 0.06, height * 0.3);
            return;
        }
        if (type === 'tripod') {
            nodes[0].node.fill = colors[0];
            nodes[0].node.coordinates2d = [
                [x, y - height * 0.48], [x + length * 0.42, y - height * 0.05],
                [x, y + height * 0.18], [x - length * 0.42, y - height * 0.05], [x, y - height * 0.48]
            ];
            for (let i = 0; i < 3; i++) {
                const offset = (i - 1) * length * 0.22;
                nodes[i + 1].node.fill = colors[1];
                nodes[i + 1].node.coordinates2d = [
                    [x + offset - length * 0.05, y + height * 0.08],
                    [x + offset + (i - 1) * length * 0.16, y + height * 0.58],
                    [x + offset + length * 0.06, y + height * 0.08],
                    [x + offset - length * 0.05, y + height * 0.08]
                ];
            }
            nodes[4].node.fill = colors[2];
            nodes[4].node.coordinates2d = polyCircle(x, y - height * 0.13, height * 0.09, 8);
            nodes[5].node.fill = colors[1];
            nodes[5].node.coordinates2d = diamond(x, y + height * 0.03, length * 0.12, height * 0.07);
            return;
        }
        // Leviathan: six visible segments form one long creature.
        for (let i = 0; i < 5; i++) {
            const segmentX = x - alien.dir * length * (i * 0.18 - 0.22);
            const waveY = y + Math.sin(this.time * 0.9 + alien.phase + i * 0.7) * height * 0.16;
            const scale = 1 - i * 0.1;
            nodes[i].node.fill = i % 2 ? colors[1] : colors[0];
            nodes[i].node.coordinates2d = polyEllipse(segmentX, waveY, length * 0.16 * scale, height * 0.32 * scale, 10);
        }
        nodes[5].node.fill = colors[2];
        nodes[5].node.coordinates2d = polyCircle(x + alien.dir * length * 0.31, y - height * 0.08, height * 0.075, 7);
    }

    updatePlayerUi(player) {
        this._aquariumBase_updatePlayerUi(player);
        if (!player.view || !player.view.ui || !player.shopOpen) return;
        const ui = player.view.ui;
        if (ui.fishTabText) ui.fishTabText.node.text = { ...ui.fishTabText.node.text, text: 'LIFE' };

        if (player.shopTab === 'tank') {
            if (ui.tankTabText) setText(ui.tankTabText, 'WORLD');
            const items = this.worldShopItems().slice(player.shopPage * SHOP_PAGE_SIZE, player.shopPage * SHOP_PAGE_SIZE + SHOP_PAGE_SIZE);
            for (let i = 0; i < ui.rows.length; i++) {
                const row = ui.rows[i];
                const item = items[i];
                if (!item) {
                    this.setShopRowAttached(ui, row, false);
                    continue;
                }
                this.setShopRowAttached(ui, row, true);
                let detail = item.description || '';
                let costText = '';
                let actionable = true;
                let affordable = true;
                let unavailable = false;

                if (item.worldType === 'expand') {
                    costText = this.formatCompact(item.cost);
                    affordable = this.economy.money >= item.cost;
                } else if (item.worldType === 'horizon') {
                    const open = this.horizonAccessible();
                    detail = open
                        ? `${this.totalHorizonMarkerCount()} MONUMENTS · T OR CLICK`
                        : `NEED ${this.formatCompact(this.currentEraMilestoneThreshold(0))}`;
                    costText = open ? 'GO' : 'LOCKED';
                    actionable = open;
                    affordable = open;
                    unavailable = !open;
                } else if (item.worldType === 'era') {
                    const ready = this.currentEraMarkerCount() >= HORIZON_MARKERS_PER_ERA;
                    const needed = this.eraVotesNeeded();
                    detail = ready
                        ? (needed > 1
                            ? `VOTES ${this.progression.eraVotes.size}/${needed} · x${this.formatMultiplier(this.eraRewardMultiplier())} → x${this.formatMultiplier(this.nextEraRewardMultiplier())}`
                            : `RESET WORLD · x${this.formatMultiplier(this.eraRewardMultiplier())} → x${this.formatMultiplier(this.nextEraRewardMultiplier())}`)
                        : `${Math.floor(this.nextEraMilestoneProgress() * 100)}% TO ${this.nextEraMilestoneName()}`;
                    costText = ready ? (needed > 1 ? 'VOTE' : 'READY') : `NEED ${this.formatCompact(this.nextEraMilestoneRemaining())}`;
                    actionable = ready;
                    affordable = ready;
                    unavailable = !ready;
                } else if (item.worldType === 'upgrade') {
                    const level = this.worldUpgradeLevel(item.id);
                    const unlocked = this.worldUpgradeUnlocked(item);
                    const maxed = level >= item.maxLevel;
                    const effect = this.worldUpgradeEffectText(item, level);
                    const nextEffect = this.worldUpgradeEffectText(item, Math.min(item.maxLevel, level + 1));
                    detail = unlocked
                        ? (level <= 0
                            ? `NEXT: ${nextEffect}`
                            : (maxed
                                ? `MAX · ${effect}`
                                : `LV ${level}/${item.maxLevel} · ${effect} → ${nextEffect}`))
                        : this.worldUpgradeLockText(item);
                    if (maxed) {
                        costText = 'MAX';
                        actionable = false;
                        affordable = false;
                        unavailable = true;
                    } else if (!unlocked) {
                        costText = 'LOCKED';
                        actionable = false;
                        affordable = false;
                        unavailable = true;
                    } else {
                        const cost = this.worldUpgradeCost(item);
                        costText = this.formatCompact(cost);
                        affordable = this.economy.money >= cost;
                    }
                }

                setText(row.name, item.name);
                setText(row.detail, detail);
                setTextSize(row.detail, Math.min(2.65, 88 / Math.max(1, detail.length * .87)));
                this.setShopCostAttached(ui, row, true);
                setText(row.cost, costText);
                row.button.node.fill = actionable && affordable ? COLORS.buttonHot : COLORS.buttonDim;
                row.button.node.color = actionable && affordable ? player.color : [76, 92, 102, 255];
                setTextColor(row.name, unavailable ? [145, 158, 164, 255] : COLORS.white);
                setTextColor(row.detail, unavailable ? [114, 127, 134, 255] : [190, 217, 224, 255]);
                setTextColor(row.cost, actionable && affordable ? COLORS.gold : [169, 170, 157, 255]);
            }
            return;
        }

        if (player.shopTab !== 'fish') return;
        const items = this.shopItems(player).slice(player.shopPage * SHOP_PAGE_SIZE, player.shopPage * SHOP_PAGE_SIZE + SHOP_PAGE_SIZE);
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item || item.biome !== 'space') continue;
            const row = ui.rows[i];
            const locked = !this.spaceUnlocked;
            const count = this.fishCounts[item.id] || 0;
            const cap = this.effectiveAlienCap();
            const cost = this.getFishCost(item);
            const unavailable = locked || this.aliens.filter((alien) => !alien.golden).length >= cap;
            row.detail.node.text = {
                ...row.detail.node.text,
                text: locked ? 'UNLOCK: BREAK THE SURFACE' : `${count} OWNED  +${this.formatCompact(item.reward * this.currentTank().rewardScale)}/BITE`
            };
            setTextSize(row.detail, Math.min(2.65, 88 / Math.max(1, row.detail.node.text.text.length * .87)));
            row.cost.node.text = {
                ...row.cost.node.text,
                text: locked ? 'LOCKED' : (unavailable ? 'MAX' : this.formatCompact(cost))
            };
            const affordable = !unavailable && this.economy.money >= cost;
            row.button.node.fill = affordable ? [58, 139, 145, 255] : [53, 67, 81, 255];
            row.button.node.color = affordable ? player.color : [76, 92, 102, 255];
        }
    }

    widestTankHalfWidth() {
        let width = this.currentTank().width || 100;
        for (const tank of CATALOG.tanks || []) {
            if (tank && Number.isFinite(tank.width)) width = Math.max(width, tank.width);
        }
        return width / 2;
    }

    horizonStartX() {
        return WORLD_CENTER_X + this.widestTankHalfWidth() + HORIZON_GAP;
    }

    horizonMarkerX(globalIndex) {
        return this.horizonStartX() + Math.max(0, globalIndex) * HORIZON_MARKER_SPACING;
    }

    horizonBaseGoal() {
        if (Number.isFinite(this._horizonBaseGoal)) return this._horizonBaseGoal;
        const tanks = Array.isArray(CATALOG.tanks) ? CATALOG.tanks : [];
        const space = tanks.find((tank) => tank && tank.id === 'space') || tanks[tanks.length - 1] || {};
        const anchor = Number.isFinite(space.upgradeCost) && space.upgradeCost > 0 ? space.upgradeCost : 10000000;
        this._horizonBaseGoal = Math.max(1000000, Math.min(MAX_POINTS * 0.25, Math.floor(anchor * 16)));
        return this._horizonBaseGoal;
    }

    currentEraGoal() {
        const eraIndex = Math.max(0, this.progression.era - 1);
        const cap = Math.floor(MAX_POINTS * 0.75);
        let goal = this.horizonBaseGoal();
        // Grow until the economy's safe-number ceiling rather than arbitrarily
        // flattening after Era 13. Once capped, later Eras are intentionally faster
        // victory laps powered by the permanent multiplier.
        for (let i = 0; i < eraIndex && goal < cap; i++) {
            goal = Math.min(cap, Math.floor(goal * HORIZON_ERA_COST_GROWTH));
        }
        goal = Math.floor(goal * this.horizonGoalMultiplier());
        return Math.max(1, goal);
    }

    currentEraMilestoneThreshold(slot) {
        const index = clamp(Math.floor(slot), 0, HORIZON_MARKERS_PER_ERA - 1);
        return Math.max(1, Math.floor(this.currentEraGoal() * HORIZON_MILESTONE_FRACTIONS[index]));
    }

    eraRewardMultiplier() {
        const value = Math.pow(HORIZON_ERA_REWARD_GROWTH, Math.max(0, this.progression.completedEras));
        return Math.min(HORIZON_MAX_REWARD_MULTIPLIER, value);
    }

    currentEraMarkerCount() {
        if (!this.spaceUnlocked) return 0;
        const goal = this.currentEraGoal();
        let count = 0;
        for (let i = 0; i < HORIZON_MARKERS_PER_ERA; i++) {
            const threshold = Math.max(1, Math.floor(goal * HORIZON_MILESTONE_FRACTIONS[i]));
            if (this.economy.totalEarned >= threshold) count++;
        }
        return count;
    }

    totalHorizonMarkerCount() {
        return this.progression.completedEras * HORIZON_MARKERS_PER_ERA + this.currentEraMarkerCount();
    }

    horizonAccessible() {
        return this.totalHorizonMarkerCount() > 0;
    }

    horizonMaxX() {
        const count = this.totalHorizonMarkerCount();
        if (count <= 0) return this.tankBounds().max;
        return this.horizonMarkerX(count - 1) + 62;
    }

    nextEraMilestoneRemaining() {
        const count = this.currentEraMarkerCount();
        if (count >= HORIZON_MARKERS_PER_ERA) return 0;
        return Math.max(0, this.currentEraMilestoneThreshold(count) - this.economy.totalEarned);
    }

    nextEraMilestoneName() {
        const count = this.currentEraMarkerCount();
        return count >= HORIZON_MARKERS_PER_ERA ? 'ERA GATE' : HORIZON_NAMES[count];
    }

    nextEraMilestoneProgress() {
        const count = this.currentEraMarkerCount();
        if (count >= HORIZON_MARKERS_PER_ERA) return 1;
        const previous = count <= 0 ? 0 : this.currentEraMilestoneThreshold(count - 1);
        const next = this.currentEraMilestoneThreshold(count);
        return clamp((this.economy.totalEarned - previous) / Math.max(1, next - previous), 0, 1);
    }

    nextEraRewardMultiplier() {
        return Math.min(HORIZON_MAX_REWARD_MULTIPLIER, this.eraRewardMultiplier() * HORIZON_ERA_REWARD_GROWTH);
    }

    horizonMarkerDescriptor(globalIndex) {
        const era = Math.floor(globalIndex / HORIZON_MARKERS_PER_ERA) + 1;
        const slot = globalIndex % HORIZON_MARKERS_PER_ERA;
        const color = HORIZON_ERA_COLORS[(era - 1) % HORIZON_ERA_COLORS.length];
        return {
            id: globalIndex + 1,
            globalIndex,
            era,
            slot,
            x: this.horizonMarkerX(globalIndex),
            y: 76,
            name: HORIZON_NAMES[slot],
            color,
            completedEra: era <= this.progression.completedEras
        };
    }

    refreshHorizonUnlocks(fromSpaceUnlock = false) {
        if (!this.progression) return;
        const count = this.currentEraMarkerCount();
        const previous = this.progression.lastCurrentUnlocked || 0;
        if (count > previous) {
            const globalIndex = this.progression.completedEras * HORIZON_MARKERS_PER_ERA + count - 1;
            const marker = this.horizonMarkerDescriptor(globalIndex);
            const complete = count >= HORIZON_MARKERS_PER_ERA;
            const message = complete
                ? `ERA ${this.progression.era} HORIZON COMPLETE — NEW ERA READY!`
                : `HORIZON: ${marker.name} RAISED`;
            this.setGlobalStatus(message, complete ? 4.2 : 2.8);
            this.setProgressionCelebration(
                complete ? `ERA ${this.progression.era} COMPLETE` : marker.name,
                complete
                    ? `ERA GATE RAISED · NEW ERA x${this.formatMultiplier(this.nextEraRewardMultiplier())}`
                    : `HORIZON MONUMENT ${count}/${HORIZON_MARKERS_PER_ERA}`,
                {
                    markerIndex: globalIndex,
                    kind: complete ? 'era' : 'milestone',
                    duration: complete ? HORIZON_ERA_CELEBRATION_SECONDS : HORIZON_CELEBRATION_SECONDS
                }
            );
        } else if (fromSpaceUnlock && count > 0) {
            this.setGlobalStatus(`HORIZON UNLOCKED · ${count} MONUMENT${count === 1 ? '' : 'S'}`, 3.2);
            this.setProgressionCelebration('HORIZON UNLOCKED', `${count} MONUMENT${count === 1 ? '' : 'S'} · EAST`, { duration: 4.2 });
        }
        this.progression.lastCurrentUnlocked = count;
        if (count !== previous || fromSpaceUnlock) {
            for (const playerId of this.playerOrder) {
                const player = this.players[playerId];
                if (player && player.connected && player.view) this.updateCameraControls(player);
            }
        }
    }

    recordProgressionGain(gain) {
        if (!this.progression || !Number.isFinite(gain) || gain <= 0) return;
        this.progression.lifetimeEarned = Math.min(MAX_POINTS, this.progression.lifetimeEarned + gain);
        this.refreshHorizonUnlocks(false);
    }

    focusHorizonCamera(playerId) {
        const player = this.players[playerId];
        if (!player || !player.connected) return false;
        if (!this.horizonAccessible()) {
            this.setStatus(player, this.spaceUnlocked ? `NEED ${this.formatCompact(this.nextEraMilestoneRemaining())}` : 'BREAK THE SURFACE FIRST');
            return false;
        }
        player.camera.targetX = Math.max(this.horizonStartX(), this.horizonMaxX() - 48);
        player.camera.targetY = 52;
        player.camera.targetZoom = Math.max(this.minZoom(), 0.82);
        player.camera.velocity = 0;
        player.camera.velocityY = 0;
        this.clampCamera(player);
        return true;
    }

    eraVotesNeeded() {
        let connected = 0;
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (player && player.connected) connected++;
        }
        return Math.max(1, Math.floor(connected / 2) + 1);
    }

    voteNewEra(playerId) {
        const player = this.players[playerId];
        if (!player || !player.connected) return false;
        if (this.currentEraMarkerCount() < HORIZON_MARKERS_PER_ERA) {
            this.setStatus(player, `NEED ${this.formatCompact(this.nextEraMilestoneRemaining())}`);
            return false;
        }

        const needed = this.eraVotesNeeded();
        if (needed <= 1) {
            if (player.eraConfirmUntil > this.time) {
                this.beginNewEra();
                return true;
            }
            player.eraConfirmUntil = this.time + 4;
            this.setStatus(player, 'CLICK NEW ERA AGAIN TO CONFIRM', 4);
            return false;
        }

        if (this.progression.eraVotes.has(playerId)) {
            this.progression.eraVotes.delete(playerId);
            this.setStatus(player, 'NEW ERA VOTE REMOVED');
        } else {
            this.progression.eraVotes.add(playerId);
            this.setGlobalStatus(`NEW ERA VOTE ${this.progression.eraVotes.size}/${needed}`, 2.2);
        }
        this.checkEraVotes();
        return true;
    }

    checkEraVotes() {
        if (!this.progression || this.currentEraMarkerCount() < HORIZON_MARKERS_PER_ERA) return false;
        const connectedIds = new Set();
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (player && player.connected) connectedIds.add(playerId);
        }
        for (const playerId of Array.from(this.progression.eraVotes)) {
            if (!connectedIds.has(playerId)) this.progression.eraVotes.delete(playerId);
        }
        if (connectedIds.size > 1 && this.progression.eraVotes.size >= this.eraVotesNeeded()) {
            this.beginNewEra();
            return true;
        }
        return false;
    }

    beginNewEra() {
        if (this.currentEraMarkerCount() < HORIZON_MARKERS_PER_ERA) return false;
        const finishedEra = this.progression.era;
        this.progression.completedEras++;
        this.progression.era = this.progression.completedEras + 1;
        this.progression.lastCurrentUnlocked = 0;
        this.progression.eraVotes.clear();

        const decorIds = CATALOG.decor.filter((item) => item.id !== 'flakes').map((item) => item.id);
        this.economy.money = 20;
        this.economy.totalEarned = 0;
        this.economy.foodEaten = 0;
        this.economy.foodLevel = 0;
        this.economy.fishPurchases = {};
        for (const species of CATALOG.fish || []) this.economy.fishPurchases[species.id] = 0;
        for (const species of CATALOG.aliens || []) this.economy.fishPurchases[species.id] = 0;
        this.economy.decorPurchases = decorIds.reduce((counts, id) => { counts[id] = 0; return counts; }, {});

        this.tankTier = 0;
        this.spaceUnlocked = false;
        this.spaceBuilt = false;
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
        this.aliens = [];
        this.spaceStars = [];
        this.spaceRocks = [];
        this.fishById = new Map();
        this.foodById = new Map();
        this.accessoryById = new Map();
        this.alienById = new Map();
        this.nextFishId = 1;
        this.nextFoodId = 1;
        this.nextAccessoryId = 1;
        this.nextBubbleId = 1;
        this.nextFloaterId = 1;
        this.nextStaticId = 1;
        this.nextAlienId = 1;
        this.nextSpaceSceneryId = 1;
        this.fishCounts = {};
        for (const species of CATALOG.fish || []) this.fishCounts[species.id] = 0;
        for (const species of CATALOG.aliens || []) this.fishCounts[species.id] = 0;
        this.decorCounts = decorIds.reduce((counts, id) => { counts[id] = 0; return counts; }, {});

        this.expandStaticWorld(0);
        this.addFoodSlots(INITIAL_POOL.food);
        this.addBubbleSlots(INITIAL_POOL.bubbles);
        this.addFloaterSlots(INITIAL_POOL.floaters);
        this.addFish('guppy', true);
        this.addFish('guppy', true);
        this.addFish('guppy', true);
        this.addFish('clown', true);
        this.addFish('clown', true);
        this.addFish('tang', true);
        this._renderSpatialIndexTime = -1;
        this._renderCreatureGrids = { water: new Map(), space: new Map() };
        this._renderFishGrid = this._renderCreatureGrids.water;
        this._renderAlienGrid = this._renderCreatureGrids.space;
        this.goldenEvent = {
            active: null,
            nextAt: this.time + this.nextFirstGoldenVisitorDelay()
        };
        this.worldEvent = {
            active: null,
            nextAt: this.time + this.nextFirstWorldEventDelay(),
            serial: (this.worldEvent && this.worldEvent.serial) || 0
        };

        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player || !player.connected) continue;
            player.eraConfirmUntil = 0;
            player.inspection = null;
            this.setShopVisible(player, false);
            player.shopPage = 0;
            const preservedGate = this.horizonMarkerDescriptor(Math.max(0, this.progression.completedEras * HORIZON_MARKERS_PER_ERA - 1));
            player.camera.x = preservedGate.x;
            player.camera.y = 54;
            player.camera.targetX = preservedGate.x;
            player.camera.targetY = 54;
            player.camera.zoom = 1;
            player.camera.targetZoom = 1;
            player.camera.velocity = 0;
            player.camera.velocityY = 0;
            player.keys = {};
            player.eraFlyHomeAt = this.time + 3.4;
            if (player.view) {
                player.view.fishClusterLevel = -1;
                player.view.fishClusterSnapshot = [];
                player.view.fishClusterNextRefresh = 0;
                player.view.closeFishIds = [];
                player.view.feedTargets = [];
            }
            this.updateCameraControls(player);
            this.updatePlayerUi(player, true);
        }

        const multiplier = this.formatMultiplier(this.eraRewardMultiplier());
        this.setGlobalStatus(`ERA ${finishedEra} PRESERVED — ERA ${this.progression.era} x${multiplier}`, 5);
        this.setProgressionCelebration(
            `ERA ${this.progression.era} BEGINS`,
            `ERA ${finishedEra} PRESERVED · PERMANENT REWARDS x${multiplier}`,
            { kind: 'era', duration: HORIZON_ERA_CELEBRATION_SECONDS }
        );
        this.persist();
        return true;
    }

    isHorizonCamera(player) {
        if (!this.horizonAccessible()) return false;
        const transition = this.horizonStartX() - HORIZON_GAP * 0.5;
        return player.camera.x >= transition;
    }

    horizonBackgroundColor(screenY) {
        if (screenY < 34) return [45, 70, 126, 255];
        if (screenY < 64) return [111, 146, 176, 255];
        if (screenY < 76) return [246, 177, 111, 255];
        return [20, 92, 130, 255];
    }

    renderHorizon(player) {
        const view = player.view;
        const count = this.totalHorizonMarkerCount();
        if (!view || count <= 0) return;
        const rect = this.visibleWorldRect(player, 10);
        const startX = this.horizonStartX();
        const endX = this.horizonMarkerX(count - 1) + 70;
        const preloadX = Math.max(HORIZON_PRELOAD_MIN_X, this.viewWidth(player) * HORIZON_PRELOAD_VIEW_FACTOR);

        // Horizon monuments are permanent, static achievements. Do not resize their
        // presentation pool as individual markers cross the viewport edge: that made
        // a seven-node island detach/rebind at culling boundaries and looked like
        // flicker/pop-in. We keep a tiny fixed pool while the Horizon is nearby and
        // preload markers well offscreen, then simply reproject the same stable ids.
        const nearHorizon = !(
            rect.maxX < startX - preloadX || rect.minX > endX + preloadX ||
            rect.maxY < 12 || rect.minY > 128
        );
        if (!nearHorizon) {
            this.ensureShapePool(view, 'horizonMarkerSlots', view.horizonLayer, 0, HORIZON_MARKER_NODES);
            this.ensureTextPool(view, 'horizonLabelSlots', view.horizonTextLayer, 0);
            return;
        }

        const poolSize = Math.min(HORIZON_VIEW_CAP, count);
        this.ensureShapePool(view, 'horizonMarkerSlots', view.horizonLayer, poolSize, HORIZON_MARKER_NODES);
        this.ensureTextPool(view, 'horizonLabelSlots', view.horizonTextLayer, poolSize);

        const first = Math.max(0, Math.floor((rect.minX - preloadX - startX) / HORIZON_MARKER_SPACING));
        const last = Math.min(count - 1, Math.ceil((rect.maxX + preloadX - startX) / HORIZON_MARKER_SPACING));
        let visible = [];
        for (let i = first; i <= last; i++) visible.push(this.horizonMarkerDescriptor(i));
        if (visible.length > HORIZON_VIEW_CAP) {
            visible.sort((a, b) => Math.abs(a.x - player.camera.x) - Math.abs(b.x - player.camera.x) || a.id - b.id);
            visible = visible.slice(0, HORIZON_VIEW_CAP).sort((a, b) => a.id - b.id);
        }

        this.bindSlots(view.horizonMarkerSlots, visible);
        for (const slot of view.horizonMarkerSlots) {
            if (slot.boundItem) {
                this.renderHorizonMarker(player, slot.boundItem, slot.nodes);
            } else {
                for (const node of slot.nodes) {
                    node.node.fill = COLORS.transparent;
                    node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                }
            }
        }

        const labelItems = player.camera.zoom >= 0.42 ? visible : [];
        this.bindSlots(view.horizonLabelSlots, labelItems);
        for (const slot of view.horizonLabelSlots) {
            const item = slot.boundItem;
            if (!item) {
                setText(slot.node, '');
                setTextPosition(slot.node, -100, -100);
                continue;
            }
            const label = `ERA ${item.era} · ${item.name}`;
            const markerScreenY = this.worldToScreenY(player, item.y);
            const labelY = clamp(
                markerScreenY + 15 * this.screenScale(player),
                HORIZON_LABEL_MIN_SCREEN_Y,
                HORIZON_LABEL_MAX_SCREEN_Y
            );
            setText(slot.node, label);
            setTextPosition(slot.node, this.worldToScreenX(player, item.x), labelY);
            setTextSize(slot.node, clamp(1.18 * player.camera.zoom, 0.72, 1.42));
            setTextColor(slot.node, [244, 248, 250, 245]);
        }
    }

    renderHorizonMarker(player, item, nodes) {
        const x = this.worldToScreenX(player, item.x);
        const y = this.worldToScreenY(player, item.y);
        const celebration = this.progression && this.progression.celebration;
        const highlighted = Boolean(celebration && celebration.until > this.time && celebration.markerIndex === item.globalIndex);
        const pulseScale = highlighted ? 1.06 + Math.sin(this.time * 8) * 0.035 : 1;
        const z = this.screenScale(player) * pulseScale;
        const sx = (v) => v * z;
        const fill = item.color;
        const dark = [31, 48, 64, 255];
        const pale = [238, 239, 220, 255];
        const green = [55, 155, 103, 255];
        const sea = [21, 103, 137, 255];
        const gold = [255, 222, 115, 255];
        const hide = (node) => { node.node.fill = COLORS.transparent; node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0); };
        for (const node of nodes) hide(node);

        nodes[0].node.fill = sea;
        nodes[0].node.coordinates2d = polyEllipse(x, y + sx(8), sx(18), sx(4.8), 12);
        nodes[1].node.fill = [201, 166, 103, 255];
        nodes[1].node.coordinates2d = polyEllipse(x, y + sx(4.0), sx(15.5), sx(5.8), 12);

        if (item.slot === 0) {
            nodes[2].node.fill = pale;
            nodes[2].node.coordinates2d = ShapeUtils.rectangle(x - sx(2.4), y - sx(16), sx(4.8), sx(20));
            nodes[3].node.fill = fill;
            nodes[3].node.coordinates2d = ShapeUtils.rectangle(x - sx(3.1), y - sx(18.5), sx(6.2), sx(3.2));
            nodes[4].node.fill = gold;
            nodes[4].node.coordinates2d = polyCircle(x, y - sx(17), sx(1.1), 8);
            nodes[5].node.fill = [255, 236, 151, 120];
            nodes[5].node.coordinates2d = [[x, y - sx(17)], [x + sx(15), y - sx(22)], [x + sx(15), y - sx(12)], [x, y - sx(17)]];
        } else if (item.slot === 1) {
            // Palm Isle is intentionally tall: the monument should read as a major
            // achievement above the waterline while its caption stays clear of HUD.
            nodes[1].node.coordinates2d = polyEllipse(x, y + sx(4.2), sx(16), sx(5.2), 12);
            nodes[2].node.fill = [113, 84, 54, 255];
            nodes[2].node.coordinates2d = thickLine(x - sx(4.5), y + sx(3), x - sx(1), y - sx(18), sx(1.9));
            nodes[3].node.fill = green;
            nodes[3].node.coordinates2d = polyCircle(x - sx(2), y - sx(20), sx(6.8), 9);
            nodes[4].node.fill = [113, 84, 54, 255];
            nodes[4].node.coordinates2d = thickLine(x + sx(5), y + sx(3), x + sx(8), y - sx(13), sx(1.6));
            nodes[5].node.fill = fill;
            nodes[5].node.coordinates2d = polyCircle(x + sx(8), y - sx(15), sx(5.4), 9);
        } else if (item.slot === 2) {
            nodes[2].node.fill = fill;
            nodes[2].node.coordinates2d = ShapeUtils.rectangle(x - sx(10), y - sx(13), sx(4), sx(17));
            nodes[3].node.fill = fill;
            nodes[3].node.coordinates2d = ShapeUtils.rectangle(x + sx(6), y - sx(13), sx(4), sx(17));
            nodes[4].node.fill = pale;
            nodes[4].node.coordinates2d = [[x - sx(11), y - sx(13)], [x, y - sx(22)], [x + sx(11), y - sx(13)], [x + sx(7), y - sx(10)], [x, y - sx(16)], [x - sx(7), y - sx(10)], [x - sx(11), y - sx(13)]];
            nodes[5].node.fill = gold;
            nodes[5].node.coordinates2d = polyCircle(x, y - sx(12), sx(2.1), 8);
        } else if (item.slot === 3) {
            nodes[2].node.fill = fill;
            nodes[2].node.coordinates2d = polyEllipse(x, y - sx(9), sx(12), sx(5.2), 14);
            nodes[3].node.fill = fill;
            nodes[3].node.coordinates2d = [[x - sx(11), y - sx(9)], [x - sx(18), y - sx(15)], [x - sx(16), y - sx(7)], [x - sx(18), y], [x - sx(11), y - sx(7)], [x - sx(11), y - sx(9)]];
            nodes[4].node.fill = pale;
            nodes[4].node.coordinates2d = polyCircle(x + sx(7), y - sx(10), sx(0.8), 6);
            nodes[5].node.fill = dark;
            nodes[5].node.coordinates2d = ShapeUtils.rectangle(x - sx(1.2), y - sx(4), sx(2.4), sx(8));
        } else if (item.slot === 4) {
            const heights = [13, 21, 16, 25];
            for (let i = 0; i < 4; i++) {
                nodes[i + 2].node.fill = i === 3 ? fill : [65 + i * 14, 84 + i * 9, 111 + i * 10, 255];
                nodes[i + 2].node.coordinates2d = ShapeUtils.rectangle(x + sx(-11 + i * 6), y - sx(heights[i]), sx(5), sx(heights[i] + 4));
            }
        } else {
            nodes[2].node.fill = fill;
            nodes[2].node.coordinates2d = ShapeUtils.rectangle(x - sx(12), y - sx(16), sx(4.5), sx(20));
            nodes[3].node.fill = fill;
            nodes[3].node.coordinates2d = ShapeUtils.rectangle(x + sx(7.5), y - sx(16), sx(4.5), sx(20));
            nodes[4].node.fill = gold;
            nodes[4].node.coordinates2d = polyCircle(x, y - sx(14), sx(7), 12);
            nodes[5].node.fill = [255, 242, 186, 255];
            nodes[5].node.coordinates2d = polyCircle(x, y - sx(14), sx(3.2), 10);
        }

        nodes[6].node.fill = highlighted
            ? [255, 235, 133, 245]
            : (item.completedEra ? [255, 255, 255, 210] : [255, 255, 255, 95]);
        nodes[6].node.coordinates2d = diamond(x, y + sx(2), sx(1.2), sx(1.8));
    }

    exportCheckpoint() {
        const checkpoint = this._aquariumBase_exportCheckpoint();
        checkpoint.formatVersion = 7;
        checkpoint.game = 'aquarium-forever-horizon';
        checkpoint.spaceUnlocked = this.spaceUnlocked;
        checkpoint.progression = {
            era: this.progression.era,
            completedEras: this.progression.completedEras,
            lifetimeEarned: this.progression.lifetimeEarned,
            worldUpgrades: Object.assign({}, this.progression.worldUpgrades)
        };
        checkpoint.aliens = this.aliens.filter(alien => !alien.golden).map((alien) => ({
            speciesId: alien.speciesId,
            x: alien.x,
            y: alien.y,
            dir: alien.dir,
            scale: alien.scale,
            name: alien.name,
            trait: alien.trait || '',
            bornAt: alien.bornAt || 0,
            bites: alien.bites || 0,
            lifetimeEarned: alien.lifetimeEarned || 0
        }));
        checkpoint.worldEvent = this.worldEvent && this.worldEvent.active ? {
            id: this.worldEvent.active.id,
            remaining: Math.max(0, this.worldEvent.active.until - this.time)
        } : null;
        return checkpoint;
    }
}

module.exports = AquariumForever;
