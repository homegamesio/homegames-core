// The museum is ordinary game data. Its raycaster and movement remain game-local.
const { MAPS, createArenaWorld } = require('./maps');
const REGIONS = Object.freeze({
    atrium: { id: 'atrium', name: 'The Grand Atrium', color: '#bfae8f', accent: '#f4d3a1', floor: '#252932', ceiling: '#101821' },
    tidal: { id: 'tidal', name: 'Tidal Archive', color: '#367f9a', accent: '#85e4ee', floor: '#152b3b', ceiling: '#0b1728' },
    verdant: { id: 'verdant', name: 'Verdant Room', color: '#708c67', accent: '#c2e49a', floor: '#242e2b', ceiling: '#111e1b' },
    signal: { id: 'signal', name: 'Signal Hall', color: '#ad774b', accent: '#ffce7b', floor: '#292431', ceiling: '#181526' },
    dream: { id: 'dream', name: 'Dream Wing', color: '#96758f', accent: '#efb8d4', floor: '#2c2535', ceiling: '#181526' }
});

function createMuseumWorld() {
    const width = 43;
    const height = 43;
    const cells = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 1 : 0));
    const regionAt = (x, y) => {
        if (x < 18 && y < 18) return REGIONS.tidal;
        if (x > 24 && y < 18) return REGIONS.verdant;
        if (x < 18 && y > 24) return REGIONS.signal;
        if (x > 24 && y > 24) return REGIONS.dream;
        return REGIONS.atrium;
    };
    const wallType = (x, y) => ({ tidal: 2, verdant: 3, signal: 4, dream: 5 }[regionAt(x, y).id] || 1);
    const wall = (x, y, length, vertical = false) => {
        for (let i = 0; i < length; i++) {
            const xx = x + (vertical ? 0 : i);
            const yy = y + (vertical ? i : 0);
            cells[yy][xx] = wallType(xx, yy);
        }
    };
    // The central cross offers long sightlines. Each gallery has two wide exits.
    for (const edge of [18, 24]) {
        for (let n = 1; n < 42; n++) {
            if (n < 18 || n > 24) {
                cells[n][edge] = wallType(edge === 18 ? 17 : 25, n);
                cells[edge][n] = wallType(n, edge === 18 ? 17 : 25);
            }
        }
        for (const start of [8, 30]) {
            for (let n = start; n < start + 5; n++) {
                cells[n][edge] = 0;
                cells[edge][n] = 0;
            }
        }
    }
    // Small exhibits break sightlines without turning the open galleries into mazes.
    wall(6, 6, 5);
    wall(12, 11, 4, true);
    wall(30, 6, 5);
    wall(35, 11, 4, true);
    wall(6, 35, 5);
    wall(12, 28, 4, true);
    wall(30, 35, 5);
    wall(35, 28, 4, true);
    wall(20, 15, 3);
    wall(20, 27, 3);
    for (const [x, y] of [[4, 13], [15, 4], [28, 13], [38, 4], [4, 28], [15, 38], [28, 28], [38, 38]]) wall(x, y, 1);
    // Paintings sit just outside a solid face. 'axis' names the direction of length;
    // 'face' is the outward normal along the other axis. Their frames are rendered
    // by the game on top of the same plane, so no texture/protocol changes are needed.
    const exhibits = [
        { id: 'atrium-tide', key: 'tidal', title: 'AFTER THE LAST TIDE', artist: 'Tidal Archive / 01', x: 20.08, y: 16.012, axis: 'x', length: 2.84, face: 1 },
        { id: 'atrium-dream', key: 'dream', title: 'A PLACE BETWEEN', artist: 'Dream Wing / 01', x: 20.08, y: 26.988, axis: 'x', length: 2.84, face: -1 },
        { id: 'tidal-main', key: 'tidal', title: 'THE OCEAN REMEMBERS', artist: 'Tidal Archive / 02', x: 6.12, y: 7.012, axis: 'x', length: 4.76, face: 1 },
        { id: 'tidal-side', key: 'tidal', title: 'DEPTH STUDY', artist: 'Tidal Archive / 03', x: 13.012, y: 11.12, axis: 'y', length: 3.76, face: 1 },
        { id: 'tidal-north', key: 'tidal', title: 'BLUE HOUR', artist: 'Tidal Archive / 04', x: 5.12, y: 1.012, axis: 'x', length: 4.76, face: 1 },
        { id: 'verdant-main', key: 'verdant', title: 'WHERE THE LIGHT GOES', artist: 'Verdant Room / 01', x: 30.12, y: 7.012, axis: 'x', length: 4.76, face: 1 },
        { id: 'verdant-side', key: 'verdant', title: 'SECOND NATURE', artist: 'Verdant Room / 02', x: 34.988, y: 11.12, axis: 'y', length: 3.76, face: -1 },
        { id: 'verdant-east', key: 'verdant', title: 'A GARDEN AFTER RAIN', artist: 'Verdant Room / 03', x: 41.988, y: 8.12, axis: 'y', length: 4.76, face: -1 },
        { id: 'signal-main', key: 'signal', title: 'TRANSMISSION / 1979', artist: 'Signal Hall / 01', x: 6.12, y: 34.988, axis: 'x', length: 4.76, face: -1 },
        { id: 'signal-side', key: 'signal', title: 'THE CITY THAT LISTENS', artist: 'Signal Hall / 02', x: 13.012, y: 28.12, axis: 'y', length: 3.76, face: 1 },
        { id: 'signal-west', key: 'signal', title: 'NO SIGNAL IS SILENT', artist: 'Signal Hall / 03', x: 1.012, y: 28.12, axis: 'y', length: 4.76, face: 1 },
        { id: 'dream-main', key: 'dream', title: 'THE SOFT ARCHITECTURE', artist: 'Dream Wing / 02', x: 30.12, y: 34.988, axis: 'x', length: 4.76, face: -1 },
        { id: 'dream-side', key: 'dream', title: 'MEMORY OF TOMORROW', artist: 'Dream Wing / 03', x: 34.988, y: 28.12, axis: 'y', length: 3.76, face: -1 },
        { id: 'dream-south', key: 'dream', title: 'SLEEP IN COLOUR', artist: 'Dream Wing / 04', x: 30.12, y: 41.988, axis: 'x', length: 4.76, face: -1 }
    ];
    // Center each 4:3 artwork on its display wall; retain its authored aspect
    // ratio rather than stretching the picture across an entire wall segment.
    for (const exhibit of exhibits) {
        const length = Math.min(exhibit.length, 2.6);
        exhibit[exhibit.axis] += (exhibit.length - length) / 2;
        exhibit.length = length;
        exhibit.height = length * 3 / 4;
    }
    const screens = [
        { id: 'kinetic-foyer', key: 'kinetic', title: 'PHASE / A kinetic study', x: 17.5, y: 21.5, angle: 0, width: 2.8 },
        { id: 'tide-screen', key: 'tide', title: 'TIDAL MEMORY / Moving image', x: 8.8, y: 14.8, angle: -Math.PI / 2, width: 3.2 },
        { id: 'signal-screen', key: 'kinetic', title: 'SIGNAL / Moving image', x: 8.8, y: 27.2, angle: Math.PI / 2, width: 3.2 },
        { id: 'dream-screen', key: 'tide', title: 'CHROMATIC DRIFT / Moving image', x: 31.5, y: 28, angle: Math.PI / 2, width: 3.2 }
    ];
    const pickups = [
        // { id: 'scatter-tidal', x: 9.2, y: 9.2, type: 'weapon', weapon: 'scatter' },
        { id: 'shotgun-tidal', x: 9.2, y: 9.2, type: 'weapon', weapon: 'shotgun' },
        { id: 'rail-verdant', x: 32.5, y: 9.5, type: 'weapon', weapon: 'rail' },
        { id: 'rail-signal', x: 9.5, y: 32.5, type: 'weapon', weapon: 'rail' },
        // { id: 'scatter-dream', x: 32.5, y: 32.5, type: 'weapon', weapon: 'scatter' },
        { id: 'shotgun-dream', x: 32.5, y: 32.5, type: 'weapon', weapon: 'shotgun' },
        { id: 'machinegun-atrium', x: 23.2, y: 21.5, type: 'weapon', weapon: 'machinegun' },
        { id: 'machinegun-signal', x: 15.5, y: 33.5, type: 'weapon', weapon: 'machinegun' },
        { id: 'rocket-signal', x: 7.5, y: 28.5, type: 'weapon', weapon: 'rocket' },
        { id: 'rocket-verdant', x: 29.5, y: 13.5, type: 'weapon', weapon: 'rocket' },
        { id: 'plasma-verdant', x: 38.5, y: 15.5, type: 'weapon', weapon: 'plasma' },
        { id: 'plasma-dream', x: 29.5, y: 38.5, type: 'weapon', weapon: 'plasma' },
        { id: 'med-tidal', x: 4.5, y: 4.5, type: 'health' },
        { id: 'med-verdant', x: 38.5, y: 8.5, type: 'health' },
        { id: 'med-signal', x: 4.5, y: 38.5, type: 'health' },
        { id: 'med-dream', x: 38.5, y: 34.5, type: 'health' },
        { id: 'med-atrium', x: 21.5, y: 23.8, type: 'health' },
        { id: 'shield-north', x: 21.5, y: 8.5, type: 'shield' },
        { id: 'shield-south', x: 21.5, y: 34.5, type: 'shield' }
    ];
    const spawns = [
        { x: 21.5, y: 21.8, angle: -Math.PI / 2 },
        { x: 9.5, y: 15.5, angle: -Math.PI / 2 },
        { x: 32.5, y: 15.5, angle: -Math.PI / 2 },
        { x: 9.5, y: 26.5, angle: Math.PI / 2 },
        { x: 32.5, y: 26.5, angle: Math.PI / 2 },
        { x: 21.5, y: 5.5, angle: Math.PI / 2 },
        { x: 5.5, y: 21.5, angle: 0 },
        { x: 37.5, y: 21.5, angle: Math.PI }
    ];
    const isWall = (x, y) => !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= width || y >= height || cells[Math.floor(y)][Math.floor(x)] !== 0;
    return {
        id: 'museum', mapId: 'museum', name: 'After Hours Museum', theme: 'museum',
        palette: MAPS[0].palette, wallHeight: 3.35, ceilingHeight: 3.35,
        width, height, cells, regions: REGIONS, regionAt, isWall, exhibits, screens, pickups, spawns,
        landmarks: [],
        teamSpawns: {
            amber: [{x:19.5,y:3.5,angle:Math.PI/2},{x:21.5,y:5.5,angle:Math.PI/2},{x:23.5,y:3.5,angle:Math.PI/2},{x:21.5,y:8.5,angle:Math.PI/2}],
            cyan: [{x:19.5,y:39.5,angle:-Math.PI/2},{x:21.5,y:37.5,angle:-Math.PI/2},{x:23.5,y:39.5,angle:-Math.PI/2},{x:21.5,y:34.5,angle:-Math.PI/2}]
        },
        flagBases: {amber:{x:21.5,y:4.5},cyan:{x:21.5,y:38.5}},
        dominationPoints: [{id:'A',name:'West Gallery',x:9.5,y:21.5},{id:'B',name:'Grand Atrium',x:21.5,y:21.5},{id:'C',name:'East Gallery',x:33.5,y:21.5}]
    };
}

function createWorld(mapId = 'museum') {
    return createArenaWorld(mapId) || createMuseumWorld();
}

module.exports = { createWorld, REGIONS, MAPS };
