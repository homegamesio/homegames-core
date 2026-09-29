const { C } = require('./settings');
const FACTIONS = { 0: C.dim, 1: C.cyan, 2: C.red };
const UNITS = {
    seeker: { name: 'SEEKER', type: 'chaser', cost: 14, build: 3, hp: 6, damage: 1.3, interval: .8, range: 15, speed: 12, r: 1.2, power: 1 },
    bastion: { name: 'BASTION', type: 'heavy', cost: 42, build: 7, hp: 28, damage: 3.4, interval: 1.4, range: 28, speed: 5.8, r: 2.2, power: 3.6 },
    warden: { name: 'WARDEN', type: 'warden', cost: 32, build: 5, hp: 15, damage: .8, interval: 1.4, range: 23, speed: 7, r: 1.8, power: 2.1 },
    pulse: { name: 'PULSE TURRET', type: 'shooter', cost: 32, build: 5, hp: 25, damage: 2, interval: .95, range: 48, speed: 0, r: 2, power: 3, static: true },
    rail: { name: 'RAIL TURRET', type: 'sniper', cost: 48, build: 7, hp: 32, damage: 5, interval: 2.4, range: 80, speed: 0, r: 2, power: 4.8, static: true },
};
const TYPES = {
    command: { name: 'COMMAND', emblem: 'fortress', income: 1.4, description: 'Lose your command core and the run ends.' },
    refinery: { name: 'REFINERY', emblem: 'reactor', income: 2.1, description: 'Rich geom production funds your expansion.' },
    foundry: { name: 'FOUNDRY', emblem: 'foundry', income: .65, description: 'Construction takes 35% less time.' },
    relay: { name: 'RELAY', emblem: 'relay', income: .7, description: 'Departures take 40% less travel time.' },
    reactor: { name: 'ION ARRAY', emblem: 'reactor', income: .7, description: 'Owned arrays charge your pilot +2 flux/sec.' },
    bastion: { name: 'BASTION', emblem: 'fortress', income: .55, description: 'Reinforced core. Defenses cost 20% less.' },
};
const TRAITS = [
    { id: 'rich', name: 'RICH VEINS', text: '+40% income', income: 1.4 },
    { id: 'hardened', name: 'HARDENED', text: '+35% core hull', hp: 1.35 },
    { id: 'assembly', name: 'RAPID ASSEMBLY', text: 'Build time -25%', build: .75 },
    { id: 'slipstream', name: 'SLIPSTREAM', text: 'Travel time -25%', travel: .75 },
    { id: 'salvage', name: 'CACHE', text: '+35 geoms on first capture', bounty: 35 },
];
const SOCKETS = [[50, 31], [110, 31], [80, 63]];
const PILOT_FIELDS = ['weapon', 'upgrades', 'flux', 'overload', 'score', 'geoms', 'multiplier', 'combo', 'chain', 'chainTime', 'bestChain'];
module.exports = { FACTIONS, UNITS, TYPES, TRAITS, SOCKETS, PILOT_FIELDS };
