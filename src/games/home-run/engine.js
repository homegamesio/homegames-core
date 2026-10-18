'use strict';

const PITCHES = 10;
const CONTACT_AT = 2;
const WINDOW = .42;
const GRAVITY = 9.8;
const FENCE = 90;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Timing changes both launch power and direction. Distances come from a
// ballistic flight; the fence is a real distance, not a random score roll.
function hitFor(offset) {
    if (!Number.isFinite(offset) || Math.abs(offset) > WINDOW) return null;
    const quality = 1 - Math.abs(offset) / WINDOW;
    const speed = 23 + 13 * quality;
    const loft = .44 + .26 * quality;
    const vx = speed * Math.cos(loft), vz = speed * Math.sin(loft);
    const duration = (vz + Math.sqrt(vz * vz + 2 * GRAVITY)) / GRAVITY;
    const distance = vx * duration;
    const points = distance >= FENCE ? 4 : distance >= 68 ? 3 : distance >= 48 ? 2 : 1;
    return { quality, vx, vz, duration, distance, angle: clamp(offset / WINDOW, -1, 1) * .62,
        points, label: ['', 'SINGLE!', 'DOUBLE!', 'TRIPLE!', 'HOME RUN!'][points] };
}

function flightAt(hit, age) {
    const t = clamp(age * 2.2, 0, hit.duration);
    return { distance: hit.vx * t, height: Math.max(0, 1 + hit.vz * t - GRAVITY * t * t / 2) };
}

class Match {
    constructor() {
        this.phase = 'setup'; this.age = 0; this.time = 0;
        this.pitch = 0; this.score = 0; this.hits = 0; this.homers = 0; this.longest = 0;
        this.swingAt = -100; this.hit = null; this.events = []; this.history = [];
        this.message = 'One button. Big little hits.';
    }
    start() {
        if (!['setup', 'results'].includes(this.phase)) return false;
        this.phase = 'windup'; this.age = 0; this.pitch = 1;
        this.score = this.hits = this.homers = this.longest = 0;
        this.hit = null; this.history = []; this.events = []; this.swingAt = -100;
        this.message = 'Here comes the ball!'; return true;
    }
    contactReady() { return this.phase === 'pitch' && Math.abs(this.age - CONTACT_AT) <= WINDOW; }
    swing() {
        if (!['windup', 'pitch'].includes(this.phase) || this.time - this.swingAt < .38) return false;
        this.swingAt = this.time;
        const hit = this.phase === 'pitch' ? hitFor(this.age - CONTACT_AT) : null;
        if (!hit) { this.message = 'Wait for the ball in the ring'; this.events.push('swing'); return false; }
        this.hit = hit; this.phase = 'flight'; this.age = 0;
        this.score += hit.points; this.hits++; this.homers += Number(hit.points === 4);
        this.longest = Math.max(this.longest, Math.round(hit.distance));
        this.history.push(hit.points); this.message = hit.label;
        this.events.push(hit.points === 4 ? 'homer' : 'hit'); return true;
    }
    step(dt) {
        if (!Number.isFinite(dt) || dt <= 0 || ['setup', 'results'].includes(this.phase)) return;
        this.time += dt; this.age += dt;
        if (this.phase === 'windup' && this.age >= .85) {
            this.age -= .85; this.phase = 'pitch'; this.message = 'Watch the ball…';
        } else if (this.phase === 'pitch') {
            if (this.age > CONTACT_AT + WINDOW + .18) {
                this.phase = 'rest'; this.age = 0; this.history.push(0);
                this.message = 'Next one is yours!'; this.events.push('miss');
            } else if (this.contactReady()) this.message = 'SWING!';
        } else if (this.phase === 'flight' && this.age >= this.hit.duration / 2.2 + .25) {
            this.phase = 'rest'; this.age = 0;
        } else if (this.phase === 'rest' && this.age >= 1.05) {
            if (this.pitch === PITCHES) {
                this.phase = 'results'; this.events.push('finish');
            } else {
                this.pitch++; this.phase = 'windup'; this.age = 0; this.hit = null;
                this.message = 'Here comes the ball!';
            }
        }
    }
}

module.exports = { Match, hitFor, flightAt, CONTACT_AT, WINDOW, PITCHES, FENCE, clamp };
