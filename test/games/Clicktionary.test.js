const assert = require('assert');

const gamePath = `${global.gameRoot}/clicktionary/index.js`;
const Clicktionary = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(Clicktionary);

const makeGame = (playerCount) => {
    const g = new Clicktionary();
    const names = ['ALICE', 'BOB', 'CARA', 'DAN', 'ERIN', 'FRAN', 'GUS', 'HAL'];
    for (let i = 1; i <= playerCount; i++) {
        g.handleNewPlayer({ playerId: i, info: { name: names[i - 1] }, settings: {} });
    }
    return g;
};

global.test('Clicktionary: full game playthrough with 3 players', () => {
    const g = makeGame(3);
    assert.strictEqual(g.phase, 'lobby');

    g.startGame(1);
    assert.strictEqual(g.phase, 'picking');
    assert.strictEqual(g.drawQueue.length, 6, '3 players <= 5 means 2 cycles');

    const drawers = [];
    for (let round = 0; round < 6; round++) {
        assert.strictEqual(g.phase, 'picking');
        const drawer = g.drawerId;
        drawers.push(drawer);
        assert.strictEqual(g.choices.length, 3);

        g.pickWord(999, 0);
        assert.strictEqual(g.phase, 'picking', 'non-drawer cannot pick');
        g.pickWord(drawer, 1);
        assert.strictEqual(g.phase, 'drawing');

        g.drawDot(drawer, 50, 50);
        g.drawDot(drawer, 51, 50);
        const guesser = Object.keys(g.players).map(Number).find(pid => pid !== drawer);
        g.drawDot(guesser, 55, 55);
        assert.strictEqual(g.pending.length, 2, 'only the drawer can draw');
        g.tick();
        assert.strictEqual(g.pending.length, 0, 'dots flush on tick');

        g.submitGuess(guesser, 'zzzz not the word');
        assert(g.feed.some(e => !e.good), 'wrong guess lands in the feed');

        const guessers = Object.keys(g.players).map(Number).filter(pid => pid !== drawer);
        const scoresBefore = guessers.map(pid => g.players[pid].score);
        guessers.forEach(pid => g.submitGuess(pid, g.word));
        guessers.forEach((pid, i) => {
            assert(g.players[pid].score > scoresBefore[i], 'correct guess scores points');
        });
        assert.strictEqual(g.phase, 'reveal', 'all correct ends the round early');

        for (let i = 0; i < 70 && g.phase === 'reveal'; i++) g.tick();
    }

    assert.strictEqual(g.phase, 'podium');
    assert.strictEqual(new Set(drawers).size, 3, 'every player drew');
    assert(g.players[1].score > 0);

    g.playAgain(2);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});

global.test('Clicktionary: close guesses stay private, scoring favors speed', () => {
    const g = makeGame(2);
    g.startGame(1);
    g.pickWord(g.drawerId, 0);
    const guesser = Object.keys(g.players).map(Number).find(pid => pid !== g.drawerId);

    const close = g.word.slice(0, -1) + 'z';
    g.submitGuess(guesser, close);
    assert.strictEqual(g.feed.length, 0, 'close guess must not appear in the public feed');
    assert(!g.correct.has(guesser));

    for (let i = 0; i < 100; i++) g.tick();
    g.submitGuess(guesser, ` ${g.word.toUpperCase()} `);
    assert(g.correct.has(guesser), 'guess matching is case/whitespace insensitive');
    const pts = g.players[guesser].score;
    assert(pts >= 100 && pts <= 100 + 75, `points in expected band, got ${pts}`);
    assert.strictEqual(g.players[g.drawerId].score, 40, 'artist scores per correct guesser');
    g.close();
});

global.test('Clicktionary: pick and draw timers auto-advance', () => {
    const g = makeGame(2);
    g.startGame(1);
    assert.strictEqual(g.phase, 'picking');
    for (let i = 0; i < 15 * 10 + 5 && g.phase === 'picking'; i++) g.tick();
    assert.strictEqual(g.phase, 'drawing', 'pick phase auto-picks a word');
    assert(g.word);

    for (let i = 0; i < 75 * 10 + 5 && g.phase === 'drawing'; i++) g.tick();
    assert.strictEqual(g.phase, 'reveal', 'draw phase times out into reveal');
    assert(g.revealed.size > 0 || g.word.length < 4, 'letter hints revealed during a full round');
    g.close();
});

global.test('Clicktionary: drawer disconnect ends the round, under 2 players ends the game', () => {
    const g = makeGame(3);
    g.startGame(1);
    g.pickWord(g.drawerId, 0);
    const firstDrawer = g.drawerId;

    g.handlePlayerDisconnect(firstDrawer);
    assert.strictEqual(g.phase, 'reveal');
    for (let i = 0; i < 70 && g.phase === 'reveal'; i++) g.tick();
    assert.strictEqual(g.phase, 'picking');
    assert(g.drawerId !== firstDrawer);

    const remaining = Object.keys(g.players).map(Number);
    g.handlePlayerDisconnect(remaining.find(pid => pid !== g.drawerId) || remaining[0]);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});

global.test('Clicktionary: ink cap and clear', () => {
    const g = makeGame(2);
    g.startGame(1);
    g.pickWord(g.drawerId, 0);
    for (let i = 0; i < 500; i++) {
        g.drawDot(g.drawerId, 40 + (i % 30), 40 + Math.floor(i / 30));
    }
    assert.strictEqual(g.inkUsed, 450, 'ink is capped');
    g.tick();
    g.clearCanvas(g.drawerId);
    assert.strictEqual(g.inkUsed, 0);
    g.drawDot(g.drawerId, 50, 50);
    assert.strictEqual(g.pending.length, 1, 'drawing works again after clear');
    g.close();
});

global.test('Clicktionary: wrong guesses pop up on screen for everyone and expire', () => {
    const g = makeGame(3);
    g.startGame(1);
    g.pickWord(g.drawerId, 0);
    const guessers = Object.keys(g.players).map(Number).filter(pid => pid !== g.drawerId);

    g.submitGuess(guessers[0], 'zzzz wrong');
    assert.strictEqual(g.bubbles.length, 1, 'wrong guess spawns a bubble');
    assert(!g.bubbles[0].node.node.playerIds || g.bubbles[0].node.node.playerIds.length === 0, 'bubble is visible to everyone');

    for (let i = 0; i < 10; i++) {
        g.submitGuess(guessers[1], `zzzz wrong ${i}`);
    }
    assert.strictEqual(g.bubbles.length, 6, 'concurrent bubbles are capped');

    const yBefore = g.bubbles[0].y;
    g.tick();
    assert(g.bubbles[0].y < yBefore, 'bubbles drift upward');

    for (let i = 0; i < 35; i++) g.tick();
    assert.strictEqual(g.bubbles.length, 0, 'bubbles expire');

    g.submitGuess(guessers[0], g.word);
    assert.strictEqual(g.bubbles.length, 1, 'correct guess spawns a GOT IT bubble');
    g.close();
});

global.test('Clicktionary: mid-game joiner becomes a guesser immediately', () => {
    const g = makeGame(2);
    g.startGame(1);
    g.pickWord(g.drawerId, 0);
    g.handleNewPlayer({ playerId: 7, info: { name: 'LATE' }, settings: {} });
    assert(g.players[7]);
    g.submitGuess(7, g.word);
    assert(g.correct.has(7), 'late joiner can guess and score');
    assert(g.players[7].score > 0);
    g.close();
});
