// All distances use a 160 x 90 world, independent of the screen resolution.
const RULES = {
    hz: 60, step: 1 / 120, speed: 34, acceleration: 26, braking: 32,
    dashSpeed: 112, dashTime: 0.16, dashRecharge: 1.55,
    shotInterval: 0.085, bulletSpeed: 165, captureTime: 4,
    maxEnemies: 36, maxBullets: 72, maxHostile: 64, maxGems: 64,
    maxParticles: 120, maxRings: 12, maxLabels: 10, maxHazards: 20, maxLinks: 12,
    bounds: { left: 6, right: 154, top: 16, bottom: 77 },
};
const C = {
    bg: [5, 10, 18, 255], panel: [10, 20, 30, 255], grid: [17, 34, 45, 255],
    line: [35, 62, 73, 255], dim: [101, 132, 145, 255], white: [225, 246, 242, 255],
    cyan: [94, 255, 219, 255], teal: [29, 103, 101, 255], blue: [92, 178, 255, 255],
    red: [255, 99, 121, 255], orange: [255, 164, 87, 255], yellow: [250, 222, 133, 255],
    violet: [184, 137, 255, 255], green: [163, 245, 139, 255],
};
const SITES = {
    reactor: { name: 'ION ARRAY', role: 'SHIELD PRODUCTION', color: C.blue,
        effect: 'Shields offline. Passive flux online.', reward: 'No fortress shields. +2 flux per second.', support: 'ION SIPHON / +2 FLUX PER SECOND' },
    foundry: { name: 'HEX FOUNDRY', role: 'HEAVY PRODUCTION', color: C.orange,
        effect: 'Heavy reserves destroyed. Wingman online.', reward: 'No heavy reserves. A combat drone joins you.', support: 'WINGMAN / AUTONOMOUS FIRE SUPPORT' },
    relay: { name: 'TRANSIT RELAY', role: 'REINFORCEMENTS', color: C.violet,
        effect: 'Reserves severed. Medical supply secured.', reward: 'No reserve waves. Repair +1 hull on deployment.', support: 'MEDICAL CONVOY / +1 HULL ON DEPLOYMENT' },
    fortress: { name: 'THE CITADEL', role: 'SECTOR COMMAND', color: C.red,
        effect: 'Destroy the command core. Win the run.', reward: 'The final assault. Available immediately.' },
};
const MODS = [
    { id: 'split', name: 'FORKED LIGHT', text: '+50% projectiles, rounded up. Each deals 80% damage.', tag: 'COVERAGE', color: C.cyan },
    { id: 'rapid', name: 'OVERCLOCK', text: 'Fire 28% faster. Keep the pressure on.', tag: 'WEAPON', color: C.orange },
    { id: 'magnet', name: 'GRAVITY WELL', text: 'Double geom attraction. +1 hull repair.', tag: 'SALVAGE', color: C.green },
    { id: 'dash', name: 'AFTERIMAGE', text: '30% shorter dash cooldown. +1 hull repair.', tag: 'MOBILITY', color: C.blue },
    { id: 'power', name: 'CORE AMPLIFIER', text: '+25% weapon damage. Stacks up to three times.', tag: 'DAMAGE', color: C.violet, max: 3 },
    { id: 'repair', name: 'SECOND WIND', text: 'Fully repair hull. +1 maximum hull, up to 10.', tag: 'SURVIVAL', color: C.yellow },
    { id: 'pierce', name: 'PHASE ROUNDS', text: 'Shots penetrate two extra targets. Line up the swarm.', tag: 'PENETRATION', color: C.blue },
    { id: 'arc', name: 'ARC CONDUCTOR', text: 'Hits arc to a nearby enemy. Pairs with Phase Rounds.', tag: 'CHAIN LIGHTNING', color: C.blue },
    { id: 'volatile', name: 'DETONATION', text: 'Kills explode for 3 area damage. Start a chain reaction.', tag: 'EXPLOSIVES', color: C.orange },
    { id: 'blade', name: 'RAZOR WAKE', text: 'Dash strikes deal 8 damage. Cut through armored packs.', tag: 'DASH STRIKE', color: C.cyan },
    { id: 'battery', name: 'CAPACITOR', text: 'Gain 50% more flux. Overload lasts two seconds longer.', tag: 'OVERLOAD', color: C.violet },
    { id: 'vampire', name: 'RECLAMATION', text: 'Every 35 geoms repairs one hull. Stay close to your kills.', tag: 'SUSTAIN', color: C.green },
    { id: 'frost', name: 'CRYO ROUNDS', text: 'Hits slow enemies for one second. Control dangerous lanes.', tag: 'CONTROL', color: C.blue },
    { id: 'ricochet', name: 'BANK SHOT', text: 'Shots bounce off the arena once. Wider firing angles.', tag: 'RICOCHET', color: C.yellow },
];
const WEAPONS = [
    { id: 'needle', name: 'NEEDLE', role: 'PRECISION / SUSTAINED FIRE', text: ['Fast, accurate pulses.', 'Reliable at any distance.', 'Builds chains with precision.'], color: C.cyan, interval: .085, speed: 165, damage: 1, count: 1, spread: 0, life: 1, pierce: 0 },
    { id: 'scatter', name: 'SCATTER', role: 'CLOSE RANGE / CROWD CLEAR', text: ['Five pellets in a wide fan.', 'Devastating at close range.', 'Dash in. Break the formation.'], color: C.orange, interval: .32, speed: 125, damage: .95, count: 5, spread: .32, life: .42, pierce: 0 },
    { id: 'lance', name: 'LANCE', role: 'PIERCING / ANTI ARMOR', text: ['Heavy, piercing bolts.', 'Ignores Bastion front armor.', 'Line up multiple enemies.'], color: C.blue, interval: .29, speed: 210, damage: 3, count: 1, spread: 0, life: .8, pierce: 2 },
];
const ENEMIES = {
    chaser: { name: 'SEEKER', hp: 2, speed: 12, r: 1.2, color: C.red, tip: 'Closes directly. Keep moving.' },
    weaver: { name: 'FRACTAL', hp: 3, speed: 10, r: 1.3, color: C.violet, tip: 'Splits on death. Sweep the fragments.' },
    shooter: { name: 'SENTRY', hp: 4, speed: 6, r: 1.5, color: C.yellow, tip: 'Orbits and fires. Close the distance.' },
    heavy: { name: 'BASTION', hp: 14, speed: 5.8, r: 2.2, color: C.orange, tip: 'Armored front. Flank, dash or use Lance.' },
    small: { name: 'SHARD', hp: 1, speed: 17, r: .8, color: C.red, tip: 'Fast fragments. Sweep them up.' },
    carrier: { name: 'CARGO', hp: 12, speed: 9, r: 2.2, color: C.blue, tip: 'Destroy it to deny enemy reserves.' },
    charger: { name: 'LANCER', hp: 5, speed: 7, r: 1.7, color: C.red, tip: 'Locks a lane, then lunges. Sidestep.' },
    sniper: { name: 'RAIL EYE', hp: 4, speed: 4, r: 1.5, color: C.violet, tip: 'Laser locks before firing. Cross the line early.' },
    warden: { name: 'WARDEN', hp: 7, speed: 5, r: 2, color: C.blue, tip: 'Shields nearby enemies. Kill it first.' },
    bomber: { name: 'MINEWEAVER', hp: 5, speed: 8, r: 1.7, color: C.orange, tip: 'Seeds delayed blasts. Watch the rings.' },
    leech: { name: 'SCAVENGER', hp: 4, speed: 13, r: 1.3, color: C.green, tip: 'Steals geoms. Kill it to recover the haul.' },
};
const CONTRACTS = [
    { id: 'clean', title: 'CLEAN BREACH', description: 'Complete without taking hull damage.', reward: 25 },
    { id: 'swift', title: 'BLITZ', description: 'Complete the operation in 55 seconds.', reward: 25 },
    { id: 'hunter', title: 'INTERDICTION', description: 'Destroy the cargo shipment.', reward: 25 },
    { id: 'flow', title: 'FLOW STATE', description: 'Reach a x5 multiplier in this operation.', reward: 25 },
];
module.exports = { RULES, C, SITES, MODS, WEAPONS, ENEMIES, CONTRACTS };
