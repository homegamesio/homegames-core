'use strict';

const { Game, GameNode, Asset, ShapeUtils } = require('squish-150');
const { Court, trajectory, clamp } = require('./physics');
const { Art, C, HIDDEN, shape, add, group, paint, ellipse, stroke, alpha } = require('./art');
const { THEMES, DURATIONS } = require('./themes');
const { readRecords, recordRound, keyFor } = require('./records');
const { Interface } = require('./interface');
const SCENE_INTERVAL_MS = 1000 / 30;

class Swish extends Game {
    static metadata() {
        return {
            name: 'Swish',
            author: "Joseph Garcia",
            description: 'made with squish',
            thumbnail: './assets/thumbnail.png',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 60,
            maxPlayers: 4,
            assets: {
                bounce: new Asset({ path: './assets/bounce.wav', type: 'audio' }),
                basket: new Asset({ path: './assets/basket.wav', type: 'audio' }),
            },
            gameId: "6f50ddde-0cbe-479f-94dc-19a33bf297db"
        };
    }
    constructor(options = {}) {
        super();
        this.options = options; this.now = options.now || Date.now; this.lastTick = this.now();
        this.nextSceneAt = this.lastTick + SCENE_INTERVAL_MS;
        this.records = readRecords(options.saveData); this.theme = this.records.theme; this.duration = this.records.duration;
        this.remaining = this.duration; this.round = 'setup'; this.owner = null;
        this.court = new Court(this.theme, []); this.players = new Map(); this.roundScores = new Map();
        this.time = 0; this.particles = []; this.lastSound = -1; this.soundUntil = 0;
        this.saveFailed = false; this.saveRevision = 0; this.saveTail = Promise.resolve();
        this.base = shape(ShapeUtils.rectangle(0, 0, 100, 100), C.wall);
        this.world = group(this.base); this.wall = group(this.base); this.menu = group(this.base); this.audio = group(this.base);
        this.art = new Art(this.world, this.theme); this.ui = new Interface(this, this.wall, this.menu);
        // One stable surface: a drag may start anywhere, including over the hoop,
        // scoreboard or another ball. Each player can only launch their own ball.
        this.surface = add(this.base, ShapeUtils.rectangle(0, 0, 100, 100), [0, 0, 0, 0], {
            onClick: (id, x, y) => this.press(id, x, y),
            onDrag: (id, x, y) => this.move(id, x, y),
            // The dispatcher also ends captures on cancellation or replacement.
            // Only an actual mouseup may launch; ending capture just cancels.
            offClick: id => this.cancelPress(id),
        });
        this.ui.showMenu(); this.draw();
    }
    getLayers() { return [{ root: this.base }]; }
    canAddPlayer() { return this.players.size < 4; }
    best() { return this.records.scores[keyFor(this.theme, this.duration)]?.[0] || 0; }
    betweenRounds() { return this.round === 'setup' || this.round === 'results'; }
    handleNewPlayer({ playerId }) {
        if (!Number.isSafeInteger(playerId) || playerId < 1 || this.players.has(playerId) || !this.canAddPlayer()) return;
        this.players.set(playerId, { drag: null, pressed: false, idle: 0, touched: false, pop: 0 }); this.court.join(playerId);
        if (this.owner === null) this.owner = playerId;
        if (!this.betweenRounds()) this.roundScores.set(playerId, 0);
        this.art.addPlayer(playerId, this.court.balls.get(playerId).seat);
        this.ui.buildWall(); if (this.betweenRounds()) this.ui.showMenu(); this.draw();
    }
    handlePlayerDisconnect(id) {
        if (!this.players.has(id)) return;
        if (!this.betweenRounds()) this.roundScores.set(id, this.court.balls.get(id).score);
        this.players.delete(id); this.court.leave(id); this.art.removePlayer(id);
        // Only five departed scores can reach the saved top-five table.
        const departed = [...this.roundScores].filter(([key]) => !this.players.has(key)).sort((a,b) => b[1]-a[1]);
        for (const [key] of departed.slice(5)) this.roundScores.delete(key);
        if (this.owner === id) this.owner = this.players.keys().next().value ?? null;
        if (!this.players.size) { this.round = 'setup'; this.remaining = this.duration; this.roundScores.clear(); }
        this.ui.buildWall(); if (this.betweenRounds()) this.ui.showMenu();
    }
    rebuildCourt() {
        this.world.clearChildren(); this.art = new Art(this.world, this.theme);
        for (const ball of this.court.balls.values()) this.art.addPlayer(ball.id, ball.seat);
        this.particles = []; this.ui.buildWall();
    }
    choose(id, { theme, duration } = {}) {
        if (id !== this.owner || !this.betweenRounds()) return false;
        if (theme !== undefined && !Object.hasOwn(THEMES, theme)) return false;
        if (duration !== undefined && !DURATIONS.includes(duration)) return false;
        if ((theme ?? this.theme) === this.theme && (duration ?? this.duration) === this.duration) return true;
        this.theme = theme ?? this.theme; this.duration = duration ?? this.duration;
        this.records.theme = this.theme; this.records.duration = this.duration;
        this.court = new Court(this.theme, [...this.players.keys()]); this.round = 'setup'; this.remaining = this.duration;
        this.rebuildCourt(); this.ui.showMenu(); this.persist(); this.draw(); return true;
    }
    startRound(id) {
        if (id !== this.owner || !this.betweenRounds()) return false;
        this.court = new Court(this.theme, [...this.players.keys()]);
        this.round = 'playing'; this.remaining = this.duration; this.lastTick = this.now(); this.deadline = this.lastTick + this.duration * 1000;
        this.roundScores = new Map([...this.players.keys()].map(player => [player, 0]));
        for (const p of this.players.values()) Object.assign(p, { drag: null, idle: 0, touched: false, pop: 0 });
        this.rebuildCourt(); this.menu.clearChildren(); this.audio.clearChildren(); this.soundUntil = 0; this.pendingSound = null;
        this.persist(); this.draw(); return true;
    }
    checkClock() {
        if (this.round !== 'playing') return;
        this.remaining = Math.max(0, Math.min(this.remaining, (this.deadline - this.now()) / 1000));
        if (this.remaining > 0) return;
        this.round = 'closing'; this.closingDeadline = this.deadline + 5000;
        for (const p of this.players.values()) p.drag = null;
        if (![...this.court.balls.values()].some(b => b.phase !== 'ready')) this.finishRound();
    }
    finishRound() {
        if (this.round !== 'closing') return;
        for (const b of this.court.balls.values()) this.roundScores.set(b.id, b.score);
        for (const score of this.roundScores.values()) recordRound(this.records, this.theme, this.duration, score);
        this.round = 'results'; this.remaining = 0;
        this.persist(); this.ui.update(); this.ui.showMenu();
    }
    persist() {
        const revision = ++this.saveRevision, data = readRecords(this.records);
        // Call saveGame immediately so the host's close/flush contract sees the
        // newest snapshot. The platform coalesces and orders its storage writes.
        try {
            this.saveTail = Promise.resolve(this.options.saveGame?.(data)).then(() => {
                if (revision === this.saveRevision) this.saveFailed = false;
            }, () => { if (revision === this.saveRevision) this.saveFailed = true; });
        } catch (_) { this.saveFailed = true; this.saveTail = Promise.resolve(); }
        this.saveTail.then(() => { if (!this.closed && this.betweenRounds()) this.ui.showMenu(); });
        return this.saveTail;
    }
    press(id, x, y) {
        const p = this.players.get(id);
        if (!p || p.pressed || !Number.isFinite(x) || !Number.isFinite(y)) return;
        p.pressed = true;
        this.checkClock();
        if (this.betweenRounds()) {
            if (id !== this.owner) return;
            const action = this.ui.hit(x, y); if (!action) return;
            if (action.start) this.startRound(id);
            else if (action.retry && this.saveFailed) this.persist();
            else if (!action.retry) this.choose(id, action);
            return;
        }
        const ball = this.court.balls.get(id);
        if (this.round !== 'playing' || ball.phase !== 'ready' || p.drag) return;
        p.drag = { x: ball.x, y: ball.y, startX: x, startY: y, originX: ball.x, originY: ball.y, moved: false };
        p.idle = 0; p.touched = true; this.draw();
    }
    move(id, x, y) {
        const drag = this.players.get(id)?.drag;
        if (!drag || !Number.isFinite(x) || !Number.isFinite(y)) return;
        const dx = x - drag.startX, dy = y - drag.startY;
        drag.x = clamp(drag.originX + dx, 3, 97); drag.y = clamp(drag.originY + dy, 10, 94);
        drag.moved = Math.hypot(dx, dy) > 3;
    }
    release(id, x, y) {
        this.checkClock();
        const p = this.players.get(id); if (!p) return;
        p.pressed = false;
        if (!p.drag) return;
        if (!Number.isFinite(x) || !Number.isFinite(y)) { p.drag = null; this.draw(); return; }
        this.move(id, x, y); const drag = p.drag; p.drag = null;
        if (this.round === 'playing' && drag.moved && drag.y < drag.originY - 5) this.court.shoot(id, drag.x, drag.y);
        p.idle = 0; this.draw();
    }
    cancelPress(id) {
        const p = this.players.get(id); if (p) { p.drag = null; p.pressed = false; }
    }
    handleMouseUp(id, point) {
        if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) this.release(id, point.x, point.y);
        this.cancelPress(id);
    }
    handleKeyDown(id, key) { if (key === 'Escape' && this.players.has(id)) this.players.get(id).drag = null; }
    sound(name) {
        if (this.time - this.lastSound < .09) return;
        this.pendingSound = name;
        this.lastSound = this.time; this.soundUntil = this.time + .85;
    }
    celebrate(event) {
        this.sound('basket'); this.particles = [];
        for (let i = 0; i < 40; i++) {
            const a = -Math.PI + i * Math.PI / 39, speed = 13 + (i * 17 % 19);
            this.particles.push({ x: event.x, y: event.y, vx: Math.cos(a) * speed,
                vy: Math.sin(a) * speed - 7, life: .6 + (i % 7) * .09, age: 0,
                color: [C.gold, C.cream, C.ball, [117, 169, 153, 255]][i % 4] });
        }
    }
    tick() {
        if (this.closed) return;
        const wasBetween = this.betweenRounds();
        const now = this.now(), dt = clamp((now-this.lastTick)/1000, 0, .25);
        this.lastTick = now; this.time += dt; this.checkClock();
        if (wasBetween && this.betweenRounds() && !this.soundUntil && this.particles.every(p => p.age >= p.life)) return;
        if (!this.betweenRounds()) this.court.tick(dt);
        for (const p of this.players.values()) { p.idle += dt; p.pop = Math.max(0, p.pop - dt); }
        for (const event of this.court.events.splice(0)) {
            if (event.type === 'basket') { this.celebrate(event); this.roundScores.set(event.id, this.court.balls.get(event.id).score); }
            if (['rim', 'bounce', 'obstacle', 'collision'].includes(event.type)) this.sound('bounce');
            if (event.type === 'return' && this.players.has(event.id)) this.players.get(event.id).pop = .25;
        }
        if (this.round === 'closing') {
            if (now >= this.closingDeadline || ![...this.court.balls.values()].some(b => b.phase !== 'ready')) this.finishRound();
        }
        for (const p of this.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 35 * dt; }
        if (now + .01 >= this.nextSceneAt) {
            this.nextSceneAt += SCENE_INTERVAL_MS;
            if (this.nextSceneAt <= now) this.nextSceneAt = now + SCENE_INTERVAL_MS;
            this.draw();
        }
    }
    draw() {
        const c = this.court, a = this.art;
        if (this.pendingSound) {
            this.audio.clearChildren();
            this.audio.addChild(new GameNode.Asset({ coordinates2d: HIDDEN,
                assetInfo: { [this.pendingSound]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } } }), false);
            this.pendingSound = null;
        } else if (this.soundUntil && this.time >= this.soundUntil) { this.audio.clearChildren(); this.soundUntil = 0; }
        a.drawHoop(c.hoop, c.cheer > 0 ? .8 - c.cheer + .001 : 0);
        a.drawObstacles(c.obstacles, c.time); a.hint(0, 0, 0);
        for (const ball of c.balls.values()) {
            const p = this.players.get(ball.id), ready = this.round === 'playing' && ball.phase === 'ready';
            let scale = p.pop > 0 ? 1 + Math.sin(p.pop / .25 * Math.PI) * .18 : p.drag ? 1.1 : 1;
            if (ball.phase === 'scored') scale = Math.max(0, 1 - Math.max(0, ball.age - .28) / .25);
            const aim = ready && p.drag?.moved && p.drag.y < p.drag.originY - 5 ? trajectory(ball, p.drag.x, p.drag.y) : null;
            a.drawBall(ball, scale, ready, aim, this.time);
            // A short gesture, not an answer key. No arc or endpoint at the hoop.
            if (ready && !p.drag && !p.touched && ball.score === 0 && p.idle > 2 && ball.id === this.owner) {
                const t = ((p.idle - 2) % 5) / 1.4;
                a.guide.node.playerIds = [ball.id]; a.guideRing.node.playerIds = [ball.id];
                if (t < 1) a.hint(ball.x + t * 6, ball.y - t * 13, Math.min(1, t * 8, (1 - t) * 6) * .7);
            }
        }
        a.burst.forEach((node, i) => {
            const p = this.particles[i];
            if (!p || p.age >= p.life) return paint(node, HIDDEN);
            const s = .7 * (1 - p.age / p.life), angle = p.age * 5 + i;
            const points = [[-s, -s * .4], [s, -s * .4], [s, s * .4], [-s, s * .4], [-s, -s * .4]];
            paint(node, points.map(([x, y]) => [p.x + x * Math.cos(angle) - y * Math.sin(angle), p.y + x * Math.sin(angle) + y * Math.cos(angle)]), p.color);
        });
        const age = .8 - c.cheer, ring = c.cheer > .2;
        paint(a.sparkRing, ring ? stroke(ellipse(c.hoop.x, c.hoop.y, 9 + age * 22, 4 + age * 14), .3) : HIDDEN,
            alpha(C.gold, ring ? 1 - age / .6 : 0));
        this.ui.update(); a.prune(); this.base.node.onStateChange();
    }
    close() { this.closed = true; for (const p of this.players.values()) p.drag = null; this.audio.clearChildren(); super.close(); }
}
module.exports = Swish;
