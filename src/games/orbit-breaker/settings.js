const C = {
    bg: [5, 12, 22], panel: [10, 22, 34], line: [32, 61, 72], muted: [116, 147, 158],
    white: [226, 244, 237], teal: [92, 255, 213], blue: [103, 184, 255],
    gold: [255, 201, 107], red: [255, 93, 119], violet: [178, 145, 255],
};
const BOUNDS = { left: 7, right: 127, top: 15, bottom: 79 };
const UPGRADES = [
    { id: 'capacity', name: 'SATELLITE ARRAY', tag: 'MORE AMMUNITION', lines: ['Store 10 captured rounds.', 'A wider magnetic field', 'makes catching easier.'] },
    { id: 'power', name: 'HOT RETURN', tag: 'MORE DAMAGE', lines: ['Returned rounds hit 50%', 'harder. Perfect catches', 'punch through two targets.'] },
    { id: 'dash', name: 'PHASE DRIVE', tag: 'MORE MOBILITY', lines: ['Dash recharges 35% faster.', 'Dashing leaves a blast', 'that shreds nearby threats.'] },
    { id: 'nova', name: 'CHAIN REACTION', tag: 'MORE OVERDRIVE', lines: ['Charge nova 50% faster.', 'Nova restores one hull', 'and grants a full orbit.'] },
    { id: 'hull', name: 'SECOND SUN', tag: 'MORE SURVIVAL', lines: ['Gain two maximum hull.', 'Fully repair your ship.', 'Perfect catches repair 1/4 hull.'] },
];
const SECTORS = ['THE GLASS BELT', 'REDLINE ARRAY', 'THE HELIOPHAGE'];
module.exports = { C, BOUNDS, UPGRADES, SECTORS };
