const { C, RULES: R, SITES, WEAPONS, MODS, ENEMIES, CONTRACTS } = require('./settings');
const { clamp } = require('./engine');
const TAU = Math.PI * 2;
const polygon = (x, y, radius, count, angle = 0) => Array.from({ length: count + 1 }, (_, i) =>
    [x + Math.cos(i / count * TAU + angle) * radius, y + Math.sin(i / count * TAU + angle) * radius]);
const tint = (a, b, amount) => a.map((v, i) => i === 3 ? 255 : Math.round(v + (b[i] - v) * amount));
const format = n => Math.floor(n).toLocaleString('en-US');
const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function wrap(d, text, x, y, width, size = 1.2, color = C.dim) {
    const limit = Math.floor(width / (size * .56)); let line = '', row = 0;
    for (const word of text.split(' ')) {
        if ((line+' '+word).length > limit && line) { d.text(line, x, y + row++ * (size + 1.05), size, color); line = ''; }
        line += (line ? ' ' : '') + word;
    }
    if (line) d.text(line, x, y + row * (size + 1.05), size, color);
    return row + 1;
}

function cornerFrame(d, x, y, w, h, color, length = 2) {
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]])
        d.path([[cx, cy + sy * length], [cx, cy], [cx + sx * length, cy]], color, .12);
}
function ship(d, x, y, a, scale = 1, color = C.cyan, glow = false, recoil = 0) {
    const points = [[1.6 - recoil, 0], [-1.05, -.95], [-.45, 0], [-1.05, .95], [1.6 - recoil, 0]];
    d.poly(points.map(([xx, yy]) => [x + (xx * Math.cos(a) - yy * Math.sin(a)) * scale,
        y + (xx * Math.sin(a) + yy * Math.cos(a)) * scale]), tint(C.bg, color, .18), color, .17 * scale, 1, glow);
    d.line(x - Math.cos(a) * .25 * scale, y - Math.sin(a) * .25 * scale,
        x + Math.cos(a) * .8 * scale, y + Math.sin(a) * .8 * scale, C.white, .22 * scale);
}
function emblem(d, x, y, type, size, color, t = 0, glow = false) {
    if (type === 'foundry') {
        d.poly(polygon(x, y, size, 6, t * .08), tint(C.bg, color, .12), color, .18, 1, glow);
        d.poly(polygon(x, y, size * .5, 6, -t * .1), null, color, .12);
    } else if (type === 'reactor') {
        d.poly(polygon(x, y, size, 24), null, color, .18, 1, glow);
        d.poly(polygon(x, y, size * .65, 3, -Math.PI / 2 + t * .1), tint(C.bg, color, .2), color, .15);
    } else if (type === 'relay') {
        d.poly(polygon(x, y, size, 4, Math.PI / 4), tint(C.bg, color, .12), color, .18, 1, glow);
        d.line(x - size * .6, y, x + size * .6, y, color, .18);
        d.line(x, y - size * .6, x, y + size * .6, color, .18);
    } else {
        d.poly(polygon(x, y, size, 6, Math.PI / 6), tint(C.bg, color, .12), color, .23, 1, glow);
        d.poly(polygon(x, y, size * .68, 6, -t * .08), null, color, .1);
        d.poly(polygon(x, y, size * .3, 3, -Math.PI / 2), color);
    }
}
function backdrop(d, e) {
    d.rect(0, 0, 160, 90, C.bg);
    for (let i = 0; i < 42; i++) {
        const x = (i * 57.31 + 13.4) % 158 + 1, y = (i * 23.67 + 5) % 88 + 1;
        d.rect(x, y, i % 5 === 0 ? .14 : .08, i % 5 === 0 ? .14 : .08, C.dim, .18 + (i % 4) * .08);
    }
    d.line(6, 11, 154, 11, C.line, .08);
    d.line(6, 81, 154, 81, C.line, .08);

    d.text('SINGLE PILOT   /   SECTOR '+String(e.seed % 100000).padStart(5, '0'), 154, 5.3, 1.05, C.dim, 'right');
}
function footer(d, text = 'WASD  MOVE     HOLD MOUSE  AIM + FIRE     SPACE  DASH     P  PAUSE') {
    d.text(text, 6, 84.2, 1.06, C.dim);

}
function title(d, e) {
    backdrop(d, e);

    d.text('Capture worlds. Break the Citadel.', 9, 35, 2.3, C.white);
    d.button('COMMAND A FLEET', 9, 49, 32, 9, 'war', C.cyan);
    d.button('SOLO MISSIONS', 44, 49, 30, 9, 'start', C.line);
    d.button('PRACTICE', 9, 64, 32, 7, 'practice', C.line);
    d.button('HELP / H', 44, 64, 30, 7, 'guide', C.line);
    const x = 117, y = 44, t = e.time;
    for (let i = 0; i < 3; i++) d.poly(polygon(x, y, 13 + i * 6.5, 48), null, C.line, .07, .6);
    emblem(d, x, y, 'fortress', 10, C.red, t, true);
    d.text('THE CITADEL', x, y + 14, 1.2, C.red, 'center');
    const colors = [C.blue, C.orange, C.violet];
    ['reactor', 'foundry', 'relay'].forEach((type, i) => {
        const a = t * .035 + i * TAU / 3 - 1.1, px = x + Math.cos(a) * 26, py = y + Math.sin(a) * 26;
        d.line(px, py, x, y, colors[i], .08, .22);
        emblem(d, px, py, type, 2.8, colors[i], t);
        const q = (t * .11 + i * .3) % 1;
        d.poly(polygon(px + (x - px) * q, py + (y - py) * q, .4, 4), colors[i]);
    });
    const a = t * .16;
    ship(d, x + Math.cos(a) * 19.5, y + Math.sin(a) * 19.5, a + Math.PI / 2, 1.2, C.cyan, true);
    footer(d);
}
function sector(d, e) {
    backdrop(d, e);
    d.text('CHOOSE YOUR APPROACH', 8, 15.5, 2.9, C.white);
    d.text('Capture for support. Raid for supplies. Or strike the Citadel now.', 8, 21, 1.25, C.dim);
    d.text('TACTICAL MAP  /  TIME PAUSED', 8, 76.7, 1.0, C.teal);
    const home = { x: 12, y: 49 }, fortress = e.world.nodes[3];
    for (const n of e.world.nodes.slice(0, 3)) {
        d.line(home.x, home.y, n.x, n.y, C.line, .09);
        d.line(n.x, n.y, fortress.x, fortress.y, n.captured ? C.teal : C.line, .12);
        for (const convoy of e.world.convoys.filter(c => c.from === n.type && !n.captured)) {
            const q = convoy.progress;
            const px = n.x + (fortress.x - n.x) * q, py = n.y + (fortress.y - n.y) * q;
            d.poly(polygon(px, py, .38, 4), SITES[n.type].color, null, 0, .75);
        }
    }
    ship(d, home.x, home.y, 0, 1.4, C.cyan, true);
    d.text('YOU', home.x, home.y + 4, 1, C.cyan, 'center');
    e.world.nodes.forEach((n, i) => {
        const spec = SITES[n.type], selected = e.selected === i, color = n.captured ? C.cyan : spec.color;
        if (selected) {
            d.poly(polygon(n.x, n.y, n.type === 'fortress' ? 9.5 : 7, 36), null, color, .1, .45);
            cornerFrame(d, n.x - 8.5, n.y - 8.5, 17, 17, color, 1.6);
        }
        emblem(d, n.x, n.y, n.type, n.type === 'fortress' ? 5.5 : 3.8, color, e.time, selected);
        d.text(`${i + 1} / ${n.captured ? 'CAPTURED' : n.raided ? 'RAIDED / '+spec.name : spec.name}`, n.x, n.y + (n.type === 'fortress' ? 10.5 : 8.8), 1.05, color, 'center');
        d.hit(n.x - 9, n.y - 9, 18, 18, 'select'+i);
    });
    d.rect(118, 15, 36, 63, C.panel);
    const n = e.world.nodes[e.selected], spec = SITES[n.type];
    d.rect(118, 15, 36, .3, n.captured ? C.cyan : spec.color);
    d.text(n.captured ? 'FRIENDLY TERRITORY' : spec.role, 121, 19, 1, n.captured ? C.cyan : spec.color);
    d.text(spec.name, 121, 23, 2.35, C.white);
    wrap(d, spec.reward, 121, 29, 30, 1.18, C.dim);
    const contract = CONTRACTS.find(c => c.id === (n.contract === 'hunter' && e.owned('relay') ? 'clean' : n.contract));
    if (contract && !n.captured) {
        d.text('+25 SALVAGE / '+contract.title, 121, 35.5, .91, C.yellow);
        wrap(d, contract.description, 121, 38, 30, .9, C.dim);
    }
    d.line(121, 42, 151, 42, C.line, .08);
    d.text('CITADEL RESOURCES', 121, 45, 1.0, C.dim);
    const stocks = [['SHIELD', e.world.shields, C.blue, 60], ['HEAVIES', e.world.heavies, C.orange, 12], ['RESERVES', e.world.reserves, C.violet, 24]];
    stocks.forEach(([name, v, color, max], i) => {
        d.text(name, 121, 49 + i * 5, .94, C.dim);
        d.text(v === 0 ? 'OFFLINE' : String(v), 151, 49 + i * 5, 1, v ? color : C.cyan, 'right');
        d.rect(121, 51.5 + i * 5, 30, .35, C.line);
        if (v) d.rect(121, 51.5 + i * 5, 30 * Math.min(1, v / max), .35, color);
    });
    if (!n.captured) {
        d.button(n.type === 'fortress' ? 'ASSAULT CITADEL' : 'CAPTURE / PERMANENT', 121, 65, 30, 5, 'deploy', spec.color);
        if (n.type !== 'fortress' && !n.raided) d.button('RAID / HALVE STOCKPILE', 121, 72, 30, 4, 'raid', C.line);
        else if (n.raided) d.text('RAID USED / CAPTURE AVAILABLE', 136, 73.5, .9, C.dim, 'center');
    } else wrap(d, spec.support, 121, 67, 30, 1.1, C.cyan);
    d.button('REPAIR +2 / 20', 6, 83, 24, 4.5, 'repair', e.salvage >= 20 && e.player.hp < e.player.maxHp ? C.cyan : C.line);
    d.button('MODULE / 60', 33, 83, 24, 4.5, 'buy', e.salvage >= 60 ? C.yellow : C.line);
    d.text('SALVAGE '+e.salvage+'   HULL '+e.player.hp+'/'+e.player.maxHp+'   ALERT '+e.alert, 62, 84.2, 1.15, C.white);
    d.text('1–4 SELECT   ENTER CAPTURE   F RAID   H HELP', 154, 87.6, .9, C.dim, 'right');
    d.text(WEAPONS.find(w => w.id === e.weapon).name+' / '+Object.keys(e.upgrades).length+' MODS', 154, 84.3, 1.1, C.cyan, 'right');
}
function arenaGrid(d, e) {
    d.rect(0, 0, 160, 90, C.bg);
    const p = e.player;
    const warp = (x, y) => {
        if (e.reduced) return [x, y];
        const dx = x - p.x, dy = y - p.y, dist = Math.hypot(dx, dy) || 1;
        const strength = Math.exp(-dist * dist / 220) * (p.dash > 0 ? 1.1 : .45);
        let xx = x + dx / dist * strength, yy = y + dy / dist * strength;
        for (const r of e.rings) if (r.life > 0) {
            const rx = x - r.x, ry = y - r.y, rd = Math.hypot(rx, ry) || 1;
            const edge = r.size * (1 - Math.pow(r.life / r.max, 2));
            const ripple = Math.exp(-Math.pow(rd - edge, 2) / 9) * (r.life / r.max) * .9;
            xx += rx / rd * ripple; yy += ry / rd * ripple;
        }
        return [xx, yy];
    };
    for (let x = 8; x <= 152; x += 8) {
        const pts = []; for (let y = 16; y <= 77; y += 6.1) pts.push(warp(x, y));
        d.path(pts, C.grid, .06);
    }
    for (let y = 17; y <= 77; y += 6) {
        const pts = []; for (let x = 6; x <= 154; x += 8) pts.push(warp(x, y));
        d.path(pts, C.grid, .06);
    }
    d.poly([[9, 16], [151, 16], [154, 19], [154, 74], [151, 77], [9, 77], [6, 74], [6, 19], [9, 16]], null, C.line, .14);
    cornerFrame(d, 6, 16, 148, 61, C.teal, 4);
    d.text('N', 80, 17.2, .8, C.teal, 'center');
    if (e.campaignArena) return;
    if (!e.boss && !e.practice && e.mission.mode === 'raid') {
        const ready = e.structures.find(s => s.priority).hp <= 0;
        d.poly(polygon(80, 69, 6, 32), null, ready ? C.cyan : C.line, .18, ready ? .9 : .3);
        d.text(ready ? 'EXTRACT' : 'EXTRACTION', 80, 68, 1.15, ready ? C.cyan : C.dim, 'center');
        if (e.capture > 0) d.arc(80, 69, 6.7, -Math.PI / 2, e.capture / 1.5 * TAU, C.cyan, .3);
    } else if (!e.boss && !e.practice) {
        const active = e.structures.every(s => s.hp <= 0);
        d.poly(polygon(80, 44, 8, 40), null, active ? (e.captureBlocked ? C.orange : C.cyan) : C.line, .13, active ? .7 : .35);
        if (active) {
            d.poly(polygon(80, 44, 7.4, 40), null, C.teal, .09);
            if (e.capture > 0) d.arc(80, 44, 8.7, -Math.PI / 2, e.capture / R.captureTime * TAU, C.cyan, .35);
            d.text(e.mission.guardPending || e.enemies.some(v => v.life > 0 && v.id === e.mission.guardId) ? 'BREAK THE GUARD' : e.captureBlocked ? 'CONTESTED' : 'HOLD HERE', 80, 41, 1.1, e.captureBlocked ? C.orange : C.cyan, 'center');
            d.text(Math.floor(e.capture / R.captureTime * 100)+'%', 80, 44, 2.2, C.white, 'center');
        } else {
            d.line(78, 44, 82, 44, C.line, .1); d.line(80, 42, 80, 46, C.line, .1);
        }
    }
}
function enemy(d, e, time) {
    if (e.spawn > 0) {
        const k = e.spawn / .8;
        d.poly(polygon(e.x, e.y, e.r + k * 3, 4, time), null, e.color, .12, .6);
        d.line(e.x - .5, e.y, e.x + .5, e.y, e.color, .1);
        return;
    }
    const color = e.flash > 0 ? tint(e.color, C.white, e.flash) : e.chill > 0 ? C.blue : e.color;
    const body = tint(C.bg, color, .18 + e.flash * .5);
    const n = e.type === 'shooter' || e.type === 'charger' ? 3 : e.type === 'heavy' || e.type === 'bomber' ? 6 : e.type === 'warden' ? 5 : 4;
    const angle = e.type === 'weaver' ? time * 1.6 + e.phase : e.type === 'carrier' ? Math.PI / 4 : e.type === 'charger' && e.attack !== 'idle' ? e.lockAngle : e.angle;
    const pulse = (!e.kind || e.targeting) && e.shot < .45 && ['shooter', 'heavy'].includes(e.type) ? 1 + .18 * Math.sin(time * 30) : 1;
    d.poly(polygon(e.x, e.y, e.r * pulse * (1 + e.flash * .2), n, angle), body, color, .18, 1, e.elite && e.flash > .7);
    if (e.elite) d.poly(polygon(e.x, e.y, e.r + .65, 4, -time), null, C.yellow, .13, .9);
    if (e.shieldFlash > 0) d.arc(e.x, e.y, e.r + .7, 0, TAU, C.blue, .2);
    if (e.type === 'carrier') {
        d.line(e.x - 1, e.y, e.x + 1, e.y, C.white, .22);
        d.text('CARGO', e.x, e.y - 4, .9, C.blue, 'center');
        d.rect(e.x - 2, e.y + 3, 4 * e.hp / e.maxHp, .25, C.blue);
    } else if (e.type === 'heavy') {
        d.poly(polygon(e.x, e.y, .7, 6, -angle), color);
        d.rect(e.x - 1.8, e.y + 3, 3.6 * e.hp / e.maxHp, .22, color);
        d.arc(e.x, e.y, e.r + .45, e.angle - 1.15, 2.3, C.yellow, .35);
    } else if (e.type === 'warden') {
        d.poly(polygon(e.x, e.y, e.r * .65, 5, -time * .6), null, C.blue, .16);
        d.poly(polygon(e.x, e.y, .4, 4, time), C.white);
    } else if (e.type === 'sniper') {
        d.line(e.x, e.y, e.x + Math.cos(angle) * 3, e.y + Math.sin(angle) * 3, color, .32);
        d.poly(polygon(e.x, e.y, .45, 4, angle), C.white);
    } else if (e.type === 'bomber') {
        d.poly(polygon(e.x, e.y, .7, 3, -time * 2), color);
        d.poly(polygon(e.x + Math.cos(time) * 2.4, e.y + Math.sin(time) * 2.4, .3, 4), C.orange);
    } else if (e.type === 'leech') {
        d.path([[e.x - 1, e.y - .5], [e.x + .5, e.y], [e.x - 1, e.y + .5]], C.white, .2);
        if (e.stolen) d.text(String(e.stolen)+'/5', e.x, e.y - 3.5, 1.1, C.green, 'center');
    } else {
        d.line(e.x, e.y, e.x + Math.cos(e.angle) * e.r * .55, e.y + Math.sin(e.angle) * e.r * .55, color, .2);
    }
    if ((!e.kind || e.targeting) && e.shot < .5 && (e.type === 'shooter' || e.type === 'heavy'))
        d.line(e.x + Math.cos(e.angle) * 2, e.y + Math.sin(e.angle) * 2,
            e.x + Math.cos(e.angle) * 10, e.y + Math.sin(e.angle) * 10, color, .08, .35);
    if (e.type === 'charger' && (e.attack === 'windup' || e.attack === 'charge')) {
        const end = rayEnd(e.x, e.y, e.lockAngle, 26);
        d.line(e.x, e.y, end[0], end[1], C.red, e.attack === 'charge' ? .4 : .16, .55);
        if (e.attack === 'windup') d.arc(e.x, e.y, e.r + .8, -Math.PI / 2, (1 - e.timer / .7) * TAU, C.red, .2);
    }
    if (e.kind === 'rail' && e.targeting && e.shot < .65) {
        const end = rayEnd(e.x, e.y, e.angle, 80);
        d.line(e.x, e.y, end[0], end[1], e.color, .11, .55);
    }
}
function rayEnd(x, y, a, length) {
    const dx = Math.cos(a), dy = Math.sin(a);
    if (dx > .0001) length = Math.min(length, (154 - x) / dx);
    if (dx < -.0001) length = Math.min(length, (6 - x) / dx);
    if (dy > .0001) length = Math.min(length, (77 - y) / dy);
    if (dy < -.0001) length = Math.min(length, (16 - y) / dy);
    return [x + dx * length, y + dy * length];
}
function combat(d, e, customHud) {
    const sx = e.reduced ? 0 : Math.sin(e.time * 83) * e.shake * .45;
    const sy = e.reduced ? 0 : Math.cos(e.time * 107) * e.shake * .3;
    d.offsetX = sx; d.offsetY = sy;
    arenaGrid(d, e);
    for (const h of e.hazards) if (h.life > 0) {
        const active = h.age >= h.warn, q = Math.min(1, h.age / h.warn);
        if (h.kind === 'beam') {
            const end = rayEnd(h.x, h.y, h.angle, h.length);
            d.line(h.x, h.y, end[0], end[1], C.violet, active ? 1.1 : .13, active ? .8 : .35 + q * .3);
            if (active) d.line(h.x, h.y, end[0], end[1], C.white, .24);
            else d.arc(h.x, h.y, 2.1, -Math.PI / 2, q * TAU, C.violet, .17);
        } else {
            const color = h.kind === 'pulse' ? C.blue : C.orange;
            d.poly(polygon(h.x, h.y, h.r, 26), active ? color : null, color, .15, active ? .24 : .5);
            d.arc(h.x, h.y, h.r, -Math.PI / 2, q * TAU, color, .25);
            d.poly(polygon(h.x, h.y, .5 + q * .3, 4, e.time), color);
        }
    }
    for (const barrel of e.barrels) {
        if (barrel.hp <= 0) { d.poly(polygon(barrel.x, barrel.y, 1.3, 4, .4), null, C.line, .08, .4); continue; }
        d.poly(polygon(barrel.x, barrel.y, 1.1, 6), tint(C.bg, C.orange, .2), C.orange, .15);
        d.line(barrel.x - .4, barrel.y - .4, barrel.x + .4, barrel.y + .4, C.yellow, .2);
        d.line(barrel.x + .4, barrel.y - .4, barrel.x - .4, barrel.y + .4, C.yellow, .2);
    }
    if (e.mission.carrier && e.enemies.some(v => v.type === 'carrier' && v.life > 0)) {
        d.line(10, 23, 149, 23, C.blue, .07, .3);
        d.text('INTERCEPT CARGO  →  DENY +3 RESERVES', 11, 19.5, .95, C.blue);
    }
    if (e.campaignArena) {
        const core = e.core;
        emblem(d, core.x, core.y, 'fortress', core.r, core.flash > .4 ? C.white : core.color, e.time, true);
        if (e.outpost.owner !== 1) d.text('CAPTURE', 80, 51, 1.05, core.color, 'center');
        d.rect(73, 53.5, 14, .5, C.line); d.rect(73, 53.5, 14 * core.hp / core.maxHp, .5, core.color);
        const { SOCKETS } = require('./war-settings');
        SOCKETS.forEach(([x, y], i) => {
            if (e.outpost.sockets[i]) return;
            const job = e.outpost.queue.find(q => q.socket === i);
            const building = e.war.panel === 'build' && e.war.buildTab === 'defenses' && e.outpost.owner === 1;
            if (!building && !job) return;
            const selected = building && e.war.socket === i;
            d.poly(polygon(x, y, 3.5, 6), null, selected ? C.cyan : C.line, .1);
            if (building && !job) {
                d.line(x - .8, y, x + .8, y, selected ? C.cyan : C.dim, .16);
                d.line(x, y - .8, x, y + .8, selected ? C.cyan : C.dim, .16);
            }
            if (job) {
                d.arc(x, y, 3.8, -Math.PI / 2, Math.max(0, 1 - job.remaining / job.duration) * TAU, C.yellow, .2);
            }
            if (building) d.hit(x - 4, y - 4, 8, 8, 'w:socket:'+i);
        });
    }
    for (const s of e.campaignArena ? [] : e.structures) {
        if (s.hp <= 0) {
            d.poly(polygon(s.x, s.y, 2.3, 6, s.angle), null, C.line, .1, .4);
            continue;
        }
        const color = s.flash > 0 ? C.white : s.type === 'shield' ? C.blue : SITES[e.mission.type].color;
        if (e.boss) d.line(s.x, s.y, e.boss.x, e.boss.y, C.blue, .1, .3 + Math.sin(e.time * 5) * .12);
        emblem(d, s.x, s.y, s.type === 'shield' ? 'reactor' : s.type, s.r, color, e.time);
        if (s.priority && e.mission.mode === 'raid') { cornerFrame(d, s.x - 4.5, s.y - 4.5, 9, 9, C.yellow, 1); d.text('RAID TARGET', s.x, s.y - 7, 1.15, C.yellow, 'center'); }
        d.rect(s.x - 2.5, s.y + 4, 5, .3, C.line);
        d.rect(s.x - 2.5, s.y + 4, 5 * s.hp / s.maxHp, .3, color);
    }
    if (e.boss && e.boss.hp > 0) {
        const b = e.boss, shield = e.structures.some(s => s.hp > 0);
        if (shield) d.poly(polygon(b.x, b.y, 6.5, 36), null, C.blue, .2, .55);
        if (b.shot < .6) d.poly(polygon(b.x, b.y, 5 + (1 - b.shot / .6) * 3, 30), null, C.red, .2, .55);
        emblem(d, b.x, b.y, 'fortress', 5, b.flash > 0 ? C.white : C.red, e.time, true);
        for (let i = 0; i < 6; i++) {
            const a = b.angle + i / 6 * TAU;
            d.line(b.x + Math.cos(a) * 5.4, b.y + Math.sin(a) * 5.4,
                b.x + Math.cos(a) * 6.1, b.y + Math.sin(a) * 6.1, C.red, .2);
        }
    }
    for (const g of e.gems) if (g.life > 0) {
        const a = g.life < 3 ? .3 + .6 * Math.abs(Math.sin(e.time * 8)) : .9;
        d.poly(polygon(g.x, g.y, .38, 4, g.angle), C.green, null, 0, a);
    }
    for (const b of e.bullets) if (b.life > 0) {
        const dx = Math.cos(b.angle), dy = Math.sin(b.angle);
        const length = b.trail || 2.8, width = b.width || .27;
        d.line(b.x - dx * length, b.y - dy * length, b.x, b.y, b.color || C.cyan, width);
        if (b.armorPiercing) d.line(b.x - dx * length * .6, b.y - dy * length * .6, b.x, b.y, C.white, width * .4);
    }
    const shieldTargets = new Set();
    for (const w of e.enemies) if (w.type === 'warden' && w.life > 0 && w.spawn <= 0) {
        for (const id of w.protected) {
            // Shared shields need one readable connection per target; leave room for the HUD.
            if (shieldTargets.size >= 8 || shieldTargets.has(id)) continue;
            const target = e.enemies.find(t => t.id === id && t.life > 0); if (!target) continue;
            shieldTargets.add(id);
            d.line(w.x, w.y, target.x, target.y, C.blue, .1, .35);
            d.arc(target.x, target.y, target.r + .55, e.time, Math.PI * 1.5, C.blue, .13);
        }
    }
    for (const enemyState of e.enemies) if (enemyState.life > 0) enemy(d, enemyState, e.time);
    if (e.campaignArena) {
        for (const ally of e.allies) if (ally.life > 0) enemy(d, ally, e.time);
        for (const bullet of e.friendlyShots) if (bullet.life > 0)
            d.line(bullet.x - Math.cos(bullet.angle) * 1.5, bullet.y - Math.sin(bullet.angle) * 1.5, bullet.x, bullet.y, C.cyan, .22);
    }
    for (const b of e.hostile) if (b.life > 0) {
        d.poly(polygon(b.x, b.y, .43, 4, e.time * 2), C.red, C.orange, .07);
    }
    for (const r of e.rings) if (r.life > 0) {
        const q = r.life / r.max;
        d.poly(polygon(r.x, r.y, r.size * (1 - q * q), 26), null, r.color, .15 + q * .1, q * .8);
        if (q > .86 && d.si < 610) d.poly(polygon(r.x, r.y, Math.min(2, r.size * .15) * q, 8), C.white, null, 0, (q - .86) * 4);
    }
    for (const p of e.particles) if (p.life > 0) {
        if (d.si > 635) break; // Keep player and HUD capacity under peak chain reactions.
        const q = p.life / p.max;
        d.line(p.x - p.vx * .028, p.y - p.vy * .028, p.x, p.y, p.color, Math.max(.06, p.size * q), q * .9);
    }
    const p = e.player;
    for (const l of e.links) if (l.life > 0) {
        const mx = (l.x + l.xx) / 2, my = (l.y + l.yy) / 2;
        d.path([[l.x, l.y], [mx - .5, my + .7], [mx + .6, my - .7], [l.xx, l.yy]], l.color, .2, l.life / l.max);
    }
    if (e.owned('foundry')) {
        const a = e.time * 1.8;
        ship(d, p.x + Math.cos(a) * 3, p.y + Math.sin(a) * 3, p.angle, .5, C.yellow);
    }
    {
        if (p.dash > 0) {
            d.line(p.x - p.dashX * 8, p.y - p.dashY * 8, p.x, p.y, C.cyan, 1.4, .14);
            d.line(p.x - p.dashX * 4, p.y - p.dashY * 4, p.x, p.y, C.white, .35, .65);
        }
        ship(d, p.x, p.y, p.angle, 1, e.overload > 0 ? C.violet : C.cyan, true, p.recoil);
        if (e.overload > 0) d.arc(p.x, p.y, 2.7, e.time * 3, Math.PI * 1.6, C.violet, .22);
        if (p.inv > 0) d.poly(polygon(p.x, p.y, 2, 20), null, C.cyan, .1, .3 + .15 * Math.sin(e.time * 25));
        if (p.recoil > .15) d.line(p.x + Math.cos(p.aim) * 1.5, p.y + Math.sin(p.aim) * 1.5,
            p.x + Math.cos(p.aim) * 2.9, p.y + Math.sin(p.aim) * 2.9, C.white, .48, p.recoil * 2);
    }
    if (e.input.fire) {
        const x = clamp(e.input.aimX, 7, 153), y = clamp(e.input.aimY, 17, 76);
        d.path([[x - 1.4, y - .55], [x - 1.4, y - 1.4], [x - .55, y - 1.4]], C.cyan, .1, .65);
        d.path([[x + .55, y + 1.4], [x + 1.4, y + 1.4], [x + 1.4, y + .55]], C.cyan, .1, .65);
    }
    for (const l of e.labels) if (l.life > 0) d.text(l.text, l.x, l.y, 1.05, l.color, 'center', l.life / l.max);
    d.offsetX = 0; d.offsetY = 0;
    if (customHud) customHud(d, e); else hud(d, e);
    if (e.flash > 0) {
        d.rect(0, 12, 1, 68, C.red, e.flash); d.rect(159, 12, 1, 68, C.red, e.flash);
        d.rect(0, 12, 160, .5, C.red, e.flash); d.rect(0, 79.5, 160, .5, C.red, e.flash);
    }
    if (e.paused) pause(d, e);
}
function hud(d, e) {
    d.rect(0, 0, 160, 13, C.bg); d.rect(0, 80, 160, 10, C.bg);
    d.line(6, 12, 154, 12, C.line, .09);

    const name = e.practice ? 'FLIGHT SCHOOL' : SITES[e.mission.type].name;
    d.text(name, 19, 3.4, 1.9, C.white);
    const weapon = WEAPONS.find(w => w.id === e.weapon);
    d.text(weapon.name+' / '+(e.practice ? '1–3 SWITCH WEAPON' : e.mission.mode.toUpperCase()+' / '+clock(e.mission.time)), 19, 7.7, 1.0, weapon.color);
    d.text('HULL', 64, 3.2, .9, C.dim);
    for (let i = 0; i < e.player.maxHp; i++) d.rect(64 + i * 2.7, 6.1, 1.9, 2.3, i < e.player.hp ? C.cyan : C.line);
    d.text('DASH', 91, 3.2, .9, C.dim);
    for (let i = 0; i < 2; i++) {
        d.rect(91 + i * 6, 6.1, 5, 2.3, C.line);
        const filled = i < e.player.charges ? 1 : i === e.player.charges ? e.player.recharge : 0;
        if (filled) d.rect(91 + i * 6, 6.1, 5 * filled, 2.3, i < e.player.charges ? C.blue : C.teal);
    }
    d.text(format(e.score).padStart(6, '0'), 134, 3.0, 3.4, C.white, 'right');
    d.text(e.overload > 0 ? 'OVERLOAD '+e.overload.toFixed(1)+'s' : e.flux >= 100 ? 'Q / OVERLOAD READY' : 'Q / FLUX '+Math.floor(e.flux)+'%', 108, 8.2, .92, e.flux >= 100 || e.overload > 0 ? C.violet : C.dim);
    d.rect(108, 10.3, 26, .45, C.line);
    d.rect(108, 10.3, 26 * (e.overload > 0 ? e.overload / (e.upgrades.battery ? 7 : 5) : e.flux / 100), .45, C.violet);
    d.text('x'+Math.floor(e.multiplier), 154, 2.5, 4.2, C.cyan, 'right');
    d.text(e.geoms+' GEOMS', 154, 8.2, .85, C.dim, 'right');
    d.rect(140, 11.4, 14, .25, C.line);
    if (e.combo > 0) d.rect(140, 11.4, 14 * e.combo / 5, .25, C.cyan);
    if (e.boss) {
        const shield = e.structures.some(s => s.hp > 0);
        d.text(shield ? 'DESTROY THE BLUE SHIELD PYLONS' : 'CORE PHASE '+e.boss.stage+' / FINISH THE SIEGE', 6, 82.4, 1.2, shield ? C.blue : C.red);
        d.rect(65, 83, 62, 1.1, C.line); d.rect(65, 83, 62 * e.boss.hp / e.boss.maxHp, 1.1, C.red);
        d.text(Math.ceil(e.boss.hp)+' / '+e.boss.maxHp, 131, 82.3, 1.1, C.red);
    } else {
        const remaining = e.structures.filter(s => s.hp > 0).length;
        const guard = e.mission.guardPending || e.enemies.some(v => v.life > 0 && v.id === e.mission.guardId);
        const objective = e.practice ? 'DASH STRIKES ENEMIES. Q UNLEASHES OVERLOAD.' : e.mission.mode === 'raid' ? (e.structures.find(s => s.priority).hp > 0 ? 'DESTROY THE GOLD MARKED UPLINK' : 'EXTRACT AT THE SOUTH BEACON') : remaining ? 'DISABLE UPLINKS  '+(3 - remaining)+' / 3' : guard ? 'BREAK THE ELITE GUARD / THEN HOLD CENTER' : 'CAPTURE THE CENTER  '+Math.floor(e.capture / R.captureTime * 100)+'%';
        d.text(objective, 6, 82.5, 1.15, C.cyan);
        const contract = CONTRACTS.find(c => c.id === e.mission.contract);
        d.text(e.practice ? '1–3 WEAPONS / H FIELD MANUAL' : contract ? contract.title+' / '+(e.contractComplete() ? 'ON TRACK' : 'BONUS +25') : 'GEOMS BUILD MULTIPLIER', 84, 82.8, 1.05, C.yellow);
    }
    d.text('WASD MOVE    MOUSE / ARROWS FIRE    SPACE DASH STRIKE    Q OVERLOAD', 6, 86.4, 1.0, C.dim);
    d.text('SALVAGE '+e.salvage+'    P PAUSE    H HELP    M SOUND    V MOTION', 154, 86.4, 1.0, C.dim, 'right');
    d.hit(146, 0, 14, 12, 'pause');
    if (e.bannerTime > 0) {
        const a = Math.min(1, e.bannerTime);
        d.rect(42, 68.5, 76, 5, C.panel, a * .95);
        d.text(e.banner, 80, 70, 1.25, C.white, 'center', a);
    }
}
function pause(d, e) {
    d.rect(0, 0, 160, 90, C.bg, .82);
    d.rect(51, 24, 58, 45, C.panel);
    cornerFrame(d, 51, 24, 58, 45, C.cyan);
    d.text('TAKE A BREATH', 80, 30, 4, C.white, 'center');
    d.text('Simulation paused. Your sector can wait.', 80, 38, 1.3, C.dim, 'center');
    d.button('RESUME', 60, 44, 40, 6, 'pause', C.cyan);
    d.button(e.practice ? 'LEAVE FLIGHT SCHOOL' : 'ABANDON RUN', 60, 53, 40, 5, 'leave', C.line);
    d.text('M  SOUND '+(e.sound ? 'ON' : 'OFF')+'    V  MOTION '+(e.reduced ? 'REDUCED' : 'FULL'), 80, 63, 1.05, C.dim, 'center');
}
function upgrade(d, e) {
    backdrop(d, e);
    const purchased = e.rewardInfo?.mode === 'purchase';
    d.text(purchased ? 'FIELD WORKSHOP' : 'TERRITORY CAPTURED', 80, 18, 4.5, C.cyan, 'center');
    const spec = SITES[e.mission?.type] || SITES[e.world.nodes[e.selected].type];
    d.text(purchased ? 'BUILD A WEAPON THAT CHANGES HOW YOU FIGHT.' : spec.effect.toUpperCase(), 80, 27, 1.35, C.white, 'center');
    d.text(purchased ? 'CHOOSE ONE FIELD MODIFICATION' : '+1 HULL / +20 SALVAGE'+(e.rewardInfo?.contract ? ' / CONTRACT COMPLETE +25' : ' / CHOOSE A MODIFICATION'), 80, 33, 1.1, C.dim, 'center');
    e.choices.forEach((m, i) => {
        const x = 11 + i * 48;
        d.rect(x, 42, 42, 29, C.panel); d.rect(x, 42, 42, .25, m.color);
        d.text('0'+(i + 1)+' / '+m.tag, x + 3, 46, 1, m.color);
        d.text(m.name, x + 3, 51, 2.4, C.white);
        wrap(d, m.text, x + 3, 56, 36, 1.18, C.dim);
        d.button('INSTALL', x + 3, 65, 36, 4.4, 'mod'+i, m.color);
    });
    d.button(e.rerolls ? 'REROLL USED' : 'REROLL / 15 SALVAGE', 61, 74, 38, 4.5, 'reroll', !e.rerolls && e.salvage >= 15 ? C.yellow : C.line);
    footer(d, '1–3 INSTALL    R REROLL    SALVAGE '+e.salvage+'    /    '+WEAPONS.find(w => w.id === e.weapon).name+' BUILD');
}
function loadout(d, e) {
    backdrop(d, e);
    d.text('CHOOSE YOUR INSTRUMENT', 80, 17, 4.3, C.white, 'center');
    d.text('Same ship. Three very different ways to break a formation.', 80, 26, 1.45, C.dim, 'center');
    WEAPONS.forEach((w, i) => {
        const x = 9 + i * 49;
        d.rect(x, 35, 44, 38, C.panel); d.rect(x, 35, 44, .3, w.color);
        d.text('0'+(i + 1)+' / '+w.role, x + 3, 39, 1.02, w.color);
        d.text(w.name, x + 3, 44, 4, C.white);
        w.text.forEach((line, j) => d.text(line, x + 3, 53 + j * 3, 1.25, C.dim));
        d.button('EQUIP '+w.name, x + 3, 65, 38, 5, 'weapon'+w.id, w.color);
    });
    footer(d, '1–3 EQUIP    SPACE DASH STRIKE    Q OVERLOAD    H FIELD MANUAL');
    d.text('GEOMS CHARGE OVERLOAD. DASH THROUGH BULLETS TO CHARGE FASTER.', 80, 77, 1.05, C.violet, 'center');
}
function guide(d, e) {
    backdrop(d, e);
    d.text('READ THE FORMATION', 8, 16, 3.7, C.white);
    d.text('SPACE strikes and absorbs bullets. Q at full flux clears danger and supercharges fire.', 8, 23, 1.25, C.cyan);
    ['charger', 'sniper', 'warden', 'heavy', 'bomber', 'leech', 'weaver', 'shooter'].forEach((type, i) => {
        const spec = ENEMIES[type], x = 8 + (i % 4) * 38, y = 31 + Math.floor(i / 4) * 22;
        d.rect(x, y, 35, 19, C.panel); d.rect(x, y, 35, .2, spec.color);
        enemy(d, { ...spec, type, x: x + 30, y: y + 4, r: Math.min(1.7, spec.r), spawn: 0, flash: 0, chill: 0,
            angle: -.4, phase: 0, shot: 2, hp: spec.hp, maxHp: spec.hp, attack: 'idle', stolen: 0 }, e.time);
        d.text(spec.name, x + 3, y + 3, 1.5, spec.color);
        wrap(d, spec.tip, x + 3, y + 8, 29, 1.2, C.white);
    });
    d.button('BACK TO THE FIGHT / H', 111, 75, 41, 4.5, 'guide', C.cyan);
    d.text('Gold rings mark elites. Orange fuel cells trigger friendly chain explosions.', 8, 76, 1.15, C.dim);
    footer(d, 'CAPTURE = PERMANENT SUPPORT   /   RAID = QUICK SUPPLIES, PRODUCTION CONTINUES');
}
function report(d, e) {
    backdrop(d, e); const reward = e.rewardInfo;
    d.text('STOCKPILE COMPROMISED', 80, 21, 4.8, C.yellow, 'center');
    d.text('You got in. You got out. Their factory is still running.', 80, 31, 1.5, C.dim, 'center');
    d.text('-'+reward.removed+' '+reward.resource.toUpperCase(), 80, 43, 4, C.white, 'center');
    d.text('+'+(reward.amount + reward.bonus)+' SALVAGE'+(reward.contract ? ' / BONUS CONTRACT COMPLETE' : '')+' / +6 ALERT', 80, 52, 1.5, C.yellow, 'center');
    d.button('RETURN TO SECTOR', 57, 64, 46, 6, 'map', C.cyan);
    footer(d, 'ENTER RETURN    /    SPEND SALVAGE ON REPAIRS OR MODULES BEFORE YOUR NEXT STRIKE');
}
function ending(d, e) {
    backdrop(d, e);
    const won = e.phase === 'won', color = won ? C.cyan : C.red;
    d.text(won ? 'SECTOR LIBERATED' : 'SIGNAL LOST', 80, 23, 6.8, color, 'center');
    d.text(won ? 'Their supply chain became your way in.' : 'The sector holds. Your next approach will be different.', 80, 34, 1.6, C.dim, 'center');
    const stats = [['SCORE', format(e.score)], ['BEST CHAIN', String(e.bestChain)], ['CAPTURES / RAIDS', e.operations+' / '+e.raids], ['RUN TIME', clock(e.runTime)]];
    stats.forEach(([label, value], i) => {
        const x = 33 + i * 31;
        d.text(value, x, 46, 3.7, C.white, 'center'); d.text(label, x, 52, 1, C.dim, 'center');
    });
    d.button('NEW SECTOR', 45, 63, 33, 6.5, 'new', C.cyan);
    d.button('RETRY THIS SEED', 82, 63, 33, 6.5, 'retry', C.line);
    d.text('BEST  '+format(e.best)+'    /    SEED  '+e.seed, 80, 74, 1.05, C.dim, 'center');
    footer(d, 'ENTER  NEW SECTOR     R  RETRY THIS SEED');
}
function render(d, e) {
    d.begin();
    if (e.guide) guide(d, e);
    else if (e.phase === 'loadout') loadout(d, e);
    else if (e.phase === 'report') report(d, e);
    else if (e.phase === 'combat' && e.paused) { backdrop(d, e); pause(d, e); }
    else if (e.phase === 'title') title(d, e);
    else if (e.phase === 'map') sector(d, e);
    else if (e.phase === 'combat') combat(d, e);
    else if (e.phase === 'upgrade') upgrade(d, e);
    else ending(d, e);
    d.end();
}
module.exports = { render, polygon, ship, emblem, wrap, combat, enemy };
