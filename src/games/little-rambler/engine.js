// Plain simulation shared by hosted and local Homegames sessions.
const STEP = 1 / 120;
const GARDEN_WIDTH = 300;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const count = (n, fallback = 0, max = 9999) => Number.isFinite(n) ? clamp(Math.floor(n), 0, max) : fallback;
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const freshRewards = () => ({ berries: 0, seeds: 0, scrap: 0 });
const BUILDINGS = [
    { id: 'planter', name: 'Wobble planter', cost: { seeds: 2, scrap: 0 }, description: 'Grow berries. Pip watches the little leaves dance.' },
    { id: 'bell', name: 'Dinner bell', cost: { seeds: 0, scrap: 4 }, description: 'Ring a tiny tune together. Pip learns to ring it too.' },
    { id: 'hammock', name: 'Patchwork hammock', cost: { seeds: 1, scrap: 7 }, description: 'A very good place for a very small nap.' }
];
const GROWTH = [
    { label: 'Nestling', threshold: 0, next: 'Share snacks, explore, and make this place your own.' },
    { label: 'Sprout', threshold: 18, next: 'A stronger hop! Reach the high seeds in the garden.' },
    { label: 'Rambler', threshold: 48, next: 'Steadier paws! Take five magnet casts on each outing.' },
    { label: 'At home', threshold: 84, next: 'A little home full of things you discovered together.' }
];

function normalizeSave(value) {
    const raw = object(value), home = object(raw.home);
    let name = typeof raw.name === 'string' ? raw.name.replace(/[^a-zA-Z0-9 '\-]/g, '').trim().slice(0, 16) : '';
    if (!name) name = 'Pip';
    return {
        version: 1, name, coat: ['moss', 'peach', 'lilac'].includes(raw.coat) ? raw.coat : 'moss',
        berries: count(raw.berries, 2), seeds: count(raw.seeds), scrap: count(raw.scrap),
        bond: count(raw.bond, 0, 999), meals: count(raw.meals), pets: count(raw.pets),
        outings: count(raw.outings), gardenTrips: count(raw.gardenTrips), salvageTrips: count(raw.salvageTrips),
        favoriteFound: raw.favoriteFound === true,
        planterGrowth: Number.isFinite(raw.planterGrowth) ? clamp(raw.planterGrowth, 0, 45) : 0,
        home: { planter: home.planter === true, bell: home.bell === true, hammock: home.hammock === true }
    };
}

class LittleRamblerEngine {
    constructor(save) {
        this.save = normalizeSave(save);
        this.mode = 'home'; this.time = 0; this.accumulator = 0; this.revision = 0;
        this.events = []; this.result = null; this.garden = null; this.salvage = null;
        this.creature = { x: 50, y: 70, facing: 1, activity: 'idle', reaction: '', reactionTime: 0 };
        this.message = `A small house. A curious ${this.save.name}. Room to grow.`;
        this.careCooldown = 0; this.homeClock = 0; this.homeTarget = 50;
        this.homeAction = null; this.homeCycle = 0; this.planterSaveClock = 0;
        this.jumpHeld = false; this.jumpQueued = false;
    }
    emit(event) {
        if (this.events.length < 16) this.events.push(event);
    }
    drainEvents() { const events = this.events; this.events = []; return events; }
    changed() { this.revision++; }
    exportSave() { return normalizeSave(this.save); }
    getGrowth() {
        const built = Object.values(this.save.home).filter(Boolean).length;
        const points = this.save.bond + this.save.outings * 4 + built * 8;
        let stage = 0;
        while (stage < GROWTH.length - 1 && points >= GROWTH[stage + 1].threshold) stage++;
        const current = GROWTH[stage], next = GROWTH[stage + 1];
        return { stage, label: current.label, points,
            progress: next ? clamp((points - current.threshold) / (next.threshold - current.threshold), 0, 1) : 1,
            next: next ? `${next.threshold - points} moments until ${next.label.toLowerCase()}` : current.next,
            ability: current.next };
    }
    getMilestones() {
        return [
            { id: 'friend', label: 'A familiar hand', text: 'Give your little companion a pet.', complete: this.save.pets > 0 },
            { id: 'favorite', label: 'A favorite flavor', text: 'Bring home a berry and share it.', complete: this.save.favoriteFound },
            { id: 'garden', label: 'Garden explorer', text: 'Take a stroll through the giant garden.', complete: this.save.gardenTrips > 0 },
            { id: 'salvage', label: 'Treasure together', text: 'Bring something back from the junk lagoon.', complete: this.save.salvageTrips > 0 },
            { id: 'home', label: 'A place of our own', text: 'Build the planter, bell, and hammock.', complete: Object.values(this.save.home).every(Boolean) }
        ];
    }
    react(activity, message, duration = 2.4) {
        this.creature.activity = activity; this.creature.reaction = message; this.creature.reactionTime = duration;
        this.message = message; this.homeAction = null; this.homeClock = 0; this.homeTarget = this.creature.x;
    }
    pet() {
        if (this.mode !== 'home' || this.careCooldown > 0) return false;
        this.careCooldown = 1.2; this.save.pets++; this.save.bond = Math.min(999, this.save.bond + 1);
        this.react('petting', [
            `${this.save.name} leans into your hand.`, `${this.save.name} makes a tiny kettle noise.`,
            'That is apparently the exact right spot.'
        ][(this.save.pets - 1) % 3]);
        this.emit('pet'); this.changed(); return true;
    }
    feed(kind = 'staple') {
        if (this.mode !== 'home' || this.careCooldown > 0 || !['staple', 'berry'].includes(kind)) return false;
        if (kind === 'berry' && this.save.berries < 1) { this.message = 'Find berries in the garden, or share some oat bites.'; return false; }
        this.careCooldown = 1.6; this.save.meals++; this.save.bond = Math.min(999, this.save.bond + (kind === 'berry' ? 3 : 1));
        if (kind === 'berry') {
            this.save.berries--; this.save.favoriteFound = true;
            this.react('eating', `${this.save.name} does a little berry dance. A favorite!`, 3);
        } else this.react('eating', `Warm oat bites. ${this.save.name} saves the best crumb for last.`);
        this.emit('eat'); this.changed(); return true;
    }
    build(id) {
        if (this.mode !== 'home') return false;
        const building = BUILDINGS.find(item => item.id === id);
        if (!building || this.save.home[id]) return false;
        if (this.save.seeds < building.cost.seeds || this.save.scrap < building.cost.scrap) {
            this.message = 'A few more discoveries will make this possible.'; return false;
        }
        this.save.seeds -= building.cost.seeds; this.save.scrap -= building.cost.scrap;
        this.save.home[id] = true; this.save.bond = Math.min(999, this.save.bond + 2);
        this.react('happy', `${this.save.name} inspects the ${building.name.toLowerCase()}. Ours!`, 2);
        this.emit('build'); this.changed(); return true;
    }
    interactHome(id) {
        if (this.mode !== 'home' || !BUILDINGS.some(item => item.id === id) || !this.save.home[id]) return false;
        if (id === 'planter' && this.save.planterGrowth >= 45) {
            this.save.berries = Math.min(9999, this.save.berries + 1); this.save.planterGrowth = 0;
            this.react('happy', 'One plump berry, grown right here at home.');
            this.emit('collect'); this.changed(); return true;
        }
        this.creature.reactionTime = 0; this.creature.reaction = ''; this.creature.activity = 'idle'; this.homeAction = id;
        this.homeTarget = { planter: 30, bell: 65, hammock: 68 }[id];
        this.homeClock = 0; return true;
    }
    startGarden() {
        if (!['home', 'result'].includes(this.mode)) return false;
        this.mode = 'garden'; this.result = null; this.jumpHeld = false; this.jumpQueued = false;
        const platforms = [
            { x: 0, y: 78, w: 300, h: 6 },
            { x: 27, y: 66, w: 17, h: 3 }, { x: 57, y: 55, w: 17, h: 3 },
            { x: 91, y: 66, w: 19, h: 3 }, { x: 120, y: 56, w: 21, h: 3 },
            { x: 150, y: 44, w: 20, h: 3 }, { x: 184, y: 65, w: 19, h: 3 },
            { x: 214, y: 53, w: 17, h: 3 }, { x: 245, y: 63, w: 19, h: 3 },
            { x: 144, y: 29, w: 13, h: 3, high: true }
        ];
        const itemData = [
            [19, 72, 'berry'], [35, 60, 'seed'], [64, 49, 'berry'], [80, 72, 'seed'],
            [101, 60, 'berry'], [130, 50, 'seed'], [160, 38, 'berry'], [175, 72, 'berry'],
            [194, 59, 'seed'], [222, 47, 'berry'], [254, 57, 'seed'], [268, 72, 'berry'],
            [149, 20, 'seed']
        ];
        this.garden = { player: { x: 10, y: 78, vx: 0, vy: 0, grounded: true, facing: 1 },
            platforms, items: itemData.map((p, id) => ({ id, x: p[0], y: p[1], kind: p[2], collected: false })),
            camera: 0, timeLeft: 120, elapsed: 0, rewards: freshRewards(), exitX: 287,
            jumpBuffer: 0, coyote: .12, finished: false };
        this.message = 'Follow the stepping leaves. Everything you find comes home.';
        return true;
    }
    startSalvage() {
        if (!['home', 'result'].includes(this.mode)) return false;
        this.mode = 'salvage'; this.result = null;
        const points = [[20, 34], [35, 29], [51, 30], [68, 29], [83, 35],
            [16, 52], [36, 50], [52, 46], [69, 50], [86, 53], [36, 63], [65, 63]];
        this.salvage = { ball: { x: 50, y: 72, vx: 0, vy: 0, r: 1.7, age: 0, active: false },
            targets: points.map((p, id) => ({ id, x: p[0], y: p[1], r: 3, collected: false, value: id % 4 === 0 ? 2 : 1 })),
            bumpers: [{ x: 27, y: 42, r: 4 }, { x: 75, y: 42, r: 4 }, { x: 50, y: 57, r: 3.5 }],
            shotsLeft: this.getGrowth().stage >= 2 ? 5 : 4, timeLeft: 90, elapsed: 0,
            rewards: freshRewards(), finished: false, bounces: 0, trail: [] };
        this.message = 'Cast the magnet. Bounce through the floating treasures.';
        return true;
    }
    launchSalvage(vx, vy) {
        if (this.mode !== 'salvage' || this.salvage.ball.active || this.salvage.shotsLeft <= 0 ||
            !Number.isFinite(vx) || !Number.isFinite(vy)) return false;
        const s = this.salvage;
        Object.assign(s.ball, { x: 50, y: 72, vx: clamp(vx, -85, 85), vy: clamp(vy, -90, -18), age: 0, active: true });
        s.shotsLeft--; s.trail = []; this.emit('launch'); return true;
    }
    finishOuting(reason = 'return') {
        if (this.mode !== 'garden' && this.mode !== 'salvage') return false;
        const kind = this.mode, outing = this[kind];
        if (outing.finished) return false;
        outing.finished = true;
        const before = this.getMilestones().filter(m => m.complete).map(m => m.id), oldStage = this.getGrowth().stage;
        const rewards = { ...outing.rewards };
        // The gate marks a complete walk; collected discoveries are always kept.
        if (kind === 'garden' && reason === 'gate') rewards.seeds++;
        const broughtSomething = Object.values(rewards).some(n => n > 0);
        if (broughtSomething || outing.elapsed >= 10) {
            this.save.outings++; this.save[kind === 'garden' ? 'gardenTrips' : 'salvageTrips']++;
            this.save.bond = Math.min(999, this.save.bond + 3);
        }
        for (const key of ['berries', 'seeds', 'scrap']) this.save[key] = Math.min(9999, this.save[key] + rewards[key]);
        this.result = { kind, title: kind === 'garden' ? 'A pocketful of garden' : 'Something from the lagoon',
            text: broughtSomething ? `${this.save.name} cannot wait to see what you do with these.` : 'A little fresh air is a good discovery too.',
            rewards, milestones: this.getMilestones().filter(m => m.complete && !before.includes(m.id)).map(m => m.label) };
        if (this.getGrowth().stage > oldStage) this.result.milestones.push(`${this.save.name} is a ${this.getGrowth().label.toLowerCase()}!`);
        this.mode = 'result'; this.changed(); this.emit('reward'); return true;
    }
    dismissResult() {
        if (this.mode !== 'result') return false;
        this.mode = 'home'; this.creature.x = 50; this.creature.y = 70;
        this.react('happy', `${this.save.name} is glad to be back. What shall we do with our finds?`, 3);
        return true;
    }
    returnHome() {
        if (this.mode === 'garden' || this.mode === 'salvage') this.finishOuting();
        return this.dismissResult();
    }
    tick(dt = 1 / 30, input = {}) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        input = object(input);
        if (input.jump && !this.jumpHeld) this.jumpQueued = true;
        this.jumpHeld = !!input.jump;
        this.accumulator += Math.min(dt, .25);
        while (this.accumulator + 1e-10 >= STEP) {
            this.accumulator = Math.max(0, this.accumulator - STEP);
            this.time += STEP;
            this.careCooldown = Math.max(0, this.careCooldown - STEP);
            if (this.mode === 'home') this.stepHome(STEP);
            else if (this.mode === 'garden') this.stepGarden(STEP, input);
            else if (this.mode === 'salvage') this.stepSalvage(STEP);
        }
    }
    stepHome(dt) {
        const pet = this.creature;
        if (this.save.home.planter && this.save.planterGrowth < 45) {
            this.save.planterGrowth = Math.min(45, this.save.planterGrowth + dt);
            this.planterSaveClock += dt;
            if (this.planterSaveClock >= 5 || this.save.planterGrowth >= 45) { this.planterSaveClock = 0; this.changed(); }
        }
        if (pet.reactionTime > 0) {
            pet.reactionTime = Math.max(0, pet.reactionTime - dt);
            if (!pet.reactionTime) { pet.reaction = ''; pet.activity = 'idle'; }
            return;
        }
        if (Math.abs(this.homeTarget - pet.x) > .3) {
            pet.facing = Math.sign(this.homeTarget - pet.x); pet.x += pet.facing * Math.min(Math.abs(this.homeTarget - pet.x), 6 * dt);
            pet.activity = 'walking'; return;
        }
        if (this.homeAction) {
            const id = this.homeAction;
            if (pet.activity === 'walking' || pet.activity === 'idle') {
                pet.activity = { planter: 'watching', bell: 'ringing', hammock: 'sleeping' }[id];
                this.message = { planter: `${this.save.name} is keeping a very small leaf company.`,
                    bell: `${this.save.name} has invented a one-note song.`, hammock: `${this.save.name} fits perfectly. Of course.` }[id];
                if (id === 'bell') this.emit('bell');
            }
            this.homeClock += dt;
            if (this.homeClock > (id === 'hammock' ? 9 : 4)) { this.homeAction = null; this.homeClock = 0; pet.activity = 'idle'; }
            return;
        }
        pet.activity = 'idle'; this.homeClock += dt;
        if (this.homeClock > 4) {
            const things = ['wander'].concat(BUILDINGS.filter(b => this.save.home[b.id]).map(b => b.id));
            const next = things[this.homeCycle++ % things.length]; this.homeClock = 0;
            if (next === 'wander') this.homeTarget = [38, 58, 44, 54][Math.floor(this.homeCycle / things.length) % 4];
            else {
                // Visiting a plant is different from the player's harvest action.
                this.homeAction = next; this.homeTarget = { planter: 30, bell: 65, hammock: 68 }[next];
            }
        }
    }
    stepGarden(dt, input) {
        const g = this.garden, p = g.player;
        g.elapsed += dt; g.timeLeft = Math.max(0, g.timeLeft - dt);
        if (this.jumpQueued) { g.jumpBuffer = .15; this.jumpQueued = false; }
        else g.jumpBuffer = Math.max(0, g.jumpBuffer - dt);
        g.coyote = p.grounded ? .12 : Math.max(0, g.coyote - dt);
        if (g.jumpBuffer > 0 && g.coyote > 0) {
            p.vy = this.getGrowth().stage >= 1 ? -62 : -53;
            p.grounded = false; g.coyote = 0; g.jumpBuffer = 0; this.emit('jump');
        }
        const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const targetSpeed = direction * 28;
        p.vx += clamp(targetSpeed - p.vx, -150 * dt, 150 * dt);
        if (direction) p.facing = direction;
        p.x = clamp(p.x + p.vx * dt, 3, GARDEN_WIDTH - 3);
        const oldY = p.y;
        p.vy += 94 * dt; p.y += p.vy * dt; p.grounded = false;
        if (p.vy >= 0) {
            let landed = null;
            for (const platform of g.platforms) {
                if (p.x + 2 > platform.x && p.x - 2 < platform.x + platform.w && oldY <= platform.y + .1 && p.y >= platform.y) {
                    if (!landed || platform.y < landed.y) landed = platform;
                }
            }
            if (landed) { p.y = landed.y; p.vy = 0; p.grounded = true; }
        }
        for (const item of g.items) {
            if (!item.collected && Math.hypot(p.x - item.x, (p.y - 4) - item.y) < 5) {
                item.collected = true; g.rewards[item.kind === 'berry' ? 'berries' : 'seeds']++; this.emit('collect');
            }
        }
        g.camera = clamp(p.x - 35, 0, GARDEN_WIDTH - 100);
        if (p.x >= g.exitX) this.finishOuting('gate');
        else if (g.timeLeft <= 0) this.finishOuting('time');
    }
    stepSalvage(dt) {
        const s = this.salvage, b = s.ball;
        s.elapsed += dt; s.timeLeft = Math.max(0, s.timeLeft - dt);
        if (b.active) {
            b.age += dt; b.vy += 35 * dt;
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.x < 6 + b.r || b.x > 94 - b.r) {
                b.x = clamp(b.x, 6 + b.r, 94 - b.r); b.vx *= -.88; this.emit('bounce'); s.bounces++;
            }
            if (b.y < 20 + b.r) { b.y = 20 + b.r; b.vy = Math.abs(b.vy) * .8; this.emit('bounce'); s.bounces++; }
            for (const bumper of s.bumpers) {
                const dx = b.x - bumper.x, dy = b.y - bumper.y, distance = Math.hypot(dx, dy), radius = b.r + bumper.r;
                if (distance < radius) {
                    const nx = distance > .0001 ? dx / distance : 0, ny = distance > .0001 ? dy / distance : -1;
                    b.x = bumper.x + nx * (radius + .02); b.y = bumper.y + ny * (radius + .02);
                    const velocity = b.vx * nx + b.vy * ny;
                    if (velocity < 0) {
                        b.vx -= 1.92 * velocity * nx; b.vy -= 1.92 * velocity * ny;
                        this.emit('bounce'); s.bounces++;
                    }
                }
            }
            for (const target of s.targets) {
                if (!target.collected && Math.hypot(b.x - target.x, b.y - target.y) < b.r + target.r) {
                    target.collected = true; s.rewards.scrap += target.value; this.emit('collect');
                }
            }
            s.trail.push({ x: b.x, y: b.y }); if (s.trail.length > 18) s.trail.shift();
            if (b.y > 79 || b.age >= 7) {
                b.active = false; b.x = 50; b.y = 72; b.vx = 0; b.vy = 0; this.emit('splash');
            }
        }
        if (s.timeLeft <= 0 || (s.shotsLeft === 0 && !b.active) || s.targets.every(t => t.collected)) this.finishOuting('done');
    }
}

module.exports = { LittleRamblerEngine, BUILDINGS, GARDEN_WIDTH, normalizeSave };
