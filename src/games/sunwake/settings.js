const ROLES = [
    { id: 'helm', name: 'HELM', color: [255, 196, 112, 255], action: 'BOOST', special: 'ANCHOR', hint: 'Tap the sky to steer. Dodge red warnings.', keys: 'WASD steer / Space boost / E anchor' },
    { id: 'gunner', name: 'GUNNER', color: [247, 135, 139, 255], action: 'FIRE', special: 'BARRAGE', hint: 'Hold on a target to fire. Break the Wardens.', keys: 'Tap / hold aim / Space fire / E barrage' },
    { id: 'engineer', name: 'ENGINEER', color: [129, 223, 176, 255], action: 'PATCH / VENT', special: 'POWER MODE', hint: 'Patch damage and vent heat. Shift power where needed.', keys: 'Space repair + vent / E cycle the power focus' },
    { id: 'scout', name: 'SCOUT', color: [143, 198, 254, 255], action: 'TRACTOR', special: 'SCAN', hint: 'Tractor survivors and salvage. Scan to crack armor.', keys: 'Tap a target / Space tractor / E scan' },
];
const BIOMES = [
    { name: 'THE GLASS SHOALS', sky: [21, 28, 57, 255], haze: [80, 76, 115, 255], rock: [88, 75, 121, 255], top: [125, 148, 164, 255], light: [249, 183, 143, 255], flora: [123, 212, 205, 255] },
    { name: 'THE VERDANT GRAVE', sky: [16, 40, 48, 255], haze: [44, 106, 108, 255], rock: [39, 89, 96, 255], top: [99, 163, 130, 255], light: [220, 232, 146, 255], flora: [156, 222, 148, 255] },
    { name: 'THE CINDER CROWN', sky: [42, 27, 51, 255], haze: [121, 66, 88, 255], rock: [94, 52, 81, 255], top: [164, 99, 109, 255], light: [255, 181, 99, 255], flora: [253, 157, 93, 255] },
];
const ROUTES = [
    { id: 'refuge', name: 'THE LANTERN ROAD', subtitle: 'Survivors / calmer skies', description: 'Rescue a stranded flotilla. Fewer raiders, more people to bring home.', bonus: 'Rescue bonus', danger: 1 },
    { id: 'ruins', name: 'THE SHATTERED VAULT', subtitle: 'Relics / armored Wardens', description: 'Rich salvage among ancient ruins. Scan the Wardens to expose their hearts.', bonus: 'Double salvage', danger: 2 },
    { id: 'storm', name: 'THE STORM GARDEN', subtitle: 'Power / lightning fields', description: 'Ride the storm for a stronger ship. Watch the lightning before it lands.', bonus: 'Recharge +40%', danger: 3 },
];
const UPGRADES = [
    { id: 'hull', name: 'LIVING TIMBERS', detail: '+25 max hull and a full patch', color: [129, 223, 176, 255] },
    { id: 'guns', name: 'SUNLANCE', detail: '+30% harpoon damage', color: [247, 135, 139, 255] },
    { id: 'reactor', name: 'STORM SAILS', detail: '+35% energy recharge', color: [143, 198, 254, 255] },
];
const KITS = [
    { id: 'dawn', name: 'DAWNCHASER', requirement: 0, hull: 120, shield: 45, speed: 8, energy: 100, description: 'A little of everything. A lot of heart.' },
    { id: 'swift', name: 'KESTREL', requirement: 15, hull: 95, shield: 35, speed: 10.5, energy: 120, description: 'Fast sails. Bigger battery. Fragile bones.' },
    { id: 'bastion', name: 'BASTION', requirement: 35, hull: 170, shield: 65, speed: 6.8, energy: 100, description: 'A flying fortress built to bring everyone home.' },
];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const random = seed => { let state = seed >>> 0; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
module.exports = { ROLES, BIOMES, ROUTES, UPGRADES, KITS, clamp, distance, random };
