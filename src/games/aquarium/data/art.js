'use strict';

const gridCrop = (col, row, cols, rows) => ({
    cropLeft: (col / cols) * 100,
    cropRight: ((cols - 1 - col) / cols) * 100,
    cropTop: (row / rows) * 100,
    cropBottom: ((rows - 1 - row) / rows) * 100
});

const sprite = (key, col, row, cols = 4, rows = 4) => ({
    key,
    crop: gridCrop(col, row, cols, rows)
});

const sequence = (key, row, frameCount = 4, cols = 4, rows = 4) => (
    Array.from({ length: frameCount }, (_, col) => sprite(key, col, row, cols, rows))
);

const KEYS = Object.freeze({
    aquariumBackground: 'world-aquarium-background',
    spaceBackground: 'world-space-background',
    aquariumSandBack: 'world-aquarium-sand-back',
    aquariumSandFront: 'world-aquarium-sand-front',
    aquariumFloor: 'atlas-aquarium-floor',
    aquariumFx: 'atlas-aquarium-fx',
    aquariumSystems: 'atlas-aquarium-systems',
    spaceScenery: 'atlas-space-scenery',
    spaceSystems: 'atlas-space-systems'
});

module.exports = Object.freeze({
    KEYS,
    gridCrop,

    backgrounds: Object.freeze({
        aquarium: { key: KEYS.aquariumBackground, crop: null },
        space: { key: KEYS.spaceBackground, crop: null },
        sandBack: { key: KEYS.aquariumSandBack, crop: null },
        sandFront: { key: KEYS.aquariumSandFront, crop: null }
    }),

    // atlas-aquarium-floor: 4 columns x 4 rows
    // row 0: sand back, sand front, tank edge, water surface
    // row 1: rock A, rock B, seaweed frame 0, seaweed frame 1
    // row 2: seaweed frame 2, seaweed frame 3, coral A, coral B
    // row 3: coral C, reef cave, castle, purchased plant
    floor: Object.freeze({
        sandBack: sprite(KEYS.aquariumFloor, 0, 0),
        sandFront: sprite(KEYS.aquariumFloor, 1, 0),
        tankEdge: sprite(KEYS.aquariumFloor, 2, 0),
        surface: sprite(KEYS.aquariumFloor, 3, 0),
        rockA: sprite(KEYS.aquariumFloor, 0, 1),
        rockB: sprite(KEYS.aquariumFloor, 1, 1),
        weedFrames: Object.freeze([
            sprite(KEYS.aquariumFloor, 2, 1),
            sprite(KEYS.aquariumFloor, 3, 1),
            sprite(KEYS.aquariumFloor, 0, 2),
            sprite(KEYS.aquariumFloor, 1, 2)
        ]),
        coralA: sprite(KEYS.aquariumFloor, 2, 2),
        coralB: sprite(KEYS.aquariumFloor, 3, 2),
        coralC: sprite(KEYS.aquariumFloor, 0, 3),
        cave: sprite(KEYS.aquariumFloor, 1, 3),
        castle: sprite(KEYS.aquariumFloor, 2, 3),
        plant: sprite(KEYS.aquariumFloor, 3, 3)
    }),

    // atlas-aquarium-fx: 8 columns x 4 rows
    // row 0: bubble frames 0..3, water speck, bright speck, golden food, reserved
    // row 1: normal food in player colors 0..7
    // row 2: caustic frames 0..3, current-jet frames 0..3
    // row 3: reserved for future particles/reward effects
    fx: Object.freeze({
        bubbleFrames: Object.freeze([
            sprite(KEYS.aquariumFx, 0, 0, 8, 4),
            sprite(KEYS.aquariumFx, 1, 0, 8, 4),
            sprite(KEYS.aquariumFx, 2, 0, 8, 4),
            sprite(KEYS.aquariumFx, 3, 0, 8, 4)
        ]),
        speck: sprite(KEYS.aquariumFx, 4, 0, 8, 4),
        brightSpeck: sprite(KEYS.aquariumFx, 5, 0, 8, 4),
        goldenFood: sprite(KEYS.aquariumFx, 6, 0, 8, 4),
        foodColors: Object.freeze(Array.from({ length: 8 }, (_, col) => (
            sprite(KEYS.aquariumFx, col, 1, 8, 4)
        ))),
        causticFrames: Object.freeze([
            sprite(KEYS.aquariumFx, 0, 2, 8, 4),
            sprite(KEYS.aquariumFx, 1, 2, 8, 4),
            sprite(KEYS.aquariumFx, 2, 2, 8, 4),
            sprite(KEYS.aquariumFx, 3, 2, 8, 4)
        ]),
        currentFrames: Object.freeze([
            sprite(KEYS.aquariumFx, 4, 2, 8, 4),
            sprite(KEYS.aquariumFx, 5, 2, 8, 4),
            sprite(KEYS.aquariumFx, 6, 2, 8, 4),
            sprite(KEYS.aquariumFx, 7, 2, 8, 4)
        ])
    }),

    // atlas-aquarium-systems: 4 columns x 4 rows
    // row 0: bubbler frames 0..3
    // row 1: roaming feeder frames 0..3
    // row 2: schooling beacon frames 0..3
    // row 3: treasure chest frames 0..3
    aquariumSystems: Object.freeze({
        bubblerFrames: Object.freeze(sequence(KEYS.aquariumSystems, 0)),
        feederFrames: Object.freeze(sequence(KEYS.aquariumSystems, 1)),
        beaconFrames: Object.freeze(sequence(KEYS.aquariumSystems, 2)),
        treasureFrames: Object.freeze(sequence(KEYS.aquariumSystems, 3))
    }),

    // atlas-space-scenery: 4 columns x 4 rows
    // row 0: star/twinkle variants 0..3
    // row 1: asteroid variants 0..3
    // rows 2-3 are reserved for future scenery/nebula fragments
    spaceScenery: Object.freeze({
        starFrames: Object.freeze(sequence(KEYS.spaceScenery, 0)),
        asteroidFrames: Object.freeze(sequence(KEYS.spaceScenery, 1))
    }),

    // atlas-space-systems: 4 columns x 4 rows
    // row 0: orbital feeder frames 0..3
    // row 1: gravity well frames 0..3
    // row 2: signal beacon frames 0..3
    // row 3: wormhole frames 0..3
    spaceSystems: Object.freeze({
        orbitalFeederFrames: Object.freeze(sequence(KEYS.spaceSystems, 0)),
        gravityWellFrames: Object.freeze(sequence(KEYS.spaceSystems, 1)),
        signalBeaconFrames: Object.freeze(sequence(KEYS.spaceSystems, 2)),
        wormholeFrames: Object.freeze(sequence(KEYS.spaceSystems, 3))
    })
});
