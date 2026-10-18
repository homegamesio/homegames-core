const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');

const COLORS = Colors.COLORS;

// BILLIARDS — 8-ball with precise, substepped physics.
//
// Drag anywhere on the table to aim (a guide shows the cue path AND the object
// ball's projected departure line — cut shots work exactly like real pool:
// the object ball leaves along the line of centers). Release to shoot.
//
// Rules: groups (solids/stripes) assigned on the first pot after the break,
// pot your group then the 8 to win, potting the 8 early loses, scratching
// respots the cue and passes the turn. Turn continues while you pot your own.
//
// Multiplayer: first two players get the seats. Single player: a PLAY THE BOT
// button seats a bot opponent that picks real ghost-ball shots but aims with
// human-ish error (worse on thin cuts and long shots) — good, not unbeatable.
//
// Physics notes (the "spot on" parts):
//  - fixed substeps: no ball ever moves more than ~1/4 radius per step, so
//    fast breaks never tunnel through balls or pockets
//  - equal-mass elastic collisions via normal impulse: head-on = stop shot,
//    cuts split energy by angle, exactly like the real thing
//  - constant rolling deceleration (real felt), not exponential decay
//  - pockets are gaps in the cushions: balls hugging a rail roll PAST side
//    pockets, but drop when actually aimed into a mouth

const TICK_RATE = 60;
const DT = 1 / TICK_RATE;

// Table geometry (16:9 world, 2:1 table)
const TABLE = { left: 15, right: 85, top: 30, bottom: 65 };
const CX = (TABLE.left + TABLE.right) / 2;
const CY = (TABLE.top + TABLE.bottom) / 2;

const BALL_R = 1.4;
const DECEL = 42;              // rolling deceleration, units/sec^2
const STOP_SPEED = 1.2;
const CUSHION_BOUNCE = 0.72;
const BALL_BOUNCE = 0.96;
const MAX_SHOT_SPEED = 140;
const MIN_PULL = 2;
const POWER_SCALE = 4.5;       // pull units -> launch speed
const SUBSTEP_MOVE = BALL_R / 4;

// Pocket mouths: gaps in the cushions
const CORNER_MOUTH = 3.2;      // rail gap length at each corner
const SIDE_MOUTH = 2.8;        // half-width of the side-pocket gap
const CORNER_CAPTURE = 3.1;
// Side capture must be < BALL_R + side-pocket offset (2.6) so a ball rolling
// along the cushion passes the mouth; only balls actually entering it drop.
const SIDE_CAPTURE = 2.3;
const GUTTER = 2.5;            // past the rail by this much = it's in

const POCKETS = [
    { x: TABLE.left - 0.9, y: TABLE.top - 0.9, r: CORNER_CAPTURE },
    { x: TABLE.right + 0.9, y: TABLE.top - 0.9, r: CORNER_CAPTURE },
    { x: TABLE.left - 0.9, y: TABLE.bottom + 0.9, r: CORNER_CAPTURE },
    { x: TABLE.right + 0.9, y: TABLE.bottom + 0.9, r: CORNER_CAPTURE },
    { x: CX, y: TABLE.top - 1.2, r: SIDE_CAPTURE },
    { x: CX, y: TABLE.bottom + 1.2, r: SIDE_CAPTURE },
];

const FELT = [24, 110, 60, 255];
const RAIL = [92, 56, 30, 255];
const HUD_COLOR = [220, 228, 240, 255];
const DIM = [150, 165, 200, 255];

const BALL_BASE = {
    1: [255, 205, 0, 255], 2: [30, 80, 255, 255], 3: [230, 40, 40, 255],
    4: [130, 60, 200, 255], 5: [255, 130, 0, 255], 6: [30, 160, 70, 255],
    7: [150, 40, 60, 255],
};
const EIGHT_COLOR = [22, 22, 26, 255];
const CUE_COLOR = [245, 245, 238, 255];

const BOT_THINK_TICKS = Math.round(1.3 * TICK_RATE);

// --- impact feel ---
// impact speeds (relative normal velocity, units/sec) that trigger feedback
const IMPACT_SOFT = 14;        // ball flash only
const IMPACT_MED = 42;         // + sparks and a contact ring
const IMPACT_HARD = 85;        // + bigger ring and a table jolt
const BALL_FLASH_TICKS = 7;    // white flash + size pop on contact
const RING_TICKS = Math.round(0.3 * TICK_RATE);
const SPARK_TICKS = Math.round(0.35 * TICK_RATE);
const SINK_TICKS = Math.round(0.22 * TICK_RATE);   // pocket drop animation
const JOLT_TICKS = 6;
const MAX_FX_PER_TICK = 8;     // break shots spawn a lot of contacts at once
const TRAIL_MIN_SPEED = 30;    // motion streaks appear above this

const ngon = (x, y, r, n = 10) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    return pts;
};

const linePoly = (ax, ay, bx, by, thickness) => {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * thickness / 2;
    const py = (dx / len) * thickness / 2;
    return [[ax + px, ay + py], [bx + px, by + py], [bx - px, by - py], [ax - px, ay - py], [ax + px, ay + py]];
};

const ZERO_COORDS = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];

// approx gaussian in [-1.5, 1.5]
const gauss = () => (Math.random() + Math.random() + Math.random()) - 1.5;

class Billiards extends Game {
    static metadata() {
        return {
            thumbnail: './assets/thumbnail.png',
            name: 'Billiards',
            author: "Joseph Garcia",
            description: '8-ball with precise physics: real cut shots, cushion mouths, ghost-ball aim guide. Play a friend or a beatable bot.',
            aspectRatio: { x: 16, y: 9 },
            assets: {
                'pointer-grab': new Asset({ path: './assets/cursor-grab.png', type: 'image' }),
                'pointer-hold': new Asset({ path: './assets/cursor-hold.png', type: 'image' })
            },
            tickRate: TICK_RATE,
            gameId: "aafd99a8-76fe-5a19-a9b6-3f876f387908",
            maxPlayers: 2
        };
    }

    constructor(options = {}) {
        super();
        this.setCursor = options.setCursor;

        this.balls = [];               // {id, x, y, vx, vy, alive, stripe, node, markerNode}
        this.seats = [null, null];     // {kind: 'human'|'bot', pid?, name}
        this.humanSeats = {};          // pid -> seat index
        this.state = 'lobby';          // lobby | aim | rolling | over
        this.currentSeat = 0;
        this.groups = [null, null];    // 'solid' | 'stripe'
        this.breakShot = true;
        this.shotPotted = [];
        this.scratched = false;
        this.aiming = null;            // {pid, x, y} while dragging
        this.botTimer = 0;
        this.joinCounter = 0;

        // impact-feel state
        this.fx = [];                  // live tweens: {life, ttl, node, step(t), done()}
        this.fxThisTick = 0;
        this.joltTicks = 0;
        this.joltMag = 0;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [16, 20, 30, 255]
        });

        this.rail = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(TABLE.left - 3, TABLE.top - 4.8, (TABLE.right - TABLE.left) + 6, (TABLE.bottom - TABLE.top) + 9.6),
            fill: RAIL
        });

        this.felt = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(TABLE.left - 1.6, TABLE.top - 2.6, (TABLE.right - TABLE.left) + 3.2, (TABLE.bottom - TABLE.top) + 5.2),
            fill: FELT
        });

        this.pocketLayer = this.container();
        this.pocketNodes = [];
        for (const p of POCKETS) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ngon(p.x, p.y, 2.2, 10),
                fill: [8, 8, 10, 255]
            });
            this.pocketNodes.push(node);
            this.pocketLayer.addChild(node);
        }

        this.aimGuide = this.thinLine([255, 255, 255, 110]);     // cue path
        this.objectGuide = this.thinLine([255, 255, 255, 170]);  // object ball departure
        this.powerLine = this.thinLine([255, 255, 255, 150]);    // pull indicator

        this.trailLayer = this.container();   // motion streaks, under the balls
        this.fxLayer = this.container();      // rings, sparks
        this.ballLayer = this.container();
        this.grabPad = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ZERO_COORDS,
            fill: [0, 0, 0, 0],
            onHover: pid => this.pointerCursor(pid, this.canShoot(Number(pid)) ? 'grab' : null),
            offHover: pid => { if (!this.aiming) this.pointerCursor(pid, null); },
            onClick: (pid, x, y) => this.startAim(Number(pid), x, y),
            onDrag: (pid, x, y) => this.dragAim(Number(pid), x, y),
            offClick: (pid, x, y) => this.shoot(Number(pid), x, y)
        });

        this.turnText = new GameNode.Text({
            textInfo: { text: '', x: 50, y: 3, size: 2, align: 'center', color: HUD_COLOR }
        });
        this.statusText = new GameNode.Text({
            textInfo: { text: 'waiting for players', x: 50, y: 8, size: 1.4, align: 'center', color: DIM }
        });
        this.helpText = new GameNode.Text({
            textInfo: { text: 'Drag anywhere to aim · Release to shoot', x: 50, y: 93, size: 1.2, align: 'center', color: DIM }
        });

        this.button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ZERO_COORDS,
            fill: [40, 90, 160, 255],
            color: COLORS.WHITE,
            border: 1,
            onClick: (pid) => this.handleButton(Number(pid))
        });
        this.buttonText = new GameNode.Text({
            textInfo: { text: '', x: 50, y: 82.2, size: 1.5, align: 'center', color: COLORS.WHITE }
        });
        this.button.addChild(this.buttonText);
        this.buttonAction = null;

        this.base.addChildren(
            this.rail, this.felt, this.pocketLayer,
            this.aimGuide, this.objectGuide, this.powerLine,
            this.trailLayer, this.fxLayer,
            this.ballLayer, this.grabPad,
            this.turnText, this.statusText, this.helpText,
            this.button
        );
    }

    container() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0), fill: [0, 0, 0, 0]
        });
    }

    thinLine(fill) {
        return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ZERO_COORDS, fill });
    }

    // --- setup ------------------------------------------------------------------

    rackBalls() {
        for (const b of this.balls) {
            this.ballLayer.removeChild(b.node.node.id);
        }
        this.balls = [];
        this.trailLayer.clearChildren();
        this.fxLayer.clearChildren();
        this.fx = [];

        const addBall = (id, x, y) => {
            const stripe = id >= 9 && id <= 15;
            const fill = id === 0 ? CUE_COLOR : id === 8 ? EIGHT_COLOR : BALL_BASE[stripe ? id - 8 : id];
            const ball = { id, x, y, vx: 0, vy: 0, alive: true, stripe, moved: false, flashTicks: 0, baseFill: fill, node: null };

            ball.trailNode = this.thinLine([fill[0], fill[1], fill[2], 0]);
            this.trailLayer.addChild(ball.trailNode);

            ball.node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ngon(x, y, BALL_R, 10),
                fill
            });
            if (stripe) {
                ball.markerNode = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ngon(x, y, BALL_R * 0.5, 6),
                    fill: [255, 255, 255, 255]
                });
                ball.node.addChild(ball.markerNode);
            }
            this.balls.push(ball);
            this.ballLayer.addChild(ball.node);
            return ball;
        };

        // cue at the head spot
        addBall(0, TABLE.left + (TABLE.right - TABLE.left) * 0.25, CY);

        // rack at the foot spot, apex facing the cue. 8 in the middle of row 3.
        const rackOrder = [1, 9, 2, 3, 8, 10, 11, 4, 12, 5, 13, 6, 14, 7, 15];
        const apexX = TABLE.left + (TABLE.right - TABLE.left) * 0.7;
        const dx = BALL_R * 1.74;
        let idx = 0;
        for (let row = 0; row < 5; row++) {
            for (let k = 0; k <= row; k++) {
                const x = apexX + row * dx;
                const y = CY + (k - row / 2) * (BALL_R * 2.02);
                addBall(rackOrder[idx++], x, y);
            }
        }

        this.updateGrabPad();
    }

    cueBall() { return this.balls.find(b => b.id === 0); }

    updateGrabPad() {
        const cue = this.cueBall();
        const coords = (cue && cue.alive && this.state === 'aim')
            ? ShapeUtils.rectangle(3, 15, 94, 74)
            : ZERO_COORDS;
        this.grabPad.update({ coordinates2d: coords });
    }

    // --- impact feel -----------------------------------------------------------

    addFx(ttl, node, step) {
        this.fxLayer.addChild(node);
        this.fx.push({ life: ttl, ttl, node, step });
    }

    // Expanding, fading ring at a contact point. Size/brightness scale with impact.
    spawnRing(x, y, size, color, alpha = 220) {
        if (this.fxThisTick >= MAX_FX_PER_TICK) return;
        this.fxThisTick++;
        const node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ngon(x, y, size * 0.4, 8),
            fill: [color[0], color[1], color[2], alpha]
        });
        this.addFx(RING_TICKS, node, (t) => {
            node.update({
                coordinates2d: ngon(x, y, size * (0.4 + t * 1.6), 8),
                fill: [color[0], color[1], color[2], Math.round(alpha * (1 - t))]
            });
        });
    }

    // Tiny shards flying out of a contact, roughly perpendicular to the hit.
    spawnSparks(x, y, nx, ny, impact, color) {
        if (this.fxThisTick >= MAX_FX_PER_TICK) return;
        this.fxThisTick++;
        const count = impact > IMPACT_HARD ? 5 : 3;
        for (let i = 0; i < count; i++) {
            const a = Math.atan2(ny, nx) + Math.PI / 2 + (Math.random() - 0.5) * 2.2;
            const speed = impact * (0.25 + Math.random() * 0.3);
            const vx = Math.cos(a) * speed, vy = Math.sin(a) * speed;
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ngon(x, y, 0.45, 4),
                fill: [color[0], color[1], color[2], 255]
            });
            this.addFx(SPARK_TICKS, node, (t) => {
                node.update({
                    coordinates2d: ngon(x + vx * t * SPARK_TICKS * DT, y + vy * t * SPARK_TICKS * DT, 0.45 * (1 - t * 0.7), 4),
                    fill: [color[0], color[1], color[2], Math.round(255 * (1 - t))]
                });
            });
        }
    }

    // Ball sinks into the pocket: shrinks toward the pocket center and fades.
    spawnSink(ball, pocket) {
        const node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ngon(ball.x, ball.y, BALL_R, 10),
            fill: [ball.baseFill[0], ball.baseFill[1], ball.baseFill[2], 255]
        });
        const bx = ball.x, by = ball.y;
        this.addFx(SINK_TICKS, node, (t) => {
            const x = bx + (pocket.x - bx) * t;
            const y = by + (pocket.y - by) * t;
            node.update({
                coordinates2d: ngon(x, y, BALL_R * (1 - t * 0.85), 10),
                fill: [ball.baseFill[0], ball.baseFill[1], ball.baseFill[2], Math.round(255 * (1 - t * 0.6))]
            });
        });
        this.spawnRing(pocket.x, pocket.y, 2.4, [255, 255, 255], 160);
    }

    jolt(mag) {
        this.joltTicks = JOLT_TICKS;
        this.joltMag = Math.max(this.joltMag, mag);
    }

    onBallImpact(a, b, impact, x, y, nx, ny) {
        if (impact < IMPACT_SOFT) return;
        a.flashTicks = Math.max(a.flashTicks, BALL_FLASH_TICKS);
        b.flashTicks = Math.max(b.flashTicks, BALL_FLASH_TICKS);
        if (impact >= IMPACT_MED) {
            this.spawnSparks(x, y, nx, ny, impact, [255, 255, 255]);
            this.spawnRing(x, y, 1 + impact / 60, [255, 255, 255], 200);
        }
        if (impact >= IMPACT_HARD) {
            this.jolt(0.25 + Math.min(0.4, impact / 300));
        }
    }

    onCushionImpact(ball, impact, x, y, nx, ny) {
        if (impact < IMPACT_MED) return;
        ball.flashTicks = Math.max(ball.flashTicks, BALL_FLASH_TICKS - 2);
        this.spawnSparks(x, y, nx, ny, impact * 0.8, [255, 240, 190]);
        this.spawnRing(x, y, 0.8 + impact / 90, [255, 240, 190], 170);
        if (impact >= IMPACT_HARD) this.jolt(0.2);
    }

    stepFx() {
        this.fxThisTick = 0;

        for (const f of [...this.fx]) {
            f.life--;
            if (f.life <= 0) {
                this.fxLayer.removeChild(f.node.node.id);
                this.fx.splice(this.fx.indexOf(f), 1);
                continue;
            }
            f.step(1 - f.life / f.ttl);
        }

        // Table jolt: the backdrop kicks and settles.
        if (this.joltTicks > 0) {
            this.joltTicks--;
            const k = this.joltMag * (this.joltTicks / JOLT_TICKS);
            const dx = (Math.random() - 0.5) * 2 * k;
            const dy = (Math.random() - 0.5) * 2 * k;
            this.rail.update({
                coordinates2d: ShapeUtils.rectangle(TABLE.left - 3 + dx, TABLE.top - 4.8 + dy, (TABLE.right - TABLE.left) + 6, (TABLE.bottom - TABLE.top) + 9.6)
            });
            this.felt.update({
                coordinates2d: ShapeUtils.rectangle(TABLE.left - 1.6 + dx, TABLE.top - 2.6 + dy, (TABLE.right - TABLE.left) + 3.2, (TABLE.bottom - TABLE.top) + 5.2)
            });
            POCKETS.forEach((p, i) => this.pocketNodes[i].update({ coordinates2d: ngon(p.x + dx, p.y + dy, 2.2, 10) }));
            if (this.joltTicks === 0) this.joltMag = 0;
        }
    }

    // Render a ball: flash-white and pop slightly bigger while flashTicks > 0,
    // and stream a motion trail while it's fast.
    renderBall(b) {
        const flash = b.flashTicks / BALL_FLASH_TICKS;
        const r = BALL_R * (1 + flash * 0.22);
        const fill = flash > 0
            ? [
                Math.round(b.baseFill[0] + (255 - b.baseFill[0]) * flash * 0.9),
                Math.round(b.baseFill[1] + (255 - b.baseFill[1]) * flash * 0.9),
                Math.round(b.baseFill[2] + (255 - b.baseFill[2]) * flash * 0.9),
                255]
            : b.baseFill;
        b.node.update({ coordinates2d: ngon(b.x, b.y, r, 10), fill });
        if (b.markerNode) b.markerNode.update({ coordinates2d: ngon(b.x, b.y, BALL_R * 0.5, 6) });

        const speed = Math.hypot(b.vx, b.vy);
        if (speed > TRAIL_MIN_SPEED) {
            const len = Math.min(7, speed * 0.05);
            const a = Math.min(150, (speed - TRAIL_MIN_SPEED) * 1.4);
            b.trailNode.update({
                coordinates2d: linePoly(b.x, b.y, b.x - (b.vx / speed) * len, b.y - (b.vy / speed) * len, BALL_R * 1.3),
                fill: [b.baseFill[0], b.baseFill[1], b.baseFill[2], Math.round(a)]
            });
            b.trailVisible = true;
        } else if (b.trailVisible) {
            b.trailVisible = false;
            b.trailNode.update({ coordinates2d: ZERO_COORDS, fill: [b.baseFill[0], b.baseFill[1], b.baseFill[2], 0] });
        }
    }

    // --- seats / lobby -------------------------------------------------------------

    handleNewPlayer({ playerId, info, clientInfo }) {
        const pid = Number(playerId);
        const name = (info && info.name) || `player ${pid}`;

        if (!this.seats[0]) {
            this.seats[0] = { kind: 'human', pid, name };
            this.humanSeats[pid] = 0;
            this.setStatus(`${name} has the table — waiting for an opponent`);
            this.showButton('PLAY THE BOT', 'bot');
        } else if (!this.seats[1] && this.state === 'lobby') {
            this.seats[1] = { kind: 'human', pid, name };
            this.humanSeats[pid] = 1;
            this.startMatch();
        } else {
            this.setStatus(`${name} is watching`);
        }
        this.updateTurnText();
    }

    handlePlayerDisconnect(playerId) {
        this.pointerCursor(playerId, null);
        const pid = Number(playerId);
        const seatIdx = this.humanSeats[pid];
        delete this.humanSeats[pid];
        if (seatIdx === undefined) return;

        // A seated player left: fold back to the lobby with whoever remains.
        this.seats = [null, null];
        const remaining = Object.keys(this.humanSeats).map(Number);
        if (remaining.length > 0) {
            const keepPid = remaining[0];
            this.humanSeats = { [keepPid]: 0 };
            // name lookup lost with the seat — use pid label; homenames refreshes on rejoin
            this.seats[0] = { kind: 'human', pid: keepPid, name: `player ${keepPid}` };
            this.setStatus('opponent left — waiting for a new one');
            this.showButton('PLAY THE BOT', 'bot');
        } else {
            this.humanSeats = {};
            this.hideButton();
            this.setStatus('waiting for players');
        }
        this.state = 'lobby';
        this.aiming = null;
        this.renderAimNodes(null);
        this.updateGrabPad();
        this.updateTurnText();
    }

    handleButton(pid) {
        if (this.buttonAction === 'bot') {
            if (this.humanSeats[pid] !== 0 || this.seats[1]) return;
            this.seats[1] = { kind: 'bot', name: 'the bot' };
            this.startMatch();
        } else if (this.buttonAction === 'rematch') {
            if (this.humanSeats[pid] === undefined) return;
            this.startMatch();
        }
    }

    showButton(label, action) {
        this.buttonAction = action;
        this.button.update({ coordinates2d: ShapeUtils.rectangle(41, 80, 18, 4.5) });
        this.buttonText.node.text = Object.assign({}, this.buttonText.node.text, { text: label });
        this.buttonText.node.onStateChange();
    }

    hideButton() {
        this.buttonAction = null;
        this.button.update({ coordinates2d: ZERO_COORDS });
        this.buttonText.node.text = Object.assign({}, this.buttonText.node.text, { text: '' });
        this.buttonText.node.onStateChange();
    }

    startMatch() {
        this.hideButton();
        this.rackBalls();
        this.groups = [null, null];
        this.breakShot = true;
        this.currentSeat = 0;
        this.state = 'aim';
        this.botTimer = BOT_THINK_TICKS;
        this.setStatus(`${this.seats[0].name} breaks`);
        this.updateTurnText();
        this.updateGrabPad();
    }

    seatLabel(idx) {
        const seat = this.seats[idx];
        if (!seat) return '—';
        const group = this.groups[idx] ? ` (${this.groups[idx]}s)` : '';
        return seat.name + group;
    }

    updateTurnText() {
        let text;
        if (this.state === 'lobby') {
            text = 'Waiting for a player';
        } else if (this.state === 'over') {
            text = `${this.seatLabel(0)}  vs  ${this.seatLabel(1)}`;
        } else {
            const marker = (i) => this.currentSeat === i ? '▶ ' : '';
            text = `${marker(0)}${this.seatLabel(0)}   vs   ${marker(1)}${this.seatLabel(1)}`;
        }
        this.turnText.node.text = Object.assign({}, this.turnText.node.text, { text });
        this.turnText.node.onStateChange();
    }

    setStatus(text) {
        this.statusText.node.text = Object.assign({}, this.statusText.node.text, { text });
        this.statusText.node.onStateChange();
    }

    // --- aiming ---------------------------------------------------------------------

    canShoot(pid) {
        return this.state === 'aim'
            && this.seats[this.currentSeat]
            && this.seats[this.currentSeat].kind === 'human'
            && this.seats[this.currentSeat].pid === pid;
    }

    pointerCursor(id, mode) {
        if (typeof this.setCursor === 'function') this.setCursor(id, mode ? { assetKey: 'pointer-' + mode, size: { width: 32, height: 32 }, hotspot: { x: 16, y: 16 } } : null);
    }

    startAim(pid, x, y) {
        if (![x, y].every(Number.isFinite)) return;
        if (!this.canShoot(pid)) return;
        if (this.aiming) return;   // re-fired click (old clients)
        const cue = this.cueBall();
        this.aiming = { pid, startX: x, startY: y, x: cue.x, y: cue.y };
        this.pointerCursor(pid, 'hold');
        this.renderAimNodes(this.aiming);
    }

    dragAim(pid, x, y) {
        if (!this.aiming || this.aiming.pid !== pid) return;
        if (![x, y].every(Number.isFinite)) return;
        const cue = this.cueBall();
        this.aiming.x = cue.x + x - this.aiming.startX;
        this.aiming.y = cue.y + y - this.aiming.startY;
        this.renderAimNodes(this.aiming);
    }

    shoot(pid, x, y) {
        if (!this.aiming || this.aiming.pid !== pid) return;
        const cue = this.cueBall();
        this.dragAim(pid, x, y);
        const dx = cue.x - this.aiming.x;
        const dy = cue.y - this.aiming.y;
        const pull = Math.hypot(dx, dy);
        this.aiming = null;
        this.pointerCursor(pid, null);
        this.renderAimNodes(null);
        if (pull < MIN_PULL) return;

        const speed = Math.min(pull * POWER_SCALE, MAX_SHOT_SPEED);
        this.fireCue((dx / pull), (dy / pull), speed);
    }

    handleKeyDown(pid, key) {
        if (key !== 'Escape' || this.aiming?.pid !== Number(pid)) return;
        this.aiming = null; this.renderAimNodes(null); this.pointerCursor(pid, null);
    }

    fireCue(nx, ny, speed) {
        const cue = this.cueBall();
        cue.vx = nx * speed;
        cue.vy = ny * speed;
        this.state = 'rolling';
        this.shotPotted = [];
        this.scratched = false;
        this.renderAimNodes(null);
        this.updateGrabPad();

        // the strike itself: a ring at the cue ball scaled by power
        this.spawnRing(cue.x, cue.y, 1 + speed / 70, [255, 255, 255], 180);
        cue.flashTicks = Math.round(BALL_FLASH_TICKS * 0.6);
        if (speed > 100) this.jolt(0.2);
    }

    // The aim guide: cue path, plus the object ball's projected departure
    // line from the contact (ghost ball) point — real pool aiming.
    renderAimNodes(aiming) {
        if (!aiming) {
            this.aimGuide.update({ coordinates2d: ZERO_COORDS });
            this.objectGuide.update({ coordinates2d: ZERO_COORDS });
            this.powerLine.update({ coordinates2d: ZERO_COORDS });
            return;
        }

        const cue = this.cueBall();
        const dx = cue.x - aiming.x;
        const dy = cue.y - aiming.y;
        const pull = Math.hypot(dx, dy);
        if (pull < 0.5) {
            this.aimGuide.update({ coordinates2d: ZERO_COORDS });
            this.objectGuide.update({ coordinates2d: ZERO_COORDS });
            this.powerLine.update({ coordinates2d: ZERO_COORDS });
            return;
        }
        const nx = dx / pull, ny = dy / pull;

        this.powerLine.update({ coordinates2d: linePoly(cue.x, cue.y, aiming.x, aiming.y, 0.5) });

        // Ray-cast the cue path against every ball to find first contact.
        const hit = this.castCuePath(cue, nx, ny);
        const guideLen = hit ? hit.travel : 26;
        this.aimGuide.update({
            coordinates2d: linePoly(cue.x, cue.y, cue.x + nx * guideLen, cue.y + ny * guideLen, 0.4)
        });

        if (hit) {
            // Object ball departs along the line of centers from the ghost position
            const gx = cue.x + nx * hit.travel;
            const gy = cue.y + ny * hit.travel;
            const ox = hit.ball.x - gx, oy = hit.ball.y - gy;
            const od = Math.hypot(ox, oy) || 1;
            this.objectGuide.update({
                coordinates2d: linePoly(
                    hit.ball.x, hit.ball.y,
                    hit.ball.x + (ox / od) * 9, hit.ball.y + (oy / od) * 9,
                    0.4)
            });
        } else {
            this.objectGuide.update({ coordinates2d: ZERO_COORDS });
        }
    }

    // First ball the cue contacts along direction (nx, ny). Returns
    // { ball, travel } where travel is the cue-center distance to contact.
    castCuePath(cue, nx, ny) {
        let best = null;
        for (const b of this.balls) {
            if (!b.alive || b.id === 0) continue;
            const rx = b.x - cue.x, ry = b.y - cue.y;
            const proj = rx * nx + ry * ny;
            if (proj <= 0) continue;
            const perp2 = (rx * rx + ry * ry) - proj * proj;
            const R = BALL_R * 2;
            if (perp2 >= R * R) continue;
            const travel = proj - Math.sqrt(R * R - perp2);
            if (travel > 0 && (!best || travel < best.travel)) {
                best = { ball: b, travel };
            }
        }
        return best;
    }

    // --- physics ------------------------------------------------------------------

    ballsMoving() {
        return this.balls.some(b => b.alive && (b.vx !== 0 || b.vy !== 0));
    }

    physicsStep(stepDT) {
        // integrate
        for (const b of this.balls) {
            if (!b.alive || (b.vx === 0 && b.vy === 0)) continue;
            b.x += b.vx * stepDT;
            b.y += b.vy * stepDT;
            b.moved = true;
        }

        // cushions with pocket mouths
        for (const b of this.balls) {
            if (!b.alive) continue;
            const nearCornerX = b.x < TABLE.left + CORNER_MOUTH || b.x > TABLE.right - CORNER_MOUTH;
            const nearCornerY = b.y < TABLE.top + CORNER_MOUTH || b.y > TABLE.bottom - CORNER_MOUTH;
            const inSideMouth = Math.abs(b.x - CX) < SIDE_MOUTH;

            if (b.x < TABLE.left + BALL_R && !nearCornerY) {
                const impact = Math.abs(b.vx);
                b.x = TABLE.left + BALL_R; b.vx = -b.vx * CUSHION_BOUNCE;
                this.onCushionImpact(b, impact, TABLE.left + 0.3, b.y, 1, 0);
            }
            if (b.x > TABLE.right - BALL_R && !nearCornerY) {
                const impact = Math.abs(b.vx);
                b.x = TABLE.right - BALL_R; b.vx = -b.vx * CUSHION_BOUNCE;
                this.onCushionImpact(b, impact, TABLE.right - 0.3, b.y, -1, 0);
            }
            if (b.y < TABLE.top + BALL_R && !nearCornerX && !inSideMouth) {
                const impact = Math.abs(b.vy);
                b.y = TABLE.top + BALL_R; b.vy = -b.vy * CUSHION_BOUNCE;
                this.onCushionImpact(b, impact, b.x, TABLE.top + 0.3, 0, 1);
            }
            if (b.y > TABLE.bottom - BALL_R && !nearCornerX && !inSideMouth) {
                const impact = Math.abs(b.vy);
                b.y = TABLE.bottom - BALL_R; b.vy = -b.vy * CUSHION_BOUNCE;
                this.onCushionImpact(b, impact, b.x, TABLE.bottom - 0.3, 0, -1);
            }
        }

        // pockets + gutter guard
        for (const b of this.balls) {
            if (!b.alive) continue;
            for (const p of POCKETS) {
                if (Math.hypot(b.x - p.x, b.y - p.y) < p.r) { this.potBall(b, p); break; }
            }
            if (b.alive && (
                b.x < TABLE.left - GUTTER || b.x > TABLE.right + GUTTER ||
                b.y < TABLE.top - GUTTER || b.y > TABLE.bottom + GUTTER)) {
                const nearest = POCKETS.reduce((best, p) =>
                    (!best || Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(b.x - best.x, b.y - best.y)) ? p : best, null);
                this.potBall(b, nearest);
            }
        }

        // ball-ball collisions (equal mass, normal impulse)
        for (let i = 0; i < this.balls.length; i++) {
            const a = this.balls[i];
            if (!a.alive) continue;
            for (let j = i + 1; j < this.balls.length; j++) {
                const b = this.balls[j];
                if (!b.alive) continue;
                const dx = b.x - a.x, dy = b.y - a.y;
                const d = Math.hypot(dx, dy);
                const minD = BALL_R * 2;
                if (d === 0 || d >= minD) continue;

                const nx = dx / d, ny = dy / d;
                const overlap = (minD - d) / 2;
                a.x -= nx * overlap; a.y -= ny * overlap;
                b.x += nx * overlap; b.y += ny * overlap;
                a.moved = true; b.moved = true;

                const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                if (rvn > 0) continue;
                // equal masses: exchange the normal component, scaled by restitution
                const impulse = -(1 + BALL_BOUNCE) * rvn / 2;
                a.vx -= impulse * nx; a.vy -= impulse * ny;
                b.vx += impulse * nx; b.vy += impulse * ny;
                this.onBallImpact(a, b, Math.abs(rvn), (a.x + b.x) / 2, (a.y + b.y) / 2, nx, ny);
            }
        }
    }

    potBall(ball, pocket) {
        ball.alive = false;
        ball.vx = 0; ball.vy = 0;
        ball.flashTicks = 0;
        if (pocket) this.spawnSink(ball, pocket);   // the real node hides; a stand-in sinks
        ball.node.update({ coordinates2d: ZERO_COORDS });
        if (ball.markerNode) ball.markerNode.update({ coordinates2d: ZERO_COORDS });
        if (ball.trailNode) ball.trailNode.update({ coordinates2d: ZERO_COORDS });
        if (ball.id === 0) {
            this.scratched = true;
        } else {
            this.shotPotted.push(ball.id);
        }
    }

    respotCue() {
        const cue = this.cueBall();
        cue.alive = true;
        cue.vx = 0; cue.vy = 0;
        // head spot; walk left/up until clear of other balls
        let x = TABLE.left + (TABLE.right - TABLE.left) * 0.25;
        let y = CY;
        for (let attempt = 0; attempt < 30; attempt++) {
            const blocked = this.balls.some(b => b.alive && b.id !== 0 && Math.hypot(b.x - x, b.y - y) < BALL_R * 2.1);
            if (!blocked) break;
            y += (attempt % 2 === 0 ? 1 : -1) * (attempt + 1) * 1.2;
            y = Math.max(TABLE.top + BALL_R, Math.min(TABLE.bottom - BALL_R, y));
            if (attempt > 15) x -= 1.5;
        }
        cue.x = x; cue.y = y;
        cue.moved = true;
    }

    // --- turn resolution -------------------------------------------------------------

    groupOf(ballId) { return ballId <= 7 ? 'solid' : 'stripe'; }

    remaining(group) {
        return this.balls.filter(b => b.alive && b.id !== 0 && b.id !== 8 && this.groupOf(b.id) === group).length;
    }

    resolveShot() {
        const shooter = this.currentSeat;
        const other = 1 - shooter;
        const potted = this.shotPotted;
        const scratched = this.scratched;
        this.breakShot = false;

        // 8-ball ends the game
        if (potted.includes(8)) {
            const myGroup = this.groups[shooter];
            const clearedGroup = myGroup && this.remaining(myGroup) === 0;
            const winner = (clearedGroup && !scratched) ? shooter : other;
            this.endMatch(winner, clearedGroup && !scratched
                ? `${this.seats[winner].name} sinks the 8 — game!`
                : `${this.seats[shooter].name} sinks the 8 too early — ${this.seats[winner].name} wins!`);
            return;
        }

        // assign groups on the first pot when the table is open
        if (this.groups[shooter] === null && potted.length > 0) {
            const first = potted[0];
            this.groups[shooter] = this.groupOf(first);
            this.groups[other] = this.groups[shooter] === 'solid' ? 'stripe' : 'solid';
            this.setStatus(`${this.groups[shooter]}s → ${this.seats[shooter].name}`);
        }

        let keepTurn = false;
        if (!scratched && potted.length > 0) {
            const myGroup = this.groups[shooter];
            keepTurn = myGroup !== null && potted.some(id => this.groupOf(id) === myGroup);
        }

        if (scratched) {
            this.respotCue();
            this.setStatus(`scratch! ${this.seats[other].name} shoots`);
        } else if (keepTurn) {
            const left = this.remaining(this.groups[shooter]);
            this.setStatus(left === 0
                ? `${this.seats[shooter].name} is on the 8-ball!`
                : `${this.seats[shooter].name} stays at the table`);
        } else if (potted.length === 0) {
            this.setStatus(`${this.seats[other].name} shoots`);
        }

        this.currentSeat = keepTurn && !scratched ? shooter : other;
        this.state = 'aim';
        this.botTimer = BOT_THINK_TICKS;
        this.updateTurnText();
        this.updateGrabPad();
    }

    endMatch(winnerSeat, message) {
        this.state = 'over';
        this.setStatus(message);
        this.updateTurnText();
        this.updateGrabPad();
        this.renderAimNodes(null);
        this.showButton('REMATCH', 'rematch');
    }

    // --- bot -------------------------------------------------------------------------

    // Is the straight path from (x1,y1) to (x2,y2) clear for a ball of
    // radius BALL_R, ignoring the given ball ids?
    pathClear(x1, y1, x2, y2, ignoreIds) {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len === 0) return true;
        const nx = dx / len, ny = dy / len;
        for (const b of this.balls) {
            if (!b.alive || ignoreIds.includes(b.id)) continue;
            const rx = b.x - x1, ry = b.y - y1;
            const proj = rx * nx + ry * ny;
            if (proj <= 0 || proj >= len) continue;
            const perp = Math.abs(rx * ny - ry * nx);
            if (perp < BALL_R * 2 - 0.05) return false;
        }
        return true;
    }

    // Does the pot line from the ball into this pocket actually clear the
    // cushions and enter the mouth? A shot aimed at a corner from a shallow
    // angle hits the rail outside the mouth — impossible in real pool, so
    // the bot must not attempt it. Walks the line with the same mouth
    // predicates the physics uses.
    potLineOpen(ball, pocket) {
        const dx = pocket.x - ball.x, dy = pocket.y - ball.y;
        const len = Math.hypot(dx, dy);
        const steps = Math.max(2, Math.ceil(len / 0.4));
        for (let i = 1; i <= steps; i++) {
            const x = ball.x + (dx * i) / steps;
            const y = ball.y + (dy * i) / steps;
            if (Math.hypot(x - pocket.x, y - pocket.y) < pocket.r * 0.8) return true;
            const nearCornerX = x < TABLE.left + CORNER_MOUTH || x > TABLE.right - CORNER_MOUTH;
            const nearCornerY = y < TABLE.top + CORNER_MOUTH || y > TABLE.bottom - CORNER_MOUTH;
            const inSideMouth = Math.abs(x - CX) < SIDE_MOUTH;
            if (x < TABLE.left + BALL_R && !nearCornerY) return false;
            if (x > TABLE.right - BALL_R && !nearCornerY) return false;
            if (y < TABLE.top + BALL_R && !nearCornerX && !inSideMouth) return false;
            if (y > TABLE.bottom - BALL_R && !nearCornerX && !inSideMouth) return false;
        }
        return true;
    }

    botTargets() {
        const group = this.groups[1];
        const alive = this.balls.filter(b => b.alive && b.id !== 0);
        if (group === null) return alive.filter(b => b.id !== 8);
        const mine = alive.filter(b => b.id !== 8 && this.groupOf(b.id) === group);
        return mine.length > 0 ? mine : alive.filter(b => b.id === 8);
    }

    botPickShot() {
        const cue = this.cueBall();
        const candidates = [];

        for (const ball of this.botTargets()) {
            for (const pocket of POCKETS) {
                const tpx = pocket.x - ball.x, tpy = pocket.y - ball.y;
                const distBP = Math.hypot(tpx, tpy);
                if (distBP === 0) continue;
                const tx = tpx / distBP, ty = tpy / distBP;

                // ghost ball: where the cue center must be at contact
                const gx = ball.x - tx * BALL_R * 2;
                const gy = ball.y - ty * BALL_R * 2;

                const adx = gx - cue.x, ady = gy - cue.y;
                const distCG = Math.hypot(adx, ady);
                if (distCG < 0.5) continue;
                const ax = adx / distCG, ay = ady / distCG;

                // cut angle: how aligned the cue path is with the pot line
                const cutCos = ax * tx + ay * ty;
                if (cutCos < 0.3) continue;   // too thin to attempt

                if (!this.pathClear(cue.x, cue.y, gx, gy, [0, ball.id])) continue;
                if (!this.pathClear(ball.x, ball.y, pocket.x, pocket.y, [0, ball.id])) continue;
                if (!this.potLineOpen(ball, pocket)) continue;

                const sidePocket = pocket.r === SIDE_CAPTURE;
                const score = (cutCos ** 2)
                    * (1 / (1 + distCG / 60))
                    * (1 / (1 + distBP / 60))
                    * (sidePocket ? 0.65 : 1);

                candidates.push({ ball, pocket, ax, ay, cutCos, distCG, distBP, score });
            }
        }

        candidates.sort((a, b) => b.score - a.score);
        if (candidates.length === 0) return null;

        // Not a machine: occasionally takes the second-best option, but only
        // when it's nearly as good (a human picking between two real shots,
        // not sabotaging themselves with a bad pocket).
        if (candidates.length > 1
            && Math.random() > 0.85
            && candidates[1].score > candidates[0].score * 0.6) {
            return candidates[1];
        }
        return candidates[0];
    }

    botShoot() {
        const cue = this.cueBall();
        const shot = this.botPickShot();

        if (!shot) {
            // Safety: nudge the nearest legal ball, softly.
            const targets = this.botTargets();
            if (targets.length === 0) return this.fireCue(1, 0, 30);
            const t = targets.reduce((best, b) =>
                (!best || Math.hypot(b.x - cue.x, b.y - cue.y) < Math.hypot(best.x - cue.x, best.y - cue.y)) ? b : best, null);
            const dx = t.x - cue.x, dy = t.y - cue.y;
            const d = Math.hypot(dx, dy) || 1;
            const err = gauss() * 0.06;
            const cos = Math.cos(err), sin = Math.sin(err);
            this.setStatus('the bot plays safe');
            return this.fireCue((dx * cos - dy * sin) / d, (dx * sin + dy * cos) / d, 28 + Math.random() * 14);
        }

        // Power: enough for the object ball to reach the pocket with margin.
        // The 1.12 factor covers restitution loss (e=0.96) and per-tick
        // discretization, both of which the closed-form model ignores.
        const arrive = 22;
        const vObj2 = arrive * arrive + 2 * DECEL * shot.distBP;
        const vImpact = (Math.sqrt(vObj2) / Math.max(shot.cutCos, 0.4)) * 1.12;
        let speed = Math.sqrt(vImpact * vImpact + 2 * DECEL * shot.distCG);
        speed = Math.max(28, Math.min(MAX_SHOT_SPEED * 0.85, speed * (0.97 + Math.random() * 0.1)));

        // Human-ish aim error: worse on thin cuts and long shots. Cue-aim
        // error is amplified ~(distCG / ball-diameter)x into the object
        // ball's departure angle — real pool's cruelty — so sigma stays
        // small and the difficulty scaling emerges from the geometry itself.
        const sigma = 0.009 + 0.02 * (1 - shot.cutCos) + 0.00014 * (shot.distCG + shot.distBP);
        const err = gauss() * sigma;
        const cos = Math.cos(err), sin = Math.sin(err);
        const nx = shot.ax * cos - shot.ay * sin;
        const ny = shot.ax * sin + shot.ay * cos;
        this.fireCue(nx, ny, speed);
    }

    // --- tick --------------------------------------------------------------------------

    tick() {
        if (this.state === 'rolling') {
            // substepped physics: nothing moves more than SUBSTEP_MOVE per step
            let maxSpeed = 0;
            for (const b of this.balls) {
                if (!b.alive) continue;
                const s = Math.hypot(b.vx, b.vy);
                if (s > maxSpeed) maxSpeed = s;
            }
            const steps = Math.max(1, Math.ceil((maxSpeed * DT) / SUBSTEP_MOVE));
            for (let s = 0; s < steps; s++) {
                this.physicsStep(DT / steps);
            }

            // rolling friction: constant deceleration, like felt
            for (const b of this.balls) {
                if (!b.alive || (b.vx === 0 && b.vy === 0)) continue;
                const speed = Math.hypot(b.vx, b.vy);
                const next = speed - DECEL * DT;
                if (next <= STOP_SPEED) {
                    b.vx = 0; b.vy = 0;
                } else {
                    b.vx *= next / speed;
                    b.vy *= next / speed;
                }
            }

            if (!this.ballsMoving()) {
                this.resolveShot();
            }
        } else if (this.state === 'aim') {
            const seat = this.seats[this.currentSeat];
            if (seat && seat.kind === 'bot') {
                if (--this.botTimer <= 0) {
                    this.botShoot();
                }
            }
        }

        // Render moved/flashing balls and advance effects — every tick, so
        // flashes and pocket sinks finish even after the balls settle.
        for (const b of this.balls) {
            if (!b.alive) { b.moved = false; continue; }
            if (b.moved || b.flashTicks > 0) {
                this.renderBall(b);
                b.moved = false;
                if (b.flashTicks > 0) b.flashTicks--;
            }
        }
        this.stepFx();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = Billiards;
