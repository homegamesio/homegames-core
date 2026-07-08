const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

const TICK_RATE = 15;
const MAX_PLAYERS = 8;
const ROUND_TICKS = 90 * TICK_RATE;
const BALLOON_R = 6;
const FLOOR_Y = 96;
const HUD_H = 10;

// Break-room palette
const BG = [235, 240, 244, 255];
const HUD_BG = [50, 60, 75, 255];
const INK = [50, 60, 75, 255];
const CREAM = [245, 248, 250, 255];
const FAINT = [150, 160, 175, 255];
const ACCENT = [255, 130, 90, 255];
const FLOOR = [200, 190, 175, 255];
const CARD = [250, 250, 248, 255];
const GOOD = [70, 180, 110, 255];

const BALLOON_COLORS = [
    [235, 90, 80, 255],
    [80, 140, 235, 255],
    [250, 200, 70, 255],
    [130, 200, 110, 255],
    [190, 110, 220, 255]
];

// Balloons join the round at these ticks (max 5 in the air)
const SPAWN_AT = [0, 300, 600, 900, 1125];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

const polyCircle = (cx, cy, r, sides = 14) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

class KeepUp extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Break Room Keep-Up',
            author: 'Joseph Garcia',
            description: 'Co-op balloon keep-up. Tap balloons to keep them off the floor and build the team streak. More balloons keep arriving.',
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
        this.balloons = [];
        this.pops = [];
        this.roundStart = 0;
        this.combo = 0;
        this.bestCombo = 0;
        this.totalBops = 0;
        this.floorPops = 0;

        this.base = this.rect(0, 0, 100, 100, BG);

        this.comboLabel = this.text('', 50, 1.6, 3.2, CREAM, 'center');
        this.bestLabel = this.text('', 2, 3.4, 1.4, FAINT);
        this.timerNode = this.text('', 93, 2.6, 2.4, CREAM, 'center');

        this.fieldLayer = this.container();
        this.fxLayer = this.container();
        this.centerLayer = this.container();
        this.playerLayer = this.container();

        this.base.addChildren(
            this.rect(0, 0, 100, HUD_H, HUD_BG),
            this.rect(0, FLOOR_Y, 100, 4, FLOOR),
            this.comboLabel, this.bestLabel, this.timerNode,
            this.fieldLayer, this.fxLayer, this.centerLayer, this.playerLayer
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

    // ---- player lifecycle ----

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
        this.players[pid] = { name, bops: 0, root };
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
        if (this.phase !== 'lobby' && !Object.keys(this.players).length) {
            return this.abortToLobby();
        }
        this.refresh();
    }

    // ---- flow ----

    startGame(pid) {
        if (this.phase !== 'lobby' || !this.players[pid]) {
            return;
        }
        this.phase = 'playing';
        this.roundStart = this._t;
        this.combo = 0;
        this.bestCombo = 0;
        this.totalBops = 0;
        this.floorPops = 0;
        Object.values(this.players).forEach(p => {
            p.bops = 0;
        });
        this.balloons = [];
        this.pops = [];
        this.fieldLayer.clearChildren();
        this.fxLayer.clearChildren();
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
        this.balloons = [];
        this.pops = [];
        this.fieldLayer.clearChildren();
        this.fxLayer.clearChildren();
        this.refresh();
    }

    endRound() {
        this.phase = 'results';
        this.balloons = [];
        this.pops = [];
        this.fieldLayer.clearChildren();
        this.fxLayer.clearChildren();
        this.refresh();
    }

    // ---- balloons ----

    spawnBalloon() {
        const b = {
            x: 15 + Math.random() * 70,
            y: HUD_H + BALLOON_R + 2,
            vx: (Math.random() - 0.5) * 0.2,
            vy: 0,
            color: BALLOON_COLORS[this.balloons.length % BALLOON_COLORS.length],
            dead: false,
            respawnAt: 0,
            node: null
        };
        b.node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(b.x, b.y, BALLOON_R),
            fill: b.color,
            onClick: (playerId, x, y) => this.bop(Number(playerId), b, x, y)
        });
        this.fieldLayer.addChild(b.node);
        this.balloons.push(b);
    }

    bop(pid, b, x, y) {
        if (this.phase !== 'playing' || b.dead || !this.players[pid]) {
            return;
        }
        b.vy = -0.62 - Math.random() * 0.15;
        b.vx += Math.max(-0.5, Math.min(0.5, (b.x - x) * 0.12));
        b.node.node.effects = glow(b.color, 16);
        b.glowUntil = this._t + 4;
        this.combo++;
        this.totalBops++;
        this.players[pid].bops++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.dirty = true;
    }

    popBalloon(b) {
        b.dead = true;
        b.respawnAt = this._t + 25;
        b.node.node.playerIds = [0];
        this.combo = 0;
        this.floorPops++;
        const fx = this.text('POP!', b.x, FLOOR_Y - 6, 2.4, ACCENT, 'center');
        this.fxLayer.addChild(fx);
        this.pops.push({ node: fx, until: this._t + 10 });
        this.dirty = true;
    }

    // ---- game loop ----

    tick() {
        this._t++;
        if (this.phase === 'playing') {
            const elapsed = this._t - this.roundStart;
            SPAWN_AT.forEach((at, i) => {
                if (elapsed >= at && this.balloons.length === i) {
                    this.spawnBalloon();
                }
            });

            this.balloons.forEach(b => {
                if (b.dead) {
                    if (this._t >= b.respawnAt) {
                        b.dead = false;
                        b.x = 15 + Math.random() * 70;
                        b.y = HUD_H + BALLOON_R + 2;
                        b.vx = (Math.random() - 0.5) * 0.2;
                        b.vy = 0;
                        b.node.node.playerIds = [];
                    } else {
                        return;
                    }
                }
                b.vy = Math.min(0.3, b.vy + 0.014);
                b.vx *= 0.995;
                b.x += b.vx;
                b.y += b.vy;
                if (b.x < BALLOON_R) {
                    b.x = BALLOON_R;
                    b.vx = Math.abs(b.vx) * 0.8;
                }
                if (b.x > 100 - BALLOON_R) {
                    b.x = 100 - BALLOON_R;
                    b.vx = -Math.abs(b.vx) * 0.8;
                }
                if (b.y < HUD_H + BALLOON_R) {
                    b.y = HUD_H + BALLOON_R;
                    b.vy = Math.abs(b.vy) * 0.5;
                }
                if (b.y > FLOOR_Y - BALLOON_R && !b.dead) {
                    return this.popBalloon(b);
                }
                if (b.glowUntil && this._t >= b.glowUntil) {
                    b.node.node.effects = null;
                    b.glowUntil = null;
                }
                b.node.node.coordinates2d = polyCircle(b.x, b.y, BALLOON_R);
            });
            this.dirty = true;

            this.setText(this.comboLabel, `STREAK ${this.combo}`);
            this.setText(this.bestLabel, `BEST ${this.bestCombo}`);
            const sec = Math.max(0, Math.ceil((ROUND_TICKS - elapsed) / TICK_RATE));
            this.setText(this.timerNode, String(sec));

            if (elapsed >= ROUND_TICKS) {
                this.endRound();
            }
        }
        this.pops = this.pops.filter(p => {
            if (this._t >= p.until) {
                this.fxLayer.removeChild(p.node.node.id);
                return false;
            }
            return true;
        });
        if (this.dirty) {
            this.dirty = false;
            this.base.node.onStateChange();
        }
    }

    // ---- views ----

    refresh() {
        if (this.phase !== 'playing') {
            this.setText(this.comboLabel, '');
            this.setText(this.bestLabel, '');
            this.setText(this.timerNode, '');
        }
        this.rebuildCenter();
        Object.keys(this.players).forEach(pid => this.rebuildPlayerRoot(Number(pid)));
        this.base.node.onStateChange();
    }

    rebuildCenter() {
        this.centerLayer.clearChildren();
        if (this.phase === 'lobby') {
            const s = this.centerLayer;
            s.addChild(this.text('BREAK ROOM KEEP-UP', 50.3, 16.3, 3.6, [0, 0, 0, 110], 'center'));
            s.addChild(this.text('BREAK ROOM KEEP-UP', 50, 16, 3.6, INK, 'center'));
            s.addChild(this.text('TAP BALLOONS. KEEP THEM OFF THE FLOOR.', 50, 26, 1.4, INK, 'center'));
            s.addChild(this.text('THE STREAK BELONGS TO EVERYONE. SO DOES THE FLOOR.', 50, 30, 1.15, FAINT, 'center'));
            const ids = Object.keys(this.players).map(Number);
            s.addChild(this.text(`PLAYERS (${ids.length}/${MAX_PLAYERS})`, 38, 40, 1.2, FAINT));
            ids.forEach((pid, i) => {
                s.addChild(this.text(this.players[pid].name, 38, 44.5 + i * 4.3, 1.35, INK));
            });
            if (ids.length >= 1) {
                s.addChild(this.makeButton({
                    x: 40, y: 82, w: 20, h: 8, label: 'START', size: 1.7, fill: ACCENT,
                    onClick: (playerId) => this.startGame(Number(playerId))
                }));
            }
        } else if (this.phase === 'results') {
            const s = this.centerLayer;
            s.addChild(this.rect(20, 14, 60, 74, CARD, { border: 4, color: INK }));
            s.addChild(this.text('TIME!', 50, 18, 2.8, ACCENT, 'center'));
            s.addChild(this.text(`BEST STREAK  ${this.bestCombo}`, 50, 27, 2, INK, 'center'));
            s.addChild(this.text(`TOTAL BOPS   ${this.totalBops}`, 50, 33, 1.6, INK, 'center'));
            s.addChild(this.text(`FLOOR HITS   ${this.floorPops}`, 50, 38, 1.6, FAINT, 'center'));
            const ids = Object.keys(this.players).map(Number)
                .sort((a, b) => this.players[b].bops - this.players[a].bops);
            ids.forEach((pid, i) => {
                const p = this.players[pid];
                s.addChild(this.text(
                    `${i === 0 && p.bops > 0 ? 'MVP ' : ''}${p.name}  ${p.bops}`,
                    50, 46 + i * 4, 1.35, i === 0 && p.bops > 0 ? GOOD : INK, 'center'
                ));
            });
            s.addChild(this.makeButton({
                x: 37, y: 78, w: 26, h: 7.5, label: 'PLAY AGAIN', size: 1.5, fill: ACCENT,
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
            p.root.addChild(this.text('< YOU', 60, 44.5 + ids.indexOf(pid) * 4.3, 1.2, ACCENT));
        }
    }
}

module.exports = KeepUp;
