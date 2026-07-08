const assert = require('assert');

const gamePath = `${global.gameRoot}/seance/index.js`;
const Seance = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(Seance);

const makeGame = (playerCount) => {
    const g = new Seance();
    const names = ['ALICE', 'BOB', 'CARA'];
    for (let i = 1; i <= playerCount; i++) {
        g.handleNewPlayer({ playerId: i, info: { name: names[i - 1] }, settings: {} });
    }
    return g;
};

global.test('Seance: hands pull the planchette and the board keeps receipts', () => {
    const g = makeGame(2);
    g.beginSeance(1);
    assert.strictEqual(g.phase, 'seance');

    const startX = g.px;
    for (let i = 0; i < 20; i++) {
        g.handleHold(1, 90, g.py);
        g.tick();
    }
    assert(g.px > startX + 2, `a held hand drags the planchette (${startX} -> ${g.px.toFixed(1)})`);
    assert(g.influence[1] > 0, 'influence is tracked');
    assert(!g.influence[2], 'idle hands accrue nothing');
    assert(g.spiritInfluence > 0, 'the spirits are always faintly present');
    g.close();
});

global.test('Seance: dwelling on a letter spells it out', () => {
    const g = makeGame(1);
    g.beginSeance(1);

    const letterA = { x: 15, y: 44 };
    g.px = letterA.x;
    g.py = letterA.y;
    g.vx = 0;
    g.vy = 0;
    for (let i = 0; i < 20 && !g.message; i++) g.tick();
    assert.strictEqual(g.message, 'A', 'dwelling selects the letter');
    assert(Math.sqrt(g.vx * g.vx + g.vy * g.vy) > 0.2, 'selection shoves the planchette away');
    g.close();
});

global.test('Seance: YES appends a word, GOODBYE ends with the fraud reveal', () => {
    const g = makeGame(2);
    g.beginSeance(1);

    g.px = 20; g.py = 24; g.vx = 0; g.vy = 0;
    for (let i = 0; i < 20 && !g.message; i++) g.tick();
    assert.strictEqual(g.message, 'YES ');

    for (let i = 0; i < 10; i++) {
        g.handleHold(2, g.px + 5, g.py);
        g.tick();
    }

    g.px = 50; g.py = 88; g.vx = 0; g.vy = 0;
    for (let i = 0; i < 40 && g.phase === 'seance'; i++) {
        g.px = 50; g.py = 88;
        g.tick();
    }
    assert.strictEqual(g.phase, 'farewell', 'GOODBYE ends the seance');
    assert.deepStrictEqual(g.transcript, ['YES'], 'the message lands in the transcript');
    assert(g.influence[2] > 0, 'receipts survive to the reveal');

    g.summonAgain(1);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});

global.test('Seance: clear pushes the transcript, messages cap and roll over', () => {
    const g = makeGame(1);
    g.beginSeance(1);
    g.message = 'HELLO';
    g.clearMessage(1);
    assert.strictEqual(g.message, '');
    assert.deepStrictEqual(g.transcript, ['HELLO']);

    g.message = 'X'.repeat(25);
    g.selectPoint({ label: 'A', append: 'A', x: 15, y: 44 });
    assert.strictEqual(g.message, '', 'overflow rolls into the transcript');
    assert.strictEqual(g.transcript.length, 2);
    g.close();
});

global.test('Seance: last guest leaving snuffs the candles', () => {
    const g = makeGame(1);
    g.beginSeance(1);
    g.handlePlayerDisconnect(1);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});
