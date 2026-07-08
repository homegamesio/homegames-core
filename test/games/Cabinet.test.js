const assert = require('assert');

const gamePath = `${global.gameRoot}/cabinet/index.js`;
const Cabinet = require(gamePath);
const { Chip8, assemble } = require(`${global.gameRoot}/cabinet/chip8.js`);
const ROM = require(`${global.gameRoot}/cabinet/rom.js`);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(Cabinet);

const makeGame = (playerCount) => {
    const g = new Cabinet();
    const names = ['ALICE', 'BOB', 'CARA'];
    for (let i = 1; i <= playerCount; i++) {
        g.handleNewPlayer({ playerId: i, info: { name: names[i - 1] }, settings: {} });
    }
    return g;
};

const seatAndBoot = (g) => {
    g.toggleSeat(1, 'left');
    g.toggleSeat(2, 'right');
    g.startMatch(1);
    g.emu.rng = () => 0.25; // deterministic serves
    return g;
};

global.test('Cabinet: the assembler encodes CHIP-8 machine code', () => {
    const { bytes, labels } = assemble(`
top:
    CLS
    LD V1, 0x0D
    ADD V1, 255
    SE V1, 12
    DRW V1, V2, 5
    JP top
    `);
    assert.deepStrictEqual(
        Array.from(bytes),
        [0x00, 0xE0, 0x61, 0x0D, 0x71, 0xFF, 0x31, 0x0C, 0xD1, 0x25, 0x12, 0x00]
    );
    assert.strictEqual(labels.top, 0x200);
});

global.test('Cabinet: the CPU does arithmetic with carry flags and XOR sprite drawing', () => {
    const { bytes } = assemble(`
    LD V0, 200
    LD V1, 100
    ADD V0, V1
    LD I, spr
    LD V2, 10
    LD V3, 5
    DRW V2, V3, 1
    DRW V2, V3, 1
halt:
    JP halt
spr:
    DB 0x80
    `);
    const emu = new Chip8(bytes);
    emu.run(3);
    assert.strictEqual(emu.V[0], 44, '200 + 100 wraps to 44');
    assert.strictEqual(emu.V[0xF], 1, 'carry flag is set');
    emu.run(4);
    assert.strictEqual(emu.display[5 * 64 + 10], 1, 'sprite pixel lands on the framebuffer');
    assert.strictEqual(emu.V[0xF], 0, 'no collision on a blank screen');
    emu.run(1);
    assert.strictEqual(emu.display[5 * 64 + 10], 0, 'XOR redraw erases the pixel');
    assert.strictEqual(emu.V[0xF], 1, 'and reports the collision');
});

global.test('Cabinet: the PONG ROM boots - paddles, scores, and a moving ball', () => {
    const g = seatAndBoot(makeGame(2));
    assert.strictEqual(g.phase, 'playing');
    g.tick();
    assert.strictEqual(g.emu.display[13 * 64 + 2], 1, 'left paddle is on screen');
    assert.strictEqual(g.emu.display[13 * 64 + 61], 1, 'right paddle is on screen');
    assert.strictEqual(g.emu.display[1 * 64 + 26], 1, 'left score digit is on screen');
    assert.strictEqual(g.emu.display[1 * 64 + 34], 1, 'right score digit is on screen');
    const ballX = g.emu.V[3];
    for (let i = 0; i < 3; i++) g.tick();
    assert.notStrictEqual(g.emu.V[3], ballX, 'the ball moves on its own');
    assert(g.rowKeys.some(k => k.length), 'the framebuffer reaches the scene graph');
    g.close();
});

global.test('Cabinet: holding a pad drives the paddle inside the emulated machine', () => {
    const g = seatAndBoot(makeGame(2));
    g.tick();
    const before = g.emu.V[1];
    for (let i = 0; i < 6; i++) {
        g.pressPad(1, 'down');
        g.tick();
    }
    assert(g.emu.V[1] > before, `left paddle moved down inside the VM (${before} -> ${g.emu.V[1]})`);
    assert.strictEqual(g.emu.display[(g.emu.V[1] + 2) * 64 + 2], 1, 'and the framebuffer shows it');

    const spectatorSafe = g.emu.V[2];
    g.pressPad(3, 'up'); // not seated, not even present
    g.tick();
    assert.strictEqual(g.emu.V[2], spectatorSafe, 'only seated players reach the keypad');
    g.close();
});

global.test('Cabinet: a missed ball scores inside the VM', () => {
    const g = seatAndBoot(makeGame(2));
    g.tick();
    // Aim the ball past the left paddle: at x=5 moving left, well below the paddle
    g.emu.V[3] = 5;
    g.emu.V[4] = (g.emu.V[1] + 10) % 28;
    g.emu.V[5] = 255;
    let guard = 0;
    while (g.emu.V[8] === 0 && guard++ < 30) {
        g.tick();
    }
    assert.strictEqual(g.emu.V[8], 1, 'the right side scores when the left misses');
    assert.strictEqual(g.phase, 'playing', 'the match continues');
    g.close();
});

global.test('Cabinet: seventh point halts the CPU, winner keeps the seat', () => {
    const g = seatAndBoot(makeGame(3));
    g.tick();
    // Left is one point from victory; send the ball past the right paddle
    g.emu.V[7] = 6;
    g.emu.V[3] = 58;
    g.emu.V[4] = (g.emu.V[2] + 10) % 28;
    g.emu.V[5] = 1;
    let guard = 0;
    while (g.phase === 'playing' && guard++ < 30) {
        g.tick();
    }
    assert.strictEqual(g.phase, 'gameover');
    assert.strictEqual(g.matchResult.winnerName, 'ALICE');
    assert.strictEqual(g.seats.left, 1, 'the winner keeps the seat');
    assert.strictEqual(g.seats.right, null, "the loser's seat opens up");

    g.insertCoin(3);
    assert.strictEqual(g.phase, 'lobby');
    assert.strictEqual(g.emu, null, 'the machine powers down');
    g.close();
});

global.test('Cabinet: seats swap in the lobby, a seated player leaving ends the match', () => {
    const g = makeGame(3);
    g.toggleSeat(1, 'left');
    g.toggleSeat(2, 'left');
    assert.strictEqual(g.seats.left, 1, 'an occupied seat cannot be stolen');
    g.toggleSeat(2, 'right');
    g.toggleSeat(1, 'right');
    assert.strictEqual(g.seats.right, 2, 'still occupied');
    assert.strictEqual(g.seats.left, 1, 'and nobody moved');
    g.startMatch(1);
    assert.strictEqual(g.phase, 'playing');

    g.handlePlayerDisconnect(2);
    assert.strictEqual(g.phase, 'lobby', 'the cabinet powers down mid-match');
    assert.strictEqual(g.seats.right, null);
    g.close();
});

global.test('Cabinet: the ROM plays a full unattended match and halts at game over', () => {
    const emu = new Chip8(ROM.bytes);
    let guard = 0;
    while (emu.V[7] < 7 && emu.V[8] < 7 && guard++ < 3000) {
        emu.run(600);
    }
    assert(emu.V[7] === 7 || emu.V[8] === 7, `someone reaches 7 (${emu.V[7]}-${emu.V[8]})`);
    const haltedAt = emu.pc;
    emu.run(100);
    assert.strictEqual(emu.pc, haltedAt, 'the CPU spins on its halt instruction');
    assert.strictEqual(haltedAt, ROM.labels.game_over, 'exactly where the assembly says it should');
});
