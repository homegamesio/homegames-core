const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-145');

const COLORS = Colors.COLORS;

// FLICK — a shared slingshot arena with real physics.
//
// Press your ball, drag back to aim (rubber-band line shows the pull),
// release to launch. Balls carry momentum by size, bounce off walls and
// EACH OTHER (elastic collisions — knock rivals around), and popped targets
// explode into shrapnel fragments that are physical bodies too: they shove
// balls and pop more targets, chaining. Chain pops credit whoever launched.
//
// Built on squish 1.4.4 drag support (onClick/onDrag/offClick) + hover
// (targets glow under the pointer) + device recognition: phones get a big
// heavy ball, desktops a small quick one. Runs at 60fps; only nodes that
// actually moved are updated each tick.

const TICK_RATE = 60;
const DT = 1 / TICK_RATE;

const ARENA = { left: 2, right: 98, top: 12, bottom: 98 };

// Ball radius by device — bigger touch targets for touch devices.
// Mass scales with area, so big mobile balls are slower to stop and
// hit harder; small desktop balls are zippy but get shoved around.
const BALL_SIZES = { desktop: 3, tablet: 4.5, mobile: 5.5 };

const MAX_PULL = 35;            // longest useful pull, world units
const LAUNCH_POWER = 3.5;       // pull units -> velocity units/sec
const FRICTION = 0.994;         // per tick @60fps (~70% speed retained per second)
const WALL_BOUNCE = 0.85;       // wall energy retention
const BALL_BOUNCE = 0.92;       // ball-ball restitution
const STOP_SPEED = 2;           // below this, a body parks
const GRAB_SPEED = 12;          // ball must be slower than this to grab
const MIN_PULL = 2;             // smaller pulls cancel the launch
const MAX_SPEED = 160;          // hard velocity cap, units/sec

const TARGET_COUNT = 6;
const TARGET_SIZE = 3.5;        // half-size of the gold diamonds
const TARGET_RESPAWN_TICKS = Math.round(1.2 * TICK_RATE);
const POP_SPEED = 6;            // a body must move this fast to pop a target

// Shrapnel — the chain-reaction medium
const FRAG_COUNT = 4;           // fragments per popped target
const FRAG_RADIUS = 1.3;
const FRAG_SPEED_MIN = 45;
const FRAG_SPEED_MAX = 75;
const FRAG_LIFE_TICKS = Math.round(1.3 * TICK_RATE);
const MAX_FRAGS = 28;

// Impact flashes — expanding, fading diamonds at collision points
const FLASH_LIFE_TICKS = Math.round(0.28 * TICK_RATE);
const MAX_FLASHES = 14;
const FLASH_IMPACT_MIN = 25;    // minimum impact speed to bother flashing

const CHAIN_TOAST_TICKS = Math.round(2 * TICK_RATE);

const PLAYER_COLORS = [
    COLORS.CANDY_RED, COLORS.SKY_BLUE, COLORS.CANDY_GREEN,
    COLORS.HARD_PINK, COLORS.ORANGE, COLORS.FUNNY_PURPLE,
    COLORS.DARK_TURQUOISE, COLORS.GOLD
];

const HINT_DEFAULT = 'drag your ball back, release to flick. pops shred into shrapnel — chain them!';
const HINT_COLOR = [150, 165, 200, 255];

const diamond = (x, y, s) => [
    [x, y - s],
    [x + s, y],
    [x, y + s],
    [x - s, y],
    [x, y - s]
];

// Thin quad along the segment A->B (the aim rubber-band).
const linePoly = (ax, ay, bx, by, thickness) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = (-dy / len) * thickness / 2;
    const py = (dx / len) * thickness / 2;
    return [
        [ax + px, ay + py],
        [bx + px, by + py],
        [bx - px, by - py],
        [ax - px, ay - py],
        [ax + px, ay + py]
    ];
};

class Flick extends Game {
    static metadata() {
        return {
            squishVersion: '145',
            name: 'Flick',
            author: 'Joseph Garcia',
            description: 'Slingshot arena with real physics: elastic ball collisions, exploding targets, chain reactions. Ball size and weight fit your device.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: TICK_RATE
        };
    }

    constructor(options = {}) {
        super();

        this.players = {};
        this.targets = [];
        this.fragments = [];
        this.flashes = [];
        this.pendingRespawns = [];   // tick countdowns for popped targets
        this.joinCounter = 0;
        this.chainToastTicks = 0;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [18, 24, 38, 255]
        });

        this.hudDivider = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, ARENA.top - 0.6, 100, 0.6),
            fill: [60, 75, 110, 255]
        });

        this.targetLayer = this.container();
        this.flashLayer = this.container();
        this.fragLayer = this.container();
        this.aimLayer = this.container();
        this.ballLayer = this.container();

        this.scoreText = new GameNode.Text({
            textInfo: { text: '', x: 50, y: 2, size: 1.6, align: 'center', color: COLORS.WHITE }
        });

        this.hintText = new GameNode.Text({
            textInfo: { text: HINT_DEFAULT, x: 50, y: 6.5, size: 1.2, align: 'center', color: HINT_COLOR }
        });

        this.base.addChildren(
            this.hudDivider,
            this.targetLayer,
            this.flashLayer,
            this.fragLayer,
            this.aimLayer,
            this.ballLayer,
            this.scoreText,
            this.hintText
        );

        for (let i = 0; i < TARGET_COUNT; i++) {
            this.spawnTarget();
        }
    }

    container() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: [0, 0, 0, 0]
        });
    }

    // --- targets -------------------------------------------------------------

    spawnTarget() {
        // Keep new targets off resting balls so they can't be popped for free.
        let x = 50, y = 55;
        for (let attempt = 0; attempt < 10; attempt++) {
            x = ARENA.left + 10 + Math.random() * (ARENA.right - ARENA.left - 20);
            y = ARENA.top + 10 + Math.random() * (ARENA.bottom - ARENA.top - 20);
            const clear = Object.values(this.players).every(p =>
                Math.hypot(p.x - x, p.y - y) > p.r + TARGET_SIZE + 4);
            if (clear) break;
        }

        const target = { x, y, node: null };

        // Hover-only nodes (no onClick) — they glow under the pointer.
        target.node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: diamond(x, y, TARGET_SIZE),
            fill: COLORS.GOLD,
            color: COLORS.WHITE,
            border: 1,
            onHover: () => target.node.update({ fill: COLORS.WHITE }),
            offHover: () => target.node.update({ fill: COLORS.GOLD })
        });

        this.targets.push(target);
        this.targetLayer.addChild(target.node);
    }

    popTarget(target, body) {
        this.targetLayer.removeChild(target.node.node.id);
        this.targets.splice(this.targets.indexOf(target), 1);
        this.pendingRespawns.push(TARGET_RESPAWN_TICKS);

        this.spawnFlash(target.x, target.y, TARGET_SIZE * 1.4, COLORS.GOLD);
        this.spawnFragments(target, body);

        const owner = this.players[body.ownerPid];
        if (owner) {
            owner.score++;
            owner.combo++;
            if (owner.combo >= 2) {
                this.setHint(`CHAIN x${owner.combo} — ${owner.name}!`, owner.color);
                this.chainToastTicks = CHAIN_TOAST_TICKS;
            }
            this.updateScoreboard();
        }
    }

    // --- shrapnel (chain-reaction bodies) --------------------------------------

    spawnFragments(target, body) {
        const baseAngle = Math.atan2(body.vy, body.vx) || 0;
        for (let i = 0; i < FRAG_COUNT; i++) {
            if (this.fragments.length >= MAX_FRAGS) {
                this.expireFragment(this.fragments[0]);
            }

            // Fan out around the impact direction, with spread.
            const angle = baseAngle + (i - (FRAG_COUNT - 1) / 2) * 0.9 + (Math.random() - 0.5) * 0.5;
            const speed = FRAG_SPEED_MIN + Math.random() * (FRAG_SPEED_MAX - FRAG_SPEED_MIN);
            const owner = this.players[body.ownerPid];
            const color = owner ? owner.color : COLORS.GOLD;

            const frag = {
                x: target.x,
                y: target.y,
                vx: Math.cos(angle) * speed + body.vx * 0.3,
                vy: Math.sin(angle) * speed + body.vy * 0.3,
                r: FRAG_RADIUS,
                m: FRAG_RADIUS * FRAG_RADIUS,
                ownerPid: body.ownerPid,
                life: FRAG_LIFE_TICKS,
                color,
                node: null
            };

            frag.node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: diamond(frag.x, frag.y, frag.r),
                fill: [color[0], color[1], color[2], 255]
            });

            this.fragments.push(frag);
            this.fragLayer.addChild(frag.node);
        }
    }

    expireFragment(frag) {
        this.fragLayer.removeChild(frag.node.node.id);
        this.fragments.splice(this.fragments.indexOf(frag), 1);
    }

    // --- impact flashes ----------------------------------------------------------

    spawnFlash(x, y, size, color) {
        if (this.flashes.length >= MAX_FLASHES) {
            const oldest = this.flashes.shift();
            this.flashLayer.removeChild(oldest.node.node.id);
        }

        const flash = { x, y, size, color, life: FLASH_LIFE_TICKS, node: null };
        flash.node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: diamond(x, y, size),
            fill: [color[0], color[1], color[2], 200]
        });
        this.flashes.push(flash);
        this.flashLayer.addChild(flash.node);
    }

    // --- players -------------------------------------------------------------

    resolveDeviceType(clientInfo) {
        const reported = clientInfo && clientInfo.deviceType;
        return BALL_SIZES[reported] ? reported : 'desktop';
    }

    handleNewPlayer({ playerId, info, clientInfo }) {
        const pid = Number(playerId);
        const deviceType = this.resolveDeviceType(clientInfo);
        const color = PLAYER_COLORS[this.joinCounter++ % PLAYER_COLORS.length];
        const r = BALL_SIZES[deviceType];

        const player = {
            pid,
            ownerPid: pid,          // bodies credit pops to ownerPid; a ball owns itself
            name: (info && info.name) || `player ${pid}`,
            deviceType,
            r,
            m: r * r,
            color,
            x: 20 + Math.random() * 60,
            y: 55 + Math.random() * 30,
            vx: 0,
            vy: 0,
            aim: null,
            score: 0,
            combo: 0,
            ball: null,
            aimLine: null
        };

        player.ball = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: diamond(player.x, player.y, player.r),
            fill: color,
            color: COLORS.WHITE,
            border: 1,
            onClick: (clickPid, x, y) => this.startAim(Number(clickPid), player, x, y),
            onDrag: (dragPid, x, y) => this.dragAim(Number(dragPid), player, x, y),
            offClick: (releasePid, x, y) => this.launch(Number(releasePid), player, x, y)
        });

        player.aimLine = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: [color[0], color[1], color[2], 150]
        });

        this.aimLayer.addChild(player.aimLine);
        this.ballLayer.addChild(player.ball);
        this.players[pid] = player;
        this.updateScoreboard();
    }

    handlePlayerDisconnect(playerId) {
        const pid = Number(playerId);
        const player = this.players[pid];
        if (!player) return;
        this.aimLayer.removeChild(player.aimLine.node.id);
        this.ballLayer.removeChild(player.ball.node.id);
        delete this.players[pid];
        this.updateScoreboard();
    }

    updateScoreboard() {
        const parts = Object.values(this.players)
            .map(p => `${p.name} [${p.deviceType}]: ${p.score}`);
        this.scoreText.node.text = Object.assign({}, this.scoreText.node.text, {
            text: parts.join('     ') || 'waiting for players'
        });
        this.scoreText.node.onStateChange();
    }

    setHint(text, color) {
        this.hintText.node.text = Object.assign({}, this.hintText.node.text, {
            text,
            color: color || HINT_COLOR
        });
        this.hintText.node.onStateChange();
    }

    // --- aim + launch ----------------------------------------------------------

    startAim(clickPid, player, x, y) {
        if (clickPid !== player.pid) return;
        if (player.aim) return;                // re-fired click (old clients)
        if (Math.hypot(player.vx, player.vy) > GRAB_SPEED) return;

        player.vx = 0;
        player.vy = 0;
        player.aim = { x, y };
        this.renderAim(player);
    }

    dragAim(dragPid, player, x, y) {
        if (dragPid !== player.pid || !player.aim) return;
        player.aim.x = x;
        player.aim.y = y;
        this.renderAim(player);
    }

    launch(releasePid, player, x, y) {
        if (releasePid !== player.pid || !player.aim) return;

        const dx = player.x - x;
        const dy = player.y - y;
        const pull = Math.hypot(dx, dy);
        player.aim = null;
        this.renderAim(player);

        if (pull < MIN_PULL) return;

        const capped = Math.min(pull, MAX_PULL);
        player.vx = (dx / pull) * capped * LAUNCH_POWER;
        player.vy = (dy / pull) * capped * LAUNCH_POWER;
        player.combo = 0;          // fresh launch, fresh chain
    }

    cancelAim(player) {
        if (!player.aim) return;
        player.aim = null;
        this.renderAim(player);
    }

    renderAim(player) {
        const coords = player.aim
            ? linePoly(player.x, player.y, player.aim.x, player.aim.y, 1)
            : ShapeUtils.rectangle(0, 0, 0, 0);
        player.aimLine.update({ coordinates2d: coords });
    }

    // --- physics ---------------------------------------------------------------

    // Elastic collision between two bodies ({x,y,vx,vy,r,m}). Separates the
    // overlap by inverse mass and applies a restitution impulse along the
    // contact normal. Returns the impact speed (0 when not touching /
    // already separating) so callers can decide whether to flash.
    resolveCollision(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.r + b.r;
        const d = Math.hypot(dx, dy);
        if (d === 0 || d >= minD) return 0;

        const nx = dx / d;
        const ny = dy / d;

        // Push apart proportionally to inverse mass so heavy balls barely budge.
        const overlap = minD - d;
        const total = a.m + b.m;
        a.x -= nx * overlap * (b.m / total);
        a.y -= ny * overlap * (b.m / total);
        b.x += nx * overlap * (a.m / total);
        b.y += ny * overlap * (a.m / total);
        a.moved = true;
        b.moved = true;

        const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rvn > 0) return 0;   // already separating

        const j = -(1 + BALL_BOUNCE) * rvn / (1 / a.m + 1 / b.m);
        a.vx -= (j * nx) / a.m;
        a.vy -= (j * ny) / a.m;
        b.vx += (j * nx) / b.m;
        b.vy += (j * ny) / b.m;

        return Math.abs(rvn);
    }

    integrate(body) {
        const speed = Math.hypot(body.vx, body.vy);
        if (speed > MAX_SPEED) {
            body.vx *= MAX_SPEED / speed;
            body.vy *= MAX_SPEED / speed;
        }
        if (body.vx === 0 && body.vy === 0) return;

        body.x += body.vx * DT;
        body.y += body.vy * DT;
        body.moved = true;

        // Wall bounces, with a flash on hard hits
        const hitWall = (impact, fx, fy) => {
            if (impact > FLASH_IMPACT_MIN) this.spawnFlash(fx, fy, body.r * 0.9, COLORS.WHITE);
        };
        if (body.x < ARENA.left + body.r) {
            hitWall(Math.abs(body.vx), ARENA.left + 0.5, body.y);
            body.x = ARENA.left + body.r; body.vx = -body.vx * WALL_BOUNCE;
        }
        if (body.x > ARENA.right - body.r) {
            hitWall(Math.abs(body.vx), ARENA.right - 0.5, body.y);
            body.x = ARENA.right - body.r; body.vx = -body.vx * WALL_BOUNCE;
        }
        if (body.y < ARENA.top + body.r) {
            hitWall(Math.abs(body.vy), body.x, ARENA.top + 0.5);
            body.y = ARENA.top + body.r; body.vy = -body.vy * WALL_BOUNCE;
        }
        if (body.y > ARENA.bottom - body.r) {
            hitWall(Math.abs(body.vy), body.x, ARENA.bottom - 0.5);
            body.y = ARENA.bottom - body.r; body.vy = -body.vy * WALL_BOUNCE;
        }

        body.vx *= FRICTION;
        body.vy *= FRICTION;

        if (Math.hypot(body.vx, body.vy) < STOP_SPEED) {
            body.vx = 0;
            body.vy = 0;
        }
    }

    tick() {
        // 1. Respawn popped targets after their delay
        for (let i = this.pendingRespawns.length - 1; i >= 0; i--) {
            if (--this.pendingRespawns[i] <= 0) {
                this.pendingRespawns.splice(i, 1);
                this.spawnTarget();
            }
        }

        const balls = Object.values(this.players);
        const bodies = [...balls, ...this.fragments];

        // 2. Integrate every body
        for (const body of bodies) {
            this.integrate(body);
        }

        // 3. Ball-ball and ball-fragment collisions (fragments skip each
        // other — visual chaos without gameplay value, and it's the n²
        // hot spot at 60fps)
        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                const impact = this.resolveCollision(balls[i], balls[j]);
                if (impact > FLASH_IMPACT_MIN) {
                    const a = balls[i], b = balls[j];
                    this.spawnFlash((a.x + b.x) / 2, (a.y + b.y) / 2, Math.min(a.r, b.r), COLORS.WHITE);
                }
            }
            for (const frag of this.fragments) {
                this.resolveCollision(balls[i], frag);
            }
        }

        // A knocked ball can't keep an aim anchored to where it was
        for (const ball of balls) {
            if (ball.aim && Math.hypot(ball.vx, ball.vy) > STOP_SPEED) {
                this.cancelAim(ball);
            }
        }

        // 4. Target pops — any fast-moving body pops on contact
        for (const body of bodies) {
            if (Math.hypot(body.vx, body.vy) < POP_SPEED) continue;
            for (const target of [...this.targets]) {
                if (Math.hypot(target.x - body.x, target.y - body.y) < body.r + TARGET_SIZE) {
                    this.popTarget(target, body);
                }
            }
        }

        // 5. Push updates only for nodes that actually moved
        for (const ball of balls) {
            if (ball.moved) {
                ball.moved = false;
                ball.ball.update({ coordinates2d: diamond(ball.x, ball.y, ball.r) });
            }
        }
        for (const frag of [...this.fragments]) {
            frag.life--;
            if (frag.life <= 0 || (frag.vx === 0 && frag.vy === 0)) {
                this.expireFragment(frag);
                continue;
            }
            const alpha = Math.round(255 * Math.min(1, frag.life / (FRAG_LIFE_TICKS * 0.4)));
            frag.moved = false;
            frag.node.update({
                coordinates2d: diamond(frag.x, frag.y, frag.r),
                fill: [frag.color[0], frag.color[1], frag.color[2], alpha]
            });
        }

        // 6. Flashes expand and fade out
        for (const flash of [...this.flashes]) {
            flash.life--;
            if (flash.life <= 0) {
                this.flashLayer.removeChild(flash.node.node.id);
                this.flashes.splice(this.flashes.indexOf(flash), 1);
                continue;
            }
            const t = 1 - flash.life / FLASH_LIFE_TICKS;   // 0 -> 1
            flash.node.update({
                coordinates2d: diamond(flash.x, flash.y, flash.size * (1 + t * 1.6)),
                fill: [flash.color[0], flash.color[1], flash.color[2], Math.round(200 * (1 - t))]
            });
        }

        // 7. Chain toast timeout
        if (this.chainToastTicks > 0 && --this.chainToastTicks === 0) {
            this.setHint(HINT_DEFAULT);
        }
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = Flick;
