const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');
const { Chip8 } = require('./chip8');
const ROM = require('./rom');

const TICK_RATE = 15;
const MAX_PLAYERS = 8;

const CYCLES_PER_TICK = 600;   // ~9000 Hz CPU
const TIMER_DIV = 150;         // 9000 / 150 = 60Hz delay/sound timers
const SYNC_BUDGET = 400;       // extra cycles to settle on the ROM's vsync loop
const HOLD_TICKS = 3;          // a tap counts as a held key for this long
const WIN_SCORE = 7;           // must match the ROM

// CHIP-8 keypad wiring, must match the ROM
const KEY_LEFT_UP = 0x1;
const KEY_LEFT_DOWN = 0x4;
const KEY_RIGHT_UP = 0xC;
const KEY_RIGHT_DOWN = 0xD;

// 64x32 framebuffer mapped to screen units (square pixels at 16:9)
const SCREEN_X = 18;
const SCREEN_Y = 16;
const PX_W = 1;
const PX_H = 16 / 9;

const TEXT_H = (size) => size * 16 / 9;

// Break-room-at-midnight palette: dust, wood, and amber phosphor
const BG = [26, 24, 28, 255];
const WOOD = [72, 52, 40, 255];
const WOOD_EDGE = [40, 28, 22, 255];
const CRT = [10, 12, 9, 255];
const PIXEL = [255, 191, 80, 255];
const AMBER = [255, 191, 80, 255];
const INK = [232, 228, 220, 255];
const FAINT = [140, 134, 128, 255];
const GOOD = [130, 225, 150, 255];
const BAD = [235, 100, 90, 255];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

class Cabinet extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'The Cabinet',
            author: 'Joseph Garcia',
            description: 'Someone left a computer from 1977 in the break room. It is a real emulated CHIP-8 CPU - RAM, registers, and all - and the only ROM anyone can find is PONG. Two take the seats, everyone else watches the machine think.',
            aspectRatio: { x: 16, y: 9 },
            services: ['multiplayer'],
            maxPlayers: MAX_PLAYERS,
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this._t = 0;
        this.dirty = false;
        this.phase = 'lobby';
        this.players = {};
        this.seats = { left: null, right: null };
        this.holds = {};
        this.emu = null;
        this.matchResult = null;
        this.lobbyMsg = null;

        this.base = this.rect(0, 0, 100, 100, BG);

        this.titleLabel = this.text('THE CABINET', 2, 1.5, 1.2, FAINT);
        this.scoreLabel = this.text('', 50, 6, 1.8, INK, 'center');
        this.subLabel = this.text('', 50, 10.5, 1, FAINT, 'center');
        this.hudLine1 = this.text('', 50, 75.5, 1, AMBER, 'center');
        this.hudLine2 = this.text('', 50, 78.3, 0.9, FAINT, 'center');
        this.hudLine3 = this.text('', 50, 81.1, 0.9, FAINT, 'center');

        this.mainLayer = this.container();
        this.displayLayer = this.container();
        this.rowNodes = [];
        this.rowKeys = new Array(32).fill('');
        for (let r = 0; r < 32; r++) {
            const row = this.container();
            this.rowNodes.push(row);
            this.displayLayer.addChild(row);
        }
        this.playerLayer = this.container();

        this.base.addChildren(
            this.titleLabel, this.scoreLabel, this.subLabel,
            this.hudLine1, this.hudLine2, this.hudLine3,
            this.mainLayer, this.displayLayer, this.playerLayer
        );

        this.refresh();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    canAddPlayer() {
        return Object.keys(this.players).length < MAX_PLAYERS;
    }

    // ---- node helpers ----

    container() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    rect(x, y, w, h, fill, opts = {}) {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill,
            ...opts
        });
    }

    text(str, x, y, size, color, align = 'left') {
        return new GameNode.Text({
            textInfo: { text: str, x, y, size, align, font: 'monospace', color }
        });
    }

    setText(node, str) {
        if (node.node.text.text !== str) {
            node.node.text = { ...node.node.text, text: str };
            this.dirty = true;
        }
    }

    makeButton({ x, y, w, h, label, size, fill, onClick }) {
        const bg = this.rect(x, y, w, h, fill, { border: 4, color: [14, 12, 14, 255], onClick });
        bg.addChild(this.text(label, x + w / 2, y + (h - TEXT_H(size)) / 2, size, INK, 'center'));
        return bg;
    }

    // ---- players ----

    handleNewPlayer({ playerId, info }) {
        const pid = Number(playerId);
        if (this.players[pid] || Object.keys(this.players).length >= MAX_PLAYERS) {
            return;
        }
        const name = ((info && info.name) || `PLAYER ${pid}`).toUpperCase().slice(0, 10);
        const root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [pid]
        });
        this.players[pid] = { name, root };
        this.playerLayer.addChild(root);
        this.refresh();
    }

    handlePlayerDisconnect(playerId) {
        const pid = Number(playerId);
        const p = this.players[pid];
        if (!p) {
            return;
        }
        this.playerLayer.removeChild(p.root.node.id);
        delete this.players[pid];
        delete this.holds[pid];
        const seated = this.seatOf(pid);
        if (seated) {
            this.seats[seated] = null;
            if (this.phase === 'playing') {
                return this.abortToLobby(`${p.name} WALKED AWAY FROM THE CABINET`);
            }
        }
        this.refresh();
    }

    seatOf(pid) {
        if (this.seats.left === pid) {
            return 'left';
        }
        if (this.seats.right === pid) {
            return 'right';
        }
        return null;
    }

    seatName(side) {
        const pid = this.seats[side];
        return pid && this.players[pid] ? this.players[pid].name : '???';
    }

    // ---- flow ----

    toggleSeat(pid, side) {
        if (this.phase !== 'lobby' || !this.players[pid]) {
            return;
        }
        if (this.seats[side] === pid) {
            this.seats[side] = null;
        } else if (!this.seats[side]) {
            const current = this.seatOf(pid);
            if (current) {
                this.seats[current] = null;
            }
            this.seats[side] = pid;
        }
        this.refresh();
    }

    startMatch(pid) {
        if (this.phase !== 'lobby' || !this.players[pid] || !this.seats.left || !this.seats.right) {
            return;
        }
        this.emu = new Chip8(ROM.bytes, { timerDiv: TIMER_DIV });
        this.holds = {};
        this.matchResult = null;
        this.lobbyMsg = null;
        this.rowKeys.fill('');
        this.rowNodes.forEach(row => row.clearChildren());
        this.phase = 'playing';
        this.refresh();
    }

    endMatch(side) {
        this.matchResult = {
            winnerName: this.seatName(side),
            loserName: this.seatName(side === 'left' ? 'right' : 'left'),
            left: this.emu.V[7],
            right: this.emu.V[8]
        };
        // Winner stays on; the loser's seat opens up
        this.seats[side === 'left' ? 'right' : 'left'] = null;
        this.clearScreen();
        this.phase = 'gameover';
        this.refresh();
    }

    insertCoin(pid) {
        if (this.phase !== 'gameover' || !this.players[pid]) {
            return;
        }
        this.abortToLobby(null);
    }

    abortToLobby(msg) {
        this.phase = 'lobby';
        this.emu = null;
        this.lobbyMsg = msg;
        this.clearScreen();
        this.refresh();
    }

    clearScreen() {
        this.rowKeys.fill('');
        this.rowNodes.forEach(row => row.clearChildren());
        this.dirty = true;
    }

    // ---- input ----

    pressPad(pid, dir) {
        if (this.phase !== 'playing' || !this.seatOf(pid)) {
            return;
        }
        if (!this.holds[pid]) {
            this.holds[pid] = {};
        }
        this.holds[pid][dir] = this._t;
    }

    heldBy(pid, dir) {
        const h = this.holds[pid];
        return !!h && h[dir] !== undefined && this._t - h[dir] <= HOLD_TICKS;
    }

    // ---- game loop ----

    tick() {
        this._t++;
        if (this.phase === 'playing' && this.emu) {
            const keys = this.emu.keys;
            keys.fill(false);
            if (this.seats.left) {
                keys[KEY_LEFT_UP] = this.heldBy(this.seats.left, 'up');
                keys[KEY_LEFT_DOWN] = this.heldBy(this.seats.left, 'down');
            }
            if (this.seats.right) {
                keys[KEY_RIGHT_UP] = this.heldBy(this.seats.right, 'up');
                keys[KEY_RIGHT_DOWN] = this.heldBy(this.seats.right, 'down');
            }

            this.emu.run(CYCLES_PER_TICK);
            // Settle on the ROM's frame-wait loop so we never render a
            // half-drawn XOR frame ("vsync" against the emulated CPU)
            let extra = 0;
            while (this.emu.pc !== ROM.labels.wait && extra++ < SYNC_BUDGET) {
                this.emu.step();
            }

            this.renderDisplay();
            this.updateHud();

            if (this.emu.V[7] >= WIN_SCORE || this.emu.V[8] >= WIN_SCORE) {
                this.endMatch(this.emu.V[7] >= WIN_SCORE ? 'left' : 'right');
            }
        }
        if (this.dirty) {
            this.dirty = false;
            this.base.node.onStateChange();
        }
    }

    renderDisplay() {
        const display = this.emu.display;
        for (let r = 0; r < 32; r++) {
            const runs = [];
            let key = '';
            let start = -1;
            for (let cx = 0; cx <= 64; cx++) {
                const on = cx < 64 && display[r * 64 + cx];
                if (on && start < 0) {
                    start = cx;
                }
                if (!on && start >= 0) {
                    runs.push([start, cx - start]);
                    key += `${start}.${cx - start};`;
                    start = -1;
                }
            }
            if (key === this.rowKeys[r]) {
                continue;
            }
            this.rowKeys[r] = key;
            const row = this.rowNodes[r];
            row.clearChildren();
            runs.forEach(([s, len]) => {
                row.addChild(this.rect(
                    SCREEN_X + s * PX_W, SCREEN_Y + r * PX_H,
                    len * PX_W, PX_H, PIXEL
                ));
            });
            this.dirty = true;
        }
    }

    updateHud() {
        const emu = this.emu;
        const hex = (v, w) => v.toString(16).toUpperCase().padStart(w, '0');
        this.setText(this.scoreLabel, `${this.seatName('left')} ${emu.V[7]} - ${emu.V[8]} ${this.seatName('right')}`);
        this.setText(this.hudLine1,
            `PC=0x${hex(emu.pc, 3)}  I=0x${hex(emu.i, 3)}  OP=${hex(emu.opcodeAt(emu.pc), 4)}  DT=${emu.dt}  ST=${emu.st}${emu.st > 0 ? '  *BEEP*' : ''}`);
        const regs = Array.from(emu.V).map(v => hex(v, 2));
        this.setText(this.hudLine2, `V0-V7  ${regs.slice(0, 8).join(' ')}`);
        this.setText(this.hudLine3, `V8-VF  ${regs.slice(8).join(' ')}   ${emu.cycles} CYCLES`);
        if (this.screenFrame) {
            this.screenFrame.node.effects = glow(AMBER, emu.st > 0 ? 24 : 4);
        }
    }

    // ---- views ----

    refresh() {
        if (this.phase === 'lobby') {
            this.setText(this.scoreLabel, '');
            this.setText(this.subLabel, '');
            this.setText(this.hudLine1, '');
            this.setText(this.hudLine2, '');
            this.setText(this.hudLine3, '');
        } else if (this.phase === 'playing') {
            this.setText(this.subLabel, `FIRST TO ${WIN_SCORE} - WINNER KEEPS THE SEAT`);
        }
        this.rebuildMain();
        Object.keys(this.players).forEach(pid => this.rebuildPlayerRoot(Number(pid)));
        this.base.node.onStateChange();
    }

    rebuildMain() {
        this.mainLayer.clearChildren();
        this.screenFrame = null;
        if (this.phase === 'lobby') {
            this.buildLobby();
            return;
        }
        // The cabinet: wood frame around an amber CRT
        this.screenFrame = this.rect(16.4, 13.2, 67.2, 62.5, WOOD, {
            border: 6, color: WOOD_EDGE, effects: glow(AMBER, 4)
        });
        this.mainLayer.addChild(this.screenFrame);
        this.mainLayer.addChild(this.rect(SCREEN_X - 0.5, SCREEN_Y - 0.9, 65, 58.7, CRT));
        if (this.phase === 'gameover') {
            this.buildGameOver();
        }
    }

    buildLobby() {
        const s = this.mainLayer;
        s.addChild(this.text('THE CABINET', 50.4, 7.4, 4.5, [0, 0, 0, 130], 'center'));
        s.addChild(this.text('THE CABINET', 50, 7, 4.5, AMBER, 'center'));
        s.addChild(this.text('SOMEONE LEFT A COMPUTER IN THE BREAK ROOM.', 50, 19, 1.3, INK, 'center'));
        s.addChild(this.text('A REAL CHIP-8 CPU FROM 1977, EMULATED LIVE - RAM, REGISTERS, TIMERS AND ALL.', 50, 23, 1.1, FAINT, 'center'));
        s.addChild(this.text(`THE ONLY ROM ANYONE CAN FIND IS PONG (${ROM.bytes.length} BYTES). FIRST TO ${WIN_SCORE}. WINNER KEEPS THE SEAT.`, 50, 26.5, 1.1, FAINT, 'center'));
        if (this.lobbyMsg) {
            s.addChild(this.text(this.lobbyMsg, 50, 31, 1.2, BAD, 'center'));
        }

        const names = Object.keys(this.players).map(pid => this.players[pid].name).join(', ');
        s.addChild(this.text(`IN THE BREAK ROOM: ${names || 'NOBODY YET'}`.slice(0, 70), 50, 36, 1, FAINT, 'center'));

        [['left', 12], ['right', 56]].forEach(([side, x]) => {
            const pid = this.seats[side];
            const card = this.rect(x, 44, 32, 20, [45, 40, 46, 255], {
                border: 5, color: pid ? AMBER : [80, 74, 80, 255],
                onClick: (playerId) => this.toggleSeat(Number(playerId), side)
            });
            card.addChild(this.text(`${side.toUpperCase()} PADDLE`, x + 16, 46.5, 1.1, FAINT, 'center'));
            card.addChild(this.text(
                pid ? this.seatName(side) : 'TAKE THIS SEAT',
                x + 16, 52.5, 1.6, pid ? AMBER : INK, 'center'
            ));
            if (pid) {
                card.addChild(this.text('(TAP TO STAND UP)', x + 16, 58.5, 0.9, FAINT, 'center'));
            }
            s.addChild(card);
        });

        if (this.seats.left && this.seats.right) {
            s.addChild(this.makeButton({
                x: 38, y: 80, w: 24, h: 8, label: 'BOOT IT UP', size: 1.5, fill: [150, 90, 45, 255],
                onClick: (playerId) => this.startMatch(Number(playerId))
            }));
        } else {
            s.addChild(this.text('THE MACHINE WAITS FOR TWO BRAVE COWORKERS.', 50, 83, 1.1, FAINT, 'center'));
        }
    }

    buildGameOver() {
        const s = this.mainLayer;
        const r = this.matchResult;
        if (!r) {
            return;
        }
        s.addChild(this.rect(27, 30, 46, 30, [20, 18, 22, 255], { border: 5, color: AMBER }));
        s.addChild(this.text(`${r.winnerName} WINS`, 50, 34, 2.4, AMBER, 'center'));
        s.addChild(this.text(`${r.left} - ${r.right}`, 50, 40.5, 1.6, INK, 'center'));
        s.addChild(this.text(`${r.loserName}'S SEAT IS UP FOR GRABS.`, 50, 45.5, 1.1, FAINT, 'center'));
        s.addChild(this.makeButton({
            x: 39, y: 50.5, w: 22, h: 7, label: 'INSERT COIN', size: 1.3, fill: [150, 90, 45, 255],
            onClick: (playerId) => this.insertCoin(Number(playerId))
        }));
    }

    rebuildPlayerRoot(pid) {
        const p = this.players[pid];
        if (!p) {
            return;
        }
        p.root.clearChildren();
        if (this.phase !== 'playing') {
            return;
        }
        const side = this.seatOf(pid);
        if (!side) {
            p.root.addChild(this.text('SPECTATING - LOUDLY DOUBT THE CPU', 50, 85, 1.1, FAINT, 'center'));
            return;
        }
        const x = side === 'left' ? 1 : 84.5;
        [['up', 16, 'UP'], ['down', 46, 'DOWN']].forEach(([dir, y, label]) => {
            const pad = this.rect(x, y, 14.5, 27, [45, 40, 46, 255], {
                border: 5, color: AMBER,
                onClick: (playerId) => this.pressPad(Number(playerId), dir)
            });
            pad.addChild(this.text(label, x + 7.25, y + 13.5 - TEXT_H(1.6) / 2, 1.6, AMBER, 'center'));
            pad.addChild(this.text('(HOLD)', x + 7.25, y + 21, 0.8, FAINT, 'center'));
            p.root.addChild(pad);
        });
        p.root.addChild(this.text(`YOU ARE THE ${side.toUpperCase()} PADDLE`, 50, 85, 1.1, AMBER, 'center'));
    }
}

module.exports = Cabinet;
