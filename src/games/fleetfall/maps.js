'use strict';
const { SECTORS, WEATHER, FRONTIERS } = require('./frontiers');

const NAMES = ['Vela', 'Kite', 'Orion', 'Mira', 'Lyra', 'Vega', 'Echo', 'Cinder', 'Halo',
    'Drift', 'Nova', 'Sol', 'Io', 'Rune', 'Ash', 'Flux', 'Nix', 'Lux', 'Heart', 'Ember', 'Opal', 'Vale', 'Dune', 'Pico'];
const ring = (count, radius, rotation = -90, cx = 50, cy = 50) => Array.from({ length: count }, (_, i) => {
    const a = (rotation + i * 360 / count) * Math.PI / 180;
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
});
const define = (id, name, points, linkDistance) => ({ id, name, linkDistance, sector: 0, rivals: 2, weather: 'drift',
    planets: points.map(([x, y, ships], i) => ({ id: i, name: NAMES[i], x, y, ships: ships ?? (i < 6 ? 22 : 12 + i % 3 * 3) })) });

// The first six planets are clockwise spawn candidates on every battlefield.
const MAPS = [
    define('orbit', 'Orbit', [...ring(6, 40), ...ring(6, 25, -60), ...ring(6, 11), [50, 50, 32]], 28),
    define('rift', 'Rift', [
        [12, 14], [88, 14], [90, 50], [88, 86], [12, 86], [10, 50],
        [25, 27], [75, 27], [25, 50], [75, 50], [25, 73], [75, 73],
        [38, 16], [62, 16], [38, 84], [62, 84], [42, 50, 24], [58, 50, 24], [50, 32, 28], [50, 68, 28]
    ], 25),
    define('binary', 'Binary', [
        [14, 12], [86, 12], [97, 50], [86, 88], [14, 88], [3, 50],
        ...ring(6, 14, 0, 27, 50), ...ring(6, 14, 0, 73, 50), [27, 50, 30], [73, 50, 30], [50, 50, 36]
    ], 28),
    define('belt', 'Belt', [
        ...ring(6, 42), ...ring(6, 42, -75), ...ring(6, 42, -60), ...ring(6, 42, -45)
    ], 17)
];
['Central cluster', 'Two linked territories', 'Twin star systems', 'Long orbital flights'].forEach((brief, i) => { MAPS[i].brief = brief; });
for (const { points, ...map } of FRONTIERS) MAPS.push({ ...define(map.id, map.name, points, map.linkDistance), ...map });

function makeMap(id = 'orbit') {
    const map = MAPS.find(m => m.id === id);
    if (!map) throw new Error(`Unknown Fleetfall map: ${id}`);
    return map.planets.map(p => ({ ...p, owner: null, production: 0 }));
}

module.exports = { MAPS, makeMap, SECTORS, WEATHER };
