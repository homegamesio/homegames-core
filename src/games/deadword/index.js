// ===========================================================================
// DEADWORD - a typing horde game for Homegames (squish-150)
//
// Polygon creatures shamble in from both edges toward the barricade at the
// center of the plane. Each one carries a word. Type its first letter to lock
// on, type the rest to put it down. Backspace releases a lock. Enemy count and
// spawn tempo scale with the number of players; word length scales with wave.
//
// Everything is drawn from polygons - no assets, no invented asset ids.
// Every node is created once in the constructor and mutated in place; nothing
// is added to or removed from the tree during play.
// ===========================================================================

const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');

// ---------------------------------------------------------------------------
// TUNING - every gameplay number lives here.
//
// Everything below is in REAL-WORLD UNITS: plane-units per SECOND, and
// SECONDS. Nothing is expressed per tick. A typing game's difficulty is a
// contract between wall-clock time and how fast a human can hit keys, so the
// simulation has to advance on wall-clock time too - otherwise raising
// tickRate for smoother motion silently makes the game harder, and a
// backgrounded browser tab (where the runtime's timer is throttled) plays in
// slow motion and turns trivial. tick() converts these to per-frame amounts
// using the real elapsed time since the previous frame.
// ---------------------------------------------------------------------------
const TUNING = {
    TICK: 30,          // tickRate - MUST match the tickRate literal in metadata().
                       // Smoothness/bandwidth ONLY: pacing no longer depends on it.
    MAX_PLAYERS: 6,    // MUST match the maxPlayers literal in metadata()

    DIFFICULTY: 1.0,   // master knob: scales counts / tempo, never speed or behavior

    BARRICADE_HP: 12,
    WAVE_SECONDS: 18,
    BANNER_SECONDS: 1.75,

    SPAWN: {
        gapBase: 2.3,      // seconds between spawns on wave 1
        gapPerWave: 0.16,  // ...shrinking each wave
        gapMin: 0.7,
        capBase: 2,
        capPerPlayer: 1.4,
        capPerWave: 0.7
    },
    SPEED: {               // plane x-units per SECOND
        base: 1.35,
        perWave: 0.2,
        perExtraPlayer: 0.09,   // a crowd gets a faster horde, not just a bigger one
        jitter: 0.22,
        max: 16.5
    },
    // The horde is capped by the node budget, so the other half of the
    // difficulty ramp is keystrokes-per-kill: longer words by wave, and one
    // tier harder once there are enough typists to chew through the short ones.
    WORD: { wavesPerTier: 2.5, playersPerTier: 2 },
    SCORE: { perChar: 12, comboStep: 0.25, comboMax: 4 },
    // fx: speeds in units/sec, gravity in units/sec^2, life in seconds
    FX: { burst: 11, seconds: 1.05, speed: 4.5, spread: 12, rise: 9, gravity: 32 },

    LABEL_MAX_W: 15,       // x-units a word label may occupy before it shrinks to fit
    LABEL_MIN_SIZE: 1.0,   // ...but never smaller than this
    MISS_FLASH_SECONDS: 0.2,
    HOLD_GAP_MS: 70,       // keydowns closer together than this are a held key, not a repeat
    BEACON_HALF: 5.2,      // how close a creature gets before it hits the barricade
    MAX_STEP_SECONDS: 0.25 // dt clamp: a stalled tab resumes, it does not teleport the horde
};

// Hard caps: memory / bandwidth budgets, NOT design knobs. Every count formula
// clamps against these so a wild tuning value degrades instead of overflowing.
const MAX_ENEMIES = 12;
const MAX_FX = 28;

const MAX_PLAYERS = TUNING.MAX_PLAYERS;

// ---------------------------------------------------------------------------
// Palette - explicit [r,g,b,a] arrays only (an invented COLORS.* name is
// undefined, which renders as an invisible shape with no error).
// ---------------------------------------------------------------------------
const SKY = [13, 11, 24, 255];
const SKY_HAZE = [26, 19, 46, 255];
const SKY_GLOW = [44, 26, 62, 255];
const GROUND = [17, 14, 28, 255];
const LANE_LINE = [40, 33, 62, 255];
const DECOR = [27, 22, 44, 255];
const DECOR_HI = [38, 31, 58, 255];

const BONE = [236, 232, 226, 255];
const DIM = [138, 130, 158, 255];
const PANEL = [22, 19, 36, 255];
const PANEL_EDGE = [76, 66, 112, 255];
const DANGER = [236, 62, 84, 255];
const SAFE = [92, 226, 214, 255];

const PLAYER_COLORS = [
    [92, 226, 214, 255],    // cyan
    [255, 152, 74, 255],    // amber
    [186, 132, 255, 255],   // violet
    [140, 226, 118, 255]    // lime
];

// ---------------------------------------------------------------------------
// Geometry helpers. The plane is 0-100 on both axes but stretched to 16:9, so
// one x-unit is 16/9 wider on screen than one y-unit. Creatures are authored in
// a square "sprite space" and pushed through ONE transform, which is also what
// mirrors them: left-walkers and right-walkers share the same geometry instead
// of two copy-pasted trig blocks.
// ---------------------------------------------------------------------------
const YS = 16 / 9;

// local sprite coords (origin at the feet, +x = forward, -y = up) -> plane
const toPlane = (ctx, lx, ly) => [
    ctx.px + (lx + ctx.lean * -ly) * ctx.s * ctx.dir,
    ctx.py + ly * ctx.s * YS
];

const shape = (ctx, pts) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) out.push(toPlane(ctx, pts[i][0], pts[i][1]));
    out.push(out[0]);
    return out;
};

// Turn a polyline into a closed outline strip. Used for every limb, leg pair,
// wing, tail and horn in the game - one implementation, many calls.
// `w` is a width or a per-point width array (tapering).
const strip = (pts, w) => {
    const up = [];
    const dn = [];
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i > 0 ? i - 1 : 0];
        const b = pts[i < pts.length - 1 ? i + 1 : i];
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const hw = (Array.isArray(w) ? w[i] : w) / 2;
        const nx = -Math.sin(ang) * hw;
        const ny = Math.cos(ang) * hw;
        up.push([pts[i][0] + nx, pts[i][1] + ny]);
        dn.push([pts[i][0] - nx, pts[i][1] - ny]);
    }
    return up.concat(dn.reverse());
};

// Two legs joined at the hip as ONE closed polygon with a real gap between
// them - a strip through the hip would fill the gap and read as a skirt.
// Every walker in the game gets its legs from this, called with mirrored or
// splayed arguments rather than duplicated per breed.
const legPair = (fx1, fx2, hx1, hx2, hipY, innerY, footY, w) => [
    [fx1 - w, footY], [fx1 + w * 0.5, footY],
    [hx1 + w * 0.9, innerY], [hx2 - w * 0.9, innerY],
    [fx2 - w * 0.5, footY], [fx2 + w, footY],
    [hx2 + w, hipY], [hx1 - w, hipY]
];

// local centered box
const lbox = (cx, cy, w, h) => [
    [cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]
];

const clamp255 = v => Math.max(0, Math.min(255, Math.round(v)));
const mixColor = (a, b, t) => [
    clamp255(a[0] + (b[0] - a[0]) * t),
    clamp255(a[1] + (b[1] - a[1]) * t),
    clamp255(a[2] + (b[2] - a[2]) * t),
    clamp255(a[3] + (b[3] - a[3]) * t)
];

// ---------------------------------------------------------------------------
// Creature breeds. Each build() returns the seven part polygons in local
// sprite space; `s1`/`s2` are sin/cos of the gait phase.
// Part draw order is fixed by PART_KEYS: back arm, legs, body, detail, eyes,
// front arm - so limbs read correctly in front of and behind the torso.
// ---------------------------------------------------------------------------
// (breed `speed` is a multiplier on TUNING.SPEED; `gait` is radians per SECOND)
const PART_KEYS = ['armB', 'legs', 'body', 'detail', 'eyeL', 'eyeR', 'armA'];
const OUTLINED = { armB: true, legs: true, body: true, armA: true };

const BREEDS = {
    // The basic shambler: lurching humanoid, short words.
    shambler: {
        scale: 3.0, half: 1.35, height: 2.5, lean: 0.1, speed: 1.0, gait: 3.6, tier: 0,
        pal: {
            body: [96, 122, 84, 255], limb: [80, 104, 70, 255], line: [30, 42, 28, 255],
            dark: [26, 34, 24, 255], eye: [255, 214, 92, 255], gib: [138, 176, 96, 255]
        },
        build: (s1) => {
            const sw = s1 * 0.22;
            return {
                body: [
                    [-0.44, -0.92], [-0.52, -1.46], [-0.38, -1.58], [-0.40, -1.86],
                    [-0.44, -2.02], [-0.30, -2.32], [0.06, -2.44], [0.36, -2.30],
                    [0.44, -2.02], [0.32, -1.84], [0.34, -1.60], [0.54, -1.44],
                    [0.46, -0.92]
                ],
                legs: legPair(-0.34 + sw, 0.32 - sw, -0.22, 0.20, -0.96, -0.56, 0.02, 0.16),
                armA: strip([
                    [0.30, -1.44], [0.78, -1.40 + s1 * 0.14], [1.16, -1.30 + s1 * 0.26]
                ], [0.26, 0.20, 0.13]),
                armB: strip([
                    [-0.34, -1.42], [-0.62, -1.14 - s1 * 0.18], [-0.72, -0.76 - s1 * 0.30]
                ], [0.24, 0.18, 0.12]),
                detail: [[0.02, -2.02], [0.36, -2.00], [0.30, -1.80], [0.08, -1.86]],
                eyeL: lbox(0.09, -2.18, 0.12, 0.10),
                eyeR: lbox(0.29, -2.15, 0.12, 0.10)
            };
        }
    },

    // Six-legged crawler: low, wide, fast, easy words.
    crawler: {
        scale: 4.0, half: 1.5, height: 1.05, lean: 0, speed: 1.55, gait: 6.3, tier: -1,
        pal: {
            body: [124, 72, 96, 255], limb: [84, 48, 68, 255], line: [34, 18, 30, 255],
            dark: [30, 16, 26, 255], eye: [255, 108, 132, 255], gib: [190, 96, 122, 255]
        },
        build: (s1) => {
            const a = s1 * 0.16;
            const pair = (x1, x2, sway) =>
                legPair(x1 - 0.18 + sway, x2 + 0.18 - sway, x1, x2, -0.52, -0.38, 0.02, 0.07);
            return {
                body: [
                    [-0.90, -0.60], [-0.66, -0.86], [-0.40, -0.70], [-0.12, -1.00],
                    [0.18, -0.76], [0.50, -0.94], [0.74, -0.70], [0.96, -0.50],
                    [0.88, -0.28], [0.40, -0.20], [-0.42, -0.22], [-0.86, -0.34]
                ],
                legs: pair(-0.72, -0.40, a),
                armB: pair(-0.18, 0.14, -a),
                armA: pair(0.36, 0.68, a),
                detail: strip([[1.30, -0.52], [0.92, -0.40], [1.28, -0.22]], [0.03, 0.16, 0.03]),
                eyeL: lbox(0.58, -0.62, 0.11, 0.09),
                eyeR: lbox(0.76, -0.52, 0.09, 0.08)
            };
        }
    },

    // Wraith: hovers, flaps, medium-long words.
    wraith: {
        scale: 3.2, half: 1.6, height: 1.9, lean: 0, speed: 1.28, gait: 3.0, tier: 1,
        hover: 7,
        pal: {
            body: [72, 78, 138, 255], limb: [56, 60, 112, 255], line: [24, 26, 54, 255],
            dark: [18, 18, 40, 255], eye: [140, 240, 255, 255], gib: [124, 138, 226, 255]
        },
        build: (s1) => ({
            body: [
                [-0.50, -0.55], [-0.46, -1.10], [-0.30, -1.50], [0.00, -1.72],
                [0.34, -1.56], [0.50, -1.20], [0.58, -0.60], [0.64, -0.10],
                [0.40, -0.36], [0.24, 0.06], [0.06, -0.30], [-0.12, 0.10],
                [-0.30, -0.32], [-0.50, 0.02], [-0.60, -0.42]
            ],
            armA: strip([
                [0.30, -1.30], [0.92, -1.55 - s1 * 0.32], [1.52, -1.18 - s1 * 0.52]
            ], [0.32, 0.20, 0.05]),
            armB: strip([
                [-0.30, -1.30], [-0.88, -1.50 - s1 * 0.28], [-1.44, -1.10 - s1 * 0.46]
            ], [0.30, 0.18, 0.05]),
            legs: strip([
                [0.00, -0.24], [-0.10 + s1 * 0.20, 0.30], [0.12 - s1 * 0.28, 0.74]
            ], [0.22, 0.12, 0.03]),
            detail: [[-0.06, -1.62], [0.26, -1.52], [0.30, -1.22], [0.02, -1.16], [-0.16, -1.36]],
            eyeL: lbox(0.06, -1.44, 0.12, 0.07),
            eyeR: lbox(0.22, -1.39, 0.10, 0.06)
        })
    },

    // Brute: slow, enormous, long words.
    brute: {
        scale: 4.2, half: 1.9, height: 2.8, lean: 0.05, speed: 0.62, gait: 2.25, tier: 2,
        pal: {
            body: [150, 92, 60, 255], limb: [124, 74, 48, 255], line: [42, 24, 16, 255],
            dark: [36, 20, 14, 255], eye: [255, 96, 60, 255], gib: [204, 128, 78, 255]
        },
        build: (s1) => {
            const sw = s1 * 0.18;
            return {
                body: [
                    [-0.72, -0.98], [-0.86, -1.88], [-0.60, -2.10], [-0.28, -2.18],
                    [-0.22, -2.44], [0.04, -2.58], [0.30, -2.46], [0.36, -2.20],
                    [0.66, -2.12], [0.90, -1.92], [0.80, -0.98]
                ],
                legs: legPair(-0.50 + sw, 0.50 - sw, -0.32, 0.32, -1.04, -0.62, 0.02, 0.26),
                armA: strip([
                    [0.66, -1.98], [1.12, -1.48 + s1 * 0.16], [1.20, -0.84 + s1 * 0.24]
                ], [0.40, 0.34, 0.44]),
                armB: strip([
                    [-0.70, -1.98], [-1.14, -1.44 - s1 * 0.16], [-1.22, -0.80 - s1 * 0.24]
                ], [0.38, 0.32, 0.42]),
                detail: strip([
                    [-0.36, -2.74], [-0.14, -2.40], [0.22, -2.38], [0.38, -2.72]
                ], [0.03, 0.17, 0.17, 0.03]),
                eyeL: lbox(-0.02, -2.36, 0.11, 0.08),
                eyeR: lbox(0.20, -2.33, 0.11, 0.08)
            };
        }
    }
};

// Lane depth. Slot index picks the lane so back-lane creatures always sit
// earlier in the tree - i.e. they render behind the front lane.
const LANE_OF_SLOT = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2];
const LANE_Y = [74, 82, 90];
const LANE_SCALE = [0.74, 0.90, 1.06];
const LANE_TEXT = [1.25, 1.45, 1.65];

// ---------------------------------------------------------------------------
// Words and phrases, bucketed by length into difficulty tiers.
//
// Tone: homegames.io is "homemade games played at home" - a mostly-solo side
// project, MIT, goofy, faintly gross. So this is deliberately not 500 gothic
// thesaurus entries. Horror is the spine; the rest is household junk, office
// dread, cryptids, noises and dev in-jokes, because a shambling corpse
// labelled LEFTOVERS is funnier than one labelled SEPULCHRAL. The long tiers
// lean hardest into the joke - those are the ones players stare at longest.
//
// Phrases are typed without needing the space bar (see typeChar), so "wet sock"
// completes as either "wet sock" or "wetsock". Repeated letters are fine:
// the key gate tells a held key from a double-tap by cadence, not by banning
// them. Entries must be lowercase letters and single spaces only.
// ---------------------------------------------------------------------------
const WORDS = [
    // tier 0 - 3-4 characters (61 entries)
    [
        'ash', 'bile', 'bone', 'char', 'claw', 'clot', 'dank', 'dead', 'dire', 'dirt', 'drip',
        'dusk', 'eek', 'fang', 'fog', 'foul', 'gash', 'gasp', 'gnaw', 'goat', 'gore', 'grim',
        'grub', 'gulp', 'hack', 'hex', 'howl', 'husk', 'jaw', 'lint', 'lurk', 'maim', 'mire',
        'moan', 'mold', 'mop', 'murk', 'oof', 'pale', 'pit', 'plop', 'pyre', 'rasp', 'rend',
        'rib', 'rot', 'ruin', 'rust', 'scab', 'slab', 'stab', 'thud', 'tomb', 'ugh', 'urn',
        'vein', 'vile', 'void', 'wail', 'wilt', 'worm'
    ],
    // tier 1 - 5-6 characters (172 entries)
    [
        'abyss', 'armpit', 'ashen', 'beast', 'belch', 'bitten', 'blegh', 'blight', 'blood',
        'blorp', 'blurgh', 'brute', 'buffet', 'burial', 'callus', 'candle', 'casket', 'cavern',
        'cellar', 'chasm', 'cheese', 'chewed', 'chills', 'cinder', 'clammy', 'coffee',
        'coffin', 'corpse', 'crunch', 'crypt', 'cursed', 'dagger', 'damned', 'decaf', 'decay',
        'demon', 'devil', 'dirge', 'dismal', 'doily', 'doodle', 'dredge', 'drool', 'dusky',
        'earwax', 'ember', 'famine', 'femur', 'feral', 'fetid', 'fever', 'fiend', 'filthy',
        'flame', 'flump', 'frenzy', 'fumes', 'fungal', 'fungus', 'ghoul', 'gloom', 'gloop',
        'glorp', 'gnarf', 'gnarl', 'gnawed', 'goblin', 'gooey', 'goose', 'gorgon', 'grime',
        'grimy', 'groan', 'grotto', 'gurgle', 'harpy', 'hearse', 'hexed', 'hnngh', 'hollow',
        'hotfix', 'humid', 'jello', 'kettle', 'ladle', 'lurker', 'malice', 'mangle', 'marrow',
        'marsh', 'miasma', 'mildew', 'moist', 'moose', 'morbid', 'morgue', 'mucus', 'muffin',
        'murky', 'nausea', 'noodle', 'omens', 'pelvis', 'phlegm', 'pillow', 'pimple', 'plague',
        'putrid', 'rabid', 'rancid', 'regex', 'retch', 'ripped', 'rotten', 'sallow', 'savage',
        'scrape', 'scream', 'scythe', 'septic', 'shadow', 'shiver', 'shlorp', 'shovel',
        'shriek', 'shroud', 'sinew', 'sinus', 'siren', 'skree', 'skull', 'slimy', 'sludge',
        'slurp', 'sodden', 'spasm', 'spine', 'spirit', 'spite', 'splat', 'sponge', 'spores',
        'squeak', 'squirm', 'squish', 'starve', 'stench', 'stink', 'talons', 'tepid', 'thwap',
        'torch', 'torpid', 'toxic', 'tumor', 'twitch', 'vapor', 'venom', 'vermin', 'vomit',
        'waffle', 'wheeze', 'whine', 'whisk', 'whump', 'wither', 'wraith', 'wretch', 'writhe',
        'yeesh', 'yikes', 'zombie'
    ],
    // tier 2 - 7-9 characters (245 entries)
    [
        'abandoned', 'afflicted', 'agonizing', 'ailment', 'all hands', 'anguished',
        'autopsies', 'bake sale', 'balloon', 'banshee', 'blackout', 'blighted', 'blister',
        'blistered', 'bloated', 'bloodless', 'bog witch', 'brimstone', 'butchered', 'cabinet',
        'cadaver', 'cadavers', 'cannibals', 'carcass', 'casserole', 'catacomb', 'catacombs',
        'ceiling', 'charnel', 'clawing', 'coaster', 'cold brew', 'cold sore', 'contagion',
        'convulse', 'corpses', 'crawling', 'crematory', 'crock pot', 'crooked', 'cryptid',
        'damp sock', 'dandruff', 'darkness', 'decaying', 'deceased', 'decompose', 'decrepit',
        'defiled', 'demonic', 'dentist', 'departed', 'deranged', 'desolated', 'devouring',
        'dial tone', 'disease', 'diseased', 'disfigure', 'dish soap', 'dismember', 'dissected',
        'doorbell', 'duct tape', 'ear canal', 'eclipsed', 'edge case', 'egg salad', 'embalmed',
        'embalming', 'entrails', 'epidemics', 'expired', 'festered', 'festering', 'foot odor',
        'forgotten', 'forsaken', 'gangrene', 'ghoulish', 'gloaming', 'gnarled', 'gnashing',
        'grasping', 'graveside', 'graveyard', 'gristle', 'groaning', 'grotesque', 'gum wad',
        'gym sock', 'hairball', 'hallway', 'hangnail', 'harrowing', 'headstone', 'hideously',
        'hotdish', 'howling', 'hunched', 'illness', 'infected', 'infection', 'infested',
        'interment', 'jackalope', 'jury duty', 'ker splat', 'kerplop', 'knuckle', 'lacerated',
        'laundry', 'leftovers', 'lint trap', 'loathsome', 'localhost', 'lunatic', 'lurching',
        'macabre', 'madness', 'malaise', 'malicious', 'malignant', 'mall goth', 'margarine',
        'mattress', 'mausoleum', 'meatball', 'microwave', 'midnight', 'milk skin', 'moaning',
        'moldered', 'moldering', 'monstrous', 'moonlight', 'mortuary', 'mothman', 'mutilated',
        'muttered', 'necrosis', 'nightfall', 'no signal', 'nose hair', 'not again', 'on hold',
        'one sock', 'opossum', 'ossuary', 'oven mitt', 'paperwork', 'perished', 'phantoms',
        'plagued', 'poisoned', 'potluck', 'predators', 'profane', 'prowler', 'pudding',
        'purulent', 'putrefied', 'quagmires', 'quivering', 'raccoon', 'ravenous', 'reaching',
        'recycling', 'refactor', 'remains', 'reply all', 'revenant', 'ribcage', 'rollback',
        'sasquatch', 'satanic', 'screams', 'screech', 'semicolon', 'shadowed', 'shambled',
        'shambler', 'ship it', 'shrieks', 'shuffled', 'sinister', 'skeletal', 'slaughter',
        'slither', 'slobber', 'spaghetti', 'spare key', 'spasming', 'spatula', 'spectres',
        'splodge', 'spoiled', 'squelch', 'staggers', 'stalker', 'swollen', 'tainted',
        'tax audit', 'tech debt', 'tendons', 'the cloud', 'the dmv', 'thermos', 'toenail',
        'tombstone', 'tormented', 'twilight', 'twist tie', 'twisted', 'twitched', 'twitching',
        'unburied', 'undefined', 'unearthly', 'unhinged', 'unit test', 'unnatural', 'unsquish',
        'venomous', 'vertebrae', 'virulence', 'virulent', 'viscera', 'voicemail', 'voracious',
        'wailing', 'wallpaper', 'wandering', 'warm milk', 'wet cough', 'wet nap', 'wet sock',
        'whimper', 'whispered', 'withered', 'withering', 'wretched', 'writhing', 'zip tie',
        'zombified'
    ],
    // tier 3 - 10-13 characters (153 entries)
    [
        'a quick sync', 'abomination', 'angry goose', 'apocalyptic', 'awkward pause',
        'back sweat', 'bees again', 'behind you', 'boxed wine', 'bread clip', 'breath mint',
        'bulk pretzels', 'cadaverous', 'callback hell', 'card table', 'carnivores',
        'catastrophe', 'ceiling fan', 'circle back', 'code review', 'contaminated',
        'cookie banner', 'crusty spoon', 'damp knight', 'damp towel', 'decapitated',
        'decomposition', 'defilement', 'dental floss', 'desecrated', 'desecration',
        'disembodied', 'disemboweled', 'disintegrate', 'disinterred', 'dust bunny',
        'everlasting', 'eviscerate', 'eviscerated', 'excruciating', 'exhumation',
        'exsanguinate', 'exterminated', 'family plan', 'feral raccoon', 'folding chair',
        'folding table', 'force push', 'free trial', 'freezer burn', 'fridge smell',
        'gangrenous', 'garage sale', 'garden hose', 'gplv three', 'grocery bag', 'grotesquery',
        'group chat', 'group project', 'guest soap', 'happy hour', 'hello world', 'hold music',
        'hot reload', 'hotel carpet', 'indescribable', 'inescapable', 'infinite loop',
        'insatiable', 'interminable', 'it compiles', 'junk drawer', 'jury summons',
        'labyrinthine', 'lake monster', 'lawn chair', 'lawn flamingo', 'lawn ornament',
        'legacy code', 'lorem ipsum', 'low battery', 'lukewarm soup', 'main branch',
        'malevolence', 'memory leak', 'monstrosity', 'mystery meat', 'mystery stain',
        'navel lint', 'necromancer', 'necromantic', 'necropolis', 'nightmares', 'nightmarish',
        'node modules', 'novelty mug', 'npm install', 'null pointer', 'obliterate',
        'obliterated', 'off by one', 'old sponge', 'open source', 'pandemonium', 'pantry moth',
        'paper plate', 'pestilence', 'pestilential', 'plastic fork', 'port conflict',
        'printer jam', 'pull request', 'putrefaction', 'ravenously', 'reanimation',
        'regurgitate', 'resurrection', 'rubber band', 'rubber duck', 'sarcophagus',
        'scope creep', 'self hosted', 'sepulchral', 'several bees', 'shower drain',
        'side project', 'small talk', 'sock drawer', 'soggy bread', 'spam folder',
        'stack trace', 'still hungry', 'storage full', 'swamp thing', 'sweaty palms',
        'tax season', 'the sun room', 'thermostat', 'tinned fish', 'tuna salad', 'tupperware',
        'unblinking', 'unfathomable', 'unimaginable', 'unmarked jar', 'unread email',
        'unrelenting', 'unspeakable', 'unsubscribe', 'vivisection', 'waiting room',
        'welcome mat', 'wifi password'
    ],
    // tier 4 - 14-20 characters (55 entries)
    [
        'a goose with a plan', 'a jar of pennies', 'a lot of moths', 'a medium sized dog',
        'a normal horse', 'a second fridge', 'a warm doorknob', 'above ground pool',
        'calendar alert', 'church basement', 'cursed printer', 'damp cardboard',
        'daylight savings', 'do not turn around', 'drawer of cords', 'expired coupon',
        'expired yogurt', 'extension cord', 'forwarded email', 'gas station sushi',
        'half a sandwich', 'haunted toaster', 'inflatable raft', 'it is a feature',
        'it knows your name', 'it works locally', 'meeting invite', 'merge conflict',
        'moist handshake', 'nine volt battery', 'off brand cola', 'one large bird',
        'one more commit', 'open enrollment', 'owl with opinions', 'parking ticket',
        'per my last email', 'potluck signup', 'race condition', 'room temperature',
        'software update', 'stack overflow', 'suburban possum', 'terms of service',
        'the basement light', 'the good scissors', 'the good towels', 'the neighbors cat',
        'the sink smell', 'too many geese', 'unlicensed wizard', 'unmute yourself',
        'unpaid invoice', 'works on my box', 'you are on mute'
    ]
];

// ===========================================================================

class Deadword extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Deadword',
            author: "Joseph Garcia",
            description: 'Type the word over each monster to put it down before it reaches the barricade.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30,
            maxPlayers: 6,
            gameId: "761575f0-3bc2-597e-a4e0-92291b66f953"
        };
    }

    constructor() {
        super();

        this.lastStamp = Date.now();
        this.clock = 0;             // seconds of session time, drives all timing
        this.phase = 'menu';          // 'menu' | 'playing' | 'over'
        this.wave = 1;
        this.waveLeft = TUNING.WAVE_SECONDS;
        this.bannerLeft = 0;
        this.spawnLeft = 2;
        this.hp = TUNING.BARRICADE_HP;
        this.teamScore = 0;
        this.fxActive = 0;
        this.writers = {};            // playerId -> writer state
        this.slotOwner = {};          // hud slot -> playerId

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: SKY
        });

        this.buildBackdrop();
        this.buildEnemies();
        this.buildBarricade();
        this.buildFx();
        this.buildHud();
        this.buildOverlays();

        this.drawFrame();
        this.showOverlay('menu');
    }

    getLayers() {
        return [{ root: this.base }];
    }

    // -----------------------------------------------------------------------
    // Construction
    // -----------------------------------------------------------------------

    // Containers are zero-size on purpose: a full-screen container swallows
    // every click on anything drawn beneath it.
    makeContainer() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    poly(pts, fill, line, border) {
        const cfg = {
            shapeType: Shapes.POLYGON,
            coordinates2d: pts,
            fill: fill
        };
        if (border) {
            cfg.color = line;
            cfg.border = border;
        }
        return new GameNode.Shape(cfg);
    }

    label(text, x, y, size, color, align) {
        return new GameNode.Text({
            textInfo: {
                text: text, x: x, y: y, size: size,
                align: align || 'center', font: 'monospace', color: color
            }
        });
    }

    // Text nodes cannot take `effects`, so a glow is four dim offset copies
    // under a bright core.
    glowText(text, x, y, size, color, glow) {
        const g = glow || color;
        const offs = [[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3]];
        const out = offs.map(o => this.label(text, x + o[0], y + o[1], size,
            [g[0], g[1], g[2], 130]));
        out.push(this.label(text, x, y, size, color));
        return out;
    }

    // Text is not clickable: a button is a clickable Shape with a Text on top.
    makeButton(x, y, w, h, text, fill, onClick) {
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: fill,
            color: BONE,
            border: 4,
            onClick: onClick
        });
        bg.addChild(this.label(text, x + w / 2, y + h / 2 - 1.6, 2.2, [16, 12, 26, 255]));
        return bg;
    }

    buildBackdrop() {
        this.base.addChild(this.poly(ShapeUtils.rectangle(0, 30, 100, 26), SKY_HAZE));
        this.base.addChild(this.poly(ShapeUtils.rectangle(0, 56, 100, 16), SKY_GLOW));
        this.base.addChild(this.poly(ShapeUtils.rectangle(0, 70, 100, 30), GROUND));

        // ruined skyline: a few silhouettes for depth
        const ruins = [
            [8, 62, 5, 10], [15, 58, 3, 14], [26, 64, 7, 8],
            [68, 60, 4, 12], [76, 63, 8, 9], [90, 57, 4, 15]
        ];
        ruins.forEach(r => this.base.addChild(this.poly(
            ShapeUtils.rectangle(r[0], r[1], r[2], r[3]), DECOR)));

        // leaning gravestones on the back lane
        [[20, 74], [38, 74], [63, 74], [84, 74]].forEach(g => this.base.addChild(this.poly(
            [[g[0], g[1]], [g[0] + 2.2, g[1] - 0.6], [g[0] + 2.8, g[1] - 5],
            [g[0] + 0.5, g[1] - 4.6]], DECOR_HI)));

        LANE_Y.forEach(y => this.base.addChild(this.poly(
            ShapeUtils.rectangle(0, y, 100, 0.35), LANE_LINE)));
    }

    buildEnemies() {
        this.enemyLayer = this.makeContainer();
        this.base.addChild(this.enemyLayer);

        this.enemies = [];
        for (let i = 0; i < MAX_ENEMIES; i++) {
            const parts = {};
            PART_KEYS.forEach(k => {
                const n = this.poly(ShapeUtils.rectangle(0, 0, 0, 0), [0, 0, 0, 0],
                    [0, 0, 0, 0], OUTLINED[k] ? 3 : 0);
                parts[k] = n;
                this.enemyLayer.addChild(n);
            });
            const bar = this.poly(ShapeUtils.rectangle(0, 0, 0, 0), [0, 0, 0, 0]);
            const word = this.label('', 50, 50, 1.5, BONE);
            this.enemyLayer.addChild(bar);
            this.enemyLayer.addChild(word);

            this.enemies.push({
                slot: i,
                lane: LANE_OF_SLOT[i],
                parts: parts,
                barNode: bar,
                wordNode: word,
                active: false,
                breed: BREEDS.shambler,
                word: '',
                progress: 0,
                claim: null,
                px: 0, py: 0, vx: 0, dir: 1, s: 1,
                phase: 0, gait: 0, bob: 0, textSize: 1.5
            });
        }
    }

    buildBarricade() {
        this.barricade = this.makeContainer();
        this.base.addChild(this.barricade);

        this.barricade.addChild(this.poly(ShapeUtils.rectangle(42, 88, 16, 8), [30, 26, 46, 255],
            [60, 52, 90, 255], 4));
        this.barricade.addChild(this.poly([[44, 88], [47, 70], [53, 70], [56, 88]],
            [38, 33, 58, 255], [70, 60, 104, 255], 4));

        this.crystal = this.poly([[50, 56], [55, 66], [50, 78], [45, 66]], SAFE, BONE, 3);
        this.crystal.node.effects = { shadow: { color: [92, 226, 214, 255], blur: 22 } };
        this.barricade.addChild(this.crystal);

        this.crystalCore = this.poly([[50, 62], [52.2, 66.5], [50, 72], [47.8, 66.5]], BONE);
        this.barricade.addChild(this.crystalCore);
    }

    buildFx() {
        this.fxLayer = this.makeContainer();
        this.base.addChild(this.fxLayer);
        this.fx = [];
        for (let i = 0; i < MAX_FX; i++) {
            const node = this.poly(ShapeUtils.rectangle(0, 0, 0, 0), [0, 0, 0, 0]);
            this.fxLayer.addChild(node);
            this.fx.push({
                node: node, active: false,
                x: 0, y: 0, vx: 0, vy: 0, size: 0, life: 0, max: 1, col: BONE
            });
        }
    }

    buildHud() {
        this.hudLayer = this.makeContainer();
        this.base.addChild(this.hudLayer);

        this.waveText = this.label('WAVE 1', 2, 2, 1.6, DIM, 'left');
        this.scoreText = this.label('0', 98, 2, 1.6, BONE, 'right');
        this.hudLayer.addChild(this.waveText);
        this.hudLayer.addChild(this.scoreText);

        this.hpTrack = this.poly(ShapeUtils.rectangle(35, 2.2, 30, 2.4), [34, 28, 50, 255],
            PANEL_EDGE, 3);
        this.hpFill = this.poly(ShapeUtils.rectangle(35, 2.2, 30, 2.4), SAFE);
        this.hudLayer.addChild(this.hpTrack);
        this.hudLayer.addChild(this.hpFill);
        this.hudLayer.addChild(this.label('BARRICADE', 50, 5.1, 1.1, DIM));

        // player cards - shown to everyone (it is a scoreboard) with a "YOU"
        // marker scoped to each player, since frameless sessions have no chrome
        // to tell people which one they are.
        this.cards = [];
        for (let i = 0; i < MAX_PLAYERS; i++) {
            const x = 2 + i * 24.5;
            const chip = this.poly(ShapeUtils.rectangle(x, 8.6, 1.4, 4.2), [0, 0, 0, 0]);
            const name = this.label('', x + 2.4, 8.6, 1.3, DIM, 'left');
            const score = this.label('', x + 22.5, 8.6, 1.3, DIM, 'right');
            const you = new GameNode.Text({
                textInfo: {
                    text: 'YOU', x: x + 2.4, y: 11.2, size: 1, align: 'left',
                    font: 'monospace', color: BONE
                },
                playerIds: [0]      // nobody until a player takes this slot
            });
            this.hudLayer.addChild(chip);
            this.hudLayer.addChild(name);
            this.hudLayer.addChild(score);
            this.hudLayer.addChild(you);
            this.cards.push({ x: x, chip: chip, name: name, score: score, you: you });
        }

        this.banner = this.label('', 50, 26, 4.5, [255, 96, 120, 255]);
        this.hudLayer.addChild(this.banner);

        // Phones have no keyboard: this opens the client's text prompt, and
        // whatever is typed there is fed through as keystrokes.
        this.typeBox = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(34, 92.4, 32, 6),
            fill: PANEL,
            color: PANEL_EDGE,
            border: 4,
            input: {
                type: 'text',
                oninput: (playerId, value) => this.handleTypedString(playerId, value)
            }
        });
        this.typeBox.addChild(this.label('TAP TO TYPE', 50, 94.3, 1.4, DIM));
        this.hudLayer.addChild(this.typeBox);
    }

    buildOverlays() {
        this.menuLayer = this.makeContainer();
        this.base.addChild(this.menuLayer);
        this.menuLayer.addChild(this.poly(ShapeUtils.rectangle(0, 0, 100, 100), [10, 8, 18, 238]));

        this.menuLayer.addChild(this.label('TYPE A MONSTER’S WORD TO STOP IT.', 50, 40, 1.6, BONE));
        this.menuLayer.addChild(this.label('BACKSPACE CHANGES YOUR TARGET.', 50, 46, 1.6, BONE));

        this.menuLayer.addChild(this.makeButton(38, 64, 24, 10, 'START', SAFE,
            () => this.startRun()));

        this.overLayer = this.makeContainer();
        this.base.addChild(this.overLayer);
        this.overLayer.addChild(this.poly(ShapeUtils.rectangle(0, 0, 100, 100), [14, 6, 12, 238]));
        this.glowText('OVERRUN', 50, 16, 7, BONE, DANGER)
            .forEach(n => this.overLayer.addChild(n));
        this.overStats = [
            this.label('', 50, 34, 2.2, BONE),
            this.label('', 50, 42, 2.2, BONE),
            this.label('', 50, 50, 1.8, DIM)
        ];
        this.overStats.forEach(n => this.overLayer.addChild(n));
        this.overLayer.addChild(this.makeButton(35, 64, 30, 10, 'PLAY AGAIN', DANGER,
            () => this.startRun()));

    }

    // -----------------------------------------------------------------------
    // Run lifecycle - "play again" resets state in place. There is no
    // location.reload() here; there is no browser in a hosted session.
    // -----------------------------------------------------------------------

    showOverlay(which) {
        this.menuLayer.node.playerIds = which === 'menu' ? [] : [0];
        this.overLayer.node.playerIds = which === 'over' ? [] : [0];
    }

    startRun() {
        this.enemies.forEach(e => {
            e.active = false;
            e.claim = null;
            e.progress = 0;
            e.word = '';
        });
        this.fx.forEach(f => { f.active = false; });
        this.fxActive = 0;

        Object.keys(this.writers).forEach(key => {
            const w = this.writers[key];
            w.score = 0;
            w.combo = 1;
            w.kills = 0;
            w.typed = 0;
            w.misses = 0;
            w.target = null;
            w.flash = 0;
            w.keys = {};
        });

        this.wave = 1;
        this.waveLeft = TUNING.WAVE_SECONDS;
        this.bannerLeft = TUNING.BANNER_SECONDS;
        this.spawnLeft = 1.3;
        this.lastStamp = Date.now();   // don't bill the menu's idle time to frame one
        this.hp = TUNING.BARRICADE_HP;
        this.teamScore = 0;
        this.phase = 'playing';

        this.showOverlay(null);
        this.drawFrame();
        this.base.node.onStateChange();
    }

    endRun() {
        this.phase = 'over';
        let best = null;
        Object.keys(this.writers).forEach(key => {
            const w = this.writers[key];
            if (!best || w.score > best.score) best = w;
        });
        const accuracy = best && (best.typed + best.misses) > 0
            ? Math.round((best.typed / (best.typed + best.misses)) * 100) : 100;
        this.overStats[0].node.text.text = 'SCORE ' + this.teamScore;
        this.overStats[1].node.text.text = 'WAVE ' + this.wave;
        this.overStats[2].node.text.text = best
            ? ('TOP TYPIST ' + best.name + ' - ' + best.kills + ' KILLS, ' + accuracy + '% CLEAN')
            : 'NO SURVIVORS';
        this.enemies.forEach(e => { e.active = false; e.claim = null; });
        Object.keys(this.writers).forEach(key => { this.writers[key].target = null; });
        this.showOverlay('over');
    }

    playerCount() {
        return Math.max(1, Object.keys(this.writers).length);
    }

    // -----------------------------------------------------------------------
    // Simulation
    // -----------------------------------------------------------------------

    tick() {
        // Real elapsed time - not the tick count - drives the simulation, so
        // pacing is identical at any tickRate and a throttled tab plays at the
        // right speed instead of in slow motion. The clamp means a tab that
        // resumes after a long stall steps forward once, rather than
        // teleporting the whole horde into the barricade.
        const now = Date.now();
        let dt = (now - this.lastStamp) / 1000;
        this.lastStamp = now;
        if (!(dt > 0)) return;                  // duplicate frame or clock skew
        if (dt > TUNING.MAX_STEP_SECONDS) dt = TUNING.MAX_STEP_SECONDS;
        this.clock += dt;

        if (this.phase !== 'playing') {
            // Menus and the game-over screen change nothing, so they must not
            // re-squish the tree - except while death fx are still burning out.
            if (this.fxActive > 0) {
                this.stepFx(dt);
                this.drawFx();
                this.base.node.onStateChange();
            }
            return;
        }

        this.stepWave(dt);
        this.stepSpawner(dt);
        this.stepEnemies(dt);
        // A breach can end the run mid-tick, tearing down phase state.
        if (this.phase !== 'playing') {
            this.drawFrame();
            this.base.node.onStateChange();
            return;
        }
        this.stepFx(dt);
        this.drawFrame();
        this.base.node.onStateChange();
    }

    stepWave(dt) {
        if (this.bannerLeft > 0) this.bannerLeft -= dt;
        this.waveLeft -= dt;
        if (this.waveLeft <= 0) {
            this.waveLeft = TUNING.WAVE_SECONDS;
            this.wave++;
            this.bannerLeft = TUNING.BANNER_SECONDS;
        }
    }

    enemyCap() {
        const s = TUNING.SPAWN;
        const raw = (s.capBase + s.capPerPlayer * this.playerCount() + s.capPerWave * (this.wave - 1))
            * TUNING.DIFFICULTY;
        return Math.max(1, Math.min(MAX_ENEMIES, Math.round(raw)));
    }

    spawnGap() {
        const s = TUNING.SPAWN;
        const crowd = 0.75 + 0.25 * this.playerCount();
        const raw = (s.gapBase - s.gapPerWave * (this.wave - 1)) / (crowd * TUNING.DIFFICULTY);
        return Math.max(s.gapMin, raw);
    }

    stepSpawner(dt) {
        this.spawnLeft -= dt;
        if (this.spawnLeft > 0) return;
        // Reset rather than subtract: a resumed stall owes one spawn, not six.
        this.spawnLeft = this.spawnGap();
        const live = this.enemies.filter(e => e.active).length;
        if (live >= this.enemyCap()) return;
        this.spawn();
    }

    pickBreed() {
        const pool = ['shambler', 'shambler', 'crawler'];
        if (this.wave >= 2) { pool.push('crawler'); pool.push('wraith'); }
        if (this.wave >= 3) { pool.push('wraith'); pool.push('brute'); }
        if (this.wave >= 5) { pool.push('brute'); pool.push('shambler'); }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // Words in play never share a first letter when it can be avoided, so a
    // lock-on keystroke is never ambiguous.
    pickWord(tier) {
        const t = Math.max(0, Math.min(WORDS.length - 1, Math.round(tier)));
        const list = WORDS[t];
        const usedWord = {};
        const usedFirst = {};
        this.enemies.forEach(e => {
            if (!e.active || !e.word) return;
            usedWord[e.word] = true;
            usedFirst[e.word.charAt(0)] = true;
        });
        let fallback = null;
        for (let i = 0; i < 40; i++) {
            const w = list[Math.floor(Math.random() * list.length)];
            if (usedWord[w]) continue;
            if (!fallback) fallback = w;
            if (!usedFirst[w.charAt(0)]) return w;
        }
        return fallback || list[0];
    }

    spawn() {
        let e = null;
        for (let i = 0; i < this.enemies.length; i++) {
            if (!this.enemies[i].active) { e = this.enemies[i]; break; }
        }
        if (!e) return;

        const breed = BREEDS[this.pickBreed()];
        const fromLeft = Math.random() < 0.5;
        const crowd = this.playerCount() - 1;
        const tier = Math.floor((this.wave - 1) / TUNING.WORD.wavesPerTier)
            + Math.floor(crowd / TUNING.WORD.playersPerTier);
        const speed = Math.min(TUNING.SPEED.max,
            (TUNING.SPEED.base + TUNING.SPEED.perWave * (this.wave - 1))
            * (1 + TUNING.SPEED.perExtraPlayer * crowd)
            * breed.speed * (1 + (Math.random() - 0.5) * TUNING.SPEED.jitter));

        e.breed = breed;
        e.active = true;
        e.claim = null;
        e.progress = 0;
        e.word = this.pickWord(tier + breed.tier);
        e.s = breed.scale * LANE_SCALE[e.lane];
        e.dir = fromLeft ? 1 : -1;
        // Coordinates clamp to [0, 255] on the wire: negatives pin to 0, so a
        // left-side spawn lives in this plain variable until it is fully on the
        // plane (see paintEnemy's draw gate). Values above 100 serialize fine.
        e.px = fromLeft ? -(breed.half * e.s + 4) : 100 + breed.half * e.s + 4;
        e.py = LANE_Y[e.lane] - (breed.hover || 0);
        e.vx = e.dir * speed;
        e.phase = Math.random() * 6.28;
        e.gait = breed.gait;
        e.bob = 0;
        e.textSize = LANE_TEXT[e.lane];
    }

    stepEnemies(dt) {
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e.active) continue;
            // Position lives in a plain variable and only the drawn value is
            // written into coordinates2d, so sub-wire-precision motion still
            // accumulates correctly at any frame length.
            e.px += e.vx * dt;
            e.phase += e.gait * dt;
            if (e.breed.hover) e.bob = Math.sin(e.phase * 0.55) * 1.6;
            // "Arrived" is a threshold crossing in the direction of travel, not
            // a band around the center: a long frame can step clean over a band.
            const reached = e.dir > 0
                ? e.px >= 50 - TUNING.BEACON_HALF
                : e.px <= 50 + TUNING.BEACON_HALF;
            if (reached) {
                this.breach(e);
                if (this.phase !== 'playing') return;
            }
        }
    }

    breach(e) {
        const headY = e.py - e.breed.height * e.s * YS * 0.5;
        this.burst(e.px, headY, DANGER, TUNING.FX.burst);
        const w = e.claim !== null ? this.writers[e.claim] : null;
        if (w) { w.combo = 1; w.target = null; }
        this.retire(e);
        this.hp--;
        if (this.hp <= 0) {
            this.hp = 0;
            this.endRun();
        }
    }

    retire(e) {
        e.active = false;
        e.claim = null;
        e.progress = 0;
        e.word = '';
        Object.keys(this.writers).forEach(key => {
            const w = this.writers[key];
            if (w.target === e.slot) w.target = null;
        });
        this.hideEnemy(e);
    }

    burst(x, y, col, count) {
        let left = count;
        for (let i = 0; i < this.fx.length && left > 0; i++) {
            const f = this.fx[i];
            if (f.active) continue;
            left--;
            const a = Math.random() * Math.PI * 2;
            const sp = TUNING.FX.speed + Math.random() * TUNING.FX.spread;
            f.active = true;
            f.x = x;
            f.y = y;
            f.vx = Math.cos(a) * sp;
            f.vy = Math.sin(a) * sp * YS - TUNING.FX.rise;
            f.size = 0.4 + Math.random() * 0.7;
            f.life = TUNING.FX.seconds;
            f.max = TUNING.FX.seconds;
            f.col = col;
        }
        this.fxActive = this.fx.filter(f => f.active).length;
    }

    stepFx(dt) {
        let live = 0;
        for (let i = 0; i < this.fx.length; i++) {
            const f = this.fx[i];
            if (!f.active) continue;
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.vy += TUNING.FX.gravity * dt;
            f.life -= dt;
            if (f.life <= 0) {
                f.active = false;
                f.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                f.node.node.fill = [0, 0, 0, 0];
                continue;
            }
            live++;
        }
        this.fxActive = live;
    }

    // -----------------------------------------------------------------------
    // Typing
    // -----------------------------------------------------------------------

    targetOf(pid) {
        const w = this.writers[pid];
        if (!w || w.target === null) return null;
        const e = this.enemies[w.target];
        if (!e || !e.active || e.claim !== pid) {
            if (w) w.target = null;
            return null;
        }
        return e;
    }

    // A creature is on stage once its ENTIRE rendered box fits on the plane.
    // Coordinates pin to 0 on the wire, so anything drawn further left smears
    // against the edge. One rule, used by the draw gate and by lock-on, so a
    // creature is never typeable before its word is readable.
    onStage(e) {
        const half = e.breed.half * e.s;
        return e.px >= half && e.px <= 100 - half;
    }

    // Nearest unclaimed creature whose word starts with `c`.
    acquire(c) {
        let best = null;
        let bestDist = 1e9;
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e.active || e.claim !== null) continue;
            if (e.word.charAt(0) !== c) continue;
            if (!this.onStage(e)) continue;
            const d = Math.abs(e.px - 50);
            if (d < bestDist) { bestDist = d; best = e; }
        }
        return best;
    }

    // Step a creature's word forward, hopping any spaces so the cursor never
    // rests on one. Spaces are shown (phrases have to stay readable) but typing
    // them is optional - see typeChar.
    advanceWord(e) {
        e.progress++;
        while (e.word.charAt(e.progress) === ' ') e.progress++;
    }

    // Returns true if the keystroke was consumed by the game.
    typeChar(pid, ch) {
        if (this.phase !== 'playing') return false;
        const w = this.writers[pid];
        if (!w) return false;
        const c = String(ch).toLowerCase();
        // A space is never required and never punished: 'wet sock' completes
        // whether or not the player reaches for the space bar.
        if (c === ' ') return true;
        if (c.length !== 1 || c < 'a' || c > 'z') return false;

        let e = this.targetOf(pid);

        if (!e) {
            e = this.acquire(c);
            if (!e) {
                w.misses++;
                w.combo = 1;
                w.flash = this.clock + TUNING.MISS_FLASH_SECONDS;
                return true;
            }
            e.claim = pid;
            e.progress = 0;
            this.advanceWord(e);
            w.target = e.slot;
            w.typed++;
        } else if (e.word.charAt(e.progress) === c) {
            this.advanceWord(e);
            w.typed++;
        } else {
            w.misses++;
            w.combo = 1;
            w.flash = this.clock + TUNING.MISS_FLASH_SECONDS;
            this.paintEnemy(e);
            return true;
        }

        if (e.progress >= e.word.length) {
            this.kill(e, pid);
        } else {
            this.paintEnemy(e);
        }
        return true;
    }

    kill(e, pid) {
        const w = this.writers[pid];
        const headY = e.py - e.breed.height * e.s * YS * 0.55;
        if (w) {
            w.combo = Math.min(TUNING.SCORE.comboMax, w.combo + TUNING.SCORE.comboStep);
            const gain = Math.round(e.word.length * TUNING.SCORE.perChar * w.combo);
            w.score += gain;
            w.kills++;
            this.teamScore += gain;
        }
        this.burst(e.px, headY, e.breed.pal.gib, TUNING.FX.burst);
        this.retire(e);
    }

    releaseTarget(pid) {
        const e = this.targetOf(pid);
        if (!e) return false;
        e.claim = null;
        e.progress = 0;
        this.writers[pid].target = null;
        this.paintEnemy(e);
        return true;
    }

    // -----------------------------------------------------------------------
    // Drawing
    // -----------------------------------------------------------------------

    hideEnemy(e) {
        PART_KEYS.forEach(k => {
            e.parts[k].node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            e.parts[k].node.fill = [0, 0, 0, 0];
        });
        e.barNode.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        e.barNode.node.fill = [0, 0, 0, 0];
        e.wordNode.node.text.text = '';
    }

    playerColor(pid) {
        const w = this.writers[pid];
        return w ? w.color : BONE;
    }

    paintEnemy(e) {
        if (!e.active) { this.hideEnemy(e); return; }

        if (!this.onStage(e)) { this.hideEnemy(e); return; }

        // Materialize over the first few units of stage time so the entrance
        // reads as deliberate rather than as a pop-in. `fill` alpha is
        // effectively binary on the client, so the fade rides on `color`.
        const half = e.breed.half * e.s;
        const entered = e.dir > 0 ? e.px - half : (100 - half) - e.px;
        const fade = clamp255(255 * Math.max(0, Math.min(1, entered / 5)));

        const s1 = Math.sin(e.phase);
        const geo = e.breed.build(s1, Math.cos(e.phase));
        const ctx = {
            px: e.px, py: e.py + e.bob, s: e.s, dir: e.dir, lean: e.breed.lean
        };
        const pal = e.breed.pal;
        const locked = e.claim !== null;
        const claimCol = locked ? this.playerColor(e.claim) : pal.eye;

        const paint = (key, pts, fill) => {
            const n = e.parts[key].node;
            n.coordinates2d = shape(ctx, pts);
            n.fill = fill;
            // On outlined parts this doubles as the stroke color; on the rest
            // it does nothing except carry the alpha.
            const line = OUTLINED[key] ? pal.line : fill;
            n.color = [line[0], line[1], line[2], fade];
        };

        paint('body', geo.body, pal.body);
        paint('legs', geo.legs, pal.limb);
        paint('armA', geo.armA, pal.limb);
        paint('armB', geo.armB, pal.limb);
        paint('detail', geo.detail, pal.dark);
        paint('eyeL', geo.eyeL, claimCol);
        paint('eyeR', geo.eyeR, claimCol);

        // The word shows only what is LEFT to type: leftmost character next.
        // Exact character widths are unknowable server-side, so nothing is
        // positioned by measuring text - the label is centered, the progress
        // bar is a polygon, and every width here is a deliberate over-estimate
        // at the fat end of the font range (~0.85 x-units per char at size 1).
        const remaining = e.word.slice(e.progress);
        // Long phrases would sprawl over their neighbours, so a label shrinks
        // to a width budget. Sized from the FULL word, not the remaining text,
        // so it doesn't resize on every keystroke.
        const size = Math.max(TUNING.LABEL_MIN_SIZE, Math.min(e.textSize,
            TUNING.LABEL_MAX_W / Math.max(1, e.word.length * 0.85)));
        const wordW = Math.max(1, remaining.length) * size * 0.85;
        const top = e.py + e.bob - e.breed.height * e.s * YS;
        // Alternate label height within a lane, so two creatures abreast miss
        // each other vertically even when their labels overlap horizontally.
        const stagger = (e.slot % 2) * (size * YS + 0.8);
        const wordY = Math.max(14, top - size * YS - 1.4 - stagger);
        // Nudge fully onto the plane: a centered label on a creature near the
        // edge would otherwise have its far end pinned and distorted.
        const wordX = Math.max(wordW / 2, Math.min(100 - wordW / 2, e.px));

        e.wordNode.node.text.text = remaining;
        e.wordNode.node.text.x = wordX;
        e.wordNode.node.text.y = wordY;
        e.wordNode.node.text.size = size;
        const wc = locked ? claimCol : BONE;
        e.wordNode.node.text.color = [wc[0], wc[1], wc[2], fade];

        if (locked) {
            const full = Math.min(TUNING.LABEL_MAX_W, e.word.length * size * 0.72);
            const done = full * (e.progress / e.word.length);
            e.barNode.node.coordinates2d = ShapeUtils.rectangle(
                wordX - full / 2, wordY + size * YS + 0.4, Math.max(0.3, done), 0.8);
            e.barNode.node.fill = claimCol;
        } else {
            e.barNode.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            e.barNode.node.fill = [0, 0, 0, 0];
        }
    }

    drawFx() {
        for (let i = 0; i < this.fx.length; i++) {
            const f = this.fx[i];
            if (!f.active) continue;
            const k = f.life / f.max;
            f.node.node.coordinates2d = ShapeUtils.rectangle(f.x, f.y, f.size, f.size * YS);
            // fill alpha is effectively binary on the client; `color` alpha is
            // what actually fades a node.
            f.node.node.fill = [f.col[0], f.col[1], f.col[2], 255];
            f.node.node.color = [255, 255, 255, clamp255(235 * k)];
        }
    }

    drawHud() {
        this.waveText.node.text.text = 'WAVE ' + this.wave;
        this.scoreText.node.text.text = String(this.teamScore);

        const frac = Math.max(0, this.hp / TUNING.BARRICADE_HP);
        this.hpFill.node.coordinates2d = ShapeUtils.rectangle(35, 2.2, Math.max(0.2, 30 * frac), 2.4);
        const hpCol = mixColor(DANGER, SAFE, frac);
        this.hpFill.node.fill = hpCol;
        this.crystal.node.fill = hpCol;
        this.crystal.node.effects = { shadow: { color: [hpCol[0], hpCol[1], hpCol[2], 255], blur: 22 } };

        this.banner.node.text.text = this.bannerLeft > 0 ? ('WAVE ' + this.wave) : '';

        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            const pid = this.slotOwner[i];
            const w = pid !== undefined ? this.writers[pid] : null;
            if (!w) {
                card.chip.node.fill = [0, 0, 0, 0];
                card.name.node.text.text = '';
                card.score.node.text.text = '';
                continue;
            }
            const hot = this.clock < w.flash;
            card.chip.node.fill = hot ? DANGER : w.color;
            card.name.node.text.text = w.name;
            card.name.node.text.color = w.color;
            card.score.node.text.text = w.score + '  x' + (Math.round(w.combo * 100) / 100);
            card.score.node.text.color = hot ? DANGER : BONE;
        }
    }

    drawFrame() {
        for (let i = 0; i < this.enemies.length; i++) this.paintEnemy(this.enemies[i]);
        this.drawFx();
        this.drawHud();
    }

    // -----------------------------------------------------------------------
    // Input
    // -----------------------------------------------------------------------

    handleKeyDown(playerId, key) {
        const pid = Number(playerId);
        const w = this.writers[pid];
        if (!w) return;

        if (this.phase !== 'playing') {
            if (key === 'Enter' || key === ' ' || key.length === 1) this.startRun();
            return;
        }

        if (key === 'Backspace') {
            if (this.releaseTarget(pid)) this.base.node.onStateChange();
            return;
        }
        if (key.length !== 1) return;

        // The client re-sends a held key every ~33ms with no initial delay, so
        // a held key and a deliberate double-tap of the same letter arrive as
        // the exact same event. They are told apart by CADENCE: re-sends of a
        // held key land ~33ms apart, while the fastest realistic repeat of one
        // finger is ~90ms. A gap wider than HOLD_GAP_MS is a fresh press.
        //
        // keyup clears the state as well, so either signal alone is enough -
        // and that is what makes 'skull' and 'reply all' typeable. Auto-repeat
        // is never wanted here, so a held key types exactly once.
        const now = Date.now();
        const st = w.keys[key];
        if (st && now - st.seen <= TUNING.HOLD_GAP_MS) {
            st.seen = now;              // still held: heartbeat, do not type
            return;
        }
        w.keys[key] = { seen: now };

        if (this.typeChar(pid, key)) {
            this.drawHud();
            this.base.node.onStateChange();
        }
    }

    handleKeyUp(playerId, key) {
        const w = this.writers[Number(playerId)];
        if (w) delete w.keys[key];
    }

    // Mobile path: the text prompt hands back the field's whole contents each
    // time, so only the newly added characters are played as keystrokes.
    handleTypedString(playerId, value) {
        const pid = Number(playerId);
        const w = this.writers[pid];
        if (!w) return;
        if (this.phase !== 'playing') { this.startRun(); return; }

        const text = String(value || '');
        const prev = w.lastInput || '';
        let added = text;
        if (text.length >= prev.length && text.slice(0, prev.length) === prev) {
            added = text.slice(prev.length);
        }
        w.lastInput = text;

        let touched = false;
        for (let i = 0; i < added.length; i++) {
            if (this.typeChar(pid, added.charAt(i))) touched = true;
        }
        if (touched) {
            this.drawHud();
            this.base.node.onStateChange();
        }
    }

    // -----------------------------------------------------------------------
    // Platform hooks
    // -----------------------------------------------------------------------

    handleNewPlayer({ playerId, info }) {
        const pid = Number(playerId);
        let slot = 0;
        while (slot < MAX_PLAYERS && this.slotOwner[slot] !== undefined) slot++;
        if (slot >= MAX_PLAYERS) slot = MAX_PLAYERS - 1;
        this.slotOwner[slot] = pid;

        const name = String((info && info.name) || ('PLAYER ' + pid)).toUpperCase().slice(0, 9);
        this.writers[pid] = {
            slot: slot,
            color: PLAYER_COLORS[slot],
            name: name,
            score: 0,
            combo: 1,
            kills: 0,
            typed: 0,
            misses: 0,
            target: null,
            flash: 0,
            keys: {},
            lastInput: ''
        };

        // Every connected player owns at least one scoped node, which also
        // keeps them on the filtered-frame path.
        this.cards[slot].you.node.playerIds = [pid];
        this.drawHud();
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        const pid = Number(playerId);
        const w = this.writers[pid];
        if (!w) return;
        this.releaseTarget(pid);
        this.cards[w.slot].you.node.playerIds = [0];
        delete this.slotOwner[w.slot];
        delete this.writers[pid];
        this.drawHud();
        this.base.node.onStateChange();
    }
}

module.exports = Deadword;