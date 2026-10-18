'use strict';
const { THEMES, obstaclesAt } = require('./themes');

const GRAVITY = 100;
const RADIUS = 2.8;
const FLOOR = 91;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const layouts = [
    { tee: 27, x: 66, y: 43 },
    { tee: 73, x: 36, y: 46 },
    { tee: 26, x: 68, y: 38 },
    { tee: 25, x: 50, y: 43 },
    { tee: 25, x: 62, y: 41 },
    { tee: 75, x: 40, y: 40 },
];

// Aim at a landing point, not an undocumented swipe speed. A slow drag and a
// quick flick to the same point make the same shot on mouse and touch screens.
function trajectory(ball, x, y) {
    x = clamp(x, 6, 94); y = clamp(y, 25, 80);
    const apex = Math.max(7, Math.min(ball.y, y) - 18);
    const vy = -Math.sqrt(2 * GRAVITY * (ball.y - apex));
    const duration = (-vy + Math.sqrt(2 * GRAVITY * (y - apex))) / GRAVITY;
    return { x, y, vx: (x - ball.x) / duration, vy, duration };
}

class Court {
    constructor(theme = 'classic', ids = [1]) {
        this.theme = Object.hasOwn(THEMES, theme) ? theme : 'classic';
        this.time = 0; this.baskets = 0; this.events = []; this.balls = new Map();
        this.obstacles = []; this.transition = null; this.cheer = 0;
        this.layout = layouts[0]; this.hoop = this.hoopAt(0);
        ids.forEach(id => this.join(id));
    }
    join(id) {
        if (this.balls.has(id) || this.balls.size >= 4) return;
        const seat = [0, 1, 2, 3].find(n => ![...this.balls.values()].some(b => b.seat === n));
        const ball = { id, seat, score: 0, misses: 0 };
        this.balls.set(id, ball); this.resetBall(ball);
    }
    leave(id) { this.balls.delete(id); }
    resetBall(ball) {
        const tee = [this.layout.tee, 100 - this.layout.tee, 50, this.layout.tee < 50 ? 87 : 13][ball.seat];
        Object.assign(ball, { x: tee, y: 83, vx: 0, vy: 0, rotation: 0, phase: 'ready', age: 0, bounced: false });
    }
    hoopAt(time) {
        const level = Math.min(this.baskets - 2, 7);
        const amplitude = level > 0 ? Math.min(17, 7 + level * 2) : 0;
        const speed = .65 + Math.max(0, level) * .11;
        return { x: this.layout.x + Math.sin(time * speed) * amplitude,
            y: Math.max(38, this.layout.y + (level > 3 ? Math.sin(time * .8) * 4 : 0)),
            half: this.baskets < 3 ? 8.5 : 7.8 };
    }
    shoot(id, x, y) {
        const ball = this.balls.get(id);
        if (!ball || ball.phase !== 'ready' || !Number.isFinite(x) || !Number.isFinite(y)) return false;
        const shot = trajectory(ball, x, y);
        Object.assign(ball, { vx: shot.vx, vy: shot.vy, phase: 'flight', age: 0 });
        this.events.push({ type: 'throw', id }); return true;
    }
    tick(dt) {
        const count = Math.max(1, Math.ceil(dt / (1 / 240)));
        for (let i = 0; i < count; i++) this.step(dt / count);
    }
    step(dt) {
        const previousObstacles = this.obstacles, oldHoop = this.hoop;
        this.time += dt; this.cheer = Math.max(0, this.cheer - dt);
        this.obstacles = obstaclesAt(this.theme, this.baskets, this.time);
        if (this.transition) {
            const transition = this.transition;
            transition.age += dt;
            if (transition.age >= .35) {
                this.layout = transition.layout;
                const target = this.hoopAt(this.time), t = clamp((transition.age - .35) / .65, 0, 1), smooth = t * t * (3 - 2 * t);
                this.hoop = { x: transition.from.x + (target.x - transition.from.x) * smooth,
                    y: transition.from.y + (target.y - transition.from.y) * smooth, half: target.half };
                if (t === 1) this.transition = null;
            }
        } else this.hoop = this.hoopAt(this.time);
        for (const ball of this.balls.values()) this.stepBall(ball, dt, oldHoop, previousObstacles);
        const flying = [...this.balls.values()].filter(ball => ball.phase === 'flight');
        for (let i = 0; i < flying.length; i++) for (let j = i + 1; j < flying.length; j++) {
            if (collideBalls(flying[i], flying[j])) this.events.push({ type: 'collision' });
        }
    }
    stepBall(b, dt, oldHoop, previousObstacles) {
        b.age += dt;
        if (b.phase === 'ready') return;
        const oldX = b.x, oldY = b.y;
        b.x += b.vx * dt; b.y += b.vy * dt + GRAVITY * dt * dt / 2; b.vy += GRAVITY * dt;
        b.rotation += b.vx * dt / RADIUS;
        if (b.phase === 'scored') {
            if (b.age > 1) { this.resetBall(b); this.events.push({ type: 'return', id: b.id }); }
            return;
        }
        for (const obstacle of this.obstacles) {
            const previous = previousObstacles.find(o => o.id === obstacle.id) || obstacle;
            if (collideObstacle(b, obstacle, previous, dt)) this.events.push({ type: 'obstacle', id: b.id });
        }
        const h = this.hoop;
        const before = oldY - oldHoop.y, after = b.y - h.y;
        if (b.vy > 0 && before < 0 && after >= 0) {
            const t = -before / (after - before);
            const crossX = oldX + (b.x - oldX) * t;
            const hoopX = oldHoop.x + (h.x - oldHoop.x) * t;
            if (Math.abs(crossX - hoopX) < h.half - RADIUS - .65) {
                this.baskets++; b.score++; b.misses = 0; b.phase = 'scored'; b.age = 0; this.cheer = .8;
                b.x = crossX; b.vx *= .2; b.vy = Math.min(b.vy, 26);
                if (!this.transition) this.transition = { age: 0, from: { ...h }, layout: layouts[this.baskets % layouts.length] };
                this.events.push({ type: 'basket', id: b.id, x: h.x, y: h.y }); return;
            }
        }
        for (const sign of [-1, 1]) {
            const rx = h.x + sign * h.half, dx = b.x - rx, dy = b.y - h.y;
            const distance = Math.hypot(dx, dy), contact = RADIUS + .65;
            if (distance >= contact) continue;
            const nx = distance > .0001 ? dx / distance : 0;
            const ny = distance > .0001 ? dy / distance : -1;
            b.x = rx + nx * contact; b.y = h.y + ny * contact;
            const rimVX = (h.x - oldHoop.x) / dt, rimVY = (h.y - oldHoop.y) / dt;
            const impact = (b.vx - rimVX) * nx + (b.vy - rimVY) * ny;
            if (impact < 0) {
                b.vx -= 1.65 * impact * nx; b.vy -= 1.65 * impact * ny;
                if (impact < -5) this.events.push({ type: 'rim', id: b.id });
            }
        }
        if (b.y > FLOOR - RADIUS && b.vy > 0) {
            b.y = FLOOR - RADIUS; b.vy *= -.5; b.vx *= .78;
            if (!b.bounced) { b.bounced = true; b.floorTime = this.time; this.events.push({ type: 'bounce', id: b.id }); }
        }
        if (b.x < -8 || b.x > 108 || b.age > 4 || (b.bounced && this.time - b.floorTime > .65)) {
            b.misses++; this.resetBall(b); this.events.push({ type: 'return', id: b.id });
        }
    }
}

function collideBalls(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
    if (distance >= RADIUS * 2) return false;
    const nx = distance > .0001 ? dx / distance : 1, ny = distance > .0001 ? dy / distance : 0;
    const overlap = (RADIUS * 2 - distance) / 2;
    a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
    const impact = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (impact >= 0) return false;
    const impulse = -impact * .9;
    a.vx -= impulse * nx; a.vy -= impulse * ny; b.vx += impulse * nx; b.vy += impulse * ny;
    return impact < -3;
}

function contactPoint(ball, o) {
    if (o.shape === 'capsule') {
        const dx = o.bx - o.ax, dy = o.by - o.ay;
        const t = clamp(((ball.x - o.ax) * dx + (ball.y - o.ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        return { x: o.ax + dx * t, y: o.ay + dy * t, t };
    }
    if (o.shape === 'box') {
        let x = clamp(ball.x, o.x - o.hw, o.x + o.hw), y = clamp(ball.y, o.y - o.hh, o.y + o.hh);
        if (x === ball.x && y === ball.y) {
            const edges = [
                { distance: ball.x - (o.x - o.hw), x: o.x - o.hw, y, nx: -1, ny: 0 },
                { distance: o.x + o.hw - ball.x, x: o.x + o.hw, y, nx: 1, ny: 0 },
                { distance: ball.y - (o.y - o.hh), x, y: o.y - o.hh, nx: 0, ny: -1 },
                { distance: o.y + o.hh - ball.y, x, y: o.y + o.hh, nx: 0, ny: 1 },
            ];
            return { ...edges.sort((a, b) => a.distance - b.distance)[0], inside: true };
        }
        return { x, y };
    }
    return { x: o.x, y: o.y };
}
function collideObstacle(ball, o, previous, dt) {
    const p = contactPoint(ball, o), dx = ball.x - p.x, dy = ball.y - p.y;
    const distance = Math.hypot(dx, dy), radius = RADIUS + (o.radius || 0);
    if (!p.inside && distance >= radius) return false;
    const nx = p.inside ? p.nx : distance > .0001 ? dx / distance : 0;
    const ny = p.inside ? p.ny : distance > .0001 ? dy / distance : -1;
    const last = o.shape === 'capsule'
        ? { x: previous.ax + (previous.bx - previous.ax) * p.t, y: previous.ay + (previous.by - previous.ay) * p.t }
        : { x: p.x + previous.x - o.x, y: p.y + previous.y - o.y };
    const vx = (p.x - last.x) / dt, vy = (p.y - last.y) / dt;
    ball.x = p.x + nx * radius; ball.y = p.y + ny * radius;
    const impact = (ball.vx - vx) * nx + (ball.vy - vy) * ny;
    if (impact < 0) { ball.vx -= impact * nx * 1.7; ball.vy -= impact * ny * 1.7; }
    return impact < -5;
}

module.exports = { Court, trajectory, clamp, RADIUS, GRAVITY, FLOOR, collideObstacle, collideBalls };
