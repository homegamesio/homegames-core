'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const TYPES = ['wall', 'bumper', 'fan', 'ramp', 'moving'];
const RADIUS = 1.25;
function design(value) {
    const point = (v, fallback) => ({ x: clamp(v?.x ?? fallback.x, 10, 90), y: clamp(v?.y ?? fallback.y, 26, 74) });
    return { version: 1, tee: point(value?.tee, { x: 17, y: 68 }), cup: point(value?.cup, { x: 83, y: 31 }),
        obstacles: (Array.isArray(value?.obstacles) ? value.obstacles : []).filter(o => o && TYPES.includes(o.type)).slice(0, 14)
            .map(o => ({ type: o.type, x: clamp(o.x, 18, 82), y: clamp(o.y, 34, 66), rotation: clamp(Math.floor(o.rotation), 0, 3) })) };
}
function geometry(obstacle, time = 0) {
    const vertical = obstacle.rotation % 2 === 1;
    const travel = obstacle.type === 'moving' ? Math.sin(time * 1.7) * 7 : 0;
    return { x: obstacle.x + (vertical ? travel : 0), y: obstacle.y + (vertical ? 0 : travel),
        w: vertical ? 3 : 14, h: vertical ? 14 : 3 };
}
function reflect(ball, nx, ny, bounce = .8) {
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) { ball.vx -= (1 + bounce) * dot * nx; ball.vy -= (1 + bounce) * dot * ny; }
}
function wall(ball, box) {
    const left = box.x - box.w / 2, top = box.y - box.h / 2;
    const nearX = clamp(ball.x, left, left + box.w), nearY = clamp(ball.y, top, top + box.h);
    const dx = ball.x - nearX, dy = ball.y - nearY, distance = Math.hypot(dx, dy);
    if (distance >= RADIUS) return;
    if (distance > .00001) {
        ball.x = nearX + dx / distance * (RADIUS + .01); ball.y = nearY + dy / distance * (RADIUS + .01);
        reflect(ball, dx / distance, dy / distance);
    } else {
        // Resolve a moving wall sweeping over the centre of the ball.
        const sides = [
            { d: ball.x - left, x: left - RADIUS - .01, y: ball.y, nx: -1, ny: 0 },
            { d: left + box.w - ball.x, x: left + box.w + RADIUS + .01, y: ball.y, nx: 1, ny: 0 },
            { d: ball.y - top, x: ball.x, y: top - RADIUS - .01, nx: 0, ny: -1 },
            { d: top + box.h - ball.y, x: ball.x, y: top + box.h + RADIUS + .01, nx: 0, ny: 1 }
        ].sort((a, b) => a.d - b.d);
        Object.assign(ball, { x: sides[0].x, y: sides[0].y }); reflect(ball, sides[0].nx, sides[0].ny);
    }
}
class Golf {
    constructor(course, ids) { this.course = design(course); this.balls = new Map(); this.time = 0; ids.forEach(id => this.join(id)); }
    join(id) { if (this.balls.size < 4 && !this.balls.has(id)) this.balls.set(id, { id, ...this.course.tee, vx: 0, vy: 0, strokes: 0, sunk: false, retired: false, age: 0, rampCooldown: 0 }); }
    leave(id) { this.balls.delete(id); }
    stationary(ball) { return !!ball && !ball.sunk && !ball.retired && Math.hypot(ball.vx, ball.vy) === 0; }
    shoot(id, dx, dy, power) {
        const ball = this.balls.get(id), distance = Math.hypot(dx, dy);
        if (!this.stationary(ball) || !Number.isFinite(distance) || distance < .01 || ball.strokes >= 12) return false;
        const speed = 15 + clamp(power, 0, 1) * 70;
        ball.vx = dx / distance * speed; ball.vy = dy / distance * speed; ball.strokes++; ball.age = 0; return true;
    }
    get finished() { return this.balls.size > 0 && [...this.balls.values()].every(b => b.sunk || b.retired); }
    tick(dt) {
        // Small fixed substeps keep even maximum-power shots from tunnelling through thin walls.
        let remaining = clamp(dt, 0, .1);
        while (remaining > .000001) { const step = Math.min(remaining, 1 / 120); remaining -= step; this.step(step); }
    }
    step(dt) {
        this.time += dt;
        for (const ball of this.balls.values()) {
            if (ball.sunk || ball.retired || !Math.hypot(ball.vx, ball.vy)) continue;
            ball.age += dt; ball.rampCooldown = Math.max(0, ball.rampCooldown - dt);
            for (const o of this.course.obstacles) {
                const dx = ball.x - o.x, dy = ball.y - o.y, angle = o.rotation * Math.PI / 2;
                if (o.type === 'fan' && Math.abs(dx) < 9 && Math.abs(dy) < 9) { ball.vx += Math.cos(angle) * 24 * dt; ball.vy += Math.sin(angle) * 24 * dt; }
                if (o.type === 'ramp' && Math.abs(dx) < 4 && Math.abs(dy) < 4 && !ball.rampCooldown) {
                    ball.vx += Math.cos(angle) * 28; ball.vy += Math.sin(angle) * 28; ball.rampCooldown = .8;
                }
            }
            const speed = Math.hypot(ball.vx, ball.vy), capped = Math.min(100, speed);
            ball.vx *= capped / speed; ball.vy *= capped / speed;
            ball.x += ball.vx * dt; ball.y += ball.vy * dt;
            for (const o of this.course.obstacles) {
                if (o.type === 'wall' || o.type === 'moving') wall(ball, geometry(o, this.time));
                else if (o.type === 'bumper') {
                    const dx = ball.x - o.x, dy = ball.y - o.y, distance = Math.hypot(dx, dy);
                    if (distance < 3.3 + RADIUS) { const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
                        ball.x = o.x + nx * (3.3 + RADIUS + .01); ball.y = o.y + ny * (3.3 + RADIUS + .01); reflect(ball, nx, ny, 1.1); }
                }
            }
            if (ball.x < 6 + RADIUS) { ball.x = 6 + RADIUS; reflect(ball, 1, 0); }
            if (ball.x > 94 - RADIUS) { ball.x = 94 - RADIUS; reflect(ball, -1, 0); }
            if (ball.y < 22 + RADIUS) { ball.y = 22 + RADIUS; reflect(ball, 0, 1); }
            if (ball.y > 78 - RADIUS) { ball.y = 78 - RADIUS; reflect(ball, 0, -1); }
            if (Math.hypot(ball.x - this.course.cup.x, ball.y - this.course.cup.y) < 2.6 && Math.hypot(ball.vx, ball.vy) < 24) {
                ball.sunk = true; ball.x = this.course.cup.x; ball.y = this.course.cup.y; ball.vx = ball.vy = 0; continue;
            }
            const moving = Math.hypot(ball.vx, ball.vy), slowed = Math.max(0, moving - 12 * dt);
            if (slowed < .8 || ball.age > 12) { ball.vx = ball.vy = 0; if (ball.strokes >= 12) ball.retired = true; }
            else { ball.vx *= slowed / moving; ball.vy *= slowed / moving; }
        }
    }
}
module.exports = { design, Golf, geometry, TYPES };
