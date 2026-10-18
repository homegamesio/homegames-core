'use strict';

const { MAPS, makeMap, WEATHER } = require('./maps');
const RULES = Object.freeze({ hz: 30, maxPlayers: 6, maxFlights: 6, maxShips: 120,
    production: 1.25, pilotY: .82, pilotRadius: .045, steerSpeed: .62, crossingLead: 2.6,
    fireCooldown: .48, shotSpeed: 1.25, shotRadius: .012 });
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Both routes must occupy the crossing at the same time. Merely intersecting
// two lines on the map is not sufficient to create a multiplayer encounter.
function closestApproach(a, b, planets) {
    const position = f => {
        const s = planets[f.source], d = planets[f.target];
        return { x: s.x + (d.x - s.x) * f.age / f.duration,
            y: s.y + (d.y - s.y) * f.age / f.duration,
            vx: (d.x - s.x) / f.duration, vy: (d.y - s.y) / f.duration };
    };
    const p = position(a), q = position(b), dx = p.x - q.x, dy = p.y - q.y;
    const vx = p.vx - q.vx, vy = p.vy - q.vy, speed2 = vx * vx + vy * vy;
    if (speed2 < .00001) return null;
    const t = -(dx * vx + dy * vy) / speed2;
    if (t < .15 || t > Math.min(a.duration - a.age, b.duration - b.age)) return null;
    return { t, separation: Math.hypot(dx + vx * t, dy + vy * t) };
}

class FleetWorld {
    constructor(seed = 519, mapId = 'orbit') {
        this.seed = seed >>> 0;
        this.phase = 'lobby'; this.soloPlayerId = null; this.resultReason = null; this.time = 0; this.nextId = 1;
        this.factions = []; this.flights = []; this.crossings = []; this.events = [];
        this.loadMap(mapId);
    }
    loadMap(mapId) {
        this.mapId = mapId;
        this.planets = makeMap(mapId);
        const map = MAPS.find(m => m.id === mapId);
        this.conditions = WEATHER[map.weather];
        this.links = [];
        for (const a of this.planets) for (const b of this.planets) {
            if (a.id < b.id && distance(a, b) < map.linkDistance) this.links.push([a.id, b.id]);
        }
    }
    selectMap(id) {
        if (this.phase !== 'lobby' || !MAPS.some(m => m.id === id)) return false;
        this.loadMap(id); return true;
    }
    random() {
        this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }
    start(players) {
        if (!players.length || players.length > RULES.maxPlayers) return false;
        this.loadMap(this.mapId); this.flights = []; this.crossings = []; this.events = [];
        this.time = 0; this.nextId = 1; this.winner = null; this.phase = 'running';
        this.soloPlayerId = players.length === 1 ? players[0].id : null; this.resultReason = null;
        this.factions = players.map((p, i) => ({ id: p.id, name: p.name, color: i, bot: false, nextOrder: 4 + i }));
        if (players.length === 1) for (let i = 0; i < MAPS.find(m => m.id === this.mapId).rivals; i++) {
            this.factions.push({ id: -1 - i, name: ['EMBER', 'VECTOR', 'NOVA', 'WRAITH', 'HELIX'][i], color: i + 1, bot: true, nextOrder: 5 + i * 2 });
        }
        this.factions.forEach((f, i) => {
            const home = this.planets[Math.floor(i * 6 / this.factions.length)];
            home.owner = f.id; home.ships = 70;
        });
        return true;
    }
    faction(id) { return this.factions.find(f => f.id === id); }
    owned(id) { return this.planets.filter(p => p.owner === id); }
    active(id) { return this.flights.filter(f => f.owner === id); }
    alive(id) { return this.owned(id).length > 0 || this.active(id).length > 0; }
    event(owner, text) {
        this.events.push({ owner, text, time: this.time });
        if (this.events.length > 24) this.events.shift();
    }
    disconnect(id) {
        const f = this.faction(id);
        if (!f) return null;
        // Transport seats are reused and do not establish returning identity.
        // Retire the commander to a distinct AI ID, preserving all ownership.
        const retiredId = Math.min(0, ...this.factions.map(faction => faction.id)) - 1;
        f.id = retiredId; f.bot = true; f.name = `${f.name.slice(0, 12)} AI`;
        for (const planet of this.planets) if (planet.owner === id) planet.owner = retiredId;
        for (const flight of this.flights) if (flight.owner === id) flight.owner = retiredId;
        for (const event of this.events) if (event.owner === id) event.owner = retiredId;
        if (this.winner === id) this.winner = retiredId;
        if (this.soloPlayerId === id) this.soloPlayerId = retiredId;
        return retiredId;
    }
    launch(owner, sourceId, targetId, fraction) {
        if (this.phase !== 'running' || !this.faction(owner)) return { error: 'No active command.' };
        const source = this.planets[sourceId], target = this.planets[targetId];
        if (!source || !target || source === target || source.owner !== owner) return { error: 'Choose your planet, then a destination.' };
        if (![.25, .5, 1].includes(fraction)) return { error: 'Choose 25%, 50%, or 100%.' };
        if (this.active(owner).length >= RULES.maxFlights) return { error: 'Six flights active.' };
        const count = Math.floor(source.ships * fraction);
        if (count < 2) return { error: '2 ships minimum.' };
        source.ships -= count;
        const flight = { id: this.nextId++, owner, source: sourceId, target: targetId,
            count, launched: count, age: 0, duration: 10 + distance(source, target) * .18,
            lane: .5, targetLane: null, hazards: [], nextHazard: .85, wave: 0, met: new Set(), hitUntil: 0, lastDamage: 0,
            shots: [], bursts: [], nextShot: 0, firedUntil: 0 };
        this.flights.push(flight);
        return { flight };
    }
    steer(flight, direction, dt) {
        flight.lane = clamp(flight.lane + clamp(direction, -1, 1) * RULES.steerSpeed * dt, .08, .92);
    }
    move(owner, flightId, lane) {
        const f = this.flights.find(flight => flight.id === flightId && flight.owner === owner);
        if (this.phase !== 'running' || !f || !Number.isFinite(lane) || f.count <= 0 || f.age >= f.duration) return false;
        f.targetLane = clamp(lane, .08, .92);
        return true;
    }
    fire(owner, flightId, targetId) {
        const f = this.flights.find(flight => flight.id === flightId && flight.owner === owner);
        if (this.phase !== 'running' || !f || f.count <= 0 || f.age >= f.duration || this.time < f.nextShot || f.shots.length >= 4) return false;
        const shot = { x: f.lane, y: RULES.pilotY - .08, vx: 0, vy: -RULES.shotSpeed };
        if (targetId !== undefined) {
            const target = f.hazards.find(h => h.id === targetId && !h.passed && !h.destroyed);
            if (!target) return false;
            const y = (f.age - target.born) * target.speed;
            if (y < 0 || y > .97) return false;
            // Lead the moving debris, so a tap lands even across the panel.
            const dx = target.x - shot.x, dy = y - shot.y;
            const a = RULES.shotSpeed ** 2 - target.speed ** 2, b = dy * target.speed;
            const time = (b + Math.sqrt(b * b + a * (dx * dx + dy * dy))) / a;
            if (time > 0) { shot.vx = dx / time; shot.vy = dy / time + target.speed; }
        }
        f.shots.push(shot);
        f.nextShot = this.time + RULES.fireCooldown; f.firedUntil = this.time + .12;
        return true;
    }
    tickShots(f, dt) {
        for (const shot of f.shots) {
            let target = null, firstHit = Infinity;
            for (const h of f.hazards) {
                // Shots already in flight can finish hitting debris after it
                // passes the pilot; new taps still require a visible target.
                if (h.destroyed) continue;
                const previousY = (f.age - dt - h.born) * h.speed;
                // Sweep in both axes against an ellipse. Diagonal shots cannot
                // tunnel through debris or hit a rock merely sharing its column.
                const rx = h.radius + RULES.shotRadius, ry = .035;
                const x = (shot.x - h.x) / rx, y = (shot.y - previousY) / ry;
                const vx = shot.vx / rx, vy = (shot.vy - h.speed) / ry;
                const a = vx * vx + vy * vy, b = x * vx + y * vy, c = x * x + y * y - 1;
                const discriminant = b * b - a * c;
                const hitAt = c <= 0 ? 0 : a > 0 && discriminant >= 0 ? (-b - Math.sqrt(discriminant)) / a : Infinity;
                if (hitAt >= 0 && hitAt <= dt && hitAt < firstHit) { target = h; firstHit = hitAt; }
            }
            shot.x += shot.vx * dt; shot.y += shot.vy * dt;
            if (target) {
                shot.hit = true;
                target.hp = (target.hp ?? (target.kind === 'wreck' ? 2 : 1)) - 1;
                target.flashUntil = this.time + .12;
                if (target.hp <= 0) {
                    target.destroyed = true;
                    f.bursts.push({ x: target.x, y: (f.age - target.born) * target.speed, at: this.time, heavy: target.kind === 'wreck' });
                    if (f.bursts.length > 8) f.bursts.shift();
                }
            }
        }
        f.shots = f.shots.filter(s => !s.hit && s.x >= -.06 && s.x <= 1.06 && s.y >= -.06 && s.y <= 1.06);
        f.hazards = f.hazards.filter(h => !h.destroyed);
        f.bursts = f.bursts.filter(b => this.time - b.at < .32);
    }
    position(flight) {
        const a = this.planets[flight.source], b = this.planets[flight.target], t = flight.age / flight.duration;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    damage(flight, amount) {
        const lost = Math.min(flight.count, amount);
        flight.count -= lost; flight.hitUntil = this.time + .48; flight.lastDamage = lost;
    }
    hazardsFor(flight) {
        const hazards = flight.hazards.map(h => ({ ...h, y: (flight.age - h.born) * h.speed }));
        for (const c of this.crossings) {
            if (c.resolved || (c.a !== flight.id && c.b !== flight.id)) continue;
            const other = this.flights.find(f => f.id === (c.a === flight.id ? c.b : c.a));
            if (!other || other.count <= 0) continue;
            hazards.push({ kind: 'fleet', x: 1 - other.lane,
                y: RULES.pilotY * clamp(1 - (c.at - this.time) / c.lead, 0, 1),
                radius: .09, damage: clamp(Math.ceil(other.count / 12), 1, 4), owner: other.owner, count: other.count });
        }
        return hazards;
    }
    pilotBot(flight, dt) {
        // Bots see exactly the same debris and lose real ships on impact.
        const threats = this.hazardsFor(flight).filter(h => !h.passed && h.y > .22 && h.y < .89);
        if (threats.some(h => h.kind !== 'fleet' && h.y < .72 && Math.abs(h.x - flight.lane) < h.radius)) this.fire(flight.owner, flight.id);
        if (!threats.length) return;
        let best = flight.lane, bestScore = -Infinity;
        for (const lane of [.12, .3, .5, .7, .88]) {
            const safety = Math.min(...threats.map(h => Math.abs(lane - h.x) - h.radius));
            const score = safety - Math.abs(lane - flight.lane) * .13;
            if (score > bestScore) { bestScore = score; best = lane; }
        }
        if (Math.abs(best - flight.lane) > .03) this.steer(flight, Math.sign(best - flight.lane) * .78, dt);
    }
    orderBot(faction) {
        if (this.time < faction.nextOrder) return;
        faction.nextOrder = this.time + 3 + this.random() * 2;
        if (this.active(faction.id).length >= 3) return;
        const source = this.owned(faction.id).filter(p => p.ships >= 22).sort((a, b) => b.ships - a.ships)[0];
        if (!source) return;
        const target = this.planets.filter(p => p.owner !== faction.id).sort((a, b) =>
            (a.ships + distance(source, a) * .5) - (b.ships + distance(source, b) * .5))[0];
        if (target && source.ships * .75 > target.ships + 3) this.launch(faction.id, source.id, target.id, 1);
        else if (target && source.ships >= 70) this.launch(faction.id, source.id, target.id, .5);
    }
    tick(dt, steering = new Map(), firing = new Set()) {
        if (this.phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
        this.time += dt;
        for (const p of this.planets) {
            if (p.owner === null || p.ships >= RULES.maxShips) continue;
            const neighbors = this.links.filter(([a, b]) =>
                (a === p.id && this.planets[b].owner === p.owner) || (b === p.id && this.planets[a].owner === p.owner)).length;
            p.production += RULES.production * (1 + Math.min(.3, neighbors * .1)) * dt;
            const whole = Math.floor(p.production); p.production -= whole;
            p.ships = Math.min(RULES.maxShips, p.ships + whole);
        }
        for (const faction of this.factions) if (faction.bot) this.orderBot(faction);
        for (const f of this.flights) {
            if (this.faction(f.owner).bot) this.pilotBot(f, dt);
            else {
                const direction = steering.get(f.id) || 0;
                if (direction) { f.targetLane = null; this.steer(f, direction, dt); }
                else if (f.targetLane !== null) {
                    const step = RULES.steerSpeed * dt;
                    f.lane += clamp(f.targetLane - f.lane, -step, step);
                    if (f.lane === f.targetLane) f.targetLane = null;
                }
                if (firing.has(f.id)) this.fire(f.owner, f.id);
            }
            f.age += dt;
            if (f.age >= f.nextHazard && f.age < f.duration - 3.2) {
                const heavy = f.wave % this.conditions.heavyEvery === this.conditions.heavyEvery - 1;
                f.hazards.push({ id: f.wave, kind: heavy ? 'wreck' : 'rock', x: f.wave === 0 ? .5 : .1 + this.random() * .8,
                    born: f.age, speed: heavy ? .25 : .31, radius: heavy ? .085 : .055,
                    damage: heavy ? 3 : 1, hp: heavy ? 2 : 1, passed: false, spin: this.random() * 6 });
                f.wave++; f.nextHazard = f.age + this.conditions.gap + this.random() * this.conditions.jitter;
            }
            this.tickShots(f, dt);
            for (const h of f.hazards) {
                const y = (f.age - h.born) * h.speed;
                if (!h.passed && y >= RULES.pilotY - .025 && y <= RULES.pilotY + .04 && Math.abs(f.lane - h.x) < h.radius + RULES.pilotRadius) {
                    this.damage(f, h.damage); h.passed = true;
                }
                if (y > RULES.pilotY + .04) h.passed = true;
            }
            f.hazards = f.hazards.filter(h => (f.age - h.born) * h.speed < 1.08);
        }
        this.tickCrossings();
        for (const f of this.flights) {
            if (f.count <= 0) this.event(f.owner, `Flight ${f.id} lost on the way to ${this.planets[f.target].name}.`);
            else if (f.age >= f.duration) this.arrive(f);
        }
        this.flights = this.flights.filter(f => f.count > 0 && f.age < f.duration);
        const activeIds = new Set(this.flights.map(f => f.id));
        this.crossings = this.crossings.filter(c => activeIds.has(c.a) && activeIds.has(c.b) && this.time < c.at + .5);
        // Per-flight encounter history cannot grow with a long match.
        for (const f of this.flights) for (const id of f.met) if (!activeIds.has(id)) f.met.delete(id);
        const alive = this.factions.filter(f => this.alive(f.id));
        if (this.soloPlayerId !== null && !this.alive(this.soloPlayerId)) {
            this.phase = 'gameover'; this.winner = null; this.resultReason = 'defeat';
        } else if (alive.length <= 1 && this.time > 2) {
            this.phase = 'gameover'; this.winner = alive[0]?.id ?? null;
        }
    }
    tickCrossings() {
        for (let i = 0; i < this.flights.length; i++) for (let j = i + 1; j < this.flights.length; j++) {
            const a = this.flights[i], b = this.flights[j];
            if (a.owner === b.owner || a.count <= 0 || b.count <= 0 || a.met.has(b.id)) continue;
            const near = closestApproach(a, b, this.planets);
            if (!near || near.separation > 5 || near.t > RULES.crossingLead) continue;
            a.met.add(b.id); b.met.add(a.id);
            this.crossings.push({ a: a.id, b: b.id, at: this.time + near.t, lead: near.t, resolved: false });
        }
        for (const c of this.crossings) {
            if (c.resolved || this.time < c.at) continue;
            c.resolved = true;
            const a = this.flights.find(f => f.id === c.a), b = this.flights.find(f => f.id === c.b);
            if (!a || !b || a.count <= 0 || b.count <= 0) continue;
            // Mirrored lanes give both pilots the same physical encounter.
            // Snapshot strength before applying either side's damage.
            if (Math.abs(a.lane - (1 - b.lane)) < .09 + RULES.pilotRadius) {
                const da = clamp(Math.ceil(b.count / 12), 1, 4), db = clamp(Math.ceil(a.count / 12), 1, 4);
                this.damage(a, da); this.damage(b, db);
                this.event(a.owner, `Enemy crossing! Flight ${a.id} lost ${da} ships.`);
                this.event(b.owner, `Enemy crossing! Flight ${b.id} lost ${db} ships.`);
            }
        }
    }
    arrive(f) {
        const p = this.planets[f.target];
        if (p.owner === f.owner) {
            p.ships = Math.min(RULES.maxShips, p.ships + f.count);
            this.event(f.owner, `${f.count} ships reinforced ${p.name}.`);
        } else if (f.count >= p.ships) {
            p.owner = f.owner; p.ships = Math.max(1, f.count - p.ships); p.production = 0;
            this.event(f.owner, `${p.name} captured! ${f.count} ships made it through.`);
        } else {
            p.ships -= f.count;
            this.event(f.owner, `${f.count} ships reached ${p.name}; ${p.ships} defenders remain.`);
        }
    }
}

module.exports = { FleetWorld, RULES, MAPS, makeMap, closestApproach, clamp };
