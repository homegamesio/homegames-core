'use strict';

// Distances are world units; the default field fits the 160 x 100 game canvas.
// Larger authored fields use the same scale and combat distances.
const TOWERS = {
    deputy: { name: 'Deputy', cost: 70, range: 18, damage: 9, interval: .7, color: [63, 145, 185], unlock: 0,
        upgrades: [65, 125, 235], branches: ['Fan the hammer', 'Marshal'], symbols: ['burst', 'shield'],
        hints: ['Three targets', 'Armor piercing'] },
    rifle: { name: 'Ranger', cost: 115, range: 30, damage: 30, interval: 1.6, pierce: 3, color: [76, 133, 96], unlock: 1,
        upgrades: [95, 170, 290], branches: ['Deadeye', 'Repeater'], symbols: ['target', 'fast'],
        hints: ['Heavy piercing shot', 'Quick long shots'] },
    lasso: { name: 'Wrangler', cost: 90, range: 18, damage: 3, interval: 1.1, slow: .55, duration: 2, color: [157, 104, 170], unlock: 3,
        upgrades: [80, 140, 240], branches: ['Roundup', 'Bounty hunter'], symbols: ['ring', 'target'],
        hints: ['Snare a whole group', 'Mark for extra damage'] },
    dynamite: { name: 'Prospector', cost: 140, range: 22, damage: 32, interval: 2.1, splash: 6, pierce: 99, color: [217, 91, 66], unlock: 5,
        upgrades: [110, 190, 320], branches: ['Powder keg', 'Brushfire'], symbols: ['burst', 'fire'],
        hints: ['Bigger explosions', 'Burning ground'] },
    gatling: { name: 'Gatling', cost: 190, range: 20, damage: 5, interval: .2, color: [57, 145, 143], unlock: 8,
        upgrades: [140, 230, 380], branches: ['Lead storm', 'Crossfire'], symbols: ['fast', 'burst'],
        hints: ['Shred armor', 'Sweep three targets'] },
    banjo: { name: 'Bard', cost: 125, range: 19, damage: 0, interval: 1, aura: 1.22, color: [220, 154, 63], unlock: 12,
        upgrades: [90, 160, 270], branches: ['Rally', 'Payday'], symbols: ['music', 'coin'],
        hints: ['Stronger posse aura', 'Extra pay each wave'] },
};
const ENEMIES = {
    drifter: { name: 'Bandit', hp: 28, speed: 4.6, loot: 1, bounty: 6, armor: 0, color: [192, 77, 62] },
    runner: { name: 'Runner', hp: 23, speed: 8.5, loot: 1, bounty: 7, armor: 0, color: [228, 146, 61] },
    rider: { name: 'Rider', hp: 82, speed: 7, loot: 2, bounty: 12, armor: 0, color: [158, 75, 114] },
    iron: { name: 'Ironcoat', hp: 145, speed: 3.7, loot: 3, bounty: 17, armor: 6, color: [91, 107, 128] },
    outlaw: { name: 'Outlaw', hp: 130, speed: 6.2, loot: 3, bounty: 15, armor: 2, color: [85, 68, 104] },
    wagon: { name: 'Gold wagon', hp: 400, speed: 3, loot: 6, bounty: 36, armor: 7, color: [137, 88, 58] },
    brute: { name: 'Big Hat', hp: 440, speed: 4.2, loot: 5, bounty: 30, armor: 3, color: [103, 91, 66] },
    baron: { name: 'The Baron', hp: 6000, speed: 2.7, loot: 15, bounty: 90, armor: 12, color: [62, 47, 65] },
};
const THEMES = [
    { name: 'SUNDUST TRAIL', sand: [231, 192, 126], light: [242, 208, 146], rock: [188, 102, 69], sage: [94, 146, 113], sky: [121, 182, 183] },
    { name: 'RED ROCK PASS', sand: [220, 156, 110], light: [237, 181, 128], rock: [165, 77, 68], sage: [83, 136, 123], sky: [117, 165, 187] },
    { name: 'SAGEBRUSH COUNTY', sand: [197, 193, 128], light: [221, 214, 150], rock: [157, 119, 86], sage: [71, 126, 112], sky: [145, 187, 174] },
    { name: 'COPPER CANYON', sand: [209, 163, 131], light: [229, 190, 149], rock: [151, 86, 88], sage: [87, 133, 125], sky: [133, 151, 178] },
    { name: 'LAST CHANCE', sand: [208, 170, 121], light: [229, 195, 141], rock: [133, 81, 88], sage: [79, 124, 116], sky: [188, 149, 153] },
    { name: 'PAINTED DESERT', sand: [229, 169, 151], light: [244, 196, 171], rock: [165, 86, 115], sage: [79, 141, 132], sky: [139, 176, 198] },
    { name: 'RATTLER GULCH', sand: [210, 181, 111], light: [236, 209, 143], rock: [145, 96, 67], sage: [82, 126, 101], sky: [157, 187, 162] },
    { name: 'GHOSTWATER BASIN', sand: [175, 196, 181], light: [205, 216, 193], rock: [117, 112, 146], sage: [67, 132, 132], sky: [154, 169, 204] },
    { name: 'BLACK MESA', sand: [188, 168, 164], light: [215, 192, 177], rock: [103, 89, 116], sage: [78, 137, 129], sky: [183, 152, 186] },
    { name: 'DEVIL\'S DOOR', sand: [224, 160, 117], light: [246, 192, 141], rock: [142, 66, 81], sage: [65, 128, 128], sky: [213, 148, 151] },
];
const DECOR = ['cactus', 'rock', 'barrel', 'fence', 'tumbleweed', 'trough'];
const ORDER = Object.keys(TOWERS), ENEMY_ORDER = Object.keys(ENEMIES);
const FIELD = { x: 4, y: 18, w: 116, h: 62 }, ROAD = 2.4, RADIUS = 2.2;
const fieldFor = level => ({ ...FIELD, w: level?.bounds?.w ?? FIELD.w, h: level?.bounds?.h ?? FIELD.h });
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function stats(tower) {
    const base = TOWERS[tower.kind];
    const s = { ...base, pierce: base.pierce || 0, targets: 1, fire: 0, mark: 1, income: 0 };
    const r = tower.rank || 0, b = tower.branch || 0;
    if (r >= 1) { s.damage *= 1.45; s.range += 2; if (s.slow) s.duration += .5; if (s.aura) s.aura = 1.32; }
    if (r >= 2) {
        if (tower.kind === 'deputy') { if (!b) { s.targets = 3; s.interval *= .8; } else { s.damage *= 2; s.pierce = 8; } }
        if (tower.kind === 'rifle') { if (!b) { s.damage *= 2.5; s.pierce = 99; s.range += 5; } else s.interval *= .42; }
        if (tower.kind === 'lasso') { if (!b) { s.targets = 5; s.slow = .38; } else { s.mark = 1.55; s.damage = 15; s.slow = .45; } }
        if (tower.kind === 'dynamite') { if (!b) { s.splash = 9; s.damage *= 1.5; } else s.fire = 12; }
        if (tower.kind === 'gatling') { if (!b) { s.damage *= 1.5; s.pierce = 6; } else s.targets = 3; }
        if (tower.kind === 'banjo') { if (!b) { s.aura = 1.65; s.range += 4; } else { s.income = 28; s.aura = 1.4; } }
    }
    if (r >= 3) {
        s.damage *= 1.7; s.range += 3; s.interval *= .82;
        if (s.slow) { s.duration += 1; s.targets += 2; }
        if (s.fire) s.fire = 24;
        if (s.aura) { s.aura += .2; s.income *= 2; }
    }
    return s;
}

module.exports = { TOWERS, ENEMIES, THEMES, DECOR, ORDER, ENEMY_ORDER, FIELD, fieldFor, ROAD, RADIUS, stats, clone, clamp };
