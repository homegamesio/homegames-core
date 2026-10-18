const LEVELS = require('./levels');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (p, r, pad = 0) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;
const circleRect = (x, y, radius, r) => Math.hypot(x - clamp(x, r.x, r.x + r.w), y - clamp(y, r.y, r.y + r.h)) < radius;
const VAN = { x: 10, y: 55 };

// Slab intersection keeps both sight cones and detection honest at wall edges.
function rayBox(x, y, dx, dy, rect, max) {
    let lo = 0, hi = max;
    for (const [pos, dir, a, b] of [[x, dx, rect.x, rect.x + rect.w], [y, dy, rect.y, rect.y + rect.h]]) {
        if (Math.abs(dir) < 1e-8) { if (pos < a || pos > b) return max; }
        else { const t1 = (a - pos) / dir, t2 = (b - pos) / dir; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2)); }
    }
    return hi >= lo ? Math.max(0, lo) : max;
}

class Heist {
    constructor() { this.players = new Map(); this.phase = 'title'; this.time = 0; this.events = []; this.levelIndex = 0; this.load(0); this.phase = 'title'; }
    emit(type, x = 50, y = 35, text = '') { this.events.push({ type, x, y, text }); if (this.events.length > 24) this.events.shift(); }
    addPlayer(id, name = 'Mover') {
        id = String(id); if (this.players.has(id) || this.players.size >= 4) return false;
        const used = new Set([...this.players.values()].map(p => p.color));
        const color = [0, 1, 2, 3].find(c => !used.has(c));
        this.players.set(id, { id, name: String(name).slice(0, 16), color, x: 14, y: 49 + color * 3, dx: 0, dy: 0, face: 0,
            cargo: null, target: null, path: [], auto: null, stun: 0, immunity: 4, whistle: 0, suspicion: 0, hidden: false, hauled: 0 });
        return true;
    }
    removePlayer(id) { const p = this.players.get(String(id)); if (!p) return; this.drop(p); this.players.delete(p.id); }
    load(index) {
        this.levelIndex = clamp(Math.floor(index), 0, LEVELS.length - 1); this.level = LEVELS[this.levelIndex];
        this.walls = [...this.level.walls, ...this.level.props]; this.doors = this.level.doors.map(d => ({ ...d }));
        this.loot = [{ ...this.level.hero, id: 'hero', big: true }, ...this.level.loot.map((l, i) => ({ ...l, id: 'extra' + i, big: false, radius: 1.2, name: 'Little treasure' }))]
            .map(l => ({ ...l, homeX: l.x, homeY: l.y, owners: new Set(), delivered: false, angle: 0 }));
        this.guards = this.level.guards.map((g, i) => ({ ...g, id: i, x: g.route[0][0], y: g.route[0][1], face: Math.PI / 2,
            waypoint: 1, mode: 'patrol', interest: 0, target: null, path: [], replan: 0, seen: null, look: 0 }));
        this.elapsed = 0; this.catches = 0; this.alerts = 0; this.laserOff = 0; this.laserCooldown = 0; this.bellCooldown = 0;
        this.escape = 0; this.result = null; this.events = [];
        for (const p of this.players.values()) Object.assign(p, { x: 14, y: 49 + p.color * 3, cargo: null, target: null, path: [], auto: null, dx: 0, dy: 0, stun: 0, immunity: 4, suspicion: 0, whistle: 0, hauled: 0 });
    }
    start(index = this.levelIndex) { this.load(index); this.phase = 'playing'; }
    get obstacles() { return this.walls.concat(this.doors.filter(d => !d.open)); }
    blocked(x, y, r = 1.1) { return x < 3 + r || x > 97 - r || y < 4 + r || y > 68 - r || this.obstacles.some(w => circleRect(x, y, r, w)); }
    sight(a, b) { const d = dist(a, b); if (!d) return true; return this.ray(a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x), d) >= d - .05; }
    ray(x, y, angle, range = 19) { const dx = Math.cos(angle), dy = Math.sin(angle); return this.obstacles.reduce((m, r) => Math.min(m, rayBox(x, y, dx, dy, r, range)), range); }
    move(body, dx, dy, radius = 1.1) {
        // Small substeps prevent tunneling even with a low client frame rate.
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / .45));
        for (let i = 0; i < steps; i++) {
            if (!this.blocked(body.x + dx / steps, body.y, radius)) body.x += dx / steps;
            if (!this.blocked(body.x, body.y + dy / steps, radius)) body.y += dy / steps;
        }
    }
    path(from, to, radius = 1.1) {
        // A small floor grid makes tap movement and guard investigations follow corridors.
        const step = 2, width = 49, height = 33;
        const ix = x => clamp(Math.round((x - 2) / step), 0, width - 1), iy = y => clamp(Math.round((y - 4) / step), 0, height - 1);
        const pos = n => ({ x: (n % width) * step + 2, y: Math.floor(n / width) * step + 4 });
        const start = iy(from.y) * width + ix(from.x), goal = iy(to.y) * width + ix(to.x);
        const queue = [start], previous = new Int32Array(width * height).fill(-1); previous[start] = start;
        let best = start, score = dist(pos(start), to);
        for (let at = 0; at < queue.length; at++) {
            const n = queue[at], point = pos(n), d = dist(point, to);
            if (d < score) { best = n; score = d; } if (n === goal && !this.blocked(point.x, point.y, radius)) { best = n; break; }
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const xx = n % width + dx, yy = Math.floor(n / width) + dy;
                if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
                const k = yy * width + xx, p = pos(k);
                if (previous[k] !== -1 || this.blocked(p.x, p.y, radius)) continue;
                previous[k] = n; queue.push(k);
            }
        }
        const path = [];
        for (let n = best; n !== start; n = previous[n]) path.push(pos(n));
        path.reverse();
        if (score < 2 && !this.blocked(to.x, to.y, radius)) path.push({ x: to.x, y: to.y });
        return path;
    }
    steer(id, dx, dy) {
        const p = this.players.get(String(id)); if (!p || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
        const d = Math.max(1, Math.hypot(dx, dy)); p.dx = dx / d; p.dy = dy / d;
        if (dx || dy) { p.path = []; p.target = null; p.auto = null; }
    }
    tap(id, x, y) {
        const p = this.players.get(String(id)); if (!p || this.phase !== 'playing' || !Number.isFinite(x) || !Number.isFinite(y)) return;
        const hit = this.loot.find(l => !l.delivered && dist(l, { x, y }) < l.radius + 1.5);
        const door = this.doors.find(d => inside({ x, y }, d, 2));
        const panel = this.level.panel && dist(this.level.panel, { x, y }) < 3;
        const bell = dist(this.level.bell, { x, y }) < 3;
        p.auto = hit ? { type: 'loot', id: hit.id } : door ? { type: 'door', id: door.id } : panel ? { type: 'panel' } : bell ? { type: 'bell' } : dist(VAN, { x, y }) < 6 ? { type: 'van' } : null;
        p.target = { x: clamp(x, 4, 96), y: clamp(y, 5, 67) }; p.dx = p.dy = 0;
        const carried = this.loot.find(l => l.id === p.cargo);
        const body = carried?.big ? carried : p;
        p.path = this.path(body, p.target, p.cargo && body.big ? body.radius : 1.1);
        if (p.auto && this.interact(p.id, p.auto)) { p.auto = null; p.path = []; p.target = null; }
    }
    nearest(p) {
        if (p.cargo) return { type: 'drop', label: 'DROP' };
        const loot = this.loot.filter(l => !l.delivered && (!l.owners.size || l.big) && dist(p, l) < l.radius + 3 && this.sight(p, l)).sort((a, b) => dist(p, a) - dist(p, b))[0];
        if (loot) return { type: 'loot', id: loot.id, label: loot.big && loot.owners.size ? 'HELP CARRY' : 'GRAB' };
        const door = this.doors.find(d => dist(p, { x: d.x + d.w / 2, y: d.y + d.h / 2 }) < 11);
        if (door) return { type: 'door', id: door.id, label: door.open ? 'CLOSE DOOR' : 'OPEN DOOR' };
        if (this.level.panel && dist(p, this.level.panel) < 5) return { type: 'panel', label: 'CUT LASERS' };
        if (dist(p, this.level.bell) < 5) return { type: 'bell', label: 'RING BELL' };
        if (dist(p, VAN) < 8 && this.loot[0].delivered) return { type: 'van', label: 'GET AWAY' };
        return { type: 'none', label: 'GRAB' };
    }
    drop(p) { const loot = this.loot?.find(l => l.id === p.cargo); if (loot) loot.owners.delete(p.id); p.cargo = null; p.path = []; p.target = null; }
    interact(id, action) {
        const p = this.players.get(String(id)); if (!p || this.phase !== 'playing' || p.stun > 0) return false;
        action = action || this.nearest(p);
        if (action.type === 'drop') { this.drop(p); this.emit('drop', p.x, p.y); return true; }
        if (action.type === 'loot') {
            const l = this.loot.find(l => l.id === action.id);
            if (!l || l.delivered || dist(p, l) > l.radius + 3 || !this.sight(p, l) || (!l.big && l.owners.size)) return false;
            if (p.cargo === l.id) { this.drop(p); return true; }
            this.drop(p); p.cargo = l.id; l.owners.add(p.id);
            p.gripAngle = Math.atan2(p.y - l.y, p.x - l.x);
            if (l.big) {
                const others = [...l.owners].filter(id => id !== p.id).map(id => this.players.get(id));
                p.gripAngle = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map(a => a + p.gripAngle).find(a =>
                    others.every(q => Math.abs(Math.atan2(Math.sin(a - q.gripAngle), Math.cos(a - q.gripAngle))) > 1)) ?? p.gripAngle;
            }
            // Hands settle onto the load. Its collision circle includes every carrier.
            if (l.big) { p.x = l.x + Math.cos(p.gripAngle) * (l.radius - 1.2); p.y = l.y + Math.sin(p.gripAngle) * (l.radius - 1.2); }
            this.emit('grab', l.x, l.y); return true;
        }
        if (action.type === 'door') {
            const d = this.doors.find(d => d.id === action.id);
            if (!d || dist(p, { x: d.x + d.w / 2, y: d.y + d.h / 2 }) > 11) return false;
            if (d.open && ([...this.players.values()].some(p => circleRect(p.x, p.y, 1.5, d)) || this.loot.some(l => !l.delivered && circleRect(l.x, l.y, l.radius, d)))) return false;
            d.open = !d.open; this.emit('door', d.x, d.y); return true;
        }
        if (action.type === 'panel' && this.level.panel && dist(p, this.level.panel) < 5) { this.laserOff = 10; this.emit('switch', p.x, p.y, 'Lasers off · 10 seconds'); return true; }
        if (action.type === 'bell' && dist(p, this.level.bell) < 5 && this.bellCooldown <= 0) { this.bellCooldown = 6; this.noise(this.level.bell, 65); this.emit('bell', this.level.bell.x, this.level.bell.y, 'Ding!'); return true; }
        if (action.type === 'van' && this.loot[0].delivered && dist(p, VAN) < 8) {
            if ([...this.players.values()].some(q => dist(q, VAN) > 13 || q.stun > 0)) { this.emit('message', 10, 48, 'Bring the whole crew!'); return true; }
            this.phase = 'escaping'; this.escape = 0; for (const p of this.players.values()) this.drop(p);
            this.emit('win', VAN.x, VAN.y); return true;
        }
        return false;
    }
    whistle(id) {
        const p = this.players.get(String(id)); if (!p || this.phase !== 'playing' || p.stun > 0 || p.whistle > 0) return false;
        p.whistle = 5; this.noise(p, 33); this.emit('whistle', p.x, p.y, 'Psst!'); return true;
    }
    noise(point, radius) { for (const g of this.guards) if (dist(g, point) < radius && g.mode !== 'chase') { g.mode = 'investigate'; g.target = { x: point.x, y: point.y }; g.interest = 6; g.path = []; g.replan = 0; } }
    caught(p) {
        if (this.phase !== 'playing' || p.immunity > 0 || p.stun > 0) return;
        this.catches++; this.drop(p); p.stun = 2.3; p.immunity = 7; p.suspicion = 0; p.dx = p.dy = 0; p.auto = null;
        this.emit('caught', p.x, p.y, 'Spotted! Back to the van.');
        p.x = 14; p.y = 49 + p.color * 3;
        for (const g of this.guards) if (g.seen === p.id) { g.mode = 'patrol'; g.seen = null; g.target = null; g.path = []; g.replan = 0; }
        if (this.catches >= 3) { this.phase = 'lost'; this.emit('lose', 50, 35); }
    }
    direction(p) {
        const carried = this.loot.find(l => l.id === p.cargo);
        const body = carried?.big ? carried : p;
        while (p.path.length && dist(body, p.path[0]) < .65) p.path.shift();
        if (p.path.length) { const t = p.path[0], d = dist(body, t); return { x: (t.x - body.x) / Math.max(1, d), y: (t.y - body.y) / Math.max(1, d) }; }
        return { x: p.dx, y: p.dy };
    }
    laserActive(l) { return this.laserOff <= 0 && this.elapsed % l.period < l.on; }
    tick(dt = 1 / 30) {
        dt = clamp(Number(dt) || 0, 0, .05); this.time += dt;
        if (this.phase === 'escaping') {
            this.escape += dt;
            if (this.escape >= 2.2) {
                this.phase = 'won'; const extras = this.loot.filter(l => !l.big && l.delivered).length;
                this.result = { level: this.levelIndex, seconds: Math.round(this.elapsed), extras, catches: this.catches,
                    medals: [true, extras === 3, this.alerts === 0 && this.catches === 0] };
            }
            return;
        }
        if (this.phase !== 'playing' || !this.players.size) return;
        this.elapsed += dt; this.laserOff -= dt; this.laserCooldown -= dt; this.bellCooldown -= dt;
        for (const p of this.players.values()) {
            p.stun = Math.max(0, p.stun - dt); p.immunity = Math.max(0, p.immunity - dt); p.whistle = Math.max(0, p.whistle - dt);
            if (p.stun) continue;
            if (p.auto && this.interact(p.id, p.auto)) { p.auto = null; p.target = null; p.path = []; }
            const d = this.direction(p); if (d.x || d.y) p.face = Math.atan2(d.y, d.x);
            const carried = this.loot.find(l => l.id === p.cargo);
            if (!carried?.big) this.move(p, d.x * (carried ? 13 : 15) * dt, d.y * (carried ? 13 : 15) * dt);
        }
        for (const l of this.loot) {
            if (!l.owners.size || l.delivered) continue;
            const owners = [...l.owners].map(id => this.players.get(id)).filter(Boolean);
            let dx = 0, dy = 0; for (const p of owners) { const d = this.direction(p); dx += d.x; dy += d.y; }
            dx /= owners.length; dy /= owners.length;
            const speed = l.big ? (owners.length > 1 ? 12 : 7.5) : 13;
            if (l.big) {
                this.move(l, dx * speed * dt, dy * speed * dt, l.radius);
                for (const p of owners) { p.x = l.x + Math.cos(p.gripAngle) * (l.radius - 1.2); p.y = l.y + Math.sin(p.gripAngle) * (l.radius - 1.2); }
            } else { l.x = owners[0].x; l.y = owners[0].y; }
            if (Math.hypot(dx, dy) > .1) l.angle += Math.sin(this.elapsed * 7) * dt * .2;
            if (dist(l, VAN) < 7.5) {
                l.delivered = true;
                for (const p of owners) {
                    const walkToVan = p.auto?.type === 'van'; p.hauled++; this.drop(p);
                    if (walkToVan) this.tap(p.id, VAN.x, VAN.y);
                }
                l.owners.clear();
                this.emit('deliver', VAN.x, VAN.y, l.big ? 'Big one loaded! Get the crew out.' : 'Treasure loaded');
            }
        }
        for (const p of this.players.values()) p.hidden = !p.cargo && this.level.hiding.some(h => inside(p, h));
        const visible = new Set();
        for (const g of this.guards) {
            let found = null;
            for (const p of this.players.values()) {
                if (p.stun || p.immunity > 0 || p.hidden) continue;
                const d = dist(g, p), a = Math.atan2(p.y - g.y, p.x - g.x), angle = Math.atan2(Math.sin(a - g.face), Math.cos(a - g.face));
                if (d < (g.mode === 'chase' ? 22 : 19) && (Math.abs(angle) < (g.mode === 'chase' ? 1 : .57) || d < 2.6) && this.sight(g, p)) {
                    visible.add(p.id); if (!found || d < dist(g, found)) found = p;
                }
            }
            if (found && found.suspicion >= .95) {
                if (g.mode !== 'chase') { this.alerts++; this.emit('alert', g.x, g.y, '!'); }
                g.mode = 'chase'; g.seen = found.id; g.target = { x: found.x, y: found.y }; g.interest = 4.5;
            } else if (g.mode !== 'patrol') { g.interest -= dt; if (g.interest <= 0) { g.mode = 'patrol'; g.seen = null; g.path = []; g.replan = 0; } }
            let target = g.mode === 'patrol' ? { x: g.route[g.waypoint][0], y: g.route[g.waypoint][1] } : g.target;
            if (dist(g, target) < 1) {
                if (g.mode === 'patrol') { g.waypoint = (g.waypoint + 1) % g.route.length; g.replan = 0; }
                else g.face += dt * .8;
            } else {
                g.replan -= dt;
                if (g.replan <= 0) { g.path = this.path(g, target); g.replan = .55; }
                while (g.path.length && dist(g, g.path[0]) < .55) g.path.shift();
                if (g.path.length) {
                    const dest = g.path[0], d = dist(g, dest), dx = (dest.x - g.x) / Math.max(1, d), dy = (dest.y - g.y) / Math.max(1, d);
                    const face = Math.atan2(dy, dx), delta = Math.atan2(Math.sin(face - g.face), Math.cos(face - g.face));
                    g.face += clamp(delta, -dt * 4, dt * 4);
                    const speed = g.mode === 'chase' ? 9.5 : g.speed;
                    this.move(g, dx * dt * speed, dy * dt * speed);
                }
            }
            if (g.mode === 'chase') for (const p of this.players.values()) if (dist(g, p) < 2.1 && !p.hidden && this.sight(g, p)) this.caught(p);
        }
        for (const p of this.players.values()) p.suspicion = clamp(p.suspicion + (visible.has(p.id) ? dt * 1.1 : -dt * 1.7), 0, 1.2);
        for (const l of this.level.lasers) if (this.laserActive(l) && this.laserCooldown <= 0) {
            const p = [...this.players.values()].find(p => p.stun <= 0 && p.immunity <= 0 && circleRect(p.x, p.y, 1, l));
            if (p) { this.laserCooldown = 3; this.alerts++; p.suspicion = 1.2; this.noise(p, 100); this.emit('alert', p.x, p.y, 'Laser tripped!'); }
        }
    }
}
module.exports = { Heist, LEVELS, VAN, dist, clamp, rayBox, circleRect };
