'use strict';

const RULES = Object.freeze({ seconds: 600, hz: 60, dropInterval: .5, spawnInterval: 1.25,
    thresholds: [5000, 50000], costs: [2, 20, 1600], values: [5, 30, 2000], speeds: [1, 1.5, 2.5], fishLimits: [6, 5, 4] });
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

class WillieWorld {
    constructor(random = Math.random) { this.random = random; this.reset(); }
    reset() {
        this.phase = 'ready'; this.time = 0; this.level = 1; this.cash = 100; this.total = 0; this.multiplier = 1;
        this.x = 42.5; this.direction = 'left'; this.fish = []; this.loads = []; this.popups = [];
        this.nextId = 1; this.nextDrop = 0; this.nextFish = 0; this.lastHit = -Infinity;
    }
    integer(min, max) { return Math.floor(clamp(this.random(), 0, 1 - Number.EPSILON) * (max - min + 1)) + min; }
    start() { if (this.phase === 'ready') { this.phase = 'running'; this.spawnFish(); this.nextFish = RULES.spawnInterval; } }
    finish(reason) { if (this.phase === 'running') { this.phase = reason; this.popups = []; } }
    popup(text, x, y, color) { this.popups.push({ text, x: clamp(x, 15, 85), y: clamp(y, 15, 82), color, expires: this.time + 1 }); }
    drop() {
        if (this.phase !== 'running' || this.cash < 0 || this.time + 1e-9 < this.nextDrop) return false;
        const cost = RULES.costs[this.level - 1]; this.cash -= cost; this.nextDrop = this.time + RULES.dropInterval;
        this.loads.push({ id: this.nextId++, x: this.x + 20, y: 41, w: 5, h: 5, level: this.level });
        this.popup(`-$${cost}`, this.x + 22.5, 41, '#b52525'); return true;
    }
    spawnFish() {
        if (this.fish.length >= RULES.fishLimits[this.level - 1]) return;
        const type = this.integer(1, this.level), right = this.integer(0, 100) < 50;
        this.fish.push({ id: this.nextId++, type, x: right ? 0 : 86, y: this.integer(35, 86), w: 14, h: 14,
            vx: (right ? 1 : -1) * (RULES.speeds[type - 1] * .1 + this.integer(0, 1) / 4) * 60,
            vy: (this.integer(0, 1) ? -1 : 1) * .3, direction: right ? 'right' : 'left', served: false });
    }
    serve(fish) {
        if (fish.served || this.phase !== 'running') return false;
        fish.served = true;
        const value = RULES.values[fish.type - 1], earned = value * this.multiplier;
        this.cash += earned; this.total += earned;
        this.popup(`+$${value} x ${this.multiplier}`, fish.x + 7, fish.y + 7, '#101010');
        this.multiplier++; this.lastHit = this.time;
        while (this.level < 3 && this.cash >= RULES.thresholds[this.level - 1]) this.level++;
        fish.vx = (fish.direction === 'left' ? -1 : 1) * 12 * this.integer(1, 3); fish.vy = -25.2;
        return true;
    }
    step(dt, controls = {}) {
        if (this.phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
        this.time += dt;
        const direction = Number(!!controls.right) - Number(!!controls.left);
        if (direction) { this.x = clamp(this.x + direction * 30 * dt, 0, 55); this.direction = direction < 0 ? 'left' : 'right'; }
        if (controls.drop) this.drop();
        if (this.time + 1e-9 >= this.nextFish) { this.spawnFish(); this.nextFish = this.time + RULES.spawnInterval; }
        for (const fish of this.fish) { fish.x += fish.vx * dt; fish.y += fish.vy * dt; }
        for (const load of this.loads) {
            load.y += 21 * dt;
            const hit = this.fish.find(f => !f.served && overlaps(load, f));
            if (hit) { this.serve(hit); load.done = true; }
            else if (load.y >= 95) { load.done = true; this.multiplier = 1; }
        }
        this.loads = this.loads.filter(load => !load.done);
        this.fish = this.fish.filter(f => f.x >= 0 && f.x <= 86 && f.y >= 0 && f.y <= 86);
        this.popups = this.popups.filter(p => p.expires > this.time);
        if (this.time - this.lastHit > 3.5) this.multiplier = 1;
        if (this.cash < 0 && !this.loads.length) this.finish('perished');
    }
}
module.exports = { WillieWorld, RULES };
