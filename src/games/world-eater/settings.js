// WORLD EATER uses world-space units. The renderer chooses its own camera scale.
const WORLD = { width: 1400, height: 900, tether: 150 };
const C = {
    bg: [4, 7, 17], panel: [11, 18, 34], line: [43, 63, 91],
    white: [232, 242, 250], muted: [135, 155, 182],
    teal: [104, 255, 220], blue: [107, 183, 255], gold: [255, 204, 109],
    red: [255, 106, 125], violet: [187, 146, 255], green: [150, 235, 170],
};
const SECTORS = [
    { name: 'THE PALE NURSERY', subtitle: 'Something ancient wakes between the stars.', color: C.teal, boss: 'THE WATCHER' },
    { name: 'CROWN OF ASH', subtitle: 'Their armadas remember what your kind has done.', color: C.gold, boss: 'CINDER REGENT' },
    { name: 'THE CHOIR OF GLASS', subtitle: 'A thousand vanished worlds are still singing.', color: C.blue, boss: 'THE MIRROR CHOIR' },
    { name: 'GRAVE OF TITANS', subtitle: 'Your ancestors did not die quietly.', color: C.violet, boss: 'THE HOLLOW MOTHER' },
    { name: 'THE LAST LIGHT', subtitle: 'A god stands between your people and tomorrow.', color: C.red, boss: 'SOL INVICTUS' },
];
const ROLES = [
    { id: 'vanguard', name: 'VANGUARD', description: 'Heavy pulse cannon. +40% weapon damage.', color: C.red },
    { id: 'harvester', name: 'HARVESTER', description: 'Wide extraction beam. +65% harvest speed.', color: C.gold },
    { id: 'warden', name: 'WARDEN', description: 'Repairs the ark while close. Reinforced drone.', color: C.teal },
];
const UPGRADES = [
    { id: 'fangs', name: 'STAR FANGS', description: 'Grow an orbital cannon. +35% weapon damage.', cost: { ore: 65, crystal: 12, life: 0 }, max: 3 },
    { id: 'carapace', name: 'VOID CARAPACE', description: '+110 hull, +45 shield. Repairs the new growth.', cost: { ore: 55, crystal: 18, life: 0 }, max: 3 },
    { id: 'siphon', name: 'WORLD SIPHON', description: '+35% extraction speed and wider harvest reach.', cost: { ore: 45, crystal: 22, life: 0 }, max: 3 },
    { id: 'heart', name: 'SECOND HEART', description: '+30% nova charge. Nova also restores shields.', cost: { ore: 35, crystal: 30, life: 0 }, max: 3 },
    { id: 'wings', name: 'SOLAR WINGS', description: '+15% movement speed. Longer, safer boosts.', cost: { ore: 50, crystal: 20, life: 0 }, max: 3 },
    { id: 'choir', name: 'LIVING CHOIR', description: 'The rescued heal the ark. +50 hull and regeneration.', cost: { ore: 30, crystal: 10, life: 12 }, max: 3 },
];
module.exports = { WORLD, C, SECTORS, ROLES, UPGRADES };
