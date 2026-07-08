const assert = require('assert');

const gamePath = `${global.gameRoot}/defuse/index.js`;
const Defuse = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(Defuse);

const makeLobby = (playerCount) => {
    const g = new Defuse();
    const names = ['ALICE', 'BOB', 'CARA', 'DAN', 'ERIN', 'FRAN', 'GUS', 'HAL'];
    for (let i = 1; i <= playerCount; i++) {
        g.handleNewPlayer({ playerId: i, info: { name: names[i - 1] }, settings: {} });
    }
    return g;
};

const solveModule = (g, m) => {
    const d = g.defuserId;
    if (m.key === 'wires') {
        g.cutWire(d, m, m.answer.index);
    } else if (m.key === 'keypad') {
        m.order.forEach(glyph => g.pressKeypad(d, m, glyph));
    } else if (m.key === 'button') {
        let guard = 3000;
        while (m.rule.digit && !g.timerStr.replace(':', '').includes(m.rule.digit) && guard--) {
            g.tick();
        }
        g.pressButton(d, m);
    } else {
        let guard = 5000;
        while (!m.disarmed && g.phase === 'active' && guard--) {
            if (g.seqFlashing(m)) {
                g.tick();
                continue;
            }
            const expected = Defuse.SEQ_MAPS[Math.min(g.bomb.strikes, 2)][m.seq[m.inputIdx]];
            g.pressPad(d, m, expected);
            g.tick();
        }
    }
    assert(m.disarmed, `module ${m.key} should be disarmed`);
};

global.test('Defuse: full mission playthrough with 3 players', () => {
    const g = makeLobby(3);
    assert.strictEqual(g.phase, 'lobby');

    g.toggleReady(1);
    g.toggleReady(2);
    assert.strictEqual(g.phase, 'lobby');
    g.toggleReady(3);
    assert.strictEqual(g.phase, 'active');

    const defusers = [];
    for (let bombNum = 0; bombNum < 3; bombNum++) {
        assert.strictEqual(g.phase, 'active');
        assert.strictEqual(g.bombIndex, bombNum);
        assert.strictEqual(g.bomb.modules.length, [2, 3, 4][bombNum]);
        defusers.push(g.defuserId);

        const experts = g.bombRoster.filter(pid => pid !== g.defuserId);
        experts.forEach(pid => {
            assert(g.pagesByPid[pid] && g.pagesByPid[pid].length >= 1, 'every expert holds at least one page');
            g.flipPage(pid, 1);
        });

        for (let i = 0; i < 20; i++) g.tick();
        g.bomb.modules.forEach(m => solveModule(g, m));

        assert.strictEqual(g.phase, 'debrief');
        assert(g.lastResult.defused, 'bomb should be defused');
        g.continueMission(1);
    }

    assert.strictEqual(g.phase, 'gameover');
    assert.strictEqual(g.record.defused, 3);
    assert(new Set(defusers).size === 3, 'defuser should rotate across bombs');

    g.playAgain(2);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});

global.test('Defuse: three strikes explodes the bomb', () => {
    const g = makeLobby(2);
    g.toggleReady(1);
    g.toggleReady(2);
    assert.strictEqual(g.phase, 'active');

    g.strike('TEST');
    g.strike('TEST');
    assert.strictEqual(g.bomb.strikes, 2);
    assert.strictEqual(g.phase, 'active');
    g.strike('TEST');
    assert.strictEqual(g.phase, 'exploding');

    for (let i = 0; i < 25; i++) g.tick();
    assert.strictEqual(g.phase, 'debrief');
    assert.strictEqual(g.lastResult.defused, false);
    assert(g.lastResult.cause.includes('THIRD STRIKE'));

    g.continueMission(2);
    assert.strictEqual(g.phase, 'active');
    assert.strictEqual(g.bombIndex, 1);
    g.close();
});

global.test('Defuse: timer runs out', () => {
    const g = makeLobby(2);
    g.toggleReady(1);
    g.toggleReady(2);
    const total = 240 * 10 + 30;
    for (let i = 0; i < total && g.phase !== 'debrief'; i++) g.tick();
    assert.strictEqual(g.phase, 'debrief');
    assert.strictEqual(g.lastResult.defused, false);
    assert(g.lastResult.cause.includes('TIME'));
    g.close();
});

global.test('Defuse: defuser disconnect promotes an expert, then aborts under 2 players', () => {
    const g = makeLobby(3);
    g.toggleReady(1);
    g.toggleReady(2);
    g.toggleReady(3);
    assert.strictEqual(g.phase, 'active');

    const originalDefuser = g.defuserId;
    g.handlePlayerDisconnect(originalDefuser);
    assert.strictEqual(g.phase, 'active');
    assert(g.defuserId !== originalDefuser, 'a new defuser should be promoted');
    assert(g.bombRoster.length === 2);

    const expert = g.bombRoster.find(pid => pid !== g.defuserId);
    g.handlePlayerDisconnect(expert);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});

global.test('Defuse: mid-bomb joiner spectates, then deals in next bomb', () => {
    const g = makeLobby(2);
    g.toggleReady(1);
    g.toggleReady(2);
    assert.strictEqual(g.phase, 'active');

    g.handleNewPlayer({ playerId: 5, info: { name: 'LATE' }, settings: {} });
    assert(!g.bombRoster.includes(5), 'late joiner should not be in the current bomb');

    g.strike('TEST');
    g.strike('TEST');
    g.strike('TEST');
    for (let i = 0; i < 25; i++) g.tick();
    assert.strictEqual(g.phase, 'debrief');
    g.continueMission(1);
    assert(g.bombRoster.includes(5), 'late joiner should deal in on the next bomb');
    g.close();
});

global.test('Defuse: wrong inputs strike without disarming', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
        const g = makeLobby(2);
        g.toggleReady(1);
        g.toggleReady(2);
        const wires = g.bomb.modules.find(m => m.key === 'wires');
        if (!wires) {
            g.close();
            continue;
        }
        const wrong = wires.wires.findIndex((w, i) => i !== wires.answer.index);
        g.cutWire(g.defuserId, wires, wrong);
        assert.strictEqual(g.bomb.strikes, 1);
        assert(!wires.disarmed);
        assert(wires.wires[wrong].cut);
        g.cutWire(g.defuserId, wires, wires.answer.index);
        assert(wires.disarmed);
        g.close();
        return;
    }
});
