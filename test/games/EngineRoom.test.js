const assert = require('assert');

const gamePath = `${global.gameRoot}/engine-room/index.js`;
const EngineRoom = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(EngineRoom);

const makeGame = (playerCount) => {
    const g = new EngineRoom();
    const names = ['ALICE', 'BOB', 'CARA', 'DANA'];
    for (let i = 1; i <= playerCount; i++) {
        g.handleNewPlayer({ playerId: i, info: { name: names[i - 1] }, settings: {} });
    }
    return g;
};

// Point pid's order at a known control with a known target
const craftOrder = (g, pid, control, target) => {
    g.orders[pid] = {
        controlId: control.id,
        type: control.type,
        target,
        deadline: g._t + 200
    };
};

global.test('EngineRoom: launch deals unique controls and an order to every crew member', () => {
    const g = makeGame(3);
    g.startGame(1);
    assert.strictEqual(g.phase, 'playing');
    assert.strictEqual(g.controls.length, 12, '4 controls per player');
    [1, 2, 3].forEach(pid => {
        assert.strictEqual(g.controls.filter(c => c.owner === pid).length, 4);
        const order = g.orders[pid];
        assert(order, `player ${pid} has an order`);
        assert(g.controls.find(c => c.id === order.controlId), 'order targets a real control');
        assert(g.orderText(order).length > 0, 'order renders as text');
    });
    const labels = new Set(g.controls.map(c => c.label));
    assert.strictEqual(labels.size, 12, 'control names are unique');
    g.close();
});

global.test('EngineRoom: filling an order scores the fix, credits both crew, and issues a new order', () => {
    const g = makeGame(2);
    g.startGame(1);

    const button = g.controls.find(c => c.owner === 2 && c.type === 'button');
    craftOrder(g, 1, button, null);
    g.operateControl(2, button.id);

    assert.strictEqual(g.completedTotal, 1);
    assert.strictEqual(g.fixes[2], 1, 'the operator gets the fix');
    assert.strictEqual(g.relays[1], 1, 'the shouter gets the relay');
    assert(g.orders[1], 'the shouter gets a fresh order');
    assert.notStrictEqual(g.orders[1].controlId, undefined);
    g.close();
});

global.test('EngineRoom: toggles and dials only complete when they reach the ordered state', () => {
    const g = makeGame(2);
    g.startGame(1);

    const toggle = g.controls.find(c => c.owner === 2 && c.type === 'toggle');
    craftOrder(g, 1, toggle, !toggle.state);
    g.operateControl(2, toggle.id);
    assert.strictEqual(g.completedTotal, 1, 'flipping to the target completes the order');

    const dial = g.controls.find(c => c.owner === 2 && c.type === 'dial');
    const wrong = dial.state % 4 + 1;
    const right = wrong % 4 + 1;
    craftOrder(g, 1, dial, right);
    g.operateControl(2, dial.id);
    assert.strictEqual(g.completedTotal, 1, 'landing on the wrong position does nothing');
    g.operateControl(2, dial.id);
    assert.strictEqual(g.completedTotal, 2, 'cycling to the target completes it');

    // Someone else's console is off limits
    const own = g.controls.find(c => c.owner === 1);
    const before = g.completedTotal;
    g.operateControl(2, own.id);
    assert.strictEqual(g.completedTotal, before, 'only the owner can work a control');
    g.close();
});

global.test('EngineRoom: missed orders cost hull, hull zero blows the ship', () => {
    const g = makeGame(2);
    g.startGame(1);

    const hullBefore = g.hull;
    g.orders[1].deadline = g._t;
    g.tick();
    assert.strictEqual(g.hull, hullBefore - 1, 'expiry costs one hull');
    assert(g.orders[1], 'a replacement order is issued');
    assert.strictEqual(g.phase, 'playing');

    g.hull = 1;
    g.orders[1].deadline = g._t;
    g.tick();
    assert.strictEqual(g.phase, 'debrief');
    assert.strictEqual(g.victory, false);

    g.playAgain(1);
    assert.strictEqual(g.phase, 'lobby');
    g.close();
});

global.test('EngineRoom: repairs advance sectors with a hull bonus, final repair wins', () => {
    const g = makeGame(2);
    g.startGame(1);

    const button = g.controls.find(c => c.owner === 2 && c.type === 'button');
    g.completedTotal = 7;
    g.hull = 3;
    craftOrder(g, 1, button, null);
    g.operateControl(2, button.id);
    assert.strictEqual(g.sector, 2, '8th repair opens sector 2');
    assert.strictEqual(g.hull, 5, 'sector clear patches the hull');

    g.completedTotal = 23;
    craftOrder(g, 1, button, null);
    g.operateControl(2, button.id);
    assert.strictEqual(g.phase, 'debrief');
    assert.strictEqual(g.victory, true, '24th repair saves the ship');
    g.close();
});

global.test('EngineRoom: a disconnect mid-game retargets orphaned orders or ends the shift', () => {
    const g = makeGame(3);
    g.startGame(1);

    const bobControl = g.controls.find(c => c.owner === 2);
    craftOrder(g, 1, bobControl, bobControl.type === 'button' ? null : bobControl.state);
    g.handlePlayerDisconnect(2);
    assert.strictEqual(g.phase, 'playing', 'two crew can keep flying');
    assert(!g.controls.some(c => c.owner === 2), 'their console is gone');
    const order = g.orders[1];
    assert(order && g.controls.find(c => c.id === order.controlId), 'the orphaned order was reissued onto a live control');

    g.handlePlayerDisconnect(3);
    assert.strictEqual(g.phase, 'lobby', 'one crew member cannot fly the ship');
    g.close();
});
