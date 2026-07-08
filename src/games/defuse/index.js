const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

const TICK_RATE = 10;
const MAX_PLAYERS = 8;
const BOMBS_PER_MISSION = 3;

// Text height in y-units at 16:9 (text size is relative to canvas width)
const TEXT_H = (size) => size * 16 / 9;

// Military-workshop palette
const BG = [26, 28, 24, 255];
const HUD_BG = [15, 17, 14, 255];
const CASING = [52, 56, 50, 255];
const CASING_EDGE = [15, 17, 14, 255];
const PANEL = [38, 42, 38, 255];
const PLAQUE = [30, 33, 29, 255];
const KEY_BG = [60, 66, 58, 255];
const PAPER = [228, 218, 186, 255];
const PAPER_EDGE = [120, 105, 70, 255];
const PAPER_INK = [45, 38, 25, 255];
const PAPER_FAINT = [125, 110, 78, 255];
const LED = [255, 70, 55, 255];
const AMBER = [255, 190, 70, 255];
const INK = [232, 236, 226, 255];
const FAINT = [130, 140, 125, 255];
const GOOD = [90, 220, 120, 255];
const BAD = [235, 70, 55, 255];
const PIP_OFF = [55, 60, 53, 255];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

const WIRE_COLORS = {
    RED: [225, 60, 45, 255],
    BLUE: [55, 95, 235, 255],
    YELLOW: [240, 210, 50, 255],
    WHITE: [242, 242, 238, 255],
    BLACK: [22, 22, 22, 255]
};
const WIRE_KEYS = Object.keys(WIRE_COLORS);

const GLYPHS = ['Ω', 'Ψ', 'Ж', 'Ѳ', 'Ξ', '¶', 'Æ', 'Ø', 'ϗ', '§'];

const BUTTON_COLORS = {
    RED: [210, 55, 45, 255],
    BLUE: [55, 95, 225, 255],
    WHITE: [240, 240, 235, 255],
    YELLOW: [235, 205, 60, 255]
};
const BUTTON_LABELS = ['PRESS', 'ABORT', 'HOLD', 'BOOM'];

const PADS = ['RED', 'BLU', 'GRN', 'YEL'];
const PAD_BASE = { RED: [150, 45, 40, 255], BLU: [40, 65, 150, 255], GRN: [40, 120, 60, 255], YEL: [150, 130, 35, 255] };
const PAD_LIT = { RED: [255, 110, 90, 255], BLU: [100, 155, 255, 255], GRN: [110, 240, 140, 255], YEL: [255, 235, 90, 255] };
const SEQ_MAPS = [
    { RED: 'BLU', BLU: 'RED', GRN: 'YEL', YEL: 'GRN' },
    { RED: 'YEL', BLU: 'GRN', GRN: 'RED', YEL: 'BLU' },
    { RED: 'GRN', BLU: 'YEL', GRN: 'BLU', YEL: 'RED' }
];

const BOMB_SPECS = [
    { modules: 2, seconds: 240 },
    { modules: 3, seconds: 240 },
    { modules: 4, seconds: 300 }
];
const MODULE_KEYS = ['wires', 'keypad', 'button', 'sequencer'];
const MODULE_NAMES = { wires: 'WIRES', keypad: 'KEYPAD', button: 'BIG BUTTON', sequencer: 'SEQUENCER' };
const MODULE_SLOTS = [[22, 20], [60, 20], [22, 59], [60, 59]];

const INDICATOR_CODES = ['SND', 'CLR', 'FRK', 'BOB', 'CAR'];
const SERIAL_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const shuffled = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const fmtTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Manual text must stay in lockstep with the eval* rule functions below.
const WIRES_A_LINES = [
    'WIRES ARE NUMBERED TOP TO BOTTOM.',
    'CHECK RULES IN ORDER. FIRST MATCH WINS.',
    '',
    'IF 3 WIRES:',
    '  1. NO RED WIRES -> CUT WIRE 2',
    '  2. ELSE EXACTLY ONE BLUE -> CUT THE BLUE',
    '  3. ELSE SERIAL ENDS ODD -> CUT WIRE 3',
    '  4. ELSE -> CUT WIRE 1',
    '',
    'IF 4 WIRES:',
    '  1. TWO OR MORE YELLOW -> CUT LAST YELLOW',
    '  2. ELSE BLACK WIRE AND 2+ BATTERIES',
    '     -> CUT THE FIRST BLACK',
    '  3. ELSE SERIAL HAS A VOWEL -> CUT WIRE 3',
    '  4. ELSE -> CUT WIRE 2'
];

const WIRES_B_LINES = [
    'WIRES ARE NUMBERED TOP TO BOTTOM.',
    'CHECK RULES IN ORDER. FIRST MATCH WINS.',
    '',
    'IF 5 WIRES:',
    '  1. LAST WIRE WHITE -> CUT WIRE 4',
    '  2. ELSE EXACTLY ONE RED -> CUT THE RED',
    '  3. ELSE NO BATTERIES -> CUT WIRE 2',
    '  4. ELSE -> CUT WIRE 1',
    '',
    'IF 6 WIRES:',
    '  1. NO YELLOW AND SERIAL ENDS ODD',
    '     -> CUT WIRE 3',
    '  2. ELSE ONE WHITE AND 2+ BLUE -> CUT WIRE 4',
    '  3. ELSE THREE BATTERIES -> CUT WIRE 6',
    '  4. ELSE -> CUT WIRE 5'
];

const BUTTON_LINES = [
    'CHECK RULES IN ORDER. FIRST MATCH WINS.',
    '"TAP ON A 4" MEANS: TAP WHEN ANY DIGIT',
    'ON THE COUNTDOWN CLOCK IS A 4.',
    '',
    '  1. RED BUTTON SAYING ABORT -> TAP ON A 4',
    '  2. ELSE 2+ BATTERIES + SAYS PRESS -> TAP NOW',
    '  3. ELSE WHITE + INDICATOR LIT -> TAP ON A 1',
    '  4. ELSE BLUE BUTTON -> TAP ON A 7',
    '  5. ELSE SAYS HOLD -> TAP ON A 5',
    '  6. ELSE -> TAP NOW',
    '',
    'A TAP AT THE WRONG TIME IS A STRIKE.'
];

const SEQUENCER_LINES = [
    'THE PADS FLASH A PATTERN, ONE PAD AT A TIME.',
    'ANSWER BY PRESSING THE MAPPED PADS, IN THE',
    'SAME ORDER. THE MAP DEPENDS ON THE BOMB\'S',
    'CURRENT STRIKE COUNT:',
    '',
    '  0 STRIKES: RED>BLU BLU>RED GRN>YEL YEL>GRN',
    '  1 STRIKE:  RED>YEL BLU>GRN GRN>RED YEL>BLU',
    '  2 STRIKES: RED>GRN BLU>YEL GRN>BLU YEL>RED',
    '',
    '3 ROUNDS. EACH ROUND ADDS ONE FLASH.',
    'USE REPLAY TO SEE THE PATTERN AGAIN.',
    'A WRONG PAD IS A STRIKE AND A RESET.'
];

const KEYPAD_INTRO = [
    'EXACTLY ONE COLUMN BELOW CONTAINS ALL 4',
    'SYMBOLS ON THE KEYPAD. PRESS THE 4 SYMBOLS',
    'IN THAT COLUMN\'S ORDER, TOP TO BOTTOM.'
];

class Defuse extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Defuse',
            author: 'Joseph Garcia',
            description: 'Co-op bomb disposal for a voice call. One player sees the bomb - everyone else holds pieces of the manual. Talk fast.',
            aspectRatio: { x: 16, y: 9 },
            services: ['multiplayer'],
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this._t = 0;
        this.dirty = false;
        this.phase = 'lobby';
        this.players = {};
        this.ready = {};
        this.rotation = 0;
        this.record = { defused: 0, exploded: 0, strikes: 0 };
        this.bomb = null;
        this.bombIndex = 0;
        this.bombRoster = [];
        this.defuserId = null;
        this.pagesByPid = {};
        this.pageIdx = {};
        this.timerStr = '--:--';
        this.lastSecond = 0;
        this.toastText = '';
        this.toastUntil = null;
        this.toastNode = null;
        this.flashUntil = null;
        this.explodeCause = null;
        this.explodeAt = 0;
        this.lastResult = null;
        this.lobbyMsg = null;

        this.base = this.rect(0, 0, 100, 100, BG);

        this.hudLayer = this.container();
        this.bombLabel = this.text('', 2, 2.4, 1.5, INK);
        this.defuserLine = this.text('', 2, 7, 1.15, FAINT);
        this.timerNode = this.text(this.timerStr, 50, 1.8, 4.6, LED, 'center');
        this.pips = [0, 1, 2].map(i => this.rect(88 + i * 3.4, 5, 2.6, 4.6, PIP_OFF, { border: 2, color: [90, 95, 88, 255] }));
        this.hudLayer.addChildren(
            this.rect(0, 0, 100, 12, HUD_BG),
            this.bombLabel,
            this.defuserLine,
            this.timerNode,
            this.text('STRIKES', 92.6, 1.6, 0.9, FAINT, 'center'),
            ...this.pips
        );

        this.mainLayer = this.container();
        this.sharedRoot = this.container();
        this.mainLayer.addChild(this.sharedRoot);

        this.flashOverlay = this.rect(0, 0, 0, 0, [0, 0, 0, 0]);

        this.base.addChildren(this.hudLayer, this.mainLayer, this.flashOverlay);

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
        // Zero-size so the container can never swallow clicks
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

    text(str, x, y, size, color, align = 'left', playerIds) {
        return new GameNode.Text({
            textInfo: { text: str, x, y, size, align, font: 'monospace', color },
            playerIds
        });
    }

    setText(node, str) {
        node.node.text = { ...node.node.text, text: str };
    }

    makeButton({ x, y, w, h, label, size, fill, textColor, onClick }) {
        const bg = this.rect(x, y, w, h, fill, { border: 4, color: CASING_EDGE, onClick });
        bg.addChild(this.text(label, x + w / 2, y + (h - TEXT_H(size)) / 2, size, textColor || INK, 'center'));
        return bg;
    }

    // ---- player lifecycle ----

    handleNewPlayer({ playerId, info }) {
        const pid = Number(playerId);
        if (this.players[pid] || Object.keys(this.players).length >= MAX_PLAYERS) {
            return;
        }
        const name = ((info && info.name) || `AGENT ${pid}`).toUpperCase().slice(0, 12);
        // The scoped root doubles as the privacy anchor: every connected player
        // must always own at least one playerIds-scoped node.
        const root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [pid]
        });
        this.players[pid] = { name, root };
        this.mainLayer.addChild(root);
        if (this.phase === 'lobby') {
            this.refresh();
        } else {
            this.rebuildPlayerRoot(pid);
            this.base.node.onStateChange();
        }
    }

    handlePlayerDisconnect(playerId) {
        const pid = Number(playerId);
        const p = this.players[pid];
        if (!p) {
            return;
        }
        this.mainLayer.removeChild(p.root.node.id);
        delete this.players[pid];
        delete this.ready[pid];
        if (this.phase === 'active' || this.phase === 'exploding') {
            this.bombRoster = this.bombRoster.filter(id => id !== pid && this.players[id]);
            if (this.bombRoster.length < 2) {
                return this.abortToLobby('BOMB ABORTED - NOT ENOUGH AGENTS');
            }
            if (pid === this.defuserId) {
                this.defuserId = this.bombRoster[0];
            }
            this.dealPages();
        }
        this.refresh();
    }

    // ---- lobby / mission flow ----

    toggleReady(pid) {
        if (this.phase !== 'lobby' || !this.players[pid] || this.ready[pid]) {
            return;
        }
        this.ready[pid] = true;
        const ids = Object.keys(this.players);
        if (ids.length >= 2 && ids.every(id => this.ready[id])) {
            this.startBomb(0);
        } else {
            this.refresh();
        }
    }

    startBomb(idx) {
        this.bombIndex = idx;
        if (idx === 0) {
            this.record = { defused: 0, exploded: 0, strikes: 0 };
        }
        this.lobbyMsg = null;
        this.toastText = '';
        this.toastUntil = null;
        this.bombRoster = Object.keys(this.players).map(Number);
        this.defuserId = this.bombRoster[this.rotation % this.bombRoster.length];
        this.rotation++;
        this.bomb = this.genBomb(idx);
        this.phase = 'active';
        const seconds = BOMB_SPECS[idx].seconds;
        this.lastSecond = seconds;
        this.timerStr = fmtTime(seconds);
        this.dealPages();
        this.bomb.modules.filter(m => m.key === 'sequencer').forEach(m => this.scheduleSeqFlashes(m));
        this.refresh();
    }

    continueMission(pid) {
        if (this.phase !== 'debrief' || !this.players[pid]) {
            return;
        }
        if (Object.keys(this.players).length < 2) {
            return this.abortToLobby('NOT ENOUGH AGENTS - BACK TO THE LOBBY');
        }
        if (this.bombIndex + 1 < BOMBS_PER_MISSION) {
            this.startBomb(this.bombIndex + 1);
        } else {
            this.phase = 'gameover';
            this.refresh();
        }
    }

    playAgain(pid) {
        if (this.phase !== 'gameover' || !this.players[pid]) {
            return;
        }
        this.abortToLobby(null);
    }

    abortToLobby(msg) {
        this.phase = 'lobby';
        this.lobbyMsg = msg;
        this.ready = {};
        this.bomb = null;
        this.timerStr = '--:--';
        this.resetOverlay();
        this.refresh();
    }

    finishBomb(defused) {
        this.record.strikes += this.bomb.strikes;
        if (defused) {
            this.record.defused++;
        } else {
            this.record.exploded++;
        }
        this.lastResult = {
            defused,
            cause: this.explodeCause || '',
            timeLeft: this.timerStr,
            strikes: this.bomb.strikes
        };
        this.explodeCause = null;
        this.toastText = '';
        this.toastUntil = null;
        this.resetOverlay();
        this.phase = 'debrief';
        this.refresh();
    }

    // ---- bomb generation ----

    genSerial() {
        let s = '';
        for (let i = 0; i < 4; i++) {
            s += SERIAL_CHARS[Math.floor(Math.random() * SERIAL_CHARS.length)];
        }
        if (!/[A-Z]/.test(s)) {
            s = 'K' + s.slice(1);
        }
        return s + Math.floor(Math.random() * 10);
    }

    genBomb(idx) {
        const spec = BOMB_SPECS[idx];
        const bomb = {
            serial: this.genSerial(),
            batteries: Math.floor(Math.random() * 4),
            indicator: { code: pick(INDICATOR_CODES), lit: Math.random() < 0.5 },
            strikes: 0,
            endTick: this._t + spec.seconds * TICK_RATE,
            modules: []
        };
        shuffled(MODULE_KEYS).slice(0, spec.modules).forEach(key => {
            if (key === 'wires') {
                bomb.modules.push(this.genWires(bomb));
            } else if (key === 'keypad') {
                bomb.modules.push(this.genKeypad());
            } else if (key === 'button') {
                bomb.modules.push(this.genButton(bomb));
            } else {
                bomb.modules.push(this.genSequencer());
            }
        });
        return bomb;
    }

    genWires(bomb) {
        const count = 3 + Math.floor(Math.random() * 4);
        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(pick(WIRE_KEYS));
        }
        return {
            key: 'wires',
            wires: colors.map(c => ({ color: c, cut: false })),
            answer: this.evalWires(colors, bomb),
            disarmed: false
        };
    }

    evalWires(colors, bomb) {
        const n = colors.length;
        const count = (c) => colors.filter(x => x === c).length;
        const serialOdd = Number(bomb.serial[bomb.serial.length - 1]) % 2 === 1;
        const serialVowel = ['A', 'E', 'U'].some(v => bomb.serial.includes(v));
        if (n === 3) {
            if (count('RED') === 0) return { index: 1, rule: 'NO RED WIRES -> CUT WIRE 2' };
            if (count('BLUE') === 1) return { index: colors.indexOf('BLUE'), rule: `EXACTLY ONE BLUE -> CUT THE BLUE (WIRE ${colors.indexOf('BLUE') + 1})` };
            if (serialOdd) return { index: 2, rule: 'SERIAL ENDS ODD -> CUT WIRE 3' };
            return { index: 0, rule: 'NO RULE MATCHED -> CUT WIRE 1' };
        }
        if (n === 4) {
            if (count('YELLOW') >= 2) return { index: colors.lastIndexOf('YELLOW'), rule: `TWO OR MORE YELLOW -> CUT LAST YELLOW (WIRE ${colors.lastIndexOf('YELLOW') + 1})` };
            if (count('BLACK') >= 1 && bomb.batteries >= 2) return { index: colors.indexOf('BLACK'), rule: `BLACK WIRE AND 2+ BATTERIES -> CUT FIRST BLACK (WIRE ${colors.indexOf('BLACK') + 1})` };
            if (serialVowel) return { index: 2, rule: 'SERIAL HAS A VOWEL -> CUT WIRE 3' };
            return { index: 1, rule: 'NO RULE MATCHED -> CUT WIRE 2' };
        }
        if (n === 5) {
            if (colors[4] === 'WHITE') return { index: 3, rule: 'LAST WIRE WHITE -> CUT WIRE 4' };
            if (count('RED') === 1) return { index: colors.indexOf('RED'), rule: `EXACTLY ONE RED -> CUT THE RED (WIRE ${colors.indexOf('RED') + 1})` };
            if (bomb.batteries === 0) return { index: 1, rule: 'NO BATTERIES -> CUT WIRE 2' };
            return { index: 0, rule: 'NO RULE MATCHED -> CUT WIRE 1' };
        }
        if (count('YELLOW') === 0 && serialOdd) return { index: 2, rule: 'NO YELLOW AND SERIAL ENDS ODD -> CUT WIRE 3' };
        if (count('WHITE') === 1 && count('BLUE') >= 2) return { index: 3, rule: 'ONE WHITE AND 2+ BLUE -> CUT WIRE 4' };
        if (bomb.batteries === 3) return { index: 5, rule: 'THREE BATTERIES -> CUT WIRE 6' };
        return { index: 4, rule: 'NO RULE MATCHED -> CUT WIRE 5' };
    }

    genKeypad() {
        let result = null;
        for (let attempt = 0; attempt < 50; attempt++) {
            const cols = [0, 1, 2].map(() => shuffled(GLYPHS).slice(0, 6));
            const target = Math.floor(Math.random() * 3);
            const picks = shuffled(cols[target]).slice(0, 4);
            result = { cols, target, picks };
            const ambiguous = cols.some((c, i) => i !== target && picks.every(g => c.includes(g)));
            if (!ambiguous) {
                break;
            }
        }
        const { cols, target, picks } = result;
        return {
            key: 'keypad',
            cols,
            target,
            order: cols[target].filter(g => picks.includes(g)),
            display: shuffled(picks),
            pressed: [],
            disarmed: false
        };
    }

    genButton(bomb) {
        const color = pick(Object.keys(BUTTON_COLORS));
        const label = pick(BUTTON_LABELS);
        return { key: 'button', color, label, rule: this.evalButton(color, label, bomb), disarmed: false };
    }

    evalButton(color, label, bomb) {
        if (color === 'RED' && label === 'ABORT') return { digit: '4', rule: 'RED + SAYS ABORT -> TAP ON A 4' };
        if (bomb.batteries >= 2 && label === 'PRESS') return { digit: null, rule: '2+ BATTERIES + SAYS PRESS -> TAP NOW' };
        if (color === 'WHITE' && bomb.indicator.lit) return { digit: '1', rule: 'WHITE + INDICATOR LIT -> TAP ON A 1' };
        if (color === 'BLUE') return { digit: '7', rule: 'BLUE BUTTON -> TAP ON A 7' };
        if (label === 'HOLD') return { digit: '5', rule: 'SAYS HOLD -> TAP ON A 5' };
        return { digit: null, rule: 'NO RULE MATCHED -> TAP NOW' };
    }

    genSequencer() {
        return {
            key: 'sequencer',
            seq: [pick(PADS), pick(PADS), pick(PADS)],
            stage: 0,
            inputIdx: 0,
            flashes: [],
            litPad: null,
            pressFlash: null,
            disarmed: false
        };
    }

    // ---- manual pages ----

    buildManualPages(bomb) {
        const pages = [];
        bomb.modules.forEach(m => {
            if (m.key === 'wires') {
                pages.push({ title: 'WIRES VOL.A', kind: 'lines', lines: WIRES_A_LINES });
                pages.push({ title: 'WIRES VOL.B', kind: 'lines', lines: WIRES_B_LINES });
            } else if (m.key === 'keypad') {
                pages.push({ title: 'KEYPAD', kind: 'keypad', cols: m.cols });
            } else if (m.key === 'button') {
                pages.push({ title: 'BIG BUTTON', kind: 'lines', lines: BUTTON_LINES });
            } else {
                pages.push({ title: 'SEQUENCER', kind: 'lines', lines: SEQUENCER_LINES });
            }
        });
        return pages;
    }

    dealPages() {
        const experts = this.bombRoster.filter(pid => pid !== this.defuserId && this.players[pid]);
        const pages = this.buildManualPages(this.bomb);
        this.pagesByPid = {};
        this.pageIdx = {};
        experts.forEach(pid => {
            this.pagesByPid[pid] = [];
            this.pageIdx[pid] = 0;
        });
        if (!experts.length) {
            return;
        }
        if (experts.length <= pages.length) {
            pages.forEach((page, i) => this.pagesByPid[experts[i % experts.length]].push(page));
        } else {
            experts.forEach((pid, i) => this.pagesByPid[pid].push(pages[i % pages.length]));
        }
    }

    flipPage(pid, dir) {
        const pages = this.pagesByPid[pid];
        if (this.phase !== 'active' || !pages || pages.length < 2) {
            return;
        }
        this.pageIdx[pid] = ((this.pageIdx[pid] || 0) + dir + pages.length) % pages.length;
        this.rebuildPlayerRoot(pid);
    }

    // ---- module interaction ----

    canAct(pid, m) {
        return this.phase === 'active' && pid === this.defuserId && !m.disarmed;
    }

    cutWire(pid, m, i) {
        if (!this.canAct(pid, m) || m.wires[i].cut) {
            return;
        }
        m.wires[i].cut = true;
        if (i === m.answer.index) {
            this.disarmModule(m);
        } else {
            this.rebuildPlayerRoot(this.defuserId);
            this.strike('WIRES');
        }
    }

    pressKeypad(pid, m, glyph) {
        if (!this.canAct(pid, m) || m.pressed.includes(glyph)) {
            return;
        }
        if (glyph === m.order[m.pressed.length]) {
            m.pressed.push(glyph);
            if (m.pressed.length === 4) {
                this.disarmModule(m);
            } else {
                this.rebuildPlayerRoot(this.defuserId);
            }
        } else {
            m.pressed = [];
            this.rebuildPlayerRoot(this.defuserId);
            this.strike('KEYPAD');
        }
    }

    pressButton(pid, m) {
        if (!this.canAct(pid, m)) {
            return;
        }
        if (!m.rule.digit || this.timerStr.replace(':', '').includes(m.rule.digit)) {
            this.disarmModule(m);
        } else {
            this.strike('BIG BUTTON');
        }
    }

    pressPad(pid, m, pad) {
        if (!this.canAct(pid, m) || this.seqFlashing(m)) {
            return;
        }
        const expected = SEQ_MAPS[Math.min(this.bomb.strikes, 2)][m.seq[m.inputIdx]];
        if (pad === expected) {
            m.inputIdx++;
            m.pressFlash = { pad, until: this._t + 3 };
            if (m.inputIdx > m.stage) {
                m.stage++;
                m.inputIdx = 0;
                if (m.stage >= 3) {
                    m.flashes = [];
                    m.litPad = null;
                    this.disarmModule(m);
                } else {
                    this.scheduleSeqFlashes(m);
                }
            }
        } else {
            m.inputIdx = 0;
            this.strike('SEQUENCER');
            if (this.phase === 'active') {
                this.scheduleSeqFlashes(m);
            }
        }
    }

    replaySeq(pid, m) {
        if (!this.canAct(pid, m) || this.seqFlashing(m)) {
            return;
        }
        m.inputIdx = 0;
        this.scheduleSeqFlashes(m);
    }

    scheduleSeqFlashes(m) {
        const start = this._t + 12;
        m.flashes = [];
        for (let i = 0; i <= m.stage; i++) {
            m.flashes.push({ pad: m.seq[i], from: start + i * 7, to: start + i * 7 + 4 });
        }
    }

    seqFlashing(m) {
        const last = m.flashes[m.flashes.length - 1];
        return !!last && this._t < last.to + 2;
    }

    disarmModule(m) {
        m.disarmed = true;
        this.rebuildPlayerRoot(this.defuserId);
        if (this.bomb.modules.every(x => x.disarmed)) {
            this.finishBomb(true);
        }
    }

    strike(source) {
        if (this.phase !== 'active') {
            return;
        }
        this.bomb.strikes++;
        this.pips.forEach((pip, i) => {
            pip.node.fill = i < this.bomb.strikes ? BAD : PIP_OFF;
        });
        this.flashOverlay.node.coordinates2d = ShapeUtils.rectangle(0, 0, 100, 100);
        this.flashOverlay.node.fill = [255, 60, 45, 255];
        // fill alpha renders binary; translucency comes from color alpha
        this.flashOverlay.node.color = [255, 255, 255, 110];
        this.flashUntil = this._t + 3;
        this.toastText = `STRIKE ${this.bomb.strikes}/3 - ${source}`;
        this.toastUntil = this._t + 30;
        if (this.toastNode) {
            this.setText(this.toastNode, this.toastText);
        }
        this.dirty = true;
        if (this.bomb.strikes >= 3) {
            this.explode(`THIRD STRIKE - ${source}`);
        }
    }

    explode(cause) {
        if (this.phase !== 'active') {
            return;
        }
        this.phase = 'exploding';
        this.explodeCause = cause;
        this.explodeAt = this._t;
        this.dirty = true;
    }

    resetOverlay() {
        this.flashOverlay.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        this.flashOverlay.node.fill = [0, 0, 0, 0];
        this.flashOverlay.node.color = [255, 255, 255, 255];
        this.flashUntil = null;
    }

    // ---- game loop ----

    tick() {
        this._t++;
        if (this.phase === 'active') {
            const remTicks = this.bomb.endTick - this._t;
            if (remTicks <= 0) {
                this.timerStr = '0:00';
                this.setText(this.timerNode, this.timerStr);
                this.explode('TIME RAN OUT');
            } else {
                const sec = Math.ceil(remTicks / TICK_RATE);
                if (sec !== this.lastSecond) {
                    this.lastSecond = sec;
                    this.timerStr = fmtTime(sec);
                    this.setText(this.timerNode, this.timerStr);
                    this.dirty = true;
                }
                this.bomb.modules.forEach(m => {
                    if (m.key === 'sequencer' && !m.disarmed) {
                        this.seqTick(m);
                    }
                });
                if (this.toastUntil && this._t >= this.toastUntil) {
                    this.toastUntil = null;
                    this.toastText = '';
                    if (this.toastNode) {
                        this.setText(this.toastNode, '');
                        this.dirty = true;
                    }
                }
            }
        }
        if (this.phase === 'exploding') {
            const e = this._t - this.explodeAt;
            if (e >= 16) {
                this.finishBomb(false);
            } else {
                this.flashOverlay.node.coordinates2d = ShapeUtils.rectangle(0, 0, 100, 100);
                this.flashOverlay.node.fill = Math.floor(e / 2) % 2 === 0 ? [255, 70, 45, 255] : [255, 235, 215, 255];
                this.flashOverlay.node.color = [255, 255, 255, 255];
                this.dirty = true;
            }
        } else if (this.flashUntil && this._t >= this.flashUntil) {
            this.resetOverlay();
            this.dirty = true;
        }
        if (this.dirty) {
            this.dirty = false;
            this.base.node.onStateChange();
        }
    }

    seqTick(m) {
        let lit = null;
        for (const f of m.flashes) {
            if (this._t >= f.from && this._t < f.to) {
                lit = f.pad;
                break;
            }
        }
        if (!lit && m.pressFlash && this._t < m.pressFlash.until) {
            lit = m.pressFlash.pad;
        }
        if (lit !== m.litPad) {
            m.litPad = lit;
            if (m.ui && m.ui.pads) {
                PADS.forEach(k => {
                    m.ui.pads[k].node.fill = k === lit ? PAD_LIT[k] : PAD_BASE[k];
                    m.ui.pads[k].node.effects = k === lit ? glow(PAD_LIT[k], 12) : null;
                });
                this.dirty = true;
            }
        }
    }

    // ---- views ----

    refresh() {
        this.updateHud();
        this.sharedRoot.clearChildren();
        if (this.phase === 'lobby') {
            this.buildLobbyShared();
        } else if (this.phase === 'debrief') {
            this.buildDebriefShared();
        } else if (this.phase === 'gameover') {
            this.buildGameOverShared();
        }
        Object.keys(this.players).forEach(pid => this.rebuildPlayerRoot(Number(pid)));
        this.base.node.onStateChange();
    }

    updateHud() {
        this.hudLayer.node.playerIds = (this.phase === 'lobby' || this.phase === 'gameover') ? [0] : [];
        this.setText(this.bombLabel, this.bomb ? `BOMB ${this.bombIndex + 1}/${BOMBS_PER_MISSION}` : '');
        const dName = (this.players[this.defuserId] || {}).name;
        this.setText(this.defuserLine, this.bomb && dName ? `DEFUSER: ${dName}` : '');
        this.setText(this.timerNode, this.timerStr);
        this.pips.forEach((pip, i) => {
            pip.node.fill = (this.bomb && i < this.bomb.strikes) ? BAD : PIP_OFF;
        });
    }

    rebuildPlayerRoot(pid) {
        const p = this.players[pid];
        if (!p) {
            return;
        }
        p.root.clearChildren();
        if (this.phase === 'lobby') {
            this.buildLobbyFor(pid);
        } else if (this.phase === 'active' || this.phase === 'exploding') {
            if (!this.bombRoster.includes(pid)) {
                this.buildSpectatorFor(pid);
            } else if (pid === this.defuserId) {
                this.buildDefuserFor(pid);
            } else {
                this.buildExpertFor(pid);
            }
        }
    }

    buildLobbyShared() {
        const s = this.sharedRoot;
        s.addChild(this.text('DEFUSE', 50.4, 8.4, 5.5, [0, 0, 0, 180], 'center'));
        s.addChild(this.text('DEFUSE', 50, 8, 5.5, AMBER, 'center'));
        s.addChild(this.text('CO-OP BOMB DISPOSAL FOR A VOICE CALL', 50, 21, 1.5, INK, 'center'));
        s.addChild(this.text('ONE AGENT DEFUSES. EVERYONE ELSE HOLDS THE MANUAL. TALK FAST.', 50, 27, 1.15, FAINT, 'center'));
        s.addChild(this.text('DEFUSER: NEVER SHARE YOUR SCREEN. EXPERTS: NO PEEKING.', 50, 30.5, 1.15, FAINT, 'center'));
        if (this.lobbyMsg) {
            s.addChild(this.text(this.lobbyMsg, 50, 35.5, 1.3, BAD, 'center'));
        }
        const ids = Object.keys(this.players).map(Number);
        s.addChild(this.text(`AGENTS (${ids.length}/${MAX_PLAYERS})`, 36, 41.5, 1.2, FAINT));
        ids.forEach((pid, i) => {
            const isReady = !!this.ready[pid];
            s.addChild(this.text(
                `${this.players[pid].name.padEnd(13)}${isReady ? '[READY]' : '[     ]'}`,
                36, 46.5 + i * 4, 1.35, isReady ? GOOD : INK
            ));
        });
        if (ids.length < 2) {
            s.addChild(this.text('NEED AT LEAST 2 AGENTS TO START', 50, 78, 1.25, FAINT, 'center'));
        }
    }

    buildLobbyFor(pid) {
        const root = this.players[pid].root;
        const ids = Object.keys(this.players).map(Number);
        root.addChild(this.text('< YOU', 64, 46.5 + ids.indexOf(pid) * 4, 1.2, AMBER));
        if (!this.ready[pid]) {
            root.addChild(this.makeButton({
                x: 40, y: 82, w: 20, h: 7.5, label: 'READY UP', size: 1.5, fill: [60, 110, 70, 255],
                onClick: (playerId) => this.toggleReady(Number(playerId))
            }));
        } else {
            root.addChild(this.text('READY - WAITING FOR THE OTHERS', 50, 85, 1.3, FAINT, 'center'));
        }
    }

    buildSpectatorFor(pid) {
        const root = this.players[pid].root;
        root.addChild(this.text('SPECTATING - YOU DEAL IN AS AN EXPERT ON THE NEXT BOMB.', 50, 45, 1.6, AMBER, 'center'));
        root.addChild(this.text('FEEL FREE TO PANIC QUIETLY.', 50, 51, 1.2, FAINT, 'center'));
    }

    buildDefuserFor(pid) {
        const root = this.players[pid].root;
        root.addChild(this.text('YOU ARE THE DEFUSER - DESCRIBE WHAT YOU SEE. DO NOT SHARE YOUR SCREEN.', 50, 12.7, 1.2, AMBER, 'center'));
        this.toastNode = this.text(this.toastText, 50, 15.3, 1.3, BAD, 'center');
        root.addChild(this.toastNode);
        root.addChild(this.rect(2, 18, 96, 80, CASING, { border: 4, color: CASING_EDGE }));
        this.buildPlaque(root);
        this.bomb.modules.forEach((m, i) => this.buildModulePanel(root, m, MODULE_SLOTS[i][0], MODULE_SLOTS[i][1]));
    }

    buildPlaque(root) {
        const b = this.bomb;
        root.addChild(this.rect(4, 21, 16.5, 60, PLAQUE, { border: 3, color: CASING_EDGE }));
        root.addChild(this.text('SERIAL', 6, 24, 1, FAINT));
        root.addChild(this.text(b.serial, 6, 26.5, 1.55, INK));
        root.addChild(this.text('BATTERIES', 6, 33.5, 1, FAINT));
        if (b.batteries === 0) {
            root.addChild(this.text('NONE', 6, 36.8, 1.3, INK));
        } else {
            for (let i = 0; i < b.batteries; i++) {
                root.addChild(this.rect(6.2 + i * 3.4, 36.6, 1, 1, AMBER));
                root.addChild(this.rect(5.5 + i * 3.4, 37.6, 2.4, 4.4, AMBER));
            }
        }
        root.addChild(this.text('INDICATOR', 6, 46, 1, FAINT));
        const lit = b.indicator.lit;
        root.addChild(this.rect(6, 48.8, 4.2, 7.4, lit ? AMBER : [48, 51, 46, 255], lit ? { effects: glow(AMBER, 12) } : {}));
        root.addChild(this.text(b.indicator.code, 11.6, 51.3, 1.35, INK));
        root.addChild(this.text(lit ? 'LIT' : 'DARK', 6.4, 57.4, 0.95, FAINT));
    }

    buildModulePanel(root, m, px, py) {
        root.addChild(this.rect(px, py, 37, 37, PANEL, { border: 3, color: CASING_EDGE }));
        root.addChild(this.text(MODULE_NAMES[m.key], px + 2, py + 1.4, 1.1, FAINT));
        root.addChild(this.rect(
            px + 33.5, py + 1.6, 1.9, 3.4,
            m.disarmed ? GOOD : [90, 40, 35, 255],
            m.disarmed ? { effects: glow(GOOD, 8) } : {}
        ));
        if (m.key === 'wires') {
            this.buildWiresUi(root, m, px, py);
        } else if (m.key === 'keypad') {
            this.buildKeypadUi(root, m, px, py);
        } else if (m.key === 'button') {
            this.buildButtonUi(root, m, px, py);
        } else {
            this.buildSequencerUi(root, m, px, py);
        }
    }

    buildWiresUi(root, m, px, py) {
        root.addChild(this.rect(px + 3.5, py + 6, 30, 30, [72, 78, 68, 255]));
        m.wires.forEach((w, i) => {
            const wy = py + 8.2 + i * 4.7;
            root.addChild(this.text(String(i + 1), px + 4.3, wy - 1, 0.9, INK));
            const fill = WIRE_COLORS[w.color];
            if (w.cut) {
                root.addChild(this.rect(px + 6.5, wy, 10.5, 1.5, fill));
                root.addChild(this.rect(px + 21.5, wy, 10.5, 1.5, fill));
            } else {
                root.addChild(this.rect(px + 6.5, wy, 25.5, 1.5, fill));
            }
        });
        m.wires.forEach((w, i) => {
            const wy = py + 8.2 + i * 4.7;
            root.addChild(this.rect(px + 3.5, wy - 1.5, 30, 4.5, [0, 0, 0, 0], {
                onClick: (playerId) => this.cutWire(Number(playerId), m, i)
            }));
        });
    }

    buildKeypadUi(root, m, px, py) {
        const positions = [[px + 4.5, py + 6], [px + 19.5, py + 6], [px + 4.5, py + 20.5], [px + 19.5, py + 20.5]];
        m.display.forEach((g, i) => {
            const [bx, by] = positions[i];
            const pressed = m.pressed.includes(g);
            const btn = this.rect(bx, by, 13, 13.5, pressed ? [70, 150, 90, 255] : KEY_BG, {
                border: 3, color: CASING_EDGE,
                onClick: (playerId) => this.pressKeypad(Number(playerId), m, g)
            });
            btn.addChild(this.text(g, bx + 6.5, by + (13.5 - TEXT_H(3)) / 2, 3, pressed ? [230, 255, 235, 255] : INK, 'center'));
            root.addChild(btn);
        });
    }

    buildButtonUi(root, m, px, py) {
        const fill = BUTTON_COLORS[m.color];
        const textColor = (m.color === 'WHITE' || m.color === 'YELLOW') ? [30, 30, 28, 255] : [245, 245, 240, 255];
        const btn = this.rect(px + 8, py + 8.5, 21, 21, fill, {
            border: 5, color: CASING_EDGE, effects: glow(fill, 6),
            onClick: (playerId) => this.pressButton(Number(playerId), m)
        });
        btn.addChild(this.text(m.label, px + 18.5, py + 8.5 + (21 - TEXT_H(1.9)) / 2, 1.9, textColor, 'center'));
        root.addChild(btn);
    }

    buildSequencerUi(root, m, px, py) {
        m.ui = { pads: {} };
        const positions = { RED: [px + 4.5, py + 6], BLU: [px + 19.5, py + 6], GRN: [px + 4.5, py + 17], YEL: [px + 19.5, py + 17] };
        PADS.forEach(k => {
            const [bx, by] = positions[k];
            const lit = m.litPad === k;
            const pad = this.rect(bx, by, 13, 9.5, lit ? PAD_LIT[k] : PAD_BASE[k], {
                border: 3, color: CASING_EDGE,
                onClick: (playerId) => this.pressPad(Number(playerId), m, k)
            });
            pad.addChild(this.text(k, bx + 6.5, by + (9.5 - TEXT_H(1)) / 2, 1, [235, 238, 230, 200], 'center'));
            m.ui.pads[k] = pad;
            root.addChild(pad);
        });
        root.addChild(this.makeButton({
            x: px + 9.5, y: py + 29.5, w: 18, h: 5.5, label: 'REPLAY', size: 1.1, fill: [70, 76, 66, 255],
            onClick: (playerId) => this.replaySeq(Number(playerId), m)
        }));
    }

    buildExpertFor(pid) {
        const root = this.players[pid].root;
        const pages = this.pagesByPid[pid] || [];
        root.addChild(this.text('YOU ARE AN EXPERT - NO PEEKING AT THE DEFUSER\'S SCREEN.', 50, 12.7, 1.2, AMBER, 'center'));
        root.addChild(this.rect(10, 20, 80, 72, PAPER, { border: 3, color: PAPER_EDGE }));
        if (!pages.length) {
            root.addChild(this.text('NO MANUAL PAGES THIS ROUND.', 50, 48, 1.6, PAPER_INK, 'center'));
            root.addChild(this.text('HELP THE OTHERS COORDINATE.', 50, 53, 1.3, PAPER_FAINT, 'center'));
            return;
        }
        const idx = (this.pageIdx[pid] || 0) % pages.length;
        const page = pages[idx];
        root.addChild(this.text(`DEFUSAL MANUAL - ${page.title}`, 50, 22.3, 1.8, PAPER_INK, 'center'));
        if (page.kind === 'lines') {
            page.lines.forEach((line, i) => {
                root.addChild(this.text(line, 14, 27.5 + i * 3.7, 1.25, PAPER_INK));
            });
        } else {
            KEYPAD_INTRO.forEach((line, i) => {
                root.addChild(this.text(line, 14, 27.5 + i * 3.7, 1.25, PAPER_INK));
            });
            ['A', 'B', 'C'].forEach((h, c) => {
                root.addChild(this.text(`COL ${h}`, 30 + c * 20, 41.5, 1.4, PAPER_FAINT, 'center'));
            });
            page.cols.forEach((col, c) => {
                col.forEach((g, r) => {
                    root.addChild(this.text(g, 30 + c * 20, 45.5 + r * 4.6, 2, PAPER_INK, 'center'));
                });
            });
        }
        if (pages.length > 1) {
            root.addChild(this.makeButton({
                x: 13, y: 83.5, w: 8, h: 5.5, label: '<', size: 1.6, fill: [90, 80, 55, 255],
                onClick: (playerId) => this.flipPage(Number(playerId), -1)
            }));
            root.addChild(this.makeButton({
                x: 79, y: 83.5, w: 8, h: 5.5, label: '>', size: 1.6, fill: [90, 80, 55, 255],
                onClick: (playerId) => this.flipPage(Number(playerId), 1)
            }));
            root.addChild(this.text(`PAGE ${idx + 1}/${pages.length}`, 50, 85.2, 1.3, PAPER_INK, 'center'));
        }
    }

    buildDebriefShared() {
        const s = this.sharedRoot;
        const r = this.lastResult;
        s.addChild(this.rect(14, 15, 72, 76, PLAQUE, { border: 4, color: r.defused ? GOOD : BAD }));
        s.addChild(this.text(r.defused ? 'BOMB DEFUSED' : 'KA-BOOM', 50, 19, 3.4, r.defused ? GOOD : BAD, 'center'));
        s.addChild(this.text(
            r.defused ? `TIME LEFT ${r.timeLeft} - STRIKES ${r.strikes}` : r.cause,
            50, 27.5, 1.5, INK, 'center'
        ));
        s.addChild(this.text('DEBRIEF', 18, 32.5, 1.2, FAINT));
        this.bomb.modules.forEach((m, i) => {
            const y = 36.5 + i * 8;
            s.addChild(this.text(
                `${MODULE_NAMES[m.key]} ${m.disarmed ? '[CLEAR]' : '[ARMED]'}`,
                18, y, 1.45, m.disarmed ? GOOD : BAD
            ));
            s.addChild(this.text(this.moduleAnswer(m), 18, y + 3.3, 1.15, FAINT));
        });
        s.addChild(this.makeButton({
            x: 40, y: 80, w: 20, h: 7.5,
            label: this.bombIndex + 1 < BOMBS_PER_MISSION ? 'NEXT BOMB' : 'RESULTS',
            size: 1.4, fill: [60, 110, 70, 255],
            onClick: (playerId) => this.continueMission(Number(playerId))
        }));
    }

    moduleAnswer(m) {
        if (m.key === 'wires') return `ANSWER: ${m.answer.rule}`;
        if (m.key === 'keypad') return `ANSWER: COL ${'ABC'[m.target]} -> ${m.order.join('  ')}`;
        if (m.key === 'button') return `ANSWER: ${m.rule.rule}`;
        return `ANSWER: FLASHED ${m.seq.join(', ')} (MAP BY CURRENT STRIKES)`;
    }

    buildGameOverShared() {
        const s = this.sharedRoot;
        const rec = this.record;
        const title = rec.defused === 3 ? 'PERFECT MISSION'
            : rec.defused === 2 ? 'MISSION COMPLETE'
                : rec.defused === 1 ? 'WELL... ONE SURVIVED'
                    : 'TOTAL DEVASTATION';
        s.addChild(this.text(title, 50, 20, 4, AMBER, 'center'));
        s.addChild(this.text(`BOMBS DEFUSED   ${rec.defused}/${BOMBS_PER_MISSION}`, 50, 38, 1.7, INK, 'center'));
        s.addChild(this.text(`BOMBS EXPLODED  ${rec.exploded}`, 50, 44, 1.7, INK, 'center'));
        s.addChild(this.text(`TOTAL STRIKES   ${rec.strikes}`, 50, 50, 1.7, INK, 'center'));
        s.addChild(this.makeButton({
            x: 37, y: 66, w: 26, h: 8, label: 'PLAY AGAIN', size: 1.6, fill: [60, 110, 70, 255],
            onClick: (playerId) => this.playAgain(Number(playerId))
        }));
        s.addChild(this.text('SAME CREW, FRESH BOMBS. ROLES ROTATE.', 50, 80, 1.2, FAINT, 'center'));
    }
}

Defuse.SEQ_MAPS = SEQ_MAPS;

module.exports = Defuse;
