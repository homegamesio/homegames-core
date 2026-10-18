'use strict';

// Authored coordinates, not a random map generator. The six leading planets
// are spawn candidates; interior garrisons and links shape expansion choices.
const SECTORS = [
    { name: 'HOME REACH', color: '#72f2c4', nebula: '#102627' },
    { name: 'CROSSROADS', color: '#72d7f2', nebula: '#102435' },
    { name: 'SHARD MARCH', color: '#d7a0fa', nebula: '#211b32' },
    { name: 'TIDAL EXPANSE', color: '#89a8ff', nebula: '#14203b' },
    { name: 'IRON DOMINION', color: '#ffc77a', nebula: '#2a221e' },
    { name: 'LAST LIGHT', color: '#ff929b', nebula: '#2c1b2c' },
];
const WEATHER = {
    calm: { name: 'OPEN SKIES', gap: 1.8, jitter: .6, heavyEvery: 6 },
    drift: { name: 'DRIFT', gap: 1.25, jitter: .55, heavyEvery: 4 },
    wreckage: { name: 'WRECKAGE', gap: 1.25, jitter: .55, heavyEvery: 3 },
    storm: { name: 'DEBRIS STORM', gap: 1, jitter: .4, heavyEvery: 4 },
};
const hex = [[50,8],[86,29],[86,71],[50,92],[14,71],[14,29]];
const corners = [[12,12],[50,8],[88,12],[88,88],[50,92],[12,88]];
const banks = [[10,15],[90,15],[90,50],[90,85],[10,85],[10,50]];
const field = (id, name, sector, rivals, weather, brief, linkDistance, homes, inside) => ({
    id, name, sector, rivals, weather, brief, linkDistance, points: [...homes, ...inside],
});

const FRONTIERS = [
    field('relay', 'Relay', 0, 2, 'calm', 'Race the relays', 30, hex,
        [[50,26,10],[70,38,12],[70,62,12],[50,74,10],[30,62,12],[30,38,12],[50,50,30]]),
    field('starwell', 'Starwell', 0, 2, 'wreckage', 'Claim the inner ring', 28, hex,
        [[38,26],[62,26],[76,50],[62,74],[38,74],[24,50],[50,39,26],[60,57,26],[40,57,26]]),

    field('crosswind', 'Crosswind', 1, 2, 'drift', 'Four crossing lanes', 30, corners,
        [[28,28,12],[50,28,18],[72,28,12],[28,50,18],[50,50,34],[72,50,18],[28,72,12],[50,72,18],[72,72,12]]),
    field('forked-signal', 'Forked Signal', 1, 3, 'calm', 'Choose your branch', 28, hex,
        [[50,27,12],[69,38,16],[69,62,16],[50,73,12],[31,62,16],[31,38,16],[37,49,26],[63,49,26]]),
    field('causeway', 'Causeway', 1, 2, 'wreckage', 'A costly shortcut', 25, banks,
        [[28,20],[28,40],[28,60],[28,80],[72,20],[72,40],[72,60],[72,80],[50,40,32],[50,60,32]]),
    field('six-spokes', 'Six Spokes', 1, 3, 'drift', 'All roads converge', 29, hex,
        [[50,28,10],[69,39,10],[69,61,10],[50,72,10],[31,61,10],[31,39,10],[50,50,42]]),
    field('switchback', 'Switchback', 1, 3, 'calm', 'Long linked chains', 24, banks,
        [[29,15,12],[50,15,12],[71,15,12],[71,36,20],[50,36,16],[29,36,20],[29,57,16],[50,57,16],[71,57,16],[71,78,20],[50,78,12],[29,78,20]]),
    field('meridian', 'Meridian', 1, 3, 'storm', 'Hold the spine', 27, hex,
        [[50,25,12],[50,42,24],[50,59,24],[50,76,12],[30,35,16],[70,35,16],[30,65,16],[70,65,16],[12,50,10],[88,50,10]]),

    field('triptych', 'Triptych', 2, 3, 'drift', 'Three island systems', 30, hex,
        [[40,26,12],[60,26,12],[50,42,28],[70,55,12],[70,77,12],[55,66,28],[30,55,12],[30,77,12],[45,80,28]]),
    field('chainlink', 'Chainlink', 2, 3, 'wreckage', 'Bridge the pockets', 26, banks,
        [[24,26,10],[24,74,10],[76,26,10],[76,74,10],[38,40,24],[62,40,24],[38,60,24],[62,60,24],[50,18,28],[50,82,28],[24,50,22],[76,50,22]]),
    field('broken-crown', 'Broken Crown', 2, 3, 'storm', 'Fight around the void', 27, hex,
        [[32,18,12],[68,18,12],[82,50,24],[68,82,12],[32,82,12],[18,50,24],[38,37,30],[62,37,30],[50,67,30]]),
    field('needle-eye', 'Needle Eye', 2, 4, 'calm', 'Two narrow bridges', 26, banks,
        [[28,14,12],[28,36,18],[28,64,18],[28,86,12],[72,14,12],[72,36,18],[72,64,18],[72,86,12],[50,36,38],[50,64,38]]),
    field('fracture', 'Fracture', 2, 3, 'wreckage', 'Uneven front lines', 29, corners,
        [[31,17,12],[70,25,16],[22,44,14],[44,39,28],[77,49,14],[30,68,16],[56,65,28],[71,79,12],[51,23,18],[50,80,18]]),
    field('far-harbor', 'Far Harbor', 2, 4, 'drift', 'Build a beachhead', 31, hex,
        [[32,22,10],[68,22,10],[78,52,10],[68,78,10],[32,78,10],[22,52,10],[40,44,36],[61,44,36],[50,62,36]]),

    field('undertow', 'Undertow', 3, 3, 'storm', 'Diagonal currents', 29, banks,
        [[29,18,14],[48,29,18],[67,40,22],[29,40,14],[48,51,28],[67,62,14],[29,62,22],[48,73,18],[67,84,14],[70,14,10],[28,86,10]]),
    field('whirlpool', 'Whirlpool', 3, 4, 'drift', 'Spiral to the core', 25, hex,
        [[32,16,12],[18,46,12],[25,63,16],[39,76,16],[59,76,20],[76,62,20],[77,43,24],[63,29,24],[44,30,28],[35,46,28],[50,55,38]]),
    field('slipstream', 'Slipstream', 3, 3, 'calm', 'Race the outer lanes', 24, banks,
        [[30,15,8],[50,15,14],[70,15,8],[30,85,8],[50,85,14],[70,85,8],[28,50,26],[50,50,40],[72,50,26],[30,33,18],[70,67,18]]),
    field('blue-shift', 'Blue Shift', 3, 4, 'storm', 'Staggered crossings', 27, corners,
        [[30,26,16],[50,27,24],[70,27,16],[19,47,18],[40,47,24],[61,47,24],[81,47,18],[28,69,16],[50,68,24],[70,68,16]]),
    field('long-arc', 'Long Arc', 3, 4, 'wreckage', 'Risk the long flight', 25, hex,
        [[31,13,12],[16,43,14],[19,61,16],[32,79,18],[67,84,18],[82,62,16],[84,43,14],[69,16,12],[50,32,30],[50,54,44],[50,74,30]]),
    field('maelstrom', 'Maelstrom', 3, 4, 'storm', 'Six contested hubs', 26, hex,
        [[50,25,16],[72,38,16],[72,62,16],[50,75,16],[28,62,16],[28,38,16],[39,44,30],[61,44,30],[50,62,30]]),

    field('anvil', 'Anvil', 4, 4, 'wreckage', 'Heavy central armor', 29, hex,
        [[29,21,14],[71,21,14],[22,43,18],[43,43,44],[64,43,44],[84,43,18],[33,65,26],[67,65,26],[50,80,20],[27,85,18],[73,85,18]]),
    field('citadel', 'Citadel', 4, 4, 'calm', 'A fortress in space', 27, hex,
        [[50,26,16],[71,38,16],[71,62,16],[50,74,16],[29,62,16],[29,38,16],[40,50,46],[60,50,46]]),
    field('trident', 'Trident', 4, 4, 'drift', 'Three linked bastions', 28, hex,
        [[50,26,16],[50,44,42],[68,42,20],[70,61,16],[55,68,42],[50,83,20],[30,61,16],[32,42,20],[40,57,42]]),
    field('iron-lattice', 'Iron Lattice', 4, 5, 'wreckage', 'Every link matters', 23, banks,
        [[29,14,14],[50,14,22],[71,14,14],[29,36,20],[50,36,32],[71,36,20],[29,58,20],[50,58,32],[71,58,20],[29,80,14],[50,80,22],[71,80,14]]),
    field('crucible', 'Crucible', 4, 4, 'storm', 'Fight for the furnace', 30, banks,
        [[28,28,16],[72,28,16],[28,72,16],[72,72,16],[50,29,32],[71,50,32],[50,71,32],[29,50,32],[50,50,56]]),
    field('siege-ring', 'Siege Ring', 4, 5, 'wreckage', 'Break the inner wall', 25, hex,
        [[33,16,14],[67,16,14],[83,50,18],[67,84,14],[33,84,14],[17,50,18],[39,36,38],[61,36,38],[72,54,38],[50,70,38],[28,54,38],[50,51,54]]),

    field('starless', 'Starless', 5, 4, 'calm', 'Outposts in the dark', 34, hex,
        [[50,34,18],[67,59,18],[33,59,18],[50,75,32],[27,35,32],[73,35,32]]),
    field('dead-reckon', 'Dead Reckon', 5, 5, 'storm', 'Cross the broken line', 27, banks,
        [[28,18,16],[48,26,24],[72,33,16],[28,45,32],[50,50,48],[72,55,32],[28,67,16],[52,74,24],[72,82,16]]),
    field('event-horizon', 'Event Horizon', 5, 5, 'wreckage', 'The center can wait', 28, hex,
        [[34,19,20],[66,19,20],[79,50,20],[66,81,20],[34,81,20],[21,50,20],[50,34,46],[64,58,46],[36,58,46]]),
    field('last-beacon', 'Last Beacon', 5, 4, 'drift', 'Keep the chain alive', 26, banks,
        [[28,21,16],[72,21,16],[28,43,24],[50,43,42],[72,43,24],[28,65,24],[50,65,42],[72,65,24],[32,85,16],[68,85,16],[50,23,26]]),
    field('supernova', 'Supernova', 5, 5, 'storm', 'A crowded collision', 28, hex,
        [[50,26,20],[71,38,20],[71,62,20],[50,74,20],[29,62,20],[29,38,20],[39,45,40],[61,45,40],[50,62,40],[10,50,12],[90,50,12]]),
    field('fleetfall', 'Fleetfall', 5, 5, 'wreckage', 'The final six-way war', 26, hex,
        [[33,18,18],[67,18,18],[82,50,24],[67,82,18],[33,82,18],[18,50,24],[38,37,34],[62,37,34],[73,63,34],[50,73,34],[27,63,34],[50,52,60]]),
];

module.exports = { SECTORS, WEATHER, FRONTIERS };
