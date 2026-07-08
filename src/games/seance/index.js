const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

const TICK_RATE = 15;
const MAX_PLAYERS = 8;

// Candlelit palette
const BG = [22, 16, 30, 255];
const BOARD_INK = [216, 196, 160, 255];
const GOLD = [255, 210, 110, 255];
const FAINT = [130, 115, 150, 255];
const CARD = [38, 30, 52, 255];
const CARD_EDGE = [120, 100, 150, 255];
const PLANCHETTE_WOOD = [190, 150, 90, 255];
const PLANCHETTE_EDGE = [90, 65, 35, 255];
const FLAME = [255, 180, 70, 255];
const GOOD = [140, 230, 160, 255];

const HOLD_FORCE = 0.045;
const SPIRIT_BIAS_FORCE = 0.03;
const DWELL_TICKS = 15;
const DWELL_RADIUS = 2.9;
const MESSAGE_MAX = 26;

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

const polyCircle = (cx, cy, r, sides = 12) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

// A-M on the upper arc, N-Z on the lower arc, classic board style
const buildBoardPoints = () => {
    const points = [];
    'ABCDEFGHIJKLM'.split('').forEach((ch, i) => {
        const t = i / 12;
        points.push({ label: ch, append: ch, x: 15 + t * 70, y: 44 - Math.sin(t * Math.PI) * 9 });
    });
    'NOPQRSTUVWXYZ'.split('').forEach((ch, i) => {
        const t = i / 12;
        points.push({ label: ch, append: ch, x: 15 + t * 70, y: 60 - Math.sin(t * Math.PI) * 9 });
    });
    points.push({ label: 'YES', append: 'YES ', x: 20, y: 24, big: true });
    points.push({ label: 'NO', append: 'NO ', x: 80, y: 24, big: true });
    points.push({ label: 'GOODBYE', append: null, goodbye: true, x: 50, y: 88, big: true });
    return points;
};
const BOARD_POINTS = buildBoardPoints();

class Seance extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Seance',
            author: 'Joseph Garcia',
            description: 'A haunted office ouija board. Ask a question out loud, rest your hands on the board, and watch it answer. Nobody is steering. Probably. The board keeps receipts.',
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
        this.px = 50;
        this.py = 70;
        this.vx = 0;
        this.vy = 0;
        this.message = '';
        this.transcript = [];
        this.influence = {};
        this.spiritInfluence = 0;
        this.dwellIdx = -1;
        this.dwellTicks = 0;
        this.cooldownUntil = 0;
        this.biasPoint = null;
        this.biasUntil = 0;
        this.nextBiasAt = 0;
        this.flashUntil = 0;

        this.base = this.rect(0, 0, 100, 100, BG);

        this.titleLabel = this.text('S E A N C E', 2, 2.2, 1.6, FAINT);
        this.handsLabel = this.text('', 2, 6.5, 1.1, FAINT);
        this.messageLabel = this.text('', 50, 2.5, 2.2, GOLD, 'center');

        this.boardLayer = this.container();
        this.planchetteLayer = this.container();
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 14, 100, 86),
            fill: [0, 0, 0, 0],
            onClick: (playerId, x, y) => this.handleHold(Number(playerId), x, y)
        });
        this.hudLayer = this.container();
        this.centerLayer = this.container();
        this.playerLayer = this.container();

        this.base.addChildren(
            this.titleLabel, this.handsLabel, this.messageLabel,
            this.boardLayer, this.planchetteLayer, this.tapCatcher,
            this.hudLayer, this.centerLayer, this.playerLayer
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
        const bg = this.rect(x, y, w, h, fill, { border: 4, color: [15, 10, 22, 255], onClick });
        bg.addChild(this.text(label, x + w / 2, y + (h - size * 16 / 9) / 2, size, BOARD_INK, 'center'));
        return bg;
    }

    // ---- players ----

    handleNewPlayer({ playerId, info }) {
        const pid = Number(playerId);
        if (this.players[pid] || Object.keys(this.players).length >= MAX_PLAYERS) {
            return;
        }
        const name = ((info && info.name) || `GUEST ${pid}`).toUpperCase().slice(0, 10);
        const root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [pid]
        });
        this.players[pid] = { name, root, hx: 50, hy: 70, lastHold: -100 };
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
        delete this.influence[pid];
        if (this.phase !== 'lobby' && !Object.keys(this.players).length) {
            return this.endSeance(true);
        }
        this.refresh();
    }

    // ---- flow ----

    beginSeance(pid) {
        if (this.phase !== 'lobby' || !this.players[pid]) {
            return;
        }
        this.phase = 'seance';
        this.px = 50;
        this.py = 70;
        this.vx = 0;
        this.vy = 0;
        this.message = '';
        this.transcript = [];
        this.influence = {};
        this.spiritInfluence = 0;
        this.dwellIdx = -1;
        this.dwellTicks = 0;
        this.cooldownUntil = 0;
        this.biasPoint = null;
        this.biasUntil = 0;
        this.nextBiasAt = this._t + 450 + Math.floor(Math.random() * 450);
        Object.values(this.players).forEach(p => {
            p.lastHold = -100;
        });
        this.buildBoard();
        this.refresh();
    }

    summonAgain(pid) {
        if (this.phase !== 'farewell' || !this.players[pid]) {
            return;
        }
        this.endSeance(true);
    }

    endSeance(toLobby) {
        this.phase = toLobby ? 'lobby' : 'farewell';
        if (toLobby) {
            this.boardLayer.clearChildren();
            this.planchetteLayer.clearChildren();
            this.planchette = null;
        }
        this.refresh();
    }

    clearMessage(pid) {
        if (this.phase !== 'seance' || !this.players[pid]) {
            return;
        }
        this.pushTranscript();
        this.refresh();
    }

    pushTranscript() {
        if (this.message.trim()) {
            this.transcript.push(this.message.trim());
            if (this.transcript.length > 6) {
                this.transcript.shift();
            }
        }
        this.message = '';
    }

    // ---- board ----

    buildBoard() {
        this.boardLayer.clearChildren();
        this.planchetteLayer.clearChildren();

        // Candles
        [[5, 78], [95, 78]].forEach(([cx, cy], i) => {
            this.boardLayer.addChild(this.rect(cx - 1.2, cy, 2.4, 12, [220, 210, 190, 255]));
            const flame = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(cx, cy - 1.6, 1.2, 8),
                fill: FLAME,
                effects: glow(FLAME, 14)
            });
            this.boardLayer.addChild(flame);
            if (i === 0) {
                this.flame1 = flame;
            } else {
                this.flame2 = flame;
            }
        });

        BOARD_POINTS.forEach(pt => {
            this.boardLayer.addChild(this.text(pt.label, pt.x, pt.y - (pt.big ? 1.8 : 1.6), pt.big ? 2 : 2.2, BOARD_INK, 'center'));
        });

        this.highlight = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(-10, -10, 3, 10),
            fill: [0, 0, 0, 0],
            color: GOLD,
            border: 5
        });
        this.boardLayer.addChild(this.highlight);

        this.planchette = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.planchetteCoords(),
            fill: PLANCHETTE_WOOD,
            border: 4,
            color: PLANCHETTE_EDGE,
            effects: glow(GOLD, 8)
        });
        this.lens = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(this.px, this.py, 1.1, 10),
            fill: [25, 18, 32, 255]
        });
        this.planchetteLayer.addChildren(this.planchette, this.lens);
    }

    planchetteCoords() {
        const s = [[0, -4.2], [2.8, -1], [3.2, 2.4], [0, 3.8], [-3.2, 2.4], [-2.8, -1], [0, -4.2]];
        return s.map(([dx, dy]) => [this.px + dx, this.py + dy]);
    }

    // ---- input ----

    handleHold(pid, x, y) {
        const p = this.players[pid];
        if (!p || this.phase !== 'seance') {
            return;
        }
        p.hx = x;
        p.hy = y;
        p.lastHold = this._t;
    }

    // ---- the spirits ----

    tick() {
        this._t++;
        if (this.phase === 'seance') {
            let ax = 0;
            let ay = 0;

            // Every hand on the board pulls quietly toward its owner's point
            Object.keys(this.players).forEach(pid => {
                const p = this.players[pid];
                if (this._t - p.lastHold > 8) {
                    return;
                }
                const dx = p.hx - this.px;
                const dy = p.hy - this.py;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 1) {
                    return;
                }
                ax += (dx / d) * HOLD_FORCE;
                ay += (dy / d) * HOLD_FORCE;
                this.influence[pid] = (this.influence[pid] || 0) + HOLD_FORCE;
            });

            // The spirits are always faintly restless
            const wx = 0.008 * Math.sin(this._t * 0.073 + 1.7) + 0.006 * Math.sin(this._t * 0.031);
            const wy = 0.008 * Math.sin(this._t * 0.057 + 4.1) + 0.006 * Math.sin(this._t * 0.043 + 2.2);
            ax += wx;
            ay += wy;
            this.spiritInfluence += Math.abs(wx) + Math.abs(wy);

            // ...and sometimes they have opinions
            if (!this.biasPoint && this._t >= this.nextBiasAt) {
                this.biasPoint = BOARD_POINTS[Math.floor(Math.random() * 26)];
                this.biasUntil = this._t + 90;
            }
            if (this.biasPoint) {
                if (this._t >= this.biasUntil) {
                    this.biasPoint = null;
                    this.nextBiasAt = this._t + 450 + Math.floor(Math.random() * 450);
                } else {
                    const dx = this.biasPoint.x - this.px;
                    const dy = this.biasPoint.y - this.py;
                    const d = Math.sqrt(dx * dx + dy * dy) || 1;
                    ax += (dx / d) * SPIRIT_BIAS_FORCE;
                    ay += (dy / d) * SPIRIT_BIAS_FORCE;
                    this.spiritInfluence += SPIRIT_BIAS_FORCE;
                }
            }

            this.vx = (this.vx + ax) * 0.88;
            this.vy = (this.vy + ay) * 0.88;
            this.px = Math.max(6, Math.min(94, this.px + this.vx));
            this.py = Math.max(19, Math.min(93, this.py + this.vy));

            this.updateDwell();

            this.planchette.node.coordinates2d = this.planchetteCoords();
            this.lens.node.coordinates2d = polyCircle(this.px, this.py, 1.1, 10);
            if (this._t % 5 === 0 && this.flame1) {
                const blur = 10 + Math.sin(this._t * 0.4) * 5;
                this.flame1.node.effects = glow(FLAME, blur);
                this.flame2.node.effects = glow(FLAME, 15 - blur * 0.4);
            }
            if (this.flashUntil && this._t >= this.flashUntil) {
                this.flashUntil = 0;
                this.highlight.node.coordinates2d = polyCircle(-10, -10, 3, 10);
            }
            this.dirty = true;

            const hands = Object.values(this.players).filter(p => this._t - p.lastHold <= 8).length;
            this.setText(this.handsLabel, `HANDS ON THE BOARD: ${hands}`);
            this.setText(this.messageLabel, this.message || '. . .');
        }
        if (this.dirty) {
            this.dirty = false;
            this.base.node.onStateChange();
        }
    }

    updateDwell() {
        if (this._t < this.cooldownUntil) {
            return;
        }
        let nearest = -1;
        let best = DWELL_RADIUS;
        BOARD_POINTS.forEach((pt, i) => {
            const d = Math.sqrt((pt.x - this.px) ** 2 + (pt.y - this.py) ** 2);
            if (d < best) {
                best = d;
                nearest = i;
            }
        });
        if (nearest !== this.dwellIdx) {
            this.dwellIdx = nearest;
            this.dwellTicks = 0;
            return;
        }
        if (nearest === -1) {
            return;
        }
        this.dwellTicks++;
        if (this.dwellTicks >= DWELL_TICKS) {
            this.selectPoint(BOARD_POINTS[nearest]);
        }
    }

    selectPoint(pt) {
        this.dwellIdx = -1;
        this.dwellTicks = 0;
        this.cooldownUntil = this._t + 14;
        this.highlight.node.coordinates2d = polyCircle(pt.x, pt.y - 0.4, pt.big ? 5 : 3, 12);
        this.flashUntil = this._t + 10;

        if (pt.goodbye) {
            this.pushTranscript();
            return this.endSeance(false);
        }
        this.message += pt.append;
        if (this.message.length >= MESSAGE_MAX) {
            this.pushTranscript();
        }
        // A polite shove so the same letter needs conviction to repeat
        const a = Math.random() * Math.PI * 2;
        this.vx += Math.cos(a) * 0.5;
        this.vy += Math.sin(a) * 0.5;
        this.dirty = true;
    }

    // ---- views ----

    refresh() {
        if (this.phase !== 'seance') {
            this.setText(this.handsLabel, '');
            this.setText(this.messageLabel, '');
        }
        this.rebuildHud();
        this.rebuildCenter();
        Object.keys(this.players).forEach(pid => this.rebuildPlayerRoot(Number(pid)));
        this.base.node.onStateChange();
    }

    rebuildHud() {
        this.hudLayer.clearChildren();
        if (this.phase === 'seance') {
            this.hudLayer.addChild(this.makeButton({
                x: 88, y: 2.5, w: 10, h: 6, label: 'CLEAR', size: 1.1, fill: [60, 45, 80, 255],
                onClick: (playerId) => this.clearMessage(Number(playerId))
            }));
        }
    }

    rebuildCenter() {
        this.centerLayer.clearChildren();
        if (this.phase === 'lobby') {
            const s = this.centerLayer;
            s.addChild(this.text('S E A N C E', 50.3, 12.3, 4.5, [0, 0, 0, 150], 'center'));
            s.addChild(this.text('S E A N C E', 50, 12, 4.5, GOLD, 'center'));
            s.addChild(this.text('ASK THE BOARD A QUESTION, OUT LOUD.', 50, 25, 1.4, BOARD_INK, 'center'));
            s.addChild(this.text('HOLD ANYWHERE TO PULL THE PLANCHETTE. QUIETLY.', 50, 29.5, 1.2, FAINT, 'center'));
            s.addChild(this.text('NOBODY WILL KNOW IT WAS YOU. PROBABLY.', 50, 33, 1.2, FAINT, 'center'));
            const ids = Object.keys(this.players).map(Number);
            s.addChild(this.text('THE CIRCLE', 40, 42, 1.2, FAINT));
            ids.forEach((pid, i) => {
                s.addChild(this.text(`${this.players[pid].name} HAS JOINED`, 40, 46.5 + i * 4, 1.3, BOARD_INK));
            });
            if (ids.length >= 1) {
                s.addChild(this.makeButton({
                    x: 37, y: 82, w: 26, h: 8, label: 'LIGHT THE CANDLES', size: 1.3, fill: [90, 55, 120, 255],
                    onClick: (playerId) => this.beginSeance(Number(playerId))
                }));
            }
        } else if (this.phase === 'farewell') {
            this.buildFarewell();
        }
    }

    buildFarewell() {
        const s = this.centerLayer;
        s.addChild(this.rect(18, 10, 64, 82, CARD, { border: 4, color: CARD_EDGE }));
        s.addChild(this.text('THE SPIRITS DEPART', 50, 14, 2.6, GOLD, 'center'));
        s.addChild(this.text('THE BOARD SPOKE:', 22, 22, 1.1, FAINT));
        const messages = this.transcript.length ? this.transcript : ['(NOTHING. SPOOKY IN ITS OWN WAY.)'];
        messages.slice(-5).forEach((m, i) => {
            s.addChild(this.text(`"${m.slice(0, 30)}"`, 22, 26 + i * 4, 1.3, BOARD_INK));
        });

        const entries = Object.keys(this.players).map(pid => ({
            name: this.players[pid].name,
            amount: this.influence[pid] || 0
        }));
        entries.push({ name: 'THE SPIRITS', amount: this.spiritInfluence, spirit: true });
        const total = entries.reduce((sum, e) => sum + e.amount, 0) || 1;
        entries.sort((a, b) => b.amount - a.amount);

        s.addChild(this.text('THE BOARD KEEPS RECEIPTS:', 22, 50, 1.1, FAINT));
        entries.forEach((e, i) => {
            const pct = Math.round((e.amount / total) * 100);
            s.addChild(this.text(
                `${e.name}  ${pct}%`,
                22, 54 + i * 3.8, 1.25, e.spirit ? GOLD : BOARD_INK
            ));
        });
        const top = entries[0];
        const verdict = top.spirit
            ? 'NO FRAUD DETECTED. SLEEP WELL.'
            : `MOST SUSPICIOUS FINGER: ${top.name}`;
        s.addChild(this.text(verdict, 50, 54 + entries.length * 3.8 + 2, 1.4, top.spirit ? GOOD : GOLD, 'center'));

        s.addChild(this.makeButton({
            x: 37, y: 83, w: 26, h: 7, label: 'SUMMON AGAIN', size: 1.3, fill: [90, 55, 120, 255],
            onClick: (playerId) => this.summonAgain(Number(playerId))
        }));
    }

    rebuildPlayerRoot(pid) {
        const p = this.players[pid];
        if (!p) {
            return;
        }
        p.root.clearChildren();
        if (this.phase === 'lobby') {
            const ids = Object.keys(this.players).map(Number);
            p.root.addChild(this.text('< YOU', 68, 46.5 + ids.indexOf(pid) * 4, 1.2, GOLD));
        }
    }
}

module.exports = Seance;
