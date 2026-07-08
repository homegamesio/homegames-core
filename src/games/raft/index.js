const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

const TICK_RATE = 15;
const MAX_PLAYERS = 8;
const RUN_TICKS = 150 * TICK_RATE;

const HUD_H = 8;
const RAFT_Y = 70;
const RAFT_HALF_W = 4;
const RAFT_HALF_H = 3;
const ROW_H = 4.6;
const SCROLL_SPEED = 0.55;
const BONK_SPEED = 0.25;
const DUCK_EVERY = 90;

// River palette
const WATER = [70, 130, 190, 255];
const BANK = [110, 160, 80, 255];
const HUD_BG = [40, 70, 100, 255];
const CREAM = [245, 248, 245, 255];
const FAINT = [170, 195, 215, 255];
const INK = [40, 55, 70, 255];
const ACCENT = [255, 170, 60, 255];
const CARD = [242, 240, 230, 255];
const WOOD = [165, 120, 70, 255];
const WOOD_DARK = [130, 92, 52, 255];
const DUCK_YELLOW = [250, 210, 70, 255];
const DUCK_BEAK = [235, 130, 50, 255];

const CREW_COLORS = [
    [245, 130, 40, 255], [50, 90, 220, 255], [220, 60, 50, 255], [140, 80, 200, 255],
    [40, 170, 170, 255], [235, 100, 160, 255], [235, 200, 50, 255], [50, 50, 55, 255]
];
const CREW_SEATS = [[-2.2, -1.3], [0, -1.3], [2.2, -1.3], [-2.2, 1.3], [0, 1.3], [2.2, 1.3], [-1.1, 0], [1.1, 0]];

const polyCircle = (cx, cy, r, sides = 12) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

class Raft extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Raft',
            author: 'Joseph Garcia',
            description: 'One raft, everyone paddles. Steer down the river together, scoop up ducks, and try not to hit the banks. You will hit the banks.',
            aspectRatio: { x: 1, y: 1 },
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
        this.joinCount = 0;
        this.raftX = 50;
        this.vx = 0;
        this.dist = 0;
        this.ducksCaught = 0;
        this.bonks = 0;
        this.runStart = 0;
        this.slowUntil = 0;
        this.spinUntil = 0;
        this.ducks = [];
        this.fx = [];
        this.rows = [];

        this.base = this.rect(0, 0, 100, 100, WATER);

        this.distLabel = this.text('', 2, 2.2, 1.5, CREAM);
        this.duckLabel = this.text('', 50, 2.2, 1.5, CREAM, 'center');
        this.timerNode = this.text('', 93, 1.8, 2.6, CREAM, 'center');

        this.riverLayer = this.container();
        this.duckLayer = this.container();
        this.raftLayer = this.container();
        this.fxLayer = this.container();
        this.controlLayer = this.container();
        this.centerLayer = this.container();
        this.playerLayer = this.container();

        this.base.addChildren(
            this.riverLayer, this.duckLayer, this.raftLayer, this.fxLayer,
            this.rect(0, 0, 100, HUD_H, HUD_BG),
            this.distLabel, this.duckLabel, this.timerNode,
            this.controlLayer, this.centerLayer, this.playerLayer
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
        const bg = this.rect(x, y, w, h, fill, { border: 4, color: INK, onClick });
        bg.addChild(this.text(label, x + w / 2, y + (h - size) / 2, size, CREAM, 'center'));
        return bg;
    }

    // ---- river ----

    channelAt(d) {
        const c = 50 + 22 * Math.sin(d * 0.016) + 8 * Math.sin(d * 0.043);
        const half = 20 - Math.min(8, d * 0.004);
        return { left: c - half, right: c + half };
    }

    buildRiver() {
        this.riverLayer.clearChildren();
        this.rows = [];
        for (let y = HUD_H; y < 100; y += ROW_H) {
            const left = this.rect(0, y, 1, ROW_H + 0.2, BANK);
            const right = this.rect(99, y, 1, ROW_H + 0.2, BANK);
            this.riverLayer.addChildren(left, right);
            this.rows.push({ y, left, right });
        }
    }

    updateRiver() {
        this.rows.forEach(row => {
            const d = this.dist + (RAFT_Y - row.y);
            const ch = this.channelAt(d);
            const leftW = Math.max(0.1, Math.min(92, ch.left));
            const rightX = Math.max(8, Math.min(99.9, ch.right));
            row.left.node.coordinates2d = ShapeUtils.rectangle(0, row.y, leftW, ROW_H + 0.2);
            row.right.node.coordinates2d = ShapeUtils.rectangle(rightX, row.y, 100 - rightX, ROW_H + 0.2);
        });
    }

    // ---- flow ----

    startGame(pid) {
        if (this.phase !== 'lobby' || !this.players[pid]) {
            return;
        }
        this.phase = 'running';
        this.runStart = this._t;
        this.raftX = 50;
        this.vx = 0;
        this.dist = 0;
        this.ducksCaught = 0;
        this.bonks = 0;
        this.slowUntil = 0;
        this.spinUntil = 0;
        this.ducks = [];
        this.fx = [];
        this.duckLayer.clearChildren();
        this.fxLayer.clearChildren();
        Object.values(this.players).forEach(p => {
            p.paddles = 0;
        });
        this.buildRiver();
        this.buildRaft();
        this.refresh();
    }

    playAgain(pid) {
        if (this.phase !== 'results' || !this.players[pid]) {
            return;
        }
        this.abortToLobby();
    }

    abortToLobby() {
        this.phase = 'lobby';
        this.clearRun();
        this.refresh();
    }

    endRun() {
        this.phase = 'results';
        this.clearRun();
        this.refresh();
    }

    clearRun() {
        this.ducks = [];
        this.fx = [];
        this.rows = [];
        this.riverLayer.clearChildren();
        this.duckLayer.clearChildren();
        this.raftLayer.clearChildren();
        this.fxLayer.clearChildren();
    }

    buildRaft() {
        this.raftLayer.clearChildren();
        this.raftNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.raftCoords(0),
            fill: WOOD,
            border: 3,
            color: WOOD_DARK
        });
        this.raftLayer.addChild(this.raftNode);
        this.crewNodes = [];
        Object.values(this.players).forEach((p, i) => {
            const seat = CREW_SEATS[i % CREW_SEATS.length];
            const node = this.rect(this.raftX + seat[0] - 0.9, RAFT_Y + seat[1] - 0.9, 1.8, 1.8, p.color, { border: 2, color: INK });
            this.crewNodes.push({ node, seat });
            this.raftLayer.addChild(node);
        });
    }

    raftCoords(angle) {
        const corners = [
            [-RAFT_HALF_W, -RAFT_HALF_H], [RAFT_HALF_W, -RAFT_HALF_H],
            [RAFT_HALF_W, RAFT_HALF_H], [-RAFT_HALF_W, RAFT_HALF_H],
            [-RAFT_HALF_W, -RAFT_HALF_H]
        ];
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return corners.map(([px, py]) => [
            this.raftX + px * cos - py * sin,
            RAFT_Y + px * sin + py * cos
        ]);
    }

    // ---- input ----

    paddle(pid, dir) {
        const p = this.players[pid];
        if (!p || this.phase !== 'running') {
            return;
        }
        this.vx = Math.max(-0.9, Math.min(0.9, this.vx + dir * 0.09));
        p.paddles++;
    }

    // ---- ducks / fx ----

    spawnDuck() {
        const d = this.dist + (RAFT_Y - HUD_H);
        const ch = this.channelAt(d);
        const x = ch.left + 4 + Math.random() * Math.max(1, ch.right - ch.left - 8);
        const body = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(x, HUD_H, 1.5),
            fill: DUCK_YELLOW
        });
        const beak = this.rect(x + 1.1, HUD_H - 0.4, 1, 0.8, DUCK_BEAK);
        this.duckLayer.addChildren(body, beak);
        this.ducks.push({ x, d, body, beak });
    }

    removeDuck(duck) {
        this.duckLayer.removeChild(duck.body.node.id);
        this.duckLayer.removeChild(duck.beak.node.id);
    }

    popFx(label, x, y, color) {
        const node = this.text(label, x, y, 2, color, 'center');
        this.fxLayer.addChild(node);
        this.fx.push({ node, until: this._t + 12 });
    }

    // ---- game loop ----

    tick() {
        this._t++;
        if (this.phase === 'running') {
            const speed = this._t < this.slowUntil ? BONK_SPEED : SCROLL_SPEED;
            this.dist += speed;

            this.vx *= 0.93;
            this.raftX += this.vx;

            const ch = this.channelAt(this.dist);
            if (this.raftX - RAFT_HALF_W < ch.left) {
                this.raftX = ch.left + RAFT_HALF_W;
                this.vx = Math.abs(this.vx) * 0.4 + 0.1;
                this.bonk();
            } else if (this.raftX + RAFT_HALF_W > ch.right) {
                this.raftX = ch.right - RAFT_HALF_W;
                this.vx = -Math.abs(this.vx) * 0.4 - 0.1;
                this.bonk();
            }

            if ((this._t - this.runStart) % DUCK_EVERY === 0) {
                this.spawnDuck();
            }
            this.ducks = this.ducks.filter(duck => {
                const y = RAFT_Y - (duck.d - this.dist);
                if (y > 102) {
                    this.removeDuck(duck);
                    return false;
                }
                if (Math.abs(y - RAFT_Y) < 4 && Math.abs(duck.x - this.raftX) < RAFT_HALF_W + 2) {
                    this.removeDuck(duck);
                    this.ducksCaught++;
                    this.popFx('QUACK!', duck.x, y - 5, DUCK_YELLOW);
                    return false;
                }
                duck.body.node.coordinates2d = polyCircle(duck.x, y, 1.5);
                duck.beak.node.coordinates2d = ShapeUtils.rectangle(duck.x + 1.1, y - 0.4, 1, 0.8);
                return true;
            });

            this.updateRiver();
            const angle = this._t < this.spinUntil ? Math.sin((this.spinUntil - this._t) * 0.8) * 0.45 : 0;
            this.raftNode.node.coordinates2d = this.raftCoords(angle);
            this.crewNodes.forEach(c => {
                c.node.node.coordinates2d = ShapeUtils.rectangle(
                    this.raftX + c.seat[0] - 0.9, RAFT_Y + c.seat[1] - 0.9, 1.8, 1.8
                );
            });
            this.dirty = true;

            this.setText(this.distLabel, `${Math.floor(this.dist / 10)}M`);
            this.setText(this.duckLabel, `DUCKS ${this.ducksCaught}`);
            const sec = Math.max(0, Math.ceil((RUN_TICKS - (this._t - this.runStart)) / TICK_RATE));
            this.setText(this.timerNode, String(sec));

            if (this._t - this.runStart >= RUN_TICKS) {
                this.endRun();
            }
        }
        this.fx = this.fx.filter(f => {
            if (this._t >= f.until) {
                this.fxLayer.removeChild(f.node.node.id);
                return false;
            }
            return true;
        });
        if (this.dirty) {
            this.dirty = false;
            this.base.node.onStateChange();
        }
    }

    bonk() {
        this.bonks++;
        this.slowUntil = this._t + 25;
        this.spinUntil = this._t + 12;
        this.popFx('BONK!', this.raftX, RAFT_Y - 8, ACCENT);
    }

    // ---- players ----

    handleNewPlayer({ playerId, info }) {
        const pid = Number(playerId);
        if (this.players[pid] || Object.keys(this.players).length >= MAX_PLAYERS) {
            return;
        }
        const name = ((info && info.name) || `PADDLER ${pid}`).toUpperCase().slice(0, 10);
        const root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [pid]
        });
        this.players[pid] = { name, color: CREW_COLORS[this.joinCount % CREW_COLORS.length], paddles: 0, root };
        this.joinCount++;
        this.playerLayer.addChild(root);
        if (this.phase === 'running') {
            this.buildRaft();
        }
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
        if (this.phase !== 'lobby' && !Object.keys(this.players).length) {
            return this.abortToLobby();
        }
        if (this.phase === 'running') {
            this.buildRaft();
        }
        this.refresh();
    }

    // ---- views ----

    refresh() {
        if (this.phase !== 'running') {
            this.setText(this.distLabel, '');
            this.setText(this.duckLabel, '');
            this.setText(this.timerNode, '');
        }
        this.rebuildControls();
        this.rebuildCenter();
        Object.keys(this.players).forEach(pid => this.rebuildPlayerRoot(Number(pid)));
        this.base.node.onStateChange();
    }

    rebuildControls() {
        this.controlLayer.clearChildren();
        if (this.phase !== 'running') {
            return;
        }
        this.controlLayer.addChild(this.makeButton({
            x: 6, y: 87, w: 22, h: 10, label: '< PADDLE', size: 1.5, fill: [50, 90, 130, 255],
            onClick: (playerId) => this.paddle(Number(playerId), -1)
        }));
        this.controlLayer.addChild(this.makeButton({
            x: 72, y: 87, w: 22, h: 10, label: 'PADDLE >', size: 1.5, fill: [50, 90, 130, 255],
            onClick: (playerId) => this.paddle(Number(playerId), 1)
        }));
    }

    rebuildCenter() {
        this.centerLayer.clearChildren();
        if (this.phase === 'lobby') {
            const s = this.centerLayer;
            s.addChild(this.text('RAFT', 50.4, 14.4, 6, [0, 0, 0, 110], 'center'));
            s.addChild(this.text('RAFT', 50, 14, 6, CREAM, 'center'));
            s.addChild(this.text('ONE RAFT. EVERYONE PADDLES. GOOD LUCK.', 50, 27, 1.4, CREAM, 'center'));
            s.addChild(this.text('STEERING IS THE SUM OF EVERYONE MASHING LEFT AND RIGHT.', 50, 31, 1.15, FAINT, 'center'));
            s.addChild(this.text('COLLECT DUCKS. THE BANKS FORGIVE, BUT THEY DO NOT FORGET.', 50, 34.5, 1.15, FAINT, 'center'));
            const ids = Object.keys(this.players).map(Number);
            s.addChild(this.text(`CREW (${ids.length}/${MAX_PLAYERS})`, 38, 43, 1.2, FAINT));
            ids.forEach((pid, i) => {
                const p = this.players[pid];
                s.addChild(this.rect(38, 47.5 + i * 4.3, 2, 2, p.color, { border: 2, color: INK }));
                s.addChild(this.text(p.name, 41.5, 47.5 + i * 4.3, 1.35, CREAM));
            });
            if (ids.length >= 1) {
                s.addChild(this.makeButton({
                    x: 40, y: 84, w: 20, h: 8, label: 'SHOVE OFF', size: 1.5, fill: ACCENT,
                    onClick: (playerId) => this.startGame(Number(playerId))
                }));
            }
        } else if (this.phase === 'results') {
            const s = this.centerLayer;
            const distM = Math.floor(this.dist / 10);
            const score = distM + this.ducksCaught * 10;
            s.addChild(this.rect(20, 14, 60, 74, CARD, { border: 4, color: INK }));
            s.addChild(this.text('ASHORE!', 50, 18, 2.8, ACCENT, 'center'));
            s.addChild(this.text(`DISTANCE  ${distM}M`, 50, 27, 1.8, INK, 'center'));
            s.addChild(this.text(`DUCKS     ${this.ducksCaught}`, 50, 32.5, 1.8, INK, 'center'));
            s.addChild(this.text(`BONKS     ${this.bonks}`, 50, 38, 1.6, [150, 120, 90, 255], 'center'));
            s.addChild(this.text(`CREW SCORE ${score}`, 50, 45, 2.2, ACCENT, 'center'));
            const ids = Object.keys(this.players).map(Number)
                .sort((a, b) => this.players[b].paddles - this.players[a].paddles);
            ids.forEach((pid, i) => {
                const p = this.players[pid];
                s.addChild(this.text(`${p.name}  ${p.paddles} PADDLES`, 50, 54 + i * 4, 1.3, INK, 'center'));
            });
            s.addChild(this.makeButton({
                x: 37, y: 79, w: 26, h: 7.5, label: 'PLAY AGAIN', size: 1.5, fill: ACCENT,
                onClick: (playerId) => this.playAgain(Number(playerId))
            }));
        }
    }

    rebuildPlayerRoot(pid) {
        const p = this.players[pid];
        if (!p) {
            return;
        }
        p.root.clearChildren();
        if (this.phase === 'lobby') {
            const ids = Object.keys(this.players).map(Number);
            p.root.addChild(this.text('< YOU', 60, 47.5 + ids.indexOf(pid) * 4.3, 1.2, ACCENT));
        }
    }
}

module.exports = Raft;
