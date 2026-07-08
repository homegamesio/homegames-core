const assert = require('assert');

const gamePath = `${global.gameRoot}/fakeout/index.js`;
const Fakeout = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(Fakeout);

const makeGame = (playerCount) => {
    const g = new Fakeout();
    const names = ['ALICE', 'BOB', 'CARA', 'DAN'];
    for (let i = 1; i <= playerCount; i++) {
        g.handleNewPlayer({ playerId: i, info: { name: names[i - 1] }, settings: {} });
    }
    return g;
};

global.test('Fakeout: full six-round game with truth votes and fooling', () => {
    const g = makeGame(3);
    g.startGame(1);
    assert.strictEqual(g.phase, 'writing');
    assert.strictEqual(g.facts.length, 6);

    const expected = { 1: 0, 2: 0, 3: 0 };
    for (let round = 0; round < 6; round++) {
        assert.strictEqual(g.phase, 'writing');
        g.submitLie(1, `XQZV ONE ${round}`);
        g.submitLie(2, `XQZV TWO ${round}`);
        assert.strictEqual(g.phase, 'writing', 'waits for every lie');
        g.submitLie(3, `XQZV THREE ${round}`);
        assert.strictEqual(g.phase, 'voting', 'all lies in starts the vote');
        assert.strictEqual(g.cards.length, 4, '3 lies + 1 truth');

        const truthIdx = g.cards.findIndex(c => c.isTruth);
        const caraIdx = g.cards.findIndex(c => c.authors.includes(3));

        const ownIdx = g.cards.findIndex(c => c.authors.includes(1));
        g.vote(1, ownIdx);
        assert.strictEqual(g.votesBy[1], undefined, 'cannot vote for your own lie');

        g.vote(1, truthIdx);
        g.vote(2, caraIdx);
        g.vote(3, truthIdx);
        assert.strictEqual(g.phase, 'reveal', 'all votes in starts the reveal');

        expected[1] += 100;
        expected[3] += 100 + 50;
        assert.strictEqual(g.players[1].score, expected[1]);
        assert.strictEqual(g.players[2].score, expected[2]);
        assert.strictEqual(g.players[3].score, expected[3]);

        for (let i = 0; i < 110 && g.phase === 'reveal'; i++) g.tick();
    }

    assert.strictEqual(g.phase, 'podium');
    g.playAgain(2);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});

global.test('Fakeout: writing the actual truth scores and removes your card', () => {
    const g = makeGame(2);
    g.startGame(1);
    g.submitLie(1, g.fact.a);
    assert(g.tooClose.has(1), 'truth-matching lie is caught');
    assert.strictEqual(g.players[1].score, 75);
    g.submitLie(2, 'XQZV FAKE');
    assert.strictEqual(g.phase, 'voting');
    assert.strictEqual(g.cards.length, 2, 'caught player contributes no card');
    assert(!g.cards.some(c => c.authors.includes(1)));
    g.close();
});

global.test('Fakeout: identical lies merge and both authors score', () => {
    const g = makeGame(3);
    g.startGame(1);
    g.submitLie(1, 'zebra cadabra');
    g.submitLie(2, 'ZEBRA   CADABRA');
    g.submitLie(3, 'XQWJ');
    assert.strictEqual(g.phase, 'voting');
    assert.strictEqual(g.cards.length, 3, 'duplicate lies merge into one card');

    const shared = g.cards.findIndex(c => c.authors.length === 2);
    assert(shared >= 0);
    g.vote(3, shared);
    const truthIdx = g.cards.findIndex(c => c.isTruth);
    g.vote(1, truthIdx);
    g.vote(2, truthIdx);
    assert.strictEqual(g.phase, 'reveal');
    assert.strictEqual(g.players[1].score, 150, 'shared lie pays both authors');
    assert.strictEqual(g.players[2].score, 150);
    g.close();
});

global.test('Fakeout: deadlines advance stalled phases', () => {
    const g = makeGame(2);
    g.startGame(1);
    g.submitLie(1, 'XQZV SOLO');
    assert.strictEqual(g.phase, 'writing');
    for (let i = 0; i < 60 * 10 + 5 && g.phase === 'writing'; i++) g.tick();
    assert.strictEqual(g.phase, 'voting', 'write deadline forces the vote');
    for (let i = 0; i < 35 * 10 + 5 && g.phase === 'voting'; i++) g.tick();
    assert.strictEqual(g.phase, 'reveal', 'vote deadline forces the reveal');
    for (let i = 0; i < 10 * 10 + 5 && g.phase === 'reveal'; i++) g.tick();
    assert.strictEqual(g.phase, 'writing');
    assert.strictEqual(g.roundIdx, 1);
    g.close();
});

global.test('Fakeout: disconnects unblock the round, under 2 ends the game', () => {
    const g = makeGame(3);
    g.startGame(1);
    g.submitLie(1, 'XQZV A');
    g.submitLie(2, 'XQZV B');
    g.handlePlayerDisconnect(3);
    assert.strictEqual(g.phase, 'voting', 'leaver no longer blocks the round');
    g.handlePlayerDisconnect(2);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});
