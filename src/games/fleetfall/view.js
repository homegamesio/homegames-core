'use strict';

const { GameNode, Shapes } = require('squish-150');
const { RULES, MAPS, clamp } = require('./engine');
const { SECTORS, WEATHER } = require('./maps');
const C = { bg: '#080f1d', panel: '#101c30', inset: '#0b1425', line: '#24364e', faint: '#16253b',
    ink: '#ecf5ff', muted: '#8b9eb8', mint: '#72f2c4', amber: '#ffc77a', red: '#ff777d', rock: '#bfa992' };
const COLORS = ['#72f2c4', '#ff777d', '#ffc77a', '#89a8ff', '#d7a0fa', '#72d7f2'];
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(255);
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const point = ([x, y]) => [clamp(x / 1.6, 0, 100), clamp(y / .9, 0, 100)];
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

function layout(count) {
    const galaxy = { x: 3, y: 11, w: count ? 75 : 154, h: 70 };
    const panels = [];
    const columns = count === 1 ? 1 : 2, rows = Math.ceil(count / columns), gap = 2;
    for (let i = 0; i < count; i++) {
        const col = i % columns, row = Math.floor(i / columns), w = (75 - gap * (columns - 1)) / columns;
        panels.push({ x: 82 + col * (w + gap), y: 11 + row * (70 / rows),
            w: count % 2 && i === count - 1 ? 75 : w, h: 70 / rows - (row < rows - 1 ? gap : 0) });
    }
    return { galaxy, panels };
}

// Reuse bounded shape/text pools, and only serialize the slots used this frame.
// Every player has a private scene; the logical galaxy remains shared.
class Painter {
    constructor(id) {
        this.id = id; this.polys = []; this.labels = [];
        const group = () => new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0]], playerIds: [id] });
        this.root = group(); this.shapeRoot = group(); this.textRoot = group();
        this.root.addChildren(this.shapeRoot, this.textRoot);
    }
    begin() { this.si = 0; this.ti = 0; }
    poly(points, color) {
        let n = this.polys[this.si];
        if (!n) this.polys[this.si] = n = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0]], playerIds: [this.id] });
        n.node.coordinates2d = points.map(point); n.node.fill = rgb(color); this.si++;
    }
    box(x, y, w, h, color) { this.poly(rect(x, y, w, h), color); }
    disk(x, y, r, color, sides = 16) {
        this.poly(Array.from({ length: sides }, (_, i) => [x + Math.cos(i * Math.PI * 2 / sides) * r, y + Math.sin(i * Math.PI * 2 / sides) * r]), color);
    }
    line(a, b, color, width = .12) {
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const x = -dy / len * width / 2, y = dx / len * width / 2;
        this.poly([[a.x + x, a.y + y], [b.x + x, b.y + y], [b.x - x, b.y - y], [a.x - x, a.y - y]], color);
    }
    text(text, x, y, size = 1.6, color = C.ink, align = 'left', font = 'Arial, sans-serif') {
        let n = this.labels[this.ti];
        if (!n) this.labels[this.ti] = n = new GameNode.Text({ textInfo: { text: '' }, playerIds: [this.id] });
        n.node.text = { text: String(text), x: x / 1.6, y: y / .9, size: size / 1.6, color: rgb(color), align, font }; this.ti++;
    }
    end() {
        this.shapeRoot.node.children = this.polys.slice(0, this.si);
        this.textRoot.node.children = this.labels.slice(0, this.ti);
    }
}

function button(p, ui, box, label, action, selected = false, color = C.mint) {
    p.box(box.x, box.y, box.w, box.h, selected ? color : C.line);
    if (!selected) p.box(box.x + .15, box.y + .15, box.w - .3, box.h - .3, C.panel);
    p.text(label, box.x + box.w / 2, box.y + (box.h - 2.5) / 2, 2.5, selected ? C.bg : C.ink, 'center');
    ui.hits.push({ ...box, action });
}

function stars(p, r, count = 20) {
    for (let i = 0; i < count; i++) p.disk(r.x + 1 + ((i * 37 + 17) % 101) / 101 * (r.w - 2),
        r.y + 1 + ((i * 53 + 31) % 103) / 103 * (r.h - 2), i % 5 ? .075 : .14, i % 5 ? C.line : C.muted, 5);
}

function drawLobby(game, ui, p) {
    stars(p, { x: 0, y: 0, w: 160, h: 90 }, 50);
    const selectedMap = MAPS.find(m => m.id === game.world.mapId), sector = SECTORS[selectedMap.sector];
    const host = game.hostId === ui.id, completed = Object.keys(game.cleared).length;
    p.text('FLEETFALL', 80, 2, 6, C.ink, 'center');
    if (!game.saveFailed) p.text('36 battlefields / 6 sectors / one galaxy', 80, 12, 2.4, C.muted, 'center');
    p.text(`${selectedMap.sector + 1} / ${SECTORS.length}   ${sector.name}`, 80, 20, 2.8, sector.color, 'center');
    button(p, ui, { x: 7, y: 18, w: 12, h: 7 }, '‹', { type: 'sectorSelect', id: (selectedMap.sector + 5) % 6 });
    button(p, ui, { x: 141, y: 18, w: 12, h: 7 }, '›', { type: 'sectorSelect', id: (selectedMap.sector + 1) % 6 });
    MAPS.filter(m => m.sector === selectedMap.sector).forEach((map, i) => {
        const r = { x: 7 + i % 3 * 49, y: 27 + Math.floor(i / 3) * 22, w: 48, h: 20 }, selected = game.world.mapId === map.id;
        p.box(r.x, r.y, r.w, r.h, selected ? sector.color : C.line);
        p.box(r.x + .2, r.y + .2, r.w - .4, r.h - .4, selected ? sector.nebula : C.panel);
        const project = planet => ({ x: r.x + 1.5 + planet.x * .18, y: r.y + 1.5 + planet.y * .145 });
        for (const a of map.planets) for (const b of map.planets) {
            if (a.id < b.id && Math.hypot(a.x - b.x, a.y - b.y) < map.linkDistance) p.line(project(a), project(b), C.line, .07);
        }
        for (const planet of map.planets) {
            const pos = project(planet);
            p.disk(pos.x, pos.y, planet.id < 6 ? .5 : .32, planet.id < 6 ? sector.color : C.muted, 8);
        }
        const number = MAPS.indexOf(map) + 1;
        p.text(`${String(number).padStart(2, '0')}${game.cleared[map.id] ? '  ✓' : ''}`, r.x + 2, r.y + 16.8, 1.5, game.cleared[map.id] ? C.mint : C.muted);
        p.text(map.name.toUpperCase(), r.x + 22, r.y + 3, 2.2, selected ? sector.color : C.ink);
        p.text(map.brief, r.x + 22, r.y + 7.3, 1.55, C.muted);
        p.text(game.players.size === 1 ? `${map.rivals} RIVALS` : `${game.players.size} PILOTS`, r.x + 22, r.y + 12, 1.5, C.muted);
        p.text(WEATHER[map.weather].name, r.x + 22, r.y + 16, 1.5, map.weather === 'storm' ? C.amber : sector.color);
        ui.hits.push({ ...r, action: { type: 'mapSelect', id: map.id } });
    });
    [...game.players.values()].forEach((v, i) => {
        p.text((v.id === ui.id ? 'YOU: ' : '') + v.name.slice(0, 12), 30 + i % 3 * 50, 70 + Math.floor(i / 3) * 4, 2, v.id === ui.id ? C.mint : C.muted, 'center');
    });
    if (completed && game.players.size === 1) button(p, ui, { x: 7, y: 79, w: 40, h: 7 }, completed === MAPS.length ? 'NEW TOUR' : 'CONTINUE', { type: 'continue' });
    button(p, ui, { x: 62, y: 78, w: 36, h: 8 }, host ? 'PLAY' : 'WAITING', { type: 'start' }, host, sector.color);
    p.text(`${completed} / ${MAPS.length} CLEARED`, 153, 81, 2.1, completed ? C.mint : C.muted, 'right');
}

function drawGalaxy(game, ui, p, r) {
    const w = game.world;
    p.box(r.x, r.y, r.w, r.h, C.inset);
    const sector = SECTORS[MAPS.find(m => m.id === w.mapId).sector];
    p.poly([[r.x, r.y + r.h * .2], [r.x + r.w * .7, r.y], [r.x + r.w, r.y + r.h * .7], [r.x + r.w * .3, r.y + r.h]], sector.nebula);
    stars(p, r);
    const project = planet => ({ x: r.x + 4 + planet.x / 100 * (r.w - 8), y: r.y + 2 + planet.y / 100 * (r.h - 4) });
    ui.planetPoints = w.planets.map(project);
    for (const [a, b] of w.links) {
        const allied = w.planets[a].owner !== null && w.planets[a].owner === w.planets[b].owner;
        p.line(project(w.planets[a]), project(w.planets[b]), allied ? '#335454' : C.faint);
    }
    for (const f of w.flights) {
        const mine = f.owner === ui.id, color = COLORS[w.faction(f.owner).color];
        if (mine) p.line(project(w.planets[f.source]), project(w.planets[f.target]), '#315c5a', .22);
        const pos = project(w.position(f));
        p.poly([[pos.x, pos.y - 1.155], [pos.x + .65, pos.y + .6], [pos.x - .65, pos.y + .6]], color);
    }
    w.planets.forEach(planet => {
        const pos = project(planet), owner = w.faction(planet.owner), color = owner ? COLORS[owner.color] : C.muted;
        const radius = r.w > 80 ? 2.45 : 2.05;
        if (ui.selected === planet.id) p.disk(pos.x, pos.y, radius + .85, C.mint, 16);
        p.disk(pos.x, pos.y, radius + .35, owner ? color : C.line, 16);
        p.disk(pos.x, pos.y, radius, C.panel, 16);
        p.text(planet.ships, pos.x, pos.y - 1.15, 2.5, color, 'center');
        const destination = w.flights.find(f => f.id === ui.focus && f.owner === ui.id)?.target;
        if (ui.selected === planet.id || destination === planet.id) p.text(planet.name.toUpperCase(), pos.x, pos.y + radius + .7, 1.7, color, 'center');
    });
    ui.hits.push({ ...r, action: { type: 'map' } });
}

function drawFlight(game, ui, p, f, r, index) {
    const w = game.world, focused = ui.focus === f.id, compact = r.h < 29;
    const color = COLORS[w.faction(f.owner).color], hit = f.hitUntil > w.time;
    p.box(r.x, r.y, r.w, r.h, focused ? color : C.line);
    p.box(r.x + .2, r.y + .2, r.w - .4, r.h - .4, hit ? '#3e2431' : C.panel);
    const titleSize = compact ? 2 : 2.4;
    p.text(`${index + 1} / ${w.planets[f.target].name.toUpperCase()}`, r.x + 1.3, r.y + 1, titleSize, color);
    p.text(`${Math.ceil(f.duration - f.age)}s`, r.x + r.w - 1.3, r.y + 1, titleSize, C.muted, 'right');
    p.box(r.x + 1.3, r.y + 3.4, r.w - 2.6, .3, C.line);
    p.box(r.x + 1.3, r.y + 3.4, (r.w - 2.6) * clamp(f.age / f.duration, 0, 1), .3, color);
    const field = { x: r.x + 3, y: r.y + 4.7, w: r.w - 6, h: r.h - 6 };
    ui.hits.push({ ...r, field, action: { type: 'move', id: f.id } });
    for (let i = 1; i < 4; i++) p.line({ x: field.x + field.w * i / 4, y: field.y },
        { x: field.x + field.w * i / 4, y: field.y + field.h }, C.faint);
    for (let i = 0; i < 5; i++) {
        const x = field.x + ((i * 17 + f.id * 13) % 97) / 97 * field.w;
        const y = field.y + ((i * .13 + f.age * .31) % 1) * field.h;
        p.line({ x, y }, { x, y: Math.min(field.y + field.h, y + .6) }, C.line);
    }
    for (const shot of f.shots) {
        const project = (x, y) => ({ x: field.x + clamp(x, 0, 1) * field.w, y: field.y + clamp(y, 0, 1) * field.h });
        p.line(project(shot.x, shot.y), project(shot.x - shot.vx * .036, shot.y - shot.vy * .036), C.mint, .32);
    }
    for (const burst of f.bursts) {
        const age = (w.time - burst.at) / .32;
        for (let i = 0; i < 5; i++) {
            const angle = i * Math.PI * 2 / 5;
            const x = field.x + (burst.x + Math.cos(angle) * age * .06) * field.w;
            const y = field.y + (burst.y + Math.sin(angle) * age * .1) * field.h;
            if (x < field.x || x > field.x + field.w || y < field.y || y > field.y + field.h) continue;
            p.disk(x, y, (1 - age) * (compact ? .32 : .55), burst.heavy ? C.amber : C.rock, 3);
        }
    }
    let crossing = false;
    for (const h of w.hazardsFor(f)) {
        if (h.passed || h.y < 0 || h.y > .97) continue;
        const x = field.x + h.x * field.w, y = field.y + h.y * field.h;
        // Horizontal silhouettes match the simulation's lane hitboxes even
        // when six short panels compress the vertical view.
        const radiusX = h.radius * field.w, radiusY = Math.min(radiusX, compact ? .9 : 2.2);
        if (h.kind === 'fleet') {
            crossing = true;
            const enemy = COLORS[w.faction(h.owner).color];
            p.poly([[x, y + radiusY], [x - radiusX, y - radiusY * .6], [x, y - radiusY * .2], [x + radiusX, y - radiusY * .6]]
                .map(([px, py]) => [clamp(px, field.x, field.x + field.w), clamp(py, field.y, field.y + field.h)]), enemy);
            if (!compact) p.text(h.count, x, y - radiusY - 1.8 < field.y ? y + radiusY + .4 : y - radiusY - 1.8, 2, enemy, 'center');
        } else {
            // A little padding makes small debris tappable in compact panels.
            const left = Math.max(field.x, x - Math.max(radiusX, 1.8)), top = Math.max(field.y, y - Math.max(radiusY, 1.8));
            ui.hits.push({ x: left, y: top, w: Math.min(field.x + field.w, x + Math.max(radiusX, 1.8)) - left,
                h: Math.min(field.y + field.h, y + Math.max(radiusY, 1.8)) - top,
                action: { type: 'fire', id: f.id, targetId: h.id } });
            const rotation = h.spin + f.age * .5;
            p.poly(Array.from({ length: 7 }, (_, i) => {
                const angle = i / 7 * Math.PI * 2 + rotation, irregularity = i % 2 ? .82 : 1;
                return [clamp(x + Math.cos(angle) * radiusX * irregularity, field.x, field.x + field.w),
                    clamp(y + Math.sin(angle) * radiusY * irregularity, field.y, field.y + field.h)];
            }), h.flashUntil > w.time ? C.ink : h.kind === 'wreck' ? C.amber : C.rock);
            if (h.kind === 'wreck' && h.hp === 1) p.line({ x: x - radiusX * .6, y: y - radiusY * .3 },
                { x: x + radiusX * .4, y: y + radiusY * .4 }, C.panel, .22);
        }
    }
    const x = field.x + f.lane * field.w, y = field.y + RULES.pilotY * field.h;
    if (f.targetLane !== null) {
        const targetX = field.x + f.targetLane * field.w, targetY = field.y + field.h * .95;
        p.line({ x: targetX - .7, y: targetY }, { x: targetX, y: targetY + .5 }, color, .2);
        p.line({ x: targetX, y: targetY + .5 }, { x: targetX + .7, y: targetY }, color, .2);
    }
    const size = compact ? 1.55 : 2.6;
    p.poly([[x - size * .4, y + size * .7], [x, y + size * (1.15 + Math.sin(f.age * 25) * .15)], [x + size * .4, y + size * .7]], C.amber);
    const wing = RULES.pilotRadius * field.w;
    p.poly([[x, y - size], [x + wing, y + size * .7], [x, y + size * .35], [x - wing, y + size * .7]], f.firedUntil > w.time ? C.ink : color);
    p.disk(x, y, size * .61, C.bg, 12);
    p.text(f.count, x, y - (compact ? 1.05 : 1.3), compact ? 2.2 : 2.8, C.ink, 'center');
    if (hit) p.text(`-${f.lastDamage}`, x, y - size - 1.5, 1.6, C.red, 'center');
    if (crossing) p.text('!', r.x + r.w - 7, r.y + 1, 1.5, C.amber, 'center');
    const ready = 1 - clamp((f.nextShot - w.time) / RULES.fireCooldown, 0, 1);
    p.box(r.x + 1.3, r.y + r.h - .7, (r.w - 2.6) * ready, .18, color);
}

function draw(game, ui) {
    const p = ui.painter, w = game.world;
    p.begin(); ui.hits = []; p.box(0, 0, 160, 90, C.bg);
    if (w.phase === 'lobby') { drawLobby(game, ui, p); drawSaveStatus(game, ui, p); p.end(); return; }
    const flights = w.active(ui.id), faction = w.faction(ui.id), color = faction ? COLORS[faction.color] : C.muted;
    const l = layout(flights.length); ui.layout = l;

    p.text(`${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, '0')}`, 156, 4, 2.2, C.muted, 'right');
    w.factions.forEach((f, i) => {
        const x = 3 + i * 24;
        p.disk(x + .6, 4.9, .4, COLORS[f.color], 6);
        p.text(`${f.id === ui.id ? 'YOU' : f.name.slice(0, 6)}  ${w.owned(f.id).length}`, x + 2, 4, 2, COLORS[f.color]);
        if (f.id === ui.id) p.box(x, 7.8, 21, .2, color);
    });
    drawGalaxy(game, ui, p, l.galaxy);
    flights.forEach((f, i) => drawFlight(game, ui, p, f, l.panels[i], i));
    [.25, .5, 1].forEach((v, i) => button(p, ui, { x: 3 + i * 12, y: 83, w: 10.5, h: 6 },
        `${v * 100}%`, { type: 'percent', value: v }, ui.percent === v, color));
    const selected = w.planets[ui.selected];
    if (ui.noticeUntil > w.time) p.text(ui.notice, 43, 84.5, 2.1, C.amber);
    else if (selected?.owner === ui.id) p.text(`${selected.name} / ${Math.floor(selected.ships * ui.percent)}`, 43, 84.5, 2.1, color);
    else if (faction && w.alive(ui.id)) { const map = MAPS.find(m => m.id === w.mapId); p.text(`${MAPS.indexOf(map) + 1} / ${MAPS.length}   ${map.name.toUpperCase()}`, 43, 84.5, 2, C.muted); }
    if (!faction || !w.alive(ui.id)) p.text(faction ? 'ELIMINATED' : 'SPECTATING', 82, 84.5, 2.3, C.muted);
    for (let i = 0; i < 6; i++) p.disk(144 + i * 2.2, 86.2, .45, i < flights.length ? color : C.line, 8);
    if (w.phase === 'gameover') {
        // Draw an exclusive results scene: pooled text from the galaxy must not
        // render over the result card (text and geometry have separate pools).
        p.begin(); ui.hits = []; p.box(0, 0, 160, 90, C.bg); stars(p, { x: 0, y: 0, w: 160, h: 90 }, 50);
        const winner = w.faction(w.winner), wc = winner ? COLORS[winner.color] : C.ink;
        p.text(w.resultReason === 'defeat' ? 'DEFEATED' : winner ? winner.name.toUpperCase() : 'DRAW', 80, 33, 7, wc, 'center');
        const map = MAPS.find(m => m.id === w.mapId), at = MAPS.indexOf(map), completed = Object.keys(game.cleared).length;
        if (winner) p.text(game.soloVictory && completed === MAPS.length ? 'GALAXY SECURED' : game.soloVictory ? map.name.toUpperCase() + ' SECURED' : 'WINS', 80, 47, 3, C.muted, 'center');
        if (game.soloVictory) {
            const seconds = game.cleared[map.id];
            p.text(`${completed} / ${MAPS.length} CLEARED${seconds ? '   ·   BEST ' + Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0') : ''}`, 80, 54, 2, C.mint, 'center');
        }
        const next = game.soloVictory && game.players.size === 1 && at + 1 < MAPS.length;
        button(p, ui, { x: next ? 39 : 62, y: 63, w: 36, h: 8 }, game.hostId === ui.id ? 'PLAY AGAIN' : 'WAITING', { type: 'lobby' }, !next && game.hostId === ui.id);
        if (next) button(p, ui, { x: 81, y: 63, w: 40, h: 8 }, MAPS[at + 1].sector !== map.sector ? 'NEXT SECTOR' : 'NEXT MAP', { type: 'nextMap' }, true);
    }
    drawSaveStatus(game, ui, p); p.end();
}

function drawSaveStatus(game, ui, p) {
    if (!game.saveFailed) return;
    const r = { x: 45, y: game.world.phase === 'lobby' ? 11 : 8, w: 70, h: 7 };
    p.box(r.x, r.y, r.w, r.h, C.panel);
    p.text(game.hostId === ui.id ? 'Progress not saved - tap to retry' : 'Progress not saved', 80, r.y + 2, 2.3, C.amber, 'center');
    if (game.hostId === ui.id) ui.hits.push({ ...r, action: { type: 'retrySave' } });
}

module.exports = { Painter, draw, layout, inside, C, COLORS };
