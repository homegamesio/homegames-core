const { WORLD, C, SECTORS, ROLES, UPGRADES } = require('./settings');
const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = n => typeof n === 'number' && Number.isFinite(n);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const copy = value => JSON.parse(JSON.stringify(value));
const emptyInput = () => ({ x: 0, y: 0, fire: false, harvest: false, boost: false });
const ENEMY_TYPES = ['scout', 'lancer', 'bomber', 'shard', 'boss'];
const PLANET_NAMES = ['LULLABY', 'MOTHER OF PEARL', 'EMBER HOME', 'VESPERS', 'THE GREEN ROOM', 'HALCYON', 'MOURNING STAR', 'LITTLE EDEN'];

// Swept collision keeps shots reliable even when a large tick crosses a target.
function segmentDistance(ax, ay, bx, by, p) {
    const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
    const t = length ? clamp(((p.x - ax) * dx + (p.y - ay) * dy) / length, 0, 1) : 0;
    return Math.hypot(p.x - ax - dx * t, p.y - ay - dy * t);
}

class Engine {
    constructor(seed = 1, saveData) {
        this.seed = finite(seed) ? seed >>> 0 : 1;
        this.rng = this.seed || 1;
        this.players = new Map();
        this.events = [];
        this.messages = [];
        this.saved = this.validateCheckpoint(saveData);
        this.hasCheckpoint = !!this.saved;
        this.reset();
        this.phase = 'title';
    }
    random() {
        let x = this.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        this.rng = x >>> 0;
        return this.rng / 4294967296;
    }
    reset() {
        this.rng = this.seed || 1;
        this.phase = 'title'; this.paused = false; this.time = 0; this.sector = 0; this.sectorTime = 0;
        this.nextId = 1; this.threat = 0; this.gateReady = false; this.protection = 3;
        this.cargo = { ore: 0, crystal: 0, life: 0 };
        this.upgrades = Object.fromEntries(UPGRADES.map(u => [u.id, 0]));
        this.stats = { consumed: 0, rescued: 0, kills: 0, bosses: 0, novas: 0, deaths: 0, ore: 0, crystal: 0, life: 0 };
        this.core = { x: 250, y: 450, hp: 440, maxHp: 440, shield: 160, maxShield: 160,
            energy: 28, maxEnergy: 100, radius: 31, angle: 0, hurtAt: -10, shotClock: 0 };
        this.planets = []; this.enemies = []; this.shots = []; this.particles = []; this.beams = []; this.rings = [];
        this.modules = [{ type: 'fangs', level: 1, angle: 0 }]; this.boss = null;
        this.progress = { resolved: 0, required: 3 }; this.objective = 'Awaken the world eater.';
        this.events.length = 0; this.messages.length = 0; this.soundClock = {}; this.spawnClock = 6;
    }
    addPlayer(id, name) {
        if (this.players.has(id)) return this.players.get(id);
        if (this.players.size >= 6) return null;
        const occupied = new Set(Array.from(this.players.values(), p => p.colorIndex));
        const index = [0, 1, 2, 3, 4, 5].find(i => !occupied.has(i)), angle = index * TAU / 6;
        const p = { id, name: String(name || `PILOT ${index + 1}`).slice(0, 24),
            x: this.core.x + Math.cos(angle) * 40, y: this.core.y + Math.sin(angle) * 40,
            vx: 0, vy: 0, angle, hp: 72, maxHp: 72, respawn: 0, role: 'vanguard',
            colorIndex: index, input: emptyInput(), inv: 3, shotClock: 0, boostCharge: 1,
            boosting: false, boostLocked: false, harvesting: null, rescueClock: 0 };
        this.players.set(id, p);
        return p;
    }
    removePlayer(id) { return this.players.delete(id); }
    resetPlayers() {
        let i = 0;
        for (const p of this.players.values()) {
            const angle = i++ * TAU / Math.max(1, this.players.size);
            p.x = this.core.x + Math.cos(angle) * 43; p.y = this.core.y + Math.sin(angle) * 43;
            p.vx = p.vy = 0; p.hp = p.maxHp; p.respawn = 0; p.inv = 3; p.shotClock = 0;
            p.boostCharge = 1; p.boosting = false; p.boostLocked = false; p.harvesting = null; p.input = emptyInput();
        }
    }
    start() {
        this.reset(); this.hasCheckpoint = false; this.saved = null;
        this.loadSector(); this.resetPlayers(); this.phase = 'play';
        this.say('WE CARRY THE LAST OF OUR KIND. FEED. GROW. ENDURE.');
        this.emit('jump');
        return true;
    }
    resume() {
        if (!this.saved) return false;
        const save = copy(this.saved);
        this.reset();
        for (const key of ['seed', 'rng', 'sector', 'time', 'sectorTime', 'nextId', 'threat', 'cargo', 'stats',
            'upgrades', 'core', 'planets', 'enemies', 'progress', 'spawnClock', 'gateReady']) this[key] = save[key];
        this.phase = save.phase;
        this.boss = this.enemies.find(e => e.type === 'boss' && e.hp > 0) || null;
        this.protection = 3; this.refreshModules(); this.resetPlayers(); this.updateObjective();
        this.hasCheckpoint = false; this.saved = null;
        this.say('THE VOYAGE CONTINUES.'); this.emit('jump');
        return true;
    }
    loadSector() {
        this.core.x = 250; this.core.y = 450; this.core.angle = 0;
        this.core.energy = Math.max(28, this.core.energy);
        this.core.shotClock = 0; this.core.hurtAt = this.time - 10;
        this.enemies = []; this.shots = []; this.beams = []; this.particles = []; this.rings = [];
        this.boss = null; this.gateReady = false; this.sectorTime = 0; this.spawnClock = 6;
        this.progress = { resolved: 0, required: 3 + Math.floor(this.sector / 2) }; this.protection = 3;
        const layouts = [[340, 450], [560, 325], [590, 620], [830, 420], [860, 690], [1040, 230], [1120, 560], [330, 180]];
        this.planets = layouts.map(([x, y], i) => {
            const kind = i === 0 || i === 3 || i === 6 ? 'ore' : i === 1 || i === 4 || i === 7 ? 'crystal' : 'garden';
            const radius = i === 0 ? 34 : 26 + this.random() * 17;
            const amount = kind === 'ore' ? 65 : kind === 'crystal' ? 43 : 58;
            return { id: this.nextId++, name: PLANET_NAMES[(i + this.sector) % PLANET_NAMES.length],
                x: x + (i ? this.random() * 48 - 24 : 0), y: y + (i ? this.random() * 48 - 24 : 0),
                radius, kind, amount, maxAmount: amount, inhabited: kind === 'garden', population: kind === 'garden' ? 18 + this.sector * 3 : 0,
                consumed: false, rescued: false, angle: this.random() * TAU, orbit: this.random() * TAU };
        });
        this.updateObjective();
    }
    setInput(id, input = {}) {
        const p = this.players.get(id); if (!p) return false;
        let x = finite(input.x) ? clamp(input.x, -1, 1) : 0, y = finite(input.y) ? clamp(input.y, -1, 1) : 0;
        const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
        p.input = { x, y, fire: !!input.fire, harvest: !!input.harvest, boost: !!input.boost };
        if (finite(input.aimX) && finite(input.aimY) && Math.hypot(input.aimX, input.aimY) > .1) {
            p.input.aimX = input.aimX; p.input.aimY = input.aimY;
        }
        return true;
    }
    setRole(id, role) {
        const p = this.players.get(id);
        if (!p || !ROLES.some(r => r.id === role)) return false;
        const fraction = p.hp / p.maxHp;
        p.role = role; p.maxHp = role === 'warden' ? 100 : 72; p.hp = p.maxHp * fraction;
        return true;
    }
    emit(event) {
        if (this.events.length < 32) this.events.push(event);
    }
    sound(event, delay) {
        if (this.time >= (this.soundClock[event] || 0)) { this.emit(event); this.soundClock[event] = this.time + delay; }
    }
    say(text) { this.messages.push({ text, at: this.time }); if (this.messages.length > 5) this.messages.shift(); }
    nearest(list, from, range = Infinity, predicate = () => true) {
        let best = null, closest = range;
        for (const item of list) {
            if (!predicate(item)) continue;
            const d = distance(from, item);
            if (d < closest) { best = item; closest = d; }
        }
        return best;
    }
    updateObjective() {
        if (this.phase === 'won') this.objective = 'A NEW DAWN. YOUR PEOPLE WILL REMEMBER.';
        else if (this.phase === 'lost') this.objective = 'EVEN TITANS FALL. THE VOYAGE CAN BEGIN AGAIN.';
        else if (this.phase === 'forge') this.objective = 'Spend your cargo. Grow the ark. Cross the dark.';
        else if (this.gateReady) this.objective = 'SYSTEM CLEARED — OPEN THE FORGE TO EVOLVE';
        else if (this.boss) this.objective = `BREAK ${this.boss.name}`;
        else this.objective = `RESOLVE ${this.progress.required} WORLDS — ${this.progress.resolved}/${this.progress.required} · DEVOUR OR RESCUE`;
    }
    step(dt = 1 / 30) {
        if (this.paused || this.phase !== 'play') return;
        if (!finite(dt) || dt <= 0) return;
        // Substeps preserve damage and movement under a delayed host tick.
        let remaining = Math.min(dt, .25);
        while (remaining > 1e-8 && this.phase === 'play') {
            const tick = Math.min(remaining, 1 / 30); this.tick(tick); remaining -= tick;
        }
    }
    tick(dt) {
        this.time += dt; this.sectorTime += dt; this.protection = Math.max(0, this.protection - dt);
        this.core.angle += dt * .12;
        this.core.energy = Math.min(this.core.maxEnergy, this.core.energy + dt * (.65 + this.upgrades.heart * .2));
        this.core.shotClock -= dt;
        if (this.time - this.core.hurtAt > 3.5) this.core.shield = Math.min(this.core.maxShield, this.core.shield + dt * (9 + this.upgrades.carapace * 2));
        this.core.hp = Math.min(this.core.maxHp, this.core.hp + dt * this.upgrades.choir * 1.2);
        let cx = 0, cy = 0, alive = 0;
        for (const p of this.players.values()) {
            this.tickPlayer(p, dt);
            if (p.respawn <= 0) { cx += p.x; cy += p.y; alive++; }
        }
        if (alive) {
            const dx = cx / alive - this.core.x, dy = cy / alive - this.core.y, d = Math.hypot(dx, dy);
            const speed = Math.min(76 * (1 + this.upgrades.wings * .15), d * 1.3);
            if (d > 5) { this.core.x += dx / d * speed * dt; this.core.y += dy / d * speed * dt; }
        }
        this.core.x = clamp(this.core.x, 50, WORLD.width - 50); this.core.y = clamp(this.core.y, 50, WORLD.height - 50);
        for (const p of this.players.values()) {
            const d = distance(p, this.core);
            if (d > WORLD.tether) { p.x = this.core.x + (p.x - this.core.x) / d * WORLD.tether; p.y = this.core.y + (p.y - this.core.y) / d * WORLD.tether; }
        }
        // The living ark helps new pilots but asks them to steer it to each world.
        const meal = this.nearest(this.planets, this.core, 125 + this.upgrades.siphon * 12, p => !p.consumed && !p.inhabited);
        if (meal) this.harvest(meal, dt * (3.6 + this.upgrades.siphon * 1.8));
        if (this.core.shotClock <= 0) {
            const target = this.nearest(this.enemies, this.core, 490, e => e.hp > 0 && e.warm <= 0);
            if (target) {
                this.fire(this.core, target, 10 * (1 + this.upgrades.fangs * .35), true, 370, 'core');
                this.core.shotClock = .65 / (1 + this.upgrades.fangs * .16);
            }
        }
        this.spawnClock -= dt;
        if (this.spawnClock <= 0 && !this.gateReady) {
            const cap = this.boss ? 5 : 5 + Math.floor(this.sector / 2);
            if (this.enemies.filter(e => !e.boss).length < cap) this.spawnWave();
            this.spawnClock = Math.max(4.3, 9 - this.sector * .6 - this.threat * .12) * (this.boss ? 1.65 : 1);
        }
        for (const enemy of this.enemies) if (enemy.hp > 0) this.tickEnemy(enemy, dt);
        this.tickBeams(dt); this.tickShots(dt);
        this.enemies = this.enemies.filter(e => e.hp > 0);
        this.tickEffects(dt);
        if (!this.boss && !this.gateReady && this.progress.resolved >= this.progress.required) this.spawnBoss();
        this.refreshModules(); this.updateObjective();
    }
    tickPlayer(p, dt) {
        p.inv = Math.max(0, p.inv - dt); p.shotClock -= dt; p.rescueClock = Math.max(0, p.rescueClock - dt);
        p.harvesting = null;
        if (p.respawn > 0) {
            p.respawn -= dt; p.x = this.core.x; p.y = this.core.y; p.vx = p.vy = 0;
            if (p.respawn <= 0) { p.hp = p.maxHp; p.inv = 3; p.respawn = 0; this.burst(p.x, p.y, C.teal, 10); this.emit('build'); }
            return;
        }
        const input = p.input;
        if (!input.boost) p.boostLocked = false;
        if (input.boost && p.boostCharge <= .04) p.boostLocked = true;
        p.boosting = input.boost && !p.boostLocked && p.boostCharge > .04 && Math.hypot(input.x, input.y) > .1;
        p.boostCharge = clamp(p.boostCharge + dt * (p.boosting ? -.43 / (1 + this.upgrades.wings * .2) : .23), 0, 1);
        const speed = 106 * (1 + this.upgrades.wings * .15) * (p.boosting ? 1.95 : 1);
        p.vx = input.x * speed; p.vy = input.y * speed;
        p.x = clamp(p.x + p.vx * dt, 20, WORLD.width - 20); p.y = clamp(p.y + p.vy * dt, 20, WORLD.height - 20);
        if (Math.hypot(p.vx, p.vy) > .1) p.angle = Math.atan2(p.vy, p.vx);
        if (p.role === 'warden' && distance(p, this.core) < 95) this.core.hp = Math.min(this.core.maxHp, this.core.hp + dt * 1.8 / Math.sqrt(this.players.size));
        if (input.harvest) {
            const target = this.nearest(this.planets, p, 105 + this.upgrades.siphon * 20, planet => !planet.consumed);
            if (target) {
                p.harvesting = target.id;
                p.angle = Math.atan2(target.y - p.y, target.x - p.x);
                this.harvest(target, dt * 11 * (p.role === 'harvester' ? 1.65 : 1) * (1 + this.upgrades.siphon * .35));
            }
        }
        if (input.fire && p.shotClock <= 0) {
            let target = this.nearest(this.enemies, p, 580, e => e.hp > 0 && e.warm <= 0);
            if (finite(input.aimX) && finite(input.aimY)) target = { x: p.x + input.aimX * 500, y: p.y + input.aimY * 500 };
            if (target) {
                p.angle = Math.atan2(target.y - p.y, target.x - p.x);
                this.fire(p, target, 5.8 * (p.role === 'vanguard' ? 1.4 : 1) * (1 + this.upgrades.fangs * .35), true, 440, p.id);
                p.shotClock = .25;
            }
        }
    }
    harvest(planet, amount) {
        if (planet.consumed || amount <= 0) return;
        const mined = Math.min(planet.amount, amount);
        planet.amount = Math.max(0, planet.amount - mined);
        const type = planet.kind === 'crystal' ? 'crystal' : 'ore';
        this.cargo[type] += mined; this.stats[type] += mined;
        this.charge(mined * .36);
        this.sound('harvest', 1.2);
        if (planet.amount <= .00001) {
            planet.amount = 0; planet.consumed = true; this.stats.consumed++; this.progress.resolved++;
            if (planet.inhabited) {
                this.threat += 2; this.say(`${planet.name} IS SILENT. VENGEANCE IS COMING.`);
                for (const side of [-1, 1]) this.spawn('scout', clamp(planet.x + side * 220, 35, WORLD.width - 35), clamp(planet.y + 160, 35, WORLD.height - 35));
            }
            else this.say(`${planet.name} BECOMES PART OF US.`);
            this.core.hp = Math.min(this.core.maxHp, this.core.hp + 16);
            this.charge(13); this.burst(planet.x, planet.y, planet.kind === 'crystal' ? C.blue : C.gold, 22);
            this.ring(planet.x, planet.y, C.gold, 160, 1.25); this.emit('consume'); this.updateObjective();
        }
    }
    rescue(id) {
        const p = this.players.get(id);
        if (this.phase !== 'play' || this.paused || !p || p.respawn > 0 || p.rescueClock > 0) return false;
        const planet = this.nearest(this.planets, p, 125 + this.upgrades.siphon * 20, v => v.inhabited && !v.consumed);
        if (!planet || this.core.energy < 20) return false;
        this.core.energy -= 20; p.rescueClock = .8;
        // Population falls with damage: rescuing a half-devoured world cannot produce full rewards.
        const population = Math.ceil(planet.population * planet.amount / planet.maxAmount);
        this.cargo.life += population; this.stats.life += population;
        this.cargo.crystal += 12; this.stats.crystal += 12;
        planet.rescued = true; planet.consumed = true; planet.population = population;
        this.stats.rescued += population; this.progress.resolved++;
        this.core.hp = Math.min(this.core.maxHp, this.core.hp + 32); this.core.shield = Math.min(this.core.maxShield, this.core.shield + 30);
        this.say(`${population} VOICES FROM ${planet.name} JOIN OUR CHOIR.`);
        this.burst(planet.x, planet.y, C.teal, 24); this.ring(planet.x, planet.y, C.teal, 180, 1.5);
        this.emit('rescue'); this.updateObjective();
        return true;
    }
    charge(amount) { this.core.energy = Math.min(this.core.maxEnergy, this.core.energy + amount * (1 + this.upgrades.heart * .3)); }
    nova(id) {
        const p = this.players.get(id);
        if (this.phase !== 'play' || this.paused || (id !== undefined && (!p || p.respawn > 0)) || this.core.energy < 100 - 1e-6) return false;
        this.core.energy = 0; this.stats.novas++;
        for (const enemy of this.enemies) if (distance(enemy, this.core) < 650) this.damageEnemy(enemy, 110 + this.upgrades.heart * 45);
        this.shots = this.shots.filter(s => s.friendly);
        this.beams = [];
        this.core.shield = Math.min(this.core.maxShield, this.core.shield + 30 + this.upgrades.heart * 35);
        this.protection = Math.max(this.protection, 1.2);
        this.ring(this.core.x, this.core.y, C.white, 590, 1.3);
        this.ring(this.core.x, this.core.y, C.teal, 410, 1.5);
        this.burst(this.core.x, this.core.y, C.teal, 30); this.say('THE HEART OF A DYING STAR.'); this.emit('nova');
        return true;
    }
    spawnWave() {
        const angle = this.random() * TAU;
        const x = clamp(this.core.x + Math.cos(angle) * 400, 45, WORLD.width - 45);
        const y = clamp(this.core.y + Math.sin(angle) * 310, 45, WORLD.height - 45);
        const roll = this.random();
        const type = roll < .5 ? 'scout' : roll < .78 ? 'lancer' : 'bomber';
        this.spawn(type, x, y);
    }
    spawn(type, x, y) {
        if (this.enemies.length >= 12 || !ENEMY_TYPES.includes(type)) return null;
        const hp = (type === 'scout' ? 26 : type === 'lancer' ? 39 : type === 'shard' ? 16 : 58) * (1 + this.sector * .14 + Math.min(10, this.threat) * .03);
        const enemy = { id: this.nextId++, type, x, y, radius: type === 'bomber' ? 17 : type === 'lancer' ? 13 : 10,
            hp, maxHp: hp, angle: 0, warm: 1.3, clock: 2.2 + this.random(), age: 0, stage: 1, boss: false,
            strafe: this.random() < .5 ? -1 : 1 };
        this.enemies.push(enemy); return enemy;
    }
    spawnBoss() {
        const angle = this.random() * TAU;
        const hp = (600 + this.sector * 340) * (1 + Math.max(0, this.players.size - 1) * .38);
        const enemy = { id: this.nextId++, type: 'boss', name: SECTORS[this.sector].boss,
            x: clamp(this.core.x + Math.cos(angle) * 330, 70, WORLD.width - 70),
            y: clamp(this.core.y + Math.sin(angle) * 270, 70, WORLD.height - 70),
            radius: 40 + this.sector * 4, hp, maxHp: hp, angle: angle + Math.PI, warm: 3.5,
            clock: 3, age: 0, stage: 1, boss: true, strafe: 1, attack: 0 };
        this.boss = enemy; this.enemies.push(enemy);
        this.say(`${enemy.name} HAS FOUND US.`); this.emit('boss'); this.updateObjective();
    }
    tickEnemy(e, dt) {
        e.age += dt; e.warm = Math.max(0, e.warm - dt); if (e.warm > 0) return;
        const dx = this.core.x - e.x, dy = this.core.y - e.y, d = Math.max(1, Math.hypot(dx, dy));
        e.angle = Math.atan2(dy, dx);
        const desired = e.boss ? 285 : e.type === 'lancer' ? 270 : e.type === 'bomber' ? 210 : 175;
        const speed = e.boss ? 35 : e.type === 'shard' ? 80 : 43 + this.sector * 3;
        const radial = clamp((d - desired) / 80, -.6, 1);
        const tangent = e.boss ? .2 : .4 * e.strafe;
        e.x = clamp(e.x + (dx / d * radial - dy / d * tangent) * speed * dt, 25, WORLD.width - 25);
        e.y = clamp(e.y + (dy / d * radial + dx / d * tangent) * speed * dt, 25, WORLD.height - 25);
        e.clock -= dt;
        if (e.boss) {
            const stage = e.hp / e.maxHp < .3 ? 3 : e.hp / e.maxHp < .65 ? 2 : 1;
            if (stage > e.stage) { e.stage = stage; this.ring(e.x, e.y, C.red, 220, 1.1); this.say(`${e.name} — PHASE ${stage}`); this.emit('boss'); }
            if (e.clock <= 0) {
                this.bossAttack(e); e.clock = Math.max(1.8, 3.6 - this.sector * .15 - e.stage * .25);
            }
        } else if (e.clock <= 0) {
            if (e.type === 'lancer') this.addBeam(e, this.core, 1.6, 24 + this.sector * 2);
            else if (e.type === 'bomber') {
                for (let i = -1; i <= 1; i++) this.fireAngle(e, e.angle + i * .28, 12 + this.sector, false, 106, 'enemy');
            } else this.fire(e, this.core, 9 + this.sector * 1.5, false, 126, 'enemy');
            e.clock = (e.type === 'lancer' ? 5 : 3.6) + this.random() * 1.1;
        }
    }
    bossAttack(e) {
        e.attack++;
        e.attackName = this.sector === 4 ? 'SOLAR JUDGMENT' : this.sector === 3 ? 'ANCESTRAL ECHO' : this.sector === 2 ? 'GLASS HARMONIC' : this.sector === 1 ? 'CINDER SPEAR' : 'THE WATCHER OPENS';
        if (e.attack % 3 === 0) {
            const count = 8 + this.sector * 2 + e.stage * 2;
            const offset = e.angle + e.attack * .33;
            for (let i = 0; i < count; i++) this.fireAngle(e, offset + TAU * i / count, 13 + this.sector * 2, false, 96 + this.sector * 7, 'boss');
            this.ring(e.x, e.y, C.red, 95, .6);
        } else if ((this.sector >= 1 && e.attack % 2 === 0) || this.sector === 4) {
            this.addBeam(e, this.core, 1.8 - e.stage * .1, 32 + this.sector * 3);
            if (this.sector === 4 && e.stage >= 2) {
                // The star god draws a three-pronged crown; the gaps remain traversable.
                for (const side of [-1, 1]) this.addBeam(e, { x: e.x + Math.cos(e.angle + side * .38) * 400, y: e.y + Math.sin(e.angle + side * .38) * 400 }, 1.9, 30);
            }
            if (this.sector >= 3 && e.stage > 1) {
                const target = this.nearest(Array.from(this.players.values()), e, Infinity, p => p.respawn <= 0);
                if (target) this.addBeam(e, target, 1.9, 23);
            }
        } else {
            const count = 3 + (e.stage - 1) * 2;
            for (let i = 0; i < count; i++) this.fireAngle(e, e.angle + (i - (count - 1) / 2) * .18, 15 + this.sector * 2, false, 115 + this.sector * 7, 'boss');
        }
        if (this.sector === 3 && e.stage >= 2) {
            for (let i = 0; i < 6; i++) this.fireAngle(e, e.age * .6 + i * TAU / 6, 11, false, 83, 'boss');
        }
        if ((this.sector === 2 || this.sector === 3) && e.attack % 4 === 0 && this.enemies.length < 8) {
            for (let i = 0; i < 2; i++) this.spawn('shard', e.x + (i ? 35 : -35), e.y);
        }
    }
    fire(from, to, damage, friendly, speed, owner) { this.fireAngle(from, Math.atan2(to.y - from.y, to.x - from.x), damage, friendly, speed, owner); }
    fireAngle(from, angle, damage, friendly, speed, owner) {
        if (this.shots.length >= 112) return;
        this.shots.push({ x: from.x, y: from.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            friendly, damage, life: friendly ? 1.8 : 5.5, radius: friendly ? 2.4 : 4.5, owner, color: friendly ? C.teal : C.red });
        if (friendly) this.sound('shot', .18);
    }
    addBeam(from, to, duration, damage) {
        if (this.beams.length >= 6) return;
        const angle = Math.atan2(to.y - from.y, to.x - from.x), length = 900;
        this.beams.push({ x: from.x, y: from.y, tx: from.x + Math.cos(angle) * length, ty: from.y + Math.sin(angle) * length,
            angle, length, age: 0, duration, fired: false, life: duration + .3, damage, color: C.red });
    }
    tickBeams(dt) {
        for (const beam of this.beams) {
            beam.age += dt; beam.life -= dt;
            if (!beam.fired && beam.age >= beam.duration) {
                beam.fired = true;
                if (segmentDistance(beam.x, beam.y, beam.tx, beam.ty, this.core) < this.core.radius + 8) this.hurtCore(beam.damage);
                for (const p of this.players.values()) if (p.respawn <= 0 && segmentDistance(beam.x, beam.y, beam.tx, beam.ty, p) < 15) this.hurtPlayer(p, beam.damage);
            }
        }
        this.beams = this.beams.filter(b => b.life > 0);
    }
    tickShots(dt) {
        for (const shot of this.shots) {
            const ox = shot.x, oy = shot.y;
            shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
            if (shot.friendly) {
                for (const enemy of this.enemies) {
                    if (enemy.hp > 0 && enemy.warm <= 0 && segmentDistance(ox, oy, shot.x, shot.y, enemy) < enemy.radius + shot.radius) {
                        this.damageEnemy(enemy, shot.damage); shot.life = 0; break;
                    }
                }
            } else {
                let hit = false;
                for (const p of this.players.values()) {
                    if (p.respawn <= 0 && segmentDistance(ox, oy, shot.x, shot.y, p) < 9 + shot.radius) {
                        this.hurtPlayer(p, shot.damage); shot.life = 0; hit = true; break;
                    }
                }
                if (!hit && segmentDistance(ox, oy, shot.x, shot.y, this.core) < this.core.radius + shot.radius) { this.hurtCore(shot.damage); shot.life = 0; }
            }
        }
        this.shots = this.shots.filter(s => s.life > 0 && s.x > -80 && s.x < WORLD.width + 80 && s.y > -80 && s.y < WORLD.height + 80);
    }
    damageEnemy(enemy, damage) {
        if (enemy.hp <= 0 || damage <= 0) return;
        enemy.hp = Math.max(0, enemy.hp - damage); enemy.flash = .09;
        this.charge(damage * (enemy.boss ? .04 : .08));
        if (enemy.hp <= 0) {
            this.stats.kills++; this.cargo.ore += enemy.boss ? 45 : 4; this.cargo.crystal += enemy.boss ? 25 : 1;
            this.burst(enemy.x, enemy.y, enemy.boss ? C.gold : C.red, enemy.boss ? 32 : 8);
            this.ring(enemy.x, enemy.y, enemy.boss ? C.gold : C.red, enemy.boss ? 240 : 55, enemy.boss ? 1.4 : .55);
            if (enemy.boss) {
                this.stats.bosses++; this.boss = null; this.gateReady = true;
                for (const other of this.enemies) if (!other.boss) other.hp = 0;
                this.shots = this.shots.filter(s => s.friendly); this.beams = [];
                this.core.hp = Math.min(this.core.maxHp, this.core.hp + 75); this.core.shield = this.core.maxShield;
                if (this.sector === SECTORS.length - 1) {
                    this.phase = 'won'; this.say(this.stats.rescued > 0 ? 'WE WERE MADE TO DEVOUR. WE CHOSE TO CARRY THEM HOME.' : 'THE LAST LIGHT FALLS. A NEW UNIVERSE IS OURS.'); this.emit('victory');
                } else { this.say('THE HUNTER IS BROKEN. OPEN THE FORGE.'); this.emit('consume'); }
                this.updateObjective();
            }
        }
    }
    hurtCore(amount) {
        if (this.protection > 0 || this.phase !== 'play' || amount <= 0) return;
        const absorbed = Math.min(this.core.shield, amount); this.core.shield -= absorbed;
        this.core.hp = Math.max(0, this.core.hp - (amount - absorbed)); this.core.hurtAt = this.time;
        this.sound('hurt', .3); this.burst(this.core.x, this.core.y, C.red, 5);
        if (this.core.hp <= 0) { this.phase = 'lost'; this.paused = false; this.say('OUR HEART GOES QUIET.'); this.emit('defeat'); this.updateObjective(); }
    }
    hurtPlayer(p, amount) {
        if (p.inv > 0 || p.respawn > 0 || p.boosting || this.protection > 0) return;
        p.hp = Math.max(0, p.hp - amount); p.inv = .45;
        this.burst(p.x, p.y, C.red, 4); this.sound('hurt', .4);
        if (p.hp <= 0) { p.respawn = 4; p.boosting = false; this.stats.deaths++; this.say(`${p.name}: DRONE REBUILDING`); }
    }
    burst(x, y, color, count) {
        for (let i = 0; i < count && this.particles.length < 85; i++) {
            const angle = this.random() * TAU, speed = 20 + this.random() * 100, life = .35 + this.random() * .8;
            this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, radius: 1.5 + this.random() * 2 });
        }
    }
    ring(x, y, color, speed, life) {
        if (this.rings.length >= 12) this.rings.shift();
        this.rings.push({ x, y, radius: 3, speed, life, maxLife: life, color });
    }
    tickEffects(dt) {
        for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vx *= 1 - dt; p.vy *= 1 - dt; }
        this.particles = this.particles.filter(p => p.life > 0);
        for (const ring of this.rings) { ring.radius += ring.speed * dt; ring.life -= dt; }
        this.rings = this.rings.filter(r => r.life > 0);
        for (const e of this.enemies) e.flash = Math.max(0, (e.flash || 0) - dt);
    }
    refreshModules() {
        this.modules = [{ type: 'fangs', level: 1, angle: this.time * .5 }];
        for (const upgrade of UPGRADES) if (this.upgrades[upgrade.id] > 0) this.modules.push({ type: upgrade.id, level: this.upgrades[upgrade.id], angle: this.time * .35 });
        for (let i = 0; i < this.modules.length; i++) this.modules[i].angle += TAU * i / this.modules.length;
        this.core.radius = 31 + Object.values(this.upgrades).reduce((a, b) => a + b, 0) * .7;
    }
    getUpgradeCost(id) {
        const upgrade = UPGRADES.find(u => u.id === id);
        if (!upgrade || this.upgrades[id] >= upgrade.max) return null;
        return Object.fromEntries(Object.entries(upgrade.cost).map(([key, value]) => [key, Math.ceil(value * (1 + this.upgrades[id] * .5))]));
    }
    buyUpgrade(id) {
        if (this.phase !== 'forge') return false;
        const cost = this.getUpgradeCost(id); if (!cost || Object.keys(cost).some(key => this.cargo[key] + 1e-6 < cost[key])) return false;
        for (const key of Object.keys(cost)) this.cargo[key] = Math.max(0, this.cargo[key] - cost[key]);
        this.upgrades[id]++;
        if (id === 'carapace') { this.core.maxHp += 110; this.core.hp += 110; this.core.maxShield += 45; this.core.shield += 45; }
        if (id === 'choir') { this.core.maxHp += 50; this.core.hp += 50; }
        this.refreshModules(); this.emit('build'); return true;
    }
    enterForge() {
        if (this.phase !== 'play' || !this.gateReady) return false;
        this.phase = 'forge'; this.paused = false;
        this.core.hp = Math.min(this.core.maxHp, this.core.hp + 90 + this.cargo.life * .4);
        this.core.shield = this.core.maxShield;
        this.updateObjective(); this.emit('build'); return true;
    }
    nextSector() {
        if (this.phase !== 'forge' || this.sector >= SECTORS.length - 1) return false;
        this.sector++; this.phase = 'play'; this.loadSector(); this.resetPlayers(); this.say(SECTORS[this.sector].subtitle.toUpperCase()); this.emit('jump'); return true;
    }
    checkpoint() {
        if (!['play', 'forge'].includes(this.phase)) return this.saved ? copy(this.saved) : null;
        const save = { schema: 1, phase: this.phase };
        for (const key of ['seed', 'rng', 'sector', 'time', 'sectorTime', 'nextId', 'threat', 'cargo', 'stats',
            'upgrades', 'core', 'planets', 'enemies', 'progress', 'spawnClock', 'gateReady']) save[key] = copy(this[key]);
        // Drones belong to the joining session. Transient hostile rounds are deliberately not saved.
        return save;
    }
    validateCheckpoint(save) {
        try {
            if (save && JSON.stringify(save).length > 65000) return null;
            if (!save || save.schema !== 1 || !['play', 'forge'].includes(save.phase) || !Number.isInteger(save.sector) || save.sector < 0 || save.sector >= SECTORS.length) return null;
            for (const key of ['seed', 'rng', 'time', 'sectorTime', 'nextId', 'threat', 'spawnClock']) if (!finite(save[key]) || Math.abs(save[key]) > 2 ** 33) return null;
            if (!save.core || !['x', 'y', 'hp', 'maxHp', 'shield', 'maxShield', 'energy', 'maxEnergy', 'radius', 'angle', 'hurtAt', 'shotClock'].every(k => finite(save.core[k]))) return null;
            if (save.core.hp <= 0 || save.core.maxHp < save.core.hp || save.core.maxHp > 10000 || save.core.x < 0 || save.core.x > WORLD.width || save.core.y < 0 || save.core.y > WORLD.height) return null;
            for (const key of ['ore', 'crystal', 'life']) if (!save.cargo || !finite(save.cargo[key]) || save.cargo[key] < 0 || save.cargo[key] > 1e8) return null;
            for (const u of UPGRADES) if (!save.upgrades || !Number.isInteger(save.upgrades[u.id]) || save.upgrades[u.id] < 0 || save.upgrades[u.id] > u.max) return null;
            for (const key of ['consumed', 'rescued', 'kills', 'bosses', 'novas', 'deaths', 'ore', 'crystal', 'life']) if (!save.stats || !finite(save.stats[key]) || save.stats[key] < 0 || save.stats[key] > 1e8) return null;
            if (!save.progress || !Number.isInteger(save.progress.resolved) || save.progress.resolved < 0 || save.progress.resolved > 8 || save.progress.required !== 3 + Math.floor(save.sector / 2)) return null;
            if (!Array.isArray(save.planets) || save.planets.length !== 8 || !Array.isArray(save.enemies) || save.enemies.length > 12) return null;
            if (typeof save.gateReady !== 'boolean') return null;
            const expectedHull = 440 + save.upgrades.carapace * 110 + save.upgrades.choir * 50;
            const expectedShield = 160 + save.upgrades.carapace * 45;
            if (save.core.maxHp !== expectedHull || save.core.maxShield !== expectedShield || save.core.maxEnergy !== 100 || save.core.energy < 0 || save.core.energy > 100 || save.core.shield < 0 || save.core.shield > expectedShield || save.core.radius < 31 || save.core.radius > 60) return null;
            const ids = new Set();
            for (const p of save.planets) {
                if (ids.has(p.id)) return null; ids.add(p.id);
                if (typeof p.name !== 'string' || p.name.length > 60 || typeof p.consumed !== 'boolean' || typeof p.rescued !== 'boolean' || typeof p.inhabited !== 'boolean' || p.x < 0 || p.x > WORLD.width || p.y < 0 || p.y > WORLD.height || p.maxAmount <= 0 || p.maxAmount > 500 || p.population < 0 || p.population > 1000) return null;
                if (!['id', 'x', 'y', 'radius', 'amount', 'maxAmount', 'population', 'angle', 'orbit'].every(k => finite(p[k])) || !['ore', 'crystal', 'garden'].includes(p.kind) || p.amount < 0 || p.amount > p.maxAmount || p.radius < 1 || p.radius > 100) return null;
            }
            let bosses = 0;
            for (const e of save.enemies) {
                if (ids.has(e.id)) return null; ids.add(e.id);
                if (!ENEMY_TYPES.includes(e.type) || !['id', 'x', 'y', 'radius', 'hp', 'maxHp', 'angle', 'warm', 'clock', 'age', 'stage', 'strafe'].every(k => finite(e[k])) || e.hp < 0 || e.hp > e.maxHp || e.maxHp > 1e6 || e.radius <= 0 || e.radius > 100 || e.x < 0 || e.x > WORLD.width || e.y < 0 || e.y > WORLD.height) return null;
                if (e.type === 'boss') { bosses++; if (!Number.isInteger(e.attack) || e.attack < 0 || typeof e.name !== 'string' || e.name.length > 60 || !e.boss) return null; }
            }
            if (bosses > 1 || save.progress.resolved !== save.planets.filter(p => p.consumed).length) return null;
            if (save.phase === 'forge' && (!save.gateReady || save.sector === SECTORS.length - 1)) return null;
            return copy(save);
        } catch (_) { return null; }
    }
}
module.exports = { Engine, segmentDistance };
