'use strict';

const MODULES = [
    { id: 'spark', name: 'Spark Spitter', slot: 'weapon', price: 0, scrap: 0, crystal: 0, description: 'Twin amber pulse cannons. Reliable, forgiving, and patched more times than the captain.', color: [255, 201, 93, 255], damage: 23, rate: .23, heat: 5, energy: 3, range: 95, pellets: 1 },
    { id: 'lance', name: 'Prism Lance', slot: 'weapon', price: 130, scrap: 30, crystal: 3, description: 'A long cyan crystal barrel. Piercing bolts punch through two targets.', color: [88, 243, 242, 255], damage: 56, rate: .62, heat: 13, energy: 10, range: 125, pellets: 1, pierce: 2 },
    { id: 'scatter', name: 'Petal Cannon', slot: 'weapon', price: 145, scrap: 38, crystal: 2, description: 'Five coral petals unfold into a close-range plasma fan.', color: [255, 119, 134, 255], damage: 16, rate: .55, heat: 15, energy: 8, range: 62, pellets: 5 },
    { id: 'orbit', name: 'Firefly Launcher', slot: 'weapon', price: 240, scrap: 65, crystal: 6, description: 'A rotating violet missile cradle. Guided fireflies burst into a field of sparks.', color: [188, 144, 255, 255], damage: 62, rate: .72, heat: 15, energy: 12, range: 110, pellets: 1, homing: true, splash: 12 },
    { id: 'sunblade', name: 'Dawn Needle', slot: 'weapon', price: 390, scrap: 100, crystal: 12, description: 'A golden relic array built around a living star shard. Heavy, piercing solar bolts.', color: [255, 226, 127, 255], damage: 96, rate: .78, heat: 21, energy: 16, range: 135, pellets: 1, pierce: 3 },
    { id: 'port-wing', name: 'Port Stabilizer', slot: 'port', price: 0, scrap: 0, crystal: 0, description: 'A scrappy coral wing with a visibly patched cargo clamp.', color: [243, 124, 137, 255] },
    { id: 'tractor', name: 'Magpie Tractor', slot: 'port', price: 110, scrap: 25, crystal: 3, description: 'An open teal magnetic claw. Pulls loot from 36 units away; +20% salvage.', color: [82, 235, 201, 255], tractor: 36, salvage: .2 },
    { id: 'arc-pod', name: 'Storm Orchard', slot: 'port', price: 205, scrap: 50, crystal: 7, description: 'Three exposed lilac capacitors arc damage between nearby enemies.', color: [188, 161, 255, 255], chain: 18 },
    { id: 'starboard-wing', name: 'Starboard Stabilizer', slot: 'starboard', price: 0, scrap: 0, crystal: 0, description: 'A sun-yellow wing, a working navigation lamp, and some optimistic tape.', color: [255, 205, 102, 255] },
    { id: 'bulwark', name: 'Lantern Shield', slot: 'starboard', price: 170, scrap: 45, crystal: 4, description: 'A broad hexagonal shield drum. +70 shield capacity and faster recharge.', color: [105, 212, 255, 255], shield: 70, shieldRegen: 4 },
    { id: 'missile-pod', name: 'Pocket Meteor', slot: 'starboard', price: 225, scrap: 60, crystal: 6, description: 'Four little red launch tubes automatically fire an extra rocket during sustained fire.', color: [255, 137, 112, 255], missile: 36 },
    { id: 'ion-drive', name: 'Secondhand Ion Drive', slot: 'drive', price: 0, scrap: 0, crystal: 0, description: 'A pair of bright amber thrusters. Old engines, a good heart.', color: [255, 193, 91, 255], speed: 26, energyRegen: 13, dashCooldown: 3 },
    { id: 'comet-drive', name: 'Comet Tail', slot: 'drive', price: 160, scrap: 45, crystal: 4, description: 'Triple cyan exhaust bells. Much faster cruise and boost speed.', color: [78, 235, 242, 255], speed: 36, energyRegen: 14, dashCooldown: 2.4 },
    { id: 'fold-drive', name: 'Ribbon Fold', slot: 'drive', price: 275, scrap: 70, crystal: 9, description: 'Twin lilac field rings. Rapid dash recovery and excellent energy regeneration.', color: [190, 149, 255, 255], speed: 32, energyRegen: 20, dashCooldown: 1.35 },
    { id: 'patchwork-hull', name: 'Kestrel Frame', slot: 'hull', price: 0, scrap: 0, crystal: 0, description: 'An ivory wedge with a coral cockpit. Home, if you squint.', color: [224, 227, 221, 255], hull: 145, shield: 65 },
    { id: 'cargo-hull', name: 'Bumblebee Freighter', slot: 'hull', price: 180, scrap: 55, crystal: 3, description: 'An expanded gold cargo belly with external containers. 200 hull and +25% salvage.', color: [255, 203, 103, 255], hull: 200, shield: 75, salvage: .25 },
    { id: 'aegis-hull', name: 'Aurora Aegis', slot: 'hull', price: 335, scrap: 90, crystal: 10, description: 'Layered violet armor plates and a luminous teal spine. 265 hull and 105 shields.', color: [175, 154, 227, 255], hull: 265, shield: 105 }
];

const CREW = [
    { id: 'moth', name: 'Moth', role: 'Navigator', description: 'A soft-spoken cartographer who hears the shape of space. +20 shields, faster boost recovery, and a new map of home.', color: [188, 164, 255, 255], story: 'Moth was a survey drone before deciding that maps should mark places worth loving, not just places worth mining.' },
    { id: 'oru', name: 'Oru Venn', role: 'Engineer', description: 'A giant mechanic with tiny origami birds in every pocket. Repairs 2 hull per second outside combat and improves shield recharge.', color: [99, 229, 214, 255], story: 'Oru built evacuation ships during the moonfall. One was never launched. He has spent twelve years fixing things that can still be saved.' },
    { id: 'pip', name: 'Pip Nine', role: 'Archivist & cook', description: 'An excitable little service automaton. +20% recovered salvage and half oxygen consumption while boarding.', color: [255, 142, 137, 255], story: 'Pip keeps recipes in the same archive as extinct languages. “A civilization is not gone,” they say, “until nobody remembers how it made breakfast.”' }
];

const SUPPLIES = [
    { id: 'medkit', name: 'Repair kit', price: 30, scrap: 5, crystal: 0, description: 'Emergency repair foam: restores 85 hull in flight or 65 suit health while boarding. Carry up to 30.', color: [111, 241, 193, 255] },
    { id: 'crystal-pack', name: 'Five refined crystals', price: 50, scrap: 10, crystal: 0, description: 'Five refined star crystals, ready for advanced ship modules.', color: [166, 160, 255, 255] }
];

const MISSIONS = [
    { id: 'welcome', title: '01 · A light left on', description: 'Meet station keeper Mara at Lantern Anchorage. The Kestrel needs work, and the valley of stars needs you.', sector: 0, poi: 'lantern', reward: 35 },
    { id: 'first-salvage', title: '02 · Someone else’s tomorrow', description: 'Clear the scavenger drones around the Sable, board its airlock, and recover the singing star fragment from its bridge.', sector: 0, poi: 'sable', wreck: 'sable', spaceCount: 3, boardCount: 2, reward: 95 },
    { id: 'navigator', title: '03 · The map that dreams', description: 'Find the survey ship Lark in the Orchard of Hulls. A stranded navigator is still transmitting from inside.', sector: 1, poi: 'lark', wreck: 'lark', spaceCount: 3, boardCount: 4, reward: 140 },
    { id: 'prism-network', title: '04 · Three notes of a song', description: 'Clear the guardians and tune all three Prismwake relays. Their harmonic map will open the route into the broken moon.', sector: 2, poi: 'prism-a', relays: ['prism-a', 'prism-b', 'prism-c'], reward: 190 },
    { id: 'engineer', title: '05 · The last lifeboat', description: 'The Mercy still has a heartbeat. Board the rescue ship in Prismwake and bring engineer Oru Venn home.', sector: 2, poi: 'mercy', wreck: 'mercy', spaceCount: 3, boardCount: 4, reward: 190 },
    { id: 'archive', title: '06 · What the silence kept', description: 'Defeat the Needle Queen in Choirgrave, then board the archive ship Choir. Decide what happens to its irreplaceable memories.', sector: 3, poi: 'needle-queen', wreck: 'choir', spaceCount: 4, boardCount: 5, boss: 'queen', reward: 270 },
    { id: 'archivist', title: '07 · A seat at the table', description: 'Pip Nine is waiting at the Freehouse. The archive’s last caretaker has an improbable plan for a living star.', sector: 3, poi: 'freehouse', reward: 100 },
    { id: 'blockade', title: '08 · A door nobody owns', description: 'Break the Red Meridian blockade and disable Stormgate’s weapons grid. The salvage guild cannot fence off the stars.', sector: 4, poi: 'stormgate', spaceCount: 6, reward: 260 },
    { id: 'carrier', title: '09 · Into the sunward dark', description: 'Board the Sunward carrier. Shut down its two anchor consoles, then release the lock on the star engine.', sector: 4, poi: 'sunward', wreck: 'sunward', spaceCount: 4, boardCount: 6, reward: 300 },
    { id: 'dawn', title: '10 · The shape of tomorrow', description: 'Face the last Warden at the Heart of Dawn. When its armor falls, choose a future for the living star—and everyone who depends on it.', sector: 5, poi: 'heart', spaceCount: 5, boss: 'warden', reward: 400 }
];

const CONTRACTS = [
    { id: 'orchard-run', name: 'Orchard patrol', description: 'Protect the civilian salvage lanes from four raiders.', sector: 1, x: 126, y: 125, count: 4, reward: 105, scrap: 28, crystal: 3 },
    { id: 'prism-cleanup', name: 'Prism cleanup', description: 'Clear five rogue guardians from the crystal gardens.', sector: 2, x: 110, y: 91, count: 5, reward: 155, scrap: 38, crystal: 5 },
    { id: 'meridian-escort', name: 'A safer crossing', description: 'Scatter the six privateers haunting Red Meridian.', sector: 4, x: 112, y: 72, count: 6, reward: 220, scrap: 55, crystal: 7 }
];

const TUNING = {
    width: 240, height: 180, shipRadius: 3, pilotRadius: 1, interactRange: 10,
    shipAcceleration: 6, boostMultiplier: 1.75, boostDrain: 29, boostRegen: 20,
    pilotSpeed: 15, pilotHp: 100, oxygenDrain: .25, bulletSpeed: 112, enemyBulletSpeed: 35,
    shieldDelay: 4, shieldRegen: 10, heatCool: 27, damageInvulnerability: .22,
    enemyRange: 62, enemyNotice: 88, enemyWindup: .8, enemyCooldown: 1.6,
    maxEnemies: 32, maxShots: 96, maxLoot: 64, maxEffects: 64
};

function sector(id, name, subtitle, color, pois, seed, landmark) {
    let state = seed;
    const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
    const rocks = [];
    for (let i = 0; i < 34; i++) {
        const x = 13 + rand() * 214, y = 13 + rand() * 154, radius = 3.2 + rand() * 4.8;
        if (pois.some(p => Math.hypot(p.x - x, p.y - y) < (p.radius || 10) + radius + 22) || Math.hypot(x - 56, y - 96) < 28) continue;
        if (CONTRACTS.some(c => c.sector === id && Math.hypot(x - c.x, y - c.y) < radius + 24)) continue;
        rocks.push({ id: 'rock-' + i, x, y, radius, seed: i + seed, crystal: i % 4 === 0, hp: radius * 7, maxHp: radius * 7 });
    }
    return { id, name, subtitle, color, width: 240, height: 180, pois, rocks, landmark, spawn: { x: 56, y: 96 } };
}
const poi = (id, name, kind, x, y, radius, extra) => Object.assign({ id, name, kind, x, y, radius }, extra || {});
const SECTORS = [
    sector(0, 'Lantern Anchorage', 'A small light in a very large dark', [57, 112, 141, 255], [poi('lantern', 'Lantern Anchorage', 'station', 35, 91, 13), poi('sable', 'Sable · cargo wreck', 'wreck', 172, 80, 13), poi('home-relay', 'Old weather beacon', 'relay', 112, 145, 6), poi('gate-0', 'Orchard slipstream', 'gate', 214, 140, 8)], 179, 'moon'),
    sector(1, 'Orchard of Hulls', 'Where old ships become new beginnings', [154, 83, 121, 255], [poi('wayfarer', 'Wayfarer’s Rest', 'station', 35, 91, 13), poi('lark', 'Lark · survey frigate', 'wreck', 170, 69, 14), poi('orchard-relay', 'Garden buoy', 'relay', 78, 143, 6), poi('gate-1', 'Prismwake aperture', 'gate', 212, 140, 8)], 291, 'debris'),
    sector(2, 'Prismwake Belt', 'The stars have learned to sing', [71, 140, 158, 255], [poi('prism-dock', 'Glass Harbor', 'station', 35, 91, 13), poi('prism-a', 'Relay Alto', 'relay', 101, 35, 6), poi('prism-b', 'Relay Tenor', 'relay', 185, 42, 6), poi('prism-c', 'Relay Bass', 'relay', 148, 145, 6), poi('mercy', 'Mercy · rescue ship', 'wreck', 192, 115, 13), poi('gate-2', 'Choirgrave passage', 'gate', 218, 156, 8)], 379, 'crystals'),
    sector(3, 'Choirgrave', 'A thousand voices in the quiet', [104, 79, 163, 255], [poi('freehouse', 'The Freehouse', 'station', 35, 91, 13), poi('needle-queen', 'The Needle Queen', 'boss', 169, 65, 20), poi('choir', 'Choir · memory ark', 'wreck', 178, 119, 14), poi('gate-3', 'Red Meridian scar', 'gate', 214, 155, 8)], 467, 'ring'),
    sector(4, 'Red Meridian', 'No empire gets to own the horizon', [176, 83, 99, 255], [poi('resistance', 'Patchwork Resistance', 'station', 35, 91, 13), poi('stormgate', 'Stormgate battery', 'relay', 150, 127, 8), poi('sunward', 'Sunward · command carrier', 'wreck', 181, 49, 18), poi('gate-4', 'Dawn threshold', 'gate', 213, 147, 10)], 593, 'storm'),
    sector(5, 'Heart of Dawn', 'Something ancient is waking up', [140, 108, 66, 255], [poi('tender', 'Last Light Tender', 'station', 35, 91, 13), poi('heart', 'The living star engine', 'boss', 169, 91, 24), poi('gate-5', 'The way home', 'gate', 81, 149, 8)], 719, 'sun')
];

const room = (id, x, y, w, h, color) => ({ id, x, y, w, h, color });
const prop = (id, kind, x, y, extra) => Object.assign({ id, kind, x, y }, extra || {});
const INTERIORS = {
    sable: { id: 'sable', name: 'Sable · forgotten cargo', width: 88, height: 64,
        rooms: [room('airlock', 2, 23, 22, 20, [55, 88, 112, 255]), room('hall', 20, 28, 20, 10, [64, 90, 111, 255]), room('cargo', 36, 14, 28, 38, [88, 89, 112, 255]), room('passage', 60, 28, 14, 10, [60, 92, 108, 255]), room('bridge', 70, 19, 16, 30, [55, 111, 118, 255])],
        walls: [{ x: 46, y: 26, w: 5, h: 12 }, { x: 55, y: 42, w: 4, h: 5 }], exit: { x: 10, y: 33 }, objective: { x: 78, y: 34 }, spawns: [{ x: 44, y: 20 }, { x: 61, y: 45 }],
        props: [prop('sable-exit', 'airlock', 10, 33), prop('sable-core', 'console', 78, 34), prop('sable-cargo', 'crate', 47, 45), prop('sable-reactor', 'reactor', 57, 20)] },
    lark: { id: 'lark', name: 'Lark · the dreaming observatory', width: 96, height: 72,
        rooms: [room('airlock', 3, 27, 22, 20, [72, 81, 120, 255]), room('hall', 20, 32, 25, 10, [78, 87, 117, 255]), room('observatory', 40, 13, 25, 49, [85, 72, 131, 255]), room('north', 61, 13, 31, 22, [96, 83, 136, 255]), room('south', 61, 46, 31, 22, [80, 92, 141, 255])],
        walls: [{ x: 48, y: 28, w: 4, h: 12 }, { x: 71, y: 48, w: 4, h: 7 }], exit: { x: 11, y: 37 }, objective: { x: 82, y: 59 }, spawns: [{ x: 44, y: 21 }, { x: 57, y: 45 }, { x: 78, y: 24 }, { x: 81, y: 52 }],
        props: [prop('lark-exit', 'airlock', 11, 37), prop('lark-chart', 'console', 82, 59), prop('moth', 'crew', 85, 57, { crewId: 'moth' }), prop('lark-scope', 'reactor', 80, 23), prop('lark-cargo', 'crate', 56, 55)] },
    mercy: { id: 'mercy', name: 'Mercy · the last lifeboat', width: 96, height: 68,
        rooms: [room('airlock', 3, 27, 23, 20, [55, 112, 116, 255]), room('ward', 22, 9, 40, 50, [78, 127, 130, 255]), room('hall', 58, 28, 21, 12, [66, 100, 128, 255]), room('engine', 75, 13, 18, 43, [94, 97, 125, 255])],
        walls: [{ x: 40, y: 25, w: 5, h: 15 }, { x: 52, y: 13, w: 4, h: 9 }], exit: { x: 11, y: 37 }, objective: { x: 85, y: 43 }, spawns: [{ x: 31, y: 18 }, { x: 50, y: 45 }, { x: 65, y: 34 }, { x: 85, y: 24 }],
        props: [prop('mercy-exit', 'airlock', 11, 37), prop('mercy-heart', 'console', 85, 43), prop('oru', 'crew', 86, 47, { crewId: 'oru' }), prop('mercy-reactor', 'reactor', 85, 20), prop('bed-a', 'bed', 29, 16), prop('bed-b', 'bed', 29, 52), prop('bed-c', 'bed', 54, 51)] },
    choir: { id: 'choir', name: 'Choir · a civilization in a bottle', width: 100, height: 76,
        rooms: [room('airlock', 3, 28, 23, 21, [74, 68, 126, 255]), room('hall', 22, 33, 24, 11, [78, 85, 133, 255]), room('archive', 42, 9, 27, 57, [99, 78, 144, 255]), room('bridge-hall', 65, 32, 16, 12, [69, 99, 135, 255]), room('core', 77, 20, 20, 38, [86, 120, 149, 255])],
        walls: [{ x: 48, y: 22, w: 5, h: 11 }, { x: 58, y: 43, w: 5, h: 11 }], exit: { x: 11, y: 38 }, objective: { x: 87, y: 39 }, spawns: [{ x: 46, y: 15 }, { x: 59, y: 25 }, { x: 49, y: 53 }, { x: 86, y: 26 }, { x: 87, y: 50 }],
        props: [prop('choir-exit', 'airlock', 11, 38), prop('choir-memory', 'console', 87, 39), prop('memory-a', 'reactor', 59, 17), prop('memory-b', 'reactor', 49, 58), prop('archive-a', 'crate', 47, 36), prop('archive-b', 'crate', 61, 37)] },
    sunward: { id: 'sunward', name: 'Sunward · beneath the guild’s armor', width: 100, height: 76,
        rooms: [room('airlock', 3, 29, 23, 19, [109, 75, 98, 255]), room('hall', 22, 33, 24, 11, [97, 89, 118, 255]), room('hangar', 42, 9, 28, 57, [108, 78, 112, 255]), room('bridge-hall', 66, 32, 15, 12, [96, 82, 124, 255]), room('bridge', 77, 18, 20, 41, [94, 101, 133, 255])],
        walls: [{ x: 48, y: 25, w: 5, h: 10 }, { x: 59, y: 44, w: 5, h: 11 }], exit: { x: 11, y: 38 }, objective: { x: 88, y: 38 }, spawns: [{ x: 46, y: 16 }, { x: 61, y: 23 }, { x: 47, y: 56 }, { x: 61, y: 58 }, { x: 86, y: 25 }, { x: 87, y: 52 }],
        props: [prop('sunward-exit', 'airlock', 11, 38), prop('anchor-a', 'console', 57, 16), prop('anchor-b', 'console', 52, 59), prop('sunward-command', 'console', 88, 38), prop('carrier-reactor', 'reactor', 87, 24), prop('carrier-cargo', 'crate', 61, 35)] }
};

module.exports = { SECTORS, MODULES, CREW, SUPPLIES, MISSIONS, CONTRACTS, INTERIORS, TUNING };
