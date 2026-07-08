const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

const TICK_RATE = 15;
const MAX_PLAYERS = 8;

// Pastoral palette
const FIELD = [116, 176, 98, 255];
const HUD_BG = [66, 110, 60, 255];
const CREAM = [248, 244, 230, 255];
const FAINT = [190, 210, 180, 255];
const CARD = [244, 238, 220, 255];
const INK = [55, 70, 50, 255];
const ACCENT = [235, 150, 50, 255];
const WOOD = [140, 100, 60, 255];
const PEN_GRASS = [148, 198, 120, 255];
const POND_BLUE = [80, 140, 200, 255];
const FLUFF = [246, 243, 232, 255];
const FLUFF_PENNED = [250, 238, 190, 255];
const SHEEP_HEAD = [72, 62, 52, 255];
const GOAT_BODY = [186, 180, 168, 255];
const GOAT_HEAD = [60, 55, 50, 255];

const DOG_COLORS = [
    { name: 'ORANGE', color: [245, 130, 40, 255] },
    { name: 'BLUE', color: [50, 90, 220, 255] },
    { name: 'RED', color: [220, 60, 50, 255] },
    { name: 'PURPLE', color: [140, 80, 200, 255] },
    { name: 'TEAL', color: [40, 170, 170, 255] },
    { name: 'PINK', color: [235, 100, 160, 255] },
    { name: 'YELLOW', color: [235, 200, 50, 255] },
    { name: 'CHARCOAL', color: [50, 50, 55, 255] }
];

// Field geometry (1:1 plane so distances and angles are true)
const FIELD_TOP = 8;
const PEN_WALLS = [
    { x: 70, y: 12, w: 26, h: 1.2 },     // top
    { x: 94.8, y: 12, w: 1.2, h: 22 },   // right
    { x: 70, y: 32.8, w: 26, h: 1.2 },   // bottom
    { x: 70, y: 12, w: 1.2, h: 7 },      // left, above the gate
    { x: 70, y: 27, w: 1.2, h: 7 }       // left, below the gate
];
const PEN_INNER = { x1: 71.4, y1: 13.4, x2: 94.6, y2: 32.6 };
const POND = { x: 32, y: 62, r: 11 };

// Flocking
const SHEEP_RADIUS = 1.1;
const DOG_RADIUS = 1.3;
const SEP_R = 2.8;
const COH_R = 9;
const FLEE_R = 13;
const SHEEP_SPEED = 0.22;
const PANIC_SPEED = 0.52;
const DOG_SPEED = 0.85;
const GOAT_BONUS = 5;

const ROUNDS = [
    { sheep: 12, seconds: 75, pond: false, goat: false, label: 'A GENTLE START' },
    { sheep: 20, seconds: 90, pond: true, goat: false, label: 'MIND THE POND' },
    { sheep: 25, seconds: 105, pond: true, goat: true, label: 'THERE IS A GOAT' }
];

const INTRO_TICKS = 45;
const ROUND_END_TICKS = 75;

const polyCircle = (cx, cy, r, sides = 18) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

class SheepDrive extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Sheep Drive',
            author: 'Joseph Garcia',
            description: 'Co-op herding. Everyone is a sheepdog - drive the flock into the pen before the bell. The sheep have their own ideas.',
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
        this.roundIdx = 0;
        this.sheep = [];
        this.roundResults = [];
        this.deadline = 0;
        this.phaseAt = 0;
        this.lastRoundEnd = null;

        this.base = this.rect(0, 0, 100, 100, FIELD);

        this.roundLabel = this.text('', 1.5, 2.2, 1.4, CREAM);
        this.pennedLabel = this.text('', 50, 2.2, 1.6, CREAM, 'center');
        this.timerNode = this.text('', 93, 1.6, 3, CREAM, 'center');

        this.fieldLayer = this.container();
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, FIELD_TOP, 100, 100 - FIELD_TOP),
            fill: [0, 0, 0, 0],
            onClick: (playerId, x, y) => this.handleTap(Number(playerId), x, y)
        });
        this.centerLayer = this.container();
        this.playerLayer = this.container();

        this.base.addChildren(
            this.rect(0, 0, 100, FIELD_TOP, HUD_BG),
            this.roundLabel, this.pennedLabel, this.timerNode,
            this.fieldLayer, this.tapCatcher, this.centerLayer, this.playerLayer
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
        const name = ((info && info.name) || `DOG ${pid}`).toUpperCase().slice(0, 10);
        const style = DOG_COLORS[this.joinCount % DOG_COLORS.length];
        this.joinCount++;
        const root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [pid]
        });
        this.players[pid] = {
            name, style, root,
            x: 20 + (this.joinCount % 8) * 8, y: 90,
            tx: 20 + (this.joinCount % 8) * 8, ty: 90,
            node: null, labelNode: null
        };
        this.playerLayer.addChild(root);
        if (this.phase === 'herding' || this.phase === 'intro') {
            this.spawnDogNodes(this.players[pid]);
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
        if (p.node) {
            this.fieldLayer.removeChild(p.node.node.id);
            this.fieldLayer.removeChild(p.labelNode.node.id);
        }
        delete this.players[pid];
        if (this.phase !== 'lobby' && !Object.keys(this.players).length) {
            return this.abortToLobby();
        }
        this.refresh();
    }

    // ---- game flow ----

    startGame(pid) {
        if (this.phase !== 'lobby' || !this.players[pid]) {
            return;
        }
        this.roundIdx = 0;
        this.roundResults = [];
        this.startRound();
    }

    startRound() {
        const spec = ROUNDS[this.roundIdx];
        this.phase = 'intro';
        this.phaseAt = this._t + INTRO_TICKS;
        this.sheep = [];
        this.fieldLayer.clearChildren();

        if (spec.pond) {
            this.fieldLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(POND.x, POND.y, POND.r),
                fill: POND_BLUE
            }));
        }
        this.fieldLayer.addChild(this.rect(70, 12, 26, 22, PEN_GRASS));
        PEN_WALLS.forEach(w => this.fieldLayer.addChild(this.rect(w.x, w.y, w.w, w.h, WOOD)));

        for (let i = 0; i < spec.sheep; i++) {
            this.sheep.push(this.makeSheep(false));
        }
        if (spec.goat) {
            this.sheep.push(this.makeSheep(true));
        }
        this.sheep.forEach(s => {
            s.bodyNode = this.rect(s.x - SHEEP_RADIUS, s.y - SHEEP_RADIUS, SHEEP_RADIUS * 2, SHEEP_RADIUS * 2, s.isGoat ? GOAT_BODY : FLUFF);
            s.headNode = this.rect(s.x, s.y, 1.1, 1.1, s.isGoat ? GOAT_HEAD : SHEEP_HEAD);
            this.fieldLayer.addChildren(s.bodyNode, s.headNode);
        });

        Object.values(this.players).forEach((p, i) => {
            p.x = 15 + i * 9;
            p.y = 90;
            p.tx = p.x;
            p.ty = p.y;
            this.spawnDogNodes(p);
        });

        this.deadline = this._t + INTRO_TICKS + spec.seconds * TICK_RATE;
        this.refresh();
    }

    makeSheep(isGoat) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 9;
        return {
            x: 30 + Math.cos(a) * d,
            y: 42 + Math.sin(a) * d,
            vx: 0, vy: 0,
            hx: 1, hy: 0,
            penned: false,
            isGoat,
            bodyNode: null, headNode: null
        };
    }

    spawnDogNodes(p) {
        p.node = this.rect(p.x - DOG_RADIUS, p.y - DOG_RADIUS, DOG_RADIUS * 2, DOG_RADIUS * 2, p.style.color, {
            border: 3, color: INK
        });
        p.labelNode = this.text(p.name, p.x, p.y - 3.2, 0.9, INK, 'center');
        this.fieldLayer.addChildren(p.node, p.labelNode);
    }

    endRound(reason) {
        const spec = ROUNDS[this.roundIdx];
        const penned = this.sheep.filter(s => s.penned && !s.isGoat).length;
        const goatPenned = this.sheep.some(s => s.penned && s.isGoat);
        const score = penned + (goatPenned ? GOAT_BONUS : 0);
        this.roundResults.push({ penned, total: spec.sheep, goatPenned, score });
        this.lastRoundEnd = { reason, penned, total: spec.sheep, goatPenned };
        this.phase = 'roundend';
        this.phaseAt = this._t + ROUND_END_TICKS;
        this.refresh();
    }

    nextRound() {
        this.roundIdx++;
        if (this.roundIdx >= ROUNDS.length) {
            this.phase = 'final';
            this.fieldLayer.clearChildren();
            this.sheep = [];
            Object.values(this.players).forEach(p => {
                p.node = null;
                p.labelNode = null;
            });
            this.refresh();
        } else {
            this.startRound();
        }
    }

    playAgain(pid) {
        if (this.phase !== 'final' || !this.players[pid]) {
            return;
        }
        this.abortToLobby();
    }

    abortToLobby() {
        this.phase = 'lobby';
        this.sheep = [];
        this.fieldLayer.clearChildren();
        Object.values(this.players).forEach(p => {
            p.node = null;
            p.labelNode = null;
        });
        this.refresh();
    }

    // ---- input ----

    handleTap(pid, x, y) {
        const p = this.players[pid];
        if (!p || this.phase !== 'herding') {
            return;
        }
        p.tx = Math.max(1.5, Math.min(98.5, x));
        p.ty = Math.max(FIELD_TOP + 2, Math.min(98.5, y));
    }

    // ---- simulation ----

    collideWalls(e, rad) {
        PEN_WALLS.forEach(r => {
            const cx = Math.max(r.x, Math.min(r.x + r.w, e.x));
            const cy = Math.max(r.y, Math.min(r.y + r.h, e.y));
            const dx = e.x - cx;
            const dy = e.y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 >= rad * rad) {
                return;
            }
            if (d2 < 0.0001) {
                // Center inside the wall: pop out the nearest side
                const dists = [e.x - r.x, r.x + r.w - e.x, e.y - r.y, r.y + r.h - e.y];
                const m = Math.min(...dists);
                if (m === dists[0]) e.x = r.x - rad;
                else if (m === dists[1]) e.x = r.x + r.w + rad;
                else if (m === dists[2]) e.y = r.y - rad;
                else e.y = r.y + r.h + rad;
            } else {
                const d = Math.sqrt(d2);
                e.x = cx + (dx / d) * rad;
                e.y = cy + (dy / d) * rad;
            }
        });
    }

    collidePond(e, rad) {
        if (!ROUNDS[this.roundIdx].pond) {
            return;
        }
        const dx = e.x - POND.x;
        const dy = e.y - POND.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const min = POND.r + rad;
        if (d < min) {
            e.x = POND.x + (dx / d) * min;
            e.y = POND.y + (dy / d) * min;
        }
    }

    clampField(e, rad) {
        e.x = Math.max(rad, Math.min(100 - rad, e.x));
        e.y = Math.max(FIELD_TOP + rad, Math.min(100 - rad, e.y));
    }

    updateDog(p) {
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.4) {
            const step = Math.min(DOG_SPEED, d);
            p.x += (dx / d) * step;
            p.y += (dy / d) * step;
        }
        this.collideWalls(p, DOG_RADIUS);
        this.collidePond(p, DOG_RADIUS);
        this.clampField(p, DOG_RADIUS);
    }

    updateSheep(s, dogs) {
        if (s.penned) {
            return;
        }
        let ax = 0;
        let ay = 0;
        let panic = 0;

        let cohX = 0, cohY = 0, aliX = 0, aliY = 0, n = 0;
        this.sheep.forEach(o => {
            if (o === s || o.penned) {
                return;
            }
            const dx = o.x - s.x;
            const dy = o.y - s.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 0.001) {
                return;
            }
            if (d < SEP_R) {
                const f = (SEP_R - d) / SEP_R;
                ax -= (dx / d) * f * 0.09;
                ay -= (dy / d) * f * 0.09;
            } else if (d < COH_R) {
                cohX += o.x;
                cohY += o.y;
                aliX += o.vx;
                aliY += o.vy;
                n++;
            }
        });
        if (n && !s.isGoat) {
            ax += (cohX / n - s.x) * 0.0045;
            ay += (cohY / n - s.y) * 0.0045;
            ax += (aliX / n - s.vx) * 0.05;
            ay += (aliY / n - s.vy) * 0.05;
        }

        const fleeR = s.isGoat ? 9 : FLEE_R;
        dogs.forEach(dog => {
            const dx = s.x - dog.x;
            const dy = s.y - dog.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 0.001 || d >= fleeR) {
                return;
            }
            const f = (fleeR - d) / fleeR;
            ax += (dx / d) * f * 0.17;
            ay += (dy / d) * f * 0.17;
            panic = Math.max(panic, f);
        });

        // Soft walls
        if (s.x < 4) ax += (4 - s.x) * 0.03;
        if (s.x > 96) ax -= (s.x - 96) * 0.03;
        if (s.y < FIELD_TOP + 4) ay += (FIELD_TOP + 4 - s.y) * 0.03;
        if (s.y > 96) ay -= (s.y - 96) * 0.03;

        const jitter = s.isGoat ? 0.05 : 0.018;
        ax += (Math.random() - 0.5) * jitter;
        ay += (Math.random() - 0.5) * jitter;

        s.vx = (s.vx + ax) * 0.9;
        s.vy = (s.vy + ay) * 0.9;
        const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        const maxSpeed = (s.isGoat ? 1.15 : 1) * (SHEEP_SPEED + panic * (PANIC_SPEED - SHEEP_SPEED));
        if (speed > maxSpeed) {
            s.vx = (s.vx / speed) * maxSpeed;
            s.vy = (s.vy / speed) * maxSpeed;
        }
        s.x += s.vx;
        s.y += s.vy;
        if (speed > 0.03) {
            s.hx = s.vx / speed;
            s.hy = s.vy / speed;
        }

        this.collideWalls(s, SHEEP_RADIUS);
        this.collidePond(s, SHEEP_RADIUS);
        this.clampField(s, SHEEP_RADIUS);

        if (s.x > PEN_INNER.x1 && s.x < PEN_INNER.x2 && s.y > PEN_INNER.y1 && s.y < PEN_INNER.y2) {
            s.penned = true;
            s.vx = 0;
            s.vy = 0;
            if (s.bodyNode) {
                s.bodyNode.node.fill = s.isGoat ? GOAT_BODY : FLUFF_PENNED;
            }
        }
    }

    pennedScore() {
        const penned = this.sheep.filter(s => s.penned && !s.isGoat).length;
        const goat = this.sheep.some(s => s.penned && s.isGoat);
        return penned + (goat ? GOAT_BONUS : 0);
    }

    // ---- game loop ----

    tick() {
        this._t++;
        if (this.phase === 'intro' && this._t >= this.phaseAt) {
            this.phase = 'herding';
            this.refresh();
        }
        if (this.phase === 'herding') {
            const dogs = Object.values(this.players);
            dogs.forEach(p => this.updateDog(p));
            this.sheep.forEach(s => this.updateSheep(s, dogs));

            this.sheep.forEach(s => {
                if (!s.bodyNode) {
                    return;
                }
                s.bodyNode.node.coordinates2d = ShapeUtils.rectangle(s.x - SHEEP_RADIUS, s.y - SHEEP_RADIUS, SHEEP_RADIUS * 2, SHEEP_RADIUS * 2);
                s.headNode.node.coordinates2d = ShapeUtils.rectangle(s.x + s.hx * 1.2 - 0.55, s.y + s.hy * 1.2 - 0.55, 1.1, 1.1);
            });
            dogs.forEach(p => {
                if (!p.node) {
                    return;
                }
                p.node.node.coordinates2d = ShapeUtils.rectangle(p.x - DOG_RADIUS, p.y - DOG_RADIUS, DOG_RADIUS * 2, DOG_RADIUS * 2);
                p.labelNode.node.text = { ...p.labelNode.node.text, x: p.x, y: p.y - 3.2 };
            });
            this.dirty = true;

            const total = this.sheep.length;
            const pennedAll = this.sheep.filter(s => s.penned).length;
            this.setText(this.pennedLabel, `PENNED ${pennedAll}/${total}`);
            const sec = Math.max(0, Math.ceil((this.deadline - this._t) / TICK_RATE));
            this.setText(this.timerNode, String(sec));

            if (pennedAll === total) {
                this.endRound('ALL SHEEP ACCOUNTED FOR');
            } else if (this._t >= this.deadline) {
                this.endRound('THE BELL RANG');
            }
        }
        if (this.phase === 'roundend' && this._t >= this.phaseAt) {
            this.nextRound();
        }
        if (this.dirty) {
            this.dirty = false;
            this.base.node.onStateChange();
        }
    }

    // ---- views ----

    refresh() {
        const inGame = this.phase !== 'lobby' && this.phase !== 'final';
        this.setText(this.roundLabel, inGame ? `ROUND ${this.roundIdx + 1}/${ROUNDS.length}` : '');
        if (!inGame) {
            this.setText(this.pennedLabel, '');
            this.setText(this.timerNode, '');
        }
        this.rebuildCenter();
        Object.keys(this.players).forEach(pid => this.rebuildPlayerRoot(Number(pid)));
        this.base.node.onStateChange();
    }

    rebuildCenter() {
        this.centerLayer.clearChildren();
        if (this.phase === 'lobby') {
            this.buildLobbyCenter();
        } else if (this.phase === 'intro') {
            const spec = ROUNDS[this.roundIdx];
            this.centerLayer.addChild(this.rect(18, 36, 64, 24, CARD, { border: 4, color: INK }));
            this.centerLayer.addChild(this.text(`ROUND ${this.roundIdx + 1} - ${spec.label}`, 50, 40, 2.2, INK, 'center'));
            this.centerLayer.addChild(this.text(`${spec.sheep} SHEEP${spec.goat ? ' AND ONE GOAT' : ''}`, 50, 46, 1.6, ACCENT, 'center'));
            this.centerLayer.addChild(this.text('HOLD ANYWHERE TO RUN THERE.', 50, 51, 1.2, INK, 'center'));
            this.centerLayer.addChild(this.text('SHEEP FLEE FROM DOGS - PUSH THEM TO THE PEN.', 50, 54.5, 1.2, INK, 'center'));
        } else if (this.phase === 'roundend' && this.lastRoundEnd) {
            const r = this.lastRoundEnd;
            this.centerLayer.addChild(this.rect(20, 36, 60, 22, CARD, { border: 4, color: ACCENT }));
            this.centerLayer.addChild(this.text(r.reason, 50, 40, 1.9, INK, 'center'));
            this.centerLayer.addChild(this.text(`PENNED ${r.penned}/${r.total}`, 50, 46, 2.4, ACCENT, 'center'));
            if (r.goatPenned) {
                this.centerLayer.addChild(this.text(`GOAT BONUS +${GOAT_BONUS}`, 50, 52, 1.4, INK, 'center'));
            }
        } else if (this.phase === 'final') {
            this.buildFinalCenter();
        }
    }

    buildLobbyCenter() {
        const s = this.centerLayer;
        s.addChild(this.text('SHEEP DRIVE', 50.4, 14.4, 5, [0, 0, 0, 110], 'center'));
        s.addChild(this.text('SHEEP DRIVE', 50, 14, 5, CREAM, 'center'));
        s.addChild(this.text('EVERYONE IS A SHEEPDOG. HERD THE FLOCK INTO THE PEN.', 50, 26, 1.3, CREAM, 'center'));
        s.addChild(this.text('NO LOSING. JUST SHEEP, AND YOUR COLLECTIVE FAILURE TO ORGANIZE THEM.', 50, 30, 1.1, FAINT, 'center'));
        const ids = Object.keys(this.players).map(Number);
        s.addChild(this.text(`DOGS (${ids.length}/${MAX_PLAYERS})`, 38, 40, 1.2, FAINT));
        ids.forEach((pid, i) => {
            const p = this.players[pid];
            s.addChild(this.rect(38, 44 + i * 4.3, 2.2, 2.2, p.style.color, { border: 2, color: INK }));
            s.addChild(this.text(p.name, 42, 44 + i * 4.3, 1.35, CREAM));
        });
        if (ids.length >= 1) {
            s.addChild(this.makeButton({
                x: 40, y: 82, w: 20, h: 8, label: 'START', size: 1.7, fill: ACCENT,
                onClick: (playerId) => this.startGame(Number(playerId))
            }));
        }
    }

    buildFinalCenter() {
        const s = this.centerLayer;
        const total = this.roundResults.reduce((sum, r) => sum + r.score, 0);
        const sheepTotal = this.roundResults.reduce((sum, r) => sum + r.total, 0);
        const sheepPenned = this.roundResults.reduce((sum, r) => sum + r.penned, 0);
        const pct = sheepTotal ? sheepPenned / sheepTotal : 0;
        const title = pct >= 1 ? 'LEGENDARY FLOCKMASTERS'
            : pct >= 0.8 ? 'CERTIFIED SHEPHERDS'
                : pct >= 0.5 ? 'DECENT DOGS'
                    : 'THE SHEEP WON';
        s.addChild(this.text('FLOCK REPORT', 50, 16, 3, CREAM, 'center'));
        this.roundResults.forEach((r, i) => {
            s.addChild(this.text(
                `ROUND ${i + 1}: ${r.penned}/${r.total}${r.goatPenned ? ` +GOAT` : ''}`,
                50, 28 + i * 5, 1.6, CREAM, 'center'
            ));
        });
        s.addChild(this.text(`TEAM SCORE ${total}`, 50, 47, 2.2, ACCENT, 'center'));
        s.addChild(this.text(title, 50, 54, 1.8, CREAM, 'center'));
        s.addChild(this.makeButton({
            x: 37, y: 80, w: 26, h: 8, label: 'PLAY AGAIN', size: 1.6, fill: ACCENT,
            onClick: (playerId) => this.playAgain(Number(playerId))
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
            p.root.addChild(this.text('< YOU', 62, 44 + ids.indexOf(pid) * 4.3, 1.2, ACCENT));
        } else if (this.phase === 'intro' || this.phase === 'herding' || this.phase === 'roundend') {
            p.root.addChild(this.text(`YOU ARE THE ${p.style.name} DOG`, 50, 97, 1.2, p.style.color, 'center'));
        }
    }
}

module.exports = SheepDrive;
