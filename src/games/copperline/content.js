'use strict';

// All simulation and rendering content is ordinary data so the same frontier runs
// in a hosted Squish session and in an offline, single-player download.
const WEAPONS = [
    { id: 'revolver', name: 'Mercy No. 6', price: 0, description: 'Your mother’s pearl-handled six-shooter. Steady, quick, dependable.', damage: 26, clip: 6, rate: 0.34, reload: 1.15, range: 48, pellets: 1, color: [238, 187, 108] },
    { id: 'scattergun', name: 'Choirbreaker', price: 125, description: 'A sawed-off brass shotgun. Five pellets make an emphatic introduction.', damage: 17, clip: 2, rate: 0.72, reload: 1.55, range: 28, pellets: 5, color: [246, 137, 88] },
    { id: 'repeater', name: 'Sunspike Repeater', price: 240, description: 'A long copper lever-action rifle with excellent reach and a fast action.', damage: 32, clip: 9, rate: 0.25, reload: 1.65, range: 70, pellets: 1, color: [255, 200, 83] },
    { id: 'voltaic', name: 'Saint Elmo', price: 390, description: 'Inez’s forbidden induction carbine. Blue lightning jumps between nearby enemies.', damage: 45, clip: 5, rate: 0.52, reload: 1.8, range: 57, pellets: 1, color: [79, 237, 238] }
];

const UPGRADES = [
    { id: 'longbarrel', name: 'Copper Longbarrel', price: 85, description: 'A visibly extended copper barrel. +25% damage and +20% range.', damage: 1.25, range: 1.2 },
    { id: 'brasscoil', name: 'Stormcoil Assembly', price: 145, description: 'Exposed turquoise coils crackle along the barrel. Every hit shocks a nearby enemy.', chain: 14 },
    { id: 'drummag', name: 'Clockwork Drum', price: 115, description: 'A chunky brass ammunition drum. +4 rounds per magazine, faster reloads.', clip: 4, reload: 0.75 }
];

const OUTFITS = [
    { id: 'trailcoat', name: 'Dustroad Denim', price: 0, description: 'Indigo coat, coral neckerchief, battered ivory hat. The clothes you came home in.', armor: 0, color: [68, 114, 159] },
    { id: 'redponcho', name: 'Sunset Serape', price: 90, description: 'A vivid woven coral poncho and a wide black hat. 12% damage resistance.', armor: 0.12, color: [231, 89, 75] },
    { id: 'duster', name: 'Midnight Marshal', price: 180, description: 'An emerald-lined violet duster, brass shoulders, and midnight hat. 24% resistance.', armor: 0.24, color: [107, 72, 148] }
];

const PROPERTIES = [
    { id: 'homestead', name: 'Wren Homestead', price: 140, description: 'A real place to return to. Your arsenal, wardrobe, and trophies appear on the porch.', income: 14, x: 35, y: 57, building: 'homestead' },
    { id: 'saloon', name: 'The Last Light', price: 290, description: 'Buy June’s saloon together. Warm lamps, a piano, your guns on the wall, and steady rent.', income: 28, x: 61, y: 43, building: 'saloon' },
    { id: 'ranch', name: 'Painted Sky Ranch', price: 420, description: 'A sprawling Ironwood ranch with a stable, water troughs, and a furnished terrace.', income: 42, x: 100, y: 183, building: 'ranch' }
];

const PERKS = [
    { id: 'vigor', name: 'Iron Heart', price: 1, description: '+25 maximum health. Recover the added health immediately.' },
    { id: 'gunslinger', name: 'Sure Hands', price: 1, description: '+15% weapon damage and steadier frontier justice.' },
    { id: 'rider', name: 'Wind Rider', price: 1, description: 'A faster horse and a quicker stamina recovery.' }
];

const MISSIONS = [
    { id: 'homecoming', title: '01 · A town that remembers', description: 'You are Rowan Wren, returning after seven years. Marshal June Bell kept your mother’s last letter. Find her outside The Last Light.', x: 62, y: 54, npc: 'june', reward: 35, xp: 35 },
    { id: 'letter', title: '02 · Ash in the canyon', description: 'Cinderjack’s riders stole the water deeds. Ride east to Red Mesa, defeat the gang, and search their strongbox.', x: 120, y: 65, enemies: 4, reward: 85, xp: 85 },
    { id: 'workshop', title: '03 · A little thunder', description: 'The stolen ledger describes a machine at Blackglass Foundry. Inez Rojas can read it. Find her at the workshop in Copperline.', x: 76, y: 67, npc: 'inez', reward: 45, xp: 45 },
    { id: 'water', title: '04 · Water for the living', description: 'Vale’s men chained the river pumps shut. Clear the Glass Basin reservoir and restart the public water supply.', x: 174, y: 179, enemies: 5, reward: 135, xp: 110 },
    { id: 'prisoners', title: '05 · The midnight passengers', description: 'Ada’s railway crew are prisoners aboard the Copperline Express. Mount your horse, reach the tracks, board the moving train, and free them.', x: 156, y: 92, enemies: 4, reward: 180, xp: 140 },
    { id: 'witness', title: '06 · A witness worth keeping', description: 'Ada Quinn escaped to the Salt Flats depot. She knows how to break the engine that is draining the valley. Meet her by the eastern station.', x: 237, y: 108, npc: 'ada', reward: 65, xp: 70 },
    { id: 'foundry', title: '07 · Break the black heart', description: 'Storm Blackglass Foundry. Destroy its defenders, then vent the great dynamo. The railroad’s private army loses its power with it.', x: 260, y: 180, enemies: 6, reward: 220, xp: 180 },
    { id: 'baron', title: '08 · No kings west of here', description: 'Silas Vale waits at Crownridge with his last guns. Defeat his guards and his armored gun rig, then decide what justice looks like.', x: 277, y: 50, enemies: 5, reward: 300, xp: 230 },
    { id: 'charter', title: '09 · A place called tomorrow', description: 'The deeds are yours. Return to June in Copperline and decide who the valley will belong to. The story ends; your frontier continues.', x: 62, y: 54, npc: 'june', reward: 180, xp: 120 }
];

const BOUNTIES = [
    { id: 'rattler', name: 'Rattler Voss', title: 'The Rattler Gang', description: 'A toll gang is trapping ranchers at Ironwood Crossing.', x: 75, y: 151, count: 4, reward: 95, xp: 80 },
    { id: 'opal', name: 'Opal Crow', title: 'Ghosts of the Salt Flats', description: 'Opal Crow’s gunhands stole a medicine shipment.', x: 218, y: 135, count: 5, reward: 140, xp: 100 },
    { id: 'coyote', name: 'The Copper Coyote', title: 'Coyote at the canyon', description: 'The old smuggler camp is occupied again. Clear it for the travelers.', x: 158, y: 36, count: 6, reward: 190, xp: 135 }
];

const TUNING = {
    width: 320, height: 240, playerHp: 100, playerSpeed: 17, horseSpeed: 32,
    sprint: 1.45, dodgeSpeed: 46, dodgeDuration: 0.3, dodgeCost: 28,
    staminaRegen: 21, focusRegen: 4, focusDuration: 4, focusSlow: 0.3,
    interactDistance: 9, enemyNotice: 43, enemyRange: 30, enemySpeed: 8,
    bulletSpeed: 87, enemyBulletSpeed: 32, enemyDamage: 12, enemyWindup: 0.8,
    enemyCooldown: 1.85, trainSpeed: 18, trainLeft: 12, trainRight: 308, trainRear: -48, trainSpan: 45,
    incomeInterval: 95, maxEnemies: 36, maxShots: 100, maxEffects: 60, maxLoot: 80
};

function buildWorld() {
    const buildings = [];
    const add = (id, x, y, w, d, h, kind, name, color) => buildings.push({ id, x, y, w, d, h, kind, name, color });
    add('saloon', 61, 43, 16, 12, 12, 'saloon', 'THE LAST LIGHT', [182, 95, 78]);
    add('sheriff', 46, 44, 10, 10, 8, 'sheriff', 'MARSHAL', [81, 146, 153]);
    add('gunsmith', 78, 56, 12, 11, 9, 'shop', 'ROJAS & SPARK', [66, 139, 152]);
    add('outfitter', 51, 75, 11, 10, 9, 'shop', 'EZRA’S GOODS', [156, 111, 167]);
    add('clinic', 80, 77, 11, 10, 8, 'house', 'DR SOL', [215, 182, 123]);
    add('homestead', 35, 57, 11, 10, 8, 'house', 'WREN HOMESTEAD', [99, 148, 146]);
    add('station', 61, 103, 19, 9, 8, 'station', 'COPPERLINE', [209, 141, 81]);
    add('ranch', 100, 183, 17, 12, 10, 'barn', 'PAINTED SKY', [183, 93, 100]);
    add('ranchhouse', 81, 185, 11, 9, 8, 'house', 'BUNKHOUSE', [109, 159, 146]);
    add('pumphouse', 174, 166, 15, 14, 12, 'pump', 'GLASS BASIN', [64, 159, 168]);
    add('depot', 236, 101, 17, 9, 8, 'station', 'SALT FLATS', [176, 136, 170]);
    add('foundry', 260, 164, 25, 18, 21, 'mine', 'BLACKGLASS', [102, 97, 133]);
    add('forgeannex', 280, 170, 11, 14, 13, 'warehouse', 'COAL & COPPER', [149, 89, 113]);
    add('manor', 277, 30, 24, 18, 20, 'manor', 'VALE ESTATE', [198, 156, 159]);
    add('watchtower', 296, 45, 7, 7, 17, 'fort', 'NORTH GUARD', [99, 110, 148]);
    add('outpost', 117, 51, 12, 10, 8, 'warehouse', 'RED MESA', [180, 106, 86]);
    const regions = [
        { id: 'town', name: 'COPPERLINE', x: 61, y: 61, color: [210, 139, 95] },
        { id: 'redmesa', name: 'RED MESA', x: 142, y: 54, color: [206, 111, 107] },
        { id: 'saltflats', name: 'SALT FLATS', x: 232, y: 116, color: [203, 174, 183] },
        { id: 'ironwood', name: 'IRONWOOD RANGE', x: 78, y: 179, color: [132, 161, 120] },
        { id: 'glassbasin', name: 'GLASS BASIN', x: 177, y: 181, color: [105, 179, 165] },
        { id: 'crownridge', name: 'CROWNRIDGE', x: 271, y: 38, color: [151, 124, 177] }
    ];
    const npcs = [
        { id: 'june', name: 'Marshal June Bell', x: 62, y: 54, color: [219, 123, 96] },
        { id: 'inez', name: 'Inez Rojas', x: 76, y: 67, color: [74, 206, 197] },
        { id: 'ezra', name: 'Ezra Finch', x: 51, y: 84, color: [221, 156, 78] },
        { id: 'sol', name: 'Dr. Sol Mercer', x: 81, y: 86, color: [146, 192, 134] },
        { id: 'ada', name: 'Ada Quinn', x: 237, y: 108, color: [203, 122, 180] },
        { id: 'vale', name: 'Silas Vale', x: 277, y: 43, color: [132, 109, 166] }
    ];
    const props = [];
    const prop = (id, x, y, kind, size, seed) => props.push({ id, x, y, kind, size, seed });
    const clearings = MISSIONS.concat(BOUNTIES, npcs, [{ x: 34, y: 77 }, { x: 91, y: 150 }, { x: 209, y: 107 }]);
    // Mesas are real cliffs, so their whole footprint must clear roads, doors,
    // and combat arenas. Their height also needs a generous sightline margin.
    const mesaFits = (x, y, size) => {
        if (x - size < 4 || x + size > TUNING.width - 4 || y - size * 0.7 < 4 || y + size * 0.7 > TUNING.height - 4) return false;
        if (clearings.some(c => Math.hypot(x - c.x, y - c.y) < size + 22)) return false;
        if (buildings.some(b => Math.abs(x - b.x) < b.w / 2 + size + 10 && Math.abs(y - b.y) < b.d / 2 + size * 0.7 + 14)) return false;
        if (x + size > 52 && x - size < 73) return false;
        if (y + size * 0.7 > 52 && y - size * 0.7 < 74) return false;
        if (Math.abs(y - 92) < size * 0.7 + 9) return false;
        return true;
    };
    let seed = 1789;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 280; i++) {
        const x = 5 + random() * 310, y = 6 + random() * 228;
        if (Math.abs(y - 92) < 7 || buildings.some(b => Math.abs(x - b.x) < b.w / 2 + 8 && Math.abs(y - b.y) < b.d / 2 + 10) || Math.hypot(x - 62, y - 64) < 19) continue;
        const kind = y > 131 && x < 125 ? (i % 3 ? 'tree' : 'rock') : x > 140 && y > 141 && x < 215 ? (i % 4 ? 'crystal' : 'rock') : i % 7 === 0 ? 'mesa' : i % 3 ? 'cactus' : 'rock';
        const size = kind === 'mesa' ? 8 + random() * 10 : 2 + random() * 3;
        if (kind === 'mesa' && !mesaFits(x, y, size)) continue;
        prop('land-' + i, x, y, kind, size, i);
    }
    // Deliberate silhouettes at the quiet edges keep the horizon distinctive.
    [[21, 19, 11], [186, 16, 10], [238, 20, 11], [301, 208, 12], [282, 222, 15], [24, 127, 11]].forEach((m, i) => {
        if (props.filter(p => p.kind === 'mesa').length < 9 && mesaFits(m[0], m[1], m[2])) prop('scenic-mesa-' + i, m[0], m[1], 'mesa', m[2], 400 + i);
    });
    prop('town-water', 66, 77, 'water', 4, 1);
    prop('ranch-water', 109, 195, 'water', 5, 2);
    prop('pump-water', 181, 184, 'water', 12, 3);
    prop('windmill', 168, 163, 'windmill', 8, 2);
    prop('windmill-ranch', 112, 180, 'windmill', 9, 3);
    prop('camp-town', 34, 77, 'camp', 3, 1);
    prop('camp-ironwood', 91, 150, 'camp', 3, 2);
    prop('camp-salt', 209, 107, 'camp', 3, 3);
    prop('wagon-town', 39, 86, 'wagon', 5, 2);
    prop('wagon-canyon', 127, 70, 'wagon', 5, 3);
    prop('grave-mother', 29, 43, 'grave', 2.5, 4);
    prop('strongbox', 120, 65, 'crate', 2.3, 1);
    prop('dynamo', 260, 180, 'crystal', 6, 8);
    for (let i = 0; i < 10; i++) prop('ranch-fence-' + i, 91 + i * 3, 202, 'fence', 3, i);
    return { width: TUNING.width, height: TUNING.height, buildings, props, npcs, regions, tracks: [{ x: 8, y: 92 }, { x: 312, y: 92 }] };
}

module.exports = { WEAPONS, UPGRADES, OUTFITS, PROPERTIES, PERKS, MISSIONS, BOUNTIES, TUNING, buildWorld };
