// A small deterministic arcade vehicle model. World units are also the art's
// 150 x 100 design units; y points down, and terrain repeats without a seam.
const TAU = Math.PI * 2;
const courseLength = 720;
const terrainKnots = [
    [0, 70], [96, 70], [132, 52], [142, 52], [180, 70],
    [224, 70], [250, 63], [276, 70], [320, 70], [358, 50],
    [374, 50], [416, 70], [454, 70], [476, 74], [500, 70],
    [546, 70], [584, 54], [596, 54], [632, 70], [720, 70]
];
const ramps = [
    { start: 96, crest: 132, end: 180, height: 18 },
    { start: 320, crest: 358, end: 416, height: 20 },
    { start: 546, crest: 584, end: 632, height: 16 }
];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const wrap = n => ((n % courseLength) + courseLength) % courseLength;
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function terrainHeight(x) {
    if (!Number.isFinite(x)) return 70;
    const local = wrap(x);
    for (let i = 1; i < terrainKnots.length; i++) {
        const a = terrainKnots[i - 1], b = terrainKnots[i];
        if (local <= b[0]) return a[1] + (b[1] - a[1]) * (local - a[0]) / (b[0] - a[0]);
    }
    return 70;
}

function terrainPoints(start, end, step = 4) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    const xs = [start, end];
    // Include corners as well as samples, so the drawn ramp matches collisions.
    if (end - start <= courseLength * 2) {
        for (let lap = Math.floor(start / courseLength); lap <= Math.floor(end / courseLength); lap++) {
            for (const p of terrainKnots) {
                const x = p[0] + lap * courseLength;
                if (x > start && x < end) xs.push(x);
            }
        }
    }
    const spacing = Math.max(1, Number.isFinite(step) ? step : 4, (end - start) / Math.max(1, 108 - xs.length));
    for (let x = start + spacing; x < end; x += spacing) xs.push(x);
    xs.sort((a, b) => a - b);
    return xs.filter((x, i) => !i || x - xs[i - 1] > .0001).map(x => [x, terrainHeight(x)]);
}

function roadPose(x) {
    let angle = Math.atan2(terrainHeight(x + 12) - terrainHeight(x - 11), 23);
    let y = 60.7;
    // Account for the wheelbase rotating on a slope, rather than sinking a tire
    // into a ramp when the cab tilts. Both tires have a 4.3-unit radius.
    for (let i = 0; i < 3; i++) {
        const c = Math.cos(angle), s = Math.sin(angle);
        const rear = terrainHeight(x - 11 * c - 5 * s);
        const front = terrainHeight(x + 12 * c - 5 * s);
        angle = Math.atan2(front - rear, 23 * c);
        y = (rear + front) / 2 - .5 * Math.sin(angle) - 5 * Math.cos(angle) - 4.3;
    }
    return { y, angle };
}

class TruckWorld {
    get canFlip() { return !this.grounded && !this._flipUsed; }
    constructor() {
        this.x = 48;
        this.y = 60.7;
        this.angle = 0;
        this.vx = 0;
        this.vy = 0;
        this.spin = 0;
        this.grounded = true;
        this.wheelAngle = 0;
        this.airTime = 0;
        this.flips = 0;
        this.events = [];
        this.suspension = 0;
        this._accumulator = 0;
        this._flipHeld = false;
        this._flipUsed = false;
        this._flipCompleted = false;
        this._flip = null;
        this._landingTime = 0;
    }

    emit(type, details = {}) {
        if (this.events.length < 8) this.events.push({ type, ...details });
    }

    reset() {
        // Nearby flat clearings keep the adventure going instead of restarting
        // the entire course. This also works when cruising in reverse.
        const x = Number.isFinite(this.x) ? this.x : 48;
        const lap = Math.floor(x / courseLength);
        const candidates = [];
        for (let l = lap - 1; l <= lap + 1; l++) for (const p of [48, 204, 300, 436, 524, 678]) candidates.push(p + l * courseLength);
        this.x = candidates.reduce((best, p) => Math.abs(p - x) < Math.abs(best - x) ? p : best, candidates[0]);
        const pose = roadPose(this.x);
        this.y = pose.y;
        this.angle = pose.angle;
        this.vx = this.vy = this.spin = this.airTime = this.suspension = 0;
        this.grounded = true;
        this._accumulator = this._landingTime = 0;
        this._flip = null;
        this._flipUsed = false;
        this._flipCompleted = false;
        this._flipHeld = false;
        this.events = [{ type: 'reset' }];
    }

    startFlip() {
        if (this.grounded || this._flipUsed) return false;
        const direction = this.vx < -1 ? 1 : -1;
        this._flip = { from: this.angle, to: this.angle + direction * TAU, time: 0, duration: 1.08 };
        this._flipUsed = true;
        // A little extra lift guarantees time to finish a toddler's late tap.
        this.vy = Math.min(this.vy, -22);
        this.emit('flipStart');
        return true;
    }

    step(dt, controls = {}) {
        this.events = [];
        if (!Number.isFinite(dt) || dt <= 0) return;
        const drive = controls.drive === 1 ? 1 : controls.drive === -1 ? -1 : 0;
        const flip = controls.flip === true;
        if (flip && !this._flipHeld) this.startFlip();
        this._flipHeld = flip;
        this._accumulator += Math.min(dt, .1);
        const h = 1 / 120;
        while (this._accumulator + 1e-10 >= h) {
            this._accumulator -= h;
            this.substep(h, drive);
        }
        if (![this.x, this.y, this.angle, this.vx, this.vy, this.spin].every(Number.isFinite) || this.y > 110 || this.y < -100 || Math.abs(this.x) > 10000000) this.reset();
    }

    substep(h, drive) {
        const previousX = this.x;
        const targetSpeed = drive > 0 ? 34 : drive < 0 ? -18 : 0;
        const grip = this.grounded ? (drive ? 3.5 : 9) : (drive ? .55 : .7);
        this.vx += (targetSpeed - this.vx) * (1 - Math.exp(-grip * h));
        if (!drive && Math.abs(this.vx) < .025) this.vx = 0;
        this.x += this.vx * h;
        this.wheelAngle = (this.wheelAngle + this.vx * h / 4.3) % TAU;
        const pose = roadPose(this.x);

        if (this.grounded) {
            // Critically damped springs give the cab a gentle suspension bob.
            const error = pose.y - this.y;
            this.vy += (error * 190 - this.vy * 26) * h;
            this.y += this.vy * h;
            this.y = clamp(this.y, pose.y - 1.1, pose.y + .45);
            this.suspension = clamp(this.y - pose.y, -1.1, .65);
            const rotation = angleDifference(pose.angle, this.angle);
            this.spin += (rotation * 130 - this.spin * 22) * h;
            this.spin = clamp(this.spin, -8, 8);
            this.angle += this.spin * h;
            this._landingTime = Math.max(0, this._landingTime - h);
            // The launch comes from crossing an uphill lip at driving speed,
            // never from pressing the flip button on ordinary flat ground.
            if (this.vx > 13 && !this._landingTime) {
                for (const ramp of ramps) {
                    const lip = Math.floor(this.x / courseLength) * courseLength + ramp.crest - 3;
                    if (previousX < lip && this.x >= lip) {
                        this.grounded = false;
                        this.airTime = 0;
                        this._flipUsed = false;
                        this._flipCompleted = false;
                        this._flip = null;
                        this.vy = -27 - Math.min(6, Math.abs(this.vx) * .15);
                        this.spin *= .15;
                        this.emit('launch', { speed: this.vx });
                        break;
                    }
                }
            }
        } else {
            this.airTime += h;
            this.vy += 38 * h;
            this.y += this.vy * h;
            this.suspension *= Math.exp(-8 * h);
            if (this._flip) {
                const flip = this._flip;
                flip.time = Math.min(flip.duration, flip.time + h);
                const t = flip.time / flip.duration;
                this.angle = flip.from + (flip.to - flip.from) * (1 - Math.cos(t * Math.PI)) / 2;
                this.spin = (flip.to - flip.from) * Math.PI * Math.sin(t * Math.PI) / (2 * flip.duration);
                if (t >= 1) {
                    this._flip = null;
                    this.flips++;
                    this._flipCompleted = true;
                    this.spin = 0;
                    this.emit('flip', { count: this.flips });
                }
            } else {
                const target = this.vy > 0 ? pose.angle : -.08 * Math.sign(this.vx || 1);
                this.spin += (angleDifference(target, this.angle) * 30 - this.spin * 9) * h;
                this.angle += this.spin * h;
            }
            if (this.y >= pose.y && this.vy >= 0 && this.airTime > .2) {
                const impact = this.vy;
                this.y = pose.y;
                this.vy = -Math.min(2, impact * .04);
                this.grounded = true;
                this._landingTime = .3;
                this._flip = null;
                this._flipUsed = false;
                this.suspension = .6;
                this.angle = angleDifference(this.angle, 0);
                this.emit('land', { speed: impact, flipped: this._flipCompleted });
            }
        }
    }
}

module.exports = { TruckWorld, terrainHeight, terrainPoints, courseLength, terrainKnots, ramps };
