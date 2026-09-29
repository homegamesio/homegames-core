const { Engine, random, distance } = require('./engine');
const { WarBattle } = require('./war-battle');
const { UNITS, TYPES, TRAITS, SOCKETS, PILOT_FIELDS, FACTIONS } = require('./war-settings');

class War {
    constructor(seed = 731) {
        this.seed = seed >>> 0; this.rng = random(this.seed); this.entityId = 0; this.time = 0;
        this.bank = [0, 100, 100]; this.spent = [0, 0, 0]; this.earned = [0, 100, 100];
        this.view = 'sector'; this.paused = true; this.help = false; this.speed = 1; this.result = null;
        this.panel = null; this.buildTab = 'ships';
        this.selected = 1; this.socket = 1; this.order = null; this.fraction = .5; this.fleets = [];
        this.notices = []; this.events = []; this.aiTimer = 15; this.log = [];
        this.personality = this.rng() < .5 ? 'EXPANSIONIST' : 'WARLORD';
        this.stats = { captures: [0, 0, 0], losses: [0, 0, 0], pilotKills: 0, dives: 0, rebuilt: 0 };
        this.pilot = new Engine(this.seed ^ 993); this.pilot.start();
        this.hero = { node: 1, travel: null, rebuild: 0 }; this.activeBattle = null;
        const names = ['KESTREL', 'HAVEN', 'CINDER', 'PRISM', 'ORBIT', 'HALO', 'EMBER', 'VANTA', 'ECHO', 'SABLE', 'CITADEL', 'RIFT'];
        const kinds = ['refinery', 'foundry', 'relay', 'reactor', 'bastion'];
        this.nodes = Array.from({ length: 12 }, (_, id) => {
            const type = id === 1 || id === 10 ? 'command' : id === 0 || id === 11 ? 'refinery' : kinds[Math.floor(this.rng() * kinds.length)];
            const trait = TRAITS[Math.floor(this.rng() * TRAITS.length)];
            return { id, name: names[id], type, trait, x: 16 + Math.floor(id / 3) * 28 + (this.rng() - .5) * 5,
                y: 25 + id % 3 * 21 + (this.rng() - .5) * 3, owner: id <= 1 ? 1 : id >= 10 ? 2 : 0,
                home: id === 1 ? 1 : id === 10 ? 2 : 0, maxHp: Math.round((type === 'command' ? 230 : type === 'bastion' ? 150 : 90) * (trait.hp || 1)),
                sockets: [null, null, null], queue: [], auto: false, rally: null, rallyClock: 0, bountyPaid: id <= 1 || id >= 10 };
        });
        this.edges = [];
        for (let col = 0; col < 4; col++) for (let row = 0; row < 2; row++) this.edges.push([col * 3 + row, col * 3 + row + 1]);
        for (let col = 0; col < 3; col++) {
            const skip = Math.floor(this.rng() * 3);
            for (let row = 0; row < 3; row++) if (row !== skip) this.edges.push([col * 3 + row, (col + 1) * 3 + row]);
            if (this.rng() < .65) this.edges.push([col * 3 + skip, (col + 1) * 3 + (skip + 1) % 3]);
        }
        for (const n of this.nodes) {
            n.battle = new WarBattle(this, n);
            const count = n.home ? 5 : n.owner ? 2 : 1 + Math.floor(this.rng() * 2);
            for (let i = 0; i < count; i++) {
                const unit = n.battle.addUnit(i === count - 1 && n.home ? 'bastion' : 'seeker', n.owner, 61 + i * 8, 46 + (i % 2) * 8);
                unit.spawn = 0;
            }
            if (n.home || (n.owner === 0 && this.rng() < .28)) {
                const u = n.battle.addUnit('pulse', n.owner, ...SOCKETS[0], null, 0); u.spawn = 0; n.sockets[0] = u.id;
            }
        }
    }
    notify(text, node = null) { this.notices.unshift({ text, node, time: this.time }); this.notices.length = Math.min(4, this.notices.length); this.log.push(text); if (this.log.length > 80) this.log.shift(); }
    income(faction) { return this.nodes.filter(n => n.owner === faction && !n.battle.contested()).reduce((sum, n) => sum + TYPES[n.type].income * (n.trait.income || 1), 0); }
    adjacent(id) { return this.edges.filter(e => e.includes(id)).map(e => e[0] === id ? e[1] : e[0]); }
    path(from, to, faction = null) {
        if (from === to) return [from];
        const queue = [[from]], seen = new Set([from]);
        while (queue.length) {
            const path = queue.shift(), current = path[path.length - 1];
            for (const next of this.adjacent(current)) {
                if (seen.has(next)) continue;
                if (next !== to && faction !== null && this.nodes[next].owner !== faction) continue;
                const route = path.concat(next); if (next === to) return route;
                seen.add(next); queue.push(route);
            }
        }
        return null;
    }
    cost(node, kind) { return Math.ceil(UNITS[kind].cost * (UNITS[kind].static && node.type === 'bastion' ? .8 : 1)); }
    queueUnit(id, kind, faction = 1, socket = this.socket) {
        const n = this.nodes[id], spec = UNITS[kind];
        if (!n || !spec || n.owner !== faction || this.result || n.queue.length >= 5) return false;
        const cost = this.cost(n, kind);
        if (this.bank[faction] < cost || n.battle.force(faction).length + n.queue.length >= 24) return false;
        if (spec.static && (!Number.isInteger(socket) || socket < 0 || socket > 2 || n.sockets[socket] || n.queue.some(q => q.socket === socket))) return false;
        this.bank[faction] -= cost; this.spent[faction] += cost;
        const duration = spec.build * (n.type === 'foundry' ? .65 : 1) * (n.trait.build || 1);
        n.queue.push({ kind, faction, socket: spec.static ? socket : null, duration, remaining: duration });
        if (faction === 1) this.events.push('select'); return true;
    }
    sendFleet(from, to, faction = 1, fraction = this.fraction, exact = 0) {
        const n = this.nodes[from], destination = this.nodes[to];
        if (!n || !destination || from === to || this.result) return false;
        const route = this.path(from, to, faction); if (!route) return false;
        const units = n.battle.force(faction, true).filter(u => u.spawn <= 0);
        if (!units.length) return false;
        const count = exact || Math.max(1, Math.ceil(units.length * fraction)), moving = units.slice(0, count);
        const ids = new Set(moving.map(u => u.id));
        n.battle.units = n.battle.units.filter(u => !ids.has(u.id)); n.battle.refresh();
        this.fleets.push({ id: ++this.entityId, faction, units: moving, route, leg: 0, progress: 0, from, to, arrived: false });
        if (faction === 1) { this.notify(moving.length+' ships dispatched to '+destination.name+'.', to); this.events.push('deploy'); }
        return true;
    }
    duration(from, to, hero = false) {
        const n = this.nodes[from];
        return Math.max(2, distance(n, this.nodes[to]) * (hero ? .13 : .25) * (n.type === 'relay' ? .6 : 1) * (n.trait.travel || 1));
    }
    arrive(fleet, at, previous) {
        const n = this.nodes[at], from = this.nodes[previous], dx = n.x - from.x, dy = n.y - from.y;
        const horizontal = Math.abs(dx) > Math.abs(dy);
        const x = horizontal ? dx > 0 ? 11 : 149 : 80, y = horizontal ? 46 : dy > 0 ? 20 : 73;
        const remaining = [];
        fleet.units.forEach((unit, i) => {
            const px = horizontal ? x + (i % 3) * (dx > 0 ? 2 : -2) : 60 + i % 8 * 5;
            const py = horizontal ? 26 + i % 8 * 5 : y;
            if (!n.battle.addUnit(unit.kind, fleet.faction, px, py, unit)) remaining.push(unit);
        });
        fleet.units = remaining; fleet.arrived = !remaining.length;
        if (fleet.arrived && n.owner !== fleet.faction) {
            this.notify((fleet.faction === 1 ? 'Your fleet engages ' : 'Enemy fleet engages ')+n.name+'.', at);
            if (n.owner === 1) this.events.push('alert');
        }
    }
    travelHero(id, dive = true) {
        if (this.hero.rebuild || this.hero.travel || this.result || !this.nodes[id]) return false;
        if (this.activeBattle) this.leaveBattle();
        if (this.hero.node === id) return dive ? this.dive(id) : true;
        const route = this.path(this.hero.node, id); if (!route) return false;
        this.hero.travel = { route, leg: 0, progress: 0, dive };
        this.notify('Pilot en route to '+this.nodes[id].name+'.', id); return true;
    }
    dive(id = this.hero.node) {
        if (this.hero.rebuild || this.hero.travel || this.hero.node !== id || this.result) return false;
        const b = this.nodes[id].battle;
        this.activeBattle = b; this.selected = id; this.view = 'battle'; this.speed = 1;
        this.panel = null; this.order = null;
        for (const key of PILOT_FIELDS) b[key] = this.pilot[key];
        b.player = this.pilot.player; b.manual = true; b.reduced = this.pilot.reduced;
        if (this.hero.positionNode !== id) {
            Object.assign(b.player, { x: 23, y: 64, vx: 0, vy: 0, inv: 1.2, shot: 0, dash: 0, charges: 2, recharge: 0 });
            this.hero.positionNode = id;
        }
        b.input = { x: 0, y: 0, aimX: 80, aimY: 44, fire: false, dash: false };
        b.banner = 'LIVE BATTLE / G RETURNS TO SECTOR'; b.bannerTime = 3;
        this.stats.dives++; this.events.push('deploy'); return true;
    }
    leaveBattle() {
        const b = this.activeBattle; if (!b) return;
        for (const key of PILOT_FIELDS) this.pilot[key] = b[key];
        b.input.fire = false; b.input.dash = false; b.input.x = b.input.y = 0; b.manual = false;
        this.activeBattle = null; this.view = 'sector'; this.panel = null;
    }
    losePilot() {
        this.leaveBattle(); this.hero.travel = null; this.hero.rebuild = 18; this.stats.rebuilt++;
        this.hero.positionNode = null;
        const lost = Math.min(20, this.bank[1]); this.bank[1] -= lost; this.spent[1] += lost;
        this.pilot.flux = 0; this.pilot.overload = 0; this.pilot.multiplier = 1;
        this.notify('Pilot lost. Rebuilding at HAVEN in 18s. Fleet commands remain available.', 1); this.events.push('defeat');
    }
    capture(id, faction) {
        const n = this.nodes[id], old = n.owner; if (old === faction || !faction || this.result) return;
        n.owner = faction; n.queue = []; n.auto = false; n.rally = null;
        Object.assign(n.battle.core, { hp: n.maxHp * .5, faction, color: FACTIONS[faction], destroyed: false, life: 1 });
        n.battle.refresh(); this.stats.captures[faction]++;
        if (!n.bountyPaid) { const amount = 20 + (n.trait.bounty || 0); this.bank[faction] += amount; this.earned[faction] += amount; n.bountyPaid = true; }
        this.notify((faction === 1 ? 'Captured ' : 'Lost to the rival: ')+n.name+'.', id); this.events.push(faction === 1 ? 'capture' : 'alert');
        if (n.home) { this.result = faction === 1 ? 'won' : 'lost'; this.leaveBattle(); this.paused = true; }
        else if (this.hero.node === id && !this.activeBattle && !this.hero.travel && faction !== 1) {
            this.hero.node = 1; this.notify('Pilot evacuated to HAVEN.', 1);
        }
    }
    buyModule() {
        if (this.bank[1] < 70 || this.result || this.choices) return false;
        this.bank[1] -= 70; this.spent[1] += 70;
        if (this.activeBattle) this.leaveBattle();
        this.pilot.draft(); this.choices = this.pilot.choices; this.pauseBeforeModal = this.paused; this.paused = true; return true;
    }
    chooseModule(index) {
        if (!this.choices?.[index]) return;
        this.pilot.phase = 'upgrade'; this.pilot.choose(index); this.choices = null; this.paused = !!this.pauseBeforeModal;
        this.notify('Pilot module installed.', this.hero.node);
    }
    repairPilot() {
        if (this.bank[1] < 20 || this.pilot.player.hp >= this.pilot.player.maxHp || this.hero.rebuild || this.hero.travel || this.nodes[this.hero.node].owner !== 1) return false;
        this.bank[1] -= 20; this.spent[1] += 20; this.pilot.player.hp = Math.min(this.pilot.player.maxHp, this.pilot.player.hp + 3); return true;
    }
    think() {
        const faction = 2, owned = this.nodes.filter(n => n.owner === faction);
        for (const n of owned) {
            const force = n.battle.force(faction, true), neighbors = this.adjacent(n.id).map(id => this.nodes[id]);
            if (n.queue.length < 2 && force.length < 10) {
                const kind = force.length && force.length % 5 === 0 ? 'warden' : force.length % 4 === 3 ? 'bastion' : 'seeker';
                this.queueUnit(n.id, kind, faction);
            }
            if (n.battle.contested()) continue;
            const targets = neighbors.filter(t => t.owner !== faction).sort((a, b) => {
                const value = t => t.battle.power(t.owner) + t.battle.core.hp / 80 - (t.type === 'refinery' ? 2 : 0) - (this.personality === 'WARLORD' && t.owner === 1 ? 2 : 0);
                return value(a) - value(b);
            });
            if (targets.length && force.length >= 4 && n.battle.power(faction) > targets[0].battle.power(targets[0].owner) * 1.05 + 1)
                this.sendFleet(n.id, targets[0].id, faction, .8);
            else if (!targets.length && force.length >= 4) {
                const front = owned.filter(t => this.adjacent(t.id).some(id => this.nodes[id].owner !== faction)).sort((a, b) => distance(n, a) - distance(n, b))[0];
                if (front && front.id !== n.id) this.sendFleet(n.id, front.id, faction, .8);
            }
        }
    }
    step(dt) {
        this.events.length = 0;
        if (this.paused || this.result) return;
        this.time += dt;
        for (const faction of [1, 2]) { const earned = this.income(faction) * dt; this.bank[faction] += earned; this.earned[faction] += earned; }
        for (const n of this.nodes) {
            const q = n.queue[0];
            if (q) {
                q.remaining -= dt * (n.battle.contested() ? .5 : 1);
                if (q.remaining <= 0) {
                    const pos = q.socket === null ? [68 + this.rng() * 24, 55 + this.rng() * 5] : SOCKETS[q.socket];
                    const u = n.battle.addUnit(q.kind, q.faction, pos[0], pos[1], null, q.socket);
                    if (u) { if (q.socket !== null) n.sockets[q.socket] = u.id; n.queue.shift(); }
                }
            }
            if (n.auto && n.owner === 1 && n.queue.length < 2 && n.battle.force(1, true).length < 8 && this.bank[1] >= 34) this.queueUnit(n.id, 'seeker');
            n.rallyClock -= dt;
            if (n.owner === 1 && n.rally !== null && n.rallyClock <= 0 && !n.battle.contested()) {
                if (n.battle.force(1, true).length >= 3) this.sendFleet(n.id, n.rally, 1, 1, 3);
                n.rallyClock = 5;
            }
            n.battle.step(dt);
            if (n.battle === this.activeBattle) this.events.push(...n.battle.events);
            if (this.result) break;
        }
        for (const f of this.fleets) {
            const from = f.route[f.leg], to = f.route[f.leg + 1]; if (to === undefined) continue;
            f.progress += dt / this.duration(from, to);
            if (f.progress >= 1) {
                if (f.leg + 1 === f.route.length - 1 || this.nodes[to].owner !== f.faction) this.arrive(f, to, from);
                else { f.leg++; f.progress = 0; }
            }
        }
        this.fleets = this.fleets.filter(f => !f.arrived);
        if (this.hero.rebuild > 0) {
            this.hero.rebuild = Math.max(0, this.hero.rebuild - dt);
            if (!this.hero.rebuild) { this.hero.node = 1; this.pilot.player.hp = this.pilot.player.maxHp; this.notify('Pilot rebuilt and ready at HAVEN.', 1); }
        }
        const travel = this.hero.travel;
        if (travel) {
            const from = travel.route[travel.leg], to = travel.route[travel.leg + 1];
            travel.progress += dt / this.duration(from, to, true);
            if (travel.progress >= 1) {
                this.hero.node = to;
                if (++travel.leg >= travel.route.length - 1) { this.hero.travel = null; if (travel.dive) this.dive(to); }
                else travel.progress = 0;
            }
        }
        this.aiTimer -= dt; if (this.aiTimer <= 0) { this.think(); this.aiTimer = 4; }
        if (this.activeBattle) for (const key of PILOT_FIELDS) this.pilot[key] = this.activeBattle[key];
    }
}
module.exports = { War };
