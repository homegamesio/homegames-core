// LEMONADE TYCOON: NIGHT OF THE LEMONS
// Day loop: PREP (mix recipe + set price, majority vote) -> SALES (customers with
// taste/price preferences, reputation) -> NIGHT (scrolling world: fight lemon
// enemies, harvest wells + sugar canes, bank resources at home base before dawn).
// Death == wait for dawn. All players dead == game over. Works solo or up to 6 players.
//
// All gameplay numbers live in the DEV TUNING MENU section below - tweak,
// save, replay. Start with TUNING.DIFFICULTY and TUNING.NIGHT_SECONDS.

const { Game, GameNode, Colors, Shapes, ShapeUtils, Asset } = require('squish-150');
const { COLORS } = Colors;
const { forecastRecipe, willingness, segmentDistance } = require('./rules');
const { captureMorning, readMorning, endRun } = require('./save-state');

// Reuse every pool slot, but don't transmit empty drawings. Keep interactive
// nodes and grouping nodes intact, including their original player scopes.
const hasVisibleContent = ({ node }) => {
    if (node.children?.length || node.handleClick || node.handleKeyDown) return true;
    if (node.text) return !!node.text.text;
    if (node.asset) return Object.values(node.asset).some(asset => asset.size?.x > 0 && asset.size?.y > 0);
    const points = node.coordinates2d;
    return !!points?.length && points.some(point => point[0] !== points[0][0] || point[1] !== points[0][1]);
};

// Local drawings are also declared literally in metadata for the catalog loader.
// Keep both registries in sync. Shape-based decorations remain intentionally simple.
const ASSETS = {
    walk2: './assets/walk-2.png',
    walk1: './assets/walk-1.png',
    cannonball: './assets/cannonball.png',
    arrow: './assets/arrow.png',
    mug: './assets/lemonade-mug.png',
    vendor: './assets/vendor.png',
    stand:        './assets/42e73f4d37144094799bdbd015f7cd8d.png',   // the lemonade stand (night home base + sales screen)
    playerChar:   './assets/6e4a664f167fa9e93204ebe0d89adf3d.png',   // player character (all players; tinted glow marks yours)
    customer:     './assets/39c717dc9365cbc742bf2354d87a0048.png',   // sales-phase customer walking up to the stand
    lemonGrunt:   './assets/28ce8d43e71d75e77bf7772bf3aae864.png',   // enemy 1: standard little lemon
    lemonBrute:   './assets/0cc54ccb203e089b50ef6db99560dff2.png',   // enemy 2: big slow heavy-hitter
    lemonJumper:  './assets/cac9cb9db69e9ddb08ddb21637350626.png',   // enemy 3: erratic hopper
    lemonSpitter: './assets/105bc51d16269f0584020a91d3ea7ff8.png',   // enemy 4: ranged spitter
    axe:          './assets/ef5cc4fe625b3f91959407f09e205d60.png',   // weapon icons float beside the player character
    bow:          './assets/2fec9fcf36f84ec6352053139e28e0f4.png',
    cannon:       './assets/19bad33f7d45358cb1b04218a2fc8afc.png',
    well:         './assets/7335d5d1006b3745e5d867a954895078.png',   // water well
    cane:         './assets/cd977932a0679886981eb09d7c25c9e2.png',   // sugar cane
    fencePost:    './assets/9cfe02450502d8264a236f34b51a39df.png',   // fence segment (all levels; level shown by tint/size for now)
    turret:       './assets/7ca78b9f5b70b052b1461ce2685df0be.png',   // auto-turret
    dancer1:      './assets/e08b124a6c8169fd41423b0e54c6f188.png',
    dancer2:      './assets/dae35539dc1c3f5e3dbaefa380c3b943.png',
    dancer3:      './assets/6e4a216679625444c626adaeb5a5650e.png',
    dancer4:      './assets/dance-floor.png',
    dancer5:      './assets/dance-wave.png',
    dancer6:      './assets/dance-cheer.png',
    bossLemon:    './assets/0cc54ccb203e089b50ef6db99560dff2.png' // enlarged brute, with a drawn crown
};
const ART_RATIOS = {"walk2": 0.4361, "walk1": 0.6598, "cannonball": 0.9627, "arrow": 1.6277, "mug": 1.2957, "vendor": 1.2024, "stand": 1.1732, "playerChar": 0.4735, "customer": 0.4414, "lemonGrunt": 0.8713, "lemonBrute": 0.9719, "lemonJumper": 1.0676, "lemonSpitter": 1.1083, "axe": 0.9395, "bow": 0.5013, "cannon": 0.6162, "well": 1.0366, "cane": 0.5803, "fencePost": 0.6465, "turret": 1.1456, "dancer1": 0.5662, "dancer2": 1.5719, "dancer3": 0.7388, "dancer4": 2.0879, "dancer5": 0.7445, "dancer6": 0.5632, "bossLemon": 0.9719};
const PAPER = [249, 239, 211, 255], INK = [44, 54, 55, 255], GREEN = [52, 112, 90, 255], ORANGE = [205, 99, 49, 255];
// The dance animation cycles through whichever dancer frames are registered, in order.
const DANCER_KEYS = ['dancer1', 'dancer2', 'dancer3', 'dancer4', 'dancer5', 'dancer6'].filter(k => ASSETS[k]);
// ======================================================================

// ========================== DEV TUNING MENU ===========================
// Every gameplay dial lives in this section. Tweak, save, replay.
//
// TWO VALUES ARE DUPLICATED IN metadata() AND MUST BE CHANGED IN BOTH
// PLACES BY HAND: TICK (metadata's tickRate) and MAX_PLAYERS (metadata's
// maxPlayers). metadata() must stay a pure object literal because the
// platform statically parses it without running any code - it cannot
// read this object.
const TUNING = {
    // ---- master knobs ----
    DIFFICULTY: 1.0,        // one dial for night meanness: scales lemon count, toughness,
                            // and spawn tempo. 0.5 = chill, 1 = normal, 1.5 = brutal.
                            // (Does NOT touch lemon speed/behavior - those stay readable.)
    NIGHT_SECONDS: 75,      // round length: how long each night lasts
    TICK: 20,               // tickRate - MUST match the tickRate literal in metadata()
    MAX_PLAYERS: 6,         // session cap - MUST match the maxPlayers literal in metadata()

    // ---- pacing ----
    RECAP_SECONDS: 12,          // dawn recap screen before auto-continuing
    SALES_END_DELAY_TICKS: 40,  // grace period after the last customer before night falls

    // ---- world / camera ----
    WORLD: 200,                     // night world is WORLD x WORLD units
    VIEW: 60,                       // camera window size in world units
    BASE: { x: 100, y: 100, r: 9 }, // home base position + banking radius

    // ---- players ----
    PLAYER: {
        hp: 5,              // night hit points (LEMON VITALITY boost adds to this)
        speed: 0.95,        // night move speed (SUGAR RUSH SHOES boost multiplies this)
        invulnTicks: 26,    // i-frames after taking a hit
        danceSpeed: 1.25,   // sales-phase dancer move speed
        ghostSpeed: 1.1     // dead players drift as scouting ghosts at speed * this
    },

    // ---- starting state / economy ----
    START: { money: 18, rep: 10, inv: { water: 100, sugar: 70, lemons: 70 } },

    // ---- customers / sales ----
    CUSTOMERS: {
        base: 7,            // customers on day 1...
        perDay: 2,          // ...plus this many per extra day...
        repDivisor: 15,     // ...plus rep/this
        min: 6, max: 12,    // clamped to this range
        decideTicks: 22     // how long a customer ponders at the stand
    },

    // ---- breakdance hype / customer rush ----
    HYPE: {
        max: 100,
        moveGain: 0.36,      // hype per moving dancer per tick
        idleGain: 0.01,     // hype per idle dancer per tick
        rushBase: 4,        // rush crowd size = base + players * perPlayer (capped by MAX_RUSH)
        rushPerPlayer: 2,
        priceBonus: 0.4     // extra $/cup a hyped rusher will tolerate
    },

    // ---- dance-floor pickups (sales phase) ----
    PICKUPS: {
        spawnTicks: 100,    // base ticks between spawns...
        jitter: 60,         // ...plus 0..jitter random extra
        lifeTicks: 140,     // how long a pickup lingers before vanishing
        radius: 4.5,        // dance this close to grab it
        bonus: 12,          // hype awarded per pickup
        max: 3              // most pickups on the floor at once (sizes the pool)
    },

    // ---- auto-combat (movement, dodge and charged moves stay player-controlled) ----
    AUTO: {
        rangedAcquire: 28,  // bow/cannon auto-fire at lemons within this range
        rangedCaneRange: 13 // ...and auto-shoot canes within this (only when no lemon is in reach)
    },

    // ---- night minimap (fog of war; shared - anyone exploring clears it for the team) ----
    MINIMAP: {
        x: 76.5, y: 73.5,   // screen position (bottom-right corner)
        size: 22,           // map is size x size screen units
        grid: 8,            // fog cells per side (8x8 = 64 shared nodes; keep modest for bandwidth)
        reveal: 16,         // world-unit radius a player uncovers as they travel
        dot: 1.3            // entity dot size on the map
    },

    // ---- night gathering ----
    GATHER: {
        wells: 2,           // wells per night (also sizes the render pool)
        wellWater: 24,      // water per well
        wellPull: 2,        // water gained per pulse while inside a well's radius
        wellPullTicks: 16,  // ticks per pulse
        wellRadius: 8,      // stand this close to a well and water flows on its own
        canes: 6,           // sugar canes per night (also sizes the render pool)
        caneHp: 3,          // chops to fell a cane
        sugarPerChop: 4,    // sugar per chop
        lemonsPerKill: 3    // lemons looted per slain lemon
    },

    // ---- the lemon horde (DIFFICULTY scales hp, cap, and spawn tempo) ----
    LEMONS: {
        baseHp: 4,          // day-1 lemon hp...
        hpGrowthDays: 3,    // ...+1 every this many days...
        hpMax: 12,           // ...capped here (before the DIFFICULTY multiplier)
        firstSpawnDelay: 35,                            // ticks of peace when night falls
        spawnCdBase: 48, spawnCdPerDay: 3, spawnCdMin: 15,  // ticks between spawns (divided by DIFFICULTY)
        capBase: 8, capPerDay: 2, capPerPlayer: 3,          // on-screen cap (multiplied by DIFFICULTY, hard-capped by MAX_LEMONS)
        jumperDay: 1, spitterDay: 2, bruteDay: 3            // the day each breed joins the spawn pool
    },

    // ---- boss cycle (the win condition that never ends) ----
    // Pay the challenge fee in prep -> the boss storms the map that night.
    // Kill it -> victory! ...except it was reporting to the NEXT boss, whose
    // era makes every regular lemon meaner (eraRamp compounds per victory).
    BOSS: {
        cost: 65, costGrowth: 1.5,   // challenge fee, growing each era
        hp: 100, hpGrowth: 1.45,       // boss durability, growing each era
        speed: 0.34,                  // slow, inevitable
        dmg: 2,                       // damage to players
        sdmg: 5,                      // damage to fence/stand per hit
        reach: 7,                     // melee reach vs players
        windup: 22,                   // telegraph ticks before each swing
        size: 5.5,                    // world-unit radius (he's BIG)
        summonTicks: 90,              // waves in extra lemons this often
        eraRamp: 1.22                 // regular-lemon difficulty multiplier per defeated boss
    }
};

// Team weapon upgrades: bought in the prep-phase armory (majority vote), apply to
// everyone, no ammo, last until all players die. 'hands' is the free starter.
const WEAPONS = {
    hands: { name: 'BARE HANDS', price: 0, dmg: 2, cd: 14, range: 6.5, knock: 0.5,
        special: 'PALM PARTY', blurb: 'Quick punches. Zest: a big shove.' },
    axe: { name: 'AXE', price: 18, dmg: 3, cd: 17, range: 10, arcCos: 0.15, knock: 6,
        special: 'WHIRLWIND', blurb: 'Wide cleave + knockback. Zest: spin!' },
    bow: { name: 'BOW', price: 18, dmg: 2, cd: 11, speed: 2.9, life: 15, radius: 1.5, pierce: 3, knock: 1,
        special: 'ARROW PARTY', blurb: 'Pierces 3 lemons. Zest: arrow fan.' },
    cannon: { name: 'CANNON', price: 48, dmg: 6, cd: 34, speed: 1.7, life: 24, radius: 2, blast: 9, knock: 7,
        special: 'MEGA POP', blurb: 'Big splash damage. Zest: mega blast.' }
};

// APPEARANCE upgrades for the stand itself: bought on the APPEARANCE shop tab
// (majority vote, permanent). These shape how customers behave rather than combat.
// FLEXIBLE BY DESIGN - to add one: add an entry here (the shop grid grows itself,
// rows of 3, keep <= 6 or add paging), optionally give it a decor node in
// buildSales()/updateDecor(), and its `effects` keys sum automatically into
// standMods(), which the sales logic reads. Effect keys currently understood:
//   extraCustomers (+N per day) - priceTolerance (+$ customers accept)
//   repBonus (+rep per happy sale) - tipChance / tipMult (tip odds + size)
const APPEARANCE_UPGRADES = {
    paint:  { name: 'FRESH PAINT',    price: 16, effects: { repBonus: 1 },
              blurb: 'happy customers give +1 extra rep' },
    sign:   { name: 'NEON SIGN',      price: 28, effects: { extraCustomers: 3 },
              blurb: '+3 customers show up every day' },
    patio:  { name: 'PATIO UMBRELLA', price: 38, effects: { priceTolerance: 0.35 },
              blurb: 'customers accept prices $0.35 higher' },
    tipjar: { name: 'TIP JAR',        price: 20, effects: { tipChance: 0.35, tipMult: 0.5 },
              blurb: 'happy customers sometimes tip 50%' }
};

// The lemon dynasty. Each defeated boss reveals the next name in the chain -
// same boss asset for now (ASSETS.bossLemon), stats scale via TUNING.BOSS.
// When the list runs out it wraps with MK.2, MK.3... To give each boss its own
// art later, turn ASSETS.bossLemon into a per-era key list like DANCER_KEYS.
const BOSS_NAMES = [
    'KING LEMON', 'BARON CITRON', 'THE ZESTFATHER', 'EMPRESS RIND',
    'GRAND PULP MAGNATE', 'LORD LIMONCELLO', 'DUKE MERINGUE', 'THE FINAL SQUEEZE'
];

// Daily weather / trend forecast, shown at prep. Shifts what customers want so
// the recipe vote matters every morning. To add a day type: one entry here.
//   custMult  - multiplies customer count
//   sweet/tart - shifts customer preference centers (+/- on the 1..5 scale)
//   priceShift - added to what customers will pay
const WEATHER = [
    { name: 'SUNNY',        blurb: 'a normal day at the stand',                custMult: 1.0, sweet: 0,  tart: 0,  priceShift: 0 },
    { name: 'SCORCHER',     blurb: 'thirsty crowds want it TART and cold',     custMult: 1.4, sweet: -1, tart: 1,  priceShift: 0.15 },
    { name: 'GLOOMY',       blurb: 'few customers - they crave something sweet', custMult: 0.6, sweet: 1, tart: -1, priceShift: 0 },
    { name: 'STREET FAIR',  blurb: 'crowds everywhere and money flows',        custMult: 1.5, sweet: 0,  tart: 0,  priceShift: 0.25 },
    { name: 'HEALTH CRAZE', blurb: 'light and low-sugar is in this week',      custMult: 0.9, sweet: -2, tart: 0,  priceShift: 0 }
];

// SUPPLIES: repeatable team upgrades with prices that scale per level - the
// late-game money sink as eras ramp up. To add one: table entry + an effect
// hook (standMax / playerMaxHp / playerSpeed / tasteScore read the levels).
const BOOSTS = {
    power: { name: 'JUICE POWER', base: 22, growth: 1.6, blurb: '+1 damage; cannon gets +2' },
    tempo: { name: 'QUICK HANDS', base: 24, growth: 1.65, blurb: '12% faster attacks per level (max 55%)' },
    standHp:   { name: 'REINFORCE STAND',  base: 22, growth: 1.5, blurb: '+10 max stand HP, applied now' },
    vitality:  { name: 'LEMON VITALITY',   base: 24, growth: 1.5, blurb: '+1 max HP for every player' },
    swiftness: { name: 'SUGAR RUSH SHOES', base: 20, growth: 1.5, blurb: 'everyone moves 8% faster at night' },
    premium:   { name: 'PREMIUM LEMONS',   base: 20, growth: 1.5, blurb: 'tastier lemonade - customers rate it higher' }
};

// Stand defense: the lemons attack your stand. Fence soaks damage first and
// keeps lemons out of the yard; turrets auto-fire (bought in prep, no micromanaging).
const STAND_MAX = 30;
const FENCE_R = 16;
const FENCE_LEVELS = [null, { price: 20, hp: 30 }, { price: 40, hp: 65 }, { price: 70, hp: 110 }];
const TURRET_COST = 38;
const MAX_TURRETS = 4;
const TURRET_SLOTS = [[-11, -11], [11, -11], [-11, 11], [11, 11]];
const TURRET_SPEC = { range: 30, cd: 18, speed: 2.0, life: 20, dmg: 2, radius: 2.2 };

// Four lemon breeds, straight from the sketch page:
// grunt = standard chaser | brute = slow, tanky, hits hard (loves the stand)
// jumper = erratic hopper | spitter = kites you and spits from range
const LEMON_TYPES = {
    grunt:   { speed: 0.52, dmg: 1, sdmg: 1, windup: 13, size: 2.6, color: COLORS.YELLOW, asset: 'lemonGrunt' },
    brute:   { speed: 0.30, dmg: 2, sdmg: 3, windup: 18, size: 3.8, color: [240, 150, 40, 255], asset: 'lemonBrute' },
    jumper:  { speed: 1.55, dmg: 1, sdmg: 1, windup: 10, size: 2.2, color: [190, 235, 70, 255], asset: 'lemonJumper' },
    spitter: { speed: 0.38, dmg: 1, sdmg: 1, windup: 12, size: 2.4, color: [255, 190, 120, 255], asset: 'lemonSpitter' }
};

// Pool sizes (memory/bandwidth budget, not gameplay). These hard-cap how many
// of each thing can exist at once regardless of the formulas above.
const MAX_LEMONS = 36;
const MAX_PROJ = 36;     // pooled projectiles (bow arrows / cannon balls)
const MAX_FX = 20;       // pooled hit-splash effects
const MAX_DMG = 8;       // pooled floating damage/gain numbers
const MAX_EPROJ = 8;     // pooled enemy (spitter) projectiles
const MAX_RUSH = 8;      // pooled rush customers
// ======================= END DEV TUNING MENU ==========================

// Aliases so the game body reads cleanly.
const TICK = TUNING.TICK;
const WORLD = TUNING.WORLD;
const VIEW = TUNING.VIEW;
const NIGHT_SECONDS = TUNING.NIGHT_SECONDS;
const BASE = TUNING.BASE;
const MAX_PLAYERS = TUNING.MAX_PLAYERS;
const DIFF = TUNING.DIFFICULTY;
const HYPE_MAX = TUNING.HYPE.max;
const HYPE_MOVE_GAIN = TUNING.HYPE.moveGain;
const HYPE_IDLE_GAIN = TUNING.HYPE.idleGain;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// Round-ish polygon (Shapes.CIRCLE does not render)
const polyCircle = (cx, cy, r, sides = 12) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

class LemonadeTycoon extends Game {
    static metadata() {
        return {
            thumbnail: './assets/thumbnail.png',
            name: 'Lemonade Tycoon: Night of the Lemons',
            author: "Joseph Garcia",
            description: 'Fight lemons in the night and profit during the day',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 20,
            maxPlayers: 6,
            assets: {
                'sfx-zest': new Asset({ path: './assets/sfx-zest.wav', type: 'audio' }),
                'sfx-hurt': new Asset({ path: './assets/sfx-hurt.wav', type: 'audio' }),
                'sfx-dash': new Asset({ path: './assets/sfx-dash.wav', type: 'audio' }),
                'sfx-cash': new Asset({ path: './assets/sfx-cash.wav', type: 'audio' }),
                'sfx-boom': new Asset({ path: './assets/sfx-boom.wav', type: 'audio' }),
                'sfx-twang': new Asset({ path: './assets/sfx-twang.wav', type: 'audio' }),
                'sfx-chop': new Asset({ path: './assets/sfx-chop.wav', type: 'audio' }),
                bossLemon: new Asset({ path: './assets/0cc54ccb203e089b50ef6db99560dff2.png', type: 'image' }),
                walk2: new Asset({ path: './assets/walk-2.png', type: 'image' }),
                walk1: new Asset({ path: './assets/walk-1.png', type: 'image' }),
                cannonball: new Asset({ path: './assets/cannonball.png', type: 'image' }),
                arrow: new Asset({ path: './assets/arrow.png', type: 'image' }),
                mug: new Asset({ path: './assets/lemonade-mug.png', type: 'image' }),
                vendor: new Asset({ path: './assets/vendor.png', type: 'image' }),
                dancer6: new Asset({ path: './assets/dance-cheer.png', type: 'image' }),
                dancer5: new Asset({ path: './assets/dance-wave.png', type: 'image' }),
                dancer4: new Asset({ path: './assets/dance-floor.png', type: 'image' }),
              'stand': new Asset({ path: './assets/42e73f4d37144094799bdbd015f7cd8d.png', 'type': 'image' }),
              'playerChar': new Asset({ path: './assets/6e4a664f167fa9e93204ebe0d89adf3d.png', 'type': 'image' }),
              'customer': new Asset({ path: './assets/39c717dc9365cbc742bf2354d87a0048.png', 'type': 'image' }),
              'lemonGrunt': new Asset({ path: './assets/28ce8d43e71d75e77bf7772bf3aae864.png', 'type': 'image' }),
              'lemonBrute':  new Asset({ path: './assets/0cc54ccb203e089b50ef6db99560dff2.png', 'type': 'image' }),
              'lemonJumper': new Asset({ path: './assets/cac9cb9db69e9ddb08ddb21637350626.png',  'type': 'image' }),
              'lemonSpitter': new Asset({ path: './assets/105bc51d16269f0584020a91d3ea7ff8.png',  'type': 'image' }),
              'axe':   new Asset({ path:   './assets/ef5cc4fe625b3f91959407f09e205d60.png',  'type': 'image' }),
              'bow':    new Asset({ path: './assets/2fec9fcf36f84ec6352053139e28e0f4.png', 'type': 'image' }),
              'cannon':  new Asset({ path:  './assets/19bad33f7d45358cb1b04218a2fc8afc.png','type': 'image' }),
              'well':    new Asset({ path:  './assets/7335d5d1006b3745e5d867a954895078.png',  'type': 'image' }),
              'cane':   new Asset({ path: './assets/cd977932a0679886981eb09d7c25c9e2.png',  'type': 'image' }),
              'fencePost':  new Asset({ path:  './assets/9cfe02450502d8264a236f34b51a39df.png',  'type': 'image' }),
              'turret':   new Asset({ path:  './assets/7ca78b9f5b70b052b1461ce2685df0be.png',  'type': 'image' }),
              'dancer1':   new Asset({ path:  './assets/e08b124a6c8169fd41423b0e54c6f188.png',  'type': 'image' }),
              'dancer2':  new Asset({ path: './assets/dae35539dc1c3f5e3dbaefa380c3b943.png', 'type': 'image' }),
              'dancer3':   new Asset({ path: './assets/6e4a216679625444c626adaeb5a5650e.png', 'type': 'image' })
            },
            gameId: "88f88b4e-5728-57e8-a7bf-ca73103bd92a"
        };
    }

    constructor({ random = Math.random, saveData, saveGame } = {}) {
        super();
        this.random = random;
        this.saveGame = typeof saveGame === 'function' ? saveGame : null;
        this.saveTail = Promise.resolve();
        this.pendingSave = null;
        this.latestCheckpoint = null;
        this.saveInFlight = false;
        this.saveRetryAt = 0;
        this.closed = false;
        const restored = readMorning(saveData, WEATHER.length);
        this.saveBlocked = restored.status === 'invalid';
        this.resumeAvailable = restored.status === 'ready';
        this.saveState = this.saveBlocked ? 'blocked' : this.saveGame ? 'ready' : 'disabled';
        this.soundEnabled = true;
        this.lastSound = {};
        this.voices = [];
        this.salesReport = null;
        this.closeTimer = 0;
        this.dayGoal = null;
        this.dayStats = { revenue: 0, tips: 0, refused: 0 };
        this.nightGoal = { banked: 0, target: 24, paid: false };
        this._t = 0;
        this.phase = 'lobby';
        this.day = 1;
        this.money = TUNING.START.money;
        this.rep = TUNING.START.rep;
        this.inv = Object.assign({}, TUNING.START.inv);
        this.recipe = { sugar: 3, lemons: 3, price: 2 };
        this.votes = {};
        this.players = {};
        this.anchors = {};
        this.stats = { cupsTotal: 0, bossKills: 0 };

        // team weapon (armory purchases are run-long, voted, and shared)
        this.weapon = 'hands';
        this.owned = { axe: false, bow: false, cannon: false };
        this.appearance = {};        // owned appearance upgrades (keys of APPEARANCE_UPGRADES)
        this.boosts = { power: 0, tempo: 0, standHp: 0, vitality: 0, swiftness: 0, premium: 0 };   // repeatable supply levels
        this.mods = this.standMods();
        this.shopTab = 'combat';
        this.shopOpen = false;
        this.weather = WEATHER[0];   // day 1 is always sunny; startPrep rolls the rest

        // boss cycle: era counts which lemon dynast you're up against
        this.era = 1;
        this.bossChallenged = false; // challenge bought this prep -> boss comes tonight
        this.bossNight = false;      // boss is (or was) on the field tonight
        this.boss = { active: false, x: 0, y: 0, hp: 1, maxHp: 1, windup: 0, wtgt: 'p', cd: 0, summonCd: 0 };
        this.victoryTimer = 0;
        this.proposal = null;    // { key, kind, wid, label } - any shop purchase being voted on
        this.propVotes = {};

        // stand defense (persists across nights; repairs cost money)
        this.standHp = STAND_MAX;
        this.fence = { level: 0, hp: 0 };
        this.turrets = 0;
        this.turretCds = [0, 0, 0, 0];
        this.standFlash = 0;
        this.fenceFlash = 0;

        // per-night recap stats
        this.nightStats = { kills: {}, banked: {}, standDmg: 0, fenceDmg: 0 };
        this.recapTimer = 0;

        // pooled world entities (created once, recycled forever)
        this.projectiles = [];
        for (let i = 0; i < MAX_PROJ; i++) {
            this.projectiles.push({ active: false, x: 0, y: 0, dx: 0, dy: 0, life: 0, dmg: 1, radius: 2.4, owner: null, color: [230, 220, 200, 255] });
        }
        this.fx = [];   // expanding hit splashes (yellow = lemon, green = cane, blue = water)
        for (let i = 0; i < MAX_FX; i++) {
            this.fx.push({ active: false, x: 0, y: 0, ttl: 0, max: 8, color: [255, 230, 80, 255] });
        }
        this.dmgTexts = [];   // floating '-1' / '+2' numbers
        for (let i = 0; i < MAX_DMG; i++) {
            this.dmgTexts.push({ active: false, x: 0, y: 0, ttl: 0, max: 16, text: '', color: COLORS.WHITE });
        }
        this.eProj = [];   // spitter projectiles
        for (let i = 0; i < MAX_EPROJ; i++) {
            this.eProj.push({ active: false, x: 0, y: 0, dx: 0, dy: 0, life: 0 });
        }
        this.lemonHp = TUNING.LEMONS.baseHp;

        // sales-day state
        this.customersLeft = 0;
        this.cupsToday = 0;
        this.customer = null;
        this.dayEndTimer = 0;
        this.hype = 0;
        this.rushActive = false;
        this.rushSold = 0;
        this.rushers = [];
        for (let i = 0; i < MAX_RUSH; i++) {
            this.rushers.push({ active: false, x: 0, y: 66, speed: 1.4, ps: 3, pt: 3, resolved: false });
        }
        // dance-floor hype pickups (pooled)
        this.pickups = [];
        for (let i = 0; i < TUNING.PICKUPS.max; i++) this.pickups.push({ active: false, x: 0, y: 0, ttl: 0 });
        this.pickupCd = TUNING.PICKUPS.spawnTicks;
        this.pickupPopTtl = 0;

        // night state
        this.nightLeft = 0;
        this.lastSecond = -1;
        this.spawnCd = 0;
        this.wells = [];
        this.canes = [];
        this.lemons = [];
        for (let i = 0; i < MAX_LEMONS; i++) {
            this.lemons.push({
                active: false, x: 0, y: 0, hp: 0, maxHp: 2, type: 'grunt', state: 'wander',
                windup: 0, wtgt: 'p', cd: 0, angle: 0, hopping: 0, hopT: 0, hdx: 0, hdy: 0
            });
        }

        if (this.resumeAvailable) {
            const saved = restored.checkpoint;
            for (const key of ['day', 'era', 'money', 'rep', 'inv', 'recipe', 'weapon', 'owned', 'appearance', 'boosts', 'standHp', 'fence', 'turrets', 'stats']) this[key] = saved[key];
            this.weather = WEATHER[saved.weatherIndex];
            this.mods = this.standMods();
            this.latestCheckpoint = saved;
        }

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [16, 20, 28, 255]
        });

        this.playerLayer = this.container();   // per-player night views live here (below HUD)
        this.buildLobby();
        this.buildPrep();
        this.buildSales();
        this.buildNightHud();
        this.buildRecap();
        this.buildVictory();
        this.buildGameOver();
        this.buildClosing();
        this.audioRoot = this.container();
        for (let i = 0; i < 6; i++) {
            const node = new GameNode.Asset({ coordinates2d: this.zeroRect(), assetInfo: {} });
            node.node.asset = undefined;
            this.audioRoot.addChild(node); this.voices.push({ node, until: 0 });
        }
        this.soundButton = this.makeButton({ x: 83, y: 97, w: 16, h: 3, label: 'SOUND ON', size: 1.1, fill: [36, 48, 57, 255], onClick: () => this.toggleSound() });
        this.saveStatusText = this.textNode('', 2, 97, 2.2, COLORS.SILVER, 'left');

        this.base.addChildren(
            this.playerLayer,
            this.lobbyRoot,
            this.prepRoot,
            this.salesRoot,
            this.nightHudRoot,
            this.recapRoot,
            this.victoryRoot,
            this.gameOverRoot, this.closingRoot, this.audioRoot, this.soundButton, this.saveStatusText
        );
        this.updateSaveStatus();
        this.setPhase('lobby');
    }

    // ---------- era / boss helpers ----------

    bossName(era) {
        const e = (era || this.era) - 1;
        const cycle = Math.floor(e / BOSS_NAMES.length);
        return BOSS_NAMES[e % BOSS_NAMES.length] + (cycle > 0 ? ' MK.' + (cycle + 1) : '');
    }

    bossCost() {
        return Math.round(TUNING.BOSS.cost * Math.pow(TUNING.BOSS.costGrowth, this.era - 1));
    }

    bossReward() { return Math.round(this.bossCost() * 1.8); }

    // regular-lemon difficulty: the master dial compounded by conquered eras
    diff() {
        return DIFF * Math.pow(TUNING.BOSS.eraRamp, this.era - 1);
    }

    // ---------- supply-boost helpers (repeatable upgrades read these) ----------

    boostCost(wid) {
        return Math.round(BOOSTS[wid].base * Math.pow(BOOSTS[wid].growth, this.boosts[wid]));
    }

    standMax() { return STAND_MAX + this.boosts.standHp * 10; }

    playerMaxHp() { return TUNING.PLAYER.hp + this.boosts.vitality; }

    playerSpeed() { return TUNING.PLAYER.speed * (1 + 0.08 * this.boosts.swiftness); }

    // taste for a recipe vs a customer's (sweet, tart) preference; PREMIUM LEMONS raise it
    tasteScore(r, ps, pt) {
        return Math.min(1, 1 - (Math.abs(r.sugar - ps) + Math.abs(r.lemons - pt)) / 8 + this.boosts.premium * 0.05);
    }

    getLayers() {
        // Keep cached screens/pools for reuse, but only serialize the current
        // screen. Otherwise six players repeatedly encode thousands of hidden
        // nodes, and empty visual slots consume each guest's upload bandwidth.
        const screen = { lobby: this.lobbyRoot, prep: this.prepRoot, sales: this.salesRoot,
            night: this.nightHudRoot, recap: this.recapRoot, victory: this.victoryRoot,
            gameover: this.gameOverRoot, closing: this.closingRoot }[this.phase];
        this.base.node.children = [
            ...(this.phase === 'night' ? [this.playerLayer] : []), screen,
            this.audioRoot, this.soundButton, this.saveStatusText, ...Object.values(this.anchors)
        ].filter(Boolean);
        return [{ root: this.base }];
    }

    updateSaveStatus() {
        const messages = { ready: 'Saves each morning', disabled: 'Saving unavailable', blocked: 'Save unreadable / autosave off',
            saving: 'Saving...', saved: this.latestCheckpoint?.ended ? 'Run ended' : 'Morning saved', error: 'Not saved / retrying' };
        if (this.saveStatusText) {
            this.setText(this.saveStatusText, messages[this.saveState]);
            this.saveStatusText.node.text.color = ['blocked', 'error'].includes(this.saveState) ? ORANGE
                : ['night', 'gameover', 'victory', 'recap'].includes(this.phase) ? COLORS.SILVER : INK;
        }
    }

    checkpoint(value) {
        if (!this.saveGame || this.saveBlocked || this.closed) return;
        this.latestCheckpoint = value;
        this.pendingSave = value;
        this.persist();
    }

    persist() {
        if (this.saveInFlight || !this.pendingSave || this.closed) return this.saveTail;
        this.saveInFlight = true;
        this.saveTail = (async () => {
            try {
                while (this.pendingSave && !this.closed) {
                    const value = this.pendingSave;
                    this.pendingSave = null;
                    this.saveState = 'saving'; this.updateSaveStatus(); this.notify();
                    try {
                        await this.saveGame(value);
                        this.saveState = this.pendingSave ? 'saving' : 'saved';
                    } catch (_) {
                        // Retain only the newest checkpoint; a slow or failed
                        // backend must not build a queue or replace it with an old day.
                        this.pendingSave = this.pendingSave || this.latestCheckpoint;
                        this.saveState = 'error'; this.saveRetryAt = this._t + 5 * TICK;
                        break;
                    }
                }
            } finally {
                this.saveInFlight = false;
                if (!this.closed) { this.updateSaveStatus(); this.notify(); }
            }
        })();
        return this.saveTail;
    }

    close() {
        if (this.closed) return this.saveTail;
        this.closed = true;
        super.close();
        // The platform closes its save bridge immediately after close returns.
        // Submit a newer pending morning/end marker now, before that boundary.
        if (this.pendingSave && this.saveGame && !this.saveBlocked) {
            const pending = this.pendingSave; this.pendingSave = null;
            let finalWrite;
            try { finalWrite = this.saveGame(pending); } catch (_) { finalWrite = Promise.reject(); }
            this.saveTail = Promise.allSettled([this.saveTail, finalWrite]).then(() => {});
        }
        return this.saveTail;
    }

    // ---------- sprites (asset nodes with shape fallbacks) ----------

    spriteReady(key) { return !!ASSETS[key]; }

    lemonSpritesReady() {
        return this.spriteReady('lemonGrunt') && this.spriteReady('lemonBrute')
            && this.spriteReady('lemonJumper') && this.spriteReady('lemonSpitter');
    }

    weaponSpritesReady() {
        return this.spriteReady('axe') && this.spriteReady('bow') && this.spriteReady('cannon');
    }

    dancerSpritesReady() {
        return DANCER_KEYS.length > 0;   // any registered frames -> sprite dancers cycling those frames
    }

    // Creates an image node if the asset ID is registered, else a colored shape.
    // 'ready' overrides the registry check for grouped assets (lemons/weapons).
    mkSprite(key, fallbackFill, extra, ready) {
        const ok = (ready === undefined) ? this.spriteReady(key) : ready;
        if (ok) {
            const n = new GameNode.Asset(Object.assign({
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                assetInfo: { [key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 } } }
            }, extra || {}));
            n._sprite = true;
            n._key = key;
            return n;
        }
        return new GameNode.Shape(Object.assign({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: fallbackFill
        }, extra || {}));
    }

    // Positions any visual (sprite or shape) as a screen-space box, optionally
    // swapping the sprite's asset key (used for lemon types / weapon icons).
    // If your squish-150 renderer names the placement field differently,
    // fix it HERE only - every sprite placement flows through this method.
    placeSprite(n, key, sx, sy, sw, sh) {
        if (!n._sprite) { n.node.coordinates2d = ShapeUtils.rectangle(sx, sy, sw, sh); return; }
        if (key) n._key = key;
        const ratio = ART_RATIOS[n._key];
        if (ratio && sw > 0 && sh > 0) {
            const w = Math.min(sw, sh * ratio), h = w / ratio;
            sx += (sw - w) / 2; sy += (sh - h) / 2; sw = w; sh = h;
        }
        // Asset positions are unsigned on the wire. Crop at the viewport edge
        // instead of letting a partly visible drawing wrap to the other side.
        const left = Math.max(0, -sx), top = Math.max(0, -sy);
        const right = Math.max(0, sx + sw - 100), bottom = Math.max(0, sy + sh - 100);
        const w = sw - left - right, h = sh - top - bottom;
        if (w <= 0 || h <= 0) { this.hideSprite(n); return; }
        const x = sx + left, y = sy + top;
        n.node.coordinates2d = ShapeUtils.rectangle(x, y, w, h);
        n.node.asset = { [n._key]: { pos: { x, y }, size: { x: w, y: h },
            cropLeft: left / sw * 100, cropRight: right / sw * 100,
            cropTop: top / sh * 100, cropBottom: bottom / sh * 100 } };
    }

    hideSprite(n) {
        n.node.coordinates2d = this.zeroRect();
        if (n._sprite) n.node.asset = { [n._key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 } } };
    }

    // ---------- small helpers ----------

    zeroRect() { return ShapeUtils.rectangle(0, 0, 0, 0); }

    container() {
        // zero-size grouping node: never swallows clicks
        return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: this.zeroRect() });
    }

    textNode(text, x, y, size, color, align, playerIds) {
        const opts = { textInfo: { text, x, y, size, align: align || 'center', color, font: 'monospace' } };
        if (playerIds) opts.playerIds = playerIds;
        return new GameNode.Text(opts);
    }

    setText(n, str) {
        n.node.text = Object.assign({}, n.node.text, { text: str });
    }

    makeButton({ x, y, w, h, label, fill, size, labelColor, onClick, playerIds }) {
        const s = size || 2;
        const bgOpts = { shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(x, y, w, h), fill, onClick };
        if (playerIds) bgOpts.playerIds = playerIds;
        const bg = new GameNode.Shape(bgOpts);
        const lbl = this.textNode(label, x + w / 2, y + h / 2 - s * 0.65, s, labelColor || COLORS.WHITE, 'center', playerIds);
        bg.addChild(lbl);
        bg.labelNode = lbl;
        return bg;
    }

    notify() {
        this.base.node.onStateChange();
    }

    show(root) { root.node.playerIds = []; }     // empty = everyone
    hide(root) { root.node.playerIds = [0]; }    // [0] = nobody

    setPhase(phase) {
        this.phase = phase;
        this.updateSaveStatus();
        this.hide(this.lobbyRoot);
        this.hide(this.prepRoot);
        this.hide(this.salesRoot);
        this.hide(this.nightHudRoot);
        this.hide(this.recapRoot);
        this.hide(this.victoryRoot);
        this.hide(this.gameOverRoot);
        this.hide(this.closingRoot);
        if (phase === 'lobby') this.show(this.lobbyRoot);
        else if (phase === 'prep') this.show(this.prepRoot);
        else if (phase === 'sales') this.show(this.salesRoot);
        else if (phase === 'night') this.show(this.nightHudRoot);
        else if (phase === 'recap') this.show(this.recapRoot);
        else if (phase === 'victory') this.show(this.victoryRoot);
        else if (phase === 'gameover') this.show(this.gameOverRoot);
        else if (phase === 'closing') this.show(this.closingRoot);
        for (const id in this.players) {
            const p = this.players[id];
            p.v.root.node.playerIds = (phase === 'night') ? [p.id] : [0];
        }
        this.notify();
    }

    panel(x, y, w, h, fill) {
        return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(x, y, w, h), fill });
    }

    buildClosing() {
        this.closingRoot = this.container();
        this.closingTitle = this.textNode('', 50, 17, 3, PAPER);
        this.closingCups = this.textNode('', 50, 37, 2.2, INK);
        this.closingCash = this.textNode('', 50, 45, 1.9, INK);
        this.closingGoal = this.textNode('', 50, 53, 1.7, GREEN);
        this.closingBank = this.textNode('', 50, 62, 2.5, GREEN);
        this.closingRoot.addChildren(
            this.panel(0, 0, 100, 100, PAPER), this.panel(6, 10, 88, 17, GREEN), this.closingTitle,
            this.closingCups, this.closingCash, this.closingGoal, this.closingBank,
            this.makeButton({ x: 25, y: 78, w: 50, h: 10, label: 'BRING ON THE LEMONS', size: 2, fill: ORANGE,
                onClick: () => { if (this.phase === 'closing') this.startNight(); } })
        );
    }

    // ---------- screen builders ----------

    buildLobby() {
        this.lobbyRoot = this.container();
        const sign = this.mkSprite('stand', ORANGE), mug = this.mkSprite('mug', COLORS.GOLD);
        this.placeSprite(sign, 'stand', 33, 26, 34, 26);
        this.placeSprite(mug, 'mug', 73, 39, 13, 13);
        const lemon = this.mkSprite('lemonGrunt', COLORS.GOLD);
        this.placeSprite(lemon, 'lemonGrunt', 13, 38, 14, 17);
        this.lobbyPlayersText = this.textNode('', 50, 89, 1.6, INK);
        this.freshRunPlayer = null;
        this.freshRunBtn = this.makeButton({ x: 27, y: 60, w: 46, h: 10, label: 'New run', size: 2.3, fill: INK,
            onClick: id => {
                if (this.phase !== 'lobby' || !this.resumeAvailable || !this.players[id]) return;
                if (this.freshRunPlayer !== id) {
                    this.freshRunPlayer = id;
                    this.setText(this.freshRunBtn.labelNode, 'Replace saved run?'); this.notify();
                } else {
                    this.resumeAvailable = false;
                    this.resetGame(true);
                }
            } });
        if (!this.resumeAvailable) this.hide(this.freshRunBtn);
        this.lobbyRoot.addChildren(
            this.panel(0, 0, 100, 100, PAPER),
            this.panel(4, 4, 92, 21, GREEN),
            this.textNode('LEMONADE TYCOON', 50, 8, 4.4, PAPER),
            this.textNode('NIGHT OF THE LEMONS', 50, 17, 2.5, [255, 216, 99, 255]),
            sign, mug, lemon,
            this.freshRunBtn,
            this.makeButton({ x: 27, y: 74, w: 46, h: 10, label: this.resumeAvailable ? 'Resume day ' + this.day : 'Play', size: 2.6, fill: ORANGE,
                onClick: () => { if (this.phase === 'lobby' && Object.keys(this.players).length) this.startPrep(this.day, this.resumeAvailable); } }),
            this.lobbyPlayersText
        );
    }

    buildPrep() {
        this.prepRoot = this.container();
        this.recipeRoot = this.container();
        this.shopRoot = this.container();
        this.prepTitle = this.textNode('', 7, 4, 2.8, PAPER, 'left');
        this.prepMoneyText = this.textNode('', 93, 4.5, 2.3, [255, 218, 107, 255], 'right');
        this.prepWeatherText = this.textNode('', 50, 17, 2, GREEN);
        this.prepRecipeSugarText = this.textNode('', 65, 30, 2.4, INK);
        this.prepRecipeLemonText = this.textNode('', 65, 42, 2.4, INK);
        this.prepPriceText = this.textNode('', 65, 54, 2.1, INK);
        const adj = (x, y, label, field, delta) => this.makeButton({ x, y, w: 10, h: 9, label, size: 2.8, fill: GREEN, onClick: () => this.adjustRecipe(field, delta) });
        this.prepCapacity = this.textNode('', 50, 66, 1.8, GREEN);
        this.confirmBtn = this.makeButton({ x: 26, y: 75, w: 48, h: 10, label: 'Open stand', size: 2.5, fill: GREEN, onClick: id => this.castVote(id) });
        this.shopBtn = this.makeButton({ x: 26, y: 87, w: 48, h: 7, label: 'Shop', size: 2, fill: [232, 217, 178, 255], labelColor: INK, onClick: () => this.setShopOpen(true) });
        this.voteText = this.textNode('', 50, 95, 1.4, INK);
        const mug = this.mkSprite('mug', COLORS.GOLD);
        this.placeSprite(mug, 'mug', 12, 32, 25, 25);
        this.recipeRoot.addChildren(
            this.prepWeatherText, mug,
            adj(43, 27, '-', 'sugar', -1), adj(82, 27, '+', 'sugar', 1), this.prepRecipeSugarText,
            adj(43, 39, '-', 'lemons', -1), adj(82, 39, '+', 'lemons', 1), this.prepRecipeLemonText,
            adj(43, 51, '-', 'price', -0.25), adj(82, 51, '+', 'price', 0.25), this.prepPriceText,
            this.prepCapacity, this.confirmBtn, this.shopBtn, this.voteText
        );

        this.tabBtns = {};
        this.combatTabRoot = this.container(); this.appearTabRoot = this.container(); this.suppliesTabRoot = this.container();
        this.tabRoots = { combat: this.combatTabRoot, appearance: this.appearTabRoot, supplies: this.suppliesTabRoot };
        for (const [i, tab] of ['combat', 'appearance', 'supplies'].entries()) {
            this.tabBtns[tab] = this.makeButton({ x: 6 + i * 30, y: 15, w: 28, h: 7, label: ['Gear', 'Stand', 'Upgrades'][i], size: 1.9, fill: INK, onClick: () => this.setShopTab(tab) });
        }
        const buy = (i, kind, key, name, detail, sprite) => {
            const x = 6 + i % 2 * 46, y = 27 + Math.floor(i / 2) * 15;
            const b = this.makeButton({ x, y, w: 42, h: 13, label: name, size: 1.8, fill: INK, onClick: id => this.propose(id, kind, key) });
            Object.assign(b.labelNode.node.text, { x: x + 3, y: y + 2, align: 'left' });
            b.priceNode = this.textNode('', x + 39, y + 2, 1.7, PAPER, 'right');
            b.detailNode = this.textNode(detail, x + (sprite ? 12 : 3), y + 8, 1.5, [237, 221, 184, 255], 'left');
            b.addChildren(b.priceNode, b.detailNode);
            if (sprite) {
                const icon = this.mkSprite(sprite, COLORS.GOLD);
                this.placeSprite(icon, sprite, x + 3, y + 5, 7, 7);
                b.addChild(icon);
            }
            return b;
        };
        this.weaponBtns = {};
        for (const [i, id] of ['axe', 'bow', 'cannon'].entries()) {
            this.weaponBtns[id] = buy(i, 'weapon', id, { axe: 'Axe', bow: 'Bow', cannon: 'Cannon' }[id],
                { axe: 'Wide cleave', bow: 'Pierces 3', cannon: 'Blast damage' }[id], id);
            this.combatTabRoot.addChild(this.weaponBtns[id]);
        }
        this.defBtns = {
            repair: buy(3, 'repair', null, 'Repairs', '', 'stand'),
            fence: buy(4, 'fence', null, 'Fence', '', 'fencePost'),
            turret: buy(5, 'turret', null, 'Turret', 'Auto fire', 'turret')
        };
        this.combatTabRoot.addChildren(...Object.values(this.defBtns));
        this.appearBtns = {}; this.boostBtns = {};
        const appearanceNames = { paint: 'Fresh paint', sign: 'Neon sign', patio: 'Umbrella', tipjar: 'Tip jar' };
        const appearanceDetails = { paint: '+1 rep per happy cup', sign: '+3 customers a day', patio: '+$0.35 price tolerance', tipjar: 'Occasional 50% tips' };
        const boostNames = { power: 'Juice power', tempo: 'Quick hands', standHp: 'Tough stand', vitality: 'Extra heart', swiftness: 'Sugar shoes', premium: 'Fancy lemons' };
        const boostDetails = { power: '+1 damage / cannon +2', tempo: '12% faster attacks', standHp: '+10 stand health', vitality: '+1 heart each', swiftness: '8% faster movement', premium: 'Tastier lemonade' };
        for (const [table, buttons, root, kind, names, details] of [
            [APPEARANCE_UPGRADES, this.appearBtns, this.appearTabRoot, 'appear', appearanceNames, appearanceDetails],
            [BOOSTS, this.boostBtns, this.suppliesTabRoot, 'boost', boostNames, boostDetails]
        ]) {
            Object.keys(table).forEach((id, i) => {
                buttons[id] = buy(i, kind, id, names[id], details[id]); root.addChild(buttons[id]);
            });
        }
        this.shopStockText = this.textNode('', 8, 77, 1.5, INK, 'left');
        this.shopStockSugar = this.textNode('', 8, 80, 1.5, INK, 'left');
        this.shopStockLemons = this.textNode('', 34, 77, 1.5, INK, 'left');
        this.restockBtn = this.makeButton({ x: 61, y: 74, w: 33, h: 10, label: 'Restock $8', size: 1.8, fill: GREEN, onClick: id => this.propose(id, 'restock') });
        this.restockBtn.labelNode.node.text.y = 75.3;
        this.restockBtn.addChild(this.textNode('+20 each', 77.5, 80, 1.4, PAPER));
        this.shopStatusText = this.textNode('', 50, 87, 1.4, INK);
        this.bossBtn = this.makeButton({ x: 45, y: 91, w: 49, h: 6, label: '', size: 1.4, fill: ORANGE, onClick: id => this.propose(id, 'boss') });
        this.shopBackBtn = this.makeButton({ x: 6, y: 91, w: 32, h: 6, label: 'Back', size: 1.9, fill: GREEN, onClick: () => this.setShopOpen(false) });
        this.shopRoot.addChildren(
            ...Object.values(this.tabBtns), ...Object.values(this.tabRoots),
            this.panel(6, 74, 52, 10, [239, 224, 190, 255]),
            this.shopStockText, this.shopStockSugar, this.shopStockLemons, this.restockBtn,
            this.shopStatusText, this.shopBackBtn, this.bossBtn
        );
        this.prepRoot.addChildren(
            this.panel(0, 0, 100, 100, PAPER), this.panel(0, 0, 100, 11, GREEN),
            this.prepTitle, this.prepMoneyText, this.recipeRoot, this.shopRoot
        );
        this.applyShopTab();
        this.applyPrepView();
    }

    // The team shares menu navigation, just as it shares the recipe and purchases.
    setShopOpen(open) {
        if (this.phase !== 'prep') return;
        this.shopOpen = open;
        this.applyPrepView();
        this.updatePrepTexts();
        this.notify();
    }

    applyPrepView() {
        if (this.shopOpen) { this.hide(this.recipeRoot); this.show(this.shopRoot); }
        else { this.show(this.recipeRoot); this.hide(this.shopRoot); }
    }

    setShopTab(tab) {
        if (this.phase !== 'prep' || !this.tabRoots[tab] || this.shopTab === tab) return;
        this.shopTab = tab;
        this.applyShopTab();
        this.notify();
    }

    applyShopTab() {
        for (const t in this.tabRoots) {
            if (t === this.shopTab) this.show(this.tabRoots[t]);
            else this.hide(this.tabRoots[t]);
            this.tabBtns[t].node.fill = t === this.shopTab ? GREEN : [232, 217, 178, 255];
            this.tabBtns[t].labelNode.node.text.color = t === this.shopTab ? PAPER : INK;
        }
    }

    buildSales() {
        this.salesRoot = this.container();
        const stand = this.mkSprite('stand', ORANGE), vendor = this.mkSprite('vendor', ORANGE), mug = this.mkSprite('mug', COLORS.GOLD);
        this.placeSprite(stand, 'stand', 39, 41, 27, 21);
        this.placeSprite(vendor, 'vendor', 34, 52, 37, 23);
        this.placeSprite(mug, 'mug', 56, 58, 5, 5);
        this.decorNodes = {
            paint: this.panel(0, 0, 0, 0, ORANGE), sign: this.panel(0, 0, 0, 0, GREEN),
            patio: this.panel(0, 0, 0, 0, [229, 132, 98, 255]), tipjar: this.mkSprite('mug', COLORS.GOLD)
        };
        this.decorSignText = this.textNode('', 52, 40, 1.1, PAPER);
        this.salesTitle = this.textNode('', 50, 3.8, 2.4, PAPER);
        this.salesCupsText = this.textNode('', 5, 12, 1.6, INK, 'left');
        this.salesMoneyText = this.textNode('', 5, 16, 1.6, INK, 'left');
        this.salesRepText = this.textNode('', 5, 20, 1.4, INK, 'left');
        this.salesInvText = this.textNode('', 5, 24, 1.2, INK, 'left');
        this.salesLeftText = this.textNode('', 50, 32, 1.3, INK);
        this.salesGoalText = this.textNode('', 50, 9, 1.3, GREEN);
        this.salesRecipeText = this.textNode('', 50, 28, 1.5, GREEN);
        this.verdictText = this.textNode('', 50, 38, 1.2, INK);
        this.customerThought = this.textNode('', 50, 34.5, 1.2, INK);
        this.customerBody = this.mkSprite('customer', COLORS.CORAL);
        this.hypeBarBg = this.panel(61, 17, 33, 3, [214, 203, 173, 255]);
        this.hypeBarFill = this.panel(0, 0, 0, 0, ORANGE);
        this.hypeLabel = this.textNode('Dance party', 77.5, 12.5, 1.8, GREEN);
        this.pickupNodes = [];
        for (let i = 0; i < TUNING.PICKUPS.max; i++) this.pickupNodes.push(this.mkSprite('mug', COLORS.GOLD));
        this.pickupPopText = this.textNode('', 0, 0, 1.5, GREEN);
        this.rusherNodes = [];
        for (let i = 0; i < MAX_RUSH; i++) this.rusherNodes.push(this.mkSprite('customer', COLORS.WHITE));
        this.salesDancerLayer = this.container(); this.salesInputLayer = this.container();
        this.salesRoot.addChildren(
            this.panel(0, 0, 100, 100, PAPER), this.panel(0, 0, 100, 8, GREEN),
            this.panel(0, 43, 100, 26, [214, 231, 207, 255]), this.panel(0, 73, 100, 27, [235, 212, 174, 255]),
            this.panel(0, 74, 100, 0.4, [192, 164, 131, 255]),
            stand, vendor, this.decorNodes.paint, this.decorNodes.sign, this.decorNodes.patio, this.decorNodes.tipjar, this.decorSignText, mug,
            this.salesTitle, this.salesCupsText, this.salesMoneyText, this.salesRepText, this.salesInvText, this.salesLeftText,
            this.salesGoalText, this.salesRecipeText, this.verdictText, this.customerThought,
            this.hypeBarBg, this.hypeBarFill, this.hypeLabel,
            ...this.pickupNodes, this.pickupPopText, ...this.rusherNodes, this.customerBody,
            this.textNode('WASD / arrows / tap to dance', 50, 95.3, 1.1, INK),
            this.salesDancerLayer, this.salesInputLayer
        );
    }

    buildNightHud() {
        this.nightHudRoot = this.container();
        this.nightTimerText = this.textNode('Dawn in ' + NIGHT_SECONDS + 's', 70, 2.8, 3, COLORS.WHITE);
        this.nightInfoText = this.textNode('', 50, 11.5, 1.8, COLORS.SILVER);
        this.nightStandText = this.textNode('', 50, 7.5, 2.2, COLORS.CORAL);

        // boss health bar (shown only on boss nights)
        this.bossNameText = this.textNode('', 50, 15.2, 1.9, COLORS.SHARP_YELLOW);
        this.bossBarBg = new GameNode.Shape({
            shapeType: Shapes.POLYGON, coordinates2d: this.zeroRect(), fill: [40, 30, 30, 235]
        });
        this.bossBarFill = new GameNode.Shape({
            shapeType: Shapes.POLYGON, coordinates2d: this.zeroRect(), fill: COLORS.CANDY_RED
        });

        // --- fog-of-war minimap (SHARED: fog any player clears is cleared for the team;
        // one set of nodes for everyone keeps the broadcast tree small). Dots are drawn
        // UNDER the opaque fog cells, so unexplored dots are covered automatically. ---
        const MM = TUNING.MINIMAP;
        const mmDot = (fill) => new GameNode.Shape({
            shapeType: Shapes.POLYGON, coordinates2d: this.zeroRect(), fill
        });
        this.mmBg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(MM.x - 0.6, MM.y - 0.6, MM.size + 1.2, MM.size + 1.2),
            fill: [46, 54, 72, 255],            // revealed-ground color
            color: [205, 185, 130, 255], border: 2
        });
        this.mmBaseDot = mmDot(COLORS.GOLD);    // the stand (position never changes)
        this.mmBaseDot.node.coordinates2d = ShapeUtils.rectangle(
            MM.x + (BASE.x / WORLD) * MM.size - 1, MM.y + (BASE.y / WORLD) * MM.size - 1, 2, 2);
        this.mmWellDots = [];
        for (let i = 0; i < TUNING.GATHER.wells; i++) this.mmWellDots.push(mmDot(COLORS.POWDER_BLUE));
        this.mmCaneDots = [];
        for (let i = 0; i < TUNING.GATHER.canes; i++) this.mmCaneDots.push(mmDot(COLORS.CANDY_GREEN));
        this.mmLemonDots = [];
        for (let i = 0; i < MAX_LEMONS; i++) this.mmLemonDots.push(mmDot(COLORS.CANDY_RED));
        this.mmBossDot = mmDot([255, 165, 35, 255]);   // the boss looms large on the map
        this.mmPlayerDots = [];
        for (let i = 0; i < MAX_PLAYERS; i++) this.mmPlayerDots.push(mmDot(COLORS.WHITE));
        // fog cells (drawn last = on top of the dots)
        this.mmFog = [];
        this.mmCells = [];
        this.mmRevealed = [];
        this.mmCellScreen = MM.size / MM.grid;
        const wcs = WORLD / MM.grid;
        for (let gy = 0; gy < MM.grid; gy++) {
            for (let gx = 0; gx < MM.grid; gx++) {
                const sx = MM.x + gx * this.mmCellScreen;
                const sy = MM.y + gy * this.mmCellScreen;
                this.mmCells.push({ sx, sy, cx: (gx + 0.5) * wcs, cy: (gy + 0.5) * wcs });
                this.mmRevealed.push(false);
                this.mmFog.push(new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(sx, sy, this.mmCellScreen, this.mmCellScreen),
                    fill: [13, 15, 24, 255]
                }));
            }
        }

        this.nightHudRoot.addChildren(
            this.panel(0, 0, 100, 14.6, [23, 34, 37, 255]),
            this.textNode('NIGHT', 14, 3, 2.8, COLORS.GOLD),
            this.nightTimerText,
            this.nightInfoText,
            this.nightStandText,
            this.bossBarBg, this.bossBarFill, this.bossNameText,
            this.mmBg,
            this.mmBaseDot,
            ...this.mmWellDots,
            ...this.mmCaneDots,
            ...this.mmLemonDots,
            this.mmBossDot,
            ...this.mmPlayerDots,
            ...this.mmFog
        );
        this.nightHudNodes = [...this.nightHudRoot.node.children];
    }

    // uncover every still-fogged cell whose center is close enough to (wx, wy)
    mmReveal(wx, wy) {
        const r = TUNING.MINIMAP.reveal + (WORLD / TUNING.MINIMAP.grid) * 0.5;
        for (let i = 0; i < this.mmCells.length; i++) {
            if (this.mmRevealed[i]) continue;
            const c = this.mmCells[i];
            if (dist(wx, wy, c.cx, c.cy) < r) {
                this.mmRevealed[i] = true;
                this.mmFog[i].node.coordinates2d = this.zeroRect();
            }
        }
    }

    updateMinimap() {
        const MM = TUNING.MINIMAP;
        const d = MM.dot;
        const place = (n, wx, wy, s) => {
            const sz = s || d;
            n.node.coordinates2d = ShapeUtils.rectangle(
                MM.x + (wx / WORLD) * MM.size - sz / 2, MM.y + (wy / WORLD) * MM.size - sz / 2, sz, sz);
        };
        for (const id in this.players) {
            const p = this.players[id];
            this.mmReveal(p.x, p.y);   // ghosts scout: the dead still clear fog
        }
        for (let i = 0; i < this.wells.length; i++) {
            const wl = this.wells[i];
            this.mmWellDots[i].node.fill = wl.left > 0 ? COLORS.POWDER_BLUE : COLORS.STORM_GRAY;
            place(this.mmWellDots[i], wl.x, wl.y);
        }
        for (let i = 0; i < this.canes.length; i++) {
            const cn = this.canes[i];
            if (cn.hp > 0) place(this.mmCaneDots[i], cn.x, cn.y);
            else this.mmCaneDots[i].node.coordinates2d = this.zeroRect();
        }
        for (let i = 0; i < this.lemons.length; i++) {
            const l = this.lemons[i];
            if (l.active) place(this.mmLemonDots[i], l.x, l.y);
            else this.mmLemonDots[i].node.coordinates2d = this.zeroRect();
        }
        if (this.boss.active) place(this.mmBossDot, this.boss.x, this.boss.y, d * 2.2);
        else this.mmBossDot.node.coordinates2d = this.zeroRect();
        const ids = Object.keys(this.players);
        for (let i = 0; i < this.mmPlayerDots.length; i++) {
            const n = this.mmPlayerDots[i];
            if (i < ids.length) {
                const p = this.players[ids[i]];
                n.node.fill = p.color;
                n.node.color = [255, 255, 255, p.alive ? 255 : 90];   // ghost dots go faint
                place(n, p.x, p.y, d * 1.4);   // players slightly bigger so you can track yourself
            } else {
                n.node.coordinates2d = this.zeroRect();
            }
        }
    }

    buildRecap() {
        this.recapRoot = this.container();
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [24, 28, 44, 255]
        });
        this.recapTitle = this.textNode('', 50, 10, 3.4, COLORS.GOLD);
        this.recapStandText = this.textNode('', 50, 21, 1.6, COLORS.CORAL);
        this.recapLines = [];
        for (let i = 0; i < MAX_PLAYERS; i++) {
            this.recapLines.push(this.textNode('', 50, 30 + i * 6, 1.6, COLORS.WHITE));
        }
        const contBtn = this.makeButton({
            x: 34, y: 72, w: 32, h: 11, label: 'CONTINUE', fill: COLORS.SUCCESS_GREEN, size: 2.4,
            onClick: () => { if (this.phase === 'recap') this.startPrep(this.day + 1); }
        });
        this.recapRoot.addChildren(
            bg,
            this.recapTitle,
            this.recapStandText,
            ...this.recapLines,
            contBtn
        );
    }

    buildGameOver() {
        this.gameOverRoot = this.container();
        const dim = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.ALMOST_BLACK
        });
        this.gameOverStats = this.textNode('', 50, 42, 1.6, COLORS.WHITE);
        this.gameOverSubText = this.textNode('The lemons overran your crew.', 50, 36.5, 1.9, COLORS.SILVER);
        const againBtn = this.makeButton({
            x: 34, y: 56, w: 32, h: 11, label: 'PLAY AGAIN', fill: COLORS.GOLD, size: 2.4,
            labelColor: COLORS.CHARCOAL,
            onClick: () => this.resetGame()
        });
        this.gameOverRoot.addChildren(
            dim,
            this.textNode('GAME OVER', 50, 27, 5, COLORS.CANDY_RED),
            this.gameOverSubText,
            this.gameOverStats,
            againBtn
        );
    }

    // ---------- per-player night view (all nodes created ONCE, mutated in place) ----------

    buildPlayerView(p) {
        const pid = p.id;
        const root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.zeroRect(),
            playerIds: [0]   // hidden until night; setPhase flips to [pid]
        });
        const mk = (fill, extra) => new GameNode.Shape(Object.assign({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.zeroRect(),
            fill
        }, extra || {}));

        const v = { root };
        v.ground = this.panel(0, 0, 100, 100, [34, 49, 48, 255]);
        v.tiles = Array.from({ length: 12 }, () => mk([41, 59, 54, 255]));
        v.baseRing = mk([48, 77, 62, 255], { color: [125, 177, 123, 255], border: 2 });
        v.fenceRing = mk([0, 0, 0, 0], { color: [201, 163, 100, 255], border: 4 });
        v.bossCrown = mk(COLORS.GOLD);
        v.bossDanger = mk([0, 0, 0, 0], { color: [255, 130, 80, 255], border: 3 });
        v.telegraphs = Array.from({ length: MAX_LEMONS }, () => mk([0, 0, 0, 0], { color: [255, 152, 99, 255], border: 2 }));
        const lemonsReady = this.lemonSpritesReady();
        const weaponsReady = this.weaponSpritesReady();
        v.baseNode = this.mkSprite('stand', [146, 92, 44, 255]);
        v.baseSign = mk(v.baseNode._sprite ? [0, 0, 0, 0] : COLORS.WHITE);   // real stand art needs no sign
        v.fencePosts = [];
        for (let i = 0; i < 8; i++) v.fencePosts.push(this.mkSprite('fencePost', [140, 100, 60, 255]));
        v.turretNodes = [];
        for (let i = 0; i < MAX_TURRETS; i++) v.turretNodes.push(this.mkSprite('turret', [90, 100, 115, 255]));
        v.wellNodes = [];
        for (let i = 0; i < TUNING.GATHER.wells; i++) v.wellNodes.push(this.mkSprite('well', COLORS.POWDER_BLUE));
        v.caneNodes = [];
        for (let i = 0; i < TUNING.GATHER.canes; i++) v.caneNodes.push(this.mkSprite('cane', COLORS.CANDY_GREEN));
        v.lemonNodes = [];
        for (let i = 0; i < MAX_LEMONS; i++) v.lemonNodes.push(this.mkSprite('lemonGrunt', COLORS.YELLOW, null, lemonsReady));
        v.bossNode = this.mkSprite('bossLemon', [255, 165, 35, 255]);   // the king himself
        v.lemonBarBg = [];
        v.lemonBarFill = [];
        for (let i = 0; i < MAX_LEMONS; i++) {
            v.lemonBarBg.push(mk([35, 35, 35, 230]));
            v.lemonBarFill.push(mk(COLORS.CANDY_GREEN));
        }
        v.projNodes = [];
        for (let i = 0; i < MAX_PROJ; i++) v.projNodes.push(mk(COLORS.WHITE));
        v.ballNodes = Array.from({ length: MAX_PROJ }, () => this.mkSprite('cannonball', COLORS.GOLD));
        v.eProjNodes = [];
        for (let i = 0; i < MAX_EPROJ; i++) v.eProjNodes.push(mk([255, 140, 80, 255]));
        // fades run through `color` alpha (fill alpha is effectively binary on the client)
        v.fxNodes = [];
        for (let i = 0; i < MAX_FX; i++) v.fxNodes.push(mk([255, 230, 80, 255], { color: [255, 255, 255, 210] }));
        v.otherNodes = Array.from({ length: MAX_PLAYERS - 1 }, () => this.mkSprite('playerChar', COLORS.WHITE));
        v.otherWeapon = Array.from({ length: MAX_PLAYERS - 1 }, () => this.mkSprite('axe', COLORS.WHITE, null, weaponsReady));
        v.atkFlash = mk([255, 250, 190, 255], { color: [255, 255, 255, 90] });      // translucent swing flash
        v.targetDot = mk(COLORS.SILVER);
        v.gatherRing = mk([120, 180, 255, 255], { color: [255, 255, 255, 110] });   // pulsing ring while a well fills you up
        // your own character keeps the colored glow so you can find yourself
        v.avatar = this.mkSprite('playerChar', p.color,
            { effects: { shadow: { color: [p.color[0], p.color[1], p.color[2], 255], blur: 10 } } });
        v.faceDot = mk(v.avatar._sprite ? [255, 255, 255, 140] : COLORS.WHITE);
        v.weaponIcon = this.mkSprite('axe', COLORS.WHITE, null, weaponsReady);
        v.dmgNodes = [];
        for (let i = 0; i < MAX_DMG; i++) v.dmgNodes.push(this.textNode('', 0, 0, 1.6, COLORS.WHITE, 'center', [pid]));

        // World taps move; private dodge/special buttons are placed above this catcher.
        v.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            playerIds: [pid],
            onClick: (playerId, x, y) => this.handleTap(playerId, x, y)
        });

        v.hpText = this.textNode('', 4, 82, 2.5, COLORS.WHITE, 'left', [pid]);
        v.hpBar = mk([144, 222, 162, 255]);
        v.zestBar = mk([255, 203, 82, 255]);
        v.comboText = this.textNode('', 4, 72, 1.5, COLORS.GOLD, 'left', [pid]);
        v.dashBtn = this.makeButton({ x: 32, y: 78, w: 18, h: 11.5, label: '', size: 2.3, fill: GREEN, playerIds: [pid], onClick: id => { if (id === pid) this.dash(id); } });
        v.specialBtn = this.makeButton({ x: 52, y: 78, w: 22, h: 11.5, label: '', size: 2.3, fill: ORANGE, playerIds: [pid], onClick: id => { if (id === pid) this.special(id); } });
        v.zestText = this.textNode('', 53, 92, 1.5, COLORS.GOLD, 'center', [pid]);
        v.carryText = this.textNode('', 4, 94.5, 1.8, COLORS.WHITE, 'left', [pid]);
        v.hintText = this.textNode('', 50, 66, 1.65, COLORS.GOLD, 'center', [pid]);
        v.nameText = this.textNode(p.name, 4, 77, 2, COLORS.WHITE, 'left', [pid]);

        root.addChildren(
            v.ground, ...v.tiles, v.baseRing, v.fenceRing, v.baseNode, v.baseSign,
            ...v.fencePosts,
            ...v.turretNodes,
            ...v.wellNodes,
            ...v.caneNodes,
            ...v.telegraphs, ...v.lemonNodes,
            v.bossDanger, v.bossNode, v.bossCrown,
            ...v.lemonBarBg, ...v.lemonBarFill,
            ...v.projNodes, ...v.ballNodes,
            ...v.eProjNodes,
            ...v.otherNodes, ...v.otherWeapon,
            ...v.fxNodes,
            v.atkFlash, v.targetDot, v.gatherRing, v.avatar, v.faceDot, v.weaponIcon,
            ...v.dmgNodes,
            v.tapCatcher,
            this.panel(1, 75.5, 74.5, 21.2, [23, 34, 37, 255]),
            v.hpText, v.hpBar, v.zestBar, v.carryText, v.hintText, v.nameText, v.comboText, v.dashBtn, v.specialBtn, v.zestText
        );
        v.drawNodes = [...root.node.children];
        return v;
    }

    // ---------- players ----------

    handleNewPlayer({ playerId, info }) {
        if (this.players[playerId] || Object.keys(this.players).length >= MAX_PLAYERS) return;

        // privacy anchor: every player always has at least one scoped node
        const anchor = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.zeroRect(),
            playerIds: [playerId]
        });
        this.anchors[playerId] = anchor;
        this.base.addChild(anchor);

        const color = Colors.randomColor([
            'BLACK', 'ALMOST_BLACK', 'HG_BLACK', 'CHARCOAL', 'GRAY', 'DIM_GRAY', 'BIG_GRAY',
            'BRIGHT_GRAY', 'STANDARD_GRAY', 'SIMPLE_GRAY', 'STORM_GRAY', 'GUN_METAL_GRAY',
            'SMOKE', 'SILVER', 'WHITE', 'ALMOST_WHITE',
            'YELLOW', 'HG_YELLOW', 'SHARP_YELLOW', 'GOLD', 'MUSTARD', 'GOLDMEMBER', 'KHAKI'
        ]);
        const p = {
            id: playerId,
            name: String((info && info.name) || ('PLAYER ' + playerId)).slice(0, 16),
            color,
            x: BASE.x, y: BASE.y,
            hp: this.playerMaxHp(), alive: true,
            carried: { water: 0, sugar: 0, lemons: 0 },
            keys: { up: false, down: false, left: false, right: false },
            target: null,
            faceX: 1, faceY: 0,
            attackCd: 0, invuln: 0, flash: 0, dashCd: 0, dashTicks: 0, dashX: 1, dashY: 0,
            zest: 35, combo: 0, comboTimer: 0, coins: 0, shake: 0, specialFlash: 0, actionKeys: {},
            hintTimer: 0,
            gathering: false, gatherTick: 0,
            dx: 20 + (Object.keys(this.players).length % MAX_PLAYERS) * 18, dy: 80,
            danceTarget: null, danceFrame: 0, danceTick: 0,
            v: null
        };
        p.v = this.buildPlayerView(p);
        // breakdancer for the sales-phase hype minigame (visible to everyone)
        p.dNode = this.mkSprite(DANCER_KEYS[0] || 'dancer1', color, null, this.dancerSpritesReady());
        p.dLabel = this.textNode(p.name, 0, 0, 1.2, COLORS.ALMOST_BLACK);
        this.setText(p.dLabel, '');
        this.salesDancerLayer.addChildren(p.dNode, p.dLabel);
        // per-player tap catcher on the sales screen (tap to send your dancer)
        p.salesCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            playerIds: [playerId],
            onClick: (pid2, x, y) => this.handleSalesTap(pid2, x, y)
        });
        this.salesInputLayer.addChild(p.salesCatcher);
        this.players[playerId] = p;
        this.playerLayer.addChild(p.v.root);
        p.v.root.node.playerIds = (this.phase === 'night') ? [playerId] : [0];
        if (this.phase === 'night') {
            this.setHint(p, 'Auto attack! SPACE: dodge / E: charged move', 4 * TICK);
            this.updatePlayerHud(p);
        }
        if (this.phase === 'sales') this.setText(p.dLabel, p.name);
        this.setText(this.lobbyPlayersText, Object.keys(this.players).length + ' / 6 players');
        if (this.phase === 'prep') this.updatePrepTexts();
        this.notify();
    }

    handlePlayerDisconnect(playerId) {
        const p = this.players[playerId];
        if (!p) return;
        this.playerLayer.removeChild(p.v.root.id);
        this.salesDancerLayer.removeChild(p.dNode.id);
        this.salesDancerLayer.removeChild(p.dLabel.id);
        this.salesInputLayer.removeChild(p.salesCatcher.id);
        delete this.players[playerId];
        const anchor = this.anchors[playerId];
        if (anchor) {
            this.base.removeChild(anchor.id);
            delete this.anchors[playerId];
        }
        delete this.votes[playerId];
        delete this.propVotes[playerId];
        this.setText(this.lobbyPlayersText, Object.keys(this.players).length + ' / 6 players');
        const remaining = Object.keys(this.players);
        if (this.phase === 'prep' && remaining.length > 0) {
            this.checkPurchaseVotes();
            if (Object.keys(this.votes).length >= Math.floor(remaining.length / 2) + 1) {
                this.startSales();
                return;
            }
            this.updatePrepTexts();
        }
        if (this.phase === 'night' && remaining.length > 0) {
            const anyAlive = remaining.some(pid2 => this.players[pid2].alive);
            if (!anyAlive) {
                this.gameOver();
                return;
            }
        }
        this.notify();
    }

    // ---------- input ----------

    handleKeyDown(playerId, key) {
        const p = this.players[playerId];
        if (!p || (this.phase !== 'night' && this.phase !== 'sales')) return;
        key = typeof key === 'string' ? key.toLowerCase() : key;
        if (key === ' ' || key === 'space' || key === 'shift' || key === 'e') {
            if (!p.actionKeys[key]) { p.actionKeys[key] = true; if (key === 'e') this.special(playerId); else this.dash(playerId); }
            return;
        }
        if (key === 'arrowup' || key === 'w') p.keys.up = true;
        else if (key === 'arrowdown' || key === 's') p.keys.down = true;
        else if (key === 'arrowleft' || key === 'a') p.keys.left = true;
        else if (key === 'arrowright' || key === 'd') p.keys.right = true;
        if (p.keys.up || p.keys.down || p.keys.left || p.keys.right) {
            p.target = null;
            p.danceTarget = null;
        }
    }

    handleKeyUp(playerId, key) {
        const p = this.players[playerId];
        if (!p) return;
        key = typeof key === 'string' ? key.toLowerCase() : key;
        delete p.actionKeys[key];
        if (key === 'arrowup' || key === 'w') p.keys.up = false;
        else if (key === 'arrowdown' || key === 's') p.keys.down = false;
        else if (key === 'arrowleft' || key === 'a') p.keys.left = false;
        else if (key === 'arrowright' || key === 'd') p.keys.right = false;
    }

    cameraFor(p) {
        return {
            x: clamp(p.x - VIEW / 2, 0, WORLD - VIEW),
            y: clamp(p.y - VIEW / 2, 0, WORLD - VIEW)
        };
    }

    handleTap(playerId, x, y) {
        const p = this.players[playerId];
        if (!p || this.phase !== 'night') return;   // ghosts steer too - they're the scouts
        const cam = this.cameraFor(p);
        p.target = {
            x: clamp(cam.x + (x / 100) * VIEW, 3, WORLD - 3),
            y: clamp(cam.y + (y / 100) * VIEW, 3, WORLD - 3)
        };
    }

    handleSalesTap(playerId, x, y) {
        const p = this.players[playerId];
        if (!p || this.phase !== 'sales') return;
        p.danceTarget = { x: clamp(x, 5, 95), y: clamp(y, 77, 92) };
    }

    // ---------- prep phase ----------

    startPrep(day, resume = false) {
        this.day = day;
        this.shopOpen = false;
        this.applyPrepView();
        this.votes = {};
        this.proposal = null;
        this.propVotes = {};
        // roll the day's forecast (day 1 is always a plain sunny opener)
        if (!resume) this.weather = day === 1 ? WEATHER[0] : WEATHER[Math.floor(this.random() * WEATHER.length)];
        this.resumeAvailable = false;
        for (const id in this.players) {
            const p = this.players[id];
            p.alive = true;
            p.hp = this.playerMaxHp();
            p.carried = { water: 0, sugar: 0, lemons: 0 }; p.coins = 0;   // unbanked haul is lost at dawn
            this.setHint(p, '', 0);
        }
        this.updatePrepTexts();
        this.setPhase('prep');
        this.checkpoint(captureMorning(this, WEATHER.indexOf(this.weather)));
    }

    adjustRecipe(field, delta) {
        if (this.phase !== 'prep' || !['price', 'sugar', 'lemons'].includes(field)) return;
        if (field === 'price') {
            this.recipe.price = clamp(Math.round((this.recipe.price + delta) * 4) / 4, 0.5, 6);
        } else {
            this.recipe[field] = clamp(this.recipe[field] + delta, 1, 5);
        }
        this.votes = {};   // recipe changed: re-vote
        this.updatePrepTexts();
        this.notify();
    }

    castVote(playerId) {
        if (this.phase !== 'prep' || !this.players[playerId]) return;
        this.votes[playerId] = true;
        const n = Object.keys(this.players).length;
        const need = Math.floor(n / 2) + 1;
        if (Object.keys(this.votes).length >= need) {
            this.startSales();
            return;
        }
        this.updatePrepTexts();
        this.notify();
    }

    // ---------- shop (armory + defense): expensive, voted, run-long ----------

    // Sum every owned appearance upgrade's effects into one modifier bag.
    // Sales logic reads this; new upgrades need no wiring beyond their table entry.
    standMods() {
        const m = { extraCustomers: 0, priceTolerance: 0, repBonus: 0, tipChance: 0, tipMult: 0 };
        for (const uid in this.appearance) {
            if (!this.appearance[uid]) continue;
            const eff = APPEARANCE_UPGRADES[uid].effects;
            for (const k in eff) m[k] = (m[k] || 0) + eff[k];
        }
        return m;
    }

    repairCost() {
        let missing = this.standMax() - this.standHp;
        if (this.fence.level > 0) missing += FENCE_LEVELS[this.fence.level].hp - this.fence.hp;
        return Math.ceil(missing / 2);   // $1 per 2 HP
    }

    purchaseInfo(kind, wid) {
        if (kind === 'restock') return { label: 'PANTRY PARCEL', price: 8, ok: true, blurb: '+20 of every ingredient' };
        if (kind === 'weapon') {
            const w = WEAPONS[wid];
            if (!w || wid === 'hands') return { ok: false, msg: 'Choose a tool' };
            return { label: w.name, price: w.price, blurb: w.blurb, ok: !this.owned[wid] };
        }
        if (kind === 'fence') {
            if (this.fence.level >= 3) return { ok: false, msg: 'The fence is already max level' };
            const lv = this.fence.level + 1;
            return { label: 'FENCE LV' + lv, price: FENCE_LEVELS[lv].price, ok: true };
        }
        if (kind === 'turret') {
            if (this.turrets >= MAX_TURRETS) return { ok: false, msg: 'All turret slots are built' };
            return { label: 'TURRET ' + (this.turrets + 1), price: TURRET_COST, ok: true };
        }
        if (kind === 'appear') {
            const u = APPEARANCE_UPGRADES[wid];
            if (!u) return { ok: false, msg: 'Unknown decoration' };
            if (this.appearance[wid]) return { ok: false, msg: u.name + ' is already installed' };
            return { label: u.name, price: u.price, blurb: u.blurb, ok: true };
        }
        if (kind === 'boost') {
            const b = BOOSTS[wid];
            if (!b) return { ok: false, msg: 'Unknown supply' };
            if (this.boosts[wid] >= 10 || (wid === 'tempo' && this.boosts[wid] >= 5)) return { ok: false, msg: 'That upgrade is maxed' };
            return { label: b.name + ' LV' + (this.boosts[wid] + 1), price: this.boostCost(wid), blurb: b.blurb, ok: true };
        }
        if (kind === 'boss') {
            if (this.bossChallenged) return { ok: false, msg: 'The challenge is set - ' + this.bossName() + ' comes TONIGHT' };
            return { label: 'FIGHT ' + this.bossName(), price: this.bossCost(), blurb: 'the boss storms the map tonight', ok: true };
        }
        if (kind !== 'repair') return { ok: false, msg: 'Unknown purchase' };
        const cost = this.repairCost();
        if (cost <= 0) return { ok: false, msg: 'Nothing needs repairs' };
        return { label: 'REPAIRS', price: cost, ok: true };
    }

    executePurchase(kind, wid) {
        this.playSound('cash');
        if (kind === 'restock') {
            for (const key of ['water', 'sugar', 'lemons']) this.inv[key] += 20;
        } else if (kind === 'weapon') {
            this.owned[wid] = true;
            this.weapon = wid;
        } else if (kind === 'fence') {
            this.fence.level++;
            this.fence.hp = FENCE_LEVELS[this.fence.level].hp;
        } else if (kind === 'turret') {
            this.turrets++;
        } else if (kind === 'appear') {
            this.appearance[wid] = true;
            this.mods = this.standMods();   // effects apply from the next sales phase
        } else if (kind === 'boost') {
            this.boosts[wid]++;
            if (wid === 'standHp') this.standHp += 10;   // the reinforcement is real, not a repair tax
        } else if (kind === 'boss') {
            this.bossChallenged = true;
        } else {   // repair: stand and fence back to full
            this.standHp = this.standMax();
            if (this.fence.level > 0) this.fence.hp = FENCE_LEVELS[this.fence.level].hp;
        }
    }

    propose(playerId, kind, wid) {
        if (this.phase !== 'prep' || !this.players[playerId]) return;
        if (kind === 'weapon' && this.owned[wid]) {
            // already bought: tapping re-equips it for the team (free)
            this.weapon = wid;
            this.proposal = null;
            this.propVotes = {};
            this.updatePrepTexts();
            this.notify();
            return;
        }
        const info = this.purchaseInfo(kind, wid);
        if (!info.ok) {
            this.setText(this.shopStatusText, info.msg || 'Not available');
            this.notify();
            return;
        }
        if (info.price > this.money) {
            this.setText(this.shopStatusText, 'Need $' + (info.price - this.money).toFixed(2) + ' more');
            this.notify();
            return;
        }
        const key = kind + ':' + (wid || '');
        if (!this.proposal || this.proposal.key !== key) {
            this.proposal = { key, kind, wid, label: info.label, blurb: info.blurb };   // switching resets the vote
            this.propVotes = {};
        }
        this.propVotes[playerId] = true;
        this.checkPurchaseVotes();
    }

    checkPurchaseVotes() {
        if (this.proposal) {
            const n = Math.max(1, Object.keys(this.players).length);
            const need = Math.floor(n / 2) + 1;
            if (Object.keys(this.propVotes).length >= need) {
                const info = this.purchaseInfo(this.proposal.kind, this.proposal.wid);
                if (info.ok && info.price <= this.money) {
                    this.money -= info.price;
                    this.executePurchase(this.proposal.kind, this.proposal.wid);
                }
                this.proposal = null;
                this.propVotes = {};
            }
        }
        this.updatePrepTexts();
        this.notify();
    }

    updatePrepTexts() {
        this.setText(this.prepTitle, this.shopOpen ? 'Shop' : 'Day ' + this.day);
        const weatherHints = { SUNNY: 'Sunny', SCORCHER: 'Scorcher / extra tart', GLOOMY: 'Gloomy / extra sweet', 'STREET FAIR': 'Street fair', 'HEALTH CRAZE': 'Health craze / less sugar' };
        this.setText(this.prepWeatherText, weatherHints[this.weather.name] || this.weather.name);
        this.setText(this.prepMoneyText, '$' + this.money.toFixed(2));
        this.setText(this.shopStockText, 'Water ' + this.inv.water);
        this.setText(this.shopStockSugar, 'Sugar ' + this.inv.sugar);
        this.setText(this.shopStockLemons, 'Lemons ' + this.inv.lemons);
        this.setText(this.prepRecipeSugarText, 'Sugar ' + this.recipe.sugar);
        this.setText(this.prepRecipeLemonText, 'Lemons ' + this.recipe.lemons);
        this.setText(this.prepPriceText, '$' + this.recipe.price.toFixed(2) + ' / cup');
        // Price and ownership occupy a consistent place, separate from the item name.
        const card = (btn, price, state) => {
            this.setText(btn.priceNode, state || '$' + price);
            btn.priceNode.node.text.size = state ? 1.35 : 1.7;
            btn.node.fill = state === 'Equipped' ? GREEN : INK;
            btn.priceNode.node.text.color = !state && price > this.money ? [235, 162, 136, 255] : PAPER;
        };
        for (const wid in this.weaponBtns) {
            const btn = this.weaponBtns[wid];
            const w = WEAPONS[wid];
            card(btn, w.price, this.owned[wid] ? (this.weapon === wid ? 'Equipped' : 'Equip') : '');
        }
        const rc = this.repairCost();
        card(this.defBtns.repair, rc, rc <= 0 ? 'Full' : '');
        this.setText(this.defBtns.repair.detailNode, 'Stand ' + this.standHp + '/' + this.standMax());
        card(this.defBtns.fence, this.fence.level < 3 ? FENCE_LEVELS[this.fence.level + 1].price : 0, this.fence.level >= 3 ? 'Max' : '');
        this.setText(this.defBtns.fence.detailNode, this.fence.level ? 'Health ' + this.fence.hp + '/' + FENCE_LEVELS[this.fence.level].hp : 'Blocks lemons');
        card(this.defBtns.turret, TURRET_COST, this.turrets >= MAX_TURRETS ? 'Max' : '');
        this.setText(this.defBtns.turret.detailNode, this.turrets ? 'Auto fire / ' + this.turrets + ' built' : 'Auto fire');
        for (const uid in this.appearBtns) {
            card(this.appearBtns[uid], APPEARANCE_UPGRADES[uid].price, this.appearance[uid] ? 'Owned' : '');
        }
        for (const bid in this.boostBtns) {
            const btn = this.boostBtns[bid], lvl = this.boosts[bid];
            card(btn, this.boostCost(bid), lvl >= (bid === 'tempo' ? 5 : 10) ? 'Max' : '');
            // Levels are useful after purchase; don't clutter the unopened shop with LV0.
            const names = { power: 'Juice power', tempo: 'Quick hands', standHp: 'Tough stand', vitality: 'Extra heart', swiftness: 'Sugar shoes', premium: 'Fancy lemons' };
            this.setText(btn.labelNode, names[bid] + (lvl ? ' ' + lvl : ''));
        }
        this.setText(this.bossBtn.labelNode, this.bossChallenged
            ? 'Boss tonight!'
            : 'Boss $' + this.bossCost() + ' / win $' + this.bossReward());
        let ws = '';
        if (this.proposal) {
            const wn = Math.max(1, Object.keys(this.players).length);
            const wneed = Math.floor(wn / 2) + 1;
            ws = this.proposal.label + ' / votes ' + Object.keys(this.propVotes).length + '/' + wneed;
        }
        this.setText(this.shopStatusText, ws);
        const cups = Math.floor(Math.min(this.inv.water, this.inv.sugar / this.recipe.sugar, this.inv.lemons / this.recipe.lemons));
        this.setText(this.prepCapacity, cups ? cups + ' cups ready' : 'Out of ingredients');
        this.prepCapacity.node.text.color = cups ? GREEN : ORANGE;
        const n = Math.max(1, Object.keys(this.players).length);
        const need = Math.floor(n / 2) + 1;
        this.setText(this.voteText, n > 1 ? 'Ready ' + Object.keys(this.votes).length + '/' + need : '');
    }

    // ---------- sales phase ----------

    startSales() {
        this.cupsToday = 0;
        this.dayStats = { revenue: 0, tips: 0, refused: 0, happy: 0, rushes: 0, bonus: 0 };
        this.dayGoal = this.makeDayGoal();
        this.mods = this.standMods();
        this.customersLeft = Math.max(3, Math.round(clamp(
            TUNING.CUSTOMERS.base + (this.day - 1) * TUNING.CUSTOMERS.perDay + Math.floor(this.rep / TUNING.CUSTOMERS.repDivisor),
            TUNING.CUSTOMERS.min, TUNING.CUSTOMERS.max) * this.weather.custMult)) + this.mods.extraCustomers;
        this.updateDecor();
        this.customer = null;
        this.dayEndTimer = 0;
        this.hype = 0;
        this.rushActive = false;
        this.rushSold = 0;
        for (const r of this.rushers) r.active = false;
        for (const pk of this.pickups) pk.active = false;
        for (const n of this.pickupNodes) this.hideSprite(n);
        this.pickupCd = TUNING.PICKUPS.spawnTicks;
        this.pickupPopTtl = 0;
        this.setText(this.pickupPopText, '');
        const ids = Object.keys(this.players);
        for (let i = 0; i < ids.length; i++) {
            const p = this.players[ids[i]];
            p.dx = 12 + i * 76 / Math.max(1, ids.length - 1);
            p.dy = 80;
            p.danceTarget = null;
            p.danceFrame = 0;
            p.danceTick = 0;
            p.keys = { up: false, down: false, left: false, right: false };
            this.setText(p.dLabel, p.name);
        }
        this.setText(this.verdictText, '');
        this.updateSalesTexts();
        this.setPhase('sales');
    }

    updateSalesTexts() {
        this.setText(this.salesTitle, 'Day ' + this.day + ' / Open');
        this.setText(this.salesCupsText, this.cupsToday + ' cups sold');
        this.setText(this.salesMoneyText, '$' + this.money.toFixed(2));
        this.setText(this.salesRepText, 'Reputation ' + this.rep + '/100');
        this.setText(this.salesInvText, 'W ' + this.inv.water + ' / S ' + this.inv.sugar + ' / L ' + this.inv.lemons);
        this.setText(this.salesLeftText, this.customersLeft + ' customers left');
        this.setText(this.salesRecipeText, this.recipeName() + ' / $' + this.recipe.price.toFixed(2));
        if (this.dayGoal) {
            const g = this.dayGoal, progress = g.kind === 'cups' ? this.cupsToday : this.dayStats[g.kind];
            const goal = { cups: 'Cups', happy: 'Happy customers', rushes: 'Dance parties' }[g.kind];
            this.setText(this.salesGoalText, g.paid ? 'Bonus! +$' + g.reward : goal + ' ' + progress + '/' + g.target + ' / +$' + g.reward);
        }
    }

    // position (or hide) the stand decor for each owned appearance upgrade.
    // A new upgrade with a visual gets its node in buildSales and a line here.
    updateDecor() {
        const d = this.decorNodes;
        d.paint.node.coordinates2d = this.appearance.paint ? ShapeUtils.rectangle(38, 57, 28, 2) : this.zeroRect();
        d.sign.node.coordinates2d = this.appearance.sign ? ShapeUtils.rectangle(37, 39, 30, 4) : this.zeroRect();
        this.setText(this.decorSignText, this.appearance.sign ? 'SIP SIP HOORAY!' : '');
        d.patio.node.coordinates2d = this.appearance.patio ? [[76, 46], [87, 57], [65, 57], [76, 46], [76, 69], [77, 69], [77, 46]] : this.zeroRect();
        if (this.appearance.tipjar) this.placeSprite(d.tipjar, 'mug', 42, 60, 5, 5); else this.hideSprite(d.tipjar);
    }

    salesTick() {
        if (!this.customer) {
            if (this.customersLeft > 0) {
                this.customersLeft--;
                this.customer = Object.assign(this.makeCustomer(), { x: 2, state: 'in', timer: 0 });
                this.setText(this.customerThought, this.customer.want);
                if (!this.customerBody._sprite) {
                    this.customerBody.node.fill = Colors.randomColor(
                        ['SKY_BLUE', 'WALLPAPER_GREEN', 'WHITE', 'ALMOST_WHITE', 'CREAM']
                    );
                }
                this.setText(this.verdictText, '');
                this.updateSalesTexts();
            } else {
                this.dayEndTimer++;
                if (this.dayEndTimer >= TUNING.SALES_END_DELAY_TICKS && !this.rushActive) {   // let a late rush finish
                    this.closeShop();
                    return;
                }
            }
        } else {
            const c = this.customer;
            if (c.state === 'in') {
                c.x += 1.1;
                if (c.x >= 30) { c.x = 30; c.state = 'decide'; c.timer = TUNING.CUSTOMERS.decideTicks; }
            } else if (c.state === 'decide') {
                c.timer--;
                if (c.timer <= 0) {
                    this.resolveCustomer(c);
                    c.state = 'out';
                }
            } else {
                c.x += 1.3;
                if (c.x >= 112) this.customer = null;
            }
        }
        // negative coordinates pin to the plane edge on the wire, so keep the
        // customer hidden until they're far enough in to draw cleanly
        if (this.customer && this.customer.x >= 4) {
            if (this.customerBody._sprite) this.placeSprite(this.customerBody, 'customer', this.customer.x - 4, 55, 8, 14);
            else this.customerBody.node.coordinates2d = polyCircle(this.customer.x, 66.5, 3.5);
        } else {
            this.hideSprite(this.customerBody);
        }

        // sales minigame (SEAM: currently breakdance hype. To swap in a different
        // minigame later, branch here + in handleSalesTap; hype/rush stay generic)
        this.updateSalesMinigame();
        if (this.hype >= HYPE_MAX && !this.rushActive) this.startRush();
        if (this.rushActive) this.updateRush();
        this.hypeBarFill.node.coordinates2d =
            ShapeUtils.rectangle(61, 17, 33 * (this.hype / HYPE_MAX), 3);

        this.notify();
    }

    resolveCustomer(c) {
        const sale = this.sellCup(c, false);
        this.setText(this.verdictText, sale.message);
        this.updateSalesTexts();
    }

    // ---------- sales minigame: breakdance hype (swap point for future minigames) ----------

    updateSalesMinigame() {
        this.updateDancers();
        this.updatePickups();
    }

    updateDancers() {
        for (const id in this.players) {
            const p = this.players[id];

            // movement: keys > tap target
            let dx = 0;
            let dy = 0;
            if (p.keys.up) dy -= 1;
            if (p.keys.down) dy += 1;
            if (p.keys.left) dx -= 1;
            if (p.keys.right) dx += 1;
            let moved = false;
            const DSPEED = TUNING.PLAYER.danceSpeed;
            const oldX = p.dx, oldY = p.dy;
            if (dx !== 0 || dy !== 0) {
                const m = Math.hypot(dx, dy);
                p.dx += (dx / m) * DSPEED;
                p.dy += (dy / m) * DSPEED;
                p.danceTarget = null;
                moved = true;
            } else if (p.danceTarget) {
                const d = dist(p.dx, p.dy, p.danceTarget.x, p.danceTarget.y);
                if (d < 1) {
                    p.danceTarget = null;
                } else {
                    const step = Math.min(DSPEED, d);
                    p.dx += ((p.danceTarget.x - p.dx) / d) * step;
                    p.dy += ((p.danceTarget.y - p.dy) / d) * step;
                    moved = true;
                }
            }
            p.dx = clamp(p.dx, 5, 95);
            p.dy = clamp(p.dy, 77, 92);

            moved = dist(oldX, oldY, p.dx, p.dy) > 0.01;
            // Hype comes from real travel, not holding a key against the boundary.
            this.hype = Math.min(HYPE_MAX, this.hype + (moved ? HYPE_MOVE_GAIN : HYPE_IDLE_GAIN) / Math.sqrt(Math.max(1, Object.keys(this.players).length)));

            // animation: cycle dance frames (double speed while moving)
            p.danceTick += moved ? 2 : 1;
            if (p.danceTick >= 8) {
                p.danceTick = 0;
                // sprite dancers cycle every registered frame; shape dancers have 3 poses
                const frames = p.dNode._sprite ? DANCER_KEYS.length : 3;
                p.danceFrame = (p.danceFrame + 1) % frames;
            }

            // draw the dancer: sprite frames, or a wobbling colored shape
            if (p.dNode._sprite) {
                this.placeSprite(p.dNode, DANCER_KEYS[p.danceFrame], p.dx - 4.5, p.dy - 5, 9, 11);
            } else {
                // three shape "poses": tall / wide / tilted hop
                const f = p.danceFrame % 3;
                const w = f === 1 ? 6.5 : 4.5;
                const h = f === 1 ? 4.5 : 6.5;
                const ox = f === 2 ? 1.4 : 0;
                const oy = f === 2 ? -1.4 : 0;
                p.dNode.node.coordinates2d = ShapeUtils.rectangle(p.dx - w / 2 + ox, p.dy - h / 2 + oy, w, h);
            }
            p.dLabel.node.text = Object.assign({}, p.dLabel.node.text, {
                text: p.name, x: p.dx, y: p.dy - 8.4
            });
        }
    }

    // Little lemonade mugs appear on the dance floor; dance over one for bonus hype.
    updatePickups() {
        const P = TUNING.PICKUPS;
        if (this.pickupCd > 0) {
            this.pickupCd--;
        } else {
            for (const pk of this.pickups) {
                if (pk.active) continue;
                pk.active = true;
                pk.x = 8 + this.random() * 84;    // anywhere on the dance floor
                pk.y = 78 + this.random() * 13;   // (inside the dancer clamp bounds)
                pk.ttl = P.lifeTicks;
                break;
            }
            this.pickupCd = P.spawnTicks + Math.floor(this.random() * P.jitter);
        }

        for (const pk of this.pickups) {
            if (!pk.active) continue;
            pk.ttl--;
            if (pk.ttl <= 0) {
                pk.active = false;
                continue;
            }
            for (const id in this.players) {
                const p = this.players[id];
                if (dist(p.dx, p.dy, pk.x, pk.y) < P.radius) {
                    pk.active = false;
                    this.hype = Math.min(HYPE_MAX, this.hype + P.bonus);
                    this.pickupPopTtl = 20;
                    this.pickupPopText.node.text = Object.assign({}, this.pickupPopText.node.text,
                        { text: '+' + P.bonus + ' HYPE!', x: clamp(pk.x, 8, 92), y: pk.y - 6 });
                    break;
                }
            }
        }
        if (this.pickupPopTtl > 0) {
            this.pickupPopTtl--;
            if (this.pickupPopTtl === 0) this.setText(this.pickupPopText, '');
        }

        // draw: gentle pulse so they read as collectible
        for (let i = 0; i < this.pickups.length; i++) {
            const pk = this.pickups[i];
            const n = this.pickupNodes[i];
            if (!pk.active) {
                this.hideSprite(n);
                continue;
            }
            const s = 4.8 + Math.sin(this._t * 0.4) * 0.5;
            if (n._sprite) {
                this.placeSprite(n, 'mug', pk.x - s / 2, pk.y - s / 2, s, s);
            } else {
                // gold diamond
                n.node.coordinates2d = [
                    [pk.x, pk.y - s / 2], [pk.x + s / 2, pk.y],
                    [pk.x, pk.y + s / 2], [pk.x - s / 2, pk.y],
                    [pk.x, pk.y - s / 2]
                ];
            }
        }
    }

    startRush() {
        this.rushActive = true;
        this.dayStats.rushes++;
        this.checkDayGoal();
        this.playSound('zest');
        this.rushSold = 0;
        this.hype = 0;
        const n = Math.min(MAX_RUSH, TUNING.HYPE.rushBase + Object.keys(this.players).length * TUNING.HYPE.rushPerPlayer);
        for (let i = 0; i < this.rushers.length; i++) {
            const r = this.rushers[i];
            r.active = i < n;
            if (!r.active) continue;
            r.x = -4 - i * 7;                       // staggered crowd (hidden until on-plane)
            r.y = 62 + (i % 3) * 3;
            r.speed = 1.2 + this.random() * 0.7;
            Object.assign(r, this.makeCustomer());
            r.resolved = false;
        }
        this.setText(this.verdictText, 'THE HYPE IS REAL - CUSTOMER RUSH!');
    }

    updateRush() {
        let anyActive = false;
        for (const r of this.rushers) {
            if (!r.active) continue;
            r.x += r.speed;
            // rushed-up customers buy on the way past the stand (hyped = easygoing)
            if (!r.resolved && r.x >= 31) {
                r.resolved = true;
                const sale = this.sellCup(r, true);
                if (sale.sold) this.rushSold++;
            }
            if (r.x > 112) {
                r.active = false;
                continue;
            }
            anyActive = true;
        }
        if (!anyActive) {
            this.rushActive = false;
            this.setText(this.verdictText, this.rushSold > 0
                ? 'The rush bought ' + this.rushSold + ' cups!'
                : 'The rush strolled by... tune that recipe!');
            this.updateSalesTexts();
        }
        // draw the crowd (off-plane left would pin to the edge, so hide until x >= 4)
        for (let i = 0; i < this.rushers.length; i++) {
            const r = this.rushers[i];
            const n = this.rusherNodes[i];
            if (!r.active || r.x < 4) {
                this.hideSprite(n);
                continue;
            }
            if (n._sprite) this.placeSprite(n, 'customer', r.x - 3.5, r.y - 7, 7, 13);
            else n.node.coordinates2d = polyCircle(r.x, r.y + 1, 3);
        }
        if (this.rushActive || this.rushSold > 0) this.updateSalesTexts();
    }

    // ---------- night phase ----------

    randSpot() {
        const a = this.random() * Math.PI * 2, r = 21 + this.random() * 28;
        return { x: BASE.x + Math.cos(a) * r, y: BASE.y + Math.sin(a) * r };
    }

    startNight() {
        this.nightLeft = NIGHT_SECONDS * TICK;
        this.nightGoal = { banked: 0, target: 24 + Math.max(0, Object.keys(this.players).length - 1) * 12, paid: false };
        this.lastSecond = -1;
        this.spawnCd = TUNING.LEMONS.firstSpawnDelay;
        this.wells = [];
        this.canes = [];
        for (let i = 0; i < TUNING.GATHER.wells; i++) this.wells.push(Object.assign(this.randSpot(), { left: TUNING.GATHER.wellWater }));
        for (let i = 0; i < TUNING.GATHER.canes; i++) this.canes.push(Object.assign(this.randSpot(), { hp: TUNING.GATHER.caneHp }));
        for (const l of this.lemons) l.active = false;
        for (const pr of this.projectiles) pr.active = false;
        for (const e of this.eProj) e.active = false;
        for (const f of this.fx) f.active = false;
        for (const d of this.dmgTexts) d.active = false;
        this.turretCds = [0, 0, 0, 0];
        this.standFlash = 0;
        this.fenceFlash = 0;
        this.nightStats = { kills: {}, banked: {}, standDmg: 0, fenceDmg: 0 };
        // fresh fog each night: re-cover every cell, then reveal home base
        for (let i = 0; i < this.mmFog.length; i++) {
            this.mmRevealed[i] = false;
            const c = this.mmCells[i];
            this.mmFog[i].node.coordinates2d =
                ShapeUtils.rectangle(c.sx, c.sy, this.mmCellScreen, this.mmCellScreen);
        }
        this.mmReveal(BASE.x, BASE.y);
        // boss night? consume the challenge and put the king on the field
        this.bossNight = false;
        this.boss.active = false;
        if (this.bossChallenged) {
            this.bossChallenged = false;
            this.bossNight = true;
            const b = this.boss;
            b.active = true;
            const side = Math.floor(this.random() * 4);
            if (side === 0) { b.x = 8; b.y = 20 + this.random() * (WORLD - 40); }
            else if (side === 1) { b.x = WORLD - 8; b.y = 20 + this.random() * (WORLD - 40); }
            else if (side === 2) { b.y = 8; b.x = 20 + this.random() * (WORLD - 40); }
            else { b.y = WORLD - 8; b.x = 20 + this.random() * (WORLD - 40); }
            b.x = BASE.x; b.y = BASE.y - 44;
            b.maxHp = Math.round(TUNING.BOSS.hp * Math.pow(TUNING.BOSS.hpGrowth, this.era - 1) * (1 + (Object.keys(this.players).length - 1) * 0.45));
            b.hp = b.maxHp;
            b.windup = 0;
            b.wtgt = 'p';
            b.cd = 30;
            b.summonCd = TUNING.BOSS.summonTicks;
            this.setText(this.bossNameText, this.bossName());
            this.bossBarBg.node.coordinates2d = ShapeUtils.rectangle(20, 17.6, 60, 2.2);
        } else {
            this.setText(this.bossNameText, '');
            this.bossBarBg.node.coordinates2d = this.zeroRect();
            this.bossBarFill.node.coordinates2d = this.zeroRect();
        }
        // lemons toughen with the days; DIFFICULTY multiplies the result
        this.lemonHp = Math.max(1, Math.round(
            Math.min(TUNING.LEMONS.hpMax, TUNING.LEMONS.baseHp + Math.floor((this.day - 1) / TUNING.LEMONS.hpGrowthDays)) * this.diff()));
        this.setText(this.nightInfoText,
            WEAPONS[this.weapon].name + ' / bank ' + this.nightGoal.target + ' water + sugar / bonus $12');
        this.updateStandHud();

        const ids = Object.keys(this.players);
        for (let i = 0; i < ids.length; i++) {
            const p = this.players[ids[i]];
            const a = (i / Math.max(1, ids.length)) * Math.PI * 2;
            p.x = BASE.x + Math.cos(a) * 5;
            p.y = BASE.y + Math.sin(a) * 5;
            p.alive = true;
            p.hp = this.playerMaxHp();
            p.carried = { water: 0, sugar: 0, lemons: 0 };
            p.target = null;
            p.attackCd = 0;
            p.dashCd = 0; p.dashTicks = 0; p.zest = 35; p.coins = 0; p.combo = 0; p.comboTimer = 0; p.actionKeys = {};
            p.invuln = 0;
            p.flash = 0;
            p.gathering = false;
            p.gatherTick = 0;
            p.keys = { up: false, down: false, left: false, right: false };
            this.setHint(p, 'Auto attack! SPACE: dodge / E: charged move', 4 * TICK);
            this.updatePlayerHud(p);
        }
        this.updateMinimap();
        this.renderNight();
        this.setPhase('night');
    }

    setHint(p, str, ticks) {
        p.hintTimer = ticks;
        this.setText(p.v.hintText, str);
    }

    updatePlayerHud(p) {
        this.setText(p.v.carryText, 'BAG  W:' + p.carried.water + '  S:' + p.carried.sugar + '  L:' + p.carried.lemons + '  $' + (p.coins || 0));
        this.setText(p.v.hpText, p.alive ? 'HP ' + p.hp + '/' + this.playerMaxHp() : 'GHOST');
        p.v.hpBar.node.coordinates2d = ShapeUtils.rectangle(4, 87, 24 * Math.max(0, p.hp / this.playerMaxHp()), 2.5);
        p.v.zestBar.node.coordinates2d = ShapeUtils.rectangle(32, 90.2, 42 * p.zest / 100, 1.2);
        this.setText(p.v.dashBtn.labelNode, p.dashCd > 0 ? (p.dashCd / TICK).toFixed(1) + 's' : 'Dodge');
        p.v.dashBtn.node.fill = p.dashCd > 0 || !p.alive ? INK : GREEN;
        this.setText(p.v.specialBtn.labelNode, p.zest >= 100 ? 'Unleash!' : Math.floor(p.zest) + '%');
        p.v.specialBtn.node.fill = p.zest >= 100 && p.alive ? ORANGE : INK;
        this.setText(p.v.zestText, WEAPONS[this.weapon].special);
        this.setText(p.v.comboText, p.combo >= 3 ? p.combo + ' SQUEEZED / +' + Math.min(3, Math.floor(p.combo / 3)) + ' lemons per KO' : '');
    }

    updateStandHud() {
        let s = 'STAND ' + this.standHp + '/' + this.standMax();
        if (this.fence.level > 0) s += '   FENCE LV' + this.fence.level + ' ' + this.fence.hp + '/' + FENCE_LEVELS[this.fence.level].hp;
        if (this.turrets > 0) s += '   TURRETS ' + this.turrets;
        this.setText(this.nightStandText, s);
    }

    dawn() {
        this.showRecap();
    }

    showRecap() {
        if (this.bossNight && this.boss.active) {
            // dawn saved you - and cost you the challenge fee
            this.setText(this.recapTitle, this.bossName() + ' RETREATS AT DAWN...');
            this.boss.active = false;
            this.bossNight = false;
        } else {
            this.setText(this.recapTitle, 'DAWN RISES - DAY ' + this.day + ' SURVIVED');
        }
        this.setText(this.recapStandText,
            'Stand damage: ' + this.nightStats.standDmg + ' / bounties banked: $' + (this.nightStats.cash || 0) +
            (this.nightGoal.paid ? ' / delivery bonus +$12' : ''));
        const ids = Object.keys(this.players);
        for (let i = 0; i < this.recapLines.length; i++) {
            if (i < ids.length) {
                const p = this.players[ids[i]];
                const k = this.nightStats.kills[p.id] || 0;
                const b = this.nightStats.banked[p.id] || 0;
                this.setText(this.recapLines[i],
                    p.name + ' - ' + k + (k === 1 ? ' lemon' : ' lemons') + ' slain - ' + b + ' banked' + (p.alive ? '' : ' - K.O.'));
            } else {
                this.setText(this.recapLines[i], '');
            }
        }
        this.recapTimer = TUNING.RECAP_SECONDS * TICK;
        this.setPhase('recap');
    }

    buildVictory() {
        this.victoryRoot = this.container();
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [36, 26, 10, 255]
        });
        this.victoryDefeatText = this.textNode('', 50, 20, 3.2, COLORS.GOLD);
        this.victoryNextName = this.textNode('', 50, 46, 3.6, COLORS.CANDY_RED);
        this.victoryStatsText = this.textNode('', 50, 60, 1.5, COLORS.SILVER);
        const contBtn = this.makeButton({
            x: 32, y: 68, w: 36, h: 11, label: 'THE FIGHT CONTINUES', fill: COLORS.GOLD, size: 2,
            labelColor: COLORS.CHARCOAL,
            onClick: () => this.advanceEra()
        });
        this.victoryRoot.addChildren(
            bg,
            this.textNode('VICTORY!', 50, 10, 5, COLORS.SHARP_YELLOW),
            this.victoryDefeatText,
            this.textNode('...but the whole time, he was reporting to', 50, 39, 1.9, COLORS.WHITE),
            this.victoryNextName,
            this.textNode('and HIS army of lemons is riper and angrier.', 50, 52.5, 1.9, COLORS.WHITE),
            this.victoryStatsText,
            contBtn,
            this.textNode('(continues automatically)', 50, 93, 1.4, COLORS.SILVER)
        );
    }

    onBossDefeated() {
        this.stats.bossKills++;
        const reward = this.bossReward();
        this.money += reward;
        this.boosts.power = Math.min(10, this.boosts.power + 1);
        this.playSound('zest');
        for (const id in this.players) this.bank(this.players[id]);
        // dawn comes early - everyone's haul is banked in the celebration
        for (const id in this.players) {
            const p = this.players[id];
            const c = p.carried;
            if (c.water + c.sugar + c.lemons > 0) {
                this.inv.water += c.water;
                this.inv.sugar += c.sugar;
                this.inv.lemons += c.lemons;
                this.nightStats.banked[p.id] = (this.nightStats.banked[p.id] || 0) + c.water + c.sugar + c.lemons;
                p.carried = { water: 0, sugar: 0, lemons: 0 };
            }
        }
        this.setText(this.victoryDefeatText, this.bossName() + ' IS DEFEATED!');
        this.setText(this.victoryNextName, this.bossName(this.era + 1));
        this.setText(this.victoryStatsText,
            'Dynasty ' + this.era + ' toppled on day ' + this.day + ' / $' + reward + ' bounty / +1 JUICE POWER');
        this.victoryTimer = TUNING.RECAP_SECONDS * TICK;
        this.bossNight = false;
        this.setPhase('victory');
    }

    advanceEra() {
        if (this.phase !== 'victory') return;
        this.era++;
        this.startPrep(this.day + 1);
    }

    gameOver(cause) {
        this.setText(this.gameOverSubText, cause === 'stand'
            ? 'Your lemonade stand was destroyed!'
            : 'The lemons overran your crew.');
        this.setText(this.gameOverStats,
            'Survived ' + this.day + (this.day === 1 ? ' day' : ' days') +
            ' - ' + this.stats.bossKills + (this.stats.bossKills === 1 ? ' boss' : ' bosses') + ' toppled' +
            ' - $' + this.money.toFixed(2) + ' in wallet - ' + this.stats.cupsTotal + ' cups sold');
        this.setPhase('gameover');
        this.checkpoint(endRun());
    }

    resetGame(confirmedNewRun = false) {
        if (this.phase !== 'gameover' && !(confirmedNewRun && this.phase === 'lobby')) return;
        this.money = TUNING.START.money;
        this.rep = TUNING.START.rep;
        this.day = 1;
        this.inv = Object.assign({}, TUNING.START.inv);
        this.recipe = { sugar: 3, lemons: 3, price: 2 };
        this.stats.cupsTotal = 0;
        this.weapon = 'hands';
        this.owned = { axe: false, bow: false, cannon: false };
        this.appearance = {};
        this.boosts = { power: 0, tempo: 0, standHp: 0, vitality: 0, swiftness: 0, premium: 0 };
        this.mods = this.standMods();
        this.era = 1;
        this.bossChallenged = false;
        this.bossNight = false;
        this.boss.active = false;
        this.stats.bossKills = 0;
        this.weather = WEATHER[0];
        this.proposal = null;
        this.propVotes = {};
        this.standHp = STAND_MAX;
        this.fence = { level: 0, hp: 0 };
        this.turrets = 0;
        this.turretCds = [0, 0, 0, 0];
        for (const id in this.players) {
            const p = this.players[id];
            p.hp = this.playerMaxHp();
            p.alive = true;
            p.carried = { water: 0, sugar: 0, lemons: 0 };
        }
        this.startPrep(1);
    }

    spawnLemons() {
        if (this.spawnCd > 0) {
            this.spawnCd--;
            return;
        }
        const cap = Math.min(MAX_LEMONS, Math.round(
            (TUNING.LEMONS.capBase + this.day * TUNING.LEMONS.capPerDay
                + Object.keys(this.players).length * TUNING.LEMONS.capPerPlayer) * this.diff()));
        let active = 0;
        for (const l of this.lemons) if (l.active) active++;
        if (active >= cap) return;
        let slot = null;
        for (const l of this.lemons) {
            if (!l.active) { slot = l; break; }
        }
        if (!slot) return;
        const living = Object.values(this.players).filter(p => p.alive);
        const focus = living[Math.floor(this.random() * living.length)] || BASE;
        let found = false;
        for (let attempt = 0; attempt < 20; attempt++) {
            const angle = this.random() * Math.PI * 2;
            const radius = 37 + this.random() * 8;
            slot.x = clamp(focus.x + Math.cos(angle) * radius, 5, WORLD - 5);
            slot.y = clamp(focus.y + Math.sin(angle) * radius, 5, WORLD - 5);
            if (living.every(p => dist(p.x, p.y, slot.x, slot.y) >= 26) && dist(slot.x, slot.y, BASE.x, BASE.y) > 24) { found = true; break; }
        }
        if (!found) { this.spawnCd = 5; return; }
        slot.stun = 0; slot.kx = 0; slot.ky = 0; slot.hitFlash = 0; slot.spawnWarmup = 14;
        slot.active = true;
        const pool = ['grunt', 'grunt'];
        if (this.day >= TUNING.LEMONS.jumperDay) pool.push('jumper');
        if (this.day >= TUNING.LEMONS.spitterDay) pool.push('spitter');
        if (this.day >= TUNING.LEMONS.bruteDay) pool.push('brute', 'jumper', 'spitter');
        slot.type = pool[Math.floor(this.random() * pool.length)];
        slot.hp = slot.type === 'brute' ? this.lemonHp * 2 + 1 : this.lemonHp;
        slot.maxHp = slot.hp;
        slot.state = 'wander';
        slot.windup = 0;
        slot.wtgt = 'p';
        slot.cd = 0;
        slot.angle = this.random() * Math.PI * 2;
        slot.hopping = 0;
        slot.hopT = 10;
        slot.hdx = 0;
        slot.hdy = 0;
        this.spawnCd = Math.max(8, Math.round(
            Math.max(TUNING.LEMONS.spawnCdMin, (TUNING.LEMONS.spawnCdBase - this.day * TUNING.LEMONS.spawnCdPerDay - Math.floor((NIGHT_SECONDS * TICK - this.nightLeft) / 400) * 5) / this.diff()) / Math.sqrt(Math.max(1, living.length))));
    }

    updateLemons() {
        const fenceUp = this.fence.level > 0 && this.fence.hp > 0;
        const guardR = fenceUp ? FENCE_R : BASE.r;
        for (const l of this.lemons) {
            if (!l.active) continue;
            const T = LEMON_TYPES[l.type];
            if (l.cd > 0) l.cd--;
            if (l.hitFlash > 0) l.hitFlash--;
            if (l.spawnWarmup > 0) { l.spawnWarmup--; continue; }
            if (l.stun > 0) {
                l.stun--; l.x = clamp(l.x + (l.kx || 0), 4, WORLD - 4); l.y = clamp(l.y + (l.ky || 0), 4, WORLD - 4);
                l.kx *= 0.65; l.ky *= 0.65; continue;
            }

            let best = null;
            let bd = 1e9;
            for (const id in this.players) {
                const p = this.players[id];
                if (!p.alive) continue;
                const d = dist(l.x, l.y, p.x, p.y);
                if (d < bd) { bd = d; best = p; }
            }
            const ds = dist(l.x, l.y, BASE.x, BASE.y);

            // pick a target: a player or the stand itself
            let tgt;
            if (l.type === 'spitter') {
                tgt = best ? { kind: 'p', x: best.x, y: best.y } : { kind: 's', x: BASE.x, y: BASE.y };
            } else if (l.type === 'brute') {
                // brutes beeline the stand unless a player is right in their face
                tgt = (best && bd < 10) ? { kind: 'p', x: best.x, y: best.y } : { kind: 's', x: BASE.x, y: BASE.y };
            } else if (best && (bd < 42 || bd <= ds)) {
                tgt = { kind: 'p', x: best.x, y: best.y };
            } else {
                tgt = { kind: 's', x: BASE.x, y: BASE.y };
            }
            const structReach = guardR + 3.5;

            if (l.state === 'windup') {
                // telegraph: stands still, flashes; players can dodge or interrupt
                if (l.wtgt === 'p' && (!best || bd > 8)) {
                    l.state = 'wander';
                    l.windup = 0;
                    continue;
                }
                l.windup--;
                if (l.windup <= 0) {
                    if (l.wtgt === 's') {
                        if (ds < structReach + 2.5) this.damageStructure(T.sdmg, l.x, l.y);
                        l.cd = 46;
                    } else if (l.type === 'spitter') {
                        if (best) this.fireEProj(l, best);
                        l.cd = 60;
                    } else {
                        if (best && bd < 5.8 && best.invuln <= 0) this.damagePlayer(best, T.dmg);
                        l.cd = 42;
                    }
                    l.state = 'wander';
                }
                continue;
            }

            // begin an attack windup
            if (l.cd <= 0) {
                if (tgt.kind === 's' && ds < structReach) {
                    l.state = 'windup'; l.windup = T.windup; l.wtgt = 's';
                    continue;
                }
                if (tgt.kind === 'p' && l.type === 'spitter' && bd < 26) {
                    l.state = 'windup'; l.windup = T.windup; l.wtgt = 'r';
                    continue;
                }
                if (tgt.kind === 'p' && l.type !== 'spitter' && bd < 4.8) {
                    l.state = 'windup'; l.windup = T.windup; l.wtgt = 'p';
                    continue;
                }
            }

            // movement by breed
            if (l.type === 'jumper') {
                // erratic hops roughly toward the target
                if (l.hopping > 0) {
                    l.hopping--;
                    l.x += l.hdx;
                    l.y += l.hdy;
                } else if (--l.hopT <= 0) {
                    const a = Math.atan2(tgt.y - l.y, tgt.x - l.x) + (this.random() - 0.5) * 2.0;
                    l.hdx = Math.cos(a) * T.speed;
                    l.hdy = Math.sin(a) * T.speed;
                    l.hopping = 6;
                    l.hopT = 14 + Math.floor(this.random() * 12);
                }
            } else if (l.type === 'spitter' && tgt.kind === 'p') {
                // kite: hold 14-24 range from the nearest player
                const a = Math.atan2(tgt.y - l.y, tgt.x - l.x);
                if (bd > 24) { l.x += Math.cos(a) * T.speed; l.y += Math.sin(a) * T.speed; }
                else if (bd < 14) { l.x -= Math.cos(a) * T.speed; l.y -= Math.sin(a) * T.speed; }
            } else {
                const chase = tgt.kind === 's' || bd < 42 || l.type === 'brute';
                if (chase && l.cd <= 0) {
                    const a = Math.atan2(tgt.y - l.y, tgt.x - l.x);
                    l.angle = a;
                    l.x += Math.cos(a) * T.speed;
                    l.y += Math.sin(a) * T.speed;
                } else {
                    if (this.random() < 0.05) l.angle += (this.random() - 0.5) * 1.4;
                    l.x += Math.cos(l.angle) * 0.3;
                    l.y += Math.sin(l.angle) * 0.3;
                    if (l.x < 4 || l.x > WORLD - 4) l.angle = Math.PI - l.angle;
                    if (l.y < 4 || l.y > WORLD - 4) l.angle = -l.angle;
                }
            }

            // A little separation keeps attacks readable when a crowd converges.
            for (const other of this.lemons) {
                if (!other.active || other === l) continue;
                const d = dist(l.x, l.y, other.x, other.y), spacing = (T.size + LEMON_TYPES[other.type].size) * 0.65;
                if (d > 0.01 && d < spacing) {
                    l.x += (l.x - other.x) / d * 0.25; l.y += (l.y - other.y) / d * 0.25;
                }
            }
            // a standing fence keeps lemons out of the yard (players pass freely)
            if (fenceUp) {
                const d2 = dist(l.x, l.y, BASE.x, BASE.y);
                if (d2 < FENCE_R && d2 > 0.01) {
                    l.x = BASE.x + ((l.x - BASE.x) / d2) * FENCE_R;
                    l.y = BASE.y + ((l.y - BASE.y) / d2) * FENCE_R;
                }
            }
            l.x = clamp(l.x, 4, WORLD - 4);
            l.y = clamp(l.y, 4, WORLD - 4);
        }
    }

    // The boss: a slow, huge, fence-crunching brute with a telegraphed swing.
    // No stagger, no knockback - kings don't flinch. Periodically waves in minions.
    updateBoss() {
        const b = this.boss;
        if (!b.active) return;
        const B = TUNING.BOSS;
        if (b.cd > 0) b.cd--;
        if (b.summonCd > 0) b.summonCd--;
        else {
            this.spawnCd = 0;   // reinforcements, NOW
            b.summonCd = B.summonTicks;
        }
        let best = null;
        let bd = 1e9;
        for (const id in this.players) {
            const p = this.players[id];
            if (!p.alive) continue;
            const d = dist(b.x, b.y, p.x, p.y);
            if (d < bd) { bd = d; best = p; }
        }
        const ds = dist(b.x, b.y, BASE.x, BASE.y);
        const fenceUp = this.fence.level > 0 && this.fence.hp > 0;
        const guardR = fenceUp ? FENCE_R : BASE.r;
        const structReach = guardR + 4.5;

        if (b.windup > 0) {
            b.windup--;
            if (b.windup <= 0) {
                if (b.wtgt === 's') {
                    if (ds < structReach + 3) this.damageStructure(B.sdmg, b.x, b.y);
                    b.cd = 40;
                } else {
                    if (best && bd < B.reach + 1.5 && best.invuln <= 0) this.damagePlayer(best, B.dmg);
                    b.cd = 34;
                }
            }
            return;
        }
        const wantPlayer = best && bd < 11;   // only swats players right in his path
        if (b.cd <= 0) {
            if (wantPlayer && bd < B.reach) { b.windup = B.windup; b.wtgt = 'p'; return; }
            if (!wantPlayer && ds < structReach) { b.windup = B.windup; b.wtgt = 's'; return; }
        }
        const tx = wantPlayer ? best.x : BASE.x;
        const ty = wantPlayer ? best.y : BASE.y;
        const a = Math.atan2(ty - b.y, tx - b.x);
        b.x += Math.cos(a) * B.speed;
        b.y += Math.sin(a) * B.speed;
        if (fenceUp) {
            const d2 = dist(b.x, b.y, BASE.x, BASE.y);
            if (d2 < FENCE_R && d2 > 0.01) {
                b.x = BASE.x + ((b.x - BASE.x) / d2) * FENCE_R;
                b.y = BASE.y + ((b.y - BASE.y) / d2) * FENCE_R;
            }
        }
        b.x = clamp(b.x, 6, WORLD - 6);
        b.y = clamp(b.y, 6, WORLD - 6);
    }

    hitBoss(dmg, p) {
        const b = this.boss;
        if (!b.active) return;
        b.hp -= dmg;
        this.spawnFx(b.x, b.y, [255, 200, 60, 255]);
        this.spawnDmg(b.x, b.y - 6, '-' + dmg, [255, 120, 100, 255]);
        if (b.hp <= 0) {
            b.active = false;
            if (p) this.nightStats.kills[p.id] = (this.nightStats.kills[p.id] || 0) + 1;
            this.onBossDefeated();
        }
    }

    damageStructure(dmg, x, y) {
        if (this.fence.level > 0 && this.fence.hp > 0) {
            this.fence.hp = Math.max(0, this.fence.hp - dmg);
            this.fenceFlash = 5;
            this.nightStats.fenceDmg += dmg;
            this.spawnFx(x, y, [200, 200, 210, 255]);
            this.updateStandHud();
            return;
        }
        this.standHp = Math.max(0, this.standHp - dmg);
        this.standFlash = 5;
        this.nightStats.standDmg += dmg;
        this.spawnFx(x, y, [255, 120, 90, 255]);
        this.spawnDmg(BASE.x, BASE.y - BASE.r - 4, '-' + dmg, [255, 120, 100, 255]);
        this.updateStandHud();
        if (this.standHp <= 0) this.gameOver('stand');
    }

    fireEProj(l, target) {
        const a = Math.atan2(target.y - l.y, target.x - l.x);
        for (const e of this.eProj) {
            if (e.active) continue;
            e.active = true;
            e.x = l.x + Math.cos(a) * 2;
            e.y = l.y + Math.sin(a) * 2;
            e.dx = Math.cos(a) * 1.35;
            e.dy = Math.sin(a) * 1.35;
            e.life = 22;
            return;
        }
    }

    updateEProj() {
        for (const e of this.eProj) {
            if (!e.active) continue;
            e.x += e.dx;
            e.y += e.dy;
            e.life--;
            if (e.life <= 0 || e.x < 2 || e.x > WORLD - 2 || e.y < 2 || e.y > WORLD - 2) {
                e.active = false;
                continue;
            }
            for (const id in this.players) {
                const p = this.players[id];
                if (!p.alive || p.invuln > 0) continue;
                if (dist(e.x, e.y, p.x, p.y) < 3) {
                    e.active = false;
                    this.spawnFx(p.x, p.y, [255, 150, 90, 255]);
                    this.damagePlayer(p, 1);
                    break;
                }
            }
            if (this.phase !== 'night') return;   // a spit may have downed the last player
        }
    }

    updateTurrets() {
        for (let i = 0; i < this.turrets; i++) {
            if (this.turretCds[i] > 0) {
                this.turretCds[i]--;
                continue;
            }
            const tx = BASE.x + TURRET_SLOTS[i][0];
            const ty = BASE.y + TURRET_SLOTS[i][1];
            let best = null;
            let bd = TURRET_SPEC.range;
            for (const l of this.lemons) {
                if (!l.active) continue;
                const d = dist(tx, ty, l.x, l.y);
                if (d < bd) { bd = d; best = l; }
            }
            if (this.boss.active) {
                const d = dist(tx, ty, this.boss.x, this.boss.y) - (TUNING.BOSS.size - 1);
                if (d < bd) { bd = d; best = this.boss; }
            }
            if (!best) continue;
            const a = Math.atan2(best.y - ty, best.x - tx);
            this.launchProjectile(tx, ty, a, TURRET_SPEC, null, [170, 215, 255, 255]);
            this.turretCds[i] = TURRET_SPEC.cd;
        }
    }

    damagePlayer(p, dmg) {
        if (!p.alive || p.invuln > 0 || this.phase !== 'night') return;
        p.hp = Math.max(0, p.hp - (dmg || 1));
        p.shake = 7; p.combo = 0; p.comboTimer = 0;
        this.playSound('hurt', p.id);
        p.invuln = TUNING.PLAYER.invulnTicks;
        if (p.hp <= 0) {
            p.alive = false;
            p.carried = { water: 0, sugar: 0, lemons: 0 }; p.coins = 0;   // dropped on death
            this.setHint(p, 'YOU DIED - drift as a ghost and scout the map for your team!', 9999);
            this.updatePlayerHud(p);
            let anyAlive = false;
            for (const id in this.players) {
                if (this.players[id].alive) { anyAlive = true; break; }
            }
            if (!anyAlive) this.gameOver();
        } else {
            this.setHint(p, 'OUCH!', 16);
            this.updatePlayerHud(p);
        }
    }

    updatePlayers() {
        for (const id in this.players) {
            const p = this.players[id];
            if (p.hintTimer > 0) {
                p.hintTimer--;
                if (p.hintTimer === 0) this.setText(p.v.hintText, '');
            }
            if (p.invuln > 0) p.invuln--;
            if (p.attackCd > 0) p.attackCd--;
            if (p.flash > 0) p.flash--;
            if (p.shake > 0) p.shake--;
            if (p.specialFlash > 0) p.specialFlash--;
            if (p.dashCd > 0) p.dashCd--;
            if (p.comboTimer > 0 && --p.comboTimer === 0) p.combo = 0;

            // movement runs for the living AND the dead: ghosts drift the map as
            // scouts, clearing fog for the team (see updateMinimap)
            // keys > tap target (the whole night screen is a tap catcher)
            let dx = 0;
            let dy = 0;
            if (p.keys.up) dy -= 1;
            if (p.keys.down) dy += 1;
            if (p.keys.left) dx -= 1;
            if (p.keys.right) dx += 1;
            const SPEED = p.alive ? this.playerSpeed() : this.playerSpeed() * TUNING.PLAYER.ghostSpeed;
            if (p.dashTicks > 0 && p.alive) {
                p.dashTicks--;
                p.x += p.dashX * SPEED * 2.9; p.y += p.dashY * SPEED * 2.9;
            } else if (dx !== 0 || dy !== 0) {
                const m = Math.hypot(dx, dy);
                p.x += (dx / m) * SPEED;
                p.y += (dy / m) * SPEED;
                p.faceX = dx / m;
                p.faceY = dy / m;
                p.target = null;
            } else if (p.target) {
                const d = dist(p.x, p.y, p.target.x, p.target.y);
                if (d < 1) {
                    p.target = null;
                } else {
                    const step = Math.min(SPEED, d);
                    const ux = (p.target.x - p.x) / d;
                    const uy = (p.target.y - p.y) / d;
                    p.x += ux * step;
                    p.y += uy * step;
                    p.faceX = ux;
                    p.faceY = uy;
                }
            }
            p.x = clamp(p.x, 3, WORLD - 3);
            p.y = clamp(p.y, 3, WORLD - 3);
            if (!p.alive) continue;   // ghosts stop here: no fighting, gathering, or banking

            // auto-attack: the weapon fires itself whenever something is in reach
            if (p.attackCd <= 0) this.autoAttack(p);

            // wells: stand inside the radius and water flows on its own
            p.gathering = false;
            let nearWell = null;
            for (const wl of this.wells) {
                if (wl.left > 0 && dist(wl.x, wl.y, p.x, p.y) < TUNING.GATHER.wellRadius) {
                    nearWell = wl;
                    break;
                }
            }
            if (nearWell) {
                p.gathering = true;
                p.gatherTick++;
                if (p.gatherTick >= TUNING.GATHER.wellPullTicks) {
                    p.gatherTick = 0;
                    const take = Math.min(TUNING.GATHER.wellPull, nearWell.left);
                    nearWell.left -= take;
                    p.carried.water += take;
                    this.spawnFx(nearWell.x, nearWell.y, [120, 185, 255, 255]);
                    this.spawnDmg(nearWell.x, nearWell.y - 3, '+' + take, [150, 205, 255, 255]);
                    this.updatePlayerHud(p);
                }
            } else {
                p.gatherTick = 0;
            }

            // A safe return turns combat into money, supplies and a little recovery.
            if (dist(p.x, p.y, BASE.x, BASE.y) < BASE.r) this.bank(p);
            this.updatePlayerHud(p);
        }
    }

    // ---------- weapons, hits, projectiles, effects ----------

    // Vampire-Survivors-style: pick the best target in reach and swing/fire at it.
    // Lemons take priority; with nothing to fight, chop the nearest cane instead.
    autoAttack(p) {
        const w = this.weaponSpec();
        const ranged = this.weapon === 'bow' || this.weapon === 'cannon';
        let tgt = null;
        let bd = ranged ? TUNING.AUTO.rangedAcquire : w.range;
        for (const l of this.lemons) {
            if (!l.active) continue;
            const d = dist(p.x, p.y, l.x, l.y);
            if (d < bd) { bd = d; tgt = l; }
        }
        if (this.boss.active) {
            // his bulk counts toward reach, so subtract it from the distance
            const d = dist(p.x, p.y, this.boss.x, this.boss.y) - (TUNING.BOSS.size - 1);
            if (d < bd) { bd = d; tgt = this.boss; }
        }
        if (!tgt) {
            bd = ranged ? TUNING.AUTO.rangedCaneRange : w.range;
            for (const cn of this.canes) {
                if (cn.hp <= 0) continue;
                const d = dist(p.x, p.y, cn.x, cn.y);
                if (d < bd) { bd = d; tgt = cn; }
            }
        }
        if (!tgt) return;
        // face the target so arc swings, projectiles, and the face dot all line up
        const d = Math.max(0.01, dist(p.x, p.y, tgt.x, tgt.y));
        p.faceX = (tgt.x - p.x) / d;
        p.faceY = (tgt.y - p.y) / d;
        this.doAttack(p);
    }

    doAttack(p) {
        const w = this.weaponSpec();
        p.attackCd = w.cd;
        p.flash = 6;
        this.playSound(this.weapon === 'cannon' ? 'boom' : this.weapon === 'bow' ? 'twang' : 'chop', p.id);
        if (this.weapon === 'bow' || this.weapon === 'cannon') {
            this.fireProjectile(p, Math.atan2(p.faceY, p.faceX), w, this.weapon === 'bow' ? [120, 222, 240, 255] : [255, 181, 72, 255]);
            if (this.weapon === 'cannon') p.shake = 4;
            return;
        }
        for (const l of this.lemons) {
            if (l.active && this.inMelee(p, w, l.x, l.y)) {
                this.hitLemon(l, p, w.dmg, w.knock);
                if (this.weapon === 'hands') break;
            }
        }
        for (const cn of this.canes) {
            if (cn.hp > 0 && this.inMelee(p, w, cn.x, cn.y)) this.hitCane(cn, p, this.weapon === 'axe' ? 3 : 1);
        }
        if (this.boss.active && this.inMelee(p, w, this.boss.x, this.boss.y, TUNING.BOSS.size - 1)) this.hitBoss(w.dmg, p);
    }

    inMelee(p, w, tx, ty, pad) {
        const d = dist(p.x, p.y, tx, ty);
        if (d > w.range + (pad || 0)) return false;
        if (!w.arcCos) return true;
        if (d < 1.5) return true;   // point blank always connects
        const dot = ((tx - p.x) / d) * p.faceX + ((ty - p.y) / d) * p.faceY;
        return dot >= w.arcCos;
    }

    hitLemon(l, p, dmg, knock = 2) {
        if (!l.active) return;
        l.hp -= dmg;
        l.hitFlash = 4;
        this.spawnFx(l.x, l.y, [255, 222, 93, 255]);
        this.spawnDmg(l.x, l.y - 3, '-' + dmg, [255, 230, 150, 255]);
        if (p) p.zest = Math.min(100, p.zest + 3);
        if (l.hp <= 0) {
            l.active = false;
            if (p) {
                this.nightStats.kills[p.id] = (this.nightStats.kills[p.id] || 0) + 1;
                p.combo = p.comboTimer > 0 ? p.combo + 1 : 1;
                p.comboTimer = 100;
                const bonus = Math.min(3, Math.floor(p.combo / 3));
                p.carried.lemons += TUNING.GATHER.lemonsPerKill + bonus;
                p.coins += 1 + (l.type === 'brute' ? 2 : 0);
                p.zest = Math.min(100, p.zest + 16);
                this.spawnDmg(l.x, l.y + 2, '+' + (3 + bonus) + ' L / $' + (l.type === 'brute' ? 3 : 1), COLORS.GOLD);
                this.updatePlayerHud(p);
                if (p.combo % 3 === 0) this.setHint(p, p.combo + ' SQUEEZED! +' + bonus + ' bonus lemons per KO', 35);
            } else {
                // Defenses earn ingredients too, safely delivered to the pantry.
                this.inv.lemons += TUNING.GATHER.lemonsPerKill;
                this.nightStats.turretKills = (this.nightStats.turretKills || 0) + 1;
            }
            return;
        }
        if (p && this.weapon !== 'hands') {
            const a = Math.atan2(l.y - p.y, l.x - p.x);
            l.kx = Math.cos(a) * knock / 3; l.ky = Math.sin(a) * knock / 3;
            l.stun = Math.max(l.stun || 0, this.weapon === 'axe' ? 8 : 3);
            l.cd = Math.max(l.cd, 10); l.state = 'wander'; l.windup = 0;
        }
    }

    hitCane(cn, p, damage = 1) {
        if (cn.hp <= 0) return;
        const chops = Math.min(cn.hp, damage);
        cn.hp -= chops;
        this.spawnFx(cn.x, cn.y, [90, 210, 100, 255]);
        if (p) {
            const sugar = TUNING.GATHER.sugarPerChop * chops;
            p.carried.sugar += sugar;
            p.zest = Math.min(100, p.zest + chops * 2);
            this.spawnDmg(cn.x, cn.y - 3, '+' + sugar + ' sugar', [150, 240, 150, 255]);
            this.updatePlayerHud(p);
        }
    }

    fireProjectile(p, angle, w, color) {
        this.launchProjectile(p.x, p.y, angle, w, p.id, color);
    }

    launchProjectile(x, y, angle, spec, ownerId, color) {
        const pr = this.projectiles.find(p => !p.active);
        if (!pr) return false;
        Object.assign(pr, { active: true, x: x + Math.cos(angle) * 2.5, y: y + Math.sin(angle) * 2.5,
            dx: Math.cos(angle) * spec.speed, dy: Math.sin(angle) * spec.speed,
            life: spec.life, dmg: spec.dmg, radius: spec.radius, owner: ownerId, color,
            pierce: spec.pierce || 1, blast: spec.blast || 0, knock: spec.knock || 0,
            kind: spec.blast ? 'cannonball' : spec.pierce ? 'arrow' : 'turret', hit: new Set() });
        return true;
    }

    updateProjectiles() {
        for (const pr of this.projectiles) {
            if (!pr.active) continue;
            const ox = pr.x, oy = pr.y;
            pr.x += pr.dx; pr.y += pr.dy; pr.life--;
            const owner = this.players[pr.owner];
            const shooter = owner && owner.alive ? owner : null;
            const targets = [...this.lemons.filter(l => l.active), ...this.canes.filter(c => c.hp > 0 && shooter)];
            if (this.boss.active) targets.unshift(this.boss);
            // Resolve nearest impacts first, with a swept test so quick arrows cannot tunnel.
            targets.sort((a, b) => dist(ox, oy, a.x, a.y) - dist(ox, oy, b.x, b.y));
            for (const target of targets) {
                if (pr.hit.has(target)) continue;
                const radius = pr.radius + (target === this.boss ? TUNING.BOSS.size - 1 : 1.5);
                if (segmentDistance(target.x, target.y, ox, oy, pr.x, pr.y) > radius) continue;
                pr.hit.add(target);
                if (pr.blast) {
                    this.explode(pr.x, pr.y, pr.blast, pr.dmg, shooter, pr.knock);
                    pr.active = false; break;
                }
                if (target === this.boss) this.hitBoss(pr.dmg, shooter);
                else if (target.type) this.hitLemon(target, shooter, pr.dmg, pr.knock);
                else this.hitCane(target, shooter);
                if (this.phase !== 'night') return;
                if (--pr.pierce <= 0) { pr.active = false; break; }
            }
            if (this.phase !== 'night') return;
            if (pr.active && (pr.life <= 0 || pr.x < 2 || pr.x > WORLD - 2 || pr.y < 2 || pr.y > WORLD - 2)) {
                if (pr.blast) this.explode(pr.x, pr.y, pr.blast, pr.dmg, shooter, pr.knock);
                pr.active = false;
            }
        }
    }

    spawnFx(x, y, color, radius = 3.8) {
        for (const f of this.fx) {
            if (f.active) continue;
            f.active = true;
            f.x = x; f.y = y; f.ttl = 10; f.max = 10; f.color = color; f.radius = radius;
            return;
        }
    }

    spawnDmg(x, y, text, color) {
        for (const d of this.dmgTexts) {
            if (d.active) continue;
            d.active = true;
            d.x = x; d.y = y; d.ttl = 16; d.max = 16; d.text = text; d.color = color;
            return;
        }
    }

    updateFx() {
        for (const f of this.fx) if (f.active && --f.ttl <= 0) f.active = false;
        for (const d of this.dmgTexts) if (d.active && --d.ttl <= 0) d.active = false;
    }

    renderNight() {
        for (const id in this.players) {
            const p = this.players[id];
            const v = p.v;
            const cam = this.cameraFor(p);
            // Tiny local impact shake leaves the HUD and input coordinates steady.
            if (p.shake > 0) { cam.x += Math.sin(this._t * 2.4) * p.shake * 0.08; cam.y += Math.cos(this._t * 1.9) * p.shake * 0.06; }
            const toX = (wx) => ((wx - cam.x) / VIEW) * 100;
            const toY = (wy) => ((wy - cam.y) / VIEW) * 100;
            const toS = (ws) => (ws / VIEW) * 100;
            // Both helpers route sprites through placeSprite (optional key swap);
            // shapes keep their original rect/polygon rendering.
            const setRect = (node, wx, wy, ws, key) => {
                const sx = toX(wx);
                const sy = toY(wy);
                if (sx < -10 || sx > 110 || sy < -10 || sy > 110) {
                    this.hideSprite(node);
                    return;
                }
                const s = toS(ws);
                if (node._sprite) this.placeSprite(node, key, sx - s / 2, sy - s / 2, s, s);
                else node.node.coordinates2d = ShapeUtils.rectangle(sx - s / 2, sy - s / 2, s, s);
            };
            const setCircle = (node, wx, wy, wr, key) => {
                const sx = toX(wx);
                const sy = toY(wy);
                if (sx < -10 || sx > 110 || sy < -10 || sy > 110) {
                    this.hideSprite(node);
                    return;
                }
                const r = toS(wr);
                if (node._sprite) this.placeSprite(node, key, sx - r, sy - r, r * 2, r * 2);
                else node.node.coordinates2d = polyCircle(sx, sy, r);
            };

            for (let tile = 0; tile < v.tiles.length; tile++) {
                const col = tile % 4, row = Math.floor(tile / 4);
                const x = Math.floor(cam.x / 16) * 16 + col * 16;
                const y = Math.floor(cam.y / 22) * 22 + row * 22;
                v.tiles[tile].node.coordinates2d = ShapeUtils.rectangle(toX(x), toY(y), toS(9), toS(0.5));
            }
            setCircle(v.baseRing, BASE.x, BASE.y, BASE.r);
            if (this.fence.level > 0 && this.fence.hp > 0) {
                v.fenceRing.node.color = this.fence.level === 1 ? [201, 163, 100, 255] : this.fence.level === 2 ? [179, 202, 208, 255] : [112, 225, 210, 255];
                v.fenceRing.node.border = 2 + this.fence.level * 2;
                setCircle(v.fenceRing, BASE.x, BASE.y, FENCE_R);
            } else v.fenceRing.node.coordinates2d = this.zeroRect();
            if (!v.baseNode._sprite) {
                v.baseNode.node.fill = this.standFlash > 0 ? [255, 95, 70, 255] : [146, 92, 44, 255];
            }
            // sprite stand conveys hits via the impact splash + damage number
            setRect(v.baseNode, BASE.x, BASE.y, BASE.r * 2);
            setRect(v.baseSign, BASE.x, BASE.y - BASE.r - 2, 5);

            // fence posts ring the yard; flash white when hit, dark stubs when broken
            // (sprite posts convey damage state via size: full -> 60% when broken)
            const fenceCol = this.fenceFlash > 0 ? [255, 255, 255, 255]
                : this.fence.hp <= 0 ? [70, 58, 50, 255]
                : this.fence.level === 1 ? [140, 100, 60, 255]
                : this.fence.level === 2 ? [150, 150, 160, 255]
                : [90, 180, 220, 255];
            const postSize = this.fence.hp <= 0 ? 1.5 : (this.fenceFlash > 0 ? 2.9 : 2.4);
            for (let i = 0; i < 8; i++) {
                if (this.fence.level === 0) {
                    this.hideSprite(v.fencePosts[i]);
                    continue;
                }
                const fa = (i / 8) * Math.PI * 2;
                if (!v.fencePosts[i]._sprite) v.fencePosts[i].node.fill = fenceCol;
                setRect(v.fencePosts[i], BASE.x + Math.cos(fa) * FENCE_R, BASE.y + Math.sin(fa) * FENCE_R, postSize);
            }
            for (let i = 0; i < MAX_TURRETS; i++) {
                if (i >= this.turrets) {
                    this.hideSprite(v.turretNodes[i]);
                    continue;
                }
                setRect(v.turretNodes[i], BASE.x + TURRET_SLOTS[i][0], BASE.y + TURRET_SLOTS[i][1], this.turretCds[i] > TURRET_SPEC.cd - 4 ? 5.8 : 4.8);
            }

            for (let i = 0; i < this.wells.length; i++) {
                const wl = this.wells[i];
                if (!v.wellNodes[i]._sprite) {
                    v.wellNodes[i].node.fill = wl.left > 0 ? COLORS.POWDER_BLUE : COLORS.STORM_GRAY;
                }
                // sprite wells shrink slightly when drained
                setCircle(v.wellNodes[i], wl.x, wl.y, wl.left > 0 ? 3.4 : 2.5);
            }
            for (let i = 0; i < this.canes.length; i++) {
                const cn = this.canes[i];
                if (cn.hp <= 0) {
                    this.hideSprite(v.caneNodes[i]);
                    continue;
                }
                setRect(v.caneNodes[i], cn.x, cn.y, 2.6 + cn.hp * 0.7);   // shrinks as it's chopped
            }
            for (let i = 0; i < this.lemons.length; i++) {
                const l = this.lemons[i];
                if (!l.active) {
                    v.telegraphs[i].node.coordinates2d = this.zeroRect();
                    this.hideSprite(v.lemonNodes[i]);
                    continue;
                }
                const LT = LEMON_TYPES[l.type];
                // shapes flash red during windup; sprites puff up 25% instead
                let size = LT.size;
                v.lemonNodes[i].node.color = [255, 255, 255, l.hitFlash > 0 ? 110 : l.spawnWarmup > 0 ? 120 : 255];
                if (l.state === 'windup' || l.spawnWarmup > 0) {
                    v.telegraphs[i].node.color = l.spawnWarmup > 0 ? [255, 220, 115, 255] : [255, 123, 88, 255];
                    setCircle(v.telegraphs[i], l.x, l.y, l.type === 'spitter' ? 4 : 5.8);
                } else v.telegraphs[i].node.coordinates2d = this.zeroRect();
                if (v.lemonNodes[i]._sprite) {
                    if (l.state === 'windup') size *= 1.25;
                } else {
                    v.lemonNodes[i].node.fill = l.state === 'windup' ? COLORS.ORANGE_RED : LT.color;
                }
                setCircle(v.lemonNodes[i], l.x, l.y, size, LT.asset);
            }

            // the boss: huge, puffs up 20% on windup (shapes tint orange-red instead)
            if (this.boss.active) {
                const b = this.boss;
                let bSize = TUNING.BOSS.size;
                if (v.bossNode._sprite) {
                    if (b.windup > 0) bSize *= 1.2;
                } else {
                    v.bossNode.node.fill = b.windup > 0 ? COLORS.ORANGE_RED : [255, 165, 35, 255];
                }
                setCircle(v.bossNode, b.x, b.y, bSize, 'bossLemon');
                const cx = toX(b.x), cy = toY(b.y - bSize);
                v.bossCrown.node.coordinates2d = [[cx-5,cy], [cx-6,cy-5], [cx-2,cy-3], [cx,cy-7], [cx+2,cy-3], [cx+6,cy-5], [cx+5,cy], [cx-5,cy]];
                if (b.windup > 0) setCircle(v.bossDanger, b.x, b.y, TUNING.BOSS.reach + 1.5); else v.bossDanger.node.coordinates2d = this.zeroRect();
            } else {
                this.hideSprite(v.bossNode); v.bossCrown.node.coordinates2d = this.zeroRect(); v.bossDanger.node.coordinates2d = this.zeroRect();
            }

            // lemon HP bars (hover above each active lemon)
            for (let i = 0; i < this.lemons.length; i++) {
                const l = this.lemons[i];
                const bg = v.lemonBarBg[i];
                const fl = v.lemonBarFill[i];
                const sx = toX(l.x);
                const sy = toY(l.y - 4.6);
                if (!l.active || sx < -10 || sx > 110 || sy < -10 || sy > 110) {
                    bg.node.coordinates2d = this.zeroRect();
                    fl.node.coordinates2d = this.zeroRect();
                    continue;
                }
                const bw = toS(5.2);
                const bh = toS(1.1);
                bg.node.coordinates2d = ShapeUtils.rectangle(sx - bw / 2, sy, bw, bh);
                fl.node.coordinates2d = ShapeUtils.rectangle(sx - bw / 2, sy, bw * (l.hp / l.maxHp), bh);
            }

            // Arrow silhouettes read direction; cannonballs have their own drawn sprite.
            for (let i = 0; i < this.projectiles.length; i++) {
                const pr = this.projectiles[i], n = v.projNodes[i], ball = v.ballNodes[i];
                n.node.coordinates2d = this.zeroRect(); this.hideSprite(ball);
                if (!pr.active) continue;
                if (pr.kind === 'cannonball') { n.node.fill = [255, 172, 72, 255]; setCircle(n, pr.x, pr.y, pr.blast > 10 ? 3 : 2); setCircle(ball, pr.x, pr.y, pr.blast > 10 ? 2.5 : 1.6); continue; }
                n.node.fill = pr.color;
                if (pr.kind === 'arrow') {
                    const len = Math.hypot(pr.dx, pr.dy) || 1, ux = pr.dx / len, uy = pr.dy / len;
                    const points = [[3,0],[0,-1.3],[0,-.35],[-3,-.35],[-3,.35],[0,.35],[0,1.3],[3,0]];
                    n.node.coordinates2d = points.map(([x,y]) => [toX(pr.x + ux*x - uy*y), toY(pr.y + uy*x + ux*y)]);
                } else setCircle(n, pr.x, pr.y, 0.8);
            }

            // enemy spit
            for (let i = 0; i < this.eProj.length; i++) {
                const e = this.eProj[i];
                if (!e.active) {
                    v.eProjNodes[i].node.coordinates2d = this.zeroRect();
                    continue;
                }
                setCircle(v.eProjNodes[i], e.x, e.y, 1.3);
            }

            // hit splashes: expanding rings that fade via `color` alpha
            // (fill alpha renders effectively opaque on the client, so the
            // fade must run through the color channel instead)
            for (let i = 0; i < this.fx.length; i++) {
                const f = this.fx[i];
                if (!f.active) {
                    v.fxNodes[i].node.coordinates2d = this.zeroRect();
                    continue;
                }
                const k = f.ttl / f.max;   // 1 -> 0
                v.fxNodes[i].node.fill = [f.color[0], f.color[1], f.color[2], f.radius >= 7 ? 0 : 255];
                v.fxNodes[i].node.border = f.radius >= 7 ? 5 : 0;
                v.fxNodes[i].node.color = [f.color[0], f.color[1], f.color[2], Math.round(210 * k)];
                setCircle(v.fxNodes[i], f.x, f.y, 1.2 + (1 - k) * (f.radius || 3.8));
            }

            // team weapon: sprite key (if art loaded) or icon color (shape mode)
            const wkey = this.weapon !== 'hands' ? this.weapon : null;
            const wcol = this.weapon === 'axe' ? [150, 95, 50, 255]
                : this.weapon === 'bow' ? [205, 165, 95, 255]
                : this.weapon === 'cannon' ? [95, 95, 110, 255] : null;

            let oi = 0;
            for (const oid in this.players) {
                if (oid === id) continue;
                if (oi >= v.otherNodes.length) break;
                const o = this.players[oid];
                if (!o.alive) {
                    // teammate's ghost: faint but visible, so scouts can coordinate
                    if (!v.otherNodes[oi]._sprite) v.otherNodes[oi].node.fill = o.color;
                    v.otherNodes[oi].node.color = [255, 255, 255, 70];
                    setRect(v.otherNodes[oi], o.x, o.y, 6.5, (o.keys.up || o.keys.down || o.keys.left || o.keys.right || o.target) ? (Math.floor(this._t / 5) % 2 ? 'walk1' : 'walk2') : 'playerChar');
                    this.hideSprite(v.otherWeapon[oi]);
                } else {
                    if (!v.otherNodes[oi]._sprite) v.otherNodes[oi].node.fill = o.color;
                    v.otherNodes[oi].node.color = [255, 255, 255, 255];
                    setRect(v.otherNodes[oi], o.x, o.y, 6.5, (o.keys.up || o.keys.down || o.keys.left || o.keys.right || o.target) ? (Math.floor(this._t / 5) % 2 ? 'walk1' : 'walk2') : 'playerChar');
                    if (wkey) {
                        if (!v.otherWeapon[oi]._sprite) v.otherWeapon[oi].node.fill = wcol;
                        setRect(v.otherWeapon[oi], o.x + o.faceX * 4, o.y + o.faceY * 4, 5, wkey);
                    } else {
                        this.hideSprite(v.otherWeapon[oi]);
                    }
                }
                oi++;
            }
            for (; oi < v.otherNodes.length; oi++) {
                this.hideSprite(v.otherNodes[oi]);
                this.hideSprite(v.otherWeapon[oi]);
            }

            if (p.alive && p.flash > 0 && (this.weapon === 'axe' || this.weapon === 'hands')) {
                const w = this.weaponSpec(), angle = Math.atan2(p.faceY, p.faceX), arc = this.weapon === 'axe' ? 1.4 : 0.8;
                const points = [[toX(p.x), toY(p.y)]];
                for (let j = 0; j <= 12; j++) { const a = angle - arc + j / 12 * arc * 2; points.push([toX(p.x + Math.cos(a)*w.range), toY(p.y + Math.sin(a)*w.range)]); }
                points.push(points[0]); v.atkFlash.node.coordinates2d = points;
                v.atkFlash.node.color = [255, 255, 255, 55 + p.flash * 10];
            } else v.atkFlash.node.coordinates2d = this.zeroRect();

            if (p.target) setRect(v.targetDot, p.target.x, p.target.y, 1.6);
            else v.targetDot.node.coordinates2d = this.zeroRect();

            // pulsing blue ring while a well is filling you up
            if (p.alive && p.gathering) {
                setCircle(v.gatherRing, p.x, p.y, 3.6 + Math.sin(this._t * 0.5) * 0.7);
            } else {
                v.gatherRing.node.coordinates2d = this.zeroRect();
            }

            if (!p.alive) {
                // ghost mode: your translucent spirit keeps drifting (color alpha
                // drives the whole-node fade; the glow reads as pleasantly spectral)
                v.avatar.node.color = [255, 255, 255, 85];
                setRect(v.avatar, p.x, p.y, 6.5, (p.keys.up || p.keys.down || p.keys.left || p.keys.right || p.target) ? (Math.floor(this._t / 5) % 2 ? 'walk1' : 'walk2') : 'playerChar');
                v.faceDot.node.coordinates2d = this.zeroRect();
                this.hideSprite(v.weaponIcon);
            } else {
                v.avatar.node.color = [255, 255, 255, 255];
                const flicker = p.invuln > 0 && Math.floor(this._t / 3) % 2 === 0;
                if (v.avatar._sprite) {
                    // sprite mode: invulnerability flickers by blinking the sprite
                    if (flicker) this.hideSprite(v.avatar);
                    else setRect(v.avatar, p.x, p.y, 6.5, (p.keys.up || p.keys.down || p.keys.left || p.keys.right || p.target) ? (Math.floor(this._t / 5) % 2 ? 'walk1' : 'walk2') : 'playerChar');
                } else {
                    v.avatar.node.fill = flicker ? COLORS.WHITE : p.color;
                    setRect(v.avatar, p.x, p.y, 6.5, (p.keys.up || p.keys.down || p.keys.left || p.keys.right || p.target) ? (Math.floor(this._t / 5) % 2 ? 'walk1' : 'walk2') : 'playerChar');
                }
                setRect(v.faceDot, p.x + p.faceX * 3, p.y + p.faceY * 3, 1.4);
                if (wkey) {
                    if (!v.weaponIcon._sprite) v.weaponIcon.node.fill = wcol;
                    setRect(v.weaponIcon, p.x + p.faceX * (4 + p.flash * 0.35), p.y + p.faceY * (4 + p.flash * 0.35), this.weapon === 'cannon' ? 6.5 : 6, wkey);
                } else {
                    this.hideSprite(v.weaponIcon);
                }
            }

            // floating damage / gain numbers drift upward and vanish
            for (let i = 0; i < this.dmgTexts.length; i++) {
                const d = this.dmgTexts[i];
                const n = v.dmgNodes[i];
                if (!d.active) {
                    n.node.text = Object.assign({}, n.node.text, { text: '' });
                    continue;
                }
                const k = 1 - d.ttl / d.max;
                const sx = toX(d.x);
                const sy = toY(d.y) - k * 6;
                if (sx < -10 || sx > 110 || sy < -10 || sy > 110) {
                    n.node.text = Object.assign({}, n.node.text, { text: '' });
                    continue;
                }
                n.node.text = Object.assign({}, n.node.text, { text: d.text, x: sx, y: sy, color: d.color });
            }
            v.root.node.children = v.drawNodes.filter(hasVisibleContent);
        }
        this.nightHudRoot.node.children = this.nightHudNodes.filter(hasVisibleContent);
    }

    nightTick() {
        this.nightLeft--;
        if (this.nightLeft <= 0) {
            this.dawn();
            return;
        }
        const sec = Math.ceil(this.nightLeft / TICK);
        if (sec !== this.lastSecond) {
            this.lastSecond = sec;
            this.setText(this.nightTimerText, 'Dawn in ' + sec + 's');
        }
        this.spawnLemons();
        this.updateLemons();
        if (this.phase !== 'night') return;   // a death may have ended the game mid-update
        this.updateBoss();
        if (this.phase !== 'night') return;   // the boss can wipe the crew or flatten the stand
        this.updatePlayers();
        if (this.phase !== 'night') return;   // an auto-attack may have felled the boss (victory!)
        this.updateTurrets();
        this.updateProjectiles();
        if (this.phase !== 'night') return;   // a turret shot can win the era too
        this.updateEProj();
        if (this.phase !== 'night') return;   // spit damage may have wiped the crew
        this.updateFx();
        if (this.standFlash > 0) this.standFlash--;
        if (this.fenceFlash > 0) this.fenceFlash--;
        if (this.bossNight && this.boss.active) {
            this.bossBarFill.node.coordinates2d =
                ShapeUtils.rectangle(20, 17.6, 60 * Math.max(0, this.boss.hp / this.boss.maxHp), 2.2);
        }
        this.updateMinimap();
        this.renderNight();
        this.notify();
    }

    recipeName() {
        const r = this.recipe;
        return r.sugar >= r.lemons + 2 ? 'CAVITY CONFETTI' : r.lemons >= r.sugar + 2 ? 'FACE SCRUNCHER'
            : r.sugar <= 2 ? 'RESPONSIBLE JUICE' : 'LIQUID SUNSHINE';
    }

    makeDayGoal() {
        const goals = [
            { kind: 'cups', target: 6, label: 'Sell 6 cups', reward: 10 },
            { kind: 'happy', target: 4, label: 'Delight 4 customers', reward: 12 },
            { kind: 'rushes', target: 1, label: 'Dance up a customer rush', reward: 12 }
        ];
        return Object.assign({ paid: false }, goals[(this.day - 1) % goals.length]);
    }

    makeCustomer() {
        const types = [
            { want: 'Extra sugar', sweet: 1, tart: 0, wallet: 0 },
            { want: 'Extra lemon', sweet: 0, tart: 1, wallet: 0.2 },
            { want: 'Low price', sweet: 0, tart: 0, wallet: -0.4 },
            { want: 'Best quality', sweet: 0, tart: 0, wallet: 0.6 }
        ];
        const c = Object.assign({}, types[Math.floor(this.random() * types.length)]);
        const forecast = forecastRecipe(this.weather);
        c.ps = clamp(forecast.sugar + c.sweet + Math.floor(this.random() * 3) - 1, 1, 5);
        c.pt = clamp(forecast.lemons + c.tart + Math.floor(this.random() * 3) - 1, 1, 5);
        return c;
    }

    sellCup(c, rush) {
        const r = this.recipe, taste = this.tasteScore(r, c.ps, c.pt);
        let message;
        if (this.inv.water < 1 || this.inv.sugar < r.sugar || this.inv.lemons < r.lemons) {
            message = 'Sold out';
        } else if (taste < (rush ? 0.25 : 0.4)) {
            message = ['super gross', 'i hate this'][this.dayStats.refused % 2];
        } else if (r.price > willingness(taste, this.rep, this.mods, this.weather, rush) + (c.wallet || 0)) {
            message = ['i dont think so', 'nope'][this.dayStats.refused % 2];
        } else {
            this.inv.water--; this.inv.sugar -= r.sugar; this.inv.lemons -= r.lemons;
            this.cupsToday++; this.stats.cupsTotal++;
            const happy = taste >= 0.7;
            let tip = 0;
            if (happy) {
                this.dayStats.happy++;
                if (this.mods.tipChance > 0 && this.random() < this.mods.tipChance) tip = Math.round(r.price * this.mods.tipMult * 100) / 100;
            }
            this.money += r.price + tip; this.dayStats.revenue += r.price; this.dayStats.tips += tip;
            this.rep = clamp(this.rep + (happy ? 3 : 1) + (happy ? this.mods.repBonus : 0), 0, 100);
            this.playSound('cash'); this.checkDayGoal();
            const reactions = taste >= .9 ? ['yowzers', 'wowzers'] : happy ? ["wow that's great!"] : ['pretty good', 'nice', 'cool'];
            message = reactions[(this.cupsToday - 1) % reactions.length] + (tip ? ' +$' + tip.toFixed(2) + ' tip!' : '');
            return { sold: true, message, taste, tip };
        }
        this.dayStats.refused++;
        this.rep = clamp(this.rep - 1, 0, 100);
        return { sold: false, message, taste, tip: 0 };
    }

    checkDayGoal() {
        const goal = this.dayGoal;
        if (!goal || goal.paid) return;
        const progress = goal.kind === 'cups' ? this.cupsToday : this.dayStats[goal.kind];
        if (progress >= goal.target) {
            goal.paid = true; this.money += goal.reward; this.dayStats.bonus += goal.reward;
            this.playSound('zest');
        }
    }

    closeShop() {
        if (this.phase !== 'sales') return;
        this.salesReport = Object.assign({ cups: this.cupsToday }, this.dayStats);
        this.setText(this.closingTitle, "That's a wrap!");
        this.setText(this.closingCups, this.cupsToday + ' cups sold');
        this.setText(this.closingCash, 'Sales $' + this.dayStats.revenue.toFixed(2) + '  +  tips $' + this.dayStats.tips.toFixed(2));
        this.setText(this.closingGoal, this.dayGoal.paid ? 'Daily bonus +$' + this.dayGoal.reward : '');
        this.setText(this.closingBank, '$' + this.money.toFixed(2) + ' in the bank');
        this.closeTimer = 9 * TICK; this.setPhase('closing');
    }

    weaponSpec() {
        const w = WEAPONS[this.weapon];
        return Object.assign({}, w, {
            dmg: w.dmg + this.boosts.power * (this.weapon === 'cannon' ? 2 : 1),
            cd: Math.max(4, Math.round(w.cd * Math.max(0.45, 1 - this.boosts.tempo * 0.12)))
        });
    }

    dash(playerId) {
        const p = this.players[playerId];
        if (!p || !p.alive || this.phase !== 'night' || p.dashCd > 0) return false;
        let dx = Number(p.keys.right) - Number(p.keys.left), dy = Number(p.keys.down) - Number(p.keys.up);
        if (!dx && !dy && p.target) { dx = p.target.x - p.x; dy = p.target.y - p.y; }
        if (!dx && !dy) { dx = p.faceX; dy = p.faceY; }
        const len = Math.hypot(dx, dy) || 1;
        p.dashX = dx / len; p.dashY = dy / len;
        p.dashTicks = 7; p.invuln = Math.max(p.invuln, 9); p.dashCd = 55;
        this.spawnFx(p.x, p.y, [136, 222, 235, 255], 5);
        this.playSound('dash', p.id); this.updatePlayerHud(p); this.notify();
        return true;
    }

    special(playerId) {
        const p = this.players[playerId];
        if (!p || !p.alive || this.phase !== 'night' || p.zest < 100) return false;
        p.zest = 0; p.specialFlash = 12; p.flash = 9;
        const w = this.weaponSpec(), a = Math.atan2(p.faceY, p.faceX);
        this.playSound('zest', p.id);
        this.setHint(p, w.special + '!', 30);
        if (this.weapon === 'bow') {
            for (let i = -2; i <= 2; i++) this.fireProjectile(p, a + i * 0.18, Object.assign({}, w, { dmg: w.dmg + 2, pierce: 6 }), [100, 240, 255, 255]);
        } else if (this.weapon === 'cannon') {
            this.fireProjectile(p, a, Object.assign({}, w, { dmg: w.dmg * 2, blast: 15, radius: 3 }), [255, 150, 65, 255]);
            p.shake = 7;
        } else {
            this.explode(p.x, p.y, this.weapon === 'axe' ? 15 : 11, w.dmg * 2, p, 10);
            p.invuln = Math.max(p.invuln, 10);
        }
        this.updatePlayerHud(p); this.notify(); return true;
    }

    explode(x, y, radius, damage, p, knock) {
        this.spawnFx(x, y, [255, 175, 65, 255], radius);
        if (p) p.shake = 5;
        for (const l of this.lemons) if (l.active && dist(x, y, l.x, l.y) <= radius) this.hitLemon(l, p, damage, knock);
        for (const c of this.canes) if (c.hp > 0 && dist(x, y, c.x, c.y) <= radius) this.hitCane(c, p, 3);
        if (this.boss.active && dist(x, y, this.boss.x, this.boss.y) <= radius + 3) this.hitBoss(damage, p);
    }

    bank(p) {
        const c = p.carried, total = c.water + c.sugar + c.lemons, coins = p.coins || 0;
        if (!total && !coins) return;
        this.inv.water += c.water; this.inv.sugar += c.sugar; this.inv.lemons += c.lemons;
        this.money += coins;
        this.nightStats.cash = (this.nightStats.cash || 0) + coins;
        this.nightStats.banked[p.id] = (this.nightStats.banked[p.id] || 0) + total;
        p.carried = { water: 0, sugar: 0, lemons: 0 }; p.coins = 0;
        if (total >= 12 && p.alive) p.hp = Math.min(this.playerMaxHp(), p.hp + 1);
        this.nightGoal.banked += c.water + c.sugar;
        let message = 'BANKED ' + total + ' supplies' + (coins ? ' + $' + coins : '') + (total >= 12 ? ' / +1 HP' : '');
        if (!this.nightGoal.paid && this.nightGoal.banked >= this.nightGoal.target) {
            this.nightGoal.paid = true; this.money += 12;
            message = 'PANTRY HEROES! Team delivery bonus: $12';
        }
        this.setText(this.nightInfoText, WEAPONS[this.weapon].name + ' / harvest delivery ' + Math.min(this.nightGoal.banked, this.nightGoal.target) + '/' + this.nightGoal.target + (this.nightGoal.paid ? ' / $12 BONUS BANKED' : ' / bonus $12'));
        this.setHint(p, message, 48); this.playSound('cash', p.id);
        this.spawnFx(p.x, p.y, [120, 230, 160, 255], 7);
        this.updatePlayerHud(p);
    }

    playSound(name, playerId) {
        if (!this.soundEnabled || this._t - (this.lastSound[name] ?? -100) < 3) return;
        const voice = this.voices.find(v => !v.until);
        if (!voice) return;
        this.lastSound[name] = this._t;
        voice.node.node.playerIds = playerId == null ? [] : [playerId];
        voice.node.node.asset = { ['sfx-' + name]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 } } };
        voice.until = this._t + 9;
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        for (const v of this.voices) { v.node.node.asset = undefined; v.until = 0; }
        this.setText(this.soundButton.labelNode, this.soundEnabled ? 'SOUND ON' : 'SOUND OFF');
        this.notify();
    }

    // ---------- main loop ----------

    tick() {
        if (this.closed) return;
        this._t++;
        if (this.pendingSave && !this.saveInFlight && this._t >= this.saveRetryAt) this.persist();
        let soundEnded = false;
        for (const v of this.voices) if (v.until && this._t >= v.until) { v.node.node.asset = undefined; v.until = 0; soundEnded = true; }
        if (soundEnded) this.notify();
        if (this.phase === 'closing') { if (--this.closeTimer <= 0) this.startNight(); return; }
        if (this.phase === 'sales') {
            this.salesTick();
            return;
        }
        if (this.phase === 'night') {
            this.nightTick();
            return;
        }
        if (this.phase === 'recap') {
            this.recapTimer--;
            if (this.recapTimer <= 0) this.startPrep(this.day + 1);
            return;
        }
        if (this.phase === 'victory') {
            this.victoryTimer--;
            if (this.victoryTimer <= 0) this.advanceEra();
        }
    }
}

module.exports = LemonadeTycoon;
