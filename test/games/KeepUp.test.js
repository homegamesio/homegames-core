const assert = require('assert');

const gamePath = `${global.gameRoot}/keep-up/index.js`;
const KeepUp = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(KeepUp);

const makeGame = (playerCount) => {
    const g = new KeepUp();
    for (let i = 1; i <= playerCount; i++) {
        g.handleNewPlayer({ playerId: i, info: { name: `P${i}` }, settings: {} });
    }
    return g;
};

global.test('KeepUp: bops build the streak, floor resets it', () => {
    const g = makeGame(2);
    g.startGame(1);
    assert.strictEqual(g.phase, 'playing');
    g.tick();
    assert.strictEqual(g.balloons.length, 1);

    const b = g.balloons[0];
    g.bop(1, b, b.x + 2, b.y);
    g.bop(2, b, b.x - 2, b.y);
    assert.strictEqual(g.combo, 2);
    assert.strictEqual(g.totalBops, 2);
    assert(b.vy < 0, 'bop sends the balloon upward');
    assert.strictEqual(g.players[1].bops, 1);

    b.y = 95;
    b.vy = 0.3;
    g.tick();
    assert(b.dead, 'balloon pops at the floor');
    assert.strictEqual(g.combo, 0, 'floor hit resets the streak');
    assert.strictEqual(g.bestCombo, 2, 'best streak survives');
    assert.strictEqual(g.floorPops, 1);

    for (let i = 0; i < 30 && b.dead; i++) g.tick();
    assert(!b.dead, 'popped balloon respawns');
    g.close();
});

global.test('KeepUp: balloons keep arriving and the round ends on time', () => {
    const g = makeGame(1);
    g.startGame(1);
    for (let i = 0; i < 320; i++) g.tick();
    assert(g.balloons.length >= 2, 'second balloon arrives at 20s');

    for (let i = 0; i < 90 * 15; i++) {
        if (g.phase !== 'playing') break;
        // keep them airborne so the sim is exercised
        g.balloons.forEach(b => {
            if (!b.dead && b.y > 70) g.bop(1, b, b.x, b.y);
        });
        g.tick();
    }
    assert.strictEqual(g.phase, 'results');
    assert(g.totalBops > 0);
    g.playAgain(1);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});

global.test('KeepUp: last player leaving returns to lobby', () => {
    const g = makeGame(1);
    g.startGame(1);
    g.handlePlayerDisconnect(1);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});
