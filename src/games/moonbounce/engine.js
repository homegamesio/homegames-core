const { LEVELS } = require('./levels');
const BOUNDS = Object.freeze({ left: 7, right: 111, top: 12, bottom: 83 });
const POWERS = [
    { id: 'guide', name: 'Stargazer', tagline: 'SEE THE NEXT BOUNCE', description: 'Green pegs reveal a longer path for your next two shots.', color: [99, 222, 255] },
    { id: 'blast', name: 'Supernova', tagline: 'CLEAR NEARBY PEGS', description: 'Your first hit bursts nearby pegs. Green pegs recharge it.', color: [255, 160, 99] },
    { id: 'twin', name: 'Gemini', tagline: 'TWO BALLS PER SHOT', description: 'Launch twin balls. Green pegs create another and recharge.', color: [193, 156, 255] },
    { id: 'magnet', name: 'Cometkeeper', tagline: 'CURVE TOWARD ORANGE PEGS', description: 'Charged balls curve gently toward nearby orange pegs.', color: [255, 143, 190] },
    { id: 'phoenix', name: 'Dawnkeeper', tagline: 'RESCUE ONE MISSED BALL', description: 'Rescue one missed ball from the bottom on each charged shot.', color: [255, 188, 87] }
];
const COLORS = { orange: [255, 167, 70], blue: [91, 181, 245], purple: [204, 146, 255], green: [132, 242, 166] };
const FIXED_DT = 1 / 120;
const GRAVITY = 24;
const LAUNCH_SPEED = 41;
const BALL_RADIUS = .68;
const MAX_SPEED = 67;
const FREE_THRESHOLDS = [10000, 25000, 50000];
const JACKPOTS = [10000, 25000, 50000, 25000, 10000];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// The simulation depends only on input and elapsed time: no timers, DOM, or I/O.
class Engine {
    constructor(seed = 73) {
        this.seed = seed >>> 0; this.best = 0; this.sound = true; this.reduced = false;
        this.uiTime = 0; this.time = 0; this.score = 0; this.levelIndex = 0;
        this.selectedPower = 0; this.powerId = 'guide'; this.paused = false;
        this.mode = 'adventure'; this.challenge = null;
        this.medals = LEVELS.map(() => 0);
        this.stats = { shots: 0, catches: 0, bestCombo: 0 }; this.events = [];
        this.launcher = { x: 59, y: 17 }; this.aimAngle = 0; this.accumulator = 0;
        this.loadLevel(); this.phase = 'title';
    }
    random() {
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }
    effectRandom() {
        this.effectSeed = (Math.imul(this.effectSeed, 1664525) + 1013904223) >>> 0;
        return this.effectSeed / 4294967296;
    }
    emit(name) { if (this.events.length < 48) this.events.push(name); }
    setPower(id) {
        const index = POWERS.findIndex(p => p.id === id);
        if (index < 0 || this.phase === 'flight') return false;
        this.selectedPower = index; this.powerId = id; return true;
    }
    start(powerId = this.powerId) {
        this.phase = 'title'; this.setPower(powerId); this.levelIndex = 0; this.score = 0; this.time = 0;
        if (this.mode === 'challenge' && Number.isInteger(this.challenge?.levelIndex) &&
            this.challenge.levelIndex >= 0 && this.challenge.levelIndex < LEVELS.length) this.levelIndex = this.challenge.levelIndex;
        this.stats = { shots: 0, catches: 0, bestCombo: 0 }; this.events = [];
        this.loadLevel(); this.emit('click');
    }
    loadLevel() {
        const level = LEVELS[this.levelIndex];
        this.seed = level.seed; this.effectSeed = (level.seed ^ 0x9e3779b9) >>> 0;
        this.pegs = level.pegs.map(p => ({ ...p, motion: p.motion ? { ...p.motion } : undefined,
            hit: false, removed: false, hitAge: 0 }));
        this.bumpers = (level.bumpers || []).map(b => ({ ...b, hitTime: 0 }));
        this.portals = (level.portals || []).map(p => ({ ...p, hitTime: 0 }));
        this.orangeTotal = this.orangeRemaining = this.pegs.filter(p => p.type === 'orange').length;
        this.balls = level.balls; this.ballsInPlay = []; this.particles = []; this.popups = [];
        if (this.mode === 'challenge' && Number.isFinite(this.challenge?.balls)) this.balls = clamp(Math.floor(this.challenge.balls), 1, 99);
        this.multiplier = 1; this.powerShots = 2; this.shotHits = 0; this.shotScore = 0; this.lastShotScore = 0;
        this.shotAge = 0; this.fever = false; this.feverTime = 0; this.jackpot = 0;
        this.anticipation = false; this.anticipationTime = 0; this.anticipationUsed = false;
        this.fastForward = false; this.fastAccumulator = 0;
        this.rings = []; this.callout = { title: '', subtitle: '', life: 0, maxLife: 1, color: [255, 225, 140], priority: 0 };
        this.impact = { x: 59, y: 45, strength: 0, life: 0, maxLife: 1 };
        this.reaction = 'idle'; this.reactionTime = 0;
        this.shotOranges = 0; this.shotCaught = 0; this.shotStyle = []; this.styleAwards = [];
        this.shotBumpers = 0; this.shotPortals = 0; this.shotRescues = 0; this.rescueUsed = false;
        this.boardStats = { shots: 0, hits: 0, oranges: 0, bank: 0, long: 0, bumper: 0, portal: 0, catches: 0, style: 0, rescues: 0 };
        this.boardPegPoints = 0; this.boardStylePoints = 0;
        this.lastShot = { hits: 0, oranges: 0, points: 0, caught: 0, style: [], bumpers: 0, portals: 0, rescues: 0 };
        this.result = { boardScore: 0, pegPoints: 0, stylePoints: 0, jackpot: 0, reserveBonus: 0, stars: 0,
            reason: '', objective: { kind: null, target: 0, progress: 0, complete: true } };
        this.banner = level.name; this.bannerTime = 2.4; this.phase = 'ready'; this.paused = false;
        this.aimAngle = 0; this.accumulator = 0; this.shake = 0; this.levelTime = 0;
        this.bucket = { x: 59, y: 79.8, width: 16 }; this.levelStartScore = this.score;
        this.levelStartStats = { ...this.stats };
        this.updateMotion(0); this.updateChallengeProgress();
    }
    retry() {
        if (!['lost', 'ready', 'cleared', 'won', 'flight'].includes(this.phase)) return false;
        this.score = this.levelStartScore; this.stats = { ...this.levelStartStats }; this.loadLevel(); this.emit('click'); return true;
    }
    next() {
        if (this.phase !== 'cleared' || this.mode === 'challenge') return false;
        if (this.levelIndex === LEVELS.length - 1) { this.phase = 'won'; this.emit('win'); }
        else { this.levelIndex++; this.loadLevel(); this.emit('click'); }
        return true;
    }
    aimAt(x, y) {
        if (this.phase !== 'ready' || this.paused || !Number.isFinite(x) || !Number.isFinite(y)) return;
        this.aimAngle = clamp(Math.atan2(x - this.launcher.x, Math.max(.1, y - this.launcher.y)), -1.22, 1.22);
    }
    newBall(angle = this.aimAngle, powered = this.powerShots > 0) {
        return { x: this.launcher.x + Math.sin(angle) * 2.8, y: this.launcher.y + Math.cos(angle) * 2.8,
            vx: Math.sin(angle) * LAUNCH_SPEED, vy: Math.cos(angle) * LAUNCH_SPEED,
            r: BALL_RADIUS, trail: [], age: 0, trailClock: 0, stuck: 0, gone: false,
            wallSincePeg: false, lastNewPeg: null, stallClock: 0, stallTravel: 0, stallRadius: 0,
            stallX: this.launcher.x, stallY: this.launcher.y, powered, magnetTarget: null,
            portalCooldown: 0, bumperCooldowns: {}, rescued: false };
    }
    launchAngles(powered = this.powerShots > 0) {
        return powered && this.powerId === 'twin'
            ? [this.aimAngle - .045, this.aimAngle + .045] : [this.aimAngle];
    }
    fire() {
        if (this.phase !== 'ready' || this.paused || this.balls <= 0) return false;
        this.balls--; this.stats.shots++; this.boardStats.shots++; this.shotHits = 0; this.shotScore = 0; this.shotAge = 0;
        this.shotOranges = 0; this.shotCaught = 0; this.shotStyle = []; this.styleAwards = [];
        this.shotBumpers = 0; this.shotPortals = 0; this.shotRescues = 0; this.rescueUsed = false;
        this.anticipation = false; this.anticipationTime = 0; this.anticipationUsed = false;
        this.freeAwards = 0; this.shotPower = this.powerShots > 0; this.blastUsed = false; this.greenSplit = false;
        if (this.shotPower) this.powerShots--;
        this.ballsInPlay = this.launchAngles(this.shotPower).map(angle => this.newBall(angle, this.shotPower));
        this.phase = 'flight'; this.bannerTime = 0; this.emit('shot'); return true;
    }
    addScore(value) {
        this.score += Math.round(value); this.best = Math.max(this.best, this.score);
        this.updateChallengeProgress();
    }
    updateChallengeProgress() {
        const goal = this.mode === 'challenge' ? this.challenge?.goal : null;
        this.challengeProgress = goal?.kind === 'catches' ? this.boardStats.catches
            : goal?.kind === 'style' ? this.boardStats.style : this.score - this.levelStartScore;
        this.challengeComplete = !goal || this.challengeProgress >= goal.target;
    }
    motionAt(peg, time) {
        const m = peg.motion;
        if (!m) return { x: peg.x, y: peg.y, motionVx: 0, motionVy: 0 };
        const angle = time * m.speed + m.phase, wave = Math.sin(angle), cosine = Math.cos(angle);
        return { x: m.cx + (m.kind === 'orbit' ? cosine : wave) * m.ax,
            y: m.cy + wave * m.ay,
            motionVx: (m.kind === 'orbit' ? -wave : cosine) * m.ax * m.speed,
            motionVy: cosine * m.ay * m.speed };
    }
    updateMotion(time) {
        for (const peg of this.pegs) if (peg.motion) Object.assign(peg, this.motionAt(peg, time));
    }
    react(reaction, duration = 1.3) {
        this.reaction = reaction; this.reactionTime = duration;
    }
    announce(title, subtitle = '', color = [255, 225, 140], duration = 1.8, priority = 1) {
        if (this.callout.life > 0 && this.callout.priority > priority) return;
        this.callout = { title, subtitle, life: duration, maxLife: duration, color, priority };
    }
    ring(x, y, color, maxR = 9, duration = .65) {
        if (this.rings.length >= 18) this.rings.shift();
        this.rings.push({ x, y, r: .5, maxR, life: duration, maxLife: duration, color });
    }
    strike(x, y, strength = .5) {
        this.impact = { x, y, strength, life: .28, maxLife: .28 };
        this.shake = Math.max(this.shake, strength * .35);
    }
    styleBonus(id, title, points, x, y) {
        if (this.styleAwards.includes(id)) return;
        this.styleAwards.push(id); this.shotStyle.push(title);
        this.boardStats.style++;
        if (id === 'bank' || id === 'long') this.boardStats[id]++;
        this.shotScore += points; this.boardStylePoints += points; this.addScore(points);
        this.announce(title, '+' + points.toLocaleString('en-US') + ' STYLE POINTS', [255, 225, 140], 1.65, 2);
        this.ring(x, y, [255, 215, 131], 12); this.strike(x, y, .45);
        this.react('wow', 1.7); this.emit(id.startsWith('streak') ? 'combo' : 'style');
        this.awardFreeBalls();
    }
    popup(x, y, text, color = [255, 235, 189], life = 1.2) {
        if (this.popups.length >= 16) this.popups.shift();
        this.popups.push({ x, y, text, color, life, maxLife: life });
    }
    burst(x, y, color, count = 10) {
        if (this.reduced) count = Math.min(count, 3);
        for (let i = 0; i < count && this.particles.length < 120; i++) {
            const a = this.effectRandom() * Math.PI * 2, speed = 3 + this.effectRandom() * 12, life = .35 + this.effectRandom() * .5;
            this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                r: .18 + this.effectRandom() * .28, color, life, maxLife: life });
        }
    }
    awardFreeBalls() {
        while (this.freeAwards < FREE_THRESHOLDS.length && this.shotScore >= FREE_THRESHOLDS[this.freeAwards]) {
            this.freeAwards++; this.balls++; this.emit('free');
            this.popup(59, 25 + this.freeAwards * 3, 'SCORE BONUS · +1 BALL', [132, 242, 166], 1.8);
            this.react('happy', 1.7);
        }
    }
    hitPeg(peg, ball, chain = false) {
        if (peg.hit || peg.removed) return;
        peg.hit = true; peg.hitAge = 0; this.shotHits++; this.boardStats.hits++;
        const points = { blue: 100, orange: 500, purple: 2000, green: 500 }[peg.type] * this.multiplier;
        const combo = 1 + Math.floor((this.shotHits - 1) / 5);
        this.shotScore += points * combo; this.boardPegPoints += points * combo; this.addScore(points * combo);
        this.stats.bestCombo = Math.max(this.stats.bestCombo, this.shotHits);
        this.burst(peg.x, peg.y, COLORS[peg.type], peg.type === 'orange' ? 12 : 7);
        this.emit('hit' + Math.min(7, Math.floor((this.shotHits - 1) / 2)));
        if (ball && !chain) {
            if (ball.wallSincePeg) this.styleBonus('bank', 'BANK SHOT', 2500, peg.x, peg.y);
            if (ball.lastNewPeg && Math.hypot(peg.x - ball.lastNewPeg.x, peg.y - ball.lastNewPeg.y) > 22) {
                this.styleBonus('long', 'LONG SHOT', 5000, peg.x, peg.y);
            }
            ball.lastNewPeg = { x: peg.x, y: peg.y }; ball.wallSincePeg = false;
        }
        if (peg.type === 'purple') this.popup(peg.x, peg.y, '+' + points * combo, COLORS.purple);
        if (peg.type === 'orange') {
            this.orangeRemaining--; this.shotOranges++; this.boardStats.oranges++; this.emit('orange');
            this.ring(peg.x, peg.y, COLORS.orange, 5.5, .48); this.strike(peg.x, peg.y, .24);
            this.react(this.shotOranges >= 3 ? 'wow' : 'happy');
            const cleared = this.orangeTotal - this.orangeRemaining;
            const previousMultiplier = this.multiplier;
            this.multiplier = this.orangeRemaining <= 2 ? 10 : cleared >= this.orangeTotal * .75 ? 5 : cleared >= this.orangeTotal * .45 ? 3 : cleared >= this.orangeTotal * .2 ? 2 : 1;
            if (this.multiplier > previousMultiplier) {
                this.announce(this.multiplier + '× MULTIPLIER', 'EVERY PEG IS WORTH MORE', COLORS.orange, 1.4, 1);
                this.emit('combo');
            }
            if (this.orangeRemaining === 0) this.beginFever();
        }
        if (peg.type === 'green') {
            this.powerShots = Math.min(6, this.powerShots + 2); this.emit('power');
            this.popup(peg.x, peg.y, POWERS[this.selectedPower].name.toUpperCase() + ' +2', COLORS.green, 1.6);
            this.announce('POWER UP!', POWERS[this.selectedPower].name.toUpperCase() + ' · +2 SHOTS', COLORS.green, 1.65, 2);
            this.ring(peg.x, peg.y, COLORS.green, 11, .75); this.react('wow', 1.5);
            if (this.powerId === 'blast' && !chain) this.blast(peg, ball);
            if (this.powerId === 'twin' && ball && !this.greenSplit && this.ballsInPlay.length < 4) {
                this.greenSplit = true;
                const twin = { ...ball, x: ball.x + 1.4, vx: -ball.vx || 16, vy: -Math.abs(ball.vy) - 7,
                    trail: [], gone: false, age: 0, wallSincePeg: false, lastNewPeg: null,
                    stallX: ball.x, stallY: ball.y, stallClock: 0, stallTravel: 0, stallRadius: 0,
                    bumperCooldowns: { ...ball.bumperCooldowns } };
                this.ballsInPlay.push(twin);
            }
        }
        if (this.shotPower && this.powerId === 'blast' && !this.blastUsed && !chain) {
            this.blastUsed = true; this.blast(peg, ball);
        }
        if (this.shotHits >= 10) this.styleBonus('streak10', '10 PEG STREAK', 5000, peg.x, peg.y);
        if (this.shotHits >= 20) this.styleBonus('streak20', '20 PEG MEGA STREAK', 12000, peg.x, peg.y);
        if (this.shotHits >= 30) this.styleBonus('streak30', '30 PEG COSMIC STREAK', 20000, peg.x, peg.y);
        this.awardFreeBalls();
    }
    blast(peg, ball) {
        this.burst(peg.x, peg.y, [255, 196, 122], 24); this.strike(peg.x, peg.y, .85);
        this.ring(peg.x, peg.y, [255, 195, 125], 14, .7); this.emit('impact');
        for (const other of this.pegs) {
            if (!other.hit && !other.removed && Math.hypot(peg.x - other.x, peg.y - other.y) < 9.5) this.hitPeg(other, ball, true);
        }
    }
    beginFever() {
        this.fever = true; this.feverTime = 0; this.banner = 'CELESTIAL FEVER'; this.bannerTime = 3.2;
        this.anticipation = false; this.anticipationTime = 0;
        this.emit('fever'); this.emit('impact'); this.strike(59, 44, 1.4);
        this.announce('CELESTIAL FEVER', 'LAND IN A BONUS SLOT', [255, 225, 140], 3.1, 5);
        this.ring(59, 44, [255, 225, 140], 58, 1.3); this.react('wow', 4);
        this.burst(59, 37, [255, 225, 140], 45);
        // A cleared board is already a win, even when this was the final ball.
    }
    pullTowardOrange(ball, pegs, dt) {
        ball.magnetTarget = null;
        if (this.powerId !== 'magnet' || !ball.powered) return;
        let nearest = null, distance = 13;
        for (const peg of pegs) {
            if (peg.type !== 'orange' || peg.hit || peg.removed) continue;
            const d = Math.hypot(peg.x - ball.x, peg.y - ball.y);
            if (d < distance && d > .01) { nearest = peg; distance = d; }
        }
        if (!nearest) return;
        const force = 4 + 22 * (1 - distance / 13);
        ball.vx += (nearest.x - ball.x) / distance * force * dt;
        ball.vy += (nearest.y - ball.y) / distance * force * dt;
        ball.magnetTarget = nearest.id;
    }
    usePortal(ball, preview) {
        if (ball.portalCooldown > 0) return false;
        for (const entry of this.portals) {
            if (Math.hypot(ball.x - entry.x, ball.y - entry.y) > entry.r + ball.r * .2) continue;
            const exit = this.portals.find(p => p.id === entry.pairId);
            if (!exit || exit === entry) continue;
            const speed = Math.hypot(ball.vx, ball.vy), nx = speed > .01 ? ball.vx / speed : 0;
            const ny = speed > .01 ? ball.vy / speed : 1, offset = exit.r + ball.r + .3;
            ball.x = clamp(exit.x + nx * offset, BOUNDS.left + ball.r, BOUNDS.right - ball.r);
            ball.y = clamp(exit.y + ny * offset, BOUNDS.top + ball.r, BOUNDS.bottom - ball.r);
            ball.portalCooldown = .65; ball.trail = []; ball.lastNewPeg = null; ball.wallSincePeg = false;
            ball.stallClock = 0; ball.stallTravel = 0; ball.stallRadius = 0; ball.stallX = ball.x; ball.stallY = ball.y;
            if (!preview) {
                entry.hitTime = exit.hitTime = .6; this.shotPortals++; this.boardStats.portal++;
                this.ring(entry.x, entry.y, [185, 152, 255], 7, .5);
                this.ring(exit.x, exit.y, [185, 152, 255], 9, .65);
                this.styleBonus('portal', 'PORTAL HOP', 1500, exit.x, exit.y); this.emit('portal');
            }
            return true;
        }
        return false;
    }
    hitBumper(ball, bumper, preview) {
        const dx = ball.x - bumper.x, dy = ball.y - bumper.y, radius = ball.r + bumper.r;
        const distance = Math.hypot(dx, dy);
        if (distance >= radius) return false;
        const nx = distance > .00001 ? dx / distance : 0, ny = distance > .00001 ? dy / distance : -1;
        ball.x = bumper.x + nx * (radius + .015); ball.y = bumper.y + ny * (radius + .015);
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) { ball.vx -= 2.04 * dot * nx; ball.vy -= 2.04 * dot * ny; }
        if ((ball.bumperCooldowns[bumper.id] || 0) <= 0) {
            const speed = Math.hypot(ball.vx, ball.vy), boost = clamp(speed, 38, MAX_SPEED);
            if (speed > .001) { ball.vx *= boost / speed; ball.vy *= boost / speed; }
            else { ball.vx = nx * boost; ball.vy = ny * boost; }
            ball.bumperCooldowns[bumper.id] = .18;
            if (!preview) {
                bumper.hitTime = .4; this.shotBumpers++; this.boardStats.bumper++;
                this.ring(bumper.x, bumper.y, [255, 197, 119], bumper.r + 6, .5);
                this.strike(bumper.x, bumper.y, .55);
                this.styleBonus('bumper', 'BUMPER BOOST', 1000, bumper.x, bumper.y); this.emit('bumper');
            }
        }
        return true;
    }
    rescue(ball) {
        if (this.powerId !== 'phoenix' || !ball.powered || this.rescueUsed) return false;
        this.rescueUsed = true; this.shotRescues++; this.boardStats.rescues++;
        ball.y = this.bucket.y - 1; ball.vy = -48; ball.vx *= .7; ball.rescued = true;
        ball.trail = []; ball.stallClock = 0; ball.stallTravel = 0; ball.stallRadius = 0;
        ball.stallX = ball.x; ball.stallY = ball.y;
        this.announce('BALL RESCUED', 'DAWNKEEPER SAVED YOUR SHOT', [255, 188, 87], 1.8, 3);
        this.ring(ball.x, 79, [255, 188, 87], 16, .85); this.burst(ball.x, 78, [255, 188, 87], 20);
        this.react('wow', 1.8); this.emit('rescue'); return true;
    }
    moveBall(ball, dt, preview = false, geometry = this.pegs) {
        ball.portalCooldown = Math.max(0, ball.portalCooldown - dt);
        for (const id of Object.keys(ball.bumperCooldowns)) ball.bumperCooldowns[id] = Math.max(0, ball.bumperCooldowns[id] - dt);
        this.pullTowardOrange(ball, geometry, dt);
        ball.vy += GRAVITY * dt;
        const speed = Math.hypot(ball.vx, ball.vy);
        if (speed > MAX_SPEED) { ball.vx *= MAX_SPEED / speed; ball.vy *= MAX_SPEED / speed; }
        let oldY = ball.y;
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        let collided = false;
        if (ball.x < BOUNDS.left + ball.r) {
            ball.x = BOUNDS.left + ball.r; ball.vx = Math.abs(ball.vx) * .92; collided = true;
            if (!preview) ball.wallSincePeg = true;
        }
        if (ball.x > BOUNDS.right - ball.r) {
            ball.x = BOUNDS.right - ball.r; ball.vx = -Math.abs(ball.vx) * .92; collided = true;
            if (!preview) ball.wallSincePeg = true;
        }
        if (ball.y < BOUNDS.top + ball.r) {
            ball.y = BOUNDS.top + ball.r; ball.vy = Math.abs(ball.vy) * .85; collided = true;
            if (!preview) ball.wallSincePeg = true;
        }
        if (this.usePortal(ball, preview)) oldY = ball.y;
        for (const bumper of this.bumpers) if (this.hitBumper(ball, bumper, preview)) collided = true;
        for (const peg of geometry) {
            if (peg.removed) continue;
            const dx = ball.x - peg.x, dy = ball.y - peg.y, radius = ball.r + peg.r;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq >= radius * radius) continue;
            const distance = Math.sqrt(distanceSq);
            let nx = distance > .00001 ? dx / distance : 0;
            let ny = distance > .00001 ? dy / distance : -1;
            ball.x = peg.x + nx * (radius + .012); ball.y = peg.y + ny * (radius + .012);
            const dot = (ball.vx - (peg.motionVx || 0)) * nx + (ball.vy - (peg.motionVy || 0)) * ny;
            if (dot < 0) { ball.vx -= 1.83 * dot * nx; ball.vy -= 1.83 * dot * ny; }
            // A perfectly vertical impact cannot sit balancing on a round peg.
            if (Math.abs(ball.vx) < .8 && ny < -.7) ball.vx += ((peg.id % 2) ? -1 : 1) * 2.4;
            collided = true;
            if (!preview) this.hitPeg(peg, ball);
        }
        if (preview) return collided;
        if (oldY < this.bucket.y && ball.y >= this.bucket.y && ball.vy > 0) {
            if (this.fever) {
                const slot = clamp(Math.floor((ball.x - BOUNDS.left) / ((BOUNDS.right - BOUNDS.left) / 5)), 0, 4);
                const reward = JACKPOTS[slot]; this.jackpot += reward; this.addScore(reward);
                this.popup(ball.x, 74, '+' + reward.toLocaleString('en-US'), [255, 226, 136], 2.3);
                this.burst(ball.x, 77, [255, 220, 120], 30); this.emit('jackpot'); ball.gone = true;
                this.ring(ball.x, 78, [255, 220, 120], 22, 1); this.strike(ball.x, 78, 1.1);
                this.announce(slot === 2 ? 'COSMIC JACKPOT!' : 'JACKPOT!', '+' + reward.toLocaleString('en-US'), [255, 225, 140], 2.5, 6);
            } else if (Math.abs(ball.x - this.bucket.x) < this.bucket.width / 2 - ball.r * .35) {
                this.balls++; this.stats.catches++; this.shotCaught++; this.boardStats.catches++;
                this.updateChallengeProgress();
                this.popup(ball.x, 75, 'CAUGHT! +1 BALL', [142, 255, 211], 1.7);
                this.burst(ball.x, 78, [133, 247, 212], 16); this.emit('catch'); ball.gone = true;
                this.ring(ball.x, 78, [133, 247, 212], 12, .7);
                this.announce('BUCKET CATCH', '+1 BALL', [133, 247, 212], 1.7, 3);
                this.react('happy', 2);
            } else this.rescue(ball);
        }
        if (ball.y > BOUNDS.bottom + 2 || ball.age > 17) ball.gone = true;
        return collided;
    }
    resolveShot() {
        this.lastShotScore = this.shotScore;
        this.lastShot = { hits: this.shotHits, oranges: this.shotOranges, points: this.shotScore,
            caught: this.shotCaught, style: this.shotStyle.slice(), bumpers: this.shotBumpers,
            portals: this.shotPortals, rescues: this.shotRescues };
        this.fastForward = false; this.fastAccumulator = 0; this.anticipation = false; this.anticipationTime = 0;
        for (const peg of this.pegs) if (peg.hit) peg.removed = true;
        let reserveBonus = 0, stars = 0, reason = '';
        if (this.orangeRemaining === 0) {
            reserveBonus = this.balls * 2000;
            this.addScore(reserveBonus);
        }
        this.updateChallengeProgress();
        if (this.orangeRemaining === 0 && (this.mode !== 'challenge' || this.challengeComplete)) {
            this.phase = 'cleared'; this.banner = this.mode === 'challenge' ? 'CHALLENGE COMPLETE' : 'BOARD COMPLETE'; this.bannerTime = 3;
            const boardScore = this.score - this.levelStartScore, par = LEVELS[this.levelIndex].parScore;
            stars = boardScore >= par * 1.6 ? 3 : boardScore >= par ? 2 : 1;
            if (this.mode !== 'challenge') this.medals[this.levelIndex] = Math.max(this.medals[this.levelIndex], stars);
            this.react('wow', 4);
            this.emit('win');
        } else if (this.balls <= 0 || this.orangeRemaining === 0 && this.mode === 'challenge') {
            this.phase = 'lost'; this.banner = 'OUT OF BALLS'; this.bannerTime = 3; this.emit('lose');
            if (this.mode === 'challenge' && this.orangeRemaining === 0 && !this.challengeComplete) {
                const goal = this.challenge.goal, noun = goal.kind === 'score' ? 'points' : goal.kind === 'catches' ? 'catches' : 'style bonuses';
                reason = 'All orange pegs cleared, but you needed ' + goal.target.toLocaleString('en-US') + ' ' + noun +
                    ' (' + this.challengeProgress.toLocaleString('en-US') + ' earned).';
                this.banner = 'OBJECTIVE NOT COMPLETE';
            } else reason = this.orangeRemaining + ' orange pegs still to clear.';
            this.react('sad', 4);
        } else {
            this.phase = 'ready'; this.banner = this.shotHits ? this.shotHits + ' PEGS · +' + this.shotScore.toLocaleString('en-US') : 'AIM AND RELEASE';
            this.bannerTime = 1.8;
            // The violet bonus moves to a fresh ordinary peg each turn.
            for (const peg of this.pegs) if (peg.type === 'purple' && !peg.removed) peg.type = 'blue';
            const candidates = this.pegs.filter(p => !p.removed && p.type === 'blue');
            if (candidates.length) candidates[Math.floor(this.random() * candidates.length)].type = 'purple';
            if (this.shotHits === 0 && !this.shotCaught) this.react('sad', 1.6);
        }
        this.result = { boardScore: this.score - this.levelStartScore, pegPoints: this.boardPegPoints,
            stylePoints: this.boardStylePoints, jackpot: this.jackpot, reserveBonus, stars, reason,
            objective: { kind: this.mode === 'challenge' ? this.challenge?.goal?.kind || null : null,
                target: this.mode === 'challenge' ? this.challenge?.goal?.target || 0 : 0,
                progress: this.challengeProgress, complete: this.challengeComplete } };
    }
    checkAnticipation() {
        // A cinematic must never turn a late winning hit into a timeout. Leave
        // enough time for the approach to finish before the global shot cap.
        if (this.fever || this.anticipationUsed || this.orangeRemaining !== 1 || this.shotAge > 15.5) return;
        const target = this.pegs.find(p => p.type === 'orange' && !p.hit && !p.removed);
        if (!target) return;
        const approaching = this.ballsInPlay.some(ball => {
            const dx = target.x - ball.x, dy = target.y - ball.y, d = Math.hypot(dx, dy);
            return d < 8 && d > target.r + ball.r &&
                dx * ball.vx + dy * ball.vy > Math.hypot(ball.vx, ball.vy) * d * .8;
        });
        if (approaching) {
            this.anticipation = true; this.anticipationTime = .7; this.anticipationUsed = true;
            this.announce('ONE ORANGE REMAINING', 'CLEAR IT TO OPEN THE JACKPOT', [255, 201, 132], .9, 3);
            this.ring(target.x, target.y, [255, 201, 132], 6, .7); this.react('wow', 1.2);
        }
    }
    checkStall(ball, oldX, oldY, dt) {
        if (this.anticipation || this.fever && this.feverTime < 1.65) {
            ball.stallClock = 0; ball.stallTravel = 0; ball.stallRadius = 0;
            ball.stallX = ball.x; ball.stallY = ball.y; return;
        }
        ball.stallClock += dt; ball.stallTravel += Math.hypot(ball.x - oldX, ball.y - oldY);
        ball.stallRadius = Math.max(ball.stallRadius, Math.hypot(ball.x - ball.stallX, ball.y - ball.stallY));
        if (ball.stallClock < 1) return;
        if (ball.stallRadius < 2.8 && ball.stallTravel < 12) {
            const nearby = this.pegs.filter(p => p.hit && !p.removed && Math.hypot(p.x - ball.x, p.y - ball.y) < 5)
                .sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y));
            if (nearby.length) {
                const peg = nearby[0]; peg.removed = true;
                this.ring(peg.x, peg.y, COLORS[peg.type], 4, .35);
                ball.vy = Math.max(ball.vy, 4);
            }
        }
        ball.stallClock = 0; ball.stallTravel = 0; ball.stallRadius = 0;
        ball.stallX = ball.x; ball.stallY = ball.y;
    }
    tick(dt) {
        this.uiTime += dt;
        this.bannerTime = Math.max(0, this.bannerTime - dt); this.shake = Math.max(0, this.shake - dt);
        this.callout.life = Math.max(0, this.callout.life - dt);
        this.impact.life = Math.max(0, this.impact.life - dt);
        for (const bumper of this.bumpers) bumper.hitTime = Math.max(0, bumper.hitTime - dt);
        for (const portal of this.portals) portal.hitTime = Math.max(0, portal.hitTime - dt);
        this.reactionTime = Math.max(0, this.reactionTime - dt);
        if (!this.reactionTime) this.reaction = 'idle';
        for (const ring of this.rings) {
            ring.life -= dt; ring.r = .5 + (ring.maxR - .5) * (1 - Math.pow(Math.max(0, ring.life / ring.maxLife), 2));
        }
        this.rings = this.rings.filter(ring => ring.life > 0);
        for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 12 * dt; p.life -= dt; }
        this.particles = this.particles.filter(p => p.life > 0);
        for (const p of this.popups) { p.y -= 3 * dt; p.life -= dt; }
        this.popups = this.popups.filter(p => p.life > 0);
        if (!['title', 'ready', 'flight'].includes(this.phase)) return;
        this.time += dt;
        if (this.phase !== 'flight') {
            this.levelTime += dt; this.updateMotion(this.levelTime);
            this.bucket.x = 59 + Math.sin(this.levelTime * .68) * 40; return;
        }
        this.shotAge += dt;
        if (this.fever) this.feverTime += dt;
        this.checkAnticipation();
        const slow = this.fever && this.feverTime < 1.65 ? .29 : this.anticipation ? .32 : 1;
        this.levelTime += dt * slow; this.updateMotion(this.levelTime);
        this.bucket.x = 59 + Math.sin(this.levelTime * .68) * 40;
        for (const peg of this.pegs) if (peg.hit && !peg.removed) peg.hitAge += dt;
        for (const ball of [...this.ballsInPlay]) {
            ball.age += dt; ball.trailClock += dt;
            if (ball.trailClock >= 1 / 30) {
                ball.trailClock -= 1 / 30; ball.trail.unshift({ x: ball.x, y: ball.y });
                if (ball.trail.length > (this.reduced ? 4 : 12)) ball.trail.pop();
            }
            const oldX = ball.x, oldY = ball.y;
            this.moveBall(ball, dt * slow); this.checkStall(ball, oldX, oldY, dt);
            if (this.shotAge >= 17) ball.gone = true;
        }
        this.anticipationTime = Math.max(0, this.anticipationTime - dt);
        if (this.anticipationTime === 0) this.anticipation = false;
        this.ballsInPlay = this.ballsInPlay.filter(ball => !ball.gone);
        if (!this.ballsInPlay.length) this.resolveShot();
    }
    step(dt = 1 / 30) {
        if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
        this.accumulator += Math.min(dt, .25);
        while (this.accumulator + 1e-10 >= FIXED_DT) {
            this.accumulator -= FIXED_DT; this.tick(FIXED_DT);
            // Fast-forward adds ordinary 120 Hz ticks; it never changes collision
            // resolution and immediately yields to the final-orange slow motion.
            if (this.fastForward && this.phase === 'flight' && !this.fever && !this.anticipation) {
                this.fastAccumulator += FIXED_DT * 1.2;
                while (this.fastAccumulator + 1e-10 >= FIXED_DT) {
                    this.fastAccumulator -= FIXED_DT; this.tick(FIXED_DT);
                    if (this.phase !== 'flight' || this.fever || this.anticipation) { this.fastAccumulator = 0; break; }
                }
                if (this.fastAccumulator < 1e-10) this.fastAccumulator = 0;
            } else this.fastAccumulator = 0;
        }
        if (this.accumulator < 1e-10) this.accumulator = 0;
    }
    preview() {
        if (this.phase !== 'ready' && this.phase !== 'title') return [];
        const ball = this.newBall(this.launchAngles()[0]), points = [{ x: ball.x, y: ball.y }];
        const guide = this.powerId === 'guide' && this.powerShots > 0;
        let collisions = 0;
        for (let i = 0; i < (guide ? 240 : 156); i++) {
            const geometry = this.pegs.map(peg => peg.motion
                ? { ...peg, ...this.motionAt(peg, this.levelTime + (i + 1) * FIXED_DT) } : peg);
            const hit = this.moveBall(ball, FIXED_DT, true, geometry);
            if (i % 5 === 0 || hit) points.push({ x: ball.x, y: ball.y });
            if (hit && ++collisions >= (guide ? 2 : 1)) break;
            if (ball.y >= this.bucket.y) break;
        }
        return points;
    }
}

module.exports = { Engine, LEVELS, POWERS, BOUNDS };
