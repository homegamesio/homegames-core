const assert = require('assert');

const gamePath = `${global.gameRoot}/sheep-drive/index.js`;
const SheepDrive = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(SheepDrive);

const makeGame = (playerCount) => {
    const g = new SheepDrive();
    const names = ['ALICE', 'BOB', 'CARA', 'DAN'];
    for (let i = 1; i <= playerCount; i++) {
        g.handleNewPlayer({ playerId: i, info: { name: names[i - 1] }, settings: {} });
    }
    return g;
};

const skipIntro = (g) => {
    for (let i = 0; i < 50 && g.phase === 'intro'; i++) g.tick();
};

global.test('SheepDrive: full three-round flow to the flock report', () => {
    const g = makeGame(2);
    assert.strictEqual(g.phase, 'lobby');
    g.startGame(1);

    const expectedScores = [];
    for (let round = 0; round < 3; round++) {
        assert.strictEqual(g.phase, 'intro');
        assert.strictEqual(g.roundIdx, round);
        skipIntro(g);
        assert.strictEqual(g.phase, 'herding');

        const goats = g.sheep.filter(s => s.isGoat).length;
        assert.strictEqual(goats, round === 2 ? 1 : 0, 'goat only appears in round 3');

        // Teleport the whole flock into the pen; one tick should pen them all
        g.sheep.forEach((s, i) => {
            s.x = 73 + (i % 6) * 3.6;
            s.y = 15 + Math.floor(i / 6) * 4;
        });
        g.tick();
        assert(g.sheep.every(s => s.penned), 'all sheep inside the pen are penned');
        assert.strictEqual(g.phase, 'roundend', 'all penned ends the round early');
        expectedScores.push(g.roundResults[round].score);
        for (let i = 0; i < 100 && g.phase === 'roundend'; i++) g.tick();
    }

    assert.strictEqual(g.phase, 'final');
    assert.deepStrictEqual(expectedScores, [12, 20, 30], 'goat is worth a 5-point bonus');

    g.playAgain(2);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});

global.test('SheepDrive: sheep flee from dogs', () => {
    const g = makeGame(1);
    g.startGame(1);
    skipIntro(g);

    const s = g.sheep[0];
    s.x = 50; s.y = 60; s.vx = 0; s.vy = 0;
    g.sheep = [s];
    const dog = g.players[1];
    dog.x = 46; dog.y = 60; dog.tx = 46; dog.ty = 60;

    const before = Math.abs(s.x - dog.x);
    for (let i = 0; i < 10; i++) g.tick();
    const after = Math.sqrt((s.x - dog.x) ** 2 + (s.y - dog.y) ** 2);
    assert(after > before, `sheep should flee the dog (${before} -> ${after})`);
    g.close();
});

global.test('SheepDrive: a dog can herd a sheep through the gate', () => {
    const g = makeGame(1);
    g.startGame(1);
    skipIntro(g);

    const s = g.sheep[0];
    s.x = 62; s.y = 23; s.vx = 0; s.vy = 0;
    g.sheep = [s];
    const dog = g.players[1];
    dog.x = 56; dog.y = 23;

    for (let i = 0; i < 300 && !s.penned; i++) {
        if (i % 5 === 0) {
            g.handleTap(1, Math.max(2, s.x - 6), s.y);
        }
        g.tick();
    }
    assert(s.penned, `sheep should be driven through the gate (ended at ${s.x.toFixed(1)},${s.y.toFixed(1)})`);
    g.close();
});

global.test('SheepDrive: pen walls block sheep, timer ends the round', () => {
    const g = makeGame(1);
    g.startGame(1);
    skipIntro(g);

    // Drop a sheep inside a wall; collision resolution must pop it out
    const s = g.sheep[0];
    s.x = 70.6; s.y = 15;
    g.tick();
    const inWall = s.x > 70 && s.x < 71.2 && s.y > 12 && s.y < 19;
    assert(!inWall, 'sheep cannot rest inside a pen wall');

    g.deadline = g._t + 3;
    for (let i = 0; i < 10 && g.phase === 'herding'; i++) g.tick();
    assert.strictEqual(g.phase, 'roundend');
    assert.strictEqual(g.lastRoundEnd.reason, 'THE BELL RANG');
    g.close();
});

global.test('SheepDrive: joiners get a dog mid-round, last leaver ends the game', () => {
    const g = makeGame(1);
    g.startGame(1);
    skipIntro(g);

    g.handleNewPlayer({ playerId: 9, info: { name: 'LATE' }, settings: {} });
    assert(g.players[9].node, 'mid-round joiner gets a dog on the field');
    g.handleTap(9, 50, 50);
    const before = { x: g.players[9].x, y: g.players[9].y };
    g.tick();
    assert(g.players[9].x !== before.x || g.players[9].y !== before.y, 'new dog can move');

    g.handlePlayerDisconnect(9);
    assert(!g.players[9]);
    assert.strictEqual(g.phase, 'herding');
    g.handlePlayerDisconnect(1);
    assert.strictEqual(g.phase, 'lobby', 'no players left returns to lobby');
    g.close();
});
