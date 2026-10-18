'use strict';

const WORLD_WIDTH = 2400;
const PARK_LEFT = 680;
const PARK_RIGHT = 1570;
const LAKE_LEFT = 965;
const LAKE_RIGHT = 1325;

function hash(n) {
    let x = n | 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    return (x ^ (x >>> 16)) >>> 0;
}

function randomFrom(seed) {
    let state = hash(seed) || 1;
    return function next() {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function range(rng, min, max) {
    return min + (max - min) * rng();
}

function pick(rng, values) {
    return values[Math.floor(rng() * values.length) % values.length];
}

function isParkX(x) {
    return x >= PARK_LEFT && x <= PARK_RIGHT;
}

function isLakePoint(x, y) {
    if (x < LAKE_LEFT || x > LAKE_RIGHT || y < 55 || y > 77) return false;
    const cx = (LAKE_LEFT + LAKE_RIGHT) * 0.5;
    const cy = 66;
    const rx = (LAKE_RIGHT - LAKE_LEFT) * 0.5;
    const ry = 11.5;
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    return nx * nx + ny * ny <= 1;
}

function districtForX(x) {
    if (x < 420) return 'west-downtown';
    if (x < PARK_LEFT) return 'museum-mile-west';
    if (x <= PARK_RIGHT) return 'central-park';
    if (x < 1980) return 'midtown-east';
    return 'river-district';
}

function generateWorld(seed = 142) {
    const rng = randomFrom(seed);
    const farBuildings = [];
    const midBuildings = [];
    const frontBuildings = [];
    const trees = [];
    const lamps = [];
    const benches = [];
    const cafes = [];
    const busStops = [];
    const parkFeatures = [];

    let x = -80;
    while (x < WORLD_WIDTH + 120) {
        const width = range(rng, 18, 46);
        const height = range(rng, 13, 39);
        farBuildings.push({
            id: `far-${farBuildings.length}`,
            x,
            width,
            height,
            antenna: rng() < 0.16,
            crown: Math.floor(rng() * 4),
            shade: Math.floor(rng() * 5)
        });
        x += width - range(rng, 1, 5);
    }

    x = -20;
    while (x < WORLD_WIDTH + 80) {
        const width = range(rng, 24, 58);
        const height = range(rng, 15, 47);
        const parkGap = isParkX(x + width * 0.5);
        if (!parkGap || rng() < 0.12) {
            midBuildings.push({
                id: `mid-${midBuildings.length}`,
                x,
                width,
                height: parkGap ? height * 0.5 : height,
                roof: Math.floor(rng() * 5),
                shade: Math.floor(rng() * 6)
            });
        }
        x += width - range(rng, 1, 4);
    }

    const blocks = [
        { start: 0, end: 635 },
        { start: 1615, end: WORLD_WIDTH }
    ];
    for (const block of blocks) {
        let bx = block.start;
        while (bx < block.end) {
            const width = range(rng, 25, 52);
            const height = range(rng, 22, 55);
            frontBuildings.push({
                id: `front-${frontBuildings.length}`,
                x: bx,
                width,
                height,
                floors: Math.max(3, Math.floor(height / 5)),
                columns: Math.max(2, Math.floor(width / 7)),
                roof: Math.floor(rng() * 5),
                colorIndex: Math.floor(rng() * 8),
                storefront: rng() < 0.44,
                cafe: false
            });
            bx += width + range(rng, 4, 13);
        }
    }

    const cafeXs = [270, 548, 1668, 1844, 2118];
    for (let index = 0; index < cafeXs.length; index += 1) {
        const cx = cafeXs[index];
        cafes.push({
            id: `cafe-${index}`,
            x: cx,
            y: 68,
            width: 34,
            nameIndex: index,
            awning: index % 3,
            queueX: cx + 20
        });
        let nearest = null;
        let best = Infinity;
        for (const building of frontBuildings) {
            const center = building.x + building.width * 0.5;
            const distance = Math.abs(center - cx);
            if (distance < best) {
                best = distance;
                nearest = building;
            }
        }
        if (nearest) nearest.cafe = true;
    }

    for (let tx = PARK_LEFT + 24; tx < PARK_RIGHT - 20; tx += range(rng, 23, 43)) {
        const lane = Math.floor(rng() * 3);
        const y = lane === 0 ? range(rng, 44, 55) : lane === 1 ? range(rng, 70, 78) : range(rng, 52, 74);
        if (!isLakePoint(tx, y)) {
            trees.push({
                id: `tree-${trees.length}`,
                x: tx + range(rng, -8, 8),
                y,
                size: range(rng, 0.75, 1.35),
                shape: Math.floor(rng() * 4),
                colorIndex: Math.floor(rng() * 5)
            });
        }
    }

    for (let tx = 38; tx < WORLD_WIDTH; tx += range(rng, 54, 84)) {
        if (isParkX(tx)) continue;
        trees.push({
            id: `street-tree-${trees.length}`,
            x: tx,
            y: 75.5,
            size: range(rng, 0.65, 0.95),
            shape: Math.floor(rng() * 4),
            colorIndex: Math.floor(rng() * 5)
        });
    }

    for (let lx = 20; lx < WORLD_WIDTH; lx += 34) {
        lamps.push({ id: `lamp-${lamps.length}`, x: lx, y: 78.5, park: isParkX(lx) });
    }

    for (let bx2 = PARK_LEFT + 55; bx2 < PARK_RIGHT - 45; bx2 += 88) {
        if (!isLakePoint(bx2, 76)) benches.push({ id: `bench-${benches.length}`, x: bx2, y: 77.2 });
    }

    [330, 620, 710, 900, 1370, 1550, 1770, 2040, 2290].forEach((stopX, index) => {
        busStops.push({ id: `bus-stop-${index}`, x: stopX, y: 80.2, direction: index % 2 ? -1 : 1 });
    });

    parkFeatures.push(
        { id: 'arch-west', type: 'arch', x: 708, y: 64 },
        { id: 'fountain', type: 'fountain', x: 835, y: 68 },
        { id: 'playground', type: 'playground', x: 1465, y: 67 },
        { id: 'bridge', type: 'bridge', x: 1145, y: 61 },
        { id: 'gazebo', type: 'gazebo', x: 1515, y: 58 },
        { id: 'flower-bed-a', type: 'flowers', x: 760, y: 73 },
        { id: 'flower-bed-b', type: 'flowers', x: 1410, y: 73 }
    );

    return {
        seed,
        width: WORLD_WIDTH,
        parkLeft: PARK_LEFT,
        parkRight: PARK_RIGHT,
        lakeLeft: LAKE_LEFT,
        lakeRight: LAKE_RIGHT,
        farBuildings,
        midBuildings,
        frontBuildings,
        trees,
        lamps,
        benches,
        cafes,
        busStops,
        parkFeatures
    };
}

module.exports = {
    WORLD_WIDTH,
    PARK_LEFT,
    PARK_RIGHT,
    LAKE_LEFT,
    LAKE_RIGHT,
    generateWorld,
    isParkX,
    isLakePoint,
    districtForX,
    randomFrom,
    range,
    pick
};
