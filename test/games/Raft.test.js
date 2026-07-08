const assert = require('assert');

const gamePath = `${global.gameRoot}/raft/index.js`;
const Raft = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(Raft);

const makeGame = (playerCount) => {
    const g = new Raft();
    for (let i = 1; i <= playerCount; i++) {
        g.handleNewPlayer({ playerId: i, info: { name: `P${i}` }, settings: {} });
    }
    return g;
};

global.test('Raft: paddling steers, banks bonk, ducks quack', () => {
    const g = makeGame(3);
    g.startGame(1);
    assert.strictEqual(g.phase, 'running');

    g.paddle(1, 1);
    g.paddle(2, 1);
    assert(g.vx > 0, 'paddling right adds rightward velocity');
    assert.strictEqual(g.players[1].paddles, 1);
    g.paddle(3, -1);
    const capped = g.vx;
    for (let i = 0; i < 50; i++) g.paddle(1, 1);
    assert(g.vx <= 0.9, `velocity is capped (got ${g.vx}), was ${capped}`);

    const ch = g.channelAt(g.dist + 0.55);
    g.raftX = ch.left + 1;
    g.vx = -0.5;
    g.tick();
    assert.strictEqual(g.bonks, 1, 'hitting the left bank bonks');
    assert(g.raftX >= g.channelAt(g.dist).left + 3.9, 'raft is pushed off the bank');
    assert(g.vx > 0, 'bonk bounces the raft back');

    g.ducks = [];
    g.spawnDuck();
    const duck = g.ducks[0];
    duck.d = g.dist + 0.6;
    duck.x = g.raftX;
    g.tick();
    assert.strictEqual(g.ducksCaught, 1, 'overlapping a duck collects it');
    assert.strictEqual(g.ducks.length, 0);
    g.close();
});

global.test('Raft: run ends on the clock with a crew score', () => {
    const g = makeGame(2);
    g.startGame(1);
    for (let i = 0; i < 150 * 15 + 5 && g.phase === 'running'; i++) {
        if (i % 3 === 0) {
            const ch = g.channelAt(g.dist);
            g.paddle(1, g.raftX < (ch.left + ch.right) / 2 ? 1 : -1);
        }
        g.tick();
    }
    assert.strictEqual(g.phase, 'results');
    assert(g.dist > 1000, `should travel a real distance (got ${g.dist.toFixed(0)})`);
    g.playAgain(2);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});

global.test('Raft: crew changes mid-run rebuild the raft, empty crew ends it', () => {
    const g = makeGame(1);
    g.startGame(1);
    g.handleNewPlayer({ playerId: 5, info: { name: 'LATE' }, settings: {} });
    assert.strictEqual(g.crewNodes.length, 2, 'late joiner gets a seat');
    g.paddle(5, -1);
    assert.strictEqual(g.players[5].paddles, 1);

    g.handlePlayerDisconnect(5);
    assert.strictEqual(g.crewNodes.length, 1);
    g.handlePlayerDisconnect(1);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});
