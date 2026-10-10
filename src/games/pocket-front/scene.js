const { UNIT_TYPES, BUILD_TYPES, WAVE_NAMES } = require('./settings');

// Every mark is a small, flat shape. Nothing is fetched, and the battlefield
// uses the same coordinates as the simulation and its placement obstacles.
const C = {
    bg: [13, 23, 39, 255], panel: [22, 37, 55, 255], card: [32, 50, 69, 255],
    edge: [51, 73, 89, 255], white: [240, 249, 239, 255], dim: [160, 184, 190, 255],
    mint: [111, 244, 186, 255], teal: [29, 161, 143, 255], darkTeal: [22, 104, 107, 255],
    gold: [255, 212, 92, 255], goldDark: [195, 138, 54, 255],
    red: [255, 111, 120, 255], pink: [215, 64, 123, 255], purple: [119, 64, 121, 255],
    grass: [158, 202, 132, 255], grassLight: [174, 216, 145, 255], grassDark: [137, 185, 115, 255],
    road: [208, 210, 159, 255], roadEdge: [184, 190, 140, 255], track: [232, 231, 184, 255],
    ground: [96, 139, 97, 255], rock: [99, 139, 133, 255], rockTop: [154, 187, 165, 255],
    leaf: [56, 142, 108, 255], leafTop: [80, 167, 111, 255],
    ink: [30, 65, 64, 255], clear: [0, 0, 0, 0],
};
const cap = (n, a, b) => Math.max(a, Math.min(b, n));
const alpha = (color, a) => [color[0], color[1], color[2], Math.round(cap(a, 0, 1) * 255)];
const number = n => Math.max(0, Math.floor(Number(n) || 0));
const living = list => (list || []).filter(v => v.hp === undefined || v.hp > 0);

function ring(p, x, y, r, color, width = .25, points = 12) {
    const verts = [];
    for (let i = 0; i <= points; i++) {
        const a = i * Math.PI * 2 / points;
        verts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    p.poly(verts, C.clear, color, width);
}
function diamond(p, x, y, r, fill) {
    p.poly([[x, y - r], [x + r, y], [x, y + r], [x - r, y], [x, y - r]], fill, null, 0);
}
function health(p, x, y, width, hp, max, color = C.mint, compact = false) {
    if (compact) {
        p.rect(x - width / 2, y, Math.max(.05, width * cap(hp / (max || 1), 0, 1)), .5, color);
        return;
    }
    p.rect(x - width / 2, y, width, .65, C.ink);
    p.rect(x - width / 2 + .13, y + .13, Math.max(.02, (width - .26) * cap(hp / (max || 1), 0, 1)), .39, color);
}
function coin(p, x, y, r = 1.4) {
    p.rect(x - r, y - r * .7, r * 2, r * 1.4, C.goldDark);
    p.rect(x - r * .72, y - r, r * 1.44, r * 1.62, C.gold);
    p.rect(x - r * .15, y - r * .57, r * .3, r * .88, C.white);
}
function button(p, label, x, y, w, h, action, color = C.card, textColor = C.white) {
    p.rect(x, y + .45, w, h, C.bg);
    p.rect(x, y, w, h, color);
    p.text(label, x + w / 2, y + (h - 1.85) / 2, 1.85, textColor, 'center');
    p.hit(x, y, w, h, action);
}
function wrap(p, value, x, y, width, size = 1.8, color = C.dim, maxLines = 3) {
    const words = String(value || '').split(/\s+/), limit = Math.max(8, Math.floor(width / (size * .53)));
    let line = '', row = 0;
    for (const word of words) {
        if (line && `${line} ${word}`.length > limit) {
            p.text(line, x, y + row * (size + .9), size, color);
            if (++row >= maxLines) return;
            line = word;
        } else line += (line ? ' ' : '') + word;
    }
    if (line && row < maxLines) p.text(line, x, y + row * (size + .9), size, color);
}

function soldier(p, type, x, y, scale = 1, enemy = false, angle = 0, time = 0, compact = false) {
    const main = enemy ? C.red : C.mint, side = enemy ? C.pink : C.teal;
    const s = scale;
    if (compact) {
        if (type === 'tank' || type === 'boss' || type === 'artillery') {
            const k = type === 'boss' ? 1.45 : 1;
            p.rect(x - 2.8 * s * k, y - 1.9 * s * k, 5.6 * s * k, 4 * s * k, side);
            p.rect(x - 1.8 * s * k, y - 1.15 * s * k, 3.6 * s * k, 2.3 * s * k, type === 'artillery' ? C.gold : main);
            p.line(x, y, x + Math.cos(angle) * 3.8 * s * k, y + Math.sin(angle) * 3.8 * s * k, C.ink, .8 * s * k);
        } else {
            p.rect(x - 1.1 * s, y - .4 * s, 2.2 * s, 2.1 * s, side);
            p.rect(x - 1.5 * s, y - 2 * s, 3 * s, 1.7 * s, type === 'runner' ? C.gold : main);
            if (type === 'medic') p.text('+', x, y - .6 * s, 1.7, C.white, 'center');
        }
        return;
    }
    if (type === 'tank' || type === 'boss') {
        const k = type === 'boss' ? 1.45 : 1;
        p.rect(x - 2.8 * s * k, y - 1.9 * s * k, 5.6 * s * k, 4.3 * s * k, C.ink);
        p.rect(x - 2.7 * s * k, y - 2 * s * k, 5.4 * s * k, .8 * s * k, side);
        p.rect(x - 2.7 * s * k, y + 1.2 * s * k, 5.4 * s * k, .8 * s * k, side);
        p.rect(x - 2.15 * s * k, y - 1.25 * s * k, 4.3 * s * k, 2.5 * s * k, main);
        p.line(x, y, x + Math.cos(angle) * 3.9 * s * k, y + Math.sin(angle) * 3.9 * s * k, side, .85 * s * k);
        p.rect(x - .9 * s * k, y - .8 * s * k, 1.8 * s * k, 1.6 * s * k, C.white);
        return;
    }
    if (type === 'artillery') {
        p.rect(x - 2.4 * s, y - 1.3 * s, 4.8 * s, 3.3 * s, C.ink);
        p.rect(x - 1.9 * s, y - 1.65 * s, 3.8 * s, 2.8 * s, C.pink);
        p.rect(x - 1.2 * s, y - 2.5 * s, 2.4 * s, 1.2 * s, C.gold);
        p.line(x, y - .3 * s, x + Math.cos(angle) * 3.4 * s, y + Math.sin(angle) * 3.4 * s, C.purple, 1.1 * s);
        return;
    }
    const bob = type === 'runner' ? Math.sin(time * 14 + x) * .24 * s : 0;
    p.rect(x - 1.45 * s, y + .6 * s, 2.9 * s, 1.45 * s, C.ground);
    p.rect(x - 1.1 * s, y - .5 * s + bob, 2.2 * s, 2 * s, side);
    p.rect(x - 1.45 * s, y - 2 * s + bob, 2.9 * s, 1.75 * s, main);
    p.rect(x - .88 * s, y - 1.35 * s + bob, 1.76 * s, .43 * s, C.ink);
    if (type === 'medic') {
        p.rect(x - .25 * s, y - .17 * s, .5 * s, 1.35 * s, C.white);
        p.rect(x - .67 * s, y + .25 * s, 1.34 * s, .5 * s, C.white);
    } else if (type === 'runner') {
        p.poly([[x - .7 * s, y - 2.15 * s], [x + .8 * s, y - 2.15 * s], [x, y - 3.15 * s]], C.gold, null, 0);
    } else p.line(x + .7 * s, y + .3 * s, x + .7 * s + Math.cos(angle) * 1.75 * s,
        y + .3 * s + Math.sin(angle) * 1.75 * s, C.ink, .58 * s);
}

function structure(p, type, x, y, scale = 1, level = 1, compact = false) {
    const s = scale;
    if (compact && type !== 'hq') {
        p.rect(x - 3.2 * s, y - 2.5 * s, 6.4 * s, 5 * s, type === 'refinery' ? C.goldDark : C.darkTeal);
        p.rect(x - 2.5 * s, y - 3 * s, 5 * s, 2 * s, type === 'refinery' ? C.gold : C.mint);
        if (type === 'refinery') p.rect(x - 1.6 * s, y - .6 * s, 3.2 * s, 1.6 * s, C.ink);
        else p.line(x, y, x + (type === 'mortar' ? 1.5 : 4) * s, y - (type === 'mortar' ? 3 : 1) * s, C.ink, 1.1 * s);
        return;
    }
    p.rect(x - 3.7 * s, y - 2.2 * s, 7.4 * s, 5.4 * s, C.ground);
    if (type === 'hq') {
        p.rect(x - 4.5 * s, y - 3 * s, 9 * s, 5.7 * s, C.darkTeal);
        p.rect(x - 4.5 * s, y - 4.1 * s, 9 * s, 2 * s, C.mint);
        p.rect(x - 1.35 * s, y - .8 * s, 2.7 * s, 3.5 * s, C.ink);
        p.rect(x - 3.45 * s, y - 1.45 * s, 1.3 * s, 1.5 * s, C.gold);
        p.rect(x + 2.15 * s, y - 1.45 * s, 1.3 * s, 1.5 * s, C.gold);
        p.rect(x - 3.55 * s, y - 7 * s, 1.55 * s, 3.15 * s, C.darkTeal);
        p.rect(x - 3.8 * s, y - 7.25 * s, 2.05 * s, .7 * s, C.white);
        p.line(x + 3.2 * s, y - 4 * s, x + 3.2 * s, y - 8 * s, C.ink, .34 * s);
        p.poly([[x + 3.2 * s, y - 8 * s], [x + 6.2 * s, y - 7.4 * s], [x + 3.2 * s, y - 6.2 * s]], C.mint, null, 0);
        if (level > 1) p.rect(x - .6 * s, y - 5.1 * s, 1.2 * s, .8 * s, C.gold);
    } else if (type === 'refinery') {
        p.rect(x - 3.1 * s, y - 2.9 * s, 6.2 * s, 5.3 * s, C.goldDark);
        p.rect(x - 3.1 * s, y - 3.6 * s, 6.2 * s, 1.2 * s, C.gold);
        p.rect(x - 2.2 * s, y - 1.7 * s, 1.55 * s, 2.7 * s, C.ink);
        p.rect(x + .6 * s, y - 1.7 * s, 1.55 * s, 2.7 * s, C.ink);
        coin(p, x, y - 3.6 * s, .9 * s);
    } else if (type === 'mortar') {
        p.rect(x - 2.7 * s, y - 2.2 * s, 5.4 * s, 4.5 * s, C.teal);
        p.rect(x - 2.1 * s, y - 2.7 * s, 4.2 * s, 3.5 * s, C.mint);
        p.line(x - .6 * s, y + .3 * s, x + 1.5 * s, y - 3.2 * s, C.ink, 1.5 * s);
        p.rect(x + .75 * s, y - 3.85 * s, 1.8 * s, 1.2 * s, C.white);
    } else {
        p.rect(x - 2.5 * s, y - 2.2 * s, 5 * s, 4.5 * s, C.darkTeal);
        p.rect(x - 2.35 * s, y - 2.8 * s, 4.7 * s, 2.2 * s, C.mint);
        p.rect(x - .45 * s, y - 1.5 * s, 4.6 * s, .9 * s, C.ink);
        p.rect(x - 1.1 * s, y - 1.9 * s, 2.2 * s, 1.6 * s, C.white);
    }
}

function terrain(p, e, compact) {
    p.rect(3.5, 16.5, 116, 59, C.ink);
    p.rect(4, 17, 115, 58, C.grass);
    for (let i = 0; i < (compact ? 8 : 18); i++) {
        const x = 7 + (i * 19.7) % 104, y = 19 + (i * 11.3) % 49;
        p.rect(x, y, 5 + i % 4, 3 + i % 3, i % 2 ? C.grassLight : C.grassDark);
    }
    p.rect(25, 23, 6.5, 46, C.roadEdge);
    for (const y of [25, 46, 67]) {
        p.rect(26, y - 3.6, 93, 7.2, C.roadEdge);
        p.rect(27, y - 2.9, 92, 5.8, C.road);
        for (let x = 35; x < 111; x += compact ? 24 : 12) p.rect(x, y - .18, 4, .36, C.track);
        p.poly([[113, y - 1.3], [111.5, y], [113, y + 1.3]], C.red, null, 0);
    }
    p.rect(9, 37, 17, 18, C.roadEdge);
    p.rect(10, 38, 15, 16, C.road);
    for (const rock of (e.terrain || []).slice(0, 14)) {
        const r = rock.radius || 2;
        p.poly([[rock.x - r, rock.y + r * .65], [rock.x - r * 1.1, rock.y - r * .3],
            [rock.x - r * .45, rock.y - r], [rock.x + r * .65, rock.y - r * .8],
            [rock.x + r, rock.y + r * .3], [rock.x + r * .45, rock.y + r * .9]], C.rock, null, 0);
        p.rect(rock.x - r * .45, rock.y - r * .6, r * .95, r * .75, C.rockTop);
    }
    for (const [x, y] of [[7, 20], [17, 20], [38, 72], [59, 19], [79, 73], [105, 20], [115, 73]]) {
        p.rect(x - 1.7, y - 1.3, 3.4, 2.6, C.leaf);
        p.rect(x - .8, y - 2.1, 2.6, 1.4, C.leafTop);
    }
}

function beacon(p, node, index, time) {
    const friendly = node.owner === 'player', enemy = node.owner === 'enemy';
    const color = friendly ? C.mint : enemy ? C.red : C.gold;
    ring(p, node.x, node.y, 4.6, alpha(C.ink, .33), .3);
    ring(p, node.x, node.y, 3.6, color, .42, 8);
    p.rect(node.x - 1.6, node.y - .5, 3.2, 2.4, C.ground);
    p.rect(node.x - 1, node.y - 1.3, 2, 2.4, C.ink);
    p.line(node.x, node.y - .6, node.x, node.y - 4, C.ink, .28);
    p.poly([[node.x, node.y - 4], [node.x + 2.5, node.y - 3.55 + Math.sin(time * 4) * .1],
        [node.x, node.y - 2.2]], color, null, 0);
    p.text(String(index + 1), node.x, node.y + 1.55, 1.7, C.ink, 'center');
    if (node.capturing && node.progress > 0) health(p, node.x, node.y + 4.5, 6, node.progress, 1,
        node.capturing === 'player' ? C.mint : C.red);
}

function battlefield(p, e, ui) {
    const dense = (e.units?.length || 0) + (e.enemies?.length || 0) > 50;
    terrain(p, e, dense);
    const time = e.time || 0;
    for (const [i, node] of (e.beacons || []).entries()) beacon(p, node, i, time);
    for (const crate of e.crates || []) {
        p.rect(crate.x - 1.7, crate.y - 1.5, 3.4, 3, C.goldDark);
        p.rect(crate.x - 1.4, crate.y - 1.8, 2.8, 1.2, C.gold);
        p.rect(crate.x - .22, crate.y - 1.7, .44, 3, C.white);
    }
    const base = e.base || { x: 18, y: 46, hp: 100, maxHp: 100, level: 1 };
    structure(p, 'hq', base.x, base.y, 1.05, base.level);
    health(p, base.x, base.y + 4.7, 10, base.hp, base.maxHp, base.hp / base.maxHp < .3 ? C.red : C.mint);
    p.text('HQ', base.x, base.y + 6.2, 1.7, C.ink, 'center');
    for (const building of living(e.buildings)) {
        structure(p, building.type, building.x, building.y, .83, building.level, dense);
        if (building.hp < building.maxHp) health(p, building.x, building.y + 3.3, 6, building.hp, building.maxHp, C.mint, dense);
    }
    if (e.rally && e.phase !== 'title') {
        const pulse = 2 + Math.sin(time * 5) * .45;
        ring(p, e.rally.x, e.rally.y, pulse, C.white, .24, 8);
        p.line(e.rally.x - .7, e.rally.y, e.rally.x + .7, e.rally.y, C.white, .22);
        p.line(e.rally.x, e.rally.y - .7, e.rally.x, e.rally.y + .7, C.white, .22);
    }
    for (const unit of living(e.units)) {
        if (unit.selected) ring(p, unit.x, unit.y + .3, unit.type === 'tank' ? 3.4 : 2.3, C.white, .28, 8);
        soldier(p, unit.type, unit.x, unit.y, unit.type === 'tank' ? .86 : .8, false, unit.angle || 0, time, dense);
        if (unit.selected || unit.hp < unit.maxHp) health(p, unit.x, unit.y + (unit.type === 'tank' ? 3 : 2.3), 3.9, unit.hp, unit.maxHp, C.mint, dense);
    }
    for (const unit of living(e.enemies)) {
        soldier(p, unit.type, unit.x, unit.y, unit.type === 'boss' ? 1 : .85, true, unit.angle ?? Math.PI, time, dense);
        if (unit.type === 'boss' || unit.hp < unit.maxHp) health(p, unit.x, unit.y + (unit.type === 'boss' ? 4.2 : 2.6),
            unit.type === 'boss' ? 8 : 3.9, unit.hp, unit.maxHp, C.red, dense);
    }
    for (const shot of (e.projectiles || []).slice(dense ? -28 : -40)) {
        const dx = shot.tx - shot.x, dy = shot.ty - shot.y, length = Math.hypot(dx, dy) || 1;
        const color = shot.type === 'heal' ? C.mint : shot.from === 'enemy' ? C.red : C.gold;
        p.line(shot.x - dx / length * 1.2, shot.y - dy / length * 1.2, shot.x, shot.y, color, shot.type === 'shell' ? .7 : .32);
    }
    for (const fx of (e.effects || []).slice(dense ? -12 : -20)) {
        const fade = cap(fx.life / (fx.maxLife || 1), 0, 1), r = (fx.radius || 2) * (1.4 - fade * .5);
        const color = fx.kind === 'heal' ? C.mint : fx.kind === 'capture' ? C.white : fx.kind === 'coin' ? C.gold : C.gold;
        if (fx.kind === 'coin') {
            if (fx.text) p.text(fx.text, fx.x, fx.y - (1 - fade) * 3, 1.7, alpha(C.gold, fade), 'center');
            else diamond(p, fx.x, fx.y, .9 * fade, C.gold);
        } else if (fx.kind === 'heal') {
            p.line(fx.x - r * .4, fx.y, fx.x + r * .4, fx.y, alpha(color, fade), .4);
            p.line(fx.x, fx.y - r * .4, fx.x, fx.y + r * .4, alpha(color, fade), .4);
        } else if (fx.kind === 'shot') diamond(p, fx.x, fx.y, .8 * fade, C.white);
        else ring(p, fx.x, fx.y, r, alpha(color, fade), .3 + fade * .5, 8);
    }
    if (ui.mode && ui.hover && ui.hover.x >= 8 && ui.hover.x <= 115 && ui.hover.y >= 21 && ui.hover.y <= 71) {
        ring(p, ui.hover.x, ui.hover.y, 4.5, C.white, .25, 8);
        p.rect(ui.hover.x - 3, ui.hover.y - 3, 6, 6, alpha(C.mint, .35));
    }
    if (ui.drag) {
        const { x1, y1, x2, y2 } = ui.drag, x = Math.min(x1, x2), y = Math.min(y1, y2);
        p.poly([[x, y], [x + Math.abs(x2 - x1), y], [x + Math.abs(x2 - x1), y + Math.abs(y2 - y1)],
            [x, y + Math.abs(y2 - y1)], [x, y]], alpha(C.mint, .16), C.white, .22);
    }
}

function hud(p, e, ui) {
    p.text('POCKET', 4, 3.4, 2.7, C.white); p.text('FRONT', 22.5, 3.4, 2.7, C.mint);
    p.text('TINY TROOPS. BIG PLANS.', 4, 8.5, 1.7, C.dim);
    p.rect(40, 2, 22, 9, C.panel); coin(p, 43.5, 6.4, 1.6);
    p.text(String(number(e.credits)), 47, 3.2, 3, C.gold);
    p.rect(64, 2, 23, 9, C.panel);
    p.text(e.endless ? 'ENDLESS' : 'WAVE', 66, 3, 1.7, C.dim);
    p.text(String(Math.max(1, number(e.wave))) + (e.endless ? '' : ' / ' + WAVE_NAMES.length), 84.7, 6, 2.3, C.white, 'right');
    const base = e.base || {};
    p.text('HEADQUARTERS', 91, 3, 1.7, C.dim);
    p.text(`${number(base.hp)} / ${number(base.maxHp)}`, 91, 6.4, 2.2, base.hp < base.maxHp * .3 ? C.red : C.mint);
    button(p, ui.paused ? 'PLAY' : 'II', 123, 3, 10, 7, 'pause');
    button(p, ui.sound === false ? 'OFF' : 'SFX', 135, 3, 11, 7, 'mute');
    button(p, '?', 148, 3, 9, 7, 'help');
    p.text('SUNNY FIELDS', 4, 13.5, 1.7, C.dim);
    const owned = (e.beacons || []).filter(b => b.owner === 'player').length;
    p.text(`${owned} / 3 FLAGS  ·  HOLD FOR INCOME`, 119, 13.5, 1.7, C.gold, 'right');
    p.rect(122, 15, 36, 72.5, C.panel);
    p.text('FIELD COMMAND', 125, 17.2, 1.9, C.white);
    const units = living(e.units), selected = units.filter(u => u.selected).length;
    p.rect(125, 22, 30, 9, C.card);
    p.text(`${selected} SEL.`, 127, 23.2, 1.8, C.mint);
    p.text(`${units.length}/${e.unitCap || 24}`, 127, 26.7, 1.7, C.dim);
    button(p, 'ALL [A]', 141, 23, 12, 6.5, 'selectAll', C.darkTeal, C.white);
    p.text('RECRUIT', 125, 33, 1.7, C.dim);
    for (const [i, type] of ['ranger', 'tank', 'medic'].entries()) {
        const spec = UNIT_TYPES[type], y = 36 + i * 6;
        p.rect(125, y, 30, 5.3, C.card);
        soldier(p, type, 128, y + 2.7, type === 'tank' ? .55 : .64);
        p.text(spec.name, 132.5, y + 1.5, 1.8, C.white);
        p.text(String(spec.cost), 153.4, y + 1.5, 1.8, e.credits >= spec.cost ? C.gold : C.red, 'right');
        p.hit(125, y, 30, 5.3, 'recruit:' + type);
    }
    p.text('BUILD', 125, 55, 1.7, C.dim);
    for (const [i, type] of ['turret', 'mortar', 'refinery'].entries()) {
        const spec = BUILD_TYPES[type], x = 125 + i * 10.4;
        p.rect(x, 58, 9.2, 12, ui.mode === type ? C.darkTeal : C.card);
        if (ui.mode === type) p.rect(x, 58, 9.2, .5, C.mint);
        structure(p, type, x + 4.6, 61.9, .55);
        p.text(type === 'refinery' ? 'MINT' : type === 'turret' ? 'GUN' : 'MORTAR', x + 4.6, 65, 1.7, C.white, 'center');
        p.text(String(spec.cost), x + 4.6, 67.5, 1.7, e.credits >= spec.cost ? C.gold : C.red, 'center');
        p.hit(x, 58, 9.2, 12, 'build:' + type);
    }
    button(p, 'HQ +1', 125, 72, 14.3, 5.5, 'upgradeBase');
    button(p, 'REPAIR', 140.7, 72, 14.3, 5.5, 'repairBase');
    p.text(String(e.baseUpgradeCost ?? 180), 132, 78.3, 1.7, C.gold, 'center');
    p.text(String(e.repairCost || 50), 148, 78.3, 1.7, C.gold, 'center');
    p.text(`+${Number(e.income || 0).toFixed(1)} COINS / SEC`, 140, 83.2, 1.7, C.mint, 'center');
    p.rect(4, 78, 115, 10, C.panel);
    const status = ui.mode ? `PLACE ${BUILD_TYPES[ui.mode]?.name.toUpperCase() || ui.mode.toUpperCase()} · ESC TO CANCEL`
        : e.phase === 'battle' ? `${e.waveLabel || 'BADBOTS INBOUND'} · ${living(e.enemies).length} IN THE FIELD`
            : 'BUILD YOUR SQUAD. DEFEND HQ.';
    p.text(status, 6, 79.6, 1.8, ui.mode ? C.mint : C.white);
    p.text('DRAG select · CLICK move / attack · A all · ESC cancel', 6, 84.1, 1.7, C.dim);
    if (e.phase === 'prep') button(p, 'START WAVE  [SPACE]', 80, 79.5, 37, 6.6, 'startWave', C.mint, C.bg);
    if (e.phase === 'battle' && e.waveDuration) {
        const progress = cap((e.waveTime || 0) / e.waveDuration, 0, 1);
        p.rect(4, 76, 115, .45, C.card); p.rect(4, 76, Math.max(.1, 115 * progress), .45, C.red);
    }
    const message = typeof e.message === 'string' ? e.message : e.message?.text;
    if (message && e.phase !== 'title' && (e.messageTime === undefined || e.messageTime > 0)) {
        const width = Math.min(103, message.length * 1.05 + 6);
        p.rect(61.5 - width / 2, 69.7, width, 4.7, alpha(C.bg, .9));
        p.text(message, 61.5, 71.1, 1.8, C.white, 'center');
    }
}

function modal(p, x, y, w, h) {
    p.rect(0, 0, 160, 90, alpha(C.bg, .77)); p.hit(0, 0, 160, 90, 'noop');
    p.rect(x, y + 1, w, h, C.bg); p.rect(x, y, w, h, C.panel);
    p.rect(x, y, w, .7, C.mint);
}
function title(p, e, ui) {
    modal(p, 9, 18, 142, 62);
    p.text('A LITTLE REAL-TIME STRATEGY GAME', 15, 22, 1.8, C.gold);
    p.text('POCKET', 14.5, 28, 9, C.white); p.text('FRONT', 14.5, 39, 9, C.mint);
    p.text('Build a tiny army. Make a big stand.', 15, 52, 2.3, C.white);
    p.text(`Recruit. Capture. Defend. Survive ${WAVE_NAMES.length} waves.`, 15, 57, 1.8, C.dim);
    p.poly([[99, 29], [142, 36], [142, 56], [110, 62], [90, 48]], C.grassDark, null, 0);
    p.poly([[99, 27], [142, 34], [142, 51], [110, 57], [90, 43]], C.grassLight, null, 0);
    p.rect(108, 40, 24, 4, C.road);
    structure(p, 'hq', 103, 38, 1.1, 1);
    soldier(p, 'tank', 122, 45, 2.3, false, -.2);
    soldier(p, 'ranger', 107, 51, 1.55, false, -.1);
    soldier(p, 'medic', 136, 49, 1.3, false);
    diamond(p, 140, 30, 2, C.gold); diamond(p, 95, 51, 1.15, C.white);
    button(p, 'DEPLOY YOUR ARMY', 15, 65, 39, 9, 'start', C.mint, C.bg);
    button(p, 'HOW TO PLAY', 58, 65, 29, 9, 'help');
    p.text(`BEST WAVE  ${number(ui.bestWave)}   /   BEST KILLS  ${number(ui.bestKills)}`, 144, 70, 1.7, C.dim, 'right');
}
function upgrade(p, e) {
    modal(p, 14, 19, 132, 57);
    p.text('NICE WORK, COMMANDER.', 80, 23, 1.8, C.gold, 'center');
    p.text('CHOOSE YOUR NEXT EDGE', 80, 28, 4, C.white, 'center');
    p.text('One free upgrade. Your army keeps it for the rest of the run.', 80, 34.5, 1.9, C.dim, 'center');
    const choices = e.upgrades || e.options || e.upgradeChoices || [];
    choices.slice(0, 3).forEach((choice, i) => {
        const x = 20 + i * 41;
        p.rect(x, 41, 38, 29, C.card); p.rect(x, 41, 38, .6, i === 1 ? C.gold : C.mint);
        if (i === 0) soldier(p, 'ranger', x + 6, 47, 1.25);
        else if (i === 1) coin(p, x + 6, 46.5, 2.2);
        else structure(p, 'turret', x + 6, 47, .78);
        p.text('0' + (i + 1), x + 34, 44, 2.4, C.dim, 'right');
        wrap(p, choice.name || 'FIELD UPGRADE', x + 3, 51.5, 32, 2.1, C.white, 2);
        wrap(p, choice.description || '', x + 3, 58, 32, 1.7, C.dim, 3);
        p.hit(x, 41, 38, 29, 'upgrade:' + i);
    });
}
function ending(p, e, ui) {
    const won = e.phase === 'won';
    modal(p, 30, 21, 100, 54);
    p.text(won ? `${WAVE_NAMES.length} WAVES. ONE TOUGH LITTLE ARMY.` : 'A BRAVE LITTLE LAST STAND.', 80, 25, 1.8, C.gold, 'center');
    p.text(won ? 'FRONT SECURED!' : 'HQ DOWN', 80, 32, 6, won ? C.mint : C.red, 'center');
    p.text(won ? 'The fields are yours. Keep the good times rolling.' : 'A fresh plan, a bigger squad, one more try.', 80, 42, 2, C.white, 'center');
    const kills = number(e.stats?.kills), waves = number(e.stats?.waves ?? (e.wave - 1));
    p.text(`${waves} WAVES HELD`, 49, 51, 2.3, C.white, 'center');
    p.text(`${kills} BADBOTS BUSTED`, 103, 51, 2.3, C.gold, 'center');
    if (won) {
        button(p, 'KEEP GOING', 41, 61, 36, 8, 'endless', C.mint, C.bg);
        button(p, 'NEW RUN', 82, 61, 36, 8, 'restart');
    } else button(p, 'DEPLOY AGAIN', 57, 61, 46, 8, 'restart', C.mint, C.bg);
}
function help(p) {
    modal(p, 31, 16, 98, 65);
    p.text('YOUR POCKET FIELD GUIDE', 80, 22, 3.8, C.white, 'center');
    const rows = [
        ['01', 'BUILD A SQUAD', 'Recruit Rangers, Tanks and Medics from the right panel.'],
        ['02', 'GIVE THE ORDERS', 'Drag a box to select. Click ground to move or a badbot to attack.'],
        ['03', 'MAKE IT YOURS', 'Stand by flags to capture income. Build defenses near your HQ.'],
        ['04', 'HOLD THE FRONT', `Keep HQ alive through ${WAVE_NAMES.length} waves. Pick an upgrade after each.`],
    ];
    rows.forEach(([id, heading, detail], i) => {
        const y = 31 + i * 9;
        p.text(id, 37, y, 2.4, C.mint);
        p.text(heading, 44, y, 1.9, C.white);
        wrap(p, detail, 44, y + 3, 77, 1.7, C.dim, 2);
    });
    button(p, 'GOT IT', 63, 71, 34, 7, 'help', C.mint, C.bg);
}
function pause(p) {
    modal(p, 47, 30, 66, 32);
    p.text('TAKE FIVE, COMMANDER.', 80, 35, 1.8, C.gold, 'center');
    p.text('FRONT ON HOLD', 80, 40, 4.2, C.white, 'center');
    button(p, 'BACK TO IT', 62, 51, 36, 7.5, 'pause', C.mint, C.bg);
}

function render(p, e, ui = {}) {
    p.rect(0, 0, 160, 90, C.bg);
    battlefield(p, e, ui);
    hud(p, e, ui);
    if (e.phase === 'title') title(p, e, ui);
    else if (e.phase === 'upgrade') upgrade(p, e);
    else if (e.phase === 'won' || e.phase === 'lost') ending(p, e, ui);
    if (ui.paused && e.phase !== 'title' && !ui.help) pause(p);
    if (ui.help) help(p);
}

module.exports = { render };
